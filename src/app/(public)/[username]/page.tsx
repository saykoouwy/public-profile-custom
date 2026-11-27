import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { notBannedWhere } from "@/lib/roles";
import { cursorStyle } from "@/lib/utils";
import BackgroundMedia from "@/components/public/BackgroundMedia";
import BioCard from "@/components/public/BioCard";
import AudioPlayer from "@/components/public/AudioPlayer";
import EnterScreen from "@/components/public/EnterScreen";
import { ComingSoonPanel } from "@/components/public/ComingSoonPanel";
import { AboutCreator } from "@/components/AboutCreator";
import type { PublicProfile } from "@/types";

// Cada perfil vive em /<usuário>. Renderizado sob demanda a cada requisição (sem cache ISR/CDN do HTML),
// buscando direto no banco: mudanças pelo painel ou feitas direto no Neon aparecem na hora.
export const dynamic = "force-dynamic";

/** Memoizado por requisição: generateMetadata e a página compartilham a mesma consulta. */
const getPublicProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  const profile = await prisma.profile.findFirst({
    // Conta banida (em vigor) não tem página pública.
    where: { user: { username: { equals: username, mode: "insensitive" }, ...notBannedWhere() } },
    include: {
      user: { select: { username: true } },
      socialLinks: {
        where: { isActive: true },
        orderBy: { orderIndex: "asc" },
        select: { id: true, platform: true, label: true, url: true, iconName: true },
      },
      tracks: {
        where: { audioUrl: { not: null } },
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, artist: true, audioUrl: true, coverUrl: true },
      },
    },
  });
  if (!profile) return null;

  // Somente campos públicos chegam ao cliente (nada de userId/ids internos do perfil).
  return {
    username: profile.user.username,
    displayName: profile.displayName,
    bio: profile.bio,
    location: profile.location,
    avatarUrl: profile.avatarUrl,
    hasHaloEffect: profile.hasHaloEffect,
    customCursorUrl: profile.customCursorUrl,
    backgroundType: profile.backgroundType,
    backgroundUrl: profile.backgroundUrl,
    // Só faixas com arquivo entram no player.
    shuffleTracks: profile.shuffleTracks,
    tracks: profile.tracks.flatMap((t) => (t.audioUrl ? [{ ...t, audioUrl: t.audioUrl }] : [])),
    // Tudo aqui é serializado no HTML (payload RSC): o que está desativado nem chega ao navegador.
    // Com o Discord desligado, o ID não vaza; com ele ligado, a atividade manual não é usada.
    discordUserId: profile.showDiscordStatus ? profile.discordUserId : null,
    showDiscordStatus: profile.showDiscordStatus,
    discordLastOnlineAt: profile.showDiscordStatus ? (profile.discordLastOnlineAt?.toISOString() ?? null) : null,
    manualStatusText: profile.showDiscordStatus ? null : profile.manualStatusText,
    manualActivityType: profile.showDiscordStatus ? null : profile.manualActivityType,
    viewsCount: profile.viewsCount,
    socialLinks: profile.socialLinks,
  };
});

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  const profile = await getPublicProfile((await params).username);
  if (!profile) return { title: "Perfil não encontrado" };
  return {
    // Nome da aba: "@usuário" (ex.: "@rubris")
    title: `@${profile.username}`,
    description: profile.bio ?? undefined,
    openGraph: {
      title: profile.displayName,
      description: profile.bio ?? undefined,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: PageProps<"/[username]">) {
  const profile = await getPublicProfile((await params).username);
  if (!profile) notFound();

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center px-0 pt-24 pb-10"
      style={profile.customCursorUrl ? { cursor: cursorStyle(profile.customCursorUrl) } : undefined}
    >
      <BackgroundMedia type={profile.backgroundType} url={profile.backgroundUrl} hasMusic={profile.tracks.length > 0} />
      {/* Telas largas: [jogo | card | favoritos]. Menores: card em cima e os dois blocos embaixo. */}
      <div className="grid w-full max-w-[668px] grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:max-w-[1240px] xl:grid-cols-[minmax(0,1fr)_668px_minmax(0,1fr)] xl:items-center">
        <div className="sm:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
          <BioCard profile={profile} />
          {profile.tracks.length > 0 && <AudioPlayer tracks={profile.tracks} shuffle={profile.shuffleTracks} />}
          {/* Sobre o criador do site; no celular vem antes dos blocos "em breve" */}
          <AboutCreator variant="compact" />
        </div>
        {/* TEMPORÁRIO: blocos "em breve" (informações de jogo e jogos favoritos) */}
        <ComingSoonPanel kind="stats" className="mx-2 xl:col-start-1 xl:row-start-1 xl:mx-0" />
        <ComingSoonPanel kind="games" className="mx-2 xl:col-start-3 xl:row-start-1 xl:mx-0" />
      </div>
      {/* Só existe quando há música: o clique de entrada é o que libera o som no navegador. */}
      {profile.tracks.length > 0 && <EnterScreen />}
    </main>
  );
}
