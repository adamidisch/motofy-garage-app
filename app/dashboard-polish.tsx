"use client";

import { useEffect } from "react";

const DATA_KEY = "motofy-data";
const GARAGE_KEY = "motofy-garage-id";

type Row = { garage_id?: string };
type Dataset = { customers?: Row[]; vehicles?: Row[]; jobs?: Row[] };

function count(rows: Row[] | undefined, garageId: string | null) {
  if (!Array.isArray(rows)) return 0;
  return garageId ? rows.filter((row) => row.garage_id === garageId).length : rows.length;
}

function totals() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return [0, 0, 0];
    const data = JSON.parse(raw) as Dataset;
    const garageId = localStorage.getItem(GARAGE_KEY);
    return [count(data.jobs, garageId), count(data.vehicles, garageId), count(data.customers, garageId)];
  } catch {
    return [0, 0, 0];
  }
}

function syncDashboard() {
  const subtitle = document.querySelector<HTMLElement>(".intro-row .intro-copy");
  if (subtitle) {
    const current = subtitle.textContent?.trim() ?? "";
    subtitle.textContent = /[Α-Ωα-ωΆ-ώ]/.test(current) ? "Η σημερινή εικόνα του συνεργείου." : "Today’s garage overview.";
  }

  const cards = document.querySelectorAll<HTMLButtonElement>(".home-actions > button");
  const values = totals();
  cards.forEach((card, index) => {
    if (index > 2) return;
    let badge = card.querySelector<HTMLSpanElement>(".home-action-total");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "home-action-total";
      const chevron = card.querySelector("svg:last-child");
      if (chevron) card.insertBefore(badge, chevron);
      else card.appendChild(badge);
    }
    badge.textContent = String(values[index]);
  });
}

export default function DashboardPolish() {
  useEffect(() => {
    syncDashboard();

    const afterInteraction = () => requestAnimationFrame(syncDashboard);
    const onStorage = (event: StorageEvent) => {
      if (event.key === DATA_KEY || event.key === GARAGE_KEY) syncDashboard();
    };

    document.addEventListener("click", afterInteraction, true);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("click", afterInteraction, true);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
