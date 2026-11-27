"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, MapPin } from "lucide-react";
import ActivityWidget from "@/components/public/ActivityWidget";
import { PLATFORM_LABELS, SocialIcon } from "@/components/icons/SocialIcons";
import { formatCount } from "@/lib/utils";
import type { PublicProfile } from "@/types";

// ---------------------------------------------------------------------------
// Cartão central
// ---------------------------------------------------------------------------

export default function BioCard({ profile }: { profile: PublicProfile }) {
  const [views, setViews] = useState(profile.viewsCount);

  // Registra a visita (no máx. 1x/24h por navegador, controlado no servidor) e recebe o total atualizado.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: profile.username }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { views?: number } | null) => {
        if (typeof data?.views === "number") setViews(data.views);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [profile.username]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-[calc(100%-16px)] max-w-[668px] rounded-[27.5px] border border-white/10 bg-neutral-900/65 p-[27.5px] pt-[64.5px] shadow-2xl backdrop-blur-md"
    >
      {/* Avatar com auréola */}
      <div className="absolute -top-[64.5px] left-1/2 -translate-x-1/2">
        <div className="relative">
          {profile.hasHaloEffect && (
            <motion.svg
              viewBox="0 0 100 30"
              aria-hidden
              className="absolute -top-[23px] left-1/2 w-[92px] -translate-x-1/2"
              style={{ filter: "drop-shadow(0 0 12px rgba(255, 215, 0, 0.7))" }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ellipse cx="50" cy="15" rx="40" ry="9" fill="none" stroke="#ffd700" strokeWidth="4.5" />
              <ellipse cx="50" cy="15" rx="40" ry="9" fill="none" stroke="#fff6c2" strokeWidth="1.2" opacity="0.9" />
            </motion.svg>
          )}
          <div
            className="size-[110px] overflow-hidden rounded-full border-2 border-white/15 bg-neutral-800 shadow-xl"
            style={profile.hasHaloEffect ? { boxShadow: "0 0 28px rgba(255, 215, 0, 0.25)" } : undefined}
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2
              <img src={profile.avatarUrl} alt={profile.displayName} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-[41.5px] text-white/80">
                {profile.displayName.slice(0, 1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Identidade */}
      <div className="flex flex-col items-center gap-[7px] text-center">
        <h1 className="w-full min-w-0 font-display text-[55px] leading-tight text-white text-glow break-words [overflow-wrap:anywhere]">
          {profile.displayName}
        </h1>
        {profile.bio && (
          <p className="w-full min-w-0 max-w-[442px] text-[16px] leading-relaxed text-neutral-300 break-words [overflow-wrap:anywhere]">
            {profile.bio}
          </p>
        )}
        {profile.location && (
          <p className="flex items-center gap-[4.5px] text-[14px] text-neutral-400">
            <MapPin className="size-4" aria-hidden />
            {profile.location}
          </p>
        )}
      </div>

      {/* Atividade */}
      <div className="mt-[23px]">
        <ActivityWidget
          discordUserId={profile.showDiscordStatus ? profile.discordUserId : null}
          lastOnlineAt={profile.discordLastOnlineAt}
          username={profile.username}
          manualActivityType={profile.manualActivityType}
          manualStatusText={profile.manualStatusText}
          fallbackAvatarUrl={profile.avatarUrl}
          fallbackName={profile.displayName}
        />
      </div>

      {/* Redes sociais */}
      {profile.socialLinks.length > 0 && (
        <nav aria-label="Redes sociais" className="mt-[23px] flex flex-wrap items-center justify-center gap-[11.5px]">
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
                className="flex size-[50.5px] items-center justify-center rounded-[14px] text-[27.5px] text-white/85 transition duration-200 hover:scale-110 hover:text-white hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.55)] focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-white/60"
              >
                <SocialIcon name={link.iconName} />
              </a>
            );
          })}
        </nav>
      )}

      {/* Rodapé */}
      <div className="mt-[23px] flex items-center text-[14px] text-neutral-400">
        <span className="flex items-center gap-[7px]" title={`${views} visualizações`}>
          <Eye className="size-4" aria-hidden />
          <span aria-label={`${views} visualizações`}>{formatCount(views)}</span>
        </span>
      </div>
    </motion.section>
  );
}
