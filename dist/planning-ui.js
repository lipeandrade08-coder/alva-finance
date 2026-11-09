import { money, numeric, totals, escapeHTML as e } from './finance.js';
import { noticeDate } from './notices.js';
import { debtPlan, personalCashToday, planningEnd, withdrawalPlan } from './planning.js';

const moneyText = value => `<span class="money">${money(value)}</span>`;
const shortDate = date => date.slice(5).split('-').reverse().join('/');
const months = n => `${n} ${n === 1 ? 'mês' : 'meses'}`;
const centsFrom = value => value === '' || value == null ? NaN : Math.round(Number(value) * 100);
const field = (label, name, value, options = '') =>
  `<label class="field">${label}<input class="input" name="${name}" value="${e(value)}" ${options}></label>`;
const moneyField = (label, name, value = '', min = 0) =>
  field(label, name, value, `type="number" inputmode="decimal" min="${min}" max="100000000" step="0.01"`);
const row = (label, value) => `<div class="planning-line"><span>${label}</span><strong>${value}</strong></div>`;

function withdrawalDetails(plan, today) {
  const status = plan.maxToday === null
    ? 'Revise o saldo inicial e as pendências com dados incompletos antes de usar a estimativa.'
    : plan.firstBelowReserve
      ? `O caixa ${plan.lowest.balance < 0 ? 'pode ficar negativo' : 'fica abaixo da reserva'} neste cenário. Primeiro dia abaixo da reserva: ${shortDate(plan.firstBelowReserve)}.`
      : 'A reserva fica preservada durante os 30 dias neste cenário.';
  const title = plan.maxToday === null ? 'Estimativa indisponível' : moneyText(plan.maxToday);
  const entries = plan.rows.map(day => {
    const payments = day.payments.map(item => e(item.name)).join(', ');
    const receipts = day.receipts.map(item => e(item.name)).join(', ');
    const changes = [
      payments && `Pagamentos: ${payments}`,
      receipts && `Recebimentos previstos: ${receipts}`,
      day.withdrawal && `Retirada: ${moneyText(day.withdrawal)}`
    ].filter(Boolean).join(' · ');
    return `<tr><td>${shortDate(day.day)}${changes ? `<small>${changes}</small>` : ''}</td><td>${moneyText(day.conservative)}</td><td>${moneyText(day.expected)}</td></tr>`;
  }).join('');
  return `<div class="planning-result">
    <span>Disponível para retirada hoje</span><strong class="planning-value">${title}</strong>
    <p class="form-note">Estimativa com os registros de ${shortDate(today)} a ${shortDate(planningEnd(today))}, sem contar recebimentos pendentes.</p>
    ${row('Caixa registrado hoje', moneyText(plan.cash))}
    ${row('Contas a pagar (inclui vencidas)', moneyText(plan.pendingPayments))}
    ${row('Tributos em aberto no período', moneyText(plan.pendingTaxes))}
    ${row('Reserva definida por você', moneyText(plan.reserve))}
    ${row('Recebimentos previstos no período', moneyText(plan.pendingReceivables))}
    ${plan.unscheduledReceivables ? row('A receber em atraso ou sem data válida', moneyText(plan.unscheduledReceivables)) : ''}
    <p class="planning-status ${plan.firstBelowReserve || plan.maxToday === null ? 'planning-warning' : ''}">${status}</p>
    ${row(`Menor saldo do negócio · ${shortDate(plan.lowest.day)}`, moneyText(plan.lowest.balance))}
    <details class="planning-details"><summary>Conferir datas e saldos do caixa</summary>
      <div class="planning-table"><table><thead><tr><th>Data</th><th>Sem entradas previstas</th><th>Se receber no prazo</th></tr></thead><tbody>${entries}</tbody></table></div>
    </details>
  </div>`;
}

