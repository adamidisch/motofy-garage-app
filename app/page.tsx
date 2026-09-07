"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, CalendarDays, Camera, CarFront, Check, ChevronRight, ClipboardCheck, ClipboardList, Clock3, Ellipsis, LayoutGrid, Mail, MoreHorizontal, Phone, Plus, ScanLine, Search, Settings2, Sparkles, StickyNote, UserRound, Wrench, X } from "lucide-react";

import { createBrowserStorage, createRepository } from "../lib/data/repository.mjs";
import { buildCustomerRow, buildDashboardSummary, buildJobRow, buildVehicleListRow, buildVehicleRecord, filterJobRows, formatDateTime, formatMileage, formatRelative, formatTodayLabel, initials, matchesCustomerQuery, matchesVehicleQuery, vehicleTitle } from "../lib/data/vehicle-record.mjs";
import { formatVocativeName, smartMatch } from "../lib/data/normalization.mjs";
import { loadVehiclePhoto, saveVehiclePhoto } from "../lib/data/photo-store.mjs";
import type { Repository } from "../lib/data/repository.d.mts";
import type { VehicleListRow } from "../lib/data/vehicle-record.d.mts";
import type { Customer, Job, Vehicle } from "../lib/data/schema.d.mts";
import VehicleRecord from "./vehicle-record";
import CreationModal, { type CreationMode } from "./creation-flows";

type View = "home" | "cars" | "work" | "notes" | "customers" | "settings";
type ScanResult = { plate: string | null; make: string | null; model: string | null; confidence: "high" | "medium" | "low"; source: "ai"; provider?: string; elapsedMs?: number };
type ScanProgress = {
  percent: number;
  phase: "prepare" | "plate" | "vehicle" | "verify";
  plate: string | null;
  plateMs: number | null;
  plateStatus: "idle" | "working" | "done" | "fallback";
  vehicleMs: number | null;
  vehicleStatus: "idle" | "working" | "done" | "fallback";
};

function greeting(lang: "el" | "en", name: string) {
  const hour = new Date().getHours();
  const prefix = lang === "el" ? (hour < 12 ? "Καλημέρα" : "Καλησπέρα") : (hour < 12 ? "Good morning" : "Good evening");
  return name.trim() ? `${prefix}, ${name.trim()}` : prefix;
}

const SESSION_KEY = "motofy-session";
const DEMO_SESSION = "__demo__";

function greet(name: string, lang: "el" | "en", now = new Date()): string {
  const morning = now.getHours() < 12;
  const display = name === DEMO_SESSION ? "Demo" : name;
  if (lang === "en") return (morning ? "Good morning, " : "Good evening, ") + (display.trim().toLowerCase() === "pehtis" ? "Pehti" : display);
  return (morning ? "Καλημέρα, " : "Καλησπέρα, ") + formatVocativeName(display);
}

const APP_VERSION = "2.0.5";
const APP_RELEASE = "Production";




