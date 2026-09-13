"use client";

import { Camera, ChevronRight, Clock3, Plus, Wrench } from "lucide-react";
import styles from "./motofy2.module.css";
import tabCss from "./screen-tabs.module.css";
import { pickPhoto } from "../lib/data/photo-store.mjs";
import type { JobWorkflow } from "../lib/data/workflow-store.mjs";
import { formatMileage } from "../lib/data/vehicle-record.mjs";
import type { VehicleRecord as VehicleRecordModel } from "../lib/data/vehicle-record.d.mts";
import type { Job } from "../lib/data/schema.d.mts";
import { ActiveVisit, PartsScreen, CostScreen, Overview, Jobs, Notes, CustomerPanel, statusLabel, EmptyPanel } from "./visit-panels";

export type Tab = "overview" | "jobs" | "next" | "notes" | "customer";
export type VisitTab = "work" | "parts" | "cost" | "photos";
type Copy = Record<string, string>;

export function RecordHome({ record, t, lang, tab, setTab, openVehicle, onJobUpdate, openCreation, vehiclePhoto, customerPhoto, onVehiclePhotoChange, onCustomerPhotoChange, openVisit, activeJob }: {
  record: VehicleRecordModel; t: Copy; lang: "el" | "en"; tab: Tab; setTab: (tab: Tab) => void; openVehicle: (id: string) => void; onJobUpdate: (id: string, status: string) => void; openCreation: (mode: string) => void; vehiclePhoto: string | null; customerPhoto: string | null; onVehiclePhotoChange: (url: string) => void; onCustomerPhotoChange: (url: string) => void; openVisit: () => void; activeJob: Job | null;
}) {
  const { vehicle, display, customer, otherVehicles, jobs, notes, lastActivity, scanSuggestion, empty } = record;
  const greek = lang === "el";
  const tabs: Array<[Tab, string]> = [["overview", t.overview], ["jobs", t.jobs], ["next", greek ? "Επόμενο" : "Next"], ["notes", t.notes], ["customer", t.owner]];
  return <div className={styles.recordBody}>
    <section className={styles.vehicleHero}>
      <button className={styles.vehiclePhoto} onClick={async () => { const url = await pickPhoto(); if (url) onVehiclePhotoChange(url); }} aria-label={t.changePhoto}>{vehiclePhoto ? <img src={vehiclePhoto} alt={display.plate}/> : <span><Camera size={22}/></span>}</button>
      <div><span className={styles.plate}>{display.plate}</span><h3>{display.subtitle || display.title || t.unknownVehicle}</h3><p>{customer?.name ?? t.noCustomer}{vehicle.mileage_km !== null ? ` · ${formatMileage(vehicle.mileage_km, lang)}` : ""}</p></div>
    </section>

    <button className={activeJob ? styles.activeVisitCard : styles.newVisitCard} onClick={openVisit}>
      <span>{activeJob ? <Wrench size={18}/> : <Plus size={18}/>}</span>
      <div><small>{activeJob ? (greek ? "ΣΤΟ ΣΥΝΕΡΓΕΙΟ ΤΩΡΑ" : "IN THE WORKSHOP") : (greek ? "ΝΕΑ ΕΠΙΣΚΕΨΗ" : "NEW VISIT")}</small><strong>{activeJob ? activeJob.title : (greek ? "Γρήγορη εισαγωγή" : "Quick check-in")}</strong><em>{activeJob ? statusLabel(activeJob.status, t) : (greek ? "Χιλιόμετρα · εργασία · σημείωση" : "Mileage · work · note")}</em></div><ChevronRight size={18}/>
    </button>

    <div className={`${styles.tabs} ${tabCss.five}`}>{tabs.map(([id, label]) => <button key={id} className={tab === id ? styles.tabActive : ""} onClick={() => setTab(id)}>{label}</button>)}</div>

    {tab === "overview" && <Overview t={t} lang={lang} vehicle={vehicle} customer={customer} currentJob={jobs.current} lastActivity={lastActivity} scanSuggestion={scanSuggestion} empty={empty} openCustomerTab={() => setTab("customer")} openCreation={openCreation}/>}
    {tab === "jobs" && <Jobs t={t} lang={lang} jobs={jobs} empty={empty} onJobUpdate={onJobUpdate} openCreation={openCreation}/>}
    {tab === "next" && <NextPanel lang={lang} />}
    {tab === "notes" && <Notes t={t} lang={lang} notes={notes} empty={empty}/>}
    {tab === "customer" && <CustomerPanel t={t} customer={customer} otherVehicles={otherVehicles} empty={empty} openVehicle={openVehicle} customerPhoto={customerPhoto} vehiclePhoto={vehiclePhoto} onCustomerPhotoChange={onCustomerPhotoChange}/>}
  </div>;
}

