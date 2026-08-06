'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

const REPLACEMENTS = [
  {
    name: 'executive and drilldown styles',
    before: `    .kpi-value { margin-top: 4px; font-size: 17px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }\n`,
    after: `    .kpi-value { margin-top: 4px; font-size: 17px; font-weight: 800; line-height: 1.2; overflow-wrap: anywhere; }\n    button.kpi-card { text-align: left; color: inherit; cursor: pointer; }\n    button.kpi-card:hover { border-color: #9fc5ed; transform: translateY(-1px); box-shadow: 0 8px 20px rgba(24,45,78,.08); }\n    button.kpi-card:focus-visible { outline: 3px solid rgba(25,103,210,.3); outline-offset: 2px; }\n    .executive-secondary {\n      display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; margin-top: 12px;\n    }\n    .secondary-card {\n      min-width: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 11px;\n      background: #f8fafc; color: inherit; text-align: left; cursor: pointer;\n    }\n    .secondary-card:hover { border-color: #a9c9eb; background: #f3f8ff; }\n    .secondary-label { color: var(--muted); font-size: 11px; }\n    .secondary-value { margin-top: 3px; font-size: 15px; font-weight: 800; overflow-wrap: anywhere; }\n    .drill-summary { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }\n    .drill-pill { padding:7px 10px; border-radius:999px; background:#eef5ff; color:#28527f; font-size:12px; font-weight:700; }\n    .drill-actions { display:flex; gap:9px; flex-wrap:wrap; margin:12px 0; }\n    .secondary-button {\n      display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border:1px solid #bfd3eb;\n      border-radius:10px; background:#fff; color:#145da0; text-decoration:none; font-weight:700; cursor:pointer;\n    }\n    .flag-list { color:#8a4a00; font-size:11px; }\n`
  },
  {
    name: 'responsive executive secondary',
    before: `      .kpi-layout { grid-template-columns: repeat(2,minmax(0,1fr)); }\n      .structure-layout { grid-template-columns: minmax(200px,.8fr) minmax(230px,1.2fr); }\n`,
    after: `      .kpi-layout { grid-template-columns: repeat(2,minmax(0,1fr)); }\n      .executive-secondary { grid-template-columns: repeat(2,minmax(0,1fr)); }\n      .structure-layout { grid-template-columns: minmax(200px,.8fr) minmax(230px,1.2fr); }\n`
  },
  {
    name: 'mobile executive secondary',
    before: `      .kpi-layout { grid-template-columns: 1fr; }\n      .overview-kpis, .chart-panel { min-height: auto; }\n`,
    after: `      .kpi-layout, .executive-secondary { grid-template-columns: 1fr; }\n      .overview-kpis, .chart-panel { min-height: auto; }\n`
  },
  {
    name: 'executive secondary markup',
    before: `          <div class="kpi-layout" id="kpi-layout"></div>\n          <div class="insight" id="insight">\n`,
    after: `          <div class="kpi-layout" id="kpi-layout"></div>\n          <div class="executive-secondary" id="executive-secondary" aria-label="Показатели второго уровня"></div>\n          <div class="insight" id="insight">\n`
  },
  {
    name: 'fixture executive and drilldown data',
    before: `        insight: {\n          title: 'Главный вывод',\n          text: 'В 2026 году доход выбранного года снизился на 14%. Доля года в общей истории: 17,6%.',\n          tone: 'warning'\n        },\n        navigation: {\n`,
    after: `        insight: {\n          title: 'Главный вывод',\n          text: 'В 2026 году доход выбранного года снизился на 14%. Доля года в общей истории: 17,6%.',\n          tone: 'warning'\n        },\n        executive: {\n          selectedYearIncome:3322811, selectedMonthIncome:151360, monthChange:-.689, yearChange:-.141,\n          baseIncome:2843452, specialIncome:479359, forecast:5353848, stabilityIndex:37, qualityScore:86,\n          activeMonths:7, averageOperation:16818, largestSource:{label:'Другое',value:1450000},\n          otherShare:.436, largeOperationCount:5, possibleDuplicateCount:1, yearOperationCount:128, monthOperationCount:9,\n          reasons:{\n            month:'Наибольший вклад по категориям: «Зарплата» — ниже относительно июня.',\n            year:'Сравнение года выполняется по сопоставимому периоду.',\n            special:'Специальные доходы составляют 14,4% дохода выбранного года.'\n          }\n        },\n        drilldowns: {\n          year:{title:'Доход выбранного года',count:128,total:3322811,rows:[],openFirstUrl:'#'},\n          month:{title:'Доход выбранного месяца',count:9,total:151360,rows:[\n            {row:1001,id:'OP-F11-017430',date:'09.07.2026',amount:7002,category:'ЕДВ',description:'—',status:'Перенесено',flags:[],openUrl:'#'},\n            {row:1002,id:'OP-F11-017435',date:'10.07.2026',amount:65432,category:'Зарплата',description:'—',status:'Перенесено',flags:[],openUrl:'#'},\n            {row:1003,id:'OP-F11-017436',date:'10.07.2026',amount:1280,category:'Зарплата',description:'—',status:'Перенесено',flags:[],openUrl:'#'},\n            {row:1004,id:'OP-F11-017463',date:'13.07.2026',amount:3000,category:'Другое',description:'Артур',status:'Перенесено',flags:['Другое'],openUrl:'#'},\n            {row:1005,id:'OP-F11-017464',date:'13.07.2026',amount:796,category:'Другое',description:'Кэшбек ТН',status:'Перенесено',flags:['Другое'],openUrl:'#'},\n            {row:1006,id:'OP-F11-017490',date:'14.07.2026',amount:19979,category:'Другое',description:'Ремонт класса',status:'Перенесено',flags:['Другое'],openUrl:'#'},\n            {row:1007,id:'OP-F11-017547',date:'25.07.2026',amount:35000,category:'Другое',description:'—',status:'Перенесено',flags:['без описания','Другое'],openUrl:'#'},\n            {row:1008,id:'OP-F11-017562',date:'27.07.2026',amount:16320,category:'Аванс',description:'—',status:'Перенесено',flags:[],openUrl:'#'},\n            {row:1009,id:'OP-F11-017576',date:'28.07.2026',amount:2551,category:'ЕДВ',description:'—',status:'Перенесено',flags:[],openUrl:'#'}\n          ],openFirstUrl:'#'},\n          previousMonth:{title:'Предыдущий месяц',count:17,total:487305,rows:[],openFirstUrl:'#'},\n          previousYear:{title:'Сопоставимый период прошлого года',count:0,total:0,rows:[],openFirstUrl:'#'},\n          base:{title:'Базовые доходы',count:0,total:2843452,rows:[],openFirstUrl:'#'},\n          special:{title:'Специальные доходы',count:0,total:479359,rows:[],openFirstUrl:'#'},\n          largestSource:{title:'Крупнейший источник',count:0,total:0,rows:[],openFirstUrl:'#'},\n          other:{title:'Категория «Другое»',count:0,total:0,rows:[],openFirstUrl:'#'},\n          large:{title:'Крупные операции',count:5,total:0,rows:[],openFirstUrl:'#'},\n          duplicates:{title:'Возможные точные дубли',count:2,total:0,groupCount:1,rows:[],openFirstUrl:'#'},\n          quality:{title:'Операции, требующие контроля качества',count:0,total:0,rows:[],openFirstUrl:'#'}\n        },\n        navigation: {\n`
  },
  {
    name: 'runtime v13 initial refresh',
    before: `        bindEvents();\n        render(state);\n      });\n`,
    after: `        bindEvents();\n        render(state);\n        if (isAppsScriptRuntime()) requestData(state.period.year, state.period.monthIndex, false);\n      });\n`
  },
  {
    name: 'cache executive secondary',
    before: `          'view-title','view-description','kpi-panel','kpi-title','kpi-note','kpi-layout',\n`,
    after: `          'view-title','view-description','kpi-panel','kpi-title','kpi-note','kpi-layout','executive-secondary',\n`
  },
  {
    name: 'bind drilldown click delegation',
    before: `        elements['month-select'].addEventListener('change', refreshFromFilters);\n        elements['open-sheet'].addEventListener('click', function () {\n`,
    after: `        elements['month-select'].addEventListener('change', refreshFromFilters);\n        [elements['kpi-layout'], elements['executive-secondary']].forEach(function (host) {\n          host.addEventListener('click', function (event) {\n            const target = event.target.closest('[data-drilldown]');\n            if (target) openDrilldown(target.dataset.drilldown);\n          });\n        });\n        elements['detail-content'].addEventListener('click', function (event) {\n          const close = event.target.closest('[data-close-drilldown]');\n          if (!close) return;\n          if (activeView === 'overview') elements['view-detail'].hidden = true;\n          else renderDetail(state, activeView);\n        });\n        elements['open-sheet'].addEventListener('click', function () {\n`
  },
  {
    name: 'use v13 server data',
    before: `          .prhGetWebDashboardData(year, month, activeView);\n`,
    after: `          .prhGetWebDashboardDataV13(year, month, activeView);\n`
  },
  {
    name: 'render executive secondary',
    before: `        renderKpis(data);\n        renderInsight(viewInsight(data, activeView));\n`,
    after: `        elements['kpi-title'].textContent = 'Executive-панель';\n        elements['kpi-note'].textContent = 'Нажмите показатель → связанные операции';\n        renderKpis(data);\n        renderExecutiveSecondary(data);\n        renderInsight(viewInsight(data, activeView));\n`
  },
  {
    name: 'replace primary executive KPI renderer',
    before: `      function renderKpis(data) {\n        const k = data.kpis;\n        const cards = [\n          ['₽','Средний доход за год',money(k.averageYearIncome)],\n          ['★','Максимальный год в истории',k.maximumYear ? k.maximumYear.year + ' • ' + money(k.maximumYear.value) : '—'],\n          ['◉','Доход за год (' + data.period.year + ')',money(data.summary.selectedYearIncome)],\n          ['▦','Активных месяцев',String(k.activeMonths)],\n          ['↗','Средний активный месяц',money(k.averageActiveMonth)],\n          ['◆','Пиковый месяц',k.peakMonth ? k.peakMonth.month + ' • ' + money(k.peakMonth.value) : '—'],\n          ['↘','Минимальный активный',k.minimumActiveMonth ? k.minimumActiveMonth.month + ' • ' + money(k.minimumActiveMonth.value) : '—'],\n          ['%','Доля спецдоходов (' + data.period.year + ')',percent(k.specialShare)]\n        ];\n        elements['kpi-layout'].innerHTML = cards.map(function (card) {\n          return '<article class="kpi-card" data-testid="kpi-card"><div class="kpi-icon">' +\n            escapeHtml(card[0]) + '</div><div><div class="kpi-label">' + escapeHtml(card[1]) +\n            '</div><div class="kpi-value">' + escapeHtml(card[2]) + '</div></div></article>';\n        }).join('');\n      }\n`,
    after: `      function renderKpis(data) {\n        const e = executiveData(data);\n        const cards = [\n          ['₽','Доход выбранного года',money(e.selectedYearIncome),'year'],\n          ['◉','Доход выбранного месяца',money(e.selectedMonthIncome),'month'],\n          ['↔','Изменение месяц к месяцу',changeText(e.monthChange),'month'],\n          ['↕','Изменение год к году',changeText(e.yearChange),'year'],\n          ['B','Базовый доход',money(e.baseIncome),'base'],\n          ['S','Специальные доходы',money(e.specialIncome),'special'],\n          ['◎','Прогноз года',money(e.forecast),'base'],\n          ['≈','Индекс стабильности',formatInt(e.stabilityIndex) + '/100','base'],\n          ['✓','Качество данных',formatInt(e.qualityScore) + '/100','quality']\n        ];\n        elements['kpi-layout'].innerHTML = cards.map(function (card) {\n          return '<button type="button" class="kpi-card" data-testid="kpi-card" data-drilldown="' +\n            escapeHtml(card[3]) + '"><div class="kpi-icon">' + escapeHtml(card[0]) +\n            '</div><div><div class="kpi-label">' + escapeHtml(card[1]) +\n            '</div><div class="kpi-value">' + escapeHtml(card[2]) + '</div></div></button>';\n        }).join('');\n      }\n\n      function renderExecutiveSecondary(data) {\n        const e = executiveData(data);\n        const source = e.largestSource ? e.largestSource.label + ' • ' + money(e.largestSource.value) : '—';\n        const cards = [\n          ['Активных месяцев',formatInt(e.activeMonths),'year'],\n          ['Средняя операция месяца',money(e.averageOperation),'month'],\n          ['Крупнейший источник',source,'largestSource'],\n          ['Доля «Другое»',percent(e.otherShare),'other'],\n          ['Крупных операций',formatInt(e.largeOperationCount),'large'],\n          ['Возможных дублей',formatInt(e.possibleDuplicateCount),'duplicates']\n        ];\n        elements['executive-secondary'].innerHTML = cards.map(function (card) {\n          return '<button type="button" class="secondary-card" data-testid="secondary-kpi" data-drilldown="' +\n            escapeHtml(card[2]) + '"><div class="secondary-label">' + escapeHtml(card[0]) +\n            '</div><div class="secondary-value">' + escapeHtml(card[1]) + '</div></button>';\n        }).join('');\n      }\n\n      function executiveData(data) {\n        if (data.executive) return data.executive;\n        const forecast = forecastYear(data);\n        return {\n          selectedYearIncome:data.summary.selectedYearIncome, selectedMonthIncome:data.summary.selectedMonthIncome,\n          monthChange:null, yearChange:data.kpis.yearChange, baseIncome:data.summary.selectedYearIncome, specialIncome:0,\n          forecast:forecast.value, stabilityIndex:0, qualityScore:data.summary.qualityScore, activeMonths:data.kpis.activeMonths,\n          averageOperation:data.summary.averageOperation, largestSource:null, otherShare:0, largeOperationCount:0, possibleDuplicateCount:0,\n          reasons:{month:'',year:'',special:''}\n        };\n      }\n\n      function changeText(value) {\n        if (value == null || !Number.isFinite(Number(value))) return '—';\n        const n = Number(value);\n        return (n > 0 ? '+' : '') + percent(n);\n      }\n`
  },
  {
    name: 'executive overview insight',
    before: `        return data.insight;\n      }\n\n      function renderInsight(insight) {\n`,
    after: `        if (view === 'overview' && data.executive && data.executive.reasons) {\n          return {\n            title:'Почему меняются доходы',\n            text:[data.executive.reasons.month,data.executive.reasons.year,data.executive.reasons.special].filter(Boolean).join(' '),\n            tone:data.executive.monthChange != null && data.executive.monthChange < 0 ? 'warning' : 'info'\n          };\n        }\n        return data.insight;\n      }\n\n      function renderInsight(insight) {\n`
  },
  {
    name: 'add drilldown renderer',
    before: `      function renderCharts(data) {\n`,
    after: `      function openDrilldown(key) {\n        const group = state.drilldowns && state.drilldowns[key];\n        if (!group) { showToast('Связанные операции будут доступны после обновления Web Dashboard 1.3.'); return; }\n        elements['view-detail'].hidden = false;\n        elements['detail-title'].textContent = 'Связанные операции — ' + group.title;\n        elements['detail-note'].textContent = 'Read-only drill-down • показано ' + formatInt(group.rows.length) + ' из ' + formatInt(group.count);\n        const openLink = group.openFirstUrl && group.openFirstUrl !== '#'\n          ? '<a class="secondary-button" href="' + escapeHtml(group.openFirstUrl) + '" target="_blank" rel="noopener">Открыть первую строку в 01 Операции</a>'\n          : '';\n        elements['detail-content'].innerHTML =\n          '<div class="drill-summary"><span class="drill-pill">Операций: ' + formatInt(group.count) +\n          '</span><span class="drill-pill">Сумма: ' + money(group.total) + '</span></div>' +\n          '<div class="drill-actions">' + openLink + '<button type="button" class="secondary-button" data-close-drilldown>Закрыть drill-down</button></div>' +\n          drilldownTable(group.rows);\n        elements['view-detail'].scrollIntoView({behavior:'smooth',block:'start'});\n      }\n\n      function drilldownTable(rows) {\n        if (!rows.length) return emptyState('Нет операций для выбранного показателя','Измените период или показатель.');\n        return '<div class="table-wrap"><table class="data-table"><thead><tr><th>Дата</th><th>Категория</th><th>Описание</th><th>Контроль</th><th>Сумма</th><th></th></tr></thead><tbody>' +\n          rows.map(function (row) {\n            const link = row.openUrl && row.openUrl !== '#'\n              ? '<a class="secondary-button" href="' + escapeHtml(row.openUrl) + '" target="_blank" rel="noopener">Строка ' + formatInt(row.row) + '</a>'\n              : 'стр. ' + formatInt(row.row);\n            return '<tr><td>' + escapeHtml(row.date) + '</td><td>' + escapeHtml(row.category) + '</td><td>' +\n              escapeHtml(row.description) + '</td><td class="flag-list">' + escapeHtml((row.flags || []).join(', ') || '—') +\n              '</td><td>' + escapeHtml(money(row.amount)) + '</td><td>' + link + '</td></tr>';\n          }).join('') + '</tbody></table></div>';\n      }\n\n      function renderCharts(data) {\n`
  },
  {
    name: 'executive forecast detail',
    before: `        if (view === 'forecast') {\n          elements['detail-content'].innerHTML = detailStats([\n            ['Факт',money(data.summary.selectedYearIncome)],\n            ['Оценка года',money(forecast.value)],\n            ['Активных месяцев',data.kpis.activeMonths],\n            ['Средний активный',money(data.kpis.averageActiveMonth)]\n          ]) + '<div class="chart-empty"><div><strong>Ориентировочная экстраполяция</strong><span>Прогноз = средний доход активного месяца × 12. Он не заменяет финансовое планирование.</span></div></div>';\n          return;\n        }\n`,
    after: `        if (view === 'forecast') {\n          const e = executiveData(data);\n          elements['detail-content'].innerHTML = detailStats([\n            ['Факт',money(e.selectedYearIncome)],\n            ['Оценка года',money(e.forecast)],\n            ['Базовый доход',money(e.baseIncome)],\n            ['Специальные доходы',money(e.specialIncome)]\n          ]) + '<div class="chart-empty"><div><strong>Ориентировочная экстраполяция</strong><span>Web Dashboard 1.3 экстраполирует средний базовый доход активных месяцев и добавляет уже полученные специальные доходы без их повторного размножения.</span></div></div>';\n          return;\n        }\n`
  }
];

function applyV13(filePath = DASHBOARD_PATH) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  REPLACEMENTS.forEach(({ name, before, after }) => {
    if (html.includes(after)) return;
    if (!html.includes(before)) throw new Error(`Dashboard v1.3 patch anchor not found: ${name}`);
    html = html.replace(before, after);
    changed = true;
  });
  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return { changed, filePath, replacements: REPLACEMENTS.length };
}

if (require.main === module) console.log('prepare-dashboard-web-v13:', applyV13());
module.exports = applyV13;
