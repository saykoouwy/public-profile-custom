"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Home, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";

type Props = { username: string; avatarUrl: string };

/** Cápsula do usuário isolada no canto superior direito do painel: avatar, @ e menu da conta. */
export function AdminUserMenu({ username, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm text-neutral-200 transition hover:bg-white/10";

  return (
    <div ref={rootRef} className="fixed top-4 right-4 z-50">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 py-1 pr-3 pl-1 text-sm font-medium text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:bg-neutral-900/80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2 */}
        <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
        <span className="max-w-32 truncate">@{username}</span>
        <ChevronDown className={`size-4 text-neutral-400 transition duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      <div
        role="menu"
        inert={!open}
        className={`absolute right-0 mt-2 w-56 origin-top-right rounded-3xl border border-white/10 bg-neutral-950/95 p-2 shadow-2xl shadow-black/50 transition duration-200 ease-out ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <Link role="menuitem" href={`/${username}`} target="_blank" className={item}>
          <ExternalLink className="size-4" aria-hidden />
          Ver meu perfil
        </Link>
        <Link role="menuitem" href="/" className={item}>
          <Home className="size-4" aria-hidden />
          Página inicial
        </Link>
        <form action={logoutAction}>
          <button role="menuitem" type="submit" className={`${item} text-red-300 hover:bg-red-500/10`}>
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
