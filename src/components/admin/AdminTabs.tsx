"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import { ImageIcon, LayoutGrid, Link2, UserRound } from "lucide-react";

/** Abas do painel: cada uma mostra só a sua seção. */
export const ADMIN_SECTIONS = [
  { id: "inicio", label: "Visão geral", icon: LayoutGrid },
  { id: "midia", label: "Mídia", icon: ImageIcon },
  { id: "identidade", label: "Identidade", icon: UserRound },
  { id: "redes", label: "Redes", icon: Link2 },
] as const;

export type SectionId = (typeof ADMIN_SECTIONS)[number]["id"];

const DEFAULT: SectionId = "inicio";
const EVENT = "admin-tab-change";

function readHash(): SectionId {
  const hash = window.location.hash.slice(1);
  return ADMIN_SECTIONS.some((s) => s.id === hash) ? (hash as SectionId) : DEFAULT;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Aba ativa, guardada no #hash da URL (recarregar a página mantém a aba). */
export function useAdminTab(): [SectionId, (id: SectionId) => void] {
  const active = useSyncExternalStore(subscribe, readHash, () => DEFAULT);
  const select = useCallback((id: SectionId) => {
    const url = id === DEFAULT ? window.location.pathname + window.location.search : `#${id}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(EVENT));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, []);
  return [active, select];
}

/** Conteúdo de uma aba: continua montado quando oculto, para não perder rascunhos ao trocar de aba. */
export function AdminTabPanel({ id, children }: { id: SectionId; children: ReactNode }) {
  const [active] = useAdminTab();
  return (
    <div id={`aba-${id}`} hidden={active !== id}>
      {children}
    </div>
  );
}
