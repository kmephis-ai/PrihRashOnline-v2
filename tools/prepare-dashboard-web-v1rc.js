'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

function validateDashboardV1Rc(filePath = DASHBOARD_PATH) {
  const html = fs.readFileSync(filePath, 'utf8');
  const required = [
    'v1.0 RC',
    'id="action-bar"',
    'id="action-refresh"',
    'id="action-quality"',
    'id="action-snapshot"',
    'id="action-pdf"',
    'function runUnifiedRefresh()',
    'function loadQualityWorkbench()',
    'function renderQualityWorkbench(workbench)',
    'function suggestClassification(proposalId)',
    'function createSnapshot()',
    'function createPdfReport()'
  ];
  required.forEach((marker) => {
    if (!html.includes(marker)) throw new Error(`Dashboard v1 RC contract missing: ${marker}`);
  });
  return { changed: false, filePath, mode: 'validate-only', stage: 'v1-rc' };
}

if (require.main === module) console.log('prepare-dashboard-web-v1rc:', validateDashboardV1Rc());
module.exports = validateDashboardV1Rc;
