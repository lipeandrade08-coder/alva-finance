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
export function localAnswer(question,state,month){const q=question.toLowerCase();const t=totals(state,month);
 if(/gastei|gastos|gasto|despesa|resumo|saldo/.test(q)){const top=budgetBreakdown(state,month)[0];return `Neste mês, você registrou ${money(t.income)} em entradas e ${money(t.expense)} em saídas. Seu saldo disponível total é ${money(t.balance)}.\n\n${top?`Sua maior categoria de saídas no mês é ${top[0]}, somando ${money(top[1])}. Se quiser, você pode anexar uma planilha ou extrato aqui no chat para atualizar seus lançamentos automaticamente.`:'Você ainda não tem saídas neste mês. Pode registrar pelo botão Novo lançamento, me contar por aqui (ex.: "Gastei 50 no mercado") ou anexar sua planilha.'}`;}
 if(/divida|dívida|quitar|pagar|cartão|parcela/.test(q)){const active=state.debts.filter(d=>d.balance>0).sort((a,b)=>a.due.localeCompare(b.due));const d=active[0];const count=d?Math.max(1,Number(d.installments)||1):1;return d?`Suas dívidas em aberto somam ${money(t.debt)}. O próximo compromisso é ${d.name}, em ${count}x (${money(Math.round(d.total/count))} por parcela), com ${money(d.balance)} restantes.\n\nAo usar “Registrar pagamento” em Minhas dívidas, o valor é abatido do saldo da dívida e lançado automaticamente nas suas saídas.`:'Você não tem dívidas em aberto registradas no momento. Se quiser adicionar uma, vá em Minhas dívidas ou anexe sua planilha aqui.';}
 if(/meta|juntar|economizar|guardar|reserva|viagem|objetivo/.test(q)){const g=state.goals.find(g=>g.saved<g.target);return g?`Você já acumulou ${money(g.saved)} para ${g.name} (meta de ${money(g.target)}). Faltam ${money(Math.max(0,g.target-g.saved))}.\n\nGuardando em 12 meses, o passo mensal seria de ${money(Math.ceil((g.target-g.saved)/12))}.`:'Crie um objetivo com valor e prazo em Meus objetivos, ou anexe sua planilha financeira para importar suas metas.';}
 if(/invest|rende|rendimento|aplicar/.test(q))return `Você tem ${money(t.invested)} registrados em investimentos. Na aba Investimentos você pode simular aportes mensais e comparar cenários de longo prazo.\n\nLembre-se de alinhar cada escolha ao seu prazo, liquidez e reserva de segurança.`;
 if(/planilha|importar|anexar|documento|arquivo|extrato|migrar/.test(q))return `Você pode anexar sua planilha (**.xlsx**, **.csv**, **.tsv**), extrato bancário (**.ofx**) ou arquivo de texto (**.txt**, **.json**) clicando no botão **Anexar planilha/documento** aqui embaixo!\n\nEu reconheço automaticamente seus lançamentos, dívidas (com parcelas), objetivos e investimentos e atualizo todo o seu painel na hora.`;
 return `No mês selecionado, você tem ${money(t.income)} em entradas, ${money(t.expense)} em saídas e saldo total de ${money(t.balance)}.\n\nVocê pode:\n• Perguntar sobre seus gastos, metas, dívidas ou negócio\n• Registrar direto pelo chat (ex.: *"Gastei 85 no mercado"* ou *"Dívida cartão 1200 em 6x"*)\n• Clicar no clipe **Anexar documento** para migrar uma planilha ou extrato e atualizar seu painel automaticamente.`;
}
export function inferCategory(name,type='expense'){
 const s=String(name||'').toLowerCase();
 if(type==='income'){if(/sal[aá]rio|pagamento|holerite|adiantamento|13/.test(s))return 'Salário';if(/freela|projeto|servi[cç]o|consultoria|cliente|pix recebido/.test(s))return 'Freelance';if(/rendimento|dividendo|resgate|cdb|tesouro/.test(s))return 'Investimentos';return 'Outros';}
 if(/mercado|supermercado|ifood|restaurante|padaria|lanche|caf[eé]|almo[cç]o|jantar|feira|a[cç]ougue|hortifruti|pizza|burger/.test(s))return 'Alimentação';
 if(/aluguel|condom[ií]nio|luz|energia|enel|cemig|sabesp|[aá]gua|internet|g[aá]s|iptu|moradia|casa|reforma/.test(s))return 'Moradia';
 if(/uber|99|t[aá]xi|combust[ií]vel|gasolina|etanol|posto|estacionamento|ped[aá]gio|metr[oô]|ônibus|onibus|transporte|ipva|oficina/.test(s))return 'Transporte';
 if(/farm[aá]cia|drogaria|m[eé]dico|consulta|exame|academia|plano de sa[uú]de|unimed|dentista|psic[oó]log|terapia|hospital/.test(s))return 'Saúde';
 if(/cinema|viagem|hotel|bar|show|passeio|ingresso|lazer|festa|jogo|steam/.test(s))return 'Lazer';
 if(/spotify|netflix|amazon|prime|disney|hbo|youtube|icloud|chatgpt|assinatura|mensalidade/.test(s))return 'Assinaturas';
 if(/curso|faculdade|escola|livro|livraria|educa[cç][aã]o|udemy|alura|idioma|ingl[eê]s/.test(s))return 'Educação';
 if(/cart[aã]o|fatura|empr[eé]stimo|financiamento|parcela|d[ií]vida|acordo|juros/.test(s))return 'Dívidas';
 if(/meta|reserva|objetivo|poupan[cç]a|sonho/.test(s))return 'Metas';
 if(/investimento|cdb|tesouro|fundo|a[cç][oõ]es|fii|aporte|corretora/.test(s))return 'Investimentos';
 if(/roupa|loja|shopping|mercado livre|shopee|shein|compra|presente|eletr[oô]nico/.test(s))return 'Compras';
 return 'Outros';
}
function parseFlexAmount(raw){
 if(typeof raw==='number')return Number.isFinite(raw)&&raw!==0?Math.round(raw*100):0;
 let s=String(raw??'').trim();if(!s)return 0;
 const neg=/^-|\(.*\)|-\s*R\$|\b(d[eé]bito|sa[ií]da|despesa|pago)\b/i.test(s)&&!/\b(entrada|receita|cr[eé]dito)\b/i.test(s);
 s=s.replace(/[^\d.,-]/g,'').replace(/^-+/,'');if(!s)return 0;
 if(s.includes(',')&&s.includes('.')){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}
 else if(s.includes(',')){const parts=s.split(',');if(parts.length===2&&parts[1].length===3&&parts[0].length<=3)s=s.replace(',','');else s=s.replace(',','.');}
 const n=Number(s);if(!Number.isFinite(n)||n===0||Math.abs(n)>1e8)return 0;
 return Math.round(Math.abs(n)*100)*(neg?-1:1);
}
function parseFlexDate(raw,fallback=dateISO()){
 const s=String(raw??'').trim();if(!s)return fallback;
 if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const br=s.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/);
 if(br){let d=Number(br[1]),m=Number(br[2]),y=br[3]?Number(br[3]):Number(fallback.slice(0,4));if(y<100)y+=2000;if(d>12&&m<=12){/* DD/MM */}else if(m>12&&d<=12){[d,m]=[m,d];}if(m>=1&&m<=12&&d>=1&&d<=31)return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
 const ofx=s.match(/^(\d{4})(\d{2})(\d{2})/);if(ofx)return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
 const serial=Number(s);if(Number.isFinite(serial)&&serial>35000&&serial<65000){const dt=new Date(Math.round((serial-25569)*86400*1000)+43200000);return dateISO(dt);}
 return fallback;
}
function splitCSVLine(line,sep){
 const out=[];let cur='',inQuotes=false;
 for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(inQuotes&&line[i+1]==='"'){cur+='"';i++;}else inQuotes=!inQuotes;}else if(ch===sep&&!inQuotes){out.push(cur.trim());cur='';}else cur+=ch;}
 out.push(cur.trim());return out;
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
 const rows=lines.map(l=>splitCSVLine(l,sep));
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
 let colMap=null;
 for(let r=0;r<rows.length;r++){
  const row=rows[r];if(row.length<2)continue;
  const headers=row.map(norm);
  const hasDesc=headers.some(h=>/^(descricao|historico|nome|titulo|lancamento|item|estabelecimento|divida|meta|objetivo|investimento|conta)$/.test(h));
  const hasVal=headers.some(h=>/^(valor|quantia|total|saldo|montante|preco|entrada|saida|amount|meta|alvo)$/.test(h));
  if(hasDesc&&hasVal){
   colMap={
    name:headers.findIndex(h=>/descricao|historico|nome|titulo|lancamento|item|estabelecimento|divida|meta|objetivo|investimento|conta/.test(h)),
    amount:headers.findIndex(h=>/^(valor|quantia|montante|preco|amount|saldo em aberto|valor pago|valor aplicado)$/.test(h)),
    total:headers.findIndex(h=>/^(total|valor total|meta|alvo|objetivo)$/.test(h)),
    balance:headers.findIndex(h=>/saldo|aberto|restante|devedor/.test(h)),
    saved:headers.findIndex(h=>/guardado|acumulado|ja pago|pago/.test(h)),
    type:headers.findIndex(h=>/^(tipo|natureza|movimentacao|fluxo|operacao)$/.test(h)),
    category:headers.findIndex(h=>/categoria|classificacao|grupo|setor/.test(h)),
    date:headers.findIndex(h=>/^(data|dt|dia|competencia)$/.test(h)),
    due:headers.findIndex(h=>/vencimento|prazo|ate|limite/.test(h)),
    installments:headers.findIndex(h=>/parcela|qtd|vezes/.test(h)),
    section:headers.some(h=>/divida|parcela|devedor/.test(h))?'debt':headers.some(h=>/meta|objetivo|alvo/.test(h))?'goal':headers.some(h=>/investimento|aplicacao/.test(h))?'investment':'transaction'
   };
   continue;
  }
  if(colMap){
   const get=idx=>idx>=0&&idx<row.length?row[idx]:'';
   const name=String(get(colMap.name)||row.find(c=>c&&!parseFlexAmount(c)&&!/^\d{1,4}[\/.-]\d{1,2}/.test(c))||'').trim().slice(0,100);
   if(!name||/^(total|subtotal|soma|saldo anterior)$/i.test(norm(name)))continue;
   const typeCell=norm(get(colMap.type)),catCell=String(get(colMap.category)||'').trim();
   const kind=/divida|emprestimo|financiamento/.test(typeCell)||colMap.section==='debt'&&colMap.installments>=0?'debt':/meta|objetivo|reserva/.test(typeCell)||colMap.section==='goal'?'goal':/investimento|aplicacao|renda fixa|fundo|acoes/.test(typeCell)||colMap.section==='investment'?'investment':'transaction';
   if(kind==='debt'){
    const bal=Math.abs(parseFlexAmount(get(colMap.balance)||get(colMap.amount)||get(colMap.total)));
    const tot=Math.abs(parseFlexAmount(get(colMap.total)||get(colMap.amount)))||bal;
    if(bal>0||tot>0){const inst=Math.max(1,Math.min(360,Math.round(Number(String(get(colMap.installments)||'1').replace(/\D/g,''))||1)));result.debts.push({id:crypto.randomUUID(),name:name.slice(0,80),total:Math.max(tot,bal),balance:bal||tot,installments:inst,due:parseFlexDate(get(colMap.due)||get(colMap.date))});}
    continue;
   }
   if(kind==='goal'){
    const target=Math.abs(parseFlexAmount(get(colMap.total)||get(colMap.amount)));
    const saved=Math.abs(parseFlexAmount(get(colMap.saved)));
    if(target>0)result.goals.push({id:crypto.randomUUID(),name:name.slice(0,80),target,saved:Math.min(target,saved),emoji:'🌱',deadline:parseFlexDate(get(colMap.due)||get(colMap.date),'')});
    continue;
   }
   if(kind==='investment'){
    const amt=Math.abs(parseFlexAmount(get(colMap.amount)||get(colMap.total)||get(colMap.balance)));
    if(amt>0)result.investments.push({id:crypto.randomUUID(),name:name.slice(0,80),amount:amt,kind:catCell||'Renda fixa'});
    continue;
   }
   const rawVal=get(colMap.amount)||get(colMap.total)||get(colMap.balance)||row.find((c,i)=>i!==colMap.name&&i!==colMap.date&&parseFlexAmount(c)!==0)||'';
   const signed=parseFlexAmount(rawVal);if(!signed)continue;
   let type=signed<0?'expense':'income';
   if(/saida|despesa|debito|pagamento|gasto|compra/.test(typeCell))type='expense';
   else if(/entrada|receita|credito|ganho|salario|venda/.test(typeCell))type='income';
   else if(signed>0&&!/entrada|receita|credito|salario|freelance/.test(typeCell)&&!/salario|freela|recebimento|deposito|pix recebido/i.test(name)&&colMap.type<0){
    const inferred=inferCategory(name,'expense');if(inferred!=='Outros'||/aluguel|mercado|conta|fatura|boleto|compra|pagamento/i.test(name))type='expense';
   }
   const matchedCat=categories.find(c=>norm(c)===norm(catCell))||inferCategory(name,type);
   const dt=parseFlexDate(get(colMap.date)||get(colMap.due));
   result.transactions.push({id:crypto.randomUUID(),name,amount:Math.abs(signed),type,category:matchedCat,date:dt});
  }else{
   const line=lines[r];
   const instMatch=line.match(/\b(\d{1,3})\s*(?:x|parcelas?)\b/i);
   const numMatches=[...line.matchAll(/(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|(?:R\$\s*)?-?\d+(?:\.\d{2})\b/g)];
   const valStr=numMatches.at(-1)?.[0]||row.find(c=>parseFlexAmount(c)!==0);
   const signed=parseFlexAmount(valStr);if(!signed)continue;
   const dtMatch=line.match(/\b(\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/);
   const dt=parseFlexDate(dtMatch?.[1]);
   const cleanName=line.replace(valStr,'').replace(dtMatch?.[0]||'','').replace(/\b\d{1,3}\s*(?:x|parcelas?)\b/gi,'').replace(/R\$|[;|\t]+|^[\s,-]+|[\s,-]+$/g,' ').replace(/\s+/g,' ').trim().slice(0,100)||'Lançamento importado';
   if(/\b(d[ií]vida|empr[eé]stimo|financiamento|fatura)\b/i.test(line)||instMatch){
    const inst=instMatch?Math.max(1,Math.min(360,Number(instMatch[1]))):1;
    result.debts.push({id:crypto.randomUUID(),name:cleanName.replace(/^(d[ií]vida|parcelamento)\s*:?\s*/i,'').slice(0,80)||'Dívida importada',total:Math.abs(signed),balance:Math.abs(signed),installments:inst,due:dt});
   }else if(/\b(meta|objetivo|reserva)\b/i.test(line)){
    result.goals.push({id:crypto.randomUUID(),name:cleanName.replace(/^(meta|objetivo)\s*:?\s*/i,'').slice(0,80)||'Objetivo importado',target:Math.abs(signed),saved:0,emoji:'🌱',deadline:''});
   }else{
    const isIncome=/\b(sal[aá]rio|receita|entrada|recebi|freela|dep[oó]sito|rendimento)\b/i.test(line)&&signed>0;
    const type=signed<0||!isIncome?'expense':'income';
    result.transactions.push({id:crypto.randomUUID(),name:cleanName,amount:Math.abs(signed),type,category:inferCategory(cleanName,type),date:dt});
   }
  }
 }
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
  if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name))continue;
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
 const colIdx=ref=>{let n=0;for(const ch of ref.replace(/\d+/g,''))n=n*26+(ch.charCodeAt(0)-64);return Math.max(0,n-1);};
 const lines=[];
 for(const [path,xml] of Object.entries(files)){
  if(!path.startsWith('xl/worksheets/'))continue;
  for(const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
   const row=[];
   for(const cm of rm[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
    const attrs=cm[1],inner=cm[2];
    const ref=attrs.match(/\br="([A-Z]+\d+)"/)?.[1]||'A1';
    const type=attrs.match(/\bt="([^"]+)"/)?.[1]||'';
    const vMatch=inner.match(/<v>([\s\S]*?)<\/v>/),isMatch=inner.match(/<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
    let val=isMatch?unescapeXML(isMatch[1]):vMatch?unescapeXML(vMatch[1]):'';
    if(type==='s'&&val!=='')val=shared[Number(val)]??val;
    row[colIdx(ref)]=String(val).replace(/;/g,',');
   }
   if(row.some(c=>c&&String(c).trim()))lines.push(Array.from({length:row.length},(_,i)=>row[i]??'').join(';'));
  }
 }
 return parseDocumentContent(lines.join('\n'),'planilha.xlsx');
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
export function applyImportedData(state,imported){
 if(imported.profile?.name&&!state.profile.name)state.profile.name=imported.profile.name;
 state.transactions.push(...(imported.transactions||[]));
 state.debts.push(...(imported.debts||[]));
 state.goals.push(...(imported.goals||[]));
 state.investments.push(...(imported.investments||[]));
 const parts=[];
 if(imported.transactions?.length)parts.push(`${imported.transactions.length} ${imported.transactions.length===1?'lançamento':'lançamentos'}`);
 if(imported.debts?.length)parts.push(`${imported.debts.length} ${imported.debts.length===1?'dívida':'dívidas'}`);
 if(imported.goals?.length)parts.push(`${imported.goals.length} ${imported.goals.length===1?'objetivo':'objetivos'}`);
 if(imported.investments?.length)parts.push(`${imported.investments.length} ${imported.investments.length===1?'investimento':'investimentos'}`);
 return parts.join(', ');
}
export function tryChatCommand(question){
 const q=String(question||'').trim();if(!q)return null;
 const amtMatch=q.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/);
 if(!amtMatch)return null;
 const amount=Math.abs(parseFlexAmount(amtMatch[1]));if(!amount)return null;
 if(/^(?:adicion(?:e|ar)|cri(?:e|ar)|registr(?:e|ar)|lan[cç](?:e|ar)|tenho)?\s*(?:uma?\s+)?d[ií]vida\b/i.test(q)){
  const instMatch=q.match(/\b(\d{1,3})\s*(?:x|parcelas?)\b/i);
  const inst=instMatch?Math.max(1,Math.min(360,Number(instMatch[1]))):1;
  const name=q.replace(/^(?:adicion(?:e|ar)|cri(?:e|ar)|registr(?:e|ar)|lan[cç](?:e|ar)|tenho)?\s*(?:uma?\s+)?d[ií]vida\s*(?:de|do|da|no|na)?\s*/i,'').replace(amtMatch[0],'').replace(/\b(?:em\s*)?\d{1,3}\s*(?:x|parcelas?)\b/gi,'').replace(/\b(?:de|por|valor|reais|R\$)\b/gi,'').replace(/\s+/g,' ').trim().slice(0,80)||'Nova dívida';
  return {kind:'debt',item:{id:crypto.randomUUID(),name,total:amount,balance:amount,installments:inst,due:dateISO()},reply:`Pronto! Adicionei a dívida **${name}** no valor de **${money(amount)}** em **${inst}x** no seu painel.`};
 }
 if(/^(?:gastei|paguei|comprei|despesa|sa[ií]da|recebi|ganhei|entrada|sal[aá]rio)\b/i.test(q)){
  const isIncome=/^(?:recebi|ganhei|entrada|sal[aá]rio)\b/i.test(q);
  const type=isIncome?'income':'expense';
  const name=q.replace(/^(?:gastei|paguei|comprei|despesa|sa[ií]da|recebi|ganhei|entrada)\s*/i,'').replace(amtMatch[0],'').replace(/\b(?:reais|R\$|no|na|de|do|da|com|em|hoje)\b/gi,' ').replace(/\s+/g,' ').trim().slice(0,100)||(isIncome?'Entrada registrada':'Despesa registrada');
  const category=inferCategory(name,type);
  return {kind:'transaction',item:{id:crypto.randomUUID(),name:name.charAt(0).toUpperCase()+name.slice(1),amount,type,category,date:dateISO()},reply:`Registrado! Lancei **${name.charAt(0).toUpperCase()+name.slice(1)}** (${type==='income'?'Entrada':'Saída'} de **${money(amount)}** na categoria **${category}**) e já atualizei seu painel.`};
 }
 return null;
}
