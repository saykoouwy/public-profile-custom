import type { NextRequest } from "next/server";

/**
 * Bloqueia requisições cross-site (defesa extra além do cookie SameSite=Strict). Navegadores sempre
 * enviam `Origin` em POST/PUT via fetch/XHR; sem ele, só aceitamos com `Sec-Fetch-Site: same-origin`.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) return origin === request.nextUrl.origin;
  return request.headers.get("sec-fetch-site") === "same-origin";
}
