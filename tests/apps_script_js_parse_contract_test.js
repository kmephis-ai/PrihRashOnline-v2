'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(root)
  .filter((name) => name.endsWith('.js'))
  .sort();

if (!files.length) throw new Error('No root Apps Script .js files found');

for (const name of files) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  try {
    new vm.Script(source, { filename: name });
  } catch (error) {
    throw new Error(`Apps Script JS parse failed for ${name}: ${error.message}`);
  }
}

console.log('apps_script_js_parse_contract_test: OK', { files: files.length });
