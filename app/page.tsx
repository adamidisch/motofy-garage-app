"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Camera, CarFront, Check, ChevronRight, ClipboardCheck, ClipboardList, Clock3, Ellipsis, LayoutGrid, MoreHorizontal, Phone, Plus, ScanLine, Search, Settings2, Sparkles, StickyNote, UserRound, Wrench, X } from "lucide-react";

import { createBrowserStorage, createRepository } from "../lib/data/repository.mjs";
import { buildVehicleListRow, buildVehicleRecord, formatMileage, formatTodayLabel, matchesVehicleQuery } from "../lib/data/vehicle-record.mjs";
import type { Repository } from "../lib/data/repository.d.mts";
import type { VehicleListRow } from "../lib/data/vehicle-record.d.mts";
import VehicleRecord from "./vehicle-record";
import CreationModal, { type CreationMode } from "./creation-flows";

type View = "home" | "cars" | "work" | "customers" | "settings";
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

const APP_VERSION = "0.2.2";
const APP_RELEASE = "Phase 1";


const jobs = [
  { car: "Ford Fiesta", plate: "ΚΜΝ 246", title: "Αλλαγή λαδιών & φίλτρου", time: "14:30", status: "scheduled", owner: "Μιχάλης Σάββα" },
  { car: "BMW 320i", plate: "ΚΜΡ 714", title: "Διάγνωση check engine", time: "Σε εξέλιξη", status: "active", owner: "Ανδρέας Χρίστου" },
  { car: "Toyota Yaris", plate: "ΚΒΥ 328", title: "Ετήσιο service", time: "Ολοκληρώθηκε · 11:20", status: "done", owner: "Μάριος Παναγή" },
];

const customers = [
  { initials: "ΜΠ", name: "Μάριος Παναγή", phone: "99 842 111", car: "Toyota Yaris · ΚΒΥ 328", count: 1, tone: "mint" },
  { initials: "ΑΧ", name: "Ανδρέας Χρίστου", phone: "96 104 842", car: "BMW 320i · ΚΜΡ 714", count: 2, tone: "blue" },
  { initials: "ΕΑ", name: "Ελένη Αντωνίου", phone: "99 201 670", car: "Mercedes A200 · ΜΡΑ 402", count: 1, tone: "peach" },
  { initials: "ΜΣ", name: "Μιχάλης Σάββα", phone: "97 016 404", car: "Ford Fiesta · ΚΜΝ 246", count: 1, tone: "lilac" },
];

