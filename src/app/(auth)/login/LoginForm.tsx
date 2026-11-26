"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { loginAction, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

const inputClass =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[15px] text-white outline-none transition placeholder:text-neutral-500 focus:border-white/30 focus:bg-white/[0.06] focus:ring-4 focus:ring-white/5";

// Logo do Google em cores (o lucide-react não traz ícones de marcas).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

/** Formulário de login no padrão da interface. Hoje só "Entrar" com usuário e senha funciona. */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="w-full">
      <p className="font-mono text-[11px] tracking-[0.2em] text-neutral-500 uppercase">Minha conta</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold text-white sm:text-5xl">Entrar</h1>
      <p className="mt-3 text-[15px] text-neutral-300">Acesse sua conta para personalizar o seu perfil.</p>

      {/* Abas: "Criar conta" fica visível, mas ainda não funciona */}
      <div role="tablist" aria-label="Acesso" className="mt-8 grid grid-cols-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          role="tab"
          aria-selected
          className="rounded-full bg-white/10 py-2.5 text-sm font-medium text-white"
        >
          Entrar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={false}
          disabled
          title="Em breve"
          className="cursor-not-allowed rounded-full py-2.5 text-sm text-neutral-500"
        >
          Criar conta
        </button>
      </div>

      {/* Google: reservado para o futuro */}
      <button
        type="button"
        disabled
        title="Em breve"
        className="mt-4 flex h-12 w-full cursor-not-allowed items-center justify-center gap-3 rounded-full border border-white/10 bg-white/[0.03] text-[15px] font-medium text-neutral-300"
      >
        <GoogleIcon />
        Continuar com Google
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tracking-wide text-neutral-400 uppercase">
          Em breve
        </span>
      </button>

      <div className="my-6 flex items-center gap-4 text-xs text-neutral-500">
        <span className="h-px flex-1 bg-white/10" />
        ou use seu usuário
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form action={formAction} noValidate className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-neutral-300">Usuário</span>
          <input
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={30}
            placeholder="exemplolol"
            defaultValue={state.username}
            className={inputClass}
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="password" className="text-sm text-neutral-300">
              Senha
            </label>
            <span title="Em breve" className="cursor-not-allowed text-sm text-neutral-500">
              Esqueci minha senha
            </span>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            maxLength={128}
            placeholder="minhasenha123"
            className={inputClass}
          />
        </div>

        <p role="alert" aria-live="polite" className="min-h-5 text-center text-sm text-red-400">
          {state.error}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ecebe6] text-[15px] font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-400">
        Ainda não tem perfil?{" "}
        <Link href="/" className="text-white transition hover:text-neutral-300">
          Conheça o mypfp.me
        </Link>
      </p>
    </div>
  );
}
