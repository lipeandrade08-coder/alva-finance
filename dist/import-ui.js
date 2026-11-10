import { escapeHTML, money } from './finance.js';
import { applyReviewedImport, monthLabel, planImport, undoReviewedImport } from './import-review.js';

const e = escapeHTML;
const labels = { transactions: 'Lançamento', debts: 'Dívida', goals: 'Objetivo', investments: 'Investimento' };
const statuses = { ready: 'Novo', possible: 'Possível duplicata', repeated: 'Já importado', conflict: 'Diverge do lote anterior', invalid: 'Dados inválidos', unsupported: 'Somente no Pessoal' };
const destinationLabel = destination => destination === 'business' ? 'Negócio' : 'Pessoal';
const dateLabel = date => typeof date === 'string' && Number.isFinite(Date.parse(date))
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(date)) : '';
const periodLabel = period => period === 'undated' ? 'Datas a revisar' : period === 'other' ? 'Registros sem data aplicável' : monthLabel(period);
const batchFiles = batch => Array.isArray(batch.files) ? batch.files.join(', ') : 'Arquivo importado';
const amountLabel = record => `${record.type === 'expense' ? '− ' : record.type === 'income' ? '+ ' : ''}${money(record.amount ?? record.total ?? record.target)}`;
const totalsLabel = ({ income, expense }) => `<span>Entradas <strong class="money">${money(income)}</strong></span><span>Saídas <strong class="money">${money(expense)}</strong></span>`;

function previewTotals(plan, period) {
  return (plan.plans ?? [plan]).map(scoped => {
    const totals = { income: 0, expense: 0 };
    for (const [key, values] of scoped.periods) {
      if (period === 'all' || key === period) {
        totals.income += values.income;
        totals.expense += values.expense;
      }
    }
    const label = plan.plans ? `<b>${destinationLabel(scoped.destination)}</b>` : '';
    return `<span class="import-period-totals">${label}${totalsLabel(totals)}</span>`;
  }).join('');
}

function previewComparison(plan, period) {
  if (!/^\d{4}-\d{2}$/.test(period)) return '';
  return (plan.plans ?? [plan]).map(scoped => {
    const values = scoped.comparison.get(period);
    if (!values) return '';
    const unmatched = values.unmatched.length ? `<details class="import-unmatched">
      <summary>Já na Alva e sem correspondência no arquivo (${values.unmatched.length})</summary>
      <ul>${values.unmatched.slice(0, 10).map(record => `<li>${e(dateLabel(record.date))} · ${e(record.name)} · <span class="money">${amountLabel(record)}</span></li>`).join('')}</ul>
      ${values.unmatched.length > 10 ? '<p>Veja os demais lançamentos na área correspondente.</p>' : ''}
    </details>` : '';
    return `<div class="import-comparison-group"><b>${destinationLabel(scoped.destination)}</b>
      <div class="import-period-totals"><span>No arquivo</span>${totalsLabel(values.file)}</div>
      ${plan.counts.conflict ? '' : `<div class="import-period-totals"><span>Após importar</span>${totalsLabel(values.after)}</div>`}
      ${unmatched}
    </div>`;
  }).join('');
}

