'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FULL_SHA = /^[0-9a-f]{40}$/;

function trackedWorkflows(root = ROOT) {
  const output = execFileSync('git', ['ls-files', '.github/workflows/*.yml', '.github/workflows/*.yaml'], { cwd: root, encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function scanPackage(root = ROOT) {
  const findings = [];
  const pkgPath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  const nvmrcPath = path.join(root, '.nvmrc');
  if (!fs.existsSync(lockPath)) findings.push({ file: 'package-lock.json', rule: 'lockfile-missing' });
  if (!fs.existsSync(nvmrcPath) || fs.readFileSync(nvmrcPath, 'utf8').trim() !== '24') findings.push({ file: '.nvmrc', rule: 'node24-marker-missing' });

  const pkg = readJson(pkgPath);
  if (!pkg.engines || pkg.engines.node !== '>=24 <25') findings.push({ file: 'package.json', rule: 'node24-engine-contract' });
  const clasp = pkg.devDependencies && pkg.devDependencies['@google/clasp'];
  if (!clasp || !/^\d+\.\d+\.\d+$/.test(clasp)) findings.push({ file: 'package.json', rule: 'clasp-not-exact' });
  Object.entries(pkg.devDependencies || {}).forEach(([name, version]) => {
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version))) {
      findings.push({ file: 'package.json', rule: `root-dev-dependency-not-exact:${name}` });
    }
  });

  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    if (lock.lockfileVersion !== 3) findings.push({ file: 'package-lock.json', rule: 'lockfile-version-not-v3' });
    const rootPackage = lock.packages && lock.packages[''];
    const lockedClasp = rootPackage && rootPackage.devDependencies && rootPackage.devDependencies['@google/clasp'];
    if (lockedClasp !== clasp) findings.push({ file: 'package-lock.json', rule: 'clasp-lock-root-mismatch' });
    const claspPackage = lock.packages && lock.packages['node_modules/@google/clasp'];
    if (!claspPackage || claspPackage.version !== clasp) findings.push({ file: 'package-lock.json', rule: 'clasp-lock-resolution-mismatch' });
  }
  return findings;
}

function scanWorkflowContent(file, content) {
  const findings = [];
  content.split(/\r?\n/).forEach((line, index) => {
    const uses = line.match(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/);
    if (uses) {
      const target = uses[1];
      if (target.startsWith('./') || target.startsWith('docker://')) return;
      const at = target.lastIndexOf('@');
      if (at < 1 || !FULL_SHA.test(target.slice(at + 1))) {
        findings.push({ file, line: index + 1, rule: 'third-party-action-not-full-sha' });
      }
    }
  });
  if (/node-version:\s*['"]?20(?:['"]|\s|$)/.test(content)) findings.push({ file, rule: 'node20-workflow-runtime' });
  if (/\bnpm\s+install\b/.test(content)) findings.push({ file, rule: 'npm-install-forbidden-use-npm-ci' });
  if (/@google\/clasp@/.test(content)) findings.push({ file, rule: 'workflow-clasp-install-forbidden' });
  const claspCalls = content.match(/\bnpx\s+(?!clasp\s+--version)([^\n]*\bclasp\b[^\n]*)/g) || [];
  claspCalls.forEach((call) => {
    if (!/\bnpx\s+--no-install\s+clasp\b/.test(call)) findings.push({ file, rule: 'clasp-must-use-locked-local-cli' });
  });
  return findings;
}

function scanWorkflows(root = ROOT, files = trackedWorkflows(root)) {
  const findings = [];
  files.forEach((file) => {
    findings.push(...scanWorkflowContent(file, fs.readFileSync(path.join(root, file), 'utf8')));
  });
  return findings;
}

function scanSupplyChain(root = ROOT) {
  return [...scanPackage(root), ...scanWorkflows(root)];
}

function main() {
  const findings = scanSupplyChain(ROOT);
  if (findings.length) {
    console.error(`supply-chain: FAIL (${findings.length} finding(s))`);
    findings.forEach((finding) => {
      console.error(`supply-chain finding: ${finding.file}${finding.line ? `:${finding.line}` : ''} -> ${finding.rule}`);
      console.error(`::error file=${finding.file}${finding.line ? `,line=${finding.line}` : ''}::supply-chain rule ${finding.rule}`);
    });
    process.exitCode = 1;
    return;
  }
  console.log('supply-chain: PASS', { node: '24', lockfile: 3, workflowPolicy: 'immutable-actions+npm-ci+locked-clasp' });
}

if (require.main === module) main();
module.exports = { FULL_SHA, scanPackage, scanWorkflowContent, scanWorkflows, scanSupplyChain, trackedWorkflows };
