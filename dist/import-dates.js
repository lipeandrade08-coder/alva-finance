const dayMs = 86_400_000;
const months = [
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];
const shortMonths = months.map(month => month.slice(0, 3));

function isoDate(year, month, day) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 ||
      month < 1 || month > 12 || day < 1 || day > 31) return '';
  const value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : '';
}

export function validImportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isoDate(...value.split('-').map(Number)) === value;
}

export function excelDate(value, date1904 = false) {
  const serial = Math.floor(Number(value));
  if (!Number.isFinite(serial) || serial < (date1904 ? 0 : 1) || (!date1904 && serial === 60) || serial > 2_958_465) return '';
  const offset = date1904 ? 24_107 : serial < 60 ? 25_568 : 25_569;
  const result = new Date((serial - offset) * dayMs).toISOString().slice(0, 10);
  return validImportDate(result) ? result : '';
}

export function isExcelDateCell(value) {
  const text = String(value ?? '').trim();
  return /^\d{5}(?:[.,]\d+)?$/.test(text) && Number(text.replace(',', '.')) >= 20_000;
}

export function importPeriod(label, defaultYear) {
  const text = String(label ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const years = new Set([...text.matchAll(/(?:^|\D)((?:19|20|21)\d{2})(?=\D|$)/g)].map(m => Number(m[1])));
  const namedMonths = new Set();
  for (const word of text.match(/[a-z]+/g) || []) {
    const month = months.includes(word) ? months.indexOf(word) : shortMonths.indexOf(word);
    if (month >= 0) namedMonths.add(month + 1);
  }
  const numeric = text.trim().match(/^(0?[1-9]|1[0-2])[ ._/-]+((?:19|20|21)\d{2})$|^((?:19|20|21)\d{2})[ ._/-]+(0?[1-9]|1[0-2])$/);
  const year = years.size === 1 ? [...years][0] : years.size ? undefined : defaultYear;
  return { year, month: numeric ? Number(numeric[1] || numeric[4]) : namedMonths.size === 1 ? [...namedMonths][0] : undefined };
}

export function isImportDateText(value) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{1,2}-\d{1,2}(?:$|[T\s])/.test(text) ||
    /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:$|\s+\d)/.test(text) ||
    /^\d{1,2}[.-]\d{1,2}[.-]\d{2,4}(?:$|\s+\d)/.test(text) ||
    /^(?:19|20|21)\d{6}(?:\d{6}(?:[.\[]|$)|$)/.test(text);
}

export function parseImportDate(raw, { period = {}, date1904 = false, serial = false } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s]\d{1,2}:)/);
  if (match) return isoDate(...match.slice(1).map(Number));
  match = text.match(/^(\d{4})(\d{2})(\d{2})(?:$|\d{6}(?:\.\d+)?(?:\[[^\]]+\])?$)/);
  if (match) return isoDate(...match.slice(1).map(Number));
  match = text.match(/^(\d{1,2})([./-])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (match) {
    const day = Number(match[1]), month = Number(match[3]);
    const rawYear = match[4];
    if (!rawYear && period.month && period.month !== month) return '';
    const year = rawYear ? Number(rawYear) + (rawYear.length === 2 ? 2000 : 0) : period.year;
    return isoDate(year, month, day);
  }
  if (period.month && /^\d{1,2}$/.test(text)) return isoDate(period.year, period.month, Number(text));
  if (serial && isExcelDateCell(text)) return excelDate(text.replace(',', '.'), date1904);
  return '';
}
