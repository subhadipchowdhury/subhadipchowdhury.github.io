// Grading a placed assembly.
//
// Five stages in order, stopping at the first failure: completeness, parse,
// interpret, compare, diagnose. Behaviour decides the verdict: any arrangement
// that computes the right thing passes.
//
// Nothing here shows the reference answer. The classifier describes the shape
// of the student's own wrong result, and as a last resort names one entry.

import {
  parseProgram, run, evalExpression, valuesEqual, deepCopy,
  isArr2, isNum, fmtNum, shapeOf, ParseError, RuntimeError,
} from './interp.js';

// ---------------------------------------------------------------------------
// Assembling placed blocks into lines
// ---------------------------------------------------------------------------

/**
 * A placement is { id, indent }. A block contributes one or more lines, each
 * with an indent relative to the block's own.
 *
 * @returns {Array<{text, indent, blockId, blockLine}>}
 */
export function assemble(placements, blocksById) {
  const lines = [];
  placements.forEach((p) => {
    const block = blocksById[p.id];
    if (!block) throw new Error(`Unknown block "${p.id}".`);
    block.lines.forEach((line, k) => {
      lines.push({
        text: line.text,
        indent: p.indent + (line.indent || 0),
        blockId: p.id,
        blockLine: k,
      });
    });
  });
  return lines;
}

function countLines(placements, blocksById) {
  return placements.reduce((n, p) => n + ((blocksById[p.id] || { lines: [] }).lines.length), 0);
}

export function indexBlocks(gate) {
  const byId = {};
  for (const b of gate.blocks) byId[b.id] = b;
  for (const d of gate.distractors || []) byId[d.id] = d;
  return byId;
}

