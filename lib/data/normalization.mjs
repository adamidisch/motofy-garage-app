/**
 * lib/data/normalization.mjs
 *
 * Pure functions — no imports, no side effects, no API calls.
 * All normalisation runs locally in < 1ms per call.
 *
 * Designed to be the single source of truth for:
 *   - plate normalisation (reuses the same homoglyph map as scan-core)
 *   - search text normalisation (strip accents, lowercase)
 *   - Greeklish → Greek transliteration
 *   - multi-variant search index building
 *   - Greek vocative name formation
 */

/* ------------------------------------------------------------------ */
/* 1. Plate normalisation                                              */
/* ------------------------------------------------------------------ */

/**
 * Greek and Cyrillic capitals that look identical to Latin capitals.
 * Only unambiguous pairs — Γ, Δ, Λ, Π, Σ, Φ, Ψ, Ω are intentionally
 * excluded because they have no Latin lookalike and silently rewriting
 * them would corrupt a plate.
 */
const HOMOGLYPHS = {
  Α:"A", Β:"B", Ε:"E", Ζ:"Z", Η:"H", Ι:"I", Κ:"K", Μ:"M",
  Ν:"N", Ο:"O", Ρ:"P", Τ:"T", Υ:"Y", Χ:"X",
  А:"A", В:"B", Е:"E", К:"K", М:"M", Н:"H", О:"O", Р:"P",
  С:"C", Т:"T", У:"Y", Х:"X",
};

/** Fold visually-identical characters and extract only A-Z 0-9. */
function foldPlateChars(value) {
  if (!value) return "";
  let out = "";
  for (const ch of String(value).normalize("NFKC").toUpperCase()) {
    const mapped = HOMOGLYPHS[ch] ?? ch;
    if (/[A-Z0-9]/.test(mapped)) out += mapped;
  }
  return out;
}

/**
 * Canonical key for a plate — what is stored in `plate_key` and what
 * every lookup must use.  Guaranteed to be stable across input methods
 * (Greek keyboard, Latin keyboard, camera OCR).
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizePlate(raw) {
  const key = foldPlateChars(raw);
  return key || null;
}

/**
 * Display form of a plate.
 * Cyprus standard: three letters + three digits → "KBY 328".
 * Non-standard lengths are returned as-is (older, trade or gov series).
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function formatPlate(raw) {
  const key = foldPlateChars(raw);
  if (!key) return null;
  const m = key.match(/^([A-Z]{1,3})(\d{1,4})$/);
  if (m) return `${m[1]} ${m[2]}`;
  const em = key.match(/([A-Z]{2,3})(\d{2,4})/);
  if (em) return `${em[1]} ${em[2]}`;
  return key.length <= 10 ? key : null;
}

/* ------------------------------------------------------------------ */
/* 2. Search text normalisation                                        */
/* ------------------------------------------------------------------ */

/**
 * Strip diacritics (accents) and lowercase.
 *
 * "Μάριος" → "μαριος", "Ανδρέας" → "ανδρεας"
 * Works for both Greek and Latin scripts.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeSearchText(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .trim();
}

/* ------------------------------------------------------------------ */
/* 3. Greeklish → Greek transliteration                                */
/* ------------------------------------------------------------------ */

/**
 * Phonetic Greeklish → Greek mapping.
 *
 * Rules ordered longest-first so "th" is checked before "t".
 * Covers the dominant informal conventions used in Cyprus and Greece.
 * Where a sequence is genuinely ambiguous (e.g. "g" can be γ or not),
 * we map to the most common reading.
 */
const GREEKLISH_MAP = [
  ["ths",  "της"], ["th",  "θ"],
  ["ps",   "ψ"],   ["ks",  "ξ"],  ["ch",  "χ"],
  ["aio",  "αιο"], ["oio", "οιο"],
  ["ai",   "αι"],  ["ei",  "ει"], ["oi",  "οι"],
  ["ou",   "ου"],  ["au",  "αυ"], ["eu",  "ευ"],
  ["mp",   "μπ"],  ["nt",  "ντ"], ["ng",  "γκ"],
  ["gk",   "γκ"],  ["gg",  "γγ"],
  ["a",    "α"],   ["v",   "β"],  ["g",   "γ"],
  ["d",    "δ"],   ["e",   "ε"],  ["z",   "ζ"],
  ["is",   "ης"],
  ["i",    "ι"],   ["8",   "θ"],  ["k",   "κ"],
  ["l",    "λ"],   ["m",   "μ"],  ["n",   "ν"],
  ["3",    "ξ"],   ["o",   "ο"],  ["p",   "π"],
  ["r",    "ρ"],   ["s",   "σ"],  ["t",   "τ"],
  ["y",    "υ"],   ["f",   "φ"],  ["x",   "χ"],
  ["c",    "κ"],   ["w",   "ω"],  ["u",   "υ"],
  ["h",    "η"],   ["j",   "τζ"], ["q",   "κ"],
];

