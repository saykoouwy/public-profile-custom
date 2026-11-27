import bcrypt from "bcryptjs";

/**
 * Hash de senha compartilhado pelo app e pelos scripts CLI do Prisma (seed/create-user).
 * Sem `import "server-only"`: os scripts rodam fora do Next.js.
 */
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
