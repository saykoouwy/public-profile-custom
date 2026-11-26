import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { verifySession } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export const metadata: Metadata = {
  title: "Painel · BioLink",
  robots: { index: false, follow: false },
};

/** Camada 2: valida token + usuário no servidor antes de renderizar qualquer HTML administrativo. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await verifySession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh bg-neutral-950 bg-[radial-gradient(ellipse_at_top,rgba(120,90,20,0.12),transparent_55%)] text-neutral-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck className="size-5 shrink-0 text-amber-300" aria-hidden />
            <span className="truncate text-sm font-semibold">Painel</span>
            <span className="hidden truncate text-xs text-neutral-500 sm:inline">@{session.username}</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="glass-soft flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Ver bio
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
              >
                <LogOut className="size-3.5" aria-hidden />
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}
