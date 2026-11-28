"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/badges/BadgeIcon";
import { BADGES_INLINE, type BadgeId } from "@/lib/badges";
import { DISPLAY_NAME_FONT_INFO, type DisplayNameEffect, type DisplayNameFont } from "@/lib/display-name";
import { cn } from "@/lib/utils";

/**
 * Nome de exibição do card: fonte e efeito escolhidos pelo dono + badges.
 * Com até 3 badges, eles ficam na mesma linha do nome, centralizados com ele; com mais de 3, todos
 * descem juntos para uma linha logo abaixo do nome. O tamanho acompanha a largura (menor no celular).
 */
export function DisplayName({
  name,
  font,
  effect,
  badges = [],
  as: Tag = "h1",
  className,
  badgeClassName = "size-[clamp(20px,5.2vw,30px)]",
}: {
  name: string;
  font: DisplayNameFont;
  effect: DisplayNameEffect;
  badges?: readonly BadgeId[];
  as?: "h1" | "span";
  className?: string;
  badgeClassName?: string;
}) {
  const fitsInline = badges.length <= BADGES_INLINE;
  const inline = fitsInline ? badges : [];
  const below = fitsInline ? [] : badges;
  const fontStyle = { fontFamily: `var(${DISPLAY_NAME_FONT_INFO[font].cssVar}), var(--font-display), serif` } as CSSProperties;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-[clamp(4px,1vw,8px)]">
      <div className="flex max-w-full min-w-0 items-center justify-center gap-[clamp(6px,1.6vw,12px)]">
        <Tag
          // data-text: o efeito de corrupção desenha cópias do nome em ::before/::after
          data-text={name}
          className={cn(
            "name-fx min-w-0 break-words text-(--card-name) [overflow-wrap:anywhere]",
            effect === "none" ? "text-glow" : `name-fx-${effect}`,
            className,
          )}
          style={fontStyle}
        >
          {name}
        </Tag>
        {inline.length > 0 && (
          <span className="flex shrink-0 items-center gap-[clamp(3px,0.9vw,6px)]">
            {inline.map((id) => (
              <Badge key={id} id={id} className={badgeClassName} />
            ))}
          </span>
        )}
      </div>
      {below.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-[clamp(3px,0.9vw,6px)]">
          {below.map((id) => (
            <Badge key={id} id={id} className={badgeClassName} />
          ))}
        </div>
      )}
    </div>
  );
}
