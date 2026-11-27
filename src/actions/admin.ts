"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthorizedProfile, requireAuth, UnauthorizedError } from "@/lib/auth";
import { deleteByPublicUrl, isOwnMediaUrl } from "@/lib/storage";
import { revalidateProfilePages } from "@/lib/revalidate";
import {
  fieldErrorsOf,
  idSchema,
  profileUpdateSchema,
  reorderSchema,
  socialLinkSchema,
  socialLinkUpdateSchema,
  trackUpdateSchema,
} from "@/lib/validators";
import { MAX_TRACKS, type ActionResult, type AdminTrack, type PublicSocialLink } from "@/types";

const MEDIA_FIELDS = ["avatarUrl", "customCursorUrl", "backgroundUrl"] as const;
type MediaField = (typeof MEDIA_FIELDS)[number];

const PROFILE_MEDIA_KINDS = ["background", "avatar", "cursor"] as const;
const MEDIA_FIELD_BY_KIND: Record<(typeof PROFILE_MEDIA_KINDS)[number], MediaField> = {
  background: "backgroundUrl",
  avatar: "avatarUrl",
  cursor: "customCursorUrl",
};

/** Camada 3: toda mutação passa por aqui — sessão válida + perfil do próprio usuário. */
async function authorizedProfileId(): Promise<string> {
  const auth = await getAuthorizedProfile();
  if (!auth) throw new UnauthorizedError();
  return auth.profile.id;
}

async function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Sessão expirada. Faça login novamente." };
    console.error("[admin action]", err);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}

/** Perfil do usuário logado (/<usuário>) e o painel. A sessão é memoizada: não repete a consulta. */
async function revalidateAll(): Promise<void> {
  revalidateProfilePages((await requireAuth()).username);
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const data = parsed.data;
    const touchedMedia = MEDIA_FIELDS.filter((f) => f in data);
    // Mídias só podem apontar para o nosso storage (ou assets locais): bloqueia URLs de rastreamento.
    const foreign = touchedMedia.filter((f) => !isOwnMediaUrl(data[f]));
    if (foreign.length) {
      return {
        ok: false,
        error: "Envie a mídia pelo painel: URLs externas não são aceitas.",
        fieldErrors: Object.fromEntries(foreign.map((f) => [f, ["Use um arquivo enviado pelo painel."]])),
      };
    }
    const previous = touchedMedia.length
      ? await prisma.profile.findUnique({
          where: { id: profileId },
          select: Object.fromEntries(touchedMedia.map((f) => [f, true])) as Record<MediaField, true>,
        })
      : null;

    await prisma.profile.update({ where: { id: profileId }, data });

    // Mídias substituídas/removidas que estavam no nosso storage são apagadas.
    if (previous) {
      await Promise.all(
        touchedMedia
          .filter((f) => previous[f] && previous[f] !== data[f])
          .map((f) => deleteByPublicUrl(previous[f])),
      );
    }

    await revalidateAll();
    return { ok: true, message: "Perfil atualizado." };
  });
}

export async function removeMedia(kind: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsedKind = z.enum(PROFILE_MEDIA_KINDS).safeParse(kind);
    if (!parsedKind.success) return { ok: false, error: "Tipo de mídia inválido." };

    const field = MEDIA_FIELD_BY_KIND[parsedKind.data];
    const previous = await prisma.profile.findUnique({ where: { id: profileId }, select: { [field]: true } });
    await prisma.profile.update({ where: { id: profileId }, data: { [field]: null } });
    await deleteByPublicUrl(previous?.[field] as string | null | undefined);

    await revalidateAll();
    return { ok: true, message: "Mídia removida." };
  });
}

export async function addSocialLink(input: unknown): Promise<ActionResult<PublicSocialLink>> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsed = socialLinkSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Link inválido.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const count = await prisma.socialLink.count({ where: { profileId } });
    if (count >= 20) return { ok: false, error: "Limite de 20 links atingido." };

    const last = await prisma.socialLink.findFirst({
      where: { profileId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const link = await prisma.socialLink.create({
      data: {
        profileId,
        platform: parsed.data.platform,
        iconName: parsed.data.platform,
        label: parsed.data.label ?? null,
        url: parsed.data.url,
        orderIndex: (last?.orderIndex ?? -1) + 1,
      },
      select: { id: true, platform: true, label: true, url: true, iconName: true },
    });

    await revalidateAll();
    return { ok: true, data: link, message: "Link adicionado." };
  });
}

