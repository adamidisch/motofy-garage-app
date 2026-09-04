"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, CalendarDays, Camera, CarFront, Check, ChevronRight, ClipboardCheck, ClipboardList, Clock3, Ellipsis, LayoutGrid, MoreHorizontal, Phone, Plus, ScanLine, Search, Settings2, Sparkles, StickyNote, UserRound, Wrench, X } from "lucide-react";

type View = "home" | "cars" | "work" | "customers" | "settings";
type Car = { id: string; plate: string; name: string; year: string; km: string; customer: string; work: string; tone: string };
type ScanResult = { plate: string | null; make: string | null; model: string | null; confidence: "high" | "medium" | "low"; source: "ai" };

const cars: Car[] = [
  { id: "yaris", plate: "ΚΒΥ 328", name: "Toyota Yaris", year: "2018", km: "86.420 km", customer: "Μάριος Παναγή", work: "Service σε 5 ημέρες", tone: "mint" },
  { id: "bmw", plate: "ΚΜΡ 714", name: "BMW 320i", year: "2020", km: "42.180 km", customer: "Ανδρέας Χρίστου", work: "Διάγνωση κινητήρα", tone: "blue" },
  { id: "merc", plate: "ΜΡΑ 402", name: "Mercedes A200", year: "2019", km: "61.304 km", customer: "Ελένη Αντωνίου", work: "Προσφορά σε αναμονή", tone: "peach" },
  { id: "ford", plate: "ΚΜΝ 246", name: "Ford Fiesta", year: "2017", km: "104.909 km", customer: "Μιχάλης Σάββα", work: "Αλλαγή λαδιών · 14:30", tone: "lilac" },
];

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

const el = { today: "ΣΗΜΕΡΑ · 2 ΣΕΠ", hello: "Καλησπέρα, Ανδρέα", subtitle: "Τι δουλειά έχουμε σήμερα;", scan: "Σάρωση αυτοκινήτου", scanTitle: "Σκάναρε το αυτοκίνητο", scanText: "Πινακίδα, πελάτης και ιστορικό — αμέσως μπροστά σου.", home: "Αρχική", cars: "Αυτοκίνητα", work: "Εργασίες", customers: "Πελάτες", add: "Προσθήκη", appointment: "Ραντεβού", notes: "Σημειώσεις", jobs: "Εργασίες", activity: "Πρόσφατη κίνηση", garage: "Συνεργείο", all: "Όλα", open: "Άνοιγμα", newCar: "Νέο αυτοκίνητο", newJob: "Νέα εργασία", newCustomer: "Νέος πελάτης", settings: "Ρυθμίσεις", signout: "Έξοδος", camera: "Κάμερα πινακίδας", cameraText: "Βάλε την πινακίδα μέσα στο πλαίσιο και πάτα Αναγνώριση.", recognize: "Αναγνώριση", demo: "Χρήση demo εικόνας", cancel: "Ακύρωση", processing: "Διαβάζουμε την πινακίδα…", found: "Βρέθηκε όχημα", openRecord: "Άνοιγμα καρτέλας", retake: "Νέα λήψη", searchCar: "Αναζήτηση πινακίδας ή αυτοκινήτου", searchCustomer: "Αναζήτηση πελάτη", allCars: "Όλα τα αυτοκίνητα", activeJobs: "Εργασίες σήμερα", customerList: "Οι πελάτες σου", noResults: "Δεν βρέθηκε αποτέλεσμα", vehicle: "Καρτέλα οχήματος", owner: "Πελάτης", mileage: "Χιλιόμετρα", currentWork: "Τρέχουσα εργασία", note: "Σημείωση", appearance: "Εμφάνιση", theme: "Theme", language: "Γλώσσα", preferences: "Ρυθμίσεις συνεργείου", saved: "Αποθηκεύτηκε", progress: "Σε εξέλιξη", history: "Ιστορικό", vehicles: "οχήματα" };
const en = { today: "TODAY · SEP 2", hello: "Good evening, Andreas", subtitle: "What needs moving today?", scan: "Scan vehicle", scanTitle: "Scan the car", scanText: "Plate, customer and history — ready when you are.", home: "Home", cars: "Cars", work: "Jobs", customers: "Customers", add: "Add", appointment: "Appointments", notes: "Notes", jobs: "Jobs", activity: "Recent activity", garage: "Garage", all: "All", open: "Open", newCar: "New car", newJob: "New job", newCustomer: "New customer", settings: "Settings", signout: "Sign out", camera: "Plate camera", cameraText: "Place the plate in frame then tap Recognise.", recognize: "Recognise", demo: "Use demo image", cancel: "Cancel", processing: "Reading the plate…", found: "Vehicle found", openRecord: "Open record", retake: "Retake", searchCar: "Search plate or vehicle", searchCustomer: "Search customer", allCars: "All vehicles", activeJobs: "Today’s jobs", customerList: "Your customers", noResults: "No results found", vehicle: "Vehicle record", owner: "Customer", mileage: "Mileage", currentWork: "Current job", note: "Note", appearance: "Appearance", theme: "Theme", language: "Language", preferences: "Garage settings", saved: "Saved", progress: "In progress", history: "History", vehicles: "vehicles" };

