import type { Role } from "@/lib/roles";

/**
 * Personalização do nome de exibição (o texto grande do card) e a regra de troca.
 *
 * O nome de exibição é só aparência: o @usuário (login, endereço /<usuário> e título da aba do
 * navegador) nunca muda ao trocá-lo.
 */

// --- Fontes --------------------------------------------------------------------------------------

/**
 * Cada fonte aponta para a variável CSS criada pelo next/font em app/layout.tsx. As extras são
 * carregadas sem preload: o navegador só baixa o arquivo da fonte que o perfil realmente usa.
 */
export const DISPLAY_NAME_FONTS = [
  "gothic",
  "cinzel",
  "serif",
  "script",
  "marker",
  "neon",
  "horror",
  "pixel",
  "modern",
  "mono",
] as const;
export type DisplayNameFont = (typeof DISPLAY_NAME_FONTS)[number];
export const DISPLAY_NAME_FONT_DEFAULT: DisplayNameFont = "gothic";

export const DISPLAY_NAME_FONT_INFO: Record<DisplayNameFont, { label: string; cssVar: string }> = {
  gothic: { label: "Gótica", cssVar: "--font-display" },
  cinzel: { label: "Imperial", cssVar: "--font-cinzel" },
  serif: { label: "Elegante", cssVar: "--font-playfair" },
  script: { label: "Manuscrita", cssVar: "--font-great-vibes" },
  marker: { label: "Marcador", cssVar: "--font-marker" },
  neon: { label: "Letreiro", cssVar: "--font-monoton" },
  horror: { label: "Terror", cssVar: "--font-creepster" },
  pixel: { label: "Pixel", cssVar: "--font-silkscreen" },
  modern: { label: "Moderna", cssVar: "--font-lexend" },
  mono: { label: "Código", cssVar: "--font-geist-mono" },
};

// --- Efeitos animados ----------------------------------------------------------------------------

/** Efeitos só em CSS (classes .name-fx-* em globals.css). Com "reduzir movimento", ficam parados. */
export const DISPLAY_NAME_EFFECTS = ["none", "corrupt", "glow", "neon", "rainbow", "shine", "fire"] as const;
export type DisplayNameEffect = (typeof DISPLAY_NAME_EFFECTS)[number];
export const DISPLAY_NAME_EFFECT_DEFAULT: DisplayNameEffect = "none";

export const DISPLAY_NAME_EFFECT_INFO: Record<DisplayNameEffect, { label: string; description: string }> = {
  none: { label: "Nenhum", description: "Só o brilho suave padrão." },
  corrupt: { label: "Corrupção", description: "O nome falha e se parte em cores, como sinal corrompido." },
  glow: { label: "Pulsar", description: "Brilho que aumenta e diminui devagar." },
  neon: { label: "Neon", description: "Letreiro de neon com piscadas de vez em quando." },
  rainbow: { label: "Arco-íris", description: "Cores passando pelo nome." },
  shine: { label: "Reflexo", description: "Um reflexo de luz atravessa o nome." },
  fire: { label: "Chamas", description: "Brilho quente que tremula como fogo." },
};

export function isDisplayNameFont(v: unknown): v is DisplayNameFont {
  return typeof v === "string" && (DISPLAY_NAME_FONTS as readonly string[]).includes(v);
}
export function isDisplayNameEffect(v: unknown): v is DisplayNameEffect {
  return typeof v === "string" && (DISPLAY_NAME_EFFECTS as readonly string[]).includes(v);
}

// --- Regra de troca do nome ----------------------------------------------------------------------

/** Membros só trocam o nome de exibição a cada 14 dias; Premium e Ultra trocam quando quiserem. */
export const NAME_CHANGE_COOLDOWN_DAYS = 14;
const COOLDOWN_MS = NAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function hasNameChangeCooldown(role: Role): boolean {
  return role === "MEMBER";
}

/** Quando a próxima troca fica liberada; null = já pode trocar. */
export function nextNameChangeAt(role: Role, lastChangedAt: Date | null, now: Date = new Date()): Date | null {
  if (!hasNameChangeCooldown(role) || !lastChangedAt) return null;
  const next = new Date(lastChangedAt.getTime() + COOLDOWN_MS);
  return next > now ? next : null;
}