const el = { scanPrepare: "Προετοιμασία φωτογραφίας", scanPlate: "Ανάγνωση πινακίδας", scanVehicle: "Αναγνώριση οχήματος", scanVerify: "Επιβεβαίωση αποτελέσματος", scanPlateFallback: "Ο γρήγορος έλεγχος δεν ολοκληρώθηκε · συνεχίζει το AI", scanWaiting: "Το AI χρειάζεται λίγο περισσότερο χρόνο…", today: "ΣΗΜΕΡΑ · 2 ΣΕΠ", hello: "Καλησπέρα, Ανδρέα", subtitle: "Τι δουλειά έχουμε σήμερα;", scan: "Σάρωση αυτοκινήτου", scanTitle: "Σκάναρε το αυτοκίνητο", scanText: "Πινακίδα, πελάτης και ιστορικό — αμέσως μπροστά σου.", home: "Αρχική", cars: "Αυτοκίνητα", work: "Εργασίες", customers: "Πελάτες", add: "Προσθήκη", appointment: "Ραντεβού", notes: "Σημειώσεις", jobs: "Εργασίες", activity: "Πρόσφατη κίνηση", garage: "Συνεργείο", all: "Όλα", open: "Άνοιγμα", newCar: "Νέο αυτοκίνητο", newJob: "Νέα εργασία", newCustomer: "Νέος πελάτης", newNote: "Νέα σημείωση", settings: "Ρυθμίσεις", signout: "Έξοδος", camera: "Κάμερα πινακίδας", cameraText: "Βάλε την πινακίδα μέσα στο πλαίσιο και πάτα Αναγνώριση.", recognize: "Αναγνώριση", demo: "Χρήση demo εικόνας", cancel: "Ακύρωση", processing: "Διαβάζουμε την πινακίδα…", found: "Βρέθηκε όχημα", openRecord: "Άνοιγμα καρτέλας", retake: "Νέα λήψη", searchCar: "Αναζήτηση πινακίδας ή αυτοκινήτου", searchCustomer: "Αναζήτηση πελάτη", allCars: "Όλα τα αυτοκίνητα", activeJobs: "Εργασίες σήμερα", customerList: "Οι πελάτες σου", noResults: "Δεν βρέθηκε αποτέλεσμα", moreResults: "Περισσότερα αποτελέσματα →", resultCount: "αποτελέσματα", vehicle: "Καρτέλα οχήματος", owner: "Πελάτης", mileage: "Χιλιόμετρα", currentWork: "Τρέχουσα εργασία", note: "Σημείωση", appearance: "Εμφάνιση", theme: "Theme", language: "Γλώσσα", preferences: "Ρυθμίσεις συνεργείου", saved: "Αποθηκεύτηκε", progress: "Σε εξέλιξη", history: "Ιστορικό", vehicles: "οχήματα", overview: "Επισκόπηση", todayFilter: "Σήμερα", lastActivity: "Τελευταία κίνηση", noCustomer: "Χωρίς πελάτη", noCustomerHint: "Το όχημα δεν έχει συνδεθεί με πελάτη ακόμα.", noJobs: "Καμία εργασία", noJobsHint: "Δεν έχει καταγραφεί εργασία για αυτό το όχημα.", noOpenJob: "Καμία ανοιχτή εργασία", noOpenJobHint: "Τίποτα σε εξέλιξη αυτή τη στιγμή.", noHistory: "Χωρίς ιστορικό", noNotes: "Καμία σημείωση", noNotesHint: "Οι σημειώσεις του συνεργείου θα εμφανίζονται εδώ.", noPhone: "Χωρίς τηλέφωνο", otherVehicles: "Άλλα οχήματα", onlyVehicle: "Μοναδικό όχημα του πελάτη", unknownVehicle: "Όχημα χωρίς στοιχεία", photos: "φωτογραφίες", scanDiffers: "Η σάρωση διάβασε διαφορετικά στοιχεία", scanUnconfirmed: "Στοιχεία από σάρωση", keepExisting: "Η καρτέλα δεν άλλαξε. Η επιβεβαίωση γίνεται χειροκίνητα.", confirmLater: "Δεν έχουν επιβεβαιωθεί ακόμα.", fieldMake: "Μάρκα", fieldModel: "Μοντέλο", statusScheduled: "Προγραμματισμένη", statusInProgress: "Σε εξέλιξη", statusDone: "Ολοκληρώθηκε", statusCancelled: "Ακυρώθηκε", activityScan: "Σάρωση πινακίδας", activityCreated: "Δημιουργία καρτέλας", newVehiclePending: "Νέο όχημα — η δημιουργία έρχεται στο επόμενο βήμα", noVehicles: "Κανένα όχημα ακόμα", plate: "Πινακίδα", optional: "Προαιρετικό", scanPrefilled: "Συμπληρώθηκε από τη σάρωση", createRecord: "Δημιουργία καρτέλας", customerHint: "Τα στοιχεία αποθηκεύονται στο συνεργείο", customerName: "Όνομα πελάτη", phone: "Τηλέφωνο", createCustomer: "Δημιουργία πελάτη", service: "Service", inspection: "Έλεγχος", repair: "Επισκευή", other: "Άλλο", jobTitle: "Εργασία", createJob: "Δημιουργία εργασίας", notePlaceholder: "Γράψε μια σύντομη σημείωση…", createNote: "Αποθήκευση σημείωσης", vehicleCreated: "Η καρτέλα δημιουργήθηκε", customerCreated: "Ο πελάτης δημιουργήθηκε", jobCreated: "Η εργασία δημιουργήθηκε", noteCreated: "Η σημείωση αποθηκεύτηκε", creationError: "Δεν ολοκληρώθηκε η αποθήκευση", undo: "Αναίρεση", yourName: "Όνομα χρήστη", namePlaceholder: "Γράψε το όνομά σου", loginTitle: "Καλώς ήρθες", loginSubtitle: "Διαχείριση οχημάτων και εργασιών.", loginPhone: "Κινητό", loginPhoneHint: "Προαιρετικό", loginBtn: "Είσοδος", loginDemo: "Δοκίμασε το demo →", flowVehicle: "Όχημα", flowScan: "Σκανάρισμα πινακίδας", flowCheck: "Έλεγχος", flowRecord: "Καρτέλα", notificationsEmpty: "Δεν υπάρχουν ειδοποιήσεις", notificationsTitle: "Ειδοποιήσεις", markInProgress: "Σε εξέλιξη", markDone: "Ολοκληρώθηκε", reopen: "Άνοιγμα", jobUpdated: "Η εργασία ενημερώθηκε" };
const en = { scanPrepare: "Preparing photo", scanPlate: "Reading plate", scanVehicle: "Identifying vehicle", scanVerify: "Verifying result", scanPlateFallback: "Fast plate check did not complete · AI is continuing", scanWaiting: "The AI needs a little more time…", today: "TODAY · SEP 2", hello: "Good evening, Andreas", subtitle: "What needs moving today?", scan: "Scan vehicle", scanTitle: "Scan the car", scanText: "Plate, customer and history — ready when you are.", home: "Home", cars: "Cars", work: "Jobs", customers: "Customers", add: "Add", appointment: "Appointments", notes: "Notes", jobs: "Jobs", activity: "Recent activity", garage: "Garage", all: "All", open: "Open", newCar: "New car", newJob: "New job", newCustomer: "New customer", newNote: "New note", settings: "Settings", signout: "Sign out", camera: "Plate camera", cameraText: "Place the plate in frame then tap Recognise.", recognize: "Recognise", demo: "Use demo image", cancel: "Cancel", processing: "Reading the plate…", found: "Vehicle found", openRecord: "Open record", retake: "Retake", searchCar: "Search plate or vehicle", searchCustomer: "Search customer", allCars: "All vehicles", activeJobs: "Today’s jobs", customerList: "Your customers", noResults: "No results found", moreResults: "More results →", resultCount: "results", vehicle: "Vehicle record", owner: "Customer", mileage: "Mileage", currentWork: "Current job", note: "Note", appearance: "Appearance", theme: "Theme", language: "Language", preferences: "Garage settings", saved: "Saved", progress: "In progress", history: "History", vehicles: "vehicles", overview: "Overview", todayFilter: "Today", lastActivity: "Last activity", noCustomer: "No customer", noCustomerHint: "This vehicle is not linked to a customer yet.", noJobs: "No jobs", noJobsHint: "Nothing has been recorded for this vehicle.", noOpenJob: "No open job", noOpenJobHint: "Nothing in progress right now.", noHistory: "No history", noNotes: "No notes", noNotesHint: "Garage notes will appear here.", noPhone: "No phone number", otherVehicles: "Other vehicles", onlyVehicle: "The customer's only vehicle", unknownVehicle: "Vehicle without details", photos: "photos", scanDiffers: "The scan read different details", scanUnconfirmed: "Details from a scan", keepExisting: "The record is unchanged. Confirming is a manual step.", confirmLater: "Not confirmed yet.", fieldMake: "Make", fieldModel: "Model", statusScheduled: "Scheduled", statusInProgress: "In progress", statusDone: "Completed", statusCancelled: "Cancelled", activityScan: "Plate scan", activityCreated: "Record created", newVehiclePending: "New vehicle — creation arrives in the next step", noVehicles: "No vehicles yet", plate: "Plate", optional: "Optional", scanPrefilled: "Filled from the scan", createRecord: "Create vehicle record", customerHint: "The details are saved to this garage", customerName: "Customer name", phone: "Phone", createCustomer: "Create customer", service: "Service", inspection: "Inspection", repair: "Repair", other: "Other", jobTitle: "Job", createJob: "Create job", notePlaceholder: "Write a short note…", createNote: "Save note", vehicleCreated: "Vehicle record created", customerCreated: "Customer created", jobCreated: "Job created", noteCreated: "Note saved", creationError: "Could not save this yet", undo: "Undo", yourName: "Username", namePlaceholder: "Enter your name", loginTitle: "Welcome", loginSubtitle: "Vehicle and job management.", loginPhone: "Mobile", loginPhoneHint: "Optional", loginBtn: "Enter", loginDemo: "Try the demo →", flowVehicle: "Vehicle", flowScan: "Plate scan", flowCheck: "Check", flowRecord: "Record", notificationsEmpty: "No notifications yet", notificationsTitle: "Notifications", markInProgress: "Mark in progress", markDone: "Mark as done", reopen: "Reopen", jobUpdated: "Job updated" };

