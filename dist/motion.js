// Animações progressivas: o conteúdo continua acessível sem suporte à API.
const preferenceKey='alva-motion-v1';
let disabled=false;
try{disabled=localStorage.getItem(preferenceKey)==='off';}catch{}
const allowed=()=>!disabled&&typeof Element.prototype.animate==='function';
const animations=new Set();const counters=new Map();const values=new Map();
const navRects=new Map();
const NAV_SELECTORS=['.mobile-bottom','.top-glass-tabs','.sidebar','.chart-tabs','.business-tabs','.auth-mode-tabs'];
const PAGE_ORDER=['dashboard','transactions','debts','goals','investments','assistant','business','settings'];
let previousPage='',observer,lastDialogFocus,drawerFocus;
const format=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const ease='cubic-bezier(.22,1,.36,1)';
const springEase='cubic-bezier(.22,1.12,.36,1)';
function play(el,frames,options={}){if(!allowed()||!el)return null;const a=el.animate(frames,{duration:450,easing:ease,...options});animations.add(a);a.finished.catch(()=>{}).finally(()=>animations.delete(a));return a;}
function stop(){observer?.disconnect();for(const a of animations)a.cancel();animations.clear();for(const [el,c] of counters){cancelAnimationFrame(c.frame);el.textContent=format.format(c.target/100);}counters.clear();}
function measureNavButton(container,btn){
 if(!container||!btn)return null;
 const cRect=container.getBoundingClientRect(),bRect=btn.getBoundingClientRect();
 if(cRect.width<2||bRect.width<2||cRect.height<2||bRect.height<2)return null;
 const key=btn.dataset.nav||btn.dataset.chart||btn.dataset.businessTab||btn.dataset.authAction||btn.textContent.trim();
 const radius=getComputedStyle(btn).borderRadius||'999px';
 return {
  x:Math.round((bRect.left-cRect.left+container.scrollLeft)*10)/10,
  y:Math.round((bRect.top-cRect.top+container.scrollTop)*10)/10,
  w:Math.round(bRect.width*10)/10,
  h:Math.round(bRect.height*10)/10,
  key,
  radius
 };
}
function captureNavState(){
 for(const sel of NAV_SELECTORS){
  const container=document.querySelector(sel);
  if(!container)continue;
  const activeBtn=container.querySelector('button.active');
  const m=measureNavButton(container,activeBtn);
  if(m)navRects.set(sel,m);
 }
}
document.addEventListener('click',captureNavState,true);
function syncLiquidGlassNavs(){
 for(const sel of NAV_SELECTORS){
  const container=document.querySelector(sel);
  if(!container)continue;
  const activeBtn=container.querySelector('button.active');
  if(!activeBtn){
   container.classList.remove('has-liquid-pill');
   container.querySelector(':scope > .liquid-glass-pill')?.remove();
   continue;
  }
  container.classList.add('has-liquid-pill');
  let pill=container.querySelector(':scope > .liquid-glass-pill');
  if(!pill){
   pill=document.createElement('span');
   pill.className='liquid-glass-pill';
   pill.setAttribute('aria-hidden','true');
   pill.innerHTML='<span class="liquid-glass-sheen"></span>';
   container.prepend(pill);
  }
  const curr=measureNavButton(container,activeBtn);
  if(!curr){
   container.classList.remove('has-liquid-pill');
   pill.remove();
   continue;
  }
  pill.style.cssText=`left:${curr.x}px;top:${curr.y}px;width:${curr.w}px;height:${curr.h}px;border-radius:${curr.radius}`;
  const prev=navRects.get(sel);
  if(prev&&prev.key!==curr.key&&allowed()){
   const dx=prev.x-curr.x,dy=prev.y-curr.y;
   if(Math.abs(dx)>1||Math.abs(dy)>1||Math.abs(prev.w-curr.w)>1){
    const horiz=Math.abs(dx)>=Math.abs(dy);
    const dist=Math.hypot(dx,dy);
    const stretchMajor=Math.min(1.15,1+dist/650);
    const stretchMinor=Math.max(0.9,1-dist/1800);
    const sx=horiz?stretchMajor:stretchMinor;
    const sy=horiz?stretchMinor:stretchMajor;
    play(pill,[
     {transform:`translate3d(${dx}px,${dy}px,0) scale(1,1)`,width:`${prev.w}px`,height:`${prev.h}px`,filter:'brightness(1)'},
     {transform:`translate3d(${dx*0.34}px,${dy*0.34}px,0) scale(${sx.toFixed(3)},${sy.toFixed(3)})`,width:`${((prev.w+curr.w)/2).toFixed(1)}px`,height:`${((prev.h+curr.h)/2).toFixed(1)}px`,filter:'brightness(1.16)',offset:0.42},
     {transform:`translate3d(${(-dx*0.035).toFixed(1)}px,${(-dy*0.035).toFixed(1)}px,0) scale(${horiz?1.02:0.99},${horiz?0.99:1.02})`,width:`${curr.w}px`,height:`${curr.h}px`,filter:'brightness(1.04)',offset:0.78},
     {transform:'translate3d(0,0,0) scale(1,1)',width:`${curr.w}px`,height:`${curr.h}px`,filter:'brightness(1)'}
    ],{duration:480,easing:springEase});
    const sheen=pill.querySelector('.liquid-glass-sheen');
    if(sheen){
     play(sheen,[
      {transform:`translateX(${dx<=0?'-130%':'130%'}) skewX(-20deg)`,opacity:0},
      {transform:'translateX(0%) skewX(-20deg)',opacity:.9,offset:0.45},
      {transform:`translateX(${dx<=0?'130%':'-130%'}) skewX(-20deg)`,opacity:0}
     ],{duration:520,easing:'ease-out'});
    }
    const ico=activeBtn.querySelector('.icon');
    if(ico){
     play(ico,[
      {transform:'scale(.84) translateY(1px)'},
      {transform:'scale(1.16) translateY(-2px)',offset:0.52},
      {transform:'scale(1) translateY(0)'}
     ],{duration:430,easing:springEase});
    }
   }
  }
  navRects.set(sel,curr);
 }
}
window.addEventListener('resize',()=>{requestAnimationFrame(syncLiquidGlassNavs);},{passive:true});
document.fonts?.ready?.then(()=>requestAnimationFrame(syncLiquidGlassNavs)).catch(()=>{});
document.addEventListener('pointerover',event=>{
 if(!allowed()||event.pointerType!=='mouse'||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 const btn=event.target.closest('.top-glass-tabs button,.sidebar .nav button,.chart-tabs button,.business-tabs button,.auth-mode-tabs button');
 if(!btn)return;
 const container=btn.closest(NAV_SELECTORS.join(','));
 if(!container)return;
 const m=measureNavButton(container,btn);
 if(!m)return;
 let hoverPill=container.querySelector(':scope > .liquid-glass-hover');
 if(!hoverPill){
  hoverPill=document.createElement('span');
  hoverPill.className='liquid-glass-hover';
  hoverPill.setAttribute('aria-hidden','true');
  container.prepend(hoverPill);
 }
 hoverPill.style.cssText=`transform:translate3d(${m.x}px,${m.y}px,0);width:${m.w}px;height:${m.h}px;border-radius:${m.radius};opacity:${btn.classList.contains('active')?'0':'1'}`;
},{passive:true});
document.addEventListener('pointerout',event=>{
 if(event.pointerType!=='mouse')return;
 const container=event.target.closest?.(NAV_SELECTORS.join(','));
 if(!container||container.contains(event.relatedTarget))return;
 const hoverPill=container.querySelector(':scope > .liquid-glass-hover');
 if(hoverPill)hoverPill.style.opacity='0';
},{passive:true});
function syncPreference(){document.documentElement.classList.toggle('motion-off',!allowed());if(!allowed())stop();const toggle=document.querySelector('#motion-toggle');if(toggle){toggle.checked=!disabled;toggle.disabled=false;}const note=document.querySelector('#motion-note');if(note)note.textContent='Movimentos fluidos de Liquid Glass nos menus, gráficos, indicadores e transições. Você pode desativar quando quiser.';}
syncPreference();
function count(el,page){const target=Number(el.dataset.counterValue);if(!Number.isFinite(target))return;const number=el.querySelector('.counter-number');if(!number)return;const key=page+':'+el.dataset.counterKey;const start=values.has(key)?values.get(key):target*.78;values.set(key,target);if(!allowed()||document.body.classList.contains('screen-privacy')||start===target)return;const state={target,frame:0};const began=performance.now();const tick=now=>{if(!number.isConnected){counters.delete(number);return;}const p=Math.min(1,(now-began)/650),eased=1-Math.pow(1-p,3);number.textContent=format.format(Math.round(start+(target-start)*eased)/100);if(p<1){state.frame=requestAnimationFrame(tick);}else{number.textContent=format.format(target/100);counters.delete(number);}};counters.set(number,state);state.frame=requestAnimationFrame(tick);}
function details(scope){scope.querySelectorAll('.progress>span').forEach((el,i)=>play(el,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:750,delay:Math.min(i*45,180)}));scope.querySelectorAll('.business-bar,.simulation-bars>div').forEach((el,i)=>play(el,[{transform:'scaleY(0)'},{transform:'scaleY(1)'}],{duration:650,delay:Math.min(i*28,240)}));scope.querySelectorAll('.line-chart path[fill="none"]').forEach(el=>{try{const length=el.getTotalLength();if(length)play(el,[{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:900});}catch{}});}
export function animatePage(page){stop();syncPreference();if(page==='settings'){const layout=document.querySelector('.settings-layout');if(layout&&!document.querySelector('#motion-toggle')){const section=document.createElement('section');section.className='panel';section.innerHTML='<h2>Movimento e acessibilidade</h2><p id="motion-note"></p><label class="motion-setting"><span>Animações da interface</span><input type="checkbox" id="motion-toggle" role="switch" aria-describedby="motion-note"><span class="switch-track" aria-hidden="true"></span></label>';layout.append(section);syncPreference();}}
 const prevIdx=PAGE_ORDER.indexOf(previousPage),currIdx=PAGE_ORDER.indexOf(page);
 const dir=prevIdx>=0&&currIdx>=0&&prevIdx!==currIdx?(currIdx>prevIdx?1:-1):0;
 const newPage=previousPage!==page;previousPage=page;const main=document.querySelector('#main');
 syncLiquidGlassNavs();
 if(!main)return;document.body.dataset.view=page;
 main.querySelectorAll('[data-counter-value]').forEach(el=>count(el,page));
 if(!allowed())return;
 if(newPage){
  play(main.querySelector('.intro'),[{opacity:0,transform:`translate3d(${dir*14}px,8px,0) scale(.992)`},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:420});
  const pageContent=main.querySelector('#page-content');
  if(pageContent&&dir!==0)play(pageContent,[{opacity:.35,transform:`translate3d(${dir*18}px,0,0) scale(.994)`},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:380});
 }
 const blocks=[...main.querySelectorAll('.stat,.panel,.agent-card,.business-identity,.tip')];
 if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const el=entry.target;observer.unobserve(el);if(newPage)play(el,[{opacity:.2,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{delay:Math.min(Number(el.dataset.motionOrder||0)*40,180)});details(el);}},{threshold:.08});blocks.forEach((el,i)=>{el.dataset.motionOrder=String(i);observer.observe(el);});}else details(main);
 const chat=main.querySelector('.message:last-child');if(chat)play(chat,[{opacity:0,transform:'translateY(8px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:320});
}
export function animateSimulation(){const output=document.querySelector('#simulation-output');if(output&&allowed())output.querySelectorAll('.simulation-bars>div').forEach((el,i)=>play(el,[{transform:'scaleY(.12)'},{transform:'scaleY(1)'}],{duration:450,delay:Math.min(i*18,100)}));}
export function animateModal(dialog,opener){
 if(opener&&!dialog.contains(opener))lastDialogFocus=opener;
 document.body.classList.add('modal-open');
 dialog.querySelectorAll('form').forEach(f=>f.setAttribute('autocomplete','off'));
 dialog.querySelectorAll('input,textarea,select').forEach(el=>{
  el.setAttribute('autocomplete','off');
  el.setAttribute('autocorrect','off');
  el.setAttribute('spellcheck','false');
  el.setAttribute('data-lpignore','true');
  el.setAttribute('data-1p-ignore','true');
  if(el.type==='number')el.inputMode='decimal';
 });
 keyboard();
 play(dialog,[{opacity:.4,transform:window.innerWidth<=700?'translateY(-12px) scale(.98)':'translateY(12px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:300});
}
export function setMenu(open){const sidebar=document.querySelector('.sidebar'),overlay=document.querySelector('.mobile-overlay'),button=document.querySelector('[data-action="menu"]');if(!sidebar||!overlay)return;const drawer=matchMedia('(max-width: 1023px)').matches;sidebar.classList.toggle('open',open);overlay.classList.toggle('show',open);document.body.classList.toggle('menu-open',open&&drawer);button?.setAttribute('aria-expanded',String(open));sidebar.setAttribute('aria-hidden',String(drawer&&!open));sidebar.inert=drawer&&!open;
 if(open)requestAnimationFrame(syncLiquidGlassNavs);
 if(open&&drawer){drawerFocus=document.activeElement;document.querySelector('.workspace').inert=true;document.querySelector('.mobile-bottom').inert=true;sidebar.querySelector('[aria-current="page"],button')?.focus({preventScroll:true});}else{const workspace=document.querySelector('.workspace'),bottom=document.querySelector('.mobile-bottom');if(workspace)workspace.inert=false;if(bottom)bottom.inert=false;if(drawer&&drawerFocus?.isConnected)drawerFocus.focus({preventScroll:true});}}
export function syncLayout(){const sidebar=document.querySelector('.sidebar');if(!sidebar)return;const drawer=matchMedia('(max-width: 1023px)').matches;const open=sidebar.classList.contains('open')&&drawer;if(!drawer){sidebar.classList.remove('open');document.querySelector('.mobile-overlay')?.classList.remove('show');document.body.classList.remove('menu-open');const workspace=document.querySelector('.workspace'),bottom=document.querySelector('.mobile-bottom');if(workspace)workspace.inert=false;if(bottom)bottom.inert=false;}sidebar.inert=drawer&&!open;sidebar.setAttribute('aria-hidden',String(drawer&&!open));document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded',String(open));}
const layoutQuery=matchMedia('(max-width: 1023px)');layoutQuery.addEventListener?.('change',syncLayout);
document.addEventListener('change',event=>{if(event.target.id!=='motion-toggle')return;disabled=!event.target.checked;try{localStorage.setItem(preferenceKey,disabled?'off':'on');}catch{}syncPreference();});
document.addEventListener('pointerdown',event=>{const button=event.target.closest('button,.button');if(!button||button.disabled||!allowed()||event.button>0)return;const r=button.getBoundingClientRect(),size=Math.min(240,Math.max(r.width,r.height)*1.8);const ink=document.createElement('span');ink.className='ink-ripple';ink.style.cssText=`width:${size}px;height:${size}px;left:${event.clientX-r.left-size/2}px;top:${event.clientY-r.top-size/2}px`;button.classList.add('ripple-host');button.append(ink);const a=play(ink,[{opacity:.16,transform:'scale(0)'},{opacity:0,transform:'scale(1)'}],{duration:520,easing:'ease-out'});if(a)a.finished.catch(()=>{}).finally(()=>ink.remove());else ink.remove();});
document.addEventListener('keydown',event=>{if(!document.body.classList.contains('menu-open'))return;if(event.key==='Escape'){event.preventDefault();setMenu(false);return;}if(event.key==='Tab'){const targets=[...document.querySelector('.sidebar').querySelectorAll('a[href],button:not([disabled])')].filter(el=>el.getClientRects().length);const first=targets[0],last=targets.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
document.addEventListener('close',event=>{if(event.target.id==='modal'){document.body.classList.remove('modal-open');if(lastDialogFocus?.isConnected)lastDialogFocus.focus({preventScroll:true});}},true);
function keyboard(){
 const viewport=window.visualViewport;if(!viewport)return;
 const active=document.activeElement;
 const editing=active?.matches('input,textarea,select');
 const visibleKeyboard=editing&&window.innerHeight-viewport.height>110;
 document.body.classList.toggle('keyboard-open',Boolean(visibleKeyboard));
 document.documentElement.style.setProperty('--visual-height',`${Math.round(viewport.height)}px`);
 document.documentElement.style.setProperty('--visual-top',`${Math.max(0,Math.round(viewport.offsetTop))}px`);
 document.documentElement.style.setProperty('--keyboard-inset',`${Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop))}px`);
 if(visibleKeyboard&&active?.closest('dialog')){
  setTimeout(()=>{try{active.scrollIntoView({block:'center',behavior:'smooth'});}catch{}},60);
 }
}
window.visualViewport?.addEventListener('resize',keyboard,{passive:true});
window.visualViewport?.addEventListener('scroll',keyboard,{passive:true});
document.addEventListener('focusin',keyboard);
document.addEventListener('focusout',()=>requestAnimationFrame(keyboard));

// Movimento decorativo limitado ao ponteiro preciso; nunca interfere na digitação.
export function animateAuth(){stop();syncPreference();syncLiquidGlassNavs();if(!allowed())return;const card=document.querySelector('.auth-card');if(!card)return;const switched=card.dataset.transition==='switch';play(switched?card.querySelector('.auth-form-content'):card,[{opacity:.2,transform:switched?'translateX(8px)':'translateY(18px) scale(.985)'},{opacity:1,transform:'translate(0) scale(1)'}],{duration:switched?280:650});if(!switched){document.querySelectorAll('.auth-story>.auth-eyebrow,.auth-story>h1,.auth-story>p,.auth-preview').forEach((el,i)=>play(el,[{opacity:.2,transform:'translateY(15px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,delay:i*75}));}}
let tiltFrame=0;
document.addEventListener('pointermove',event=>{if(!allowed()||event.pointerType!=='mouse'||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;const scene=event.target.closest('.auth-scene');if(!scene||event.target.closest('input,button,a')||document.activeElement?.matches('input'))return;const x=(event.clientX/window.innerWidth-.5)*2,y=(event.clientY/window.innerHeight-.5)*2;cancelAnimationFrame(tiltFrame);tiltFrame=requestAnimationFrame(()=>{scene.style.setProperty('--float-x',`${(x*6).toFixed(1)}px`);scene.style.setProperty('--float-y',`${(y*5).toFixed(1)}px`);});},{passive:true});
