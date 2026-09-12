"use client";

import { useState } from "react";
import { ArrowLeft, Camera, Check, ChevronRight, CircleDashed, Clock3, Euro, Gauge, ImageIcon, Mail, Package, Phone, Plus, Share2, StickyNote, Trash2, UserRound, Wrench, X } from "lucide-react";
import styles from "./motofy2.module.css";
import { pickPhoto } from "../lib/data/photo-store.mjs";
import { addCost, addPart, cyclePart, getJobWorkflow, removeCost, removePart, setCustomerNote, setReady, totalCost } from "../lib/data/workflow-store.mjs";
import type { JobWorkflow, WorkflowCost, WorkflowPart } from "../lib/data/workflow-store.mjs";
import { formatDate, formatDateTime, formatMileage, formatRelative, initials } from "../lib/data/vehicle-record.mjs";
import type { VehicleRecord as VehicleRecordModel } from "../lib/data/vehicle-record.d.mts";
import type { Job, Vehicle } from "../lib/data/schema.d.mts";

type Tab = "overview" | "jobs" | "notes" | "customer";
type Screen = "record" | "visit" | "parts" | "cost" | "checkout" | "me";
type Copy = Record<string, string>;

export default function VehicleRecord({
  record, t, lang, close, openVehicle, onJobUpdate, openCreation, vehiclePhoto, customerPhoto, onVehiclePhotoChange, onCustomerPhotoChange,
}: {
  record: VehicleRecordModel;
  t: Copy;
  lang: "el" | "en";
  close: () => void;
  openVehicle: (vehicleId: string) => void;
  onJobUpdate: (jobId: string, status: string) => void;
  openCreation: (mode: string) => void;
  vehiclePhoto: string | null;
  customerPhoto: string | null;
  onVehiclePhotoChange: (dataUrl: string) => void;
  onCustomerPhotoChange: (dataUrl: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [screen, setScreen] = useState<Screen>("record");
  const [, setWorkflowVersion] = useState(0);
  const { display, jobs } = record;
  const activeJob = jobs.current ?? jobs.open[0] ?? null;
  const workflow = activeJob ? getJobWorkflow(activeJob.id) : null;
  const greek = lang === "el";

  function refreshWorkflow() { setWorkflowVersion((value) => value + 1); }
  function back() {
    if (screen === "record") close();
    else if (screen === "visit") setScreen("record");
    else setScreen("visit");
  }
  function openVisit() { if (!activeJob) { openCreation("job"); return; } setScreen("visit"); }

  return <div className={styles.screenLayer} role="dialog" aria-modal="true" aria-label={t.vehicle}>
    <section className={styles.recordScreen}>
      <header className={styles.recordHeader}>
        <button aria-label={t.cancel} onClick={back}><ArrowLeft size={20}/></button>
        <div><p>{screen === "record" ? t.vehicle : screen === "visit" ? (greek ? "ΕΝΕΡΓΗ ΕΠΙΣΚΕΨΗ" : "ACTIVE VISIT") : screen === "parts" ? (greek ? "ΑΝΤΑΛΛΑΚΤΙΚΑ" : "PARTS") : screen === "cost" ? (greek ? "ΚΟΣΤΟΣ" : "COST") : screen === "checkout" ? (greek ? "ΠΑΡΑΔΟΣΗ" : "CHECKOUT") : "MOTOFY ME"}</p><h2>{display.title ?? t.unknownVehicle}</h2></div>
        <span className={styles.headerPlate}>{display.plate}</span>
      </header>

      {screen === "record" && <RecordHome record={record} t={t} lang={lang} tab={tab} setTab={setTab} openVehicle={openVehicle} onJobUpdate={onJobUpdate} openCreation={openCreation} vehiclePhoto={vehiclePhoto} customerPhoto={customerPhoto} onVehiclePhotoChange={onVehiclePhotoChange} onCustomerPhotoChange={onCustomerPhotoChange} openVisit={openVisit} activeJob={activeJob} />}
      {screen === "visit" && activeJob && workflow && <ActiveVisit job={activeJob} workflow={workflow} lang={lang} onJobUpdate={onJobUpdate} refreshWorkflow={refreshWorkflow} openParts={() => setScreen("parts")} openCost={() => setScreen("cost")} openCheckout={() => setScreen("checkout")} openMe={() => setScreen("me")}/>} 
      {screen === "parts" && activeJob && workflow && <PartsScreen jobId={activeJob.id} workflow={workflow} lang={lang} refresh={refreshWorkflow}/>} 
      {screen === "cost" && activeJob && workflow && <CostScreen jobId={activeJob.id} workflow={workflow} lang={lang} refresh={refreshWorkflow}/>} 
      {screen === "checkout" && activeJob && workflow && <CheckoutScreen job={activeJob} workflow={workflow} record={record} lang={lang} onComplete={() => { onJobUpdate(activeJob.id, "done"); setReady(activeJob.id, false); refreshWorkflow(); setScreen("record"); }}/>} 
      {screen === "me" && activeJob && workflow && <MotofyMePreview record={record} job={activeJob} workflow={workflow} lang={lang}/>} 
    </section>
  </div>;
}

function RecordHome({ record, t, lang, tab, setTab, openVehicle, onJobUpdate, openCreation, vehiclePhoto, customerPhoto, onVehiclePhotoChange, onCustomerPhotoChange, openVisit, activeJob }: {
  record: VehicleRecordModel; t: Copy; lang: "el" | "en"; tab: Tab; setTab: (tab: Tab) => void; openVehicle: (id: string) => void; onJobUpdate: (id: string, status: string) => void; openCreation: (mode: string) => void; vehiclePhoto: string | null; customerPhoto: string | null; onVehiclePhotoChange: (url: string) => void; onCustomerPhotoChange: (url: string) => void; openVisit: () => void; activeJob: Job | null;
}) {
  const { vehicle, display, customer, otherVehicles, jobs, notes, lastActivity, scanSuggestion, empty } = record;
  const tabs: Array<[Tab, string]> = [["overview", t.overview], ["jobs", t.jobs], ["notes", t.notes], ["customer", t.owner]];
  const greek = lang === "el";
  return <div className={styles.recordBody}>
    <section className={styles.vehicleHero}>
      <button className={styles.vehiclePhoto} onClick={async () => { const url = await pickPhoto(); if (url) onVehiclePhotoChange(url); }} aria-label={t.changePhoto}>{vehiclePhoto ? <img src={vehiclePhoto} alt={display.plate}/> : <span><Camera size={22}/></span>}</button>
      <div><span className={styles.plate}>{display.plate}</span><h3>{display.subtitle || display.title || t.unknownVehicle}</h3><p>{customer?.name ?? t.noCustomer}{vehicle.mileage_km !== null ? ` · ${formatMileage(vehicle.mileage_km, lang)}` : ""}</p></div>
    </section>

    <button className={activeJob ? styles.activeVisitCard : styles.newVisitCard} onClick={openVisit}>
      <span>{activeJob ? <Wrench size={18}/> : <Plus size={18}/>}</span>
      <div><small>{activeJob ? (greek ? "ΣΤΟ ΣΥΝΕΡΓΕΙΟ ΤΩΡΑ" : "IN THE WORKSHOP") : (greek ? "ΝΕΑ ΕΠΙΣΚΕΨΗ" : "NEW VISIT")}</small><strong>{activeJob ? activeJob.title : (greek ? "Γρήγορη εισαγωγή" : "Quick check-in")}</strong><em>{activeJob ? statusLabel(activeJob.status, t) : (greek ? "Χιλιόμετρα · εργασία · σημείωση" : "Mileage · work · note")}</em></div><ChevronRight size={18}/>
    </button>

    <div className={styles.tabs}>{tabs.map(([id, label]) => <button key={id} className={tab === id ? styles.tabActive : ""} onClick={() => setTab(id)}>{label}</button>)}</div>

    {tab === "overview" && <Overview t={t} lang={lang} vehicle={vehicle} customer={customer} currentJob={jobs.current} lastActivity={lastActivity} scanSuggestion={scanSuggestion} empty={empty} openCustomerTab={() => setTab("customer")} openCreation={openCreation}/>} 
    {tab === "jobs" && <Jobs t={t} lang={lang} jobs={jobs} empty={empty} onJobUpdate={onJobUpdate} openCreation={openCreation}/>} 
    {tab === "notes" && <Notes t={t} lang={lang} notes={notes} empty={empty}/>} 
    {tab === "customer" && <CustomerPanel t={t} customer={customer} otherVehicles={otherVehicles} empty={empty} openVehicle={openVehicle} customerPhoto={customerPhoto} vehiclePhoto={vehiclePhoto} onCustomerPhotoChange={onCustomerPhotoChange}/>} 
  </div>;
}

function ActiveVisit({ job, workflow, lang, onJobUpdate, refreshWorkflow, openParts, openCost, openCheckout, openMe }: { job: Job; workflow: JobWorkflow; lang: "el" | "en"; onJobUpdate: (id: string, status: string) => void; refreshWorkflow: () => void; openParts: () => void; openCost: () => void; openCheckout: () => void; openMe: () => void }) {
  const greek = lang === "el";
  const items = job.title.split(" · ").filter(Boolean);
  const total = totalCost(workflow);
  return <div className={styles.workflowBody}>
    <section className={styles.statusHero}><span className={job.status === "in_progress" ? styles.statusLive : styles.statusPlanned}/><div><small>{job.status === "in_progress" ? (greek ? "ΣΕ ΕΞΕΛΙΞΗ" : "IN PROGRESS") : (greek ? "ΚΑΤΑΧΩΡΗΘΗΚΕ" : "CHECKED IN")}</small><h3>{greek ? "Η επίσκεψη είναι ανοιχτή" : "Visit is open"}</h3><p>{job.mileage_km !== null ? formatMileage(job.mileage_km, lang) : (greek ? "Χωρίς χιλιόμετρα" : "No mileage recorded")}</p></div></section>
    {job.status === "scheduled" && <button className={styles.primaryWide} onClick={() => onJobUpdate(job.id, "in_progress")}><Wrench size={17}/>{greek ? "Ξεκίνησε η εργασία" : "Start work"}</button>}

    <section className={styles.workflowCard}><p className={styles.sectionLabel}>{greek ? "ΕΡΓΑΣΙΕΣ" : "WORK"}</p><div className={styles.workItems}>{items.map((item) => <div key={item}><Check size={14}/><span>{item}</span></div>)}</div></section>
    <div className={styles.actionGrid}>
      <button onClick={openParts}><Package size={18}/><strong>{greek ? "Ανταλλακτικά" : "Parts"}</strong><small>{workflow.parts.length ? `${workflow.parts.length}` : (greek ? "Κανένα" : "None")}</small></button>
      <button onClick={openCost}><Euro size={18}/><strong>{greek ? "Κόστος" : "Cost"}</strong><small>{total ? `€${total.toFixed(2)}` : (greek ? "Προαιρετικό" : "Optional")}</small></button>
      <button onClick={() => { setReady(job.id, !workflow.ready); refreshWorkflow(); }}><Check size={18}/><strong>{workflow.ready ? (greek ? "Έτοιμο" : "Ready") : (greek ? "Σήμανση Ready" : "Mark ready")}</strong><small>{workflow.ready ? (greek ? "Περιμένει πελάτη" : "Waiting for customer") : (greek ? "Όταν τελειώσει" : "When finished")}</small></button>
      <button onClick={openMe}><Share2 size={18}/><strong>Motofy Me</strong><small>{greek ? "Προεπισκόπηση" : "Preview"}</small></button>
    </div>
    <button className={styles.checkoutButton} onClick={openCheckout}><Check size={18}/>{greek ? "Ολοκλήρωση & παράδοση" : "Complete & check out"}<ChevronRight size={18}/></button>
  </div>;
}

function PartsScreen({ jobId, workflow, lang, refresh }: { jobId: string; workflow: JobWorkflow; lang: "el" | "en"; refresh: () => void }) {
  const [label, setLabel] = useState("");
  const greek = lang === "el";
  const labels: Record<string, string> = greek ? { needed: "Χρειάζεται", ordered: "Παραγγέλθηκε", waiting: "Αναμονή", arrived: "Ήρθε" } : { needed: "Needed", ordered: "Ordered", waiting: "Waiting", arrived: "Arrived" };
  return <div className={styles.workflowBody}>
    <section className={styles.workflowCard}><p className={styles.sectionLabel}>{greek ? "ΝΕΟ ΑΝΤΑΛΛΑΚΤΙΚΟ" : "ADD PART"}</p><div className={styles.inlineEntry}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={greek ? "π.χ. τακάκια εμπρός" : "e.g. front brake pads"}/><button onClick={() => { if (!label.trim()) return; addPart(jobId, label); setLabel(""); refresh(); }}><Plus size={18}/></button></div></section>
    <section className={styles.partsList}>{workflow.parts.length ? workflow.parts.map((part: WorkflowPart) => <article key={part.id}><div><strong>{part.label}</strong><button className={styles.partStatus} onClick={() => { cyclePart(jobId, part.id); refresh(); }}>{labels[part.status] ?? part.status}</button></div><button onClick={() => { removePart(jobId, part.id); refresh(); }}><Trash2 size={15}/></button></article>) : <EmptyPanel icon={<Package size={20}/>} title={greek ? "Δεν υπάρχουν ανταλλακτικά" : "No parts yet"}/>}</section>
  </div>;
}

function CostScreen({ jobId, workflow, lang, refresh }: { jobId: string; workflow: JobWorkflow; lang: "el" | "en"; refresh: () => void }) {
  const [label, setLabel] = useState(""); const [amount, setAmount] = useState(""); const greek = lang === "el"; const total = totalCost(workflow);
  return <div className={styles.workflowBody}>
    <section className={styles.totalCard}><small>{greek ? "ΣΥΝΟΛΟ" : "TOTAL"}</small><strong>€{total.toFixed(2)}</strong><p>{greek ? "Προαιρετικό — βάλε μόνο ό,τι θέλεις να κρατήσεις." : "Optional — record only what you need."}</p></section>
    <section className={styles.workflowCard}><div className={styles.costEntry}><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={greek ? "Εργασία / ανταλλακτικό" : "Work / part"}/><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="€"/><button onClick={() => { addCost(jobId, label, amount); setLabel(""); setAmount(""); refresh(); }}><Plus size={18}/></button></div></section>
    <section className={styles.costList}>{workflow.costs.map((row: WorkflowCost) => <article key={row.id}><span>{row.label}</span><strong>€{Number(row.amount).toFixed(2)}</strong><button onClick={() => { removeCost(jobId, row.id); refresh(); }}><X size={14}/></button></article>)}</section>
  </div>;
}

function CheckoutScreen({ job, workflow, record, lang, onComplete }: { job: Job; workflow: JobWorkflow; record: VehicleRecordModel; lang: "el" | "en"; onComplete: () => void }) {
  const greek = lang === "el"; const total = totalCost(workflow); const items = job.title.split(" · ").filter(Boolean);
  return <div className={styles.workflowBody}>
    <section className={styles.checkoutSummary}><span className={styles.readyIcon}><Check size={24}/></span><h3>{greek ? "Έτοιμο για παράδοση;" : "Ready to check out?"}</h3><p>{record.display.plate} · {record.display.title ?? record.display.subtitle}</p></section>
    <section className={styles.workflowCard}><p className={styles.sectionLabel}>{greek ? "ΟΛΟΚΛΗΡΩΘΗΚΑΝ" : "COMPLETED"}</p>{items.map((item) => <div className={styles.summaryRow} key={item}><Check size={14}/><span>{item}</span></div>)}{workflow.parts.filter((p: WorkflowPart) => p.status === "arrived").map((part: WorkflowPart) => <div className={styles.summaryRow} key={part.id}><Package size={14}/><span>{part.label}</span></div>)}</section>
    {total > 0 && <section className={styles.totalLine}><span>{greek ? "Σύνολο" : "Total"}</span><strong>€{total.toFixed(2)}</strong></section>}
    <button className={styles.completeButton} onClick={onComplete}><Check size={18}/>{greek ? "Επιβεβαίωση · Το αυτοκίνητο έφυγε" : "Confirm · Vehicle checked out"}</button>
  </div>;
}

function MotofyMePreview({ record, job, workflow, lang }: { record: VehicleRecordModel; job: Job; workflow: JobWorkflow; lang: "el" | "en" }) {
  const greek = lang === "el"; const [note, setNote] = useState(workflow.customerNote ?? ""); const total = totalCost(workflow);
  return <div className={styles.workflowBody}>
    <section className={styles.meCard}><span className={styles.meLogo}>m</span><small>MOTOFY ME</small><h3>{record.display.title ?? record.display.subtitle}</h3><p>{record.display.plate}</p><div className={workflow.ready ? styles.meReady : styles.meWorking}>{workflow.ready ? (greek ? "Έτοιμο για παραλαβή" : "Ready for pickup") : (greek ? "Στο συνεργείο" : "In the workshop")}</div></section>
    <section className={styles.workflowCard}><p className={styles.sectionLabel}>{greek ? "ΤΡΕΧΟΥΣΑ ΕΠΙΣΚΕΨΗ" : "CURRENT VISIT"}</p>{job.title.split(" · ").map((item) => <div className={styles.summaryRow} key={item}><Check size={14}/><span>{item}</span></div>)}{total > 0 && <div className={styles.totalLine}><span>{greek ? "Σύνολο" : "Total"}</span><strong>€{total.toFixed(2)}</strong></div>}</section>
    <label className={styles.customerNote}>{greek ? "Μήνυμα προς πελάτη" : "Customer message"}<textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => setCustomerNote(job.id, note)} placeholder={greek ? "Προαιρετικό" : "Optional"}/></label>
    <p className={styles.meHint}>{greek ? "Προεπισκόπηση. Το πραγματικό share link θα ενεργοποιηθεί όταν συνδεθεί το Supabase ώστε να δουλεύει και εκτός αυτής της συσκευής." : "Preview. The real share link will be enabled with Supabase so it works across devices."}</p>
  </div>;
}

function EmptyPanel({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) { return <div className={styles.empty}><span>{icon}</span><strong>{title}</strong>{hint && <small>{hint}</small>}</div>; }
function statusLabel(status: string, t: Copy) { if (status === "in_progress") return t.statusInProgress; if (status === "done") return t.statusDone; if (status === "cancelled") return t.statusCancelled; return t.statusScheduled; }

function Overview({ t, lang, vehicle, customer, currentJob, lastActivity, scanSuggestion, empty, openCustomerTab, openCreation }: { t: Copy; lang: "el" | "en"; vehicle: Vehicle; customer: VehicleRecordModel["customer"]; currentJob: Job | null; lastActivity: VehicleRecordModel["lastActivity"]; scanSuggestion: VehicleRecordModel["scanSuggestion"]; empty: VehicleRecordModel["empty"]; openCustomerTab: () => void; openCreation: (mode: string) => void }) {
  return <>
    {scanSuggestion && <aside className={styles.scanSuggestion}><strong>{scanSuggestion.conflicts.length ? t.scanDiffers : t.scanUnconfirmed}</strong><p>{[scanSuggestion.make, scanSuggestion.model].filter(Boolean).join(" ")}</p><small>{scanSuggestion.conflicts.length ? t.keepExisting : t.confirmLater}</small></aside>}
    <section className={styles.infoGrid}><button onClick={openCustomerTab}><small><UserRound size={13}/>{t.owner}</small><strong>{customer ? customer.name : t.noCustomer}</strong></button><div><small><Gauge size={13}/>{t.mileage}</small><strong>{empty.mileage ? "—" : formatMileage(vehicle.mileage_km, lang)}</strong></div></section>
    <section className={styles.basicBlock}><p>{t.currentWork}</p>{currentJob ? <article className={styles.basicJob}><span/><div><strong>{currentJob.title}</strong><small>{statusLabel(currentJob.status, t)}</small></div></article> : <div className={styles.emptyActions}><EmptyPanel icon={<CircleDashed size={20}/>} title={t.noOpenJob} hint={t.noOpenJobHint}/><button onClick={() => openCreation("job")}><Wrench size={14}/>{t.newJob}</button><button onClick={() => openCreation("note")}><StickyNote size={14}/>{t.newNote}</button></div>}</section>
    {lastActivity && <section className={styles.basicBlock}><p>{t.lastActivity}</p><div className={styles.activity}><Clock3 size={16}/><div><strong>{lastActivity.kind === "note" ? lastActivity.note?.body?.slice(0, 70) ?? t.note : lastActivity.job?.title ?? t.activityScan}</strong><small>{formatRelative(lastActivity.at, new Date(), lang)}</small></div></div></section>}
  </>;
}

function Jobs({ t, lang, jobs, empty, onJobUpdate, openCreation }: { t: Copy; lang: "el" | "en"; jobs: VehicleRecordModel["jobs"]; empty: VehicleRecordModel["empty"]; onJobUpdate: (jobId: string, status: string) => void; openCreation: (mode: string) => void }) {
  function nextStatus(s: string) { return s === "scheduled" ? "in_progress" : s === "in_progress" ? "done" : "scheduled"; }
  function nextLabel(s: string) { return s === "scheduled" ? t.markInProgress : s === "in_progress" ? t.markDone : t.reopen; }
  if (empty.jobs) return <div className={styles.emptyActions}><EmptyPanel icon={<Wrench size={20}/>} title={t.noJobs} hint={t.noJobsHint}/><button onClick={() => openCreation("job")}><Wrench size={14}/>{t.newJob}</button></div>;
  return <><section className={styles.basicBlock}><p>{t.progress}</p>{jobs.open.map((job) => <article className={styles.basicJob} key={job.id}><span/><div><strong>{job.title}</strong><small>{statusLabel(job.status, t)}{job.scheduled_for ? ` · ${formatDateTime(job.scheduled_for, lang)}` : ""}</small></div><button onClick={() => onJobUpdate(job.id, nextStatus(job.status))}>{nextLabel(job.status)}</button></article>)}</section><section className={styles.basicBlock}><p>{t.history}</p>{jobs.history.length ? jobs.history.map((job) => <article className={styles.historyRow} key={job.id}><Check size={13}/><div><strong>{job.title}</strong><small>{formatDate(job.completed_at ?? job.created_at, lang)}{job.mileage_km !== null ? ` · ${formatMileage(job.mileage_km, lang)}` : ""}</small></div></article>) : <EmptyPanel icon={<Clock3 size={20}/>} title={t.noHistory}/>}</section></>;
}

function Notes({ t, lang, notes, empty }: { t: Copy; lang: "el" | "en"; notes: VehicleRecordModel["notes"]; empty: VehicleRecordModel["empty"] }) {
  if (empty.notes) return <EmptyPanel icon={<StickyNote size={20}/>} title={t.noNotes} hint={t.noNotesHint}/>;
  return <section className={styles.notes}>{notes.map((note) => <article key={note.id}><header><strong>{note.author ?? t.garage}</strong><small>{formatDateTime(note.created_at, lang)}</small></header><p>{note.body}</p>{note.photo_paths.length > 0 && <div><ImageIcon size={15}/><small>{note.photo_paths.length} {t.photos}</small></div>}</article>)}</section>;
}

function CustomerPanel({ t, customer, otherVehicles, empty, openVehicle, customerPhoto, vehiclePhoto, onCustomerPhotoChange }: { t: Copy; customer: VehicleRecordModel["customer"]; otherVehicles: Vehicle[]; empty: VehicleRecordModel["empty"]; openVehicle: (vehicleId: string) => void; customerPhoto: string | null; vehiclePhoto: string | null; onCustomerPhotoChange: (url: string) => void }) {
  if (empty.customer || !customer) return <EmptyPanel icon={<UserRound size={20}/>} title={t.noCustomer} hint={t.noCustomerHint}/>;
  return <><section className={styles.customerCard}><button onClick={async () => { const url = await pickPhoto(); if (url) onCustomerPhotoChange(url); }}>{(customerPhoto ?? vehiclePhoto) ? <img src={customerPhoto ?? vehiclePhoto!} alt={customer.name}/> : <span>{initials(customer.name)}</span>}</button><div><strong>{customer.name}</strong>{customer.phone ? <a href={"tel:" + customer.phone.replaceAll(" ", "")}><Phone size={13}/>{customer.phone}</a> : <small>{t.noPhone}</small>}{customer.email && <a href={"mailto:" + customer.email}><Mail size={13}/>{customer.email}</a>}</div></section><section className={styles.basicBlock}><p>{t.otherVehicles}</p>{otherVehicles.length ? otherVehicles.map((row) => <button className={styles.otherVehicle} key={row.id} onClick={() => openVehicle(row.id)}><span>{row.plate}</span><strong>{[row.make, row.model].filter(Boolean).join(" ") || t.unknownVehicle}</strong><ChevronRight size={16}/></button>) : <EmptyPanel icon={<Camera size={20}/>} title={t.onlyVehicle}/>}</section></>;
}
