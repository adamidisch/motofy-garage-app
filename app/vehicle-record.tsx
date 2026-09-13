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

type Tab = "overview" | "jobs" | "next" | "notes" | "customer";
type VisitTab = "work" | "parts" | "cost" | "photos";
type Screen = "record" | "visit" | "checkout" | "me";
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
  const [visitTab, setVisitTab] = useState<VisitTab>("work");
  const [screen, setScreen] = useState<Screen>("record");
  const [, setWorkflowVersion] = useState(0);
  const { display, jobs } = record;
  const activeJob = jobs.current ?? jobs.open[0] ?? null;
  const workflow = activeJob ? getJobWorkflow(activeJob.id) : null;
  const greek = lang === "el";

  function refreshWorkflow() { setWorkflowVersion((value) => value + 1); }
  function back() {
    if (screen === "record") close();
    else { setVisitTab("work"); setScreen("record"); }
  }
  function openVisit() { if (!activeJob) { openCreation("job"); return; } setVisitTab("work"); setScreen("visit"); }

  return <div className={styles.screenLayer} role="main" aria-label={t.vehicle}>
    <section className={styles.recordScreen}>
      <header className={styles.recordHeader}>
        <button aria-label={t.cancel} onClick={back}><ArrowLeft size={20}/></button>
        <div><p>{screen === "record" ? t.vehicle : screen === "visit" ? (greek ? "ΕΝΕΡΓΗ ΕΠΙΣΚΕΨΗ" : "ACTIVE VISIT") : screen === "checkout" ? (greek ? "ΠΑΡΑΔΟΣΗ" : "CHECKOUT") : "MOTOFY ME"}</p><h2>{display.title ?? t.unknownVehicle}</h2></div>
        <span className={styles.headerPlate}>{display.plate}</span>
      </header>

      {screen === "record" && <RecordHome record={record} t={t} lang={lang} tab={tab} setTab={setTab} openVehicle={openVehicle} onJobUpdate={onJobUpdate} openCreation={openCreation} vehiclePhoto={vehiclePhoto} customerPhoto={customerPhoto} onVehiclePhotoChange={onVehiclePhotoChange} onCustomerPhotoChange={onCustomerPhotoChange} openVisit={openVisit} activeJob={activeJob} />}
      {screen === "visit" && activeJob && workflow && <VisitScreen job={activeJob} workflow={workflow} lang={lang} visitTab={visitTab} setVisitTab={setVisitTab} onJobUpdate={onJobUpdate} refreshWorkflow={refreshWorkflow} openCheckout={() => setScreen("checkout")} openMe={() => setScreen("me")} vehiclePhoto={vehiclePhoto} onVehiclePhotoChange={onVehiclePhotoChange} />}
      {screen === "checkout" && activeJob && workflow && <CheckoutScreen job={activeJob} workflow={workflow} record={record} lang={lang} onComplete={() => { onJobUpdate(activeJob.id, "done"); setReady(activeJob.id, false); refreshWorkflow(); setScreen("record"); }}/>}
      {screen === "me" && activeJob && workflow && <MotofyMePreview record={record} job={activeJob} workflow={workflow} lang={lang}/>}
    </section>
  </div>;
}
