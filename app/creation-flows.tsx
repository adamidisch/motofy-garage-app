"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CarFront, Check, Gauge, Plus, UserRound, Wrench } from "lucide-react";
import styles from "./motofy2.module.css";

import type { Repository } from "../lib/data/repository.d.mts";

export type CreationMode = "vehicle" | "customer" | "job" | "note";
type Copy = Record<string, string>;

type VehicleDraft = { plate: string; make: string; model: string; mileage_km: string; customer_id: string };
type CustomerDraft = { name: string; phone: string };
type NoteDraft = { vehicle_id: string; body: string };

const JOB_CHOICES_EL = ["Service", "Λάδια & φίλτρο", "Φρένα", "A/C", "Ηλεκτρικά", "Παράθυρο", "Ελαστικά", "Έλεγχος"];
const JOB_CHOICES_EN = ["Service", "Oil & filter", "Brakes", "A/C", "Electrical", "Window", "Tyres", "Inspection"];

export default function CreationModal({
  mode, repository, t, initialScan, initialVehicleId, close, onCreateVehicle, onCreateCustomer, onCreateJob, onCreateNote,
}: {
  mode: CreationMode;
  repository: Repository;
  t: Copy;
  initialScan?: { plate: string | null; make: string | null; model: string | null } | null;
  initialVehicleId?: string | null;
  close: () => void;
  onCreateVehicle: (draft: { plate: string; make: string | null; model: string | null; mileage_km: number | null; customer_id: string | null }) => void;
  onCreateCustomer: (draft: { name: string; phone: string | null }) => void;
  onCreateJob: (draft: { vehicle_id: string; title: string; mileage_km: number | null }) => void;
  onCreateNote: (draft: { vehicle_id: string; body: string }) => void;
}) {
  const title = mode === "vehicle" ? t.newCar : mode === "customer" ? t.newCustomer : mode === "job" ? "Νέα επίσκεψη" : t.newNote;
  return (
    <div className={styles.screenLayer} role="dialog" aria-modal="true" aria-label={title}>
      <section className={styles.flowScreen}>
        <header className={styles.flowHeader}>
          <button aria-label={t.cancel} onClick={close}><ArrowLeft size={20}/></button>
          <div><p>{mode === "job" ? "ΓΡΗΓΟΡΗ ΕΙΣΑΓΩΓΗ" : t.add}</p><h2>{title}</h2></div>
          <span/>
        </header>
        <div className={styles.flowBody}>
          {mode === "vehicle" && <VehicleForm repository={repository} t={t} initialScan={initialScan} onSubmit={onCreateVehicle} close={close}/>} 
          {mode === "customer" && <CustomerForm t={t} onSubmit={onCreateCustomer} close={close}/>} 
          {mode === "job" && <JobForm repository={repository} t={t} initialVehicleId={initialVehicleId} onSubmit={onCreateJob} close={close}/>} 
          {mode === "note" && <NoteForm repository={repository} t={t} initialVehicleId={initialVehicleId} onSubmit={onCreateNote} close={close}/>} 
        </div>
      </section>
    </div>
  );
}

function VehicleForm({ repository, t, initialScan, onSubmit, close }: { repository: Repository; t: Copy; initialScan?: { plate: string | null; make: string | null; model: string | null } | null; onSubmit: (draft: { plate: string; make: string | null; model: string | null; mileage_km: number | null; customer_id: string | null }) => void; close: () => void }) {
  const [draft, setDraft] = useState<VehicleDraft>({ plate: initialScan?.plate ?? "", make: initialScan?.make ?? "", model: initialScan?.model ?? "", mileage_km: "", customer_id: "" });
  const customers = useMemo(() => repository.listCustomers(), [repository]);
  return <form className={styles.flowForm} onSubmit={(event) => { event.preventDefault(); if (!draft.plate.trim()) return; onSubmit({ plate: draft.plate, make: draft.make || null, model: draft.model || null, mileage_km: draft.mileage_km ? Number(draft.mileage_km) : null, customer_id: draft.customer_id || null }); }}>
    {initialScan && <div className={styles.contextCard}><CarFront size={17}/><span>{t.scanPrefilled}</span></div>}
    <Field label={t.plate} value={draft.plate} onChange={(value) => setDraft({ ...draft, plate: value })} required autoFocus />
    <div className={styles.twoCols}><Field label={t.fieldMake} value={draft.make} onChange={(value) => setDraft({ ...draft, make: value })}/><Field label={t.fieldModel} value={draft.model} onChange={(value) => setDraft({ ...draft, model: value })}/></div>
    <Field label={t.mileage} value={draft.mileage_km} onChange={(value) => setDraft({ ...draft, mileage_km: value })} inputMode="numeric" placeholder={t.optional}/>
    <label className={styles.field}>{t.owner}<select value={draft.customer_id} onChange={(event) => setDraft({ ...draft, customer_id: event.target.value })}><option value="">{t.noCustomer}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
    <Actions close={close} cancel={t.cancel} submit={t.createRecord}/>
  </form>;
}