const el = { scanPrepare: "Προετοιμασία φωτογραφίας", scanPlate: "Ανάγνωση πινακίδας", scanVehicle: "Αναγνώριση οχήματος", scanVerify: "Επιβεβαίωση αποτελέσματος", scanPlateFallback: "Ο γρήγορος έλεγχος δεν ολοκληρώθηκε · συνεχίζει το AI", scanWaiting: "Το AI χρειάζεται λίγο περισσότερο χρόνο…", today: "ΣΗΜΕΡΑ · 2 ΣΕΠ", hello: "Καλησπέρα, Ανδρέα", subtitle: "Τι δουλειά έχουμε σήμερα;", scan: "Σάρωση αυτοκινήτου", scanTitle: "Σκάναρε το αυτοκίνητο", scanText: "Πινακίδα, πελάτης και ιστορικό — αμέσως μπροστά σου.", home: "Αρχική", cars: "Αυτοκίνητα", work: "Εργασίες", customers: "Πελάτες", add: "Προσθήκη", appointment: "Ραντεβού", notes: "Σημειώσεις", jobs: "Εργασίες", activity: "Πρόσφατη κίνηση", garage: "Συνεργείο", all: "Όλα", open: "Άνοιγμα", newCar: "Νέο αυτοκίνητο", newJob: "Νέα εργασία", newCustomer: "Νέος πελάτης", newNote: "Νέα σημείωση", settings: "Ρυθμίσεις", signout: "Έξοδος", camera: "Κάμερα πινακίδας", cameraText: "Βάλε την πινακίδα μέσα στο πλαίσιο και πάτα Αναγνώριση.", recognize: "Αναγνώριση", demo: "Χρήση demo εικόνας", cancel: "Ακύρωση", processing: "Διαβάζουμε την πινακίδα…", found: "Βρέθηκε όχημα", openRecord: "Άνοιγμα καρτέλας", retake: "Νέα λήψη", searchCar: "Αναζήτηση πινακίδας ή αυτοκινήτου", searchCustomer: "Αναζήτηση πελάτη", allCars: "Όλα τα αυτοκίνητα", activeJobs: "Εργασίες σήμερα", customerList: "Οι πελάτες σου", noResults: "Δεν βρέθηκε αποτέλεσμα", vehicle: "Καρτέλα οχήματος", owner: "Πελάτης", mileage: "Χιλιόμετρα", currentWork: "Τρέχουσα εργασία", note: "Σημείωση", appearance: "Εμφάνιση", theme: "Theme", language: "Γλώσσα", preferences: "Ρυθμίσεις συνεργείου", saved: "Αποθηκεύτηκε", progress: "Σε εξέλιξη", history: "Ιστορικό", vehicles: "οχήματα", overview: "Επισκόπηση", todayFilter: "Σήμερα", lastActivity: "Τελευταία κίνηση", noCustomer: "Χωρίς πελάτη", noCustomerHint: "Το όχημα δεν έχει συνδεθεί με πελάτη ακόμα.", noJobs: "Καμία εργασία", noJobsHint: "Δεν έχει καταγραφεί εργασία για αυτό το όχημα.", noOpenJob: "Καμία ανοιχτή εργασία", noOpenJobHint: "Τίποτα σε εξέλιξη αυτή τη στιγμή.", noHistory: "Χωρίς ιστορικό", noNotes: "Καμία σημείωση", noNotesHint: "Οι σημειώσεις του συνεργείου θα εμφανίζονται εδώ.", noPhone: "Χωρίς τηλέφωνο", otherVehicles: "Άλλα οχήματα", onlyVehicle: "Μοναδικό όχημα του πελάτη", unknownVehicle: "Όχημα χωρίς στοιχεία", photos: "φωτογραφίες", scanDiffers: "Η σάρωση διάβασε διαφορετικά στοιχεία", scanUnconfirmed: "Στοιχεία από σάρωση", keepExisting: "Η καρτέλα δεν άλλαξε. Η επιβεβαίωση γίνεται χειροκίνητα.", confirmLater: "Δεν έχουν επιβεβαιωθεί ακόμα.", fieldMake: "Μάρκα", fieldModel: "Μοντέλο", statusScheduled: "Προγραμματισμένη", statusInProgress: "Σε εξέλιξη", statusDone: "Ολοκληρώθηκε", statusCancelled: "Ακυρώθηκε", activityScan: "Σάρωση πινακίδας", activityCreated: "Δημιουργία καρτέλας", newVehiclePending: "Νέο όχημα — η δημιουργία έρχεται στο επόμενο βήμα", noVehicles: "Κανένα όχημα ακόμα", plate: "Πινακίδα", optional: "Προαιρετικό", scanPrefilled: "Συμπληρώθηκε από τη σάρωση", createRecord: "Δημιουργία καρτέλας", customerHint: "Τα στοιχεία αποθηκεύονται στο συνεργείο", customerName: "Όνομα πελάτη", phone: "Τηλέφωνο", createCustomer: "Δημιουργία πελάτη", service: "Service", inspection: "Έλεγχος", repair: "Επισκευή", other: "Άλλο", jobTitle: "Εργασία", createJob: "Δημιουργία εργασίας", notePlaceholder: "Γράψε μια σύντομη σημείωση…", createNote: "Αποθήκευση σημείωσης", vehicleCreated: "Η καρτέλα δημιουργήθηκε", customerCreated: "Ο πελάτης δημιουργήθηκε", jobCreated: "Η εργασία δημιουργήθηκε", noteCreated: "Η σημείωση αποθηκεύτηκε", creationError: "Δεν ολοκληρώθηκε η αποθήκευση", undo: "Αναίρεση", yourName: "Το όνομά σου", namePlaceholder: "Γράψε το όνομά σου" };
const en = { scanPrepare: "Preparing photo", scanPlate: "Reading plate", scanVehicle: "Identifying vehicle", scanVerify: "Verifying result", scanPlateFallback: "Fast plate check did not complete · AI is continuing", scanWaiting: "The AI needs a little more time…", today: "TODAY · SEP 2", hello: "Good evening, Andreas", subtitle: "What needs moving today?", scan: "Scan vehicle", scanTitle: "Scan the car", scanText: "Plate, customer and history — ready when you are.", home: "Home", cars: "Cars", work: "Jobs", customers: "Customers", add: "Add", appointment: "Appointments", notes: "Notes", jobs: "Jobs", activity: "Recent activity", garage: "Garage", all: "All", open: "Open", newCar: "New car", newJob: "New job", newCustomer: "New customer", newNote: "New note", settings: "Settings", signout: "Sign out", camera: "Plate camera", cameraText: "Place the plate in frame then tap Recognise.", recognize: "Recognise", demo: "Use demo image", cancel: "Cancel", processing: "Reading the plate…", found: "Vehicle found", openRecord: "Open record", retake: "Retake", searchCar: "Search plate or vehicle", searchCustomer: "Search customer", allCars: "All vehicles", activeJobs: "Today’s jobs", customerList: "Your customers", noResults: "No results found", vehicle: "Vehicle record", owner: "Customer", mileage: "Mileage", currentWork: "Current job", note: "Note", appearance: "Appearance", theme: "Theme", language: "Language", preferences: "Garage settings", saved: "Saved", progress: "In progress", history: "History", vehicles: "vehicles", overview: "Overview", todayFilter: "Today", lastActivity: "Last activity", noCustomer: "No customer", noCustomerHint: "This vehicle is not linked to a customer yet.", noJobs: "No jobs", noJobsHint: "Nothing has been recorded for this vehicle.", noOpenJob: "No open job", noOpenJobHint: "Nothing in progress right now.", noHistory: "No history", noNotes: "No notes", noNotesHint: "Garage notes will appear here.", noPhone: "No phone number", otherVehicles: "Other vehicles", onlyVehicle: "The customer's only vehicle", unknownVehicle: "Vehicle without details", photos: "photos", scanDiffers: "The scan read different details", scanUnconfirmed: "Details from a scan", keepExisting: "The record is unchanged. Confirming is a manual step.", confirmLater: "Not confirmed yet.", fieldMake: "Make", fieldModel: "Model", statusScheduled: "Scheduled", statusInProgress: "In progress", statusDone: "Completed", statusCancelled: "Cancelled", activityScan: "Plate scan", activityCreated: "Record created", newVehiclePending: "New vehicle — creation arrives in the next step", noVehicles: "No vehicles yet", plate: "Plate", optional: "Optional", scanPrefilled: "Filled from the scan", createRecord: "Create vehicle record", customerHint: "The details are saved to this garage", customerName: "Customer name", phone: "Phone", createCustomer: "Create customer", service: "Service", inspection: "Inspection", repair: "Repair", other: "Other", jobTitle: "Job", createJob: "Create job", notePlaceholder: "Write a short note…", createNote: "Save note", vehicleCreated: "Vehicle record created", customerCreated: "Customer created", jobCreated: "Job created", noteCreated: "Note saved", creationError: "Could not save this yet", undo: "Undo", yourName: "Your name", namePlaceholder: "Enter your name" };

