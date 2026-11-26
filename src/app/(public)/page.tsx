import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import BackgroundMedia from "@/components/public/BackgroundMedia";
import BioCard from "@/components/public/BioCard";
import AudioPlayer from "@/components/public/AudioPlayer";
import EnterScreen from "@/components/public/EnterScreen";
import type { PublicProfile } from "@/types";

// Renderizado no servidor e mantido em cache; as Server Actions do admin chamam revalidatePath("/")
// a cada alteração. O revalidate abaixo é só uma rede de segurança para o contador de views no HTML.
export const revalidate = 300;

async function getPublicProfile(): Promise<PublicProfile | null> {
  const profile = await prisma.profile.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
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
    discordUserId: profile.discordUserId,
    showDiscordStatus: profile.showDiscordStatus,
    manualStatusText: profile.manualStatusText,
    manualActivityType: profile.manualActivityType,
    viewsCount: profile.viewsCount,
    socialLinks: profile.socialLinks,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getPublicProfile();
  if (!profile) return { title: "BioLink" };
  return {
    title: profile.displayName,
    description: profile.bio ?? undefined,
    openGraph: {
      title: profile.displayName,
      description: profile.bio ?? undefined,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

export default async function PublicPage() {
  const profile = await getPublicProfile();

  if (!profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center text-neutral-400">
        Perfil ainda não configurado. Rode <code className="mx-1 text-neutral-200">npx prisma db seed</code>.
      </main>
    );
  }

  return (
    <main
      className="relative flex min-h-dvh flex-col items-center justify-center px-0 pt-24 pb-10"
      style={profile.customCursorUrl ? { cursor: `url("${encodeURI(profile.customCursorUrl)}") 4 4, auto` } : undefined}
    >
      <BackgroundMedia type={profile.backgroundType} url={profile.backgroundUrl} hasMusic={profile.tracks.length > 0} />
      <BioCard profile={profile} />
      {profile.tracks.length > 0 && (
        <>
          <AudioPlayer tracks={profile.tracks} shuffle={profile.shuffleTracks} />
          {/* Só existe quando há música: o clique de entrada é o que libera o som no navegador. */}
          <EnterScreen />
        </>
      )}
    </main>
  );
}
