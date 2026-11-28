"use client";

import { useEffect, useRef, useState } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import type { BackgroundKind } from "@/types";
import type { BackgroundEffect as Effect } from "@/lib/background-effects";
import { BackgroundEffect } from "@/components/public/BackgroundEffect";

export const AUDIO_TOGGLE_EVENT = "biolink:toggle-audio";
export const AUDIO_STATE_EVENT = "biolink:audio-state";
/** Pede para tocar (sem alternar): disparado pela tela "clique para entrar". */
export const AUDIO_PLAY_EVENT = "biolink:play-audio";
/** Novo volume (0–1) escolhido no controle deslizante; o player de música aplica no próprio <audio>. */
export const AUDIO_VOLUME_EVENT = "biolink:audio-volume";

const VOLUME_KEY = "biolink:volume";
const DEFAULT_VOLUME = 0.8;

/** Volume salvo pelo visitante (vale para todos os perfis neste navegador). */
export function readStoredVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

/** iOS ignora `volume` em elementos de mídia (só o botão físico controla); lá o controle deslizante some. */
function volumeIsAdjustable(): boolean {
  const probe = document.createElement("audio");
  probe.volume = 0.5;
  return probe.volume === 0.5;
}

type Props = {
  type: BackgroundKind;
  url: string | null;
  /** Efeito por cima do fundo (neve, chuva...), escolhido pelo dono. */
  effect: Effect;
  /** Quando há música no perfil, o botão controla o player; senão, o som do próprio vídeo. */
  hasMusic: boolean;
};

export default function BackgroundMedia({ type, url, effect, hasMusic }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [canAdjust, setCanAdjust] = useState(false);
  // Barra de volume aberta: com o mouse em cima (ou foco do teclado); no toque, abre no 1º toque.
  const [open, setOpen] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const openedByTouch = useRef(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const isVideo = type === "VIDEO" && !!url;

  useEffect(() => () => clearTimeout(collapseTimer.current), []);

  /** No toque não existe "tirar o mouse": a barra fecha sozinha após alguns segundos sem uso. */
  const scheduleTouchCollapse = () => {
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setOpen(false), 3000);
  };

  // Volume salvo e suporte do navegador só existem no cliente: lidos após a hidratação.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- valores só disponíveis no navegador */
    setVolume(readStoredVolume());
    setCanAdjust(volumeIsAdjustable());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Mantém o ícone em sincronia com o player de música (play/pause feitos no próprio player).
  useEffect(() => {
    if (!hasMusic) return;
    const onState = (e: Event) => setSoundOn((e as CustomEvent<{ playing: boolean }>).detail.playing);
    window.addEventListener(AUDIO_STATE_EVENT, onState);
    return () => window.removeEventListener(AUDIO_STATE_EVENT, onState);
  }, [hasMusic]);

  const applyVolume = (v: number) => {
    setVolume(v);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      // Modo privado/sem storage: vale só nesta visita.
    }
    if (hasMusic) window.dispatchEvent(new CustomEvent(AUDIO_VOLUME_EVENT, { detail: { volume: v } }));
    else if (videoRef.current) videoRef.current.volume = v;
  };

  // Vídeo com som próprio (sem música): aplica o volume salvo assim que ele é lido.
  useEffect(() => {
    if (!hasMusic && videoRef.current) videoRef.current.volume = volume;
  }, [hasMusic, volume]);

  const toggleSound = () => {
    // Ao mutar/desmutar, volta a ser só o ícone (reabre ao passar o mouse de novo).
    clearTimeout(collapseTimer.current);
    setOpen(false);
    // Ativando o som com o volume salvo em 0: volta para um nível audível, senão o clique parece não fazer nada.
    if (!soundOn && volume === 0) applyVolume(0.5);
    if (hasMusic) {
      window.dispatchEvent(new Event(AUDIO_TOGGLE_EVENT));
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (!video.muted) void video.play().catch(() => undefined);
    setSoundOn(!video.muted);
  };

  const showButton = hasMusic || isVideo;
  const audible = soundOn && volume > 0;
  const VolumeIcon = !audible ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const pct = Math.round(volume * 100);

  // `object-cover`: a mídia sempre preenche a tela inteira, sem bordas, em qualquer tamanho de tela.
  // Quando o formato dela difere do da tela, as sobras são cortadas (centralizado) em vez de virar borda.
  const mediaClass = "absolute inset-0 h-full w-full object-cover";

  return (
    <>
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-neutral-950">
        {url && isVideo && (
          <video
            ref={videoRef}
            src={url}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={mediaClass}
          />
        )}
        {url && !isVideo && (
          // eslint-disable-next-line @next/next/no-img-element -- mídia arbitrária do usuário (GIF animado incluso)
          <img src={url} alt="" className={mediaClass} />
        )}
        {!url && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,90,20,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(60,60,80,0.3),transparent_60%)]" />
        )}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
        <BackgroundEffect effect={effect} />
      </div>

      {showButton && (
        // Fechado: só o ícone. Mouse em cima: a barra desliza para fora. Mouse sai: volta ao ícone.
        <div
          ref={controlRef}
          onPointerEnter={(e) => e.pointerType === "mouse" && canAdjust && setOpen(true)}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            // Arrastando a barra e o mouse escapou: só fecha ao soltar, e se não tiver voltado para cima.
            if (e.buttons & 1) {
              window.addEventListener(
                "pointerup",
                () => !controlRef.current?.matches(":hover") && setOpen(false),
                { once: true },
              );
              return;
            }
            setOpen(false);
          }}
          className="fixed top-4 left-4 z-20 flex h-11 items-center rounded-[14px] border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-xl"
        >
          <button
            type="button"
            onPointerDown={(e) => {
              // Toque com a barra fechada: o 1º toque só abre a barra (não muta).
              if (e.pointerType !== "mouse" && canAdjust && !open) {
                openedByTouch.current = true;
                setOpen(true);
                scheduleTouchCollapse();
              }
            }}
            onClick={() => {
              if (openedByTouch.current) {
                openedByTouch.current = false;
                return;
              }
              toggleSound();
            }}
            aria-label={soundOn ? "Mutar" : "Ativar som"}
            aria-pressed={soundOn}
            className="flex size-11 shrink-0 items-center justify-center rounded-[14px] transition active:scale-90"
          >
            <VolumeIcon className="size-[22px]" strokeWidth={2.25} />
          </button>
          {canAdjust && (
            <div
              className={`overflow-hidden transition-[width,opacity,margin] duration-300 ease-out ${
                open ? "mr-4 w-28 opacity-100" : "mr-0 w-0 opacity-0"
              }`}
            >
              <div className="relative flex h-6 w-28 items-center">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                  <div
                    className={`h-full rounded-full transition-colors ${audible ? "bg-white" : "bg-white/45"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => {
                    applyVolume(Number(e.currentTarget.value));
                    if (openedByTouch.current || !window.matchMedia("(hover: hover)").matches) scheduleTouchCollapse();
                  }}
                  // Teclado: Tab até a barra também a abre.
                  onFocus={() => setOpen(true)}
                  onBlur={() => setOpen(false)}
                  aria-label="Volume"
                  aria-valuetext={`${pct}%`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
