import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

/**
 * Camada 1 (firewall de borda): bloqueia /admin sem um JWT válido antes de qualquer renderização
 * e evita que um admin já autenticado veja /login. A validação contra o banco acontece nas camadas 2 e 3.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && !session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/login"],
};
