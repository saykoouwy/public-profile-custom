"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, ExternalLink, LogOut, Menu, SlidersHorizontal, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { NAV_LINKS } from "./nav-links";

type Props = { user: { username: string; avatarUrl: string } | null };

/**
 * Menu da navbar em telas menores que lg: o botão fica no lugar de "Login"/"Dashboard"
 * e abre um painel com os links das seções e as opções da conta.
 */
export function MobileMenu({ user }: Props) {
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

  const close = () => setOpen(false);

  // Rola até a seção por código. Fechar o menu deixa o painel "inert": se isso acontecer
  // durante a rolagem, o navegador tira o foco do link e cancela a animação. Por isso o menu
  // fecha primeiro e a rolagem começa dois quadros depois. scrollIntoView respeita o scroll-mt.
  const goToSection = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.getElementById(href.split("#")[1] ?? "");
    if (!target) return; // fora da página inicial: segue o link normalmente
    e.preventDefault();
    e.currentTarget.blur();
    close();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        history.pushState(null, "", `#${target.id}`);
      }),
    );
  };
  const itemClass =
    "flex items-center justify-between gap-2 rounded-xl px-4 py-3 text-[15px] text-neutral-200 transition hover:bg-white/10";

  return (
    <div ref={rootRef} className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-mobile"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-1 pr-3 pl-1 text-sm font-medium text-white transition hover:bg-white/10"
      >
        {user ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2
          <img src={user.avatarUrl} alt="" className="size-7 rounded-full object-cover" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-white/10">
            {/* Ícones sobrepostos que trocam com rotação suave */}
            <span className="relative size-4">
              <Menu
                className={`absolute inset-0 size-4 transition duration-300 ${open ? "rotate-90 scale-50 opacity-0" : ""}`}
                aria-hidden
              />
              <X
                className={`absolute inset-0 size-4 transition duration-300 ${open ? "" : "-rotate-90 scale-50 opacity-0"}`}
                aria-hidden
              />
            </span>
          </span>
        )}
        {user ? "Dashboard" : "Menu"}
      </button>

      {/* Fica sempre montado para animar a abertura e o fechamento; inert quando fechado.
          Fundo quase opaco: dentro da navbar (que já usa backdrop-filter) o blur não alcança a página. */}
      <div
        id="menu-mobile"
        inert={!open}
        className={`absolute inset-x-0 top-full mt-3 border border-white/10 bg-neutral-950/90 backdrop-blur-xl origin-top rounded-3xl p-2 shadow-2xl shadow-black/50 transition duration-300 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        }`}
      >
        <nav aria-label="Seções">
          {NAV_LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => goToSection(e, l.href)}
              style={{ transitionDelay: open ? `${60 + i * 40}ms` : "0ms" }}
              className={`${itemClass} duration-300 ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
            >
              {l.label}
              <ArrowRight className="size-4 text-neutral-500" aria-hidden />
            </a>
          ))}
        </nav>

        <div className="mx-3 my-2 h-px bg-white/10" />

        {user ? (
          <div>
            <p className="truncate px-4 pt-1 pb-2 text-xs text-neutral-500">@{user.username}</p>
            <Link href="/customize" onClick={close} className={itemClass}>
              <span className="flex items-center gap-2.5">
                <SlidersHorizontal className="size-4" aria-hidden />
                Personalizar
              </span>
            </Link>
            <Link href={`/${user.username}`} onClick={close} className={itemClass}>
              <span className="flex items-center gap-2.5">
                <ExternalLink className="size-4" aria-hidden />
                Ver meu perfil
              </span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={`${itemClass} w-full text-red-300 hover:bg-red-500/10`}>
                <span className="flex items-center gap-2.5">
                  <LogOut className="size-4" aria-hidden />
                  Sair
                </span>
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            onClick={close}
            className="m-1 flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
          >
            Login
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
