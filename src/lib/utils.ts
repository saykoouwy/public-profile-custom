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

/** Formata contagens compactas (ex.: 1234 -> "1.2K"). */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
