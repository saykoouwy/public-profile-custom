"use client";

import { motion } from "framer-motion";
import { Gamepad2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TEMPORÁRIO: blocos laterais do card público (informações de jogo e jogos favoritos)
 * enquanto as funções reais não existem. Mostram um esqueleto do que virá + "Em breve".
 */
export function ComingSoonPanel({ kind, className }: { kind: "stats" | "games"; className?: string }) {
  const stats = kind === "stats";
  const Icon = stats ? Trophy : Gamepad2;

  return (
    <motion.aside
      aria-label={stats ? "Informações de jogo (em breve)" : "Jogos favoritos (em breve)"}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative min-h-[230px] overflow-hidden xl:min-h-[320px] rounded-[27.5px] border border-white/10 bg-neutral-900/65 p-5 shadow-2xl backdrop-blur-md",
        className,
      )}
    >
      <header className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/[0.06]">
          <Icon className="size-[18px] text-amber-300" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-bold text-white">{stats ? "Informações de jogo" : "Jogos favoritos"}</h2>
          <p className="truncate text-xs text-neutral-500">{stats ? "Rank, elo e partidas" : "Vitrine dos favoritos"}</p>
        </div>
      </header>

      {/* Esqueleto do que vai aparecer aqui, apagado por trás do aviso */}
      <div aria-hidden className="mt-5 opacity-40 blur-[1px]">
        {stats ? <StatsSkeleton /> : <GamesSkeleton />}
      </div>

      {/* Aviso "em desenvolvimento" com animação de carregamento */}
      <div className="absolute inset-x-0 top-16 bottom-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-neutral-950/20 via-neutral-950/60 to-neutral-950/80 text-center">
        <LoadingRing />
        <div>
          <p className="text-sm font-semibold text-white">Em desenvolvimento</p>
          <p className="mt-0.5 text-xs text-neutral-400">Em breve por aqui</p>
        </div>
      </div>
    </motion.aside>
  );
}

/** Anel girando com um arco amarelo (a animação de carregando). */
function LoadingRing() {
  return (
    <span role="status" aria-label="Carregando" className="relative block size-10">
      <span className="absolute inset-0 rounded-full border-[3px] border-white/10" />
      <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-amber-300 border-r-amber-300/40" />
    </span>
  );
}

function Shimmer({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-white/10", className)} />;
}

function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shimmer className="size-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-3.5 w-2/3" />
          <Shimmer className="h-3 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-1.5 rounded-xl bg-white/[0.04] p-2.5">
            <Shimmer className="h-4 w-3/4" />
            <Shimmer className="h-2.5 w-1/2" />
          </div>
        ))}
      </div>
      <Shimmer className="h-2 w-full rounded-full" />
    </div>
  );
}

function GamesSkeleton() {
  return (
    <div className="mx-auto grid max-w-[300px] grid-cols-3 gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        // Telas menores mostram só a primeira fileira, para o bloco não ficar alto demais
        <div key={i} className={cn("space-y-1.5", i >= 3 && "max-xl:hidden")}>
          <Shimmer className="aspect-[3/4] w-full rounded-xl" />
          <Shimmer className="h-2.5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
