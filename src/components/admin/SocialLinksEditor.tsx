"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { Eye, EyeOff, GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  addSocialLink,
  deleteSocialLink,
  toggleSocialLink,
  updateSocialLink,
  updateSocialLinksOrder,
} from "@/actions/admin";
import { NoticeLine } from "@/components/admin/MediaManager";
import { PICKER_PLATFORMS, PLATFORM_LABELS, SocialIcon, brandLogoSrc } from "@/components/icons/SocialIcons";
import { cn } from "@/lib/utils";
import { cardClass, inputBase, inputErr, inputOk, panelClass } from "./ui";
import { SectionHeading } from "./SectionHeading";

type ServerLink = { id: string; platform: string; label: string | null; url: string; iconName: string; isActive: boolean };

/** Item da lista: links salvos (id) e rascunhos criados pelo seletor (id null até receber uma URL válida). */
type Item = { key: string; id: string | null; platform: string; label: string; url: string; isActive: boolean };
type Notice = { kind: "ok" | "error"; text: string } | null;

const MAX_LINKS = 20;

const fromServer = (l: ServerLink): Item => ({
  key: l.id,
  id: l.id,
  platform: l.platform,
  label: l.label ?? "",
  url: l.url,
  isActive: l.isActive,
});

/** Aceita "youtube.com/@fulano" e completa com https://. */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  if (/^http:\/\//i.test(v)) return v.replace(/^http:/i, "https:");
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

const platformName = (p: string) => PLATFORM_LABELS[p] ?? "Link";
const savedIds = (list: Item[]) => list.flatMap((i) => (i.id ? [i.id] : []));

/** Logo colorida da rede (ou o ícone monocromático, se não houver arquivo). */
function BrandLogo({ platform, className }: { platform: string; className: string }) {
  const src = brandLogoSrc(platform);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático de /public
    <img src={src} alt="" className={cn("object-contain", className)} draggable={false} />
  ) : (
    <SocialIcon name={platform} className="text-lg text-white" />
  );
}

