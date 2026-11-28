"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FolderPen,
  WandSparkles,
  ImageUp,
  Loader2,
  Music,
  Music2,
  Pencil,
  Save,
  Trash,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { addTrack, deleteTrack, removeMedia, removeTrackCover, updateProfile, updateTrack } from "@/actions/admin";
import { MAX_BYTES, MAX_CURSOR_PX, MB, acceptFor, categoryOfFileType, mimeOfFile } from "@/lib/media-rules";
import { cn, cursorStyle, formatTime } from "@/lib/utils";
import { inputClass, type Notice } from "./ui";
import { AppearanceEditors } from "./CardAppearance";
import { BackgroundEffect } from "@/components/public/BackgroundEffect";
import {
  BACKGROUND_EFFECTS,
  BACKGROUND_EFFECT_INFO,
  type BackgroundEffect as BackgroundEffectId,
} from "@/lib/background-effects";
import type { CardSurface, PresenceSurface } from "@/lib/card-surface";
import { MAX_TRACKS, type AdminTrack, type BackgroundKind, type UploadKind } from "@/types";

type Media = {
  backgroundType: BackgroundKind;
  backgroundUrl: string | null;
  backgroundEffect: BackgroundEffectId;
  avatarUrl: string | null;
  hasHaloEffect: boolean;
  customCursorUrl: string | null;
};

const BACKGROUND_HINT = "MP4/WebM até 15 MB · JPG/PNG/WebP/GIF até 5 MB";


// Limites e tipos vêm de @/lib/media-rules, o mesmo módulo que a rota /api/upload usa para validar.
function clientLimit(file: File): number {
  return MAX_BYTES[categoryOfFileType(mimeOfFile(file))];
}

/**
 * Navegadores ignoram em silêncio cursores maiores que 128×128 px: avisa antes de enviar.
 * Retorna a mensagem de erro, ou null se a imagem serve (ou não deu para medir — o servidor valida o tipo).
 */
async function cursorSizeError(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    return width > MAX_CURSOR_PX || height > MAX_CURSOR_PX
      ? `O cursor deve ter no máximo ${MAX_CURSOR_PX}×${MAX_CURSOR_PX} px (esta imagem tem ${width}×${height}); maiores que isso os navegadores ignoram.`
      : null;
  } catch {
    return null;
  }
}

/** Fluxo seguro: sign (servidor valida tipo/tamanho) -> PUT direto com progresso -> commit (servidor valida magic bytes). */
async function uploadFile(
  kind: UploadKind,
  file: File,
  onProgress: (pct: number) => void,
  trackId?: string,
): Promise<void> {
  const signRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", kind, contentType: mimeOfFile(file), size: file.size }),
  });
  const sign = (await signRes.json()) as { key?: string; url?: string; headers?: Record<string, string>; error?: string };
  if (!signRes.ok || !sign.key || !sign.url) throw new Error(sign.error ?? "Falha ao preparar upload.");

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sign.url!);
    for (const [k, v] of Object.entries(sign.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falha no envio do arquivo.")));
    xhr.onerror = () => reject(new Error("Falha de rede no envio."));
    xhr.send(file);
  });

  const commitRes = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "commit", kind, key: sign.key, trackId }),
  });
  if (!commitRes.ok) {
    const body = (await commitRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Arquivo rejeitado.");
  }
}

/**
 * Estado de upload por "slot": o tipo de mídia do perfil (ex.: "avatar") ou, para faixas,
 * "audio:<trackId>" / "audioCover:<trackId>" — assim cada música tem progresso e aviso próprios.
 */
function useUploader(onDone: () => void) {
  const [progress, setProgress] = useState<Record<string, number | undefined>>({});
  const [notice, setNotice] = useState<Record<string, Notice>>({});

  const upload = async (slot: string, kind: UploadKind, file: File, trackId?: string) => {
    setNotice((n) => ({ ...n, [slot]: null }));
    if (file.size > clientLimit(file)) {
      setNotice((n) => ({ ...n, [slot]: { kind: "error", text: `Arquivo excede ${clientLimit(file) / MB} MB.` } }));
      return;
    }
    if (kind === "cursor") {
      const sizeError = await cursorSizeError(file);
      if (sizeError) {
        setNotice((n) => ({ ...n, [slot]: { kind: "error", text: sizeError } }));
        return;
      }
    }
    setProgress((p) => ({ ...p, [slot]: 0 }));
    try {
      await uploadFile(kind, file, (pct) => setProgress((p) => ({ ...p, [slot]: pct })), trackId);
      setNotice((n) => ({ ...n, [slot]: { kind: "ok", text: "Enviado." } }));
      onDone();
    } catch (err) {
      setNotice((n) => ({ ...n, [slot]: { kind: "error", text: err instanceof Error ? err.message : "Erro no upload." } }));
    } finally {
      setProgress((p) => ({ ...p, [slot]: undefined }));
    }
  };

  return { progress, notice, setNotice, upload };
}

