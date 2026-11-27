import "server-only";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import type { ActionResult } from "@/types";

/**
 * Envolve o corpo de uma Server Action: falta de sessão/privilégio vira mensagem amigável e qualquer
 * outro erro é registrado no servidor sem vazar detalhes para o cliente.
 */
export async function runAction<T>(tag: string, fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: "Sessão expirada. Faça login novamente." };
    if (err instanceof ForbiddenError) return { ok: false, error: "Você não tem permissão para isso." };
    console.error(`[${tag}]`, err);
    return { ok: false, error: "Erro inesperado. Tente novamente." };
  }
}
