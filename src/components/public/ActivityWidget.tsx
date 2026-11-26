"use client";

import { useEffect, useState } from "react";
import { Gamepad2, Gem, Music2, Sparkles } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";

// Subconjunto da resposta da Lanyard API (https://github.com/Phineas/lanyard) usado pelo widget.
type LanyardActivity = {
  type: number; // 0 = jogando, 2 = ouvindo, 4 = status customizado
  name: string;
  details?: string;
  state?: string;
  application_id?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string };
};

type LanyardData = {
  discord_user: { id: string; username: string; global_name?: string | null; avatar: string | null };
  discord_status: "online" | "idle" | "dnd" | "offline";
  listening_to_spotify: boolean;
  spotify: {
    song: string;
    artist: string;
    album: string;
    album_art_url: string | null;
    timestamps: { start: number; end: number };
  } | null;
  activities: LanyardActivity[];
};

type Props = {
  discordUserId: string | null;
  manualActivityType: string | null;
  manualStatusText: string | null;
  fallbackAvatarUrl: string | null;
  fallbackName: string;
};

const STATUS_COLOR: Record<LanyardData["discord_status"], string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  offline: "bg-neutral-500",
};

const POLL_MS = 30_000;

function activityImage(activity: LanyardActivity): string | null {
  const img = activity.assets?.large_image;
  if (!img) return null;
  if (img.startsWith("mp:external/")) return `https://media.discordapp.net/external/${img.slice("mp:external/".length)}`;
  if (img.startsWith("spotify:")) return `https://i.scdn.co/image/${img.slice("spotify:".length)}`;
  return activity.application_id ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${img}.png` : null;
}

function useLanyard(userId: string | null): LanyardData | null {
  const [data, setData] = useState<LanyardData | null>(null);

  useEffect(() => {
    if (!userId || !/^\d{17,20}$/.test(userId)) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: LanyardData };
        if (!cancelled) setData(json.success && json.data ? json.data : null);
      } catch {
        if (!cancelled) setData(null);
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId]);

  return userId ? data : null;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export default function ActivityWidget({
  discordUserId,
  manualActivityType,
  manualStatusText,
  fallbackAvatarUrl,
  fallbackName,
}: Props) {
  const lanyard = useLanyard(discordUserId);
  const spotify = lanyard?.listening_to_spotify ? lanyard.spotify : null;
  const game = lanyard?.activities.find((a) => a.type === 0) ?? null;
  const now = useNow(!!spotify || !!game?.timestamps?.start);
  // A atividade manual só vale quando o modo manual está ativo (tipo definido).
  const manualText = manualActivityType ? manualStatusText : null;

  // Nada para mostrar: sem Discord ativo e sem atividade manual.
  if (!spotify && !game && !manualText && !lanyard) return null;

  const user = lanyard?.discord_user;
  const avatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=96`
    : fallbackAvatarUrl;
  const name = user ? user.global_name || user.username : fallbackName;
  const status = lanyard?.discord_status ?? "online";

  let line: { verb: string; title: string; subtitle?: string; art: string | null; icon: "music" | "game" } | null = null;
  let progress: { elapsed: number; total: number } | null = null;

  if (spotify) {
    line = { verb: "listening to", title: spotify.song, subtitle: `by ${spotify.artist}`, art: spotify.album_art_url, icon: "music" };
    const total = (spotify.timestamps.end - spotify.timestamps.start) / 1000;
    progress = { elapsed: Math.min(Math.max((now - spotify.timestamps.start) / 1000, 0), total), total };
  } else if (game) {
    const since = game.timestamps?.start ? ` · ${formatTime((now - game.timestamps.start) / 1000)} elapsed` : "";
    line = { verb: "Playing", title: game.name, subtitle: [game.details, game.state].filter(Boolean).join(" — ") + since || undefined, art: activityImage(game), icon: "game" };
  } else if (manualText) {
    const playing = manualActivityType === "PLAYING";
    line = { verb: playing ? "Playing" : "listening to", title: manualText, art: null, icon: playing ? "game" : "music" };
  }

  return (
    <div className="glass-soft rounded-2xl p-3.5">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="size-11 overflow-hidden rounded-full bg-neutral-800">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element -- imagens externas (Discord CDN)
              <img src={avatar} alt="" className="size-full object-cover" />
            )}
          </div>
          <span
            className={cn("absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-[3px] border-neutral-900", STATUS_COLOR[status])}
            aria-label={`Status: ${status}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-white">{name}</span>
            <span className="flex items-center gap-1 text-amber-300/90" aria-hidden>
              <Sparkles className="size-3.5" />
              <Gem className="size-3.5 text-sky-300/90" />
            </span>
          </div>
          {line ? (
            <p className="truncate text-xs text-neutral-400">
              {line.verb} <span className="font-medium text-neutral-200">{line.title}</span>
            </p>
          ) : (
            <p className="text-xs text-neutral-500 capitalize">{status}</p>
          )}
          {line?.subtitle && <p className="truncate text-[11px] text-neutral-500">{line.subtitle}</p>}
        </div>

        {line && (
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
            {line.art ? (
              // eslint-disable-next-line @next/next/no-img-element -- capa externa (Spotify/Discord CDN)
              <img src={line.art} alt="" className="size-full object-cover" />
            ) : line.icon === "game" ? (
              <Gamepad2 className="size-5 text-neutral-300" aria-hidden />
            ) : (
              <Music2 className="size-5 text-neutral-300" aria-hidden />
            )}
          </div>
        )}
      </div>

      {progress && (
        <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-neutral-400">
          <span>{formatTime(progress.elapsed)}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-1000 ease-linear"
              style={{ width: `${(progress.elapsed / progress.total) * 100}%` }}
            />
          </div>
          <span>{formatTime(progress.total)}</span>
        </div>
      )}
    </div>
  );
}
