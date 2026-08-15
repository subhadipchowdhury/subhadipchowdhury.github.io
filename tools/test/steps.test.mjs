// Tests for the step diagnosis: where an arrangement broke, and where one that
// ran to the end first went wrong.
//
// The properties that matter:
//   - a message names the student's own step and the pass it was on
//   - no message discloses a value from the reference
//   - a mistake nobody wrote a message for still gets located

import { buildReference, verify, referenceProgram, assemble, indexBlocks } from '../../teaching/labs/engine/lab/verify.js';
import { stepText, passPhrase, describeCell, crashReport, divergenceReport } from '../../teaching/labs/engine/lab/steps.js';
import { valuesEqual, run, parseProgram } from '../../teaching/labs/engine/lab/interp.js';
import { DIVDIFF_GATE, CORRECT, withBlank } from './fixtures/divdiff-gate.mjs';

let passed = 0;
const failures = [];
let group = '';

function describe(name, fn) {
  group = name;
  try { fn(); } catch (err) { failures.push({ group, name: '(setup)', err }); }
}
function it(name, fn) {
  try { fn(); passed++; } catch (err) { failures.push({ group, name, err }); }
}
function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg || 'assertion failed'); }
function eq(a, b, msg) {
  const ok = a === b || JSON.stringify(a) === JSON.stringify(b) || valuesEqual(a, b, 1e-12);
  if (!ok) fail(`${msg || 'values differ'}\n    expected ${JSON.stringify(b)}\n    actual   ${JSON.stringify(a)}`);
}
function has(text, needle, msg) {
  if (!String(text).includes(needle)) {
    fail(`${msg || 'missing text'}\n    expected to contain "${needle}"\n    actual   "${text}"`);
  }
}
function hasnt(text, needle, msg) {
  if (String(text).includes(needle)) {
    fail(`${msg || 'unwanted text'}\n    expected NOT to contain "${needle}"\n    actual   "${text}"`);
  }
}

const gate = DIVDIFF_GATE;
const reference = buildReference(gate);
const check = (submission) => verify(gate, submission, reference);
const said = (v) => `${v.message} ${v.detail || ''}`;

// The reference table's own numbers, so a test can assert they are not quoted.
const SECRETS = ['-1.33333', '0.322222', '3.03472'];

describe('naming things the student can see', () => {
  const lines = assemble(gate.solution, indexBlocks(gate));

  it('quotes a step with the blanks as the student filled them', () => {
    const recIndex = lines.findIndex((l) => l.blockId === 'rec');
    eq(stepText(lines, recIndex, { den: 'x[i+j] - x[i]' }),
      'T[i, j] ← (T[i+1, j-1] - T[i, j-1]) / (x[i+j] - x[i])');
  });

  it('brackets a substituted blank, since the blank was its own expression', () => {
    const recIndex = lines.findIndex((l) => l.blockId === 'rec');
    has(stepText(lines, recIndex, { den: 'x[j] - x[i]' }), '/ (x[j] - x[i])',
      'an unbracketed "/ x[j] - x[i]" would read as a different expression');
  });

  it('leaves a bracketed blank alone, and an empty one as a gap', () => {
    const recIndex = lines.findIndex((l) => l.blockId === 'rec');
    has(stepText(lines, recIndex, { den: '(x[i+j] - x[i])' }), '/ (x[i+j] - x[i])');
    has(stepText(lines, recIndex, {}), '/ ___');
  });

  it('names the pass outermost loop first', () => {
    eq(passPhrase([{ name: 'j', value: 2 }, { name: 'i', value: 0 }]), 'with j = 2 and i = 0');
    eq(passPhrase([{ name: 'i', value: 3 }]), 'with i = 3');
    eq(passPhrase([]), null);
  });

  it('names an entry the way the notation writes it', () => {
    eq(describeCell('T', [0, 2]), 'T[0][2]');
    eq(describeCell('c', [3]), 'c[3]');
    eq(describeCell('p', []), 'p');
  });
});

