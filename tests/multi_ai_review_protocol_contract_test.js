'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  PACKET_SCHEMA,
  REPORT_SCHEMA,
  REQUIRED_ROLES,
  validatePacket,
  validateReport,
  assertPublicSafe,
  aggregateReviewReports,
  evaluateSupplementaryEvidence
} = require('../tools/multi-ai-review-protocol');

const SHA = 'a'.repeat(40);
const SYNTHETIC_PR = 4242;

function packet(overrides = {}) {
  return {
    schema: PACKET_SCHEMA,
    roadmap_id: 'AIENG-003',
    issue: 72,
    pr: SYNTHETIC_PR,
    candidate_sha: SHA,
    review_mode: 'READ_ONLY',
    writer_authority: false,
    required_roles: REQUIRED_ROLES.slice(),
    changed_paths: ['AGENTS.md', 'tools/multi-ai-review-protocol.js'],
    public_evidence_refs: ['PR Validation', 'multi-ai-review-contract'],
    ...overrides
  };
}

function finding(severity, code, resolved = false, overrides = {}) {
  return {
    severity,
    code,
    path: 'tools/multi-ai-review-protocol.js',
    summary: `${severity} synthetic review finding`,
    evidence: 'Synthetic contract evidence: deterministic assertion on exact candidate.',
    recommendation: 'Исправить на той же writer-ветке и повторить review exact candidate.',
    confidence: 0.9,
    resolved,
    ...overrides
  };
}

function report(role, reviewerId, findings = [], overrides = {}) {
  return {
    schema: REPORT_SCHEMA,
    roadmap_id: 'AIENG-003',
    issue: 72,
    pr: SYNTHETIC_PR,
    candidate_sha: SHA,
    reviewer_id: reviewerId,
    role,
    review_mode: 'READ_ONLY',
    writer_authority: false,
    findings,
    ...overrides
  };
}

function cleanReports(overrides = {}) {
  return [
    report('ARCHITECTURE', 'arch-reviewer', overrides.ARCHITECTURE || []),
    report('SECURITY_PRIVACY', 'security-reviewer', overrides.SECURITY_PRIVACY || []),
    report('FINANCIAL_DATA', 'finance-reviewer', overrides.FINANCIAL_DATA || []),
    report('TEST_OPERATIONS', 'testops-reviewer', overrides.TEST_OPERATIONS || [])
  ];
}

assert.strictEqual(PACKET_SCHEMA, 'PRH_MULTI_AI_REVIEW_PACKET_V1');
assert.strictEqual(REPORT_SCHEMA, 'PRH_MULTI_AI_REVIEW_REPORT_V1');
assert.deepStrictEqual(REQUIRED_ROLES, ['ARCHITECTURE', 'SECURITY_PRIVACY', 'FINANCIAL_DATA', 'TEST_OPERATIONS']);
assert.strictEqual(validatePacket(packet()), true);
assert.strictEqual(validateReport(report('ARCHITECTURE', 'arch-reviewer'), packet()).role, 'ARCHITECTURE');

{
  const result = aggregateReviewReports(packet(), cleanReports());
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.reasonCode, 'OK');
  assert.deepStrictEqual(result.missingRoles, []);
  assert.strictEqual(result.blockingFindings, 0);
  assert.strictEqual(result.reviewerCanMarkDone, false);
  assert.strictEqual(result.reviewerHasWriterAuthority, false);
}

{
  const result = aggregateReviewReports(packet(), cleanReports({
    ARCHITECTURE: [finding('P2', 'ARCH_ADVISORY')],
    TEST_OPERATIONS: [finding('P3', 'TEST_ADVISORY')]
  }));
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.advisoryFindings, 2);
  assert.strictEqual(result.findings[0].evidence.includes('Synthetic contract evidence'), true);
}

for (const severity of ['P0', 'P1']) {
  const result = aggregateReviewReports(packet(), cleanReports({
    SECURITY_PRIVACY: [finding(severity, `${severity}_BLOCKER`)]
  }));
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_BLOCKING_FINDINGS');
}

{
  const result = aggregateReviewReports(packet(), cleanReports({
    FINANCIAL_DATA: [finding('P0', 'FIN_RESOLVED', true), finding('P2', 'FIN_ADVISORY')]
  }));
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.advisoryFindings, 1);
}

{
  const result = aggregateReviewReports(packet(), cleanReports().slice(0, 3));
  assert.strictEqual(result.status, 'INCOMPLETE');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_REQUIRED_ROLE_MISSING');
}

{
  const reports = cleanReports();
  reports[3] = report('ARCHITECTURE', 'second-arch');
  assert.strictEqual(aggregateReviewReports(packet(), reports).reasonCode, 'MULTI_AI_DUPLICATE_ROLE');
}

{
  const reports = cleanReports();
  reports[3] = report('TEST_OPERATIONS', 'arch-reviewer');
  assert.strictEqual(aggregateReviewReports(packet(), reports).reasonCode, 'MULTI_AI_DUPLICATE_REVIEWER');
}