const GREEKLISH_MAP_ALT = [
  ["ths",  "της"], ["th",  "θ"],
  ["ps",   "ψ"],   ["ks",  "ξ"],  ["ch",  "χ"],
  ["aio",  "αιο"], ["oio", "οιο"],
  ["ai",   "αι"],  ["ei",  "ει"], ["oi",  "οι"],
  ["ou",   "ου"],  ["au",  "αυ"], ["eu",  "ευ"],
  ["mp",   "μπ"],  ["nt",  "ντ"], ["ng",  "γκ"],
  ["gk",   "γκ"],  ["gg",  "γγ"],
  ["a",    "α"],   ["v",   "β"],  ["g",   "γ"],
  ["d",    "δ"],   ["e",   "ε"],  ["z",   "ζ"],
  ["i",    "η"],   ["8",   "θ"],  ["k",   "κ"],
  ["l",    "λ"],   ["m",   "μ"],  ["n",   "ν"],
  ["3",    "ξ"],   ["o",   "ο"],  ["p",   "π"],
  ["r",    "ρ"],   ["s",   "σ"],  ["t",   "τ"],
  ["y",    "υ"],   ["f",   "φ"],  ["x",   "χ"],
  ["c",    "κ"],   ["w",   "ω"],  ["u",   "υ"],
  ["h",    "η"],   ["j",   "τζ"], ["q",   "κ"],
];

/**
 * Convert a Greeklish string to lowercase Greek.
 *
 * Input must already be lowercase ASCII.  Returns an empty string when
 * nothing recognisably maps (e.g. a plate number — callers should guard
 * against feeding plate-shaped strings here).
 *
 * @param {string} latinText  already-lowercased ASCII
 * @returns {string}  Greek lowercase without accents
 */