describe('the algorithm stopped', () => {
  // n as the inner bound walks off the bottom of the table. No message is
  // written for it, so the location is the whole diagnosis.
  const v = check(withBlank(CORRECT, 'bound', 'n'));

  it('reports the run stage', () => {
    eq(v.stage, 'run');
    eq(v.why, 'runtime_index');
  });

  it('names the step it stopped at', () => {
    has(v.message, 'T[i, j] ← (T[i+1, j-1] - T[i, j-1]) / (x[i+j] - x[i])');
  });

  it('names the pass it was on', () => {
    has(v.message, 'with j = 1 and i = 3');
  });

  it('says why in the detail, not in the lead', () => {
    has(v.detail, 'outside T');
  });

  it('points the highlight at the step', () => {
    eq(v.blockId, 'rec');
  });

  it('keeps the authored message first when there is one, and adds the location', () => {
    const w = check(withBlank(CORRECT, 'bound', 'n-j'));
    eq(w.why, 'bound_off_by_one');
    has(w.message, 'one row too far');
    has(w.detail, 'with j = 1 and i = 3');
  });

  it('reports the pass a runaway loop was still on', () => {
    // A while loop is the only way to hang this gate, so the report is built
    // directly rather than through a submission.
    const err = { kind: 'cap', line: 0, loops: [{ name: 'j', value: 1 }] };
    const r = crashReport(err, [{ text: 'for j ← 1 to n-1:', blockId: 'loopj' }], {}, 'the test input');
    has(r.message, 'never finished');
    has(r.message, 'with j = 1');
  });
});

describe('the algorithm ran and the numbers are wrong', () => {
  it('locates the first wrong entry and the pass that wrote it', () => {
    // Column 0 filled in after the loops instead of before it: every reachable
    // block is present and in a legal order, and nothing is written for it.
    const placements = CORRECT.placements.map((p) => ({ ...p }));
    const i = placements.findIndex((p) => p.id === 'col0');
    const [col0] = placements.splice(i, 1);
    placements.splice(placements.length - 1, 0, col0);
    const v = check({ placements, blanks: { ...CORRECT.blanks } });

    eq(v.stage, 'compare');
    eq(v.why, 'first_wrong_entry');
    has(v.message, 'T[0][1]');
    has(v.message, 'with j = 1 and i = 0');
    has(v.detail, 'nothing had written to yet');
    eq(v.blockId, 'rec');
  });

  it('reports an entry the algorithm never fills in', () => {
    const v = check(withBlank(CORRECT, 'bound', 'n-j-2'));
    eq(v.why, 'entry_never_written');
    has(v.message, 'never fills in T[2][1]');
  });

  it('discloses no reference value in any of those messages', () => {
    const cases = [
      withBlank(CORRECT, 'bound', 'n'),
      withBlank(CORRECT, 'bound', 'n-j-2'),
      withBlank(CORRECT, 'den', 'x[i+j] - x[j]'),
    ];
    for (const sub of cases) {
      const v = check(sub);
      for (const secret of SECRETS) hasnt(said(v), secret, `verdict ${v.why} quoted a reference value`);
    }
  });

  it('says nothing when the arrangement is right', () => {
    const v = check(CORRECT);
    assert(v.ok, `expected a pass, got: ${v.message}`);
  });
});

describe('a gate whose answer is one number', () => {
  // Horner's sweep, small enough to state here. It writes no entries at all, so
  // the write log has nothing to compare and the read log is the diagnosis.
  const EVAL_GATE = {
    cell_id: 'neweval',
    title: 'Evaluate the polynomial at a point',
    blocks: [
      { id: 'def', lines: [{ text: 'function newton_eval(xn, c, t):', indent: 0 }] },
      { id: 'n', lines: [{ text: 'n ← length(c)', indent: 0 }] },
      { id: 'init', lines: [{ text: 'p ← c[⟨?init⟩]', indent: 0 }] },
      { id: 'loop', lines: [{ text: 'for k ← n-2 down to 0:', indent: 0 }] },
      { id: 'upd', lines: [{ text: 'p ← p * (t - xn[k]) + c[k]', indent: 0 }] },
      { id: 'ret', lines: [{ text: 'return p', indent: 0 }] },
    ],
    solution: [
      { id: 'def', indent: 0 }, { id: 'n', indent: 1 }, { id: 'init', indent: 1 },
      { id: 'loop', indent: 1 }, { id: 'upd', indent: 2 }, { id: 'ret', indent: 1 },
    ],
    blanks: { init: { kind: 'index', answer: 'n-1', env: ['n'], width: 6 } },
    distractors: [],
    probes: [{
      env: { xn: [0, 1, 3, 6], c: [1, 3, -4 / 3, (0.6 + 4 / 3) / 6], t: 2.5 },
      call: 'newton_eval(xn, c, t)',
    }],
    trace: [],
    compare: 'value',
  };
  const ref = buildReference(EVAL_GATE);

  it('names a coefficient the sweep never uses', () => {
    const v = verify(EVAL_GATE, {
      placements: EVAL_GATE.solution.map((s) => ({ ...s })),
      blanks: { init: 'n-2' },
    }, ref);
    eq(v.why, 'input_never_read');
    has(v.message, 'never uses c[3]');
    hasnt(said(v), '3.03', 'the value of the answer must not appear');
  });

  it('still passes the right answer', () => {
    const v = verify(EVAL_GATE, {
      placements: EVAL_GATE.solution.map((s) => ({ ...s })),
      blanks: { init: 'n-1' },
    }, ref);
    assert(v.ok, `expected a pass, got: ${v.message}`);
  });
});

