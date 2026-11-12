const paths = {
  dashboard: '/pessoal',
  transactions: '/pessoal/lancamentos',
  goals: '/pessoal/objetivos',
  debts: '/pessoal/dividas',
  investments: '/pessoal/investimentos',
  assistant: '/assistente',
  notices: '/avisos',
  settings: '/perfil',
  business: '/negocio'
};

const details = {
  transactions: { income: 'entradas', expense: 'saidas' },
  business: {
    records: 'movimentacoes', cash: 'caixa', sales: 'vendas',
    pending: 'pendencias', receivable: 'a-receber', payable: 'a-pagar', taxes: 'tributos'
  }
};

export function pageHref(view, detail) {
  const root = Object.hasOwn(paths, view) ? paths[view] : paths.dashboard;
  const subpath = Object.hasOwn(details, view) && Object.hasOwn(details[view], detail)
    ? details[view][detail] : '';
  return '#' + root + (subpath ? '/' + subpath : '');
}

const pages = new Map();
for (const view of Object.keys(paths)) {
  pages.set(pageHref(view), { view });
  for (const detail of Object.keys(details[view] ?? {})) {
    pages.set(pageHref(view, detail), { view, detail });
  }
}

export function readPage(hash) {
  return pages.get(hash) ?? { view: 'dashboard' };
}
