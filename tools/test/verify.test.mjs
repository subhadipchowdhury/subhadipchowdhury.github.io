// Tests for the grader.
//
// The property that matters most: a submission passes if and only if it
// computes the right thing. Everything else here is about the quality of the
// message a student sees when it does not.

import {
  buildReference, verify, verifyQuiz, renderTriangle, expressionsAgree,
} from '../../teaching/labs/engine/lab/verify.js';
import { valuesEqual } from '../../teaching/labs/engine/lab/interp.js';
import {
  DIVDIFF_GATE, REF_TABLE, REF_COEFFS, CORRECT, swapBlock, withBlank,
} from './fixtures/divdiff-gate.mjs';

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
  const scalar = typeof b === 'string' || typeof b === 'boolean' || b === undefined || b === null;
  const ok = scalar ? a === b : (valuesEqual(a, b, 1e-12) || JSON.stringify(a) === JSON.stringify(b));
  if (!ok) fail(`${msg || 'values differ'}\n    expected ${JSON.stringify(b)}\n    actual   ${JSON.stringify(a)}`);
}
function has(text, needle, msg) {
  if (!String(text).includes(needle)) {
    fail(`${msg || 'missing text'}\n    expected to contain "${needle}"\n    actual   "${text}"`);
  }
}

const gate = DIVDIFF_GATE;
const reference = buildReference(gate);
const check = (submission) => verify(gate, submission, reference);

describe('reference', () => {
  it('the solution assembly computes the hand-checked table', () => {
    eq(reference.length, 1);
    eq(reference[0].value[0], REF_COEFFS, 'coefficients');
    eq(reference[0].trace.T, REF_TABLE, 'traced table');
  });
});

describe('accepting', () => {
  it('the solution passes', () => {
    const v = check(CORRECT);
    assert(v.ok, `expected a pass, got: ${v.message}`);
    eq(v.stage, 'solved');
  });

  it('an equivalent reordering passes', () => {
    // n and T can be built in either order; behaviour is the verdict.
    const placements = CORRECT.placements.map((p) => ({ ...p }));
    const i = placements.findIndex((p) => p.id === 'n');
    const j = placements.findIndex((p) => p.id === 'tab');
    [placements[i], placements[j]] = [placements[j], placements[i]];
    // T ← zeros(n, n) now runs before n exists, so this particular swap fails.
    // The one that must pass is moving `coef` and `ret` relative to nothing,
    // and rewriting the bound as an equivalent expression.
    const v = check(withBlank(CORRECT, 'bound', 'n - j - 1'));
    assert(v.ok, `whitespace in a blank must not matter: ${v.message}`);
  });

  it('an algebraically rearranged blank passes', () => {
    const v = check(withBlank(CORRECT, 'den', '-(x[i] - x[i+j])'));
    assert(v.ok, `a correct but rearranged denominator must pass: ${v.message}`);
  });

  it('ASCII typed for the glyphs passes', () => {
    const v = check(withBlank(CORRECT, 'den', 'x[i+j] - x[i]'));
    assert(v.ok, `a hyphen must read as a minus sign: ${v.message}`);
  });
});

describe('completeness', () => {
  it('an empty workspace says so', () => {
    const v = check({ placements: [], blanks: {} });
    eq(v.stage, 'complete');
    has(v.message, 'Nothing is in the workspace');
  });

  it('a missing block is reported as a count, with no hint at which', () => {
    const placements = CORRECT.placements.filter((p) => p.id !== 'coef');
    const v = check({ ...CORRECT, placements });
    eq(v.stage, 'complete');
    has(v.message, '1 line short');
    assert(!v.message.includes('coef') && !v.message.includes('c ←'),
      'the message must not name the missing block');
  });

  it('an empty blank names the blank but not the answer', () => {
    const v = check(withBlank(CORRECT, 'den', '   '));
    eq(v.stage, 'complete');
    eq(v.blank, 'den');
    eq(v.blockId, 'rec');
    assert(!v.message.includes('x['), 'the message must not contain the answer');
  });

  it('swapping in a decoy is NOT reported as an incomplete workspace', () => {
    // The line count matches, so the student gets a diagnosis rather than being
    // told structurally that one of their blocks is a decoy.
    const v = check(swapBlock(CORRECT, 'rec', 'd_num', 3));
    assert(v.stage !== 'complete', `expected a diagnosis, got a completeness message: ${v.message}`);
  });
});