{
  const reports = cleanReports();
  reports[1] = report('SECURITY_PRIVACY', 'security-reviewer', [], { candidate_sha: 'b'.repeat(40) });
  assert.strictEqual(aggregateReviewReports(packet(), reports).reasonCode, 'MULTI_AI_CANDIDATE_IDENTITY_MISMATCH');
}

assert.strictEqual(
  aggregateReviewReports(packet(), [report('ARCHITECTURE', 'arch-reviewer', [], { writer_authority: true }), ...cleanReports().slice(1)]).reasonCode,
  'MULTI_AI_REVIEW_NOT_READ_ONLY'
);
assert.strictEqual(
  aggregateReviewReports(packet(), [report('ARCHITECTURE', 'arch-reviewer', [], { review_mode: 'WRITE' }), ...cleanReports().slice(1)]).reasonCode,
  'MULTI_AI_REVIEW_NOT_READ_ONLY'
);
assert.strictEqual(
  aggregateReviewReports(packet(), [report('ARCHITECTURE', 'arch-reviewer', [], { rawPayload: 'private' }), ...cleanReports().slice(1)]).reasonCode,
  'MULTI_AI_REPORT_SHAPE_INVALID'
);
assert.strictEqual(
  aggregateReviewReports(packet(), cleanReports({ ARCHITECTURE: [finding('P2', 'RAW_PAYLOAD', false, { rawPayload: 'private' })] })).reasonCode,
  'MULTI_AI_FINDING_SHAPE_INVALID'
);
assert.strictEqual(
  aggregateReviewReports(packet(), cleanReports({ ARCHITECTURE: [finding('P2', 'NO_EVIDENCE', false, { evidence: '' })] })).reasonCode,
  'MULTI_AI_FINDING_EVIDENCE_INVALID'
);

for (const unsafe of [
  { url: 'https://script.google.com/macros/s/PRIVATE/exec' },
  { deployment: `AKfy${'x'.repeat(30)}` },
  { token: `ya29.${'x'.repeat(30)}` },
  { refreshToken: `1//${'x'.repeat(30)}` },
  { path: 'G:\\PrihRashOnline-Keys\\private.key' }
]) {
  assert.throws(() => assertPublicSafe(unsafe), /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);
}

{
  const review = aggregateReviewReports(packet(), cleanReports());
  const red = evaluateSupplementaryEvidence(review, {
    prValidation: 'PASS', trustedDevDeploy: 'PASS', trustedRuntimeHealth: 'PASS',
    autonomousMerge: 'PASS', mainVerification: 'FAIL'
  });
  assert.strictEqual(red.machineGatesPass, false);
  assert.strictEqual(red.deliveryDone, false);
  assert.strictEqual(red.reviewerCanMarkDone, false);

  const green = evaluateSupplementaryEvidence(review, {
    prValidation: 'PASS', trustedDevDeploy: 'PASS', trustedRuntimeHealth: 'PASS',
    autonomousMerge: 'PASS', mainVerification: 'PASS'
  });
  assert.strictEqual(green.machineGatesPass, true);
  assert.strictEqual(green.deliveryDone, true);
  assert.strictEqual(green.reviewerCanMarkDone, false);
}

const packetSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.ai-context', 'multi-ai-review-packet.schema.json'), 'utf8'));
const reportSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.ai-context', 'multi-ai-review-report.schema.json'), 'utf8'));
assert.strictEqual(packetSchema.properties.schema.const, PACKET_SCHEMA);
assert.strictEqual(packetSchema.properties.review_mode.const, 'READ_ONLY');
assert.strictEqual(packetSchema.properties.writer_authority.const, false);
assert.deepStrictEqual(packetSchema.properties.required_roles.const, REQUIRED_ROLES);
assert.strictEqual(reportSchema.properties.schema.const, REPORT_SCHEMA);
assert.strictEqual(reportSchema.properties.writer_authority.const, false);
assert.strictEqual(reportSchema.properties.findings.items.additionalProperties, false);
assert(Object.prototype.hasOwnProperty.call(reportSchema.properties.findings.items.properties, 'evidence'));
assert(Object.prototype.hasOwnProperty.call(reportSchema.properties.findings.items.properties, 'confidence'));
assert(!Object.prototype.hasOwnProperty.call(reportSchema.properties.findings.items.properties, 'rawPayload'));

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'multi-ai-review-protocol.js'), 'utf8');
assert(!/\bfetch\s*\(/.test(source));
assert(!source.includes('UrlFetchApp'));
assert(!/merge_pull_request|update_ref|create_branch|create_issue|update_issue|git push|gh pr merge/i.test(source));
assert(!/OpenAI|Anthropic|Gemini|YandexGPT|paid model/i.test(source));

console.log('multi_ai_review_protocol_contract_test: OK', {
  exactCandidateBinding: true,
  requiredRoles: REQUIRED_ROLES,
  findingContract: ['severity', 'evidence', 'recommendation', 'confidence'],
  readOnly: true,
  blockingSeverity: ['P0', 'P1'],
  advisorySeverity: ['P2', 'P3'],
  privateContextRejected: true,
  machineGatesRemainAuthoritative: true,
  reviewerCanMarkDone: false,
  paidExternalModelDependency: false
});
