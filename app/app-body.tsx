"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, MoreHorizontal, Plus, Settings2, X, CarFront, Wrench, UserRound, StickyNote, Check, ClipboardList } from "lucide-react";
import { requestNormalizedName, storeGreeting } from "./name-client";
import { createBrowserStorage, createRepository } from "../lib/data/repository.mjs";
import { buildCustomerRow, buildDashboardSummary, buildJobRow, buildVehicleListRow, buildVehicleRecord, formatTodayLabel } from "../lib/data/vehicle-record.mjs";
import type { Repository } from "../lib/data/repository.d.mts";
import type { VehicleListRow } from "../lib/data/vehicle-record.d.mts";
import type { Customer, Job, Vehicle } from "../lib/data/schema.d.mts";
import VehicleRecord from "./vehicle-record";
import { loadPhotos, savePhoto } from "../lib/data/photo-store.mjs";
import CreationModal, { type CreationMode } from "./creation-flows";
import { el, en } from "./i18n";
import { Scanner } from "./scanner-ui";
import { Cars, Customers, Dashboard, Settings, Work } from "./app-views";
import { readGreetName } from "./name-client";

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

const DEMO_SESSION = "__demo__";

function greet(name: string, lang: "el" | "en", now = new Date()): string {
  const morning = now.getHours() < 12;
  const display = readGreetName(name, DEMO_SESSION);
  if (lang === "en") return (morning ? "Good morning, " : "Good evening, ") + display;
  return (morning ? "Καλημέρα, " : "Καλησπέρα, ") + display;
}

const APP_VERSION = "2.1.11";
const APP_RELEASE = "Phase 1";

