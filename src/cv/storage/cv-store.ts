import type { CvDraft } from "../types/draft";

// Same IndexedDB-with-localStorage-fallback shape as doc-drafts-store.ts,
// keyed by CV id since a user can keep several CVs ("Mes CV"). Autosave
// writes here on every debounced edit; nothing here ever leaves the device.

const DB_NAME = "signe-pdf";
// Kept in sync with signature-store.ts and doc-drafts-store.ts, which
// share this database — see the comment there for why every module
// creates every store defensively.
const DB_VERSION = 3;
const STORE_NAME = "cvs";
const LOCAL_STORAGE_INDEX_KEY = "signe:cv-drafts-index";
const LOCAL_STORAGE_PREFIX = "signe:cv-draft:";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("signatures")) request.result.createObjectStore("signatures");
      if (!request.result.objectStoreNames.contains("documents")) request.result.createObjectStore("documents", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll(): Promise<CvDraft[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as CvDraft[] | undefined) ?? []);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function idbPut(draft: CvDraft): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

const hasIndexedDb = typeof indexedDB !== "undefined";

function localStorageGetAll(): CvDraft[] {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_INDEX_KEY) ?? "[]");
    return ids.map(id => {
      const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + id);
      return raw ? (JSON.parse(raw) as CvDraft) : null;
    }).filter((d): d is CvDraft => d !== null);
  } catch { return []; }
}

function localStoragePut(draft: CvDraft) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + draft.id, JSON.stringify(draft));
    const ids: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_INDEX_KEY) ?? "[]");
    if (!ids.includes(draft.id)) { ids.push(draft.id); localStorage.setItem(LOCAL_STORAGE_INDEX_KEY, JSON.stringify(ids)); }
  } catch { /* storage unavailable — the draft just won't persist */ }
}

function localStorageDelete(id: string) {
  try {
    localStorage.removeItem(LOCAL_STORAGE_PREFIX + id);
    const ids: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_INDEX_KEY) ?? "[]");
    localStorage.setItem(LOCAL_STORAGE_INDEX_KEY, JSON.stringify(ids.filter(i => i !== id)));
  } catch { /* ignore */ }
}

export async function listCvDrafts(): Promise<CvDraft[]> {
  if (hasIndexedDb) {
    try { return await idbGetAll(); } catch { /* fall through */ }
  }
  return localStorageGetAll();
}

export async function saveCvDraft(draft: CvDraft): Promise<void> {
  if (hasIndexedDb) {
    try { await idbPut(draft); return; } catch { /* fall through */ }
  }
  localStoragePut(draft);
}

export async function deleteCvDraft(id: string): Promise<void> {
  if (hasIndexedDb) {
    try { await idbDelete(id); } catch { /* ignore */ }
  }
  localStorageDelete(id);
}
