import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyData } from '../dist/finance.js';
import { attentionPlan, crossedLimits, recordDemoNotices } from '../dist/notices.js';
import { createNoticeHandler } from '../supabase/functions/notification-center/handler.js';

const account = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const otherAccount = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const expense = amount => ({ name: 'Mercado da semana', category: 'Alimentação', type: 'expense', amount, date: '2026-11-09' });
function finances(spent) {
  return {
    ...emptyData(),
    spending_limits: [{ id: 'd0000000-0000-0000-0000-000000000001', name: 'Mercado', limit: 10000, scope: 'keyword' }],
    transactions: [expense(spent)]
  };
}

test('a Central usa 80% exatos, registra 100% e não duplica avisos ao refazer um gasto', () => {
  const month = '2026-11';
  const below = finances(7999);
  assert.deepEqual(crossedLimits(finances(0), below, month), []);
  const warning = finances(8000);
  recordDemoNotices(warning, crossedLimits(below, warning, month), month);
  assert.deepEqual(warning.notice_history.map(row => row.level), [80]);
  recordDemoNotices(warning, crossedLimits(below, warning, month), month);
  assert.equal(warning.notice_history.length, 1);
  const reached = { ...warning, transactions: [expense(10000)] };
  recordDemoNotices(reached, crossedLimits(warning, reached, month), month);
  assert.deepEqual(reached.notice_history.map(row => row.level), [100, 80]);
  assert.deepEqual(crossedLimits(reached, finances(10001), month), []);
  assert.equal(crossedLimits(below, finances(10000), month).length, 1);
});

test('o assessor prioriza vencidos e limites atingidos, com ações pessoais e do negócio', () => {
  const state = {
    ...finances(10000),
    debts: [{ id: 'card', name: 'Cartão', balance: 1000, due: '2026-11-15' }, { name: 'Quitada', balance: 0, due: '2026-11-08' }],
    business: {
      taxes: [{ id: 'das', name: 'DAS', amount: 7000, due_date: '2026-11-08', paid: false }],
      records: [{ name: 'Venda a receber', amount: 500, type: 'income', status: 'pending', due_date: '2026-11-10' }]
    }
  };
  const plan = attentionPlan(state, '2026-11-09');
  assert.deepEqual(plan.map(item => item.target), ['business', 'transactions', 'debts']);
  assert.equal(plan[0].title, 'DAS');
  assert.deepEqual(plan.map(({entity,itemId}) => [entity,itemId]), [
    ['tax','das'], ['limit',state.spending_limits[0].id], ['debt','card']
  ]);
  assert.match(plan[1].title, /Mercado.*100%/);
  assert.equal(plan[2].title, 'Cartão');
});

function edge({ session = account, provider = true, providerStatus = 200, claimed = [] } = {}) {
  const calls = [];
  let storedDigest;
  const env = {
    SUPABASE_URL: 'https://test.supabase.invalid', SUPABASE_ANON_KEY: 'test-public-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    RESEND_API_KEY: provider ? 'test-email-key' : undefined, ALVA_ALERT_FROM: 'Alva <alerta@example.invalid>',
    ALVA_NOTICE_WORKER_SECRET: 'test-worker-secret-longer-than-32-characters'
  };
  const handler = createNoticeHandler({
    env: key => env[key],
    fetcher: async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, body, headers: init.headers });
      if (url.endsWith('/auth/v1/user')) return Response.json({ id: account, email: 'Conta@example.invalid' });
      if (url.endsWith('/alva_notice_session')) return Response.json(session);
      if (url.endsWith('/alva_notice_contact')) {
        assert.equal(body.p_user, account);
        assert.equal(body.p_email, 'conta@example.invalid');
        assert.equal(init.headers.Authorization, 'Bearer test-service-key');
        if (body.p_action === 'start') {
          assert.match(body.p_digest, /^[0-9a-f]{64}$/);
          storedDigest = body.p_digest;
          return Response.json({ state: 'challenge_created' });
        }
        if (body.p_action === 'confirm') return Response.json({ state: body.p_digest === storedDigest ? 'enabled' : 'invalid_code' });
        return Response.json({ state: 'disabled' });
      }
      if (url.endsWith('/alva_claim_notice_email')) return Response.json(claimed);
      if (url.endsWith('/alva_finish_notice_email')) return Response.json(true);
      if (url === 'https://api.resend.com/emails') return Response.json({}, { status: providerStatus });
      throw new Error('Solicitação inesperada.');
    }
  });
  const request = (body, headers = {}) => handler(new Request('https://test.supabase.invalid/notification-center', {
    method: 'POST', headers: { authorization: 'Bearer test-session-token', ...headers }, body: JSON.stringify(body)
  }));
  return { calls, request, env };
}

test('o código vai só para o endereço do Auth e seu hash vincula a confirmação à conta', async () => {
  const { request, calls } = edge();
  const start = await request({ action: 'start', email: 'intruso@example.invalid', user_id: otherAccount });
  assert.deepEqual(await start.json(), { state: 'pending' });
  const out = calls.find(call => call.url === 'https://api.resend.com/emails');
  assert.deepEqual(out.body.to, ['conta@example.invalid']);
  const code = out.body.text.match(/\b\d{6}\b/)[0];
  const wrong = (code === '000000' ? '111111' : '000000');
  assert.equal((await request({ action: 'confirm', code: wrong })).status, 400);
  assert.deepEqual(await (await request({ action: 'confirm', code })).json(), { state: 'enabled' });
});

test('sessão revogada, usuário divergente ou segredo de worker inválido bloqueiam o acesso', async () => {
  for (const session of [null, otherAccount]) {
    const { request, calls } = edge({ session });
    assert.equal((await request({ action: 'start' })).status, 401);
    assert.equal(calls.length, 2);
  }
  const { request, calls } = edge();
  assert.equal((await request({}, { 'x-alva-worker-key': 'incorrect' })).status, 401);
  assert.equal(calls.length, 0);
});

test('sem provedor o painel indica e-mail indisponível e não cria desafio', async () => {
  const { request, calls } = edge({ provider: false });
  assert.deepEqual(await (await request({ action: 'status' })).json(), { email: 'conta@example.invalid', available: false, state: 'disabled' });
  assert.equal((await request({ action: 'start' })).status, 503);
  assert.equal(calls.filter(call => call.url.endsWith('/alva_notice_contact')).length, 1);
});

test('worker usa idempotência, não expõe valores e registra falha temporária para reprocessar', async () => {
  const job = { id: 'test-job', lease: 'test-lease', email: 'verificado@example.invalid', level: 100, amount: 123456, label: 'Categoria privada' };
  const { request, calls, env } = edge({ providerStatus: 429, claimed: [job] });
  const response = await request({}, { 'x-alva-worker-key': env.ALVA_NOTICE_WORKER_SECRET });
  assert.equal(response.status, 200);
  const [queue, send, finish] = calls;
  assert.equal(queue.body.p_user, null);
  assert.deepEqual(send.body.to, [job.email]);
  assert.equal(send.headers['Idempotency-Key'], 'alva-notice/test-job');
  assert.doesNotMatch(JSON.stringify(send.body), /123456|Categoria privada/);
  assert.deepEqual(finish.body, { p_id: 'test-job', p_lease: 'test-lease', p_accepted: false, p_retryable: true });
});
