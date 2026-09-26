"use client";

import { useState } from "react";
import { ArrowUp, Mic, Search, Sparkles } from "lucide-react";
import { resolveMiniAI } from "../lib/mini-ai.mjs";
import type { Repository } from "../lib/data/repository.d.mts";
import type { Job, Note, Vehicle } from "../lib/data/schema.d.mts";
import styles from "./mini-ai.module.css";

type Result = {
  type: string; text?: string; action?: string; vehicle?: Vehicle;
  vehicles?: Vehicle[]; rows?: Array<{ job: Job; vehicle: Vehicle }>;
  jobs?: Job[]; notes?: Note[]; body?: string;
};
type SpeechRecognizer = {
  lang: string; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

export default function MiniAI({ repository, isDemo, lang, openAddVehicle, openJobs, openVehicle, prepareNote }: {
  repository: Repository | null;
  isDemo: boolean;
  lang: "el" | "en";
  openAddVehicle: () => void;
  openJobs: () => void;
  openVehicle: (id: string) => void;
  prepareNote: (vehicleId: string, body: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);
  const [clarifyQuery, setClarifyQuery] = useState("");
  const [pendingNoteBody, setPendingNoteBody] = useState<string | null>(null);
  const c = lang === "el" ? {
    placeholder: "Ρώτησε το Motofy ή πες τι θέλεις να κάνεις", voice: "Μίλησε στο Motofy", send: "Αποστολή",
    suggestions: ["Βάλε νέο αυτοκίνητο", "Τι δουλειές έχουμε σήμερα;"],
    loading: "Το Motofy ελέγχει το αίτημα…", add: "Άνοιγμα νέου αυτοκινήτου", jobs: "Άνοιγμα εργασιών",
    record: "Άνοιγμα καρτέλας", note: "Έλεγχος και αποθήκευση"
  } : {
    placeholder: "Ask Motofy or say what you want to do", voice: "Speak to Motofy", send: "Send",
    suggestions: ["Add a new car", "What jobs do we have today?"],
    loading: "Motofy is checking…", add: "Add a new car", jobs: "Open jobs",
    record: "Open vehicle", note: "Review and save"
  };
  const recognizer = typeof window === "undefined" ? undefined :
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognizer }).webkitSpeechRecognition;

  function handleLocal(value: string, selectedVehicleId: string | null = null): Result {
    if (!repository) return { type: "answer", text: "Τα δεδομένα φορτώνουν…" } as Result;
    return resolveMiniAI(value, repository, { selectedVehicleId }) as Result;
  }

  async function submit(value = query) {
    if (!value.trim() || pending) return;
    setQuery(value);
    const local = handleLocal(value);
    if (local.type !== "unhandled") {
      setPendingNoteBody(null); setResult(local); setClarifyQuery(local.type === "clarify" ? value : ""); return;
    }
    if (isDemo) {
      setResult({ type: "answer", text: "Δεν βρήκα τοπικό αποτέλεσμα για αυτή τη φράση στο demo." });
      return;
    }
    setPending(true);
    try {
      const general = /^(τι (ειναι|σημαινει)|what (is|does))/i.test(value.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      const response = await fetch("/api/ai-search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: value, ...(general ? { mode: "answer", scope: "general" } : { mode: "interpret" }) })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("unavailable");
      if (general && typeof data.answer === "string") {
        setResult({ type: "answer", text: data.answer }); return;
      }
      const proposal = data.proposal;
      if (proposal?.action === "open_add_vehicle") setResult({ type: "action", action: "open_add_vehicle" });
      else if (proposal?.action === "show_jobs") setResult({ type: "action", action: "show_jobs" });
      else if (proposal?.action === "open_vehicle" && typeof proposal.slots?.plate === "string") {
        const vehicle = repository?.findVehicleByPlate(proposal.slots.plate);
        setResult(vehicle ? { type: "vehicle", vehicle } : { type: "answer", text: "Δεν βρήκα αυτή την πινακίδα." });
      } else if (proposal?.action === "prepare_vehicle_note") {
        const vehicle = typeof proposal.slots?.plate === "string" ? repository?.findVehicleByPlate(proposal.slots.plate) : null;
        const noteBody = typeof proposal.slots?.note === "string" ? proposal.slots.note : "";
        setPendingNoteBody(vehicle ? null : noteBody);
        setResult(vehicle
          ? { type: "prepare_note", vehicle, body: noteBody }
          : { type: "clarify", text: "Σε ποιο όχημα να μπει η σημείωση;", vehicles: repository?.listVehicles() ?? [] });
        setClarifyQuery(value);
      } else setResult({ type: "answer", text: proposal?.clarification || "Πες μου μια πινακίδα ή τι θέλεις να ανοίξω." });
    } catch {
      setResult({ type: "answer", text: "Το AI δεν είναι διαθέσιμο τώρα. Η αναζήτηση με πινακίδα και οι γρήγορες εντολές λειτουργούν κανονικά." });
    } finally { setPending(false); }
  }

  function chooseVehicle(vehicle: Vehicle) {
    if (pendingNoteBody !== null) {
      setResult({ type: "prepare_note", vehicle, body: pendingNoteBody });
      setPendingNoteBody(null); setClarifyQuery(""); return;
    }
    const next = handleLocal(clarifyQuery, vehicle.id);
    setResult(next.type === "clarify" ? { type: "vehicle", vehicle } : next);
    setClarifyQuery("");
  }

  function startVoice() {
    if (!recognizer) return;
    try {
      const speech = new recognizer();
      speech.lang = lang === "el" ? "el-GR" : "en-GB";
      speech.interimResults = false;
      speech.onresult = event => setQuery(event.results[0]?.[0]?.transcript ?? "");
      speech.onerror = () => setResult({ type: "answer", text: "Δεν αναγνωρίστηκε η φωνή. Μπορείς να γράψεις στο ίδιο πεδίο." });
      speech.start();
    } catch { setResult({ type: "answer", text: "Το μικρόφωνο δεν είναι διαθέσιμο σε αυτόν τον browser." }); }
  }

  return <section className={styles.wrap} aria-label="Motofy Mini AI">
    <div className={styles.field}>
      <Search size={18} aria-hidden="true"/>
      <input value={query} onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }}
        placeholder={c.placeholder}
        aria-label={c.placeholder}/>
      {recognizer && <button type="button" className={styles.icon} onClick={startVoice} aria-label={c.voice}><Mic size={18}/></button>}
      <button type="button" className={styles.send} disabled={!query.trim() || pending} onClick={() => void submit()} aria-label={c.send}><ArrowUp size={17}/></button>
    </div>
    {!result && <div className={styles.suggestions}>
      {c.suggestions.map(item =>
        <button key={item} onClick={() => void submit(item)}>{item}</button>)}
    </div>}
    {pending && <p className={styles.status} role="status">{c.loading}</p>}
    {result && !pending && <div className={styles.result} role="status">
      <div className={styles.resultLabel}><Sparkles size={14}/> MOTOFY AI</div>
      {result.type === "answer" && <p>{result.text}</p>}
      {result.type === "action" && <button className={styles.row} onClick={result.action === "open_add_vehicle" ? openAddVehicle : openJobs}>
        {result.action === "open_add_vehicle" ? c.add : c.jobs} <span>›</span>
      </button>}
      {result.type === "vehicle" && result.vehicle && <button className={styles.row} onClick={() => openVehicle(result.vehicle!.id)}>
        {result.vehicle.plate} · {[result.vehicle.make, result.vehicle.model].filter(Boolean).join(" ")} <span>›</span>
      </button>}
      {result.type === "history" && <><strong>{result.vehicle?.plate} · Λάδια</strong>
        {result.jobs?.length ? result.jobs.map(job => <p key={job.id}>Ολοκληρωμένη εργασία: {job.title} · {job.completed_at ? new Date(job.completed_at).toLocaleDateString("el-CY") : "χωρίς ημερομηνία"}</p>) : <p>Δεν βρέθηκε ολοκληρωμένη εργασία αλλαγής λαδιών.</p>}
        {!!result.notes?.length && <p>Υπάρχουν {result.notes.length} σχετικές σημειώσεις. Έλεγξέ τες στην καρτέλα.</p>}
        {result.vehicle && <button className={styles.link} onClick={() => openVehicle(result.vehicle!.id)}>{c.record}</button>}
      </>}
      {result.type === "jobs" && <>{result.rows?.length ? result.rows.map(({ job, vehicle }) =>
        <button key={job.id} className={styles.row} onClick={() => openVehicle(vehicle.id)}>{vehicle.plate} · {job.title}<span>›</span></button>) : <p>Δεν βρέθηκαν προγραμματισμένες ή ενεργές εργασίες για σήμερα.</p>}</>}
      {result.type === "visits" && <><p>Εργασίες που καταχωρίστηκαν τον μήνα {result.rows?.length ? result.rows[0].job.created_at?.slice(0, 7) : ""}:</p>
        {result.rows?.length ? result.rows.map(({ job, vehicle }) => <button key={job.id} className={styles.row} onClick={() => openVehicle(vehicle.id)}>{vehicle.plate} · {job.title}<span>›</span></button>) : <p>Δεν βρέθηκε καταχώριση για αυτό το φίλτρο.</p>}</>}
      {result.type === "clarify" && <><p>{result.text}</p><div className={styles.choices}>{(result.vehicles?.length ? result.vehicles : repository?.listVehicles() ?? []).slice(0, 12).map(vehicle =>
        <button key={vehicle.id} onClick={() => chooseVehicle(vehicle)}>{vehicle.plate} · {vehicle.make}</button>)}</div></>}
      {result.type === "prepare_note" && result.vehicle && <><p>Σημείωση για {result.vehicle.plate}{result.body ? `: «${result.body}»` : ""}</p>
        <button className={styles.primary} onClick={() => prepareNote(result.vehicle!.id, result.body ?? "")}>{c.note}</button></>}
    </div>}
  </section>;
}
