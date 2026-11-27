import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

/**
 * Camada 1 (firewall de borda): bloqueia /customize sem um JWT válido antes de qualquer renderização.
 * A validação contra o banco (usuário existe, sessão não revogada) acontece nas camadas 2 e 3.
 *
 * Importante: aqui NÃO redirecionamos /login -> /customize. Um token com assinatura válida mas sem
 * usuário/perfil no banco faria /customize mandar para /login e este proxy devolver para /customize
 * (loop ERR_TOO_MANY_REDIRECTS). Esse redirecionamento é feito pela página de login, consultando o banco.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/customize") && !(await verifyToken(request.cookies.get(SESSION_COOKIE)?.value))) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/customize", "/customize/:path*", "/login", "/logout"],
};
