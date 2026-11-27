"use server";

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthorizedProfile, requireAuth, UnauthorizedError } from "@/lib/auth";
import { runAction } from "@/lib/action-utils";
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

const MAX_LINKS = 20;
const ORPHAN_TRACK_MS = 60 * 60 * 1000;

/**
 * Executa `fn` numa transação com um lock exclusivo por perfil (advisory lock do PostgreSQL, liberado
 * no fim da transação). Serializa "conta → calcula posição → cria" entre requisições simultâneas.
 */
function withProfileLock<T>(profileId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Tagged template: o valor vai como parâmetro ($1), nunca concatenado no SQL.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${profileId}))`;
    return fn(tx);
  });
}

/** Próximo orderIndex (fim da lista) de links ou faixas do perfil. */
async function nextOrderIndex(
  model: Prisma.TransactionClient["socialLink"] | Prisma.TransactionClient["track"],
  profileId: string,
): Promise<number> {
  const last = await (model as Prisma.TransactionClient["track"]).findFirst({
    where: { profileId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  return (last?.orderIndex ?? -1) + 1;
}

/** Camada 3: toda mutação passa por aqui — sessão válida + perfil do próprio usuário. */
async function authorizedProfileId(): Promise<string> {
  const auth = await getAuthorizedProfile();
  if (!auth) throw new UnauthorizedError();
  return auth.profile.id;
}

function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction("admin action", fn);
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

    // Discord e atividade manual são exclusivos. O schema só enxerga o payload (parcial); aqui a regra
    // é aplicada contra o estado salvo, para nenhuma combinação de campos omitidos burlá-la.
    if (data.showDiscordStatus === true) data.manualActivityType = null;
    if (data.manualActivityType) {
      data.showDiscordStatus = false;
      if (!("manualStatusText" in data)) {
        const current = await prisma.profile.findUnique({ where: { id: profileId }, select: { manualStatusText: true } });
        if (!current?.manualStatusText) {
          return {
            ok: false,
            error: "Verifique os campos destacados.",
            fieldErrors: { manualStatusText: ["Informe o texto da atividade manual."] },
          };
        }
      }
    }

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

    // Contagem + posição + criação sob o lock do perfil: cliques simultâneos não passam do limite
    // nem geram orderIndex repetido.
    const link = await withProfileLock(profileId, async (tx) => {
      if ((await tx.socialLink.count({ where: { profileId } })) >= MAX_LINKS) return null;
      return tx.socialLink.create({
        data: {
          profileId,
          platform: parsed.data.platform,
          iconName: parsed.data.platform,
          label: parsed.data.label ?? null,
          url: parsed.data.url,
          // Rascunho marcado como oculto já nasce oculto (não aparece nem por um instante na bio).
          isActive: parsed.data.isActive ?? true,
          orderIndex: await nextOrderIndex(tx.socialLink, profileId),
        },
        select: { id: true, platform: true, label: true, url: true, iconName: true },
      });
    });
    if (!link) return { ok: false, error: `Limite de ${MAX_LINKS} links atingido.` };

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
    const track = await withProfileLock(profileId, async (tx) => {
      // Faixas sem arquivo há mais de 1 h são restos de uploads interrompidos (aba fechada, queda de
      // conexão): liberam o slot antes de contar. Faixa sem áudio nem aparece na bio.
      await tx.track.deleteMany({
        where: { profileId, audioUrl: null, coverUrl: null, createdAt: { lt: new Date(Date.now() - ORPHAN_TRACK_MS) } },
      });
      if ((await tx.track.count({ where: { profileId } })) >= MAX_TRACKS) return null;
      return tx.track.create({
        data: { profileId, orderIndex: await nextOrderIndex(tx.track, profileId) },
        select: { id: true },
      });
    });
    if (!track) return { ok: false, error: `Limite de ${MAX_TRACKS} músicas atingido.` };
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
