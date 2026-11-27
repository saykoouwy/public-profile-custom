import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Film, Link2, ListMusic, MessageCircle, SlidersHorizontal, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { notBannedWhere } from "@/lib/roles";
import { BRAND_NAME } from "@/lib/brand";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { AboutCreator } from "@/components/AboutCreator";

export const metadata: Metadata = {
  title: `${BRAND_NAME} · sua página de bio`,
  description: "Uma página de bio só sua: fundo em vídeo, música, status do Discord e todos os seus links em um lugar.",
};

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
  // O primeiro perfil criado (e não banido: o de um banido responde 404) serve de exemplo ao vivo.
  const example = await prisma.user.findFirst({
    where: notBannedWhere(),
    orderBy: { createdAt: "asc" },
    select: { username: true },
  });

  return (
    <div className="relative min-h-dvh overflow-x-clip text-neutral-100">
      <HeroBackground interactive />

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
            <AboutCreator />
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
