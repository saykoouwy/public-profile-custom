"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import {
  AUDIO_PLAY_EVENT,
  AUDIO_STATE_EVENT,
  AUDIO_TOGGLE_EVENT,
} from "@/components/public/BackgroundMedia";
import { formatTime } from "@/lib/utils";
import type { PublicTrack } from "@/types";

const SKIP_SECONDS = 10;

// Alguns arquivos (ex.: streams sem índice) reportam duração Infinity/NaN até serem lidos por completo.
const finiteOrZero = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Fisher–Yates: embaralha sem viés. */
function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export default function AudioPlayer({ tracks, shuffle = false }: { tracks: PublicTrack[]; shuffle?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Ordem de reprodução (índices de `tracks`), definida no cliente após a hidratação; null = ainda não definida.
  const [clientOrder, setClientOrder] = useState<number[] | null>(null);
  const order = clientOrder ?? tracks.map((_, i) => i);
  const [index, setIndex] = useState(0);
  const resumeRef = useRef(false); // continuar tocando após trocar de faixa
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState<number | null>(null);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, []);

  // Os metadados podem carregar antes da hidratação (evento perdido): lê o estado atual na montagem.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && audio.readyState >= HTMLMediaElement.HAVE_METADATA) setDuration(finiteOrZero(audio.duration));
  }, []);

  // O botão de som global (BackgroundMedia) alterna este player; a tela de entrada só pede para tocar.
  useEffect(() => {
    const play = () => {
      const audio = audioRef.current;
      if (audio?.paused) void audio.play().catch(() => setPlaying(false));
    };
    window.addEventListener(AUDIO_TOGGLE_EVENT, toggle);
    window.addEventListener(AUDIO_PLAY_EVENT, play);
    return () => {
      window.removeEventListener(AUDIO_TOGGLE_EVENT, toggle);
      window.removeEventListener(AUDIO_PLAY_EVENT, play);
    };
  }, [toggle]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(AUDIO_STATE_EVENT, { detail: { playing } }));
  }, [playing]);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
    setCurrent(audio.currentTime);
  }, []);

  // Arraste da barra: o valor mais recente fica num ref para o "soltar" funcionar mesmo fora do <input>
  // (dedo/mouse soltos fora da barra, toque cancelado) — a barra nunca fica congelada em `seeking`.
  const dragValue = useRef<number | null>(null);
  const dragging = seeking !== null;
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      if (dragValue.current !== null) seekTo(dragValue.current);
      dragValue.current = null;
      setSeeking(null);
    };
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [dragging, seekTo]);

  const many = tracks.length > 1;
  const track = tracks[order[Math.min(index, order.length - 1)] ?? 0] ?? tracks[0];
  const { audioUrl: src, title, artist, coverUrl } = track;

  // Modo aleatório: sorteia a ordem no navegador (a página é servida do cache, então sortear no
  // servidor faria todos os visitantes ouvirem a mesma "aleatória"). A música começa no clique da EnterScreen.
  // O sorteio precisa acontecer só no navegador (Math.random no render quebraria a hidratação),
  // por isso é um setState único em efeito de montagem.
  useEffect(() => {
    const n = tracks.length;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor só disponível no cliente (aleatório)
    setClientOrder(shuffle && n > 1 ? shuffled(n) : Array.from({ length: n }, (_, i) => i));
  }, [shuffle, tracks.length]);

  /** Troca de faixa (com volta ao início/fim da playlist); `resume` mantém a reprodução. */
  const changeTrack = (next: number, resume: boolean) => {
    resumeRef.current = resume;
    setIndex((next + order.length) % order.length);
    setCurrent(0);
    setDuration(0);
    dragValue.current = null;
    setSeeking(null);
  };

  const goTo = (next: number) => changeTrack(next, !!audioRef.current && !audioRef.current.paused);

  // Ao mudar o src, retoma a reprodução se a faixa anterior estava tocando (ou terminou sozinha).
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && resumeRef.current) void audio.play().catch(() => setPlaying(false));
    resumeRef.current = false;
  }, [src]);

  const previous = () => {
    // Como em players comuns: com mais de 3s tocados, "anterior" volta ao início da faixa.
    if (!many || (audioRef.current?.currentTime ?? 0) > 3) seekTo(0);
    else goTo(index - 1);
  };

  const next = () => (many ? goTo(index + 1) : seekTo(current + SKIP_SECONDS));

  const shown = seeking ?? current;
  const progress = duration > 0 ? (shown / duration) * 100 : 0;

  return (
    <motion.section
      aria-label="Player de música"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto mt-4 grid w-[92%] max-w-[480px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 rounded-2xl border border-white/10 bg-neutral-900/65 p-3 shadow-2xl backdrop-blur-md"
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        loop={!many}
        onEnded={() => many && changeTrack(index + 1, true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        // durationchange já dispara ao carregar os metadados (e de novo se a duração mudar).
        onDurationChange={(e) => setDuration(finiteOrZero(e.currentTarget.duration))}
      />

      <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- capa enviada pelo usuário (R2)
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <Music2 className="size-6 text-neutral-400" aria-hidden />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{title || "Sem título"}</p>
        <p className="truncate text-xs text-neutral-400">
          {artist}
          {many && (
            <span className="ml-1.5 tabular-nums text-neutral-500">
              {artist ? "· " : ""}
              {index + 1}/{tracks.length}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={previous}
          aria-label={many ? "Música anterior" : "Voltar ao início"}
          className="flex size-8 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Tocar"}
          className="flex size-10 items-center justify-center rounded-full bg-white text-neutral-950 transition hover:scale-105 active:scale-95"
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 translate-x-px fill-current" />}
        </button>
        <button
          type="button"
          onClick={next}
          aria-label={many ? "Próxima música" : `Avançar ${SKIP_SECONDS} segundos`}
          className="flex size-8 items-center justify-center rounded-full text-neutral-300 transition hover:bg-white/10 hover:text-white"
        >
          <SkipForward className="size-4" />
        </button>
      </div>

      <div className="col-span-3 flex items-center gap-2">
        <span className="w-8 text-[10px] tabular-nums text-neutral-400">{formatTime(shown)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={shown}
          disabled={!duration}
          aria-label="Posição da música"
          aria-valuetext={`${formatTime(shown)} de ${formatTime(duration)}`}
          // Arrastando com o ponteiro: só mostra a posição (evita dezenas de seeks) e aplica ao soltar.
          // Teclado, tecnologia assistiva ou qualquer mudança sem ponteiro pressionado: aplica na hora.
          // O "soltar" é tratado pelo efeito acima (pointerup/pointercancel na janela).
          onPointerDown={() => {
            dragValue.current = current;
            setSeeking(current);
          }}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (dragValue.current === null) seekTo(value);
            else {
              dragValue.current = value;
              setSeeking(value);
            }
          }}
          className="scrubber min-w-0 flex-1"
          style={{ ["--progress" as string]: `${progress}%` }}
        />
        <span className="w-8 text-right text-[10px] tabular-nums text-neutral-400">{formatTime(duration)}</span>
      </div>
    </motion.section>
  );
}

