"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AUDIO_PLAY_EVENT } from "@/components/public/BackgroundMedia";

/**
 * Tela "clique para entrar": navegadores só liberam som depois de uma interação do visitante.
 * O clique aqui é essa interação — a música começa no mesmo instante em que a tela some.
 */
export default function EnterScreen() {
  const [open, setOpen] = useState(true);

  const enter = () => {
    // Disparado dentro do clique (ativação do usuário), senão o navegador recusaria o som.
    window.dispatchEvent(new Event(AUDIO_PLAY_EVENT));
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.button
          type="button"
          onClick={enter}
          autoFocus
          aria-label="Clique para entrar"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/70 backdrop-blur-xl outline-none"
        >
          <motion.span
            animate={{ opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="text-glow text-lg tracking-[0.3em] text-white lowercase select-none"
          >
            clique para entrar
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