export default function SocialLinksEditor({ links: initialLinks }: { links: ServerLink[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<Item[]>(() => initialLinks.map(fromServer));
  const [notice, setNotice] = useState<Notice>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const draftSeq = useRef(0);
  // Lista atual para os handlers assíncronos (fim do arraste, salvamento).
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  // Ordem (ids) que o servidor conhece: só persiste um arraste quando ela muda.
  const savedOrder = useRef(initialLinks.map((l) => l.id).join(","));

  // Dados novos do servidor (router.refresh): links salvos seguem o servidor, rascunhos ficam onde estão.
  const [serverLinks, setServerLinks] = useState(initialLinks);
  if (initialLinks !== serverLinks) {
    setServerLinks(initialLinks);
    const byId = new Map(initialLinks.map((l) => [l.id, l]));
    const kept = items.flatMap((it) => {
      if (!it.id) return [it];
      const s = byId.get(it.id);
      byId.delete(it.id);
      return s ? [fromServer(s)] : [];
    });
    setItems([...kept, ...[...byId.values()].map(fromServer)]);
  }

  const patch = (key: string, data: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...data } : it)));

  const counts: Record<string, number> = {};
  for (const it of items) counts[it.platform] = (counts[it.platform] ?? 0) + 1;
  const visible = items.filter((i) => i.id && i.isActive).length;
  const full = items.length >= MAX_LINKS;

  /** Clicou num ícone do seletor: cria um retângulo novo, já com o campo de link em foco. */
  const addDraft = (platform: string) => {
    if (full) {
      setNotice({ kind: "error", text: `Limite de ${MAX_LINKS} redes atingido.` });
      return;
    }
    const key = `draft-${++draftSeq.current}`;
    setItems((list) => [...list, { key, id: null, platform, label: "", url: "", isActive: true }]);
    setFocusKey(key);
    setNotice(null);
  };

  /** Persiste a ordem atual dos links salvos (rascunhos não entram). */
  const persistOrder = (list: Item[]) => {
    const ids = savedIds(list);
    const joined = ids.join(",");
    if (ids.length === 0 || joined === savedOrder.current) return;
    const previous = savedOrder.current;
    savedOrder.current = joined;
    startTransition(async () => {
      const res = await updateSocialLinksOrder(ids);
      if (!res.ok) {
        savedOrder.current = previous;
        setNotice({ kind: "error", text: res.error });
      }
      router.refresh();
    });
  };

  /** Rascunho vira registro novo; link salvo só atualiza URL/rótulo. Retorna a mensagem de erro, se houver. */
  const save = async (item: Item, data: { url?: string; label?: string }): Promise<string | null> => {
    if (!item.id) {
      const res = await addSocialLink({ platform: item.platform, label: data.label ?? item.label, url: data.url ?? item.url });
      if (!res.ok) return res.fieldErrors?.url?.[0] ?? res.fieldErrors?.label?.[0] ?? res.error;
      const id = res.data!.id;
      const next = itemsRef.current.map((it) => (it.key === item.key ? { ...it, ...data, id, key: id } : it));
      itemsRef.current = next;
      setItems(next);
      setNotice({ kind: "ok", text: `${platformName(item.platform)} adicionado.` });
      // O servidor coloca o link novo no fim (e visível): ajusta a ordem e a visibilidade escolhidas antes de salvar.
      savedOrder.current = [...savedOrder.current.split(",").filter(Boolean), id].join(",");
      persistOrder(next);
      if (!item.isActive) await toggleSocialLink(id, false);
      router.refresh();
      return null;
    }
    const res = await updateSocialLink(item.id, data);
    if (!res.ok) return res.fieldErrors?.url?.[0] ?? res.fieldErrors?.label?.[0] ?? res.error;
    patch(item.key, data);
    router.refresh();
    return null;
  };

  const toggle = (item: Item) => {
    patch(item.key, { isActive: !item.isActive });
    if (!item.id) return;
    const id = item.id;
    startTransition(async () => {
      const res = await toggleSocialLink(id, !item.isActive);
      if (!res.ok) {
        patch(item.key, { isActive: item.isActive });
        setNotice({ kind: "error", text: res.error });
      } else router.refresh();
    });
  };

  const remove = (item: Item) => {
    if (!item.id) {
      setItems((list) => list.filter((i) => i.key !== item.key));
      return;
    }
    if (!window.confirm(`Remover ${item.label || platformName(item.platform)}?`)) return;
    const id = item.id;
    startTransition(async () => {
      const res = await deleteSocialLink(id);
      if (res.ok) {
        setItems((list) => list.filter((i) => i.key !== item.key));
        savedOrder.current = savedOrder.current.split(",").filter((x) => x && x !== id).join(",");
        setNotice({ kind: "ok", text: res.message ?? "Removido." });
        router.refresh();
      } else setNotice({ kind: "error", text: res.error });
    });
  };

  return (
    <section id="redes" aria-labelledby="redes-titulo" className={`${panelClass} p-5 sm:p-10`}>
      <SectionHeading
        eyebrow="03 · Redes"
        id="redes-titulo"
        title="Redes sociais"
        text="Escolha uma rede, cole o link e arraste para definir a ordem no seu card."
        aside={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-300">
            {visible} de {items.length} visíveis
          </span>
        }
      />

      {/* Bloco principal: todas as redes disponíveis */}
      <div className={cn(cardClass, "p-4 sm:p-5")}>
        <p className="mb-4 text-sm font-semibold text-white">Adicionar rede</p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] sm:gap-3">
          {PICKER_PLATFORMS.map((p) => {
            const name = platformName(p);
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => addDraft(p)}
                  disabled={full}
                  aria-label={`Adicionar ${name}`}
                  className="group relative flex aspect-square w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.08] focus-visible:border-white/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <BrandLogo platform={p} className="size-[46%]" />
                  {/* Nome da rede acima do quadrado ao passar o mouse / focar */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 rounded-lg border border-white/10 bg-neutral-950/95 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg shadow-black/50 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                  >
                    {name}
                  </span>
                  {counts[p] ? (
                    <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-300 text-[10px] font-bold text-neutral-950 tabular-nums">
                      {counts[p]}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bloco das redes adicionadas: um retângulo por rede, arrastável */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Suas redes</p>
          <div className="flex min-h-5 items-center gap-2">
            {pending && <Loader2 className="size-3.5 animate-spin text-neutral-400" aria-label="Salvando" />}
            {notice && <NoticeLine notice={notice} />}
          </div>
        </div>

        {items.length === 0 ? (
          <p className={`${cardClass} border-dashed px-4 py-10 text-center text-sm text-neutral-500`}>
            Nenhuma rede ainda. Clique em um ícone acima para adicionar.
          </p>
        ) : (
          <>
            <Reorder.Group axis="y" values={items} onReorder={setItems} as="ol" className="space-y-3">
              {items.map((item, i) => (
                <LinkRow
                  key={item.key}
                  item={item}
                  position={i + 1}
                  autoFocus={focusKey === item.key}
                  onSave={(data) => save(item, data)}
                  onLocalLabel={(label) => patch(item.key, { label })}
                  onToggle={() => toggle(item)}
                  onRemove={() => remove(item)}
                  onDragEnd={() => persistOrder(itemsRef.current)}
                />
              ))}
            </Reorder.Group>
            <p className="mt-3 text-[11px] text-neutral-500">
              Arraste pelo <GripVertical className="inline size-3 align-[-2px]" aria-hidden /> para mudar a posição no card.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function LinkRow({
  item,
  position,
  autoFocus,
  onSave,
  onLocalLabel,
  onToggle,
  onRemove,
  onDragEnd,
}: {
  item: Item;
  position: number;
  autoFocus: boolean;
  onSave: (data: { url?: string; label?: string }) => Promise<string | null>;
  onLocalLabel: (label: string) => void;
  onToggle: () => void;
  onRemove: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const [url, setUrl] = useState(item.url);
  const [label, setLabel] = useState(item.label);
  const [editingLabel, setEditingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // O valor mudou fora deste campo (outra aba, sanitização do servidor): adota se não houver edição pendente.
  const [base, setBase] = useState({ url: item.url, label: item.label });
  if (base.url !== item.url || base.label !== item.label) {
    if (url === base.url) setUrl(item.url);
    if (label === base.label) setLabel(item.label);
    setBase({ url: item.url, label: item.label });
  }

  const name = platformName(item.platform);
  const isDraft = !item.id;

  const commitUrl = async () => {
    const next = normalizeUrl(url);
    if (next !== url) setUrl(next);
    if (!next) return setError(isDraft ? null : "Informe o link.");
    if (!isDraft && next === item.url) return setError(null);
    setSaving(true);
    const err = await onSave({ url: next, label: label.trim() });
    setSaving(false);
    setError(err);
  };

  const commitLabel = async () => {
    setEditingLabel(false);
    const next = label.trim();
    if (next !== label) setLabel(next);
    if (next === item.label) return;
    if (isDraft) return onLocalLabel(next);
    const err = await onSave({ label: next });
    setError(err);
    if (err) setLabel(item.label);
  };

  /** Enter salva (via blur); Esc desfaz a edição. */
  const keys = (reset: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      reset();
      e.currentTarget.blur();
    }
  };

  return (
    <Reorder.Item
      value={item}
      as="li"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.015, boxShadow: "0 20px 40px -12px rgba(0,0,0,0.6)" }}
      className={cn(
        cardClass,
        "relative bg-neutral-950/60 p-3 transition-[border-color,opacity] hover:border-white/20 sm:p-4",
        !item.isActive && "opacity-60",
      )}
    >
      {/* Linha de cima: alça de arraste, rede, rótulo e ações */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label={`Arrastar ${name} (posição ${position})`}
          onPointerDown={(e) => controls.start(e)}
          className="-ml-1 flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/5 hover:text-neutral-200 active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05]">
          <BrandLogo platform={item.platform} className="size-[55%]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {item.label || name}
            <span className="ml-2 font-mono text-[10px] text-neutral-500 tabular-nums">#{position}</span>
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            {isDraft
              ? "Não salvo — cole o link abaixo"
              : item.isActive
                ? item.label
                  ? `${name} · visível`
                  : "Visível no perfil"
                : "Oculto no perfil"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <RowButton
            label={editingLabel ? "Fechar rótulo" : "Editar rótulo"}
            onClick={() => setEditingLabel((v) => !v)}
            active={editingLabel}
          >
            <Pencil className="size-3.5" />
          </RowButton>
          <RowButton label={item.isActive ? "Ocultar no perfil" : "Mostrar no perfil"} onClick={onToggle}>
            {item.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </RowButton>
          <RowButton label="Excluir" onClick={onRemove} danger>
            <Trash2 className="size-3.5" />
          </RowButton>
        </div>
      </div>

      {/* Rótulo (aberto pelo lápis) */}
      {editingLabel && (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={keys(() => setLabel(item.label))}
          maxLength={40}
          autoFocus
          placeholder={`Rótulo (ex.: ${name} pessoal)`}
          aria-label={`Rótulo de ${name}`}
          className={cn(inputBase, inputOk, "mt-3 py-2")}
        />
      )}

      {/* Campo do link */}
      <div className="relative mt-3">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onBlur={commitUrl}
          onKeyDown={keys(() => setUrl(item.url))}
          autoFocus={autoFocus}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={`Link do seu ${name} (https://…)`}
          aria-label={`Link de ${name}`}
          aria-invalid={!!error}
          className={cn(inputBase, error ? inputErr : inputOk, "pr-10")}
        />
        {saving && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-neutral-400" />}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-300">{error}</p>}
    </Reorder.Item>
  );
}

function RowButton({
  label,
  onClick,
  danger,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-full transition",
        danger ? "text-red-300 hover:bg-red-500/10" : "text-neutral-300 hover:bg-white/10 hover:text-white",
        active && "bg-white/10 text-white",
      )}
    >
      {children}
    </button>
  );
}