type Uploader = ReturnType<typeof useUploader>;
type ProfileMediaKind = "background" | "avatar" | "cursor";

/** Extensão do arquivo a partir da URL pública (ex.: ".MP4"), para o selo do tile. */
function extensionOf(url: string | null): string | null {
  if (!url) return null;
  const ext = url.split(/[?#]/)[0].split("/").pop()?.split(".").pop();
  return ext && ext.length <= 5 ? `.${ext.toUpperCase()}` : null;
}

export default function MediaManager({
  media,
  tracks,
  shuffleTracks,
  cardSurface,
  presenceSurface,
  storageEnabled,
}: {
  media: Media;
  tracks: AdminTrack[];
  shuffleTracks: boolean;
  cardSurface: CardSurface;
  presenceSurface: PresenceSurface;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const uploader = useUploader(() => router.refresh());
  const { progress, notice, setNotice, upload } = uploader;
  // Otimista: mostra o novo valor na hora e volta a seguir o servidor (props) quando a action termina —
  // inclusive se o valor mudar em outra aba e chegar por router.refresh().
  const [halo, setOptimisticHalo] = useOptimistic(media.hasHaloEffect);
  const [audioOpen, setAudioOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const effectBadge =
    media.backgroundEffect !== "none" ? BACKGROUND_EFFECT_INFO[media.backgroundEffect].label.toUpperCase() : null;

  const remove = (kind: ProfileMediaKind) =>
    startTransition(async () => {
      const res = await removeMedia(kind);
      setNotice((n) => ({ ...n, [kind]: res.ok ? { kind: "ok", text: "Removido." } : { kind: "error", text: res.error } }));
      if (res.ok) router.refresh();
    });

  const toggleHalo = (value: boolean) => {
    startTransition(async () => {
      setOptimisticHalo(value);
      const res = await updateProfile({ hasHaloEffect: value });
      if (!res.ok) setNotice((n) => ({ ...n, avatar: { kind: "error", text: res.error } }));
      else router.refresh();
    });
  };

  const tileProps = (kind: ProfileMediaKind, url: string | null) => ({
    kind,
    badge: extensionOf(url),
    progress: progress[kind],
    notice: notice[kind] ?? null,
    onFile: (f: File) => void upload(kind, kind, f),
    onRemove: url ? () => remove(kind) : undefined,
    disabled: !storageEnabled || pending,
  });

  const withFile = tracks.filter((t) => t.audioUrl).length;
  // Faixa sem arquivo (upload interrompido): não aparece na bio, então não conta como áudio.
  const pendingTracks = tracks.length - withFile;
  const audioBadge = [
    withFile > 0 && `${withFile} ${withFile === 1 ? "ÁUDIO" : "ÁUDIOS"}`,
    pendingTracks > 0 && `${pendingTracks} ${pendingTracks === 1 ? "PENDENTE" : "PENDENTES"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      {!storageEnabled && (
        <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          Armazenamento não configurado: defina as variáveis R2_* para habilitar uploads.
        </p>
      )}

      {/* Linha "Envio de mídias": no máximo 4 blocos por linha. */}
      <div className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1. Plano de fundo: o clique abre o pop-up (trocar, remover e efeitos de fundo) */}
        <MediaTile
          {...tileProps("background", media.backgroundUrl)}
          onRemove={undefined}
          onOpen={() => setBackgroundOpen(true)}
          badge={[extensionOf(media.backgroundUrl), effectBadge].filter(Boolean).join(" · ") || null}
          title="Plano de fundo"
          hint={BACKGROUND_HINT}
        >
          {media.backgroundUrl &&
            (media.backgroundType === "VIDEO" ? (
              <video src={media.backgroundUrl} muted loop autoPlay playsInline className="size-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
              <img src={media.backgroundUrl} alt="Plano de fundo atual" className="size-full object-cover" />
            ))}
        </MediaTile>

        {/* 2. Avatar */}
        <MediaTile
          {...tileProps("avatar", media.avatarUrl)}
          title="Avatar do perfil"
          hint="WebP/PNG/JPG/GIF até 5 MB"
          aside={
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-400">
              Auréola
              <Switch checked={halo} onChange={toggleHalo} disabled={pending} label="Auréola dourada" size="sm" />
            </label>
          }
        >
          {media.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
            <img src={media.avatarUrl} alt="Avatar atual" className="size-full object-cover" />
          )}
        </MediaTile>

        {/* 3. Áudio: o tile abre o gerenciador em pop-up */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex min-h-6 items-center">
            <h3 className="text-[15px] font-medium text-white">Áudio</h3>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAudioOpen(true)}
              aria-haspopup="dialog"
              className="flex aspect-[9/4] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] text-neutral-400 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-neutral-300"
            >
              <FolderPen className="size-7 text-white" aria-hidden />
              <span className="px-4 text-center text-xs">Clique para abrir o gerenciador de áudios</span>
            </button>
            {audioBadge && (
              <span className="pointer-events-none absolute top-2.5 right-2.5">
                <TileBadge>{audioBadge}</TileBadge>
              </span>
            )}
          </div>
        </div>

        {/* 4. Cursor */}
        <MediaTile
          {...tileProps("cursor", media.customCursorUrl)}
          title="Cursor personalizado"
          hint="PNG/GIF/WebP até 5 MB (ideal 32×32)"
          cursorUrl={media.customCursorUrl}
        >
          {media.customCursorUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
            <img src={media.customCursorUrl} alt="Cursor atual" className="size-full object-cover" />
          )}
        </MediaTile>
      </div>

      {/* Aparência dos blocos do card público e, à parte, da caixa do Discord */}
      <AppearanceEditors
        card={cardSurface}
        presence={presenceSurface}
        background={{ type: media.backgroundType, url: media.backgroundUrl }}
      />

      <BackgroundDialog
        open={backgroundOpen}
        onClose={() => setBackgroundOpen(false)}
        media={media}
        progress={progress.background}
        notice={notice.background ?? null}
        disabled={!storageEnabled || pending}
        onFile={(f) => void upload("background", "background", f)}
        onRemove={() => remove("background")}
      />

      <AudioManagerDialog
        open={audioOpen}
        onClose={() => setAudioOpen(false)}
        tracks={tracks}
        shuffleTracks={shuffleTracks}
        storageEnabled={storageEnabled}
        uploader={uploader}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tile de mídia (plano de fundo, avatar, cursor)
// ---------------------------------------------------------------------------

function MediaTile({
  kind,
  title,
  hint,
  badge,
  progress,
  notice,
  disabled,
  onFile,
  onRemove,
  onOpen,
  aside,
  cursorUrl,
  children,
}: {
  kind: UploadKind;
  title: string;
  hint: string;
  badge: string | null;
  progress: number | undefined;
  notice: Notice;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
  /** Com isto, o clique no tile abre um pop-up (que cuida de enviar/trocar/remover) em vez do seletor de arquivo. */
  onOpen?: () => void;
  aside?: ReactNode;
  cursorUrl?: string | null;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== undefined;
  const hasMedia = Boolean(children);

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="truncate text-[15px] font-medium text-white">{title}</h3>
        {aside}
      </div>

      <div
        className="group relative aspect-[9/4] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/25"
        style={cursorUrl ? { cursor: cursorStyle(cursorUrl) } : undefined}
      >
        <FileTriggerInput inputRef={inputRef} kind={kind} label={`Arquivo para ${title}`} onFile={onFile} />

        {/* Área clicável inteira: envia ou troca o arquivo */}
        <button
          type="button"
          onClick={() => (onOpen ? onOpen() : inputRef.current?.click())}
          disabled={(!onOpen && disabled) || uploading}
          aria-haspopup={onOpen ? "dialog" : undefined}
          title={onOpen ? `Gerenciar ${title.toLowerCase()} · ${hint}` : `${hasMedia ? "Trocar" : "Enviar"} ${title.toLowerCase()} · ${hint}`}
          aria-label={onOpen ? `Gerenciar ${title.toLowerCase()}` : `${hasMedia ? "Trocar" : "Enviar"} ${title.toLowerCase()}`}
          className="absolute inset-0 size-full disabled:cursor-not-allowed"
          style={cursorUrl ? { cursor: "inherit" } : undefined}
        >
          {hasMedia ? (
            <span className="block size-full">{children}</span>
          ) : (
            <span className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center text-neutral-500 transition group-hover:text-neutral-300">
              <ImageUp className="size-6" aria-hidden />
              <span className="text-xs">Clique para enviar</span>
              <span className="text-[10px] text-neutral-600">{hint}</span>
            </span>
          )}
          {hasMedia && !uploading && (
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/55 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
              {onOpen ? <WandSparkles className="size-4" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {onOpen ? "Trocar, remover e efeitos" : "Trocar arquivo"}
            </span>
          )}
        </button>

        {(badge || onRemove) && !uploading && (
          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            {badge && <TileBadge>{badge}</TileBadge>}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remover ${title.toLowerCase()}`}
                className="flex size-7 items-center justify-center rounded-full bg-neutral-950/80 text-red-400 backdrop-blur-sm transition hover:bg-neutral-900 hover:text-red-300 disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )}

        {uploading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Enviando ${title}`}
          >
            <span className="text-xs tabular-nums text-white">Enviando… {progress}%</span>
            <UploadProgressBar value={progress} className="h-1 w-2/3 bg-white/15" />
          </div>
        )}
      </div>

      {notice && <NoticeLine notice={notice} />}
    </div>
  );
}

function TileBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-950/80 px-2.5 py-1 text-[11px] font-medium text-neutral-200 backdrop-blur-sm">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Plano de fundo (pop-up): prévia, trocar, remover e efeitos de fundo
// ---------------------------------------------------------------------------

function BackgroundDialog({
  open,
  onClose,
  media,
  progress,
  notice,
  disabled,
  onFile,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  media: Media;
  progress: number | undefined;
  notice: Notice;
  disabled: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [saving, startTransition] = useTransition();
  // Otimista: o efeito escolhido aparece na hora; volta a seguir o servidor quando a action termina.
  const [effect, setOptimisticEffect] = useOptimistic(media.backgroundEffect);
  const [effectNotice, setEffectNotice] = useState<Notice>(null);
  const uploading = progress !== undefined;
  const hasMedia = Boolean(media.backgroundUrl);

  // <dialog> nativo: foco preso, Esc fecha e o fundo fica inerte. A animação de entrada está no CSS.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const chooseEffect = (value: BackgroundEffectId) => {
    if (value === effect) return;
    setEffectNotice(null);
    startTransition(async () => {
      setOptimisticEffect(value);
      const res = await updateProfile({ backgroundEffect: value });
      if (!res.ok) setEffectNotice({ kind: "error", text: res.error });
      else router.refresh();
    });
  };

  const requestClose = () => {
    if (!uploading) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => uploading && e.preventDefault()}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      aria-labelledby="background-dialog-title"
      className="m-auto max-h-[88dvh] w-[min(92vw,36rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/90 p-0 text-neutral-100 shadow-2xl shadow-black/60 backdrop-blur-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:animate-[dialog-in_260ms_cubic-bezier(0.22,1,0.36,1)] open:backdrop:animate-[backdrop-in_260ms_ease-out]"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-center justify-between gap-3 px-6 pt-6">
          <h2 id="background-dialog-title" className="font-heading text-xl font-semibold text-white">
            Plano de fundo
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={uploading}
            title={uploading ? "Aguarde o envio terminar" : undefined}
            aria-label="Fechar"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 pt-4 pb-6">
          {/* Prévia: o fundo atual com o efeito escolhido por cima */}
          <div className="relative aspect-video shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
            {hasMedia ? (
              media.backgroundType === "VIDEO" ? (
                <video src={media.backgroundUrl!} muted loop autoPlay playsInline className="absolute inset-0 size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
                <img src={media.backgroundUrl!} alt="Plano de fundo atual" className="absolute inset-0 size-full object-cover" />
              )
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500">
                <ImageUp className="size-6" aria-hidden />
                <span className="text-xs">Nenhum plano de fundo enviado</span>
              </span>
            )}
            <div className="absolute inset-0 bg-black/30" />
            <BackgroundEffect effect={effect} />
            {uploading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Enviando plano de fundo"
              >
                <span className="text-xs tabular-nums text-white">Enviando… {progress}%</span>
                <UploadProgressBar value={progress} className="h-1 w-2/3 bg-white/15" />
              </div>
            )}
          </div>

          {/* Trocar / remover */}
          <FileTriggerInput inputRef={inputRef} kind="background" label="Arquivo para o plano de fundo" onFile={onFile} />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="size-4" aria-hidden />
              {hasMedia ? "Trocar" : "Enviar"}
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={!hasMedia || disabled || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/15 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash className="size-4" aria-hidden />
              Remover
            </button>
          </div>
          <p className="-mt-1 text-center text-[11px] text-neutral-500">{BACKGROUND_HINT}</p>
          {notice && <NoticeLine notice={notice} />}

          {/* Efeitos de fundo: menu que abre/fecha abaixo do botão */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setEffectsOpen((o) => !o)}
              aria-expanded={effectsOpen}
              aria-controls="background-effects-menu"
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-white/[0.04]"
            >
              <WandSparkles className="size-4 shrink-0 text-amber-300" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-medium text-white">Efeitos de fundo</span>
                <span className="block text-xs text-neutral-400">{BACKGROUND_EFFECT_INFO[effect].label}</span>
              </span>
              {saving && <Loader2 className="size-4 animate-spin text-neutral-400" aria-label="Salvando" />}
              <ChevronDown
                className={cn("size-4 text-neutral-400 transition duration-300", effectsOpen && "rotate-180")}
                aria-hidden
              />
            </button>

            <div
              id="background-effects-menu"
              role="radiogroup"
              aria-label="Efeitos de fundo"
              inert={!effectsOpen}
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                effectsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <ul className="grid grid-cols-1 gap-2 border-t border-white/10 p-2 sm:grid-cols-2">
                  {BACKGROUND_EFFECTS.map((id) => {
                    const info = BACKGROUND_EFFECT_INFO[id];
                    const selected = id === effect;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => chooseEffect(id)}
                          className={cn(
                            "flex h-full w-full items-center gap-3 rounded-xl border p-2 text-left transition",
                            selected ? "border-amber-300/40 bg-amber-300/10" : "border-transparent hover:bg-white/[0.06]",
                          )}
                        >
                          {/* Miniatura com o próprio efeito rodando */}
                          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-neutral-600 via-neutral-800 to-neutral-950">
                            {/* Meia escala: na miniatura de 40px os flocos/gotas ficam visíveis */}
                            <BackgroundEffect effect={id} className="h-[200%] w-[200%] origin-top-left scale-50" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-white">{info.label}</span>
                            <span className="line-clamp-2 block text-[11px] leading-snug text-neutral-400">{info.description}</span>
                          </span>
                          {selected && <Check className="size-4 shrink-0 text-amber-300" aria-hidden />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
          {effectNotice && <NoticeLine notice={effectNotice} />}
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Gerenciador de áudio (pop-up)
// ---------------------------------------------------------------------------

function AudioManagerDialog({
  open,
  onClose,
  tracks,
  shuffleTracks,
  storageEnabled,
  uploader,
}: {
  open: boolean;
  onClose: () => void;
  tracks: AdminTrack[];
  shuffleTracks: boolean;
  storageEnabled: boolean;
  uploader: Uploader;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [shuffle, setOptimisticShuffle] = useOptimistic(shuffleTracks);
  const [adding, setAdding] = useState<number | undefined>(undefined);
  const uploadingNew = adding !== undefined;

  // Fechar a aba no meio do envio deixaria uma faixa sem arquivo: o navegador pede confirmação.
  useEffect(() => {
    if (!uploadingNew) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploadingNew]);

  /** Durante o envio de um novo áudio o pop-up não fecha (Esc, clique fora ou botão X). */
  const requestClose = () => {
    if (!uploadingNew) onClose();
  };

  // <dialog> nativo: foco preso, Esc fecha e o fundo fica inerte.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const selected = tracks.find((t) => t.id === selectedId) ?? tracks.find((t) => t.audioUrl) ?? null;
  const full = tracks.length >= MAX_TRACKS;

  const toggleShuffle = (value: boolean) => {
    startTransition(async () => {
      setOptimisticShuffle(value);
      const res = await updateProfile({ shuffleTracks: value });
      if (!res.ok) setNotice({ kind: "error", text: res.error });
      else router.refresh();
    });
  };

  /** Adicionar áudio = escolher o arquivo; a faixa é criada, recebe o upload e ganha o nome do arquivo como título. */
  const addFromFile = async (file: File) => {
    setNotice(null);
    if (file.size > clientLimit(file)) {
      setNotice({ kind: "error", text: `Arquivo excede ${clientLimit(file) / MB} MB.` });
      return;
    }
    setAdding(0);
    const created = await addTrack();
    if (!created.ok || !created.data) {
      setAdding(undefined);
      setNotice({ kind: "error", text: created.ok ? "Falha ao criar a faixa." : created.error });
      return;
    }
    const id = created.data.id;
    try {
      await uploadFile("audio", file, setAdding, id);
      setSelectedId(id);
      const named = await updateTrack(id, { title: file.name.replace(/\.[^.]+$/, "").slice(0, 60), artist: "" });
      setNotice(
        named.ok
          ? { kind: "ok", text: "Áudio adicionado." }
          : { kind: "error", text: `Áudio enviado, mas o nome não foi salvo: ${named.error} Edite-o pelo lápis.` },
      );
    } catch (err) {
      await deleteTrack(id); // não deixa faixa vazia para trás
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Erro no upload." });
    } finally {
      setAdding(undefined);
      router.refresh();
    }
  };

  const removeTrack = (track: AdminTrack, index: number) => {
    if (!window.confirm(`Remover "${track.title || `Áudio ${index + 1}`}" da lista?`)) return;
    startTransition(async () => {
      const res = await deleteTrack(track.id);
      if (res.ok) {
        if (editingId === track.id) setEditingId(null);
        if (selectedId === track.id) setSelectedId(null);
        router.refresh();
      } else setNotice({ kind: "error", text: res.error });
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={(e) => uploadingNew && e.preventDefault()}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
      aria-labelledby="audio-manager-title"
      className="m-auto max-h-[88dvh] w-[min(92vw,34rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/90 p-0 text-neutral-100 shadow-2xl shadow-black/60 backdrop-blur-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[88dvh] flex-col">
        <header className="flex items-center justify-between gap-3 px-6 pt-6">
          <h2 id="audio-manager-title" className="font-heading text-xl font-semibold text-white">
            Gerenciador de áudio
          </h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={uploadingNew}
            title={uploadingNew ? "Aguarde o envio terminar" : undefined}
            aria-label="Fechar gerenciador de áudio"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 pt-3 pb-6">
          <p className="text-sm text-neutral-300">Para ouvir um áudio, selecione-o clicando.</p>

          {/* Prévia do áudio selecionado */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            {selected?.audioUrl ? (
              <div className="space-y-2">
                <p className="truncate text-xs text-neutral-400">
                  Tocando: <span className="text-neutral-200">{selected.title || "Sem título"}</span>
                </p>
                <audio key={selected.id} src={selected.audioUrl} controls preload="metadata" className="h-9 w-full" />
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-neutral-500">Nenhum áudio para ouvir ainda.</p>
            )}
          </div>

          <section className="space-y-2.5">
            <h3 className="text-sm font-medium text-neutral-200">
              Áudios ({tracks.length}/{MAX_TRACKS})
            </h3>

            {tracks.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 py-6 text-center text-xs text-neutral-500">
                Nenhum áudio ainda. Use “Adicionar áudio” abaixo.
              </p>
            )}

            <ul className="space-y-2.5">
              {tracks.map((t, i) => (
                <TrackItem
                  key={t.id}
                  track={t}
                  index={i}
                  selected={t.id === selected?.id}
                  editing={t.id === editingId}
                  disabled={pending}
                  storageEnabled={storageEnabled}
                  uploader={uploader}
                  onSelect={() => setSelectedId(t.id)}
                  onEdit={() => setEditingId(editingId === t.id ? null : t.id)}
                  onDelete={() => removeTrack(t, i)}
                />
              ))}
            </ul>
          </section>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-white">Embaralhar áudios</span>
              <span className="block text-xs text-neutral-400">
                Reproduz um áudio aleatório da sua lista sempre que alguém visitar sua página
              </span>
            </span>
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => toggleShuffle(e.target.checked)}
              disabled={pending}
              className="size-5 shrink-0 cursor-pointer accent-amber-400 disabled:opacity-50"
            />
          </label>

          <FileTriggerInput
            inputRef={addInputRef}
            kind="audio"
            label="Arquivo do novo áudio"
            onFile={(file) => void addFromFile(file)}
          />
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            disabled={!storageEnabled || full || uploadingNew || pending}
            className="relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[#ecebe6] py-3 text-sm font-medium text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingNew && (
              <span
                className="absolute inset-y-0 left-0 bg-amber-300/40 transition-[width]"
                style={{ width: `${adding}%` }}
                aria-hidden
              />
            )}
            <span className="relative flex items-center gap-2">
              {uploadingNew ? <Loader2 className="size-4 animate-spin" /> : <Music className="size-4" />}
              {uploadingNew ? `Enviando… ${adding}%` : full ? `Limite de ${MAX_TRACKS} áudios` : "Adicionar áudio"}
            </span>
          </button>
          <p className="-mt-2 text-center text-[11px] text-neutral-500">MP3/OGG até 10 MB por áudio</p>

          {notice && <NoticeLine notice={notice} />}
        </div>
      </div>
    </dialog>
  );
}

/** Duração lida dos metadados do arquivo (não fica salva no banco). */
function useAudioDuration(url: string | null): string | null {
  const [duration, setDuration] = useState<{ url: string; value: string } | null>(null);
  useEffect(() => {
    if (!url) return;
    const audio = new Audio();
    audio.preload = "metadata";
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration({ url, value: formatTime(audio.duration) });
    };
    audio.addEventListener("loadedmetadata", onMeta);
    audio.src = url;
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeAttribute("src");
      audio.load();
    };
  }, [url]);
  return duration && duration.url === url ? duration.value : null;
}

function TrackItem({
  track,
  index,
  selected,
  editing,
  disabled,
  storageEnabled,
  uploader,
  onSelect,
  onEdit,
  onDelete,
}: {
  track: AdminTrack;
  index: number;
  selected: boolean;
  editing: boolean;
  disabled: boolean;
  storageEnabled: boolean;
  uploader: Uploader;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const duration = useAudioDuration(track.audioUrl);
  const subtitle = [track.artist, duration].filter(Boolean).join(" · ");

  return (
    <li
      className={cn(
        "rounded-2xl border bg-white/[0.03] transition",
        selected ? "border-amber-300/40 ring-1 ring-amber-300/25" : "border-white/10",
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={onSelect}
          disabled={!track.audioUrl}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-4 text-left disabled:cursor-default"
        >
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.06]">
            {track.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- capa enviada pelo usuário
              <img src={track.coverUrl} alt="" className="size-full object-cover" />
            ) : (
              <Music2 className="size-5 text-neutral-500" aria-hidden />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-white">{track.title || "Sem título"}</span>
            <span className="block truncate text-xs text-neutral-400">
              {track.audioUrl ? subtitle || "—" : <span className="text-red-300">Sem arquivo · não aparece na bio</span>}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5 self-start">
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={editing}
            aria-label={`Editar áudio ${index + 1}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition",
              editing ? "bg-white/15 text-white" : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white",
            )}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label={`Remover áudio ${index + 1}`}
            className="flex size-8 items-center justify-center rounded-full bg-white/5 text-red-400 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="border-t border-white/10 p-3">
          <TrackEditor track={track} index={index} storageEnabled={storageEnabled} uploader={uploader} />
        </div>
      )}
    </li>
  );
}

