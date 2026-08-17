'use strict';

const fs = require('fs');
const path = require('path');
const suite = require('../lib/ai/ai_eval_suite');

function parseArgs(argv) {
  const args = { candidate: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--candidate') {
      args.candidate = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`AI_EVAL_ARGUMENT_UNSUPPORTED:${argv[i]}`);
    }
  }
  return args;
}

function loadCandidate(file) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.results)) return parsed.results;
  throw new Error('AI_EVAL_CANDIDATE_RESULTS_MISSING');
}

function run(argv = process.argv) {
  const args = parseArgs(argv);
  const root = path.join(__dirname, '..');
  const results = args.candidate ? loadCandidate(args.candidate) : suite.loadBaseline(root).baseline.results;
  const report = suite.compareCandidateToBaseline(results, root);
  if (report.status !== 'PASS') {
    const error = new Error(`AI_EVAL_REGRESSION:${report.failed_task_ids.join(',') || 'BASELINE_PARITY'}`);
    error.code = 'AI_EVAL_REGRESSION';
    error.report = report;
    throw error;
  }
  return report;
}

if (require.main === module) {
  try {
    console.log('ai-regression-eval: PASS', run());
  } catch (error) {
    console.error('ai-regression-eval: FAIL', error.code || error.message);
    if (error.report) console.error(JSON.stringify(error.report));
    process.exit(1);
  }
}

module.exports = Object.freeze({ parseArgs, loadCandidate, run });
