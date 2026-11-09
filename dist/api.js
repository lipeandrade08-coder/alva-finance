const SESSION_KEY='alva-auth-session-v1';
function storedSession(storage){
 try{
  const data=JSON.parse(globalThis[storage].getItem(SESSION_KEY)||'null');
  if(data?.access_token&&data.refresh_token&&(!data.saved_until||Date.now()<data.saved_until))return data;
  return null;
 }catch{return null;}
}
function removeStoredSession(storage){
 try{globalThis[storage].removeItem(SESSION_KEY);}catch{}
}
export let session=null;
let persisted=false;
let pendingRefresh;
export function getConfig(){return {...(window.ALVA_CONFIG||{})};}
export function configured(){const c=getConfig();return Boolean(c.supabaseUrl&&c.supabasePublicKey);}
function forgetSession(){
 if(persisted&&storedSession('localStorage')?.storageId===session?.storageId)removeStoredSession('localStorage');
 removeStoredSession('sessionStorage');
 session=null;
 persisted=false;
}
function saveSession(data,previous){
 if(!data?.access_token||!data?.refresh_token)throw new Error('Não foi possível iniciar a sessão. Entre novamente.');
 const user=data.user||previous?.user;
 session={
  access_token:data.access_token,
  refresh_token:data.refresh_token,
  expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600),
  storageId:previous?.storageId||crypto.randomUUID(),
  user:user?{id:user.id,email:user.email}:undefined
 };
 persisted=false;
 try{
  localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  persisted=true;
 }catch{}
}
const savedSession=storedSession('localStorage');
const initialSession=savedSession||storedSession('sessionStorage');
if(savedSession?.storageId){session=savedSession;persisted=true;}
else if(initialSession)saveSession({...initialSession,expires_at:Number(initialSession.expires_at)||1},initialSession);
else removeStoredSession('localStorage');
removeStoredSession('sessionStorage');

function syncSession(){
 if(!session||!persisted)return;
 const latest=storedSession('localStorage');
 if(latest?.storageId===session.storageId){session=latest;return;}
 session=null;
 persisted=false;
 window.dispatchEvent?.(new Event('alva:session-expired'));
}
window.addEventListener?.('storage',event=>{
 if(event.key===SESSION_KEY||event.key===null)syncSession();
});
window.addEventListener?.('pageshow',syncSession);

