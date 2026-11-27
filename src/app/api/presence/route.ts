import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";
import { usernameSchema } from "@/lib/validators";
import { syncDiscordLastOnline } from "@/lib/discord-presence";
import { notBannedWhere } from "@/lib/roles";
import { consumeRateLimit, hashKey, trustedClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({ username: usernameSchema });
const noStore = { "Cache-Control": "no-store" };

/**
 * Chamado pelo widget de atividade enquanto alguém vê o perfil: o servidor confere na Lanyard se o dono
 * está online e, se estiver, grava o horário. Devolve a última vez online para o "Offline há X".
 */
export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ lastOnlineAt: null }, { status: 400, headers: noStore });

  if (!isSameOrigin(request)) {
    return NextResponse.json({ lastOnlineAt: null }, { status: 403, headers: noStore });
  }

  const ip = await trustedClientIp();
  if (ip) {
    const limit = await consumeRateLimit(`presence:${hashKey(ip)}`, 30, 60_000);
    if (!limit.allowed) return NextResponse.json({ lastOnlineAt: null }, { status: 429, headers: noStore });
  }

  const profile = await prisma.profile.findFirst({
    // Conta banida não tem página pública: também não expõe nem atualiza a presença.
    where: {
      user: { username: { equals: body.data.username, mode: "insensitive" }, ...notBannedWhere() },
      showDiscordStatus: true,
    },
    select: { id: true, discordUserId: true, discordLastOnlineAt: true },
  });
  if (!profile) return NextResponse.json({ lastOnlineAt: null }, { status: 404, headers: noStore });

  const lastOnlineAt = await syncDiscordLastOnline(profile);
  return NextResponse.json({ lastOnlineAt: lastOnlineAt?.toISOString() ?? null }, { headers: noStore });
}
