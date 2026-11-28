"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleQuestionMark, Loader2, RotateCcw, Undo2, XCircle } from "lucide-react";
import { updateProfile } from "@/actions/admin";
import {
  CARD_BG_DEFAULT,
  CARD_BLUR_DEFAULT,
  CARD_NAME_DEFAULT_HEX,
  CARD_OPACITY_DEFAULT,
  CARD_TEXT_DEFAULT_HEX,
  HEX_COLOR_RE,
  PRESENCE_BG_DEFAULT,
  PRESENCE_BLUR_DEFAULT,
  PRESENCE_OPACITY_DEFAULT,
  PRESENCE_TEXT_DEFAULT_HEX,
  cardSurfaceStyle,
  presenceSurfaceStyle,
  type CardSurface,
  type PresenceSurface,
} from "@/lib/card-surface";
import { useDismiss } from "@/hooks/useDismiss";
import { clamp, cn } from "@/lib/utils";
import { cardClass, inputClass, primaryButton, secondaryButton, type Notice } from "./ui";
import type { BackgroundKind } from "@/types";

type Background = { type: BackgroundKind; url: string | null };

const CARD_DEFAULTS: CardSurface = {
  opacity: CARD_OPACITY_DEFAULT,
  blur: CARD_BLUR_DEFAULT,
  bgColor: CARD_BG_DEFAULT,
  nameColor: null,
  textColor: null,
};
const PRESENCE_DEFAULTS: PresenceSurface = {
  opacity: PRESENCE_OPACITY_DEFAULT,
  blur: PRESENCE_BLUR_DEFAULT,
  bgColor: PRESENCE_BG_DEFAULT,
  textColor: null,
};

const sameValues = <T extends object>(a: T, b: T) =>
  (Object.keys(a) as (keyof T)[]).every((k) => a[k] === b[k]);

/** Rascunho de um editor: compara com o que está salvo e com os padrões. */
function useDraft<T extends object>(saved: T, defaults: T) {
  const [draft, setDraftState] = useState(saved);
  return {
    draft,
    setDraft: (patch: Partial<T>) => setDraftState((d) => ({ ...d, ...patch })),
    /** Volta para o último estado salvo. */
    revert: () => setDraftState(saved),
    /** Volta para a aparência original do site (ainda precisa salvar). */
    resetToDefaults: () => setDraftState(defaults),
    dirty: !sameValues(draft, saved),
    isDefault: sameValues(draft, defaults),
  };
}
type Draft<T extends object> = ReturnType<typeof useDraft<T>>;

// ---------------------------------------------------------------------------
// Aparência do card + caixa do Discord, com uma barra flutuante única para salvar
// ---------------------------------------------------------------------------

/**
 * Os controles só mexem nas prévias. Ao mudar qualquer coisa, sobe uma barra no rodapé da tela com
 * "Redefinir" (volta ao último estado salvo) e "Salvar". Salvar manda só o que mudou ao updateProfile;
 * o card público usa os novos valores na próxima carga (a página é renderizada a cada requisição).
 */
