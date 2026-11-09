import test from 'node:test';
import assert from 'node:assert/strict';
import { debtPlan, withdrawalPlan } from '../dist/planning.js';

test('retirada reserva tributos e pagamentos, sem usar vendas a receber ou cobrar tributos duas vezes', () => {
  const business = {
    profile: { name: 'Estúdio', opening_balance: 550000 },
    records: [
      { name: 'Tributo já baixado', type: 'expense', status: 'paid', amount: 50000, paid_date: '2026-11-06' },
      { name: 'Fornecedor atrasado', type: 'expense', status: 'pending', amount: 200000, due_date: '2026-11-07' },
      { name: 'Venda a receber', type: 'income', status: 'pending', amount: 160000, due_date: '2026-11-12' },
      { name: 'Venda atrasada', type: 'income', status: 'pending', amount: 100000, due_date: '2026-11-01' }
    ],
    taxes: [
      { name: 'Guia paga', paid: true, amount: 50000, due_date: '2026-11-07' },
      { name: 'Guia aberta', paid: false, amount: 50000, due_date: '2026-12-01' },
      { name: 'Guia fora do período', paid: false, amount: 100000, due_date: '2026-12-09' }
    ]
  };
  const plan = withdrawalPlan(business, { today: '2026-11-09', date: '2026-11-12', reserve: 150000, amount: 110000 });
  assert.equal(plan.maxToday, 100000);
  assert.equal(plan.firstBelowReserve, '2026-12-01');
  assert.equal(plan.rows[0].conservative, 300000);
  assert.equal(plan.rows.at(-1).conservative, 140000);
  assert.equal(plan.rows.at(-1).expected, 300000);
  assert.equal(plan.unscheduledReceivables, 100000);
});

test('pendência sem data bloqueia estimativa de retirada até revisão', () => {
  const business = {
    profile: { name: 'Estúdio', opening_balance: 500000 },
    records: [{ name: 'Conta sem data', status: 'pending', type: 'expense', due_date: '', amount: 10000 }],
    taxes: []
  };
  const plan = withdrawalPlan(business, { today: '2026-11-09', date: '2026-11-09', reserve: 0 });
  assert.equal(plan.maxToday, null);
  assert.equal(plan.rows[0].conservative, 490000);
});

test('parcela extra reduz o saldo e usa somente o valor necessário na última parcela', () => {
  const plan = debtPlan({ principal: 100000, payment: 60000, rate: 10, extra: 60000 });
  assert.equal(plan.regular.interest, 15000);
  assert.equal(plan.accelerated.interest, 10000);
  assert.equal(plan.accelerated.firstPayment, 110000);
  assert.equal(plan.extraUsed, 50000);
  assert.equal(plan.monthsSaved, 1);
  assert.equal(plan.interestSaved, 5000);
});

test('simulação não promete quitação ou economia quando a parcela normal só cobre juros', () => {
  const plan = debtPlan({ principal: 100000, payment: 10000, rate: 10, extra: 15000 });
  assert.equal(plan.regular.status, 'stalled');
  assert.equal(plan.accelerated.status, 'complete');
  assert.equal(plan.monthsSaved, null);
  assert.equal(plan.interestSaved, null);
});
