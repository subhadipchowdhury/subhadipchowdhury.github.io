// Build-time validation of a lab spec.
//
//     node tools/validate.mjs teaching/applet/lab/specs/m1-newton.json
//     jsc -m tools/validate.mjs -- teaching/applet/lab/specs/m1-newton.json
//
// build_labs.py runs this and refuses to ship a spec it rejects. The check that
// earns its keep: every distractor and every authored wrong blank is pushed
// through the real grader, and has to come back both rejected and carrying the
// message written for it. A distractor the probes cannot separate from the
// answer is a puzzle a student can pass while wrong, and a message that never
// fires is a message that does not exist.

import { buildReference, verify } from '../teaching/applet/lab/engine/verify.js';
import { evalExpression } from '../teaching/applet/lab/engine/interp.js';

// ---------------------------------------------------------------------------
// Runtime compatibility: node and the JavaScriptCore shell
// ---------------------------------------------------------------------------

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const argv = isNode ? process.argv.slice(2) : (globalThis.arguments ?? []);
const say = typeof print === 'function' ? print : console.log;

async function readText(path) {
  if (isNode) {
    const fs = await import('node:fs');
    return fs.readFileSync(path, 'utf8');
  }
  return globalThis.read(path);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const problems = [];
const notes = [];

function bad(where, message) { problems.push(`${where}: ${message}`); }

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkStructure(gate, where) {
  const blockIds = new Set(gate.blocks.map((b) => b.id));
  const decoyIds = new Set((gate.distractors || []).map((d) => d.id));

  for (const id of decoyIds) {
    if (blockIds.has(id)) bad(where, `"${id}" is both a block and a distractor`);
  }

  const solutionIds = gate.solution.map((s) => s.id);
  for (const id of solutionIds) {
    if (!blockIds.has(id)) bad(where, `the solution places "${id}", which is not a block`);
  }
  for (const id of blockIds) {
    if (!solutionIds.includes(id)) {
      bad(where, `block "${id}" is never placed by the solution; it should be a distractor`);
    }
  }
  if (new Set(solutionIds).size !== solutionIds.length) {
    bad(where, 'the solution places the same block twice');
  }

  if (!gate.probes?.length) bad(where, 'no probes, so nothing can be graded');

  // A message nothing can reach is a message that does not exist.
  const feedback = gate.feedback || {};
  for (const d of gate.distractors || []) {
    if (!d.why) bad(where, `distractor "${d.id}" has no why`);
    else if (!feedback[d.why]) bad(where, `distractor "${d.id}" points at feedback "${d.why}", which is not written`);
    if (!blockIds.has(d.near)) bad(where, `distractor "${d.id}" sits near "${d.near}", which is not a block`);
  }
  for (const [name, alternatives] of Object.entries(gate.wrong_blanks || {})) {
    if (!gate.blanks?.[name]) bad(where, `wrong_blanks names "${name}", which is not a blank`);
    for (const alt of alternatives) {
      if (!alt.why) bad(where, `a wrong answer for "${name}" has no why`);
      else if (!feedback[alt.why]) bad(where, `wrong answer "${alt.text}" points at feedback "${alt.why}", which is not written`);
    }
  }
  for (const key of Object.keys(feedback)) {
    const reachable = (gate.distractors || []).some((d) => d.why === key)
      || Object.values(gate.wrong_blanks || {}).some((xs) => xs.some((a) => a.why === key));
    if (!reachable) notes.push(`${where}: feedback "${key}" is never reachable`);
  }

  // Blanks appear in block text; a blank nothing mentions is dead weight.
  const allText = [...gate.blocks, ...(gate.distractors || [])]
    .flatMap((b) => b.lines.map((l) => l.text)).join('\n');
  for (const name of Object.keys(gate.blanks || {})) {
    if (!allText.includes(`⟨?${name}⟩`)) bad(where, `blank "${name}" appears in no block`);
  }
  for (const m of allText.matchAll(/⟨\?([^⟩]+)⟩/g)) {
    if (!gate.blanks?.[m[1].trim()]) bad(where, `block text uses blank "${m[1].trim()}", which is not declared`);
  }
}

function correctSubmission(gate) {
  const blanks = {};
  for (const [name, spec] of Object.entries(gate.blanks || {})) blanks[name] = spec.answer;
  return { placements: gate.solution.map((s) => ({ ...s })), blanks };
}

// A distractor with L lines stands in for its `near` block and the L−1 blocks
// that follow it in the solution, which is what makes a fused two-line decoy a
// drop-in for a pair of loop headers.
function substituteDistractor(gate, distractor) {
  const at = gate.solution.findIndex((s) => s.id === distractor.near);
  if (at < 0) return null;
  const span = distractor.lines.length;
  const placements = gate.solution.map((s) => ({ ...s }));
  placements.splice(at, span, { id: distractor.id, indent: gate.solution[at].indent });
  return placements;
}

function checkDistractors(gate, reference, where) {
  for (const d of gate.distractors || []) {
    const placements = substituteDistractor(gate, d);
    if (!placements) continue;
    const submission = { ...correctSubmission(gate), placements };

    let verdict;
    try {
      verdict = verify(gate, submission, reference);
    } catch (err) {
      bad(where, `distractor "${d.id}" crashed the grader: ${err.message}`);
      continue;
    }

    if (verdict.ok) {
      bad(where, `distractor "${d.id}" passes. The probes cannot tell it from the answer; `
        + 'change the probe or drop the distractor');
      continue;
    }
    if (verdict.why !== d.why) {
      bad(where, `distractor "${d.id}" is caught but reports "${verdict.why}" instead of `
        + `"${d.why}", so the student sees the wrong message:\n      ${verdict.message}`);
    }
  }
}

function checkWrongBlanks(gate, reference, where) {
  for (const [name, alternatives] of Object.entries(gate.wrong_blanks || {})) {
    const answer = gate.blanks?.[name]?.answer;
    for (const alt of alternatives) {
      const submission = correctSubmission(gate);
      submission.blanks[name] = alt.text;

      let verdict;
      try {
        verdict = verify(gate, submission, reference);
      } catch (err) {
        bad(where, `wrong answer "${alt.text}" for "${name}" crashed the grader: ${err.message}`);
        continue;
      }
      if (verdict.ok) {
        bad(where, `"${alt.text}" is listed as a wrong answer for "${name}" but passes. `
          + `Either it is right, or the probes cannot separate it from ${answer}`);
        continue;
      }
      if (verdict.why !== alt.why) {
        bad(where, `wrong answer "${alt.text}" for "${name}" reports "${verdict.why}" `
          + `instead of "${alt.why}":\n      ${verdict.message}`);
      }
    }
  }
}

function checkBlankAnswers(gate, where) {
  for (const [name, spec] of Object.entries(gate.blanks || {})) {
    if (!spec.answer || !String(spec.answer).trim()) {
      bad(where, `blank "${name}" has no answer`);
      continue;
    }
    if (!spec.env?.length) {
      notes.push(`${where}: blank "${name}" declares no env, so wrong-answer matching cannot sample it`);
    }
    // Only a parse failure is the answer's fault. Whether it evaluates depends
    // on data this check does not have, and buildReference below settles that
    // by running the solution for real.
    try {
      evalExpression(String(spec.answer), {}, { maxSteps: 5000 });
    } catch (err) {
      if (err.name === 'ParseError') {
        bad(where, `blank "${name}" answer "${spec.answer}" does not read as an expression: ${err.message}`);
      }
    }
  }
}

function checkReveal(gate, where) {
  if (!gate.reveal?.length) {
    bad(where, 'no reveal mapping');
    return;
  }
  const numbered = gate.reveal.filter((l) => l.role === 'block');
  const ids = new Set(numbered.map((l) => l.blockId));
  for (const b of gate.blocks) {
    if (!ids.has(b.id)) bad(where, `block "${b.id}" has no Python line in the reveal`);
  }
  for (const line of gate.reveal) {
    if (!line.role) bad(where, `reveal line ${line.n} has no role`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const specPath = argv[0];
if (!specPath) {
  say('usage: validate.mjs <spec.json>');
  say('VALIDATION FAILED');
  if (isNode) process.exit(2); else quit();
}

const spec = JSON.parse(await readText(specPath));
const gates = spec.cells.filter((c) => c.gate).map((c) => c.gate);

if (!gates.length) notes.push(`${spec.lab_id}: no gated cells`);

let checked = 0;
for (const gate of gates) {
  const where = `${spec.lab_id}/${gate.cell_id}`;
  checkStructure(gate, where);
  checkBlankAnswers(gate, where);
  checkReveal(gate, where);

  let reference;
  try {
    reference = buildReference(gate);
  } catch (err) {
    bad(where, `the solution itself does not run: ${err.message}`);
    continue;
  }

  // The solution must pass its own grader, which is not as tautological as it
  // sounds: the reference and the submission take different paths through it.
  const self = verify(gate, correctSubmission(gate), reference);
  if (!self.ok) {
    bad(where, `the solution does not pass its own grader: ${self.message}`);
    continue;
  }

  checkDistractors(gate, reference, where);
  checkWrongBlanks(gate, reference, where);
  checked += 1;

  const decoys = (gate.distractors || []).length;
  const wrongs = Object.values(gate.wrong_blanks || {}).reduce((n, xs) => n + xs.length, 0);
  say(`  ${gate.cell_id}: ${gate.solution.length} blocks, ${decoys} decoys, `
    + `${wrongs} wrong answers, ${gate.probes.length} probe${gate.probes.length === 1 ? '' : 's'} — all separated`);
}

for (const note of notes) say(`  note: ${note}`);

if (problems.length) {
  say('');
  for (const p of problems) say(`  ${p}`);
  say('VALIDATION FAILED');
  if (isNode) process.exit(1); else quit();
}

say(`  validated ${checked} gate${checked === 1 ? '' : 's'}`);
