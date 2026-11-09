import test from 'node:test';
import assert from 'node:assert/strict';
let serial=0;
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};};
async function fixture(handler,storedSession,storageType='localStorage'){globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.window={ALVA_CONFIG:{supabaseUrl:'https://test-project.supabase.co',supabasePublicKey:'sb_publishable_test_only'}};if(storedSession)globalThis[storageType].setItem('alva-auth-session-v1',JSON.stringify(storedSession));const calls=[];globalThis.fetch=async(url,options={})=>{const call={url,options,body:options.body?JSON.parse(options.body):undefined};calls.push(call);const result=await handler(call);return {ok:result.status===undefined||result.status<400,status:result.status||200,json:async()=>result.data};};const api=await import(`../dist/api.js?auth_test=${serial++}`);return {api,calls};}
const validSession={access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:900,user:{id:'user-a',email:'ana@example.com'}};
const password='TestPassword12345';
test('cadastro por senha recebe sessão sem enviar OTP e não persiste senha',async()=>{const {api,calls}=await fixture(()=>({data:validSession}));await api.signUp('  ANA@example.com ',password,' Ana ');assert.equal(calls[0].url,'https://test-project.supabase.co/auth/v1/signup');assert.deepEqual(calls[0].body,{email:'ana@example.com',password,data:{full_name:'Ana'}});assert.equal(api.session.access_token,validSession.access_token);assert.equal(localStorage.values.size,1);assert.equal(sessionStorage.values.size,0);assert.ok(![...localStorage.values.values()].join('').includes(password));});
test('entrada usa grant de senha, sem criar usuário',async()=>{const {api,calls}=await fixture(()=>({data:validSession}));await api.signIn('ana@example.com',password);assert.ok(calls[0].url.endsWith('grant_type=password'));assert.deepEqual(calls[0].body,{email:'ana@example.com',password});});
test('e-mail inválido, nome vazio e senha fraca bloqueiam cadastro antes da rede',async()=>{const {api,calls}=await fixture(()=>({data:{}}));await assert.rejects(()=>api.signUp('ana@@example.com',password,'Ana'));await assert.rejects(()=>api.signUp('ana@example.com',password,' '));for(const p of ['short','testpassword123','TESTPASSWORD123','TestPassword','aA1'+'é'.repeat(40)])await assert.rejects(()=>api.signUp('ana@example.com',p,'Ana'));assert.equal(calls.length,0);});
test('credenciais inválidas não criam sessão',async()=>{const {api}=await fixture(()=>({status:400,data:{msg:'Invalid login credentials',error_code:'invalid_credentials'}}));await assert.rejects(()=>api.signIn('ana@example.com',password),e=>e.code==='invalid_credentials');assert.equal(api.session,null);assert.equal(sessionStorage.values.size,0);});
test('cadastro sem tokens não é tratado como sucesso',async()=>{const {api}=await fixture(()=>({data:{user:validSession.user}}));await assert.rejects(()=>api.signUp('ana@example.com',password,'Ana'));assert.equal(api.session,null);});
test('abertura da conta usa identidade do servidor e provisionamento idempotente',async()=>{const {api,calls}=await fixture(call=>{if(call.url.endsWith('/signup'))return {data:validSession};if(call.url.endsWith('/user'))return {data:validSession.user};if(call.url.includes('ensure_alva_account'))return {data:null};if(call.url.includes('/profiles?'))return {data:[{id:'user-a',full_name:'Ana'}]};if(call.url.includes('/finance_data?'))return {data:[{data:{profile:{name:'Ana'}},revision:3}]};throw new Error('Unexpected call');});await api.signUp('ana@example.com',password,'Ana');const account=await api.loadAccount();assert.equal(account.revision,3);assert.deepEqual(calls[2].body,{});assert.equal(calls[2].options.headers.Authorization,'Bearer test-access-token');assert.ok(calls.filter(c=>c.url.includes('/profiles?')||c.url.includes('/finance_data?')).every(c=>c.url.includes('user-a')));});
test('renovação rejeitada limpa sessão e não salva dados',async()=>{const {api,calls}=await fixture(()=>({status:400,data:{msg:'Invalid Refresh Token'}}),{...validSession,expires_at:1});await assert.rejects(()=>api.saveAccount({},0));assert.equal(api.session,null);assert.equal(localStorage.values.size,0);assert.equal(calls.length,1);});
test('sessão revogada no banco é limpa no cliente',async()=>{const {api}=await fixture(()=>({status:403,data:{message:'session_expired',code:'28000'}}),{...validSession,expires_at:Date.now()/1000+900});await assert.rejects(()=>api.saveAccount({},0));assert.equal(api.session,null);});
test('tokens na URL não autenticam e são removidos da barra de endereço',async()=>{const {api,calls}=await fixture(()=>({data:{}}));let cleaned=false;globalThis.location={hash:'#access_token=untrusted&refresh_token=untrusted',pathname:'/',search:''};globalThis.history={replaceState:()=>cleaned=true};assert.equal(await api.acceptCallback(),false);assert.equal(cleaned,true);assert.equal(api.session,null);assert.equal(calls.length,0);});
test('sair revoga sessão atual no servidor e limpa armazenamento',async()=>{const {api,calls}=await fixture(()=>({data:null}),{...validSession,expires_at:Date.now()/1000+900});const revocation=api.logout();assert.equal(localStorage.values.size,0);assert.equal(api.session,null);await revocation;assert.ok(calls[0].url.endsWith('/logout?scope=local'));assert.equal(sessionStorage.values.size,0);});

