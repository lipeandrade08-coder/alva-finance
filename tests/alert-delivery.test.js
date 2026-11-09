import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as nodeModule from 'node:module';

const env = new Map();
let handler;
if (typeof nodeModule.stripTypeScriptTypes === 'function') {
  const source = await readFile(new URL('../supabase/functions/financial-agent/index.ts', import.meta.url), 'utf8');
  const javascript = nodeModule.stripTypeScriptTypes(source, { mode: 'strip' });
  globalThis.Deno = { env: { get: key => env.get(key) }, serve: fn => { handler = fn; } };
  await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);
}
const edgeTest = (name, run) => test(name, { skip: !handler && 'Use Node.js 22.13 ou mais recente para testar a Edge Function.' }, run);
const limitId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const month = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date());
const verified = { email: 'confirmed@example.com', whatsapp: '+5511987654321' };
const limit = { id: limitId, name: 'Mercado', scope: 'keyword', limit: 10000, channel: 'both' };
const state = {
  profile: { alert_email: verified.email, alert_whatsapp: '11987654321' },
  transactions: [{ name: 'Mercado da semana', type: 'expense', date: `${month}-01`, amount: 10500 }],
  spending_limits: [limit]
};

async function requestAlert(t, { authorized = true, appMetadata = {}, currentState = state, quota = true, quotaStatus = 200, payload = {} } = {}) {
  env.set('SUPABASE_URL', 'https://test.supabase.invalid');
  env.set('SUPABASE_ANON_KEY', 'synthetic-public-key');
  env.set('RESEND_API_KEY', 'synthetic-provider-key');
  env.set('ALVA_ALERT_FROM', 'Alva <alerts@example.com>');
  env.set('WHATSAPP_WEBHOOK_URL', 'https://test-webhook.invalid/whatsapp');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: userId, email: verified.email, app_metadata: appMetadata, user_metadata: { alva_verified_alerts: verified } }, { status: authorized ? 200 : 401 });
    if (url.includes('/rest/v1/finance_data?')) return Response.json([{ data: currentState }]);
    if (url.endsWith('/claim_agent_request')) return Response.json(quota, { status: quotaStatus });
    if (url === 'https://api.resend.com/emails' || url === env.get('WHATSAPP_WEBHOOK_URL')) return Response.json({ ok: true });
    throw new Error('Unexpected network call');
  });
  const response = await handler(new Request('https://test.supabase.invalid/agent', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-session' },
    body: JSON.stringify({ action: 'send_alert', limit_id: limitId, ...payload })
  }));
  return { response, calls };
}

const isExternal = call => !call.url.startsWith('https://test.supabase.invalid');

edgeTest('sessão inválida encerra a solicitação antes de ler dados ou falar com provedores', async t => {
  const { response, calls } = await requestAlert(t, { authorized: false, appMetadata: { alva_verified_alerts: verified } });
  assert.equal(response.status, 401);
  assert.equal(calls.length, 1);
});

edgeTest('contatos em metadados do cliente ou no corpo não autorizam envio', async t => {
  const { response, calls } = await requestAlert(t, { payload: { alert: { email: verified.email, whatsapp: verified.whatsapp, text: 'Texto arbitrário' } } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sent, { email: false, whatsapp: false });
  assert.equal(calls.some(isExternal), false);
});

edgeTest('alerta elegível usa somente destinos verificados e consulta a cota antes de enviar', async t => {
  const { response, calls } = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, payload: { alert: { email: 'intruso@example.com', whatsapp: '11111111111', text: 'Não enviar' } } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sent, { email: true, whatsapp: true });
  assert.ok(calls[2].url.endsWith('/claim_agent_request'));
  const [email, whatsapp] = calls.filter(isExternal);
  assert.deepEqual(JSON.parse(email.options.body).to, [verified.email]);
  assert.equal(JSON.parse(whatsapp.options.body).phone, verified.whatsapp.slice(1));
  assert.ok(email.options.headers['Idempotency-Key'].includes(limitId));
  assert.ok(!email.options.body.includes('Não enviar'));
});

edgeTest('cota esgotada ou serviço de cota indisponível bloqueiam o envio', async t => {
  const first = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, quota: false });
  assert.equal(first.response.status, 429);
  assert.equal(first.calls.some(isExternal), false);
  t.mock.restoreAll();
  const second = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, quotaStatus: 503 });
  assert.equal(second.response.status, 503);
  assert.equal(second.calls.some(isExternal), false);
});

edgeTest('limite ainda não atingido e mudança para destinatário não verificado não enviam', async t => {
  const low = structuredClone(state);
  low.transactions[0].amount = 5000;
  const first = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, currentState: low });
  assert.equal(first.calls.some(isExternal), false);
  t.mock.restoreAll();
  const changed = structuredClone(state);
  changed.profile = { alert_email: 'intruso@example.com', alert_whatsapp: '11999999999' };
  const second = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, currentState: changed });
  assert.equal(second.calls.some(isExternal), false);
});

edgeTest('modo WhatsApp da Central não usa o envio legado de e-mail', async t => {
  const { response, calls } = await requestAlert(t, { appMetadata: { alva_verified_alerts: verified }, payload: { whatsapp_only: true } });
  assert.deepEqual((await response.json()).sent, { email: false, whatsapp: true });
  assert.equal(calls.filter(isExternal).length, 1);
  assert.equal(calls.some(call => call.url === 'https://api.resend.com/emails'), false);
});
