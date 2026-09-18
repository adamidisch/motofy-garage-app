/**
 * Demo dataset.
 *
 * Ids are fixed rather than generated, so resetting produces the same records
 * and a bookmarked vehicle keeps working. Every relation is a real foreign key:
 * no customer name, plate or job title is duplicated as a string in a second
 * array, which is the defect this dataset replaces.
 *
 * Dates are derived from the current time, never hardcoded, so the app does not
 * claim it is the 2nd of September forever.
 *
 * The four original cars keep their Greek-lettered plates exactly as they were
 * written. They normalise to Latin on the way in, which is both correct for
 * Cyprus and a live demonstration that a hand-typed plate and a camera reading
 * land on the same record.
 */

import { makeCustomer, makeGarage, makeJob, makeNote, makeVehicle } from "./schema.mjs";

export const DEMO_GARAGE_ID = "gar_motofy_demo";

const DAY = 86_400_000;

function at(now, days, hour = 9, minute = 0) {
  const date = new Date(now.getTime() + days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * Build the demo dataset.
 *
 * @param {object} [options]
 * @param {Date | string} [options.now] anchor for all generated timestamps
 * @param {string} [options.garageId]
 * @returns {object} a dataset matching `emptyDataset()`'s shape
 */
export function createSeed({ now = new Date(), garageId = DEMO_GARAGE_ID } = {}) {
  const anchor = now instanceof Date ? now : new Date(now);
  const created = at(anchor, -420);

  const garage = makeGarage({ id: garageId, name: "Motofy Garage", created_at: created }, created);

  const customers = [
    { id: "cus_marios", name: "Μάριος Παναγή", phone: "+357 99 412 830", email: "m.panagi@example.com.cy", d: -400 },
    { id: "cus_andreas", name: "Ανδρέας Χρίστου", phone: "+357 99 305 118", email: null, d: -365 },
    { id: "cus_eleni", name: "Ελένη Αντωνίου", phone: "+357 96 774 209", email: "eleni.a@example.com.cy", d: -298 },
    { id: "cus_michalis", name: "Μιχάλης Σάββα", phone: "+357 99 880 641", email: null, d: -210 },
    { id: "cus_georgia", name: "Γεωργία Λοΐζου", phone: "+357 97 233 507", email: null, d: -96 },
    { id: "cus_nicos", name: "Νίκος Γεωργίου", phone: "+357 99 624 115", email: null, d: -82 },
    { id: "cus_christina", name: "Χριστίνα Κυριάκου", phone: "+357 96 318 744", email: "christina.k@example.com.cy", d: -70 },
    { id: "cus_petros", name: "Πέτρος Δημητρίου", phone: "+357 97 542 860", email: null, d: -54 },
    { id: "cus_sofia", name: "Σοφία Ιωάννου", phone: "+357 95 701 326", email: null, d: -41 },
    { id: "cus_costas", name: "Κώστας Νεοφύτου", phone: "+357 99 187 492", email: "costas.n@example.com.cy", d: -25 },
  ].map((c) =>
    makeCustomer(
      { id: c.id, garage_id: garageId, name: c.name, phone: c.phone, email: c.email, created_at: at(anchor, c.d) },
      at(anchor, c.d),
    ),
  );

  const vehicles = [
    // Μάριος owns two vehicles. Without this the customer tab would look
    // correct while hiding a broken relation.
    { id: "veh_yaris", customer_id: "cus_marios", plate: "ΚΒΥ 328", make: "Toyota", model: "Yaris", year: 2018, km: 86420, colour: "Ασημί", d: -398 },
    { id: "veh_transit", customer_id: "cus_marios", plate: "ΖΚΑ 517", make: "Ford", model: "Transit", year: 2016, km: 189300, colour: "Λευκό", d: -140 },
    { id: "veh_bmw", customer_id: "cus_andreas", plate: "ΚΜΡ 714", make: "BMW", model: "320i", year: 2020, km: 42180, colour: "Μαύρο", d: -360 },
    { id: "veh_merc", customer_id: "cus_eleni", plate: "ΜΡΑ 402", make: "Mercedes-Benz", model: "A200", year: 2019, km: 61304, colour: "Γκρι", d: -290 },
    { id: "veh_fiesta", customer_id: "cus_michalis", plate: "ΚΜΝ 246", make: "Ford", model: "Fiesta", year: 2017, km: 104909, colour: "Κόκκινο", d: -205 },
    { id: "veh_note", customer_id: "cus_georgia", plate: "ΝΑΚ 883", make: "Nissan", model: "Note", year: 2015, km: 132540, colour: "Μπλε", d: -90 },
    { id: "veh_golf", customer_id: "cus_nicos", plate: "KXZ 611", make: "Volkswagen", model: "Golf", year: 2018, km: 94720, colour: "Γκρι", d: -80 },
    { id: "veh_chr", customer_id: "cus_christina", plate: "MNT 308", make: "Toyota", model: "C-HR", year: 2021, km: 38640, colour: "Λευκό", d: -68 },
    { id: "veh_mazda", customer_id: "cus_petros", plate: "LPA 927", make: "Mazda", model: "CX-30", year: 2020, km: 52780, colour: "Κόκκινο", d: -52 },
    { id: "veh_kia", customer_id: "cus_sofia", plate: "KTY 144", make: "Kia", model: "Sportage", year: 2019, km: 73110, colour: "Μαύρο", d: -39 },
    { id: "veh_audi", customer_id: "cus_costas", plate: "PKE 520", make: "Audi", model: "A3", year: 2017, km: 118250, colour: "Ασημί", d: -23 },
    // Arrived by scan, never linked to anyone. The UI has to cope with this.
    { id: "veh_orphan", customer_id: null, plate: "ΤΡΗ 059", make: "Opel", model: "Corsa", year: null, km: null, colour: null, d: -3, scan: true },
  ].map((v) =>
    makeVehicle(
      {
        id: v.id,
        garage_id: garageId,
        customer_id: v.customer_id,
        plate: v.plate,
        make: v.make,
        model: v.model,
        year: v.year,
        mileage_km: v.km,
        colour: v.colour,
        scan_make: v.scan ? v.make : null,
        scan_model: v.scan ? v.model : null,
        scan_confidence: v.scan ? "medium" : null,
        scan_provider: v.scan ? "gemini" : null,
        scanned_at: v.scan ? at(anchor, v.d, 16, 42) : null,
        confirmed_at: v.scan ? null : at(anchor, v.d),
        created_at: at(anchor, v.d),
      },
      at(anchor, v.d),
    ),
  );

  const jobs = [
    { id: "job_fiesta_oil", vehicle_id: "veh_fiesta", title: "Αλλαγή λαδιών & φίλτρου", status: "scheduled", km: 104909, sched: [0, 14, 30], d: -1 },
    { id: "job_bmw_diag", vehicle_id: "veh_bmw", title: "Διάγνωση check engine", desc: "Λυχνία κινητήρα αναμμένη σε κρύα εκκίνηση. Ελέγχθηκε αισθητήρας λάμδα.", status: "in_progress", km: 42180, sched: [0, 8, 30], d: -2 },
    { id: "job_merc_quote", vehicle_id: "veh_merc", title: "Προσφορά για δισκόπλακες", status: "scheduled", km: 61304, sched: [2, 11, 0], d: -4 },
    { id: "job_yaris_service", vehicle_id: "veh_yaris", title: "Ετήσιο service", desc: "Λάδια, φίλτρα, έλεγχος φρένων.", status: "done", km: 86420, done: [-6, 11, 20], d: -8 },
    { id: "job_yaris_brakes", vehicle_id: "veh_yaris", title: "Αντικατάσταση τακακιών εμπρός", status: "done", km: 81050, done: [-121, 15, 10], d: -124 },
    { id: "job_transit_clutch", vehicle_id: "veh_transit", title: "Αλλαγή συμπλέκτη", desc: "Πατινάρισμα σε ανηφόρα με φορτίο.", status: "done", km: 186740, done: [-58, 17, 45], d: -64 },
    { id: "job_bmw_service", vehicle_id: "veh_bmw", title: "Service 40.000 km", status: "done", km: 40110, done: [-95, 12, 0], d: -98 },
    { id: "job_note_aircon", vehicle_id: "veh_note", title: "Επισκευή A/C", status: "cancelled", km: 132540, d: -30 },
    { id: "job_golf_brakes", vehicle_id: "veh_golf", title: "Έλεγχος φρένων", status: "in_progress", km: 94720, sched: [0, 10, 0], d: -1 },
    { id: "job_chr_service", vehicle_id: "veh_chr", title: "Υβριδικό service", status: "scheduled", km: 38640, sched: [1, 9, 30], d: -2 },
    { id: "job_mazda_battery", vehicle_id: "veh_mazda", title: "Έλεγχος μπαταρίας", status: "done", km: 51980, done: [-18, 16, 20], d: -20 },
    { id: "job_kia_tyres", vehicle_id: "veh_kia", title: "Αλλαγή ελαστικών", status: "scheduled", km: 73110, sched: [3, 13, 0], d: -1 },
    { id: "job_audi_service", vehicle_id: "veh_audi", title: "Service και φίλτρα", status: "done", km: 116900, done: [-32, 12, 10], d: -35 },
  ].map((j) =>
    makeJob(
      {
        id: j.id,
        garage_id: garageId,
        vehicle_id: j.vehicle_id,
        title: j.title,
        description: j.desc ?? null,
        status: j.status,
        mileage_km: j.km,
        scheduled_for: j.sched ? at(anchor, j.sched[0], j.sched[1], j.sched[2]) : null,
        completed_at: j.done ? at(anchor, j.done[0], j.done[1], j.done[2]) : null,
        created_at: at(anchor, j.d),
      },
      at(anchor, j.d),
    ),
  );

  const notes = [
    { id: "not_bmw_1", vehicle_id: "veh_bmw", body: "Ο πελάτης αναφέρει θόρυβο στο τιμόνι σε χαμηλή ταχύτητα.", author: "Ανδρέας", d: -2 },
    { id: "not_bmw_2", vehicle_id: "veh_bmw", body: "Κωδικός P0133 στο διαγνωστικό. Παραγγέλθηκε αισθητήρας.", author: "Ανδρέας", d: -1, photos: 1 },
    { id: "not_yaris_1", vehicle_id: "veh_yaris", body: "Ελαστικά εμπρός στο όριο. Να προταθεί αλλαγή στο επόμενο service.", author: "Μάριος Κ.", d: -8 },
    { id: "not_transit_1", vehicle_id: "veh_transit", body: "Χρησιμοποιείται για διανομές, υψηλά χιλιόμετρα ανά μήνα.", author: "Ανδρέας", d: -64 },
    { id: "not_fiesta_1", vehicle_id: "veh_fiesta", body: "Ο πελάτης θα περάσει το απόγευμα. Προτιμά τηλέφωνο, όχι μήνυμα.", author: "Ανδρέας", d: -1 },
    { id: "not_orphan_1", vehicle_id: "veh_orphan", body: "Ήρθε από σάρωση, δεν έχει συνδεθεί με πελάτη ακόμα.", author: "Ανδρέας", d: -3 },
    { id: "not_golf_1", vehicle_id: "veh_golf", body: "Ακούγεται τρίξιμο στο φρενάρισμα σε χαμηλή ταχύτητα.", author: "Ανδρέας", d: -2 },
    { id: "not_chr_1", vehicle_id: "veh_chr", body: "Να ελεγχθεί η κατάσταση της υβριδικής μπαταρίας.", author: "Ανδρέας", d: -3 },
    { id: "not_mazda_1", vehicle_id: "veh_mazda", body: "Η μπαταρία αντικαταστάθηκε και έγινε έλεγχος φόρτισης.", author: "Ανδρέας", d: -18 },
    { id: "not_kia_1", vehicle_id: "veh_kia", body: "Αναμονή επιβεβαίωσης για τα ελαστικά.", author: "Ανδρέας", d: -1 },
  ].map((n) =>
    makeNote(
      {
        id: n.id,
        garage_id: garageId,
        vehicle_id: n.vehicle_id,
        body: n.body,
        author: n.author,
        photo_paths: n.photos
          ? [`garages/${garageId}/vehicles/${n.vehicle_id}/note-${n.id}.webp`]
          : [],
        created_at: at(anchor, n.d, 10, 15),
      },
      at(anchor, n.d, 10, 15),
    ),
  );

  return { version: 1, garages: [garage], customers, vehicles, jobs, notes };
}