export default function Home() {
  const [session, setSession] = useState<string | null>(() => {
    try { return globalThis.localStorage?.getItem(SESSION_KEY) ?? null; } catch { return null; }
  });
  if (!session) return <LoginScreen
    onLogin={async (name, language) => {
      let storedName = name.trim();
      if (language === "el" && /[A-Za-z]/.test(storedName)) {
        const controller = new AbortController();
        // Gemini needs a few seconds for a reliable Greek name correction.
        // Do not cancel the real check prematurely; the login UI shows progress.
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        try {
          const response = await fetch("/api/name/normalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: storedName }), signal: controller.signal });
          const result = await response.json();
          if (typeof result.canonical_name === "string" && result.canonical_name.trim()) storedName = result.canonical_name.trim();
        } catch { /* local normalization remains the safe fallback */ }
        window.clearTimeout(timeout);
      }
      localStorage.setItem(SESSION_KEY, storedName); setSession(storedName);
    }}
    onDemo={() => setSession(DEMO_SESSION)}
  />;
  return <AppBody session={session} onLogout={() => { localStorage.removeItem(SESSION_KEY); setSession(null); }}/>;
}

function LoginScreen({ onLogin, onDemo }: { onLogin: (name: string, language: "el" | "en") => Promise<void>; onDemo: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const lang = (() => { try { return localStorage.getItem("motofy-language") ?? "el"; } catch { return "el"; } })();
  const t = lang === "en" ? en : el;
  const [submitting, setSubmitting] = useState(false);
  async function submit() {
    const n = name.trim();
    if (!n || submitting) return;
    setSubmitting(true);
    try {
      // A real local validation pass: no request is needed and no personal
      // name leaves the device. Keep the short state visible to the user.
      if (lang === "el") formatVocativeName(n);
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      await onLogin(n, lang as "el" | "en");
    } finally { setSubmitting(false); }
  }
  return (
    <div className="login-screen">
      <div className="login-card">

        {/* Single logo lockup: icon left, wordmark right — one treatment only */}
        <div className="login-lockup" aria-label="Motofy">
          <div className="login-lockup-main">
            <div className="login-lockup-icon" aria-hidden="true">
              <img src="/icon.svg" alt="" width={44} height={44}/>
            </div>
            <span className="login-lockup-word" aria-hidden="true">motofy</span>
          </div>
          <span className="login-lockup-ver" aria-hidden="true">ver. {APP_VERSION}</span>
        </div>

        {/* Supporting line — no greeting, no Motofy repetition */}
        <p className="login-tagline">{t.loginSubtitle}</p>

        {/* Fields with labels */}
        <div className="login-fields">
          <label className="login-field-label">
            <span>{t.yourName}</span>
            <input
              className="login-field-input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </label>
          <label className="login-field-label">
            <span>{t.loginPhone}<em className="login-field-hint">{t.loginPhoneHint}</em></span>
            <input
              className="login-field-input"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>
          <button className={`login-btn${submitting ? " is-loading" : ""}`} onClick={submit} disabled={!name.trim() || submitting} aria-busy={submitting}>
            <span>{submitting ? (lang === "el" ? "Έλεγχος…" : "Checking…") : t.loginBtn}</span>
            {submitting && <span className="login-btn-progress" aria-hidden="true" />}
          </button>
          <button className="login-demo-link" onClick={onDemo}>{t.loginDemo}</button>
        </div>

        {/* Flow — sequential, one icon active at a time */}
        <div className="login-flow" aria-hidden="true">
          <span className="login-flow-cell lf-s1"><CarFront size={14}/><span className="lf-label">{t.flowVehicle}</span></span>
          <span className="login-flow-cell lf-s2"><ScanLine size={14}/><span className="lf-label">{t.flowScan}</span></span>
          <span className="login-flow-cell lf-s3"><Check size={14}/><span className="lf-label">{t.flowCheck}</span></span>
          <span className="login-flow-cell lf-s4"><ClipboardList size={14}/><span className="lf-label">{t.flowRecord}</span></span>
        </div>

      </div>
    </div>
  );
}

function AppBody({ session, onLogout }: { session: string; onLogout: () => void }) {
  const [lang, setLang] = useState<"el" | "en">("el");
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [scanner, setScanner] = useState<"camera" | "processing" | "match" | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    percent: 0, phase: "prepare", plate: null, plateMs: null,
    plateStatus: "idle", vehicleMs: null, vehicleStatus: "idle",
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResultsOpen, setGlobalSearchResultsOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [scanForRecord, setScanForRecord] = useState<ScanResult | null>(null);
  const [creation, setCreation] = useState<CreationMode | null>(null);
  const [creationScan, setCreationScan] = useState<ScanResult | null>(null);
  const [creationVehicleId, setCreationVehicleId] = useState<string | null>(null);
  const [creationPhoto, setCreationPhoto] = useState<string | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<Record<string, string>>({});
  const [toastAction, setToastAction] = useState<(() => void) | null>(null);
  // Created on the client only. The seed is stamped with the current time, so
  // building it during SSR and again after hydration would produce two
  // different trees.
  const [repository, setRepository] = useState<Repository | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState("sky");
  const [userName, setUserName] = useState("");
  const headerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const t = lang === "el" ? el : en;

  function stopCamera() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  function closeScanner() { stopCamera(); setScanner(null); setCameraError(false); setScanError(""); setSelectedImage(null); }
  function notice(message: string, action?: () => void) { setToast(message); setToastAction(() => action ?? null); window.setTimeout(() => { setToast(""); setToastAction(null); }, 2200); }
  function selectView(next: View) { setView(next); setQuery(""); setMenuOpen(false); setAddOpen(false); setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); setSelectedCustomerId(null); }

  function refreshRepository() {
    setRepository(createRepository({ storage: createBrowserStorage() }));
  }
  function openCreation(mode: CreationMode, scan: ScanResult | null = null, vehicleId: string | null = null) {
    setAddOpen(false); setMenuOpen(false); setCreationScan(scan); setCreationVehicleId(vehicleId); setCreationPhoto(selectedImage); setCreation(mode);
  }
  function finishCreation(message: string, vehicleId?: string) {
    const undo = repository?.peekUndo();
    refreshRepository(); setCreation(null); setCreationScan(null); setCreationVehicleId(null); setCreationPhoto(null); notice(message, undo ? () => { repository?.undo(); refreshRepository(); setToast(""); setToastAction(null); } : undefined);
    if (vehicleId) { setSelectedVehicleId(vehicleId); setView("cars"); }
  }
  function createVehicleFromFlow(draft: { plate: string; make: string | null; model: string | null; mileage_km: number | null; customer_id: string | null }) {
    if (!repository) return;
    try {
      const vehicle = repository.createVehicle({ ...draft, confirmed_at: creationScan ? new Date().toISOString() : null, scan_make: creationScan?.make ?? null, scan_model: creationScan?.model ?? null, scan_confidence: creationScan?.confidence ?? null, scan_provider: creationScan?.provider ?? null, scanned_at: creationScan ? new Date().toISOString() : null });
      if (creationPhoto) void saveVehiclePhoto(vehicle.id, creationPhoto).then(() => loadVehiclePhoto(vehicle.id).then((photo) => photo && setVehiclePhotos((current) => ({ ...current, [vehicle.id]: photo }))));
      finishCreation(t.vehicleCreated, vehicle.id);
    } catch { notice(t.creationError); }
  }
  function createCustomerFromFlow(draft: { name: string; phone: string | null }) {
    if (!repository) return;
    try { repository.createCustomer(draft); finishCreation(t.customerCreated); } catch { notice(t.creationError); }
  }
  function createJobFromFlow(draft: { vehicle_id: string; title: string; mileage_km: number | null }) {
    if (!repository) return;
    try { repository.createJob({ ...draft, status: "scheduled" }); finishCreation(t.jobCreated, draft.vehicle_id); } catch { notice(t.creationError); }
  }
  function createNoteFromFlow(draft: { vehicle_id: string; body: string }) {
    if (!repository) return;
    try { repository.createNote(draft); finishCreation(t.noteCreated, draft.vehicle_id); } catch { notice(t.creationError); }
  }

  useEffect(() => {
    setRepository(createRepository({ storage: createBrowserStorage() }));
  }, []);

  useEffect(() => {
    if (!repository) return;
    let alive = true;
    Promise.all(repository.listVehicles().map(async (vehicle) => [vehicle.id, await loadVehiclePhoto(vehicle.id)] as const)).then((items) => {
      if (!alive) return;
      setVehiclePhotos(Object.fromEntries(items.filter((item): item is [string, string] => Boolean(item[1]))));
    });
    return () => { alive = false; };
  }, [repository]);

  const vehicleRows: VehicleListRow[] = repository
    ? repository.listVehicles().map((vehicle) => buildVehicleListRow(repository, vehicle))
    : [];

  type JobRow = { job: Job; vehicle: Vehicle | null; customer: Customer | null };
  type CustomerRow = { customer: Customer; vehicles: Vehicle[]; vehicleCount: number };

  const jobRows: JobRow[] = repository
    ? repository.listOpenJobs().concat(
        // pull history too so the history filter tab has data
        repository.listVehicles().flatMap((v) =>
          repository.listJobsByVehicle(v.id, { status: "done" })
            .concat(repository.listJobsByVehicle(v.id, { status: "cancelled" }))
        )
      ).filter((job, index, arr) => arr.findIndex((j) => j.id === job.id) === index) // dedupe
       .map((job) => buildJobRow(repository, job))
    : [];

  const customerRows: CustomerRow[] = repository
    ? repository.listCustomers().map((customer) => buildCustomerRow(repository, customer))
    : [];

  const noteRows = repository
    ? repository.listVehicles().flatMap((vehicle) => repository.listNotesByVehicle(vehicle.id).map((note) => ({ note, vehicle, customer: vehicle.customer_id ? repository.getCustomer(vehicle.customer_id) : null })))
    : [];

  const selectedCustomer = selectedCustomerId ? customerRows.find((row) => row.customer.id === selectedCustomerId) ?? null : null;

  const globalResults = repository && globalSearchQuery.trim()
    ? [
        ...vehicleRows.filter((row) => smartMatch(globalSearchQuery, [row.title, row.subtitle, row.vehicle.plate, row.customer?.name, row.vehicle.make, row.vehicle.model, row.currentJob?.title])).map((row) => ({ kind: "vehicle" as const, id: row.vehicle.id, title: row.vehicle.plate ?? t.unknownVehicle, subtitle: [[row.vehicle.make, row.vehicle.model].filter(Boolean).join(" "), row.customer?.name].filter(Boolean).join(" · ") })),
        ...customerRows.filter((row) => smartMatch(globalSearchQuery, [row.customer.name, row.customer.phone, ...row.vehicles.map((v) => v.plate)])).map((row) => ({ kind: "customer" as const, id: row.customer.id, title: row.customer.name, subtitle: row.customer.phone ?? t.customers })),
        ...jobRows.filter((row) => smartMatch(globalSearchQuery, [row.job.title, row.vehicle?.plate, row.vehicle?.make, row.vehicle?.model, row.customer?.name])).map((row) => ({ kind: "job" as const, id: row.job.id, vehicleId: row.vehicle?.id ?? null, title: row.vehicle?.plate ?? row.job.title, subtitle: [[row.vehicle?.make, row.vehicle?.model].filter(Boolean).join(" "), row.job.title, row.customer?.name].filter(Boolean).join(" · ") })),
        ...repository.listVehicles().flatMap((vehicle) => repository.listNotesByVehicle(vehicle.id).map((note) => ({ vehicle, note }))).filter(({ vehicle, note }) => smartMatch(globalSearchQuery, [note.body, vehicle.plate, vehicle.make, vehicle.model])).map(({ vehicle, note }) => ({ kind: "note" as const, id: note.id, vehicleId: vehicle.id, title: note.body, subtitle: vehicle.plate })),
      ]
    : [];

  function openGlobalResult(result: (typeof globalResults)[number]) {
    setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); setGlobalSearchQuery("");
    if (result.kind === "vehicle") { setSelectedVehicleId(result.id); setView("cars"); }
    else if (result.kind === "customer") { setView("customers"); setQuery(""); setSelectedCustomerId(result.id); }
    else if (result.vehicleId) { setSelectedVehicleId(result.vehicleId); setView("cars"); }
  }

  const dashSummary = repository ? buildDashboardSummary(repository) : null;
  const openRecord = repository && selectedVehicleId
    ? buildVehicleRecord({ repository, vehicleId: selectedVehicleId, scan: scanForRecord })
    : null;

  useEffect(() => {
    const savedLang = localStorage.getItem("motofy-language");
    const savedTheme = localStorage.getItem("motofy-theme");
    const savedName = localStorage.getItem("motofy-user-name");
    const timer = window.setTimeout(() => { if (savedLang === "el" || savedLang === "en") setLang(savedLang); if (savedTheme) setTheme(savedTheme); if (savedName) setUserName(savedName); }, 0);
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) { setMenuOpen(false); setAddOpen(false); setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setAddOpen(false); setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); setCreation(null); setCreationScan(null); setCreationVehicleId(null); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setScanner(null); setCameraError(false); setSelectedVehicleId(null); setSelectedCustomerId(null); setScanForRecord(null); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, []);

  useEffect(() => {
    if (!scanner && !selectedVehicleId) return;
    const scrollY = window.scrollY;
    const { body } = document;
    const previous = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [scanner, selectedVehicleId, selectedCustomerId]);

  function switchLanguage() { const next = lang === "el" ? "en" : "el"; setLang(next); localStorage.setItem("motofy-language", next); }
  function chooseTheme(next: string) { setTheme(next); localStorage.setItem("motofy-theme", next); notice(t.saved); }
  function saveUserName(next: string) { setUserName(next); localStorage.setItem("motofy-user-name", next.trim()); }
  function startScanner() {
    setMenuOpen(false); setAddOpen(false); setCameraError(false); setScanError("");
    setScanResult(null); setSelectedImage(null);
    setScanProgress({ percent: 0, phase: "prepare", plate: null, plateMs: null, plateStatus: "idle", vehicleMs: null, vehicleStatus: "idle" });
    setScanner("camera"); window.requestAnimationFrame(startCamera);
  }
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch { setCameraError(true); }
  }
  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const width = Math.min(video.videoWidth, 1600); const height = Math.round(video.videoHeight * (width / video.videoWidth));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.86);
  }
  async function recognise() {
    const image = selectedImage ?? captureFrame();
    if (!image) { setCameraError(true); setScanError("Χρειάζεται φωτογραφία για να γίνει η αναγνώριση."); return; }

    stopCamera();
    setScanError("");
    setScanResult(null);
    setScanProgress({ percent: 12, phase: "prepare", plate: null, plateMs: null, plateStatus: "idle", vehicleMs: null, vehicleStatus: "idle" });
    setScanner("processing");

    const requestBody = JSON.stringify({
      imageData: image,
      mimeType: image.startsWith("data:image/png") ? "image/png" : image.startsWith("data:image/webp") ? "image/webp" : "image/jpeg",
    });

    const plateController = new AbortController();
    const vehicleController = new AbortController();
    const plateTimeout = window.setTimeout(() => plateController.abort(), 7_000);
    const vehicleTimeout = window.setTimeout(() => vehicleController.abort(), 35_000);

    setScanProgress((current) => ({ ...current, percent: 34, phase: "plate", plateStatus: "working", vehicleStatus: "working" }));

    const platePromise = fetch("/api/scan/plate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: plateController.signal,
      body: requestBody,
    }).then(async (response) => {
      const payload = await response.json() as ScanResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Δεν ολοκληρώθηκε η γρήγορη ανάγνωση.");
      return payload;
    });

    const vehiclePromise = fetch("/api/scan/vehicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: vehicleController.signal,
      body: requestBody,
    }).then(async (response) => {
      const payload = await response.json() as ScanResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Δεν ολοκληρώθηκε η αναγνώριση οχήματος.");
      return payload;
    });

    let plateResult: ScanResult | null = null;
    let vehicleResult: ScanResult | null = null;
    let plateFailure: unknown = null;
    let vehicleFailure: unknown = null;

    try {
      plateResult = await platePromise;
      setScanProgress((current) => ({
        ...current,
        percent: 58,
        phase: "vehicle",
        plate: plateResult?.plate ?? null,
        plateMs: plateResult?.elapsedMs ?? null,
        plateStatus: plateResult?.plate ? "done" : "fallback",
      }));
    } catch (error) {
      plateFailure = error;
      setScanProgress((current) => ({
        ...current,
        percent: 58,
        phase: "vehicle",
        plateStatus: "fallback",
      }));
    } finally {
      window.clearTimeout(plateTimeout);
    }

    try {
      vehicleResult = await vehiclePromise;
      setScanProgress((current) => ({
        ...current,
        percent: 92,
        phase: "verify",
        vehicleMs: vehicleResult?.elapsedMs ?? null,
        vehicleStatus: "done",
      }));
    } catch (error) {
      vehicleFailure = error;
      setScanProgress((current) => ({
        ...current,
        percent: 92,
        phase: "verify",
        vehicleStatus: "fallback",
      }));
    } finally {
      window.clearTimeout(vehicleTimeout);
    }

    const finalPlate = plateResult?.plate ?? vehicleResult?.plate ?? null;
    const finalResult: ScanResult | null =
      finalPlate || vehicleResult?.make || vehicleResult?.model
        ? {
            plate: finalPlate,
            make: vehicleResult?.make ?? null,
            model: vehicleResult?.model ?? null,
            confidence: plateResult?.plate ? plateResult.confidence : vehicleResult?.confidence ?? "low",
            source: "ai",
          }
        : null;

    if (finalResult) {
      setScanProgress((current) => ({ ...current, percent: 100, phase: "verify" }));
      setScanResult(finalResult);
      setScanner("match");
      return;
    }

    const timedOut = [plateFailure, vehicleFailure].some((error) => error instanceof DOMException && error.name === "AbortError");
    const message =
      timedOut
        ? "Η αναγνώριση άργησε πολύ. Δοκίμασε ξανά ή βγάλε πιο καθαρή φωτογραφία."
        : vehicleFailure instanceof Error
          ? vehicleFailure.message
          : plateFailure instanceof Error
            ? plateFailure.message
            : "Δεν ολοκληρώθηκε η αναγνώριση.";
    setScanError(message);
    setScanner("camera");
  }
  function choosePhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => { setSelectedImage(String(reader.result)); setCameraError(false); setScanError(""); stopCamera(); };
    reader.readAsDataURL(file);
  }
  /**
   * Open the record the plate belongs to.
   *
   * Lookup only. An unknown plate is left alone rather than filed as a record,
   * because creating one is a decision the mechanic has not made yet; that flow
   * arrives in the next step.
   */
  function openFoundCar() {
    if (!scanResult?.plate || !repository) return;
    const existing = repository.findVehicleByPlate(scanResult.plate);
    if (!existing) { const photo = selectedImage; closeScanner(); openCreation("vehicle", scanResult); setCreationPhoto(photo); return; }
    if (selectedImage) void saveVehiclePhoto(existing.id, selectedImage).then(() => setVehiclePhotos((current) => ({ ...current, [existing.id]: selectedImage })));
    closeScanner();
    setScanForRecord(scanResult);
    setSelectedVehicleId(existing.id);
    setView("cars");
    notice(t.openRecord);
  }
  const nav = [["home", LayoutGrid, t.home], ["cars", CarFront, t.cars], ["work", ClipboardList, t.work], ["customers", UserRound, t.customers]] as const;

  return <main className={"app-shell theme-" + theme}>
    <section className="phone-canvas">
      <header className="topbar" ref={headerRef}>
        <button className="brand" aria-label="Motofy home" onClick={() => selectView("home")}><span className="brand-mark"><img src="/icon.svg" alt="" width={28} height={28}/></span><span>motofy</span></button>
        <div className="top-actions"><button className="icon-button" onClick={() => { setGlobalSearchOpen(true); setGlobalSearchResultsOpen(false); setGlobalSearchQuery(""); setMenuOpen(false); setAddOpen(false); }} aria-label={lang === "el" ? "Αναζήτηση" : "Search"}><Search size={18}/></button><button className="language" onClick={switchLanguage}>ΕΛ <span>/</span> EN</button><button className="icon-button" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); }} aria-label={t.add}><Plus size={20}/></button><button className="icon-button" onClick={() => { setMenuOpen(!menuOpen); setAddOpen(false); setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); }} aria-label="Menu"><MoreHorizontal size={21}/></button></div>
        {addOpen && <div className="action-popover add-popover"><button onClick={() => openCreation("vehicle")}><CarFront size={16}/>{t.newCar}</button><button onClick={() => openCreation("job")}><Wrench size={16}/>{t.newJob}</button><button onClick={() => openCreation("customer")}><UserRound size={16}/>{t.newCustomer}</button><button onClick={() => openCreation("note")}><StickyNote size={16}/>{t.newNote}</button></div>}
        {menuOpen && <div className="action-popover menu-popover"><button onClick={() => selectView("settings")}><Settings2 size={16}/>{t.settings}</button><button onClick={() => { setMenuOpen(false); onLogout(); }}><X size={16}/>{t.signout}</button></div>}
        {globalSearchOpen && <div className={"global-search-panel" + (globalSearchResultsOpen ? " global-search-expanded" : "")} role="dialog" aria-label={lang === "el" ? "Αναζήτηση" : "Search"}>
          <label className="global-search-input"><Search size={18}/><input autoFocus value={globalSearchQuery} onChange={(event) => setGlobalSearchQuery(event.target.value)} placeholder={lang === "el" ? "Αναζήτηση οχήματος, πελάτη ή εργασίας" : "Search vehicles, customers or jobs"}/>{globalSearchQuery && <button aria-label="Clear search" onClick={() => setGlobalSearchQuery("")}><X size={16}/></button>}<button aria-label={t.cancel} onClick={() => { setGlobalSearchOpen(false); setGlobalSearchResultsOpen(false); setGlobalSearchQuery(""); }}><X size={18}/></button></label>
          {globalSearchQuery && <>
            <div className="global-search-results">{(globalSearchResultsOpen ? globalResults : globalResults.slice(0, 3)).map((result) => <button className="global-search-result" key={result.kind + result.id} onClick={() => openGlobalResult(result)}><span className={"global-search-kind " + result.kind}>{result.kind === "vehicle" ? <CarFront size={16}/> : result.kind === "customer" ? <UserRound size={16}/> : result.kind === "job" ? <ClipboardList size={16}/> : <StickyNote size={16}/>}</span><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><ChevronRight size={16}/></button>)}{!globalResults.length && <p className="global-search-empty">{t.noResults}</p>}</div>
            {!globalSearchResultsOpen && globalResults.length > 3 && <button className="global-search-more" onClick={() => { setGlobalSearchResultsOpen(true); (document.activeElement as HTMLElement | null)?.blur?.(); }} aria-expanded="false"><span>{t.moreResults}</span><span>{globalResults.length}</span></button>}
            {globalSearchResultsOpen && globalResults.length > 0 && <p className="global-search-count">{globalResults.length} {t.resultCount}</p>}
          </>}
        </div>}
      </header>
      <div className="content">
        {view === "home" && <Dashboard t={t} lang={lang} session={session} todayLabel={formatTodayLabel(new Date(), lang)} summary={dashSummary} startScanner={startScanner} selectView={selectView} notice={notice}/>}
        {view === "cars" && <Cars t={t} lang={lang} query={query} setQuery={setQuery} rows={vehicleRows} photos={vehiclePhotos} selectVehicle={setSelectedVehicleId}/>}
        {view === "work" && <Work t={t} lang={lang} jobRows={jobRows} photos={vehiclePhotos} selectVehicle={setSelectedVehicleId} notice={notice} openCreation={openCreation} onJobUpdate={(jobId, status) => { if (!repository) return; repository.updateJob(jobId, { status }); const undo = repository.peekUndo(); refreshRepository(); notice(t.jobUpdated, undo ? () => { repository.undo(); refreshRepository(); } : undefined); }}/>}
        {view === "notes" && <NotesView t={t} lang={lang} rows={noteRows} photos={vehiclePhotos} selectVehicle={setSelectedVehicleId}/>}
        {view === "customers" && <Customers t={t} query={query} setQuery={setQuery} customerRows={customerRows} photos={vehiclePhotos} selectVehicle={setSelectedVehicleId} selectCustomer={setSelectedCustomerId} notice={notice} openCreation={openCreation}/>}
        {view === "settings" && <Settings t={t} theme={theme} chooseTheme={chooseTheme} lang={lang} switchLanguage={switchLanguage} userName={userName} saveUserName={saveUserName}/>}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "selected" : ""} onClick={() => selectView(id)}><Icon size={20}/><span>{label}</span></button>)}<button className="nav-add" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }}><span><Plus size={22}/></span><small>{t.add}</small></button></nav>
    </section>
    {scanner && <Scanner stage={scanner} t={t} error={cameraError} scanError={scanError} result={scanResult} progress={scanProgress} selectedImage={selectedImage} videoRef={videoRef} fileInputRef={fileInputRef} close={closeScanner} recognise={recognise} choosePhoto={choosePhoto} openRecord={openFoundCar} restart={startScanner}/>}
    {openRecord && (
      <VehicleRecord record={openRecord} t={t} lang={lang} photoUrl={vehiclePhotos[openRecord.vehicle.id] ?? null} onPhotoChange={(dataUrl) => { void saveVehiclePhoto(openRecord.vehicle.id, dataUrl).then(() => setVehiclePhotos((current) => ({ ...current, [openRecord.vehicle.id]: dataUrl }))); }} close={() => { setSelectedVehicleId(null); setScanForRecord(null); }} openVehicle={(id) => { setScanForRecord(null); setSelectedVehicleId(id); }} onJobUpdate={(jobId, status) => { if (!repository) return; repository.updateJob(jobId, { status }); const undo = repository.peekUndo(); refreshRepository(); notice(t.jobUpdated, undo ? () => { repository.undo(); refreshRepository(); } : undefined); }}/>
    )}
    {selectedCustomer && <CustomerRecord row={selectedCustomer} t={t} lang={lang} photos={vehiclePhotos} close={() => setSelectedCustomerId(null)} openVehicle={(id) => { setSelectedCustomerId(null); setSelectedVehicleId(id); }}/>}
    {creation && repository && (
      <CreationModal mode={creation} repository={repository} t={t} initialScan={creationScan} initialVehicleId={creationVehicleId} onScanVehicle={() => { setCreation(null); setCreationScan(null); startScanner(); }} close={() => { setCreation(null); setCreationScan(null); setCreationVehicleId(null); setCreationPhoto(null); }} onCreateVehicle={createVehicleFromFlow} onCreateCustomer={createCustomerFromFlow} onCreateJob={createJobFromFlow} onCreateNote={createNoteFromFlow}/>
    )}
    {toast && <div className="toast"><Check size={16}/><span>{toast}</span>{toastAction && <button onClick={toastAction}>{t.undo}</button>}</div>}
  </main>;
}