export default function Home() {
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [scanForRecord, setScanForRecord] = useState<ScanResult | null>(null);
  const [creation, setCreation] = useState<CreationMode | null>(null);
  const [creationScan, setCreationScan] = useState<ScanResult | null>(null);
  const [creationVehicleId, setCreationVehicleId] = useState<string | null>(null);
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
  function selectView(next: View) { setView(next); setQuery(""); setMenuOpen(false); setAddOpen(false); }

  function refreshRepository() {
    setRepository(createRepository({ storage: createBrowserStorage() }));
  }
  function openCreation(mode: CreationMode, scan: ScanResult | null = null, vehicleId: string | null = null) {
    setAddOpen(false); setMenuOpen(false); setCreationScan(scan); setCreationVehicleId(vehicleId); setCreation(mode);
  }
  function finishCreation(message: string, vehicleId?: string) {
    const undo = repository?.peekUndo();
    refreshRepository(); setCreation(null); setCreationScan(null); setCreationVehicleId(null); notice(message, undo ? () => { repository?.undo(); refreshRepository(); setToast(""); setToastAction(null); } : undefined);
    if (vehicleId) { setSelectedVehicleId(vehicleId); setView("cars"); }
  }
  function createVehicleFromFlow(draft: { plate: string; make: string | null; model: string | null; mileage_km: number | null; customer_id: string | null }) {
    if (!repository) return;
    try {
      const vehicle = repository.createVehicle({ ...draft, confirmed_at: creationScan ? new Date().toISOString() : null, scan_make: creationScan?.make ?? null, scan_model: creationScan?.model ?? null, scan_confidence: creationScan?.confidence ?? null, scan_provider: creationScan?.provider ?? null, scanned_at: creationScan ? new Date().toISOString() : null });
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

  const vehicleRows: VehicleListRow[] = repository
    ? repository.listVehicles().map((vehicle) => buildVehicleListRow(repository, vehicle))
    : [];
  const openRecord = repository && selectedVehicleId
    ? buildVehicleRecord({ repository, vehicleId: selectedVehicleId, scan: scanForRecord })
    : null;

  useEffect(() => {
    const savedLang = localStorage.getItem("motofy-language");
    const savedTheme = localStorage.getItem("motofy-theme");
    const savedName = localStorage.getItem("motofy-user-name");
    const timer = window.setTimeout(() => { if (savedLang === "el" || savedLang === "en") setLang(savedLang); if (savedTheme) setTheme(savedTheme); if (savedName) setUserName(savedName); }, 0);
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) { setMenuOpen(false); setAddOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setAddOpen(false); setCreation(null); setCreationScan(null); setCreationVehicleId(null); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setScanner(null); setCameraError(false); setSelectedVehicleId(null); setScanForRecord(null); } };
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
  }, [scanner, selectedVehicleId]);

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
    if (!existing) { closeScanner(); openCreation("vehicle", scanResult); return; }
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
        <div className="top-actions"><button className="language" onClick={switchLanguage}>ΕΛ <span>/</span> EN</button><button className="icon-button" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }} aria-label={t.add}><Plus size={20}/></button><button className="icon-button" onClick={() => { setMenuOpen(!menuOpen); setAddOpen(false); }} aria-label="Menu"><MoreHorizontal size={21}/></button></div>
        {addOpen && <div className="action-popover add-popover"><button onClick={() => openCreation("vehicle")}><CarFront size={16}/>{t.newCar}</button><button onClick={() => openCreation("job")}><Wrench size={16}/>{t.newJob}</button><button onClick={() => openCreation("customer")}><UserRound size={16}/>{t.newCustomer}</button><button onClick={() => openCreation("note")}><StickyNote size={16}/>{t.newNote}</button></div>}
        {menuOpen && <div className="action-popover menu-popover"><button onClick={() => selectView("settings")}><Settings2 size={16}/>{t.settings}</button><button onClick={() => notice(t.signout)}><X size={16}/>{t.signout}</button></div>}
      </header>
      <div className="content">
        {view === "home" && <Dashboard t={t} lang={lang} todayLabel={formatTodayLabel(new Date(), lang)} startScanner={startScanner} selectView={selectView} notice={notice}/>}
        {view === "cars" && <Cars t={t} lang={lang} query={query} setQuery={setQuery} rows={vehicleRows} selectVehicle={setSelectedVehicleId}/>}
        {view === "work" && <Work t={t} notice={notice}/>}
        {view === "customers" && <Customers t={t} query={query} setQuery={setQuery} notice={notice}/>}
        {view === "settings" && <Settings t={t} theme={theme} chooseTheme={chooseTheme} lang={lang} switchLanguage={switchLanguage} userName={userName} saveUserName={saveUserName}/>}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "selected" : ""} onClick={() => selectView(id)}><Icon size={20}/><span>{label}</span></button>)}<button className="nav-add" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }}><span><Plus size={22}/></span><small>{t.add}</small></button></nav>
    </section>
    {scanner && <Scanner stage={scanner} t={t} error={cameraError} scanError={scanError} result={scanResult} progress={scanProgress} selectedImage={selectedImage} videoRef={videoRef} fileInputRef={fileInputRef} close={closeScanner} recognise={recognise} choosePhoto={choosePhoto} openRecord={openFoundCar} restart={startScanner}/>}
    {openRecord && (
      <VehicleRecord record={openRecord} t={t} lang={lang} close={() => { setSelectedVehicleId(null); setScanForRecord(null); }} openVehicle={(id) => { setScanForRecord(null); setSelectedVehicleId(id); }}/>
    )}
    {creation && repository && (
      <CreationModal mode={creation} repository={repository} t={t} initialScan={creationScan} initialVehicleId={creationVehicleId} close={() => { setCreation(null); setCreationScan(null); setCreationVehicleId(null); }} onCreateVehicle={createVehicleFromFlow} onCreateCustomer={createCustomerFromFlow} onCreateJob={createJobFromFlow} onCreateNote={createNoteFromFlow}/>
    )}
    {toast && <div className="toast"><Check size={16}/><span>{toast}</span>{toastAction && <button onClick={toastAction}>{t.undo}</button>}</div>}
  </main>;
}

