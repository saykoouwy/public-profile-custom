import "server-only";
import { prisma } from "@/lib/db";

/** Abaixo disso o registro é considerado fresco e a Lanyard nem é consultada de novo. */
const FRESH_MS = 30_000;

type LanyardStatus = "online" | "idle" | "dnd" | "offline";

async function fetchDiscordStatus(discordUserId: string): Promise<LanyardStatus | null> {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: { discord_status?: LanyardStatus } };
    return json.success ? (json.data?.discord_status ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Atualiza `discordLastOnlineAt` consultando a Lanyard DO SERVIDOR: quem chama não consegue forjar
 * "estava online", só pedir uma checagem. Retorna o valor atual (atualizado ou não).
 */
export async function syncDiscordLastOnline(profile: {
  id: string;
  discordUserId: string | null;
  discordLastOnlineAt: Date | null;
}): Promise<Date | null> {
  const { discordUserId, discordLastOnlineAt } = profile;
  if (!discordUserId || !/^\d{17,20}$/.test(discordUserId)) return discordLastOnlineAt;
  if (discordLastOnlineAt && Date.now() - discordLastOnlineAt.getTime() < FRESH_MS) return discordLastOnlineAt;

  const status = await fetchDiscordStatus(discordUserId);
  if (!status || status === "offline") return discordLastOnlineAt;

  const now = new Date();
  await prisma.profile.update({ where: { id: profile.id }, data: { discordLastOnlineAt: now } });
  return now;
}
