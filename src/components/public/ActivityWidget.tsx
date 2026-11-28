"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Gamepad2, Music2, Radio, Trophy, Tv } from "lucide-react";
import { DISCORD_ID_RE, clamp, formatElapsed, formatTime } from "@/lib/utils";
import { presenceSurfaceStyle, type PresenceSurface } from "@/lib/card-surface";

// Subconjunto da resposta da Lanyard API (https://github.com/Phineas/lanyard) usado pelo widget.
type LanyardActivity = {
  type: number; // 0 jogando, 1 transmitindo, 2 ouvindo, 3 assistindo, 4 status customizado, 5 competindo
  name: string;
  details?: string;
  state?: string;
  application_id?: string;
  timestamps?: { start?: number; end?: number };
  assets?: { large_image?: string; large_text?: string };
  emoji?: { name?: string; id?: string; animated?: boolean };
};

type DiscordStatus = "online" | "idle" | "dnd" | "offline";

type LanyardData = {
  discord_user: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
    public_flags?: number;
    avatar_decoration_data?: { asset: string } | null;
    primary_guild?: {
      identity_guild_id: string | null;
      identity_enabled: boolean | null;
      tag: string | null;
      badge: string | null;
    } | null;
  };
  discord_status: DiscordStatus;
  listening_to_spotify: boolean;
  spotify: {
    track_id?: string | null;
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
  /** ISO da última vez visto online, vindo do banco (atualizado por /api/presence e pelo cron). */
  lastOnlineAt?: string | null;
  username?: string;
  manualActivityType: string | null;
  manualStatusText: string | null;
  fallbackAvatarUrl: string | null;
  fallbackName: string;
  /** Aparência da caixa (fundo, desfoque e cor do texto), escolhida pelo dono. */
  surface: PresenceSurface;
};

const STATUS_LABEL: Record<DiscordStatus, string> = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  offline: "Offline",
};

// Cores oficiais do Discord para cada status.
const STATUS_COLOR: Record<DiscordStatus, string> = {
  online: "#23a55a",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#80848e",
};

const ACTIVITY_VERB: Record<number, string> = {
  0: "Jogando",
  1: "Transmitindo",
  2: "Ouvindo",
  3: "Assistindo",
  5: "Competindo em",
};

/**
 * Badges públicas do Discord, lidas dos bits de `public_flags`. Nitro e boost não aparecem aqui:
 * o Discord só expõe essas duas na rota de perfil, que exige token de usuário.
 */
const BADGES: { bit: number; label: string; icon: string }[] = [
  { bit: 0, label: "Discord Staff", icon: "5e74e9b61934fc1f67c65515d1f7e60d" },
  { bit: 1, label: "Dono de servidor parceiro", icon: "3f9748e53446a137a052f3454e2de41e" },
  { bit: 2, label: "Eventos HypeSquad", icon: "bf01d1073931f921909045f3a39fd264" },
  { bit: 3, label: "Discord Bug Hunter", icon: "2717692c7dca7289b35297368a940dd0" },
  { bit: 14, label: "Discord Bug Hunter (ouro)", icon: "848f79194d4be5ff5f81505cbd0ce1e6" },
  { bit: 6, label: "HypeSquad Bravery", icon: "8a88d63823d8a71cd5e390baa45efa02" },
  { bit: 7, label: "HypeSquad Brilliance", icon: "011940fd013da3f7fb926e4a1cd2e618" },
  { bit: 8, label: "HypeSquad Balance", icon: "3aa41de486fa12454c3761e8e223442e" },
  { bit: 9, label: "Apoiador inicial", icon: "7060786766c9c840eb3019e725d2b358" },
  { bit: 17, label: "Desenvolvedor de bot verificado pioneiro", icon: "6df5892e0f35b051f8b61eace34f4967" },
  { bit: 18, label: "Ex-moderador certificado", icon: "fee1624003e2fee35cb398e125dc479b" },
  { bit: 22, label: "Desenvolvedor ativo", icon: "6bdc42827a38498929a4920da12695d9" },
];

