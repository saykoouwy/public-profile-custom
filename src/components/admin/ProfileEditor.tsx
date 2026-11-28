"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, CalendarClock, Eye, Loader2, Save } from "lucide-react";
import { updateProfile } from "@/actions/admin";
import { NoticeLine, Switch } from "@/components/admin/MediaManager";
import { cn, formatNumber } from "@/lib/utils";
import { cardClass, inputBase, inputErr, inputOk, panelClass, primaryButton, type Notice } from "./ui";
import { SectionHeading } from "./SectionHeading";
import { DisplayName } from "@/components/public/DisplayName";
import type { BadgeId } from "@/lib/badges";
import type { Role } from "@/lib/roles";
import {
  DISPLAY_NAME_EFFECTS,
  DISPLAY_NAME_EFFECT_INFO,
  DISPLAY_NAME_FONTS,
  DISPLAY_NAME_FONT_INFO,
  NAME_CHANGE_COOLDOWN_DAYS,
  hasNameChangeCooldown,
  type DisplayNameEffect,
  type DisplayNameFont,
} from "@/lib/display-name";

type ProfileFields = {
  displayName: string;
  displayNameFont: DisplayNameFont;
  displayNameEffect: DisplayNameEffect;
  bio: string;
  location: string;
  discordUserId: string;
  /** true = atividade manual (ignora o Discord); false = presença real do Discord via Lanyard. */
  manualMode: boolean;
  manualActivityType: "LISTENING" | "PLAYING";
  manualStatusText: string;
  viewsCount: number;
};


const inputClass = inputBase;

