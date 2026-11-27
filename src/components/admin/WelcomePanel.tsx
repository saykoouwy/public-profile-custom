"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Copy, Eye, Link2, ListMusic } from "lucide-react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useSiteHost } from "@/hooks/useSiteHost";
import { formatNumber } from "@/lib/utils";
import { eyebrowClass, panelClass } from "./ui";

type Props = {
  username: string;
  displayName: string;
  avatarUrl: string;
  hasHalo: boolean;
  views: number;
  links: number;
  tracks: number;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Cartão de boas-vindas do painel: quem está logado, o link público e números rápidos. */
export function WelcomePanel({ username, displayName, avatarUrl, hasHalo, views, links, tracks }: Props) {
  const { copied, copy } = useCopyToClipboard();
  // Domínio real em que o site está (não um "mypfp.me" fixo).
  const host = useSiteHost();
  // Saudação só no cliente (fuso do visitante); no servidor fica o "Olá" neutro.
  const [hello] = useState(() => (typeof window === "undefined" ? "Olá" : greeting()));

  const stats = [
    { icon: <Eye className="size-4" aria-hidden />, value: formatNumber(views), label: "visualizações" },
    { icon: <Link2 className="size-4" aria-hidden />, value: links, label: links === 1 ? "rede" : "redes" },
    { icon: <ListMusic className="size-4" aria-hidden />, value: tracks, label: tracks === 1 ? "música" : "músicas" },
  ];

  return (
    <section id="inicio" className={`${panelClass} relative scroll-mt-20 overflow-hidden p-8 sm:p-12`}>
      {/* Brilho de cobre atrás do avatar */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-[#c0603a]/25 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:text-left">
        <div className="relative shrink-0">
          {hasHalo && (
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_180deg,#fcd34d,#c0603a,#fcd34d)] opacity-80 blur-[2px]"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2 */}
          <img
            src={avatarUrl}
            alt=""
            className="relative size-28 rounded-full border-4 border-neutral-950 object-cover sm:size-32"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={eyebrowClass} suppressHydrationWarning>
            {hello}
          </p>
          <h1 className="mt-2 truncate font-heading text-4xl font-semibold text-white sm:text-5xl">
            {displayName || username}
          </h1>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-neutral-300">
              {host}/<span className="text-white">{username}</span>
            </span>
            <button
              type="button"
              onClick={() => copy(`${window.location.origin}/${username}`)}
              aria-label="Copiar link do perfil"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-neutral-200 transition hover:bg-white/10"
            >
              {copied ? <Check className="size-3.5 text-emerald-300" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start">
            {stats.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-neutral-400"
              >
                <span className="text-amber-300">{s.icon}</span>
                <span className="font-heading text-base font-semibold text-white tabular-nums">{s.value}</span>
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href={`/${username}`}
          target="_blank"
          className="group flex shrink-0 items-center gap-3 rounded-full bg-white py-1.5 pr-1.5 pl-6 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
        >
          Ver meu perfil
          <span className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white transition group-hover:translate-x-0.5">
            <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      </div>
    </section>
  );
}