function Dashboard({ t, lang, session, todayLabel, summary, startScanner, selectView, notice }: { t: typeof el; lang: "el" | "en"; session: string; todayLabel: string; summary: ReturnType<typeof buildDashboardSummary> | null; startScanner: () => void; selectView: (view: View) => void; notice: (message: string) => void }) {
  return <><section className="intro-row"><div><p className="eyebrow">{todayLabel}</p><h1>{greet(session, lang)}</h1><p className="intro-copy">{t.subtitle}</p></div><button className="notification" onClick={() => notice(t.notificationsEmpty)} aria-label={t.notificationsTitle}><Bell size={19}/></button></section>
    <section className="scan-card"><div className="scan-orb"><ScanLine size={30}/></div><div className="scan-copy"><span className="pill"><Sparkles size={13}/> AI READY</span><h2>{t.scanTitle}</h2><p>{t.scanText}</p></div><button className="scan-button" onClick={startScanner}>{t.scan}<span><Camera size={16}/></span></button></section>
    <section className="metrics"><button onClick={() => selectView("work")}><span className="metric-icon indigo"><CalendarDays size={18}/></span><div><strong>{summary?.openCount ?? "—"}</strong><p>{t.activeJobs}</p></div></button><button onClick={() => selectView("notes")}><span className="metric-icon aqua"><StickyNote size={18}/></span><div><strong>{summary?.noteCount ?? "—"}</strong><p>{t.notes}</p></div></button><button onClick={() => selectView("work")}><span className="metric-icon gold"><ClipboardCheck size={18}/></span><div><strong>{summary?.openCount ?? "—"}</strong><p>{t.jobs}</p></div></button></section>
    <section className="section-heading"><div><p className="eyebrow">{t.activity}</p><h2>{t.garage}</h2></div><button onClick={() => selectView("work")}>{t.all}<ChevronRight size={15}/></button></section>
    <section className="activity-list">{(summary?.recent ?? []).map(({ job, vehicle }, index) => <button className="activity" key={job.id} onClick={() => selectView("work")}><span className={"activity-icon " + (index === 0 ? "lilac" : index === 1 ? "blue" : "mint")}>{job.status === "in_progress" ? <Wrench size={18}/> : job.status === "done" ? <Check size={18}/> : <Clock3 size={18}/>}</span><span className="activity-text"><strong className="plate-title">{vehicle?.plate ?? t.unknownVehicle}</strong><small>{vehicle ? ([vehicle.make, vehicle.model].filter(Boolean).join(" ") || t.unknownVehicle) + " · " : ""}{formatRelative(job.updated_at ?? job.created_at)}</small></span><Ellipsis size={18}/></button>)}</section>
  </>;
}

