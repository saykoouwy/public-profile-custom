import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Rate limit de janela fixa.
 *
 * - Produção (várias instâncias serverless): defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 *   (Upstash Redis / Vercel KV). O contador fica compartilhado entre instâncias e sobrevive a reinícios.
 * - Sem essas variáveis: contador em memória, por instância (suficiente para desenvolvimento/uma instância).
 * - Se o Redis falhar, cai para a memória em vez de derrubar o login.
 */

export type RateLimitResult = { allowed: boolean; retryAfter: number };

type Entry = { count: number; resetAt: number };
const memory = new Map<string, Entry>();
const MEMORY_MAX_KEYS = 10_000;

function consumeMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memory.size > MEMORY_MAX_KEYS) {
    for (const [k, e] of memory) if (e.resetAt <= now) memory.delete(k);
    // Ainda cheio (ataque com muitas chaves): descarta as mais antigas em vez de crescer sem limite.
    if (memory.size > MEMORY_MAX_KEYS) {
      for (const k of [...memory.keys()].slice(0, memory.size - MEMORY_MAX_KEYS)) memory.delete(k);
    }
  }
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
}

function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

async function consumeRedis(
  cfg: { url: string; token: string },
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // INCR + PEXPIRE NX (só define o TTL na primeira tentativa da janela) + PTTL, numa única ida ao Redis.
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
    signal: AbortSignal.timeout(2_000),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const [incr, , pttl] = (await res.json()) as { result?: number; error?: string }[];
  if (typeof incr?.result !== "number") throw new Error(incr?.error ?? "Redis: resposta inválida");
  const ttl = typeof pttl?.result === "number" && pttl.result > 0 ? pttl.result : windowMs;
  return { allowed: incr.result <= limit, retryAfter: Math.ceil(ttl / 1000) };
}

/** Consome uma tentativa da chave. `limit` tentativas por `windowMs`. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const namespaced = `rl:${key}`;
  const cfg = redisConfig();
  if (cfg) {
    try {
      return await consumeRedis(cfg, namespaced, limit, windowMs);
    } catch (err) {
      console.error("[rate-limit] Redis indisponível, usando memória:", err);
    }
  }
  return consumeMemory(namespaced, limit, windowMs);
}

/** Hash curto e não reversível: IPs e usernames não ficam em texto puro nas chaves do Redis. */
export function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 22);
}

/**
 * IP do cliente a partir de headers que a PLATAFORMA define (o cliente não consegue forjá-los nela).
 * Cada header só é lido quando a plataforma correspondente está confirmada por variável de ambiente;
 * fora dela (ex.: VPS sem Cloudflare na frente) o cliente poderia forjá-los e driblar o rate limit:
 * - Vercel (`VERCEL`, definida pela própria Vercel): `x-vercel-forwarded-for` / `x-real-ip`
 * - Cloudflare (`TRUST_CLOUDFLARE=1`): `cf-connecting-ip`
 *
 * `x-forwarded-for` só é aceito com TRUST_PROXY=1 (proxy próprio que sobrescreve o header) e, nesse caso,
 * usa o ÚLTIMO item (adicionado pelo proxy confiável), não o primeiro (que o cliente controla).
 * Retorna null quando não há IP confiável — quem chama não deve agrupar todos numa chave global.
 */
export async function trustedClientIp(): Promise<string | null> {
  const h = await headers();
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;

  const platform =
    (process.env.VERCEL ? (first(h.get("x-vercel-forwarded-for")) ?? first(h.get("x-real-ip"))) : null) ??
    (process.env.TRUST_CLOUDFLARE === "1" ? first(h.get("cf-connecting-ip")) : null);
  if (platform) return platform;

  if (process.env.TRUST_PROXY === "1") {
    const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
    if (chain?.length) return chain[chain.length - 1];
    return first(h.get("x-real-ip"));
  }
  return null;
}