export default function Home() {
  const [lang, setLang] = useState<"el" | "en">("el");
  const [view, setView] = useState<View>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [scanner, setScanner] = useState<"camera" | "processing" | "match" | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState("sky");
  const headerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const t = lang === "el" ? el : en;

  function stopCamera() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  function closeScanner() { stopCamera(); setScanner(null); setCameraError(false); setScanError(""); setSelectedImage(null); }
  function notice(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2200); }
  function selectView(next: View) { setView(next); setQuery(""); setMenuOpen(false); setAddOpen(false); }

  useEffect(() => {
    const savedLang = localStorage.getItem("motofy-language");
    const savedTheme = localStorage.getItem("motofy-theme");
    const timer = window.setTimeout(() => { if (savedLang === "el" || savedLang === "en") setLang(savedLang); if (savedTheme) setTheme(savedTheme); }, 0);
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) { setMenuOpen(false); setAddOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); setAddOpen(false); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setScanner(null); setCameraError(false); setSelectedCar(null); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; };
  }, []);

  useEffect(() => {
    if (!scanner && !selectedCar) return;
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
  }, [scanner, selectedCar]);

  function switchLanguage() { const next = lang === "el" ? "en" : "el"; setLang(next); localStorage.setItem("motofy-language", next); }
  function chooseTheme(next: string) { setTheme(next); localStorage.setItem("motofy-theme", next); notice(t.saved); }
  function startScanner() { setMenuOpen(false); setAddOpen(false); setCameraError(false); setScanError(""); setScanResult(null); setSelectedImage(null); setScanner("camera"); window.requestAnimationFrame(startCamera); }
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
    stopCamera(); setScanError(""); setScanner("processing");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ imageData: image, mimeType: image.startsWith("data:image/png") ? "image/png" : "image/jpeg" }) });
      const payload = await response.json() as ScanResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Δεν ολοκληρώθηκε η αναγνώριση.");
      setScanResult(payload); setScanner("match");
    } catch (error) { setScanError(error instanceof DOMException && error.name === "AbortError" ? "Η αναγνώριση άργησε πολύ. Δοκίμασε ξανά ή βγάλε πιο καθαρή φωτογραφία." : error instanceof Error ? error.message : "Δεν ολοκληρώθηκε η αναγνώριση."); setScanner("camera"); }
    finally { window.clearTimeout(timeout); }
  }
  function choosePhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => { setSelectedImage(String(reader.result)); setCameraError(false); setScanError(""); stopCamera(); };
    reader.readAsDataURL(file);
  }
  function openFoundCar() {
    if (!scanResult || (!scanResult.plate && !scanResult.make)) return;
    const name = [scanResult.make, scanResult.model].filter(Boolean).join(" ") || "Όχημα προς επιβεβαίωση";
    closeScanner(); setSelectedCar({ id: "scan-" + Date.now(), plate: scanResult.plate || "—", name, year: "—", km: "—", customer: "Νέος πελάτης", work: "Νέα καρτέλα προς επιβεβαίωση", tone: "blue" }); setView("cars"); notice(t.openRecord);
  }
  const nav = [["home", LayoutGrid, t.home], ["cars", CarFront, t.cars], ["work", ClipboardList, t.work], ["customers", UserRound, t.customers]] as const;

  return <main className={"app-shell theme-" + theme}>
    <section className="phone-canvas">
      <header className="topbar" ref={headerRef}>
        <button className="brand" aria-label="Motofy home" onClick={() => selectView("home")}><span className="brand-mark"><Wrench size={15}/></span><span>motofy</span></button>
        <div className="top-actions"><button className="language" onClick={switchLanguage}>ΕΛ <span>/</span> EN</button><button className="icon-button" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }} aria-label={t.add}><Plus size={20}/></button><button className="icon-button" onClick={() => { setMenuOpen(!menuOpen); setAddOpen(false); }} aria-label="Menu"><MoreHorizontal size={21}/></button></div>
        {addOpen && <div className="action-popover add-popover"><button onClick={() => { selectView("cars"); notice(t.newCar); }}><CarFront size={16}/>{t.newCar}</button><button onClick={() => { selectView("work"); notice(t.newJob); }}><Wrench size={16}/>{t.newJob}</button><button onClick={() => { selectView("customers"); notice(t.newCustomer); }}><UserRound size={16}/>{t.newCustomer}</button></div>}
        {menuOpen && <div className="action-popover menu-popover"><button onClick={() => selectView("settings")}><Settings2 size={16}/>{t.settings}</button><button onClick={() => notice(t.signout)}><X size={16}/>{t.signout}</button></div>}
      </header>
      <div className="content">
        {view === "home" && <Dashboard t={t} startScanner={startScanner} selectView={selectView} notice={notice}/>}
        {view === "cars" && <Cars t={t} query={query} setQuery={setQuery} selectCar={setSelectedCar}/>}
        {view === "work" && <Work t={t} notice={notice}/>}
        {view === "customers" && <Customers t={t} query={query} setQuery={setQuery} notice={notice}/>}
        {view === "settings" && <Settings t={t} theme={theme} chooseTheme={chooseTheme} lang={lang} switchLanguage={switchLanguage}/>}
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "selected" : ""} onClick={() => selectView(id)}><Icon size={20}/><span>{label}</span></button>)}<button className="nav-add" onClick={() => { setAddOpen(!addOpen); setMenuOpen(false); }}><span><Plus size={22}/></span><small>{t.add}</small></button></nav>
    </section>
    {scanner && <Scanner stage={scanner} t={t} error={cameraError} scanError={scanError} result={scanResult} selectedImage={selectedImage} videoRef={videoRef} fileInputRef={fileInputRef} close={closeScanner} recognise={recognise} choosePhoto={choosePhoto} openRecord={openFoundCar} restart={startScanner}/>}
    {selectedCar && <Record car={selectedCar} t={t} close={() => setSelectedCar(null)}/>}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </main>;
}

