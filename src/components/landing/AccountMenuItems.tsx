"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, Home, LogOut, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/actions/auth";

type ItemKey = "customize" | "profile" | "home";

const ITEMS: Record<ItemKey, { label: string; icon: LucideIcon }> = {
  customize: { label: "Personalizar", icon: SlidersHorizontal },
  profile: { label: "Ver meu perfil", icon: ExternalLink },
  home: { label: "Página inicial", icon: Home },
};

type Props = {
  username: string;
  /** Itens de navegação, na ordem; "Sair" sempre vem por último. */
  items: ItemKey[];
  /** Classe de cada item (o visual muda entre navbar, menu mobile e painel). */
  itemClassName: string;
  /** Classe extra do botão "Sair". */
  logoutClassName?: string;
  /** Envolve ícone + texto (o menu mobile usa um <span> para alinhar). */
  wrap?: (children: ReactNode) => ReactNode;
  /** Usa role="menuitem" (menus suspensos). */
  menu?: boolean;
  /** Abre o perfil público em nova aba (no painel). */
  profileInNewTab?: boolean;
  onNavigate?: () => void;
};

/** Itens da conta logada + formulário de logout, compartilhados pelos três menus da conta. */
export function AccountMenuItems({
  username,
  items,
  itemClassName,
  logoutClassName = "",
  wrap = (c) => c,
  menu = false,
  profileInNewTab = false,
  onNavigate,
}: Props) {
  const role = menu ? "menuitem" : undefined;
  const href: Record<ItemKey, string> = { customize: "/customize", profile: `/${username}`, home: "/" };

  return (
    <>
      {items.map((key) => {
        const { label, icon: Icon } = ITEMS[key];
        const newTab = key === "profile" && profileInNewTab;
        return (
          <Link
            key={key}
            role={role}
            href={href[key]}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener" : undefined}
            onClick={onNavigate}
            className={itemClassName}
          >
            {wrap(
              <>
                <Icon className="size-4" aria-hidden />
                {label}
              </>,
            )}
          </Link>
        );
      })}
      <form action={logoutAction}>
        <button role={role} type="submit" className={`${itemClassName} w-full ${logoutClassName}`}>
          {wrap(
            <>
              <LogOut className="size-4" aria-hidden />
              Sair
            </>,
          )}
        </button>
      </form>
    </>
  );
}
