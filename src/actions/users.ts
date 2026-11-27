"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, requireRole, revokeSessions } from "@/lib/auth";
import { runAction } from "@/lib/action-utils";
import { deleteByPublicUrl } from "@/lib/storage";
import { revalidateProfilePages } from "@/lib/revalidate";
import { BAN_DURATIONS, ROLE_LABELS } from "@/lib/roles";
import { isReservedUsername, normalizeUsername } from "@/lib/usernames";
import { adminCreateUserSchema, assignableRoleSchema, banSchema, fieldErrorsOf, idSchema } from "@/lib/validators";
import type { ActionResult } from "@/types";

/**
 * Ações da aba Admin. Regras de segurança (valem no servidor, independente do que o cliente envie):
 *  - toda ação exige sessão válida com privilégio ULTRA (relido do banco a cada requisição);
 *  - ULTRA nunca pode ser atribuído por aqui (o schema só aceita MEMBER/PREMIUM);
 *  - uma conta ULTRA nunca é alvo: não muda de privilégio, não é banida nem excluída;
 *  - os alvos são identificados pelo id (permanente), nunca pelo username.
 */

function run<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  return runAction("users action", fn);
}

/** Confere a sessão Ultra e o alvo. Retorna erro amigável quando o alvo é protegido. */
type Target = { id: string; username: string };

async function protectedTarget(rawId: unknown): Promise<{ ok: false; error: string } | { ok: true; target: Target }> {
  const session = await requireRole("ULTRA");
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return { ok: false, error: "Usuário inválido." };

  const target = await prisma.user.findUnique({
    where: { id: parsed.data },
    select: { id: true, username: true, role: true },
  });
  if (!target) return { ok: false, error: "Usuário não encontrado." };
  if (target.id === session.userId || target.role === "ULTRA") {
    return { ok: false, error: "A conta Ultra é protegida e não pode ser alterada." };
  }
  return { ok: true, target };
}

function refresh(username?: string) {
  revalidateProfilePages(username);
  revalidatePath("/customize");
}

export async function createUser(input: unknown): Promise<ActionResult> {
  return run(async () => {
    await requireRole("ULTRA");
    const parsed = adminCreateUserSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Verifique os campos destacados.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    // Gravado em minúsculas: login e /<usuário> não diferenciam maiúsculas.
    const username = normalizeUsername(parsed.data.username);
    if (isReservedUsername(username)) {
      return { ok: false, error: "Nome reservado pelo site.", fieldErrors: { username: ["Este nome é uma rota do site."] } };
    }
    const taken = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "Usuário já existe.", fieldErrors: { username: ["Este nome já está em uso."] } };

    try {
      await prisma.user.create({
        data: {
          username,
          role: parsed.data.role,
          passwordHash: await hashPassword(parsed.data.password),
          profile: { create: { displayName: username, bio: null, location: null } },
        },
      });
    } catch (err) {
      // Duas criações simultâneas com o mesmo nome: a checagem acima passou nas duas, o @unique barra uma.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "Usuário já existe.", fieldErrors: { username: ["Este nome já está em uso."] } };
      }
      throw err;
    }

    refresh();
    return { ok: true, message: `Conta "${username}" criada como ${ROLE_LABELS[parsed.data.role]}.` };
  });
}

export async function setUserRole(id: unknown, role: unknown): Promise<ActionResult> {
  return run(async () => {
    const res = await protectedTarget(id);
    if (!res.ok) return res;
    const parsedRole = assignableRoleSchema.safeParse(role);
    if (!parsedRole.success) return { ok: false, error: "Privilégio inválido." };

    // role != ULTRA também na escrita: a proteção é atômica, não só na leitura anterior.
    const { count } = await prisma.user.updateMany({
      where: { id: res.target.id, role: { not: "ULTRA" } },
      data: { role: parsedRole.data },
    });
    if (count === 0) return { ok: false, error: "Usuário não encontrado." };

    refresh(res.target.username);
    return { ok: true, message: `${res.target.username} agora é ${ROLE_LABELS[parsedRole.data]}.` };
  });
}

export async function banUser(id: unknown, input: unknown): Promise<ActionResult> {
  return run(async () => {
    const res = await protectedTarget(id);
    if (!res.ok) return res;
    const parsed = banSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Verifique os dados do banimento.", fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const now = new Date();
    const ms = BAN_DURATIONS[parsed.data.duration];
    const { count } = await prisma.user.updateMany({
      where: { id: res.target.id, role: { not: "ULTRA" } },
      data: {
        bannedAt: now,
        banExpiresAt: ms === null ? null : new Date(now.getTime() + ms),
        banReason: parsed.data.reason ?? null,
      },
    });
    if (count === 0) return { ok: false, error: "Usuário não encontrado." };
    // Derruba as sessões abertas na hora (todos os dispositivos).
    await revokeSessions(res.target.id);

    refresh(res.target.username);
    return {
      ok: true,
      message: ms === null ? `${res.target.username} foi banido permanentemente.` : `${res.target.username} foi suspenso.`,
    };
  });
}

export async function unbanUser(id: unknown): Promise<ActionResult> {
  return run(async () => {
    const res = await protectedTarget(id);
    if (!res.ok) return res;

    const { count } = await prisma.user.updateMany({
      where: { id: res.target.id, role: { not: "ULTRA" } },
      data: { bannedAt: null, banExpiresAt: null, banReason: null },
    });
    if (count === 0) return { ok: false, error: "Usuário não encontrado." };

    refresh(res.target.username);
    return { ok: true, message: `Banimento de ${res.target.username} removido.` };
  });
}

/** Exclui a conta, o perfil (cascade) e as mídias enviadas por ela. Irreversível. */
export async function deleteUser(id: unknown): Promise<ActionResult> {
  return run(async () => {
    const res = await protectedTarget(id);
    if (!res.ok) return res;

    const profile = await prisma.profile.findUnique({
      where: { userId: res.target.id },
      select: {
        avatarUrl: true,
        backgroundUrl: true,
        customCursorUrl: true,
        tracks: { select: { audioUrl: true, coverUrl: true } },
      },
    });

    const { count } = await prisma.user.deleteMany({ where: { id: res.target.id, role: { not: "ULTRA" } } });
    if (count === 0) return { ok: false, error: "Usuário não encontrado." };

    // Depois de apagar do banco: uma falha no storage não deixa a conta "meio excluída".
    if (profile) {
      const urls = [
        profile.avatarUrl,
        profile.backgroundUrl,
        profile.customCursorUrl,
        ...profile.tracks.flatMap((t) => [t.audioUrl, t.coverUrl]),
      ];
      await Promise.all(urls.map((u) => deleteByPublicUrl(u)));
    }

    refresh(res.target.username);
    return { ok: true, message: `Conta ${res.target.username} excluída.` };
  });
}
