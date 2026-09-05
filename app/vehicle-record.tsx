"use client";

import { useState } from "react";
import { ArrowLeft, CalendarClock, Camera, Check, ChevronRight, CircleDashed, Clock3, Gauge, ImageIcon, Mail, Phone, ScanLine, StickyNote, UserRound, Wrench, X } from "lucide-react";

import { formatDate, formatDateTime, formatMileage, formatRelative, initials } from "../lib/data/vehicle-record.mjs";
import type { VehicleRecord as VehicleRecordModel } from "../lib/data/vehicle-record.d.mts";
import type { Job, Vehicle } from "../lib/data/schema.d.mts";

type Tab = "overview" | "jobs" | "notes" | "customer";
type Copy = Record<string, string>;

/**
 * The record is read-only in this step. There is deliberately no composer, no
 * edit control and no delete: creation flows arrive next, and a button that
 * looks live but does nothing is worse than no button.
 */
export default function VehicleRecord({
  record,
  t,
  lang,
  close,
  openVehicle,
}: {
  record: VehicleRecordModel;
  t: Copy;
  lang: "el" | "en";
  close: () => void;
  openVehicle: (vehicleId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const { vehicle, display, customer, otherVehicles, jobs, notes, lastActivity, scanSuggestion, empty } = record;

  const tabs: Array<[Tab, string]> = [
    ["overview", t.overview],
    ["jobs", t.jobs],
    ["notes", t.notes],
    ["customer", t.owner],
  ];

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.vehicle}
      onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <section className="record-modal">
        <header>
          <button aria-label={t.cancel} onClick={close}><ArrowLeft size={20}/></button>
          <div>
            <p className="eyebrow">{t.vehicle}</p>
            <h2>{display.title ?? t.unknownVehicle}</h2>
          </div>
          <button aria-label={t.cancel} onClick={close}><X size={20}/></button>
        </header>

        <div className="plate-display">{display.plate}</div>
        {display.subtitle && <p className="record-subtitle">{display.subtitle}</p>}

        <div className="record-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="record-panel">
          {tab === "overview" && (
            <Overview
              t={t}
              lang={lang}
              vehicle={vehicle}
              customer={customer}
              currentJob={jobs.current}
              lastActivity={lastActivity}
              scanSuggestion={scanSuggestion}
              empty={empty}
              openCustomerTab={() => setTab("customer")}
            />
          )}

          {tab === "jobs" && <Jobs t={t} lang={lang} jobs={jobs} empty={empty}/>}

          {tab === "notes" && <Notes t={t} lang={lang} notes={notes} empty={empty}/>}

          {tab === "customer" && (
            <CustomerPanel
              t={t}
              customer={customer}
              otherVehicles={otherVehicles}
              empty={empty}
              openVehicle={openVehicle}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EmptyPanel({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="record-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function statusLabel(status: string, t: Copy) {
  if (status === "in_progress") return t.statusInProgress;
  if (status === "done") return t.statusDone;
  if (status === "cancelled") return t.statusCancelled;
  return t.statusScheduled;
}

/* ------------------------------------------------------------------ */

function Overview({
  t, lang, vehicle, customer, currentJob, lastActivity, scanSuggestion, empty, openCustomerTab,
}: {
  t: Copy; lang: "el" | "en"; vehicle: Vehicle; customer: VehicleRecordModel["customer"];
  currentJob: Job | null; lastActivity: VehicleRecordModel["lastActivity"];
  scanSuggestion: VehicleRecordModel["scanSuggestion"]; empty: VehicleRecordModel["empty"];
  openCustomerTab: () => void;
}) {
  return (
    <>
      {scanSuggestion && <ScanSuggestion t={t} lang={lang} suggestion={scanSuggestion}/>}

      <section className="record-grid">
        <button className="record-cell" onClick={openCustomerTab}>
          <small><UserRound size={13}/>{t.owner}</small>
          <strong>{customer ? customer.name : t.noCustomer}</strong>
        </button>
        <div className="record-cell">
          <small><Gauge size={13}/>{t.mileage}</small>
          <strong>{empty.mileage ? "—" : formatMileage(vehicle.mileage_km, lang)}</strong>
        </div>
      </section>

      <section className="record-block">
        <p className="eyebrow">{t.currentWork}</p>
        {currentJob ? (
          <article className={"record-job current " + currentJob.status}>
            <span className={"status-dot " + currentJob.status}/>
            <div>
              <strong>{currentJob.title}</strong>
              <small>
                {statusLabel(currentJob.status, t)}
                {currentJob.scheduled_for ? ` · ${formatDateTime(currentJob.scheduled_for, lang)}` : ""}
              </small>
            </div>
          </article>
        ) : (
          <EmptyPanel icon={<CircleDashed size={20}/>} title={t.noOpenJob} hint={t.noOpenJobHint}/>
        )}
      </section>

      {lastActivity && (
        <section className="record-block">
          <p className="eyebrow">{t.lastActivity}</p>
          <div className="record-activity">
            <span><Clock3 size={16}/></span>
            <div>
              <strong>{activityTitle(lastActivity, t)}</strong>
              <small>{formatRelative(lastActivity.at, new Date(), lang)}</small>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function activityTitle(entry: NonNullable<VehicleRecordModel["lastActivity"]>, t: Copy) {
  if (entry.kind === "note") return entry.note?.body?.slice(0, 70) ?? t.note;
  if (entry.kind === "job_completed") return `${t.statusDone} · ${entry.job?.title ?? ""}`.trim();
  if (entry.kind === "job") return entry.job?.title ?? t.jobs;
  if (entry.kind === "scan") return t.activityScan;
  return t.activityCreated;
}

/* ------------------------------------------------------------------ */

/**
 * The suggestion never writes. It reports what the camera read next to what the
 * record holds and stops there; accepting a reading is an explicit action that
 * arrives with the editing flows.
 */
function ScanSuggestion({ t, lang, suggestion }: { t: Copy; lang: "el" | "en"; suggestion: NonNullable<VehicleRecordModel["scanSuggestion"]> }) {
  const hasConflict = suggestion.conflicts.length > 0;
  return (
    <aside className={"scan-suggestion" + (hasConflict ? " conflict" : "")}>
      <header>
        <span><ScanLine size={15}/></span>
        <div>
          <strong>{hasConflict ? t.scanDiffers : t.scanUnconfirmed}</strong>
          <small>
            {suggestion.provider ?? "AI"}
            {suggestion.scannedAt ? ` · ${formatRelative(suggestion.scannedAt, new Date(), lang)}` : ""}
          </small>
        </div>
      </header>

      {hasConflict ? (
        <ul>
          {suggestion.conflicts.map((conflict) => (
            <li key={conflict.field}>
              <span>{conflict.field === "make" ? t.fieldMake : t.fieldModel}</span>
              <em>{conflict.current}</em>
              <ChevronRight size={13}/>
              <b>{conflict.scanned}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="scan-suggestion-read">{[suggestion.make, suggestion.model].filter(Boolean).join(" ")}</p>
      )}

      <footer>{hasConflict ? t.keepExisting : t.confirmLater}</footer>
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function Jobs({ t, lang, jobs, empty }: { t: Copy; lang: "el" | "en"; jobs: VehicleRecordModel["jobs"]; empty: VehicleRecordModel["empty"] }) {
  if (empty.jobs) {
    return <EmptyPanel icon={<Wrench size={20}/>} title={t.noJobs} hint={t.noJobsHint}/>;
  }

  return (
    <>
      <section className="record-block">
        <p className="eyebrow">{t.progress}</p>
        {jobs.open.length ? (
          jobs.open.map((job) => (
            <article className={"record-job " + job.status} key={job.id}>
              <span className={"status-dot " + job.status}/>
              <div>
                <strong>{job.title}</strong>
                <small>
                  {statusLabel(job.status, t)}
                  {job.scheduled_for ? ` · ${formatDateTime(job.scheduled_for, lang)}` : ""}
                </small>
                {job.description && <p>{job.description}</p>}
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel icon={<CircleDashed size={20}/>} title={t.noOpenJob}/>
        )}
      </section>

      <section className="record-block">
        <p className="eyebrow">{t.history}</p>
        {jobs.history.length ? (
          <ol className="record-timeline">
            {jobs.history.map((job) => (
              <li key={job.id} className={job.status}>
                <span>{job.status === "done" ? <Check size={12}/> : <X size={12}/>}</span>
                <div>
                  <strong>{job.title}</strong>
                  <small>
                    {formatDate(job.completed_at ?? job.created_at, lang)}
                    {job.mileage_km !== null ? ` · ${formatMileage(job.mileage_km, lang)}` : ""}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyPanel icon={<CalendarClock size={20}/>} title={t.noHistory}/>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Notes({ t, lang, notes, empty }: { t: Copy; lang: "el" | "en"; notes: VehicleRecordModel["notes"]; empty: VehicleRecordModel["empty"] }) {
  if (empty.notes) {
    return <EmptyPanel icon={<StickyNote size={20}/>} title={t.noNotes} hint={t.noNotesHint}/>;
  }

  return (
    <section className="record-notes">
      {notes.map((note) => (
        <article key={note.id}>
          <header>
            <strong>{note.author ?? t.garage}</strong>
            <small>{formatDateTime(note.created_at, lang)}</small>
          </header>
          <p>{note.body}</p>
          {note.photo_paths.length > 0 && (
            <div className="note-photos" aria-label={t.photos}>
              {note.photo_paths.map((path) => (
                // The image itself arrives with Storage. Until then the record
                // shows that a photo exists rather than a broken thumbnail.
                <span key={path} className="note-photo-placeholder"><ImageIcon size={15}/></span>
              ))}
              <small>{note.photo_paths.length} {t.photos}</small>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CustomerPanel({
  t, customer, otherVehicles, empty, openVehicle,
}: {
  t: Copy; customer: VehicleRecordModel["customer"]; otherVehicles: Vehicle[];
  empty: VehicleRecordModel["empty"]; openVehicle: (vehicleId: string) => void;
}) {
  if (empty.customer || !customer) {
    return <EmptyPanel icon={<UserRound size={20}/>} title={t.noCustomer} hint={t.noCustomerHint}/>;
  }

  return (
    <>
      <section className="record-customer">
        <span className="avatar blue">{initials(customer.name)}</span>
        <div>
          <strong>{customer.name}</strong>
          {customer.phone ? (
            <a href={"tel:" + customer.phone.replaceAll(" ", "")}><Phone size={13}/>{customer.phone}</a>
          ) : (
            <small>{t.noPhone}</small>
          )}
          {customer.email && <a href={"mailto:" + customer.email}><Mail size={13}/>{customer.email}</a>}
        </div>
      </section>

      <section className="record-block">
        <p className="eyebrow">{t.otherVehicles}</p>
        {empty.otherVehicles ? (
          <EmptyPanel icon={<Camera size={20}/>} title={t.onlyVehicle}/>
        ) : (
          <div className="record-vehicle-links">
            {otherVehicles.map((row) => (
              <button key={row.id} onClick={() => openVehicle(row.id)}>
                <span className="plate-chip">{row.plate}</span>
                <strong>{[row.make, row.model].filter(Boolean).join(" ") || t.unknownVehicle}</strong>
                <ChevronRight size={16}/>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
