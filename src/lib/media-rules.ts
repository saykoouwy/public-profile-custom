/**
 * Regras de mídia puras (sem `server-only`): compartilhadas entre a rota de upload (servidor)
 * e o MediaManager (cliente), para os limites exibidos e validados nunca divergirem.
 */
import type { UploadKind } from "@/types";

export type MediaMime =
  | "video/mp4"
  | "video/webm"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif"
  | "audio/mpeg"
  | "audio/ogg";

export type MediaCategory = "video" | "image" | "audio";

/** Mídias padrão servidas de /public. */
export const DEFAULT_AVATAR = "/default-avatar.webp";
export const DEFAULT_BACKGROUND = "/default-bg.mp4";

/**
 * Únicos caminhos locais (fora de /uploads/) aceitos como mídia de perfil. Allowlist explícita:
 * aceitar "qualquer caminho" permitiria apontar para rotas do app (ex.: avatarUrl "/logout"),
 * que o navegador de cada visitante buscaria com os cookies dele.
 */
export const LOCAL_MEDIA_ASSETS: ReadonlySet<string> = new Set([DEFAULT_AVATAR, DEFAULT_BACKGROUND]);

export const MB = 1024 * 1024;
const VIDEO: MediaMime[] = ["video/mp4", "video/webm"];
const IMAGE: MediaMime[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const AUDIO: MediaMime[] = ["audio/mpeg", "audio/ogg"];

export const MAX_BYTES: Record<MediaCategory, number> = {
  video: 15 * MB,
  image: 5 * MB,
  audio: 10 * MB,
};

export const ALLOWED_BY_KIND: Record<UploadKind, MediaMime[]> = {
  background: [...VIDEO, ...IMAGE],
  audio: AUDIO,
  audioCover: IMAGE,
  avatar: IMAGE,
  cursor: ["image/png", "image/gif", "image/webp"],
};

/** Navegadores ignoram cursores CSS maiores que 128×128 px. */
export const MAX_CURSOR_PX = 128;

export function categoryOf(mime: MediaMime): MediaCategory {
  return mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "audio";
}

/** Categoria pelo MIME informado pelo navegador (pode vir vazio ou com aliases). */
export function categoryOfFileType(type: string): MediaCategory {
  return type.startsWith("video/") ? "video" : type.startsWith("audio/") ? "audio" : "image";
}

const MIME_BY_EXTENSION: Record<string, MediaMime> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  oga: "audio/ogg",
};

/**
 * Tipo do arquivo escolhido: o MIME informado pelo navegador ou, quando ele vem vazio (alguns sistemas
 * não associam .ogg/.webp), um palpite pela extensão. É só para o cliente escolher o limite e assinar o
 * upload: o servidor confere o conteúdo real pelos magic bytes no commit.
 */
export function mimeOfFile(file: { type: string; name: string }): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? "";
}

/** Valor do atributo `accept` do <input type="file"> (inclui o alias audio/mp3 de alguns navegadores). */
export function acceptFor(kind: UploadKind): string {
  const list: string[] = [...ALLOWED_BY_KIND[kind]];
  if (list.includes("audio/mpeg")) list.splice(list.indexOf("audio/mpeg") + 1, 0, "audio/mp3");
  return list.join(",");
}
