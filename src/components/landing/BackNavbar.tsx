import Image from "next/image";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { ArrowLeft } from "lucide-react";

/**
 * Navbar em cápsula das telas fora da página inicial (ex.: login): mesma aparência da
 * Navbar principal, mas com uma única opção, voltar para o início.
 */
export function BackNavbar() {
  return (
    <div className="sticky top-4 z-40 h-14">
      <nav className="absolute inset-x-4 top-0 mx-auto flex max-w-6xl items-center justify-between gap-x-4 rounded-full border border-white/10 bg-neutral-950/60 py-2 pr-2 pl-5 shadow-lg shadow-black/30 backdrop-blur-xl">
        <Link href="/" aria-label={`${BRAND_NAME}, página inicial`} className="shrink-0">
          <Image src="/logo.png" alt={BRAND_NAME} width={743} height={158} priority className="h-7 w-auto" />
        </Link>
        <Link
          href="/"
          className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" aria-hidden />
          Voltar ao início
        </Link>
      </nav>
    </div>
  );
}
