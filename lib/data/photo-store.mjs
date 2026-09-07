/* Small browser-only photo store. The app keeps only the photo key in its data
   model so moving to Supabase Storage later does not change the UI contract. */
const DB_NAME = "motofy-media";
const STORE = "vehicle-photos";

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveVehiclePhoto(vehicleId, dataUrl) {
  if (!vehicleId || !dataUrl) return;
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, vehicleId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadVehiclePhoto(vehicleId) {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(vehicleId);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}
