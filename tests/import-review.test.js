import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../dist/finance.js';
import { businessTotals } from '../dist/business.js';
import { applyReviewedImport, planImport, readImportFile, readPastedImport, undoReviewedImport } from '../dist/import-review.js';

const heading = 'Data;Descrição;Valor;Tipo';
const sale = '05/11/2026;Venda de teste;150,00;Entrada';
const cost = '06/11/2026;Materiais;35,50;Saída';
const csv = (...rows) => [heading, ...rows].join('\n');
const file = (name, content) => new File([content], name);

function ofx(account, lines) {
  return `<OFX><BANKID>001<ACCTID>${account}<BANKTRANLIST>${lines.map(([id, name, amount]) => `<STMTTRN><FITID>${id}<DTPOSTED>20261105120000<TRNAMT>${amount}<MEMO>${name}</STMTTRN>`).join('')}</BANKTRANLIST></OFX>`;
}

test('prévia não grava e o mesmo CSV renomeado não cria novos lançamentos', async () => {
  const state = emptyData('Ana');
  const original = await readImportFile(file('extrato.csv', csv(sale, cost)));
  const plan = planImport(state, [original]);
  assert.equal(plan.selected.length, 2);
  assert.equal(state.transactions.length, 0);
  const batch = await applyReviewedImport(state, [original], { account: 'Conta pessoal' });
  assert.equal(batch.count, 2);
  const renamed = await readImportFile(file('outro-nome.csv', csv(sale, cost)));
  const repeated = planImport(state, [renamed]);
  assert.equal(repeated.counts.repeated, 2);
  assert.equal(repeated.selected.length, 0);
  await assert.rejects(applyReviewedImport(state, [renamed]), /Nenhum registro novo/);
  assert.equal(state.transactions.length, 2);
});

test('extratos OFX com períodos sobrepostos comparam a conta e o identificador bancário', async () => {
  const state = emptyData();
  const first = await readImportFile(file('a.ofx', ofx('123', [['t1', 'Mercado', '-45.00']])));
  await applyReviewedImport(state, [first]);
  const later = await readImportFile(file('b.ofx', ofx('123', [['t1', 'Supermercado', '-45.00'], ['t2', 'Salário', '2000.00']])));
  const plan = planImport(state, [later]);
  assert.equal(plan.counts.repeated, 1);
  assert.equal(plan.selected[0].record.name, 'Salário');
  assert.equal('ofx_reference' in state.transactions[0], false);
  assert.equal(state.transactions[0].import_bank_key.length, 64);
  const anotherAccount = await readImportFile(file('c.ofx', ofx('456', [['t1', 'Padaria', '-12.00']])));
  assert.equal(planImport(state, [anotherAccount]).selected.length, 1);
});

test('correspondências incertas preservam a quantidade e podem ser incluídas após revisão', async () => {
  const state = emptyData();
  const manual = await readPastedImport(csv(cost));
  state.transactions.push(manual.rows[0].record);
  const documents = [await readPastedImport(csv(cost, cost))];
  const plan = planImport(state, documents);
  assert.deepEqual(plan.rows.map(row => row.status), ['possible', 'ready']);
  const include = new Set([plan.rows[0].key]);
  const batch = await applyReviewedImport(state, documents, { include });
  assert.equal(batch.count, 2);
  assert.equal(state.transactions.length, 3);
});

test('duas ocorrências idênticas no próprio extrato são importadas uma vez cada', async () => {
  const state = emptyData();
  const document = await readPastedImport(csv(cost, cost));
  assert.equal((await applyReviewedImport(state, [document, document])).count, 2);
  assert.equal(planImport(state, [document]).selected.length, 0);
});

test('destino Negócio afeta o caixa e mantém receita de venda sob classificação explícita', async () => {
  const state = emptyData();
  const document = await readPastedImport(csv(sale, cost));
  const batch = await applyReviewedImport(state, [document], { destination: 'business', account: 'PJ' });
  assert.equal(state.transactions.length, 0);
  assert.equal(businessTotals(state.business, '2026-11').balance, 11450);
  assert.equal(businessTotals(state.business, '2026-11').revenue, 0);
  await undoReviewedImport(state, batch.id);
  assert.equal(state.business.records.length, 0);
  await applyReviewedImport(state, [document], { destination: 'business' });
  state.business.records[0].counts_as_sale = true;
  assert.equal(businessTotals(state.business, '2026-11').revenue, 15000);
});

test('desfazer após recarregar remove apenas registros do lote e permite reimportar', async () => {
  const state = emptyData();
  const document = await readPastedImport(csv(cost));
  const batch = await applyReviewedImport(state, [document]);
  const saved = JSON.parse(JSON.stringify(state));
  const manual = { id: crypto.randomUUID(), name: 'Café', amount: 1500, date: '2026-11-09', type: 'expense' };
  saved.transactions.push(manual);
  await undoReviewedImport(saved, batch.id);
  assert.deepEqual(saved.transactions, [manual]);
  assert.ok(saved.import_batches[0].undone_at);
  assert.equal(planImport(saved, [document]).selected.length, 1);
  await assert.rejects(undoReviewedImport(saved, batch.id), /já foi desfeita/);
});

test('desfazer preserva registros alterados ou vinculados depois da importação', async () => {
  const state = emptyData();
  const document = await readPastedImport(csv(cost));
  const batch = await applyReviewedImport(state, [document]);
  const linked = structuredClone(state);
  linked.transactions.push({ id: crypto.randomUUID(), linked: linked.transactions[0].id });
  await assert.rejects(undoReviewedImport(linked, batch.id), /vinculadas/);
  state.transactions[0].amount = 2000;
  await assert.rejects(undoReviewedImport(state, batch.id), /alterados/);
  assert.equal(state.transactions[0].amount, 2000);
});