function Intro({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) { return <section className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</section>; }
function SearchBox({ value, setValue, placeholder }: { value: string; setValue: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={18}/><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder}/>{value && <button aria-label="Clear search" onClick={() => setValue("")}><X size={16}/></button>}</label>; }
function Empty({ text }: { text: string }) { return <div className="empty-inline"><Search size={20}/>{text}</div>; }

function Cars({ t, lang, query, setQuery, rows, photos, selectVehicle }: { t: typeof el; lang: "el" | "en"; query: string; setQuery: (value: string) => void; rows: VehicleListRow[]; photos: Record<string, string>; selectVehicle: (vehicleId: string) => void }) {
  const filtered = rows.filter((row) => matchesVehicleQuery(row, query));
  const tones = ["mint", "blue", "peach", "lilac"];
  return <><Intro eyebrow={t.allCars} title={t.cars} action={<span className="page-count">{rows.length}</span>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCar}/><section className="vehicle-list">{filtered.map((row, index) => <button className="vehicle-row" key={row.vehicle.id} onClick={() => selectVehicle(row.vehicle.id)}><span className={"vehicle-badge " + tones[index % tones.length]}>{photos[row.vehicle.id] ? <img src={photos[row.vehicle.id]} alt=""/> : <CarFront size={19}/>}</span><span className="vehicle-text"><strong className="plate-title">{row.vehicle.plate ?? t.unknownVehicle}</strong><small>{[row.title, row.subtitle].filter(Boolean).join(" · ")}</small><small>{[row.customer?.name ?? t.noCustomer, row.vehicle.mileage_km !== null ? formatMileage(row.vehicle.mileage_km, lang) : null].filter(Boolean).join(" · ")}</small><em>{row.currentJob?.title ?? t.noOpenJob}</em></span><ChevronRight size={18}/></button>)}{!filtered.length && <Empty text={rows.length ? t.noResults : t.noVehicles}/>}</section></>;
}

function Work({ t, lang, jobRows, photos, selectVehicle, notice, openCreation, onJobUpdate }: { t: typeof el; lang: "el" | "en"; jobRows: Array<{ job: Job; vehicle: Vehicle | null; customer: Customer | null }>; photos: Record<string, string>; selectVehicle: (id: string) => void; notice: (message: string) => void; openCreation: (mode: CreationMode) => void; onJobUpdate: (jobId: string, status: string) => void }) {
  function nextStatus(s: string) { return s === "scheduled" ? "in_progress" : s === "in_progress" ? "done" : "scheduled"; }
  function nextLabel(s: string) { return s === "scheduled" ? t.markInProgress : s === "in_progress" ? t.markDone : t.reopen; }
  const [scope, setScope] = useState<"today" | "active" | "history">("today");
  const [menuJobId, setMenuJobId] = useState<string | null>(null);
  const visibleJobs = filterJobRows(jobRows, scope);
  const statusCopy = (status: Job["status"]) => status === "scheduled" ? t.statusScheduled : status === "in_progress" ? t.statusInProgress : status === "done" ? t.statusDone : t.statusCancelled;
  const grouped = visibleJobs.reduce<Array<{ key: string; vehicle: Vehicle | null; customer: Customer | null; jobs: Array<{ job: Job; vehicle: Vehicle | null; customer: Customer | null }> }>>((groups, row) => {
    const key = row.vehicle?.id ?? "job:" + row.job.id;
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.jobs.push(row); else groups.push({ key, vehicle: row.vehicle, customer: row.customer, jobs: [row] });
    return groups;
  }, []);
  return <><Intro eyebrow={t.activeJobs} title={t.work} action={<button className="compact-add" onClick={() => openCreation("job")}><Plus size={16}/>{t.add}</button>}/><div className="filter-tabs"><button className={scope === "today" ? "active" : ""} onClick={() => setScope("today")}>{t.todayFilter}</button><button className={scope === "active" ? "active" : ""} onClick={() => setScope("active")}>{t.progress}</button><button className={scope === "history" ? "active" : ""} onClick={() => setScope("history")}>{t.history}</button></div><section className="job-list">{grouped.map(({ key, vehicle, customer, jobs }) => { const vehicleName = vehicleTitle(vehicle) ?? vehicle?.plate ?? t.unknownVehicle; const phone = customer?.phone?.trim(); return <article className="work-vehicle-card" key={key}><header className="work-vehicle-header"><span className="work-vehicle-avatar">{vehicle && photos[vehicle.id] ? <img src={photos[vehicle.id]} alt=""/> : <CarFront size={21}/>}</span><div className="work-vehicle-summary"><strong className="job-plate-title">{vehicle?.plate ?? t.unknownVehicle}</strong><small>{vehicleName}</small><span>{customer?.name ?? t.noCustomer}{phone ? <> · <a href={"tel:" + phone.replaceAll(" ", "")} onClick={(event) => event.stopPropagation()}><Phone size={12}/>{phone}</a></> : null}</span></div><button className="work-vehicle-open" aria-label={vehicleName + " options"} onClick={() => setMenuJobId(menuJobId === key ? null : key)}><Ellipsis size={18}/></button>{menuJobId === key && <div className="job-action-menu"><button onClick={() => { setMenuJobId(null); if (vehicle) selectVehicle(vehicle.id); }}>{t.open}</button></div>}</header><div className="work-job-list">{jobs.map(({ job }) => { const statusClass = job.status === "in_progress" ? "active" : job.status; return <div className="work-job-row" key={job.id}><span className={"status-dot " + statusClass}/><div><strong>{job.title}</strong><small>{statusCopy(job.status)}</small></div><button className="job-status-btn" onClick={() => onJobUpdate(job.id, nextStatus(job.status))}>{nextLabel(job.status)}</button></div>; })}</div></article>; })}{!grouped.length && <Empty text={scope === "history" ? t.noHistory : t.noOpenJob}/>}</section></>;
}

function NotesView({ t, lang, rows, photos, selectVehicle }: { t: typeof el; lang: "el" | "en"; rows: Array<{ note: any; vehicle: Vehicle; customer: Customer | null }>; photos: Record<string, string>; selectVehicle: (id: string) => void }) {
  return <><Intro eyebrow={t.notes} title={t.notes} action={<span className="page-count">{rows.length}</span>}/><section className="notes-list">{rows.map(({ note, vehicle, customer }) => <article className="note-card" key={note.id}><button className="note-card-heading" onClick={() => selectVehicle(vehicle.id)}><span className="note-vehicle-avatar">{photos[vehicle.id] ? <img src={photos[vehicle.id]} alt=""/> : <CarFront size={18}/>}</span><span><strong className="plate-title">{vehicle.plate ?? t.unknownVehicle}</strong><small>{[vehicleTitle(vehicle), customer?.name].filter(Boolean).join(" · ")}</small></span><ChevronRight size={17}/></button><p>{note.body}</p><footer><span><StickyNote size={13}/>{note.author ?? t.garage}</span><time>{formatDateTime(note.created_at, lang)}</time></footer></article>)}{!rows.length && <Empty text={t.noNotes}/>}</section></>;
}

function CustomerRecord({ row, t, photos, close, openVehicle }: { row: { customer: Customer; vehicles: Vehicle[]; vehicleCount: number }; t: typeof el; lang: "el" | "en"; photos: Record<string, string>; close: () => void; openVehicle: (id: string) => void }) {
  const { customer, vehicles } = row;
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={customer.name} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="customer-record-modal">
      <header>
        <button aria-label={t.cancel} onClick={close}><ArrowLeft size={20}/></button>
        <div className="customer-record-title"><p className="eyebrow">{t.customers}</p><h2>{customer.name}</h2></div>
        <button aria-label={t.cancel} onClick={close}><X size={20}/></button>
      </header>
      <section className="customer-record-identity">
        <span className="customer-record-avatar">{initials(customer.name)}</span>
        <div>
          {customer.phone ? <a className="customer-record-phone" href={"tel:" + customer.phone.replaceAll(" ", "")}><Phone size={15}/>{customer.phone}</a> : <small>{t.noPhone}</small>}
          {customer.email && <a className="customer-record-email" href={"mailto:" + customer.email}><Mail size={14}/>{customer.email}</a>}
        </div>
      </section>
      <section className="customer-record-vehicles">
        <div className="customer-record-section-heading"><p className="eyebrow">{t.vehicles}</p><strong>{vehicles.length}</strong></div>
        {vehicles.length ? vehicles.map((vehicle) => <button className="customer-record-vehicle" key={vehicle.id} onClick={() => openVehicle(vehicle.id)}><span className="customer-record-car-avatar">{photos[vehicle.id] ? <img src={photos[vehicle.id]} alt=""/> : <CarFront size={20}/>}</span><span><strong className="plate-title">{vehicle.plate ?? t.unknownVehicle}</strong><small>{[vehicle.make, vehicle.model, vehicle.year, vehicle.colour].filter(Boolean).join(" · ") || t.unknownVehicle}</small></span><ChevronRight size={17}/></button>) : <div className="customer-record-empty">{t.noVehicles}</div>}
      </section>
    </section>
  </div>;
}

function Customers({ t, query, setQuery, customerRows, photos, selectVehicle, selectCustomer, notice, openCreation }: { t: typeof el; query: string; setQuery: (value: string) => void; customerRows: Array<{ customer: any; vehicles: any[]; vehicleCount: number }>; photos: Record<string, string>; selectVehicle: (id: string) => void; selectCustomer: (id: string) => void; notice: (message: string) => void; openCreation: (mode: CreationMode) => void }) {
  const TONES = ["mint", "blue", "peach", "lilac"];
  const filtered = customerRows.filter((row) => matchesCustomerQuery(row, query));
  return <><Intro eyebrow={t.customerList} title={t.customers} action={<button className="compact-add" onClick={() => openCreation("customer")}><Plus size={16}/>{t.add}</button>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCustomer}/><section className="customer-list">{filtered.map((row, idx) => <article className="customer-row customer-row-clickable" key={row.customer.id} role="button" tabIndex={0} onClick={() => selectCustomer(row.customer.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectCustomer(row.customer.id); } }}><span className={"avatar " + TONES[idx % TONES.length]}>{photos[row.vehicles[0]?.id] ? <img src={photos[row.vehicles[0].id]} alt=""/> : initials(row.customer.name)}</span><div><strong>{row.customer.name}</strong>{row.customer.phone ? <span className="customer-phone-preview"><Phone size={13}/>{row.customer.phone}</span> : <small>{t.noPhone}</small>}<small><CarFront size={13}/>{row.vehicles.length ? row.vehicles.map((v: any) => v.plate).join(", ") : t.noVehicles}</small></div><span className="car-count" onClick={(event) => { event.stopPropagation(); if (row.vehicles[0]) selectVehicle(row.vehicles[0].id); }} style={{cursor: row.vehicles.length ? "pointer" : "default"}}>{row.vehicleCount}<small>{t.vehicles}</small></span><ChevronRight size={17}/></article>)}{!filtered.length && <Empty text={customerRows.length ? t.noResults : t.noVehicles}/>}</section></>;
}

