import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Limpa um cookie de sessão órfão (token com assinatura válida, mas usuário/perfil inexistente ou
 * sessão revogada) e leva ao login. Server Components não podem alterar cookies, então o painel
 * redireciona para cá em vez de ir direto para /login.
 *
 * Só apaga o cookie do próprio navegador (não revoga nada no servidor): um link cross-site para cá,
 * no pior caso, desloga o visitante — por isso não exige verificação de origem.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
