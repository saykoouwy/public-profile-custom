import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSameOrigin } from "@/lib/http";
import { usernameSchema } from "@/lib/validators";
import { notBannedWhere } from "@/lib/roles";
import { secureCookies } from "@/lib/auth";
import { consumeRateLimit, hashKey, trustedClientIp } from "@/lib/rate-limit";

/** Um cookie por perfil: visitar um perfil não impede de contar a visita em outro. */
const viewedCookie = (profileId: string) => `bl_viewed_${profileId}`;
const bodySchema = z.object({ username: usernameSchema });
const DAY_MS = 24 * 60 * 60 * 1000;
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embed|curl|wget|python|headless|lighthouse/i;

/**
 * Incrementa o contador de visualizações de forma atômica, no máximo uma vez a cada 24h por navegador
 * (cookie HttpOnly) E por IP (hash do IP + perfil, quando a plataforma informa um IP confiável) — um script
 * que ignora cookies não infla o contador. Requisições cross-site e user-agents de bots apenas leem o valor.
 */
export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ views: 0 }, { status: 400 });

  const profile = await prisma.profile.findFirst({
    where: { user: { username: { equals: body.data.username, mode: "insensitive" }, ...notBannedWhere() } },
    select: { id: true, viewsCount: true },
  });
  if (!profile) return NextResponse.json({ views: 0 }, { status: 404 });

  const sameOrigin = isSameOrigin(request);
  const ua = request.headers.get("user-agent") ?? "";
  const alreadyCounted = request.cookies.has(viewedCookie(profile.id));

  const readOnly = () =>
    NextResponse.json({ views: profile.viewsCount, counted: false }, { headers: { "Cache-Control": "no-store" } });

  if (!sameOrigin || alreadyCounted || !ua || BOT_UA.test(ua)) return readOnly();

  const ip = await trustedClientIp();
  if (ip) {
    const perIp = await consumeRateLimit(`views:${profile.id}:${hashKey(ip)}`, 1, DAY_MS);
    if (!perIp.allowed) return readOnly();
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { viewsCount: { increment: 1 } },
    select: { viewsCount: true },
  });

  const response = NextResponse.json(
    { views: updated.viewsCount, counted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(viewedCookie(profile.id), "1", {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    maxAge: DAY_MS / 1000,
  });
  return response;
}