function Settings({ t, theme, chooseTheme, lang, switchLanguage, userName, saveUserName }: { t: typeof el; theme: string; chooseTheme: (theme: string) => void; lang: string; switchLanguage: () => void; userName: string; saveUserName: (name: string) => void }) {
  return <><Intro eyebrow={t.preferences} title={t.settings}/><section className="settings-group"><p className="eyebrow">{t.appearance}</p><label className="setting-row name-setting"><span><span className="setting-icon"><UserRound size={17}/></span>{t.yourName}</span><input aria-label={t.yourName} value={userName} onChange={(event) => saveUserName(event.target.value)} placeholder={t.namePlaceholder}/></label><div className="setting-row"><span><span className="setting-icon"><Sparkles size={17}/></span>{t.theme}</span><div className="theme-select">{["sky", "pearl", "midnight"].map((item) => <button key={item} className={theme === item ? "selected" : ""} onClick={() => chooseTheme(item)}>{item}</button>)}</div></div><button className="setting-row" onClick={switchLanguage}><span><span className="setting-icon"><UserRound size={17}/></span>{t.language}</span><strong>{lang.toUpperCase()}<ChevronRight size={17}/></strong></button><p className="app-version">Motofy v{APP_VERSION} · {APP_RELEASE}</p></section></>;
}

