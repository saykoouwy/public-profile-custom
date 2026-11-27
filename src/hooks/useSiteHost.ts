"use client";

import { useSyncExternalStore } from "react";
import { BRAND_NAME } from "@/lib/brand";

const noopSubscribe = () => () => undefined;

/**
 * Domínio em que o site está rodando (ex.: "mypfp.me" ou "localhost:3000"), para mostrar o link real
 * do perfil. No servidor (e na hidratação) usa o nome da marca; depois, o host da própria página.
 */
export function useSiteHost(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.host, () => BRAND_NAME);
}
