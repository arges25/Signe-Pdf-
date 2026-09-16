import type { DocDraft } from "./doc-types";

// Same IndexedDB-with-localStorage-fallback shape as signature-store.ts,
// but keyed by draft id instead of a single record, since there can be
// several drafts. Autosave writes here on every debounced edit so a
// document survives a closed tab, a reloaded PWA, or Safari discarding
// the page in the background — nothing here ever leaves the device.

const DB_NAME = "signe-pdf";
// Kept in sync with signature-store.ts, which shares this database — both
// modules must request the same version and both create-if-missing every
// store, since whichever one happens to open the (possibly brand new)
// database first is the one that runs the upgrade.
const DB_VERSION = 2;
const STORE_NAME = "documents";
const LOCAL_STORAGE_INDEX_KEY = "signe:doc-drafts-index";
const LOCAL_STORAGE_PREFIX = "signe:doc-draft:";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("signatures")) request.result.createObjectStore("signatures");
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll(): Promise<DocDraft[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as DocDraft[] | undefined) ?? []);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function idbPut(draft: DocDraft): Promise<void> {
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

function localStorageGetAll(): DocDraft[] {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_INDEX_KEY) ?? "[]");
    return ids.map(id => {
      const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + id);
      return raw ? (JSON.parse(raw) as DocDraft) : null;
    }).filter((d): d is DocDraft => d !== null);
  } catch { return []; }
}

function localStoragePut(draft: DocDraft) {
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

export async function listDrafts(): Promise<DocDraft[]> {
  if (hasIndexedDb) {
    try { return await idbGetAll(); } catch { /* fall through */ }
  }
  return localStorageGetAll();
}

export async function saveDraft(draft: DocDraft): Promise<void> {
  if (hasIndexedDb) {
    try { await idbPut(draft); return; } catch { /* fall through */ }
  }
  localStoragePut(draft);
}

export async function deleteDraft(id: string): Promise<void> {
  if (hasIndexedDb) {
    try { await idbDelete(id); } catch { /* ignore */ }
  }
  localStorageDelete(id);
}
