import "server-only";
import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaMime } from "@/lib/media-rules";
import type { UploadKind } from "@/types";

// ---------------------------------------------------------------------------
// Regras de mídia: MIME aceitos, limites e assinaturas (magic bytes)
// ---------------------------------------------------------------------------

export { ALLOWED_BY_KIND, MAX_BYTES, categoryOf, type MediaMime } from "@/lib/media-rules";

const EXTENSION: Record<MediaMime, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
};

/** Normaliza aliases enviados por navegadores (ex.: audio/mp3 -> audio/mpeg). */
export function normalizeMime(mime: string): MediaMime | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (m === "audio/mp3" || m === "audio/mpeg3" || m === "audio/x-mpeg") return "audio/mpeg";
  if (m === "image/jpg") return "image/jpeg";
  return (Object.keys(EXTENSION) as MediaMime[]).includes(m as MediaMime) ? (m as MediaMime) : null;
}

export const SNIFF_BYTES = 32;

// "Brands" ISO BMFF aceitas após "ftyp" (MP4/M4V/variantes 3GP comuns em celulares).
const MP4_BRANDS = new Set([
  "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "mp71", "avc1", "dash",
  "M4V ", "M4VH", "M4VP", "MSNV", "3gp4", "3gp5", "3gp6", "3g2a", "f4v ", "qt  ",
]);

/**
 * Cabeçalho de frame MPEG de áudio (MP3 sem tag ID3): sync de 11 bits, versão e camada válidas,
 * bitrate diferente de "livre"(0)/"inválido"(15) e sample rate diferente do reservado (3).
 */
function isMpegAudioFrame(b: Uint8Array): boolean {
  if (b.length < 3 || b[0] !== 0xff || (b[1] & 0xe0) !== 0xe0) return false;
  const version = (b[1] >> 3) & 0x03; // 1 = reservado
  const layer = (b[1] >> 1) & 0x03; // 0 = reservado
  const bitrate = (b[2] >> 4) & 0x0f;
  const sampleRate = (b[2] >> 2) & 0x03;
  return version !== 1 && layer !== 0 && bitrate !== 0 && bitrate !== 0x0f && sampleRate !== 0x03;
}

/** Detecta o tipo real do arquivo pelos primeiros bytes. Retorna null se não reconhecido. */
export function sniffMime(head: Uint8Array): MediaMime | null {
  const b = head;
  const ascii = (start: number, s: string) =>
    b.length >= start + s.length && s.split("").every((ch, i) => b[start + i] === ch.charCodeAt(0));
  const text = (start: number, len: number) => String.fromCharCode(...b.subarray(start, start + len));

  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v))
    return "image/png";
  if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (b.length >= 12 && ascii(4, "ftyp")) {
    // Tamanho da caixa ftyp (big-endian) precisa ser plausível e a major brand conhecida.
    const boxSize = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
    return boxSize >= 16 && boxSize <= 512 && MP4_BRANDS.has(text(8, 4)) ? "video/mp4" : null;
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (ascii(0, "OggS")) return "audio/ogg";
  // ID3v2: "ID3" + versão principal 2–4 + revisão 0xff-livre.
  if (ascii(0, "ID3") && b.length >= 5 && b[3] >= 2 && b[3] <= 4 && b[4] !== 0xff) return "audio/mpeg";
  if (isMpegAudioFrame(b)) return "audio/mpeg";
  return null;
}

/** Gera chave UUID imutável: o nome enviado pelo usuário nunca é usado (sem path traversal/sobrescrita). */
export function buildObjectKey(kind: UploadKind, mime: MediaMime): string {
  return `${kind}/${crypto.randomUUID()}.${EXTENSION[mime]}`;
}

/** Tipo implícito na extensão da chave gerada por buildObjectKey. */
export function mimeFromKey(key: string): MediaMime | null {
  const ext = key.split(".").pop();
  const entry = (Object.entries(EXTENSION) as [MediaMime, string][]).find(([, e]) => e === ext);
  return entry ? entry[0] : null;
}

const KEY_PATTERN =
  /^(background|audio|audioCover|avatar|cursor)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm|jpg|png|webp|gif|mp3|ogg)$/;

export function isValidObjectKey(key: string, kind?: UploadKind): boolean {
  return KEY_PATTERN.test(key) && (!kind || key.startsWith(`${kind}/`));
}

// ---------------------------------------------------------------------------
// Drivers: Cloudflare R2 (produção) ou disco local (apenas desenvolvimento sem R2)
// ---------------------------------------------------------------------------

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain: string;
};

