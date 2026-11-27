import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** ID de usuário do Discord (snowflake): 17 a 20 dígitos. */
export const DISCORD_ID_RE = /^\d{17,20}$/;

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formata segundos como m:ss ou h:mm:ss (ex.: 366 -> "6:06", 3759 -> "1:02:39"). */
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const ss = String(s % 60).padStart(2, "0");
  if (s < 3600) return `${Math.floor(s / 60)}:${ss}`;
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${ss}`;
}

/** Formata contagens compactas em pt-BR (ex.: 1234 -> "1,2 mil"). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Formata contagens completas em pt-BR (ex.: 1200 -> "1.200"). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

/** Tempo decorrido por extenso, curto (ex.: 90 s -> "1 min", 5 h -> "5 h", 3 dias -> "3 dias"). */
export function formatElapsed(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return d === 1 ? "1 dia" : `${d} dias`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo === 1 ? "1 mês" : `${mo} meses`;
  const y = Math.floor(d / 365);
  return y <= 1 ? "1 ano" : `${y} anos`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Valor CSS `cursor` para uma imagem personalizada. `encodeURI` não codifica ( ) ' — que poderiam
 * fechar o `url("...")` antes da hora —, então eles (e aspas/barra invertida) são escapados também.
 */
export function cursorStyle(url: string): string {
  const safe = encodeURI(url).replace(/[()'"\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);
  return `url("${safe}") 4 4, auto`;
}
