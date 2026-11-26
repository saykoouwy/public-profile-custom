import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import {
  ALLOWED_BY_KIND,
  MAX_BYTES,
  buildObjectKey,
  categoryOf,
  createUploadTarget,
  deleteByPublicUrl,
  deleteObject,
  isValidObjectKey,
  mimeFromKey,
  normalizeMime,
  publicUrlFor,
  readObjectHead,
  sniffMime,
  storageMode,
  writeLocalObject,
} from "@/lib/storage";
import type { UploadKind } from "@/types";

/**
 * Upload em duas fases (o arquivo não trafega pela função serverless — limite de 4,5 MB na Vercel):
 *  1. POST {action:"sign"}   -> valida sessão, tipo e tamanho; devolve URL pré-assinada com chave UUID.
 *  2. PUT direto no R2       -> navegador envia o arquivo.
 *  3. POST {action:"commit"} -> servidor lê os magic bytes do objeto; se inválido, apaga; se válido, grava no perfil.
 * Em desenvolvimento sem R2, o passo 2 usa PUT nesta mesma rota e grava em public/uploads.
 */

const KINDS = ["background", "audio", "audioCover", "avatar", "cursor"] as const;

// Mídias do perfil; "audio" e "audioCover" pertencem a uma faixa da playlist (trackId obrigatório).
const PROFILE_FIELD_BY_KIND = {
  background: "backgroundUrl",
  avatar: "avatarUrl",
  cursor: "customCursorUrl",
} as const satisfies Partial<Record<UploadKind, string>>;

const TRACK_FIELD_BY_KIND = {
  audio: "audioUrl",
  audioCover: "coverUrl",
} as const satisfies Partial<Record<UploadKind, string>>;

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    kind: z.enum(KINDS),
    contentType: z.string().max(100),
    size: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("commit"),
    kind: z.enum(KINDS),
    key: z.string().max(200),
    trackId: z.uuid().optional(),
  }),
]);

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Bloqueia requisições cross-site (defesa extra além do cookie SameSite=Strict). */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

async function authorizedProfile() {
  const session = await verifySession();
  if (!session) return null;
  return prisma.profile.findUnique({ where: { userId: session.userId } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Origem não permitida.", 403);
  const profile = await authorizedProfile();
  if (!profile) return error("Não autorizado.", 401);
  if (storageMode() === "disabled") return error("Armazenamento não configurado.", 503);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return error("JSON inválido.", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return error("Requisição inválida.", 400);
  const body = parsed.data;

  if (body.action === "sign") {
    const mime = normalizeMime(body.contentType);
    if (!mime || !ALLOWED_BY_KIND[body.kind].includes(mime)) {
      return error("Tipo de arquivo não permitido para este campo.", 415);
    }
    const limit = MAX_BYTES[categoryOf(mime)];
    if (body.size > limit) {
      return error(`Arquivo excede o limite de ${Math.round(limit / 1024 / 1024)} MB.`, 413);
    }
    const key = buildObjectKey(body.kind, mime);
    const target = await createUploadTarget(key, mime, body.size);
    return NextResponse.json({ key, ...target }, { headers: { "Cache-Control": "no-store" } });
  }

  // commit
  if (!isValidObjectKey(body.key, body.kind)) return error("Chave inválida.", 400);

  const isTrackMedia = body.kind === "audio" || body.kind === "audioCover";
  const track =
    isTrackMedia && body.trackId
      ? await prisma.track.findFirst({ where: { id: body.trackId, profileId: profile.id } })
      : null;
  if (isTrackMedia && !track) {
    await deleteObject(body.key);
    return error("Música não encontrada.", 404);
  }

  const object = await readObjectHead(body.key);
  if (!object) return error("Arquivo não encontrado no armazenamento.", 404);

  const sniffed = sniffMime(object.head);
  const declared = mimeFromKey(body.key);
  const valid =
    sniffed !== null &&
    sniffed === declared &&
    ALLOWED_BY_KIND[body.kind].includes(sniffed) &&
    object.size <= MAX_BYTES[categoryOf(sniffed)];

  if (!valid) {
    await deleteObject(body.key);
    return error("Conteúdo do arquivo não corresponde a um formato permitido.", 422);
  }

  const url = publicUrlFor(body.key);
  const data: Record<string, unknown> = {};

  if (track && (body.kind === "audio" || body.kind === "audioCover")) {
    const field = TRACK_FIELD_BY_KIND[body.kind];
    await prisma.track.update({ where: { id: track.id }, data: { [field]: url } });
    await deleteByPublicUrl(track[field]);
  } else if (body.kind === "background" || body.kind === "avatar" || body.kind === "cursor") {
    const field = PROFILE_FIELD_BY_KIND[body.kind];
    data[field] = url;
    if (body.kind === "background") {
      data.backgroundType = sniffed === "image/gif" ? "GIF" : sniffed.startsWith("video/") ? "VIDEO" : "IMAGE";
    }
    await prisma.profile.update({ where: { id: profile.id }, data });
    await deleteByPublicUrl(profile[field]);
  }

  revalidatePath("/[username]", "page");
  revalidatePath("/customize");
  return NextResponse.json(
    { url, backgroundType: data.backgroundType ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Driver local de desenvolvimento: recebe o arquivo quando o R2 não está configurado. */
export async function PUT(request: NextRequest) {
  if (storageMode() !== "local") return error("Não encontrado.", 404);
  if (!sameOrigin(request)) return error("Origem não permitida.", 403);
  if (!(await authorizedProfile())) return error("Não autorizado.", 401);

  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!isValidObjectKey(key)) return error("Chave inválida.", 400);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (!declaredLength || declaredLength > MAX_BYTES.video) return error("Tamanho inválido.", 413);

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength > MAX_BYTES.video) return error("Tamanho inválido.", 413);

  try {
    await writeLocalObject(key, data);
  } catch {
    return error("Falha ao gravar arquivo.", 409);
  }
  return new NextResponse(null, { status: 200 });
}