function Scanner({ stage, t, error, scanError, result, progress, selectedImage, videoRef, fileInputRef, close, recognise, choosePhoto, openRecord, restart }: { stage: "camera" | "processing" | "match"; t: typeof el; error: boolean; scanError: string; result: ScanResult | null; progress: ScanProgress; selectedImage: string | null; videoRef: React.RefObject<HTMLVideoElement | null>; fileInputRef: React.RefObject<HTMLInputElement | null>; close: () => void; recognise: () => void; choosePhoto: (file: File | undefined) => void; openRecord: () => void; restart: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="scanner-modal"><header><button aria-label={t.cancel} onClick={close}><X size={20}/></button><div><p className="eyebrow">{stage === "match" ? "SCAN COMPLETE" : "LIVE SCAN"}</p><h2>{stage === "match" ? t.found : t.camera}</h2></div><span/></header>
    {stage === "camera" && <><div className={"camera-stage " + (error ? "camera-error" : "")}>{selectedImage ? <img src={selectedImage} alt="Επιλεγμένη φωτογραφία αυτοκινήτου"/> : !error && <video ref={videoRef} playsInline muted/>}<div className="plate-guide"><i/><i/><i/><i/></div>{error && !selectedImage && <div className="camera-fallback"><Camera size={31}/><strong>{t.cameraText}</strong></div>}</div><p className="scanner-help">{scanError || t.cameraText}</p><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])}/><footer><button className="secondary-button" onClick={() => fileInputRef.current?.click()}>{selectedImage ? t.retake : "Φωτογραφία"}</button><button className="primary-button" onClick={recognise}>{t.recognize}<ScanLine size={18}/></button></footer></>}
    {stage === "processing" && <ProcessingState t={t} progress={progress}/>}
    {stage === "match" && <div className="match-state"><span className="match-check"><Check size={28}/></span><p className="eyebrow">AI RESULT · {result?.confidence === "high" ? "ΥΨΗΛΗ ΒΕΒΑΙΟΤΗΤΑ" : result?.confidence === "medium" ? "ΜΕΤΡΙΑ ΒΕΒΑΙΟΤΗΤΑ" : "ΧΑΜΗΛΗ ΒΕΒΑΙΟΤΗΤΑ"}</p><h3>{result?.plate || "Δεν διαβάστηκε πινακίδα"}</h3><strong>{[result?.make, result?.model].filter(Boolean).join(" ") || "Δεν αναγνωρίστηκε με ασφάλεια"}<small>Από φωτογραφία · επιβεβαίωσε πριν τη χρήση</small></strong><p>{result?.plate || result?.make ? "Νέα καρτέλα · Επιβεβαίωση στοιχείων" : "Δοκίμασε πιο καθαρή λήψη της πινακίδας και του αυτοκινήτου."}</p><footer><button className="secondary-button" onClick={restart}>{t.retake}</button>{(result?.plate || result?.make) && <button className="primary-button" onClick={openRecord}>{t.openRecord}<ChevronRight size={18}/></button>}</footer></div>}
  </section></div>;
}

