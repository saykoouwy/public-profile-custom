"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { clearSessionCookie, setSessionCookie, signSession, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";

export type LoginState = { error?: string; username?: string };

// Rate limit em memória: máx. 5 tentativas por minuto por IP (por instância do servidor).
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function consumeAttempt(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  if (attempts.size > 5_000) {
    for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
  }
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= MAX_ATTEMPTS,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawUsername = formData.get("username");
  const username = typeof rawUsername === "string" ? rawUsername.slice(0, 30) : "";

  const limit = consumeAttempt(await clientIp());
  if (!limit.allowed) {
    return { error: `Muitas tentativas. Tente novamente em ${limit.retryAfter}s.`, username };
  }

  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Usuário ou senha inválidos.", username };
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, passwordHash: true },
  });
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);
  if (!user || !valid) {
    return { error: "Usuário ou senha inválidos.", username };
  }

  await setSessionCookie(await signSession(user.id));
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
