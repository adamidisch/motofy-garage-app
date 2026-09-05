"use client";

import { useMemo, useState } from "react";
import { CarFront, Check, UserRound, Wrench, X } from "lucide-react";

import type { Repository } from "../lib/data/repository.d.mts";

export type CreationMode = "vehicle" | "customer" | "job" | "note";
type Copy = Record<string, string>;

type VehicleDraft = { plate: string; make: string; model: string; mileage_km: string; customer_id: string };
type CustomerDraft = { name: string; phone: string };
type JobDraft = { vehicle_id: string; title: string; mileage_km: string };
type NoteDraft = { vehicle_id: string; body: string };

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
  const title = mode === "vehicle" ? t.newCar : mode === "customer" ? t.newCustomer : mode === "job" ? t.newJob : t.newNote;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="creation-modal">
        <header className="creation-header">
          <div><p className="eyebrow">{t.add}</p><h2>{title}</h2></div>
          <button aria-label={t.cancel} onClick={close}><X size={20}/></button>
        </header>
        {mode === "vehicle" && <VehicleForm repository={repository} t={t} initialScan={initialScan} onSubmit={onCreateVehicle} close={close}/>} 
        {mode === "customer" && <CustomerForm t={t} onSubmit={onCreateCustomer} close={close}/>} 
        {mode === "job" && <JobForm repository={repository} t={t} initialVehicleId={initialVehicleId} onSubmit={onCreateJob} close={close}/>} 
        {mode === "note" && <NoteForm repository={repository} t={t} initialVehicleId={initialVehicleId} onSubmit={onCreateNote} close={close}/>} 
      </section>
    </div>
  );
}

function VehicleForm({ repository, t, initialScan, onSubmit, close }: { repository: Repository; t: Copy; initialScan?: { plate: string | null; make: string | null; model: string | null } | null; onSubmit: (draft: { plate: string; make: string | null; model: string | null; mileage_km: number | null; customer_id: string | null }) => void; close: () => void }) {
  const [draft, setDraft] = useState<VehicleDraft>({ plate: initialScan?.plate ?? "", make: initialScan?.make ?? "", model: initialScan?.model ?? "", mileage_km: "", customer_id: "" });
  const customers = useMemo(() => repository.listCustomers(), [repository]);
  return <form className="creation-form" onSubmit={(event) => { event.preventDefault(); if (!draft.plate.trim()) return; onSubmit({ plate: draft.plate, make: draft.make || null, model: draft.model || null, mileage_km: draft.mileage_km ? Number(draft.mileage_km) : null, customer_id: draft.customer_id || null }); }}>
    {initialScan && <div className="creation-context"><CarFront size={16}/><span>{t.scanPrefilled}</span></div>}
    <Field label={t.plate} value={draft.plate} onChange={(value) => setDraft({ ...draft, plate: value })} required autoFocus />
    <div className="creation-two"><Field label={t.fieldMake} value={draft.make} onChange={(value) => setDraft({ ...draft, make: value })}/><Field label={t.fieldModel} value={draft.model} onChange={(value) => setDraft({ ...draft, model: value })}/></div>
    <Field label={t.mileage} value={draft.mileage_km} onChange={(value) => setDraft({ ...draft, mileage_km: value })} inputMode="numeric" placeholder={t.optional}/>
    <label className="creation-label">{t.owner}<select value={draft.customer_id} onChange={(event) => setDraft({ ...draft, customer_id: event.target.value })}><option value="">{t.noCustomer}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
    <footer className="creation-actions"><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button type="submit" className="primary-button"><Check size={17}/>{t.createRecord}</button></footer>
  </form>;
}

