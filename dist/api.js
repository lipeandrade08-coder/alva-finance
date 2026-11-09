const SESSION_KEY='alva-auth-session-v1';
function readSession(){
 try{
  const legacy=localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||legacy||'null');
  if(!data?.access_token||!data?.refresh_token||(data.saved_until&&Date.now()>data.saved_until)){
   sessionStorage.removeItem(SESSION_KEY);
   return null;
  }
  delete data.saved_until;
  sessionStorage.setItem(SESSION_KEY,JSON.stringify(data));
  return data;
 }catch{return null;}
}
export let session=readSession();
let refreshPromise;
export function getConfig(){return {...(window.ALVA_CONFIG||{})};}
export function configured(){const c=getConfig();return Boolean(c.supabaseUrl&&c.supabasePublicKey);}
export function forgetSession(){session=null;localStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(SESSION_KEY);}
function saveSession(data){
 if(!data?.access_token||!data?.refresh_token)throw new Error('Não foi possível iniciar a sessão. Entre novamente.');
 session={...data,expires_at:Number(data.expires_at)||Math.floor(Date.now()/1000)+(Number(data.expires_in)||3600)};
 sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));
}
async function request(path,{method='GET',body,token,headers={},timeoutMs=20000,signal}={}){if(!configured()){const error=new Error('O cadastro está sendo preparado. Tente novamente em breve.');error.code='not_configured';throw error;}const c=getConfig();const response=await fetch(`${c.supabaseUrl}${path}`,{method,headers:{apikey:c.supabasePublicKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{}),...(signal?{signal}:typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(timeoutMs)}:{})});const result=await response.json().catch(()=>null);if(!response.ok){const error=new Error(result?.msg||result?.message||result?.error_description||result?.error||'Não foi possível concluir a operação.');error.status=response.status;error.code=result?.error_code||result?.code;if(token&&(error.status===401||error.code==='28000')){forgetSession();window.dispatchEvent?.(new Event('alva:session-expired'));}throw error;}return result;}
export function normalizeEmail(email){const value=String(email||'').trim().toLowerCase();if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Informe um e-mail válido.');return value;}
export function validatePassword(password){const value=String(password||'');if(value.length<10||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/[0-9]/.test(value))throw new Error('Use ao menos 10 caracteres, com letras maiúsculas, minúsculas e um número.');if(new TextEncoder().encode(value).length>72)throw new Error('Use uma senha de até 72 bytes.');return value;}
export async function signUp(email,password,name){const normalized=normalizeEmail(email),fullName=String(name||'').trim();if(!fullName||fullName.length>70)throw new Error('Informe seu nome, com até 70 caracteres.');const result=await request('/auth/v1/signup',{method:'POST',body:{email:normalized,password:validatePassword(password),data:{full_name:fullName}}});saveSession(result);return result;}
export async function signIn(email,password){const normalized=normalizeEmail(email);if(!String(password||''))throw new Error('Informe sua senha.');const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:normalized,password:String(password)}});saveSession(result);return result;}
async function accessToken(){if(!session){const error=new Error('Entre na sua conta para continuar.');error.status=401;throw error;}if(!session.expires_at||session.expires_at*1000<Date.now()+60000){if(!refreshPromise)refreshPromise=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}}).then(saveSession).catch(err=>{if(err.status===400||err.status===401)forgetSession();throw err;}).finally(()=>refreshPromise=null);await refreshPromise;}return session.access_token;}
// O fluxo usa senha. Tokens recebidos pela URL nunca iniciam uma sessão.
export async function acceptCallback(){const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('access_token')||hash.has('error_description')||hash.has('refresh_token'))history.replaceState(null,'',location.pathname+location.search);return false;}
export async function logout(){try{if(session)await request('/auth/v1/logout?scope=local',{method:'POST',token:await accessToken()});}catch{}finally{forgetSession();}}
export async function loadAccount(){const token=await accessToken();const user=await request('/auth/v1/user',{token});await request('/rest/v1/rpc/ensure_alva_account',{method:'POST',token,body:{}});const [profiles,rows]=await Promise.all([request(`/rest/v1/profiles?id=eq.${user.id}&select=*`,{token}),request(`/rest/v1/finance_data?user_id=eq.${user.id}&select=data,revision`,{token})]);if(!rows?.[0])throw new Error('Não foi possível carregar seu espaço financeiro. Tente novamente.');return {user,profile:profiles?.[0],data:rows[0].data,revision:rows[0].revision};}
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
