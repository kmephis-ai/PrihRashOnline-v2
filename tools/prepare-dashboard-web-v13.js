'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

function validateDashboardV13(filePath = DASHBOARD_PATH) {
  const html = fs.readFileSync(filePath, 'utf8');
  const required = [
    'Executive-панель',
    'id="executive-secondary"',
    'function renderExecutiveSecondary(data)',
    'function openDrilldown(key)',
    'function drilldownTable(rows)',
    '.prhGetWebDashboardDataV13(year, month, activeView)'
  ];
  required.forEach((marker) => {
    if (!html.includes(marker)) throw new Error(`Dashboard v1.3 contract missing: ${marker}`);
  });
  return { changed: false, filePath, mode: 'validate-only', stage: 'v1.3' };
}

if (require.main === module) console.log('prepare-dashboard-web-v13:', validateDashboardV13());
module.exports = validateDashboardV13;
