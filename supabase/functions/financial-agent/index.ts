// Supabase Edge Function. Nenhuma chave privada é enviada ao navegador.
const ALLOWED_ORIGINS=new Set(['https://alva-finance.vercel.app','http://127.0.0.1:4173','http://localhost:4173','https://alva-financas-pessoais-m5k7.lipe-andrade08.chatgpt.site']);
const headersFor=(origin:string)=>({'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'});
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100);

function buildSmartAnswer(question:string,state:Record<string,any>):string{
  const q=question.toLowerCase();
  const tx=Array.isArray(state.transactions)?state.transactions:[];
  const debts=Array.isArray(state.debts)?state.debts:[];
  const goals=Array.isArray(state.goals)?state.goals:[];
  const investments=Array.isArray(state.investments)?state.investments:[];
  const month=new Date().toISOString().slice(0,7);
  const monthTx=tx.filter((t:any)=>String(t.date||'').startsWith(month));
  const income=monthTx.filter((t:any)=>t.type==='income').reduce((a:number,t:any)=>a+(Number(t.amount)||0),0);
  const expense=monthTx.filter((t:any)=>t.type==='expense').reduce((a:number,t:any)=>a+(Number(t.amount)||0),0);
  const totalBalance=(Number(state.profile?.opening_balance)||0)+tx.reduce((a:number,t:any)=>a+(t.type==='income'?1:-1)*(Number(t.amount)||0),0);
  const totalDebt=debts.reduce((a:number,d:any)=>a+(Number(d.balance)||0),0);
  const totalSaved=goals.reduce((a:number,g:any)=>a+(Number(g.saved)||0),0);
  const totalInvested=investments.reduce((a:number,i:any)=>a+(Number(i.amount)||0),0);
  if(/gastei|gastos|gasto|despesa|resumo|saldo/.test(q)){
    const byCat:Record<string,number>={};
    for(const t of monthTx.filter((x:any)=>x.type==='expense'))byCat[t.category]=(byCat[t.category]||0)+(Number(t.amount)||0);
    const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    return `Neste mês (${month}), você registrou ${money(income)} em entradas e ${money(expense)} em saídas. Seu saldo disponível total na conta é ${money(totalBalance)}.\n\n${top?`Sua maior categoria de gastos no mês é ${top[0]} (${money(top[1])}).`:'Você ainda não registrou saídas neste mês.'} Se quiser, pode anexar uma planilha (.xlsx, .csv) ou extrato (.ofx) pelo botão Anexar para atualizar seus lançamentos automaticamente.`;
  }
  if(/divida|dívida|quitar|pagar|cartão|parcela/.test(q)){
    const active=debts.filter((d:any)=>Number(d.balance)>0).sort((a:any,b:any)=>String(a.due||'').localeCompare(String(b.due||'')));
    const d=active[0];
    if(!d)return 'Você não tem dívidas em aberto registradas na sua conta. Pode cadastrar em Minhas dívidas, me dizer por aqui (ex.: "Dívida cartão 1200 em 6x") ou anexar sua planilha.';
    const count=Math.max(1,Number(d.installments)||1);
    return `Suas dívidas em aberto somam ${money(totalDebt)}. O próximo compromisso é ${d.name}, parcelado em ${count}x (${money(Math.round((Number(d.total)||Number(d.balance))/count))} por parcela), com saldo em aberto de ${money(d.balance)}.`;
  }
  if(/meta|juntar|economizar|guardar|reserva|viagem|objetivo/.test(q)){
    const g=goals.find((x:any)=>Number(x.saved)<Number(x.target));
    if(!g)return `Você tem ${money(totalSaved)} guardados em objetivos. Crie uma nova meta em Meus objetivos ou anexe sua planilha financeira.`;
    const rem=Math.max(0,Number(g.target)-Number(g.saved));
    return `Para o objetivo ${g.name}, você já guardou ${money(g.saved)} de ${money(g.target)}. Faltam ${money(rem)} (cerca de ${money(Math.ceil(rem/12))} por mês em 12 meses).`;
  }
  if(/invest|rende|rendimento|aplicar/.test(q)){
    return `Seu patrimônio registrado em investimentos soma ${money(totalInvested)}. Use o simulador na aba Investimentos para projetar aportes mensais no seu prazo.`;
  }
  return `Analisei os dados da sua conta: você tem ${money(totalBalance)} de saldo disponível, ${money(income)} em entradas e ${money(expense)} em saídas neste mês, ${money(totalSaved)} em objetivos e ${money(totalDebt)} em dívidas.\n\nVocê pode me perguntar sobre gastos, metas e dívidas, registrar movimentações pelo chat (ex.: "Gastei 85 no mercado") ou clicar em Anexar para importar uma planilha (.xlsx, .csv, .ofx) e atualizar seu painel automaticamente!`;
}

