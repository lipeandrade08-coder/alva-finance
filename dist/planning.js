import { noticeDate } from './notices.js';

const isMoney = value => Number.isSafeInteger(value) && Math.abs(value) <= 10_000_000_000;

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(date, days) {
  const day = new Date(date + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export const planningEnd = today => addDays(today, 29);

export function personalCashToday(state, today = noticeDate()) {
  return state.transactions.reduce((balance, item) => {
    if (item.date > today) return balance;
    return balance + (item.type === 'income' ? item.amount : -item.amount);
  }, state.profile.opening_balance);
}

export function withdrawalPlan(business, { reserve, amount = 0, date, today = noticeDate() }) {
  const end = planningEnd(today);
  if (!isMoney(reserve) || reserve < 0 || !isMoney(amount) || amount < 0) {
    throw new Error('Informe valores válidos para a reserva e a retirada.');
  }
  if (!isDate(date) || date < today || date > end) {
    throw new Error('Escolha uma data dentro dos próximos 30 dias.');
  }
  const { profile, records, taxes } = business;
  let cash = profile.opening_balance;
  let hasCashRecords = false;
  let incomplete = !isMoney(cash);
  if (incomplete) cash = 0;

  const scheduled = new Map();
  let unscheduledReceivables = 0;
  let pendingPayments = 0;
  let pendingTaxes = 0;
  let pendingReceivables = 0;
  function schedule(day, item, type) {
    if (!scheduled.has(day)) scheduled.set(day, { payments: [], receipts: [] });
    scheduled.get(day)[type].push(item);
  }

  for (const item of records) {
    if (item.status === 'paid') {
      const paidOn = item.paid_date || item.date;
      if (!isDate(paidOn) || !isMoney(item.amount) || item.amount <= 0) incomplete = true;
      else if (paidOn <= today) {
        hasCashRecords = true;
        cash += item.type === 'income' ? item.amount : -item.amount;
      }
      continue;
    }
    if (item.status !== 'pending') continue;
    if (isDate(item.due_date) && item.due_date > end) continue;
    if (!isMoney(item.amount) || item.amount <= 0) {
      if (item.type === 'expense') incomplete = true;
      continue;
    }
    if (item.type === 'income') {
      if (!isDate(item.due_date) || item.due_date < today) unscheduledReceivables += item.amount;
      else {
        pendingReceivables += item.amount;
        schedule(item.due_date, item, 'receipts');
      }
    } else {
      if (!isDate(item.due_date)) incomplete = true;
      pendingPayments += item.amount;
      schedule(isDate(item.due_date) && item.due_date > today ? item.due_date : today, item, 'payments');
    }
  }
  for (const tax of taxes) {
    if (tax.paid || (isDate(tax.due_date) && tax.due_date > end)) continue;
    if (!isMoney(tax.amount) || tax.amount <= 0 || !isDate(tax.due_date)) incomplete = true;
    if (!isMoney(tax.amount) || tax.amount <= 0) continue;
    pendingTaxes += tax.amount;
    schedule(isDate(tax.due_date) && tax.due_date > today ? tax.due_date : today, tax, 'payments');
  }

  const maxToday = incomplete || (!profile.name && !hasCashRecords && cash === 0)
    ? null
    : Math.max(0, cash - pendingPayments - pendingTaxes - reserve);
  let conservative = cash;
  let expected = cash;
  let firstBelowReserve;
  let lowest;
  const rows = [];
  for (let offset = 0; offset < 30; offset++) {
    const day = addDays(today, offset);
    const { payments = [], receipts = [] } = scheduled.get(day) || {};
    const out = payments.reduce((sum, item) => sum + item.amount, 0) + (day === date ? amount : 0);
    const incoming = receipts.reduce((sum, item) => sum + item.amount, 0);
    conservative -= out;
    expected += incoming - out;
    if (conservative < reserve && !firstBelowReserve) firstBelowReserve = day;
    if (!lowest || conservative < lowest.balance) lowest = { day, balance: conservative };
    if (offset === 0 || offset === 29 || day === date || payments.length || receipts.length) {
      rows.push({ day, payments, receipts, withdrawal: day === date ? amount : 0, conservative, expected });
    }
  }
  return {
    cash, reserve, maxToday, pendingPayments, pendingTaxes, pendingReceivables, unscheduledReceivables,
    lowest, firstBelowReserve, rows
  };
}

function payoff(balance, payment, rate) {
  let months = 0;
  let interest = 0;
  let firstPayment;
  while (balance > 0 && months < 600) {
    const monthlyInterest = Math.round(balance * rate / 100);
    const paid = Math.min(payment, balance + monthlyInterest);
    if (firstPayment === undefined) firstPayment = paid;
    if (paid <= monthlyInterest) return { status: 'stalled', firstPayment };
    interest += monthlyInterest;
    balance += monthlyInterest - paid;
    months++;
  }
  return balance > 0 ? { status: 'too-long', firstPayment } : { status: 'complete', months, interest, firstPayment };
}

export function debtPlan({ principal, payment, rate, extra }) {
  if (!isMoney(principal) || principal <= 0 || !isMoney(payment) || payment <= 0 ||
      !isMoney(extra) || extra < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('Confira o saldo devedor, a taxa mensal e os valores das parcelas.');
  }
  const regular = payoff(principal, payment, rate);
  const accelerated = payoff(principal, payment + extra, rate);
  const comparable = regular.status === 'complete' && accelerated.status === 'complete';
  return {
    regular, accelerated, extraUsed: accelerated.firstPayment - regular.firstPayment,
    monthsSaved: comparable ? regular.months - accelerated.months : null,
    interestSaved: comparable ? regular.interest - accelerated.interest : null
  };
}