async function request(path,{method='GET',body,token,headers={},timeoutMs=20000,signal}={}){
 if(!configured())throw Object.assign(new Error('O cadastro está sendo preparado. Tente novamente em breve.'),{code:'not_configured'});
 const config=getConfig();
 const response=await fetch(`${config.supabaseUrl}${path}`,{
  method,
  headers:{apikey:config.supabasePublicKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  ...(signal?{signal}:typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(timeoutMs)}:{})
 });
 const result=await response.json().catch(()=>null);
 if(response.ok)return result;
 const error=Object.assign(new Error(result?.msg||result?.message||result?.error_description||result?.error||'Não foi possível concluir a operação.'),{
  status:response.status,code:result?.error_code||result?.code
 });
 if(token&&(error.status===401||error.code==='28000')){
  syncSession();
  if(token===session?.access_token)expireSession();
 }
 throw error;
}
export function normalizeEmail(email){const value=String(email||'').trim().toLowerCase();if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Informe um e-mail válido.');return value;}
export function validatePassword(password){const value=String(password||'');if(value.length<10||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/[0-9]/.test(value))throw new Error('Use ao menos 10 caracteres, com letras maiúsculas, minúsculas e um número.');if(new TextEncoder().encode(value).length>72)throw new Error('Use uma senha de até 72 bytes.');return value;}
export async function signUp(email,password,name){const normalized=normalizeEmail(email),fullName=String(name||'').trim();if(!fullName||fullName.length>70)throw new Error('Informe seu nome, com até 70 caracteres.');const result=await request('/auth/v1/signup',{method:'POST',body:{email:normalized,password:validatePassword(password),data:{full_name:fullName}}});saveSession(result);return result;}
export async function signIn(email,password){const normalized=normalizeEmail(email);if(!String(password||''))throw new Error('Informe sua senha.');const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:normalized,password:String(password)}});saveSession(result);return result;}
function activeSession(storageId){
 syncSession();
 if(!session||(storageId&&session.storageId!==storageId))throw Object.assign(new Error('Entre na sua conta para continuar.'),{status:401});
 return session;
}
function expireSession(){
 forgetSession();
 window.dispatchEvent?.(new Event('alva:session-expired'));
}
const needsRefresh=current=>!current.expires_at||current.expires_at*1000<Date.now()+60000;
async function refreshSession(storageId){
 const current=activeSession(storageId);
 if(!needsRefresh(current))return;
 try{
  const next=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:current.refresh_token}});
  if(activeSession(storageId).refresh_token===current.refresh_token)saveSession(next,current);
 }catch(err){
  const latest=activeSession(storageId);
  if(latest.refresh_token!==current.refresh_token)return;
  if(err.status===400||err.status===401||err.code==='session_not_found')expireSession();
  throw err;
 }
}
async function accessToken(){
 const current=activeSession();
 if(needsRefresh(current)){
  if(pendingRefresh?.storageId!==current.storageId){
   const refresh=()=>refreshSession(current.storageId);
   const locks=globalThis.navigator?.locks;
   const pending={storageId:current.storageId};
   pending.promise=(locks?locks.request(SESSION_KEY,refresh):refresh()).finally(()=>{
    if(pendingRefresh===pending)pendingRefresh=null;
   });
   pendingRefresh=pending;
  }
  await pendingRefresh.promise;
 }
 return activeSession(current.storageId).access_token;
}
// O fluxo usa senha. Tokens recebidos pela URL nunca iniciam uma sessão.
export async function acceptCallback(){const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('access_token')||hash.has('error_description')||hash.has('refresh_token'))history.replaceState(null,'',location.pathname+location.search);return false;}
export async function logout(){
 syncSession();
 const current=session;
 if(!current)return;
 forgetSession();
 try{
  let token=current.access_token;
  if(current.expires_at*1000<=Date.now()){
   const renewed=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:current.refresh_token}});
   token=renewed.access_token;
  }
  await request('/auth/v1/logout?scope=local',{method:'POST',token});
 }catch{}
}
export async function loadAccount(){
 const {storageId}=activeSession();
 const token=await accessToken();
 const user=await request('/auth/v1/user',{token});
 await request('/rest/v1/rpc/ensure_alva_account',{method:'POST',token,body:{}});
 const [profiles,rows]=await Promise.all([
  request(`/rest/v1/profiles?id=eq.${user.id}&select=*`,{token}),
  request(`/rest/v1/finance_data?user_id=eq.${user.id}&select=data,revision`,{token})
 ]);
 activeSession(storageId);
 if(!rows?.[0])throw new Error('Não foi possível carregar seu espaço financeiro. Tente novamente.');
 return {user,profile:profiles?.[0],data:rows[0].data,revision:rows[0].revision};
}
export async function saveAccount(data,revision){return await request('/rest/v1/rpc/save_finances',{method:'POST',token:await accessToken(),body:{new_data:data,expected_revision:revision}});}
export async function askAgent(message,history,month){return await request('/functions/v1/financial-agent',{method:'POST',token:await accessToken(),timeoutMs:26000,body:{message,history,month}});}
export async function sendAlertNotification(limitId, {whatsappOnly=false}={}){
 if(!session)return null;
 try{
  return await request('/functions/v1/financial-agent',{method:'POST',token:await accessToken(),body:{action:'send_alert',limit_id:limitId,whatsapp_only:whatsappOnly}});
 }catch{return null;}
}
export async function audioStatus(){
 return await request('/functions/v1/financial-agent',{method:'POST',token:await accessToken(),body:{action:'audio_status'}});
}
export async function transcribeAudio(file, signal){
 const bytes=new Uint8Array(await file.arrayBuffer());
 const chunks=[];
 for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 const token=await accessToken();
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,45000);
 try{
  return await request('/functions/v1/financial-agent',{method:'POST',token,signal:controller.signal,
   body:{action:'transcribe_audio',audio:btoa(chunks.join(''))}});
 }catch(error){
  if(error.name==='AbortError'&&!signal?.aborted)throw new Error('A transcrição demorou demais. Tente reenviar o áudio.');
  throw error;
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener('abort',abort);
 }
}

const noticeFields='id,limit_id,month,level,label,spent_cents,limit_cents,created_at,read_at,email_state';
export async function listNotices(){
 return await request(`/rest/v1/alva_notices?select=${noticeFields}&order=created_at.desc,id.desc&limit=50`,{token:await accessToken()});
}
export async function readNotices(ids){
 const unique=[...new Set(ids)].filter(id=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)).slice(0,50);
 if(!unique.length)return;
 await request(`/rest/v1/alva_notices?id=in.(${unique.join(',')})&read_at=is.null`,{method:'PATCH',token:await accessToken(),body:{read_at:new Date().toISOString()}});
}
export async function noticeChannel(action,details={}){
 return await request('/functions/v1/notification-center',{method:'POST',token:await accessToken(),body:{...details,action}});
}
