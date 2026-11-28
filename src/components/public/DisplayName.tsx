"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { Badge } from "@/components/badges/BadgeIcon";
import { BADGES_INLINE, type BadgeId } from "@/lib/badges";
import { DISPLAY_NAME_FONT_INFO, type DisplayNameEffect, type DisplayNameFont } from "@/lib/display-name";
import { cn } from "@/lib/utils";

/**
 * Nome de exibição do card: fonte e efeito escolhidos pelo dono + badges.
 * Com até 3 badges, eles ficam na mesma linha do nome, centralizados com ele; com mais de 3, todos
 * descem juntos para uma linha logo abaixo do nome. O tamanho dos badges acompanha a largura.
 *
 * Com `fit`, o nome se ajusta ao espaço: começa em `fit.max` px e diminui até caber numa linha só
 * (junto dos badges ao lado), sem passar de `fit.min`. Só um nome longo demais até no mínimo quebra
 * linha. Recalcula ao redimensionar e quando a fonte escolhida termina de carregar.
 */
export function DisplayName({
  name,
  font,
  effect,
  badges = [],
  as: Tag = "h1",
  className,
  badgeClassName = "size-[clamp(20px,5.2vw,30px)]",
  fit,
}: {
  name: string;
  font: DisplayNameFont;
  effect: DisplayNameEffect;
  badges?: readonly BadgeId[];
  as?: "h1" | "span";
  className?: string;
  badgeClassName?: string;
  fit?: { min: number; max: number };
}) {
  const fitsInline = badges.length <= BADGES_INLINE;
  const inline = fitsInline ? badges : [];
  const below = fitsInline ? [] : badges;
  const fontStyle = { fontFamily: `var(${DISPLAY_NAME_FONT_INFO[font].cssVar}), var(--font-display), serif` } as CSSProperties;

  const wrapRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLElement>(null);
  const badgesRef = useRef<HTMLSpanElement>(null);
  const fitMin = fit?.min;
  const fitMax = fit?.max;

  // Mede antes de pintar (useLayoutEffect): o nome nunca aparece no tamanho errado.
  // O tamanho vai direto no estilo do elemento, sem re-render do React.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = nameRef.current;
    if (!wrap || !el || fitMin === undefined || fitMax === undefined) return;

    const apply = () => {
      const badgesBox = badgesRef.current;
      const gap = badgesBox ? parseFloat(getComputedStyle(el.parentElement!).columnGap) || 0 : 0;
      const available = wrap.clientWidth - (badgesBox ? badgesBox.offsetWidth + gap : 0);
      if (available <= 0) return;
      // Mede o nome inteiro numa linha no tamanho máximo e escala proporcionalmente.
      el.style.whiteSpace = "nowrap";
      el.style.fontSize = `${fitMax}px`;
      const natural = el.scrollWidth;
      const ideal = natural > available ? Math.floor((fitMax * available) / natural) : fitMax;
      const size = Math.max(fitMin, ideal);
      el.style.fontSize = `${size}px`;
      // Nem no mínimo coube: deixa quebrar linha em vez de vazar do card.
      el.style.whiteSpace = ideal < fitMin ? "normal" : "nowrap";
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(wrap);
    let alive = true;
    // A fonte escolhida pode chegar depois (carregada sob demanda): mede de novo com ela.
    document.fonts?.ready.then(() => alive && apply());
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [name, font, effect, inline.length, fitMin, fitMax]);

  return (
    <div ref={wrapRef} className="flex w-full min-w-0 flex-col items-center gap-[clamp(4px,1vw,8px)]">
      <div className="flex max-w-full min-w-0 items-center justify-center gap-[clamp(6px,1.6vw,12px)]">
        <Tag
          ref={nameRef as never}
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
          <span ref={badgesRef} className="flex shrink-0 items-center gap-[clamp(3px,0.9vw,6px)]">
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
