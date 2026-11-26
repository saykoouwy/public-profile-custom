"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ArrowRight, ChevronDown, ExternalLink, LogOut, Menu, SlidersHorizontal, X } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { NAV_LINKS } from "./nav-links";

type Props = { user: { username: string; avatarUrl: string } | null };

/**
 * Menu da navbar em telas menores que lg. O botão fica no lugar de "Login"/"Dashboard" e,
 * ao abrir, a própria navbar cresce para baixo com as seções e as opções da conta
 * (um bloco só, sem pop-up separado). Retorna dois filhos diretos do <nav>: o botão e o painel,
 * que ocupa a linha inteira (basis-full) graças ao flex-wrap da navbar.
 */
export function MobileMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
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
    "flex items-center justify-between gap-2 rounded-2xl px-3 py-3 text-[15px] text-neutral-200 transition hover:bg-white/10";
  // Entrada em cascata dos itens quando o menu abre.
  const stagger = (i: number) => ({
    style: { transitionDelay: open ? `${80 + i * 40}ms` : "0ms" },
    className: `transition duration-300 ${open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`,
  });

  return (
    <>
      <div ref={buttonRef} className="lg:hidden">
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
          {user && (
            <ChevronDown
              className={`size-4 text-neutral-400 transition duration-300 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          )}
        </button>
      </div>

      {/* Painel dentro da navbar: a altura anima de 0fr para 1fr. Fica sempre montado
          para animar abrir e fechar; inert quando fechado. */}
      <div
        id="menu-mobile"
        ref={panelRef}
        inert={!open}
        className={`grid basis-full transition-[grid-template-rows,opacity] duration-300 ease-out lg:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="-ml-3 min-h-0 overflow-hidden">
          <div className="mt-2 border-t border-white/10 pt-2 pb-1">
            <nav aria-label="Seções">
              {NAV_LINKS.map((l, i) => {
                const s = stagger(i);
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => goToSection(e, l.href)}
                    style={s.style}
                    className={`${itemClass} ${s.className}`}
                  >
                    {l.label}
                    <ArrowRight className="size-4 text-neutral-500" aria-hidden />
                  </a>
                );
              })}
            </nav>

            <div className="mx-3 my-2 h-px bg-white/10" />

            {user ? (
              <div {...stagger(NAV_LINKS.length)}>
                {/* Quem está logado: foto e @ do usuário */}
                <div className="mb-1 flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL arbitrária do R2 */}
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="size-11 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">@{user.username}</p>
                    <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                      Conectado
                    </p>
                  </div>
                </div>
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
              <div {...stagger(NAV_LINKS.length)}>
                <Link
                  href="/login"
                  onClick={close}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
                >
                  Login
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
