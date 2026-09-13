"use client";

import { useEffect, useState } from "react";
import { Camera, Check, ChevronRight, ScanLine, Sparkles, X } from "lucide-react";
import { el } from "./i18n";

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

export function Scanner({ stage, t, error, scanError, result, progress, selectedImage, videoRef, fileInputRef, close, recognise, choosePhoto, openRecord, restart }: { stage: "camera" | "processing" | "match"; t: typeof el; error: boolean; scanError: string; result: ScanResult | null; progress: ScanProgress; selectedImage: string | null; videoRef: React.RefObject<HTMLVideoElement | null>; fileInputRef: React.RefObject<HTMLInputElement | null>; close: () => void; recognise: () => void; choosePhoto: (file: File | undefined) => void; openRecord: () => void; restart: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="scanner-modal"><header><button aria-label={t.cancel} onClick={close}><X size={20}/></button><div><p className="eyebrow">{stage === "match" ? "SCAN COMPLETE" : "LIVE SCAN"}</p><h2>{stage === "match" ? t.found : t.camera}</h2></div><span/></header>
    {stage === "camera" && <><div className={"camera-stage " + (error ? "camera-error" : "")}>{selectedImage ? <img src={selectedImage} alt="Επιλεγμένη φωτογραφία αυτοκινήτου"/> : !error && <video ref={videoRef} playsInline muted/>}<div className="plate-guide"><i/><i/><i/><i/></div>{error && !selectedImage && <div className="camera-fallback"><Camera size={31}/><strong>{t.cameraText}</strong></div>}</div><p className="scanner-help">{scanError || t.cameraText}</p><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])}/><footer><button className="secondary-button" onClick={() => fileInputRef.current?.click()}>{selectedImage ? t.retake : "Φωτογραφία"}</button><button className="primary-button" onClick={recognise}>{t.recognize}<ScanLine size={18}/></button></footer></>}
    {stage === "processing" && <ProcessingState t={t} progress={progress}/>} 
    {stage === "match" && <div className="match-state"><span className="match-check"><Check size={28}/></span><p className="eyebrow">AI RESULT · {result?.confidence === "high" ? "ΥΨΗΛΗ ΒΕΒΑΙΟΤΗΤΑ" : result?.confidence === "medium" ? "ΜΕΤΡΙΑ ΒΕΒΑΙΟΤΗΤΑ" : "ΧΑΜΗΛΗ ΒΕΒΑΙΟΤΗΤΑ"}</p><h3>{result?.plate || "Δεν διαβάστηκε πινακίδα"}</h3><strong>{[result?.make, result?.model].filter(Boolean).join(" ") || "Δεν αναγνωρίστηκε με ασφάλεια"}<small>Από φωτογραφία · επιβεβαίωσε πριν τη χρήση</small></strong><p>{result?.plate || result?.make ? "Νέα καρτέλα · Επιβεβαίωση στοιχείων" : "Δοκίμασε πιο καθαρή λήψη της πινακίδας και του αυτοκινήτου."}</p><footer><button className="secondary-button" onClick={restart}>{t.retake}</button>{(result?.plate || result?.make) && <button className="primary-button" onClick={openRecord}>{t.openRecord}<ChevronRight size={18}/></button>}</footer></div>}
  </section></div>;
}

export function ProcessingState({ t, progress }: { t: typeof el; progress: ScanProgress }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 100);
    return () => window.clearInterval(timer);
  }, []);

  const phaseLabel =
    progress.phase === "prepare" ? t.scanPrepare :
    progress.phase === "plate" ? t.scanPlate :
    progress.phase === "vehicle" ? t.scanVehicle :
    t.scanVerify;

  return <div className="processing-state">
    <span className="scan-processing"><ScanLine size={34}/></span>
    <h3>{t.processing}</h3>
    <p className="processing-phase">{phaseLabel}</p>
    <div className="scan-progress-shell" aria-label={phaseLabel}>
      <div className="scan-progress-top"><strong>{progress.percent}%</strong><span>{(elapsed / 1000).toFixed(1)}s</span></div>
      <div className="scan-progress-track"><i style={{ width: progress.percent + "%" }}/></div>
    </div>
    <div className="processing-lines">
      <div className={"processing-line " + (progress.plateStatus === "done" ? "done" : progress.plateStatus === "fallback" ? "fallback" : "working")}>
        <span>{progress.plateStatus === "done" ? <Check size={13}/> : <ScanLine size={13}/>}</span>
        <div><strong>{t.scanPlate}</strong><small>{progress.plateStatus === "done" ? `${progress.plate || ""} · Plate engine ✓${progress.plateMs ? ` · ${(progress.plateMs / 1000).toFixed(1)}s` : ""}` : progress.plateStatus === "fallback" ? t.scanPlateFallback : "Plate Recognizer · processing…"}</small></div>
      </div>
      <div className={"processing-line " + (progress.vehicleStatus === "done" ? "done" : progress.vehicleStatus === "fallback" ? "fallback" : "working")}>
        <span>{progress.vehicleStatus === "done" ? <Check size={13}/> : <Sparkles size={13}/>}</span>
        <div><strong>{t.scanVehicle}</strong><small>{progress.vehicleStatus === "done" ? `Vehicle AI ✓${progress.vehicleMs ? ` · ${(progress.vehicleMs / 1000).toFixed(1)}s` : ""}` : elapsed > 8000 ? t.scanWaiting : "Gemini · processing…"}</small></div>
      </div>
    </div>
  </div>;
}
