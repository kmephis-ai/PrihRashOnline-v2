'use strict';

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join('lib', 'ai', 'ai_playbook_catalog.v1.json');
const META_MARKER = 'PRH_AI_PLAYBOOK_META_V1';
const EXPECTED_IDS = Object.freeze([
  'ROADMAP_EXECUTION',
  'PR_REVIEW',
  'MIGRATION_REVIEW',
  'DOCS_DRIFT',
  'RELEASE'
]);

function fail(reason, detail) {
  const message = detail ? `${reason}:${detail}` : reason;
  const error = new Error(message);
  error.code = reason;
  throw error;
}

function sorted(value) {
  return Array.from(value).slice().sort();
}

function setEqual(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function countCyrillic(text) {
  const matches = String(text || '').match(/[А-Яа-яЁё]/g);
  return matches ? matches.length : 0;
}

function parseMeta(text, file) {
  const re = /<!--\s*PRH_AI_PLAYBOOK_META_V1\s*\n([\s\S]*?)\n-->/;
  const match = re.exec(text);
  if (!match) fail('AI_PLAYBOOK_META_MISSING', file);
  let meta;
  try {
    meta = JSON.parse(match[1].trim());
  } catch (_) {
    fail('AI_PLAYBOOK_META_JSON_INVALID', file);
  }
  const keys = Object.keys(meta).sort();
  const expected = ['authority_granted_by_playbook', 'catalog', 'language', 'mode', 'playbook_id', 'version'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('AI_PLAYBOOK_META_SHAPE_INVALID', file);
  return meta;
}

function validateCatalog(catalog) {
  if (!catalog || catalog.schema !== 'PRH_AI_PLAYBOOK_CATALOG_V1' || catalog.version !== '1.0.0' || catalog.roadmap_id !== 'AIENG-004' || catalog.language !== 'ru') {
    fail('AI_PLAYBOOK_CATALOG_VERSION_INVALID');
  }
  if (!catalog.principles || catalog.principles.catalog_grants_authority !== false ||
      catalog.principles.existing_authority_required !== true ||
      catalog.principles.source_of_truth_duplicated !== false ||
      catalog.principles.public_safe !== true ||
      catalog.principles.public_finance_data !== 'SYNTHETIC_ONLY' ||
      catalog.principles.paid_dependency_required !== false ||
      catalog.principles.red_machine_gate_bypass_allowed !== false ||
      catalog.principles.one_writer_preserved !== true ||
      catalog.principles.free_only !== true) {
    fail('AI_PLAYBOOK_CATALOG_BOUNDARY_INVALID');
  }
  if (!catalog.authorities || Object.values(catalog.authorities).some((value) => value !== false)) {
    fail('AI_PLAYBOOK_CATALOG_AUTHORITY_INVALID');
  }
  if (!Array.isArray(catalog.required_playbook_ids) || !setEqual(catalog.required_playbook_ids, EXPECTED_IDS)) {
    fail('AI_PLAYBOOK_REQUIRED_IDS_INVALID');
  }
  const ids = Object.keys(catalog.playbooks || {});
  if (!setEqual(ids, EXPECTED_IDS)) fail('AI_PLAYBOOK_CATALOG_IDS_INVALID');
  if (!Array.isArray(catalog.canonical_authorities) || catalog.canonical_authorities.length < 8 ||
      !catalog.canonical_authorities.includes('AGENTS.md') ||
      !catalog.canonical_authorities.includes('docs/ROADMAP.md') ||
      !catalog.canonical_authorities.includes('live GitHub Issues') ||
      !catalog.canonical_authorities.includes('exact-SHA code/tests/workflows/machine evidence') ||
      !catalog.canonical_authorities.includes('PRH_ROADMAP_TASK_V2') ||
      !catalog.canonical_authorities.includes('PRH_MULTI_AI_REVIEW_V1') ||
      !catalog.canonical_authorities.includes('FIN-TRUTH-v1') ||
      !catalog.canonical_authorities.includes('CI-003')) {
    fail('AI_PLAYBOOK_CANONICAL_AUTHORITY_INVALID');
  }
  if (!catalog.scanner || catalog.scanner.metadata_marker !== META_MARKER ||
      !Number.isSafeInteger(catalog.scanner.max_steps_per_playbook) || catalog.scanner.max_steps_per_playbook < 1 ||
      !Number.isSafeInteger(catalog.scanner.max_stop_conditions_per_playbook) || catalog.scanner.max_stop_conditions_per_playbook < 1) {
    fail('AI_PLAYBOOK_SCANNER_POLICY_INVALID');
  }
  return true;
}

function scanPlaybooks(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const catalog = options.catalog || JSON.parse(fs.readFileSync(path.join(root, CATALOG_PATH), 'utf8'));
  validateCatalog(catalog);

  const seenFiles = new Set();
  const results = [];
  for (const id of EXPECTED_IDS) {
    const entry = catalog.playbooks[id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('AI_PLAYBOOK_ENTRY_INVALID', id);
    if (entry.version !== '1.0.0') fail('AI_PLAYBOOK_VERSION_INVALID', id);
    if (typeof entry.file !== 'string' || !entry.file.startsWith('.ai-context/playbooks/') || !entry.file.endsWith('.md')) {
      fail('AI_PLAYBOOK_PATH_INVALID', id);
    }
    if (seenFiles.has(entry.file)) fail('AI_PLAYBOOK_FILE_DUPLICATE', entry.file);
    seenFiles.add(entry.file);
    if (!entry.authority_grants || Object.values(entry.authority_grants).some((value) => value !== false)) {
      fail('AI_PLAYBOOK_AUTHORITY_GRANT_FORBIDDEN', id);
    }
    if (!Array.isArray(entry.required_inputs) || entry.required_inputs.length === 0 ||
        !Array.isArray(entry.ordered_steps) || entry.ordered_steps.length === 0 ||
        entry.ordered_steps.length > catalog.scanner.max_steps_per_playbook ||
        new Set(entry.ordered_steps).size !== entry.ordered_steps.length ||
        !Array.isArray(entry.stop_conditions) || entry.stop_conditions.length === 0 ||
        entry.stop_conditions.length > catalog.scanner.max_stop_conditions_per_playbook ||
        !Array.isArray(entry.outputs) || entry.outputs.length === 0 ||
        !Array.isArray(entry.required_markers) || entry.required_markers.length === 0) {
      fail('AI_PLAYBOOK_PROCESS_CONTRACT_INVALID', id);
    }
    if (!Number.isSafeInteger(entry.min_cyrillic_letters) || entry.min_cyrillic_letters < 80 ||
        !Number.isSafeInteger(entry.max_bytes) || entry.max_bytes < 1000 || entry.max_bytes > 20000) {
      fail('AI_PLAYBOOK_SIZE_POLICY_INVALID', id);
    }

    const absolute = path.join(root, entry.file);
    if (!fs.existsSync(absolute)) fail('AI_PLAYBOOK_FILE_MISSING', entry.file);
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('AI_PLAYBOOK_FILE_TYPE_INVALID', entry.file);
    const bytes = fs.readFileSync(absolute);
    if (bytes.length > entry.max_bytes) fail('AI_PLAYBOOK_OVERSIZED', entry.file);
    const text = bytes.toString('utf8');
    const meta = parseMeta(text, entry.file);
    if (meta.playbook_id !== id || meta.version !== entry.version || meta.language !== 'ru' ||
        meta.mode !== entry.mode || meta.catalog !== `${catalog.schema}@${catalog.version}` ||
        meta.authority_granted_by_playbook !== false) {
      fail('AI_PLAYBOOK_META_MISMATCH', id);
    }
    if (countCyrillic(text) < entry.min_cyrillic_letters) fail('AI_PLAYBOOK_RUSSIAN_TEXT_INSUFFICIENT', entry.file);
    for (const marker of entry.required_markers) {
      if (!text.includes(marker)) fail('AI_PLAYBOOK_REQUIRED_MARKER_MISSING', `${id}:${marker}`);
    }
    if ((id === 'PR_REVIEW' || id === 'MIGRATION_REVIEW') && (entry.mode !== 'READ_ONLY' || !text.includes('writer_authority=false'))) {
      fail('AI_PLAYBOOK_READ_ONLY_BOUNDARY_INVALID', id);
    }
    if (/authority_granted_by_playbook\s*[=:]\s*true/i.test(text) || /writer_authority\s*[=:]\s*true/i.test(text)) {
      fail('AI_PLAYBOOK_TEXT_AUTHORITY_GRANT_FORBIDDEN', id);
    }
    results.push(Object.freeze({ id, file: entry.file, mode: entry.mode, bytes: bytes.length, cyrillic: countCyrillic(text), status: 'PASS' }));
  }
  return Object.freeze({
    schema: catalog.schema,
    version: catalog.version,
    playbook_count: results.length,
    results: Object.freeze(results)
  });
}

if (require.main === module) {
  try {
    const result = scanPlaybooks();
    console.log('ai-playbooks: PASS', {
      schema: result.schema,
      version: result.version,
      playbooks: result.playbook_count,
      ids: result.results.map((item) => item.id),
      modes: result.results.map((item) => item.mode),
      authorityGranted: false,
      paidDependencyRequired: false,
      freeOnly: true
    });
  } catch (error) {
    console.error(`ai-playbooks: FAIL ${error.code || 'AI_PLAYBOOK_SCAN_FAILED'} ${error.message}`);
    process.exit(1);
  }
}

module.exports = Object.freeze({
  CATALOG_PATH,
  META_MARKER,
  EXPECTED_IDS,
  countCyrillic,
  parseMeta,
  validateCatalog,
  scanPlaybooks
});
