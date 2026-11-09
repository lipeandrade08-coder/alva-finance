const origins = ['https://alva-finance.vercel.app', 'https://alva-financas-pessoais-m5k7.lipe-andrade08.chatgpt.site', 'http://127.0.0.1:4173', 'http://localhost:4173'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const bytes = value => new TextEncoder().encode(value);

async function codeDigest(secret, user, email, code) {
  const key = await crypto.subtle.importKey('raw', bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = await crypto.subtle.sign('HMAC', key, bytes(JSON.stringify(['alva-notice-code', user, email, code])));
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

function sameSecret(expected, provided) {
  if (!expected || !provided || expected.length < 32 || expected.length !== provided.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  return difference === 0;
}

async function readAction(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_body');
  const decoder = new TextDecoder();
  let body = '';
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) throw new Error('invalid_body');
      body += decoder.decode(value, { stream: true });
    }
    const parsed = JSON.parse(body + decoder.decode());
    if (!parsed || typeof parsed.action !== 'string') throw new Error('invalid_body');
    return parsed;
  } finally { await reader.cancel().catch(() => {}); }
}

export function createNoticeHandler({ env, fetcher = fetch, background }) {
  const allowedOrigins = new Set([...origins, ...(env('ALVA_ALLOWED_ORIGIN') ?? '').split(',').map(value => value.trim()).filter(Boolean)]);
  const supabaseUrl = env('SUPABASE_URL');
  const publicKey = env('SUPABASE_ANON_KEY');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = env('RESEND_API_KEY');
  const from = env('ALVA_ALERT_FROM');
  const emailAvailable = Boolean(resendKey && from);
  const appUrl = 'https://alva-finance.vercel.app';

  async function rpc(name, payload, token = serviceKey, key = serviceKey) {
    const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, value: await response.json() };
  }

  async function getAccount(token) {
    const [user, session] = await Promise.all([
      fetcher(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: publicKey, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000)
      }),
      rpc('alva_notice_session', {}, token, publicKey)
    ]);
    if (!user.ok || !session.ok) return null;
    const account = await user.json();
    if (!account?.id || account.id !== session.value) return null;
    const email = String(account.email ?? '').trim().toLowerCase();
    return { id: account.id, email: email.length <= 254 && emailPattern.test(email) ? email : '' };
  }

  async function sendEmail({ email, subject, text, key }) {
    try {
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ from, to: [email], subject, text })
      });
      return { accepted: response.ok, retryable: response.status === 429 || response.status >= 500 };
    } catch { return { accepted: false, retryable: true }; }
  }

  async function drain(userId) {
    if (!emailAvailable) return;
    const claimed = await rpc('alva_claim_notice_email', { p_user: userId });
    if (!claimed.ok || !Array.isArray(claimed.value)) throw new Error('queue_unavailable');
    await Promise.all(claimed.value.map(async job => {
      const result = await sendEmail({
        email: job.email,
        subject: job.level === 100 ? 'Você atingiu um limite de gastos na Alva' : 'Um limite de gastos merece atenção',
        text: `Abra sua Central de avisos para conferir seus gastos e decidir o próximo passo.\n\n${appUrl}\n\nVocê pode desligar esses avisos na Central da Alva.`,
        key: `alva-notice/${job.id}`
      });
      const done = await rpc('alva_finish_notice_email', {
        p_id: job.id, p_lease: job.lease, p_accepted: result.accepted, p_retryable: result.retryable
      });
      if (!done.ok) throw new Error('queue_unavailable');
    }));
  }

  async function runDelivery(userId) {
    if (!emailAvailable) return;
    const task = drain(userId).catch(() => console.warn('Alva: não foi possível processar a fila de avisos.'));
    if (background) background(task);
    else await task;
  }

  return async request => {
    const origin = request.headers.get('origin');
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      ...(origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {})
    };
    const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
    if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Origem não autorizada.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply({ error: 'Método não permitido.' }, 405);
    if (!supabaseUrl || !publicKey || !serviceKey) return reply({ error: 'Central temporariamente indisponível.' }, 503);
    const workerKey = request.headers.get('x-alva-worker-key');
    if (workerKey) {
      if (!sameSecret(env('ALVA_NOTICE_WORKER_SECRET'), workerKey)) return reply({ error: 'Não autorizado.' }, 401);
      try { await drain(null); return reply({ ok: true }); }
      catch { return reply({ error: 'Fila temporariamente indisponível.' }, 503); }
    }
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply({ error: 'Entre na sua conta.' }, 401);
    try {
      const account = await getAccount(authorization.slice(7));
      if (!account) return reply({ error: 'Entre novamente para continuar.' }, 401);
      let body;
      try { body = await readAction(request); }
      catch { return reply({ error: 'Solicitação inválida.' }, 400); }
      const contact = (action, digest = null) => rpc('alva_notice_contact', {
        p_user: account.id, p_email: account.email, p_action: action, p_digest: digest
      });
      if (body.action === 'status') {
        if (!account.email) return reply({ email: '', available: false, state: 'disabled' });
        const result = await contact('status');
        if (!result.ok) return reply({ error: 'Central temporariamente indisponível.' }, 503);
        if (result.value.state === 'enabled') await runDelivery(account.id);
        return reply({ email: account.email, available: emailAvailable, state: result.value.state });
      }
      if (body.action === 'flush') {
        await runDelivery(account.id);
        return reply({ ok: true });
      }
      if (body.action === 'disable') {
        const result = await contact('disable');
        return result.ok ? reply({ state: 'disabled' }) : reply({ error: 'Não foi possível desativar os avisos.' }, 503);
      }
      if (!['start','confirm'].includes(body.action)) return reply({ error: 'Ação inválida.' }, 400);
      if (!emailAvailable || !account.email) return reply({ error: 'A confirmação por e-mail está em configuração.' }, 503);
      if (body.action === 'confirm') {
        if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) return reply({ error: 'Digite os seis dígitos do código.' }, 400);
        const result = await contact('confirm', await codeDigest(serviceKey, account.id, account.email, body.code));
        if (!result.ok) return reply({ error: 'Não foi possível confirmar agora.' }, 503);
        if (result.value.state === 'enabled') return reply({ state: 'enabled' });
        return reply({ error: result.value.state === 'expired' ? 'Código expirado ou limite de tentativas atingido. Peça outro código.' : 'Código incorreto. Confira o e-mail e tente novamente.' }, 400);
      }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
      const digest = await codeDigest(serviceKey, account.id, account.email, code);
      const result = await contact('start', digest);
      if (!result.ok) return reply({ error: 'Não foi possível pedir o código agora.' }, 503);
      if (result.value.state === 'enabled') return reply({ state: 'enabled' });
      if (result.value.state === 'rate_limited') return reply({ error: 'Aguarde antes de pedir outro código.' }, 429);
      if (result.value.state !== 'challenge_created') return reply({ error: 'Não foi possível preparar o código.' }, 400);
      const delivery = await sendEmail({
        email: account.email, subject: 'Confirme os avisos por e-mail da Alva',
        text: `Seu código é ${code}. Digite-o na Central de avisos da Alva em até 10 minutos. A confirmação ativa os avisos por e-mail.`,
        key: `alva-confirm/${crypto.randomUUID()}`
      });
      if (!delivery.accepted) {
        await contact('cancel_code', digest);
        return reply({ error: 'O provedor não aceitou o envio agora. Tente novamente mais tarde.' }, 502);
      }
      return reply({ state: 'pending' });
    } catch { return reply({ error: 'Central temporariamente indisponível.' }, 503); }
  };
}
