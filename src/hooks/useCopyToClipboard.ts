"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Copia um texto e mantém `copied = true` por `timeoutMs` (para o feedback "Copiado!"). */
export function useCopyToClipboard(timeoutMs = 1800): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), timeoutMs);
      } catch {
        /* sem permissão de área de transferência: nada a fazer */
      }
    },
    [timeoutMs],
  );

  return { copied, copy };
}