/** Compara os campos editáveis (o contador de views muda sozinho e não conta como edição). */
function sameFields(a: ProfileFields, b: ProfileFields): boolean {
  return (Object.keys(a) as (keyof ProfileFields)[]).every((k) => k === "viewsCount" || a[k] === b[k]);
}
const selectClass = "bg-neutral-950/80";

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export default function ProfileEditor({
  profile,
  username,
  role,
  badges,
  nextNameChangeAt,
}: {
  profile: ProfileFields;
  /** @usuário da conta: login, endereço /<usuário> e título da aba. Não muda com o nome de exibição. */
  username: string;
  role: Role;
  badges: BadgeId[];
  /** ISO de quando a próxima troca do nome fica liberada (Membros); null = pode trocar agora. */
  nextNameChangeAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(profile);
  // Última versão do servidor que o formulário "conhece". Quando as props mudam (router.refresh, outra aba,
  // salvamento), o rascunho intacto adota os dados novos; com edições pendentes, só o contador é atualizado.
  const [base, setBase] = useState(profile);
  if (profile !== base && (!sameFields(profile, base) || profile.viewsCount !== base.viewsCount)) {
    setBase(profile);
    setForm(sameFields(form, base) ? profile : { ...form, viewsCount: profile.viewsCount });
  }
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Notice>(null);

  const set = <K extends keyof ProfileFields>(key: K, value: ProfileFields[K]) => setForm((f) => ({ ...f, [key]: value }));

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (form.manualMode && !form.manualStatusText.trim()) {
      setErrors({ manualStatusText: ["Informe o texto da atividade manual."] });
      setNotice({ kind: "error", text: "Verifique os campos destacados." });
      return;
    }
    startTransition(async () => {
      // Os dois modos são exclusivos: o modo manual desliga o Discord e vice-versa.
      const res = await updateProfile({
        displayName: form.displayName,
        displayNameFont: form.displayNameFont,
        displayNameEffect: form.displayNameEffect,
        bio: form.bio,
        location: form.location,
        discordUserId: form.discordUserId,
        showDiscordStatus: !form.manualMode,
        manualActivityType: form.manualMode ? form.manualActivityType : null,
        manualStatusText: form.manualStatusText,
      });
      setErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      setNotice(res.ok ? { kind: "ok", text: res.message ?? "Salvo." } : { kind: "error", text: res.error });
      // Salvo: o que foi enviado vira a base, e a versão sanitizada do servidor substitui o rascunho.
      if (res.ok) {
        setBase(form);
        router.refresh();
      }
    });
  };

  const fieldError = (key: string) => errors[key]?.[0];
  // Membro em período de espera: o campo trava (o servidor também recusa a troca).
  const nameLocked = nextNameChangeAt !== null;

  return (
    <>
      {/* 02 · Perfil: identidade e presença */}
      <section id="perfil" aria-labelledby="perfil-titulo" className={`${panelClass} p-5 sm:p-10`}>
        <SectionHeading
          eyebrow="02 · Identidade"
          id="perfil-titulo"
          title="Identidade e presença"
          text="Como você aparece na sua bio e o que está fazendo agora."
          aside={
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
              <Eye className="size-3.5" aria-hidden /> {formatNumber(form.viewsCount)} visualizações
            </span>
          }
        />
      <form onSubmit={saveProfile} className="grid gap-x-8 gap-y-6 lg:grid-cols-2" noValidate>
        <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white">Identidade</h3>

        <Field label="Nome de exibição" error={fieldError("displayName")}>
          <input
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            maxLength={32}
            required
            disabled={nameLocked}
            title={nameLocked ? `Liberado em ${formatDate(nextNameChangeAt!)}` : undefined}
            className={cn(inputClass, "disabled:cursor-not-allowed disabled:opacity-60", fieldError("displayName") ? inputErr : inputOk)}
          />
        </Field>
        <div className={`${cardClass} space-y-2 p-3 text-xs leading-relaxed text-neutral-400`}>
          <p className="flex gap-2">
            <AtSign className="mt-0.5 size-3.5 shrink-0 text-neutral-500" aria-hidden />
            <span>
              O nome de exibição é só o que aparece no card. Seu nome de usuário continua{" "}
              <strong className="font-medium text-neutral-200">@{username}</strong>: é ele que você usa para entrar, que
              fica no seu link e no título da aba do navegador.
            </span>
          </p>
          <p className="flex gap-2">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-neutral-500" aria-hidden />
            <span>
              {hasNameChangeCooldown(role)
                ? `Membros podem trocar o nome de exibição a cada ${NAME_CHANGE_COOLDOWN_DAYS} dias.`
                : "Com o seu privilégio, você pode trocar o nome de exibição quando quiser."}
              {nameLocked && (
                <strong className="font-medium text-amber-200"> Próxima troca liberada em {formatDate(nextNameChangeAt!)}.</strong>
              )}
            </span>
          </p>
        </div>
        <Field label="Bio" error={fieldError("bio")} hint={`${form.bio.length}/160`}>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={160}
            rows={3}
            className={cn(inputClass, "resize-none", fieldError("bio") ? inputErr : inputOk)}
          />
        </Field>
        <Field label="Localização" error={fieldError("location")}>
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            maxLength={60}
            className={cn(inputClass, fieldError("location") ? inputErr : inputOk)}
          />
        </Field>

        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Presença</h3>
          <Field label="ID de usuário do Discord" error={fieldError("discordUserId")} hint="Requer entrar no servidor da Lanyard (discord.gg/lanyard).">
            <input
              value={form.discordUserId}
              onChange={(e) => set("discordUserId", e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              maxLength={20}
              placeholder="ex.: 94490510688792576"
              className={cn(inputClass, fieldError("discordUserId") ? inputErr : inputOk)}
            />
          </Field>
          <div className={`${cardClass} space-y-4 p-4`}>
            <label className="flex items-center gap-3 text-sm text-neutral-200">
              <Switch
                checked={form.manualMode}
                onChange={(v) => {
                  set("manualMode", v);
                  setErrors((e) => ({ ...e, manualStatusText: [] }));
                }}
                label="Usar atividade manual"
              />
              <span>
                Usar atividade manual
                <span className="block text-[11px] text-neutral-500">
                  {form.manualMode ? "Ignora a presença real do Discord." : "Exibindo a presença real do Discord."}
                </span>
              </span>
            </label>

            <fieldset
              disabled={!form.manualMode}
              className={cn("grid gap-2 transition sm:grid-cols-[140px_1fr]", !form.manualMode && "opacity-40")}
            >
              <legend className="sr-only">Atividade manual</legend>
              <Field label="Tipo">
                <select
                  value={form.manualActivityType}
                  onChange={(e) => set("manualActivityType", e.target.value as ProfileFields["manualActivityType"])}
                  className={cn(inputClass, inputOk, selectClass, "disabled:cursor-not-allowed")}
                >
                  <option value="LISTENING">Ouvindo</option>
                  <option value="PLAYING">Jogando</option>
                </select>
              </Field>
              <Field label="Texto da atividade" error={fieldError("manualStatusText")}>
                <input
                  value={form.manualStatusText}
                  onChange={(e) => set("manualStatusText", e.target.value)}
                  maxLength={80}
                  placeholder="DMMCR — rxbris"
                  className={cn(inputClass, "disabled:cursor-not-allowed", fieldError("manualStatusText") ? inputErr : inputOk)}
                />
              </Field>
            </fieldset>

            <label
              className="flex items-center gap-3 border-t border-white/10 pt-3 text-sm text-neutral-300"
              title="Controlado pela opção “Usar atividade manual”"
            >
              <Switch
                checked={!form.manualMode}
                onChange={() => undefined}
                disabled
                label="Mostrar status do Discord em tempo real"
              />
              <span>
                Mostrar status do Discord em tempo real
                <span className="block text-[11px] text-neutral-500">
                  {form.manualMode ? "Desligado pela atividade manual." : "Ligado automaticamente."}
                  {!form.manualMode && !form.discordUserId && " Informe o ID do Discord acima."}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Estilo do nome: fonte + efeito animado, com prévia (badges inclusos) */}
        <div className="space-y-4 border-t border-white/10 pt-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white">Estilo do nome</h3>
          <div
            aria-label="Prévia do nome"
            className="flex min-h-28 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_center,rgb(38_38_38),rgb(10_10_10))] px-4 py-6 text-center"
          >
            <DisplayName
              as="span"
              name={form.displayName || username}
              font={form.displayNameFont}
              effect={form.displayNameEffect}
              badges={badges}
              className="text-[clamp(32px,7vw,48px)] leading-tight text-white"
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Fonte</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {DISPLAY_NAME_FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={form.displayNameFont === f}
                  onClick={() => set("displayNameFont", f)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition",
                    form.displayNameFont === f
                      ? "border-amber-300/40 bg-amber-300/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]",
                  )}
                >
                  <span
                    className="max-w-full truncate text-2xl leading-none text-white"
                    style={{ fontFamily: `var(${DISPLAY_NAME_FONT_INFO[f].cssVar})` }}
                  >
                    Aa
                  </span>
                  <span className="text-[11px] text-neutral-400">{DISPLAY_NAME_FONT_INFO[f].label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm text-neutral-300">Efeito animado</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DISPLAY_NAME_EFFECTS.map((fx) => (
                <button
                  key={fx}
                  type="button"
                  aria-pressed={form.displayNameEffect === fx}
                  onClick={() => set("displayNameEffect", fx)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition",
                    form.displayNameEffect === fx
                      ? "border-amber-300/40 bg-amber-300/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]",
                  )}
                >
                  <span className="block text-sm font-medium text-white">{DISPLAY_NAME_EFFECT_INFO[fx].label}</span>
                  <span className="block text-[11px] leading-snug text-neutral-400">{DISPLAY_NAME_EFFECT_INFO[fx].description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center lg:col-span-2">
          <div className="min-h-5">{notice && <NoticeLine notice={notice} />}</div>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar perfil
          </button>
        </div>
      </form>
      </section>
    </>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between text-sm text-neutral-300">
        {label}
        {hint && <span className="font-normal text-neutral-500">{hint}</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-red-300">{error}</span>}
    </label>
  );
}