const LANYARD_SOCKET = "wss://api.lanyard.rest/socket";
const RECONNECT_MS = 5_000;
const FALLBACK_POLL_MS = 30_000;
/** Enquanto o dono está online e alguém vê o perfil, o "visto por último" é renovado nesse intervalo. */
const PRESENCE_SYNC_MS = 60_000;

function activityImage(activity: LanyardActivity): string | null {
  const img = activity.assets?.large_image;
  if (!img) return null;
  if (img.startsWith("mp:external/")) return `https://media.discordapp.net/external/${img.slice("mp:external/".length)}`;
  if (img.startsWith("spotify:")) return `https://i.scdn.co/image/${img.slice("spotify:".length)}`;
  return activity.application_id ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${img}.png` : null;
}

function badgesOf(flags: number | undefined) {
  if (!flags) return [];
  return BADGES.filter((b) => (flags & (1 << b.bit)) !== 0);
}

/**
 * Ícone de status no formato do Discord: bolinha (online), lua (ausente), círculo com traço (não perturbe)
 * e anel (offline). Com `ring`, ganha a borda escura que o "recorta" do avatar.
 */
function StatusIcon({ status, ring = false, className }: { status: DiscordStatus; ring?: boolean; className?: string }) {
  const maskId = useId();
  const color = STATUS_COLOR[status];
  return (
    <svg viewBox="0 0 16 16" className={className} role="img" aria-label={STATUS_LABEL[status]}>
      {ring && <circle cx="8" cy="8" r="8" fill="#171717" />}
      <mask id={maskId}>
        <circle cx="8" cy="8" r="5" fill="white" />
        {status === "idle" && <circle cx="5.5" cy="5.5" r="3.75" fill="black" />}
        {status === "dnd" && <rect x="4.25" y="6.75" width="7.5" height="2.5" rx="1.25" fill="black" />}
        {status === "offline" && <circle cx="8" cy="8" r="2.5" fill="black" />}
      </mask>
      <circle cx="8" cy="8" r="5" fill={color} mask={`url(#${maskId})`} />
    </svg>
  );
}

/**
 * Presença via WebSocket da Lanyard: o Discord empurra cada mudança (troca de música, pausa, jogo)
 * na hora, em vez de esperar o próximo polling. Se o socket cair, reconecta; enquanto estiver fora,
 * a API REST cobre a lacuna.
 */
function useLanyard(userId: string | null): LanyardData | null {
  const [data, setData] = useState<LanyardData | null>(null);

  useEffect(() => {
    if (!userId || !DISCORD_ID_RE.test(userId)) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;

    const fetchRest = async () => {
      try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: LanyardData };
        if (!cancelled) setData(json.success && json.data ? json.data : null);
      } catch {
        // Mantém o último estado conhecido; o socket ou o próximo polling corrigem.
      }
    };

    const startPolling = () => {
      if (!poll) poll = setInterval(fetchRest, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    const connect = () => {
      if (cancelled) return;
      socket = new WebSocket(LANYARD_SOCKET);

      socket.onmessage = (event) => {
        let msg: { op: number; t?: string; d?: unknown };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (msg.op === 1) {
          const interval = (msg.d as { heartbeat_interval?: number })?.heartbeat_interval ?? 30_000;
          socket?.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
          clearInterval(heartbeat);
          heartbeat = setInterval(() => socket?.send(JSON.stringify({ op: 3 })), interval);
        } else if (msg.op === 0 && (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") && msg.d) {
          stopPolling();
          if (!cancelled) setData(msg.d as LanyardData);
        }
      };

      socket.onclose = () => {
        clearInterval(heartbeat);
        if (cancelled) return;
        startPolling();
        reconnect = setTimeout(connect, RECONNECT_MS);
      };
    };

    void fetchRest();
    connect();

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearTimeout(reconnect);
      stopPolling();
      socket?.close();
    };
  }, [userId]);

  return userId ? data : null;
}

/**
 * "Visto por último": parte do valor do banco e, enquanto alguém vê o perfil, pede ao servidor que confira
 * a Lanyard (o servidor é quem grava, então o visitante não consegue forjar). Quando o status vira offline
 * diante do visitante, o horário local da virada é usado se for mais recente que o do banco.
 */