function Dashboard({ t, startScanner, selectView, notice }: { t: typeof el; startScanner: () => void; selectView: (view: View) => void; notice: (message: string) => void }) {
  return <><section className="intro-row"><div><p className="eyebrow">{t.today}</p><h1>{t.hello}</h1><p className="intro-copy">{t.subtitle}</p></div><button className="notification"><Bell size={18}/><i/></button></section>
    <section className="scan-card"><div className="scan-orb"><ScanLine size={30}/></div><div className="scan-copy"><span className="pill"><Sparkles size={13}/> AI READY</span><h2>{t.scanTitle}</h2><p>{t.scanText}</p></div><button className="scan-button" onClick={startScanner}>{t.scan}<span><Camera size={16}/></span></button></section>
    <section className="metrics"><button onClick={() => selectView("work")}><span className="metric-icon indigo"><CalendarDays size={18}/></span><div><strong>4</strong><p>{t.appointment}</p></div></button><button onClick={() => notice(t.note)}><span className="metric-icon aqua"><StickyNote size={18}/></span><div><strong>2</strong><p>{t.notes}</p></div></button><button onClick={() => selectView("work")}><span className="metric-icon gold"><ClipboardCheck size={18}/></span><div><strong>6</strong><p>{t.jobs}</p></div></button></section>
    <section className="section-heading"><div><p className="eyebrow">{t.activity}</p><h2>{t.garage}</h2></div><button onClick={() => selectView("work")}>{t.all}<ChevronRight size={15}/></button></section>
    <section className="activity-list">{jobs.map((job, index) => <button className="activity" key={job.car} onClick={() => selectView("work")}><span className={"activity-icon " + (index === 0 ? "lilac" : index === 1 ? "blue" : "mint")}>{index === 1 ? <Wrench size={18}/> : index === 2 ? <Check size={18}/> : <Clock3 size={18}/>}</span><span className="activity-text"><strong>{job.car}</strong><small>{job.title} · {job.time}</small></span><Ellipsis size={18}/></button>)}</section>
  </>;
}

