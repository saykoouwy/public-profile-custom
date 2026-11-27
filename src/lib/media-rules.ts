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

/** Valor do atributo `accept` do <input type="file"> (inclui o alias audio/mp3 de alguns navegadores). */
export function acceptFor(kind: UploadKind): string {
  const list: string[] = [...ALLOWED_BY_KIND[kind]];
  if (list.includes("audio/mpeg")) list.splice(list.indexOf("audio/mpeg") + 1, 0, "audio/mp3");
  return list.join(",");
}