function Dashboard({ t, lang, todayLabel, startScanner, selectView, notice }: { t: typeof el; lang: "el" | "en"; todayLabel: string; startScanner: () => void; selectView: (view: View) => void; notice: (message: string) => void }) {
  return <><section className="intro-row"><div><p className="eyebrow">{todayLabel}</p><h1>{greeting(lang, userName)}</h1><p className="intro-copy">{t.subtitle}</p></div><button className="notification"><Bell size={18}/><i/></button></section>
    <section className="scan-card"><div className="scan-orb"><ScanLine size={30}/></div><div className="scan-copy"><span className="pill"><Sparkles size={13}/> AI READY</span><h2>{t.scanTitle}</h2><p>{t.scanText}</p></div><button className="scan-button" onClick={startScanner}>{t.scan}<span><Camera size={16}/></span></button></section>
    <section className="metrics"><button onClick={() => selectView("work")}><span className="metric-icon indigo"><CalendarDays size={18}/></span><div><strong>4</strong><p>{t.appointment}</p></div></button><button onClick={() => notice(t.note)}><span className="metric-icon aqua"><StickyNote size={18}/></span><div><strong>2</strong><p>{t.notes}</p></div></button><button onClick={() => selectView("work")}><span className="metric-icon gold"><ClipboardCheck size={18}/></span><div><strong>6</strong><p>{t.jobs}</p></div></button></section>
    <section className="section-heading"><div><p className="eyebrow">{t.activity}</p><h2>{t.garage}</h2></div><button onClick={() => selectView("work")}>{t.all}<ChevronRight size={15}/></button></section>
    <section className="activity-list">{jobs.map((job, index) => <button className="activity" key={job.car} onClick={() => selectView("work")}><span className={"activity-icon " + (index === 0 ? "lilac" : index === 1 ? "blue" : "mint")}>{index === 1 ? <Wrench size={18}/> : index === 2 ? <Check size={18}/> : <Clock3 size={18}/>}</span><span className="activity-text"><strong>{job.car}</strong><small>{job.title} · {job.time}</small></span><Ellipsis size={18}/></button>)}</section>
  </>;
}

