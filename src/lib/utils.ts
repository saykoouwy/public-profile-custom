import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
