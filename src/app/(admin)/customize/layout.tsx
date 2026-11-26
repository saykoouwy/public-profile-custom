import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminUserMenu } from "@/components/admin/AdminUserMenu";
import { HeroBackground } from "@/components/landing/HeroBackground";

export const metadata: Metadata = {
  title: "Painel · mypfp.me",
  robots: { index: false, follow: false },
};

/** Camada 2: valida token + usuário no servidor antes de renderizar qualquer HTML administrativo. */
export default async function AdminLayout({ children }: LayoutProps<"/customize">) {
  const session = await verifySession();
  if (!session) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: session.userId },
    select: { avatarUrl: true },
  });

  return (
    <div className="relative min-h-dvh overflow-x-clip text-neutral-100">
      {/* Mesmo fundo animado da página inicial e do login */}
      <HeroBackground />

      {/* Cápsula do usuário isolada no canto superior direito */}
      <AdminUserMenu username={session.username} avatarUrl={profile?.avatarUrl ?? "/default-avatar.webp"} />

      {/* A página monta a sidebar (esquerda) e o conteúdo (direita) dentro deste contêiner */}
      <div className="relative mx-auto flex max-w-[1400px] flex-col gap-6 px-4 pt-16 pb-4 lg:flex-row lg:gap-8 lg:pt-4">
        {children}
      </div>
    </div>
  );
}
