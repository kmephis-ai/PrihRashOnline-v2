'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

const REPLACEMENTS = [
  {
    name: 'hide mobile tab scrollbar',
    before: `      .tabs {
        display: flex; overflow-x: auto; scroll-snap-type: x proximity;
        border-radius: 12px; scrollbar-width: thin;
      }
`,
    after: `      .tabs {
        display: flex; overflow-x: auto; scroll-snap-type: x proximity;
        border-radius: 12px; scrollbar-width: none;
        -ms-overflow-style: none;
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
