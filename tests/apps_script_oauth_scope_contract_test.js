'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'appsscript.json'), 'utf8'));

const EXPECTED_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.scriptapp',
  'https://www.googleapis.com/auth/spreadsheets.currentonly',
  'https://www.googleapis.com/auth/userinfo.email'
].sort();

assert(Array.isArray(manifest.oauthScopes), 'appsscript.json must declare explicit oauthScopes');
assert.deepStrictEqual([...manifest.oauthScopes].sort(), EXPECTED_SCOPES, 'runtime OAuth scope set must stay explicit and least-privilege');
assert.strictEqual(new Set(manifest.oauthScopes).size, manifest.oauthScopes.length, 'oauthScopes must not contain duplicates');
assert.strictEqual(manifest.webapp && manifest.webapp.access, 'MYSELF', 'private Web App boundary must remain MYSELF');
assert.strictEqual(manifest.executionApi && manifest.executionApi.access, 'MYSELF', 'Execution API boundary must remain MYSELF');
assert(!manifest.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'), 'broad all-spreadsheets scope is not allowed while code stays current-document-only');

const sources = fs.readdirSync(ROOT)
  .filter((name) => name.endsWith('.js'))
  .sort()
  .map((name) => ({ name, source: fs.readFileSync(path.join(ROOT, name), 'utf8') }));
const joined = sources.map((entry) => entry.source).join('\n');

function requireUsage(pattern, scope, explanation) {
  assert(pattern.test(joined), `${explanation}: expected service usage not found`);
  assert(manifest.oauthScopes.includes(scope), `${explanation}: required scope missing: ${scope}`);
}

requireUsage(/\bSpreadsheetApp\b/, 'https://www.googleapis.com/auth/spreadsheets.currentonly', 'current spreadsheet access');
requireUsage(/\bDriveApp\b/, 'https://www.googleapis.com/auth/drive', 'PDF export file creation');
requireUsage(/\bUrlFetchApp\b/, 'https://www.googleapis.com/auth/script.external_request', 'external HTTP export request');
requireUsage(/ScriptApp\.(?:newTrigger|getProjectTriggers|getUserTriggers|deleteTrigger)\b/, 'https://www.googleapis.com/auth/script.scriptapp', 'installable trigger management');
requireUsage(/(?:SpreadsheetApp\.getUi\(|\.showSidebar\(|\.showModalDialog\(|\.showModelessDialog\()/, 'https://www.googleapis.com/auth/script.container.ui', 'container UI');
requireUsage(/Session\.(?:getActiveUser|getEffectiveUser)\(\)/, 'https://www.googleapis.com/auth/userinfo.email', 'user email identity');

assert(!/SpreadsheetApp\.(?:openById|openByUrl)\s*\(/.test(joined), 'currentonly scope is invalid if arbitrary spreadsheets are opened by id/url');
assert(!/\b(?:GmailApp|MailApp|CalendarApp|FormApp|DocumentApp|SlidesApp)\b/.test(joined), 'new OAuth-sensitive Apps Script service introduced without scope review');

console.log('apps_script_oauth_scope_contract_test: OK', {
  explicitScopes: EXPECTED_SCOPES.length,
  spreadsheetsScope: 'currentonly',
  webappAccess: manifest.webapp.access,
  executionApiAccess: manifest.executionApi.access,
  scopeDriftFailClosed: true
});
