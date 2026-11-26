import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

/** Um cookie por perfil: visitar um perfil não impede de contar a visita em outro. */
const viewedCookie = (profileId: string) => `bl_viewed_${profileId}`;
const bodySchema = z.object({ username: z.string().regex(/^[a-zA-Z0-9_.-]{3,30}$/) });
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embed|curl|wget|python|headless|lighthouse/i;

/**
 * Incrementa o contador de visualizações de forma atômica, no máximo uma vez a cada 24h por navegador
 * (cookie HttpOnly). Requisições cross-site e user-agents de bots apenas leem o valor atual.
 */
export async function POST(request: NextRequest) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ views: 0 }, { status: 400 });

  const profile = await prisma.profile.findFirst({
    where: { user: { username: { equals: body.data.username, mode: "insensitive" } } },
    select: { id: true, viewsCount: true },
  });
  if (!profile) return NextResponse.json({ views: 0 }, { status: 404 });

  const origin = request.headers.get("origin");
  const sameOrigin = origin === request.nextUrl.origin;
  const ua = request.headers.get("user-agent") ?? "";
  const alreadyCounted = request.cookies.has(viewedCookie(profile.id));

  if (!sameOrigin || alreadyCounted || !ua || BOT_UA.test(ua)) {
    return NextResponse.json({ views: profile.viewsCount, counted: false }, { headers: { "Cache-Control": "no-store" } });
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
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
