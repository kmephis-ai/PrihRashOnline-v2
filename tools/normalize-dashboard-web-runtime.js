'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

function validateRuntime(filePath = DASHBOARD_PATH) {
  const html = fs.readFileSync(filePath, 'utf8');
  const forbidden = ['cssEscape(', 'charts.google.com', 'cdn.jsdelivr.net'];
  forbidden.forEach((marker) => {
    if (html.includes(marker)) throw new Error(`Dashboard runtime contains forbidden dependency/compatibility marker: ${marker}`);
  });
  if (!html.includes("privacyClass:'PUBLIC_SYNTHETIC'")) {
    throw new Error('Dashboard runtime lacks PUBLIC_SYNTHETIC fallback marker');
  }
  return { changed: false, filePath, mode: 'validate-only', normalized: ['synthetic-fallback','no-public-cdn'] };
}

if (require.main === module) console.log('normalize-dashboard-web-runtime:', validateRuntime());
module.exports = validateRuntime;
