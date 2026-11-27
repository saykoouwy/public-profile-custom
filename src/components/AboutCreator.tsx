import { Code2, Gamepad2, MapPin } from "lucide-react";
import { BRAND_NAME, CREATOR_GITHUB } from "@/lib/brand";
import { GitHubIcon } from "@/components/icons/SocialIcons";
import { cn } from "@/lib/utils";

const GITHUB_USER = CREATOR_GITHUB;
const AVATAR = "https://avatars.githubusercontent.com/u/75825622?v=4&s=192";

const TAGS = [
  { icon: <Code2 className="size-3.5 text-amber-300" aria-hidden />, text: "Desenvolvedor iniciante" },
  { icon: <Gamepad2 className="size-3.5 text-amber-300" aria-hidden />, text: "Ama games" },
  { icon: <GitHubIcon className="size-3.5 text-amber-300" aria-hidden />, text: "No GitHub desde 2020" },
];

/**
 * Quem criou o site. `full`: seção "Quem somos" da página inicial.
 * `compact`: bloco pequeno abaixo do player no card público.
 */
export function AboutCreator({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  if (variant === "compact") {
    return (
      <aside
        aria-label={`Sobre o ${BRAND_NAME}`}
        className={cn(
          "mx-auto mt-4 flex w-[calc(100%-16px)] max-w-[668px] items-center gap-3.5 rounded-3xl border border-white/[0.06] bg-neutral-900/60 p-4 shadow-2xl backdrop-blur-md",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do GitHub */}
        <img
          src={AVATAR}
          alt="Foto de perfil do William no GitHub"
          width={52}
          height={52}
          className="size-[52px] shrink-0 rounded-full border border-white/10 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">
            William <span className="font-medium text-neutral-500">· criador do {BRAND_NAME}</span>
          </p>
          <p className="mt-0.5 text-xs text-neutral-400">
            Projeto pessoal de um engenheiro de software intermediário apaixonado por games, feito para cada um ter uma bio com a sua cara.
          </p>
        </div>
        <a
          href={`https://github.com/${GITHUB_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`@${GITHUB_USER} no GitHub`}
          title={`@${GITHUB_USER} no GitHub`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/10"
        >
          <GitHubIcon className="size-[18px]" aria-hidden />
        </a>
      </aside>
    );
  }

  return (
    <div
      className={cn(
        "glass mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-3xl p-8 text-center sm:flex-row sm:items-start sm:p-10 sm:text-left",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do GitHub */}
      <img
        src={AVATAR}
        alt="Foto de perfil do William no GitHub"
        width={96}
        height={96}
        className="size-24 shrink-0 rounded-full border border-white/10 object-cover"
      />
      <div>
        <h3 className="text-xl font-semibold text-white">William</h3>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-neutral-400 sm:justify-start">
          <MapPin className="size-4" aria-hidden />
          Porto Velho, Brasil
        </p>
        <p className="mt-5 text-neutral-300">
          O {BRAND_NAME} é um projeto pessoal do William, desenvolvedor iniciante e apaixonado por games. A ideia é
          simples: dar a cada pessoa uma página de bio com a sua cara, sem precisar escrever código.
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-neutral-300 sm:justify-start">
          {TAGS.map((t) => (
            <li key={t.text} className="glass-soft flex items-center gap-1.5 rounded-full px-3 py-1.5">
              {t.icon}
              {t.text}
            </li>
          ))}
        </ul>
        <a
          href={`https://github.com/${GITHUB_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <GitHubIcon className="size-4" aria-hidden />
          @{GITHUB_USER} no GitHub
        </a>
      </div>
    </div>
  );
}