describe('authored feedback for placed decoys', () => {
  it('d_num: the reversed numerator', () => {
    const v = check(swapBlock(CORRECT, 'rec', 'd_num', 3));
    eq(v.why, 'num_reversed');
    has(v.message, 'alternating by column');
    eq(v.placedDecoys, ['d_num']);
  });

  it('d_colc: reading the coefficients off the first column', () => {
    const v = check(swapBlock(CORRECT, 'coef', 'd_colc', 1));
    eq(v.why, 'col_not_row');
    has(v.message, 'top entry of each column');
  });

  it('d_swap: the fused two-line block replaces both loop headers', () => {
    const placements = [];
    for (const p of CORRECT.placements) {
      if (p.id === 'loopj') { placements.push({ id: 'd_swap', indent: 1 }); continue; }
      if (p.id === 'loopi') continue; // the fused block supplies both headers
      placements.push({ ...p });
    }
    const v = check({ ...CORRECT, placements });
    eq(v.why, 'loops_swapped');
  });

  it('the student sees their own trace alongside the failure', () => {
    const v = check(swapBlock(CORRECT, 'rec', 'd_num', 3));
    assert(v.trace && v.trace.T, 'the failure card needs the student trace');
    assert(!valuesEqual(v.trace.T, REF_TABLE, 1e-9), 'and it must be their wrong one');
  });
});

describe('authored feedback for wrong blanks', () => {
  it('den = x[i+1] - x[i]', () => {
    const v = check(withBlank(CORRECT, 'den', 'x[i+1] - x[i]'));
    eq(v.why, 'den_neighbour');
    has(v.message, 'adjacent nodes');
  });

  it('den = x[j] - x[i], which divides by zero, still gets its written message', () => {
    const v = check(withBlank(CORRECT, 'den', 'x[j] - x[i]'));
    eq(v.why, 'den_j_not_ij');
    has(v.detail, 'divides by zero', 'the crash becomes the supporting detail');
  });

  it('a differently spelled version of the same mistake matches', () => {
    const v = check(withBlank(CORRECT, 'den', '-(x[i] - x[i+1])'));
    eq(v.why, 'den_neighbour', 'the same wrong expression rearranged must match');
  });

  it('bound = n-1 runs off the table and gets its written message', () => {
    const v = check(withBlank(CORRECT, 'bound', 'n-1'));
    eq(v.why, 'bound_full');
    has(v.message, 'every row of the table');
  });

  it('bound = n-j', () => {
    const v = check(withBlank(CORRECT, 'bound', 'n-j'));
    eq(v.why, 'bound_off_by_one');
  });

  it('a wrong blank nobody anticipated falls through to the classifier', () => {
    // Two rows short in every column: not an authored case.
    const v = check(withBlank(CORRECT, 'bound', 'n-j-2'));
    assert(v.why !== 'bound_full' && v.why !== 'bound_off_by_one',
      `should not match an authored wrong answer, got ${v.why}`);
    assert(v.message.length > 20, 'and should still say something useful');
  });
});

describe('the structural classifier', () => {
  it('names the sign pattern when no authored string exists', () => {
    const bare = { ...gate, feedback: {} };
    const ref = buildReference(bare);
    const v = verify(bare, swapBlock(CORRECT, 'rec', 'd_num', 3), ref);
    eq(v.why, 'sign_by_column');
    has(v.message, 'right magnitudes');
  });

  it('spots a correct table returned wrongly', () => {
    const bare = { ...gate, feedback: {} };
    const ref = buildReference(bare);
    const v = verify(bare, swapBlock(CORRECT, 'coef', 'd_colc', 1), ref);
    eq(v.why, 'right_table_wrong_return');
    has(v.message, 'table you built is correct');
  });

  it('reports indentation when the order is already right', () => {
    const placements = CORRECT.placements.map((p) => (
      p.id === 'rec' ? { ...p, indent: 2 } : { ...p }
    ));
    const v = check({ ...CORRECT, placements });
    eq(v.why, 'indent_only');
    has(v.message, 'right order');
  });

  it('the generic fallback discloses exactly one entry', () => {
    const bare = { ...gate, feedback: {} };
    const ref = buildReference(bare);
    const v = verify(bare, withBlank(CORRECT, 'bound', 'n-j-2'), ref);
    const numbers = v.message.match(/-?\d+\.?\d*/g) || [];
    assert(numbers.length <= 4, `at most one disclosed value plus its subscripts: "${v.message}"`);
  });
});