function TrackEditor({
  track,
  index,
  storageEnabled,
  uploader,
}: {
  track: AdminTrack;
  index: number;
  storageEnabled: boolean;
  uploader: Uploader;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [notice, setNotice] = useState<Notice>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const audioSlot = `audio:${track.id}`;
  const coverSlot = `audioCover:${track.id}`;
  const audioProgress = uploader.progress[audioSlot];
  const uploading = audioProgress !== undefined;
  // Sem storage não dá para ENVIAR arquivos, mas remover a capa e editar textos continuam funcionando.
  const uploadDisabled = pending || !storageEnabled;
  const dirty = title !== track.title || artist !== track.artist;

  const save = () =>
    startTransition(async () => {
      const res = await updateTrack(track.id, { title, artist });
      setNotice(
        res.ok
          ? { kind: "ok", text: res.message ?? "Salvo." }
          : { kind: "error", text: res.fieldErrors ? Object.values(res.fieldErrors).flat()[0] : res.error },
      );
      if (res.ok) router.refresh();
    });

  const removeCover = () =>
    startTransition(async () => {
      const res = await removeTrackCover(track.id);
      setNotice(res.ok ? { kind: "ok", text: res.message ?? "Removido." } : { kind: "error", text: res.error });
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CoverPicker
          url={track.coverUrl}
          progress={uploader.progress[coverSlot]}
          uploadDisabled={uploadDisabled}
          removeDisabled={pending}
          onFile={(f) => void uploader.upload(coverSlot, "audioCover", f, track.id)}
          onRemove={track.coverUrl ? removeCover : undefined}
        />
        <div className="grid min-w-0 flex-1 gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="Nome do áudio"
            aria-label={`Nome do áudio ${index + 1}`}
            className={inputClass}
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={60}
            placeholder="Banda / artista"
            aria-label={`Banda ou artista do áudio ${index + 1}`}
            className={inputClass}
          />
        </div>
      </div>

      {uploading && (
        <UploadProgressBar value={audioProgress} label={`Enviando áudio ${index + 1}`} className="h-1.5 bg-white/10" />
      )}

      <div className="flex items-center gap-2">
        <FileTriggerInput
          inputRef={fileRef}
          kind="audio"
          label={`Arquivo do áudio ${index + 1}`}
          onFile={(file) => void uploader.upload(audioSlot, "audio", file, track.id)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadDisabled || uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {uploading ? `Enviando… ${audioProgress}%` : track.audioUrl ? "Trocar arquivo" : "Enviar arquivo"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ecebe6] py-2.5 text-xs font-semibold text-neutral-950 transition hover:bg-white disabled:opacity-50"
        >
          <Save className="size-3.5" />
          {dirty ? "Salvar" : "Salvo"}
        </button>
      </div>

      {uploader.notice[audioSlot] && <NoticeLine notice={uploader.notice[audioSlot]} />}
      {uploader.notice[coverSlot] && <NoticeLine notice={uploader.notice[coverSlot]} />}
      {notice && <NoticeLine notice={notice} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peças internas
// ---------------------------------------------------------------------------

function CoverPicker({
  url,
  progress,
  uploadDisabled,
  removeDisabled,
  onFile,
  onRemove,
}: {
  url: string | null;
  progress: number | undefined;
  uploadDisabled: boolean;
  removeDisabled: boolean;
  onFile: (file: File) => void;
  onRemove?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploadDisabled || progress !== undefined}
        aria-label="Enviar capa do áudio"
        title="Capa do áudio"
        className="group flex size-[76px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/[0.04] text-neutral-500 transition hover:border-amber-300/50 disabled:opacity-60"
      >
        {progress !== undefined ? (
          <span className="text-xs tabular-nums text-amber-200">{progress}%</span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview de mídia do usuário
          <img src={url} alt="Capa atual" className="size-full object-cover" />
        ) : (
          <span className="text-[10px]">Capa</span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled || progress !== undefined}
          aria-label="Remover capa"
          className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-red-300 ring-1 ring-white/15 hover:text-red-200 disabled:opacity-50"
        >
          <Trash2 className="size-3" />
        </button>
      )}
      <FileTriggerInput inputRef={ref} kind="audioCover" label="Arquivo da capa" onFile={onFile} />
    </div>
  );
}

/** <input type="file"> oculto, aberto por outro botão; limpa o valor para permitir reenviar o mesmo arquivo. */
function FileTriggerInput({
  inputRef,
  kind,
  label,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  kind: UploadKind;
  label: string;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept={acceptFor(kind)}
      className="hidden"
      aria-label={label}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = "";
      }}
    />
  );
}

/** Barra de progresso do envio. Com `label`, é ela mesma a região de progresso acessível. */
function UploadProgressBar({ value, label, className }: { value: number | undefined; label?: string; className?: string }) {
  const a11y = label
    ? { role: "progressbar" as const, "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label }
    : { "aria-hidden": true };
  return (
    <div className={cn("overflow-hidden rounded-full", className)} {...a11y}>
      <div className="h-full rounded-full bg-amber-300 transition-[width]" style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition disabled:opacity-50",
        sm ? "h-5 w-9" : "h-6 w-11",
        checked ? "bg-amber-400" : "bg-white/15",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow transition",
          sm ? "size-4" : "size-5",
          checked ? (sm ? "translate-x-4.5" : "translate-x-5.5") : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function NoticeLine({ notice }: { notice: NonNullable<Notice> }) {
  return (
    <p
      role={notice.kind === "error" ? "alert" : "status"}
      className={cn("flex items-center gap-1.5 text-xs", notice.kind === "ok" ? "text-emerald-300" : "text-red-300")}
    >
      {notice.kind === "ok" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {notice.text}
    </p>
  );
}
