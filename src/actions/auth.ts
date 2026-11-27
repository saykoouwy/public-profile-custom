"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  clearSessionCookie,
  revokeSessions,
  setSessionCookie,
  signSession,
  verifyPassword,
  verifySession,
} from "@/lib/auth";
import { consumeRateLimit, hashKey, trustedClientIp } from "@/lib/rate-limit";
import { normalizeUsername } from "@/lib/usernames";
import { loginSchema } from "@/lib/validators";

export type LoginState = { error?: string; username?: string };

// Por IP: 5 tentativas/minuto. Por conta: 10 tentativas/15 min (freia força bruta distribuída em
// vários IPs sem permitir que um único atacante bloqueie o login de todo mundo).
const IP_LIMIT = { max: 5, windowMs: 60_000 };
const ACCOUNT_LIMIT = { max: 10, windowMs: 15 * 60_000 };

/** Busca sem diferenciar maiúsculas; se houver duplicatas antigas ("Admin"/"admin"), exige o casing exato. */
async function findUserForLogin(username: string) {
  const matches = await prisma.user.findMany({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true, passwordHash: true, tokenVersion: true },
    take: 2,
  });
  if (matches.length <= 1) return matches[0] ?? null;
  return matches.find((u) => u.username === username) ?? null;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawUsername = formData.get("username");
  const username = typeof rawUsername === "string" ? rawUsername.slice(0, 30) : "";

  const ip = await trustedClientIp();
  const checks = [
    consumeRateLimit(`login:acct:${hashKey(normalizeUsername(username))}`, ACCOUNT_LIMIT.max, ACCOUNT_LIMIT.windowMs),
  ];
  // Sem IP confiável não existe chave por IP (uma chave global "unknown" deixaria qualquer um bloquear todos).
  if (ip) checks.push(consumeRateLimit(`login:ip:${hashKey(ip)}`, IP_LIMIT.max, IP_LIMIT.windowMs));
  const blocked = (await Promise.all(checks)).find((r) => !r.allowed);
  if (blocked) {
    return { error: `Muitas tentativas. Tente novamente em ${blocked.retryAfter}s.`, username };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Usuário ou senha inválidos.", username };
  }

  const user = await findUserForLogin(parsed.data.username);
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);
  if (!user || !valid) {
    return { error: "Usuário ou senha inválidos.", username };
  }

  await setSessionCookie(await signSession(user.id, user.tokenVersion));
  redirect("/customize");
}

/** Sair revoga a sessão no servidor (todos os dispositivos): um cookie copiado deixa de valer na hora. */
export async function logoutAction(): Promise<void> {
  const session = await verifySession();
  if (session) await revokeSessions(session.userId);
  await clearSessionCookie();
  redirect("/login");
}
