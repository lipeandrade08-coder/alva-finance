import { importDocumentFile, parseDocumentContent } from './finance.js';
import { ensureBusiness } from './business.js';
import { validImportDate } from './import-dates.js';

const collections = ['transactions', 'debts', 'goals', 'investments'];
const destinations = ['personal', 'business'];
const maxFileBytes = 5 * 1024 * 1024;
const maxAmount = 10_000_000_000;
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
const textBytes = value => new TextEncoder().encode(value);

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function prepareDocument(parsed, bytes, name) {
  const source = await digest(bytes);
  const rows = [];
  for (const collection of collections) {
    for (const [index, item] of parsed[collection].entries()) {
      const { ofx_reference: reference, import_date_raw: sourceDate, import_issue: issue,
        import_sheet: sheet, import_cell: cell, import_destination: destination, ...record } = item;
      const bankKey = reference && parsed.ofx_account
        ? await digest(textBytes(JSON.stringify([parsed.ofx_account, reference])))
        : '';
      rows.push({ collection, record, key: `${source}:${collection}:${index}`, bankKey, sourceDate, issue, sheet, cell, destination });
    }
  }
  return {
    name: String(name).slice(0, 100),
    source,
    spreadsheet: /\.xlsx$/i.test(name),
    rows,
    ignoredSheets: parsed.import_ignored_sheets ?? [],
    unsettled: parsed.import_unsettled ?? 0,
    unverified: parsed.import_unverified ?? 0
  };
}

