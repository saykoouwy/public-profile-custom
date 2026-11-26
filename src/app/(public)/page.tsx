import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import { ArrowRight, Code2, Film, Gamepad2, MapPin, Link2, ListMusic, MessageCircle, SlidersHorizontal, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { Navbar } from "@/components/landing/Navbar";

export const metadata: Metadata = {
  title: "Custom Profile · sua página de bio",
  description: "Uma página de bio só sua: fundo em vídeo, música, status do Discord e todos os seus links em um lugar.",
};

// O lucide-react não traz mais ícones de marcas; mesmo desenho usado no BioCard.
const GithubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Film className="size-5" />,
    title: "Fundo em vídeo ou imagem",
    text: "MP4, WebM, GIF ou foto cobrindo a página inteira.",
  },
  {
    icon: <ListMusic className="size-5" />,
    title: "Playlist de músicas",
    text: "Até 5 músicas com capa, player na página e modo aleatório.",
  },
  {
    icon: <MessageCircle className="size-5" />,
    title: "Status do Discord",
    text: "Mostra o que você está jogando ou ouvindo em tempo real, ou um status manual.",
  },
  {
    icon: <Link2 className="size-5" />,
    title: "Todos os seus links",
    text: "Instagram, GitHub, YouTube, TikTok, Twitch e links próprios, na ordem que quiser.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Detalhes seus",
    text: "Avatar com auréola, cursor personalizado e contador de visualizações.",
  },
  {
    icon: <SlidersHorizontal className="size-5" />,
    title: "Painel sem código",
    text: "Tudo é editado pelo painel: envie arquivos, escreva a bio e pronto.",
  },
];

const STEPS = [
  { title: "Entre no painel", text: "Faça login e abra a personalização." },
  { title: "Monte sua página", text: "Envie fundo, avatar, músicas e adicione seus links." },
  { title: "Compartilhe", text: "Seu perfil fica em um link próprio, pronto para a bio das redes." },
];

export default async function LandingPage() {
  // O primeiro perfil criado serve de exemplo ao vivo.
  const example = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { username: true } });

  return (
    <div className="relative min-h-dvh overflow-x-clip text-neutral-100">
      <HeroBackground />

      <div className="relative pt-4">
        <Navbar />

        <main className="mx-auto max-w-6xl px-6">
          {/* Hero */}
          <section className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center py-24 text-center">
            {/* Painel escuro translúcido com desfoque; mesmo espaçamento interno em todos os lados */}
            <div className="flex max-w-4xl flex-col items-center rounded-[2rem] border border-white/10 bg-black/45 p-10 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-16">
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">
                Sua página de bio, do seu jeito
              </span>
              <h1 className="mt-6 max-w-[10.8em] font-heading text-4xl font-semibold text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-6xl">
                Um perfil que é a sua cara, num link só
              </h1>
              <p className="mt-5 max-w-xl text-base text-neutral-200 sm:text-lg">
                Fundo em vídeo, música tocando, status do Discord e todos os seus links reunidos em uma página que você
                personaliza sem escrever código.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {example && (
                <Link
                  href={`/${example.username}`}
                  className="group flex items-center gap-3 rounded-full bg-white py-1.5 pr-1.5 pl-6 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
                >
                  Ver um exemplo
                  <span className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-white transition group-hover:translate-x-0.5">
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </Link>
              )}
              <Link
                href="/login"
                className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
              >
                Login
                <ArrowRight className="size-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />
              </Link>
            </div>
          </section>

          {/* Recursos */}
          <section id="recursos" aria-labelledby="recursos-titulo" className="scroll-mt-24 py-20 sm:py-24">
            <h2 id="recursos-titulo" className="mb-12 text-center font-heading text-2xl font-semibold text-white sm:text-3xl">
              O que dá para colocar no seu perfil
            </h2>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="glass rounded-2xl p-6">
                  <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    {f.icon}
                  </span>
                  <h3 className="font-medium text-white">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-400">{f.text}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Como funciona */}
          <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-24 py-20 sm:py-24">
            <h2 id="como-funciona-titulo" className="mb-12 text-center font-heading text-2xl font-semibold text-white sm:text-3xl">
              Como funciona
            </h2>
            <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="glass rounded-2xl p-6">
                  <span className="text-sm font-semibold tabular-nums text-amber-300">0{i + 1}</span>
                  <h3 className="mt-2 font-medium text-white">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-neutral-400">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>
          {/* Quem somos */}
          <section id="quem-somos" aria-labelledby="quem-somos-titulo" className="scroll-mt-24 py-20 sm:py-24">
            <h2 id="quem-somos-titulo" className="mb-12 text-center font-heading text-2xl font-semibold text-white sm:text-3xl">
              Quem somos
            </h2>
            <div className="glass mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-3xl p-8 text-center sm:flex-row sm:items-start sm:p-10 sm:text-left">
              {/* eslint-disable-next-line @next/next/no-img-element -- avatar externo do GitHub */}
              <img
                src="https://avatars.githubusercontent.com/u/75825622?v=4&s=192"
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
                  O mypfp.me é um projeto pessoal do William, desenvolvedor iniciante e apaixonado por games. A ideia é
                  simples: dar a cada pessoa uma página de bio com a sua cara, sem precisar escrever código.
                </p>
                <ul className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-neutral-300 sm:justify-start">
                  <li className="glass-soft flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <Code2 className="size-3.5 text-amber-300" aria-hidden />
                    Desenvolvedor iniciante
                  </li>
                  <li className="glass-soft flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <Gamepad2 className="size-3.5 text-amber-300" aria-hidden />
                    Ama games
                  </li>
                  <li className="glass-soft flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <GithubIcon className="size-3.5 text-amber-300" aria-hidden />
                    No GitHub desde 2020
                  </li>
                </ul>
                <a
                  href="https://github.com/saykoouwy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <GithubIcon className="size-4" aria-hidden />
                  @saykoouwy no GitHub
                </a>
              </div>
            </div>
          </section>
        </main>

        <footer className="mx-auto mt-12 max-w-6xl border-t border-white/10 px-6 py-8 text-xs text-neutral-500">
          Custom Profile · projeto pessoal, livre para uso não comercial.
        </footer>
      </div>
    </div>
  );
}