export function AppearanceEditors({
  card,
  presence,
  background,
}: {
  card: CardSurface;
  presence: PresenceSurface;
  background: Background;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cardDraft = useDraft(card, CARD_DEFAULTS);
  const presenceDraft = useDraft(presence, PRESENCE_DEFAULTS);
  const [result, setResult] = useState<Notice>(null);
  const dirty = cardDraft.dirty || presenceDraft.dirty;

  // A mensagem "salvo" some sozinha depois de um tempo.
  useEffect(() => {
    if (result?.kind !== "ok") return;
    const t = setTimeout(() => setResult(null), 2200);
    return () => clearTimeout(t);
  }, [result]);

  // Avisa antes de sair da página com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = () =>
    startTransition(async () => {
      const c = cardDraft.draft;
      const p = presenceDraft.draft;
      const res = await updateProfile({
        ...(cardDraft.dirty && {
          cardOpacity: c.opacity,
          cardBlur: c.blur,
          cardBgColor: c.bgColor,
          cardNameColor: c.nameColor,
          cardTextColor: c.textColor,
        }),
        ...(presenceDraft.dirty && {
          presenceOpacity: p.opacity,
          presenceBlur: p.blur,
          presenceBgColor: p.bgColor,
          presenceTextColor: p.textColor,
        }),
      });
      if (!res.ok) {
        setResult({ kind: "error", text: res.error });
        return;
      }
      setResult({ kind: "ok", text: "Alterações salvas." });
      router.refresh();
    });

  const discard = () => {
    cardDraft.revert();
    presenceDraft.revert();
    setResult(null);
  };

  // Mudou algo depois de um aviso: o aviso antigo deixa de valer.
  const edit =
    <T extends object>(d: Draft<T>) =>
    (patch: Partial<T>) => {
      if (result) setResult(null);
      d.setDraft(patch);
    };

  return (
    <>
      <CardEditor d={cardDraft} set={edit(cardDraft)} background={background} disabled={pending} />
      <PresenceEditor
        d={presenceDraft}
        set={edit(presenceDraft)}
        card={cardDraft.draft}
        background={background}
        disabled={pending}
      />
      <SaveBar
        state={pending ? "saving" : dirty ? "dirty" : result ? result.kind : null}
        message={result?.text}
        onSave={save}
        onDiscard={discard}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Card (card principal, player, informações de jogo e jogos favoritos)
// ---------------------------------------------------------------------------

function CardEditor({
  d,
  set,
  background,
  disabled,
}: {
  d: Draft<CardSurface>;
  set: (patch: Partial<CardSurface>) => void;
  background: Background;
  disabled: boolean;
}) {
  return (
    <EditorShell
      title="Aparência do card"
      description="Opacidade, desfoque e cor de fundo valem para o card, o player, as informações de jogo e os jogos favoritos. As cores do texto valem para o card principal."
      preview={
        <PreviewStage background={background}>
          <MiniCard style={cardSurfaceStyle(d.draft)} sample>
            <span className="mt-2 block h-8 w-full rounded-lg border border-white/10 bg-white/[0.04]" />
          </MiniCard>
          <MiniPlayer style={cardSurfaceStyle(d.draft)} />
        </PreviewStage>
      }
      onResetDefaults={() => set(CARD_DEFAULTS)}
      isDefault={d.isDefault}
      disabled={disabled}
    >
      <PercentSlider
        label="Opacidade"
        hint="0% = sem fundo · 100% = fundo sólido"
        value={d.draft.opacity}
        onChange={(opacity) => set({ opacity })}
        disabled={disabled}
      />
      <PercentSlider
        label="Desfoque"
        hint="0% = sem desfoque · 100% = desfoque máximo do que está atrás"
        value={d.draft.blur}
        onChange={(blur) => set({ blur })}
        disabled={disabled}
      />
      <ColorField
        label="Cor de fundo"
        hint="Cor do fundo do card, do player, das informações de jogo e dos jogos favoritos. A opacidade acima define o quanto ela aparece."
        value={d.draft.bgColor}
        defaultValue={CARD_BG_DEFAULT}
        onChange={(bgColor) => set({ bgColor: bgColor ?? CARD_BG_DEFAULT })}
        disabled={disabled}
      />
      <ColorField
        label="Cor destaque"
        hint="Muda a cor do seu nome de exibição, o texto grande no topo do card."
        value={d.draft.nameColor}
        defaultValue={null}
        defaultHex={CARD_NAME_DEFAULT_HEX}
        onChange={(nameColor) => set({ nameColor })}
        disabled={disabled}
      />
      <ColorField
        label="Cor de texto"
        hint="Muda a cor da bio e do local no card. O local fica um pouco mais apagado que a bio."
        value={d.draft.textColor}
        defaultValue={null}
        defaultHex={CARD_TEXT_DEFAULT_HEX}
        onChange={(textColor) => set({ textColor })}
        disabled={disabled}
      />
    </EditorShell>
  );
}

// ---------------------------------------------------------------------------
// Caixa do Discord (presença), independente do card
// ---------------------------------------------------------------------------

function PresenceEditor({
  d,
  set,
  card,
  background,
  disabled,
}: {
  d: Draft<PresenceSurface>;
  set: (patch: Partial<PresenceSurface>) => void;
  /** Aparência atual (rascunho) do card, para a prévia mostrar a caixa no contexto real. */
  card: CardSurface;
  background: Background;
  disabled: boolean;
}) {
  return (
    <EditorShell
      title="Caixa do Discord"
      description="A caixa com a presença do Discord (ou a atividade manual) dentro do card. É independente da aparência do card."
      preview={
        <PreviewStage background={background}>
          <MiniCard style={cardSurfaceStyle(card)}>
            <PresencePreview surface={d.draft} />
          </MiniCard>
        </PreviewStage>
      }
      onResetDefaults={() => set(PRESENCE_DEFAULTS)}
      isDefault={d.isDefault}
      disabled={disabled}
    >
      <PercentSlider
        label="Opacidade"
        hint="0% = sem fundo · 100% = fundo sólido"
        value={d.draft.opacity}
        onChange={(opacity) => set({ opacity })}
        disabled={disabled}
      />
      <PercentSlider
        label="Desfoque"
        hint="0% = sem desfoque · 100% = desfoque máximo do que está atrás"
        value={d.draft.blur}
        onChange={(blur) => set({ blur })}
        disabled={disabled}
      />
      <ColorField
        label="Cor de fundo"
        hint="Cor do fundo da caixa do Discord. A opacidade acima define o quanto ela aparece."
        value={d.draft.bgColor}
        defaultValue={PRESENCE_BG_DEFAULT}
        onChange={(bgColor) => set({ bgColor: bgColor ?? PRESENCE_BG_DEFAULT })}
        disabled={disabled}
      />
      <ColorField
        label="Cor de texto"
        hint="Muda a cor dos textos da caixa: nome, atividade, artista e tempo. Os textos secundários usam a mesma cor um pouco mais apagada."
        value={d.draft.textColor}
        defaultValue={null}
        defaultHex={PRESENCE_TEXT_DEFAULT_HEX}
        onChange={(textColor) => set({ textColor })}
        disabled={disabled}
      />
    </EditorShell>
  );
}

// ---------------------------------------------------------------------------
// Barra flutuante de salvar
// ---------------------------------------------------------------------------

/**
 * Pílula fixa no canto inferior da tela. Entra com um pulo (mola) quando há alterações, mostra
 * "salvando…" e, depois de salvar, "Alterações salvas" por alguns segundos antes de sumir.
 */
function SaveBar({
  state,
  message,
  onSave,
  onDiscard,
}: {
  state: "dirty" | "saving" | "ok" | "error" | null;
  message?: string;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const showActions = state === "dirty" || state === "saving" || state === "error";
  // Portal no <body>: o painel em volta usa backdrop-filter, o que faria o `fixed` se prender a ele
  // (e não à tela). Só existe no navegador; no servidor (e na hidratação) não renderiza nada.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {state && (
        <motion.div
          key="save-bar"
          role="region"
          aria-label="Modificações não salvas"
          initial={{ y: 96, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 96, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
          transition={{ type: "spring", stiffness: 520, damping: 16, mass: 0.9 }}
          // Celular: tudo numa linha (texto numa coluna que pode quebrar, botões compactos).
          // A partir de sm: tamanho cheio.
          className="fixed inset-x-3 bottom-3 z-50 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] items-center justify-center gap-x-2 rounded-[1.75rem] border border-white/10 bg-neutral-950/85 py-2 pr-2 pl-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:inset-x-4 sm:bottom-7 sm:max-w-[calc(100%-2rem)] sm:gap-x-5 sm:rounded-[2.1rem] sm:py-3 sm:pr-3 sm:pl-6"
        >
          <p
            role="status"
            className="flex min-w-0 items-center gap-1.5 text-[12px] leading-snug text-neutral-200 sm:gap-2.5 sm:text-[17px]"
          >
            {state === "ok" ? (
              <>
                <CheckCircle2 className="size-4 shrink-0 text-emerald-300 sm:size-5" aria-hidden />
                {message}
              </>
            ) : state === "error" ? (
              <>
                <XCircle className="size-4 shrink-0 text-red-300 sm:size-5" aria-hidden />
                <span className="text-red-200">{message}</span>
              </>
            ) : (
              <>
                <span className="relative flex size-2 shrink-0 sm:size-2.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/60" />
                  <span className="relative size-2 rounded-full bg-amber-300 sm:size-2.5" />
                </span>
                Você tem algumas modificações não salvas, deseja salvar?
              </>
            )}
          </p>
          {showActions && (
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onDiscard}
                disabled={state === "saving"}
                aria-label="Redefinir"
                title="Redefinir"
                className={cn(secondaryButton, "size-9 p-0 sm:size-auto sm:px-5 sm:py-2.5 sm:text-[17px]")}
              >
                <Undo2 className="size-4 sm:size-5" aria-hidden />
                {/* No celular fica só o ícone */}
                <span className="hidden sm:inline">Redefinir</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={state === "saving"}
                className={cn(primaryButton, "px-3.5 py-2 text-[13px] sm:px-5 sm:py-2.5 sm:text-[17px]")}
              >
                {state === "saving" && <Loader2 className="size-4 animate-spin sm:size-5" aria-hidden />}
                Salvar
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

const subscribeNoop = () => () => {};

// ---------------------------------------------------------------------------
// Peças compartilhadas
// ---------------------------------------------------------------------------

function EditorShell({
  title,
  description,
  preview,
  onResetDefaults,
  isDefault,
  disabled,
  children,
}: {
  title: string;
  description: string;
  preview: ReactNode;
  onResetDefaults: () => void;
  isDefault: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 pt-6">
      <div className="flex min-h-6 items-center">
        <h3 className="text-[15px] font-medium text-white">{title}</h3>
      </div>
      <div className={`${cardClass} grid gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]`}>
        {preview}
        <div className="flex min-w-0 flex-col gap-5">
          <p className="text-xs leading-relaxed text-neutral-400">{description}</p>
          {children}
          <div className="mt-auto">
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={isDefault || disabled}
              className={cn(secondaryButton, "px-4 py-2")}
            >
              <RotateCcw className="size-4" aria-hidden />
              Restaurar padrão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Arrasto com o ponteiro capturado: continua mesmo saindo do elemento, até soltar o botão.
 * Devolve a posição relativa (0–1) dentro de `ref`, em x e y.
 */
function useDrag(ref: RefObject<HTMLElement | null>, onMove: (x: number, y: number) => void, disabled?: boolean) {
  const [dragging, setDragging] = useState(false);
  const at = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return;
    onMove(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
  };
  return {
    dragging,
    handlers: {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0) return;
        e.preventDefault(); // sem seleção de texto durante o arraste
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
        setDragging(true);
        at(e);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        if (dragging) at(e);
      },
      onPointerUp: () => setDragging(false),
      onPointerCancel: () => setDragging(false),
      onLostPointerCapture: () => setDragging(false),
    },
  };
}

/**
 * Barra de 0 a 100%. Feita à mão (em vez do <input type="range"> nativo) para dar para segurar e
 * arrastar com folga: a área de toque é alta, o ponteiro fica capturado durante o arraste e
 * `touch-none` impede a página de rolar no celular. Teclado: setas (±1), PageUp/PageDown (±10), Home/End.
 */
function PercentSlider({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const set = (next: number) => {
    const v = clamp(Math.round(next), 0, 100);
    if (v !== value) onChange(v);
  };
  const { dragging, handlers } = useDrag(trackRef, (x) => set(x * 100), disabled);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <span id={labelId} className="text-sm font-medium text-white">
            {label}
          </span>
          <HelpTip text={hint} />
        </span>
        <span className="font-mono text-sm tabular-nums text-amber-300">{value}%</span>
      </div>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        aria-disabled={disabled || undefined}
        {...handlers}
        onKeyDown={(e) => {
          if (disabled) return;
          const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
          if (e.key in steps) set(value + steps[e.key]);
          else if (e.key === "Home") set(0);
          else if (e.key === "End") set(100);
          else return;
          e.preventDefault();
        }}
        className={cn(
          "group relative flex h-7 touch-none items-center rounded-full outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-300/50",
          disabled ? "cursor-not-allowed opacity-50" : dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div ref={trackRef} className="relative h-2 w-full rounded-full bg-white/15">
          <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400" style={{ width: `${value}%` }} />
          <div
            className={cn(
              "absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 bg-white shadow-md shadow-black/40 transition-transform",
              dragging ? "scale-125" : "group-hover:scale-110",
            )}
            style={{ left: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * "?" ao lado do nome de um controle: passar o mouse (ou focar pelo teclado) mostra a explicação.
 * O texto também fica ligado ao botão por aria-describedby, para leitores de tela.
 */
function HelpTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label="O que isto faz?"
        aria-describedby={id}
        className="flex size-4 items-center justify-center rounded-full text-neutral-500 transition hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-amber-300/60"
      >
        <CircleQuestionMark className="size-4" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2 text-xs leading-relaxed font-normal text-neutral-200 opacity-0 shadow-xl shadow-black/50 transition duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/**
 * Cor em #hex: bolinha que abre a paleta + campo de texto. O texto só vira valor quando é um #rrggbb
 * válido. O botão redondo dentro do campo volta para `defaultValue` (null = cores originais do card).
 * Na cor padrão o campo mostra o hex dela (`defaultHex` quando o padrão é null); escolher esse mesmo
 * hex também volta ao padrão, em vez de salvar uma cor "personalizada" idêntica.
 */
function ColorField({
  label,
  hint,
  value,
  defaultValue,
  defaultHex,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: string | null;
  defaultValue: string | null;
  /** Hex exibido quando o padrão é null (cores originais). */
  defaultHex?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const allowDefault = defaultValue === null;
  const isDefault = value === defaultValue;
  const fallbackHex = defaultValue ?? defaultHex ?? "#ffffff";
  const current = value ?? fallbackHex;
  const id = useId();
  const [text, setText] = useState(current);
  // Acompanha mudanças externas (paleta, Redefinir, Restaurar padrão) sem efeito: ajusta durante o render.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(current);
  }
  /** Cor válida digitada/escolhida: igual ao hex padrão vira o próprio padrão. */
  const pick = (hex: string) => onChange(hex.toLowerCase() === fallbackHex.toLowerCase() ? defaultValue : hex.toLowerCase());

  const normalized = text.trim().startsWith("#") ? text.trim() : `#${text.trim()}`;
  const invalid = text.trim() !== "" && !HEX_COLOR_RE.test(normalized);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-white">
          {label}
        </label>
        <HelpTip text={hint} />
      </div>
      <div className="flex items-center gap-3">
        <ColorPicker label={label} value={current} onChange={pick} disabled={disabled} />
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode="text"
            spellCheck={false}
            maxLength={7}
            placeholder={fallbackHex}
            value={text}
            disabled={disabled}
            aria-invalid={invalid}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              const n = next.trim().startsWith("#") ? next.trim() : `#${next.trim()}`;
              if (HEX_COLOR_RE.test(n)) pick(n);
              else if (allowDefault && next.trim() === "") onChange(null);
            }}
            className={cn(inputClass, "pr-11 font-mono uppercase", invalid && "border-red-400/60")}
          />
          {/* Volta para a cor padrão */}
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            disabled={disabled || isDefault}
            aria-label={`${label}: usar a cor padrão`}
            title={isDefault ? "Já está na cor padrão" : "Usar a cor padrão"}
            className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-300 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
      {invalid && <p className="text-[11px] text-red-300">Use o formato #rrggbb (ex.: #1db954).</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paleta de cores (bolinha + mini pop-up)
// ---------------------------------------------------------------------------

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  return `#${[f(5), f(3), f(1)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Cores rápidas da paleta. */
const SWATCHES = [
  "#ffffff", "#d4d4d4", "#737373", "#171717", "#000000",
  "#fcd34d", "#fb923c", "#f87171", "#f472b6", "#c084fc",
  "#818cf8", "#60a5fa", "#22d3ee", "#34d399", "#a3e635",
];

/**
 * Bolinha com a cor atual; ao clicar abre um mini pop-up no padrão do painel com área de
 * saturação/brilho, barra de matiz e cores rápidas. Fecha ao clicar fora ou com Esc.
 */
function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  // Matiz guardada à parte: em cinzas (saturação 0) ela não sai do hex, e não pode "pular" para 0.
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [lastHex, setLastHex] = useState(value);
  if (value.toLowerCase() !== lastHex.toLowerCase()) {
    setLastHex(value);
    setHsv((prev) => {
      const next = hexToHsv(value);
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next;
    });
  }

  const commit = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setLastHex(hex);
    onChange(hex);
  };

  useDismiss(open, () => setOpen(false), [rootRef]);

  const sv = useDrag(svRef, (x, y) => commit({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag(hueRef, (x) => commit({ ...hsv, h: Math.min(359.9, x * 360) }));

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={`${label}: abrir paleta de cores`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "block size-8 rounded-full ring-1 ring-white/20 ring-offset-2 ring-offset-neutral-950 transition hover:scale-110 hover:ring-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:cursor-not-allowed disabled:opacity-50",
          open && "scale-110 ring-white/60",
        )}
        style={{ backgroundColor: value }}
      />

      <AnimatePresence>
        {open && (
          <motion.div
            id={dialogId}
            role="dialog"
            aria-label={`Paleta: ${label}`}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 30 }}
            className="absolute top-full left-0 z-40 mt-3 w-60 origin-top-left rounded-3xl border border-white/10 bg-neutral-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            {/* Saturação (x) e brilho (y) */}
            <div
              ref={svRef}
              {...sv.handlers}
              className="relative h-36 cursor-crosshair touch-none overflow-hidden rounded-2xl select-none"
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
              <span
                className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.5)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
              />
            </div>

            {/* Matiz */}
            <div
              {...hue.handlers}
              className="mt-3 flex h-5 cursor-pointer touch-none items-center select-none"
              aria-hidden
            >
              <div
                ref={hueRef}
                className="relative h-2.5 w-full rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
                />
              </div>
            </div>

            {/* Cores rápidas */}
            <div className="mt-3 grid grid-cols-5 gap-2 border-t border-white/10 pt-3">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Usar ${c}`}
                  onClick={() => onChange(c)}
                  className={cn(
                    "mx-auto block size-6 rounded-full ring-1 ring-white/15 transition hover:scale-115 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
                    c === value.toLowerCase() && "ring-2 ring-white",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <p className="mt-3 flex items-center justify-between font-mono text-[11px] text-neutral-500 uppercase">
              <span>{label}</span>
              <span className="text-neutral-300">{value}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prévias
// ---------------------------------------------------------------------------

/** Fundo da prévia: o plano de fundo do próprio usuário (ou um degradê, se não houver). */
function PreviewStage({ background, children }: { background: Background; children: ReactNode }) {
  return (
    <div
      aria-label="Prévia"
      role="img"
      className="relative flex min-h-[260px] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-amber-500/40 via-fuchsia-600/30 to-sky-600/40 p-5"
    >
      {background.url &&
        (background.type === "VIDEO" ? (
          <video src={background.url} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
          <img src={background.url} alt="" className="absolute inset-0 size-full object-cover" />
        ))}
      {children}
    </div>
  );
}

/** Card em miniatura. Com `sample`, mostra nome/bio/local de exemplo nas cores escolhidas. */
function MiniCard({ style, sample = false, children }: { style: CSSProperties; sample?: boolean; children?: ReactNode }) {
  return (
    <div className="relative w-full max-w-[300px] rounded-2xl border border-white/10 p-4 pt-7 shadow-2xl" style={style}>
      <span className="absolute -top-5 left-1/2 size-10 -translate-x-1/2 rounded-full border-2 border-white/15 bg-neutral-700" />
      <div className="flex flex-col items-center gap-1 text-center">
        {sample ? (
          <>
            <span className="font-display text-xl leading-tight text-(--card-name)">Seu nome</span>
            <span className="text-[11px] text-(--card-text-1)">Sua bio aparece aqui</span>
            <span className="text-[10px] text-(--card-text-2)">Sua cidade</span>
          </>
        ) : (
          <>
            <span className="h-3 w-24 rounded-full bg-white/80" />
            <span className="h-2 w-36 rounded-full bg-white/35" />
            <span className="h-2 w-16 rounded-full bg-white/25" />
          </>
        )}
        {children}
      </div>
    </div>
  );
}

function MiniPlayer({ style }: { style: CSSProperties }) {
  return (
    <div className="relative flex w-full max-w-[300px] items-center gap-2 rounded-xl border border-white/[0.06] p-2.5 shadow-2xl" style={style}>
      <span className="size-7 shrink-0 rounded-md bg-white/10" />
      <span className="flex-1 space-y-1">
        <span className="block h-2 w-20 rounded-full bg-white/70" />
        <span className="block h-1 w-full rounded-full bg-white/20" />
      </span>
    </div>
  );
}

/** Caixa do Discord em miniatura, com texto de exemplo nas mesmas variáveis de cor do widget real. */
function PresencePreview({ surface }: { surface: PresenceSurface }) {
  return (
    <div className="mt-2 flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left" style={presenceSurfaceStyle(surface)}>
      <span className="size-9 shrink-0 rounded-full bg-neutral-600" />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13px] font-semibold text-(--presence-text-1)">seu_nome</span>
        <span className="block truncate text-[11px] text-(--presence-text-3)">
          Ouvindo <span className="font-medium text-(--presence-text-2)">Nome da música</span>
        </span>
        <span className="block truncate text-[10px] text-(--presence-text-4)">de Artista</span>
      </span>
      <span className="size-9 shrink-0 rounded-md bg-white/10" />
    </div>
  );
}
