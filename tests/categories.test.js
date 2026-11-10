import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../dist/finance.js';
import { addCustomCategory, categoryForRecord, categoryNames, categoryOptions } from '../dist/categories.js';

test('categorias personalizadas persistem por área e tipo, sem depender de lançamentos existentes', () => {
  const state = emptyData();
  assert.equal(addCustomCategory(state, { area: 'personal', type: 'expense', name: '  Netflix  ' }), 'Netflix');
  assert.equal(addCustomCategory(state, { area: 'personal', type: 'income', name: 'Aulas' }), 'Aulas');
  const saved = JSON.parse(JSON.stringify(state));
  assert.ok(categoryNames(saved, 'personal', 'expense').includes('Netflix'));
  assert.ok(categoryNames(saved, 'personal', 'income').includes('Aulas'));
  assert.ok(!categoryNames(saved, 'personal', 'income').includes('Netflix'));
  assert.ok(!categoryNames(saved, 'business', 'expense').includes('Netflix'));
  assert.throws(() => categoryForRecord(saved, 'personal', { type: 'income', category: 'Netflix' }), /categoria válida/);
});

test('criação no lançamento evita duplicatas e preserva categorias já usadas no histórico', () => {
  const state = emptyData();
  state.business = { records: [{ category: 'Categoria antiga', type: 'expense' }] };
  const name = categoryForRecord(state, 'business', {
    type: 'expense', category: '', new_category: 'Locação  de estúdio'
  });
  assert.equal(name, 'Locação de estúdio');
  assert.throws(() => addCustomCategory(state, {
    area: 'business', type: 'expense', name: 'locacao de estudio'
  }), /já existe/);
  assert.ok(categoryNames(state, 'business', 'expense').includes('Categoria antiga'));
  assert.equal(categoryForRecord(state, 'business', { type: 'expense', category: 'Categoria antiga' }), 'Categoria antiga');
});

test('texto de categoria é escapado nas opções de lançamento e filtro', () => {
  const state = emptyData();
  addCustomCategory(state, { area: 'personal', type: 'expense', name: 'Cinema & <Arte>' });
  const options = categoryOptions(state, 'personal', 'expense');
  assert.match(options, /Cinema &amp; &lt;Arte&gt;/);
  assert.doesNotMatch(options, /<Arte>/);
});
