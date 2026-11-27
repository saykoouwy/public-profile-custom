"use client";

import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Ban, Loader2, Lock, Search, Trash2, Undo2, UserPlus } from "lucide-react";
import { banUser, createUser, deleteUser, setUserRole, unbanUser } from "@/actions/users";
import { NoticeLine } from "@/components/admin/MediaManager";
import {
  ASSIGNABLE_ROLES,
  BAN_DURATION_LABELS,
  BAN_DURATIONS,
  ROLE_LABELS,
  formatBanDate,
  type AssignableRole,
  type BanDuration,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { ActionResult, AdminUserRow } from "@/types";
import { RoleBadge } from "./RoleBadge";
import { SectionHeading } from "./SectionHeading";
import { cardClass, inputBase, inputClass, inputErr, inputOk, panelClass, primaryButton, secondaryButton, type Notice } from "./ui";

const DURATIONS = Object.keys(BAN_DURATIONS) as BanDuration[];
const selectClass = `${inputClass} appearance-none pr-8 [&>option]:bg-neutral-900`;

/**
 * Aba Admin (só Ultra): cadastrar contas, trocar privilégio, banir/desbanir e excluir.
 * Tudo é revalidado no servidor (src/actions/users.ts); aqui é só a interface.
 */
export function UsersAdmin({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.username.toLowerCase().includes(q)) : users;
  }, [users, query]);

  const counts = {
    total: users.length,
    premium: users.filter((u) => u.role === "PREMIUM").length,
    banned: users.filter((u) => u.banned).length,
  };

  return (
    <section aria-labelledby="admin-titulo" className={`${panelClass} p-5 sm:p-10`}>
      <SectionHeading
        eyebrow="00 · Admin"
        id="admin-titulo"
        title="Gerenciar contas"
        text="Cadastre contas, defina privilégios e aplique banimentos. Só a conta Ultra vê esta aba."
        aside={
          <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
            <Stat value={counts.total} label={counts.total === 1 ? "conta" : "contas"} />
            <Stat value={counts.premium} label="premium" />
            <Stat value={counts.banned} label={counts.banned === 1 ? "banida" : "banidas"} />
          </div>
        }
      />

      <CreateUserForm />

      <div className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-heading text-lg font-semibold text-white">Contas</h3>
          <label className="relative sm:w-64">
            <span className="sr-only">Buscar usuário</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-500" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar usuário"
              className={cn(inputClass, "pl-10")}
            />
          </label>
        </div>

        <ul className="space-y-2">
          {filtered.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
          {filtered.length === 0 && (
            <li className={cn(cardClass, "px-4 py-6 text-center text-sm text-neutral-500")}>Nenhuma conta encontrada.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
      <span className="font-semibold text-white tabular-nums">{value}</span> {label}
    </span>
  );
}

function CreateUserForm() {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [role, setRole] = useState<AssignableRole>("MEMBER");

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const res = await createUser({ username: data.get("username"), password: data.get("password"), role });
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setNotice(res.ok ? { kind: "ok", text: res.message ?? "Conta criada." } : { kind: "error", text: res.error });
      if (res.ok) {
        form.reset();
        setRole("MEMBER");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className={cn(cardClass, "p-4 sm:p-5")} noValidate>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white">
        <UserPlus className="size-4 text-amber-300" aria-hidden />
        Cadastrar conta
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-start">
        <Field label="Usuário" error={errors.username?.[0]}>
          <input
            name="username"
            autoComplete="off"
            maxLength={30}
            placeholder="ex.: fulano"
            aria-invalid={!!errors.username}
            className={cn(inputBase, errors.username ? inputErr : inputOk)}
          />
        </Field>
        <Field label="Senha inicial" error={errors.password?.[0]}>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={128}
            placeholder="mín. 6 caracteres"
            aria-invalid={!!errors.password}
            className={cn(inputBase, errors.password ? inputErr : inputOk)}
          />
        </Field>
        <Field label="Privilégio">
          <RolePicker value={role} onChange={setRole} disabled={pending} />
        </Field>
        <div className="sm:pt-6">
          <button type="submit" disabled={pending} className={cn(primaryButton, "w-full sm:w-auto")}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            Criar
          </button>
        </div>
      </div>
      {notice && (
        <div className="mt-3">
          <NoticeLine notice={notice} />
        </div>
      )}
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-neutral-400">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-300">{error}</span>}
    </label>
  );
}

/** Seletor segmentado Membro / Premium (Ultra nunca é uma opção). */
function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: AssignableRole;
  onChange: (role: AssignableRole) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Privilégio" className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
      {ASSIGNABLE_ROLES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          disabled={disabled}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
            value === r
              ? r === "PREMIUM"
                ? "bg-amber-300/15 text-amber-200"
                : "bg-white/10 text-white"
              : "text-neutral-400 hover:text-white",
          )}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [mode, setMode] = useState<"idle" | "ban" | "delete">("idle");
  const [duration, setDuration] = useState<BanDuration>("1d");
  const [reason, setReason] = useState("");
  const isUltra = user.role === "ULTRA";

  const act = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      setNotice(res.ok ? (res.message ? { kind: "ok", text: res.message } : null) : { kind: "error", text: res.error });
      if (res.ok) after?.();
    });

  const status = user.banned
    ? user.banExpiresAt
      ? `Suspenso até ${formatBanDate(user.banExpiresAt)}`
      : "Banido permanentemente"
    : null;

  return (
    <li className={cn(cardClass, "p-3 sm:p-4", user.banned && "border-red-400/20 bg-red-500/[0.04]")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Identidade */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar pode ser GIF/URL do R2 */}
          <img src={user.avatarUrl} alt="" className={cn("size-10 shrink-0 rounded-full object-cover", user.banned && "grayscale")} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/${user.username}`}
                target="_blank"
                rel="noopener"
                className="truncate font-medium text-white hover:underline"
              >
                @{user.username}
              </a>
              <RoleBadge role={user.role} />
              {status && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">
                  <Ban className="size-3" aria-hidden />
                  {status}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-neutral-500">
              Desde {formatBanDate(user.createdAt).split(",")[0]}
              {user.banReason && <> · Motivo: {user.banReason}</>}
            </p>
          </div>
        </div>

        {/* Ações */}
        {isUltra ? (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-fuchsia-300/20 bg-fuchsia-300/[0.06] px-3 py-1.5 text-xs text-fuchsia-200 md:self-center">
            <Lock className="size-3.5" aria-hidden />
            Conta protegida
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <RolePicker
              value={user.role as AssignableRole}
              disabled={pending}
              onChange={(r) => r !== user.role && act(() => setUserRole(user.id, r))}
            />
            {user.banned ? (
              <button type="button" disabled={pending} onClick={() => act(() => unbanUser(user.id))} className={smallButton}>
                <Undo2 className="size-3.5" aria-hidden />
                Desbanir
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                aria-expanded={mode === "ban"}
                onClick={() => setMode(mode === "ban" ? "idle" : "ban")}
                className={cn(smallButton, mode === "ban" && "border-red-400/40 text-red-200")}
              >
                <Ban className="size-3.5" aria-hidden />
                Banir
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              aria-expanded={mode === "delete"}
              onClick={() => setMode(mode === "delete" ? "idle" : "delete")}
              aria-label={`Excluir @${user.username}`}
              className={cn(smallButton, "px-2.5", mode === "delete" && "border-red-400/40 text-red-200")}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
            {pending && <Loader2 className="size-4 animate-spin text-neutral-400" aria-hidden />}
          </div>
        )}
      </div>

      {/* Banir: duração + motivo */}
      {mode === "ban" && !user.banned && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center">
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as BanDuration)}
            aria-label="Duração do banimento"
            className={cn(selectClass, "sm:w-40")}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {BAN_DURATION_LABELS[d]}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={120}
            placeholder="Motivo (opcional, aparece para a pessoa no login)"
            className={cn(inputClass, "flex-1")}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                act(
                  () => banUser(user.id, { duration, reason }),
                  () => {
                    setMode("idle");
                    setReason("");
                  },
                )
              }
              className={dangerButton}
            >
              <Ban className="size-4" aria-hidden />
              {duration === "perm" ? "Banir para sempre" : "Suspender"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondaryButton}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Excluir: confirmação */}
      {mode === "delete" && (
        <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-200">
            Excluir <strong>@{user.username}</strong>? Perfil, links, músicas e mídias são apagados. Não dá para desfazer.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => act(() => deleteUser(user.id))} className={dangerButton}>
              <Trash2 className="size-4" aria-hidden />
              Excluir
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondaryButton}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="mt-2">
          <NoticeLine notice={notice} />
        </div>
      )}
    </li>
  );
}

const smallButton =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10 disabled:opacity-50";

const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-500/15 px-5 py-2.5 text-sm font-medium text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50";