function useLastOnline(username: string | undefined, status: DiscordStatus | undefined, initial: string | null) {
  const [lastOnline, setLastOnline] = useState<number | null>(() => (initial ? Date.parse(initial) : null));
  const previous = useRef<DiscordStatus | undefined>(undefined);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (!status) return;
    if (status === "offline" && was && was !== "offline") {
      setLastOnline((v) => Math.max(v ?? 0, Date.now()));
    }
  }, [status]);

  useEffect(() => {
    if (!username || !status) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
        if (!res.ok) return;
        const { lastOnlineAt } = (await res.json()) as { lastOnlineAt: string | null };
        if (!cancelled && lastOnlineAt) setLastOnline((v) => Math.max(v ?? 0, Date.parse(lastOnlineAt)));
      } catch {
        // Sem rede: fica com o último valor conhecido.
      }
    };
    void sync();
    if (status === "offline") return () => void (cancelled = true);
    const timer = setInterval(sync, PRESENCE_SYNC_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [username, status]);

  return lastOnline;
}

function useNow(active: boolean, intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

type Line = {
  verb: string;
  title: string;
  subtitle?: string;
  art: string | null;
  artAlt?: string;
  icon: "music" | "game" | "stream" | "watch" | "compete";
};

const FALLBACK_ICON = { music: Music2, game: Gamepad2, stream: Radio, watch: Tv, compete: Trophy };
const ICON_BY_TYPE: Record<number, Line["icon"]> = { 0: "game", 1: "stream", 2: "music", 3: "watch", 5: "compete" };

export default function ActivityWidget({
  discordUserId,
  lastOnlineAt = null,
  username,
  manualActivityType,
  manualStatusText,
  fallbackAvatarUrl,
  fallbackName,
  surface,
}: Props) {
  const lanyard = useLanyard(discordUserId);
  const spotify = lanyard?.listening_to_spotify ? lanyard.spotify : null;
  // Primeira atividade "de verdade": ignora o status customizado e o próprio Spotify (já tratado acima).
  const activity = lanyard?.activities.find((a) => a.type !== 4 && !(a.type === 2 && a.name === "Spotify")) ?? null;
  const custom = lanyard?.activities.find((a) => a.type === 4) ?? null;
  const lastOnline = useLastOnline(discordUserId ? username : undefined, lanyard?.discord_status, lastOnlineAt);
  const ticking = !!spotify || !!activity?.timestamps?.start;
  // 1 s com mídia tocando (o contador mostra segundos inteiros e a barra anima por CSS);
  // 30 s basta para o "Offline há X".
  const now = useNow(ticking || lanyard?.discord_status === "offline", ticking ? 1000 : 30_000);
  // A atividade manual só vale quando o modo manual está ativo (tipo definido).
  const manualText = manualActivityType ? manualStatusText : null;

  // Nada para mostrar: sem Discord ativo e sem atividade manual.
  if (!spotify && !activity && !manualText && !lanyard) return null;

  const user = lanyard?.discord_user;
  const avatar = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith("a_") ? "gif" : "png"}?size=128`
    : fallbackAvatarUrl;
  const decoration = user?.avatar_decoration_data?.asset
    ? `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=128&passthrough=true`
    : null;
  const name = user ? user.global_name || user.username : fallbackName;
  const status: DiscordStatus = lanyard?.discord_status ?? "online";
  const badges = badgesOf(user?.public_flags);
  const guild = user?.primary_guild;
  const tag = guild?.tag && guild.identity_enabled !== false ? guild : null;

  let customText: string | null = null;
  let customEmoji: string | null = null;
  if (custom) {
    customText = custom.state ?? null;
    if (custom.emoji?.id) {
      customEmoji = `https://cdn.discordapp.com/emojis/${custom.emoji.id}.${custom.emoji.animated ? "gif" : "png"}?size=32`;
    } else if (custom.emoji?.name) {
      customText = [custom.emoji.name, customText].filter(Boolean).join(" ");
    }
  }

  let line: Line | null = null;
  let progress: { key: string; elapsed: number; total: number } | null = null;

  if (spotify) {
    line = {
      verb: "Ouvindo",
      title: spotify.song,
      subtitle: `de ${spotify.artist}`,
      art: spotify.album_art_url,
      artAlt: spotify.album,
      icon: "music",
    };
    // Podcasts/transições podem vir com end <= start: sem duração válida, sem barra (evita NaN%).
    const total = (spotify.timestamps.end - spotify.timestamps.start) / 1000;
    if (Number.isFinite(total) && total > 0) {
      progress = {
        key: `${spotify.track_id ?? spotify.song}-${spotify.timestamps.start}`,
        elapsed: clamp((now - spotify.timestamps.start) / 1000, 0, total),
        total,
      };
    }
  } else if (activity) {
    const details = [activity.details, activity.state].filter(Boolean).join(" — ");
    const { start, end } = activity.timestamps ?? {};
    let since = "";
    if (start && end && end > start) {
      const total = (end - start) / 1000;
      progress = { key: `${activity.name}-${start}`, elapsed: clamp((now - start) / 1000, 0, total), total };
    } else if (start) {
      since = `há ${formatTime((now - start) / 1000)}`;
    }
    line = {
      verb: ACTIVITY_VERB[activity.type] ?? "Jogando",
      title: activity.name,
      subtitle: [details, since].filter(Boolean).join(" · ") || undefined,
      art: activityImage(activity),
      artAlt: activity.assets?.large_text,
      icon: ICON_BY_TYPE[activity.type] ?? "game",
    };
  } else if (manualText) {
    const playing = manualActivityType === "PLAYING";
    line = { verb: playing ? "Jogando" : "Ouvindo", title: manualText, art: null, icon: playing ? "game" : "music" };
  }

  const statusText =
    status === "offline" && lastOnline ? `Offline há ${formatElapsed(now - lastOnline)}` : STATUS_LABEL[status];
  const FallbackIcon = line ? FALLBACK_ICON[line.icon] : Music2;

  return (
    // @container: as medidas abaixo (cqi) acompanham a largura disponível no card do perfil, não a da tela.
    // Com espaço (≥ 480px), o widget ocupa 80% dessa largura, centralizado, mantendo os mesmos tamanhos;
    // em telas estreitas ele usa a largura toda para o nome não voltar a ser cortado.
    <div className="@container">
    <div
      className="mx-auto w-full rounded-[20px] p-[clamp(13px,3.26cqi,20px)] @min-[480px]:w-[80%]"
      style={presenceSurfaceStyle(surface)}
    >
      <div className="flex items-center gap-[clamp(10px,2.94cqi,18px)]">
        <div className="relative size-[clamp(50px,12.65cqi,77.5px)] shrink-0">
          <div className="size-full overflow-hidden rounded-full bg-neutral-800">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element -- imagens externas (Discord CDN)
              <img src={avatar} alt="" className="size-full object-cover" />
            )}
          </div>
          {decoration && (
            // A decoração do Discord é desenhada 20% maior que o avatar, centralizada por cima dele.
            // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Discord CDN)
            <img
              src={decoration}
              alt=""
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-1/2 size-[120%] max-w-none -translate-x-1/2 -translate-y-1/2"
            />
          )}
          {/* Só com Discord conectado: no modo manual não existe status real para mostrar. */}
          {lanyard && (
            <StatusIcon status={status} ring className="absolute -right-[3px] -bottom-[3px] z-10 size-[clamp(16px,3.6cqi,22px)]" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[clamp(5px,1.22cqi,7.5px)]">
            <span className="truncate text-[clamp(16px,3.25cqi,19.9px)] leading-[1.33] font-semibold text-(--presence-text-1)">{name}</span>
            {tag && (
              <span
                className="flex shrink-0 items-center gap-[5px] rounded-[7.5px] bg-white/10 px-[clamp(5px,1.22cqi,7.5px)] py-px text-[clamp(12px,2.37cqi,14.5px)] leading-[1.5] font-semibold text-neutral-200"
                title="Tag de servidor"
              >
                {tag.badge && tag.identity_guild_id && (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem externa (Discord CDN)
                  <img
                    src={`https://cdn.discordapp.com/guild-tag-badges/${tag.identity_guild_id}/${tag.badge}.png?size=32`}
                    alt=""
                    className="size-[clamp(14px,3.1cqi,19px)]"
                  />
                )}
                {tag.tag}
              </span>
            )}
            {badges.length > 0 && (
              <span className="flex shrink-0 items-center gap-[2.5px]">
                {badges.map((b) => (
                  // eslint-disable-next-line @next/next/no-img-element -- ícones oficiais (Discord CDN)
                  <img
                    key={b.bit}
                    src={`https://cdn.discordapp.com/badge-icons/${b.icon}.png`}
                    alt={b.label}
                    title={b.label}
                    className="size-[clamp(17px,3.6cqi,22px)]"
                  />
                ))}
              </span>
            )}
          </div>
          {line ? (
            <p className="truncate text-[clamp(13.5px,2.68cqi,16.4px)] text-(--presence-text-3)">
              {line.verb} <span className="font-medium text-(--presence-text-2)">{line.title}</span>
            </p>
          ) : customText || customEmoji ? (
            <p className="flex min-w-0 items-center gap-[5px] text-[clamp(13.5px,2.68cqi,16.4px)] text-(--presence-text-3)">
              {customEmoji && (
                // eslint-disable-next-line @next/next/no-img-element -- emoji customizado (Discord CDN)
                <img src={customEmoji} alt="" className="size-[clamp(17px,3.6cqi,22px)] shrink-0" />
              )}
              <span className="truncate">{customText}</span>
            </p>
          ) : (
            <p className="flex min-w-0 items-center gap-[5px] text-[clamp(13.5px,2.68cqi,16.4px)] text-(--presence-text-3)">
              <StatusIcon status={status} className="size-[clamp(16px,3.26cqi,20px)] shrink-0" />
              <span className="truncate">{statusText}</span>
            </p>
          )}
          {line?.subtitle ? (
            <p className="truncate text-[clamp(12.5px,2.48cqi,15.2px)] text-(--presence-text-4)">{line.subtitle}</p>
          ) : (
            // Com status customizado e sem atividade, o status (ex.: "Offline há 3 h") vai na segunda linha.
            !line &&
            (customText || customEmoji) && (
              <p className="flex min-w-0 items-center gap-[5px] text-[clamp(12.5px,2.48cqi,15.2px)] text-(--presence-text-4)">
                <StatusIcon status={status} className="size-[clamp(15px,3.1cqi,19px)] shrink-0" />
                <span className="truncate">{statusText}</span>
              </p>
            )
          )}
        </div>

        {line && (
          <div
            className="flex size-[clamp(54px,13.6cqi,83.5px)] shrink-0 items-center justify-center overflow-hidden rounded-[clamp(10px,2.37cqi,14.5px)] bg-white/5"
            title={line.artAlt}
          >
            {line.art ? (
              // eslint-disable-next-line @next/next/no-img-element -- capa externa (Spotify/Discord CDN)
              <img src={line.art} alt={line.artAlt ?? ""} className="size-full object-cover" />
            ) : (
              <FallbackIcon className="size-[clamp(20px,4.3cqi,26.5px)] text-neutral-300" aria-hidden />
            )}
          </div>
        )}
      </div>

      {progress && (
        <div className="mt-[clamp(12px,2.7cqi,16.5px)] flex items-center gap-[clamp(8px,1.7cqi,10.5px)] text-[clamp(12px,2.27cqi,13.9px)] tabular-nums text-(--presence-text-3)">
          <span>{formatTime(progress.elapsed)}</span>
          <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-white/10">
            {/* `key` por faixa: ao trocar de música a barra recomeça do zero em vez de "voltar" animando. */}
            <div
              key={progress.key}
              className="h-full rounded-full bg-emerald-400 transition-[width] duration-300 ease-linear"
              style={{ width: `${clamp((progress.elapsed / progress.total) * 100, 0, 100)}%` }}
            />
          </div>
          <span>{formatTime(progress.total)}</span>
        </div>
      )}
    </div>
    </div>
  );
}
