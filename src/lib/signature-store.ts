import type { SignatureAsset } from "./pdf-signing";

// Saves the user's signature locally so it survives page reloads and app
// restarts (including the installed PWA on iPhone/Android) without ever
// leaving the device. IndexedDB is preferred (more reliable for a small
// image blob, works in Safari/iOS PWAs); localStorage is the fallback for
// contexts where IndexedDB is unavailable or throws (e.g. some private
// browsing modes).

const DB_NAME = "signe-pdf";
const DB_VERSION = 1;
const STORE_NAME = "signatures";
const RECORD_KEY = "saved-signature";
const LOCAL_STORAGE_KEY = "signe:saved-signature";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(): Promise<SignatureAsset | null> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as SignatureAsset | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(asset: SignatureAsset): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(asset, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbDelete(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const hasIndexedDb = typeof indexedDB !== "undefined";

export async function loadSavedSignature(): Promise<SignatureAsset | null> {
  if (hasIndexedDb) {
    try {
      return await idbGet();
    } catch {
      // Fall through to localStorage.
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SignatureAsset) : null;
  } catch {
    return null;
  }
}

export async function saveSignature(asset: SignatureAsset): Promise<void> {
  if (hasIndexedDb) {
    try {
      await idbSet(asset);
      return;
    } catch {
      // Fall through to localStorage.
    }
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(asset));
  } catch {
    // Storage can fail (private browsing, quota). The signature still
    // works for the current session, it just won't persist.
  }
}

export async function clearSavedSignature(): Promise<void> {
  if (hasIndexedDb) {
    try {
      await idbDelete();
    } catch {
      // ignore
    }
  }
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}