export async function readImportFile(file) {
  if (file.size > maxFileBytes) throw new Error('Cada arquivo pode ter até 5 MB. Divida o extrato e tente novamente.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxFileBytes) throw new Error('Cada arquivo pode ter até 5 MB.');
  const parsed = await importDocumentFile({ name: file.name, arrayBuffer: async () => bytes });
  return prepareDocument(parsed, bytes, file.name);
}

export async function readPastedImport(text) {
  const bytes = textBytes(text);
  if (bytes.byteLength > maxFileBytes) throw new Error('O texto pode ter até 5 MB.');
  return prepareDocument(parseDocumentContent(text, 'Texto colado'), bytes, 'Texto colado');
}

function existingRows(state, destination) {
  if (destination === 'business') return (state.business?.records ?? []).map(record => ({ collection: 'transactions', record }));
  return collections.flatMap(collection => (state[collection] ?? []).map(record => ({ collection, record })));
}

function matchKey(collection, item) {
  const name = normalize(item.name);
  const details = {
    transactions: [item.type, item.date, item.amount],
    debts: [item.total, item.due, item.installments],
    goals: [item.target, item.deadline],
    investments: [item.amount, normalize(item.kind)]
  };
  return JSON.stringify([collection, name, ...details[collection]]);
}

const dateFields = { transactions: 'date', debts: 'due', goals: 'deadline' };

export function monthLabel(period) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${period}-01T00:00:00Z`));
}

function validAmount(value, allowZero = false) {
  return Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= maxAmount;
}

function isValid({ collection, record }) {
  if (!normalize(record.name)) return false;
  if (collection === 'transactions') return ['income', 'expense'].includes(record.type) && validImportDate(record.date) && validAmount(record.amount);
  if (collection === 'debts') return validAmount(record.total) && validAmount(record.balance, true) && record.balance <= record.total && validImportDate(record.due);
  if (collection === 'goals') return validAmount(record.target) && validAmount(record.saved, true) && record.saved <= record.target && (!record.deadline || validImportDate(record.deadline));
  return validAmount(record.amount);
}

function increment(map, key) {
  const count = (map.get(key) ?? 0) + 1;
  map.set(key, count);
  return count;
}

function replacementCandidates(state, documents, destination) {
  const workbooks = documents.filter(document => document.spreadsheet);
  if (!workbooks.length) return [];
  const scopes = new Set(workbooks.flatMap(document => document.rows.map(row => row.destination)));
  if (scopes.has('personal') && scopes.has('business') && destination !== 'mixed') return [];
  const sources = new Set(workbooks.map(document => document.source));
  const monthsByName = new Map();
  for (const document of workbooks) {
    const months = monthsByName.get(document.name) ?? new Set();
    for (const row of document.rows) {
      if (row.collection === 'transactions' && validImportDate(row.record.date)) months.add(row.record.date.slice(0, 7));
    }
    monthsByName.set(document.name, months);
  }
  return (state.import_batches ?? []).filter(batch => {
    if (batch.undone_at || !destinations.includes(batch.destination)) return false;
    if (batch.files?.length !== 1) return false;
    const rows = importedRows(state, batch);
    if (!rows.length || rows.length !== batch.count) return false;
    if (rows.every(({ record }) => sources.has(record.import_source?.split(':')[0]))) return true;
    const months = monthsByName.get(batch.files[0]);
    const dated = rows.filter(({ collection }) => collection === 'transactions');
    return months && dated.length > 0 && dated.every(({ record }) => months.has(record.date?.slice(0, 7)));
  });
}

export function planImport(state, documents, options = {}) {
  const candidates = replacementCandidates(state, documents, options.destination);
  const replacements = candidates.filter(batch => options.replace?.has(batch.id));
  const excludedBatches = new Set(replacements.map(batch => batch.id));
  return { ...planTransactions(state, documents, { ...options, excludedBatches }), candidates, replacements };
}

function planTransactions(state, documents, options) {
  if (options.destination !== 'mixed') return planDestination(state, documents, options);
  let unassignedCount = 0;
  const scopedDocuments = documents.map(document => ({
    ...document,
    rows: document.rows.filter(row => {
      if (destinations.includes(row.destination)) return true;
      unassignedCount++;
      return false;
    })
  }));
  const plans = destinations.map(destination => planDestination(state, scopedDocuments, { ...options, destination }));
  const counts = Object.fromEntries(Object.keys(plans[0].counts).map(status => [
    status, plans.reduce((sum, plan) => sum + plan.counts[status], 0)
  ]));
  return {
    destination: 'mixed',
    plans,
    counts,
    unassignedCount,
    ...summarizeRows(plans.flatMap(plan => plan.rows))
  };
}

function planDestination(state, documents, { destination = 'personal', account = '', include = new Set(), dates = new Map(), excludedBatches } = {}) {
  const scope = normalize(account);
  const existing = existingRows(state, destination).filter(({ record }) => !excludedBatches.has(record.import_batch_id));
  const opposite = destination === 'personal' ? 'business' : 'personal';
  const foreignKeys = new Set(existingRows(state, opposite)
    .filter(({ record }) => !excludedBatches.has(record.import_batch_id))
    .map(({ record }) => record.import_source).filter(Boolean));
  const knownKeys = new Map(existing.filter(({ record }) => record.import_source)
    .map(({ collection, record }) => [record.import_source, matchKey(collection, record)]));
  const bankKeys = new Set(existing.map(({ record }) => record.import_bank_key).filter(Boolean));
  const previousCounts = new Map();
  for (const { collection, record } of existing) {
    const previousScope = normalize(record.import_account);
    if (!scope || !previousScope || previousScope === scope) increment(previousCounts, matchKey(collection, record));
  }
  const rows = [];
  let otherDestinationCount = 0;
  const counts = { ready: 0, possible: 0, repeated: 0, conflict: 0, invalid: 0, unsupported: 0 };
  for (const document of documents) {
    const occurrences = new Map();
    for (const original of document.rows) {
      if (original.destination && original.destination !== destination) {
        otherDestinationCount++;
        continue;
      }
      const dateField = dateFields[original.collection];
      const override = dates.get(original.key);
      const corrected = dateField && validImportDate(override);
      const row = corrected ? { ...original, record: { ...original.record, [dateField]: override } } : original;
      const date = dateField && row.record[dateField];
      const needsDate = dateField && !validImportDate(date) && (row.collection !== 'goals' || Boolean(row.sourceDate));
      const period = needsDate ? 'undated' : validImportDate(date) ? date.slice(0, 7) : 'other';
      let status;
      if (destination === 'business' && row.collection !== 'transactions') {
        status = 'unsupported';
      } else if (needsDate || row.issue || !isValid(row)) {
        status = 'invalid';
      } else {
        const signature = matchKey(row.collection, row.record);
        const ordinal = increment(occurrences, signature);
        const known = knownKeys.get(row.key);
        const mismatch = known !== undefined && known !== signature;
        const wrongDestination = original.destination && foreignKeys.has(row.key);
        if (document.spreadsheet && (mismatch || wrongDestination)) {
          status = 'conflict';
        } else if (known !== undefined || (row.bankKey && bankKeys.has(row.bankKey))) {
          status = 'repeated';
        } else {
          status = ordinal <= (previousCounts.get(signature) ?? 0) ? 'possible' : 'ready';
        }
        if (status !== 'conflict') knownKeys.set(row.key, signature);
        if (row.bankKey) bankKeys.add(row.bankKey);
      }
      counts[status]++;
      rows.push({ ...row, destination, fileName: document.name, status, period, dateField, needsDate, selected: status === 'ready' || (status === 'possible' && include.has(row.key)) });
    }
    for (const [signature, count] of occurrences) {
      previousCounts.set(signature, Math.max(count, previousCounts.get(signature) ?? 0));
    }
  }
  const summary = summarizeRows(rows);
  const comparison = comparePeriods(rows, existing, summary.periods, destination);
  return { destination, account: String(account).trim().slice(0, 60), counts, otherDestinationCount, comparison, ...summary };
}

function comparePeriods(rows, existing, periods, destination) {
  const comparison = new Map();
  for (const period of periods.keys()) {
    if (/^\d{4}-\d{2}$/.test(period)) {
      comparison.set(period, { file: { income: 0, expense: 0 }, after: { income: 0, expense: 0 }, unmatched: [] });
    }
  }
  const counted = new Set();
  const available = new Map();
  for (const row of rows) {
    const totals = comparison.get(row.period);
    if (!totals || row.collection !== 'transactions' || row.status === 'invalid' || row.status === 'unsupported') continue;
    if (!counted.has(row.key)) {
      totals.file[row.record.type] += row.record.amount;
      if (!row.selected) increment(available, matchKey(row.collection, row.record));
    }
    counted.add(row.key);
    if (row.selected) totals.after[row.record.type] += row.record.amount;
  }
  for (const { collection, record } of existing) {
    if (collection !== 'transactions' || (destination === 'business' && record.status !== 'paid')) continue;
    const date = destination === 'business' ? record.paid_date || record.date : record.date;
    const totals = comparison.get(date?.slice(0, 7));
    if (!totals || !['income', 'expense'].includes(record.type)) continue;
    totals.after[record.type] += record.amount;
    const signature = matchKey(collection, { ...record, date });
    const remaining = available.get(signature) ?? 0;
    if (remaining) available.set(signature, remaining - 1);
    else totals.unmatched.push({ name: record.name, amount: record.amount, type: record.type, date });
  }
  return comparison;
}

function summarizeRows(rows) {
  const periods = new Map();
  for (const row of rows) {
    const totals = periods.get(row.period) ?? { count: 0, selected: 0, income: 0, expense: 0 };
    totals.count++;
    if (row.selected) {
      totals.selected++;
      if (row.collection === 'transactions') totals[row.record.type] += row.record.amount;
    }
    periods.set(row.period, totals);
  }
  return { rows, selected: rows.filter(row => row.selected), periods };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
}

async function batchDigest(rows) {
  const sorted = [...rows].sort((a, b) => a.record.id.localeCompare(b.record.id));
  return digest(textBytes(JSON.stringify(sortKeys(sorted))));
}

function importedRows(state, batch) {
  return existingRows(state, batch.destination).filter(({ record }) => record.import_batch_id === batch.id);
}

export async function applyReviewedImport(state, documents, options) {
  const plan = planImport(state, documents, options);
  if (plan.counts.conflict) throw new Error('Há divergências com um lote anterior. Revise a substituição antes de importar.');
  if (!plan.selected.length) throw new Error('Nenhum registro novo para importar.');
  await Promise.all(plan.replacements.map(batch => validateUndo(state, batch)));
  for (const batch of plan.replacements) removeBatch(state, batch);
  if (plan.destination !== 'mixed') return saveImportBatch(state, plan);
  const batches = [];
  for (const scopedPlan of plan.plans) {
    if (scopedPlan.selected.length) batches.push(await saveImportBatch(state, scopedPlan));
  }
  return { destination: 'mixed', batches };
}

async function saveImportBatch(state, plan) {
  const batch = {
    id: crypto.randomUUID(),
    destination: plan.destination,
    account: plan.account,
    files: [...new Set(plan.selected.map(row => row.fileName))].slice(0, 10),
    created_at: new Date().toISOString(),
    count: plan.selected.length
  };
  for (const row of plan.selected) {
    const metadata = {
      import_batch_id: batch.id,
      import_source: row.key,
      import_account: plan.account
    };
    if (row.bankKey) metadata.import_bank_key = row.bankKey;
    if (row.sheet && row.cell) {
      metadata.import_sheet = row.sheet.slice(0, 100);
      metadata.import_cell = row.cell;
    }
    if (batch.destination === 'business') {
      const { id, name, amount, type, date } = row.record;
      ensureBusiness(state).records.push({
        id, name, amount, type, date, ...metadata,
        due_date: date, paid_date: date, status: 'paid',
        category: 'Outros', counterparty: '', counts_as_sale: false
      });
    } else {
      state[row.collection].push({ ...row.record, ...metadata });
    }
  }
  batch.digest = await batchDigest(importedRows(state, batch));
  state.import_batches = [batch, ...(state.import_batches ?? [])].slice(0, 30);
  return batch;
}

export async function undoReviewedImport(state, batchId) {
  const batch = (state.import_batches ?? []).find(item => item.id === batchId);
  if (!batch || batch.undone_at) throw new Error('Esta importação já foi desfeita ou não está mais no histórico.');
  await validateUndo(state, batch);
  removeBatch(state, batch);
  return batch;
}

async function validateUndo(state, batch) {
  const rows = importedRows(state, batch);
  if (rows.length !== batch.count || await batchDigest(rows) !== batch.digest) {
    throw new Error('Há registros alterados ou removidos neste lote. Revise os lançamentos individualmente.');
  }
  const ids = new Set(rows.map(({ record }) => record.id));
  const allRecords = [...(state.transactions ?? []), ...(state.business?.records ?? [])];
  if (allRecords.some(record => ids.has(record.linked) && !ids.has(record.id))) {
    throw new Error('Este lote tem movimentações vinculadas. Revise os lançamentos individualmente.');
  }
}

function removeBatch(state, batch) {
  if (batch.destination === 'business') {
    state.business.records = state.business.records.filter(record => record.import_batch_id !== batch.id);
  } else {
    for (const collection of collections) {
      state[collection] = state[collection].filter(record => record.import_batch_id !== batch.id);
    }
  }
  batch.undone_at = new Date().toISOString();
}
