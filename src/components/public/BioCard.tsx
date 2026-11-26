"use client";

import { useEffect, useState, type ReactNode, type SVGProps } from "react";
import { motion } from "framer-motion";
import { Eye, Link2, MapPin } from "lucide-react";
import ActivityWidget from "@/components/public/ActivityWidget";
import { formatCount } from "@/lib/utils";
import type { PublicProfile } from "@/types";

// ---------------------------------------------------------------------------
// Ícones de plataformas (SVG inline, sem dependências externas)
// ---------------------------------------------------------------------------

const Svg = ({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" aria-hidden width="1em" height="1em" {...props}>
    {children}
  </svg>
);

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<string, ReactNode> = {
  x: (
    <Svg fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </Svg>
  ),
  github: (
    <Svg fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </Svg>
  ),
  spotify: (
    <Svg>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <g {...stroke} stroke="#0a0a0a" strokeWidth={1.8}>
        <path d="M6.5 9.2c3.8-1.2 8-.9 11.2.9" />
        <path d="M7.2 12.5c3.1-.9 6.5-.6 9.2.8" />
        <path d="M7.9 15.6c2.4-.6 4.9-.4 6.9.6" />
      </g>
    </Svg>
  ),
  steam: (
    <Svg>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="15.5" cy="9" r="3" fill="none" stroke="#0a0a0a" strokeWidth={1.6} />
      <circle cx="8.5" cy="15.5" r="2.2" fill="#0a0a0a" />
      <path d="M8.5 15.5 13.2 11" stroke="#0a0a0a" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  ),
  lastfm: (
    <Svg>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="10.5" fontWeight="800" fontFamily="Arial, sans-serif" fill="#0a0a0a">
        fm
      </text>
    </Svg>
  ),
  discord: (
    <Svg fill="currentColor">
      <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.6 15.6 0 0 0-5.8 0l-.5-1a17 17 0 0 0-4.2 1.3C1.7 9.4 1 13.4 1.3 17.3a17 17 0 0 0 5.2 2.7l1.1-1.8c-.6-.2-1.2-.5-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.7c.4-4.5-.7-8.4-2.9-12ZM8.6 14.9c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm6.8 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z" />
    </Svg>
  ),
  instagram: (
    <Svg {...stroke}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </Svg>
  ),
  youtube: (
    <Svg>
      <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="currentColor" />
      <path d="M10 8.8v6.4l5.4-3.2z" fill="#0a0a0a" />
    </Svg>
  ),
  twitch: (
    <Svg fill="currentColor">
      <path d="M4 2 2.5 5.5V20h5v2.5h2.8L12.8 20h4L21.5 15V2Zm15.5 12-2.9 2.9h-4.5l-2.6 2.6v-2.6H5.5V4h14Z" />
      <path d="M15.2 7.2h1.9v5.2h-1.9zm-5 0h1.9v5.2h-1.9z" />
    </Svg>
  ),
  tiktok: (
    <Svg fill="currentColor">
      <path d="M16.6 2h-3.3v13.4a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.2a6.2 6.2 0 1 0 5.3 6.2V8.6a7.6 7.6 0 0 0 4.4 1.4V6.7A4.4 4.4 0 0 1 16.6 2Z" />
    </Svg>
  ),
};

export function SocialIcon({ name, className }: { name: string; className?: string }) {
  return <span className={className}>{ICONS[name] ?? <Link2 className="size-[1em]" aria-hidden />}</span>;
}

export const PLATFORM_LABELS: Record<string, string> = {
  x: "X",
  steam: "Steam",
  spotify: "Spotify",
  lastfm: "Last.fm",
  discord: "Discord",
  instagram: "Instagram",
  github: "GitHub",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitch: "Twitch",
  custom: "Link",
};

// ---------------------------------------------------------------------------
// Cartão central
// ---------------------------------------------------------------------------

export default function BioCard({ profile }: { profile: PublicProfile }) {
  const [views, setViews] = useState(profile.viewsCount);

  // Registra a visita (no máx. 1x/24h por navegador, controlado no servidor) e recebe o total atualizado.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/views", { method: "POST", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { views?: number } | null) => {
        if (typeof data?.views === "number") setViews(data.views);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-[92%] max-w-[480px] rounded-3xl border border-white/10 bg-neutral-900/65 p-6 pt-14 shadow-2xl backdrop-blur-md"
    >
      {/* Avatar com auréola */}
      <div className="absolute -top-14 left-1/2 -translate-x-1/2">
        <div className="relative">
          {profile.hasHaloEffect && (
            <motion.svg
              viewBox="0 0 100 30"
              aria-hidden
              className="absolute -top-5 left-1/2 w-20 -translate-x-1/2"
              style={{ filter: "drop-shadow(0 0 12px rgba(255, 215, 0, 0.7))" }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ellipse cx="50" cy="15" rx="40" ry="9" fill="none" stroke="#ffd700" strokeWidth="4.5" />
              <ellipse cx="50" cy="15" rx="40" ry="9" fill="none" stroke="#fff6c2" strokeWidth="1.2" opacity="0.9" />
            </motion.svg>
          )}
          <div
            className="size-24 overflow-hidden rounded-full border-2 border-white/15 bg-neutral-800 shadow-xl"
            style={profile.hasHaloEffect ? { boxShadow: "0 0 28px rgba(255, 215, 0, 0.25)" } : undefined}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2
              <img src={profile.avatarUrl} alt={profile.displayName} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-4xl text-white/80">
                {profile.displayName.slice(0, 1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Identidade */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="font-display text-5xl leading-tight text-white text-glow break-words">
          {profile.displayName}
        </h1>
        {profile.bio && <p className="max-w-sm text-sm leading-relaxed text-neutral-300 break-words">{profile.bio}</p>}
        {profile.location && (
          <p className="flex items-center gap-1 text-xs text-neutral-400">
            <MapPin className="size-3.5" aria-hidden />
            {profile.location}
          </p>
        )}
      </div>

      {/* Atividade */}
      <div className="mt-5">
        <ActivityWidget
          discordUserId={profile.showDiscordStatus ? profile.discordUserId : null}
          manualActivityType={profile.manualActivityType}
          manualStatusText={profile.manualStatusText}
          fallbackAvatarUrl={profile.avatarUrl}
          fallbackName={profile.displayName}
        />
      </div>

      {/* Redes sociais */}
      {profile.socialLinks.length > 0 && (
        <nav aria-label="Redes sociais" className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {profile.socialLinks.map((link) => {
            const label = link.label || PLATFORM_LABELS[link.platform] || "Link";
            return (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={label}
                title={label}
                className="flex size-11 items-center justify-center rounded-xl text-2xl text-white/85 transition duration-200 hover:scale-110 hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.55)] focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-white/60"
              >
                <SocialIcon name={link.iconName} />
              </a>
            );
          })}
        </nav>
      )}

      {/* Rodapé */}
      <div className="mt-5 flex items-center text-xs text-neutral-400">
        <span className="flex items-center gap-1.5" title={`${views} visualizações`}>
          <Eye className="size-3.5" aria-hidden />
          <span aria-label={`${views} visualizações`}>{formatCount(views)}</span>
        </span>
      </div>
    </motion.section>
  );
}
