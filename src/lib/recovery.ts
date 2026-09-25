import { projectFromJson, projectToJson, type ProjectDocument, type ProjectLoad } from "./projectFile";

/**
 * Crash recovery: a copy of the open project kept in the app's IndexedDB. It is
 * rewritten shortly after every change, so reopening AV-SW after a crash,
 * forced shutdown or reload restores the last state, including unsaved changes.
 * It never replaces the project file; Save still writes the .avsw the user chose.
 *
 * Drawings are stored once per drawing id; later updates write only the small
 * project data, so large drawing sets do not stall the UI on every edit.
 */

export type RecoverySession = {
  project: ProjectDocument;
  /** Where the project is saved on disk, if it has been saved. */
  path: string | null;
  dirty: boolean;
};

export type RecoveredSession = ProjectLoad & { path: string | null; dirty: boolean };

type StoredSession = {
  project: ReturnType<typeof projectToJson>;
  path: string | null;
  dirty: boolean;
  savedAt: string;
};

const DB_NAME = "avsw";
const DB_VERSION = 2;
const SESSION_STORE = "session";
const DRAWING_STORE = "drawings";
const SESSION_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [SESSION_STORE, DRAWING_STORE]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
      // Version 1 kept the whole .avsw file in one "recovery" entry.
      if (db.objectStoreNames.contains("recovery")) db.deleteObjectStore("recovery");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    body(tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function read<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  let result: T | undefined;
  return transaction(db, [store], "readonly", (tx) => {
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => {
      result = request.result as T | undefined;
    };
  }).then(() => result);
}

function storedDrawingIds(db: IDBDatabase): Promise<Set<string>> {
  let keys: IDBValidKey[] = [];
  return transaction(db, [DRAWING_STORE], "readonly", (tx) => {
    const request = tx.objectStore(DRAWING_STORE).getAllKeys();
    request.onsuccess = () => {
      keys = request.result;
    };
  }).then(() => new Set(keys.map(String)));
}

async function withDatabase<T>(run: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await run(db);
  } finally {
    db.close();
  }
}

/** Returns whether the copy was written. */
export async function saveRecovery(session: RecoverySession): Promise<boolean> {
  try {
    await withDatabase(async (db) => {
      const stored = await storedDrawingIds(db);
      const current = new Set(session.project.drawings.map((drawing) => drawing.id));
      const record: StoredSession = {
        project: projectToJson(session.project),
        path: session.path,
        dirty: session.dirty,
        savedAt: new Date().toISOString(),
      };
      await transaction(db, [SESSION_STORE, DRAWING_STORE], "readwrite", (tx) => {
        tx.objectStore(SESSION_STORE).put(record, SESSION_KEY);
        const drawings = tx.objectStore(DRAWING_STORE);
        for (const drawing of session.project.drawings) {
          if (!stored.has(drawing.id)) drawings.put(drawing.bytes, drawing.id);
        }
        for (const id of stored) {
          if (!current.has(id)) drawings.delete(id);
        }
      });
    });
    return true;
  } catch (error) {
    console.warn("AV-SW could not update its recovery copy", error);
    return false;
  }
}

/** The recovered project, or null if there is none or it cannot be read. */
export async function loadRecovery(): Promise<RecoveredSession | null> {
  try {
    return await withDatabase(async (db) => {
      const stored = await read<StoredSession>(db, SESSION_STORE, SESSION_KEY);
      if (!stored) return null;

      const bytes = new Map<string, Uint8Array>();
      const entries: unknown[] = Array.isArray(stored.project?.drawings) ? stored.project.drawings : [];
      for (const entry of entries) {
        const id = (entry as { id?: unknown })?.id;
        if (typeof id !== "string") continue;
        const drawing = await read<Uint8Array>(db, DRAWING_STORE, id);
        if (drawing instanceof Uint8Array) bytes.set(id, drawing);
      }

      const loaded = projectFromJson(stored.project, (entry) => bytes.get(entry.id));
      return { ...loaded, path: stored.path ?? null, dirty: Boolean(stored.dirty) };
    });
  } catch (error) {
    console.warn("AV-SW could not read its recovery copy", error);
    return null;
  }
}

/** Forget the recovery copy, e.g. after the user chose not to save changes. */
export async function clearRecovery() {
  try {
    await withDatabase((db) =>
      transaction(db, [SESSION_STORE, DRAWING_STORE], "readwrite", (tx) => {
        tx.objectStore(SESSION_STORE).delete(SESSION_KEY);
        tx.objectStore(DRAWING_STORE).clear();
      }),
    );
  } catch (error) {
    console.warn("AV-SW could not clear its recovery copy", error);
  }
}
