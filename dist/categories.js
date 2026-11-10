import { categories, escapeHTML } from './finance.js';
import { businessCategories } from './business.js';

const defaults = { personal: categories, business: businessCategories };
const types = ['income', 'expense'];
export const categoryNameLimit = 50;
const cleanName = value => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : '';
const nameKey = value => cleanName(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function customCategories(state, area) {
  const saved = state.custom_categories;
  if (!Array.isArray(saved)) return [];
  return saved.filter(item => item?.area === area && types.includes(item.type) &&
    typeof item.name === 'string' && item.name.length <= categoryNameLimit && cleanName(item.name));
}

export function categoryNames(state, area, type) {
  const records = area === 'business' ? state.business?.records : state.transactions;
  const choices = new Set(defaults[area]);
  for (const item of customCategories(state, area)) {
    if (!type || item.type === type) choices.add(item.name);
  }
  for (const record of records ?? []) {
    if ((!type || record.type === type) && typeof record.category === 'string' && record.category.trim()) {
      choices.add(record.category);
    }
  }
  return [...choices];
}

export function addCustomCategory(state, { area, type, name }) {
  if (!Object.hasOwn(defaults, area) || !types.includes(type)) throw new Error('Selecione o tipo de categoria.');
  const label = cleanName(name);
  if (!/[\p{L}\p{N}]/u.test(label) || label.length > categoryNameLimit || /\p{Cc}/u.test(label)) {
    throw new Error('Informe um nome de categoria de até 50 caracteres.');
  }
  if (categoryNames(state, area, type).some(option => nameKey(option) === nameKey(label))) {
    throw new Error('Essa categoria já existe para esse tipo de lançamento.');
  }
  const existing = customCategories(state, area);
  const otherArea = area === 'personal' ? 'business' : 'personal';
  state.custom_categories = [...customCategories(state, otherArea), ...existing, { area, type, name: label }];
  return label;
}

export function categoryOptions(state, area, type, selected) {
  return categoryNames(state, area, type).map(name => {
    const text = escapeHTML(name);
    return '<option value="' + text + '"' + (selected === name ? ' selected' : '') + '>' + text + '</option>';
  }).join('');
}

export function categoryField(state, area, type, selected) {
  return '<div class="field" data-category-area="' + area + '">' +
    '<label class="field">Categoria<select name="category">' +
    categoryOptions(state, area, type, selected) + '<option value="">+ Nova categoria</option></select></label>' +
    '<div data-category-name hidden><label class="field">Nome da nova categoria' +
    '<input class="input" name="new_category" maxlength="' + categoryNameLimit + '" autocomplete="off" disabled>' +
    '</label></div></div>';
}

export function changeCategoryField(state, input) {
  const field = input.form?.querySelector('[data-category-area]');
  if (!field || !['type', 'category'].includes(input.name)) return;
  const area = field.dataset.categoryArea;
  const select = input.form.elements.category;
  const name = input.form.elements.new_category;
  const creating = select.value === '';
  if (input.name === 'type') {
    select.innerHTML = categoryOptions(state, area, input.value, select.value) + '<option value="">+ Nova categoria</option>';
    if (creating) select.value = '';
  }
  const show = select.value === '';
  field.querySelector('[data-category-name]').hidden = !show;
  name.disabled = !show;
  name.required = show;
  name.placeholder = input.form.elements.type.value === 'expense' ? 'Ex.: Netflix, Cinema' : 'Ex.: Comissões, Aulas';
  if (show && input === select) name.focus();
}

export function categoryForRecord(state, area, fields) {
  if (!types.includes(fields.type)) throw new Error('Selecione o tipo do lançamento.');
  if (fields.category === '') {
    return addCustomCategory(state, { area, type: fields.type, name: fields.new_category });
  }
  if (!categoryNames(state, area, fields.type).includes(fields.category)) {
    throw new Error('Selecione uma categoria válida.');
  }
  return fields.category;
}
