'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TEXT_EXTENSIONS = new Set(['.js','.cjs','.mjs','.json','.html','.md','.yml','.yaml','.txt','.css','.xml','.toml']);
const BLOCKED_EXPORT_EXTENSIONS = new Set(['.xlsx','.xls','.ods','.gsheet']);
const CONDITIONAL_EXPORT_EXTENSIONS = new Set(['.csv','.tsv']);
const FORBIDDEN_CONTENT = [
  { id:'real-dev-provenance', regex:/\breal\s+DEV\s+(?:data|analytics)\b/i },
  { id:'real-derived-fixture-provenance', regex:/\b(?:fixture|test data)\b[^\n]{0,80}\bderived\s+from\s+(?:DEV|production)\b/i },
  { id:'operation-source-id', regex:new RegExp('\\bOP-' + 'F11-', 'i') },
  { id:'embedded-sheet-export', regex:/"(?:spreadsheet|sheet)_export"\s*:/i }
];

function normalized(file) {
  return String(file).split(path.sep).join('/');
}

function trackedFiles(root = ROOT) {
  try {
    const output = execFileSync('git', ['ls-files','-z'], { cwd:root, encoding:'utf8' });
    return output.split('\0').filter(Boolean);
  } catch (error) {
    return walk(root).map((file) => path.relative(root,file));
  }
}

function walk(dir) {
  const output=[];
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (['.git','node_modules','artifacts'].includes(entry.name)) continue;
    const target=path.join(dir,entry.name);
    if (entry.isDirectory()) output.push(...walk(target));
    else output.push(target);
  }
  return output;
}

function classifyPath(file) {
  const clean=normalized(file);
  const ext=path.extname(clean).toLowerCase();
  if (clean.startsWith('artifacts/')) return { blocked:true, id:'tracked-ci-artifact' };
  if (BLOCKED_EXPORT_EXTENSIONS.has(ext)) return { blocked:true, id:'tracked-spreadsheet-export' };
  if (CONDITIONAL_EXPORT_EXTENSIONS.has(ext) && !clean.includes('/synthetic/') && !clean.startsWith('tests/fixtures/synthetic')) {
    return { blocked:true, id:'non-synthetic-tabular-export' };
  }
  return { blocked:false, id:null };
}

function scanContent(file, content) {
  const findings=[];
  FORBIDDEN_CONTENT.forEach((rule) => {
    if (rule.regex.test(content)) findings.push({ file:normalized(file), rule:rule.id });
  });
  const fixtureBearing = /(?:yearlyIncome|monthlyIncome|monthStructure|selectedYearIncome|selectedMonthIncome)/.test(content);
  const publicFixturePath = normalized(file)==='DashboardWebApp.html' || normalized(file).startsWith('tests/') || normalized(file).startsWith('tools/prepare-dashboard-web');
  if (fixtureBearing && publicFixturePath && !/(?:PUBLIC_SYNTHETIC|synthetic[-_ ](?:fixture|generator|preview|data))/i.test(content)) {
    findings.push({ file:normalized(file), rule:'financial-fixture-without-synthetic-provenance' });
  }
  return findings;
}

function scanTree(root = ROOT, files = trackedFiles(root)) {
  const findings=[];
  files.forEach((file) => {
    const clean=normalized(file);
    const pathFinding=classifyPath(clean);
    if (pathFinding.blocked) findings.push({ file:clean, rule:pathFinding.id });
    const ext=path.extname(clean).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) return;
    const full=path.join(root,file);
    if (!fs.existsSync(full) || fs.statSync(full).size > 2_000_000) return;
    findings.push(...scanContent(clean,fs.readFileSync(full,'utf8')));
  });
  return findings;
}

function main() {
  const files=trackedFiles(ROOT);
  const findings=scanTree(ROOT,files);
  if (findings.length) {
    console.error(`privacy-public-data: FAIL (${findings.length} finding(s))`);
    findings.forEach((finding) => {
      console.error(`privacy finding: ${finding.file} -> ${finding.rule}`);
      console.error(`::error file=${finding.file}::privacy rule ${finding.rule}`);
    });
    process.exitCode=1;
    return;
  }
  console.log('privacy-public-data: PASS', { trackedFiles:files.length, policy:'synthetic-only-public-tree' });
}

if (require.main===module) main();
module.exports={ classifyPath, scanContent, scanTree, trackedFiles };
