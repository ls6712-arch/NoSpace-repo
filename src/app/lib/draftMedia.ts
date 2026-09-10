/**
 * The draft's attached photo/video — kept separately from draftStore.ts
 * because a File's actual bytes can't live in localStorage (string-only).
 * IndexedDB can store a real Blob/File, and survives a full browser close
 * the same way localStorage does, so this is what makes "the draft kept the
 * caption but lost the photo" not happen. Device-local only: there's no
 * cross-device sync for the media itself, only for the text fields
 * (draftRemote.ts) — recovering a draft on another device recovers the
 * words, not the picture.
 *
 * Every function here is best-effort: IndexedDB can be unavailable (some
 * private-browsing modes, storage quota, an old browser), and a failure
 * here should never break saving the rest of the draft.
 */
const DB_NAME = "nospace-drafts";
const DB_VERSION = 1;
const STORE_NAME = "media";
const DRAFT_KEY = "current";

interface StoredMedia {
  file: File;
  type: "photo" | "video";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraftMedia(file: File, type: "photo" | "video"): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ file, type } satisfies StoredMedia, DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best effort — the draft's text still saves fine without this
  }
}

export async function loadDraftMedia(): Promise<StoredMedia | null> {
  try {
    const db = await openDB();
    const result = await new Promise<StoredMedia | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as StoredMedia) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearDraftMedia(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // best effort
  }
}