function runMap(map, latinText) {
  let result = "";
  let i = 0;
  while (i < latinText.length) {
    let matched = false;
    for (const [lat, gr] of map) {
      if (latinText.startsWith(lat, i)) {
        result += gr;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (!matched) { result += latinText[i]; i++; }
  }
  // Greek terminal sigma: σ at end of word → ς
  return result.replace(/σ(?=[\s.,;!?]|$)/g, "ς");
}

/** Transliterate using i→ι mapping (most common informal Greeklish). */
export function transliterateGreeklish(latinText) {
  if (!latinText) return "";
  return runMap(GREEKLISH_MAP, latinText);
}

/** Transliterate using i→η mapping (older traditional Greeklish). */
export function transliterateGreeklishAlt(latinText) {
  if (!latinText) return "";
  return runMap(GREEKLISH_MAP_ALT, latinText);
}

/* ------------------------------------------------------------------ */
/* 4. Multi-variant search index                                       */
/* ------------------------------------------------------------------ */

/**
 * Build an array of normalised variants for a query string.
 *
 * Given "marios" it returns ["marios", "μαριος"] so a search can match
 * both stored Greek names and any ASCII representation.
 *
 * Given "Μάριος" it returns ["μαριος"] (accent-stripped lowercase).
 *
 * Given "ΚΒΥ 328" it returns ["kby328", "kby 328"] for plate matching.
 *
 * The caller should check whether each haystack value includes ANY of
 * the returned tokens — matching any variant counts as a hit.
 *
 * @param {string} query
 * @returns {string[]}  deduplicated, never empty
 */
export function buildSearchVariants(query) {
  if (!query || !query.trim()) return [];
  const raw = query.trim();
  const variants = new Set();

  // 1. Normalised as-typed (accent-stripped, lowercase)
  const normalised = normalizeSearchText(raw);
  if (normalised) variants.add(normalised);

  // 2. Plate key (fold homoglyphs, keep A-Z0-9 only)
  const plateKey = normalizePlate(raw);
  if (plateKey) {
    variants.add(plateKey.toLowerCase());
    // Also spaced form e.g. "kby 328"
    const spaced = formatPlate(raw);
    if (spaced) variants.add(spaced.toLowerCase());
  }

  // 3. Greeklish → Greek (only when input is pure ASCII letters)
  if (/^[a-z\s]+$/.test(normalised)) {
    for (const gl of [transliterateGreeklish(normalised), transliterateGreeklishAlt(normalised)]) {
      const greekNorm = normalizeSearchText(gl);
      if (greekNorm && greekNorm !== normalised) variants.add(greekNorm);
    }
  }

  // 4. Latin homoglyph fold of a Greek query
  //    e.g. the user typed "ΚΒΥ" on a Greek keyboard
  const folded = foldPlateChars(raw).toLowerCase();
  if (folded && folded !== normalised) variants.add(folded);

  return [...variants];
}

/**
 * Check whether any of the search variants appear in a haystack string.
 *
 * @param {string|null|undefined} haystack
 * @param {string[]} variants  from buildSearchVariants()
 * @returns {boolean}
 */
export function matchesSearchVariants(haystack, variants) {
  if (!haystack || !variants.length) return false;
  const h = normalizeSearchText(haystack);
  return variants.some((v) => h.includes(v));
}

/**
 * Convenience: does a single query string match any of the provided
 * field values?
 *
 * @param {string} query
 * @param {Array<string|null|undefined>} fields
 * @returns {boolean}
 */
export function smartMatch(query, fields) {
  if (!query || !query.trim()) return true;  // empty query matches all
  const variants = buildSearchVariants(query);
  return fields.some((field) => field && matchesSearchVariants(field, variants));
}

/* ------------------------------------------------------------------ */
/* 5. Greek vocative name                                              */
/* ------------------------------------------------------------------ */

/**
 * Common first names with their vocative form.
 *
 * Sourced from the 50 most frequent Cypriot and Greek first names.
 * The map uses normalised (accent-stripped, lowercase) keys so lookups
 * are accent-insensitive: "μαριος" matches "Μάριος".
 */
const VOCATIVE_MAP = {
  // Masculine -ος → -ε (irregular)
  "γιωργος": "Γιώργη",  "γεωργιος": "Γεώργιε",
  "νικος": "Νίκο",      "νικολαος": "Νικόλαε",
  "παναγιωτης": "Παναγιώτη", "πανος": "Πάνο",
  "σταυρος": "Σταύρο",  "δημητρης": "Δημήτρη",
  "χρηστος": "Χρήστο",  "κωστας": "Κώστα",
  "βασιλης": "Βασίλη",  "σπυρος": "Σπύρο",
  "θανασης": "Θανάση",  "αναστασιος": "Αναστάσιε",
  "στελιος": "Στέλιο",  "πετρος": "Πέτρε",
  "αντωνης": "Αντώνη",  "αντωνιος": "Αντώνιε",
  "μιχαλης": "Μιχάλη",  "μιχαηλ": "Μιχαήλ",
  "γιαννης": "Γιάννη",  "ιωαννης": "Ιωάννη",
  "παυλος": "Παύλε",    "αγγελος": "Άγγελε",
  "κυριακος": "Κυριάκο", "χαρης": "Χάρη",
  "ανδρεας": "Ανδρέα",  "αλεξανδρος": "Αλέξανδρε",
  "λεανδρος": "Λέανδρε", "αλεξης": "Αλέξη",
  "μαριος": "Μάριε",    "πιερος": "Πιέρο",
  "θεοδωρος": "Θεόδωρε", "φιλιππος": "Φίλιππε",
  "σωτηρης": "Σωτήρη",  "λευτερης": "Λευτέρη",
  "τασος": "Τάσο",      "τακης": "Τάκη",
  "γιαννακης": "Γιαννάκη", "κυπρος": "Κύπρο",
  // Feminine — nominative = vocative for most
  "μαρια": "Μαρία",     "ελενη": "Ελένη",
  "ανδρεα": "Ανδρέα",   "σοφια": "Σοφία",
  "ειρηνη": "Ειρήνη",   "αννα": "Άννα",
  "γεωργια": "Γεωργία", "αναστασια": "Αναστασία",
  "ελενη": "Ελένη",     "κατερινα": "Κατερίνα",
  "χριστινα": "Χριστίνα", "παρασκευη": "Παρασκευή",
  "δεσποινα": "Δέσποινα", "φωτεινη": "Φωτεινή",
  "αγγελικη": "Αγγελική", "νικη": "Νίκη",
  "ολγα": "Όλγα",       "σταυρουλα": "Σταυρούλα",
};

/**
 * Suffix rules for names not in the dictionary.
 *
 * Applied in order — first match wins.
 * These cover the majority of Greek masculine first names.
 * Feminine names ending in -α or -η are left unchanged (correct vocative).
 */
const VOCATIVE_RULES = [
  [/ιος$/i, (s) => s.replace(/ιος$/i, "ιε")],   // Βασίλειος → Βασίλειε
  [/ιης$/i, (s) => s.replace(/ιης$/i, "ιη")],
  [/ης$/i,  (s) => s.replace(/(?:η|ή)ς$/i, (ending) => ending[0])], // Δημήτρης → Δημήτρη
  [/ος$/i,  (s) => s.replace(/(?:ο|ό)ς$/i, "ε")],    // Μάριος → Μάριε (fallback)
  [/ας$/i,  (s) => s.replace(/(?:α|ά)ς$/i, (ending) => ending[0])], // Ανδρέας → Ανδρέα
  [/υς$/i,  (s) => s.replace(/υς$/i,  "υ")],
];

/**
 * Return the vocative form of a Greek first name.
 *
 * Falls back gracefully:
 * 1. Dictionary lookup (accent-insensitive)
 * 2. Suffix rules
 * 3. Name as supplied (never crashes, never corrupts)
 *
 * Non-Greek names (ASCII) are returned unchanged.
 *
 * @param {string} name  first name as the user entered it
 * @returns {string}
 */
export function formatVocativeName(name) {
  if (!name || !name.trim()) return name ?? "";
  const trimmed = name.trim();

  // Common Greeklish names are rendered naturally in the Greek UI.
  // Keep this deliberately small so ordinary English names remain unchanged.
  const greeklishNames = {
    pehtis: "Πέχτη",
    marios: "Μάριε",
    antreas: "Αντρέα",
    kostas: "Κώστα",
    giorgos: "Γιώργη",
    nikos: "Νίκο",
    michalis: "Μιχάλη",
    giannis: "Γιάννη",
    thanasis: "Θανάση",
    panagiotis: "Παναγιώτη",
    stavros: "Σταύρο",
    dimitris: "Δημήτρη",
    demetris: "Δημήτρη",
    xaralampos: "Χαράλαμπε",
    charalampos: "Χαράλαμπε",
    haralampos: "Χαράλαμπε",
    christos: "Χρήστο",
    vasilis: "Βασίλη",
    spyros: "Σπύρο",
    stelios: "Στέλιο",
    petros: "Πέτρο",
    antonis: "Αντώνη",
    alexandros: "Αλέξανδρε",
    alexis: "Αλέξη",
    sotiris: "Σωτήρη",
    leftheris: "Λευτέρη",
    tasos: "Τάσο",
    takis: "Τάκη",
    konstantinos: "Κωνσταντίνε",
    kostantinos: "Κωνσταντίνε",
    kostantinps: "Κωνσταντίνε",
  };
  const greeklishName = greeklishNames[trimmed.toLowerCase()];
  if (greeklishName) return greeklishName;

  // Recognise lowercase Greeklish spellings through the phonetic map
  // (for example aleksandros → Αλέξανδρε) without a network round-trip.
  if (trimmed === trimmed.toLowerCase() && /^[a-z]+$/.test(trimmed)) {
    for (const transliterated of [transliterateGreeklish(trimmed), transliterateGreeklishAlt(trimmed)]) {
      const transliteratedKey = normalizeSearchText(transliterated);
      if (VOCATIVE_MAP[transliteratedKey]) return VOCATIVE_MAP[transliteratedKey];
      for (const [pattern, transform] of VOCATIVE_RULES) {
        if (pattern.test(transliteratedKey)) return transform(transliterated);
      }
    }
  }

  // ASCII name (non-Greek) — return as-is
  if (/^[\x00-\x7F]+$/.test(trimmed)) return trimmed;

  // Dictionary lookup on the accent-stripped, lowercase form
  const key = normalizeSearchText(trimmed);
  if (VOCATIVE_MAP[key]) return VOCATIVE_MAP[key];

  // Suffix rules on the accent-stripped form so -ής matches /ης$/i
  const strippedKey = normalizeSearchText(trimmed); // accent-free lowercase
  for (const [pattern, transform] of VOCATIVE_RULES) {
    if (pattern.test(strippedKey)) {
      // Apply the transform to the original spelling so existing Greek accents
      // survive the vocative change (e.g. Λεωνίδας → Λεωνίδα).
      const transformed = transform(trimmed);
      // Capitalise first letter to match input style
      return transformed.charAt(0).toUpperCase() + transformed.slice(1);
    }
  }

  // Fallback: return as-is (never wrong, just not vocative)
  return trimmed;
}
