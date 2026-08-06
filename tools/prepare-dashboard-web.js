'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

const REPLACEMENTS = [
  {
    name: 'hide and harden mobile tab scrollbar',
    before: `      .tabs {
        display: flex; overflow-x: auto; scroll-snap-type: x proximity;
        border-radius: 12px; scrollbar-width: thin;
      }
`,
    after: `      .tabs {
        display: flex; overflow-x: auto; scroll-snap-type: x proximity;
        border-radius: 12px; scrollbar-width: none;
        -ms-overflow-style: none;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
        scroll-padding-inline: 12px;
      }
      .tabs::-webkit-scrollbar { display: none; }
`
  },
  {
    name: 'preserve fixture month when URL parameters are absent',
    before: `      function readUrlState() {
        try {
          const params = new URL(window.location.href).searchParams;
          const year = Number(params.get('year'));
          const month = Number(params.get('month'));
          return {
            year: Number.isFinite(year) && year > 0 ? year : null,
            month: Number.isInteger(month) && month >= 0 && month <= 11 ? month : null,
            view: params.get('view') || null
          };
        } catch (error) {
          return { year:null, month:null, view:null };
        }
      }
`,
    after: `      function readUrlState() {
        try {
          const params = new URL(window.location.href).searchParams;
          const yearRaw = params.get('year');
          const monthRaw = params.get('month');
          const year = yearRaw === null || yearRaw === '' ? null : Number(yearRaw);
          const month = monthRaw === null || monthRaw === '' ? null : Number(monthRaw);
          return {
            year: Number.isFinite(year) && year > 0 ? year : null,
            month: Number.isInteger(month) && month >= 0 && month <= 11 ? month : null,
            view: params.get('view') || null
          };
        } catch (error) {
          return { year:null, month:null, view:null };
        }
      }
`
  },
  {
    name: 'reject null month in local period update',
    before: `      function updateLocalPeriod(year,month) {
        if (year && state.period.years.indexOf(Number(year)) >= 0) state.period.year = Number(year);
        if (Number.isInteger(Number(month)) && Number(month) >= 0 && Number(month) <= 11) {
          state.period.monthIndex = Number(month);
          state.period.month = state.period.months[Number(month)];
        }
        state.navigation.active = activeView;
      }
`,
    after: `      function updateLocalPeriod(year,month) {
        if (year && state.period.years.indexOf(Number(year)) >= 0) state.period.year = Number(year);
        if (month !== null && month !== '' && Number.isInteger(Number(month)) && Number(month) >= 0 && Number(month) <= 11) {
          state.period.monthIndex = Number(month);
          state.period.month = state.period.months[Number(month)];
        }
        state.navigation.active = activeView;
      }
`
  },
  {
    name: 'align fixture period with real DEV data',
    before: `          years: [2023,2024,2025,2026],
          months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
          latestDate: '31.07.2026'
`,
    after: `          years: [2018,2019,2020,2021,2022,2023,2024,2025,2026],
          months: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
          latestDate: '28.07.2026'
`
  },
  {
    name: 'align fixture yearly history with real DEV analytics',
    before: `        yearlyIncome: [
          {year:2023,value:1845221},{year:2024,value:2481349},{year:2025,value:3869563},{year:2026,value:3322811}
        ],
`,
    after: `        yearlyIncome: [
          {year:2018,value:228236},{year:2019,value:1019745},{year:2020,value:1416997},
          {year:2021,value:1901776},{year:2022,value:2334790},{year:2023,value:2129741},
          {year:2024,value:2598662},{year:2025,value:3869563},{year:2026,value:3322811}
        ],
`
  },
  {
    name: 'align fixture monthly history with real DEV analytics',
    before: `        monthlyIncome: [222068,511651,739836,346552,864039,487305,151360,231646,268112,208945,184221,98724]
`,
    after: `        monthlyIncome: [222068,511651,739836,346552,864039,487305,151360,0,0,0,0,0]
`
  },
  {
    name: 'align fixture July structure with real DEV analytics',
    before: `        monthStructure: [
          {label:'Зарплата',value:68578},{label:'Аванс',value:35516},{label:'Другое',value:34998},{label:'ЕДВ',value:2268}
        ],
`,
    after: `        monthStructure: [
          {label:'Зарплата',value:66712},{label:'Другое',value:58775},{label:'Аванс',value:16320},{label:'ЕДВ',value:9553}
        ],
`
  },
  {
    name: 'improve visual 1.2 typography',
    before: `    body { font-family: Arial, Roboto, sans-serif; font-size: 14px; }
`,
    after: `    body {
      font-family: Arial, Roboto, sans-serif; font-size: 14px; line-height: 1.45;
      -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
    }
`
  },
  {
    name: 'equalize filter and KPI card geometry',
    before: `    .filters {
      display: grid; grid-template-columns: 1.05fr 1.05fr 1.2fr .9fr 1.2fr;
      gap: var(--gap); margin-bottom: var(--gap);
    }
`,
    after: `    .filters {
      display: grid; grid-template-columns: 1.05fr 1.05fr 1.2fr .9fr 1.2fr;
      grid-auto-rows: 1fr; align-items: stretch;
      gap: var(--gap); margin-bottom: var(--gap);
    }
`
  },
  {
    name: 'equalize KPI rows',
    before: `    .kpi-layout { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
    .kpi-card {
      min-height: 92px; padding: 13px;
`,
    after: `    .kpi-layout {
      display: grid; grid-template-columns: repeat(3,minmax(0,1fr));
      grid-auto-rows: 1fr; gap: 12px; align-items: stretch;
    }
    .kpi-card {
      min-height: 96px; height: 100%; padding: 14px;
`
  },
  {
    name: 'add visual 1.2 loading skeleton',
    before: `    .loader-card { padding: 18px 24px; border-radius: 14px; background: #fff; box-shadow: var(--shadow); font-weight: 800; }
`,
    after: `    .loader-card {
      width: min(420px,calc(100vw - 36px)); padding: 20px 22px;
      border-radius: 16px; background: #fff; box-shadow: var(--shadow); font-weight: 800;
    }
    .loader-title { margin-bottom: 14px; color: #173357; }
    .skeleton-stack { display: grid; gap: 9px; }
    .skeleton-line {
      height: 11px; border-radius: 999px;
      background: linear-gradient(90deg,#edf1f6 25%,#f8fafc 45%,#edf1f6 65%);
      background-size: 220% 100%; animation: skeleton-shimmer 1.15s ease-in-out infinite;
    }
    .skeleton-line.short { width: 62%; }
    @keyframes skeleton-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
    @media (prefers-reduced-motion: reduce) { .skeleton-line { animation: none; } }
`
  },
  {
    name: 'render visual 1.2 loading skeleton',
    before: `  <div class="loading-layer" id="loading-layer" aria-hidden="true"><div class="loader-card">Обновляем дашборд…</div></div>
`,
    after: `  <div class="loading-layer" id="loading-layer" aria-hidden="true"><div class="loader-card"><div class="loader-title">Обновляем дашборд…</div><div class="skeleton-stack" aria-hidden="true"><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div></div></div>
`
  }
];

function applyDashboardWebPatches(filePath = DASHBOARD_PATH) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  REPLACEMENTS.forEach(({ name, before, after }) => {
    if (html.includes(after)) return;
    if (!html.includes(before)) {
      throw new Error(`Dashboard patch anchor not found: ${name}`);
    }
    html = html.replace(before, after);
    changed = true;
  });

  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return { changed, filePath, replacements: REPLACEMENTS.length };
}

if (require.main === module) {
  const result = applyDashboardWebPatches();
  console.log(`prepare-dashboard-web: ${result.changed ? 'UPDATED' : 'ALREADY_CURRENT'} (${result.replacements} guards)`);
}

module.exports = applyDashboardWebPatches;