function CustomerForm({ t, onSubmit, close }: { t: Copy; onSubmit: (draft: { name: string; phone: string | null }) => void; close: () => void }) {
  const [draft, setDraft] = useState<CustomerDraft>({ name: "", phone: "" });
  return <form className="creation-form" onSubmit={(event) => { event.preventDefault(); if (draft.name.trim()) onSubmit({ name: draft.name, phone: draft.phone || null }); }}>
    <div className="creation-context"><UserRound size={16}/><span>{t.customerHint}</span></div>
    <Field label={t.customerName} value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} required autoFocus />
    <Field label={t.phone} value={draft.phone} onChange={(value) => setDraft({ ...draft, phone: value })} inputMode="tel" placeholder={t.optional}/>
    <footer className="creation-actions"><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button type="submit" className="primary-button"><Check size={17}/>{t.createCustomer}</button></footer>
  </form>;
}

function JobForm({ repository, t, initialVehicleId, onSubmit, close }: { repository: Repository; t: Copy; initialVehicleId?: string | null; onSubmit: (draft: { vehicle_id: string; title: string; mileage_km: number | null }) => void; close: () => void }) {
  const [draft, setDraft] = useState<JobDraft>({ vehicle_id: initialVehicleId ?? repository.listVehicles()[0]?.id ?? "", title: "", mileage_km: "" });
  const vehicles = useMemo(() => repository.listVehicles(), [repository]);
  const choices = [t.service, t.inspection, t.repair, t.other];
  return <form className="creation-form" onSubmit={(event) => { event.preventDefault(); if (draft.vehicle_id && draft.title.trim()) onSubmit({ vehicle_id: draft.vehicle_id, title: draft.title, mileage_km: draft.mileage_km ? Number(draft.mileage_km) : null }); }}>
    <label className="creation-label">{t.vehicle}<select value={draft.vehicle_id} onChange={(event) => setDraft({ ...draft, vehicle_id: event.target.value })}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" · ")}</option>)}</select></label>
    <div className="quick-choices">{choices.map((choice) => <button type="button" key={choice} className={draft.title === choice ? "selected" : ""} onClick={() => setDraft({ ...draft, title: choice })}><Wrench size={14}/>{choice}</button>)}</div>
    <Field label={t.jobTitle} value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} required autoFocus />
    <Field label={t.mileage} value={draft.mileage_km} onChange={(value) => setDraft({ ...draft, mileage_km: value })} inputMode="numeric" placeholder={t.optional}/>
    <footer className="creation-actions"><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button type="submit" className="primary-button"><Check size={17}/>{t.createJob}</button></footer>
  </form>;
}

function NoteForm({ repository, t, initialVehicleId, onSubmit, close }: { repository: Repository; t: Copy; initialVehicleId?: string | null; onSubmit: (draft: { vehicle_id: string; body: string }) => void; close: () => void }) {
  const [draft, setDraft] = useState<NoteDraft>({ vehicle_id: initialVehicleId ?? repository.listVehicles()[0]?.id ?? "", body: "" });
  const vehicles = useMemo(() => repository.listVehicles(), [repository]);
  return <form className="creation-form" onSubmit={(event) => { event.preventDefault(); if (draft.vehicle_id && draft.body.trim()) onSubmit({ vehicle_id: draft.vehicle_id, body: draft.body }); }}>
    <label className="creation-label">{t.vehicle}<select value={draft.vehicle_id} onChange={(event) => setDraft({ ...draft, vehicle_id: event.target.value })}>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" · ")}</option>)}</select></label>
    <label className="creation-label">{t.note}<textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder={t.notePlaceholder} autoFocus rows={4}/></label>
    <footer className="creation-actions"><button type="button" className="secondary-button" onClick={close}>{t.cancel}</button><button type="submit" className="primary-button"><Check size={17}/>{t.createNote}</button></footer>
  </form>;
}

function Field({ label, value, onChange, required, autoFocus, inputMode, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; autoFocus?: boolean; inputMode?: "numeric" | "tel"; placeholder?: string }) {
  return <label className="creation-label">{label}<input value={value} onChange={(event) => onChange(event.target.value)} required={required} autoFocus={autoFocus} inputMode={inputMode} placeholder={placeholder}/></label>;
}
