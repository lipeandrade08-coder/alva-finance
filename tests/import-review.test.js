import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyData, totals } from '../dist/finance.js';
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

test('importa CSV com vários meses e anos, sem confundir decimais, saldos e totais com movimentações', async () => {
  const document = await readPastedImport([
    'sep=;',
    'Data do lançamento;Descrição;Saldo;Valor da movimentação;Tipo;Parcelas',
    '31/12/2024;"Material; loja";5000;35.50;Saída;2',
    '2025-01-02T00:15:00+03:00;Crédito;5010;1.234,56;Entrada;',
    '04/02/2025;"Descrição com',
    'quebra";5100;R$ -12,05;Saída;',
    '28/02/2025;Total do mês;5000;5.000,00;Entrada;',
    '31/02/2025;Data impossível;5010;20,00;Saída;',
    ';Sem data;5020;22,00;Saída;',
    '05/02/2025;Sem valor de movimento;5000;;Entrada;'
  ].join('\r\n'));
  const state = emptyData();
  const plan = planImport(state, [document]);
  assert.deepEqual(plan.selected.map(row => [row.record.date, row.record.amount, row.record.type]), [
    ['2024-12-31', 3550, 'expense'],
    ['2025-01-02', 123456, 'income'],
    ['2025-02-04', 1205, 'expense']
  ]);
  assert.equal(plan.periods.get('undated').count, 2);
  assert.equal(plan.periods.get('2025-01').income, 123456);
  assert.equal(plan.periods.get('2025-02').expense, 1205);
  assert.equal(plan.rows.find(row => row.record.name === 'Data impossível').sourceDate, '31/02/2025');
  const missing = plan.rows.find(row => row.record.name === 'Sem data');
  await applyReviewedImport(state, [document], { dates: new Map([[missing.key, '2025-03-01']]) });
  assert.equal(totals(state, '2024-12').expense, 3550);
  assert.equal(totals(state, '2025-02').expense, 1205);
  assert.equal(totals(state, '2025-03').expense, 2200);
  assert.equal(state.transactions.length, 4);
});

for (const system of [1900, 1904]) {
  test(`Excel ${system} mantém as datas por aba, preserva células vazias e não importa totais`, async () => {
    const bytes = await readFile(new URL(`./fixtures/importacao-${system}.xlsx`, import.meta.url));
    const document = await readImportFile(file(`extrato-${system}.xlsx`, bytes));
    const state = emptyData();
    const plan = planImport(state, [document]);
    assert.deepEqual(plan.selected.map(row => [row.record.date, row.record.amount]), [
      ['2024-01-03', 1875], ['2024-01-31', 240000], ['2025-02-06', 35050], ['2025-02-08', 2505]
    ]);
    assert.equal(plan.periods.get('undated').count, 1);
    assert.equal(plan.rows.length, 5);
    await applyReviewedImport(state, [document], { destination: 'business' });
    assert.equal(businessTotals(state.business, '2024-01').spent, 1875);
    assert.equal(businessTotals(state.business, '2025-02').spent, 2505);
  });
}

test('mês informado no arquivo não faz data vazia ou ano ambíguo cair no mês atual', async () => {
  const document = await readPastedImport('Dezembro 2024\nDia;Descrição;Receita\n28;Venda de dezembro;1.500\nJaneiro\nDia;Descrição;Receita\n2;Venda sem ano;250,00');
  const plan = planImport(emptyData(), [document]);
  assert.deepEqual(plan.rows.map(row => [row.period,row.record.type,row.record.amount]), [
    ['2024-12','income',150000], ['undated','income',25000]
  ]);
});

test('Excel separa receitas e despesas por mês e destino, ignorando relatórios e previsões', async () => {
  const bytes = await readFile(new URL('./fixtures/importacao-abas-mistas.xlsx', import.meta.url));
  const document = await readImportFile(file('controle.xlsx', bytes));
  assert.deepEqual(document.ignoredSheets, ['Visão Geral', 'Clientes Ativos']);
  assert.equal(document.unsettled, 2);
  const state = emptyData();
  const personal = planImport(state, [document]);
  const business = planImport(state, [document], { destination: 'business' });
  const monthly = plan => [...plan.periods].filter(([period]) => /^\d/.test(period))
    .map(([period, { income, expense }]) => [period, income, expense]);
  assert.deepEqual(monthly(personal), [['2026-08', 182030, 25025], ['2026-11', 183544, 7280]]);
  assert.deepEqual(monthly(business), [['2026-08', 90000, 5740], ['2026-11', 70000, 12999]]);
  assert.equal(personal.otherDestinationCount, 4);
  assert.equal(personal.periods.get('undated').count, 1);
  assert.equal(business.periods.has('2026-12'), false);

  await applyReviewedImport(state, [document]);
  await applyReviewedImport(state, [document], { destination: 'business' });
  assert.equal(state.transactions.length, 4);
  assert.equal(state.investments.length, 1);
  assert.equal(state.goals.length, 0);
  assert.equal(state.business.records.length, 4);
  assert.equal(totals(state, '2026-11').expense, 7280);
  assert.equal(businessTotals(state.business, '2026-11').received, 70000);
  assert.equal(planImport(state, [document]).selected.length, 0);
  assert.equal(planImport(state, [document], { destination: 'business' }).selected.length, 0);
});
