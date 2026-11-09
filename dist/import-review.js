import { importDocumentFile, parseDocumentContent } from './finance.js';
import { ensureBusiness } from './business.js';
import { validImportDate } from './import-dates.js';

const collections = ['transactions', 'debts', 'goals', 'investments'];
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
        import_sheet: sheet, import_destination: destination, ...record } = item;
      const bankKey = reference && parsed.ofx_account
        ? await digest(textBytes(JSON.stringify([parsed.ofx_account, reference])))
        : '';
      rows.push({ collection, record, key: `${source}:${collection}:${index}`, bankKey, sourceDate, issue, sheet, destination });
    }
  }
  return {
    name: String(name).slice(0, 100),
    rows,
    ignoredSheets: parsed.import_ignored_sheets ?? [],
    unsettled: parsed.import_unsettled ?? 0
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

export function planImport(state, documents, { destination = 'personal', account = '', include = new Set(), dates = new Map() } = {}) {
  const scope = normalize(account);
  const existing = existingRows(state, destination);
  const knownKeys = new Set(existing.map(({ record }) => record.import_source).filter(Boolean));
  const bankKeys = new Set(existing.map(({ record }) => record.import_bank_key).filter(Boolean));
  const previousCounts = new Map();
  for (const { collection, record } of existing) {
    const previousScope = normalize(record.import_account);
    if (!scope || !previousScope || previousScope === scope) increment(previousCounts, matchKey(collection, record));
  }
  const rows = [];
  let otherDestinationCount = 0;
  const counts = { ready: 0, possible: 0, repeated: 0, invalid: 0, unsupported: 0 };
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
        if (knownKeys.has(row.key) || (row.bankKey && bankKeys.has(row.bankKey))) {
          status = 'repeated';
        } else {
          status = ordinal <= (previousCounts.get(signature) ?? 0) ? 'possible' : 'ready';
        }
        knownKeys.add(row.key);
        if (row.bankKey) bankKeys.add(row.bankKey);
      }
      counts[status]++;
      rows.push({ ...row, fileName: document.name, status, period, dateField, needsDate, selected: status === 'ready' || (status === 'possible' && include.has(row.key)) });
    }
    for (const [signature, count] of occurrences) {
      previousCounts.set(signature, Math.max(count, previousCounts.get(signature) ?? 0));
    }
  }
  const selected = rows.filter(row => row.selected);
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
  return { destination, account: String(account).trim().slice(0, 60), rows, counts, selected, periods, otherDestinationCount };
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
  if (!plan.selected.length) throw new Error('Nenhum registro novo para importar.');
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
  const rows = importedRows(state, batch);
  if (rows.length !== batch.count || await batchDigest(rows) !== batch.digest) {
    throw new Error('Há registros alterados ou removidos neste lote. Revise os lançamentos individualmente.');
  }
  const ids = new Set(rows.map(({ record }) => record.id));
  const allRecords = [...(state.transactions ?? []), ...(state.business?.records ?? [])];
  if (allRecords.some(record => ids.has(record.linked) && !ids.has(record.id))) {
    throw new Error('Este lote tem movimentações vinculadas. Revise os lançamentos individualmente.');
  }
  if (batch.destination === 'business') {
    state.business.records = state.business.records.filter(record => record.import_batch_id !== batch.id);
  } else {
    for (const collection of collections) {
      state[collection] = state[collection].filter(record => record.import_batch_id !== batch.id);
    }
  }
  batch.undone_at = new Date().toISOString();
  return batch;
}