function Intro({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) { return <section className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</section>; }
function SearchBox({ value, setValue, placeholder }: { value: string; setValue: (value: string) => void; placeholder: string }) { return <label className="search-field"><Search size={18}/><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder}/>{value && <button aria-label="Clear search" onClick={() => setValue("")}><X size={16}/></button>}</label>; }
function Empty({ text }: { text: string }) { return <div className="empty-inline"><Search size={20}/>{text}</div>; }

function Cars({ t, query, setQuery, selectCar }: { t: typeof el; query: string; setQuery: (value: string) => void; selectCar: (car: Car) => void }) {
  const filtered = cars.filter((car) => (car.name + car.plate + car.customer).toLowerCase().includes(query.toLowerCase()));
  return <><Intro eyebrow={t.allCars} title={t.cars} action={<span className="page-count">4</span>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCar}/><section className="vehicle-list">{filtered.map((car) => <button className="vehicle-row" key={car.id} onClick={() => selectCar(car)}><span className={"vehicle-badge " + car.tone}><CarFront size={19}/></span><span className="vehicle-text"><strong>{car.name}<small>{car.year} · {car.plate}</small></strong><small>{car.customer} · {car.km}</small><em>{car.work}</em></span><ChevronRight size={18}/></button>)}{!filtered.length && <Empty text={t.noResults}/>}</section></>;
}

function Work({ t, notice }: { t: typeof el; notice: (message: string) => void }) {
  const [scope, setScope] = useState<"today" | "active" | "history">("today");
  const visibleJobs = scope === "today" ? jobs : jobs.filter((job) => scope === "active" ? job.status === "active" : job.status === "done");
  return <><Intro eyebrow={t.activeJobs} title={t.work} action={<button className="compact-add" onClick={() => notice(t.newJob)}><Plus size={16}/>{t.add}</button>}/><div className="filter-tabs"><button className={scope === "today" ? "active" : ""} onClick={() => setScope("today")}>{t.today}</button><button className={scope === "active" ? "active" : ""} onClick={() => setScope("active")}>{t.progress}</button><button className={scope === "history" ? "active" : ""} onClick={() => setScope("history")}>{t.history}</button></div><section className="job-list">{visibleJobs.map((job) => <article className="job-card" key={job.car}><div className="job-top"><span className={"status-dot " + job.status}/><strong>{job.car}<small>{job.plate} · {job.owner}</small></strong><button aria-label={job.car + " options"} onClick={() => notice(job.car)}><Ellipsis size={18}/></button></div><p>{job.title}</p><footer><span className={"status-label " + job.status}>{job.time}</span><button onClick={() => notice(t.open)}>{t.open}<ChevronRight size={15}/></button></footer></article>)}</section></>;
}

function Customers({ t, query, setQuery, notice }: { t: typeof el; query: string; setQuery: (value: string) => void; notice: (message: string) => void }) {
  const filtered = customers.filter((customer) => (customer.name + customer.car).toLowerCase().includes(query.toLowerCase()));
  return <><Intro eyebrow={t.customerList} title={t.customers} action={<button className="compact-add" onClick={() => notice(t.newCustomer)}><Plus size={16}/>{t.add}</button>}/><SearchBox value={query} setValue={setQuery} placeholder={t.searchCustomer}/><section className="customer-list">{filtered.map((customer) => <article className="customer-row" key={customer.name}><span className={"avatar " + customer.tone}>{customer.initials}</span><div><strong>{customer.name}</strong><a href={"tel:" + customer.phone.replaceAll(" ", "")}><Phone size={13}/>{customer.phone}</a><small><CarFront size={13}/>{customer.car}</small></div><span className="car-count">{customer.count}<small>{t.vehicles}</small></span></article>)}{!filtered.length && <Empty text={t.noResults}/>}</section></>;
}

function Settings({ t, theme, chooseTheme, lang, switchLanguage }: { t: typeof el; theme: string; chooseTheme: (theme: string) => void; lang: string; switchLanguage: () => void }) {
  return <><Intro eyebrow={t.preferences} title={t.settings}/><section className="settings-group"><p className="eyebrow">{t.appearance}</p><div className="setting-row"><span><span className="setting-icon"><Sparkles size={17}/></span>{t.theme}</span><div className="theme-select">{["sky", "pearl", "midnight"].map((item) => <button key={item} className={theme === item ? "selected" : ""} onClick={() => chooseTheme(item)}>{item}</button>)}</div></div><button className="setting-row" onClick={switchLanguage}><span><span className="setting-icon"><UserRound size={17}/></span>{t.language}</span><strong>{lang.toUpperCase()}<ChevronRight size={17}/></strong></button></section></>;
}