function Intro({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) { return <section className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</section>; }
function SearchBox({ value, setValue, placeholder }: { value: string; setValue: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={18}/><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder}/>{value && <button aria-label="Clear search" onClick={() => setValue("")}><X size={16}/></button>}</label>; }
function Empty({ text }: { text: string }) { return <div className="empty-inline"><Search size={20}/>{text}</div>; }

function Cars({ t, lang, query, setQuery, rows, selectVehicle }: { t: typeof el; lang: "el" | "en"; query: string; setQuery: (value: string) => void; rows: VehicleListRow[]; selectVehicle: (vehicleId: string) => void }) {
  const filtered = rows.filter((row) => matchesVehicleQuery(row, query));
  const tones = ["mint", "blue", "peach", "lilac"];
  return <><Intro eyebrow={t.allCars} title={t.cars} action={<span className="page-count">{rows.length}</span>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCar}/><section className="vehicle-list">{filtered.map((row, index) => <button className="vehicle-row" key={row.vehicle.id} onClick={() => selectVehicle(row.vehicle.id)}><span className={"vehicle-badge " + tones[index % tones.length]}><CarFront size={19}/></span><span className="vehicle-text"><strong>{row.title ?? t.unknownVehicle}<small>{[row.subtitle, row.vehicle.plate].filter(Boolean).join(" · ")}</small></strong><small>{[row.customer?.name ?? t.noCustomer, row.vehicle.mileage_km !== null ? formatMileage(row.vehicle.mileage_km, lang) : null].filter(Boolean).join(" · ")}</small><em>{row.currentJob?.title ?? t.noOpenJob}</em></span><ChevronRight size={18}/></button>)}{!filtered.length && <Empty text={rows.length ? t.noResults : t.noVehicles}/>}</section></>;
}

function Work({ t, notice }: { t: typeof el; notice: (message: string) => void }) {
  const [scope, setScope] = useState<"today" | "active" | "history">("today");
  const visibleJobs = scope === "today" ? jobs : jobs.filter((job) => scope === "active" ? job.status === "active" : job.status === "done");
  return <><Intro eyebrow={t.activeJobs} title={t.work} action={<button className="compact-add" onClick={() => notice(t.newJob)}><Plus size={16}/>{t.add}</button>}/><div className="filter-tabs"><button className={scope === "today" ? "active" : ""} onClick={() => setScope("today")}>{t.todayFilter}</button><button className={scope === "active" ? "active" : ""} onClick={() => setScope("active")}>{t.progress}</button><button className={scope === "history" ? "active" : ""} onClick={() => setScope("history")}>{t.history}</button></div><section className="job-list">{visibleJobs.map((job) => <article className="job-card" key={job.car}><div className="job-top"><span className={"status-dot " + job.status}/><strong>{job.car}<small>{job.plate} · {job.owner}</small></strong><button aria-label={job.car + " options"} onClick={() => notice(job.car)}><Ellipsis size={18}/></button></div><p>{job.title}</p><footer><span className={"status-label " + job.status}>{job.time}</span><button onClick={() => notice(t.open)}>{t.open}<ChevronRight size={15}/></button></footer></article>)}</section></>;
}

function Customers({ t, query, setQuery, notice }: { t: typeof el; query: string; setQuery: (value: string) => void; notice: (message: string) => void }) {
  const filtered = customers.filter((customer) => (customer.name + customer.car).toLowerCase().includes(query.toLowerCase()));
  return <><Intro eyebrow={t.customerList} title={t.customers} action={<button className="compact-add" onClick={() => notice(t.newCustomer)}><Plus size={16}/>{t.add}</button>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCustomer}/><section className="customer-list">{filtered.map((customer) => <article className="customer-row" key={customer.name}><span className={"avatar " + customer.tone}>{customer.initials}</span><div><strong>{customer.name}</strong><a href={"tel:" + customer.phone.replaceAll(" ", "")}><Phone size={13}/>{customer.phone}</a><small><CarFront size={13}/>{customer.car}</small></div><span className="car-count">{customer.count}<small>{t.vehicles}</small></span></article>)}{!filtered.length && <Empty text={t.noResults}/>}</section></>;
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