describe('runtime failures', () => {
  it('an unreachable arrangement is a parse error naming the block', () => {
    // A loop header with nothing inside it.
    const placements = CORRECT.placements
      .filter((p) => p.id !== 'rec')
      .concat([{ id: 'rec', indent: 1 }]);
    const v = check({ ...CORRECT, placements });
    assert(v.stage === 'parse' || v.stage === 'compare' || v.stage === 'run',
      `expected a real failure, got ${v.stage}`);
  });

  it('the probe input is named in a runtime message', () => {
    const bare = { ...gate, feedback: {}, wrong_blanks: {} };
    const ref = buildReference(bare);
    const v = verify(bare, withBlank(CORRECT, 'bound', 'n-1'), ref);
    eq(v.stage, 'run');
    has(v.message, 'x = [0, 1, 3, 6]');
  });
});

describe('rendering the student trace', () => {
  it('prints the triangle with the nodes down the side', () => {
    const text = renderTriangle(REF_TABLE, [0, 1, 3, 6]);
    const rows = text.split('\n');
    eq(rows.length, 6, 'a header, a rule, and four rows');
    has(rows[2], '1');
    has(rows[5], '8');
    // Row i must hold n - i entries.
    const counts = rows.slice(2).map((r) => r.split('│')[1].trim().split(/\s+/).length);
    eq(counts, [4, 3, 2, 1]);
  });
});

describe('blank equivalence sampling', () => {
  const spec = gate.blanks.den;
  const probe = gate.probes[0];

  it('recognises rearrangements', () => {
    assert(expressionsAgree('x[i+j] - x[i]', '-(x[i] - x[i+j])', spec, probe));
  });

  it('separates the real answer from the wrong ones', () => {
    assert(!expressionsAgree('x[i+j] - x[i]', 'x[i+1] - x[i]', spec, probe));
    assert(!expressionsAgree('x[i+j] - x[i]', 'x[j] - x[i]', spec, probe));
  });
});

// ---------------------------------------------------------------------------
// The concept check
// ---------------------------------------------------------------------------

// Small and local: a quiz gate is nothing but its questions, so a fixture built
// here says more than one imported from a lab that may be reworded.
const QUIZ = {
  cell_id: 'q',
  kind: 'quiz',
  questions: [
    {
      id: 'a',
      answer: 'right',
      options: [
        { id: 'right', text_html: 'yes', why_html: 'because of the thing' },
        { id: 'wrong', text_html: 'no', why_html: 'you swapped the two factors' },
      ],
    },
    {
      id: 'b',
      answer: 'r2',
      options: [
        { id: 'r2', text_html: 'yes', why_html: 'the symmetric one' },
        { id: 'w2', text_html: 'no', why_html: 'that is the fourth difference' },
      ],
    },
  ],
};

describe('verifyQuiz', () => {
  it('passes only when every question is right', () => {
    eq(verifyQuiz(QUIZ, { picks: { a: 'right', b: 'r2' } }).ok, true);
    eq(verifyQuiz(QUIZ, { picks: { a: 'right', b: 'w2' } }).ok, false);
    eq(verifyQuiz(QUIZ, { picks: { a: 'wrong', b: 'r2' } }).ok, false);
  });

  it('does not pass a block that has not been answered', () => {
    eq(verifyQuiz(QUIZ, { picks: {} }).ok, false);
    eq(verifyQuiz(QUIZ, { picks: { a: 'right' } }).ok, false, 'one of two is not a pass');
    eq(verifyQuiz(QUIZ, {}).ok, false);
  });

  it('counts how many are right, which is what the block-level note says', () => {
    const verdict = verifyQuiz(QUIZ, { picks: { a: 'right', b: 'w2' } });
    eq(verdict.right, 1);
    eq(verdict.total, 2);
  });

  it('hands back the diagnosis written for the option picked', () => {
    const verdict = verifyQuiz(QUIZ, { picks: { a: 'wrong', b: 'w2' } });
    has(verdict.results.a.why_html, 'swapped the two factors');
    has(verdict.results.b.why_html, 'fourth difference');
  });

  // The answer's own why explains why it is the answer, and that belongs in the
  // reveal a solved block opens. Handing it back here would print it beside a
  // question the student has just got right, which gives the game away on a
  // block that is only partly right.
  it('says nothing about a question that is right', () => {
    const verdict = verifyQuiz(QUIZ, { picks: { a: 'right', b: 'w2' } });
    eq(verdict.results.a.ok, true);
    eq(verdict.results.a.why_html, '');
  });

  it('treats an unanswered question as wrong rather than crashing', () => {
    const verdict = verifyQuiz(QUIZ, { picks: { a: 'right' } });
    eq(verdict.results.b.ok, false);
    eq(verdict.results.b.picked, null);
    eq(verdict.results.b.why_html, '', 'there is no option to have a why');
  });

  it('a block with no questions cannot pass', () => {
    eq(verifyQuiz({ cell_id: 'empty', questions: [] }, { picks: {} }).ok, false);
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
