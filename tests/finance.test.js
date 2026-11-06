import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,cents,totals,projection,budgetBreakdown,escapeHTML} from '../dist/finance.js';
test('interpreta valores brasileiros e rejeita valores inválidos',()=>{assert.equal(cents('1.234,56'),123456);assert.equal(cents('1234.56'),123456);assert.equal(cents('12,90'),1290);for(const value of ['abc','-1','0','Infinity'])assert.throws(()=>cents(value));});
test('saldo é global e resumo mensal respeita o mês',()=>{const s=emptyData('Teste');s.profile.opening_balance=10000;s.transactions=[{type:'income',amount:5000,date:'2026-10-01'},{type:'expense',amount:3000,date:'2026-11-02',category:'Alimentação'},{type:'income',amount:9000,date:'2026-11-03'}];const t=totals(s,'2026-11');assert.equal(t.balance,21000);assert.equal(t.income,9000);assert.equal(t.expense,3000);assert.deepEqual(budgetBreakdown(s,'2026-11'),[['Alimentação',3000]]);});
test('simulação com taxa zero preserva capital mais aportes',()=>{const p=projection(100000,30000,0,5);assert.equal(p.total,1900000);assert.equal(p.contributed,1900000);assert.equal(p.points.length,6);});
test('taxa anual efetiva é convertida para capitalização mensal',()=>{assert.equal(projection(100000,0,10,1).total,110000);assert.equal(projection(100000,0,10,2).total,121000);});
test('textos do usuário são escapados para HTML',()=>{assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');});
