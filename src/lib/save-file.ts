// Shared "where should this end up" logic: File System Access API when the
// browser supports it (desktop Chrome/Edge — lets the user pick a folder
// and name), else the Web Share API when the browser can share files (the
// right fit for iOS/Android — surfaces the native "Save to Files" sheet),
// else a plain anchor download. Never promises a folder picker on a
// platform that doesn't actually offer one (e.g. iOS).

export const supportsFileSystemAccess = typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

export function supportsShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    const probe = new File([""], "test.pdf", { type: "application/pdf" });
    return navigator.canShare({ files: [probe] });
  } catch { return false; }
}

export const saveHint = supportsFileSystemAccess
  ? "Vous pourrez choisir l’emplacement et le nom du fichier."
  : supportsShareFiles()
    ? "Utilisez le menu Partager pour l’enregistrer dans Fichiers (iPhone/Android) ou l’envoyer ailleurs."
    : "Le fichier sera téléchargé par votre navigateur.";

// Requests a save location up front, before any slow work (signing,
// converting), so the picker still benefits from the user gesture that
// triggered the calling handler. Returns null if unsupported or if the
// request failed for a reason other than the user cancelling; throws only
// when the user explicitly cancelled (AbortError), so callers can stop
// cleanly instead of silently falling back to another method.
export async function requestSaveHandle(suggestedName: string, mimeType: string, extension: string): Promise<FileSystemFileHandle | null> {
  if (!supportsFileSystemAccess) return null;
  try {
    return await window.showSaveFilePicker!({
      suggestedName,
      types: [{ description: extension === "pdf" ? "Document PDF" : "Fichier", accept: { [mimeType]: [`.${extension}`] } }],
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return null;
  }
}

export type SaveOutcome = { method: "picker" | "share"; finalName: string } | { method: "download"; finalName: string; url: string } | { cancelled: true };

// Writes the blob via the given handle if one was obtained, else tries Web
// Share, else falls back to a classic download link. Doesn't manage any
// UI state (toasts, download banners) — the caller does that with the
// returned outcome.
export async function saveBlob(blob: Blob, suggestedName: string, handle: FileSystemFileHandle | null): Promise<SaveOutcome> {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { method: "picker", finalName: suggestedName };
  }

  const file = new File([blob], suggestedName, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: suggestedName });
      return { method: "share", finalName: suggestedName };
    } catch (e) {
      if ((e as Error).name === "AbortError") return { cancelled: true };
      // unexpected failure: fall through to a plain download below
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = suggestedName;
  document.body.appendChild(link); link.click(); link.remove();
  // The caller is responsible for revoking this URL when it's done with it
  // (e.g. after showing a fallback "open"/"download" link).
  return { method: "download", finalName: suggestedName, url };
}
