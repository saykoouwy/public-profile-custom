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
// Destinos de sub-recursos (tag <img>/<audio>/<video>/<script>/CSS/fontes). Navegações e fetch do
// próprio app ("document", "empty") seguem normalmente.
const SUBRESOURCE_DESTS = new Set([
  "image",
  "audio",
  "video",
  "track",
  "script",
  "style",
  "font",
  "object",
  "embed",
  "worker",
  "manifest",
]);

export function GET(request: NextRequest) {
  // Defesa em profundidade: uma mídia apontando para /logout (ex.: <img src="/logout">) não desloga
  // quem estiver vendo a página. A allowlist de mídia já impede isso; aqui é a segunda barreira.
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && SUBRESOURCE_DESTS.has(dest)) {
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
