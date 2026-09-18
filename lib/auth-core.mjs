/**
 * Small, dependency-free helpers for the Motofy name + PIN identity.
 *
 * The browser never derives the Supabase credential. The worker uses these
 * helpers so the same name + PIN always resolves to the same hidden Auth user
 * while the PIN itself is never stored as plaintext.
 */

export function canonicalLoginName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function canonicalLoginPin(value) {
  const pin = String(value ?? "").replace(/\D/g, "").slice(0, 4);
  return pin.length === 0 || pin.length === 4 ? pin : null;
}

/** @typedef {{ok:false,error:string}|{ok:true,nameKey:string,pinKey:string}} LoginIdentity */

/** @returns {LoginIdentity} */
export function validateLoginIdentity(name, pin) {
  const nameKey = canonicalLoginName(name);
  const pinKey = canonicalLoginPin(pin);
  if (!nameKey || nameKey.length > 120) return { ok: false, error: "invalid_name" };
  if (pinKey === null) return { ok: false, error: "invalid_pin" };
  return { ok: true, nameKey, pinKey };
}

export async function sha256Hex(value, cryptoImpl = globalThis.crypto) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** @returns {Promise<LoginIdentity | {ok:true,nameKey:string,pinKey:string,identityKey:string,email:string,password:string}>} */
export async function buildAuthIdentity({ name, pin, pepper = "" }) {
  const checked = validateLoginIdentity(name, pin);
  if (!checked.ok) return checked;
  const { nameKey, pinKey } = checked;
  const identityKey = await sha256Hex(`motofy|identity|${pepper}|${nameKey}|${pinKey}`);
  const passwordKey = await sha256Hex(`motofy|password|${pepper}|${nameKey}|${pinKey}`);
  return {
    ok: true,
    nameKey,
    pinKey,
    identityKey,
    email: `m_${identityKey}@accounts.motofy.app`,
    // Supabase Auth receives a strong generated password, never the 4-digit PIN.
    password: `Mtf!${passwordKey}`,
  };
}
