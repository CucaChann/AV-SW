/**
 * Crash recovery: a copy of the open project (in .avsw format, drawings
 * included) kept in the app's IndexedDB. It is rewritten shortly after every
 * change, so reopening AV-SW after a crash, forced shutdown or reload restores
 * the last state, including unsaved changes. It never replaces the project
 * file; Save still writes the .avsw the user chose.
 */

export type RecoverySnapshot = {
  /** Serialized .avsw bytes. */
  file: Uint8Array;
  /** Where the project is saved on disk, if it has been saved. */
  path: string | null;
  dirty: boolean;
  savedAt: string;
};

const DB_NAME = "avsw";
const STORE = "recovery";
const KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadRecovery(): Promise<RecoverySnapshot | null> {
  try {
    const value = await withStore("readonly", (store) => store.get(KEY));
    return value && value.file instanceof Uint8Array ? (value as RecoverySnapshot) : null;
  } catch {
    return null;
  }
}

/** Returns whether the copy was written. */
export async function saveRecovery(snapshot: RecoverySnapshot): Promise<boolean> {
  try {
    await withStore("readwrite", (store) => store.put(snapshot, KEY));
    return true;
  } catch (error) {
    console.warn("AV-SW could not update its recovery copy", error);
    return false;
  }
}

/** Forget the recovery copy, e.g. after the user chose not to save changes. */
export async function clearRecovery() {
  try {
    await withStore("readwrite", (store) => store.delete(KEY));
  } catch (error) {
    console.warn("AV-SW could not clear its recovery copy", error);
  }
}
