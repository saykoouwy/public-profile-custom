import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Bug, Mail } from "lucide-react";
import { BRAND_NAME, CREATOR_GITHUB } from "@/lib/brand";
import { GitHubIcon, SocialIcon } from "@/components/icons/SocialIcons";
import { NAV_LINKS } from "./nav-links";

// PROPOSTA: os contatos abaixo são exemplos. Troque pelos reais (ou remova) antes de publicar.
const CONTACT_EMAIL = "contato@mypfp.me"; // exemplo
const DISCORD_INVITE = "#"; // exemplo: convite do servidor do Discord
const GITHUB_USER = CREATOR_GITHUB;

const CONTACTS = [
  {
    icon: <Mail className="size-5" aria-hidden />,
    title: "E-mail",
    text: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
  },
  {
    icon: <SocialIcon name="discord" className="text-xl" />,
    title: "Discord",
    text: "Entre no servidor da comunidade",
    href: DISCORD_INVITE,
  },
  {
    icon: <Bug className="size-5" aria-hidden />,
    title: "Achou um problema?",
    text: "Conte pra mim e eu corrijo",
    href: `mailto:${CONTACT_EMAIL}?subject=Problema no ${BRAND_NAME}`,
  },
];

/** Rodapé da página inicial: contato, navegação e créditos. Alvo do link "Contato" da navbar. */
export function Footer() {
  return (
    // Faixa de ponta a ponta, mais escura que o resto da página para destacar o rodapé.
    <footer
      id="contato"
      aria-labelledby="contato-titulo"
      className="mt-16 scroll-mt-24 border-t border-white/10 bg-black/75 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl px-6 pt-14 pb-8 sm:pt-16">
        {/* Chamada de contato */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <h2
              id="contato-titulo"
              className="font-heading text-2xl font-semibold text-white sm:text-3xl"
            >
              Fale comigo
            </h2>
            <p className="mt-3 text-neutral-400">
              Dúvidas, sugestões de recursos ou quer mostrar o perfil que você
              montou? Manda uma mensagem.
            </p>
          </div>

          <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-2xl">
            {CONTACTS.map((c) => (
              <li key={c.title}>
                <a
                  href={c.href}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-amber-300/30 hover:bg-white/[0.07]"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    {c.icon}
                  </span>
                  <span>
                    <span className="block font-medium text-white">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-sm break-words text-neutral-400 group-hover:text-neutral-300">
                      {c.text}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="my-8 h-px bg-white/10" />

        {/* Marca, navegação e redes */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Image
              src="/logo.png"
              alt={BRAND_NAME}
              width={743}
              height={158}
              className="h-7 w-auto"
            />
          </div>

          <nav aria-label="Rodapé">
            <p className="mb-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Navegação
            </p>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-neutral-300 transition hover:text-white"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="text-neutral-300 transition hover:text-white"
                >
                  Login
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Redes
            </p>
            <div className="flex gap-2">
              <a
                href={`https://github.com/${GITHUB_USER}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`@${GITHUB_USER} no GitHub`}
                className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/10"
              >
                <GitHubIcon className="size-[18px]" />
              </a>
              <a
                href={DISCORD_INVITE}
                aria-label="Servidor no Discord"
                className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-lg text-white transition hover:bg-white/10"
              >
                <SocialIcon name="discord" />
              </a>
            </div>
          </div>
        </div>

        {/* Linha final */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-neutral-500">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME} · projeto pessoal, livre
            para uso não comercial.
          </p>
          <a
            href="#"
            className="flex items-center gap-1 transition hover:text-white"
          >
            Voltar ao topo
            <ArrowUp className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </footer>
  );
}
