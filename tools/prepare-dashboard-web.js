'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

function validateDashboardBase(filePath = DASHBOARD_PATH) {
  const html = fs.readFileSync(filePath, 'utf8');
  const required = [
    '<script id="initial-data" type="application/json"><?!= initialData ?></script>',
    "privacyClass:'PUBLIC_SYNTHETIC'",
    'id="yearly-chart"',
    'id="monthly-chart"',
    'id="donut"',
    'function parseInitialData()',
    'function render(data)'
  ];
  required.forEach((marker) => {
    if (!html.includes(marker)) throw new Error(`Dashboard base contract missing: ${marker}`);
  });
  return { changed: false, filePath, mode: 'validate-only', stage: 'base' };
}

if (require.main === module) console.log('prepare-dashboard-web:', validateDashboardBase());
module.exports = validateDashboardBase;
