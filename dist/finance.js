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
 state.debts=[{id:crypto.randomUUID(),name:'Cartão de crédito',total:480000,balance:240000,installments:6,due:`${month}-10`},{id:crypto.randomUUID(),name:'Notebook',total:360000,balance:180000,installments:10,due:`${month}-15`}];
 state.investments=[{id:crypto.randomUUID(),name:'Reserva em renda fixa',amount:600000,kind:'Renda fixa'},{id:crypto.randomUUID(),name:'Carteira de longo prazo',amount:220000,kind:'Fundos'}];return state;
}
export function totals(state,month){const list=state.transactions.filter(t=>t.date.startsWith(month));const sum=(items,type)=>items.filter(t=>t.type===type).reduce((a,t)=>a+t.amount,0);return {income:sum(list,'income'),expense:sum(list,'expense'),balance:state.profile.opening_balance+sum(state.transactions,'income')-sum(state.transactions,'expense'),saved:state.goals.reduce((a,g)=>a+g.saved,0),debt:state.debts.reduce((a,d)=>a+d.balance,0),invested:state.investments.reduce((a,i)=>a+i.amount,0),list};}
export function projection(initial,monthly,annual,years){const rate=Math.pow(1+annual/100,1/12)-1;const months=Math.round(years*12);let total=initial;const points=[total];for(let n=1;n<=months;n++){total=total*(1+rate)+monthly;if(n%12===0)points.push(total);}return {total:Math.round(total),contributed:initial+monthly*months,points};}
export function budgetBreakdown(state,month){const list=state.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(month));const sums={};for(const t of list)sums[t.category]=(sums[t.category]||0)+t.amount;return Object.entries(sums).sort((a,b)=>b[1]-a[1]);}
export function localAnswer(question,state,month){
 const q=String(question||'').toLowerCase().trim();
 const t=totals(state,month),byCat=budgetBreakdown(state,month),top=byCat[0];
 const activeDebts=state.debts.filter(d=>d.balance>0).sort((a,b)=>a.due.localeCompare(b.due));
 const activeGoals=state.goals.filter(g=>g.saved<g.target);
 if(/^(oi|ol[aá]|bom dia|boa tarde|boa noite|e a[ií]|tudo bem)\b/.test(q)){
  return `Olá! 🌿 Seu saldo disponível atual é ${money(t.balance)}. Neste mês você tem ${money(t.income)} em entradas e ${money(t.expense)} em saídas.\n\nVocê pode me pedir para:\n• Lançar gastos ou receitas (ex.: "Gastei 85 no mercado" ou "Recebi 3000 de salário")\n• Cadastrar ou excluir dívidas e metas (ex.: "Dívida cartão 1200 em 6x" ou "Criar meta viagem 5000")\n• Ou clicar em Anexar para importar sua planilha (.xlsx, .csv, .ofx) e atualizar todo o painel automaticamente!`;
 }
 if(/maior(?:es)?\s+gasto|onde\s+gastei|categoria|para\s+onde\s+vai/.test(q)){
  if(!byCat.length)return `Você ainda não tem saídas registradas neste mês (${month}). Quando registrar ou importar sua planilha, mostro aqui o ranking completo por categoria.`;
  const list=byCat.slice(0,5).map(([cat,val],i)=>`${i+1}. ${cat}: ${money(val)} (${Math.round(val/Math.max(1,t.expense)*100)}%)`).join('\n');
  return `Aqui estão suas maiores categorias de saída neste mês (total de ${money(t.expense)}):\n\n${list}\n\nSeu saldo disponível total é ${money(t.balance)}.`;
 }
 if(/gastei|gastos|gasto|despesa|resumo|saldo|sobrou|quanto\s+tenho|extrato/.test(q)){
  const net=t.income-t.expense;
  return `Resumo do seu mês (${month}):\n• Entradas no mês: ${money(t.income)}\n• Saídas no mês: ${money(t.expense)}\n• Balanço do mês: ${net>=0?'+':'−'}${money(Math.abs(net))}\n• Saldo disponível total: ${money(t.balance)}\n\n${top?`A categoria com maior saída é ${top[0]} (${money(top[1])}).`:'Nenhuma saída registrada neste mês.'}`;
 }
 if(/divida|dívida|quitar|pagar|cartão|parcela|devo/.test(q)){
  if(!activeDebts.length)return 'Você não tem dívidas em aberto no momento! 🌱 Se quiser cadastrar alguma, diga por exemplo: "Adicionar dívida Cartão 1200 em 6x" ou anexe sua planilha.';
  const lines=activeDebts.slice(0,5).map(d=>{const c=Math.max(1,Number(d.installments)||1);return `• ${d.name}: ${money(d.balance)} em aberto (${c}x de ${money(Math.round(d.total/c))}, venc. ${new Date(d.due+'T12:00:00').toLocaleDateString('pt-BR')})`;}).join('\n');
  return `Você tem ${activeDebts.length} ${activeDebts.length===1?'dívida em aberto':'dívidas em aberto'}, somando ${money(t.debt)}:\n\n${lines}\n\nVocê pode registrar pagamentos ou excluir uma dívida na aba Minhas dívidas (ou me pedir: "Excluir dívida ${activeDebts[0].name}").`;
 }
 if(/meta|juntar|economizar|guardar|reserva|viagem|objetivo|sonho/.test(q)){
  if(!state.goals.length)return 'Você ainda não cadastrou objetivos. Diga por exemplo "Criar meta Reserva de emergência de 10000" ou clique em Meus objetivos.';
  const lines=state.goals.map(g=>`• ${g.emoji||'🌱'} ${g.name}: ${money(g.saved)} de ${money(g.target)} (${Math.min(100,Math.round(g.saved/Math.max(1,g.target)*100))}%)`).join('\n');
  const nextGoal=activeGoals[0];
  return `Seus objetivos somam ${money(t.saved)} guardados:\n\n${lines}${nextGoal?`\n\nPara concluir "${nextGoal.name}", faltam ${money(nextGoal.target-nextGoal.saved)} (ou ${money(Math.ceil((nextGoal.target-nextGoal.saved)/12))}/mês em 1 ano).`:''}`;
 }
 if(/invest|rende|rendimento|aplicar|patrim[oô]nio/.test(q)){
  const lines=state.investments.map(i=>`• ${i.name} (${i.kind}): ${money(i.amount)}`).join('\n');
  return `Você tem ${money(t.invested)} aplicados em investimentos${lines?':\n\n'+lines:'.'}\n\nPara registrar um novo aporte pelo chat, diga por exemplo: "Investi 500 em Renda fixa".`;
 }
 if(/dica|organizar|ajuda|planejar|analis|como\s+estou|diagn[oó]stico/.test(q)){
  const net=t.income-t.expense;
  const tips=[];
  if(t.expense>t.income&&t.income>0)tips.push(`• Suas saídas (${money(t.expense)}) superaram as entradas (${money(t.income)}) neste mês. Revise a categoria ${top?top[0]:'principal'}.`);
  else if(t.income>0)tips.push(`• Você está com saldo positivo de ${money(net)} no mês (${Math.round(net/t.income*100)}% das entradas preservadas).`);
  if(t.debt>0)tips.push(`• Você possui ${money(t.debt)} em dívidas abertas. Priorize quitar as parcelas em dia.`);
  if(activeGoals.length)tips.push(`• Separe uma parte do saldo para o objetivo "${activeGoals[0].name}" (faltam ${money(activeGoals[0].target-activeGoals[0].saved)}).`);
  if(!tips.length)tips.push('• Comece registrando suas receitas e despesas ou anexe sua planilha financeira no botão Anexar.');
  return `Diagnóstico rápido da sua conta:\n• Saldo disponível: ${money(t.balance)}\n• Guardado em metas: ${money(t.saved)} | Investido: ${money(t.invested)}\n• Dívidas em aberto: ${money(t.debt)}\n\nRecomendações:\n${tips.join('\n')}`;
 }
 if(/planilha|importar|anexar|documento|arquivo|extrato|migrar/.test(q)){
  return `Para migrar sua planilha ou extrato automaticamente:\n1. Clique no botão Anexar (clipe ao lado da mensagem) ou em Importar planilha no topo da tela.\n2. Escolha seu arquivo Excel (.xlsx), CSV (.csv), extrato (.ofx) ou texto (.txt).\n3. Eu reconheço todas as colunas (Data, Descrição, Categoria, Valor, Parcelas) e atualizo o seu painel e gráficos na hora!`;
 }
 return `Aqui está o panorama atual da sua conta (${month}):\n• Saldo disponível: ${money(t.balance)}\n• Entradas no mês: ${money(t.income)} | Saídas: ${money(t.expense)}\n• Objetivos: ${money(t.saved)} | Dívidas: ${money(t.debt)} | Investimentos: ${money(t.invested)}\n\nSe quiser que eu lance algo agora, basta escrever por exemplo:\n• "Gastei 85 no mercado"\n• "Recebi 3500 de salário"\n• "Dívida cartão 1200 em 6x"\n• "Criar meta viagem 5000"\nOu clique em Anexar para enviar sua planilha!`;
}
export function inferCategory(name,type='expense'){
 const s=String(name||'').toLowerCase();
 if(type==='income'){if(/sal[aá]rio|pagamento|holerite|adiantamento|13|pro-labore|pr[oó]-labore/.test(s))return 'Salário';if(/freela|projeto|servi[cç]o|consultoria|cliente|pix recebido|venda|honor[aá]rio/.test(s))return 'Freelance';if(/rendimento|dividendo|resgate|cdb|tesouro|juros/.test(s))return 'Investimentos';return 'Outros';}
 if(/mercado|supermercado|extra|carrefour|assai|atacad[aã]o|p[aã]o de a[cç][uú]car|ifood|restaurante|padaria|lanche|caf[eé]|almo[cç]o|jantar|feira|a[cç]ougue|hortifruti|pizza|burger|alimenta/.test(s))return 'Alimentação';
 if(/aluguel|condom[ií]nio|luz|energia|enel|cemig|copel|sabesp|[aá]gua|saneamento|internet|vivo|claro|tim|oi|g[aá]s|iptu|moradia|casa|reforma|m[oó]veis/.test(s))return 'Moradia';
 if(/uber|99|t[aá]xi|combust[ií]vel|gasolina|etanol|posto|ipiranga|shell|br|estacionamento|ped[aá]gio|sem parar|veloe|metr[oô]|ônibus|onibus|passagem|transporte|ipva|oficina|mec[aâ]nico| seguro auto/.test(s))return 'Transporte';
 if(/farm[aá]cia|drogaria|droga raia|drogasil|pague menos|m[eé]dico|consulta|exame|academia|smartfit|plano de sa[uú]de|unimed|amil|bradesco sa[uú]de|dentista|psic[oó]log|terapia|hospital|sa[uú]de/.test(s))return 'Saúde';
 if(/cinema|viagem|hotel|airbnb|bar|show|passeio|ingresso|lazer|festa|jogo|steam|playstation|xbox|parque/.test(s))return 'Lazer';
 if(/spotify|netflix|amazon|prime|disney|hbo|max|globoplay|youtube|icloud|google one|chatgpt|assinatura|mensalidade|clube/.test(s))return 'Assinaturas';
 if(/curso|faculdade|escola|col[eé]gio|livro|livraria|educa[cç][aã]o|udemy|alura|idioma|ingl[eê]s|mensalidade escolar|material/.test(s))return 'Educação';
 if(/cart[aã]o|fatura|nubank|ita[uú]|bradesco|inter|santander|c6|empr[eé]stimo|financiamento|parcela|d[ií]vida|acordo|juros|cons[oó]rcio/.test(s))return 'Dívidas';
 if(/meta|reserva|objetivo|poupan[cç]a|sonho|caixinha/.test(s))return 'Metas';
 if(/investimento|cdb|tesouro|selic|ipca|fundo|a[cç][oõ]es|fii|aporte|corretora|xp|btg|nuinvest/.test(s))return 'Investimentos';
 if(/roupa|renner|riachuelo|c&a|zara|loja|shopping|mercado livre|shopee|shein|magalu|amazon|compra|presente|eletr[oô]nico|celular|notebook/.test(s))return 'Compras';
 return 'Outros';
}
const normStr=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
function isExcelSerialDate(v){
 const s=String(v??'').trim();
 if(!/^\d{5}(?:\.\d+)?$/.test(s))return false;
 const n=Number(s);return n>=36526&&n<=60000;
}
function excelSerialToISO(n){
 const days=Math.floor(Number(n));
 const dt=new Date(Math.round((days-25569)*86400*1000)+43200000);
 return dateISO(dt);
}
function isDateLikeCell(raw){
 const s=String(raw??'').trim();if(!s)return false;
 if(/^\d{4}-\d{2}-\d{2}(?:[T\s].*)?$/.test(s))return true;
 if(/^\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?$/.test(s))return true;
 return false;
}
export function parseFlexDate(raw,fallback=dateISO()){
 if(raw instanceof Date&&!isNaN(raw))return dateISO(raw);
 const s=String(raw??'').trim();if(!s)return fallback;
 if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const br=s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/);
 if(br){
  let d=Number(br[1]),m=Number(br[2]),y=br[3]?Number(br[3]):Number(fallback.slice(0,4)||new Date().getFullYear());
  if(y<100)y+=2000;
  if(m>12&&d<=12)[d,m]=[m,d];
  if(m>=1&&m<=12&&d>=1&&d<=31)return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 }
 const ofx=s.match(/^(\d{4})(\d{2})(\d{2})/);if(ofx)return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
 if(isExcelSerialDate(s))return excelSerialToISO(Number(s));
 return fallback;
}
export function parseFlexAmount(raw){
 if(typeof raw==='number')return Number.isFinite(raw)&&raw!==0?Math.round(raw*100):0;
 let s=String(raw??'').trim();if(!s)return 0;
 if(isDateLikeCell(s))return 0;
 const neg=/^\s*-|\(.*\)|-\s*R\$|\b(d[eé]bito|sa[ií]da|despesa)\b/i.test(s)&&!/\b(entrada|receita|cr[eé]dito)\b/i.test(s);
 s=s.replace(/[^\d.,-]/g,'').replace(/^-+/,'');if(!s)return 0;
 if(s.includes(',')&&s.includes('.')){
  if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
 }else if(s.includes(',')){
  const parts=s.split(',');
  if(parts.length===2&&parts[1].length===3&&parts[0].length<=3)s=s.replace(',','');
  else s=s.replace(',','.');
 }
 const n=Number(s);if(!Number.isFinite(n)||n===0||Math.abs(n)>1e8)return 0;
 return Math.round(Math.abs(n)*100)*(neg?-1:1);
}
function splitCSVLine(line,sep){
 const out=[];let cur='',inQuotes=false;
 for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQuotes&&line[i+1]==='"'){cur+='"';i++;}else inQuotes=!inQuotes;}else if(ch===sep&&!inQuotes){out.push(cur.trim());cur='';}else cur+=ch;}
 out.push(cur.trim());return out;
}
function parseTableRows(rows,result,sheetHint=''){
 if(!rows?.length)return;
 let colMap=null;
 const hintNorm=normStr(sheetHint);
 for(let r=0;r<rows.length;r++){
  const row=rows[r].map(c=>String(c??'').trim());
  const nonEmpty=row.filter(Boolean);
  if(nonEmpty.length<2)continue;
  const headers=row.map(normStr);
  const descIdx=headers.findIndex(h=>/\b(descricao|historico|nome|titulo|lancamento|item|estabelecimento|divida|meta|objetivo|investimento|conta|gasto|despesa|receita|origem|referencia|detalhe|credor|fornecedor|cliente)\b/.test(h));
  const valIdx=headers.findIndex(h=>/\b(valor|quantia|total|saldo|montante|preco|entrada|saida|amount|meta|alvo|parcela|aplicado|aberto)\b/.test(h));
  if(descIdx>=0&&valIdx>=0&&descIdx!==valIdx&&!row.some(c=>isDateLikeCell(c))){
   colMap={
    name:descIdx,
    amount:headers.findIndex((h,i)=>i!==descIdx&&/\b(valor|quantia|montante|preco|amount|valor pago|valor aplicado)\b/.test(h)),
    incomeCol:headers.findIndex(h=>/\b(entrada|entradas|receita|receitas|credito|ganho)\b/.test(h)),
    expenseCol:headers.findIndex(h=>/\b(saida|saidas|despesa|despesas|debito|gasto|gastos)\b/.test(h)),
    total:headers.findIndex((h,i)=>i!==descIdx&&/\b(total|valor total|meta|alvo|objetivo)\b/.test(h)),
    balance:headers.findIndex((h,i)=>i!==descIdx&&/\b(saldo|aberto|restante|devedor)\b/.test(h)),
    saved:headers.findIndex((h,i)=>i!==descIdx&&/\b(guardado|acumulado|ja pago|pago)\b/.test(h)),
    type:headers.findIndex(h=>/\b(tipo|natureza|movimentacao|fluxo|operacao|status)\b/.test(h)),
    category:headers.findIndex(h=>/\b(categoria|classificacao|grupo|setor|area)\b/.test(h)),
    date:headers.findIndex(h=>/\b(data|dt|dia|competencia|emissao|compra)\b/.test(h)),
    due:headers.findIndex(h=>/\b(vencimento|prazo|ate|limite)\b/.test(h)),
    installments:headers.findIndex(h=>/\b(parcela|parcelas|qtd|vezes)\b/.test(h)),
    section:/divida|devedor|emprestimo/.test(hintNorm)||headers.some(h=>/\b(divida|parcelas|saldo devedor)\b/.test(h))&&!headers.some(h=>/\b(entrada|receita)\b/.test(h))?'debt':/meta|objetivo/.test(hintNorm)||headers.some(h=>/\b(meta|objetivo|valor alvo|guardado)\b/.test(h))?'goal':/investimento/.test(hintNorm)||headers.some(h=>/\b(investimento|valor aplicado|modalidade)\b/.test(h))?'investment':'transaction'
   };
   if(colMap.amount<0)colMap.amount=valIdx;
   continue;
  }
  if(colMap){
   const get=idx=>idx>=0&&idx<row.length?row[idx]:'';
   let name=get(colMap.name);
   if(!name){
    name=row.find((c,i)=>i!==colMap.amount&&i!==colMap.date&&i!==colMap.category&&c&&!isDateLikeCell(c)&&!isExcelSerialDate(c)&&parseFlexAmount(c)===0)||'';
   }
   name=String(name||'').trim().slice(0,100);
   if(!name||/^(total|subtotal|soma|saldo anterior|saldo final|resumo)$/i.test(normStr(name)))continue;
   const typeCell=normStr(get(colMap.type)),catCell=String(get(colMap.category)||'').trim();
   const kind=/\b(divida|emprestimo|financiamento)\b/.test(typeCell)||(colMap.section==='debt'&&colMap.installments>=0)?'debt':/\b(meta|objetivo|reserva)\b/.test(typeCell)||colMap.section==='goal'?'goal':/\b(investimento|aplicacao|renda fixa|fundo|acoes)\b/.test(typeCell)||colMap.section==='investment'?'investment':'transaction';
   const rawDate=get(colMap.date)||get(colMap.due);
   const dt=parseFlexDate(rawDate);
   if(kind==='debt'){
    const bal=Math.abs(parseFlexAmount(get(colMap.balance)||get(colMap.amount)||get(colMap.total)));
    const tot=Math.abs(parseFlexAmount(get(colMap.total)||get(colMap.amount)))||bal;
    if(bal>0||tot>0){
     const inst=Math.max(1,Math.min(360,Math.round(Number(String(get(colMap.installments)||'1').replace(/\D/g,''))||1)));
     result.debts.push({id:crypto.randomUUID(),name:name.slice(0,80),total:Math.max(tot,bal),balance:bal||tot,installments:inst,due:parseFlexDate(get(colMap.due)||rawDate)});
    }
    continue;
   }
   if(kind==='goal'){
    const target=Math.abs(parseFlexAmount(get(colMap.total)||get(colMap.amount)));
    const saved=Math.abs(parseFlexAmount(get(colMap.saved)));
    if(target>0)result.goals.push({id:crypto.randomUUID(),name:name.slice(0,80),target,saved:Math.min(target,saved),emoji:'🌱',deadline:parseFlexDate(get(colMap.due)||rawDate,'')});
    continue;
   }
   if(kind==='investment'){
    const amt=Math.abs(parseFlexAmount(get(colMap.amount)||get(colMap.total)||get(colMap.balance)));
    if(amt>0)result.investments.push({id:crypto.randomUUID(),name:name.slice(0,80),amount:amt,kind:catCell||'Renda fixa'});
    continue;
   }
   let signed=0,explicitType='';
   if(colMap.incomeCol>=0&&colMap.expenseCol>=0&&colMap.incomeCol!==colMap.expenseCol){
    const inc=Math.abs(parseFlexAmount(get(colMap.incomeCol))),exp=Math.abs(parseFlexAmount(get(colMap.expenseCol)));
    if(inc>0){signed=inc;explicitType='income';}else if(exp>0){signed=-exp;explicitType='expense';}
   }
   if(!signed){
    const candidate=get(colMap.amount)||get(colMap.total)||get(colMap.balance)||row.find((c,i)=>i!==colMap.name&&i!==colMap.date&&i!==colMap.category&&!isExcelSerialDate(c)&&parseFlexAmount(c)!==0)||'';
    signed=parseFlexAmount(candidate);
   }
   if(!signed)continue;
   let type=explicitType||(signed<0?'expense':'income');
   if(/\b(saida|despesa|debito|pagamento|gasto|compra)\b/.test(typeCell))type='expense';
   else if(/\b(entrada|receita|credito|ganho|salario|venda)\b/.test(typeCell))type='income';
   else if(!explicitType&&signed>0&&colMap.type<0){
    const isIncName=/\b(sal[aá]rio|freela|recebimento|dep[oó]sito|pix recebido|renda|pro-labore|pr[oó]-labore|venda|reembolso|dividendo)\b/i.test(name)||/\b(sal[aá]rio|freelance|receita|entrada)\b/i.test(catCell);
    if(!isIncName)type='expense';
   }
   const matchedCat=categories.find(c=>normStr(c)===normStr(catCell))||inferCategory(name,type);
   result.transactions.push({id:crypto.randomUUID(),name,amount:Math.abs(signed),type,category:matchedCat,date:dt});
  }else{
   // Row without detected header yet: inspect cells structurally
   let dt=dateISO(),hasDate=false,signed=0,catMatch='',texts=[];
   for(const cell of row){
    if(!cell)continue;
    if(!hasDate&&(isDateLikeCell(cell)||isExcelSerialDate(cell))){dt=parseFlexDate(cell);hasDate=true;continue;}
    const foundCat=categories.find(c=>normStr(c)===normStr(cell));
    if(foundCat&&!catMatch){catMatch=foundCat;continue;}
    const val=parseFlexAmount(cell);
    if(val!==0&&!isExcelSerialDate(cell)&&signed===0){signed=val;continue;}
    if(!/^(pix|boleto|cr[eé]dito|d[eé]bito|dinheiro|transfer[eê]ncia|pago|pendente)$/i.test(cell))texts.push(cell);
   }
   if(!signed&&row.length===1){
    const line=row[0];
    const dtM=line.match(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/);
    if(dtM)dt=parseFlexDate(dtM[1]);
    const withoutDate=dtM?line.replace(dtM[0],' '):line;
    const numM=[...withoutDate.matchAll(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|(?:R\$\s*)?-?\d+(?:[.,]\d{1,2})\b/g)];
    const valStr=numM.at(-1)?.[0];
    signed=parseFlexAmount(valStr);
    if(signed){
     const clean=withoutDate.replace(valStr,'').replace(/\b\d{1,3}\s*(?:x|parcelas?)\b/gi,'').replace(/R\$|[;|\t]+|^[\s,:-]+|[\s,:-]+$/g,' ').replace(/\s+/g,' ').trim();
     if(clean)texts=[clean];
    }
   }
   if(!signed||!texts.length)continue;
   const fullText=row.join(' ');
   const name=texts[0].slice(0,100);
   if(/^(total|subtotal|soma|saldo)$/i.test(normStr(name)))continue;
   const instMatch=fullText.match(/\b(\d{1,3})\s*(?:x|parcelas?)\b/i);
   if(/\b(d[ií]vida|empr[eé]stimo|financiamento)\b/i.test(fullText)||instMatch){
    const inst=instMatch?Math.max(1,Math.min(360,Number(instMatch[1]))):1;
    result.debts.push({id:crypto.randomUUID(),name:name.replace(/^(d[ií]vida|parcelamento)\s*:?\s*/i,'').slice(0,80)||'Dívida importada',total:Math.abs(signed),balance:Math.abs(signed),installments:inst,due:dt});
   }else if(/\b(meta|objetivo|reserva)\b/i.test(fullText)){
    result.goals.push({id:crypto.randomUUID(),name:name.replace(/^(meta|objetivo)\s*:?\s*/i,'').slice(0,80)||'Objetivo importado',target:Math.abs(signed),saved:0,emoji:'🌱',deadline:''});
   }else{
    const isInc=/\b(sal[aá]rio|receita|entrada|recebi|freela|dep[oó]sito|rendimento)\b/i.test(fullText)&&signed>0;
    const type=signed<0||!isInc?'expense':'income';
    result.transactions.push({id:crypto.randomUUID(),name,amount:Math.abs(signed),type,category:catMatch||inferCategory(name,type),date:dt});
   }
  }
 }
}
export function parseDocumentContent(text,fileName=''){
 const result={transactions:[],debts:[],goals:[],investments:[],profile:{}};
 const raw=String(text??'').replace(/^\uFEFF/,'').trim();if(!raw)return result;
 if(raw.startsWith('{')||raw.startsWith('[')){
  try{
   const j=JSON.parse(raw);const items=Array.isArray(j)?j:j.transactions||[];
   if(j.profile?.name)result.profile.name=String(j.profile.name).slice(0,70);
   if(Array.isArray(j.debts))for(const d of j.debts){const total=Math.abs(parseFlexAmount(d.total??d.balance??d.amount))||(Number.isInteger(d.total)?d.total:0);const balance=Math.abs(parseFlexAmount(d.balance??d.total??d.amount))||(Number.isInteger(d.balance)?d.balance:total);if(total>0&&d.name)result.debts.push({id:crypto.randomUUID(),name:String(d.name).trim().slice(0,80),total:Math.max(total,balance),balance,installments:Math.max(1,Math.min(360,Math.round(Number(d.installments||d.parcelas)||1))),due:parseFlexDate(d.due||d.vencimento)});}
   if(Array.isArray(j.goals))for(const g of j.goals){const target=Math.abs(parseFlexAmount(g.target??g.amount))||(Number.isInteger(g.target)?g.target:0);const saved=Math.abs(parseFlexAmount(g.saved))||(Number.isInteger(g.saved)?g.saved:0);if(target>0&&g.name)result.goals.push({id:crypto.randomUUID(),name:String(g.name).trim().slice(0,80),target,saved:Math.min(target,saved),emoji:String(g.emoji||'🌱').slice(0,10),deadline:parseFlexDate(g.deadline||'')});}
   if(Array.isArray(j.investments))for(const i of j.investments){const amount=Math.abs(parseFlexAmount(i.amount))||(Number.isInteger(i.amount)?i.amount:0);if(amount>0&&i.name)result.investments.push({id:crypto.randomUUID(),name:String(i.name).trim().slice(0,80),amount,kind:String(i.kind||i.category||'Renda fixa').slice(0,40)});}
   for(const t of items){const rawAmt=Number.isInteger(t.amount)&&t.type?t.amount*(t.type==='expense'?-1:1):parseFlexAmount(t.amount??t.valor);const amount=Math.abs(rawAmt);if(amount>0&&(t.name||t.descricao)){const type=t.type==='income'||t.type==='expense'?t.type:rawAmt<0?'expense':'income';const name=String(t.name||t.descricao).trim().slice(0,100);const cat=categories.includes(t.category)?t.category:inferCategory(name,type);result.transactions.push({id:crypto.randomUUID(),name,amount,type,category:cat,date:parseFlexDate(t.date||t.data)});}}
   return result;
  }catch{}
 }
 if(/<STMTTRN>/i.test(raw)){
  const blocks=raw.split(/<STMTTRN>/i).slice(1);
  for(const b of blocks){
   const amtMatch=b.match(/<TRNAMT>([^\r\n<]+)/i),dtMatch=b.match(/<DTPOSTED>([^\r\n<]+)/i),memoMatch=b.match(/<(?:MEMO|NAME)>([^\r\n<]+)/i);
   const signed=parseFlexAmount(amtMatch?.[1]);if(!signed)continue;
   const type=signed<0?'expense':'income',amount=Math.abs(signed),name=String(memoMatch?.[1]||'Movimentação bancária').trim().slice(0,100);
   result.transactions.push({id:crypto.randomUUID(),name,amount,type,category:inferCategory(name,type),date:parseFlexDate(dtMatch?.[1])});
  }
  return result;
 }
 const lines=raw.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(!lines.length)return result;
 const sample=lines.slice(0,Math.min(10,lines.length)).join('\n');
 const sep=[';','\t',',','|'].sort((a,b)=>(sample.split(b).length-1)-(sample.split(a).length-1))[0];
 const hasDelimiter=(sample.split(sep).length-1)>=lines.slice(0,Math.min(5,lines.length)).length;
 const rows=lines.map(l=>hasDelimiter?splitCSVLine(l,sep):[l]);
 parseTableRows(rows,result,fileName);
 return result;
}
export async function parseXlsxBuffer(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const files={};let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw new Error('Arquivo Excel (.xlsx) inválido.');
 const cdCount=view.getUint16(eocd+10,true),cdOffset=view.getUint32(eocd+16,true);
 let pos=cdOffset;const dec=new TextDecoder();
 for(let i=0;i<cdCount&&pos+46<=bytes.length;i++){
  if(view.getUint32(pos,true)!==0x02014b50)break;
  const method=view.getUint16(pos+10,true),compSize=view.getUint32(pos+20,true),nameLen=view.getUint16(pos+28,true),extraLen=view.getUint16(pos+30,true),commentLen=view.getUint16(pos+32,true),localOffset=view.getUint32(pos+42,true);
  const name=dec.decode(bytes.subarray(pos+46,pos+46+nameLen));
  pos+=46+nameLen+extraLen+commentLen;
  if(!/^xl\/(sharedStrings\.xml|styles\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(name))continue;
  const lNameLen=view.getUint16(localOffset+26,true),lExtraLen=view.getUint16(localOffset+28,true),dataStart=localOffset+30+lNameLen+lExtraLen;
  const slice=bytes.subarray(dataStart,dataStart+compSize);
  if(method===0)files[name]=dec.decode(slice);
  else if(method===8&&typeof DecompressionStream==='function'){
   const ds=new DecompressionStream('deflate-raw');const w=ds.writable.getWriter();w.write(slice);w.close();
   const buf=await new Response(ds.readable).arrayBuffer();files[name]=dec.decode(buf);
  }
 }
 const unescapeXML=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&');
 const shared=[];
 if(files['xl/sharedStrings.xml']){
  for(const m of files['xl/sharedStrings.xml'].matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){
   shared.push(unescapeXML([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  }
 }
 const dateStyleIds=new Set();
 if(files['xl/styles.xml']){
  const customDateFmts=new Set([14,15,16,17,18,19,20,21,22,45,46,47]);
  for(const m of files['xl/styles.xml'].matchAll(/<numFmt\b([^>]*)\/?>/g)){
   const id=Number(m[1].match(/\bnumFmtId="(\d+)"/)?.[1]);
   const code=m[1].match(/\bformatCode="([^"]+)"/)?.[1]||'';
   if(id&&/[dmy]/i.test(code)&&!/[0#]/.test(code.replace(/\[[^\]]*\]/g,'')))customDateFmts.add(id);
  }
  const xfsSection=files['xl/styles.xml'].match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]||'';
  let idx=0;
  for(const m of xfsSection.matchAll(/<xf\b([^>]*)\/?>/g)){
   const fmtId=Number(m[1].match(/\bnumFmtId="(\d+)"/)?.[1]);
   if(customDateFmts.has(fmtId))dateStyleIds.add(idx);
   idx++;
  }
 }
 const colIdx=ref=>{let n=0;for(const ch of ref.replace(/\d+/g,''))n=n*26+(ch.charCodeAt(0)-64);return Math.max(0,n-1);};
 const result={transactions:[],debts:[],goals:[],investments:[],profile:{}};
 for(const [path,xml] of Object.entries(files).sort((a,b)=>a[0].localeCompare(b[0]))){
  if(!path.startsWith('xl/worksheets/'))continue;
  const sheetRows=[];
  for(const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
   const row=[];
   for(const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
    const attrs=cm[1],inner=cm[2];
    const ref=attrs.match(/\br="([A-Z]+\d+)"/)?.[1]||'A1';
    const type=attrs.match(/\bt="([^"]+)"/)?.[1]||'';
    const styleIdx=Number(attrs.match(/\bs="(\d+)"/)?.[1]);
    const vMatch=inner.match(/<v>([\s\S]*?)<\/v>/),isMatch=inner.match(/<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
    let val=isMatch?unescapeXML(isMatch[1]):vMatch?unescapeXML(vMatch[1]):'';
    if(type==='s'&&val!=='')val=shared[Number(val)]??val;
    else if((!type||type==='n')&&val!==''&&dateStyleIds.has(styleIdx)&&isExcelSerialDate(val))val=excelSerialToISO(Number(val));
    row[colIdx(ref)]=String(val??'').trim();
   }
   if(row.some(c=>c&&String(c).trim()))sheetRows.push(Array.from({length:row.length},(_,i)=>row[i]??''));
  }
  parseTableRows(sheetRows,result,path);
 }
 return result;
}
export async function importDocumentFile(file){
 const name=String(file?.name||'documento');
 let parsed;
 if(/\.xlsx$/i.test(name)&&typeof file.arrayBuffer==='function'){
  parsed=await parseXlsxBuffer(await file.arrayBuffer());
 }else{
  let text='';
  if(typeof file.arrayBuffer==='function'){
   const buf=await file.arrayBuffer();text=new TextDecoder('utf-8').decode(buf);
   if(text.includes('\uFFFD'))text=new TextDecoder('iso-8859-1').decode(buf);
  }else if(typeof file.text==='function')text=await file.text();
  else text=String(file?.content||file||'');
  parsed=parseDocumentContent(text,name);
 }
 const totalItems=parsed.transactions.length+parsed.debts.length+parsed.goals.length+parsed.investments.length;
 return {...parsed,fileName:name,totalItems};
}
export function describeImportedData(imported){
 const parts=[];
 if(imported.transactions?.length)parts.push(`${imported.transactions.length} ${imported.transactions.length===1?'lançamento':'lançamentos'}`);
 if(imported.debts?.length)parts.push(`${imported.debts.length} ${imported.debts.length===1?'dívida':'dívidas'}`);
 if(imported.goals?.length)parts.push(`${imported.goals.length} ${imported.goals.length===1?'objetivo':'objetivos'}`);
 if(imported.investments?.length)parts.push(`${imported.investments.length} ${imported.investments.length===1?'investimento':'investimentos'}`);
 return parts.join(', ');
}
export function applyImportedData(state,imported){
 if(imported.profile?.name&&!state.profile.name)state.profile.name=imported.profile.name;
 state.transactions.push(...(imported.transactions||[]));
 state.debts.push(...(imported.debts||[]));
 state.goals.push(...(imported.goals||[]));
 state.investments.push(...(imported.investments||[]));
 return describeImportedData(imported);
}
export function tryChatCommand(question,state){
 const q=String(question||'').trim();if(!q)return null;
 // Excluir dívida ou lançamento por comando
 const delDebtMatch=q.match(/^(?:exclu(?:a|ir)|apag(?:ue|ar)|remov(?:a|er)|delet(?:e|ar))\s+(?:a\s+)?d[ií]vida\s+(.+)$/i);
 if(delDebtMatch&&state?.debts?.length){
  const target=normStr(delDebtMatch[1]);
  const found=state.debts.find(d=>normStr(d.name).includes(target)||target.includes(normStr(d.name)));
  if(found)return {kind:'delete-debt',id:found.id,reply:`Pronto! Excluí a dívida "${found.name}" (${money(found.balance)}) do seu painel.`};
 }
 const delTxMatch=q.match(/^(?:exclu(?:a|ir)|apag(?:ue|ar)|remov(?:a|er)|delet(?:e|ar))\s+(?:o\s+)?(?:lan[cç]amento|gasto|despesa|receita)\s+(.+)$/i);
 if(delTxMatch&&state?.transactions?.length){
  const target=normStr(delTxMatch[1]);
  const found=state.transactions.find(t=>!t.linked&&(normStr(t.name).includes(target)||target.includes(normStr(t.name))));
  if(found)return {kind:'delete-transaction',id:found.id,reply:`Pronto! Excluí o lançamento "${found.name}" (${money(found.amount)}) e recalculei seu saldo.`};
 }
 // Se for uma pergunta informativa sem intenção de cadastro, deixa para a análise responder
 if(/\?$/.test(q)||/^(?:quanto|quais|qual|como|onde|por\s*que|analise|resumo|mostre|me\s+mostre|explique|calcule|simule)\b/i.test(q))return null;
 const withoutInstallments=q.replace(/\b\d{1,3}\s*(?:x|parcelas?|vezes)\b/gi,' ').replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ');
 const amtMatches=[...withoutInstallments.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g)];
 if(!amtMatches.length)return null;
 const amtToken=amtMatches.at(-1)[1];
 const amount=Math.abs(parseFlexAmount(amtToken));if(!amount)return null;
 const cleanLabel=raw=>raw.replace(amtMatches.at(-1)[0],'').replace(/\b(?:em\s*)?\d{1,3}\s*(?:x|parcelas?|vezes)\b/gi,'').replace(/\b(?:adicion(?:e|ar)|cri(?:e|ar)|registr(?:e|ar)|lan[cç](?:e|ar)|cadastr(?:e|ar)|coloc(?:a|ar)|tenho|quero|uma?|novo|nova|d[ií]vida|meta|objetivo|investimento|investi|apliquei|gastei|paguei|comprei|despesa|sa[ií]da|gasto|recebi|ganhei|entrada|receita|sal[aá]rio|reais|real|R\$|no|na|de|do|da|com|em|por|para|valor|hoje)\b/gi,' ').replace(/[:;,-]+/g,' ').replace(/\s+/g,' ').trim();
 if(/\b(d[ií]vida|empr[eé]stimo|financiamento|parcelado|parcelas?)\b/i.test(q)&&!/\b(paguei\s+a\s+parcela|quitei)\b/i.test(q)){
  const instMatch=q.match(/\b(\d{1,3})\s*(?:x|parcelas?|vezes)\b/i);
  const inst=instMatch?Math.max(1,Math.min(360,Number(instMatch[1]))):1;
  const name=(cleanLabel(q)||'Cartão / Dívida').slice(0,80);
  const label=name.charAt(0).toUpperCase()+name.slice(1);
  return {kind:'debt',item:{id:crypto.randomUUID(),name:label,total:amount,balance:amount,installments:inst,due:dateISO()},reply:`Pronto! Cadastrei a dívida "${label}" de ${money(amount)} em ${inst}x (${money(Math.round(amount/inst))} por parcela) em Minhas dívidas.`};
 }
 if(/\b(meta|objetivo|sonho|juntar\s+para)\b/i.test(q)){
  const name=(cleanLabel(q)||'Minha meta').slice(0,80);
  const label=name.charAt(0).toUpperCase()+name.slice(1);
  return {kind:'goal',item:{id:crypto.randomUUID(),name:label,target:amount,saved:0,emoji:'🌱',deadline:''},reply:`Pronto! Criei o objetivo "${label}" com meta de ${money(amount)} em Meus objetivos.`};
 }
 if(/\b(investi|apliquei|investimento|aplicar\s+em|aporte\s+em)\b/i.test(q)){
  const name=(cleanLabel(q)||'Aporte').slice(0,80);
  const label=name.charAt(0).toUpperCase()+name.slice(1);
  const kind=/a[cç][oõ]es/i.test(q)?'Ações':/fundo|fii/i.test(q)?'Fundos':'Renda fixa';
  return {kind:'investment',item:{id:crypto.randomUUID(),name:label,amount,kind},reply:`Pronto! Registrei o investimento "${label}" de ${money(amount)} (${kind}) e atualizei seu saldo.`};
 }
 if(/\b(gastei|paguei|comprei|despesa|sa[ií]da|gasto|recebi|ganhei|entrada|receita|sal[aá]rio|freela|freelance|lance|lan[cç]ar|adicione|adicionar|registre|registrar)\b/i.test(q)){
  const isIncome=/\b(recebi|ganhei|entrada|receita|sal[aá]rio|freela|freelance)\b/i.test(q)&&!/\b(gastei|paguei|despesa|sa[ií]da)\b/i.test(q);
  const type=isIncome?'income':'expense';
  const rawName=cleanLabel(q)||(/sal[aá]rio/i.test(q)?'Salário':/freela/i.test(q)?'Freelance':isIncome?'Entrada':'Despesa');
  const label=(rawName.charAt(0).toUpperCase()+rawName.slice(1)).slice(0,100);
  const category=inferCategory(label+' '+q,type);
  return {kind:'transaction',item:{id:crypto.randomUUID(),name:label,amount,type,category,date:dateISO()},reply:`Registrado! Lancei "${label}" (${type==='income'?'Entrada':'Saída'} de ${money(amount)} na categoria ${category}) e já atualizei seu painel.`};
 }
 return null;
}
