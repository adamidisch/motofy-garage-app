/**
 * lib/data/photo-store.mjs
 *
 * IndexedDB abstraction for vehicle and customer avatar photos.
 * Photos are stored as compressed data URLs (max 800×800, JPEG 0.82).
 * The repository only holds the id reference — no binary data in localStorage.
 *
 * Interface is deliberately thin so the implementation can be swapped for
 * Supabase Storage without touching any component:
 *   savePhoto(type, id, dataUrl)  → Promise<void>
 *   loadPhoto(type, id)           → Promise<string|null>
 *   deletePhoto(type, id)         → Promise<void>
 *
 * type: "vehicle" | "customer"
 * id:   the entity's id string from the repository
 */

const DB_NAME = "motofy-media";
const DB_VERSION = 1;
const STORE = "photos";
const MAX_DIM = 800;
const JPEG_QUALITY = 0.82;

/* ------------------------------------------------------------------ */
/* DB open                                                             */
/* ------------------------------------------------------------------ */

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE); // key = "vehicle:veh_xxx" or "customer:cus_xxx"
      }
    };
    req.onsuccess = (event) => { _db = event.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function key(type, id) {
  return `${type}:${id}`;
}

/* ------------------------------------------------------------------ */
/* Image compression                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resize and compress a data URL to at most MAX_DIM × MAX_DIM JPEG.
 * Returns the original if canvas is unavailable (SSR, tests).
 */
async function compress(dataUrl) {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Avoid a second lossy encode when pickPhoto() already produced a small JPEG.
      if (Math.max(img.width, img.height) <= MAX_DIM && dataUrl.startsWith("data:image/jpeg")) {
        resolve(dataUrl);
        return;
      }
      const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Save a photo for an entity.
 * The data URL is compressed before storage.
 *
 * @param {"vehicle"|"customer"} type
 * @param {string} id
 * @param {string} dataUrl
 */
export async function savePhoto(type, id, dataUrl) {
  if (!dataUrl || !id) return;
  const compressed = await compress(dataUrl);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(compressed, key(type, id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load a photo for an entity.
 *
 * @param {"vehicle"|"customer"} type
 * @param {string} id
 * @returns {Promise<string|null>}
 */
export async function loadPhoto(type, id) {
  if (!id) return null;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key(type, id));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Delete a photo.
 *
 * @param {"vehicle"|"customer"} type
 * @param {string} id
 */
export async function deletePhoto(type, id) {
  if (!id) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key(type, id));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* non-fatal */ }
}

/**
 * Load multiple photos in one pass.
 * Returns a Map<id, dataUrl|null>.
 *
 * @param {"vehicle"|"customer"} type
 * @param {string[]} ids
 * @returns {Promise<Map<string, string|null>>}
 */
export async function loadPhotos(type, ids) {
  const result = new Map();
  if (!ids.length) return result;
  try {
    const db = await openDb();
    await Promise.all(ids.map((id) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key(type, id));
        req.onsuccess = () => { result.set(id, req.result ?? null); resolve(); };
        req.onerror = () => { result.set(id, null); resolve(); };
      })
    ));
  } catch { ids.forEach((id) => result.set(id, null)); }
  return result;
}

/**
 * Open the device camera/gallery and resolve to a data URL.
 * Returns null if the user cancels.
 *
 * @param {"camera"|"gallery"|"any"} [source]
 * @returns {Promise<string|null>}
 */
export function pickPhoto(source = "any") {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (source === "camera") input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = async () => resolve(await compress(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    // If no file is chosen, resolve after a short grace period
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}
