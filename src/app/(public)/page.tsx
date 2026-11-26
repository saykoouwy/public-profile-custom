import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Film, Link2, ListMusic, LogIn, MessageCircle, SlidersHorizontal, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Custom Profile · sua página de bio",
  description: "Uma página de bio só sua: fundo em vídeo, música, status do Discord e todos os seus links em um lugar.",
};

// Página estática; o link "Ver um exemplo" é revisto de tempos em tempos.
export const revalidate = 3600;

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
    <div className="min-h-dvh bg-neutral-950 bg-[radial-gradient(ellipse_at_top,rgba(120,90,20,0.18),transparent_60%)] text-neutral-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl text-white">Custom Profile</span>
        <Link
          href="/login"
          className="glass-soft flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
        >
          <LogIn className="size-3.5" aria-hidden />
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <span className="mb-6 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">
            Sua página de bio, do seu jeito
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            Um perfil que é a sua cara, num link só
          </h1>
          <p className="mt-5 max-w-xl text-base text-neutral-400 sm:text-lg">
            Fundo em vídeo, música tocando, status do Discord e todos os seus links reunidos em uma página que você
            personaliza sem escrever código.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {example && (
              <Link
                href={`/${example.username}`}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200"
              >
                Ver um exemplo
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
            <Link
              href="/login"
              className="glass-soft rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Entrar no painel
            </Link>
          </div>
        </section>

        {/* Recursos */}
        <section aria-labelledby="recursos" className="py-12">
          <h2 id="recursos" className="mb-8 text-center text-2xl font-semibold text-white">
            O que dá para colocar no seu perfil
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="glass rounded-2xl p-5">
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
        <section aria-labelledby="como-funciona" className="py-16">
          <h2 id="como-funciona" className="mb-8 text-center text-2xl font-semibold text-white">
            Como funciona
          </h2>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="glass-soft rounded-2xl p-5">
                <span className="text-sm font-semibold tabular-nums text-amber-300">0{i + 1}</span>
                <h3 className="mt-2 font-medium text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm text-neutral-400">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl border-t border-white/10 px-6 py-6 text-xs text-neutral-500">
        Custom Profile · projeto pessoal, livre para uso não comercial.
      </footer>
    </div>
  );
}
