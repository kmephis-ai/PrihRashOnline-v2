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

function packet(overrides = {}) {
  return {
    schema: PACKET_SCHEMA,
    roadmap_id: 'AIENG-003',
    issue: 72,
    pr: 73,
    candidate_sha: SHA,
    review_mode: 'READ_ONLY',
    writer_authority: false,
    required_roles: REQUIRED_ROLES.slice(),
    changed_paths: ['AGENTS.md', 'tools/multi-ai-review-protocol.js'],
    public_evidence_refs: ['PR Validation', 'multi-ai-review-contract'],
    ...overrides
  };
}

function report(role, reviewerId, findings = [], overrides = {}) {
  return {
    schema: REPORT_SCHEMA,
    roadmap_id: 'AIENG-003',
    issue: 72,
    pr: 73,
    candidate_sha: SHA,
    reviewer_id: reviewerId,
    role,
    review_mode: 'READ_ONLY',
    writer_authority: false,
    findings,
    ...overrides
  };
}

function finding(severity, code, resolved = false, overrides = {}) {
  return {
    severity,
    code,
    path: 'tools/multi-ai-review-protocol.js',
    summary: `${severity} synthetic review finding`,
    recommendation: 'Fix on the same primary writer branch and rerun review on the new exact candidate.',
    resolved,
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
assert.deepStrictEqual(REQUIRED_ROLES, [
  'ARCHITECTURE',
  'SECURITY_PRIVACY',
  'FINANCIAL_DATA',
  'TEST_OPERATIONS'
]);
assert.strictEqual(validatePacket(packet()), true);
assert.strictEqual(validateReport(report('ARCHITECTURE', 'arch-reviewer'), packet()).role, 'ARCHITECTURE');

{
  const result = aggregateReviewReports(packet(), cleanReports());
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.reasonCode, 'OK');
  assert.deepStrictEqual(result.rolesPresent, REQUIRED_ROLES);
  assert.deepStrictEqual(result.missingRoles, []);
  assert.strictEqual(result.blockingFindings, 0);
  assert.strictEqual(result.advisoryFindings, 0);
  assert.strictEqual(result.reviewerCanMarkDone, false);
  assert.strictEqual(result.reviewerHasWriterAuthority, false);
}

{
  const result = aggregateReviewReports(packet(), cleanReports({
    ARCHITECTURE: [finding('P2', 'ARCH_ADVISORY')],
    TEST_OPERATIONS: [finding('P3', 'TEST_ADVISORY')]
  }));
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.blockingFindings, 0);
  assert.strictEqual(result.advisoryFindings, 2);
}

for (const severity of ['P0', 'P1']) {
  const result = aggregateReviewReports(packet(), cleanReports({
    SECURITY_PRIVACY: [finding(severity, `${severity}_BLOCKER`)]
  }));
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_BLOCKING_FINDINGS');
  assert.strictEqual(result.blockingFindings, 1);
}

{
  const result = aggregateReviewReports(packet(), cleanReports({
    FINANCIAL_DATA: [finding('P0', 'FIN_RESOLVED_BLOCKER', true), finding('P2', 'FIN_ADVISORY')]
  }));
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.blockingFindings, 0);
  assert.strictEqual(result.advisoryFindings, 1);
}

{
  const reports = cleanReports().slice(0, 3);
  const result = aggregateReviewReports(packet(), reports);
  assert.strictEqual(result.status, 'INCOMPLETE');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_REQUIRED_ROLE_MISSING');
  assert.deepStrictEqual(result.missingRoles, ['TEST_OPERATIONS']);
  assert.strictEqual(result.reviewerCanMarkDone, false);
}

{
  const reports = cleanReports();
  reports[3] = report('ARCHITECTURE', 'second-arch-reviewer');
  const result = aggregateReviewReports(packet(), reports);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_DUPLICATE_ROLE');
}

{
  const reports = cleanReports();
  reports[3] = report('TEST_OPERATIONS', 'arch-reviewer');
  const result = aggregateReviewReports(packet(), reports);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_DUPLICATE_REVIEWER');
}

{
  const reports = cleanReports();
  reports[1] = report('SECURITY_PRIVACY', 'security-reviewer', [], { candidate_sha: 'b'.repeat(40) });
  const result = aggregateReviewReports(packet(), reports);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_CANDIDATE_IDENTITY_MISMATCH');
}

{
  const result = aggregateReviewReports(packet(), [
    report('ARCHITECTURE', 'arch-reviewer', [], { writer_authority: true }),
    ...cleanReports().slice(1)
  ]);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_REVIEW_NOT_READ_ONLY');
}

