'use strict';

const fs = require('fs');
const path = require('path');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'chat-driven-dev-release.yml'),
  'utf8'
);

expect(workflow.includes('SyntaxError'), 'Runtime smoke must reject Apps Script SyntaxError pages');
expect(workflow.includes('Apps Script runtime error page'), 'Runtime smoke must explicitly fail closed on Apps Script runtime error content');
expect(workflow.includes('ПрихРасхOnline'), 'Runtime smoke must require an expected dashboard marker in the response body');
expect(workflow.includes('Dashboard marker not found'), 'Runtime smoke must fail when the expected dashboard marker is missing');

console.log('apps_script_runtime_smoke_contract_test: OK');