function r2Config(): R2Config | null {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_DOMAIN,
  } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_DOMAIN) {
    return null;
  }
  const domain = R2_PUBLIC_DOMAIN.startsWith("http") ? R2_PUBLIC_DOMAIN : `https://${R2_PUBLIC_DOMAIN}`;
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucket: R2_BUCKET_NAME,
    publicDomain: domain.replace(/\/+$/, ""),
  };
}

export type StorageMode = "r2" | "local" | "disabled";

export function storageMode(): StorageMode {
  if (r2Config()) return "r2";
  return process.env.NODE_ENV === "production" ? "disabled" : "local";
}

let s3: S3Client | undefined;
function client(cfg: R2Config): S3Client {
  s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  return s3;
}

const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");
const LOCAL_PREFIX = "/uploads/";

function localPath(key: string): string {
  if (!isValidObjectKey(key)) throw new Error("Invalid object key");
  return path.join(LOCAL_ROOT, ...key.split("/"));
}

export function publicUrlFor(key: string): string {
  const cfg = r2Config();
  return cfg ? `${cfg.publicDomain}/${key}` : `${LOCAL_PREFIX}${key}`;
}

/** Extrai a chave de um URL salvo no perfil, apenas se ele pertencer ao nosso storage. */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const cfg = r2Config();
  let key: string | null = null;
  if (cfg && url.startsWith(`${cfg.publicDomain}/`)) key = url.slice(cfg.publicDomain.length + 1);
  else if (url.startsWith(LOCAL_PREFIX)) key = url.slice(LOCAL_PREFIX.length);
  return key && isValidObjectKey(key) ? key : null;
}

/**
 * Mídia do perfil aceita pelo servidor: asset local de /public (ex.: "/default-avatar.webp", já validado
 * pelo schema) ou um arquivo do NOSSO storage. URLs https:// de terceiros são recusadas: serviriam para
 * rastrear IP/User-Agent de quem visita a página pública.
 */
export function isOwnMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith(LOCAL_PREFIX)) return true;
  return keyFromPublicUrl(url) !== null;
}

export type UploadTarget = { method: "PUT"; url: string; headers: Record<string, string> };

/** Cria destino de upload direto (URL pré-assinada do R2 com tipo e tamanho fixados, válida por 5 min). */
export async function createUploadTarget(key: string, mime: MediaMime, size: number): Promise<UploadTarget> {
  const cfg = r2Config();
  if (cfg) {
    const url = await getSignedUrl(
      client(cfg),
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        ContentType: mime,
        ContentLength: size,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { expiresIn: 300, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    return { method: "PUT", url, headers: { "Content-Type": mime } };
  }
  if (storageMode() === "local") {
    return { method: "PUT", url: `/api/upload?key=${encodeURIComponent(key)}`, headers: { "Content-Type": mime } };
  }
  throw new Error("Storage is not configured");
}

/** Driver local: grava o corpo recebido (somente em desenvolvimento). */
export async function writeLocalObject(key: string, data: Uint8Array): Promise<void> {
  if (storageMode() !== "local") throw new Error("Local storage disabled");
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data, { flag: "wx" });
}

/** Lê os primeiros bytes do objeto armazenado e o tamanho total, para validar magic bytes após o upload. */
export async function readObjectHead(key: string): Promise<{ head: Uint8Array; size: number } | null> {
  const cfg = r2Config();
  try {
    if (cfg) {
      const res = await client(cfg).send(
        new GetObjectCommand({ Bucket: cfg.bucket, Key: key, Range: `bytes=0-${SNIFF_BYTES - 1}` }),
      );
      const head = res.Body ? await res.Body.transformToByteArray() : new Uint8Array();
      const total = Number(res.ContentRange?.split("/")[1] ?? res.ContentLength ?? 0);
      return { head, size: total };
    }
    const handle = await open(localPath(key), "r");
    try {
      const buf = new Uint8Array(SNIFF_BYTES);
      const { bytesRead } = await handle.read(buf, 0, SNIFF_BYTES, 0);
      const { size } = await handle.stat();
      return { head: buf.subarray(0, bytesRead), size };
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!isValidObjectKey(key)) return;
  const cfg = r2Config();
  try {
    if (cfg) {
      await client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    } else if (storageMode() === "local") {
      await unlink(localPath(key));
    }
  } catch (err) {
    console.error("[storage] failed to delete object", key, err);
  }
}

/** Remove do storage a mídia antiga de um campo do perfil, se ela for nossa (ignora URLs externas e defaults). */
export async function deleteByPublicUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(url);
  if (key) await deleteObject(key);
}