test('sessão da aba anterior migra para o armazenamento do navegador',async()=>{
 const {api,calls}=await fixture(()=>({data:null}),{...validSession,saved_until:Date.now()+60000},'sessionStorage');
 assert.equal(api.session.refresh_token,validSession.refresh_token);
 assert.equal(localStorage.values.size,1);
 assert.equal(sessionStorage.values.size,0);
 assert.equal(api.session.saved_until,undefined);
 assert.equal(calls.length,0);
});

test('reabertura após expirar o acesso renova a sessão e salva o novo token',async()=>{
 const renewed={...validSession,access_token:'rotated-access',refresh_token:'rotated-refresh'};
 const {calls}=await fixture(call=>{
  if(call.url.endsWith('grant_type=refresh_token'))return {data:renewed};
  return {data:4};
 },{...validSession,expires_at:1});
 globalThis.sessionStorage=storage();
 const reopened=await import(`../dist/api.js?auth_test=${serial++}`);
 const results=await Promise.all([reopened.saveAccount({},3),reopened.saveAccount({},3)]);
 assert.deepEqual(results,[4,4]);
 assert.deepEqual(calls[0].body,{refresh_token:validSession.refresh_token});
 assert.equal(calls.filter(call=>call.url.includes('grant_type')).length,1);
 assert.equal(calls[1].options.headers.Authorization,'Bearer rotated-access');
 assert.equal(JSON.parse(localStorage.getItem('alva-auth-session-v1')).refresh_token,'rotated-refresh');
});

test('falha temporária de renovação mantém a sessão para nova tentativa',async()=>{
 const {api}=await fixture(()=>({status:503,data:{message:'Unavailable'}}),{...validSession,expires_at:1});
 await assert.rejects(api.saveAccount({},0),{status:503});
 assert.equal(api.session.refresh_token,validSession.refresh_token);
 assert.equal(localStorage.values.size,1);
});

test('sair enquanto o token é renovado impede que a resposta restaure a sessão',async()=>{
 let finishRefresh;
 const refreshing=new Promise(resolve=>{finishRefresh=resolve;});
 let attempts=0;
 const {api}=await fixture(async call=>{
  if(!call.url.endsWith('grant_type=refresh_token'))return {data:null};
  if(attempts++===0)await refreshing;
  return {data:{...validSession,access_token:'rotated-access',refresh_token:'rotated-refresh'}};
 },{...validSession,expires_at:1});
 const save=api.saveAccount({},0);
 const rejected=assert.rejects(save,{status:401});
 const revocation=api.logout();
 assert.equal(api.session,null);
 assert.equal(localStorage.values.size,0);
 finishRefresh();
 await Promise.all([rejected,revocation]);
 assert.equal(localStorage.values.size,0);
});
