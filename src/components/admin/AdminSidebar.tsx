"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  ImageIcon,
  LayoutGrid,
  Link2,
  Menu,
  Music2,
  UserRound,
  X,
} from "lucide-react";
import { PLATFORM_LABELS, SocialIcon } from "@/components/public/BioCard";
import { cn } from "@/lib/utils";

type SidebarLink = { id: string; platform: string; label: string | null; iconName: string; isActive: boolean };
type SidebarTrack = { id: string; title: string | null; audioUrl: string | null };

type Props = {
  username: string;
  views: number;
  links: SidebarLink[];
  tracks: SidebarTrack[];
};

export const ADMIN_SECTIONS = [
  { id: "inicio", label: "Visão geral", icon: LayoutGrid },
  { id: "midia", label: "Mídia", icon: ImageIcon },
  { id: "perfil", label: "Perfil", icon: UserRound },
  { id: "redes", label: "Redes", icon: Link2 },
] as const;

type SectionId = (typeof ADMIN_SECTIONS)[number]["id"];

/** Rola até a seção (mesma rolagem suave usada na página inicial). */
function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/** Seção visível no momento, para destacar o item ativo da navegação. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>("inicio");
  useEffect(() => {
    const els = ADMIN_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id as SectionId);
      },
      // Considera "ativa" a seção que cruza a faixa superior da tela.
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return active;
}

/** Rola depois que o menu mobile fecha (fechar durante a rolagem a cancelaria). */
function scrollAfterClose(id: string, close: () => void) {
  close();
  requestAnimationFrame(() => requestAnimationFrame(() => scrollToSection(id)));
}

/**
 * Sidebar do painel: navegação pelas seções, atalho para copiar o link e grupos
 * recolhíveis com as redes e as músicas do perfil. No celular vira uma bolinha de menu
 * (mesmo visual da cápsula do usuário) que se expande num bloco único com o mesmo conteúdo.
 */
export function AdminSidebar(props: Props) {
  const active = useActiveSection();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!mobileRef.current?.contains(e.target as Node)) setMobileOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Celular: bolinha de menu no canto superior esquerdo que vira um bloco único ao abrir */}
      <div
        ref={mobileRef}
        className={cn(
          "fixed top-4 left-4 z-[60] overflow-hidden border border-white/10 bg-neutral-950/80 shadow-2xl shadow-black/40 backdrop-blur-xl transition-[width,border-radius] duration-300 ease-out lg:hidden",
          mobileOpen ? "w-[min(20rem,calc(100vw-2rem))] rounded-[1.75rem]" : "w-[42px] rounded-[21px]",
        )}
      >
        <div className="flex items-center gap-3 p-1">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="painel-menu-mobile"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15"
          >
            {/* Ícones sobrepostos que trocam com rotação suave */}
            <span className="relative size-4">
              <Menu
                className={cn("absolute inset-0 size-4 transition duration-300", mobileOpen && "rotate-90 scale-50 opacity-0")}
                aria-hidden
              />
              <X
                className={cn("absolute inset-0 size-4 transition duration-300", !mobileOpen && "-rotate-90 scale-50 opacity-0")}
                aria-hidden
              />
            </span>
          </button>
          <span
            className={cn(
              "flex shrink-0 items-center gap-2 transition duration-300",
              mobileOpen ? "opacity-100" : "opacity-0",
            )}
          >
            <Image src="/logo.png" alt="mypfp.me" width={743} height={158} className="h-5 w-auto" />
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
              Painel
            </span>
          </span>
        </div>

        {/* Corpo: a altura anima de 0fr para 1fr; inert quando fechado */}
        <div
          id="painel-menu-mobile"
          inert={!mobileOpen}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
            mobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto border-t border-white/10 px-2 pt-2 pb-2">
              <SidebarBody {...props} active={active} onNavigate={(id) => scrollAfterClose(id, closeMobile)} />
            </div>
            <ViewsFooter views={props.views} />
          </div>
        </div>
      </div>

      {/* Desktop: sidebar fixa ao lado do conteúdo */}
      <aside className="sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 lg:block">
        <div className="flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-neutral-950/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
            <Link href="/" aria-label="mypfp.me, página inicial">
              <Image src="/logo.png" alt="mypfp.me" width={743} height={158} className="h-6 w-auto" />
            </Link>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
              Painel
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
            <SidebarBody {...props} active={active} onNavigate={scrollToSection} />
          </div>
          <ViewsFooter views={props.views} />
        </div>
      </aside>
    </>
  );
}

