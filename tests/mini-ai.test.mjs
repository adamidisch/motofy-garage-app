import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMiniAI } from '../lib/mini-ai.mjs';

const vehicles = [
  { id: 'v1', plate: 'ABC 123', plate_key: 'ABC123', make: 'Toyota' },
  { id: 'v2', plate: 'XYZ 456', plate_key: 'XYZ456', make: 'Toyota' }
];
const repository = {
  listVehicles: () => vehicles,
  listJobsByVehicle: id => id === 'v1' ? [
    { id: 'j1', title: 'Αλλαγή λαδιών', status: 'done', completed_at: '2026-09-20T10:00:00Z' },
    { id: 'j2', title: 'Φρένα', status: 'scheduled', scheduled_for: '2026-09-26T09:00:00Z' }
  ] : [],
  listNotesByVehicle: () => []
};

test('simple commands and date stay local', () => {
  assert.deepEqual(resolveMiniAI('Βάλε νέο αυτοκίνητο', repository), { type: 'action', action: 'open_add_vehicle' });
  assert.equal(resolveMiniAI('Τι μέρα είναι σήμερα;', repository, { now: new Date('2026-09-26T10:00:00Z') }).type, 'answer');
});
test('plate history cites only completed matching jobs', () => {
  const result = resolveMiniAI('Πότε άλλαξε λάδια το ABC123;', repository);
  assert.equal(result.type, 'history');
  assert.deepEqual(result.jobs.map(x => x.id), ['j1']);
});
test('ambiguous note never writes and a selected vehicle prepares only', () => {
  assert.equal(resolveMiniAI('Βάλε στις σημειώσεις ότι περιμένουμε τακάκια', repository).type, 'clarify');
  const result = resolveMiniAI('Βάλε στις σημειώσεις ότι περιμένουμε τακάκια', repository, { selectedVehicleId: 'v1' });
  assert.equal(result.type, 'prepare_note');
  assert.equal(result.vehicle.id, 'v1');
  assert.equal(result.body, 'περιμένουμε τακάκια');
});
test('today uses the garage date and excludes unrelated scheduled jobs', () => {
  const result = resolveMiniAI('Τι δουλειές έχουμε σήμερα;', repository, { now: new Date('2026-09-26T10:00:00Z') });
  assert.deepEqual(result.rows.map(x => x.job.id), ['j2']);
});
test('monthly make filter uses recorded job dates, not inferred arrivals', () => {
  const repo = { ...repository, listJobsByVehicle: id => id === 'v1' ? [{ id: 'j3', title: 'Service', created_at: '2026-09-22T12:00:00Z' }] : [] };
  const result = resolveMiniAI('Δείξε μου τα Toyota που ήρθαν αυτόν τον μήνα', repo, { now: new Date('2026-09-26T10:00:00Z') });
  assert.equal(result.type, 'visits');
  assert.deepEqual(result.rows.map(row => row.vehicle.id), ['v1']);
});
