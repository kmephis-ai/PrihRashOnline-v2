'use strict';

const ROADMAP_ID_RE = /^[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9]{3}$/;

function parseProjectStatusEntries(markdown) {
  const entries = [];
  for (const rawLine of String(markdown || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('- `')) continue;
    const idEnd = line.indexOf('`', 3);
    if (idEnd < 0) continue;
    const id = line.slice(3, idEnd);
    if (!ROADMAP_ID_RE.test(id)) continue;
    const tail = line.slice(idEnd + 1);
    let lifecycle = '';
    for (const candidate of ['IN_PROGRESS', 'DONE', 'BLOCKED', 'READY', 'BACKLOG']) {
      if (tail.includes(candidate)) {
        lifecycle = candidate;
        break;
      }
    }
    entries.push(Object.freeze({ id, lifecycle, line: rawLine }));
  }
  return Object.freeze(entries);
}

function currentRoadmapWriters(markdown) {
  return Object.freeze(parseProjectStatusEntries(markdown)
    .filter((entry) => entry.lifecycle === 'IN_PROGRESS')
    .map((entry) => entry.id));
}

function branchRoadmapId(env) {
  const source = env || process.env;
  const branch = String(source.GITHUB_HEAD_REF || source.GITHUB_REF_NAME || '');
  const match = /^agent\/([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-[0-9]{3})-[a-z0-9][a-z0-9-]*$/.exec(branch);
  return match ? match[1] : '';
}

function unquoteScalar(value) {
  const text = String(value || '').trim();
  if (text.length >= 2 && ((text[0] === "'" && text[text.length - 1] === "'") ||
      (text[0] === '"' && text[text.length - 1] === '"'))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseWorkflowSteps(yamlText) {
  const lines = String(yamlText || '').split(/\r?\n/);
  const steps = [];
  let current = null;
  let collectingRun = false;
  let runIndent = -1;

  function finish() {
    if (!current) return;
    current.run = current.runLines.join('\n').trim();
    delete current.runLines;
    steps.push(Object.freeze(current));
    current = null;
    collectingRun = false;
    runIndent = -1;
  }

  for (const raw of lines) {
    const indent = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.startsWith('- name:')) {
      finish();
      current = { name: unquoteScalar(trimmed.slice('- name:'.length)), runLines: [] };
      continue;
    }
    if (!current) continue;

    if (collectingRun) {
      if (trimmed && indent <= runIndent) {
        collectingRun = false;
      } else {
        const contentStart = Math.min(raw.length, runIndent + 2);
        current.runLines.push(raw.slice(contentStart));
        continue;
      }
    }

    if (trimmed.startsWith('run:')) {
      const value = trimmed.slice('run:'.length).trim();
      runIndent = indent;
      if (value === '|' || value === '>') {
        collectingRun = true;
      } else if (value) {
        current.runLines.push(unquoteScalar(value));
      }
    }
  }
  finish();
  return Object.freeze(steps);
}

function workflowStepMap(yamlText) {
  const map = new Map();
  for (const step of parseWorkflowSteps(yamlText)) {
    if (!step.name) continue;
    if (map.has(step.name)) {
      const error = new Error(`WORKFLOW_STEP_DUPLICATE:${step.name}`);
      error.code = 'WORKFLOW_STEP_DUPLICATE';
      throw error;
    }
    map.set(step.name, step);
  }
  return map;
}

module.exports = {
  ROADMAP_ID_RE,
  parseProjectStatusEntries,
  currentRoadmapWriters,
  branchRoadmapId,
  parseWorkflowSteps,
  workflowStepMap
};
