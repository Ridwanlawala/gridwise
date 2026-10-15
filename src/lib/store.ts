/**
 * Tiny persistence layer: IndexedDB for the outage-report collection (can grow large),
 * localStorage for small settings. Falls back to localStorage when IndexedDB is unavailable.
 */
const DB_NAME = 'gridwise';
const STORE = 'reports';
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('area', 'area');
        s.createIndex('start', 'start');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const r = fn(store);
    t.oncomplete = () => resolve(r ? (r as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const LS_REPORTS = 'gridwise.reports';

export async function getAll<T>(): Promise<T[]> {
  const db = await openDb();
  if (!db) return JSON.parse(localStorage.getItem(LS_REPORTS) || '[]');
  return ((await tx<T[]>(db, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)) || []) as T[];
}

export async function putMany<T extends { id: string }>(items: T[]): Promise<void> {
  const db = await openDb();
  if (!db) {
    const all = await getAll<T>();
    const map = new Map(all.map((i) => [i.id, i]));
    items.forEach((i) => map.set(i.id, i));
    localStorage.setItem(LS_REPORTS, JSON.stringify([...map.values()]));
    return;
  }
  await tx(db, 'readwrite', (s) => {
    items.forEach((i) => s.put(i));
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return localStorage.removeItem(LS_REPORTS);
  await tx(db, 'readwrite', (s) => s.clear());
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`gridwise.${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  localStorage.setItem(`gridwise.${key}`, JSON.stringify(value));
}