function Scanner({ stage, t, error, scanError, result, selectedImage, videoRef, fileInputRef, close, recognise, choosePhoto, openRecord, restart }: { stage: "camera" | "processing" | "match"; t: typeof el; error: boolean; scanError: string; result: ScanResult | null; selectedImage: string | null; videoRef: React.RefObject<HTMLVideoElement | null>; fileInputRef: React.RefObject<HTMLInputElement | null>; close: () => void; recognise: () => void; choosePhoto: (file: File | undefined) => void; openRecord: () => void; restart: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="scanner-modal"><header><button aria-label={t.cancel} onClick={close}><X size={20}/></button><div><p className="eyebrow">{stage === "match" ? "SCAN COMPLETE" : "LIVE SCAN"}</p><h2>{stage === "match" ? t.found : t.camera}</h2></div><span/></header>
    {stage === "camera" && <><div className={"camera-stage " + (error ? "camera-error" : "")}>{selectedImage ? <img src={selectedImage} alt="Επιλεγμένη φωτογραφία αυτοκινήτου"/> : !error && <video ref={videoRef} playsInline muted/>}<div className="plate-guide"><i/><i/><i/><i/></div>{error && !selectedImage && <div className="camera-fallback"><Camera size={31}/><strong>{t.cameraText}</strong></div>}</div><p className="scanner-help">{scanError || t.cameraText}</p><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])}/><footer><button className="secondary-button" onClick={() => fileInputRef.current?.click()}>{selectedImage ? t.retake : "Φωτογραφία"}</button><button className="primary-button" onClick={recognise}>{t.recognize}<ScanLine size={18}/></button></footer></>}
    {stage === "processing" && <div className="processing-state"><span className="scan-processing"><ScanLine size={34}/></span><h3>{t.processing}</h3><p>Base · Contrast · Sharp · Gray · Inverse · Vote</p><div className="ocr-passes"><span><Check size={12}/> Base</span><span><Check size={12}/> Contrast</span><span><Check size={12}/> Sharp</span><span>Vote</span></div></div>}
    {stage === "match" && <div className="match-state"><span className="match-check"><Check size={28}/></span><p className="eyebrow">AI RESULT · {result?.confidence === "high" ? "ΥΨΗΛΗ ΒΕΒΑΙΟΤΗΤΑ" : result?.confidence === "medium" ? "ΜΕΤΡΙΑ ΒΕΒΑΙΟΤΗΤΑ" : "ΧΑΜΗΛΗ ΒΕΒΑΙΟΤΗΤΑ"}</p><h3>{result?.plate || "Δεν διαβάστηκε πινακίδα"}</h3><strong>{[result?.make, result?.model].filter(Boolean).join(" ") || "Δεν αναγνωρίστηκε με ασφάλεια"}<small>Από φωτογραφία · επιβεβαίωσε πριν τη χρήση</small></strong><p>{result?.plate || result?.make ? "Νέα καρτέλα · Επιβεβαίωση στοιχείων" : "Δοκίμασε πιο καθαρή λήψη της πινακίδας και του αυτοκινήτου."}</p><footer><button className="secondary-button" onClick={restart}>{t.retake}</button>{(result?.plate || result?.make) && <button className="primary-button" onClick={openRecord}>{t.openRecord}<ChevronRight size={18}/></button>}</footer></div>}
  </section></div>;
}

function Record({ car, t, close }: { car: Car; t: typeof el; close: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="record-modal"><header><button aria-label={t.cancel} onClick={close}><ArrowLeft size={20}/></button><div><p className="eyebrow">{t.vehicle}</p><h2>{car.name}</h2></div><button aria-label={t.cancel} onClick={close}><X size={20}/></button></header><div className="plate-display">{car.plate}</div><section className="record-grid"><div><small>{t.owner}</small><strong>{car.customer}</strong></div><div><small>{t.mileage}</small><strong>{car.km}</strong></div><div><small>{t.currentWork}</small><strong>{car.work}</strong></div></section><section className="record-note"><StickyNote size={18}/><p><strong>{t.note}</strong>Το όχημα είναι έτοιμο για τον επόμενο έλεγχο.</p></section><button className="primary-button full-width" onClick={close}><Check size={18}/>{t.open}</button></section></div>;
}
