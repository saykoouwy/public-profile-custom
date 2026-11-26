import type { Metadata } from "next";
import { BackNavbar } from "@/components/landing/BackNavbar";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar · mypfp.me",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip text-neutral-100">
      {/* Mesmo fundo animado da página inicial */}
      <HeroBackground />

      <div className="relative flex min-h-dvh flex-col pt-4">
        <BackNavbar />

        <main className="flex flex-1 items-center justify-center px-4 py-12">
          {/* Mesmo painel do hero da página inicial: escuro, translúcido, com desfoque */}
          <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-black/45 p-8 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-12">
            <LoginForm />
          </section>
        </main>
      </div>
    </div>
  );
}
