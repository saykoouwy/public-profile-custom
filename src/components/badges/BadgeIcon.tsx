"use client";

import { useId } from "react";
import {
  BadgeCheck,
  Bug,
  Crown,
  FlaskConical,
  Gem,
  Gift,
  Heart,
  Leaf,
  Lock,
  Music,
  Rocket,
  Settings,
  ShieldCheck,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BADGE_INFO, type BadgeId } from "@/lib/badges";
import { cn } from "@/lib/utils";

/**
 * Desenho de cada badge: ícone preenchido com degradê (claro em cima, forte embaixo) e contorno escuro
 * da mesma cor, no estilo "sticker" colorido. Vetorial: nítido em qualquer tamanho e sem baixar imagem.
 */
const ART: Record<BadgeId, { Icon: LucideIcon; from: string; to: string; stroke: string }> = {
  founder: { Icon: Crown, from: "#c4b5fd", to: "#7c3aed", stroke: "#3b0764" },
  bug_hunter: { Icon: Bug, from: "#fda4af", to: "#e11d48", stroke: "#4c0519" },
  tester: { Icon: FlaskConical, from: "#7dd3fc", to: "#0284c7", stroke: "#082f49" },
  verified: { Icon: BadgeCheck, from: "#93c5fd", to: "#2563eb", stroke: "#172554" },
  featured: { Icon: Star, from: "#fef08a", to: "#f59e0b", stroke: "#78350f" },
  champion: { Icon: Trophy, from: "#fde68a", to: "#f59e0b", stroke: "#78350f" },
  supporter: { Icon: Gem, from: "#ddd6fe", to: "#7c3aed", stroke: "#2e1065" },
  moderator: { Icon: ShieldCheck, from: "#86efac", to: "#10b981", stroke: "#022c22" },
  pioneer: { Icon: Rocket, from: "#fecaca", to: "#ef4444", stroke: "#450a0a" },
  gifted: { Icon: Gift, from: "#fed7aa", to: "#f97316", stroke: "#431407" },
  newcomer: { Icon: Leaf, from: "#bbf7d0", to: "#22c55e", stroke: "#052e16" },
  booster: { Icon: Zap, from: "#e9d5ff", to: "#a855f7", stroke: "#3b0764" },
  beloved: { Icon: Heart, from: "#fecdd3", to: "#e11d48", stroke: "#4c0519" },
  developer: { Icon: Settings, from: "#f4f4f5", to: "#a1a1aa", stroke: "#27272a" },
  exclusive: { Icon: Lock, from: "#e4e4e7", to: "#71717a", stroke: "#18181b" },
  musician: { Icon: Music, from: "#f3e8ff", to: "#9333ea", stroke: "#3b0764" },
};

/** Só o desenho (decorativo). */
export function BadgeIcon({ id, className }: { id: BadgeId; className?: string }) {
  // Id do degradê único por instância (o mesmo badge pode aparecer várias vezes na página).
  const gradientId = `badge-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { Icon, from, to, stroke } = ART[id];
  return (
    <Icon
      aria-hidden
      className={cn("drop-shadow-[0_2px_4px_rgb(0_0_0/0.45)]", className)}
      fill={`url(#${gradientId})`}
      stroke={stroke}
      strokeWidth={1.6}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
    </Icon>
  );
}

/**
 * Badge com nome ao passar o mouse (ou focar/tocar): balãozinho acima, no estilo do site.
 * O tamanho vem de quem usa (no card público, um tamanho fluido que encolhe no celular).
 */
export function Badge({ id, className }: { id: BadgeId; className?: string }) {
  const info = BADGE_INFO[id];
  return (
    <span
      tabIndex={0}
      aria-label={`${info.label}: ${info.description}`}
      className={cn("group/badge relative inline-flex shrink-0 items-center justify-center rounded-full outline-none", className)}
    >
      <BadgeIcon id={id} className="size-full transition-transform duration-200 group-hover/badge:scale-110 group-focus-visible/badge:scale-110" />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-48 -translate-x-1/2 translate-y-1 rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-1.5 text-center font-sans text-xs leading-snug text-neutral-200 opacity-0 shadow-xl shadow-black/50 transition duration-150 group-hover/badge:translate-y-0 group-hover/badge:opacity-100 group-focus-visible/badge:translate-y-0 group-focus-visible/badge:opacity-100"
      >
        <span className="block font-semibold text-white">{info.label}</span>
        <span className="block text-[11px] text-neutral-400">{info.description}</span>
      </span>
    </span>
  );
}
