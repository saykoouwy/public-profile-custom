"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Fecha um menu/painel aberto ao clicar (ou tocar) fora dos elementos informados ou ao apertar Esc.
 * Usado pelos menus da conta (landing e painel), pelo menu mobile da navbar e pela sidebar do painel.
 */
export function useDismiss(open: boolean, onClose: () => void, refs: RefObject<HTMLElement | null>[]): void {
  // Guarda as referências mais recentes sem reinscrever os listeners a cada render.
  const latest = useRef({ onClose, refs });
  useEffect(() => {
    latest.current = { onClose, refs };
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!latest.current.refs.some((r) => r.current?.contains(target))) latest.current.onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}