export function VisitScreen({ job, workflow, lang, visitTab, setVisitTab, onJobUpdate, refreshWorkflow, openCheckout, openMe, vehiclePhoto, onVehiclePhotoChange }: {
  job: Job; workflow: JobWorkflow; lang: "el" | "en"; visitTab: VisitTab; setVisitTab: (tab: VisitTab) => void;
  onJobUpdate: (id: string, status: string) => void; refreshWorkflow: () => void; openCheckout: () => void; openMe: () => void;
  vehiclePhoto: string | null; onVehiclePhotoChange: (url: string) => void;
}) {
  const greek = lang === "el";
  const tabs: Array<[VisitTab, string]> = [
    ["work", greek ? "Δουλειά" : "Work"],
    ["parts", greek ? "Μέρη" : "Parts"],
    ["cost", greek ? "Κόστος" : "Cost"],
    ["photos", greek ? "Φωτο" : "Photos"],
  ];
  return <div className={styles.recordBody}>
    <div className={tabCss.visitTabs}>{tabs.map(([id, label]) => <button key={id} className={visitTab === id ? styles.tabActive : ""} onClick={() => setVisitTab(id)}>{label}</button>)}</div>
    {visitTab === "work" && <ActiveVisit job={job} workflow={workflow} lang={lang} onJobUpdate={onJobUpdate} refreshWorkflow={refreshWorkflow} openCheckout={openCheckout} openMe={openMe}/>}
    {visitTab === "parts" && <PartsScreen jobId={job.id} workflow={workflow} lang={lang} refresh={refreshWorkflow}/>}
    {visitTab === "cost" && <CostScreen jobId={job.id} workflow={workflow} lang={lang} refresh={refreshWorkflow}/>}
    {visitTab === "photos" && <VisitPhotos lang={lang} vehiclePhoto={vehiclePhoto} onVehiclePhotoChange={onVehiclePhotoChange}/>}
  </div>;
}

function NextPanel({ lang }: { lang: "el" | "en" }) {
  const greek = lang === "el";
  return <EmptyPanel icon={<Clock3 size={20}/>} title={greek ? "Τίποτα σε εκκρεμότητα" : "Nothing pending"} hint={greek ? "Ό,τι σημειώσεις Επόμενο σε μια επίσκεψη θα κάθεται εδώ." : "Items marked Next on a visit will live here."}/>;
}

function VisitPhotos({ lang, vehiclePhoto, onVehiclePhotoChange }: { lang: "el" | "en"; vehiclePhoto: string | null; onVehiclePhotoChange: (url: string) => void }) {
  const greek = lang === "el";
  return <section className={styles.workflowCard}>
    <p className={styles.sectionLabel}>{greek ? "ΦΩΤΟ ΕΠΙΣΚΕΨΗΣ" : "VISIT PHOTOS"}</p>
    <button className={styles.vehiclePhoto} style={{width:"100%",height:180}} onClick={async () => { const url = await pickPhoto(); if (url) onVehiclePhotoChange(url); }}>
      {vehiclePhoto ? <img src={vehiclePhoto} alt=""/> : <span><Camera size={22}/></span>}
    </button>
    <p className={styles.meHint}>{greek ? "Προσωρινά μία φωτο. Το Internal / Share έρχεται με το Motofy Me." : "One photo for now. Internal / Share lands with Motofy Me."}</p>
  </section>;
}
