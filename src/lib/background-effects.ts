/**
 * Efeitos desenhados por cima do plano de fundo do card público, escolhidos em /customize#midia.
 * Todos são só CSS (gradientes e pequenos SVGs em mosaico animados com transform/opacity, que rodam
 * na GPU): nada de canvas, JavaScript por quadro ou filtros pesados. Com "reduzir movimento" ligado
 * no sistema, as animações param e fica só a camada estática.
 * Estilos em globals.css (classes .bg-fx-*); componente em components/public/BackgroundEffect.tsx.
 */
export const BACKGROUND_EFFECTS = ["none", "vignette", "grain", "vhs", "snow", "rain", "stars", "aurora"] as const;
export type BackgroundEffect = (typeof BACKGROUND_EFFECTS)[number];

export const BACKGROUND_EFFECT_DEFAULT: BackgroundEffect = "none";

export const BACKGROUND_EFFECT_INFO: Record<BackgroundEffect, { label: string; description: string }> = {
  none: { label: "Nenhum", description: "Só o seu plano de fundo." },
  vignette: { label: "Vinheta", description: "Escurece as bordas e destaca o centro." },
  grain: { label: "Granulado", description: "Textura de filme analógico." },
  vhs: { label: "VHS", description: "Fita antiga: linhas, faixa de tracking e tremidas." },
  snow: { label: "Neve", description: "Flocos caindo devagar." },
  rain: { label: "Chuva", description: "Gotas finas caindo na diagonal." },
  stars: { label: "Estrelas", description: "Pontinhos de luz piscando." },
  aurora: { label: "Aurora", description: "Brilhos coloridos se movendo devagar." },
};

export function isBackgroundEffect(v: unknown): v is BackgroundEffect {
  return typeof v === "string" && (BACKGROUND_EFFECTS as readonly string[]).includes(v);
}