export async function updateSocialLinksOrder(orderedIds: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsed = reorderSchema.safeParse(orderedIds);
    if (!parsed.success) return { ok: false, error: "Ordem inválida." };

    const owned = await prisma.socialLink.count({ where: { profileId, id: { in: parsed.data } } });
    if (owned !== parsed.data.length) return { ok: false, error: "Links não encontrados." };

    await prisma.$transaction(
      parsed.data.map((id, index) =>
        prisma.socialLink.update({ where: { id, profileId }, data: { orderIndex: index } }),
      ),
    );

    await revalidateAll();
    return { ok: true, message: "Ordem salva." };
  });
}

export async function toggleSocialLink(id: unknown, isActive: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsedId = idSchema.safeParse(id);
    const parsedActive = z.boolean().safeParse(isActive);
    if (!parsedId.success || !parsedActive.success) return { ok: false, error: "Dados inválidos." };

    const { count } = await prisma.socialLink.updateMany({
      where: { id: parsedId.data, profileId },
      data: { isActive: parsedActive.data },
    });
    if (count === 0) return { ok: false, error: "Link não encontrado." };

    await revalidateAll();
    return { ok: true };
  });
}

export async function updateSocialLink(id: unknown, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "ID inválido." };
    const parsed = socialLinkUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Link inválido.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const { count } = await prisma.socialLink.updateMany({
      where: { id: parsedId.data, profileId },
      data: parsed.data,
    });
    if (count === 0) return { ok: false, error: "Link não encontrado." };

    await revalidateAll();
    return { ok: true, message: "Link atualizado." };
  });
}

export async function deleteSocialLink(id: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: "ID inválido." };

    const { count } = await prisma.socialLink.deleteMany({ where: { id: parsed.data, profileId } });
    if (count === 0) return { ok: false, error: "Link não encontrado." };

    await revalidateAll();
    return { ok: true, message: "Link removido." };
  });
}

// ---------------------------------------------------------------------------
// Playlist (faixas do player)
// ---------------------------------------------------------------------------

/** Cria uma faixa vazia no fim da playlist; o arquivo e a capa são enviados depois via /api/upload. */
export async function addTrack(): Promise<ActionResult<AdminTrack>> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const count = await prisma.track.count({ where: { profileId } });
    if (count >= MAX_TRACKS) return { ok: false, error: `Limite de ${MAX_TRACKS} músicas atingido.` };

    const last = await prisma.track.findFirst({
      where: { profileId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    const track = await prisma.track.create({
      data: { profileId, orderIndex: (last?.orderIndex ?? -1) + 1 },
      select: { id: true },
    });
    return { ok: true, data: { id: track.id, title: "", artist: "", audioUrl: null, coverUrl: null } };
  });
}

export async function updateTrack(id: unknown, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsedId = idSchema.safeParse(id);
    const parsed = trackUpdateSchema.safeParse(input);
    if (!parsedId.success) return { ok: false, error: "Música inválida." };
    if (!parsed.success) {
      return { ok: false, error: "Verifique os campos da música.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const { count } = await prisma.track.updateMany({ where: { id: parsedId.data, profileId }, data: parsed.data });
    if (count === 0) return { ok: false, error: "Música não encontrada." };

    await revalidateAll();
    return { ok: true, message: "Música salva." };
  });
}

/**
 * Remove a capa de uma faixa. (O arquivo de áudio não é removível sozinho: uma faixa sem arquivo some
 * da bio e fica "pendente" no painel — para isso existe trocar o arquivo ou excluir a faixa.)
 */
export async function removeTrackCover(id: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return { ok: false, error: "Dados inválidos." };

    const track = await prisma.track.findFirst({
      where: { id: parsedId.data, profileId },
      select: { coverUrl: true },
    });
    if (!track) return { ok: false, error: "Música não encontrada." };

    // profileId também na escrita: a posse é verificada de forma atômica, não só na leitura anterior.
    const { count } = await prisma.track.updateMany({
      where: { id: parsedId.data, profileId },
      data: { coverUrl: null },
    });
    if (count === 0) return { ok: false, error: "Música não encontrada." };
    await deleteByPublicUrl(track.coverUrl);

    await revalidateAll();
    return { ok: true, message: "Capa removida." };
  });
}

export async function deleteTrack(id: unknown): Promise<ActionResult> {
  return run(async () => {
    const profileId = await authorizedProfileId();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return { ok: false, error: "Música inválida." };

    const track = await prisma.track.findFirst({
      where: { id: parsed.data, profileId },
      select: { audioUrl: true, coverUrl: true },
    });
    if (!track) return { ok: false, error: "Música não encontrada." };

    const { count } = await prisma.track.deleteMany({ where: { id: parsed.data, profileId } });
    if (count === 0) return { ok: false, error: "Música não encontrada." };
    await Promise.all([deleteByPublicUrl(track.audioUrl), deleteByPublicUrl(track.coverUrl)]);

    await revalidateAll();
    return { ok: true, message: "Música removida." };
  });
}
