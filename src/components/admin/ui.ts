/** Aviso curto de sucesso/erro exibido pelas seções do painel. */
export type Notice = { kind: "ok" | "error"; text: string } | null;

// Classes compartilhadas do painel (/customize), no mesmo padrão da página inicial e do login.

/** Painel principal: escuro, translúcido e com desfoque (igual ao hero da página inicial). */
export const panelClass =
  "rounded-[2rem] border border-white/10 bg-black/45 shadow-2xl shadow-black/40 backdrop-blur-2xl";

/** Cartão interno, dentro de um painel. */
export const cardClass = "rounded-2xl border border-white/10 bg-white/[0.03]";

export const inputBase =
  "w-full rounded-xl border bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:bg-white/[0.06] focus:ring-4";
export const inputOk = "border-white/10 focus:border-white/30 focus:ring-white/5";
export const inputErr = "border-red-400/60 focus:border-red-400 focus:ring-red-400/10";
export const inputClass = `${inputBase} ${inputOk}`;

/** Botão principal em creme (mesmo do "Entrar" do login). */
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#ecebe6] px-5 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50";

/** Botão secundário translúcido. */
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

/** Rótulo pequeno em caixa alta acima dos títulos ("01 · MÍDIA"). */
export const eyebrowClass = "font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase";
