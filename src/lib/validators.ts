import { z } from "zod";
import { ACTIVITY_TYPES, BACKGROUND_TYPES, SOCIAL_PLATFORMS } from "@/types";

// ---------------------------------------------------------------------------
// Primitivas de sanitização
// ---------------------------------------------------------------------------

// Remove tags HTML, caracteres de controle (exceto quebra de linha) e colapsa espaços.
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Texto livre sanitizado com limite de tamanho. */
const safeText = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(max, `Máximo de ${max} caracteres.`));

/** Texto opcional: string vazia vira null. */
const optionalText = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(max, `Máximo de ${max} caracteres.`))
    .transform((v) => (v === "" ? null : v))
    .nullable();

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** URL externa estrita: apenas https://, sem credenciais embutidas. Bloqueia javascript:, data:, http:, etc. */
export const httpsUrl = z
  .string()
  .trim()
  .max(2048, "URL muito longa.")
  .refine(isHttpsUrl, "Use uma URL válida começando com https://");

// Caminho local servido de /public (ex.: "/default-bg.mp4"). Sem "..", barras duplas ou query.
const LOCAL_ASSET = /^\/(?!\/)[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/;

/** URL de mídia: https:// (R2) ou asset local. String vazia/null remove a mídia. */
export const mediaUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => v === "" || isHttpsUrl(v) || (LOCAL_ASSET.test(v) && !v.includes("..")),
    "Mídia deve ser uma URL https:// ou um arquivo local.",
  )
  .transform((v) => (v === "" ? null : v))
  .nullable();

// ---------------------------------------------------------------------------
// Schemas de entrada
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Usuário deve ter ao menos 3 caracteres.")
    .max(30, "Usuário deve ter no máximo 30 caracteres.")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Usuário contém caracteres inválidos."),
  password: z
    .string()
    .min(6, "Senha deve ter ao menos 6 caracteres.")
    .max(128, "Senha muito longa."),
});

export const profileUpdateSchema = z
  .object({
    displayName: safeText(32).pipe(z.string().min(1, "Nome é obrigatório.")),
    bio: optionalText(160),
    location: optionalText(60),
    avatarUrl: mediaUrl,
    hasHaloEffect: z.boolean(),
    customCursorUrl: mediaUrl,
    backgroundType: z.enum(BACKGROUND_TYPES),
    backgroundUrl: mediaUrl,
    discordUserId: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{17,20}$/.test(v), "ID do Discord deve ter 17–20 dígitos.")
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    showDiscordStatus: z.boolean(),
    manualStatusText: optionalText(80),
    manualActivityType: z.enum(ACTIVITY_TYPES).nullable(),
    shuffleTracks: z.boolean(),
  })
  .partial()
  .strict()
  .superRefine((data, ctx) => {
    // Modos exclusivos: atividade manual (tipo definido) não pode coexistir com o status do Discord.
    if (data.showDiscordStatus === true && data.manualActivityType) {
      ctx.addIssue({
        code: "custom",
        path: ["manualActivityType"],
        message: "Desative a atividade manual para mostrar o status do Discord.",
      });
    }
    if (data.manualActivityType && "manualStatusText" in data && !data.manualStatusText) {
      ctx.addIssue({ code: "custom", path: ["manualStatusText"], message: "Informe o texto da atividade manual." });
    }
  });

export const socialLinkSchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    label: optionalText(40).optional(),
    url: httpsUrl,
  })
  .strict();

export const trackUpdateSchema = z
  .object({
    title: optionalText(60),
    artist: optionalText(60),
  })
  .strict();

export const idSchema = z.uuid("ID inválido.");

export const reorderSchema = z
  .array(idSchema)
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "IDs duplicados.");

/** Converte erros do Zod em { campo: [mensagens] } para feedback no formulário. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
