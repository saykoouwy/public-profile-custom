"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useDismiss } from "@/hooks/useDismiss";
import { AccountMenuItems } from "./AccountMenuItems";

type Props = { username: string; avatarUrl: string };

/** Botão "Dashboard" da navbar com menu suspenso (só aparece com sessão ativa). */
export function UserMenu({ username, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useDismiss(open, () => setOpen(false), [rootRef]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1.5 pr-4 pl-1.5 text-[1.1rem] font-medium text-white transition hover:bg-white/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2 */}
        <img src={avatarUrl} alt="" className="size-[2.125rem] rounded-full object-cover" />
        Dashboard
        <ChevronDown className={`size-[1.25rem] text-neutral-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="glass absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl p-1.5 text-sm shadow-xl shadow-black/40"
        >
          <p className="truncate px-3 py-2 text-xs text-neutral-500">@{username}</p>
          <AccountMenuItems
            menu
            username={username}
            items={["customize", "profile"]}
            itemClassName="flex items-center gap-2 rounded-xl px-3 py-2 text-neutral-200 transition hover:bg-white/10"
            logoutClassName="text-red-300 hover:bg-red-500/10"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
