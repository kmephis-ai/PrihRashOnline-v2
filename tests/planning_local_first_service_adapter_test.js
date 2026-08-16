'use strict';
const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','PlanningLocalFirstService.js'),'utf8');
assert(!/\.setValue\s*\(|\.setValues\s*\(|\.appendRow\s*\(|\.insertSheet\s*\(/.test(source),'planning source adapter must stay read-only');
assert(source.includes("BUDGET_SCENARIO: 'Базовый'"));
assert(source.includes("CASH_FLOW_BALANCE_PROXY: false"));
assert(source.includes('canonical_mutation_performed:false'));
assert(!source.includes('PR_CONFIG.ID_RULES'),'stale ID rules must not be source authority');

const sha=(v)=>crypto.createHash('sha256').update(String(v)).digest('hex');
class Sheet{constructor(values){this.values=values}getLastRow(){return this.values.length}getLastColumn(){return this.values[0].length}getRange(r,c,nr,nc){const v=this.values.slice(r-1,r-1+nr).map(row=>row.slice(c-1,c-1+nc));return {getValues:()=>v}}}
const sheets={
 '03 Бюджеты':new Sheet([
  ['Период','Сценарий','Категория','Подкатегория','Проект','План','Факт','Отклонение','Лимит','Комментарий','Статус','ID'],
  ['2026-08','Базовый','','','','1000','','','','','','BUD-TOTAL'],
  ['2026-08','Базовый','Продукты','','','300','','','','','','BUD-DETAIL'],
  ['2026-08','Экономный','','','','800','','','','','','BUD-ECON']
 ]),
 '04 Регулярные':new Sheet([
  ['ID','Активно','Наименование','Тип','Сумма','Счёт','Категория','Подкатегория','Член семьи','Проект','Периодичность','Следующая дата','Дата окончания','Комментарий'],
  ['REG-1',true,'Аренда','Расход',100,'Основной','Дом','','','','Ежемесячно','2026-08-20','',''],
  ['REG-2',true,'Перевод','Перевод',20,'Основной','','','','','Ежемесячно','2026-08-22','','']
 ]),
 '05 Обязательства':new Sheet([
  ['ID','Тип','Наименование','Организация','Обязательный платёж','Дата платежа','Остаток'],
  ['OBL-1','Кредит','Кредит','Банк',50,'2026-08-25',500],
  ['OBL-2','Кредит','Без даты','Банк',40,'',400]
 ])
};
const book={getSheetByName:(n)=>sheets[n]||null,getSpreadsheetTimeZone:()=> 'Etc/UTC'};
const canonicalRevision='a'.repeat(64);
const context={console,Date,Set,Object,JSON,Math,Number,String,Array,RegExp,Error,
 getBook_:()=>book,
 prhR2FinCurrency_:()=> 'RUB',
 prhR2FinSha256Hex_:sha,
 prhR2DataCreateSnapshot_:()=>({transactions:[],revision:canonicalRevision,dimensions:{resolvers:{account:(label)=>'account:'+sha(String(label).toLowerCase()).slice(0,16)}}}),
 Utilities:{formatDate:(date,_tz,_fmt)=>date.toISOString().slice(0,10)}
};
vm.createContext(context);vm.runInContext(source,context,{filename:'PlanningLocalFirstService.js'});
const first=context.prhPlanningLocalFirstBootstrap({});
assert.strictEqual(first.state,'FULL_SNAPSHOT');
assert.strictEqual(first.canonical_revision,canonicalRevision);
assert(/^[0-9a-f]{64}$/.test(first.planning_revision));
assert.strictEqual(first.source.budget.state,'READY');
assert.strictEqual(first.source.budget.plans.length,1,'detail/scenario rows must not be silently re-summed');
assert.strictEqual(first.source.budget.plans[0].budget_minor,100000);
assert.strictEqual(first.source.recurring.plans.length,1,'unsupported transfer recurrence must fail closed');
assert.strictEqual(first.source.recurring.unsupported_count,1);
assert.strictEqual(first.source.recurring.plans[0].direction,'OUTFLOW');
assert.strictEqual(first.source.recurring.plans[0].recurrence.interval_months,1);
assert.strictEqual(first.source.commitments.items.length,1,'commitment without explicit date must not be inferred');
assert.strictEqual(first.source.commitments.items[0].recurrence_inferred,false);
assert.strictEqual(first.source.liquidity.state,'SETUP_REQUIRED');
assert.strictEqual(first.source.liquidity.reason,'BALANCE_OBSERVATION_SHEET_MISSING');
assert.strictEqual(first.cash_flow_balance_proxy_used,false);
assert.strictEqual(first.financial_write_authorized,false);
const noop=context.prhPlanningLocalFirstBootstrap({local_planning_revision:first.planning_revision,expected_canonical_revision:canonicalRevision});
assert.strictEqual(noop.state,'NOOP');assert.strictEqual(noop.source,undefined);

sheets['06 Баланс']=new Sheet([
 ['ID','Дата и время','Счёт','Валюта','Остаток','Метод','Комментарий'],
 ['BAL-1','2026-08-01T00:00:00Z','Основной','RUB',1000,'Ручной',''],
 ['BAL-2','2026-08-16T23:59:59Z','Основной','RUB',900,'Выписка','']
]);
const withBalance=context.prhPlanningLocalFirstBootstrap({local_planning_revision:first.planning_revision,expected_canonical_revision:canonicalRevision});
assert.strictEqual(withBalance.state,'FULL_SNAPSHOT');
assert.strictEqual(withBalance.source.liquidity.state,'READY');
assert.strictEqual(withBalance.source.liquidity.observations.length,2);
assert.strictEqual(withBalance.source.liquidity.observations[0].balance_minor,100000);
assert.strictEqual(withBalance.source.liquidity.observations[0].provenance.capture_method,'MANUAL_DECLARED');
assert.strictEqual(withBalance.source.liquidity.observations[1].provenance.capture_method,'STATEMENT_DECLARED');
assert.notStrictEqual(withBalance.planning_revision,first.planning_revision);
assert.strictEqual(context.prhPlanningLocalFirstHealthToken(),'PRH_PLANNING_LF_V1|OWNER_AUTHORITY|READ_ONLY|NO_CASHFLOW_BALANCE_PROXY|OK');
const wire=context.prhPlanningLocalFirstBootstrapWire({});assert.strictEqual(typeof wire,'string');assert.strictEqual(JSON.parse(wire).state,'FULL_SNAPSHOT');
assert.throws(()=>context.prhPlanningLocalFirstBootstrap({unexpected:true}),/PLANNING_SYNC_REQUEST_FIELD_UNKNOWN/);
console.log('planning_local_first_service_adapter_test: PASS',{budgetExplicitTotal:true,recurrenceLossless:true,commitmentNoInference:true,liquidityExplicitObservation:true,noWrites:true});
