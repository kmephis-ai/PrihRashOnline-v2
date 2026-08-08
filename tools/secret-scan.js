'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MAX_BYTES = 2_000_000;
const BLOCKED_PATHS = [
  /^\.env(?:\.|$)/i,
  /^\.clasprc\.json$/i,
  /^\.clasp\.json$/i,
  /(?:^|\/)credentials?(?:\.|\/)/i,
  /(?:^|\/)service[-_]?account(?:\.|\/)/i
];

function secretRules() {
  return [
    { id:'private-key', regex:new RegExp('-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----') },
    { id:'github-token', regex:new RegExp('(?:gh' + 'p_[A-Za-z0-9]{30,}|github_' + 'pat_[A-Za-z0-9_]{30,})') },
    { id:'google-api-key', regex:new RegExp('AI' + 'za[0-9A-Za-z_-]{30,}') },
    { id:'aws-access-key', regex:new RegExp('AKIA[0-9A-Z]{16}') },
    { id:'oauth-client-secret', regex:new RegExp('"client' + '_secret"\\s*:\\s*"[^"\\n]{12,}"', 'i') },
    { id:'service-account-private-key', regex:new RegExp('"private' + '_key"\\s*:\\s*"[^"\\n]{20,}"', 'i') }
  ];
}

function normalized(file) {
  return String(file).split(path.sep).join('/');
}

function trackedFiles(root = ROOT) {
  const output = execFileSync('git', ['ls-files', '-z'], { cwd:root, encoding:'utf8' });
  return output.split('\0').filter(Boolean);
}

function isBlockedPath(file) {
  const clean = normalized(file);
  if (/\.example$/i.test(clean) || /(?:^|\/)examples?\//i.test(clean)) return false;
  return BLOCKED_PATHS.some((rule) => rule.test(clean));
}

function scanContent(file, content) {
  const clean = normalized(file);
  return secretRules()
    .filter((rule) => rule.regex.test(content))
    .map((rule) => ({ file:clean, rule:rule.id }));
}

function scanTree(root = ROOT, files = trackedFiles(root)) {
  const findings=[];
  files.forEach((file) => {
    const clean=normalized(file);
    if (isBlockedPath(clean)) findings.push({ file:clean, rule:'blocked-sensitive-path' });
    const full=path.join(root,file);
    if (!fs.existsSync(full)) return;
    const stat=fs.statSync(full);
    if (!stat.isFile() || stat.size > MAX_BYTES) return;
    const buffer=fs.readFileSync(full);
    if (buffer.includes(0)) return;
    findings.push(...scanContent(clean,buffer.toString('utf8')));
  });
  return findings;
}

function main() {
  const files=trackedFiles(ROOT);
  const findings=scanTree(ROOT,files);
  if (findings.length) {
    console.error(`secret-scan: FAIL (${findings.length} finding(s))`);
    findings.forEach((finding) => {
      console.error(`secret finding: ${finding.file} -> ${finding.rule}`);
      console.error(`::error file=${finding.file}::secret rule ${finding.rule}`);
    });
    process.exitCode=1;
    return;
  }
  console.log('secret-scan: PASS', { trackedFiles:files.length, policy:'high-confidence-current-tree' });
}

if (require.main===module) main();
module.exports={ isBlockedPath, scanContent, scanTree, secretRules };
