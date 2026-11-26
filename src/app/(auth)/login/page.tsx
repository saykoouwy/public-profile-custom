"use client";

import { useActionState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/actions/auth";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-neutral-950 px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl"
      />
      <form
        action={formAction}
        className="glass relative w-full max-w-sm space-y-5 rounded-3xl p-7 shadow-2xl"
        noValidate
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="glass-soft flex size-12 items-center justify-center rounded-2xl">
            <LockKeyhole className="size-5 text-amber-300" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-white">Painel administrativo</h1>
            <p className="text-sm text-neutral-400">Entre para editar seu perfil.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">Usuário</span>
            <input
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={30}
              defaultValue={state.username}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-neutral-300">Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              maxLength={128}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/20"
            />
          </label>
        </div>

        <p role="alert" aria-live="polite" className="min-h-5 text-center text-sm text-red-400">
          {state.error}
        </p>

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
