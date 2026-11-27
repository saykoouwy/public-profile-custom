import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { BCRYPT_COST } from "@/lib/password";
import { DEFAULT_AVATAR } from "@/lib/media-rules";
import { hasPrivilege, isBanActive, type Role } from "@/lib/roles";

export { hashPassword } from "@/lib/password";

export const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias
const ISSUER = "biolink";
const AUDIENCE = "biolink-admin";

/** userId é a identidade permanente; username pode mudar sem afetar privilégios ou banimentos. */
export type SessionUser = { userId: string; username: string; role: Role };
export type TokenClaims = { userId: string; tokenVersion: number };

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and have at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Cookies `Secure` só são aceitos pelo navegador em HTTPS (e em http://localhost por exceção).
 * Em produção são sempre `Secure`; em desenvolvimento (ex.: teste via IP na rede local) não,
 * para o login não "sumir" silenciosamente.
 */
export function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Gera um JWT HS256 com expiração de 7 dias. `ver` = User.tokenVersion no momento do login:
 * incrementar a versão no banco (logout, troca de senha) invalida na hora todos os tokens anteriores.
 */
export async function signSession(userId: string, tokenVersion = 0): Promise<string> {
  return new SignJWT({ ver: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

/** Valida assinatura, algoritmo, emissor, audiência e expiração. Não consulta o banco. */
export async function verifyToken(token: string | undefined): Promise<TokenClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const { sub, ver } = payload;
    if (typeof sub !== "string" || !sub) return null;
    // Tokens sem versão (emitidos antes da revogação existir) não são mais aceitos.
    if (typeof ver !== "number" || !Number.isInteger(ver) || ver < 0) return null;
    return { userId: sub, tokenVersion: ver };
  } catch {
    return null;
  }
}

/**
 * Lê o cookie `admin_session`, valida o token e confirma no banco que o usuário ainda existe
 * que o token não foi revogado (tokenVersion) e que a conta não está banida. Memoizado por requisição.
 */
export const verifySession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifyToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { id: true, username: true, tokenVersion: true, role: true, bannedAt: true, banExpiresAt: true },
  });
  if (!user || user.tokenVersion !== claims.tokenVersion) return null;
  // Banido (temporário ainda no prazo, ou permanente): a sessão deixa de valer.
  if (isBanActive(user)) return null;
  return { userId: user.id, username: user.username, role: user.role };
});

/** Interrompe a execução (lança) quando não há sessão válida. Use em toda Server Action/rota protegida. */
export async function requireAuth(): Promise<SessionUser> {
  const session = await verifySession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Exige um privilégio mínimo (ex.: "PREMIUM" para personalizações extras, "ULTRA" para o Admin). */
export async function requireRole(required: Role): Promise<SessionUser> {
  const session = await requireAuth();
  if (!hasPrivilege(session.role, required)) throw new ForbiddenError();
  return session;
}

/** Sessão + perfil do próprio usuário (camada 3). Memoizado por requisição. */
export const getAuthorizedProfile = cache(async () => {
  const session = await verifySession();
  if (!session) return null;
  const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
  return profile ? { session, profile } : null;
});

/** Dados da cápsula do usuário (navbar da landing e painel). Memoizado por requisição. */
export const getCurrentUserNav = cache(async (): Promise<{ username: string; avatarUrl: string } | null> => {
  const session = await verifySession();
  if (!session) return null;
  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
    select: { avatarUrl: true },
  });
  return { username: session.username, avatarUrl: profile?.avatarUrl ?? DEFAULT_AVATAR };
});

/** Revoga todas as sessões do usuário (todos os dispositivos). */
export async function revokeSessions(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
}

const cookieOptions = () =>
  ({ httpOnly: true, secure: secureCookies(), sameSite: "strict", path: "/" }) as const;

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

// Hash gerado uma vez por processo, usado quando o usuário não existe: o bcrypt.compare
// roda com o mesmo custo e o tempo de resposta não revela quais usernames são válidos.
let dummyHash: Promise<string> | undefined;

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  dummyHash ??= bcrypt.hash("timing-equalizer", BCRYPT_COST);
  const ok = await bcrypt.compare(password, hash ?? (await dummyHash));
  return hash !== null && ok;
}
