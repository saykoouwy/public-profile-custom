import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthorizedProfile } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";
import { BackNavbar } from "@/components/landing/BackNavbar";
import { HeroBackground } from "@/components/landing/HeroBackground";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: `Entrar · ${BRAND_NAME}`,
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Já logado (validado no banco, não só pela assinatura do JWT)? Vai direto para o painel.
  // Cookie órfão (usuário/perfil inexistente, sessão revogada) apenas mostra o formulário: sem loop.
  if (await getAuthorizedProfile()) redirect("/customize");

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
