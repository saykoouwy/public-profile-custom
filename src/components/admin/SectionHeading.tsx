import type { ReactNode } from "react";
import { eyebrowClass } from "./ui";

/** Cabeçalho padrão das seções do painel ("02 · Perfil" + título + descrição + selo opcional). */
export function SectionHeading({
  eyebrow,
  id,
  title,
  text,
  aside,
}: {
  eyebrow: string;
  id: string;
  title: string;
  text: string;
  aside?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className={eyebrowClass}>{eyebrow}</p>
        <h2 id={id} className="mt-2 font-heading text-2xl font-semibold text-white sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-neutral-400">{text}</p>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </header>
  );
}
