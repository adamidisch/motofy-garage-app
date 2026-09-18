"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bell,
  Camera,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  Gauge,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  RotateCcw,
  Settings2,
  StickyNote,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import type { Customer, Job, Note, Vehicle } from "../lib/data/schema.d.mts";
import type { VehicleRecord as VehicleRecordModel } from "../lib/data/vehicle-record.d.mts";
import { createBrowserStorage, createRepository } from "../lib/data/repository.mjs";
import { STORAGE_KEY } from "../lib/data/schema.mjs";
import { formatDate, formatMileage } from "../lib/data/vehicle-record.mjs";
import {
  addCost,
  addPart,
  cyclePart,
  getJobWorkflow,
  removeCost,
  removePart,
  setReady,
  totalCost,
} from "../lib/data/workflow-store.mjs";
import type { JobWorkflow, WorkflowCost, WorkflowPart } from "../lib/data/workflow-store.d.mts";
import { pickPhoto } from "../lib/data/photo-store.mjs";
import { syncRemoteState } from "./name-client";
import { CheckoutScreen, MotofyMePreview } from "./visit-panels";
import ui from "./vehicle-record-v2.module.css";

type Copy = Record<string, string>;
type MainTab = "overview" | "work" | "reminders" | "notes";
type VisitTab = "work" | "parts" | "cost" | "photos";
type Screen = "record" | "visit" | "checkout" | "me";
type Reminder = { id: string; title: string; due: string; created_at: string };
type CreationMode = "vehicle" | "customer" | "job" | "note";

const REMINDER_PREFIX = "__motofy_reminder__:";
const ARCHIVE_AUTHOR = "__motofy_vehicle_archive__";

function readDataset() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, any> : null;
  } catch { return null; }
}

function scopedPayload(payload: Record<string, any>, garageId: string) {
  const scoped = { ...payload };
  scoped.garages = (Array.isArray(payload.garages) ? payload.garages : []).filter((row: any) => row.id === garageId);
  for (const key of ["customers", "vehicles", "jobs", "notes"]) {
    scoped[key] = (Array.isArray(payload[key]) ? payload[key] : []).filter((row: any) => row.garage_id === garageId);
  }
  return scoped;
}

function writeDataset(payload: Record<string, any>, garageId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    syncRemoteState(scopedPayload(payload, garageId));
  } catch {}
}

function readReminders(vehicleId: string): Reminder[] {
  const payload = readDataset();
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  return notes
    .filter((note: any) => note.vehicle_id === vehicleId && typeof note.author === "string" && note.author.startsWith(REMINDER_PREFIX))
    .map((note: any) => ({ id: note.id, title: note.body || "Υπενθύμιση", due: note.author.slice(REMINDER_PREFIX.length), created_at: note.created_at }))
    .sort((a: Reminder, b: Reminder) => a.due.localeCompare(b.due));
}

function readPlainNotes(vehicleId: string): Note[] {
  const payload = readDataset();
  const notes = Array.isArray(payload?.notes) ? payload.notes : [];
  return notes.filter((note: any) => note.vehicle_id === vehicleId && !(typeof note.author === "string" && (note.author.startsWith(REMINDER_PREFIX) || note.author === ARCHIVE_AUTHOR)));
}

function persistReminder(vehicle: Vehicle, current: Reminder | null, title: string, due: string) {
  const payload = readDataset();
  if (!payload || !title.trim()) return;
  const now = new Date().toISOString();
  payload.notes = Array.isArray(payload.notes) ? payload.notes : [];
  if (current) {
    const note = payload.notes.find((item: any) => item.id === current.id);
    if (note) { note.body = title.trim(); note.author = `${REMINDER_PREFIX}${due}`; note.updated_at = now; }
  } else {
    payload.notes.push({
      id: `not_rem_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      garage_id: vehicle.garage_id,
      vehicle_id: vehicle.id,
      body: title.trim(),
      author: `${REMINDER_PREFIX}${due}`,
      photo_paths: [],
      created_at: now,
      updated_at: now,
    });
  }
  writeDataset(payload, vehicle.garage_id);
}

function deleteReminder(vehicle: Vehicle, id: string) {
  const payload = readDataset();
  if (!payload) return;
  payload.notes = (Array.isArray(payload.notes) ? payload.notes : []).filter((item: any) => item.id !== id);
  writeDataset(payload, vehicle.garage_id);
}

function persistPlainNote(vehicle: Vehicle, current: Note | null, body: string) {
  const payload = readDataset();
  if (!payload || !body.trim()) return;
  const now = new Date().toISOString();
  payload.notes = Array.isArray(payload.notes) ? payload.notes : [];
  if (current) {
    const note = payload.notes.find((item: any) => item.id === current.id);
    if (note) { note.body = body.trim(); note.updated_at = now; }
  } else {
    payload.notes.push({
      id: `not_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      garage_id: vehicle.garage_id,
      vehicle_id: vehicle.id,
      body: body.trim(),
      author: null,
      photo_paths: [],
      created_at: now,
      updated_at: now,
    });
  }
  writeDataset(payload, vehicle.garage_id);
}

function deletePlainNote(vehicle: Vehicle, id: string) {
  deleteReminder(vehicle, id);
}