function CustomerForm({ t, onSubmit, close }: { t: Copy; onSubmit: (draft: { name: string; phone: string | null }) => void; close: () => void }) {
  const [draft, setDraft] = useState<CustomerDraft>({ name: "", phone: "" });
  return <form className={styles.flowForm} onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSubmit({ name: draft.name, phone: draft.phone || null }); }}>
    <div className={styles.contextCard}><UserRound size={17}/><span>{t.customerHint}</span></div>
    <Field label={t.customerName} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} required autoFocus />
    <Field label={t.phone} value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} inputMode="tel" placeholder={t.optional}/>
    <Actions close={close} cancel={t.cancel} submit={t.createCustomer}/>
  </form>;
}

function JobForm({ repository, t, initialVehicleId, onSubmit, close }: { repository: Repository; t: Copy; initialVehicleId?: string | null; onSubmit: (draft: { vehicle_id: string; title: string; mileage_km: number | null }) => void; close: () => void }) {
  const vehicles = useMemo(() => repository.listVehicles(), [repository]);
  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? vehicles[0]?.id ?? "");
  const [mileage, setMileage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const greek = String(t.newCar ?? "").includes("Νέο") || String(t.customerName ?? "").includes("Όνομα");
  const choices = greek ? JOB_CHOICES_EL : JOB_CHOICES_EN;

  function toggle(choice: string) {
    setSelected((current) => current.includes(choice) ? current.filter((item) => item !== choice) : current.concat(choice));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const items = selected.concat(custom.trim() ? [custom.trim()] : []);
    if (!vehicleId || !items.length) return;
    onSubmit({ vehicle_id: vehicleId, title: items.join(" · "), mileage_km: mileage ? Number(mileage) : null });
  }

  return <form className={styles.flowForm} onSubmit={submit}>
    <div className={styles.contextCard}><Wrench size={17}/><span>{greek ? "2 λεπτά για να μπει το αυτοκίνητο στη δουλειά." : "Get the car into the workshop in two minutes."}</span></div>
    <label className={styles.field}>{t.vehicle}<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" · ")}</option>)}</select></label>
    <label className={styles.field}><span className={styles.labelRow}><span>{t.mileage}</span><Gauge size={14}/></span><input value={mileage} onChange={(event) => setMileage(event.target.value)} inputMode="numeric" placeholder={greek ? "Προαιρετικό · π.χ. 86420" : "Optional · e.g. 86420"}/></label>
    <section>
      <p className={styles.sectionLabel}>{greek ? "ΤΙ ΘΑ ΚΑΝΟΥΜΕ" : "WORK NEEDED"}</p>
      <div className={styles.choiceGrid}>{choices.map((choice) => <button type="button" key={choice} className={selected.includes(choice) ? styles.choiceSelected : styles.choice} onClick={() => toggle(choice)}><span>{selected.includes(choice) ? <Check size={14}/> : <Plus size={14}/>}</span>{choice}</button>)}</div>
    </section>
    <Field label={greek ? "Κάτι άλλο" : "Something else"} value={custom} onChange={setCustom} placeholder={greek ? "Προαιρετικό" : "Optional"}/>
    <footer className={styles.stickyActions}><button type="button" onClick={close}>{t.cancel}</button><button type="submit" disabled={!selected.length && !custom.trim()}><Check size={17}/>{greek ? "Καταχώρηση επίσκεψης" : "Create visit"}</button></footer>
  </form>;
}

function NoteForm({ repository, t, initialVehicleId, onSubmit, close }: { repository: Repository; t: Copy; initialVehicleId?: string | null; onSubmit: (draft: { vehicle_id: string; body: string }) => void; close: () => void }) {
  const [draft, setDraft] = useState<NoteDraft>({ vehicle_id: initialVehicleId ?? repository.listVehicles()[0]?.id ?? "", body: "" });
  const vehicles = useMemo(() => repository.listVehicles(), [repository]);
  return <form className={styles.flowForm} onSubmit={(event) => { event.preventDefault(); if (draft.vehicle_id && draft.body.trim()) onSubmit({ vehicle_id: draft.vehicle_id, body: draft.body }); }}>
    <label className={styles.field}>{t.vehicle}<select value={draft.vehicle_id} onChange={(event) => setDraft({ ...draft, vehicle_id: event.target.value })}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" · ")}</option>)}</select></label>
    <label className={styles.field}>{t.note}<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder={t.notePlaceholder} autoFocus rows={7}/></label>
    <Actions close={close} cancel={t.cancel} submit={t.createNote}/>
  </form>;
}

function Actions({ close, cancel, submit }: { close: () => void; cancel: string; submit: string }) {
  return <footer className={styles.stickyActions}><button type="button" onClick={close}>{cancel}</button><button type="submit"><Check size={17}/>{submit}</button></footer>;
}

function Field({ label, value, onChange, required, autoFocus, inputMode, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; autoFocus?: boolean; inputMode?: "numeric" | "tel"; placeholder?: string }) {
  return <label className={styles.field}>{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} autoFocus={autoFocus} inputMode={inputMode} placeholder={placeholder}/></label>;
}