export function createImportUI({ getData, dialog, modal, commit, onImported }) {
  let review;
  const pageSize = 25;

  function updatePreview() {
    if (!review) return;
    const form = dialog.querySelector('#import-review-form');
    if (!form) return;
    const fields = new FormData(form);
    review.options.destination = fields.get('destination');
    review.options.account = fields.get('account');
    review.options.replace = new Set(fields.getAll('replace_batch'));
    const plan = planImport(getData(), review.documents, review.options);
    review.plan = plan;
    const replacements = new Set(plan.replacements.map(batch => batch.id));
    const replacementField = form.querySelector('#import-replacements');
    replacementField.hidden = !plan.candidates.length;
    replacementField.innerHTML = plan.candidates.length ? `<legend>Substituir lotes anteriores</legend>
      <p class="form-note">Marque apenas os lotes desta planilha que precisam ser corrigidos. Ao confirmar, o lote inteiro será substituído pelos registros revisados.</p>
      ${plan.candidates.map(batch => `<label class="import-include"><input type="checkbox" name="replace_batch" value="${e(batch.id)}" ${replacements.has(batch.id) ? 'checked' : ''}>${e(destinationLabel(batch.destination))} · ${e(batchFiles(batch))} · ${e(dateLabel(batch.created_at))} · ${batch.count} registro${batch.count === 1 ? '' : 's'}</label>`).join('')}` : '';
    const periodSelect = form.querySelector('#import-period');
    if (review.period !== 'all' && !plan.periods.has(review.period)) review.period = 'all';
    const periods = [...plan.periods.keys()].sort((a, b) => a.localeCompare(b));
    periodSelect.innerHTML = '<option value="all">Todos os períodos</option>' +
      periods.map(period => `<option value="${period}">${e(periodLabel(period))} · ${plan.periods.get(period).count}</option>`).join('');
    periodSelect.value = review.period;
    const filtered = plan.rows.map((row, index) => ({ row, index }))
      .filter(({ row }) => review.period === 'all' || row.period === review.period)
      .sort((a, b) => a.row.period.localeCompare(b.row.period));
    review.page = Math.max(0, Math.min(review.page, Math.ceil(filtered.length / pageSize) - 1));
    const start = review.page * pageSize;
    const page = filtered.slice(start, start + pageSize);
    const unavailable = plan.counts.invalid + plan.counts.unsupported;
    const skipped = plan.counts.repeated + plan.counts.possible - plan.selected.filter(row => row.status === 'possible').length;
    const undated = plan.periods.get('undated')?.count ?? 0;
    form.querySelector('#import-summary').textContent = `${plan.selected.length} para importar · ${skipped} duplicatas ignoradas${unavailable ? ` · ${unavailable} fora da importação` : ''}`;
    form.querySelector('#import-date-note').hidden = !undated;
    form.querySelector('#import-date-note').textContent = undated ? `${undated} registro${undated === 1 ? '' : 's'} com data a revisar. Informe a data correta para incluir na importação.` : '';
    form.querySelector('#import-business-note').hidden = plan.destination === 'personal';
    const notes = [...review.sourceNotes];
    if (plan.counts.conflict) {
      notes.push(`${plan.counts.conflict} registros divergem de um lote anterior. Selecione o lote incorreto para substituir ou revise o histórico de importações.`);
    }
    if (plan.otherDestinationCount) {
      const other = destinationLabel(plan.destination === 'business' ? 'personal' : 'business');
      notes.push(`${plan.otherDestinationCount} registros de abas de ${other} estão separados. Para conferi-los, troque o destino.`);
    }
    if (plan.unassignedCount) {
      notes.push(`Linhas sem destino identificado: ${plan.unassignedCount}. Selecione Pessoal ou Negócio para revisar essas linhas.`);
    }
    const sourceNote = form.querySelector('#import-source-note');
    sourceNote.hidden = !notes.length;
    sourceNote.innerHTML = notes.map(note => `<li>${e(note)}</li>`).join('');
    form.querySelector('#import-period-totals').innerHTML = previewComparison(plan, review.period) ||
      `<span class="form-note">A importar</span>${previewTotals(plan, review.period)}`;
    form.querySelector('#import-rows').innerHTML = page.map(({ row, index }, pageIndex) => {
      const date = row.dateField ? row.record[row.dateField] : '';
      const dateText = dateLabel(date);
      const previousPeriod = page[pageIndex - 1]?.row.period;
      const group = review.period === 'all' && previousPeriod !== row.period
        ? `<li class="import-month-heading"><span>${e(periodLabel(row.period))}</span>${dateText && !row.needsDate ? previewTotals(plan, row.period) : ''}</li>` : '';
      const editor = row.dateField && !['repeated', 'conflict', 'unsupported'].includes(row.status) && !row.issue
        ? `<details class="import-date-editor" ${row.needsDate ? 'open' : ''}><summary>${row.needsDate ? 'Informar data' : 'Corrigir data'}</summary><label class="field"><span class="visually-hidden">Data de ${e(row.record.name)}</span><input class="input" type="date" data-import-date="${index}" value="${e(date)}"></label></details>` : '';
      const issue = row.issue || (row.needsDate ? row.sourceDate ? `Data no arquivo: ${row.sourceDate}` : 'Linha sem data no arquivo' : '');
      const status = row.needsDate && row.status === 'invalid' ? 'Data a revisar' : statuses[row.status];
      const kind = row.collection === 'transactions' ? row.record.type === 'income' ? 'Entrada' : 'Saída' : labels[row.collection];
      const detail = plan.plans ? `${destinationLabel(row.destination)} · ${kind}` : kind;
      return `${group}<li class="import-row"><div class="import-row-name"><strong>${e(row.record.name || labels[row.collection])}</strong><small>${detail}${dateText ? ` · ${e(dateText)}` : ''} · ${e(row.fileName)}${row.sheet ? ` · ${e(row.sheet)}${row.cell ? '!' + e(row.cell) : ''}` : ''}</small>${issue ? `<small>${e(issue)}</small>` : ''}${editor}${row.status === 'possible' ? `<label class="import-include"><input type="checkbox" data-import-choice="${index}" ${row.selected ? 'checked' : ''}>Incluir mesmo assim</label>` : ''}</div><div class="import-row-value"><strong class="money">${row.issue && !row.record.amount ? '—' : amountLabel(row.record)}</strong><span class="import-status ${row.status}">${status}</span></div></li>`;
    }).join('');
    form.querySelector('#import-pages').innerHTML = filtered.length > pageSize ? `<button type="button" class="button secondary" data-import-page="-1" ${review.page === 0 ? 'disabled' : ''}>Anterior</button><span>${start + 1}–${Math.min(start + pageSize, filtered.length)} de ${filtered.length}</span><button type="button" class="button secondary" data-import-page="1" ${start + pageSize >= filtered.length ? 'disabled' : ''}>Próxima</button>` : '';
    form.querySelector('[type="submit"]').disabled = !plan.selected.length || Boolean(plan.counts.conflict);
    form.querySelector('[type="submit"]').textContent = plan.counts.conflict ? 'Revise os lotes anteriores'
      : plan.replacements.length ? `Substituir e importar ${plan.selected.length} registros`
      : plan.selected.length ? `Importar ${plan.selected.length} registro${plan.selected.length === 1 ? '' : 's'}` : 'Nenhum registro novo';
  }

  function open(documents, destination = 'personal') {
    if (documents.reduce((count, document) => count + document.rows.length, 0) > 5000) throw new Error('Divida a importação em lotes de até 5.000 registros.');
    const sourceNotes = [];
    const ignored = [...new Set(documents.flatMap(document => document.ignoredSheets ?? []))];
    const unsettled = documents.reduce((count, document) => count + (document.unsettled ?? 0), 0);
    const unverified = documents.reduce((count, document) => count + (document.unverified ?? 0), 0);
    if (unverified) sourceNotes.push(`Linhas sem data ou com valores ambíguos ficaram fora da importação (${unverified}).`);
    if (ignored.length) sourceNotes.push(`Resumos e projeções ignorados: ${ignored.slice(0, 5).join(', ')}${ignored.length > 5 ? '…' : ''}.`);
    if (unsettled) sourceNotes.push(`${unsettled} movimentaç${unsettled === 1 ? 'ão pendente, prevista ou cancelada ficou' : 'ões pendentes, previstas ou canceladas ficaram'} fora da importação.`);
    if (!documents.some(document => document.rows.length)) throw new Error(sourceNotes.join(' ') || 'Não encontrei registros no arquivo. Confira as colunas de descrição, data e valor.');
    const scopes = new Set(documents.flatMap(document => document.rows.map(row => row.destination)));
    const mixed = scopes.has('personal') && scopes.has('business');
    if (mixed) destination = 'mixed';
    else if (scopes.size === 1) destination = [...scopes][0] || destination;
    const mixedOption = mixed ? '<option value="mixed" selected>Pessoal e Negócio</option>' : '';
    review = { documents, sourceNotes, original: getData(), options: { destination, account: '', include: new Set(), dates: new Map() }, page: 0, period: 'all' };
    modal('Revisar importação', `<div class="import-review"><p class="form-note">Confira o destino e os registros antes de salvar. Possíveis duplicatas ficam de fora por padrão. O filtro de mês muda só a prévia.</p><div class="form-grid import-fields"><label class="field">Destino<select name="destination" data-import-setting>${mixedOption}<option value="personal" ${destination === 'personal' ? 'selected' : ''}>Pessoal</option><option value="business" ${destination === 'business' ? 'selected' : ''}>Negócio</option></select></label><label class="field">Conta de origem (opcional)<input class="input" name="account" data-import-setting maxlength="60" placeholder="Ex.: Conta PJ ou carteira" autocomplete="off"></label></div><div class="import-period"><label class="field">Ver lançamentos por mês<select id="import-period" data-import-period></select></label><div id="import-period-totals"></div></div><ul id="import-source-note" class="form-note import-source-note" hidden></ul><p id="import-date-note" class="form-note" hidden></p><p id="import-business-note" class="form-note" hidden>Entradas do extrato atualizam o caixa. Marque as vendas em Meu negócio para incluí-las no faturamento.</p><fieldset id="import-replacements" class="import-replacements" hidden></fieldset><p class="import-summary" id="import-summary" aria-live="polite"></p><ul id="import-rows" class="import-rows"></ul><div id="import-pages" class="import-pages"></div><button class="button ghost" type="button" data-import-history>Ver histórico</button></div>`, 'import-review-form', 'Importar registros');
    updatePreview();
  }

  function showHistory() {
    review = null;
    const batches = getData().import_batches ?? [];
    const body = batches.length ? `<ul class="import-rows">${batches.map(batch => `<li class="import-row"><div class="import-row-name"><strong>${e(batchFiles(batch))}</strong><small>${e(destinationLabel(batch.destination))}${batch.account ? ` · ${e(batch.account)}` : ''} · ${e(dateLabel(batch.created_at))} · ${e(batch.count)} registro${batch.count === 1 ? '' : 's'}</small></div>${batch.undone_at ? '<span class="import-status">Desfeita</span>' : `<button class="button secondary" type="button" data-import-undo="${e(batch.id)}">Desfazer</button>`}</li>`).join('')}</ul>` : '<p class="form-note">As próximas importações confirmadas aparecerão aqui.</p>';
    modal('Histórico de importações', body, '');
  }

  function click(button) {
    if (button.hasAttribute('data-import-history')) {
      showHistory();
      return true;
    }
    if (button.dataset.importPage && review) {
      review.page += Number(button.dataset.importPage);
      updatePreview();
      dialog.querySelector('#import-rows')?.scrollTo({ top: 0 });
      return true;
    }
    if (button.dataset.importUndo) {
      const batch = (getData().import_batches ?? []).find(item => item.id === button.dataset.importUndo);
      if (batch && !batch.undone_at) {
        modal('Desfazer importação?', `<input type="hidden" name="batch_id" value="${e(batch.id)}"><p class="form-note">O lote contém ${e(batch.count)} registro${batch.count === 1 ? '' : 's'} de <strong>${e(batchFiles(batch))}</strong> em ${destinationLabel(batch.destination)}. A Alva verifica alterações e vínculos antes de remover o lote.</p>`, 'import-undo-form', 'Desfazer lote');
      }
      return true;
    }
    return false;
  }

  function change(input) {
    if (!review || !input.closest('#import-review-form')) return false;
    if (input.hasAttribute('data-import-setting') || input.name === 'replace_batch') {
      review.options.include.clear();
      review.page = 0;
      updatePreview();
    }
    if (input.hasAttribute('data-import-period')) {
      review.period = input.value;
      review.page = 0;
      updatePreview();
      dialog.querySelector('#import-rows')?.scrollTo({ top: 0 });
    }
    if (input.hasAttribute('data-import-date')) {
      const index = Number(input.dataset.importDate);
      const row = review.plan.rows[index];
      if (row?.dateField && !['repeated', 'conflict', 'unsupported'].includes(row.status)) {
        if (input.value) review.options.dates.set(row.key, input.value);
        else review.options.dates.delete(row.key);
        review.options.include.delete(row.key);
        updatePreview();
        const editor = dialog.querySelector(`[data-import-date="${index}"]`);
        if (editor) {
          editor.closest('details').open = true;
          editor.focus({ preventScroll: true });
        }
      }
    }
    if (input.hasAttribute('data-import-choice')) {
      const row = review.plan.rows[Number(input.dataset.importChoice)];
      if (row?.status === 'possible') {
        if (input.checked) review.options.include.add(row.key);
        else review.options.include.delete(row.key);
        const focusedIndex = input.dataset.importChoice;
        updatePreview();
        dialog.querySelector(`[data-import-choice="${focusedIndex}"]`)?.focus({ preventScroll: true });
      }
    }
    return true;
  }

  async function submit(form) {
    if (form.id === 'import-review-form' && review) {
      if (review.original !== getData()) throw new Error('Os dados mudaram desde a prévia. Abra o arquivo novamente para revisar a importação.');
      const fields = new FormData(form);
      if (fields.get('destination') !== review.options.destination || fields.get('account') !== review.options.account) {
        review.options.include.clear();
        updatePreview();
        throw new Error('Confira a prévia atualizada antes de importar.');
      }
      const pending = review;
      let batch;
      await commit(async next => {
        batch = await applyReviewedImport(next, pending.documents, pending.options);
      }, 'Importação concluída.');
      if (batch) onImported(batch);
      return true;
    }
    if (form.id === 'import-undo-form') {
      const id = new FormData(form).get('batch_id');
      await commit(next => undoReviewedImport(next, id), 'Importação desfeita.');
      showHistory();
      return true;
    }
    return false;
  }

  dialog.addEventListener('close', () => { if (!dialog.open) review = null; });
  return { open, click, change, submit };
}
