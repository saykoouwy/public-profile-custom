import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { storageMode } from "@/lib/storage";
import MediaManager from "@/components/admin/MediaManager";
import ProfileEditor from "@/components/admin/ProfileEditor";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTabPanel } from "@/components/admin/AdminTabs";
import SocialLinksEditor from "@/components/admin/SocialLinksEditor";
import { WelcomePanel } from "@/components/admin/WelcomePanel";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { isBanActive } from "@/lib/roles";
import { DEFAULT_AVATAR } from "@/lib/media-rules";
import type { AdminUserRow } from "@/types";
import { eyebrowClass, panelClass } from "@/components/admin/ui";

export default async function AdminPage() {
  // Layout e page renderizam em paralelo: a page também verifica (memoizado por requisição).
  const session = await verifySession();
  if (!session) redirect("/logout");

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
  if (!profile) redirect("/logout");

  // Lista de contas: só é consultada (e só chega ao navegador) para o privilégio Ultra.
  const isUltra = session.role === "ULTRA";
  const users = isUltra ? await listUsersForAdmin() : [];

  return (
    <>
      <AdminSidebar
        username={session.username}
        isUltra={isUltra}
        views={profile.viewsCount}
        links={profile.socialLinks}
        tracks={profile.tracks}
      />

      {/* Uma aba por vez: o menu lateral escolhe qual seção aparece */}
      <main className="min-w-0 flex-1 pb-20 lg:pt-16">
        {isUltra && (
          <AdminTabPanel id="admin">
            <UsersAdmin users={users} />
          </AdminTabPanel>
        )}

        <AdminTabPanel id="inicio">
          <WelcomePanel
            username={session.username}
            role={session.role}
            displayName={profile.displayName}
            avatarUrl={profile.avatarUrl ?? DEFAULT_AVATAR}
            hasHalo={profile.hasHaloEffect}
            views={profile.viewsCount}
            links={profile.socialLinks.filter((l) => l.isActive).length}
            tracks={profile.tracks.filter((t) => t.audioUrl).length}
          />
        </AdminTabPanel>

        <AdminTabPanel id="midia">
          <section id="midia" aria-labelledby="midia-titulo" className={`${panelClass} p-5 sm:p-10`}>
            <header className="mb-8">
              <p className={eyebrowClass}>01 · Mídia</p>
              <h2 id="midia-titulo" className="mt-2 font-heading text-2xl font-semibold text-white sm:text-3xl">
                Envio de mídias
              </h2>
              <p className="mt-2 text-sm text-neutral-400">Fundo, música, avatar e cursor exibidos na sua bio.</p>
            </header>
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
        </AdminTabPanel>

        <AdminTabPanel id="identidade">
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
          />
        </AdminTabPanel>

        <AdminTabPanel id="redes">
          <SocialLinksEditor links={profile.socialLinks} />
        </AdminTabPanel>
      </main>
    </>
  );
}

async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const now = new Date();
  const rows = await prisma.user.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      bannedAt: true,
      banExpiresAt: true,
      banReason: true,
      profile: { select: { avatarUrl: true } },
    },
  });
  return rows.map((u) => {
    const banned = isBanActive(u, now);
    return {
      id: u.id,
      username: u.username,
      avatarUrl: u.profile?.avatarUrl ?? DEFAULT_AVATAR,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      banned,
      banExpiresAt: banned ? (u.banExpiresAt?.toISOString() ?? null) : null,
      banReason: banned ? u.banReason : null,
    };
  });
}