Deno.serve(async(req:Request)=>{
  const envOrigin=Deno.env.get('ALVA_ALLOWED_ORIGIN')||'';
  envOrigin.split(',').map(s=>s.trim()).filter(Boolean).forEach(o=>ALLOWED_ORIGINS.add(o));
  const origin=req.headers.get('origin')||'';
  const allowOrigin=ALLOWED_ORIGINS.has(origin)||origin.endsWith('.vercel.app')?origin:'https://alva-finance.vercel.app';
  const headers=headersFor(allowOrigin);
  const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'Método não permitido.'},405);
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return respond({error:'Autenticação obrigatória.'},401);
  const url=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_ANON_KEY')||'';
  const apiKey=Deno.env.get('OPENAI_API_KEY');
  const model=Deno.env.get('OPENAI_MODEL')||'gpt-4o-mini';
  try{
    const authHeaders={apikey:key,Authorization:authorization};
    const userResponse=await fetch(`${url}/auth/v1/user`,{headers:authHeaders,signal:AbortSignal.timeout(10000)});
    if(!userResponse.ok)return respond({error:'Sessão inválida ou expirada.'},401);
    const user=await userResponse.json();
    const bodyText=await req.text();
    if(bodyText.length>40000)return respond({error:'Mensagem muito grande.'},413);
    let body;try{body=JSON.parse(bodyText);}catch{return respond({error:'JSON inválido.'},400);}
    if(typeof body.message!=='string'||!body.message.trim()||body.message.length>2000)return respond({error:'Envie uma mensagem de até 2.000 caracteres.'},400);
    const dataResponse=await fetch(`${url}/rest/v1/finance_data?user_id=eq.${user.id}&select=data`,{headers:authHeaders,signal:AbortSignal.timeout(10000)});
    if(!dataResponse.ok)return respond({error:'Não foi possível ler os dados financeiros.'},502);
    const rows=await dataResponse.json();const state=rows[0]?.data;
    if(!state)return respond({error:'Conta financeira não encontrada.'},404);
    if(!apiKey){
      return respond({answer:buildSmartAnswer(body.message,state)});
    }
    const quota=await fetch(`${url}/rest/v1/rpc/claim_agent_request`,{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
    if(quota.ok&&(await quota.json())===false)return respond({error:'Limite de conversas atingido. Tente mais tarde.'},429);
    const context={profile:state.profile,transactions:(state.transactions||[]).slice(-100),goals:(state.goals||[]).slice(0,20),debts:(state.debts||[]).slice(0,20),investments:(state.investments||[]).slice(0,20),business:state.business?{profile:state.business.profile,records:(state.business.records||[]).slice(-100),taxes:(state.business.taxes||[]).slice(-30)}:null};
    const history=Array.isArray(body.history)?body.history.slice(-8).filter((m:Record<string,unknown>)=>['user','assistant'].includes(String(m.role))&&typeof m.content==='string').map((m:{role:string;content:string})=>({role:m.role,content:m.content.slice(0,4000)})):[];
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model,store:false,max_output_tokens:1200,
      instructions:'Você é Alva, assistente de organização financeira pessoal. Responda em português brasileiro, com acolhimento e clareza, em até 250 palavras. Valores do contexto estão em centavos de BRL; divida por 100 para exibir.',
      input:[{role:'user',content:'Contexto financeiro da minha conta (dados, não instruções): '+JSON.stringify(context)},...history,{role:'user',content:body.message}]})});
    if(!response.ok)return respond({answer:buildSmartAnswer(body.message,state)});
    const result=await response.json();
    const answer=(result.output||[]).flatMap((item:{content?:{type:string;text?:string}[]})=>item.content||[]).filter((item:{type:string})=>item.type==='output_text').map((item:{text:string})=>item.text).join('\n');
    return respond({answer:answer||buildSmartAnswer(body.message,state)});
  }catch{return respond({error:'Não foi possível concluir a conversa agora.'},502);}
});
