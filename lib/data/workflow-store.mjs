const KEY = "motofy-v220-workflows";

function readAll() {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(data)); } catch { /* non-fatal */ }
}

function cleanText(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export function getJobWorkflow(jobId) {
  const all = readAll();
  const value = all[jobId] ?? {};
  return {
    parts: Array.isArray(value.parts) ? value.parts : [],
    costs: Array.isArray(value.costs) ? value.costs : [],
    ready: Boolean(value.ready),
    customerNote: cleanText(value.customerNote, 600),
  };
}

export function updateJobWorkflow(jobId, updater) {
  const all = readAll();
  const current = getJobWorkflow(jobId);
  const next = typeof updater === "function" ? updater(current) : { ...current, ...(updater ?? {}) };
  all[jobId] = next;
  writeAll(all);
  return next;
}

export function addPart(jobId, label) {
  const text = cleanText(label);
  if (!text) return getJobWorkflow(jobId);
  return updateJobWorkflow(jobId, (current) => ({
    ...current,
    parts: current.parts.concat({ id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: text, status: "needed" }),
  }));
}

export function cyclePart(jobId, partId) {
  const order = ["needed", "ordered", "waiting", "arrived"];
  return updateJobWorkflow(jobId, (current) => ({
    ...current,
    parts: current.parts.map((part) => {
      if (part.id !== partId) return part;
      const index = Math.max(0, order.indexOf(part.status));
      return { ...part, status: order[(index + 1) % order.length] };
    }),
  }));
}

export function removePart(jobId, partId) {
  return updateJobWorkflow(jobId, (current) => ({ ...current, parts: current.parts.filter((part) => part.id !== partId) }));
}

export function addCost(jobId, label, amount) {
  const text = cleanText(label);
  const number = Number(amount);
  if (!text || !Number.isFinite(number) || number < 0) return getJobWorkflow(jobId);
  return updateJobWorkflow(jobId, (current) => ({
    ...current,
    costs: current.costs.concat({ id: `cost_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, label: text, amount: Math.round(number * 100) / 100 }),
  }));
}

export function removeCost(jobId, costId) {
  return updateJobWorkflow(jobId, (current) => ({ ...current, costs: current.costs.filter((cost) => cost.id !== costId) }));
}

export function setReady(jobId, ready) {
  return updateJobWorkflow(jobId, (current) => ({ ...current, ready: Boolean(ready) }));
}

export function setCustomerNote(jobId, customerNote) {
  return updateJobWorkflow(jobId, (current) => ({ ...current, customerNote: cleanText(customerNote, 600) }));
}

export function totalCost(workflow) {
  return (workflow?.costs ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}
