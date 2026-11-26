"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, LogOut, SlidersHorizontal } from "lucide-react";
import { logoutAction } from "@/actions/auth";

type Props = { username: string; avatarUrl: string };

/** Botão "Dashboard" da navbar com menu suspenso (só aparece com sessão ativa). */
export function UserMenu({ username, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1 pr-3 pl-1 text-sm font-medium text-white transition hover:bg-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2 */}
        <img src={avatarUrl} alt="" className="size-7 rounded-full object-cover" />
        Dashboard
        <ChevronDown className={`size-4 text-neutral-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="glass absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl p-1.5 text-sm shadow-xl shadow-black/40"
        >
          <p className="truncate px-3 py-2 text-xs text-neutral-500">@{username}</p>
          <Link
            role="menuitem"
            href="/customize"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Personalizar
          </Link>
          <Link
            role="menuitem"
            href={`/${username}`}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-neutral-200 transition hover:bg-white/10"
          >
            <ExternalLink className="size-4" aria-hidden />
            Ver meu perfil
          </Link>
          <form action={logoutAction}>
            <button
              role="menuitem"
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-300 transition hover:bg-red-500/10"
            >
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
