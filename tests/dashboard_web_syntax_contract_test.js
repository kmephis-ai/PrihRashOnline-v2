'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'DashboardWebApp.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)).map((match) => match[1]);

if (!scripts.length) throw new Error('No inline JavaScript found in DashboardWebApp.html');

scripts.forEach((script, index) => {
  const source = script.trim();
  if (!source) return;
  if (source.includes('<?')) return; // Apps Script template payload is not browser JavaScript.
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`Dashboard inline script #${index + 1} has invalid JavaScript syntax: ${error.message}`);
  }
});

if (html.includes('cssEscape(')) {
  throw new Error('Deprecated cssEscape runtime helper/reference remains after canonical preparation');
}

console.log('dashboard_web_syntax_contract_test: OK', { scripts: scripts.length, htmlLength: html.length });
