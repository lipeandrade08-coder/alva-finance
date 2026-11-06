export const categories=['Alimentação','Moradia','Transporte','Saúde','Lazer','Compras','Educação','Assinaturas','Dívidas','Metas','Investimentos','Salário','Freelance','Outros'];
export const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((value||0)/100);
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dateISO=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function cents(value){const n=Number(String(value).trim().replace(/\s|R\$/g,'').replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));if(!Number.isFinite(n)||n<=0||n>1e10)throw new Error('Informe um valor válido, maior que zero.');return Math.round(n*100);}
export const numeric=c=>((c||0)/100).toFixed(2);
export function emptyData(name=''){return {profile:{name,monthly_budget:0,opening_balance:0},transactions:[],goals:[],debts:[],investments:[]};}
export function sampleData(){
 const state=emptyData('Camila Oliveira');const month=dateISO().slice(0,7);const day=n=>`${month}-${String(Math.min(n,new Date().getDate())).padStart(2,'0')}`;
 state.profile={name:'Camila Oliveira',monthly_budget:350000,opening_balance:184000};
 state.transactions=[
 {name:'Salário',category:'Salário',amount:650000,type:'income',date:day(1)},
 {name:'Aluguel',category:'Moradia',amount:120000,type:'expense',date:day(2)},
 {name:'Mercado da semana',category:'Alimentação',amount:35690,type:'expense',date:day(3)},
 {name:'Spotify Premium',category:'Assinaturas',amount:2190,type:'expense',date:day(3)},
 {name:'Uber',category:'Transporte',amount:2890,type:'expense',date:day(4)},
 {name:'Café com amigos',category:'Alimentação',amount:4850,type:'expense',date:day(5)},
 {name:'Academia',category:'Saúde',amount:12900,type:'expense',date:day(4)},
 {name:'Livraria',category:'Educação',amount:7380,type:'expense',date:day(5)},
 {name:'Almoço',category:'Alimentação',amount:6100,type:'expense',date:day(5)}
 ].map(x=>({...x,id:crypto.randomUUID()}));
 state.goals=[{id:crypto.randomUUID(),name:'Reserva de emergência',target:1500000,saved:600000,emoji:'🌱',deadline:`${new Date().getFullYear()+1}-06-30`},{id:crypto.randomUUID(),name:'Minha próxima viagem',target:500000,saved:225000,emoji:'✈️',deadline:`${new Date().getFullYear()+1}-03-15`}];
 state.debts=[{id:crypto.randomUUID(),name:'Cartão de crédito',total:480000,balance:240000,rate:7.5,due:`${month}-10`},{id:crypto.randomUUID(),name:'Notebook',total:360000,balance:180000,rate:0,due:`${month}-15`}];
 state.investments=[{id:crypto.randomUUID(),name:'Reserva em renda fixa',amount:600000,kind:'Renda fixa'},{id:crypto.randomUUID(),name:'Carteira de longo prazo',amount:220000,kind:'Fundos'}];return state;
}
export function totals(state,month){const list=state.transactions.filter(t=>t.date.startsWith(month));const sum=(items,type)=>items.filter(t=>t.type===type).reduce((a,t)=>a+t.amount,0);return {income:sum(list,'income'),expense:sum(list,'expense'),balance:state.profile.opening_balance+sum(state.transactions,'income')-sum(state.transactions,'expense'),saved:state.goals.reduce((a,g)=>a+g.saved,0),debt:state.debts.reduce((a,d)=>a+d.balance,0),invested:state.investments.reduce((a,i)=>a+i.amount,0),list};}
export function projection(initial,monthly,annual,years){const rate=Math.pow(1+annual/100,1/12)-1;const months=Math.round(years*12);let total=initial;const points=[total];for(let n=1;n<=months;n++){total=total*(1+rate)+monthly;if(n%12===0)points.push(total);}return {total:Math.round(total),contributed:initial+monthly*months,points};}
export function budgetBreakdown(state,month){const list=state.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(month));const sums={};for(const t of list)sums[t.category]=(sums[t.category]||0)+t.amount;return Object.entries(sums).sort((a,b)=>b[1]-a[1]);}
export function localAnswer(question,state,month){const q=question.toLowerCase();const t=totals(state,month);const intro='Análise automática da demonstração, baseada nos seus registros.\n\n';
 if(/gastei|gastos|gasto|despesa|resumo|saldo/.test(q)){const top=budgetBreakdown(state,month)[0];return intro+`Neste mês, você registrou ${money(t.income)} em entradas e ${money(t.expense)} em saídas. Seu saldo total registrado é ${money(t.balance)}.\n\n${top?`A maior categoria de gastos é ${top[0]}, com ${money(top[1])}. Abra os lançamentos dessa categoria para revisar os valores.`:'Registre suas despesas para descobrir onde seu dinheiro está indo.'}`;}
 if(/divida|dívida|quitar|pagar|cartão/.test(q)){const active=state.debts.filter(d=>d.balance>0).sort((a,b)=>b.rate-a.rate);const d=active[0];return intro+(d?`Suas dívidas registradas somam ${money(t.debt)}. A maior taxa informada é a de ${d.name}: ${d.rate}% ao mês, com ${money(d.balance)} em aberto.\n\nVocê pode simular priorizar essa dívida. Confira o CET e as condições de cada contrato antes de decidir. Ao usar “Registrar pagamento”, o valor será abatido da dívida e lançado como despesa.`:'Você não tem dívidas em aberto registradas. Cadastre uma dívida com saldo e taxa para organizar o plano.');}
 if(/meta|juntar|economizar|guardar|reserva|viagem/.test(q)){const g=state.goals.find(g=>g.saved<g.target);return intro+(g?`Você já guardou ${money(g.saved)} para ${g.name}, de um objetivo de ${money(g.target)}. Faltam ${money(Math.max(0,g.target-g.saved))}.\n\nDividindo o valor restante em 12 meses, o aporte seria de ${money(Math.ceil((g.target-g.saved)/12))} por mês, sem considerar rendimentos. Confira se esse valor cabe no seu orçamento antes de guardar.`:'Crie uma meta com valor e prazo. A Alva mostra o progresso e permite registrar cada aporte.');}
 if(/invest|rende|rendimento|aplicar/.test(q))return intro+`Você registrou ${money(t.invested)} em investimentos. Use o simulador para comparar um aporte mensal e uma taxa hipotética escolhida por você.\n\nA simulação é bruta, sem impostos, taxas ou inflação e não representa uma oferta nem uma previsão de rentabilidade. Defina objetivo, prazo, liquidez e tolerância a perdas antes de avaliar um investimento.`;
 return intro+'Posso calcular um resumo dos seus gastos, mostrar o progresso das metas, organizar as dívidas por taxa e simular aportes. Experimente “Quanto gastei este mês?” ou “Como está minha reserva?”.\n\nA conversa com IA será ativada quando o Supabase e o provedor de IA estiverem conectados.';
}