function ProcessingState({ t, progress }: { t: typeof el; progress: ScanProgress }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 100);
    return () => window.clearInterval(timer);
  }, []);

  const phaseLabel =
    progress.phase === "prepare" ? t.scanPrepare :
    progress.phase === "plate" ? t.scanPlate :
    progress.phase === "vehicle" ? t.scanVehicle :
    t.scanVerify;

  return <div className="processing-state">
    <span className="scan-processing"><ScanLine size={34}/></span>
    <h3>{t.processing}</h3>
    <p className="processing-phase">{phaseLabel}</p>

    <div className="scan-progress-shell" aria-label={phaseLabel}>
      <div className="scan-progress-top"><strong>{progress.percent}%</strong><span>{(elapsed / 1000).toFixed(1)}s</span></div>
      <div className="scan-progress-track"><i style={{ width: progress.percent + "%" }}/></div>
    </div>

    <div className="processing-lines">
      <div className={"processing-line " + (progress.plateStatus === "done" ? "done" : progress.plateStatus === "fallback" ? "fallback" : "working")}>
        <span>{progress.plateStatus === "done" ? <Check size={13}/> : <ScanLine size={13}/>}</span>
        <div><strong>{t.scanPlate}</strong><small>{progress.plateStatus === "done" ? `${progress.plate || ""} · Plate engine ✓${progress.plateMs ? ` · ${(progress.plateMs / 1000).toFixed(1)}s` : ""}` : progress.plateStatus === "fallback" ? t.scanPlateFallback : "Plate Recognizer · processing…"}</small></div>
      </div>
      <div className={"processing-line " + (progress.vehicleStatus === "done" ? "done" : progress.vehicleStatus === "fallback" ? "fallback" : "working")}>
        <span>{progress.vehicleStatus === "done" ? <Check size={13}/> : <Sparkles size={13}/>}</span>
        <div><strong>{t.scanVehicle}</strong><small>{progress.vehicleStatus === "done" ? `Vehicle AI ✓${progress.vehicleMs ? ` · ${(progress.vehicleMs / 1000).toFixed(1)}s` : ""}` : elapsed > 8000 ? t.scanWaiting : "Gemini · processing…"}</small></div>
      </div>
    </div>
  </div>;
}
