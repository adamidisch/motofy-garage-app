"use client";

import { useState } from "react";
import { CarFront, Check, ClipboardList, ScanLine } from "lucide-react";
import { clearGreeting, requestNormalizedName, storeGreeting } from "./name-client";
import { el, en } from "./i18n";
import { AppBody } from "./app-body";

const SESSION_KEY = "motofy-session";
const DEMO_SESSION = "__demo__";
const APP_VERSION = "2.1.11";

export default function Home() {
  const [session, setSession] = useState<string | null>(() => {
    try { return globalThis.localStorage?.getItem(SESSION_KEY) ?? null; } catch { return null; }
  });
  if (!session) return (
    <LoginScreen
      onLogin={async (name) => {
        const savedLang = localStorage.getItem("motofy-language");
        const nextLang = savedLang === "en" ? "en" : "el";
        const greeting = await requestNormalizedName(name, nextLang);
        storeGreeting(name, greeting);
        setSession(name);
      }}
      onDemo={() => setSession(DEMO_SESSION)}
    />
  );
  return <AppBody session={session} onLogout={() => { clearGreeting(); setSession(null); }} />;
}

function LoginScreen({ onLogin, onDemo }: { onLogin: (name: string) => void; onDemo: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const lang = (() => { try { return localStorage.getItem("motofy-language") ?? "el"; } catch { return "el"; } })();
  const t = lang === "en" ? en : el;
  function submit() { const n = name.trim(); if (n) onLogin(n); }
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-lockup">
          <img src="/icon.svg" alt="" width={44} height={44} className="login-icon-anim" />
          <div className="login-lockup-text">
            <span className="login-lockup-word">motofy</span>
            <span className="login-lockup-ver">ver. {APP_VERSION}</span>
          </div>
        </div>
        <p className="login-tagline">{t.loginSubtitle}</p>
        <div className="login-fields">
          <label className="login-field-label">
            <span>{t.yourName}</span>
            <input className="login-field-input" type="text" autoComplete="name" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} autoFocus />
          </label>
          <label className="login-field-label">
            <span>{t.loginPhone}<em className="login-field-hint">{t.optional}</em></span>
            <input className="login-field-input" type="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          </label>
          <button className="login-btn" onClick={submit} disabled={!name.trim()}>{t.loginBtn}</button>
          <button className="login-demo-btn login-demo-outline" onClick={onDemo}>{t.loginDemo}</button>
        </div>
        <div className="login-flow" aria-hidden="true">
          <span><CarFront size={14} /><small>{lang === "en" ? "Vehicles" : "Οχήματα"}</small></span>
          <span><ScanLine size={14} /><small>{lang === "en" ? "Plate scan" : "Σκανάρισμα πινακίδας"}</small></span>
          <span className="active"><Check size={14} /><small>{lang === "en" ? "Check" : "Έλεγχος"}</small></span>
          <span><ClipboardList size={14} /><small>{lang === "en" ? "Record" : "Καρτέλα"}</small></span>
        </div>
      </div>
    </div>
  );
}
