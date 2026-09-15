import { access, readFile, stat } from "node:fs/promises";

const serviceWorkerPath = new URL("../dist/client/sw.js", import.meta.url);
const manifestPath = new URL("../public/manifest.webmanifest", import.meta.url);

async function requireFile(url, label) {
  try {
    await access(url);
    const info = await stat(url);
    if (!info.isFile() || info.size === 0) {
      throw new Error(`${label} is empty or is not a file`);
    }
  } catch (error) {
    throw new Error(`${label} is missing: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await requireFile(serviceWorkerPath, "Serwist service worker");
await requireFile(manifestPath, "PWA manifest");

const serviceWorker = await readFile(serviceWorkerPath, "utf8");
if (serviceWorker.includes("self.__SW_MANIFEST")) {
  throw new Error("Serwist precache manifest was not injected into dist/client/sw.js");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.display !== "standalone") {
  throw new Error(`Expected manifest display=standalone, received ${String(manifest.display)}`);
}

const iconSizes = new Set(
  Array.isArray(manifest.icons) ? manifest.icons.map((icon) => icon?.sizes) : [],
);
for (const required of ["192x192", "512x512"]) {
  if (!iconSizes.has(required)) {
    throw new Error(`PWA manifest is missing a ${required} icon`);
  }
}

console.log("PWA verification passed: manifest and injected Serwist service worker are present.");
