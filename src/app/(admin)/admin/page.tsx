import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { storageMode } from "@/lib/storage";
import MediaManager from "@/components/admin/MediaManager";
import ProfileEditor from "@/components/admin/ProfileEditor";

export default async function AdminPage() {
  // Layout e page renderizam em paralelo: a page também verifica (memoizado por requisição).
  const session = await verifySession();
  if (!session) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
    include: {
      socialLinks: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, platform: true, label: true, url: true, iconName: true, isActive: true },
      },
      tracks: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, artist: true, audioUrl: true, coverUrl: true },
      },
    },
  });
  if (!profile) redirect("/login");

  return (
    <>
      <section className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Envio de mídias</h1>
          <p className="text-sm text-neutral-400">Fundo, música, avatar e cursor exibidos na sua bio.</p>
        </div>
        <MediaManager
          storageEnabled={storageMode() !== "disabled"}
          media={{
            backgroundType: profile.backgroundType,
            backgroundUrl: profile.backgroundUrl,
            avatarUrl: profile.avatarUrl,
            hasHaloEffect: profile.hasHaloEffect,
            customCursorUrl: profile.customCursorUrl,
          }}
          shuffleTracks={profile.shuffleTracks}
          tracks={profile.tracks.map((t) => ({ ...t, title: t.title ?? "", artist: t.artist ?? "" }))}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Perfil e redes</h2>
          <p className="text-sm text-neutral-400">Textos, presença no Discord e links sociais.</p>
        </div>
        <ProfileEditor
          profile={{
            displayName: profile.displayName,
            bio: profile.bio ?? "",
            location: profile.location ?? "",
            discordUserId: profile.discordUserId ?? "",
            manualMode: !profile.showDiscordStatus && profile.manualActivityType !== null,
            manualActivityType: profile.manualActivityType === "PLAYING" ? "PLAYING" : "LISTENING",
            manualStatusText: profile.manualStatusText ?? "",
            viewsCount: profile.viewsCount,
          }}
          links={profile.socialLinks}
        />
      </section>
    </>
  );
}
