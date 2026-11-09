import { evaluateSpendingLimits, money } from './finance.js';

export const noticeDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const levelOf = limit => limit.exceeded ? 100 : limit.warning ? 80 : 0;

export function crossedLimits(previous, current, month) {
  const previousLevels = new Map(evaluateSpendingLimits(previous, month).map(limit => [limit.id, levelOf(limit)]));
  return evaluateSpendingLimits(current, month).filter(limit => levelOf(limit) > (previousLevels.get(limit.id) ?? 0));
}

export function recordDemoNotices(state, limits, month) {
  const history = Array.isArray(state.notice_history) ? state.notice_history : [];
  const keys = new Set(history.map(row => `${row.limit_id}/${row.month}/${row.level}`));
  const inserted = [];
  for (const limit of limits) {
    const level = levelOf(limit);
    const monthStart = `${month}-01`;
    const key = `${limit.id}/${monthStart}/${level}`;
    if (!level || keys.has(key)) continue;
    keys.add(key);
    inserted.push({
      id: crypto.randomUUID(), limit_id: limit.id, label: limit.name, level, month: monthStart,
      spent_cents: limit.spent, limit_cents: limit.limit, created_at: new Date().toISOString(),
      email_state: 'panel', read_at: null
    });
  }
  if (inserted.length) state.notice_history = [...inserted, ...history].slice(0, 50);
}

const dueText = value => value.split('-').reverse().join('/');

export function attentionPlan(state, today = noticeDate()) {
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 7);
  const horizon = start.toISOString().slice(0, 10);
  const relevant = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= horizon;
  const commitments = [
    ...(state.debts ?? []).filter(item => item.balance > 0 && relevant(item.due)).map(item => ({
      itemId: item.id, entity: 'debt', title: item.name, date: item.due, amount: item.balance,
      target: 'debts', section: 'Pessoal', action: 'Abrir dívida', amountLabel: 'em aberto'
    })),
    ...(state.business?.records ?? []).filter(item => item.status === 'pending' && relevant(item.due_date)).map(item => ({
      itemId: item.id, entity: 'record', title: item.name, date: item.due_date, amount: item.amount,
      target: 'business', section: 'Negócio', action: item.type === 'income' ? 'Abrir recebimento' : 'Abrir conta',
      amountLabel: item.type === 'income' ? 'a receber' : 'a pagar', isReceipt: item.type === 'income'
    })),
    ...(state.business?.taxes ?? []).filter(item => !item.paid && relevant(item.due_date)).map(item => ({
      itemId: item.id, entity: 'tax', title: item.name, date: item.due_date, amount: item.amount,
      target: 'business', section: 'Negócio', action: 'Abrir tributo', amountLabel: 'a pagar'
    }))
  ].sort((a, b) => a.date.localeCompare(b.date)).map(item => ({
    itemId: item.itemId, entity: item.entity, title: item.title, target: item.target, action: item.action,
    detail: `${item.section} · ${item.date < today ? 'Venceu em' : 'Vence em'} ${dueText(item.date)}`,
    amounts: `${money(item.amount)} ${item.amountLabel}`,
    priority: item.isReceipt ? (item.date <= today ? 2 : 4) : (item.date <= today ? 0 : 2),
    icon: 'calendar'
  }));
  const limits = evaluateSpendingLimits(state, today.slice(0, 7)).filter(limit => levelOf(limit) > 0)
    .sort((a, b) => b.pct - a.pct).map(limit => ({
      itemId: limit.id, entity: 'limit',
      title: `${limit.name} · ${limit.pct}% do limite`,
      detail: 'Gastos registrados neste mês',
      amounts: `${money(limit.spent)} de ${money(limit.limit)}`,
      target: 'transactions', action: 'Revisar limite', priority: limit.exceeded ? 1 : 3, icon: 'wallet'
    }));
  return [...commitments, ...limits].sort((a, b) => a.priority - b.priority).slice(0, 3);
}
