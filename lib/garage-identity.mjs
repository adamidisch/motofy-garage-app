/**
 * Build a stable opaque garage id from the login identity.
 *
 * This separates local datasets. It is deliberately not presented as full
 * authentication: a real multi-device release still needs server-side auth.
 */
export function normaliseGarageName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("el-GR");
}

export function normalisePin(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 4);
}

export async function deriveGarageId(name, pin = "") {
  const normalisedName = normaliseGarageName(name);
  if (!normalisedName) throw new TypeError("garage name is required");

  const normalisedPin = normalisePin(pin);
  const material = `motofy-garage-v1\u0000${normalisedName}\u0000${normalisedPin || "no-pin"}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `gar_${hex.slice(0, 24)}`;
}
