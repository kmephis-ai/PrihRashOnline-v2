'use strict';

const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '..', 'DashboardWebApp.html');

function normalizeRuntime(filePath = DASHBOARD_PATH) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  const unsafeLookup = `        const host = elements['detail-content'].querySelector('[data-suggestion-for="' + cssEscape(proposalId) + '"]');`;
  const safeLookup = `        const host = Array.from(elements['detail-content'].querySelectorAll('[data-suggestion-for]'))\n          .find(function (node) { return node.dataset.suggestionFor === String(proposalId); });`;

  if (html.includes(unsafeLookup)) {
    html = html.replace(unsafeLookup, safeLookup);
    changed = true;
  } else if (!html.includes(safeLookup)) {
    throw new Error('Runtime normalization anchor not found: quality suggestion lookup');
  }

  const cssStart = `      function cssEscape(value) {\n`;
  const nextFunction = `      function parseInitialData() {\n`;
  const start = html.indexOf(cssStart);
  if (start >= 0) {
    const end = html.indexOf(nextFunction, start);
    if (end < 0) throw new Error('Runtime normalization anchor not found: parseInitialData');
    html = html.slice(0, start) + html.slice(end);
    changed = true;
  }

  if (html.includes('cssEscape(')) {
    throw new Error('Runtime normalization failed: cssEscape reference remains');
  }

  // Apps Script HtmlTemplate scans the raw HTML for "<?" scriptlet openers.
  // A client-side JS string containing the same two characters is therefore unsafe:
  // text.indexOf('<?') can be parsed as a second server-side scriptlet during evaluate().
  const unsafeTemplateProbe = "text.indexOf('<?')";
  const safeTemplateProbe = "text.indexOf('<' + '?')";
  if (html.includes(unsafeTemplateProbe)) {
    html = html.split(unsafeTemplateProbe).join(safeTemplateProbe);
    changed = true;
  }

  const scriptletOpeners = html.match(/<\?/g) || [];
  if (scriptletOpeners.length !== 1 || !html.includes('<?!= initialData ?>')) {
    throw new Error(`Runtime normalization failed: expected exactly one Apps Script template opener, found ${scriptletOpeners.length}`);
  }

  if (changed) fs.writeFileSync(filePath, html, 'utf8');
  return { changed, filePath, normalized: ['quality-selector', 'cssEscape-removal', 'template-scriptlet-sentinel'] };
}

if (require.main === module) console.log('normalize-dashboard-web-runtime:', normalizeRuntime());
module.exports = normalizeRuntime;