/** Conteúdo comum da sidebar (desktop) e do menu expandido (celular). */
function SidebarBody({
  username,
  links,
  tracks,
  active,
  onNavigate,
}: Props & { active: SectionId; onNavigate: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [linksOpen, setLinksOpen] = useState(true);
  const [tracksOpen, setTracksOpen] = useState(true);
  const visibleLinks = links.filter((l) => l.isActive).length;
  const playable = tracks.filter((t) => t.audioUrl).length;
  const counts: Partial<Record<SectionId, number>> = { redes: links.length };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${username}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de área de transferência */
    }
  };

  return (
    <div className="space-y-1">
      {/* Navegação principal */}
      <nav aria-label="Seções do painel" className="space-y-0.5">
        {ADMIN_SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] transition",
                isActive ? "bg-white/10 font-semibold text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                className={cn("size-5 transition", isActive ? "text-amber-300" : "text-neutral-500 group-hover:text-neutral-300")}
                aria-hidden
              />
              <span className="flex-1 text-left">{label}</span>
              {counts[id] !== undefined && <CountBadge>{counts[id]}</CountBadge>}
            </button>
          );
        })}
        <a
          href={`/${username}`}
          target="_blank"
          rel="noopener"
          className="group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] text-neutral-400 transition hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="size-5 text-neutral-500 transition group-hover:text-neutral-300" aria-hidden />
          <span className="flex-1">Meu perfil</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-neutral-300 uppercase">
            Ao vivo
          </span>
        </a>
      </nav>

      {/* Ação de destaque (cobre), como o botão principal da referência */}
      <button
        type="button"
        onClick={copyLink}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2.5 text-[15px] font-medium text-orange-300 transition hover:border-orange-400/50 hover:bg-orange-500/15"
      >
        {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
        {copied ? "Link copiado!" : "Copiar meu link"}
      </button>

      <div className="my-3 h-px bg-white/10" />

      {/* Grupo: redes */}
      <Group title="Redes" open={linksOpen} onToggle={() => setLinksOpen((v) => !v)} meta={`${visibleLinks}/${links.length}`}>
        {links.length === 0 ? (
          <EmptyRow onClick={() => onNavigate("redes")}>Adicionar a primeira rede</EmptyRow>
        ) : (
          links.map((l) => (
            <Row key={l.id} onClick={() => onNavigate("redes")} dim={!l.isActive}>
              <SocialIcon name={l.iconName} className="text-lg text-white/90" />
              <span className="flex-1 truncate text-left font-medium text-white">
                {l.label || PLATFORM_LABELS[l.platform] || "Link"}
              </span>
              <span
                title={l.isActive ? "Visível na bio" : "Oculto"}
                className={cn("size-1.5 rounded-full", l.isActive ? "bg-emerald-400" : "bg-neutral-600")}
              />
            </Row>
          ))
        )}
      </Group>

      {/* Grupo: músicas */}
      <Group title="Músicas" open={tracksOpen} onToggle={() => setTracksOpen((v) => !v)} meta={`${playable}`}>
        {tracks.length === 0 ? (
          <EmptyRow onClick={() => onNavigate("midia")}>Enviar a primeira música</EmptyRow>
        ) : (
          tracks.map((t, i) => (
            <Row key={t.id} onClick={() => onNavigate("midia")} dim={!t.audioUrl}>
              <Music2 className="size-4 text-amber-300/80" aria-hidden />
              <span className="flex-1 truncate text-left font-medium text-white">{t.title || `Áudio ${i + 1}`}</span>
              <span className="text-[11px] text-neutral-500 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            </Row>
          ))
        )}
      </Group>
    </div>
  );
}

function ViewsFooter({ views }: { views: number }) {
  return (
    <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4 text-xs text-neutral-400">
      <Eye className="size-4 text-neutral-500" aria-hidden />
      <span className="font-semibold text-white tabular-nums">{views.toLocaleString("pt-BR")}</span>
      visualizações
    </div>
  );
}

function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-normal text-neutral-400 tabular-nums">
      {children}
    </span>
  );
}

function Group({
  title,
  open,
  onToggle,
  meta,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  meta: string;
  children: ReactNode;
}) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold tracking-[0.14em] text-neutral-500 uppercase transition hover:text-neutral-300"
      >
        <span className="flex-1 text-left">{title}</span>
        <span className="font-normal tracking-normal tabular-nums">{meta}</span>
        <ChevronDown className={cn("size-4 transition duration-300", !open && "-rotate-90")} aria-hidden />
      </button>
      {/* Abre e fecha animando a altura */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!open}
      >
        <div className="min-h-0 space-y-0.5 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

function Row({ onClick, dim, children }: { onClick: () => void; dim?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5",
        dim && "opacity-50",
      )}
    >
      {children}
    </button>
  );
}

function EmptyRow({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
    >
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </button>
  );
}
