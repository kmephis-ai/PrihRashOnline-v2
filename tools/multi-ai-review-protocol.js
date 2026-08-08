'use strict';

const fs = require('fs');

const PACKET_SCHEMA = 'PRH_MULTI_AI_REVIEW_PACKET_V1';
const REPORT_SCHEMA = 'PRH_MULTI_AI_REVIEW_REPORT_V1';
const REQUIRED_ROLES = Object.freeze([
  'ARCHITECTURE',
  'SECURITY_PRIVACY',
  'FINANCIAL_DATA',
  'TEST_OPERATIONS'
]);
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const BLOCKING_SEVERITIES = new Set(['P0', 'P1']);
const ROADMAP_ID_RE = /^[A-Z][A-Z0-9-]*-[0-9]{3}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const REVIEWER_ID_RE = /^[A-Za-z0-9_.-]{2,64}$/;
const CODE_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

function fail(reason) {
  const error = new Error(reason);
  error.code = reason;
  throw error;
}

function boundedReason(error, fallback) {
  const raw = String(error && (error.code || error.message) || '');
  return /^[A-Z][A-Z0-9_]{2,79}$/.test(raw) ? raw : fallback;
}

function assertPublicSafe(value) {
  const forbidden = [
    /script\.google\.com\/macros\/s\//i,
    /\bAKfy[A-Za-z0-9_-]{20,}\b/,
    /\bya29\.[A-Za-z0-9._-]+\b/,
    /\b1\/\/[A-Za-z0-9_-]{20,}\b/,
    /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/,
    /[A-Z]:\\(?:YandexDisk|PrihRashOnline-Keys|PrihRashOnline(?:\\|$))/i
  ];
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (typeof current === 'string') {
      if (forbidden.some((pattern) => pattern.test(current))) fail('MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN');
      continue;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (current && typeof current === 'object') {
      for (const [key, nested] of Object.entries(current)) stack.push(key, nested);
    }
  }
  return true;
}

function assertKeys(value, allowed, required, reason) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(reason);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) fail(reason);
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) fail(reason);
}

function validatePacket(packet) {
  const allowed = ['schema', 'roadmap_id', 'issue', 'pr', 'candidate_sha', 'review_mode', 'writer_authority',
    'required_roles', 'changed_paths', 'public_evidence_refs'];
  assertKeys(packet, allowed, allowed, 'MULTI_AI_PACKET_SHAPE_INVALID');
  if (packet.schema !== PACKET_SCHEMA) fail('MULTI_AI_PACKET_SCHEMA_INVALID');
  if (!ROADMAP_ID_RE.test(String(packet.roadmap_id || ''))) fail('MULTI_AI_ROADMAP_ID_INVALID');
  if (!Number.isInteger(packet.issue) || packet.issue < 1) fail('MULTI_AI_ISSUE_INVALID');
  if (!Number.isInteger(packet.pr) || packet.pr < 1) fail('MULTI_AI_PR_INVALID');
  if (!SHA_RE.test(String(packet.candidate_sha || ''))) fail('MULTI_AI_CANDIDATE_SHA_INVALID');
  if (packet.review_mode !== 'READ_ONLY' || packet.writer_authority !== false) fail('MULTI_AI_REVIEW_NOT_READ_ONLY');
  if (!Array.isArray(packet.required_roles)
      || JSON.stringify(packet.required_roles) !== JSON.stringify(REQUIRED_ROLES)) {
    fail('MULTI_AI_REQUIRED_ROLES_INVALID');
  }
  if (!Array.isArray(packet.changed_paths) || packet.changed_paths.length === 0 || packet.changed_paths.length > 500
      || new Set(packet.changed_paths).size !== packet.changed_paths.length) fail('MULTI_AI_CHANGED_PATHS_INVALID');
  if (!Array.isArray(packet.public_evidence_refs) || packet.public_evidence_refs.length > 200
      || new Set(packet.public_evidence_refs).size !== packet.public_evidence_refs.length) fail('MULTI_AI_EVIDENCE_REFS_INVALID');
  for (const ref of [...packet.changed_paths, ...packet.public_evidence_refs]) {
    if (typeof ref !== 'string' || ref.length < 1 || ref.length > 240) fail('MULTI_AI_REFERENCE_INVALID');
  }
  assertPublicSafe(packet);
  return true;
}

function normalizeFinding(finding) {
  const allowed = ['severity', 'code', 'path', 'summary', 'recommendation', 'confidence', 'resolved'];
  assertKeys(finding, allowed, allowed, 'MULTI_AI_FINDING_SHAPE_INVALID');
  if (!SEVERITIES.has(finding.severity)) fail('MULTI_AI_FINDING_SEVERITY_INVALID');
  if (!CODE_RE.test(String(finding.code || ''))) fail('MULTI_AI_FINDING_CODE_INVALID');
  for (const [key, max] of [['path', 240], ['summary', 240], ['recommendation', 500]]) {
    if (typeof finding[key] !== 'string' || finding[key].length < 1 || finding[key].length > max) {
      fail(`MULTI_AI_FINDING_${key.toUpperCase()}_INVALID`);
    }
  }
  if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) {
    fail('MULTI_AI_FINDING_CONFIDENCE_INVALID');
  }
  if (typeof finding.resolved !== 'boolean') fail('MULTI_AI_FINDING_RESOLUTION_INVALID');
  const normalized = {
    severity: finding.severity,
    code: finding.code,
    path: finding.path,
    summary: finding.summary,
    recommendation: finding.recommendation,
    confidence: finding.confidence,
    resolved: finding.resolved
  };
  assertPublicSafe(normalized);
  return normalized;
}