export function AppBody({ session, onLogout }: { session: string; onLogout: () => void }) {
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
  const [vehiclePhotos, setVehiclePhotos] = useState<Map<string, string|null>>(new Map());
  const [customerPhotos, setCustomerPhotos] = useState<Map<string, string|null>>(new Map());
  const [query, setQuery] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [scanForRecord, setScanForRecord] = useState<ScanResult | null>(null);
  const [creation, setCreation] = useState<CreationMode | null>(null);
  const [creationScan, setCreationScan] = useState<ScanResult | null>(null);
  const [creationVehicleId, setCreationVehicleId] = useState<string | null>(null);
  const [creationPhoto, setCreationPhoto] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<(() => void) | null>(null);
  const repositoryRef = useRef<Repository | null>(null);
  const [, setRepoVersion] = useState(0);
  const repository = repositoryRef.current;
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

  async function syncPhotoMaps(repo: Repository) {
    const vehicleIds = repo.listVehicles().map((vehicle) => vehicle.id);
    const customerIds = repo.listCustomers().map((customer) => customer.id);
    const [vehicles, customers] = await Promise.all([
      loadPhotos("vehicle", vehicleIds),
      loadPhotos("customer", customerIds),
    ]);
    setVehiclePhotos((current) => {
      const next = new Map(current);
      for (const [id, url] of vehicles) if (url && !next.get(id)) next.set(id, url);
      return next;
    });
    setCustomerPhotos((current) => {
      const next = new Map(current);
      for (const [id, url] of customers) if (url && !next.get(id)) next.set(id, url);
      return next;
    });
  }
  function refreshRepository() {
    const repo = repositoryRef.current;
    if (repo) void syncPhotoMaps(repo);
    setRepoVersion((version) => version + 1);
  }
  function openCreation(mode: CreationMode, scan: ScanResult | null = null, vehicleId: string | null = null, photo: string | null = null) {
    setAddOpen(false); setMenuOpen(false); setCreationScan(scan); setCreationVehicleId(vehicleId); setCreationPhoto(photo); setCreation(mode);
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
      const photo = creationPhoto;
      finishCreation(t.vehicleCreated, vehicle.id);
      if (photo) void savePhoto("vehicle", vehicle.id, photo).then(() => setVehiclePhotos((p) => new Map(p).set(vehicle.id, photo))).catch(() => {});
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
    const repo = createRepository({ storage: createBrowserStorage() });
    repositoryRef.current = repo;
    setRepoVersion((version) => version + 1);
    void syncPhotoMaps(repo);
  }, []);

  const vehicleRows: VehicleListRow[] = repository
    ? repository.listVehicles().map((vehicle) => buildVehicleListRow(repository, vehicle))
    : [];

  type JobRow = { job: Job; vehicle: Vehicle | null; customer: Customer | null };
  type CustomerRow = { customer: Customer; vehicles: Vehicle[]; vehicleCount: number };

  const jobRows: JobRow[] = repository
    ? repository.listOpenJobs().concat(
        repository.listVehicles().flatMap((v) =>
          repository.listJobsByVehicle(v.id, { status: "done" })
            .concat(repository.listJobsByVehicle(v.id, { status: "cancelled" }))
        )
      ).filter((job, index, arr) => arr.findIndex((j) => j.id === job.id) === index)
       .map((job) => buildJobRow(repository, job))
    : [];

  const customerRows: CustomerRow[] = repository
    ? repository.listCustomers().map((customer) => buildCustomerRow(repository, customer))
    : [];

  const dashSummary = repository ? buildDashboardSummary(repository) : null;
  const openRecord = repository && selectedVehicleId
    ? buildVehicleRecord({ repository, vehicleId: selectedVehicleId, scan: scanForRecord })
    : null;

  useEffect(() => {
    const savedLang = localStorage.getItem("motofy-language");
    const savedTheme = localStorage.getItem("motofy-theme");
    const savedName = localStorage.getItem("motofy-user-name");
    const timer = window.setTimeout(() => { if (savedLang === "el" || savedLang === "en") setLang(savedLang); if (savedTheme) setTheme(savedTheme); if (savedName) setUserName(savedName); }, 0);
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) { setMenuOpen(false); setAddOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setAddOpen(false); setCreation(null); setCreationScan(null); setCreationVehicleId(null); setCreationPhoto(null); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setScanner(null); setCameraError(false); setSelectedVehicleId(null); setScanForRecord(null); } };
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
  function saveUserName(next: string) { setUserName(next); }
  async function commitUserName(next: string) {
    const trimmed = next.trim();
    setUserName(trimmed);
    if (!trimmed) return;
    const greeting = await requestNormalizedName(trimmed, lang);
    storeGreeting(trimmed, greeting);
    notice(t.saved);
  }
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
    if (!selectedImage) setSelectedImage(image);
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
        ...current, percent: 58, phase: "vehicle",
        plate: plateResult?.plate ?? null, plateMs: plateResult?.elapsedMs ?? null,
        plateStatus: plateResult?.plate ? "done" : "fallback",
      }));
    } catch (error) {
      plateFailure = error;
      setScanProgress((current) => ({ ...current, percent: 58, phase: "vehicle", plateStatus: "fallback" }));
    } finally { window.clearTimeout(plateTimeout); }
    try {
      vehicleResult = await vehiclePromise;
      setScanProgress((current) => ({
        ...current, percent: 92, phase: "verify",
        vehicleMs: vehicleResult?.elapsedMs ?? null, vehicleStatus: "done",
      }));
    } catch (error) {
      vehicleFailure = error;
      setScanProgress((current) => ({ ...current, percent: 92, phase: "verify", vehicleStatus: "fallback" }));
    } finally { window.clearTimeout(vehicleTimeout); }
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
  function openFoundCar() {
    if (!scanResult?.plate || !repository) return;
    const existing = repository.findVehicleByPlate(scanResult.plate);
    const photo = selectedImage;
    if (!existing) { closeScanner(); openCreation("vehicle", scanResult, null, photo); return; }
    closeScanner();
    setScanForRecord(scanResult);
    setSelectedVehicleId(existing.id);
    setView("cars");
    if (photo) void savePhoto("vehicle", existing.id, photo).then(() => setVehiclePhotos((p) => new Map(p).set(existing.id, photo))).catch(() => {});
    notice(t.openRecord);
  }
  const nav = [["home", LayoutGrid, t.home], ["cars", CarFront, t.cars], ["work", ClipboardList, t.work], ["customers", UserRound, t.customers]] as const;

  return <main className={"app-shell theme-" + theme}>
    <section className="phone-canvas">
      <header className="topbar" ref={headerRef}>
        <button className="brand" aria-label="Motofy home" onClick={() => selectView("home")}><span className="brand-mark"><img src="/icon.svg" alt="" width={28} height={28}/></span><span>motofy</span><span className="brand-ver">v{APP_VERSION}</span></button>
        <div className="top-actions"><button className="lang-toggle" onClick={switchLanguage} aria-label={t.language}><span className={lang === "el" ? "lt-active" : ""}>ΕΛ</span><span className={lang === "en" ? "lt-active" : ""}>EN</span></button><button className="icon-button" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }} aria-label={t.add}><Plus size={20}/></button><button className="icon-button" onClick={() => { setMenuOpen(!menuOpen); setAddOpen(false); }} aria-label="Menu"><MoreHorizontal size={21}/></button></div>
        {addOpen && <div className="action-popover add-popover"><button onClick={() => openCreation("vehicle")}><CarFront size={16}/>{t.newCar}</button><button onClick={() => openCreation("job")}><Wrench size={16}/>{t.newJob}</button><button onClick={() => openCreation("customer")}><UserRound size={16}/>{t.newCustomer}</button><button onClick={() => openCreation("note")}><StickyNote size={16}/>{t.newNote}</button></div>}
        {menuOpen && <div className="action-popover menu-popover"><button onClick={() => selectView("settings")}><Settings2 size={16}/>{t.settings}</button><button onClick={() => { setMenuOpen(false); onLogout(); }}><X size={16}/>{t.signout}</button></div>}
      </header>
      <div className="content">
        {view === "home" && <Dashboard t={t} lang={lang} session={session} greeting={greet(session, lang)} todayLabel={formatTodayLabel(new Date(), lang)} summary={dashSummary} startScanner={startScanner} selectView={selectView} notice={notice}/>}
        {view === "cars" && <Cars t={t} lang={lang} query={query} setQuery={setQuery} rows={vehicleRows} selectVehicle={setSelectedVehicleId} vehiclePhotos={vehiclePhotos}/>}
        {view === "work" && <Work t={t} lang={lang} jobRows={jobRows} selectVehicle={setSelectedVehicleId} notice={notice} openCreation={openCreation} vehiclePhotos={vehiclePhotos} onJobUpdate={(jobId, status) => { if (!repository) return; repository.updateJob(jobId, { status }); const undo = repository.peekUndo(); refreshRepository(); notice(t.jobUpdated, undo ? () => { repository.undo(); refreshRepository(); } : undefined); }}/>}
        {view === "customers" && <Customers t={t} query={query} setQuery={setQuery} customerRows={customerRows} selectVehicle={setSelectedVehicleId} notice={notice} openCreation={openCreation}/>}
        {view === "settings" && <Settings t={t} theme={theme} chooseTheme={chooseTheme} lang={lang} switchLanguage={switchLanguage} userName={userName} saveUserName={saveUserName} commitUserName={commitUserName}/>}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "selected" : ""} onClick={() => selectView(id)}><Icon size={20}/><span>{label}</span></button>)}</nav>
    </section>
    {scanner && <Scanner stage={scanner} t={t} error={cameraError} scanError={scanError} result={scanResult} progress={scanProgress} selectedImage={selectedImage} videoRef={videoRef} fileInputRef={fileInputRef} close={closeScanner} recognise={recognise} choosePhoto={choosePhoto} openRecord={openFoundCar} restart={startScanner}/>}
    {openRecord && (
      <VehicleRecord record={openRecord} t={t} lang={lang} close={() => { setSelectedVehicleId(null); setScanForRecord(null); }} openVehicle={(id) => { setScanForRecord(null); setSelectedVehicleId(id); }} onJobUpdate={(jobId, status) => { if (!repository) return; repository.updateJob(jobId, { status }); const undo = repository.peekUndo(); refreshRepository(); notice(t.jobUpdated, undo ? () => { repository.undo(); refreshRepository(); } : undefined); }} openCreation={openCreation} vehiclePhoto={selectedVehicleId ? (vehiclePhotos.get(selectedVehicleId) ?? null) : null} customerPhoto={openRecord?.customer?.id ? (customerPhotos.get(openRecord.customer.id) ?? null) : null} onVehiclePhotoChange={async (url) => { if (!selectedVehicleId) return; try { await savePhoto("vehicle", selectedVehicleId, url); setVehiclePhotos((p) => new Map(p).set(selectedVehicleId, url)); } catch {} }} onCustomerPhotoChange={async (url) => { const cid = openRecord?.customer?.id; if (!cid) return; try { await savePhoto("customer", cid, url); setCustomerPhotos((p) => new Map(p).set(cid, url)); } catch {} }}/>
    )}
    {creation && repository && (
      <CreationModal mode={creation} repository={repository} t={t} initialScan={creationScan} initialVehicleId={creationVehicleId} close={() => { setCreation(null); setCreationScan(null); setCreationVehicleId(null); setCreationPhoto(null); }} onCreateVehicle={createVehicleFromFlow} onCreateCustomer={createCustomerFromFlow} onCreateJob={createJobFromFlow} onCreateNote={createNoteFromFlow}/>
    )}
    {toast && <div className="toast"><Check size={16}/><span>{toast}</span>{toastAction && <button onClick={toastAction}>{t.undo}</button>}</div>}
  </main>;
}
