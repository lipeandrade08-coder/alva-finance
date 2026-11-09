import {dateISO,money} from './finance.js';
export const businessCategories=['Serviços','Produtos','Materiais','Fornecedores','Aluguel','Marketing','Transporte','Ferramentas','Impostos','Outros'];
export function emptyBusiness(){return {profile:{name:'',kind:'MEI',cnpj:'',opening_balance:0,annual_goal:0},records:[],taxes:[]};}
export function sampleBusiness(){const b=emptyBusiness(),m=dateISO().slice(0,7),day=n=>`${m}-${String(Math.min(n,new Date().getDate())).padStart(2,'0')}`;b.profile={name:'Estúdio Camila',kind:'MEI',cnpj:'',opening_balance:150000,annual_goal:6000000};b.records=[
{name:'Identidade visual',category:'Serviços',type:'income',amount:240000,date:day(2),due_date:day(2),status:'paid',paid_date:day(2),counterparty:'Cliente exemplo'},
{name:'Pacote de conteúdo',category:'Serviços',type:'income',amount:180000,date:day(3),due_date:`${m}-12`,status:'pending',paid_date:null,counterparty:'Cliente exemplo'},
{name:'Materiais de produção',category:'Materiais',type:'expense',amount:38000,date:day(3),due_date:day(3),status:'paid',paid_date:day(3),counterparty:'Fornecedor exemplo'},
{name:'Assinatura de software',category:'Ferramentas',type:'expense',amount:14900,date:day(4),due_date:`${m}-15`,status:'pending',paid_date:null,counterparty:''}
].map(r=>({...r,id:crypto.randomUUID()}));return b;}
export function ensureBusiness(data,demo=false){if(!data.business)data.business=demo?sampleBusiness():emptyBusiness();return data.business;}
export function businessTotals(b, month) {
 const sum = list => list.reduce((total, record) => total + record.amount, 0);
 const initialBalance = Number(b.profile.opening_balance) || 0;
 const monthStart = month + '-01';
 let balance = initialBalance;
 let openingBalance = initialBalance;
 let received = 0;
 let spent = 0;
 let withdrawals = 0;
 for (const record of b.records) {
  if (record.status !== 'paid') continue;
  const paidDate = record.paid_date || record.date;
  const delta = record.type === 'income' ? record.amount : -record.amount;
  balance += delta;
  if (paidDate && paidDate < monthStart) openingBalance += delta;
  if (!paidDate?.startsWith(month)) continue;
  if (record.type === 'income') received += record.amount;
  if (record.type === 'expense') spent += record.amount;
  if (record.linked_type === 'withdrawal') withdrawals += record.amount;
 }
 const sales = b.records.filter(record => record.type === 'income' && !record.linked && record.counts_as_sale !== false);
 const receivable = b.records.filter(record => record.type === 'income' && record.status === 'pending');
 const payable = b.records.filter(record => record.type === 'expense' && record.status === 'pending');
 const outstandingTaxes = b.taxes.filter(tax => !tax.paid);
 return {
  balance, closingBalance: openingBalance + received - spent,
  revenue: sum(sales.filter(record => record.date.startsWith(month))),
  annualRevenue: sum(sales.filter(record => record.date.startsWith(month.slice(0, 4)))),
  received, spent, cashResult: received - spent,
  receivable: sum(receivable), payable: sum(payable) + sum(outstandingTaxes),
  withdrawals, receivableCount: receivable.length, payableCount: payable.length + outstandingTaxes.length
 };
}
export function addBusinessRecord(state,record){const b=ensureBusiness(state);if(!record.name?.trim()||!Number.isSafeInteger(record.amount)||record.amount<=0)throw new Error('Informe uma descrição e um valor válido.');if(!['income','expense'].includes(record.type)||!['paid','pending'].includes(record.status))throw new Error('Tipo ou situação inválidos.');b.records.push({...record,id:crypto.randomUUID(),name:record.name.trim(),paid_date:record.status==='paid'?record.paid_date||record.date:null});}
export function settleBusinessRecord(state,id,paidDate){const record=ensureBusiness(state).records.find(r=>r.id===id);if(!record)throw new Error('Lançamento não encontrado.');if(record.status==='paid')throw new Error('Este lançamento já foi baixado.');record.status='paid';record.paid_date=paidDate;}
export function addBusinessTax(state,tax){const b=ensureBusiness(state);if(b.taxes.some(t=>t.name.toLowerCase()===tax.name.toLowerCase()&&t.competence===tax.competence))throw new Error('Já existe um tributo com esse nome nesta competência.');if(!Number.isSafeInteger(tax.amount)||tax.amount<=0)throw new Error('Informe o valor do documento.');b.taxes.push({...tax,id:crypto.randomUUID(),paid:false,paid_date:null});}
export function payBusinessTax(state,id,paidDate){const b=ensureBusiness(state),tax=b.taxes.find(t=>t.id===id);if(!tax)throw new Error('Tributo não encontrado.');if(tax.paid)throw new Error('O pagamento já foi registrado.');tax.paid=true;tax.paid_date=paidDate;b.records.push({id:crypto.randomUUID(),name:`${tax.name} · ${tax.competence}`,amount:tax.amount,type:'expense',category:'Impostos',date:paidDate,due_date:tax.due_date,status:'paid',paid_date:paidDate,counterparty:'',linked:id,linked_type:'tax'});}
export function ownerWithdrawal(state,amount,date){if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Informe um valor válido.');const b=ensureBusiness(state),id=crypto.randomUUID();b.records.push({id,name:'Retirada para o titular',amount,type:'expense',category:'Retirada do titular',date,due_date:date,status:'paid',paid_date:date,counterparty:state.profile.name,linked:id,linked_type:'withdrawal'});state.transactions.push({id:crypto.randomUUID(),name:`Retirada: ${b.profile.name||'Meu negócio'}`,amount,type:'income',category:'Renda do negócio',date,linked:id});}
export function businessAnswer(question,state,month){if(!/(neg[oó]cio|empresa|mei|faturamento|cliente|fornecedor|das\b|capital de giro)/i.test(question))return null;const b=ensureBusiness(state),t=businessTotals(b,month);return `Análise automática do negócio, baseada nos registros.\n\n${b.profile.name||'Meu negócio'} tem ${money(t.balance)} de caixa registrado. No mês selecionado, as vendas lançadas somam ${money(t.revenue)} e os recebimentos somam ${money(t.received)}.\n\nHá ${money(t.receivable)} a receber e ${money(t.payable)} a pagar, considerando todas as pendências cadastradas. Confira os vencimentos em Meu negócio para organizar o caixa.\n\nO resumo é gerencial. Tributos são informados por você; a Alva não calcula enquadramento fiscal nem emite guias.`;}
export function businessCSV(b,month){const list=b.records.filter(r=>r.date.startsWith(month));const rows=[['Descrição','Tipo','Categoria','Cliente/fornecedor','Data do registro','Vencimento','Situação','Data da baixa','Valor (R$)'],...list.map(r=>[r.name,r.type==='income'?'Receita':'Despesa',r.category,r.counterparty||'',r.date,r.due_date,r.status==='paid'?'Baixado':'Pendente',r.paid_date||'',(r.type==='income'?1:-1)*r.amount/100])];const cell=v=>typeof v==='number'?String(v).replace('.',','):'"'+String(v).replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';return '\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n');}
