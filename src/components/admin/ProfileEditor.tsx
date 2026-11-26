"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from "lucide-react";
import {
  addSocialLink,
  deleteSocialLink,
  toggleSocialLink,
  updateProfile,
  updateSocialLinksOrder,
} from "@/actions/admin";
import { NoticeLine, Switch } from "@/components/admin/MediaManager";
import { PLATFORM_LABELS, SocialIcon } from "@/components/public/BioCard";
import { cn } from "@/lib/utils";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/types";

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

type Link = { id: string; platform: string; label: string | null; url: string; iconName: string; isActive: boolean };
type Notice = { kind: "ok" | "error"; text: string } | null;

const inputClass =
  "w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-neutral-500 focus:ring-2";
const inputOk = "border-white/10 focus:border-amber-300/60 focus:ring-amber-300/20";
const inputErr = "border-red-400/60 focus:border-red-400 focus:ring-red-400/20";

export default function ProfileEditor({ profile, links: initialLinks }: { profile: ProfileFields; links: Link[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<Notice>(null);

  const [links, setLinks] = useState(initialLinks);
  const [linkNotice, setLinkNotice] = useState<Notice>(null);
  const [newLink, setNewLink] = useState<{ platform: SocialPlatform; label: string; url: string }>({
    platform: "x",
    label: "",
    url: "",
  });
  const [linkErrors, setLinkErrors] = useState<Record<string, string[]>>({});

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
      if (res.ok) router.refresh();
    });
  };

  const addLink = (e: FormEvent) => {
    e.preventDefault();
    setLinkNotice(null);
    startTransition(async () => {
      const res = await addSocialLink({ platform: newLink.platform, label: newLink.label, url: newLink.url });
      setLinkErrors(res.ok ? {} : (res.fieldErrors ?? {}));
      if (res.ok && res.data) {
        setLinks((l) => [...l, { ...res.data!, isActive: true }]);
        setNewLink((n) => ({ ...n, label: "", url: "" }));
        setLinkNotice({ kind: "ok", text: res.message ?? "Adicionado." });
        router.refresh();
      } else if (!res.ok) {
        setLinkNotice({ kind: "error", text: res.error });
      }
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= links.length) return;
    const previous = links;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
    startTransition(async () => {
      const res = await updateSocialLinksOrder(next.map((l) => l.id));
      if (!res.ok) {
        setLinks(previous);
        setLinkNotice({ kind: "error", text: res.error });
      } else router.refresh();
    });
  };

  const toggle = (link: Link) => {
    setLinks((l) => l.map((x) => (x.id === link.id ? { ...x, isActive: !x.isActive } : x)));
    startTransition(async () => {
      const res = await toggleSocialLink(link.id, !link.isActive);
      if (!res.ok) {
        setLinks((l) => l.map((x) => (x.id === link.id ? { ...x, isActive: link.isActive } : x)));
        setLinkNotice({ kind: "error", text: res.error });
      } else router.refresh();
    });
  };

  const remove = (link: Link) => {
    if (!window.confirm(`Remover o link ${link.label || PLATFORM_LABELS[link.platform] || link.url}?`)) return;
    startTransition(async () => {
      const res = await deleteSocialLink(link.id);
      if (res.ok) {
        setLinks((l) => l.filter((x) => x.id !== link.id));
        setLinkNotice({ kind: "ok", text: res.message ?? "Removido." });
        router.refresh();
      } else setLinkNotice({ kind: "error", text: res.error });
    });
  };

  const fieldError = (key: string) => errors[key]?.[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Identidade e presença */}
      <form onSubmit={saveProfile} className="glass space-y-4 rounded-2xl p-5" noValidate>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Identidade</h3>
          <span className="flex items-center gap-1 text-xs text-neutral-400">
            <Eye className="size-3.5" aria-hidden /> {form.viewsCount} visualizações
          </span>
        </div>

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
            rows={2}
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

        <div className="space-y-3 border-t border-white/10 pt-4">
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
          <div className="glass-soft space-y-3 rounded-xl p-3">
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
                  className={cn(inputClass, inputOk, "bg-neutral-900 disabled:cursor-not-allowed")}
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

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-h-5">{notice && <NoticeLine notice={notice} />}</div>
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar perfil
          </button>
        </div>
      </form>

      {/* Redes sociais */}
      <div className="glass space-y-4 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white">Redes sociais</h3>

        {links.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum link ainda.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link, i) => (
              <li
                key={link.id}
                className={cn("glass-soft flex items-center gap-3 rounded-xl px-3 py-2", !link.isActive && "opacity-50")}
              >
                <SocialIcon name={link.iconName} className="text-xl text-white/85" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{link.label || PLATFORM_LABELS[link.platform] || "Link"}</p>
                  <p className="truncate text-[11px] text-neutral-500">{link.url}</p>
                </div>
                <div className="flex shrink-0 items-center">
                  <IconButton label="Mover para cima" onClick={() => move(i, -1)} disabled={pending || i === 0}>
                    <ArrowUp className="size-3.5" />
                  </IconButton>
                  <IconButton label="Mover para baixo" onClick={() => move(i, 1)} disabled={pending || i === links.length - 1}>
                    <ArrowDown className="size-3.5" />
                  </IconButton>
                  <IconButton label={link.isActive ? "Ocultar" : "Exibir"} onClick={() => toggle(link)} disabled={pending}>
                    {link.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </IconButton>
                  <IconButton label="Remover" onClick={() => remove(link)} disabled={pending} danger>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addLink} className="space-y-2 border-t border-white/10 pt-4" noValidate>
          <p className="text-xs font-medium text-neutral-300">Adicionar rede</p>
          <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
            <select
              value={newLink.platform}
              onChange={(e) => setNewLink((n) => ({ ...n, platform: e.target.value as SocialPlatform }))}
              aria-label="Plataforma"
              className={cn(inputClass, inputOk, "bg-neutral-900")}
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
            <input
              value={newLink.label}
              onChange={(e) => setNewLink((n) => ({ ...n, label: e.target.value }))}
              maxLength={40}
              placeholder="Rótulo (opcional)"
              aria-label="Rótulo"
              className={cn(inputClass, linkErrors.label ? inputErr : inputOk)}
            />
          </div>
          <input
            value={newLink.url}
            onChange={(e) => setNewLink((n) => ({ ...n, url: e.target.value }))}
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-label="URL"
            aria-invalid={!!linkErrors.url}
            className={cn(inputClass, linkErrors.url ? inputErr : inputOk)}
          />
          {linkErrors.url && <p className="text-xs text-red-300">{linkErrors.url[0]}</p>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-h-5">{linkNotice && <NoticeLine notice={linkNotice} />}</div>
            <button
              type="submit"
              disabled={pending || !newLink.url}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-neutral-300">
        {label}
        {hint && <span className="font-normal text-neutral-500">{hint}</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-red-300">{error}</span>}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition disabled:opacity-30",
        danger ? "text-red-300 hover:bg-red-500/10" : "text-neutral-300 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