describe('the instrumentation itself', () => {
  it('is off unless asked for, so the graded run pays nothing', () => {
    const program = referenceProgram(gate);
    const plain = run(program, { env: gate.probes[0].env, call: gate.probes[0].call, trace: ['T'] });
    eq(plain.writes.length, 0, 'no writes recorded without log: true');
    const logged = run(program, { env: gate.probes[0].env, call: gate.probes[0].call, trace: ['T'], log: true });
    assert(logged.writes.length > 0, 'writes recorded with log: true');
  });

  it('records the pass each write happened on', () => {
    const program = referenceProgram(gate);
    const r = run(program, { env: gate.probes[0].env, call: gate.probes[0].call, trace: ['T'], log: true });
    const inner = r.writes.filter((w) => w.loops.length === 2);
    assert(inner.length === 6, `expected six writes inside both loops, got ${inner.length}`);
    eq(inner[0].loops.map((f) => `${f.name}=${f.value}`), ['j=1', 'i=0']);
    eq(inner[0].cell, [0, 1]);
  });

  it('leaves the loop stack standing when an error propagates', () => {
    const program = parseProgram([
      { text: 'for j ← 0 to 2:', indent: 0, blockId: 'a' },
      { text: 'x ← y', indent: 1, blockId: 'b' },
    ], {});
    let caught = null;
    try { run(program, { env: {} }); } catch (err) { caught = err; }
    assert(caught, 'expected the undefined name to throw');
    eq(caught.loops, [{ name: 'j', value: 0 }]);
  });

  it('reports a read of an entry nothing has written yet', () => {
    const program = parseProgram([
      { text: 'T ← zeros(2, 2)', indent: 0, blockId: 'a' },
      { text: 'T[0, 0] ← 1', indent: 0, blockId: 'b' },
      { text: 'z ← T[0, 0] + T[1, 1]', indent: 0, blockId: 'c' },
      { text: 'return z', indent: 0, blockId: 'd' },
    ], {});
    const r = run(program, { env: {}, log: true });
    eq(r.value, 1);
    eq(r.unfilled.length, 1, 'only the unwritten entry is reported');
    eq(r.unfilled[0].cell, [1, 1]);
  });

  it('does not flag a read of an input it did not build', () => {
    const program = parseProgram([
      { text: 'z ← x[1]', indent: 0, blockId: 'a' },
      { text: 'return z', indent: 0, blockId: 'b' },
    ], {});
    const r = run(program, { env: { x: [5, 6] }, log: true });
    eq(r.unfilled.length, 0);
    assert(r.readKeys.has('x|1'), 'the read is still logged');
  });
});

describe('degrading rather than failing', () => {
  it('returns null when the two runs cannot be compared', () => {
    const out = divergenceReport({
      gate,
      program: referenceProgram(gate),
      refProgram: referenceProgram(gate),
      probe: gate.probes[0],
      lines: assemble(gate.solution, indexBlocks(gate)),
      blanks: CORRECT.blanks,
    });
    eq(out, null, 'a correct run against itself has no divergence');
  });
});

if (failures.length === 0) {
  print(`\n  ${passed} tests passed.\n`);
} else {
  print(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) {
    print(`  ✗ ${f.group} :: ${f.name}`);
    print(`      ${f.err.message.split('\n').join('\n      ')}`);
    print('');
  }
}
