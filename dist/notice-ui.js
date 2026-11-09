import { escapeHTML as e, money } from './finance.js';
import { attentionPlan, noticeDate } from './notices.js';

const statusLabels = {
  panel: 'No painel', queued: 'E-mail na fila', sending: 'Enviando e-mail', accepted: 'Aceito para envio',
  failed: 'Falha no envio por e-mail', paused: 'Envio externo desativado'
};

function localDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(date) : '';
}

export function createNoticeUI({ api, getData, isDemo, identity, icon, onUpdate, onReadDemo }) {
  let rows = [];
  let channel;
  let historyError = false;
  let channelError = '';
  let status = '';
  let pending = false;
  let sequence = 0;

  function reset() {
    sequence++;
    rows = [];
    channel = undefined;
    historyError = false;
    channelError = '';
    status = '';
    pending = false;
  }

  const history = () => isDemo() ? (getData().notice_history ?? []) : rows;
  const unread = () => history().filter(row => !row.read_at).length;

  async function refresh({ settings = false } = {}) {
    const owner = identity();
    if (!owner) return;
    if (isDemo()) { onUpdate(); return; }
    const request = ++sequence;
    const [notices, email] = await Promise.allSettled([api.listNotices(), settings ? api.noticeChannel('status') : Promise.resolve(null)]);
    if (request !== sequence || owner !== identity()) return;
    historyError = notices.status === 'rejected';
    if (notices.status === 'fulfilled' && Array.isArray(notices.value)) rows = notices.value;
    if (settings) {
      if (email.status === 'fulfilled') {
        channel = email.value;
        channelError = '';
      } else channelError = 'Não foi possível consultar o canal de e-mail agora.';
    }
    onUpdate();
  }

  function actionCards() {
    const tasks = attentionPlan(getData());
    if (!tasks.length) return `<div class="notice-empty"><strong>Seu dia está em ordem</strong><p>Quando houver um vencimento próximo ou um limite que merece atenção, ele aparece aqui.</p><button type="button" class="button secondary" data-nav="transactions">Revisar lançamentos</button></div>`;
    return `<ul class="notice-list">${tasks.map(task => `<li class="notice-item"><span class="notice-icon">${icon(task.icon)}</span><div class="notice-copy"><strong>${e(task.title)}</strong><p>${e(task.detail)}</p></div><button type="button" class="button secondary" data-notice-target="${task.target}">${task.action}</button></li>`).join('')}</ul>`;
  }

  function emailPanel() {
    if (isDemo()) return '<p class="notice-hint">Entre na sua conta para configurar avisos por e-mail.</p>';
    if (!channel) return `<p class="notice-hint">${e(channelError || 'Consultando o canal de e-mail…')}</p>${channelError ? '<button type="button" class="button secondary" data-notice-action="refresh">Tentar de novo</button>' : ''}`;
    if (!channel.available && channel.state !== 'enabled') return '<p class="notice-hint">O envio por e-mail está em preparação. Os avisos ficam disponíveis na Central.</p>';
    const disabled = pending ? ' disabled' : '';
    let controls;
    if (channel.state === 'enabled') {
      controls = `<span class="notice-pill active">E-mail confirmado</span><p>Novos avisos de limite serão encaminhados para <strong>${e(channel.email)}</strong>${channel.available ? '.' : ' quando o envio estiver disponível.'}</p><button type="button" class="button secondary" data-notice-action="disable"${disabled}>Desativar e-mail</button>`;
    } else if (channel.state === 'pending') {
      controls = `<p>Digite o código enviado para <strong>${e(channel.email)}</strong>. Ele vale por 10 minutos.</p><form id="notice-code-form" method="post" class="notice-code-form"><label class="field">Código de confirmação<input class="input" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></label><button type="submit" class="button"${disabled}>Confirmar e ativar</button></form><button type="button" class="button ghost" data-notice-action="start"${disabled}>Pedir outro código</button>`;
    } else {
      controls = `<p>Receba novos avisos de limite no e-mail <strong>${e(channel.email)}</strong>. Confirme o endereço para ativar e desligue quando quiser.</p><button type="button" class="button" data-notice-action="start"${disabled}>Enviar código</button>`;
    }
    return `<div class="notice-channel">${controls}<p role="status" class="notice-feedback ${channelError ? 'error' : ''}">${e(channelError || status)}</p></div>`;
  }

  function render() {
    const entries = history();
    const count = unread();
    const list = entries.length ? `<ul class="notice-list">${entries.map(row => `<li class="notice-item ${row.read_at ? '' : 'unread'}"><span class="notice-icon">${icon(row.level === 100 ? 'alert' : 'bell')}</span><div class="notice-copy"><strong>${row.level === 100 ? 'Limite atingido' : 'Perto do limite'} · ${e(row.label)}</strong><p>${money(row.spent_cents)} de ${money(row.limit_cents)} · ${e(localDate(row.created_at))}</p><span class="notice-pill">${e(statusLabels[row.email_state] || 'No painel')}</span></div><button type="button" class="button secondary" data-notice-open="${e(row.id)}">Ver gastos</button></li>`).join('')}</ul>` : `<div class="notice-empty"><strong>${historyError ? 'Histórico indisponível agora' : 'Nenhum aviso registrado'}</strong><p>${historyError ? 'Tente atualizar em instantes.' : 'Se um limite chegar a 80% ou 100%, o aviso ficará disponível aqui.'}</p></div>`;
    return `<div class="notice-layout"><section class="panel notice-focus"><span class="notice-kicker">${icon('spark')} ASSISTENTE ALVA</span><h2>O que merece sua atenção</h2><p class="notice-hint">Próximos vencimentos e limites do mês, com um atalho para agir.</p>${actionCards()}</section><section class="panel notice-settings"><span class="notice-kicker">${icon('mail')} SEU CANAL</span><h2>Avisos por e-mail</h2>${emailPanel()}</section><section class="panel notice-history"><div class="notice-heading"><div><h2>Histórico de avisos</h2><p class="notice-hint">${count ? `${count} novo${count === 1 ? '' : 's'} nos avisos recentes` : 'Seus avisos recentes'}</p></div><div class="notice-actions"><button type="button" class="button secondary" data-notice-action="refresh">Atualizar</button>${count ? '<button type="button" class="button ghost" data-notice-action="read-all">Marcar como lidos</button>' : ''}</div></div>${list}</section></div>`;
  }

  async function markRead(ids) {
    if (!ids.length) return;
    const owner = identity();
    if (isDemo()) await onReadDemo(ids);
    else {
      await api.readNotices(ids);
      if (owner !== identity()) return;
      const readAt = new Date().toISOString();
      const targets = new Set(ids);
      rows = rows.map(row => targets.has(row.id) ? { ...row, read_at: readAt } : row);
    }
    onUpdate();
  }

  async function changeEmail(action, code) {
    if (pending || isDemo()) return;
    const owner = identity();
    channelError = '';
    status = '';
    pending = true;
    onUpdate();
    try {
      const result = await api.noticeChannel(action, code ? { code } : {});
      if (owner !== identity()) return;
      channel = { ...channel, state: result.state };
      status = { pending: 'Código aceito para envio.', enabled: 'Avisos por e-mail ativados.', disabled: 'Avisos por e-mail desativados.' }[result.state] || '';
    } catch (error) {
      if (owner === identity()) channelError = error.message || 'Não foi possível concluir agora.';
    } finally {
      if (owner === identity()) { pending = false; onUpdate(); }
    }
  }

  async function click(button) {
    if (button.dataset.noticeOpen) {
      const row = history().find(item => item.id === button.dataset.noticeOpen);
      if (row && !row.read_at) await markRead([row.id]);
      return { target: 'transactions', month: row?.month?.slice(0, 7) };
    }
    if (button.dataset.noticeTarget) return { target: button.dataset.noticeTarget, month: noticeDate().slice(0, 7) };
    const action = button.dataset.noticeAction;
    if (!action) return false;
    if (action === 'refresh') await refresh({ settings: true });
    if (action === 'read-all') await markRead(history().filter(row => !row.read_at).map(row => row.id));
    if (action === 'start' || action === 'disable') await changeEmail(action);
    return true;
  }

  async function submit(form) {
    if (form.id !== 'notice-code-form') return false;
    await changeEmail('confirm', String(new FormData(form).get('code') || '').trim());
    return true;
  }

  return { refresh, render, unread, reset, click, submit };
}
