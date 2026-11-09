import { escapeHTML, money } from './finance.js';
import { applyReviewedImport, planImport, undoReviewedImport } from './import-review.js';

const e = escapeHTML;
const labels = { transactions: 'Lançamento', debts: 'Dívida', goals: 'Objetivo', investments: 'Investimento' };
const statuses = { ready: 'Novo', possible: 'Possível duplicata', repeated: 'Já importado', invalid: 'Dados inválidos', unsupported: 'Somente no Pessoal' };
const destinationLabel = destination => destination === 'business' ? 'Negócio' : 'Pessoal';
const dateLabel = date => typeof date === 'string' && Number.isFinite(Date.parse(date))
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(date)) : '';
const batchFiles = batch => Array.isArray(batch.files) ? batch.files.join(', ') : 'Arquivo importado';
const amountLabel = record => `${record.type === 'expense' ? '− ' : record.type === 'income' ? '+ ' : ''}${money(record.amount ?? record.total ?? record.target)}`;

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
    const plan = planImport(getData(), review.documents, review.options);
    review.plan = plan;
    const start = review.page * pageSize;
    const page = plan.rows.slice(start, start + pageSize);
    const unavailable = plan.counts.invalid + plan.counts.unsupported;
    const skipped = plan.counts.repeated + plan.counts.possible - plan.selected.filter(row => row.status === 'possible').length;
    form.querySelector('#import-summary').textContent = `${plan.selected.length} para importar · ${skipped} repetidos ou suspeitos ignorados${unavailable ? ` · ${unavailable} indisponíveis neste destino` : ''}`;
    form.querySelector('#import-business-note').hidden = plan.destination !== 'business';
    form.querySelector('#import-rows').innerHTML = page.map((row, index) => {
      const date = row.record.date || row.record.due || row.record.deadline;
      const validDate = typeof date === 'string' && Number.isFinite(Date.parse(date));
      return `<li class="import-row"><div class="import-row-name"><strong>${e(row.record.name || labels[row.collection])}</strong><small>${labels[row.collection]}${validDate ? ` · ${e(dateLabel(date))}` : ''} · ${e(row.fileName)}</small>${row.status === 'possible' ? `<label class="import-include"><input type="checkbox" data-import-choice="${start + index}" ${row.selected ? 'checked' : ''}>Incluir mesmo assim</label>` : ''}</div><div class="import-row-value"><strong class="money">${amountLabel(row.record)}</strong><span class="import-status ${row.status}">${statuses[row.status]}</span></div></li>`;
    }).join('');
    form.querySelector('#import-pages').innerHTML = plan.rows.length > pageSize ? `<button type="button" class="button secondary" data-import-page="-1" ${review.page === 0 ? 'disabled' : ''}>Anterior</button><span>${start + 1}–${Math.min(start + pageSize, plan.rows.length)} de ${plan.rows.length}</span><button type="button" class="button secondary" data-import-page="1" ${start + pageSize >= plan.rows.length ? 'disabled' : ''}>Próxima</button>` : '';
    form.querySelector('[type="submit"]').disabled = !plan.selected.length;
    form.querySelector('[type="submit"]').textContent = plan.selected.length ? `Importar ${plan.selected.length} registro${plan.selected.length === 1 ? '' : 's'}` : 'Nenhum registro novo';
  }

  function open(documents, destination = 'personal') {
    if (documents.reduce((count, document) => count + document.rows.length, 0) > 5000) throw new Error('Divida a importação em lotes de até 5.000 registros.');
    if (!documents.some(document => document.rows.length)) throw new Error('Não encontrei registros no arquivo. Confira as colunas de descrição, data e valor.');
    review = { documents, original: getData(), options: { destination, account: '', include: new Set() }, page: 0 };
    modal('Revisar importação', `<div class="import-review"><p class="form-note">Confira o destino e os registros antes de salvar. Possíveis duplicatas ficam de fora por padrão.</p><div class="form-grid import-fields"><label class="field">Destino<select name="destination" data-import-setting><option value="personal" ${destination === 'personal' ? 'selected' : ''}>Pessoal</option><option value="business" ${destination === 'business' ? 'selected' : ''}>Negócio</option></select></label><label class="field">Conta de origem (opcional)<input class="input" name="account" data-import-setting maxlength="60" placeholder="Ex.: Conta PJ ou carteira" autocomplete="off"></label></div><p id="import-business-note" class="form-note" hidden>Entradas do extrato atualizam o caixa. Marque as vendas em Meu negócio para incluí-las no faturamento.</p><p class="import-summary" id="import-summary" aria-live="polite"></p><ul id="import-rows" class="import-rows"></ul><div id="import-pages" class="import-pages"></div><button class="button ghost" type="button" data-import-history>Ver histórico</button></div>`, 'import-review-form', 'Importar registros');
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
    if (input.hasAttribute('data-import-setting')) {
      review.options.include.clear();
      review.page = 0;
      updatePreview();
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
