import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { syncDiscordLastOnline } from "@/lib/discord-presence";

/**
 * Checagem periódica do "visto por último" de todos os perfis com Discord ligado, para o "Offline há X"
 * ficar preciso mesmo quando ninguém está vendo o perfil. Chame a cada ~5 min por um agendador externo
 * (ex.: cron-job.org) com o header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const profiles = await prisma.profile.findMany({
    where: { showDiscordStatus: true, discordUserId: { not: null } },
    select: { id: true, discordUserId: true, discordLastOnlineAt: true },
  });

  let online = 0;
  for (const profile of profiles) {
    const before = profile.discordLastOnlineAt?.getTime();
    const after = (await syncDiscordLastOnline(profile))?.getTime();
    if (after && after !== before) online += 1;
  }

  return NextResponse.json({ checked: profiles.length, online }, { headers: { "Cache-Control": "no-store" } });
}