{
  const result = aggregateReviewReports(packet(), [
    report('ARCHITECTURE', 'arch-reviewer', [], { review_mode: 'WRITE' }),
    ...cleanReports().slice(1)
  ]);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_REVIEW_NOT_READ_ONLY');
}

{
  const maliciousReport = report('ARCHITECTURE', 'arch-reviewer', [], { rawPayload: 'private' });
  const result = aggregateReviewReports(packet(), [maliciousReport, ...cleanReports().slice(1)]);
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_REPORT_SHAPE_INVALID');
}

{
  const maliciousFinding = finding('P2', 'EXTRA_RAW', false, { rawPayload: 'private' });
  const result = aggregateReviewReports(packet(), cleanReports({ ARCHITECTURE: [maliciousFinding] }));
  assert.strictEqual(result.status, 'BLOCKED');
  assert.strictEqual(result.reasonCode, 'MULTI_AI_FINDING_SHAPE_INVALID');
}

assert.throws(() => assertPublicSafe({ url: 'https://script.google.com/macros/s/PRIVATE/exec' }),
  /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ deployment: `AKfy${'x'.repeat(30)}` }),
  /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ token: `ya29.${'x'.repeat(30)}` }),
  /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ refreshToken: `1//${'x'.repeat(30)}` }),
  /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);
assert.throws(() => assertPublicSafe({ path: 'G:\\PrihRashOnline-Keys\\private.key' }),
  /MULTI_AI_PRIVATE_CONTEXT_FORBIDDEN/);

{
  const review = aggregateReviewReports(packet(), cleanReports());
  const redMachine = evaluateSupplementaryEvidence(review, {
    prValidation: 'PASS',
    trustedDevDeploy: 'PASS',
    trustedRuntimeHealth: 'PASS',
    autonomousMerge: 'PASS',
    mainVerification: 'FAIL'
  });
  assert.strictEqual(redMachine.reviewStatus, 'PASS');
  assert.strictEqual(redMachine.machineGatesPass, false);
  assert.strictEqual(redMachine.deliveryDone, false);
  assert.strictEqual(redMachine.reviewerCanMarkDone, false);

  const allPass = evaluateSupplementaryEvidence(review, {
    prValidation: 'PASS',
    trustedDevDeploy: 'PASS',
    trustedRuntimeHealth: 'PASS',
    autonomousMerge: 'PASS',
    mainVerification: 'PASS'
  });
  assert.strictEqual(allPass.machineGatesPass, true);
  assert.strictEqual(allPass.deliveryDone, true);
  assert.strictEqual(allPass.reviewerCanMarkDone, false);
}

const packetSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '.ai-context', 'multi-ai-review-packet.schema.json'), 'utf8'));
const reportSchema = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', '.ai-context', 'multi-ai-review-report.schema.json'), 'utf8'));
assert.strictEqual(packetSchema.properties.schema.const, PACKET_SCHEMA);
assert.strictEqual(packetSchema.properties.review_mode.const, 'READ_ONLY');
assert.strictEqual(packetSchema.properties.writer_authority.const, false);
assert.deepStrictEqual(packetSchema.properties.required_roles.const, REQUIRED_ROLES);
assert.strictEqual(reportSchema.properties.schema.const, REPORT_SCHEMA);
assert.strictEqual(reportSchema.properties.writer_authority.const, false);
assert.strictEqual(reportSchema.properties.findings.items.additionalProperties, false);
assert(!Object.prototype.hasOwnProperty.call(reportSchema.properties.findings.items.properties, 'rawPayload'));

const source = fs.readFileSync(path.join(__dirname, '..', 'tools', 'multi-ai-review-protocol.js'), 'utf8');
assert(!/\bfetch\s*\(/.test(source), 'protocol must not call external model/provider network');
assert(!source.includes('UrlFetchApp'), 'protocol must not call Apps Script external provider API');
assert(!/merge_pull_request|update_ref|create_branch|create_issue|update_issue|git push|gh pr merge/i.test(source),
  'review protocol must not contain repository write/merge actions');
assert(!/OpenAI|Anthropic|Gemini|YandexGPT|paid model/i.test(source),
  'protocol must not introduce external model/provider dependency');

console.log('multi_ai_review_protocol_contract_test: OK', {
  exactCandidateBinding: true,
  requiredRoles: REQUIRED_ROLES,
  readOnly: true,
  duplicateRoleFailClosed: true,
  blockingSeverity: ['P0', 'P1'],
  advisorySeverity: ['P2', 'P3'],
  privateContextRejected: true,
  machineGatesRemainAuthoritative: true,
  reviewerCanMarkDone: false,
  paidExternalModelDependency: false
});
