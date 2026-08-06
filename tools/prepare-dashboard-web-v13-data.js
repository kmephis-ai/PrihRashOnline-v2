'use strict';

const fs = require('fs');
const path = require('path');
const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

const REPLACEMENTS = [
  ['stability index', 'stabilityIndex:37', 'stabilityIndex:51'],
  ['largest source', "largestSource:{label:'Другое',value:1450000}", "largestSource:{label:'Другое',value:1293660}"],
  ['other share', 'otherShare:.436', 'otherShare:.389']
];

function applyExecutiveDataAlignment(filePath = DASHBOARD_PATH) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  REPLACEMENTS.forEach(([name, before, after]) => {
    if (html.includes(after)) return;
    if (!html.includes(before)) throw new Error(`Executive data patch anchor not found: ${name}`);
    html = html.replace(before, after);
    changed = true;
  });
  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return { changed, filePath, replacements: REPLACEMENTS.length };
}

if (require.main === module) console.log('prepare-dashboard-web-v13-data:', applyExecutiveDataAlignment());
module.exports = applyExecutiveDataAlignment;
