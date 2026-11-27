"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Save } from "lucide-react";
import { updateProfile } from "@/actions/admin";
import { NoticeLine, Switch } from "@/components/admin/MediaManager";
import { cn, formatNumber } from "@/lib/utils";
import { cardClass, inputBase, inputErr, inputOk, panelClass, primaryButton } from "./ui";
import { SectionHeading } from "./SectionHeading";

type ProfileFields = {
  displayName: string;
  bio: string;
  location: string;
  discordUserId: string;
  /** true = atividade manual (ignora o Discord); false = presença real do Discord via Lanyard. */
  manualMode: boolean;
  manualActivityType: "LISTENING" | "PLAYING";
  manualStatusText: string;
  viewsCount: number;
};

type Notice = { kind: "ok" | "error"; text: string } | null;

const inputClass = inputBase;

/** Compara os campos editáveis (o contador de views muda sozinho e não conta como edição). */
function sameFields(a: ProfileFields, b: ProfileFields): boolean {
  return (Object.keys(a) as (keyof ProfileFields)[]).every((k) => k === "viewsCount" || a[k] === b[k]);
}
const selectClass = "bg-neutral-950/80";

export default function ProfileEditor({ profile }: { profile: ProfileFields }) {
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
            className={cn(inputClass, fieldError("displayName") ? inputErr : inputOk)}
          />
        </Field>
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

