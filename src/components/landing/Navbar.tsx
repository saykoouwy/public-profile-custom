import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MobileMenu } from "./MobileMenu";
import { NAV_LINKS } from "./nav-links";
import { UserMenu } from "./UserMenu";

/** Navbar flutuante em cápsula: logo, menu central e área do usuário. */
export async function Navbar() {
  const session = await verifySession();
  const profile = session
    ? await prisma.profile.findUnique({ where: { userId: session.userId }, select: { avatarUrl: true } })
    : null;
  const user = session
    ? { username: session.username, avatarUrl: profile?.avatarUrl ?? "/default-avatar.webp" }
    : null;

  return (
    <div className="sticky top-4 z-40 px-4">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-neutral-950/60 py-2 pr-2 pl-5 shadow-lg shadow-black/30 backdrop-blur-xl">
        <Link href="/" aria-label="mypfp.me, página inicial" className="shrink-0">
          <Image src="/logo.png" alt="mypfp.me" width={743} height={158} priority className="h-7 w-auto" />
        </Link>

        <ul className="hidden items-center gap-1 text-sm text-neutral-400 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.label}>
              <a href={l.href} className="rounded-full px-3 py-1.5 transition hover:bg-white/5 hover:text-white">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop: links ficam no centro; à direita, Login ou o menu da conta */}
        <div className="hidden lg:block">
          {user ? (
            <UserMenu username={user.username} avatarUrl={user.avatarUrl} />
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Login
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>

        {/* Telas menores: um único botão abre seções + conta */}
        <MobileMenu user={user} />
      </nav>
    </div>
  );
}
