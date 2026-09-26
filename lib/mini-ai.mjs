import { plateKey } from './data/schema.mjs';

const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el-GR').trim();
const todayKey = (date, timeZone = 'Asia/Nicosia') => new Intl.DateTimeFormat('en-CA', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
}).format(date);

function plateIn(query, vehicles) {
  const tokens = query.match(/[\p{L}]{2,3}[\s-]?\d{3,4}/gu) ?? [];
  const keys = tokens.map(plateKey).filter(Boolean);
  return vehicles.filter(vehicle => keys.includes(vehicle.plate_key));
}

export function resolveMiniAI(query, repository, { selectedVehicleId = null, now = new Date() } = {}) {
  const q = normalize(query);
  if (!q) return { type: 'empty' };
  const vehicles = repository.listVehicles();
  const direct = plateIn(query, vehicles);

  if (/(τι μερα|ποια μερα|what day|σημερα τι μερα)/.test(q)) {
    return { type: 'answer', text: new Intl.DateTimeFormat('el-GR', {
      timeZone: 'Asia/Nicosia', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(now) };
  }
  if (/(νεο|προσθεσε|βαλε|add|new).*(αυτοκινητο|οχημα|car|vehicle)/.test(q)) {
    return { type: 'action', action: 'open_add_vehicle' };
  }
  if (/(τι (εχω|εχουμε)|δουλει|εργασι|jobs).*(σημερα|today)|^(σημερα|today).*(δουλει|εργασι|jobs)/.test(q)) {
    const day = todayKey(now);
    const jobs = vehicles.flatMap(vehicle => repository.listJobsByVehicle(vehicle.id)
      .filter(job => job.status === 'in_progress' || (job.status === 'scheduled' && job.scheduled_for && todayKey(new Date(job.scheduled_for)) === day))
      .map(job => ({ job, vehicle })));
    return { type: 'jobs', rows: jobs, day };
  }
  if (/(δειξε|βρες|show|find)/.test(q) && /(αυτοκινητ|οχημα|cars?|toyota)/.test(q) && /(μηνα|month)/.test(q)) {
    const make = q.match(/\b(toyota|nissan|honda|ford|bmw|mercedes|mazda|kia|hyundai|volkswagen)\b/i)?.[1];
    if (make) {
      const month = todayKey(now).slice(0, 7);
      const rows = vehicles.filter(vehicle => normalize(vehicle.make) === make.toLowerCase())
        .flatMap(vehicle => repository.listJobsByVehicle(vehicle.id)
          .filter(job => job.created_at && todayKey(new Date(job.created_at)).startsWith(month))
          .map(job => ({ vehicle, job })));
      return { type: 'visits', rows, month };
    }
  }
  if (/(λαδι|oil)/.test(q) && /(ποτε|when)/.test(q)) {
    if (direct.length !== 1) return { type: 'clarify', text: direct.length > 1 ? 'Ποιο όχημα εννοείς;' : 'Ποια είναι η πινακίδα;', vehicles: direct };
    const vehicle = direct[0];
    const jobs = repository.listJobsByVehicle(vehicle.id).filter(job =>
      job.status === 'done' && /(λαδι|oil)/.test(normalize([job.title, job.description].join(' '))));
    const notes = repository.listNotesByVehicle(vehicle.id).filter(note => /(λαδι|oil)/.test(normalize(note.body)));
    return { type: 'history', vehicle, jobs, notes };
  }
  if (/(βαλε|προσθεσε|γραψε|add).*(σημειωσ|notes?)/.test(q)) {
    const matches = direct.length ? direct : selectedVehicleId ? vehicles.filter(vehicle => vehicle.id === selectedVehicleId) : [];
    if (matches.length !== 1) return { type: 'clarify', text: 'Σε ποιο όχημα να μπει η σημείωση;', vehicles: matches };
    const body = query.match(/(?:ότι|οτι|πως|that)\s+(.+)$/iu)?.[1]?.trim() ?? '';
    return { type: 'prepare_note', vehicle: matches[0], body };
  }
  if (direct.length === 1) return { type: 'vehicle', vehicle: direct[0] };
  if (direct.length > 1) return { type: 'clarify', text: 'Ποιο όχημα εννοείς;', vehicles: direct };
  if (/^(τι (ειναι|σημαινει)|what (is|does))/.test(q) && /\bdpf\b/i.test(q)) {
    return { type: 'answer', text: 'DPF είναι το φίλτρο μικροσωματιδίων πετρελαιοκινητήρα. Συγκρατεί σωματίδια από τα καυσαέρια.' };
  }
  return { type: 'unhandled' };
}
