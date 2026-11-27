/**
 * Regras de nome de usuário compartilhadas pelo app e pelos scripts CLI (seed/create-user).
 * Sem `import "server-only"`: os scripts rodam fora do Next.js.
 */

/**
 * Caminhos que um perfil em /<usuário> sombrearia (ou seria sombreado por eles):
 * rotas do app, rotas internas do Next.js e arquivos servidos de /public.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Rotas do app
  "customize",
  "login",
  "logout",
  "api",
  "admin",
  // Next.js / metadados
  "_next",
  "favicon.ico",
  "icon.svg",
  "apple-icon.png",
  "opengraph-image",
  "twitter-image",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  "manifest.webmanifest",
  // Arquivos de /public
  "uploads",
  "icons",
  "logo.png",
  "default-avatar.webp",
  "default-bg.mp4",
]);

/** Usernames são únicos sem diferenciar maiúsculas: gravamos sempre em minúsculas. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(username));
}