function validateReport(report, packet) {
  const allowed = ['schema', 'roadmap_id', 'issue', 'pr', 'candidate_sha', 'reviewer_id', 'role',
    'review_mode', 'writer_authority', 'findings'];
  assertKeys(report, allowed, allowed, 'MULTI_AI_REPORT_SHAPE_INVALID');
  if (report.schema !== REPORT_SCHEMA) fail('MULTI_AI_REPORT_SCHEMA_INVALID');
  if (!REVIEWER_ID_RE.test(String(report.reviewer_id || ''))) fail('MULTI_AI_REVIEWER_ID_INVALID');
  if (!REQUIRED_ROLES.includes(report.role)) fail('MULTI_AI_REVIEWER_ROLE_INVALID');
  if (report.review_mode !== 'READ_ONLY' || report.writer_authority !== false) fail('MULTI_AI_REVIEW_NOT_READ_ONLY');
  if (report.roadmap_id !== packet.roadmap_id || report.issue !== packet.issue || report.pr !== packet.pr
      || report.candidate_sha !== packet.candidate_sha) fail('MULTI_AI_CANDIDATE_IDENTITY_MISMATCH');
  if (!Array.isArray(report.findings) || report.findings.length > 100) fail('MULTI_AI_FINDINGS_INVALID');
  const normalized = {
    schema: REPORT_SCHEMA,
    roadmap_id: report.roadmap_id,
    issue: report.issue,
    pr: report.pr,
    candidate_sha: report.candidate_sha,
    reviewer_id: report.reviewer_id,
    role: report.role,
    review_mode: 'READ_ONLY',
    writer_authority: false,
    findings: report.findings.map(normalizeFinding)
  };
  assertPublicSafe(normalized);
  return normalized;
}

function aggregateReviewReports(packetInput, reportsInput) {
  try {
    validatePacket(packetInput);
    if (!Array.isArray(reportsInput)) fail('MULTI_AI_REPORTS_INVALID');
    const reports = reportsInput.map((report) => validateReport(report, packetInput));
    const roles = new Set();
    const reviewers = new Set();
    for (const report of reports) {
      if (roles.has(report.role)) fail('MULTI_AI_DUPLICATE_ROLE');
      if (reviewers.has(report.reviewer_id)) fail('MULTI_AI_DUPLICATE_REVIEWER');
      roles.add(report.role);
      reviewers.add(report.reviewer_id);
    }
    const missingRoles = REQUIRED_ROLES.filter((role) => !roles.has(role));
    if (missingRoles.length) {
      return {
        status: 'INCOMPLETE', reasonCode: 'MULTI_AI_REQUIRED_ROLE_MISSING',
        candidateSha: packetInput.candidate_sha, rolesPresent: Array.from(roles).sort(), missingRoles,
        blockingFindings: 0, advisoryFindings: 0, reviewerCanMarkDone: false, reviewerHasWriterAuthority: false
      };
    }

    const findings = reports.flatMap((report) => report.findings.map((finding) => ({ ...finding, role: report.role })));
    const unresolved = findings.filter((finding) => !finding.resolved);
    const blocking = unresolved.filter((finding) => BLOCKING_SEVERITIES.has(finding.severity));
    const advisory = unresolved.filter((finding) => !BLOCKING_SEVERITIES.has(finding.severity));
    return {
      status: blocking.length ? 'BLOCKED' : 'PASS',
      reasonCode: blocking.length ? 'MULTI_AI_BLOCKING_FINDINGS' : 'OK',
      candidateSha: packetInput.candidate_sha,
      rolesPresent: REQUIRED_ROLES.slice(), missingRoles: [],
      blockingFindings: blocking.length, advisoryFindings: advisory.length,
      reviewerCanMarkDone: false, reviewerHasWriterAuthority: false, findings
    };
  } catch (error) {
    return {
      status: 'BLOCKED', reasonCode: boundedReason(error, 'MULTI_AI_PROTOCOL_FAILED'),
      candidateSha: packetInput && SHA_RE.test(String(packetInput.candidate_sha || '')) ? packetInput.candidate_sha : '',
      rolesPresent: [], missingRoles: REQUIRED_ROLES.slice(),
      blockingFindings: 0, advisoryFindings: 0, reviewerCanMarkDone: false, reviewerHasWriterAuthority: false
    };
  }
}

function evaluateSupplementaryEvidence(reviewResult, machineEvidence) {
  const evidence = machineEvidence && typeof machineEvidence === 'object' ? machineEvidence : {};
  const required = ['prValidation', 'trustedDevDeploy', 'trustedRuntimeHealth', 'autonomousMerge', 'mainVerification'];
  const machinePass = required.every((key) => String(evidence[key] || '') === 'PASS');
  return {
    reviewStatus: String(reviewResult && reviewResult.status || 'BLOCKED'),
    machineGatesPass: machinePass,
    deliveryDone: machinePass && String(reviewResult && reviewResult.status || '') === 'PASS',
    reviewerCanMarkDone: false
  };
}

function parseJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assertPublicSafe(parsed);
  return parsed;
}

function main() {
  try {
    if (process.argv[2] !== 'aggregate' || !process.argv[3] || !process.argv[4]) fail('MULTI_AI_COMMAND_INVALID');
    const result = aggregateReviewReports(parseJson(process.argv[3]), parseJson(process.argv[4]));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'BLOCKED', reasonCode: boundedReason(error, 'MULTI_AI_PROTOCOL_FAILED') })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  PACKET_SCHEMA,
  REPORT_SCHEMA,
  REQUIRED_ROLES,
  validatePacket,
  validateReport,
  normalizeFinding,
  assertPublicSafe,
  aggregateReviewReports,
  evaluateSupplementaryEvidence
};
