import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias
const ISSUER = "biolink";
const AUDIENCE = "biolink-admin";

export type SessionUser = { userId: string; username: string };

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and have at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

/** Gera um JWT HS256 assinado com expiração de 7 dias. */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Valida assinatura, algoritmo, emissor, audiência e expiração. Não consulta o banco. */
export async function verifyToken(token: string | undefined): Promise<{ userId: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return typeof payload.sub === "string" && payload.sub ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}

/**
 * Lê o cookie `admin_session`, valida o token e confirma que o usuário ainda existe.
 * Memoizado por requisição (layout + page + actions consultam o banco uma única vez).
 */
export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifyToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, username: true },
  });
  return user ? { userId: user.id, username: user.username } : null;
});

/** Interrompe a execução (lança) quando não há sessão válida. Use em toda Server Action/rota protegida. */
export async function requireAuth(): Promise<SessionUser> {
  const session = await verifySession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Hash gerado uma vez por processo, usado quando o usuário não existe: o bcrypt.compare
// roda com o mesmo custo e o tempo de resposta não revela quais usernames são válidos.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  dummyHash ??= bcrypt.hash("timing-equalizer", 12);
  const ok = await bcrypt.compare(password, hash ?? (await dummyHash));
  return hash !== null && ok;
}
