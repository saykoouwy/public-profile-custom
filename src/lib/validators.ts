import { z } from "zod";
import { ACTIVITY_TYPES, BACKGROUND_TYPES, SOCIAL_PLATFORMS } from "@/types";
import { DISCORD_ID_RE } from "@/lib/utils";
import { LOCAL_MEDIA_ASSETS } from "@/lib/media-rules";
import { HEX_COLOR_RE } from "@/lib/card-surface";
import { BACKGROUND_EFFECTS } from "@/lib/background-effects";
import { DISPLAY_NAME_EFFECTS, DISPLAY_NAME_FONTS } from "@/lib/display-name";
import { BADGE_IDS } from "@/lib/badges";
import { ASSIGNABLE_ROLES, BAN_DURATIONS, type BanDuration } from "@/lib/roles";

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

// Arquivo enviado no modo de storage local: /uploads/<pasta>/<arquivo>. Sem "..", barras duplas ou query.
const LOCAL_UPLOAD = /^\/uploads(\/[a-zA-Z0-9._-]+)+$/;

/** Caminho local aceito: só os assets padrão da allowlist ou arquivos de /uploads/ (nunca rotas do app). */
function isLocalMedia(v: string): boolean {
  return LOCAL_MEDIA_ASSETS.has(v) || (LOCAL_UPLOAD.test(v) && !v.includes(".."));
}

/** URL de mídia: https:// (R2) ou asset local. String vazia/null remove a mídia. */
export const mediaUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => v === "" || isHttpsUrl(v) || isLocalMedia(v),
    "Mídia deve ser uma URL https:// ou um arquivo local.",
  )
  .transform((v) => (v === "" ? null : v))
  .nullable();

// ---------------------------------------------------------------------------
// Schemas de entrada
// ---------------------------------------------------------------------------

/** Formato de username: login, cadastro e as APIs públicas (/api/views, /api/presence) usam o mesmo. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Usuário deve ter ao menos 3 caracteres.")
  .max(30, "Usuário deve ter no máximo 30 caracteres.")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Usuário contém caracteres inválidos.")
  // Nomes só de pontuação ("...", "---") viram URLs confusas e fáceis de imitar.
  .regex(/[a-zA-Z0-9]/, "Usuário precisa ter ao menos uma letra ou número.");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z
    .string()
    .min(6, "Senha deve ter ao menos 6 caracteres.")
    .max(128, "Senha muito longa."),
});

/** Porcentagem inteira de 0 a 100 (transparência e desfoque do card público). */
const percent = z.number().int().min(0).max(100);

/** Cor #rrggbb, guardada em minúsculas. */
const hexColor = z
  .string()
  .trim()
  .regex(HEX_COLOR_RE, "Use uma cor no formato #rrggbb.")
  .transform((v) => v.toLowerCase());

export const profileUpdateSchema = z
  .object({
    displayName: safeText(32).pipe(z.string().min(1, "Nome é obrigatório.")),
    displayNameFont: z.enum(DISPLAY_NAME_FONTS),
    displayNameEffect: z.enum(DISPLAY_NAME_EFFECTS),
    bio: optionalText(160),
    location: optionalText(60),
    avatarUrl: mediaUrl,
    hasHaloEffect: z.boolean(),
    customCursorUrl: mediaUrl,
    backgroundType: z.enum(BACKGROUND_TYPES),
    backgroundUrl: mediaUrl,
    backgroundEffect: z.enum(BACKGROUND_EFFECTS),
    discordUserId: z
      .string()
      .trim()
      .refine((v) => v === "" || DISCORD_ID_RE.test(v), "ID do Discord deve ter 17–20 dígitos.")
      .transform((v) => (v === "" ? null : v))
      .nullable(),
    showDiscordStatus: z.boolean(),
    manualStatusText: optionalText(80),
    manualActivityType: z.enum(ACTIVITY_TYPES).nullable(),
    shuffleTracks: z.boolean(),
    cardOpacity: percent,
    cardBlur: percent,
    cardBgColor: hexColor,
    cardNameColor: hexColor.nullable(),
    cardTextColor: hexColor.nullable(),
    presenceOpacity: percent,
    presenceBlur: percent,
    presenceBgColor: hexColor,
    presenceTextColor: hexColor.nullable(),
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
    isActive: z.boolean().optional(),
  })
  .strict();

export const socialLinkUpdateSchema = z
  .object({
    label: optionalText(40),
    url: httpsUrl,
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Nada para atualizar.");

export const trackUpdateSchema = z
  .object({
    title: optionalText(60),
    artist: optionalText(60),
  })
  .strict();

export const idSchema = z.uuid("ID inválido.");

// ---------------------------------------------------------------------------
// Admin (privilégio Ultra)
// ---------------------------------------------------------------------------

/** ULTRA não está entre as opções: o painel nunca consegue atribuí-lo. */
export const assignableRoleSchema = z.enum(ASSIGNABLE_ROLES, "Privilégio inválido.");

export const adminCreateUserSchema = loginSchema.extend({ role: assignableRoleSchema }).strict();

export const banSchema = z
  .object({
    duration: z.enum(Object.keys(BAN_DURATIONS) as [BanDuration, ...BanDuration[]], "Duração inválida."),
    reason: optionalText(120).optional(),
  })
  .strict();

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

/** Badges atribuídos pela conta Ultra: ids conhecidos, sem repetição, na ordem escolhida. */
export const badgesSchema = z
  .array(z.enum(BADGE_IDS))
  .max(BADGE_IDS.length)
  .refine((ids) => new Set(ids).size === ids.length, "Badge repetido.");