function payoffDetails(result) {
  if (result.status === 'stalled') return 'A parcela não reduz o saldo';
  if (result.status === 'too-long') return 'Acima de 600 meses';
  return `${months(result.months)} · ${moneyText(result.interest)} em juros`;
}

export function createPlanningUI({ getData, modal, openWithdrawal }) {
  function openCash() {
    const today = noticeDate();
    modal('Quanto posso tirar do negócio?', `
      <form method="post" id="withdrawal-plan-form">
        <p class="form-note">Projete o caixa do negócio para os próximos 30 dias. Confira o saldo e os compromissos cadastrados antes de decidir.</p>
        <div class="form-grid">
          ${moneyField('Reserva mínima do negócio (R$)', 'reserve')}
          ${moneyField('Retirada para simular (R$)', 'withdrawal', '0')}
          ${field('Data simulada', 'planned_date', today, `type="date" min="${today}" max="${planningEnd(today)}" required`)}
        </div>
        <div class="planning-output" role="status"></div>
        <p class="form-error" role="alert"></p>
        <div class="modal-actions">
          <button class="button secondary" type="button" data-action="close-modal">Fechar</button>
          <button class="button" type="submit" disabled>Preparar registro de hoje</button>
        </div>
      </form>`, '');
    update(document.querySelector('#withdrawal-plan-form'));
  }

  function openDebt(id) {
    const state = getData();
    const debt = state.debts.find(item => item.id === id && item.balance > 0);
    if (!debt) throw new Error('Esta dívida não está mais em aberto.');
    const options = state.goals.filter(item => item.saved < item.target).map(item =>
      `<option value="${e(item.id)}">${e(item.name)}</option>`).join('');
    modal('Simular quitação', `
      <form method="post" id="debt-plan-form" autocomplete="off">
        <p><strong>${e(debt.name)}</strong></p>
        <p class="form-note">Use o saldo devedor sem juros futuros e a taxa efetiva mensal do contrato. A simulação supõe taxa e parcelas fixas, com o extra reduzindo o saldo a cada mês.</p>
        <div class="form-grid">
          ${moneyField('Saldo devedor sem juros futuros (R$)', 'principal', '', 0.01)}
          ${field('Taxa efetiva ao mês (%)', 'rate', '', 'type="number" inputmode="decimal" min="0" max="100" step="0.0001"')}
          ${moneyField('Parcela mensal atual (R$)', 'payment', debt.installment_amount > 0 ? numeric(debt.installment_amount) : '', 0.01)}
          ${moneyField('Extra por mês (R$)', 'extra', '0')}
          ${options ? `<label class="field">Meta para comparar<select name="goal_id"><option value="">Selecione uma meta</option>${options}</select></label>
            ${moneyField('Aporte mensal previsto na meta (R$)', 'goal_contribution')}` : ''}
        </div>
        <div class="planning-output" role="status"></div>
        <div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Fechar</button></div>
      </form>`, '');
    update(document.querySelector('#debt-plan-form'));
  }

  function cashResult(form) {
    const data = getData();
    const input = new FormData(form);
    const today = noticeDate();
    const reserve = centsFrom(input.get('reserve'));
    const amount = centsFrom(input.get('withdrawal') || '0');
    const date = input.get('planned_date');
    if (Number.isNaN(reserve)) return { html: '<p class="form-note">Informe quanto precisa ficar reservado no negócio. Digite 0 se não quiser separar uma reserva nesta simulação.</p>' };
    const plan = withdrawalPlan(data.business, { reserve, amount, date, today });
    const effect = amount > 0 ? row(`Saldo pessoal atual + retirada de ${shortDate(date)}`, moneyText(personalCashToday(data, today) + amount)) : '';
    return {
      html: withdrawalDetails(plan, today) + (effect ? `<div class="planning-result">${effect}<p class="form-note">Projeção pessoal que soma apenas a entrada simulada ao saldo de hoje.</p></div>` : ''),
      recordable: date === today && amount > 0 && plan.maxToday !== null && amount <= plan.maxToday,
      amount
    };
  }

  function debtResult(form) {
    const data = getData();
    const input = new FormData(form);
    if (['principal', 'rate', 'payment'].some(name => input.get(name) === '')) {
      return '<p class="form-note">Preencha o saldo devedor, a taxa e a parcela para comparar prazo e juros.</p>';
    }
    const plan = debtPlan({
      principal: centsFrom(input.get('principal')),
      rate: Number(input.get('rate')),
      payment: centsFrom(input.get('payment')),
      extra: centsFrom(input.get('extra') || '0')
    });
    const firstPayment = plan.accelerated.firstPayment;
    const today = noticeDate();
    const monthlyBudget = data.profile.monthly_budget;
    const monthExpenses = monthlyBudget > 0 ? totals(data, today.slice(0, 7)).expense : 0;
    const goal = data.goals.find(item => item.id === input.get('goal_id'));
    const goalContribution = centsFrom(input.get('goal_contribution'));
    let goalImpact = '';
    if (goal && Number.isFinite(goalContribution) && goalContribution >= 0 && goalContribution <= 10_000_000_000) {
      const remaining = Math.max(0, goal.target - goal.saved);
      const planned = Math.min(remaining, goalContribution);
      const adjusted = Math.max(0, planned - plan.extraUsed);
      goalImpact = `<p class="form-note">Se o extra sair do aporte deste mês para <strong>${e(goal.name)}</strong>, o aporte cai de ${moneyText(planned)} para ${moneyText(adjusted)}. Depois desse aporte, faltariam ${moneyText(remaining - adjusted)} para a meta.</p>`;
    } else if (goal) {
      goalImpact = '<p class="form-note">Informe o aporte que planeja para comparar o impacto na meta.</p>';
    }
    return `<div class="planning-result">
      ${row('Com a parcela atual', payoffDetails(plan.regular))}
      ${row('Com o extra mensal', payoffDetails(plan.accelerated))}
      ${plan.interestSaved === null ? '' : row('Economia estimada', `${months(plan.monthsSaved)} · ${moneyText(plan.interestSaved)} em juros`)}
      ${row('Próximo pagamento simulado', moneyText(firstPayment))}
      ${row('Saldo pessoal de hoje após este pagamento', moneyText(personalCashToday(data, today) - firstPayment))}
      ${monthlyBudget > 0 ? row('Margem no orçamento do mês após pagar', moneyText(monthlyBudget - monthExpenses - firstPayment)) : ''}
      ${goalImpact}
      <p class="form-note">O saldo pessoal considera apenas este pagamento. O contrato pode prever outro cálculo, encargos ou condições para antecipar parcelas. Confira com o credor antes de pagar.</p>
    </div>`;
  }

  function update(form) {
    const output = form.querySelector('.planning-output');
    const expanded = output.querySelector('details')?.open;
    const submit = form.querySelector('[type="submit"]');
    try {
      const result = form.id === 'withdrawal-plan-form' ? cashResult(form) : { html: debtResult(form) };
      output.innerHTML = result.html;
      if (expanded && output.querySelector('details')) output.querySelector('details').open = true;
      if (submit) submit.disabled = !result.recordable;
    } catch (error) {
      output.textContent = error.message;
      if (submit) submit.disabled = true;
    }
  }

  function input(control) {
    const form = control.closest('#withdrawal-plan-form, #debt-plan-form');
    if (!form) return false;
    update(form);
    return true;
  }

  function submit(form) {
    if (form.id === 'debt-plan-form') return true;
    if (form.id !== 'withdrawal-plan-form') return false;
    const result = cashResult(form);
    if (!result.recordable) throw new Error('Escolha um valor dentro da estimativa e a data de hoje.');
    openWithdrawal(result.amount);
    return true;
  }

  return { openCash, openDebt, input, submit };
}
