import {money,escapeHTML as e,dateISO,cents,numeric,emptyData,sampleData,totals,projection,budgetBreakdown,spendingPeriods,spendingReport,localAnswer,parseDocumentContent,tryChatCommand,debtMetrics,evaluateSpendingLimits,formatGoalCoachingPlan} from './finance.js';
import * as api from './api.js';
import {createAuthUI} from './auth-ui.js';
import {animateAuth,animatePage,animateModal,animateSimulation,setMenu,syncLayout} from './motion.js';
import {addBusinessRecord,ensureBusiness,businessAnswer} from './business.js';
import {createBusinessUI} from './business-ui.js';
import {addCustomCategory,categoryField,categoryForRecord,categoryNameLimit,categoryOptions,changeCategoryField,customCategories} from './categories.js';
import {pageHref,readPage} from './routes.js';
import {createImportUI} from './import-ui.js';
import {readImportFile,readPastedImport} from './import-review.js';
import {attentionButton,attentionDetails,createNoticeUI} from './notice-ui.js';
import {createPlanningUI} from './planning-ui.js';
import {AUDIO_ACCEPT,createVoiceCapture,isAudioFile} from './voice.js';
import {attentionPlan,crossedLimits,recordDemoNotices,noticeDate} from './notices.js';
const paths={camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>',whatsapp:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>',business:'<path d="M3 21h18M5 21V8h14v13M8 8V3h8v5M9 12h1M14 12h1M9 16h1M14 16h1"/>',home:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',wallet:'<path d="M20 7H5a2 2 0 0 1 0-4h13v4M4 7v12a2 2 0 0 0 2 2h14V7M20 12h-6v5h6"/><path d="M17 14.5h.01"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',debt:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',invest:'<path d="M3 18l6-6 4 4 8-12M15 4h6v6"/>',spark:'<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4M18 4h4"/>',settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',chevron:'<path d="M9 5l7 7-7 7"/>',left:'<path d="M15 5l-7 7 7 7"/>',down:'<path d="M5 9l7 7 7-7"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',up:'<path d="M7 17L17 7M7 7h10v10"/>',in:'<path d="M17 7L7 17M7 7v10h10"/>',bell:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 11h18"/>',leaf:'<path d="M12 21v-8M12 15C3 15 4 7 4 7s8-1 8 8M12 12c0-8 8-9 8-9s2 9-8 9"/>',food:'<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 3c-4 2-5 7-4 9h4M20 3v18"/>',car:'<path d="M4 10l2-6h12l2 6M3 10h18v8H3zM6 18v3M18 18v3M6 14h2M16 14h2"/>',house:'<path d="M3 10l9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',bag:'<rect x="4" y="7" width="16" height="14" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/>',search:'<circle cx="10" cy="10" r="7"/><path d="M15 15l6 6"/>',trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 15V3M7 8l5-5 5 5M4 16v5h16v-5"/>',clip:'<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',check:'<path d="M5 12l4 4L19 6"/>',refresh:'<path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.wallet}</svg>`;
const navigation=[['dashboard','home','Visão geral'],['transactions','wallet','Lançamentos'],['goals','target','Meus objetivos'],['debts','debt','Minhas dívidas'],['investments','invest','Investimentos'],['assistant','spark','Assistente Alva'],['notices','bell','Central de avisos'],['business','business','Meu negócio']];
const pageInfo={notices:['Central de avisos','Veja o que merece atenção e escolha seu próximo passo.'],business:['Seu negócio em boas mãos.','MEI, microempresa ou trabalho por conta própria. Um espaço para crescer.'],dashboard:['Seu dinheiro em equilíbrio.','Um passo de cada vez. Cada escolha conta.'],transactions:['Tudo no seu controle.','Receitas e despesas organizadas, sem complicação.'],goals:['Seus sonhos têm um plano.','Pequenas conquistas de hoje. Grandes possibilidades amanhã.'],debts:['Mais perto de ficar em dia.','Parcelas, valor de cada prestação e cálculo automático dos juros que você está pagando.'],investments:['Cultive seu amanhã.','Acompanhe seus aportes e explore cenários para o futuro.'],assistant:['Vamos conversar sobre dinheiro?','Converse com a Alva ou anexe sua planilha para atualizar todo o seu painel automaticamente.'],settings:['Um espaço com a sua cara.','Sua foto de perfil e preferências e suas conexões.']};
const DEMO_KEY='alva-demo-v1';let data;try{data=JSON.parse(localStorage.getItem(DEMO_KEY))||sampleData();}catch{data=sampleData();}
function normalizeState(s, demoMode=false){
 if(!s.profile)s.profile={name:'',monthly_budget:0,opening_balance:0};
 if(!s.profile.alert_channel)s.profile.alert_channel='both';
 if(typeof s.profile.alert_whatsapp!=='string')s.profile.alert_whatsapp='';
 if(typeof s.profile.alert_email!=='string')s.profile.alert_email='';
 if(typeof s.avatar_photo!=='string')s.avatar_photo='';
 if(!Array.isArray(s.spending_limits))s.spending_limits=[];
 ensureBusiness(s,demoMode);
}
normalizeState(data,true);
let authVisible=true;
let view='dashboard',month=dateISO().slice(0,7),demo=true,revision=0,saving=false,chartMode='flow',hidden=false,chatBusy=false,voiceCloud,voiceProposal;
let spendingPeriod='month',spendingAnchor;
let transactionType='all';
let messages=[{role:'assistant',content:'Oi! Eu sou a Alva 🌿 Vamos dar mais clareza ao seu dinheiro?\n\nVocê pode mandar um **áudio** pelo botão de microfone 🎙️ ou escrever dizendo o que gastou ou recebeu (ex.: "Gastei 85 no mercado", "Recebi 1200 de um cliente", "Limitar gasto com Uber em 200") e também anexar sua planilha (.xlsx, .csv) ou extrato (.ofx)!'}];
const $=s=>document.querySelector(s);const monthLabel=(period=month)=>new Date(`${period}-15T12:00:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(' de ',' ');
const firstName=()=>data.profile.name.split(' ')[0]||'você';const initials=()=>data.profile.name.split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'AL';
const avatarHTML=()=>data.avatar_photo?`<img src="${e(data.avatar_photo)}" alt="Foto de perfil" class="avatar-img">`:e(initials());
const authUI=createAuthUI({api,icon,isVisible:()=>authVisible,render:()=>{shell();postRender();},onAuthenticated:enterAccount,openDemo:()=>{authVisible=false;demo=true;try{data=JSON.parse(localStorage.getItem(DEMO_KEY))||sampleData();}catch{data=sampleData();}normalizeState(data,true);openRequestedPage();}});
const businessUI=createBusinessUI({getData:()=>data,getMonth:()=>month,icon,modal,commit,toast,stat,panelHeader});
const voice=createVoiceCapture({
 transcribe:async (file,signal)=>{
  if(demo)throw Object.assign(new Error('Entre na sua conta para transcrever arquivos. Na demonstração, use o ditado do navegador ou digite.'),{status:400});
  try{return await api.transcribeAudio(file,signal);}
  catch(error){
   if(['audio_unavailable','audio_credentials','audio_billing','audio_model_access','audio_rate_limit'].includes(error.code))voiceCloud=false;
   throw error;
  }
 },
 onChange:updateVoiceUI,
 onTranscript:text=>{if(!authVisible&&view==='assistant')openVoiceReview(text);}
});
const planningUI=createPlanningUI({getData:()=>data,modal,openWithdrawal:amount=>businessUI.openWithdrawal(amount)});
const importUI=createImportUI({
 getData:()=>data,dialog:$('#modal'),modal,commit,
 onImported:result=>{
  const batches=result.batches??[result];
  const destination=view==='business'?'business':'personal';
  const batch=batches.find(item=>item.destination===destination)??batches[0];
  const rows=batch.destination==='business'?data.business.records:data.transactions;
  const months=rows.filter(record=>record.import_batch_id===batch.id).map(record=>record.date.slice(0,7)).sort();
  if(months.length&&!months.includes(month))month=months.at(-1);
  if(batch.destination==='business')navigate('business','records');
  else navigate(batches.length>1?'dashboard':'transactions');
 }
});
const noticeUI=createNoticeUI({
 api,getData:()=>data,isDemo:()=>demo,identity:()=>authVisible?null:demo?'demo':api.session?.user?.id,icon,
 onUpdate:()=>{
  if(authVisible)return;
  const count=noticeUI.unread(),bell=$('[data-action="notifications"]');
  if(bell){
   bell.classList.toggle('has-alert',Boolean(count));
   bell.setAttribute('aria-label',count?`Central de avisos, ${count} novo${count===1?'':'s'}`:'Central de avisos');
   bell.innerHTML=`${icon('bell')}${count?`<span class="notif-count">${count}</span>`:''}`;
  }
  if(view==='notices'&&$('#page-content'))$('#page-content').innerHTML=noticeUI.render();
 },
 onReadDemo:ids=>commit(next=>{
  const chosen=new Set(ids),readAt=new Date().toISOString();
  for(const row of next.notice_history??[])if(chosen.has(row.id))row.read_at=readAt;
 },'Avisos marcados como lidos.')
});
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function ledgerMonthOptions(){
 const rows=view==='business'?(data.business?.records??[]):data.transactions;
 const dates=rows.flatMap(row=>view==='business'?[row.date,row.paid_date]:[row.date]);
 const months=new Set([month,...dates.map(date=>String(date??'').slice(0,7)).filter(key=>/^\d{4}-(?:0[1-9]|1[0-2])$/.test(key))]);
 return [...months].sort().reverse().map(key=>`<option value="${key}" ${key===month?'selected':''}>${e(monthLabel(key))}</option>`).join('');
}
function shell(){
 document.body.classList.remove('menu-open');document.body.classList.toggle('screen-auth',authVisible);
 if(authVisible){document.body.dataset.view='auth';$('#app').innerHTML=authUI.render();return;}
 authUI.stop();const title=pageInfo[view]?.[0]||'';
 const unreadNotices=noticeUI.unread();
 const topTabs=[['dashboard','home','Início'],['transactions','wallet','Lançamentos'],['debts','debt','Dívidas'],['goals','target','Objetivos'],['assistant','spark','Alva']];
 const mobileTabs=[['dashboard','home','Início'],['transactions','wallet','Lançamentos'],['debts','debt','Dívidas'],['goals','target','Objetivos'],['assistant','spark','Alva']];
 $('#app').innerHTML=`<input type="file" id="file-importer" class="visually-hidden" accept=".csv,.tsv,.txt,.xlsx,.ofx,.json,${AUDIO_ACCEPT}" multiple><input type="file" id="voice-file" class="visually-hidden" accept="${AUDIO_ACCEPT}"><input type="file" id="avatar-importer" class="visually-hidden" accept="image/*"><div class="mobile-overlay" data-action="close-menu"></div><aside class="sidebar" id="app-sidebar" aria-label="Menu principal"><button class="icon-button sidebar-close" data-action="close-menu" aria-label="Fechar menu">${icon('close')}</button><a href="${pageHref('dashboard')}" class="brand"><img src="./logo.svg" alt="">alva<span style="color:#99ae7c;font-size:29px">.</span></a><p class="brand-sub">SEU PRÓXIMO PASSO</p><div class="nav-label">SEU ESPAÇO</div><nav class="nav" aria-label="Navegação principal">${navigation.map(([id,ico,label])=>`<button data-nav="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ico)}${label}${id==='assistant'?'<span class="pill">IA</span>':''}</button>`).join('')}</nav><div class="nav-separator"></div><nav class="nav"><button data-nav="settings" class="${view==='settings'?'active':''}">${icon('settings')}Configurações</button><button data-action="help">${icon('help')}Precisa de ajuda?</button></nav><div class="sidebar-bottom"><div class="grow-note"><div class="sprout">${icon('leaf')}</div><h3>O futuro começa<br>com um pequeno passo.</h3><p>Estamos aqui para caminhar<br>com você, todos os dias.</p></div><a class="user-card" href="${pageHref('settings')}"><span class="avatar">${avatarHTML()}</span><span><strong>${e(data.profile.name||'Meu perfil')}</strong><small>${demo?'Perfil de demonstração':'Minha conta pessoal'}</small></span>${icon('chevron')}</a></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb"><button class="icon-button menu-button" data-action="menu" aria-label="Abrir menu" aria-controls="app-sidebar" aria-expanded="false">${icon('menu')}</button>${icon('home')}<span>Meu espaço</span><span>/</span><b>${navigation.find(x=>x[0]===view)?.[2]||'Configurações'}</b></div><nav class="top-glass-tabs" aria-label="Atalhos rápidos">${topTabs.map(([id,ic,lbl])=>`<button data-nav="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span>${lbl}</span></button>`).join('')}</nav><div class="top-actions">${demo?`<button class="button top-signin" data-action="login">${icon('lock')}Criar minha conta</button>`:''}<span class="sync-label"><i class="live-dot"></i>${demo?'Salvo neste navegador':saving?'Salvando…':'Conectado ao Supabase'}</span><button class="icon-button" data-action="privacy" aria-label="${hidden?'Mostrar':'Ocultar'} valores">${icon('eye')}</button><button class="icon-button notification ${unreadNotices?'has-alert':''}" data-action="notifications" aria-label="${unreadNotices?`Central de avisos, ${unreadNotices} novo${unreadNotices===1?'':'s'}`:'Central de avisos'}">${icon('bell')}${unreadNotices?`<span class="notif-count">${unreadNotices}</span>`:''}</button><button class="avatar" data-nav="settings" aria-label="Abrir meu perfil">${avatarHTML()}</button></div></header><main id="main" class="main" tabindex="-1">${demo?`<div class="demo-access"><span>${icon('leaf')}Você está na demonstração. Seus dados reais começam na sua conta.</span><button class="button secondary" data-action="login">Criar minha conta</button></div>`:''}<section class="intro"><div><div class="eyebrow">${icon(view==='dashboard'?'sun':'leaf')} ${view==='dashboard'?`OLÁ, ${e(firstName().toUpperCase())}`:'SEU PRÓXIMO PASSO'}</div><h1>${title}</h1><p>${pageInfo[view]?.[1]||''}</p></div><div class="intro-actions">${view==='business'?`<button class="button secondary" data-action="import-file">${icon('upload')}Importar extrato</button><button class="button ghost" data-import-history>Importações</button><button class="button secondary" data-business="export">${icon('download')}Exportar</button><button class="button" data-business="record">${icon('plus')}Nova movimentação</button>`:''}${view==='dashboard'||view==='transactions'?`<button class="button secondary" data-action="limit">${icon('alert')}Limitar gasto</button><button class="button secondary" data-action="import-file">${icon('upload')}Importar planilha</button><button class="button ghost" data-import-history>Importações</button><button class="button secondary" data-action="export">${icon('download')}Exportar</button><button class="button" data-action="transaction">${icon('plus')}Novo lançamento</button>`:view==='goals'?`<button class="button secondary" data-action="import-file">${icon('upload')}Importar</button><button class="button" data-action="goal">${icon('plus')}Criar objetivo</button>`:view==='debts'?`<button class="button secondary" data-action="import-file">${icon('upload')}Importar</button><button class="button" data-action="debt">${icon('plus')}Adicionar dívida</button>`:view==='investments'?`<button class="button secondary" data-action="import-file">${icon('upload')}Importar</button><button class="button" data-action="investment">${icon('plus')}Registrar investimento</button>`:view==='assistant'?`<button class="button secondary" data-action="import-file">${icon('clip')}Anexar planilha</button>`:''}</div></section>${['dashboard','transactions','business'].includes(view)?`<div class="toolbar"><div class="period"><button data-action="prev-month" aria-label="Mês anterior">${icon('left')}</button><select id="ledger-month" aria-label="Selecionar mês">${ledgerMonthOptions()}</select><button data-action="next-month" aria-label="Próximo mês">${icon('chevron')}</button></div><span class="demo-tag">${icon(demo?'leaf':'lock')}${demo?'Demonstração · dados de exemplo':'Sua conta · dados pessoais'}</span></div>`:''}<div id="page-content">${renderPage()}</div><footer class="footer"><span>${icon('lock')}${demo?'Demonstração local · dados neste navegador':'Seus dados pertencem a você'}</span><span>Desenvolvido por <strong>2type</strong></span></footer></main></div><nav class="mobile-bottom" aria-label="Atalhos">${mobileTabs.map(([id,ic,lbl])=>`<button data-nav="${id}" class="${view===id?'active':''}" ${view===id?'aria-current="page"':''}>${icon(ic)}<span>${lbl}</span></button>`).join('')}</nav>`;
 document.body.classList.toggle('screen-privacy',hidden);
}
function stat(label,value,ico,foot,href){
 const amount=money(value).replace('R$','').trim();
 return `<a class="stat stat-link" href="${href}"><div class="stat-label"><span class="stat-icon-badge">${icon(ico)}</span><span>${label}</span><span class="stat-corner" aria-hidden="true">${icon('chevron')}</span></div><div class="stat-value money" data-counter-value="${value}" data-counter-key="${e(label)}"><span class="currency" aria-hidden="true">R$</span><span class="counter-number" aria-hidden="true">${amount}</span><span class="visually-hidden">${money(value)}</span></div><div class="stat-bottom"><div class="stat-foot">${foot}</div><svg class="stat-sparkline" viewBox="0 0 68 24" aria-hidden="true"><path d="M2 19 L16 14 L29 17 L44 9 L56 12 L66 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div></a>`;
}
function panelHeader(title,subtitle,action=''){return `<div class="panel-header"><div><h2>${title}</h2>${subtitle?`<p class="panel-subtitle">${subtitle}</p>`:''}</div>${action}</div>`;}
function renderPage(){if(view==='notices')return noticeUI.render();if(view==='business')return businessUI.render();return ({dashboard:dashboard,transactions:transactions,goals:goals,debts:debts,investments:investments,assistant:assistant,settings:settings}[view]||dashboard)();}
function chart({list,openingBalance}){
 const days=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
 const income=[],expense=[],balance=[];
 let received=0,spent=0;
 for(let day=1;day<=days;day++){
  for(const transaction of list){
   if(Number(transaction.date.slice(8))!==day)continue;
   if(transaction.type==='income')received+=transaction.amount;
   if(transaction.type==='expense')spent+=transaction.amount;
  }
  income.push(received);
  expense.push(spent);
  balance.push(openingBalance+received-spent);
 }
 const a=chartMode==='flow'?income:balance,b=chartMode==='flow'?expense:[];const max=Math.max(10000,...a,...b),min=Math.min(0,...a,...b),range=max-min||1;const coord=(v,idx)=>`${44+idx/Math.max(1,days-1)*492},${150-(v-min)/range*130}`;const line=values=>values.map((v,j)=>`${j?'L':'M'}${coord(v,j)}`).join(' ');const p=line(a),last=a.length?coord(a.at(-1),a.length-1):'44,150';return `<svg class="line-chart" viewBox="0 0 555 187" role="img" aria-label="${chartMode==='flow'?'Receitas e despesas acumuladas':'Saldo acumulado'} no mês"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a7c18b" stop-opacity=".2"/><stop offset="100%" stop-color="#a7c18b" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3].map(n=>{const y=20+n*43.33;return `<line x1="44" x2="540" y1="${y}" y2="${y}" stroke="#edf0e8" stroke-dasharray="3 4"/><text x="0" y="${y+3}">${((max-n*range/3)/100000).toLocaleString('pt-BR',{maximumFractionDigits:1})}k</text>`;}).join('')}<path d="${p} L ${last.split(',')[0]},150 L44,150Z" fill="url(#chart-fill)"/>${b.length?`<path d="${line(b)}" fill="none" stroke="#c3ceba" stroke-width="2" stroke-linejoin="round"/>`:''}<path d="${p}" fill="none" stroke="#759962" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${last.split(',')[0]}" cy="${last.split(',')[1]}" r="4" fill="#71945d" stroke="white" stroke-width="2"/>${[1,5,10,15,20,25,days].map(d=>`<text x="${44+(d-1)/(days-1)*492}" y="176" text-anchor="middle">${String(d).padStart(2,'0')}</text>`).join('')}</svg>`;}
function spendingLimitsPanel(){
 const limits=evaluateSpendingLimits(data,month);
 return `<section class="panel limits-panel">${panelHeader('Limites de gastos','Defina um teto e acompanhe os avisos na Central',`<button class="button secondary mini-action" data-action="limit">${icon('plus')}Novo limite</button>`)}<div class="limits-list">${limits.map(l=>`<div class="limit-item ${l.status}"><div class="limit-top"><div><strong>${e(l.name)}</strong><small>${e(l.category)}</small></div><div class="row-actions"><span class="limit-badge ${l.status}">${l.exceeded?`🚨 Limite atingido (${l.pct}%)`:l.warning?`⚠️ Atenção (${l.pct}%)`:`${l.pct}% usado`}</span><button class="icon-button mini-icon" data-send-alert="${e(l.id)}" title="Detalhes do aviso" aria-label="Ver aviso de ${e(l.name)}">${icon('bell')}</button><button class="delete-button" data-delete-limit="${e(l.id)}" title="Excluir limite" aria-label="Excluir limite ${e(l.name)}">${icon('trash')}</button></div></div><div class="progress ${l.status}"><span style="width:${Math.min(100,l.pct)}%"></span></div><div class="goal-values"><b class="money">${money(l.spent)} gastos</b><span class="money">Limite: ${money(l.limit)} · ${l.exceeded?`Passou ${money(l.spent-l.limit)}`:`Restam ${money(l.remaining)}`}</span></div></div>`).join('')||'<div class="empty">Quer controlar gastos específicos como Uber, iFood ou Lazer?<br>Estipule um limite e a Alva avisa você quando chegar lá!</div>'}</div></section>`;
}
function todayCard(){
 const task=attentionPlan(data)[0];
 const hasBusiness=Boolean(data.business?.profile?.name||data.business?.records?.length);
 return `<section class="panel notice-focus today-card" aria-labelledby="today-title">
  <div class="today-copy"><span class="notice-kicker">${icon('spark')} HOJE NA ALVA</span>
   <h2 id="today-title">${task?e(task.title):'Seus próximos passos'}</h2>
   <p>${task?attentionDetails(task):'Sem vencimentos próximos ou limites que precisem de atenção.'}</p>
  </div><div class="today-actions">
   ${task?attentionButton(task):''}
   ${hasBusiness?'<button class="button secondary" type="button" data-plan="withdrawal">Simular retirada</button>':''}
   <button class="button ghost" type="button" data-nav="notices">Ver avisos</button>
  </div>
 </section>`;
}
function dashboard(){const t=totals(data,month);return `${todayCard()}<section class="stats" aria-label="Resumo financeiro">${stat('Saldo pessoal acumulado',t.closingBalance,'wallet',`${icon('lock')}Até o fim de ${e(monthLabel())}`,pageHref('transactions'))}${stat('Entradas do mês',t.income,'in',`${icon('in')}Receitas registradas`,pageHref('transactions','income'))}${stat('Saídas do mês',t.expense,'up',`${icon('up')}Despesas registradas`,pageHref('transactions','expense'))}${stat('Guardado em objetivos',t.saved,'target',`${icon('leaf')}${data.goals.length} objetivos no seu caminho`,pageHref('goals'))}</section><div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Seu dinheiro em movimento</h2><p class="panel-subtitle">Clareza para acompanhar suas escolhas</p></div><div class="chart-tabs"><button data-chart="flow" class="${chartMode==='flow'?'active':''}">Fluxo</button><button data-chart="balance" class="${chartMode==='balance'?'active':''}">Saldo</button></div></div><div class="chart-meta"><span><i class="legend-dot"></i>${chartMode==='flow'?'Entradas':'Saldo'}</span>${chartMode==='flow'?'<span><i class="legend-dot gray"></i>Saídas</span>':''}<span style="margin-left:auto">Acumulado do mês</span></div>${chart(t)}<div class="chart-bottom"><span>Dos seus registros, sem estimativas.</span><b><a class="text-button" href="${pageHref('transactions',t.income>=t.expense?undefined:'expense')}">${t.income>=t.expense?'Ver movimentações':'Revisar saídas'}${icon('chevron')}</a></b></div></section><aside class="agent-card"><div class="agent-label"><span class="agent-mark">${icon('spark')}</span>Um olhar da Alva <small>IA ATIVA</small></div><h2>Pequenos passos.<br><em>Grandes possibilidades.</em></h2><p>${t.income>t.expense?`Você tem ${money(t.income-t.expense)} entre entradas e saídas do mês. Vamos planejar o próximo passo ou importar sua planilha?`:'Vamos olhar seus gastos, conversar ou importar sua planilha financeira?'}</p><a class="button light" href="${pageHref('assistant')}">Conversar com a Alva${icon('arrow')}</a><div class="agent-foot">Assistente ativa · Aceita planilhas e extratos</div></aside><section class="panel">${panelHeader('Últimos lançamentos','Seu dia a dia, organizado',`<a class="text-button" href="${pageHref('transactions')}">Ver todos${icon('chevron')}</a>`)}${transactionTable([...t.list].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4))}</section><section class="panel goals-panel">${panelHeader('Sonhos em construção','Cada pouquinho faz diferença',`<a class="text-button" href="${pageHref('goals')}">Ver objetivos${icon('chevron')}</a>`)}<div class="goals-mini">${data.goals.slice(0,2).map(goalMini).join('')||'<div class="empty">Qual é o seu próximo sonho?</div>'}</div><button class="button ghost" data-action="goal">${icon('plus')}Criar um novo objetivo</button></section></div><div class="bottom-grid triple-grid">${spendingPanel()}${spendingLimitsPanel()}<section class="panel">${panelHeader('No seu radar','Compromissos que merecem atenção',`<a class="text-button" href="${pageHref('notices')}">Abrir avisos${icon('chevron')}</a>`)}${data.debts.filter(d=>d.balance>0).slice().sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3).map(d=>{const m=debtMetrics(d);return `<div class="next-bill"><div class="date-tile"><small>${new Date(d.due+'T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase()}</small>${d.due.slice(8)}</div><div class="bill-info">${e(d.name)}<p>${m.installments}x de ${money(m.installmentAmount)}${m.interest>0?` · Juros: ${money(m.interest)}`:''}</p></div><span class="amount money">${money(m.balance)}</span></div>`;}).join('')||'<div class="empty">Nenhuma dívida em aberto. 🌱</div>'}</section></div>`;}
function categoryIcon(t){const ic=t.type==='income'?'wallet':t.category==='Alimentação'?'food':t.category==='Transporte'?'car':t.category==='Moradia'?'house':'bag';const cls=t.type==='income'?'receita':t.category==='Alimentação'?'alimentacao':t.category==='Transporte'?'transporte':t.category==='Moradia'?'moradia':'';return `<span class="category-icon ${cls}">${icon(ic)}</span>`;}
function transactionTable(list,full=false){return `<table class="transaction-table ${full?'full-table':''}"><thead><tr><th>Descrição</th><th class="category-column">Categoria</th><th>Data</th><th>Valor</th></tr></thead><tbody>${list.map(t=>`<tr><td><div class="transaction-name">${categoryIcon(t)}<div><strong>${e(t.name)}</strong><small>${t.type==='income'?'Entrada':'Saída'}${t.linked?' · vinculado':''}${t.import_account?' · '+e(t.import_account):''}</small>${t.import_sheet&&t.import_cell?`<small>Origem ${e(t.import_sheet)}!${e(t.import_cell)}</small>`:''}</div></div></td><td class="category-column"><span class="tag">${e(t.category)}</span></td><td class="muted">${new Date(t.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','')}</td><td><div class="row-actions"><span class="amount money ${t.type==='income'?'positive':''}">${t.type==='income'?'+':'−'} ${money(t.amount)}</span>${full&&!t.linked?`<button class="delete-button" data-delete="${e(t.id)}" aria-label="Excluir ${e(t.name)}">${icon('trash')}</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="4"><div class="empty">Nenhum lançamento neste período.<br>Comece registrando uma receita ou despesa.</div></td></tr>'}</tbody></table>`;}
function goalMini(g){const p=Math.min(100,Math.round(g.saved/g.target*100));return `<div><div class="goal-top"><span class="goal-emoji">${e(g.emoji)}</span><div><h3>${e(g.name)}</h3><p>${p===100?'Objetivo alcançado!':'Seu futuro agradece'}</p></div><span class="percentage">${p}%</span></div><div class="progress"><span style="width:${p}%"></span></div><div class="goal-values"><b class="money">${money(g.saved)}</b><span class="money">de ${money(g.target)}</span></div></div>`;}
function currentSpendingReport(){
 const today=dateISO();
 const reference=month===today.slice(0,7)?today:`${month}-01`;
 return spendingReport(data,spendingPeriod,spendingAnchor?.month===month?spendingAnchor.date:reference);
}
function spendingResults({from,to,rows,total}){
 const formatDate=date=>date.split('-').reverse().join('/');
 const budget=data.profile.monthly_budget;
 return `<div class="spending-summary">
  <p class="panel-subtitle">${formatDate(from)} a ${formatDate(to)}</p>
  <div class="spending-total"><span>Total em despesas</span><strong class="money">${money(total)}</strong></div>
  ${spendingPeriod==='month'&&budget?`<span class="insight-tag">${Math.round(total/budget*100)}% do orçamento mensal</span>`:''}
 </div>${rows.length?`<ol class="spending-ranking" aria-label="Categorias em ordem de gasto">${rows.map(([category,amount])=>{
   const share=total?amount/total*100:0;
   const percent=share>0&&share<1?'&lt;1%':`${Math.round(share)}%`;
   return `<li>
    <div class="spending-row"><span>${e(category)}</span><strong class="money">${money(amount)}</strong></div>
    <div class="spending-share"><div class="progress" aria-hidden="true"><span style="width:${share}%"></span></div><small>${percent}</small></div>
   </li>`;
  }).join('')}</ol>`:'<p class="empty">Nenhuma despesa registrada neste período.</p>'}`;
}
function spendingPanel(){
 return `<section class="panel spending-panel" aria-labelledby="spending-title">
  <div class="panel-header"><div><h2 id="spending-title">Onde você mais gastou</h2><p class="panel-subtitle">Despesas pessoais por categoria</p></div></div>
  <div class="spending-controls">
   <select id="spending-period" aria-label="Período dos gastos">${Object.entries(spendingPeriods).map(([key,label])=>`<option value="${key}" ${key===spendingPeriod?'selected':''}>${label}</option>`).join('')}</select>
   <div class="period">
    <button type="button" data-spending-step="previous" aria-label="Período anterior">${icon('left')}</button>
    <button type="button" data-spending-step="next" aria-label="Próximo período">${icon('chevron')}</button>
   </div>
  </div>
  <div id="spending-results" aria-live="polite">${spendingResults(currentSpendingReport())}</div>
 </section>`;
}
function updateSpendingResults(){
 const results=$('#spending-results');
 if(results)results.innerHTML=spendingResults(currentSpendingReport());
}
function transactions(){return `<section class="panel">${panelHeader('Lançamentos pessoais',e(monthLabel()))}<div class="filter-bar"><label class="search">${icon('search')}<input class="input" id="search" placeholder="Buscar um lançamento…" aria-label="Buscar lançamento"></label><select id="type-filter" aria-label="Filtrar por tipo"><option value="all">Todas as movimentações</option><option value="expense" ${transactionType==='expense'?'selected':''}>Saídas</option><option value="income" ${transactionType==='income'?'selected':''}>Entradas</option></select><select id="category-filter" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${categoryOptions(data,'personal')}</select><button type="button" class="button secondary" data-categories="personal">Categorias</button></div><div id="transaction-results">${transactionTable(totals(data,month).list.filter(t=>transactionType==='all'||t.type===transactionType).sort((a,b)=>b.date.localeCompare(a.date)),true)}</div></section>`;}
function goals(){return `<div class="tip">${icon('leaf')}<div><strong>Cada objetivo começa com um passo.</strong><br>Ao guardar dinheiro, a Alva atualiza sua meta e registra a saída no seu saldo. Acompanhe as perguntas da assistente para manter seu plano funcional e eficaz.</div></div><div class="content-grid">${data.goals.map(g=>{const p=Math.min(100,Math.round(g.saved/g.target*100));const rem=Math.max(0,g.target-g.saved);const due=g.deadline?new Date(String(g.deadline).includes('T')?g.deadline:`${g.deadline}T12:00:00`):null;const dLabel=due&&!isNaN(due.getTime())?'Até '+due.toLocaleDateString('pt-BR'):'No seu tempo';return `<section class="panel large-goal"><div class="goal-card-top"><span class="goal-emoji">${e(g.emoji)}</span><div class="row-actions"><button class="delete-button" data-delete-goal="${e(g.id)}" aria-label="Excluir objetivo ${e(g.name)}" title="Excluir objetivo">${icon('trash')}</button></div></div><h2>${e(g.name)}</h2><p class="panel-subtitle">${dLabel} · ${p}% conquistado · ${rem>0?`Falta ${money(rem)}`:'Concluído!'}</p><div class="progress"><span style="width:${p}%"></span></div><div class="goal-values"><b class="money">${money(g.saved)}</b><span class="money">de ${money(g.target)}</span></div><div class="goal-card-actions"><button class="button secondary" data-contribute="${e(g.id)}" ${g.saved>=g.target?'disabled':''}>${icon(g.saved>=g.target?'check':'plus')}${g.saved>=g.target?'Objetivo alcançado':'Guardar para este objetivo'}</button><button class="button ghost" data-goal-plan="${e(g.id)}" title="Ver perguntas e plano da assistente">${icon('spark')}Perguntas da Alva</button></div></section>`;}).join('')||'<section class="panel empty">Crie seu primeiro objetivo.<br>Uma viagem, uma reserva ou um novo começo.</section>'}</div>`;}
function debts(){
 const t=totals(data,month);
 return `<div class="tip">${icon('debt')}<div><strong class="money">${money(t.debt)} em dívidas em aberto</strong>${t.debtInterest>0?` · <span class="debt-interest-inline money">${money(t.debtInterest)} em juros calculados</span>`:''}<br>Informe a quantidade de parcelas e o valor da parcela: a Alva calcula automaticamente quanto você está pagando de juros.</div></div><div class="content-grid">${[...data.debts].sort((a,b)=>(b.balance>0)-(a.balance>0)||a.due.localeCompare(b.due)).map(d=>{
  const m=debtMetrics(d);
  const pctStr=m.interestPct.toFixed(1).replace('.',',');
  return `<section class="panel debt-card">${panelHeader(e(d.name),`${m.installments}x de ${money(m.installmentAmount)}`,`<div class="row-actions"><span class="tag">${m.balance?'Em andamento':'Quitada'}</span><button class="delete-button" data-delete-debt="${e(d.id)}" aria-label="Excluir ${e(d.name)}" title="Excluir dívida">${icon('trash')}</button></div>`)}<div class="debt-total money">${money(m.balance)}</div><div class="progress"><span style="width:${Math.max(0,(1-m.balance/Math.max(1,m.total))*100)}%"></span></div><div class="detail"><span>Parcelas (${m.installments}x)</span><b class="money">${m.installments}x de ${money(m.installmentAmount)}</b></div><div class="detail"><span>Valor sem juros (original)</span><b class="money">${money(m.principal)}</b></div><div class="detail"><span>Total parcelado</span><b class="money">${money(m.total)}</b></div><div class="detail debt-interest-row"><span>Juros que estou pagando</span><b class="debt-interest-pill ${m.interest>0?'warning':'ok'} money">${m.interest>0?`${money(m.interest)} (+${pctStr}%)`:'R$ 0,00 (Sem juros)'}</b></div><div class="detail"><span>Já pago</span><b class="money">${money(m.paid)}</b></div><div class="detail"><span>Vencimento</span><b>${new Date(d.due+'T12:00:00').toLocaleDateString('pt-BR')}</b></div><button class="button secondary" data-pay="${e(d.id)}" ${!m.balance?'disabled':''}>${icon(m.balance?'check':'leaf')}${m.balance?'Registrar pagamento':'Dívida quitada'}</button>${m.balance?`<button class="button ghost" type="button" data-debt-plan="${e(d.id)}">Simular quitação</button>`:''}</section>`;
 }).join('')||'<section class="panel empty">Nenhuma dívida cadastrada.<br>Adicione um compromisso para acompanhar as parcelas e os juros.</section>'}</div><p class="form-note">Os juros são calculados automaticamente comparando (Quantidade de parcelas × Valor da parcela) com o valor original sem juros.</p>`;
}
function investments(){const t=totals(data,month);return `<div class="investment-grid"><section class="panel">${panelHeader('Seu patrimônio investido','Valores informados por você')}<div class="debt-total money">${money(t.invested)}</div>${data.investments.map(i=>`<div class="next-bill"><span class="category-icon receita">${icon('invest')}</span><div class="bill-info">${e(i.name)}<p>${e(i.kind)}</p></div><span class="amount money">${money(i.amount)}</span></div>`).join('')||'<p class="empty">Registre seus investimentos para acompanhar o patrimônio.</p>'}<div class="notice">Os valores não são atualizados por cotações. Registrar um investimento adiciona uma saída no seu saldo; o saldo inicial deve considerar valores anteriores.</div></section><section class="panel">${panelHeader('E se você começasse hoje?','Simule um cenário com os seus próprios números')}<form method="post" id="simulator" class="form-grid"><label class="field">Valor inicial (R$)<input class="input" name="initial" type="number" min="0" max="100000000" value="1000" step="0.01" required></label><label class="field">Aporte mensal (R$)<input class="input" name="monthly" type="number" min="0" max="1000000" value="300" step="0.01" required></label><label class="field">Taxa hipotética (% ao ano)<input class="input" name="rate" type="number" min="0" max="100" value="6" step="0.1" required></label><label class="field">Prazo (anos)<input class="input" name="years" type="number" min="1" max="50" value="5" step="1" required></label></form><div id="simulation-output"></div><p class="form-note">Cenário ilustrativo, com aportes ao fim de cada mês. Valores brutos, sem impostos, taxas e inflação. A taxa é uma hipótese, sem garantia de retorno.</p></section></div>`;}
function voiceControls(){
 const {phase}=voice.state;
 const listening=phase==='recording';
 const busy=phase!=='idle'&&!listening;
 return `<button class="button secondary chat-mic ${listening?'voice-active':''}" type="button" data-action="voice-record"
   aria-label="${listening?'Finalizar gravação':'Gravar áudio'}" aria-pressed="${listening}" ${busy?'disabled':''}>
   ${icon('mic')}<span class="chat-send-label">${listening?'Finalizar':'Áudio'}</span></button>`;
}
function voiceStatus(){
 const {phase,message,canRetry}=voice.state;
 if(!message)return '';
 return `<div class="voice-status-bar"><span role="status">${e(message)}</span>
  ${phase!=='idle'?'<button type="button" class="button secondary mini-action" data-action="voice-cancel">Cancelar</button>':''}
  ${canRetry?'<button type="button" class="button secondary mini-action" data-action="voice-retry">Reenviar áudio</button>':''}
 </div>`;
}
function updateVoiceUI(){
 if(authVisible||view!=='assistant')return;
 const mic=$('[data-voice-control]'), status=$('[data-voice-status]');
 if(mic){
  const button=mic.querySelector('button');
  const listening=voice.state.phase==='recording';
  button.disabled=voice.state.phase!=='idle'&&!listening;
  button.classList.toggle('voice-active',listening);
  button.setAttribute('aria-pressed',String(listening));
  button.setAttribute('aria-label',listening?'Finalizar gravação':'Gravar áudio');
  button.querySelector('.chat-send-label').textContent=listening?'Finalizar':'Áudio';
 }
 if(status)status.innerHTML=voiceStatus();
}

function assistant(){
 const questions=['Quanto gastei este mês?','O que merece atenção?','Como está o caixa do negócio?','Como estão minhas dívidas?'];
 return `<div class="chat-layout">
  <section class="panel chat-panel">
   <div class="chat-header"><span class="agent-mark">${icon('spark')}</span><div><h2>Sua assistente Alva</h2><p>Converse por texto, áudio ou planilha</p></div></div>
   <div class="chat-messages" id="chat-messages" aria-live="polite">${messages.map(m=>`<div class="message ${m.role}">${e(m.content)}</div>`).join('')}${chatBusy?'<div class="message assistant typing" role="status"><span class="visually-hidden">Alva está preparando a resposta.</span><span class="page-busy" aria-hidden="true"><i></i><i></i><i></i></span></div>':''}</div>
   <div data-voice-status>${voiceStatus()}</div>
   <form method="post" id="chat-form" class="chat-input" autocomplete="off">
    <button class="button secondary chat-attach" type="button" data-action="import-file" aria-label="Anexar planilha">${icon('clip')}<span class="chat-send-label">Anexar</span></button>
    <span data-voice-control>${voiceControls()}</span>
    <input class="input" name="message" autocomplete="off" placeholder="Ex.: Gastei 50 no mercado" maxlength="2000" aria-label="Mensagem para a Alva" required>
    <button class="button" type="submit" ${chatBusy?'disabled':''} aria-label="Enviar mensagem">${icon('arrow')}<span class="chat-send-label">Enviar</span></button>
   </form>
   <div class="voice-tools"><button type="button" class="text-button" data-action="voice-file">${icon('upload')}Anexar áudio</button>
    ${(window.SpeechRecognition||window.webkitSpeechRecognition)?'<button type="button" class="text-button" data-action="voice-native">Ditado do navegador</button>':''}</div>
  </section>
  <aside class="chat-context">
   <section class="panel">${panelHeader('Fale com a Alva','Confira a transcrição e os valores antes de salvar')}
    <p class="form-note">Por exemplo, diga “Gastei 45 reais e 90 centavos na padaria”. Se o microfone estiver bloqueado, abra as permissões do site, anexe uma gravação ou digite.</p>
   </section>
   <section class="panel" style="margin-top:16px">${panelHeader('Um bom começo','Escolha um assunto para conversar')}
    <div class="chat-suggestions">${questions.map(q=>`<button class="suggestion" data-question="${e(q)}">${e(q)} ${icon('spark')}</button>`).join('')}</div>
   </section>
  </aside>
 </div>`;
}
function settings(){return `<div class="settings-layout"><section class="panel">${panelHeader('Meu perfil e alertas','Sua foto de perfil e preferências de avisos')}<form method="post" id="profile-form"><div class="avatar-picker-row"><button type="button" class="avatar avatar-lg" data-action="pick-avatar" title="Trocar foto de perfil" aria-label="Escolher foto de perfil">${avatarHTML()}</button><div class="avatar-picker-info"><strong>Foto de perfil</strong><small>Escolha uma foto do seu celular ou computador</small><div class="avatar-picker-btns"><button class="button secondary mini-action" type="button" data-action="pick-avatar">${icon('camera')}Escolher foto</button>${data.avatar_photo?`<button class="button ghost mini-action" type="button" data-action="remove-avatar">${icon('trash')}Remover</button>`:''}</div></div></div><div class="form-grid"><label class="field full">Seu nome<input class="input" name="name" value="${e(data.profile.name)}" maxlength="70" required></label><label class="field">Orçamento mensal (R$)<input class="input" type="number" min="0" max="100000000" step="0.01" name="budget" value="${numeric(data.profile.monthly_budget)}" required></label><label class="field">Saldo inicial (R$)<input class="input" type="number" min="-100000000" max="100000000" step="0.01" name="opening" value="${numeric(data.profile.opening_balance)}" required></label><label class="field">WhatsApp para alertas (com DDD)<input class="input" name="whatsapp" value="${e(data.profile.alert_whatsapp||'')}" placeholder="Ex.: 11999999999" maxlength="30"></label><div class="field full"><button class="button secondary" type="button" data-nav="notices">${icon('mail')}Configurar e-mail na Central de avisos</button></div></div><p>Quando seus gastos chegarem no limite estipulado para um item ou categoria, a Alva dispara o aviso automaticamente no WhatsApp e no E-mail.</p><button class="button" type="submit">${icon('check')}Salvar perfil e alertas</button></form><div class="connection-state">${icon('lock')}${demo?'Perfil de demonstração':'Conta pessoal autenticada'}</div></section><section class="panel">${panelHeader('Minha conta',demo?'Seu espaço pessoal começa pelo e-mail':'Seu acesso à Alva')}${demo?`<p>Crie sua conta com e-mail e uma senha pessoal. Os lançamentos de exemplo ficam na demonstração; sua conta começa com os seus números.</p><button class="button" data-action="login">${icon('mail')}Criar minha conta</button>`:`<p>${icon('mail')} ${e(api.session?.user?.email||'E-mail cadastrado')}</p><p>A Alva lembra sua sessão neste navegador. Use o botão abaixo para sair da conta.</p><button class="button ghost" data-action="logout">Sair da minha conta</button>`}</section><section class="panel">${panelHeader('Seus dados, com você','Importe ou exporte quando quiser')}<p>Traga sua planilha (.xlsx, .csv) ou extrato (.ofx) para atualizar o painel automaticamente, ou baixe seus lançamentos em CSV.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="button" type="button" data-action="import-file">${icon('upload')}Importar planilha</button><button class="button secondary" type="button" data-action="export">${icon('download')}Exportar lançamentos</button></div></section><section class="panel">${panelHeader('Sobre a Alva','Seu dinheiro, com clareza')}<p>Um espaço para cuidar do seu dia a dia, acompanhar sonhos, calcular juros das dívidas e controlar limites de gastos.</p><p>${demo?'Demonstração com armazenamento neste navegador.':'Conta pessoal com dados sincronizados.'}</p></section></div>`;}
function modal(title,body,formId='record-form',submit='Salvar'){const opener=document.activeElement;const m=$('#modal');m.innerHTML=`<div class="modal-header"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon('close')}</button></div>${formId?`<form method="post" id="${formId}" autocomplete="off">${body}<p class="form-error" id="modal-error" role="alert"></p><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancelar</button><button class="button" type="submit">${submit}</button></div></form>`:body}`;if(!m.open)m.showModal();animateModal(m,opener);}
const inputField=(label,name,type='text',value='',attrs='')=>`<label class="field">${label}<input class="input" name="${name}" type="${type}" value="${e(value)}" autocomplete="off" ${attrs} required></label>`;
function updateDebtPreview(){
 const box=$('#debt-interest-preview');if(!box)return;
 const form=box.closest('form');if(!form)return;
 const inst=Math.max(1,Math.round(Number(form.querySelector('[name="installments"]')?.value)||1));
 const instVal=Math.max(0,Number(String(form.querySelector('[name="installment_amount"]')?.value||form.querySelector('[name="amount"]')?.value||'0').replace(',','.'))||0);
 const origVal=Math.max(0,Number(String(form.querySelector('[name="principal"]')?.value||'0').replace(',','.'))||0);
 const paidInst=Math.max(0,Math.min(inst,Math.round(Number(form.querySelector('[name="paid_installments"]')?.value)||0)));
 const totalCents=Math.round(inst*instVal*100);
 const principalCents=origVal>0?Math.round(origVal*100):totalCents;
 const interestCents=Math.max(0,totalCents-principalCents);
 const pct=principalCents>0?((interestCents/principalCents)*100):0;
 const monthlyPct=inst>0?pct/inst:0;
 const balanceCents=Math.max(0,totalCents-Math.round(paidInst*instVal*100));
 box.innerHTML=`<div class="debt-calc-row"><span>Total das parcelas (${inst}x de ${money(Math.round(instVal*100))})</span><b class="money">${money(totalCents)}</b></div><div class="debt-calc-row"><span>Valor original (sem juros)</span><b class="money">${money(principalCents)}</b></div><div class="debt-calc-row highlight"><span>Quanto você está pagando de juros</span><b class="${interestCents>0?'negative':'positive'} money">${interestCents>0?`${money(interestCents)} (+${pct.toFixed(1).replace('.',',')}% · ~${monthlyPct.toFixed(2).replace('.',',')}%/mês)`:'R$ 0,00 (Sem juros!)'}</b></div><div class="debt-calc-row"><span>Saldo em aberto atual</span><b class="money">${money(balanceCents)}</b></div>`;
}
function openCategories(area){
 const saved=customCategories(data,area);
 const list=(type,label)=>{
  const names=saved.filter(item=>item.type===type).map(item=>e(item.name));
  return names.length?`<p class="form-note"><strong>${label}</strong> · ${names.join(', ')}</p>`:'';
 };
 modal(area==='business'?'Categorias do negócio':'Categorias pessoais',
  `<p class="form-note">Crie categorias para organizar seus lançamentos.</p>
  <input type="hidden" name="area" value="${area}">
  <div class="form-grid">
   <label class="field">Tipo<select name="type"><option value="expense">Saída</option><option value="income">Entrada</option></select></label>
   ${inputField('Nome','name','text','',`maxlength="${categoryNameLimit}" placeholder="Ex.: Cinema ou Comissões"`)}
  </div>${list('expense','Saídas')}${list('income','Entradas')}`,
  'category-form','Criar categoria');
}
async function submitCategory(form){
 const fields=Object.fromEntries(new FormData(form));
 await commit(next=>addCustomCategory(next,fields),'Categoria criada.');
}
function recordModal(kind,id){let body='';const common=`<input type="hidden" name="kind" value="${kind}"><input type="hidden" name="id" value="${e(id||'')}">`;
 if(kind==='transaction'){const t=data.transactions.find(t=>t.id===id);body=`<div class="form-grid"><label class="field full">Descrição<input class="input" name="record_title" autocomplete="off" autocorrect="off" spellcheck="false" value="${e(t?.name||'')}" placeholder="Ex.: mercado da semana" maxlength="100" required></label>${inputField('Valor (R$)','amount','number',t?numeric(t.amount):'','min="0.01" max="100000000" step="0.01"')}<label class="field">Tipo<select name="type"><option value="expense" ${t?.type==='expense'?'selected':''}>Saída</option><option value="income" ${t?.type==='income'?'selected':''}>Entrada</option></select></label>${categoryField(data,'personal',t?.type||'expense',t?.category)}${inputField('Data','date','date',t?.date||dateISO(),`max="${dateISO()}"`)}</div>`;}
 if(kind==='goal')body=`<div class="form-grid"><label class="field full">O que você quer conquistar?<input class="input" name="record_title" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="Ex.: minha reserva de emergência" required></label>${inputField('Quanto quer juntar? (R$)','amount','number','','min="0.01" max="100000000" step="0.01"')}<label class="field">Símbolo<select name="emoji"><option>🌱</option><option>✈️</option><option>🏡</option><option>🎓</option><option>🚗</option><option>💻</option><option>✨</option></select></label><label class="field full">Prazo (opcional)<input class="input" name="deadline" type="date" min="${dateISO()}"></label></div>`;
 if(kind==='debt')body=`<div class="form-grid"><label class="field full">Nome da dívida<input class="input" name="record_title" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="Ex.: Cartão de crédito, Financiamento, Notebook" required></label>${inputField('Valor original sem juros (R$)','principal','number','','min="0.01" max="100000000" step="0.01" placeholder="Ex.: 1000.00"')}${inputField('Quantidade de parcelas','installments','number','6','min="1" max="360" step="1"')}${inputField('Valor de cada parcela (R$)','installment_amount','number','','min="0.01" max="100000000" step="0.01" placeholder="Ex.: 200.00"')}<label class="field">Parcelas já pagas<input class="input" name="paid_installments" type="number" min="0" max="359" step="1" value="0"></label>${inputField('Próximo vencimento','due','date',dateISO())}</div><div id="debt-interest-preview" class="debt-calc-box" aria-live="polite"></div><p class="form-note">Ao informar a quantidade de parcelas e o valor da parcela, a Alva calcula automaticamente quanto de juros você está pagando.</p>`;
 if(kind==='limit')body=`<div class="form-grid"><label class="field full">O que você quer limitar?<input class="input" name="record_title" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="Ex.: Uber, iFood, Mercado, Lazer, Roupas…" required></label>${inputField('Limite máximo no mês (R$)','amount','number','','min="0.01" max="100000000" step="0.01" placeholder="Ex.: 300.00"')}<label class="field">Categoria relacionada<select name="category">${categoryOptions(data,'personal','expense')}</select></label><label class="field">Como monitorar?<select name="scope"><option value="any">Pelo nome ou categoria</option><option value="keyword">Apenas gastos com esse nome</option><option value="category">Toda a categoria selecionada</option></select></label></div><p class="form-note">A Alva registra avisos ao atingir 80% e 100% do limite. Configure o e-mail na Central de avisos.</p>`;
 if(kind==='investment')body=`<div class="form-grid"><label class="field full">Nome do investimento<input class="input" name="record_title" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="Ex.: aporte para o futuro" required></label>${inputField('Valor aplicado (R$)','amount','number','','min="0.01" max="100000000" step="0.01"')}<label class="field">Categoria<select name="category"><option>Renda fixa</option><option>Fundos</option><option>Ações</option><option>Outros</option></select></label></div><p class="form-note">Este registro também cria uma saída na categoria Investimentos, com a data de hoje.</p>`;
 if(kind==='contribute'||kind==='pay'){const item=(kind==='pay'?data.debts:data.goals).find(x=>x.id===id);const remaining=kind==='pay'?item.balance:Math.max(0,item.target-item.saved);const defaultPay=kind==='pay'?numeric(Math.min(remaining,debtMetrics(item).installmentAmount||remaining)):'';body=`<p class="muted" style="margin-bottom:20px;font-size:12px">${e(item.name)} · ${kind==='pay'?'Em aberto':'Falta juntar'}: <b class="money">${money(remaining)}</b></p>${inputField(kind==='pay'?'Valor pago (R$)':'Valor para guardar (R$)','amount','number',defaultPay,`min="0.01" max="${numeric(remaining)}" step="0.01"`)}<p class="form-note">O valor será registrado como saída no seu saldo. A ${kind==='pay'?'dívida':'meta'} será atualizada na mesma operação.</p>`;}
 modal({transaction:id?'Editar lançamento':'Novo lançamento',goal:'Um novo objetivo',debt:'Adicionar dívida e calcular juros',limit:'Limitar gasto específico',investment:'Registrar investimento',contribute:'Mais perto do seu sonho',pay:'Registrar pagamento'}[kind],common+body,'record-form',kind==='contribute'?'Guardar agora':kind==='pay'?'Registrar pagamento':kind==='limit'?'Ativar limite e alerta':'Salvar');
 if(kind==='debt')updateDebtPreview();
}
function openGoalPlanModal(goal){
 const remaining=Math.max(0,Number(goal?.target||0)-Number(goal?.saved||0));
 const byCat=budgetBreakdown(data,month);
 const top=byCat[0];
 let diffMonths=12,deadlineLabel='';
 if(goal?.deadline){
  const due=new Date(String(goal.deadline).includes('T')?goal.deadline:`${goal.deadline}T12:00:00`);
  if(!isNaN(due.getTime())){
   const now=new Date();
   diffMonths=Math.max(1,Math.round((due-now)/(1000*60*60*24*30.44)));
   deadlineLabel=due.toLocaleDateString('pt-BR');
  }
 }
 const monthlyNeeded=Math.ceil(remaining/diffMonths);
 const weeklyNeeded=Math.ceil(monthlyNeeded/4);
 modal(`Plano para seu objetivo 🌱`,`<div class="goal-coaching-box"><div class="goal-coaching-header"><span class="goal-emoji">${e(goal?.emoji||'🎯')}</span><div><h3>${e(goal?.name||'Objetivo')}</h3><p>Meta: <b class="money">${money(goal?.target||0)}</b>${deadlineLabel?` · Prazo: ${deadlineLabel}`:''}</p></div></div><p class="goal-coaching-intro">A Alva montou <b>4 perguntas práticas</b> para ajudar você a poupar com constância e tornar este objetivo funcional e eficaz:</p><div class="goal-coaching-cards"><div class="goal-coaching-card"><div class="coaching-step">1</div><div class="coaching-body"><strong>Qual ritmo cabe no seu mês? (Parcela do Sonho)</strong><p>${deadlineLabel?`Para alcançar até ${deadlineLabel} (~${diffMonths} meses), você precisa guardar cerca de <b class="money">${money(monthlyNeeded)}/mês</b> (ou <b class="money">${money(weeklyNeeded)}/semana</b>).`:`Em 6 meses: <b class="money">${money(Math.ceil(remaining/6))}/mês</b><br>Em 12 meses: <b class="money">${money(Math.ceil(remaining/12))}/mês</b><br>Em 24 meses: <b class="money">${money(Math.ceil(remaining/24))}/mês</b>.`}</p></div></div><div class="goal-coaching-card"><div class="coaching-step">2</div><div class="coaching-body"><strong>De onde virá o dinheiro? (Corte inteligente)</strong><p>${top?`Sua maior saída no mês é com <b>${e(top[0])}</b> (${money(top[1])}). Reduzir 15% nela já libera <b class="money">${money(Math.round(top[1]*0.15))}/mês</b> direto para sua meta!`:`Dica da Alva: analise gastos que você quase não percebe (delivery, pequenos lanches, assinaturas paradas).`}</p></div></div><div class="goal-coaching-card"><div class="coaching-step">3</div><div class="coaching-body"><strong>Quando separar? (Regra do Pague-se Primeiro)</strong><p>Guarde o valor da sua meta <b>no mesmo dia em que o seu dinheiro cair na conta</b>, antes de começar a gastar. Quem se paga primeiro tem 3x mais chance de concluir!</p></div></div><div class="goal-coaching-card"><div class="coaching-step">4</div><div class="coaching-body"><strong>Quer dar o primeiro passo hoje?</strong><p>Guardar qualquer valor agora (mesmo R$ 20 ou R$ 50) ativa o hábito no seu cérebro e faz a barra de progresso andar.</p></div></div></div><div class="modal-actions" style="margin-top:20px;flex-direction:column;gap:8px"><button class="button" type="button" data-nav-assistant-goal="${e(goal?.name||'')}">${icon('spark')}Conversar com a Alva sobre esse objetivo</button><button class="button secondary" type="button" data-contribute="${e(goal?.id||'')}">${icon('plus')}Guardar primeira quantia agora</button><button class="button ghost" type="button" data-action="close-modal">Fechar e ver Meus objetivos</button></div></div>`,'');
}
function openLimitAlertModal(limit){
 const title=limit.exceeded?'Limite atingido':'Perto do limite';
 modal(`${title} · ${e(limit.name)}`,`<div class="limit-item ${limit.status}"><div class="limit-top"><div><strong>${e(limit.name)}</strong><small>${e(limit.category)}</small></div><span class="limit-badge ${limit.status}">${limit.pct}% do limite</span></div><div class="progress ${limit.status}"><span style="width:${Math.min(100,limit.pct)}%"></span></div><div class="goal-values"><b class="money">Gasto: ${money(limit.spent)}</b><span class="money">Limite: ${money(limit.limit)}</span></div></div><div class="modal-actions"><button class="button secondary" type="button" data-action="notifications">Abrir Central de avisos</button></div>`,'');
}

async function commit(change,success='Salvo com sucesso.'){
 if(saving)throw new Error('Aguarde a operação atual terminar.');
 saving=true;
 const owner=data;
 const ownerIsDemo=demo;
 const ownerId=api.session?.user?.id;
 const observedMonth=noticeDate().slice(0,7);
 const next=structuredClone(owner);
 const stillCurrent=()=>data===owner&&!authVisible&&demo===ownerIsDemo&&(ownerIsDemo||api.session?.user?.id===ownerId);
 try{
  await change(next);
  if(!stillCurrent())throw new Error('A conta mudou. Abra a tela novamente antes de salvar.');
  normalizeState(next,ownerIsDemo);
  const alerts=crossedLimits(owner,next,observedMonth);
  if(ownerIsDemo)recordDemoNotices(next,alerts,observedMonth);
  let nextRevision=revision;
  if(ownerIsDemo)localStorage.setItem(DEMO_KEY,JSON.stringify(next));
  else nextRevision=await api.saveAccount(next,revision);
  if(!stillCurrent())throw new Error('A conta mudou durante o salvamento.');
  revision=nextRevision;
  data=next;saving=false;$('#modal').close();shell();postRender();toast(success);
  if(alerts.length&&!ownerIsDemo){
   void api.noticeChannel('flush').catch(()=>{});
   void noticeUI.refresh();
   const whatsapp=alerts.find(limit=>limit.channel!=='email');
   if(whatsapp&&next.profile.alert_whatsapp)void api.sendAlertNotification(whatsapp.id,{whatsappOnly:true});
  }
 }finally{saving=false;}
}

function formError(err,form){let msg=err.message||'Não foi possível salvar. Tente novamente.';if(/revision_conflict/.test(msg))msg='Há alterações feitas em outra aba ou dispositivo. Recarregue a página para atualizar os dados antes de salvar.';if(/Invalid login credentials/.test(msg))msg='E-mail ou senha incorretos. Confira seus dados.';const target=form?.querySelector('.form-error')||($('#modal')?.open?$('#modal-error'):null);if(target)target.textContent=msg;else toast(msg);}
async function submitRecord(form){
 const f=Object.fromEntries(new FormData(form));
 const itemName=String(f.record_title??f.name??'').trim();
 const amount=f.kind==='debt'?cents(f.installment_amount||f.amount||f.principal):cents(f.amount);
 let newCreatedGoal=null;
 await commit(next=>{
  const id=crypto.randomUUID();
  if(f.kind==='transaction'){
   if(!itemName)throw new Error('Informe uma descrição.');
   const t={id:f.id||id,name:itemName,amount,type:f.type,category:categoryForRecord(next,'personal',f),date:f.date};
   if(f.id){const idx=next.transactions.findIndex(t=>t.id===f.id&&!t.linked);if(idx<0)throw new Error('Lançamento não encontrado.');next.transactions[idx]={...next.transactions[idx],...t};}
   else next.transactions.push(t);
  }
  if(f.kind==='goal'){
   newCreatedGoal={id,name:itemName,target:amount,saved:0,emoji:f.emoji,deadline:f.deadline};
   next.goals.push(newCreatedGoal);
  }
  if(f.kind==='debt'){
   const inst=Math.max(1,Math.min(360,Math.round(Number(f.installments)||1)));
   const instAmt=f.installment_amount?cents(f.installment_amount):Math.round(amount/inst);
   const total=f.installment_amount?inst*instAmt:amount;
   const principal=f.principal?cents(f.principal):total;
   const paidInst=Math.max(0,Math.min(inst,Math.round(Number(f.paid_installments)||0)));
   const balance=Math.max(0,total-paidInst*instAmt);
   next.debts.push({id,name:itemName,principal,total,balance,installments:inst,installment_amount:instAmt,due:f.due});
  }
  if(f.kind==='limit'){
   if(!itemName)throw new Error('Informe o gasto ou categoria que deseja limitar.');
   if(f.whatsapp!==undefined)next.profile.alert_whatsapp=String(f.whatsapp||'').trim().slice(0,30);
   if(f.email!==undefined)next.profile.alert_email=String(f.email||'').trim().slice(0,120);
   if(f.channel)next.profile.alert_channel=f.channel;
   if(typeof Notification!=='undefined'&&Notification.permission==='default'){try{Notification.requestPermission();}catch{}}
   if(next.spending_limits.length>=100)throw new Error('Você já tem 100 limites. Exclua um para adicionar outro.');
   next.spending_limits.push({id,name:itemName.slice(0,80),category:f.category||'Outros',scope:f.scope||'any',limit:amount,channel:f.channel||'both'});
  }
  if(f.kind==='investment'){next.investments.push({id,name:itemName,amount,kind:f.category});next.transactions.push({id:crypto.randomUUID(),name:itemName,category:'Investimentos',type:'expense',amount,date:dateISO(),linked:id});}
  if(f.kind==='contribute'||f.kind==='pay'){const pay=f.kind==='pay',item=(pay?next.debts:next.goals).find(x=>x.id===f.id);if(!item)throw new Error('Registro não encontrado.');if(amount>(pay?item.balance:item.target-item.saved))throw new Error('O valor ultrapassa o saldo restante.');if(pay)item.balance-=amount;else item.saved+=amount;next.transactions.push({id:crypto.randomUUID(),name:`${pay?'Pagamento':'Objetivo'}: ${item.name}`,category:pay?'Dívidas':'Metas',amount,type:'expense',date:dateISO(),linked:item.id});}
 },f.kind==='contribute'?'Mais um passo para o seu objetivo! 🌱':f.kind==='pay'?'Pagamento registrado e dívida atualizada.':f.kind==='limit'?'Limite de gasto e alerta ativados!':f.kind==='goal'?'Objetivo criado com sucesso! 🌱':'Registro salvo com sucesso.');
 if(newCreatedGoal){
  messages.push({role:'assistant',content:formatGoalCoachingPlan(newCreatedGoal,data,month)});
  setTimeout(()=>{openGoalPlanModal(newCreatedGoal);},220);
 }
}
function filterTransactions(){const q=($('#search')?.value||'').toLowerCase(),type=$('#type-filter')?.value,category=$('#category-filter')?.value;const list=totals(data,month).list.filter(t=>t.name.toLowerCase().includes(q)&&(type==='all'||t.type===type)&&(!category||t.category===category)).sort((a,b)=>b.date.localeCompare(a.date));$('#transaction-results').innerHTML=transactionTable(list,true);attachEditButtons();}
function attachEditButtons(){if(view!=='transactions')return;$('#transaction-results')?.querySelectorAll('tbody tr').forEach(row=>{const del=row.querySelector('[data-delete]');if(del){const strong=row.querySelector('.transaction-name strong');strong.setAttribute('role','button');strong.tabIndex=0;strong.style.cursor='pointer';strong.title='Editar lançamento';strong.dataset.edit=del.dataset.delete;}});}
function simulate(){const form=$('#simulator');if(!form)return;const f=Object.fromEntries(new FormData(form));if(!form.checkValidity()){$('#simulation-output').innerHTML='<p class="form-error">Revise os valores para simular.</p>';return;}const r=projection(Math.round(Number(f.initial)*100),Math.round(Number(f.monthly)*100),Number(f.rate),Number(f.years));const max=Math.max(...r.points,1);$('#simulation-output').innerHTML=`<div class="simulation-result"><span class="muted" style="font-size:11px">Valor bruto no cenário escolhido</span><h3 class="money">${money(r.total)}</h3><div class="goal-values"><span class="money">Aportes: ${money(r.contributed)}</span><b class="money">Rendimento simulado: ${money(r.total-r.contributed)}</b></div><div class="simulation-bars" aria-label="Evolução anual do cenário">${r.points.map((p,i)=>`<div style="height:${Math.max(2,p/max*100)}%" title="Ano ${i}: ${money(p)}"></div>`).join('')}</div></div>`;animateSimulation();}
function exportCSV(){const rows=[['Descrição','Tipo','Categoria','Data','Valor'],...totals(data,month).list.map(t=>[t.name,t.type==='income'?'Entrada':'Saída',t.category,t.date,(t.type==='income'?1:-1)*t.amount/100])];const cell=v=>typeof v==='number'?String(v).replace('.',','):'"'+String(v).replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';const csv='\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`alva-lancamentos-${month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Planilha exportada.');}
async function handleFiles(fileList){
 const files=[...(fileList||[])];if(!files.length)return;
 const audioFiles=files.filter(isAudioFile);
 if(audioFiles.length){
  if(files.length!==1)throw new Error('Selecione um áudio por vez, separado das planilhas.');
  if(view!=='assistant')navigate('assistant');
  await voice.upload(audioFiles[0]);
  return;
 }
 const docFiles=files;
 if(!docFiles.length)return;
 if(docFiles.length>10||docFiles.reduce((size,file)=>size+file.size,0)>15*1024*1024)throw new Error('Selecione até 10 arquivos, com 15 MB no total.');
 const importAccount=data;
 const documents=[];
 for(const file of docFiles)documents.push(await readImportFile(file));
 if(authVisible||data!==importAccount)throw new Error('A conta mudou durante a leitura. Selecione o arquivo novamente.');
 importUI.open(documents,view==='business'?'business':'personal');
}
async function handleAvatarFile(file){
 if(!file||!/^image\//i.test(file.type||''))throw new Error('Escolha um arquivo de imagem (JPG, PNG, HEIC ou WebP).');
 const dataUrl=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>reject(new Error('Formato de imagem inválido.'));
   img.onload=()=>{
    const size=160;
    const canvas=document.createElement('canvas');
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');
    const minSide=Math.min(img.width||size,img.height||size);
    const sx=Math.max(0,((img.width||size)-minSide)/2);
    const sy=Math.max(0,((img.height||size)-minSide)/2);
    ctx.drawImage(img,sx,sy,minSide,minSide,0,0,size,size);
    resolve(canvas.toDataURL('image/jpeg',0.84));
   };
   img.src=String(reader.result||'');
  };
  reader.readAsDataURL(file);
 });
 await commit(next=>{next.avatar_photo=dataUrl;},'Foto de perfil atualizada! 📸');
}
function voiceAction(action){
 if(action==='voice-cancel')voice.cancel();
 else if(action==='voice-retry')void voice.retry();
 else if(action==='voice-file')$('#voice-file')?.click();
 else if(action==='voice-record'||action==='voice-native'){
  if(chatBusy){toast('Aguarde a resposta da Alva antes de gravar.');return true;}
  if(view!=='assistant')navigate('assistant');
  voice.toggle({cloud:demo?false:voiceCloud,nativeOnly:action==='voice-native'});
 }else return false;
 return true;
}

function openVoiceReview(text){
 voiceProposal=null;
 modal('Confira o que a Alva ouviu',
  `<p class="form-note">Corrija palavras e valores antes de continuar.</p>
   <label class="field">Transcrição do áudio<textarea class="input voice-transcript" name="transcript" required maxlength="2000" rows="4">${e(text.slice(0,2000))}</textarea></label>`,
  'voice-review-form','Continuar');
}

function voiceCommandRows(cmd){
 if(cmd.kind==='transaction')return [cmd.item];
 if(cmd.kind==='transactions')return cmd.items;
 return [];
}

function reviewVoice(text){
 if(!text)throw new Error('Preencha a transcrição antes de continuar.');
 const cmd=tryChatCommand(text,data,{strict:true});
 if(!cmd){$('#modal').close();void sendMessage(text,{readOnly:true});return;}
 if(cmd.kind.startsWith('delete-'))throw new Error('Para excluir um registro, abra o item e use a ação de excluir.');
 const transactions=voiceCommandRows(cmd);
 const item=cmd.item;
 const rows=transactions.length?transactions.map((t,i)=>`<li>
   <strong>${e(t.name)} · ${t.type==='income'?'Entrada':'Saída'}</strong>
   <small>${e(t.category)}</small><div class="form-grid">
    ${inputField('Valor (R$)',`voice_amount_${i}`,'number',numeric(t.amount),'min="0.01" max="100000000" step="0.01"')}
    ${inputField('Data',`voice_date_${i}`,'date',t.date,`max="${dateISO()}"`)}
   </div></li>`).join(''):`<li><strong>${e(item.name)}</strong>
    <small>${{debt:'Dívida',goal:'Meta',investment:'Investimento','spending-limit':'Limite de gastos'}[cmd.kind]}</small>
    <span class="money">${money(item.total??item.target??item.limit??item.amount)}</span>
    ${cmd.kind==='debt'?`<small class="money">${item.installments} parcelas de ${money(item.installment_amount)}</small>`:''}</li>`;
 voiceProposal={owner:data,cmd,text};
 modal('Revise antes de registrar',`<p class="form-note">Confira os dados que vão entrar na sua conta.</p>
   <ul class="voice-review-list">${rows}</ul>
   ${transactions.length?`<label class="field">Onde registrar<select name="destination"><option value="personal">Pessoal</option><option value="business">Meu negócio</option></select></label>
    ${transactions.some(t=>t.type==='income')?'<label class="field"><span><input type="checkbox" name="count_sales"> Se o destino for Meu negócio, somar entradas ao faturamento de vendas</span></label>':''}`:''}
   <button class="text-button" type="button" data-action="voice-edit">Editar transcrição</button>`,
  'voice-confirm-form','Confirmar registro');
}

async function confirmVoice(form){
 const proposal=voiceProposal;
 if(!proposal||proposal.owner!==data)throw new Error('Os dados mudaram. Revise a transcrição de novo antes de salvar.');
 const fields=new FormData(form);
 const transactions=voiceCommandRows(proposal.cmd).map((item,i)=>{
  const amount=cents(fields.get(`voice_amount_${i}`));
  const date=String(fields.get(`voice_date_${i}`));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>dateISO())throw new Error('Revise a data de cada lançamento.');
  return {...item,amount,date};
 });
 const business=fields.get('destination')==='business';
 await commit(next=>{
  if(transactions.length){
   if(!business){next.transactions.push(...transactions);return;}
   for(const item of transactions)addBusinessRecord(next,{
    ...item,status:'paid',due_date:item.date,paid_date:item.date,counterparty:'',
    category:'Outros',counts_as_sale:item.type==='income'&&fields.get('count_sales')==='on'
   });
  }else applyChatCommand(next,proposal.cmd);
 },'Registro confirmado e salvo.');
 voiceProposal=null;
 if(!authVisible){
  messages.push({role:'user',content:`🎙️ ${proposal.text}`});
  messages.push({role:'assistant',content:transactions.length?
   `${transactions.length} ${transactions.length===1?'movimentação registrada':'movimentações registradas'} em ${business?'Meu negócio':'Pessoal'}.`:'Registro salvo na sua conta.'});
  if(view==='assistant'){shell();postRender();}
 }
}

function assistantMonth(question){
 const today=noticeDate();
 const text=question.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 if(/\b(?:mes passado|mes anterior)\b/.test(text)){
  const day=new Date(`${today.slice(0,7)}-01T12:00:00Z`);
  day.setUTCMonth(day.getUTCMonth()-1);
  return day.toISOString().slice(0,7);
 }
 return /\b(?:este mes|nesse mes|neste mes|mes atual)\b/.test(text)?today.slice(0,7):month;
}

function priorityAnswer(question){
 const text=question.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
 if(!/\b(?:o que merece atencao|vencem esta semana|vence esta semana|prioridades hoje)\b/.test(text))return '';
 const plan=attentionPlan(data);
 return plan.length?`No seu radar, pelos registros dos próximos sete dias e pelos limites deste mês:\n${plan.map(item=>`• ${item.title} · ${item.detail} · ${item.amounts}`).join('\n')}\nAbra a Central de avisos para acessar cada item.`:'Pelos registros atuais, não há vencimentos próximos nem limites que precisem de atenção. Acompanhe pela Central de avisos.';
}
function postRender(){if(authVisible){authUI.mounted();animateAuth();return;}simulate();syncLayout();animatePage(view);document.querySelectorAll('input[type="number"]').forEach(el=>el.inputMode='decimal');attachEditButtons();const chat=$('#chat-messages');if(chat)chat.scrollTop=chat.scrollHeight;}
function openRequestedPage(){
 const {view: requested,detail}=readPage(location.hash);
 navigate(requested,detail);
}
function navigate(id,detail,{fromHistory=false}={}){
 const href=pageHref(id,detail);
 if(!fromHistory&&location.hash!==href)history.pushState(null,'',href);
 if(id==='business')businessUI.setSection(detail);
 if(id==='transactions')transactionType=detail||'all';
 $('#modal')?.close();
 const wasDrawer=document.body.classList.contains('menu-open');
 if(view==='assistant'&&id!=='assistant'){voice.cancel();voiceProposal=null;}
 view=id;shell();
 if(wasDrawer){
  $('.sidebar')?.classList.add('open');
  $('.mobile-overlay')?.classList.add('show');
  document.body.classList.add('menu-open');
  setTimeout(()=>setMenu(false),240);
 }
 postRender();$('#main')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
 if(view==='notices')void noticeUI.refresh({settings:true});
}
window.addEventListener('hashchange',()=>{
 if(authVisible)return;
 const {view: requested,detail}=readPage(location.hash);
 navigate(requested,detail,{fromHistory:true});
});
function openNoticeAction(action){
 month=action.month||month;
 navigate(action.target);
 if(action.entity==='record'||action.entity==='tax')businessUI.openPending(action.itemId,action.entity==='tax');
 if(action.entity==='debt'){
  const debt=data.debts.find(item=>item.id===action.itemId&&item.balance>0);
  if(debt)recordModal('pay',debt.id);
 }
 if(action.entity==='limit'){
  const limit=evaluateSpendingLimits(data,month).find(item=>item.id===action.itemId);
  if(limit)openLimitAlertModal(limit);
 }
}
function applyChatCommand(next,cmd){
  if(cmd.kind==='debt')next.debts.push(cmd.item);
  if(cmd.kind==='goal')next.goals.push(cmd.item);
  if(cmd.kind==='spending-limit'){
   if(next.spending_limits.length>=100)throw new Error('Você já tem 100 limites. Exclua um para adicionar outro.');
   next.spending_limits.push(cmd.item);
  }
  if(cmd.kind==='investment'){next.investments.push(cmd.item);next.transactions.push({id:crypto.randomUUID(),name:cmd.item.name,category:'Investimentos',type:'expense',amount:cmd.item.amount,date:dateISO(),linked:cmd.item.id});}
  if(cmd.kind==='transaction')next.transactions.push(cmd.item);
  if(cmd.kind==='transactions')next.transactions.push(...cmd.items);
  if(cmd.kind==='delete-debt'){next.debts=next.debts.filter(d=>d.id!==cmd.id);next.transactions.forEach(t=>{if(t.linked===cmd.id)delete t.linked;});}
  if(cmd.kind==='delete-goal'){next.goals=next.goals.filter(g=>g.id!==cmd.id);next.transactions.forEach(t=>{if(t.linked===cmd.id)delete t.linked;});}
  if(cmd.kind==='delete-transaction')next.transactions=next.transactions.filter(t=>t.id!==cmd.id||t.linked);
}

async function sendMessage(question,{readOnly=false}={}){
 if(chatBusy||!question.trim())return;
 if(voice.state.phase!=='idle')voice.cancel();
 const text=question.trim(),history=messages.slice(-8),conversation=messages;
 const selectedMonth=assistantMonth(text);
 const stillCurrent=()=>!authVisible&&messages===conversation;
 let savingCommand=false;
 messages.push({role:'user',content:text});
 chatBusy=true;
 if(view==='assistant'){shell();postRender();}else navigate('assistant');
 try{
  const cmd=readOnly?null:tryChatCommand(text,data);
  if(cmd){
   savingCommand=true;
   await commit(next=>applyChatCommand(next,cmd),'Painel atualizado pela Alva!');
   if(stillCurrent())messages.push({role:'assistant',content:cmd.reply});
   return;
  }
  if(!readOnly&&!/\?$/.test(text)&&text.includes('\n')){
   const parsed=parseDocumentContent(text,'mensagem');
   const count=parsed.transactions.length+parsed.debts.length+parsed.goals.length+parsed.investments.length;
   if(count>0){
    const owner=data;
    const document=await readPastedImport(text);
    if(!stillCurrent()||data!==owner)throw new Error('A conta mudou. Cole os registros novamente.');
    messages.push({role:'assistant',content:'Confira os registros na prévia e escolha onde importar.'});
    importUI.open([document]);
    return;
   }
  }
  let answer=priorityAnswer(text);
  if(!answer&&!demo){
   try{const result=await api.askAgent(text,history,selectedMonth);answer=result?.answer;}catch{}
  }
  if(stillCurrent())messages.push({role:'assistant',content:answer||businessAnswer(text,data,selectedMonth)||localAnswer(text,data,selectedMonth)});
 }catch(error){
  if(stillCurrent())messages.push({role:'assistant',content:savingCommand?
   `Não consegui confirmar o registro. ${error.message||'Confira seus dados antes de tentar novamente.'}`:
   businessAnswer(text,data,selectedMonth)||localAnswer(text,data,selectedMonth)});
 }finally{
  if(stillCurrent()){chatBusy=false;shell();postRender();}
 }
}
function authModal(mode='signup'){voice.cancel();voiceProposal=null;setMenu(false);authVisible=true;authUI.open(mode);window.scrollTo({top:0,behavior:'instant'});}
async function enterAccount({restored=false}={}){const account=await api.loadAccount();voice.cancel();voiceCloud=undefined;voiceProposal=null;chatBusy=false;data=account.data;normalizeState(data);authVisible=false;authUI.stop();revision=account.revision;demo=false;messages=[{role:'assistant',content:`Olá, ${data.profile.name.split(' ')[0]||'bem-vindo'}! 🌿 Posso analisar os dados da sua conta, registrar movimentações por conversa ou importar sua planilha (.xlsx, .csv, .ofx) para atualizar seu painel automaticamente.`}];$('#modal').close();openRequestedPage();void noticeUI.refresh();const conversation=messages;void api.audioStatus().then(result=>{if(messages===conversation)voiceCloud=Boolean(result?.available);}).catch(()=>{});if(!restored)toast('Sua conta está pronta. Bem-vindo à Alva!');}
document.addEventListener('click',async ev=>{const b=ev.target.closest('button,a,[data-edit]');if(!b)return;try{if(!authVisible&&voiceAction(b.dataset.action))return;if(await authUI.click(b))return;if(authVisible)return;const noticeAction=await noticeUI.click(b);if(noticeAction){if(noticeAction.target)openNoticeAction(noticeAction);return;}if(b.dataset.plan==='withdrawal'){if(view!=='business')navigate('business');planningUI.openCash();return;}if(b.dataset.debtPlan){planningUI.openDebt(b.dataset.debtPlan);return;}if(b.dataset.categories){openCategories(b.dataset.categories);return;}if(importUI.click(b))return;if(await businessUI.click(b))return;if(b.dataset.nav){ev.preventDefault();navigate(b.dataset.nav);return;}if(b.dataset.chart){chartMode=b.dataset.chart;shell();postRender();return;}if(b.dataset.spendingStep){
 const step=b.dataset.spendingStep;
 if(step==='previous'||step==='next'){
  spendingAnchor={month,date:currentSpendingReport()[step]};
  updateSpendingResults();
 }
 return;
}if(b.dataset.question){await sendMessage(b.dataset.question);return;}if(b.dataset.contribute){recordModal('contribute',b.dataset.contribute);return;}if(b.dataset.pay){recordModal('pay',b.dataset.pay);return;}if(b.dataset.edit){recordModal('transaction',b.dataset.edit);return;}if(b.dataset.sendAlert){const lim=evaluateSpendingLimits(data,month).find(l=>l.id===b.dataset.sendAlert);if(lim)openLimitAlertModal(lim);return;}if(b.dataset.deleteLimit){const lim=data.spending_limits.find(l=>l.id===b.dataset.deleteLimit);if(!lim)return;modal('Excluir limite de gasto?',`<input type="hidden" name="id" value="${e(lim.id)}"><p class="muted" style="font-size:12px;line-height:1.9">${e(lim.name)} · Limite de ${money(lim.limit)}<br>Você deixará de receber alertas para este limite.</p>`,'delete-limit-form','Excluir limite');return;}if(b.dataset.delete){const t=data.transactions.find(t=>t.id===b.dataset.delete);modal('Excluir lançamento?',`<input type="hidden" name="id" value="${e(t.id)}"><p class="muted" style="font-size:12px;line-height:1.9">${e(t.name)} · ${money(t.amount)}<br>O saldo será recalculado após a exclusão.</p>`,'delete-form','Excluir lançamento');return;}if(b.dataset.deleteDebt){const d=data.debts.find(d=>d.id===b.dataset.deleteDebt);if(!d)return;modal('Excluir dívida?',`<input type="hidden" name="id" value="${e(d.id)}"><p class="muted" style="font-size:12px;line-height:1.9">${e(d.name)} · ${money(d.balance)} em aberto<br>A dívida será removida da sua lista.</p>`,'delete-debt-form','Excluir dívida');return;}if(b.dataset.deleteGoal){const g=data.goals.find(g=>g.id===b.dataset.deleteGoal);if(!g)return;modal('Excluir objetivo?',`<input type="hidden" name="id" value="${e(g.id)}"><p class="muted" style="font-size:12px;line-height:1.9">${e(g.name)} · ${money(g.saved)} guardados de ${money(g.target)}<br>O objetivo será removido da sua lista. Os lançamentos vinculados continuarão no seu histórico.</p>`,'delete-goal-form','Excluir objetivo');return;}if(b.dataset.goalPlan){const g=data.goals.find(g=>g.id===b.dataset.goalPlan);if(g)openGoalPlanModal(g);return;}if(b.dataset.navAssistantGoal){navigate('assistant');return;}const a=b.dataset.action;if(['transaction','goal','debt','investment','limit'].includes(a))recordModal(a);if(a==='voice-edit'&&voiceProposal)openVoiceReview(voiceProposal.text);if(a==='import-file')$('#file-importer')?.click();if(a==='pick-avatar')$('#avatar-importer')?.click();if(a==='remove-avatar'){await commit(next=>{next.avatar_photo='';},'Foto de perfil removida.');return;}if(a==='close-modal')$('#modal').close();if(a==='export')exportCSV();if(a==='privacy'){hidden=!hidden;shell();postRender();}if(a==='menu')setMenu(true);if(a==='close-menu')setMenu(false);if(a==='prev-month'||a==='next-month'){const d=new Date(month+'-15T12:00:00');d.setMonth(d.getMonth()+(a==='prev-month'?-1:1));month=dateISO(d).slice(0,7);shell();postRender();}if(a==='login')authModal();if(a==='logout'){void api.logout();clearAccount();authUI.open('login');toast('Você saiu da sua conta.');}if(a==='help')modal('Um passo de cada vez',`<div class="connection-guide"><b>1. Organize seu ponto de partida</b><br>Em Configurações, informe seu saldo inicial, orçamento e seu WhatsApp/E-mail para alertas.<br><br><b>2. Migre sua planilha automaticamente</b><br>Anexe arquivos .xlsx, .csv ou .ofx na Assistente Alva ou no topo do painel.<br><br><b>3. Calcule juros das suas dívidas</b><br>Em Minhas dívidas, informe as parcelas e o valor de cada prestação para ver automaticamente quanto paga de juros.<br><br><b>4. Defina limites de gastos</b><br>Estipule um valor máximo para gastos específicos (ex.: Uber, iFood, Lazer) e receba alerta quando atingir o limite.</div>`,'');if(a==='notifications'){$('#modal').close();navigate('notices');}}catch(err){formError(err);}});
document.addEventListener('click',ev=>{if(ev.target.classList.contains('mobile-overlay'))setMenu(false);});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.dataset.edit)recordModal('transaction',ev.target.dataset.edit);});
document.addEventListener('input',ev=>{if(ev.target.matches('#import-review-form input[data-import-setting]')){importUI.change(ev.target);return;}if(authVisible){authUI.input(ev.target);return;}if(planningUI.input(ev.target))return;if(ev.target.id==='business-search')businessUI.filter();if(ev.target.id==='search')filterTransactions();if(ev.target.closest('#simulator'))simulate();if(ev.target.closest('#record-form')&&$('#debt-interest-preview'))updateDebtPreview();});
document.addEventListener('change',async ev=>{if(importUI.change(ev.target))return;changeCategoryField(data,ev.target);if(ev.target.id==='spending-period'&&Object.hasOwn(spendingPeriods,ev.target.value)){
 spendingPeriod=ev.target.value;
 updateSpendingResults();
 return;
}if(ev.target.id==='ledger-month'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(ev.target.value)){month=ev.target.value;shell();postRender();$('#ledger-month')?.focus({preventScroll:true});return;}if(ev.target.id==='avatar-importer'){try{if(ev.target.files?.[0])await handleAvatarFile(ev.target.files[0]);}catch(err){formError(err);}finally{ev.target.value='';}return;}if(ev.target.id==='voice-file'){const file=ev.target.files?.[0];ev.target.value='';if(file&&!authVisible){if(view!=='assistant')navigate('assistant');await voice.upload(file);}return;}if(ev.target.id==='file-importer'){try{await handleFiles(ev.target.files);}catch(err){formError(err);}finally{ev.target.value='';}return;}if(['business-type-filter','business-category-filter'].includes(ev.target.id))businessUI.filter();if(ev.target.id==='type-filter'){
 transactionType=ev.target.value;
 const href=pageHref('transactions',transactionType);
 if(location.hash!==href)history.replaceState(null,'',href);
}if(['type-filter','category-filter'].includes(ev.target.id))filterTransactions();});
document.addEventListener('dragover',ev=>{if(!authVisible&&ev.dataTransfer?.types?.includes('Files'))ev.preventDefault();});
document.addEventListener('drop',async ev=>{if(authVisible||!ev.dataTransfer?.files?.length)return;ev.preventDefault();try{await handleFiles(ev.dataTransfer.files);}catch(err){formError(err);}});
document.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.target,formId=form.getAttribute('id'),btn=form.querySelector('button[type="submit"]')||form.querySelector('.button');if(btn)btn.disabled=true;try{if(await authUI.submit(form))return;if(authVisible)return;if(formId==='voice-review-form'){reviewVoice(String(new FormData(form).get('transcript')||'').trim());return;}if(formId==='voice-confirm-form'){await confirmVoice(form);return;}if(await noticeUI.submit(form))return;if(await importUI.submit(form))return;if(planningUI.submit(form))return;if(formId==='category-form'){await submitCategory(form);return;}if(await businessUI.submit(form))return;if(formId==='record-form')await submitRecord(form);if(formId==='delete-form'){const id=new FormData(form).get('id');await commit(next=>{next.transactions=next.transactions.filter(t=>t.id!==id||t.linked);},'Lançamento excluído.');}if(formId==='delete-debt-form'){const id=new FormData(form).get('id');await commit(next=>{next.debts=next.debts.filter(d=>d.id!==id);next.transactions.forEach(t=>{if(t.linked===id)delete t.linked;});},'Dívida excluída.');}if(formId==='delete-goal-form'){const id=new FormData(form).get('id');await commit(next=>{next.goals=next.goals.filter(g=>g.id!==id);next.transactions.forEach(t=>{if(t.linked===id)delete t.linked;});},'Objetivo excluído.');}if(formId==='delete-limit-form'){const id=new FormData(form).get('id');await commit(next=>{next.spending_limits=(next.spending_limits||[]).filter(l=>l.id!==id);},'Limite de gasto removido.');}if(formId==='profile-form'){const f=Object.fromEntries(new FormData(form));await commit(next=>{next.profile={...next.profile,name:f.name.trim(),monthly_budget:Math.round(Number(f.budget)*100),opening_balance:Math.round(Number(f.opening)*100),alert_whatsapp:String(f.whatsapp||'').trim().slice(0,30)};},'Perfil e alertas atualizados.');}if(formId==='chat-form'){const message=new FormData(form).get('message');await sendMessage(message);}}catch(err){formError(err,form);}finally{if(btn)btn.disabled=false;}});
if(api.configured()&&api.session)authUI.setLoading(true);
else{shell();postRender();}
(async()=>{
 if(!api.configured())return;
 try{
  await api.acceptCallback();
  if(api.session)await enterAccount({restored:true});
 }catch(err){
  if(api.session)authUI.fail(err);
  else authUI.open('login');
 }
})();

function clearAccount(){voice.cancel();voiceProposal=null;voiceCloud=undefined;chatBusy=false;noticeUI.reset();data=emptyData();normalizeState(data);revision=0;messages=[];view='dashboard';spendingPeriod='month';spendingAnchor=undefined;hidden=false;demo=true;authVisible=true;document.body.classList.remove('screen-privacy');document.querySelector('#modal')?.close();}
window.addEventListener('alva:session-expired',()=>{clearAccount();authUI.open('login');toast('Sua sessão terminou. Entre novamente para continuar.');});

window.addEventListener('pagehide',()=>voice.cancel());
