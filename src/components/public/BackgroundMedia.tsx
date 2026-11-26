"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { BackgroundKind } from "@/types";

export const AUDIO_TOGGLE_EVENT = "biolink:toggle-audio";
export const AUDIO_STATE_EVENT = "biolink:audio-state";
/** Pede para tocar (sem alternar): disparado pela tela "clique para entrar". */
export const AUDIO_PLAY_EVENT = "biolink:play-audio";

type Props = {
  type: BackgroundKind;
  url: string | null;
  /** Quando há música no perfil, o botão controla o player; senão, o som do próprio vídeo. */
  hasMusic: boolean;
};

export default function BackgroundMedia({ type, url, hasMusic }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const isVideo = type === "VIDEO" && !!url;

  // Mantém o ícone em sincronia com o player de música (play/pause feitos no próprio player).
  useEffect(() => {
    if (!hasMusic) return;
    const onState = (e: Event) => setSoundOn((e as CustomEvent<{ playing: boolean }>).detail.playing);
    window.addEventListener(AUDIO_STATE_EVENT, onState);
    return () => window.removeEventListener(AUDIO_STATE_EVENT, onState);
  }, [hasMusic]);

  const toggleSound = () => {
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
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {url && !isVideo && (
          // eslint-disable-next-line @next/next/no-img-element -- mídia arbitrária do usuário (GIF animado incluso)
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!url && (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,90,20,0.25),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(60,60,80,0.3),transparent_60%)]" />
        )}
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      </div>

      {showButton && (
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Desativar som" : "Ativar som"}
          aria-pressed={soundOn}
          className="glass fixed top-4 left-4 z-20 flex size-11 items-center justify-center rounded-full text-white/90 shadow-lg transition hover:scale-105 hover:text-white active:scale-95"
        >
          {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
      )}
    </>
  );
}