// Which blanks actually appear in the placed blocks. A blank inside a block
// still in the tray is not the student's problem.
export function activeBlanks(placements, blocksById) {
  const names = new Set();
  for (const p of placements) {
    const block = blocksById[p.id];
    if (!block) continue;
    for (const line of block.lines) {
      for (const m of line.text.matchAll(/⟨\?([^⟩]+)⟩/g)) names.add(m[1].trim());
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// Reference
// ---------------------------------------------------------------------------

/**
 * Run the instructor's solution. Computed once per gate at page load, so the
 * student's answer is compared against values from this same interpreter.
 */
export function buildReference(gate) {
  const byId = indexBlocks(gate);
  const answers = {};
  for (const [name, spec] of Object.entries(gate.blanks || {})) answers[name] = spec.answer;
  const lines = assemble(gate.solution, byId);
  const program = parseProgram(lines, answers);
  return gate.probes.map((probe) => run(program, {
    env: probe.env,
    call: probe.call,
    trace: gate.trace || [],
    maxSteps: gate.maxSteps || 1e6,
  }));
}

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

/**
 * @param {Object} gate       the gate spec from the lab JSON
 * @param {Object} submission { placements: [{id, indent}], blanks: {name: text} }
 * @param {Array}  reference  from buildReference
 * @returns {Object} verdict
 *   ok           boolean
 *   stage        'complete' | 'parse' | 'run' | 'compare' | 'solved'
 *   message      one sentence for the student
 *   detail       optional second sentence
 *   blockId      block to point at, when known
 *   blank        blank to point at, when known
 *   why          classification key, used to look up authored feedback
 *   placedDecoys ids of distractors currently in the workspace
 *   trace        the student's own computed trace, for display
 */
export function verify(gate, submission, reference) {
  const byId = indexBlocks(gate);
  const placements = submission.placements || [];
  const blanks = submission.blanks || {};
  const decoyIds = new Set((gate.distractors || []).map((d) => d.id));
  const placedDecoys = placements.filter((p) => decoyIds.has(p.id)).map((p) => p.id);

  const base = { placedDecoys, trace: null, why: null };

  // 1. Completeness, by line count only. A student who swapped a real block for
  // a decoy has a full workspace, and should get the diagnosis below rather
  // than a message that gives away which block is the decoy.
  const wanted = countLines(gate.solution, byId);
  const placed = countLines(placements, byId);
  if (placements.length === 0) {
    return { ...base, ok: false, stage: 'complete', message: 'Nothing is in the workspace yet.' };
  }
  if (placed !== wanted) {
    const diff = Math.abs(wanted - placed);
    return {
      ...base,
      ok: false,
      stage: 'complete',
      message: placed < wanted
        ? `Your workspace is ${diff} line${diff === 1 ? '' : 's'} short of a complete algorithm.`
        : `Your workspace has ${diff} line${diff === 1 ? '' : 's'} more than the algorithm needs.`,
    };
  }

  const needed = activeBlanks(placements, byId);
  for (const name of needed) {
    const text = blanks[name];
    if (text === undefined || String(text).trim() === '') {
      return {
        ...base,
        ok: false,
        stage: 'complete',
        message: 'A blank is still empty.',
        blank: name,
        blockId: blockOwningBlank(gate, byId, placements, name),
      };
    }
  }

  // Every block in the right order with the wrong nesting is a distinct kind of
  // near-miss, and it can surface at any stage below, so it is settled here.
  const indentOnly = sequenceMatchesSolution(gate, placements)
    && !indentsMatchSolution(gate, placements);
  const indentVerdict = () => ({
    ...base,
    ok: false,
    stage: 'indent',
    why: 'indent_only',
    message: 'Your lines are in the right order. The question is which of them sit inside which loop.',
    detail: 'A line one level further in runs once per pass of the loop above it.',
  });

  // 2. Parse. The blocks are authored, so a parse failure is a blank or an
  // arrangement that cannot be read as a program at all.
  let program;
  const lines = assemble(placements, byId);
  try {
    program = parseProgram(lines, blanks);
  } catch (err) {
    if (!(err instanceof ParseError)) throw err;
    if (err.blank) {
      return {
        ...base, ok: false, stage: 'parse', message: err.message,
        blockId: err.blockId ?? null, blank: err.blank, why: 'blank_syntax',
      };
    }
    if (indentOnly) return indentVerdict();
    return {
      ...base,
      ok: false,
      stage: 'parse',
      message: err.message,
      blockId: err.blockId ?? null,
      blank: err.blank ?? null,
      why: err.blank ? 'blank_syntax' : 'arrangement',
    };
  }

  // 3. Interpret, once per probe.
  const results = [];
  for (let k = 0; k < gate.probes.length; k++) {
    const probe = gate.probes[k];
    try {
      results.push(run(program, {
        env: probe.env,
        call: probe.call,
        trace: gate.trace || [],
        maxSteps: gate.maxSteps || 1e6,
      }));
    } catch (err) {
      if (!(err instanceof RuntimeError)) throw err;
      // A wrong blank or a placed decoy that happens to crash still deserves
      // the message written for that mistake; the crash becomes the detail.
      const authored = authoredFeedback(gate, placements, blanks, k);
      if (!authored && indentOnly) return indentVerdict();
      if (authored) {
        return {
          ...base, ok: false, stage: 'run', probeIndex: k,
          message: authored.message,
          detail: runtimeMessage(err, probe),
          blank: authored.blank ?? null,
          blockId: err.blockId ?? null,
          why: authored.why,
        };
      }
      return {
        ...base,
        ok: false,
        stage: 'run',
        message: runtimeMessage(err, probe),
        detail: err.kind === 'index' ? 'A subscript outside the array is an error here, it does not wrap around.' : null,
        blockId: err.blockId ?? null,
        blank: err.blank ?? null,
        why: `runtime_${err.kind}`,
        probeIndex: k,
      };
    }
  }

  // 4. Compare.
  const mode = gate.compare || 'value';
  for (let k = 0; k < results.length; k++) {
    const got = results[k];
    const ref = reference[k];
    const same = mode === 'prints'
      ? printsEqual(got.prints, ref.prints)
      : valuesEqual(got.value, ref.value, gate.tolerance ?? 1e-9)
        && traceEqual(got.trace, ref.trace, gate.trace || [], gate.tolerance ?? 1e-9);

    if (!same) {
      // 5. Diagnose.
      const diag = diagnose(gate, byId, placements, blanks, got, ref, mode, k, indentOnly);
      return { ...base, ok: false, stage: 'compare', probeIndex: k, trace: got.trace, prints: got.prints, ...diag };
    }
  }

  return { ...base, ok: true, stage: 'solved', message: 'Solved.', trace: results[0].trace, prints: results[0].prints, results };
}

function blockOwningBlank(gate, byId, placements, name) {
  for (const p of placements) {
    const block = byId[p.id];
    if (!block) continue;
    if (block.lines.some((l) => l.text.includes(`⟨?${name}⟩`))) return p.id;
  }
  return null;
}

function runtimeMessage(err, probe) {
  const on = probeLabel(probe);
  if (err.kind === 'cap') {
    return `On ${on}, your algorithm never finished. Something in a loop does not shrink.`;
  }
  return `On ${on}: ${err.message}`;
}

function probeLabel(probe) {
  const parts = Object.entries(probe.env || {})
    .filter(([, v]) => Array.isArray(v) && !isArr2(v))
    .slice(0, 2)
    .map(([k, v]) => `${k} = [${v.map(fmtNum).join(', ')}]`);
  return parts.length ? `the test input ${parts.join(', ')}` : 'the test input';
}

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

function traceEqual(got, ref, names, tol) {
  for (const name of names) {
    if (!(name in ref)) continue;
    if (!(name in got)) return false;
    if (!valuesEqual(got[name], ref[name], tol)) return false;
  }
  return true;
}

function printsEqual(got, ref) {
  if (got.length !== ref.length) return false;
  for (let i = 0; i < got.length; i++) {
    if (!valuesEqual(got[i].values, ref[i].values, 1e-9)) return false;
    if (JSON.stringify(got[i].subs) !== JSON.stringify(ref[i].subs)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Diagnosis
// ---------------------------------------------------------------------------
//
// Three sources compose one message, in this priority:
//   (i)   an authored string for a placed distractor or a matched wrong blank
//   (ii)  a structural pattern in the student's own output
//   (iii) the smallest wrong entry, which discloses exactly one number

// (i) of the three feedback sources: a string written for this exact mistake,
// keyed by a placed distractor or by a blank that agrees with a known wrong
// answer. Shared by the runtime and comparison paths.
function authoredFeedback(gate, placements, blanks, probeIndex) {
  const feedback = gate.feedback || {};
  for (const p of placements) {
    const d = (gate.distractors || []).find((x) => x.id === p.id);
    if (d && feedback[d.why]) return { message: feedback[d.why], why: d.why, blank: null };
  }
  const wrong = matchWrongBlank(gate, blanks, probeIndex);
  if (wrong && feedback[wrong.why]) return { message: feedback[wrong.why], why: wrong.why, blank: wrong.name };
  if (wrong && wrong.note) return { message: wrong.note, why: wrong.why, blank: wrong.name };
  return null;
}

function diagnose(gate, byId, placements, blanks, got, ref, mode, probeIndex, indentOnly) {
  const authored = authoredFeedback(gate, placements, blanks, probeIndex);
  if (authored) {
    return { ok: false, message: authored.message, why: authored.why, blank: authored.blank };
  }

  // (ii) indentation only: the sequence is right, the nesting is not
  if (indentOnly) {
    return {
      ok: false,
      why: 'indent_only',
      message: 'Your lines are in the right order. The question is which of them sit inside which loop.',
      detail: 'A line one level further in runs once per pass of the loop above it.',
    };
  }

  // (ii) structural patterns in the output
  const pattern = mode === 'prints'
    ? classifyPrints(got.prints, ref.prints)
    : classifyValues(got, ref, gate.trace || []);
  if (pattern) {
    return { ok: false, why: pattern.why, message: pattern.message, detail: pattern.detail || null };
  }

  // (iii) one disclosed entry
  return { ok: false, why: 'generic', message: firstDifference(got, ref, gate.trace || []) };
}

function matchWrongBlank(gate, blanks, probeIndex) {
  const sets = gate.wrong_blanks || {};
  const probe = gate.probes[probeIndex] || gate.probes[0];
  for (const [name, alternatives] of Object.entries(sets)) {
    const entered = blanks[name];
    if (!entered) continue;
    for (const alt of alternatives) {
      const text = typeof alt === 'string' ? alt : alt.text;
      const why = typeof alt === 'string' ? `blank_${name}_${slug(text)}` : alt.why;
      const note = typeof alt === 'string' ? null : alt.note;
      if (expressionsAgree(entered, text, gate.blanks[name], probe)) {
        return { name, why, note };
      }
    }
  }
  return null;
}

function slug(s) { return s.replace(/[^a-z0-9]+/gi, '_').toLowerCase(); }

/**
 * Do two blank expressions compute the same thing? Sampled over environments
 * built from the probe, so a wrong answer spelled differently still matches the
 * authored feedback for that mistake.
 */
export function expressionsAgree(a, b, blankSpec, probe) {
  const envs = sampleEnvs(blankSpec, probe);
  let compared = 0;
  for (const env of envs) {
    let va;
    let vb;
    try { va = evalExpression(a, env, { maxSteps: 20000 }); } catch (e) { va = ERR; }
    try { vb = evalExpression(b, env, { maxSteps: 20000 }); } catch (e) { vb = ERR; }
    if (va === ERR && vb === ERR) continue; // both undefined here, no information
    if (va === ERR || vb === ERR) return false;
    if (!valuesEqual(va, vb, 1e-12)) return false;
    compared++;
  }
  return compared > 0;
}

const ERR = Symbol('error');

// Index-like names get small integers; arrays come from the probe. Deterministic
// so a build is reproducible.
function sampleEnvs(blankSpec, probe) {
  const names = (blankSpec && blankSpec.env) || [];
  const arrays = {};
  let n = 4;
  for (const [k, v] of Object.entries(probe.env || {})) {
    if (Array.isArray(v)) { arrays[k] = v; n = Math.min(n, v.length); }
  }
  const out = [];
  const indexNames = names.filter((s) => !(s in arrays) && s !== 'n');
  const combos = [];
  const values = [0, 1, 2];
  const build = (depth, acc) => {
    if (depth === indexNames.length) { combos.push({ ...acc }); return; }
    for (const v of values) build(depth + 1, { ...acc, [indexNames[depth]]: v });
  };
  build(0, {});
  for (const combo of combos.slice(0, 27)) {
    out.push({ ...arrays, n, ...combo });
  }
  return out;
}

function sequenceMatchesSolution(gate, placements) {
  const want = gate.solution.map((s) => s.id).join('|');
  const got = placements.map((p) => p.id).join('|');
  return want === got;
}

function indentsMatchSolution(gate, placements) {
  if (placements.length !== gate.solution.length) return false;
  return gate.solution.every((s, k) => s.indent === placements[k].indent);
}

// ---------------------------------------------------------------------------
// Structural classification of a wrong result
// ---------------------------------------------------------------------------

function classifyValues(got, ref, traceNames) {
  // Prefer a traced table: it says more than a returned array.
  for (const name of traceNames) {
    if (isArr2(ref.trace?.[name]) && isArr2(got.trace?.[name])) {
      const p = classifyTable(got.trace[name], ref.trace[name], name);
      if (p) return p;
    }
  }

  const tuple = Array.isArray(ref.value) && ref.value.__tuple;
  if (tuple) {
    // The table can be right while the wrong slice is returned. That is the
    // row-versus-column mistake.
    const traced = traceNames.find((nm) => isArr2(ref.trace?.[nm]));
    if (traced && valuesEqual(got.trace?.[traced], ref.trace[traced], 1e-9)) {
      return {
        why: 'right_table_wrong_return',
        message: 'The table you built is correct, but the values you pulled out of it aren\u2019t the coefficients.',
        detail: 'Which subscript varies along the entries you picked out?',
      };
    }
  }

  const g = tuple ? got.value[0] : got.value;
  const r = tuple ? ref.value[0] : ref.value;

  if (isArr2(r) && isArr2(g)) return classifyTable(g, r, 'the table');
  if (Array.isArray(r) && Array.isArray(g)) return classifyArray(g, r);
  if (isNum(r) && isNum(g)) return classifyScalar(g, r);
  if (shapeOf(g) !== shapeOf(r)) {
    return {
      why: 'shape',
      message: `Your algorithm produced ${shapeOf(g)} where the answer is ${shapeOf(r)}.`,
    };
  }
  return null;
}

function classifyTable(got, ref, name) {
  if (got.length !== ref.length || (got[0] || []).length !== (ref[0] || []).length) {
    return {
      why: 'shape',
      message: `Your ${name} is ${got.length}×${(got[0] || []).length}; the answer is ${ref.length}×${(ref[0] || []).length}.`,
    };
  }
  const n = ref.length;
  const m = ref[0].length;

  // transpose
  let isTranspose = n === m;
  for (let i = 0; isTranspose && i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (!valuesEqual(got[i][j], ref[j][i], 1e-9)) { isTranspose = false; break; }
    }
  }
  if (isTranspose) {
    return {
      why: 'transpose',
      message: `Your ${name} holds the right numbers with the rows and columns exchanged.`,
      detail: 'Check which subscript your loops drive and which one the recurrence writes.',
    };
  }

  // sign flip, per column, in the pattern (−1)^j
  const flipped = [];
  const matched = [];
  for (let j = 0; j < m; j++) {
    let allFlip = true;
    let allSame = true;
    let any = false;
    for (let i = 0; i < n - j; i++) {
      if (ref[i][j] === 0 && got[i][j] === 0) continue;
      any = true;
      if (!valuesEqual(got[i][j], -ref[i][j], 1e-9)) allFlip = false;
      if (!valuesEqual(got[i][j], ref[i][j], 1e-9)) allSame = false;
    }
    if (!any) { matched.push(j); continue; }
    if (allSame) matched.push(j);
    else if (allFlip) flipped.push(j);
  }
  if (flipped.length && flipped.length + matched.length === m) {
    const alternating = flipped.every((j) => j % 2 === 1) || flipped.every((j) => j % 2 === 0);
    return {
      why: 'sign_by_column',
      message: alternating
        ? `Your ${name} has the right magnitudes throughout, with the signs wrong in the odd-numbered columns and right in the even ones.`
        : `Your ${name} has the right magnitudes, with the signs reversed in column${flipped.length > 1 ? 's' : ''} ${flipped.join(', ')}.`,
      detail: 'A difference is one value minus another, and the order of the two decides the sign.',
    };
  }

  // exactly one bad column
  const bad = [];
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n - j; i++) {
      if (!valuesEqual(got[i][j], ref[i][j], 1e-9)) { bad.push(j); break; }
    }
  }
  if (bad.length === 1) {
    return {
      why: 'one_column',
      message: `Every column of your ${name} is right except column ${bad[0]}.`,
      detail: `Column ${bad[0]} is where differences of order ${bad[0]} live; the columns before it fed into them.`,
    };
  }
  if (bad.length && bad[0] > 0) {
    return {
      why: 'from_column',
      message: `Your ${name} agrees with the answer through column ${bad[0] - 1} and goes wrong from column ${bad[0]} on.`,
      detail: 'The first column that goes wrong is the one to read; later columns inherit its error.',
    };
  }
  return null;
}

function classifyArray(got, ref) {
  if (got.length !== ref.length) {
    return {
      why: 'shape',
      message: `Your answer has ${got.length} entries; the answer has ${ref.length}.`,
    };
  }
  const flip = ref.every((v, i) => valuesEqual(got[i], -v, 1e-9));
  if (flip && ref.some((v) => v !== 0)) {
    return { why: 'sign', message: 'Every entry has the right magnitude and the wrong sign.' };
  }
  const rev = ref.every((v, i) => valuesEqual(got[i], ref[ref.length - 1 - i], 1e-9));
  if (rev && ref.length > 1 && !valuesEqual(got, ref, 1e-9)) {
    return { why: 'reversed', message: 'Your entries are the right values in reverse order.' };
  }
  const bad = ref.map((v, i) => (valuesEqual(got[i], v, 1e-9) ? null : i)).filter((i) => i !== null);
  if (bad.length === 1) {
    return {
      why: 'one_entry',
      message: `All of your entries are right except the one at index ${bad[0]}.`,
    };
  }
  if (bad.length && bad[0] > 0) {
    return {
      why: 'from_entry',
      message: `Your entries are right up to index ${bad[0] - 1} and wrong from index ${bad[0]} on.`,
    };
  }
  return null;
}

function classifyScalar(got, ref) {
  if (valuesEqual(got, -ref, 1e-9) && ref !== 0) {
    return { why: 'sign', message: 'Your answer has the right magnitude and the wrong sign.' };
  }
  if (!Number.isFinite(got)) {
    return { why: 'nonfinite', message: `Your algorithm produced ${got}.` };
  }
  return null;
}

function classifyPrints(got, ref) {
  if (got.length !== ref.length) {
    return {
      why: 'print_count',
      message: `Your version printed ${got.length} entries; the triangle has ${ref.length}.`,
      detail: got.length > ref.length
        ? 'You printed entries that no column ever wrote to.'
        : 'Some entries of the triangle never got printed.',
    };
  }
  const gotSubs = got.map((p) => JSON.stringify(p.subs));
  const refSubs = ref.map((p) => JSON.stringify(p.subs));
  const first = gotSubs.findIndex((s, i) => s !== refSubs[i]);
  if (first >= 0) {
    return {
      why: 'print_order',
      message: `Your version prints the right number of entries but visits them in a different order, starting at print number ${first + 1}.`,
      detail: 'Which subscript does the outer loop drive?',
    };
  }
  return null;
}

// The last resort: disclose exactly one entry, the earliest one that is wrong.
function firstDifference(got, ref, traceNames) {
  for (const name of traceNames) {
    const r = ref.trace?.[name];
    const g = got.trace?.[name];
    if (r === undefined || g === undefined) continue;
    const at = findFirst(g, r, name);
    if (at) return at;
  }
  const tuple = Array.isArray(ref.value) && ref.value.__tuple;
  const r = tuple ? ref.value[0] : ref.value;
  const g = tuple ? got.value[0] : got.value;
  const at = findFirst(g, r, 'the result');
  if (at) return at;
  return 'Not yet. Your algorithm ran, but it did not produce the right values.';
}

function findFirst(got, ref, name) {
  if (isNum(ref) && isNum(got)) {
    if (valuesEqual(got, ref, 1e-9)) return null;
    return `Not yet. ${cap(name)} should be ${fmtNum(ref)}; yours is ${fmtNum(got)}.`;
  }
  if (isArr2(ref) && isArr2(got)) {
    for (let i = 0; i < Math.min(ref.length, got.length); i++) {
      for (let j = 0; j < Math.min(ref[i].length, got[i].length); j++) {
        if (!valuesEqual(got[i][j], ref[i][j], 1e-9)) {
          return `Not yet. ${name}[${i}, ${j}] should be ${fmtNum(ref[i][j])}; yours is ${fmtNum(got[i][j])}.`;
        }
      }
    }
    return null;
  }
  if (Array.isArray(ref) && Array.isArray(got)) {
    for (let i = 0; i < Math.min(ref.length, got.length); i++) {
      if (!valuesEqual(got[i], ref[i], 1e-9)) {
        return `Not yet. Entry ${i} should be ${fmtNum(ref[i])}; yours is ${fmtNum(got[i])}.`;
      }
    }
    return null;
  }
  return null;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---------------------------------------------------------------------------
// Rendering the student's own trace
// ---------------------------------------------------------------------------

/**
 * The failure card shows the student's computed table as a triangle. The
 * reference is never rendered.
 */
export function renderTriangle(table, x) {
  if (!isArr2(table)) return null;
  const n = table.length;
  const rows = [];
  for (let i = 0; i < n; i++) {
    const cells = [];
    for (let j = 0; j < n - i; j++) cells.push(pad(fmtNum(round(table[i][j])), 11));
    rows.push(`${x ? pad(fmtNum(x[i]), 7) : pad(String(i), 7)} │${cells.join('')}`);
  }
  const head = `${pad(x ? 'x_i' : 'row', 7)} │ order 0 and up, left to right`;
  return [head, '─'.repeat(Math.max(head.length, 20)), ...rows].join('\n');
}

function round(v) {
  if (!Number.isFinite(v)) return v;
  return Math.abs(v) < 1e-12 ? 0 : Number(v.toPrecision(6));
}

function pad(s, w) { return String(s).padStart(w); }

export const __test = { classifyTable, classifyArray, sampleEnvs, expressionsAgree };
