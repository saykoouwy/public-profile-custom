import type { CSSProperties } from "react";

/**
 * Aparência dos blocos do card público, ajustada pelo dono em /customize#midia.
 *
 * - Card: card principal, player, informações de jogo e jogos favoritos. Opacidade e desfoque (0–100%)
 *   e cor do fundo; no card principal, também a cor do nome e a cor da bio/local.
 * - Caixa do Discord (presença, dentro do card): opacidade, desfoque, cor do fundo e cor do texto.
 *
 * Os padrões reproduzem o visual original, então quem nunca mexeu vê o card igual.
 */

// --- Card --------------------------------------------------------------------------------------

/** Padrões do card: neutral-900 a 65% + desfoque de 12px (o antigo `bg-neutral-900/65 backdrop-blur-md`). */
export const CARD_OPACITY_DEFAULT = 65;
export const CARD_BLUR_DEFAULT = 50;
/** neutral-900, o fundo original. */
export const CARD_BG_DEFAULT = "#171717";
/** Cores originais do texto do card: nome (branco) e bio (neutral-300; o local usa neutral-400). */
export const CARD_NAME_DEFAULT_HEX = "#ffffff";
export const CARD_TEXT_DEFAULT_HEX = "#d4d4d4";

export type CardSurface = {
  opacity: number;
  blur: number;
  /** Cor do fundo em #rrggbb. */
  bgColor: string;
  /** Cor do nome de exibição; null = branco original. */
  nameColor: string | null;
  /** Cor da bio e do local; null = tons de cinza originais. */
  textColor: string | null;
};

// --- Caixa do Discord ----------------------------------------------------------------------------

/** Padrões da caixa do Discord: branco a 4%, sem desfoque (o antigo `glass-soft`), texto nas cores originais. */
export const PRESENCE_OPACITY_DEFAULT = 4;
export const PRESENCE_BLUR_DEFAULT = 0;
export const PRESENCE_BG_DEFAULT = "#ffffff";
/** Cor original do texto principal da caixa do Discord. */
export const PRESENCE_TEXT_DEFAULT_HEX = "#ffffff";

export type PresenceSurface = {
  opacity: number;
  blur: number;
  /** Cor do fundo em #rrggbb. */
  bgColor: string;
  /** Cor do texto em #rrggbb; null = cores originais (branco e tons de cinza). */
  textColor: string | null;
};

export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

// --- Estilos -------------------------------------------------------------------------------------

/** Desfoque em 100%. 50% = 12px, o mesmo do antigo `backdrop-blur-md`. */
const MAX_BLUR_PX = 24;

const clampPct = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
const round3 = (n: number) => +n.toFixed(3);
const validHex = (c: string | null | undefined) => (c && HEX_COLOR_RE.test(c) ? c : null);
/** Variáveis CSS (--x) no objeto de estilo do React. */
const cssVars = (vars: Record<`--${string}`, string>) => vars as CSSProperties;

function blurFilter(blur: number): CSSProperties {
  const px = (clampPct(blur) / 100) * MAX_BLUR_PX;
  const filter = px > 0 ? `blur(${px}px)` : "none";
  return { backdropFilter: filter, WebkitBackdropFilter: filter };
}

/** "#rrggbb" -> "r g b" (para usar em rgb(... / alfa)). Cor inválida cai no branco. */
function hexToRgb(hex: string): string {
  const h = HEX_COLOR_RE.test(hex) ? hex.slice(1) : "ffffff";
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

/**
 * Card: cor escolhida com a opacidade escolhida, o desfoque do que está atrás, e a borda e a sombra
 * sumindo junto com o fundo (cheias a partir do padrão; em 0% de opacidade o bloco não tem contorno).
 * Sobrescreve as classes `border-white/*` e `shadow-2xl` dos componentes.
 * Também define --card-name (nome) e --card-text-1/2 (bio/local), usadas pelo card principal.
 */
export function cardSurfaceStyle({ opacity, blur, bgColor, nameColor, textColor }: CardSurface): CSSProperties {
  const alpha = clampPct(opacity) / 100;
  const edge = Math.min(1, clampPct(opacity) / CARD_OPACITY_DEFAULT);
  const name = validHex(nameColor) ?? CARD_NAME_DEFAULT_HEX;
  const text = validHex(textColor);
  return {
    ...cssVars({
      "--card-name": name,
      // bio (neutral-300) e local (neutral-400) originais, ou a cor escolhida com o local um pouco mais apagado
      "--card-text-1": text ?? CARD_TEXT_DEFAULT_HEX,
      "--card-text-2": text ? `color-mix(in srgb, ${text} 75%, transparent)` : "#a3a3a3",
    }),
    backgroundColor: `rgb(${hexToRgb(bgColor)} / ${alpha})`,
    ...blurFilter(blur),
    borderColor: `rgb(255 255 255 / ${round3(0.1 * edge)})`,
    // Mesma sombra do `shadow-2xl`, com a opacidade escalada.
    boxShadow: edge > 0 ? `0 25px 50px -12px rgb(0 0 0 / ${round3(0.25 * edge)})` : "none",
  };
}

/** Tons do texto da caixa do Discord: principal, destaque, secundário e terciário. */
const PRESENCE_TEXT_DEFAULT = [PRESENCE_TEXT_DEFAULT_HEX, "#e5e5e5", "#a3a3a3", "#737373"] as const;

/**
 * Caixa do Discord: fundo na cor/opacidade escolhidas, desfoque e borda que some com o fundo.
 * Também define as variáveis --presence-text-1..4 usadas pelos textos do widget: com cor
 * personalizada, os tons secundários são a mesma cor mais apagada.
 */
export function presenceSurfaceStyle({ opacity, blur, bgColor, textColor }: PresenceSurface): CSSProperties {
  const alpha = clampPct(opacity) / 100;
  const edge = Math.min(1, clampPct(opacity) / Math.max(1, PRESENCE_OPACITY_DEFAULT));
  const custom = validHex(textColor);
  const tones = custom
    ? [custom, `color-mix(in srgb, ${custom} 88%, transparent)`, `color-mix(in srgb, ${custom} 65%, transparent)`, `color-mix(in srgb, ${custom} 48%, transparent)`]
    : PRESENCE_TEXT_DEFAULT;
  return {
    backgroundColor: `rgb(${hexToRgb(bgColor)} / ${alpha})`,
    ...blurFilter(blur),
    border: `1px solid rgb(255 255 255 / ${round3(0.08 * edge)})`,
    ...cssVars(Object.fromEntries(tones.map((c, i) => [`--presence-text-${i + 1}`, c]))),
  };
}
