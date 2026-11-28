import type { BackgroundEffect as Effect } from "@/lib/background-effects";
import { cn } from "@/lib/utils";

/**
 * Camada de efeito por cima do plano de fundo. Preenche o elemento pai (absolute inset-0), então serve
 * tanto para o fundo fixo da página pública quanto para a prévia do painel. Só CSS: ver .bg-fx-* em globals.css.
 */
export function BackgroundEffect({ effect, className }: { effect: Effect; className?: string }) {
  if (effect === "none") return null;
  return (
    <div aria-hidden className={cn("bg-fx pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {effect === "vignette" && <div className="bg-fx-vignette absolute inset-0" />}
      {effect === "grain" && <div className="bg-fx-grain" />}
      {effect === "vhs" && (
        <>
          {/* linhas rolando + faixa de tracking descendo + tremida de cor/brilho */}
          <div className="bg-fx-vhs-lines" />
          <div className="bg-fx-vhs-band" />
          <div className="bg-fx-vhs-glitch absolute inset-0" />
        </>
      )}
      {effect === "snow" && (
        <>
          <div className="bg-fx-snow bg-fx-snow-far" />
          <div className="bg-fx-snow bg-fx-snow-near" />
        </>
      )}
      {effect === "rain" && <div className="bg-fx-rain" />}
      {effect === "stars" && (
        <>
          <div className="bg-fx-stars bg-fx-stars-a absolute inset-0" />
          <div className="bg-fx-stars bg-fx-stars-b absolute inset-0" />
        </>
      )}
      {effect === "aurora" && (
        <>
          <div className="bg-fx-aurora bg-fx-aurora-a" />
          <div className="bg-fx-aurora bg-fx-aurora-b" />
        </>
      )}
    </div>
  );
}