function archiveVehicle(vehicle: Vehicle) {
  const payload = readDataset();
  if (!payload) return false;
  const jobs = (Array.isArray(payload.jobs) ? payload.jobs : []).filter((job: any) => job.vehicle_id === vehicle.id);
  const notes = (Array.isArray(payload.notes) ? payload.notes : []).filter((note: any) => note.vehicle_id === vehicle.id && note.author !== ARCHIVE_AUTHOR);
  const now = new Date().toISOString();
  payload.notes = (Array.isArray(payload.notes) ? payload.notes : []).filter((note: any) => note.vehicle_id !== vehicle.id);
  payload.notes.push({
    id: `not_arc_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
    garage_id: vehicle.garage_id,
    vehicle_id: vehicle.id,
    body: JSON.stringify({ vehicle, jobs, notes, archived_at: now }),
    author: ARCHIVE_AUTHOR,
    photo_paths: [],
    created_at: now,
    updated_at: now,
  });
  payload.vehicles = (Array.isArray(payload.vehicles) ? payload.vehicles : []).filter((row: any) => row.id !== vehicle.id);
  payload.jobs = (Array.isArray(payload.jobs) ? payload.jobs : []).filter((job: any) => job.vehicle_id !== vehicle.id);
  writeDataset(payload, vehicle.garage_id);
  return true;
}

function deleteVehiclePermanently(vehicle: Vehicle) {
  const payload = readDataset();
  if (!payload) return false;
  payload.vehicles = (Array.isArray(payload.vehicles) ? payload.vehicles : []).filter((row: any) => row.id !== vehicle.id);
  payload.jobs = (Array.isArray(payload.jobs) ? payload.jobs : []).filter((row: any) => row.vehicle_id !== vehicle.id);
  payload.notes = (Array.isArray(payload.notes) ? payload.notes : []).filter((row: any) => row.vehicle_id !== vehicle.id);
  writeDataset(payload, vehicle.garage_id);
  return true;
}

function vehicleName(vehicle: Vehicle, fallback: string) {
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ") || fallback;
}

export default function VehicleRecordV2({
  record, t, lang, close, openVehicle, onJobUpdate, openCreation, vehiclePhoto, customerPhoto, onVehiclePhotoChange, onCustomerPhotoChange,
}: {
  record: VehicleRecordModel;
  t: Copy;
  lang: "el" | "en";
  close: () => void;
  openVehicle: (vehicleId: string) => void;
  onJobUpdate: (jobId: string, status: string) => void;
  openCreation: (mode: CreationMode, scan?: any, vehicleId?: string | null, photo?: string | null) => void;
  vehiclePhoto: string | null;
  customerPhoto: string | null;
  onVehiclePhotoChange: (dataUrl: string) => void;
  onCustomerPhotoChange: (dataUrl: string) => void;
}) {
  const greek = lang === "el";
  const [screen, setScreen] = useState<Screen>("record");
  const [tab, setTab] = useState<MainTab>("overview");
  const [visitTab, setVisitTab] = useState<VisitTab>("work");
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"archive" | "delete" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle>(record.vehicle);
  const [customer, setCustomer] = useState<Customer | null>(record.customer);
  const [job, setJob] = useState<Job | null>(record.jobs.current ?? record.jobs.open[0] ?? null);
  const [workflowVersion, setWorkflowVersion] = useState(0);
  const [reminders, setReminders] = useState<Reminder[]>(() => readReminders(record.vehicle.id));
  const [notes, setNotes] = useState<Note[]>(() => readPlainNotes(record.vehicle.id));
  const [reminderEditor, setReminderEditor] = useState<Reminder | null | "new">(null);
  const [noteEditor, setNoteEditor] = useState<Note | null | "new">(null);

  const adminRepo = useMemo(() => createRepository({
    storage: createBrowserStorage(),
    garageId: record.vehicle.garage_id,
    seedWhenEmpty: false,
    onPersist: (payload) => syncRemoteState(scopedPayload(payload, record.vehicle.garage_id)),
  }), [record.vehicle.garage_id]);

  const workflow = job ? getJobWorkflow(job.id) : null;
  void workflowVersion;

  function leave() {
    close();
    if (dirty) window.setTimeout(() => window.location.reload(), 0);
  }

  function refreshWorkflow() { setWorkflowVersion((value) => value + 1); }
  function refreshNotes() { setNotes(readPlainNotes(vehicle.id)); }
  function refreshReminders() { setReminders(readReminders(vehicle.id)); }

  function updateVehicle(changes: Partial<Vehicle>) {
    const updated = adminRepo.updateVehicle(vehicle.id, changes);
    if (!updated) return;
    setVehicle(updated);
    setDirty(true);
  }

  function linkCustomer(customerId: string | null) {
    const updatedVehicle = adminRepo.linkVehicleToCustomer(vehicle.id, customerId);
    if (!updatedVehicle) return;
    setVehicle(updatedVehicle);
    setCustomer(customerId ? adminRepo.getCustomer(customerId) : null);
    setDirty(true);
  }

  function createAndLinkCustomer(name: string, phone: string) {
    if (!name.trim()) return;
    const created = adminRepo.createCustomer({ name: name.trim(), phone: phone.trim() || null });
    adminRepo.linkVehicleToCustomer(vehicle.id, created.id);
    setCustomer(created);
    setDirty(true);
  }

  function updateJob(changes: Partial<Job>) {
    if (!job) return;
    const updated = adminRepo.updateJob(job.id, changes);
    if (!updated) return;
    setJob(updated);
    setDirty(true);
  }

  function back() {
    if (screen === "record") leave();
    else { setScreen("record"); setVisitTab("work"); }
  }

  function openVisit() {
    if (!job) { openCreation("job", null, vehicle.id); return; }
    setScreen("visit");
  }

  const plate = vehicle.plate;
  const title = vehicleName(vehicle, t.unknownVehicle ?? (greek ? "Όχημα" : "Vehicle"));

  return <div className={ui.layer} role="main" aria-label={t.vehicle}>
    <section className={ui.shell}>
      <header className={ui.header}>
        <button className={ui.iconButton} aria-label={t.cancel} onClick={back}><ArrowLeft size={19}/></button>
        <div className={ui.headerIdentity}>
          <span className={ui.headerPlate}>{plate}</span>
          <div><small>{screen === "visit" ? (greek ? "ΕΝΕΡΓΗ ΕΠΙΣΚΕΨΗ" : "ACTIVE VISIT") : screen === "checkout" ? (greek ? "ΠΑΡΑΔΟΣΗ" : "CHECKOUT") : screen === "me" ? "MOTOFY ME" : (greek ? "ΚΑΡΤΕΛΑ ΟΧΗΜΑΤΟΣ" : "VEHICLE RECORD")}</small><strong>{title}</strong></div>
        </div>
        {screen === "record" ? <div className={ui.headerMenuWrap}><button className={ui.iconButton} aria-label={greek ? "Ρυθμίσεις οχήματος" : "Vehicle settings"} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={20}/></button>{menuOpen && <div className={ui.popover}><button onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}><Settings2 size={16}/>{greek ? "Ρυθμίσεις οχήματος" : "Vehicle settings"}</button><button onClick={openVisit}><Wrench size={16}/>{greek ? "Άνοιγμα επίσκεψης" : "Open visit"}</button></div>}</div> : <span className={ui.headerSpacer}/>} 
      </header>

      {screen === "record" && <div className={ui.body}>
        <section className={ui.hero}>
          <button className={ui.photo} onClick={async () => { const url = await pickPhoto(); if (url) onVehiclePhotoChange(url); }} aria-label={t.changePhoto}>
            {vehiclePhoto ? <img src={vehiclePhoto} alt={title}/> : <span><CarFront size={38}/><small>{greek ? "Προσθήκη φωτογραφίας" : "Add photo"}</small></span>}
            <i><Camera size={15}/></i>
          </button>
          <div className={ui.heroInfo}>
            <div className={ui.heroTitle}><div><h2>{title}</h2><span className={ui.plateChip}>{plate}</span></div><button className={ui.smallIcon} onClick={() => setSettingsOpen(true)} aria-label={greek ? "Επεξεργασία" : "Edit"}><Edit3 size={15}/></button></div>
            <div className={ui.metaGrid}>
              <div><small><Gauge size={13}/>{greek ? "Χιλιόμετρα" : "Mileage"}</small><strong>{vehicle.mileage_km === null ? "—" : formatMileage(vehicle.mileage_km, lang)}</strong></div>
              <button className={ui.customerSummary} onClick={() => setCustomerOpen(true)}><small><UserRound size={13}/>{greek ? "Πελάτης" : "Customer"}</small><strong>{customer?.name ?? (greek ? "+ Προσθήκη πελάτη" : "+ Add customer")}</strong>{customer?.phone && <span>{customer.phone}</span>}</button>
            </div>
          </div>
        </section>

        <nav className={ui.tabs} aria-label={greek ? "Καρτέλες οχήματος" : "Vehicle tabs"}>
          {([
            ["overview", greek ? "Επισκόπηση" : "Overview"],
            ["work", greek ? "Εργασίες" : "Work"],
            ["reminders", greek ? "Υπενθυμίσεις" : "Reminders"],
            ["notes", greek ? "Σημειώσεις" : "Notes"],
          ] as Array<[MainTab, string]>).map(([id, label]) => <button key={id} className={tab === id ? ui.tabActive : ""} onClick={() => setTab(id)}>{label}</button>)}
        </nav>

        {tab === "overview" && <OverviewPanel greek={greek} vehicle={vehicle} customer={customer} job={job} reminders={reminders} notes={notes} openVisit={openVisit} setTab={setTab} setCustomerOpen={setCustomerOpen}/>} 
        {tab === "work" && <WorkPanel greek={greek} job={job} openVisit={openVisit} createJob={() => openCreation("job", null, vehicle.id)} history={record.jobs.history}/>} 
        {tab === "reminders" && <RemindersPanel greek={greek} reminders={reminders} onAdd={() => setReminderEditor("new")} onEdit={setReminderEditor} onDelete={(id) => { deleteReminder(vehicle, id); refreshReminders(); }}/>} 
        {tab === "notes" && <NotesPanel greek={greek} notes={notes} onAdd={() => setNoteEditor("new")} onEdit={setNoteEditor} onDelete={(id) => { deletePlainNote(vehicle, id); refreshNotes(); }}/>} 
      </div>}

      {screen === "visit" && job && workflow && <VisitWorkspace greek={greek} job={job} workflow={workflow} visitTab={visitTab} setVisitTab={setVisitTab} updateJob={updateJob} refreshWorkflow={refreshWorkflow} openCheckout={() => setScreen("checkout")} openMe={() => setScreen("me")} vehiclePhoto={vehiclePhoto} onVehiclePhotoChange={onVehiclePhotoChange}/>} 
      {screen === "checkout" && job && workflow && <div className={ui.legacyPanel}><CheckoutScreen job={job} workflow={workflow} record={{...record, vehicle, customer, display:{...record.display, plate, title}}} lang={lang} onComplete={() => { onJobUpdate(job.id, "done"); setReady(job.id, false); setScreen("record"); setDirty(true); }}/></div>}
      {screen === "me" && job && workflow && <div className={ui.legacyPanel}><MotofyMePreview record={{...record, vehicle, customer, display:{...record.display, plate, title}}} job={job} workflow={workflow} lang={lang}/></div>}
    </section>

    {customerOpen && <CustomerSheet greek={greek} customer={customer} customers={adminRepo.listCustomers()} otherVehicles={record.otherVehicles} customerPhoto={customerPhoto} close={() => setCustomerOpen(false)} onCustomerPhotoChange={onCustomerPhotoChange} linkCustomer={linkCustomer} createCustomer={createAndLinkCustomer} openVehicle={openVehicle}/>} 
    {settingsOpen && <VehicleSettings greek={greek} vehicle={vehicle} customers={adminRepo.listCustomers()} customer={customer} close={() => { setSettingsOpen(false); setConfirmAction(null); }} save={(changes) => updateVehicle(changes)} linkCustomer={linkCustomer} confirmAction={confirmAction} setConfirmAction={setConfirmAction} archive={() => { if (archiveVehicle(vehicle)) { setSettingsOpen(false); close(); window.setTimeout(() => window.location.reload(), 0); } }} remove={() => { if (deleteVehiclePermanently(vehicle)) { setSettingsOpen(false); close(); window.setTimeout(() => window.location.reload(), 0); } }}/>} 
    {reminderEditor && <ReminderEditor greek={greek} reminder={reminderEditor === "new" ? null : reminderEditor} close={() => setReminderEditor(null)} save={(title, due) => { persistReminder(vehicle, reminderEditor === "new" ? null : reminderEditor, title, due); refreshReminders(); setReminderEditor(null); }}/>} 
    {noteEditor && <NoteEditor greek={greek} note={noteEditor === "new" ? null : noteEditor} close={() => setNoteEditor(null)} save={(body) => { persistPlainNote(vehicle, noteEditor === "new" ? null : noteEditor, body); refreshNotes(); setNoteEditor(null); }}/>} 
  </div>;
}

function OverviewPanel({ greek, vehicle, customer, job, reminders, notes, openVisit, setTab, setCustomerOpen }: { greek: boolean; vehicle: Vehicle; customer: Customer | null; job: Job | null; reminders: Reminder[]; notes: Note[]; openVisit: () => void; setTab: (tab: MainTab) => void; setCustomerOpen: (value: boolean) => void }) {
  return <div className={ui.panelStack}>
    {job ? <button className={ui.currentVisit} onClick={openVisit}><span><Wrench size={18}/></span><div><small>{job.status === "in_progress" ? (greek ? "ΣΕ ΕΞΕΛΙΞΗ" : "IN PROGRESS") : (greek ? "ΕΝΕΡΓΗ ΕΠΙΣΚΕΨΗ" : "ACTIVE VISIT")}</small><strong>{job.title}</strong><em>{job.mileage_km === null ? "" : formatMileage(job.mileage_km, greek ? "el" : "en")}</em></div><ChevronRight size={18}/></button> : <button className={ui.emptyAction} onClick={openVisit}><Plus size={17}/><span><strong>{greek ? "Νέα επίσκεψη" : "New visit"}</strong><small>{greek ? "Πρόσθεσε τις εργασίες που χρειάζεται" : "Add the work this vehicle needs"}</small></span></button>}
    <div className={ui.quickGrid}>
      <button onClick={() => setTab("reminders")}><Bell size={17}/><span><strong>{reminders.length}</strong><small>{greek ? "Υπενθυμίσεις" : "Reminders"}</small></span></button>
      <button onClick={() => setTab("notes")}><StickyNote size={17}/><span><strong>{notes.length}</strong><small>{greek ? "Σημειώσεις" : "Notes"}</small></span></button>
      <button onClick={() => setCustomerOpen(true)}><UserRound size={17}/><span><strong>{customer?.name ?? "—"}</strong><small>{greek ? "Πελάτης" : "Customer"}</small></span></button>
      <div><Gauge size={17}/><span><strong>{vehicle.mileage_km === null ? "—" : formatMileage(vehicle.mileage_km, greek ? "el" : "en")}</strong><small>{greek ? "Χιλιόμετρα" : "Mileage"}</small></span></div>
    </div>
  </div>;
}

function WorkPanel({ greek, job, openVisit, createJob, history }: { greek: boolean; job: Job | null; openVisit: () => void; createJob: () => void; history: Job[] }) {
  return <div className={ui.panelStack}>
    <div className={ui.sectionHead}><div><small>{greek ? "ΤΡΕΧΟΥΣΑ ΔΟΥΛΕΙΑ" : "CURRENT WORK"}</small><h3>{greek ? "Εργασίες" : "Work"}</h3></div><button className={ui.addButton} onClick={createJob}><Plus size={15}/>{greek ? "Νέα" : "New"}</button></div>
    {job ? <button className={ui.workCard} onClick={openVisit}><span className={ui.workIcon}><Wrench size={18}/></span><div><strong>{job.title}</strong><small>{job.status === "in_progress" ? (greek ? "Σε εξέλιξη" : "In progress") : (greek ? "Προγραμματισμένη" : "Scheduled")}</small></div><ChevronRight size={18}/></button> : <div className={ui.emptyBox}><Wrench size={21}/><strong>{greek ? "Καμία ανοιχτή εργασία" : "No open work"}</strong><button onClick={createJob}><Plus size={15}/>{greek ? "Προσθήκη εργασίας" : "Add work"}</button></div>}
    {history.length > 0 && <section className={ui.history}><p>{greek ? "ΙΣΤΟΡΙΚΟ SERVICE" : "SERVICE HISTORY"}</p>{history.slice(0, 5).map((item) => <article key={item.id}><span><Check size={13}/></span><div><strong>{item.title}</strong><small>{formatDate(item.completed_at ?? item.updated_at, greek ? "el" : "en")}</small></div></article>)}</section>}
  </div>;
}

function RemindersPanel({ greek, reminders, onAdd, onEdit, onDelete }: { greek: boolean; reminders: Reminder[]; onAdd: () => void; onEdit: (item: Reminder) => void; onDelete: (id: string) => void }) {
  return <div className={ui.panelStack}><div className={ui.sectionHead}><div><small>{greek ? "ΕΠΟΜΕΝΑ" : "UP NEXT"}</small><h3>{greek ? "Υπενθυμίσεις" : "Reminders"}</h3></div><button className={ui.addButton} onClick={onAdd}><Plus size={15}/>{greek ? "Προσθήκη" : "Add"}</button></div>{reminders.length ? <section className={ui.reminderList}>{reminders.map((item) => <article key={item.id}><span className={ui.reminderIcon}><Clock3 size={16}/></span><div><strong>{item.title}</strong><small>{item.due ? formatDate(item.due, greek ? "el" : "en") : (greek ? "Χωρίς ημερομηνία" : "No date")}</small></div><div className={ui.rowActions}><button onClick={() => onEdit(item)}><Edit3 size={14}/></button><button onClick={() => onDelete(item.id)}><Trash2 size={14}/></button></div></article>)}</section> : <div className={ui.emptyBox}><Bell size={21}/><strong>{greek ? "Δεν υπάρχουν υπενθυμίσεις" : "No reminders yet"}</strong><small>{greek ? "Πρόσθεσε service, MOT, λάδια ή οτιδήποτε θέλεις να θυμηθείς." : "Add service, MOT, oil or anything worth remembering."}</small><button onClick={onAdd}><Plus size={15}/>{greek ? "Νέα υπενθύμιση" : "New reminder"}</button></div>}</div>;
}

function NotesPanel({ greek, notes, onAdd, onEdit, onDelete }: { greek: boolean; notes: Note[]; onAdd: () => void; onEdit: (item: Note) => void; onDelete: (id: string) => void }) {
  return <div className={ui.panelStack}><div className={ui.sectionHead}><div><small>{greek ? "ΓΙΑ ΤΟ ΟΧΗΜΑ" : "ABOUT THIS VEHICLE"}</small><h3>{greek ? "Σημειώσεις" : "Notes"}</h3></div><button className={ui.addButton} onClick={onAdd}><Plus size={15}/>{greek ? "Προσθήκη" : "Add"}</button></div>{notes.length ? <section className={ui.noteList}>{notes.map((item) => <article key={item.id}><div><p>{item.body}</p><small>{formatDate(item.updated_at ?? item.created_at, greek ? "el" : "en")}</small></div><div className={ui.rowActions}><button onClick={() => onEdit(item)}><Edit3 size={14}/></button><button onClick={() => onDelete(item.id)}><Trash2 size={14}/></button></div></article>)}</section> : <div className={ui.emptyBox}><StickyNote size={21}/><strong>{greek ? "Καμία σημείωση" : "No notes yet"}</strong><button onClick={onAdd}><Plus size={15}/>{greek ? "Νέα σημείωση" : "New note"}</button></div>}</div>;
}

function VisitWorkspace({ greek, job, workflow, visitTab, setVisitTab, updateJob, refreshWorkflow, openCheckout, openMe, vehiclePhoto, onVehiclePhotoChange }: { greek: boolean; job: Job; workflow: JobWorkflow; visitTab: VisitTab; setVisitTab: (tab: VisitTab) => void; updateJob: (changes: Partial<Job>) => void; refreshWorkflow: () => void; openCheckout: () => void; openMe: () => void; vehiclePhoto: string | null; onVehiclePhotoChange: (url: string) => void }) {
  return <div className={ui.visitBody}>
    <nav className={ui.visitTabs}>{([ ["work", greek ? "Δουλειά" : "Work"], ["parts", greek ? "Μέρη" : "Parts"], ["cost", greek ? "Κόστος" : "Cost"], ["photos", greek ? "Φωτο" : "Photos"] ] as Array<[VisitTab,string]>).map(([id,label]) => <button key={id} className={visitTab === id ? ui.visitTabActive : ""} onClick={() => setVisitTab(id)}>{label}</button>)}</nav>
    {visitTab === "work" && <VisitWork greek={greek} job={job} workflow={workflow} updateJob={updateJob} refreshWorkflow={refreshWorkflow} openCheckout={openCheckout} openMe={openMe}/>} 
    {visitTab === "parts" && <VisitParts greek={greek} job={job} workflow={workflow} refreshWorkflow={refreshWorkflow}/>} 
    {visitTab === "cost" && <VisitCost greek={greek} job={job} workflow={workflow} refreshWorkflow={refreshWorkflow}/>} 
    {visitTab === "photos" && <VisitPhotos greek={greek} vehiclePhoto={vehiclePhoto} onVehiclePhotoChange={onVehiclePhotoChange}/>} 
  </div>;
}

function VisitWork({ greek, job, workflow, updateJob, refreshWorkflow, openCheckout, openMe }: { greek: boolean; job: Job; workflow: JobWorkflow; updateJob: (changes: Partial<Job>) => void; refreshWorkflow: () => void; openCheckout: () => void; openMe: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState("");
  const items = job.title.split(" · ").filter(Boolean);
  function saveItems(next: string[]) { if (!next.length) return; updateJob({ title: next.join(" · ") }); }
  return <div className={ui.panelStack}>
    <section className={ui.visitStatus}><span/><div><small>{job.status === "in_progress" ? (greek ? "ΣΕ ΕΞΕΛΙΞΗ" : "IN PROGRESS") : (greek ? "ΕΝΕΡΓΗ ΕΠΙΣΚΕΨΗ" : "ACTIVE VISIT")}</small><h3>{greek ? "Η επίσκεψη είναι ανοιχτή" : "Visit is open"}</h3><p>{job.mileage_km === null ? (greek ? "Χωρίς χιλιόμετρα" : "No mileage") : formatMileage(job.mileage_km, greek ? "el" : "en")}</p></div></section>
    <section className={ui.visitCard}><div className={ui.sectionHead}><div><small>{greek ? "ΕΡΓΑΣΙΕΣ" : "WORK"}</small><h3>{greek ? "Τι κάνουμε" : "Work list"}</h3></div><button className={ui.addButton} onClick={() => setAdding(true)}><Plus size={15}/>{greek ? "Εργασία" : "Work"}</button></div><div className={ui.workItems}>{items.map((item,index) => <article key={`${item}-${index}`}><span><Check size={14}/></span><strong>{item}</strong><button aria-label={greek ? "Αφαίρεση" : "Remove"} onClick={() => saveItems(items.filter((_,i) => i !== index))}><X size={14}/></button></article>)}</div>{adding && <div className={ui.inlineAdd}><input autoFocus value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={greek ? "π.χ. αλλαγή τακακιών" : "e.g. replace brake pads"}/><button onClick={() => { if (!newItem.trim()) return; saveItems([...items,newItem.trim()]); setNewItem(""); setAdding(false); }}><Check size={15}/></button><button onClick={() => { setNewItem(""); setAdding(false); }}><X size={15}/></button></div>}</section>
    <div className={ui.visitActions}><button className={workflow.ready ? ui.readyOn : ""} onClick={() => { setReady(job.id, !workflow.ready); refreshWorkflow(); }}><Check size={17}/><span><strong>{workflow.ready ? (greek ? "Έτοιμο" : "Ready") : (greek ? "Σήμανση Ready" : "Mark ready")}</strong><small>{workflow.ready ? (greek ? "Περιμένει πελάτη" : "Waiting for customer") : (greek ? "Όταν τελειώσει" : "When finished")}</small></span></button><button onClick={openMe}><RotateCcw size={17}/><span><strong>Motofy Me</strong><small>{greek ? "Προεπισκόπηση" : "Preview"}</small></span></button></div>
    <button className={ui.primaryAction} onClick={openCheckout}><Check size={17}/>{greek ? "Ολοκλήρωση & παράδοση" : "Complete & check out"}<ChevronRight size={17}/></button>
  </div>;
}

function VisitParts({ greek, job, workflow, refreshWorkflow }: { greek: boolean; job: Job; workflow: JobWorkflow; refreshWorkflow: () => void }) {
  const [label, setLabel] = useState("");
  const labels: Record<string,string> = greek ? { needed:"Χρειάζεται", ordered:"Παραγγέλθηκε", waiting:"Αναμονή", arrived:"Παρελήφθη" } : { needed:"Needed", ordered:"Ordered", waiting:"Waiting", arrived:"Arrived" };
  return <div className={ui.panelStack}><section className={ui.visitCard}><div className={ui.sectionHead}><div><small>{greek ? "ΑΝΤΑΛΛΑΚΤΙΚΑ" : "PARTS"}</small><h3>{greek ? "Μέρη" : "Parts"}</h3></div></div><div className={ui.inlineAdd}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={greek ? "π.χ. τακάκια εμπρός" : "e.g. front brake pads"}/><button onClick={() => { if (!label.trim()) return; addPart(job.id,label.trim()); setLabel(""); refreshWorkflow(); }}><Plus size={15}/></button></div></section>{workflow.parts.length ? <section className={ui.partList}>{workflow.parts.map((part: WorkflowPart) => <article key={part.id}><span className={ui.partIcon}><Package size={16}/></span><div><strong>{part.label}</strong><button onClick={() => { cyclePart(job.id,part.id); refreshWorkflow(); }}>{labels[part.status] ?? part.status}</button></div><button className={ui.trashButton} onClick={() => { removePart(job.id,part.id); refreshWorkflow(); }}><Trash2 size={14}/></button></article>)}</section> : <div className={ui.emptyBox}><Package size={21}/><strong>{greek ? "Δεν υπάρχουν μέρη" : "No parts yet"}</strong><small>{greek ? "Πρόσθεσε ό,τι χρειάζεται παραγγελία ή τοποθέτηση." : "Add anything that needs ordering or fitting."}</small></div>}</div>;
}

function VisitCost({ greek, job, workflow, refreshWorkflow }: { greek: boolean; job: Job; workflow: JobWorkflow; refreshWorkflow: () => void }) {
  const [label,setLabel] = useState(""); const [amount,setAmount] = useState(""); const total = totalCost(workflow);
  return <div className={ui.panelStack}><section className={ui.total}><small>{greek ? "ΣΥΝΟΛΟ" : "TOTAL"}</small><strong>€{total.toFixed(2)}</strong><span>{greek ? "Προαιρετική καταγραφή κόστους" : "Optional cost tracking"}</span></section><section className={ui.visitCard}><div className={ui.inlineAdd}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={greek ? "Εργασία / μέρος" : "Work / part"}/><input className={ui.moneyInput} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="€"/><button onClick={() => { if (!label.trim() || !amount.trim()) return; addCost(job.id,label.trim(),amount); setLabel(""); setAmount(""); refreshWorkflow(); }}><Plus size={15}/></button></div></section><section className={ui.costList}>{workflow.costs.map((row: WorkflowCost) => <article key={row.id}><span>{row.label}</span><strong>€{Number(row.amount).toFixed(2)}</strong><button onClick={() => { removeCost(job.id,row.id); refreshWorkflow(); }}><X size={14}/></button></article>)}</section></div>;
}

function VisitPhotos({ greek, vehiclePhoto, onVehiclePhotoChange }: { greek: boolean; vehiclePhoto: string | null; onVehiclePhotoChange: (url: string) => void }) {
  return <div className={ui.panelStack}><section className={ui.visitCard}><div className={ui.sectionHead}><div><small>{greek ? "ΦΩΤΟ ΕΠΙΣΚΕΨΗΣ" : "VISIT PHOTO"}</small><h3>{greek ? "Φωτογραφία" : "Photo"}</h3></div></div><button className={ui.visitPhoto} onClick={async () => { const url = await pickPhoto(); if (url) onVehiclePhotoChange(url); }}>{vehiclePhoto ? <img src={vehiclePhoto} alt=""/> : <span><Camera size={24}/>{greek ? "Προσθήκη φωτογραφίας" : "Add photo"}</span>}</button></section></div>;
}

function CustomerSheet({ greek, customer, customers, otherVehicles, customerPhoto, close, onCustomerPhotoChange, linkCustomer, createCustomer, openVehicle }: { greek: boolean; customer: Customer | null; customers: Customer[]; otherVehicles: Vehicle[]; customerPhoto: string | null; close: () => void; onCustomerPhotoChange: (url: string) => void; linkCustomer: (id: string | null) => void; createCustomer: (name: string, phone: string) => void; openVehicle: (id: string) => void }) {
  const [newName,setNewName] = useState(""); const [newPhone,setNewPhone] = useState(""); const [mode,setMode] = useState<"view"|"pick"|"new">(customer ? "view" : "pick");
  return <div className={ui.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className={ui.sheet}><header><div><small>{greek ? "ΠΕΛΑΤΗΣ" : "CUSTOMER"}</small><h3>{customer?.name ?? (greek ? "Σύνδεση πελάτη" : "Link customer")}</h3></div><button onClick={close}><X size={18}/></button></header>{mode === "view" && customer && <><button className={ui.customerHero} onClick={async () => { const url = await pickPhoto(); if (url) onCustomerPhotoChange(url); }}>{customerPhoto ? <img src={customerPhoto} alt={customer.name}/> : <span><UserRound size={25}/></span>}<div><strong>{customer.name}</strong><small>{customer.phone ?? (greek ? "Χωρίς τηλέφωνο" : "No phone")}</small></div></button><div className={ui.sheetActions}>{customer.phone && <a href={`tel:${customer.phone.replaceAll(" ","")}`}><Phone size={16}/>{greek ? "Κλήση" : "Call"}</a>}<button onClick={() => setMode("pick")}><UserRound size={16}/>{greek ? "Αλλαγή πελάτη" : "Change customer"}</button></div>{otherVehicles.length > 0 && <section className={ui.otherVehicles}><p>{greek ? "ΑΛΛΑ ΟΧΗΜΑΤΑ" : "OTHER VEHICLES"}</p>{otherVehicles.map((item) => <button key={item.id} onClick={() => { close(); openVehicle(item.id); }}><CarFront size={15}/><span>{vehicleName(item,item.plate)}</span><em>{item.plate}</em><ChevronRight size={15}/></button>)}</section>}</>}{mode === "pick" && <section className={ui.pickList}><button className={ui.newCustomerButton} onClick={() => setMode("new")}><Plus size={16}/>{greek ? "Νέος πελάτης" : "New customer"}</button>{customers.map((item) => <button key={item.id} className={customer?.id === item.id ? ui.selectedCustomer : ""} onClick={() => { linkCustomer(item.id); close(); }}><UserRound size={16}/><span><strong>{item.name}</strong><small>{item.phone ?? ""}</small></span>{customer?.id === item.id && <Check size={15}/>}</button>)}{customer && <button className={ui.unlinkButton} onClick={() => { linkCustomer(null); close(); }}><X size={15}/>{greek ? "Αφαίρεση πελάτη από το όχημα" : "Unlink customer"}</button>}</section>}{mode === "new" && <section className={ui.form}><label>{greek ? "Όνομα" : "Name"}<input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}/></label><label>{greek ? "Τηλέφωνο" : "Phone"}<input inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}/></label><div><button onClick={() => setMode("pick")}>{greek ? "Πίσω" : "Back"}</button><button className={ui.saveButton} onClick={() => { createCustomer(newName,newPhone); close(); }} disabled={!newName.trim()}><Check size={15}/>{greek ? "Προσθήκη" : "Add"}</button></div></section>}</section></div>;
}

function VehicleSettings({ greek, vehicle, customers, customer, close, save, linkCustomer, confirmAction, setConfirmAction, archive, remove }: { greek: boolean; vehicle: Vehicle; customers: Customer[]; customer: Customer | null; close: () => void; save: (changes: Partial<Vehicle>) => void; linkCustomer: (id: string | null) => void; confirmAction: "archive"|"delete"|null; setConfirmAction: (value: "archive"|"delete"|null) => void; archive: () => void; remove: () => void }) {
  const [plate,setPlate] = useState(vehicle.plate); const [make,setMake] = useState(vehicle.make ?? ""); const [model,setModel] = useState(vehicle.model ?? ""); const [mileage,setMileage] = useState(vehicle.mileage_km?.toString() ?? "");
  return <div className={ui.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className={ui.sheet}><header><div><small>{greek ? "ΟΧΗΜΑ" : "VEHICLE"}</small><h3>{greek ? "Ρυθμίσεις οχήματος" : "Vehicle settings"}</h3></div><button onClick={close}><X size={18}/></button></header><section className={ui.form}><label>{greek ? "Πινακίδα" : "Plate"}<input value={plate} onChange={(e) => setPlate(e.target.value)}/></label><div className={ui.twoCols}><label>{greek ? "Μάρκα" : "Make"}<input value={make} onChange={(e) => setMake(e.target.value)}/></label><label>{greek ? "Μοντέλο" : "Model"}<input value={model} onChange={(e) => setModel(e.target.value)}/></label></div><label>{greek ? "Χιλιόμετρα" : "Mileage"}<input inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)}/></label><label>{greek ? "Πελάτης" : "Customer"}<select value={customer?.id ?? ""} onChange={(e) => linkCustomer(e.target.value || null)}><option value="">{greek ? "Χωρίς πελάτη" : "No customer"}</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className={ui.saveWide} onClick={() => { save({ plate, make: make || null, model: model || null, mileage_km: mileage ? Number(mileage) : null }); close(); }}><Check size={16}/>{greek ? "Αποθήκευση αλλαγών" : "Save changes"}</button></section><section className={ui.danger}><p>{greek ? "ΔΙΑΧΕΙΡΙΣΗ" : "MANAGE"}</p>{confirmAction === "archive" ? <div className={ui.confirmBox}><strong>{greek ? "Απόκρυψη οχήματος;" : "Archive vehicle?"}</strong><small>{greek ? "Θα φύγει από τις ενεργές λίστες χωρίς να γίνει μόνιμη διαγραφή." : "It will disappear from active lists without permanent deletion."}</small><div><button onClick={() => setConfirmAction(null)}>{greek ? "Ακύρωση" : "Cancel"}</button><button onClick={archive}><Archive size={15}/>{greek ? "Απόκρυψη" : "Archive"}</button></div></div> : <button onClick={() => setConfirmAction("archive")}><Archive size={16}/><span><strong>{greek ? "Απόκρυψη / αρχειοθέτηση" : "Archive vehicle"}</strong><small>{greek ? "Να μην εμφανίζεται στις ενεργές λίστες" : "Hide from active lists"}</small></span></button>}{confirmAction === "delete" ? <div className={`${ui.confirmBox} ${ui.deleteConfirm}`}><strong>{greek ? "Μόνιμη διαγραφή;" : "Delete permanently?"}</strong><small>{greek ? "Θα διαγραφούν το όχημα, οι εργασίες και οι σημειώσεις του." : "The vehicle, its jobs and notes will be deleted."}</small><div><button onClick={() => setConfirmAction(null)}>{greek ? "Ακύρωση" : "Cancel"}</button><button onClick={remove}><Trash2 size={15}/>{greek ? "Διαγραφή" : "Delete"}</button></div></div> : <button className={ui.deleteRow} onClick={() => setConfirmAction("delete")}><Trash2 size={16}/><span><strong>{greek ? "Διαγραφή οχήματος" : "Delete vehicle"}</strong><small>{greek ? "Μόνιμη ενέργεια" : "Permanent action"}</small></span></button>}</section></section></div>;
}

function ReminderEditor({ greek, reminder, close, save }: { greek: boolean; reminder: Reminder | null; close: () => void; save: (title: string, due: string) => void }) {
  const [title,setTitle] = useState(reminder?.title ?? ""); const [due,setDue] = useState(reminder?.due ?? "");
  return <div className={ui.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className={ui.sheet}><header><div><small>{greek ? "ΥΠΕΝΘΥΜΙΣΗ" : "REMINDER"}</small><h3>{reminder ? (greek ? "Επεξεργασία" : "Edit") : (greek ? "Νέα υπενθύμιση" : "New reminder")}</h3></div><button onClick={close}><X size={18}/></button></header><section className={ui.form}><label>{greek ? "Τι να θυμηθούμε" : "Reminder"}<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={greek ? "π.χ. αλλαγή λαδιών" : "e.g. oil change"}/></label><label>{greek ? "Ημερομηνία" : "Date"}<input type="date" value={due} onChange={(e) => setDue(e.target.value)}/></label><button className={ui.saveWide} disabled={!title.trim()} onClick={() => save(title,due)}><Check size={16}/>{greek ? "Αποθήκευση" : "Save"}</button></section></section></div>;
}

function NoteEditor({ greek, note, close, save }: { greek: boolean; note: Note | null; close: () => void; save: (body: string) => void }) {
  const [body,setBody] = useState(note?.body ?? "");
  return <div className={ui.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className={ui.sheet}><header><div><small>{greek ? "ΣΗΜΕΙΩΣΗ" : "NOTE"}</small><h3>{note ? (greek ? "Επεξεργασία" : "Edit") : (greek ? "Νέα σημείωση" : "New note")}</h3></div><button onClick={close}><X size={18}/></button></header><section className={ui.form}><label>{greek ? "Σημείωση" : "Note"}<textarea autoFocus rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder={greek ? "Γράψε κάτι χρήσιμο για το όχημα…" : "Write something useful about this vehicle…"}/></label><button className={ui.saveWide} disabled={!body.trim()} onClick={() => save(body)}><Check size={16}/>{greek ? "Αποθήκευση" : "Save"}</button></section></section></div>;
}
