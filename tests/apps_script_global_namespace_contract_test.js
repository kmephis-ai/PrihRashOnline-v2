'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceFiles = fs.readdirSync(root)
  .filter((name) => name.endsWith('.js'))
  .sort();

const declarations = new Map();
const declarationPattern = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b|^function\s+([A-Za-z_$][\w$]*)\s*\(/gm;

for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  let match;
  while ((match = declarationPattern.exec(source)) !== null) {
    const name = match[1] || match[2];
    if (!declarations.has(name)) declarations.set(name, []);
    declarations.get(name).push({ file, index: match.index });
  }
}

const collisions = [...declarations.entries()]
  .filter(([, locations]) => locations.length > 1)
  .map(([name, locations]) => ({ name, files: locations.map((location) => location.file) }));

assert.deepStrictEqual(collisions, [], `Apps Script global namespace collisions: ${JSON.stringify(collisions)}`);

const onOpen = declarations.get('onOpen') || [];
assert.strictEqual(onOpen.length, 1, 'Apps Script project must have exactly one top-level onOpen simple trigger');
assert.strictEqual(onOpen[0].file, 'ApplicationMenuService.js', 'ApplicationMenuService.js must own the canonical onOpen entrypoint');

const foundation = fs.readFileSync(path.join(root, 'Code.js'), 'utf8');
const applicationMenu = fs.readFileSync(path.join(root, 'ApplicationMenuService.js'), 'utf8');
assert(foundation.includes('function prhBuildFoundationMenu_()'), 'legacy DEV foundation menu must remain available as a helper');
assert(!/^function\s+onOpen\s*\(/m.test(foundation), 'Code.js must not declare a second onOpen trigger');
assert(applicationMenu.includes("if (typeof prhBuildFoundationMenu_ === 'function') prhBuildFoundationMenu_();"), 'canonical onOpen must preserve the foundation menu');

console.log('apps_script_global_namespace_contract_test: OK', {
  sourceFiles: sourceFiles.length,
  collisions: 0,
  canonicalOnOpen: 'ApplicationMenuService.js',
  foundationMenuPreserved: true
});
