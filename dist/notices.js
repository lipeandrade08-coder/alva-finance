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
      title: item.name, date: item.due, amount: item.balance, target: 'debts', section: 'Pessoal', action: 'Ver dívidas', amountLabel: 'em aberto'
    })),
    ...(state.business?.records ?? []).filter(item => item.type === 'expense' && item.status === 'pending' && relevant(item.due_date)).map(item => ({
      title: item.name, date: item.due_date, amount: item.amount, target: 'business', section: 'Negócio', action: 'Ver compromissos', amountLabel: 'a pagar'
    })),
    ...(state.business?.taxes ?? []).filter(item => !item.paid && relevant(item.due_date)).map(item => ({
      title: item.name, date: item.due_date, amount: item.amount, target: 'business', section: 'Negócio', action: 'Ver tributos', amountLabel: 'a pagar'
    }))
  ].sort((a, b) => a.date.localeCompare(b.date)).map(item => ({
    title: item.title,
    detail: `${item.section} · ${money(item.amount)} ${item.amountLabel} · ${item.date < today ? 'Venceu em' : 'Vence em'} ${dueText(item.date)}`,
    target: item.target, action: item.action, priority: item.date <= today ? 0 : 2, icon: 'calendar'
  }));
  const limits = evaluateSpendingLimits(state, today.slice(0, 7)).filter(limit => levelOf(limit) > 0)
    .sort((a, b) => b.pct - a.pct).map(limit => ({
      title: `${limit.name} · ${limit.pct}% do limite`,
      detail: `${money(limit.spent)} de ${money(limit.limit)} registrados neste mês.`,
      target: 'transactions', action: 'Revisar gastos', priority: limit.exceeded ? 1 : 3, icon: 'wallet'
    }));
  return [...commitments, ...limits].sort((a, b) => a.priority - b.priority).slice(0, 3);
}
