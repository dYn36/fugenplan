const DATABASE = 'fugenplan-pdf-v1';
const STORE = 'documents';
const MAX_BYTES = 20 * 1024 * 1024;

function storageError(error: unknown): Error {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'QuotaExceededError') return new Error('Für die PDF-Datei ist nicht genügend Browserspeicher frei. Sichere dein Projekt als Datei.');
  return new Error('Die PDF-Datei konnte nicht im Browser gespeichert oder gelesen werden. Prüfe die Speicherberechtigung des Browsers.');
}

function validateId(id: string): void {
  if (typeof id !== 'string' || !id.length || id.length > 200) throw new Error('Die PDF-Kennung ist ungültig.');
}

/** Ask the browser to protect local project data from automatic storage eviction. */
export async function protectPdfStorage(): Promise<boolean> {
  try {
    const storage = globalThis.navigator?.storage;
    if (!storage) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist?.() ?? false;
  } catch {
    // Denial or a missing API does not prevent normal IndexedDB persistence across reloads.
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Dieser Browser stellt keinen lokalen PDF-Speicher bereit.')); return;
    }
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); } catch (error) { reject(storageError(error)); return; }
    let rejected = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onerror = () => { rejected = true; reject(storageError(request.error)); };
    request.onblocked = () => {
      rejected = true;
      reject(new Error('Der lokale PDF-Speicher wird von einem anderen Tab verwendet. Schließe andere Fugenplan-Tabs und versuche es erneut.'));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export async function putPdf(id: string, bytes: Uint8Array): Promise<void> {
  validateId(id);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) {
    throw new Error('Die PDF-Daten sind leer oder größer als 20 MiB.');
  }
  // Own the data before an asynchronous worker can transfer the caller's buffer.
  const owned = new Uint8Array(bytes).buffer;
  await protectPdfStorage();
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = db.transaction(STORE, 'readwrite', { durability: 'strict' });
        transaction.objectStore(STORE).put(owned, id);
      } catch (error) { reject(storageError(error)); return; }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(storageError(transaction.error));
      transaction.onabort = () => reject(storageError(transaction.error));
    });
  } finally { db.close(); }
  // A successful import must be backed by readable original bytes, not only the in-memory preview.
  const saved = await getPdf(id);
  const expected = new Uint8Array(owned);
  if (!saved || saved.byteLength !== expected.byteLength || saved.some((byte, index) => byte !== expected[index])) {
    throw new Error('Die PDF konnte nicht vollständig gespeichert werden. Öffne die Datei erneut.');
  }
}

export async function getPdf(id: string): Promise<Uint8Array | null> {
  validateId(id);
  const db = await openDatabase();
  try {
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      let transaction: IDBTransaction;
      let request: IDBRequest;
      let data: Uint8Array | null = null;
      try {
        transaction = db.transaction(STORE, 'readonly');
        request = transaction.objectStore(STORE).get(id);
      } catch (error) { reject(storageError(error)); return; }
      request.onsuccess = () => {
        const value: unknown = request.result;
        if (value === undefined) return;
        if (value instanceof ArrayBuffer) data = new Uint8Array(value);
        else if (value instanceof Uint8Array) data = new Uint8Array(value);
        else { reject(new Error('Die gespeicherten PDF-Daten sind beschädigt. Öffne die ursprüngliche PDF-Datei erneut.')); return; }
        if (!data.byteLength || data.byteLength > MAX_BYTES) {
          reject(new Error('Die gespeicherten PDF-Daten sind ungültig. Öffne die ursprüngliche PDF-Datei erneut.'));
        }
      };
      transaction.oncomplete = () => resolve(data);
      transaction.onerror = () => reject(storageError(transaction.error));
      transaction.onabort = () => reject(storageError(transaction.error));
    });
  } finally { db.close(); }
}
