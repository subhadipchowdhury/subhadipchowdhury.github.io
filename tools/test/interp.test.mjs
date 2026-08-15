// Tests for the pseudocode interpreter.
//
// Run with:  tools/test/run.sh
//
// The interpreter is the grader, so these tests carry more weight than usual.
// Three groups: the notation behaves as section 1 of the design says; the three
// M1 reference algorithms compute the right numbers; every authored distractor
// and wrong blank is distinguishable from the reference on its probe, which is
// the property the build-time validator depends on.

import {
  parseProgram, run, evalExpression, linesFromSource, valuesEqual,
  ParseError, RuntimeError,
} from '../../teaching/labs/engine/lab/interp.js';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

let passed = 0;
const failures = [];
let group = '';

function describe(name, fn) {
  group = name;
  // Setup at describe level can throw too; that is a failure, not a crash.
  try { fn(); } catch (err) { failures.push({ group, name: '(setup)', err }); }
}

function it(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push({ group, name, err });
  }
}

function fail(msg) { throw new Error(msg); }

function assert(cond, msg) { if (!cond) fail(msg || 'assertion failed'); }

function eq(actual, expected, msg) {
  const scalar = typeof expected === 'string' || typeof expected === 'boolean'
    || expected === undefined || expected === null;
  const ok = scalar ? actual === expected
    : (valuesEqual(actual, expected, 1e-12) || JSON.stringify(actual) === JSON.stringify(expected));
  if (!ok) {
    fail(`${msg || 'values differ'}\n    expected ${show(expected)}\n    actual   ${show(actual)}`);
  }
}

function ne(actual, expected, msg) {
  if (valuesEqual(actual, expected, 1e-9)) {
    fail(`${msg || 'values should differ but are equal'}: ${show(actual)}`);
  }
}

function show(v) {
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(6);
  return String(v);
}

function throws(fn, check, msg) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) fail(`${msg || 'expected a throw'} but nothing was thrown`);
  if (typeof check === 'string' && !err.message.includes(check)) {
    fail(`${msg || 'wrong error'}\n    expected message containing "${check}"\n    actual   "${err.message}"`);
  }
  if (typeof check === 'function' && !check(err)) {
    fail(`${msg || 'wrong error'}: ${err.name}: ${err.message}`);
  }
  return err;
}

// A wrong assembly is caught if it either computes something else or raises.
// Both are acceptable outcomes; silently matching the reference is not.
function caught(fn, reference, msg) {
  let value;
  try {
    value = fn();
  } catch (err) {
    if (err instanceof RuntimeError) return err;
    throw err;
  }
  ne(value, reference, msg);
  return null;
}

// Convenience: parse indented pseudocode text and call one function in it.
function exec(source, { blanks = {}, env = {}, call = null, trace = [] } = {}) {
  const program = parseProgram(linesFromSource(source), blanks);
  return run(program, { env, call, trace, maxSteps: 200000 });
}

// ---------------------------------------------------------------------------
// Notation
// ---------------------------------------------------------------------------

describe('expressions', () => {
  it('arithmetic and precedence', () => {
    eq(evalExpression('2 + 3 · 4'), 14);
    eq(evalExpression('(2 + 3) · 4'), 20);
    eq(evalExpression('2 ^ 3 ^ 2'), 512, 'power is right-associative');
    eq(evalExpression('−3 ^ 2'), -9, 'unary minus binds looser than power');
    eq(evalExpression('7 / 2'), 3.5);
    eq(evalExpression('1 − 2 − 3'), -4, 'subtraction is left-associative');
  });

  it('accepts ASCII for the typed glyphs', () => {
    eq(evalExpression('2 * 3'), 6);
    eq(evalExpression('2 - 3'), -1);
    eq(evalExpression('sqrt(16)'), 4);
    eq(evalExpression('pi > 3'), true);
  });

  it('comparisons and logic', () => {
    eq(evalExpression('3 = 3'), true);
    eq(evalExpression('3 ≠ 3'), false);
    eq(evalExpression('3 <= 3'), true);
    eq(evalExpression('1 < 2 and 2 < 3'), true);
    eq(evalExpression('not (1 < 2)'), false);
  });

  it('library functions', () => {
    eq(evalExpression('abs(−3)'), 3);
    eq(evalExpression('max(2, 9)'), 9);
    eq(evalExpression('min([4, 1, 7])'), 1);
    eq(evalExpression('sum([1, 2, 3])'), 6);
    eq(evalExpression('length([1, 2, 3])'), 3);
    eq(evalExpression('cos(0)'), 1);
  });

  it('π is a value, not a name that can be shadowed by accident', () => {
    eq(evalExpression('π'), Math.PI);
    eq(evalExpression('cos(π)'), -1);
  });
});

describe('indexing', () => {
  const env = { x: [10, 20, 30, 40], T: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] };

  it('reads points and inclusive ranges', () => {
    eq(evalExpression('x[0]', env), 10);
    eq(evalExpression('x[3]', env), 40);
    eq(evalExpression('x[1..2]', env), [20, 30], 'a..b includes b');
    eq(evalExpression('T[1, 2]', env), 6);
  });

  it('distinguishes a row from a column', () => {
    eq(evalExpression('T[0, 0..2]', env), [1, 2, 3], 'row 0');
    eq(evalExpression('T[0..2, 0]', env), [1, 4, 7], 'column 0');
  });

  it('an empty range is empty, not an error', () => {
    eq(evalExpression('x[2..1]', env), []);
  });

  it('rejects negative and out-of-range subscripts', () => {
    throws(() => evalExpression('x[−1]', env), 'never go negative',
      'negative index must raise, since Python would silently wrap');
    throws(() => evalExpression('x[4]', env), 'outside x');
    throws(() => evalExpression('T[0, 5]', env), 'outside T');
  });

  it('reports the axis correctly', () => {
    const err = throws(() => evalExpression('T[9, 0]', env), 'row 9');
    eq(err.kind, 'index');
  });
});

describe('statements', () => {
  it('assigns, loops inclusively, and returns', () => {
    const r = exec(`
function total(n):
    s ← 0
    for i ← 1 to n:
        s ← s + i
    return s
`, { call: 'total(4)' });
    eq(r.value, 10, '1 to 4 inclusive');
  });

  it('a for loop with from > to runs zero times', () => {
    const r = exec(`
function f():
    s ← 0
    for i ← 1 to 0:
        s ← s + 1
    return s
`, { call: 'f()' });
    eq(r.value, 0);
  });

  it('counts down', () => {
    const r = exec(`
function f():
    s ← []
    s ← zeros(3)
    k ← 0
    for i ← 2 down to 0:
        s[k] ← i
        k ← k + 1
    return s
`, { call: 'f()' });
    eq(r.value, [2, 1, 0]);
  });

  it('unpacks a two-value return', () => {
    const r = exec(`
function two():
    return 1, 2

function use():
    a, b ← two()
    return a · 10 + b
`, { call: 'use()' });
    eq(r.value, 12);
  });

  it('assigns into a row and a column', () => {
    const r = exec(`
function f():
    T ← zeros(2, 3)
    T[0, 0..2] ← [1, 2, 3]
    T[0..1, 0] ← [7, 8]
    return T
`, { call: 'f()' });
    eq(r.value, [[7, 2, 3], [8, 0, 0]]);
  });

  it('branches', () => {
    const src = `
function sign(x):
    if x > 0:
        return 1
    else if x < 0:
        return −1
    else:
        return 0
`;
    eq(exec(src, { call: 'sign(5)' }).value, 1);
    eq(exec(src, { call: 'sign(−5)' }).value, -1);
    eq(exec(src, { call: 'sign(0)' }).value, 0);
  });

  it('runs a while loop', () => {
    const r = exec(`
function f():
    n ← 1
    while n < 100:
        n ← n · 2
    return n
`, { call: 'f()' });
    eq(r.value, 128);
  });

  it('records a print trace with the subscripts visited', () => {
    const r = exec(`
function f(T):
    for i ← 0 to 1:
        for j ← 0 to 1 − i:
            print T[i, j]
`, { env: { T: [[1, 2], [3, 4]] }, call: 'f(T)' });
    eq(r.prints.map((p) => p.values[0]), [1, 2, 3]);
    eq(r.prints.map((p) => p.subs[0]), [[0, 0], [0, 1], [1, 0]]);
  });

  it('solves a linear system', () => {
    const r = exec(`
function f(A, b):
    return solve(A, b)
`, { env: { A: [[2, 1], [1, 3]], b: [5, 10] }, call: 'f(A, b)' });
    eq(r.value, [1, 3]);
  });
});

describe('errors students will actually hit', () => {
  it('an unterminated loop hits the instruction cap', () => {
    const err = throws(() => exec(`
function f():
    n ← 1
    while n > 0:
        n ← n + 1
    return n
`, { call: 'f()' }), 'never shrinks');
    eq(err.kind, 'cap');
  });

  it('division by zero is an error, not infinity', () => {
    const err = throws(() => evalExpression('1 / 0'), 'divides by zero');
    eq(err.kind, 'divzero');
  });

  it('an empty blank is reported as empty, not as a syntax error', () => {
    const err = throws(() => exec(`
function f():
    return ⟨?gap⟩
`, { blanks: {}, call: 'f()' }), 'still empty');
    eq(err.blank, 'gap');
  });

  it('a malformed blank names the blank', () => {
    const err = throws(() => exec(`
function f():
    return ⟨?gap⟩
`, { blanks: { gap: '2 +' }, call: 'f()' }), 'cannot be read as an expression');
    eq(err.blank, 'gap');
  });

  it('a body-less header is caught at parse time', () => {
    throws(() => exec(`
function f():
    for i ← 0 to 3:
    return 1
`), 'at least one line must sit one level further in');
  });

  it('over-indentation is caught at parse time', () => {
    throws(() => exec(`
function f():
        return 1
`), 'two or more levels');
  });

  it('an else with no if is caught', () => {
    throws(() => exec(`
function f():
    else:
        return 1
`), 'has no "if" above it');
  });

  it('= is not assignment', () => {
    throws(() => exec(`
function f():
    n = 3
    return n
`), 'an arrow');
  });

  it('using a name before it has a value', () => {
    const err = throws(() => exec(`
function f():
    return q + 1
`, { call: 'f()' }), 'has no value at this point');
    eq(err.kind, 'name');
  });

  it('one subscript on a table', () => {
    throws(() => evalExpression('T[1]', { T: [[1, 2], [3, 4]] }), 'needs a row and a column');
  });
});

// ---------------------------------------------------------------------------
// The M1 reference algorithms
// ---------------------------------------------------------------------------

const DIVDIFF = `
function divided_differences(x, y):
    n ← length(x)
    T ← zeros(n, n)
    T[0..n−1, 0] ← y
    for j ← 1 to n−1:
        for i ← 0 to ⟨?bound⟩:
            T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / ⟨?den⟩
    c ← T[0, 0..n−1]
    return c, T
`;

const DIVDIFF_BLANKS = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };

const NEWTON_EVAL = `
function newton_eval(xn, c, t):
    n ← length(c)
    p ← c[⟨?init⟩]
    for k ← n−2 down to 0:
        p ← p · (t − xn[k]) + c[k]
    return p
`;

const PROBE = { x: [0, 1, 3, 6], y: [1, 4, 2, 8] };

// The table, computed by hand from the definition, not from this interpreter.
const REF_TABLE = [
  [1, 3, -4 / 3, (0.6 + 4 / 3) / 6],
  [4, -1, 0.6, 0],
  [2, 2, 0, 0],
  [8, 0, 0, 0],
];
const REF_COEFFS = [1, 3, -4 / 3, (0.6 + 4 / 3) / 6];

describe('divided_differences', () => {
  it('builds the reference table', () => {
    const r = exec(DIVDIFF, {
      blanks: DIVDIFF_BLANKS, env: PROBE, call: 'divided_differences(x, y)', trace: ['T'],
    });
    eq(r.value[0], REF_COEFFS, 'coefficients');
    eq(r.value[1], REF_TABLE, 'full table');
    eq(r.trace.T, REF_TABLE, 'traced T matches the returned table');
  });

  it('the coefficients are the top row, and the top row is not the first column', () => {
    eq(REF_COEFFS[1], 3);
    ne(REF_TABLE.map((row) => row[0]), REF_COEFFS,
      'the probe must separate the row reading from the column reading');
  });

  it('a two-point table is the plain difference quotient', () => {
    const r = exec(DIVDIFF, {
      blanks: DIVDIFF_BLANKS, env: { x: [2, 5], y: [7, 13] }, call: 'divided_differences(x, y)',
    });
    eq(r.value[0], [7, 2]);
  });
});

describe('divided_differences distractors are probe-distinguishable', () => {
  const reference = exec(DIVDIFF, {
    blanks: DIVDIFF_BLANKS, env: PROBE, call: 'divided_differences(x, y)',
  }).value;

  const variant = (source, blanks) => exec(source, {
    blanks: { ...DIVDIFF_BLANKS, ...blanks }, env: PROBE, call: 'divided_differences(x, y)',
  }).value;

  it('d_num: reversed numerator', () => {
    const got = variant(DIVDIFF.replace(
      'T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / ⟨?den⟩',
      'T[i, j] ← (T[i, j−1] − T[i+1, j−1]) / ⟨?den⟩',
    ));
    ne(got[0], REF_COEFFS);
    // The design's feedback string claims sign alternation by column; check it,
    // because the message is only honest if the arithmetic backs it.
    const table = got[1];
    for (let j = 1; j < 4; j++) {
      for (let i = 0; i < 4 - j; i++) {
        eq(table[i][j], Math.pow(-1, j) * REF_TABLE[i][j],
          `column ${j} should be (−1)^${j} times the reference`);
      }
    }
  });

  it('d_colc: coefficients read off the first column', () => {
    const got = variant(DIVDIFF.replace('c ← T[0, 0..n−1]', 'c ← T[0..n−1, 0]'));
    ne(got[0], REF_COEFFS);
    eq(got[0], [1, 4, 2, 8], 'reading the column gives the y-values back');
  });

  it('d_swap: the two loops nested the other way', () => {
    // The fused distractor swaps both headers; with j outer replaced by i, the
    // entries T[i+1, j-1] are read before they are written.
    caught(() => variant(DIVDIFF
      .replace('for j ← 1 to n−1:', 'for i ← 0 to n−1:')
      .replace('for i ← 0 to ⟨?bound⟩:', 'for j ← 1 to n−i−1:'))[0], REF_COEFFS);
  });

  it('wrong blank den = x[j] − x[i]', () => {
    // At i = j the spread collapses to zero, so this one is caught by the
    // division rather than by a wrong number. Either way it cannot pass.
    const err = caught(() => variant(DIVDIFF, { den: 'x[j] − x[i]' })[0], REF_COEFFS);
    if (err) eq(err.kind, 'divzero');
  });

  it('wrong blank den = x[i+1] − x[i]', () => {
    caught(() => variant(DIVDIFF, { den: 'x[i+1] − x[i]' })[0], REF_COEFFS);
  });

  it('wrong blank bound = n−1 runs off the table', () => {
    throws(() => variant(DIVDIFF, { bound: 'n−1' }), (e) => e.kind === 'index',
      'the wrong bound should read past the last row');
  });

  it('wrong blank bound = n−j leaves the last column wrong', () => {
    caught(() => variant(DIVDIFF, { bound: 'n−j' })[0], REF_COEFFS);
  });

  it('an algebraically equivalent denominator still passes', () => {
    eq(variant(DIVDIFF, { den: '−(x[i] − x[i+j])' })[0], REF_COEFFS,
      'semantic checking must accept a rearranged but correct blank');
    eq(variant(DIVDIFF, { den: '(x[i+j]) − (x[i])' })[0], REF_COEFFS);
  });

  it('a reordering that computes the same thing passes', () => {
    // n and T can be created in either order; behaviour is what is graded.
    const reordered = `
function divided_differences(x, y):
    T ← zeros(length(x), length(x))
    n ← length(x)
    T[0..n−1, 0] ← y
    for j ← 1 to n−1:
        for i ← 0 to ⟨?bound⟩:
            T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / ⟨?den⟩
    c ← T[0, 0..n−1]
    return c, T
`;
    eq(variant(reordered)[0], REF_COEFFS);
  });
});

describe('newton_eval', () => {
  const withCoeffs = { xn: PROBE.x, c: REF_COEFFS };

  const at = (t, blanks = {}, source = NEWTON_EVAL) => exec(source, {
    blanks: { init: 'n−1', ...blanks }, env: { ...withCoeffs, t }, call: 'newton_eval(xn, c, t)',
  }).value;

  it('reproduces the data at the nodes', () => {
    PROBE.x.forEach((node, k) => {
      eq(at(node), PROBE.y[k], `p(x[${k}]) must equal y[${k}]`);
    });
  });

  it('agrees with the expanded Newton form off the nodes', () => {
    for (const t of [0.5, 2.0, 5.0, -1.25]) {
      const c = REF_COEFFS;
      const expected = c[0]
        + c[1] * (t - 0)
        + c[2] * (t - 0) * (t - 1)
        + c[3] * (t - 0) * (t - 1) * (t - 3);
      eq(at(t), expected, `p(${t})`);
    }
  });

  it('d_fwd: a forward sweep is wrong', () => {
    const fwd = NEWTON_EVAL.replace('for k ← n−2 down to 0:', 'for k ← 1 to n−1:');
    ne(at(0.5, {}, fwd), at(0.5));
  });

  it('d_node: shifting by coefficients instead of nodes is wrong', () => {
    const bad = NEWTON_EVAL.replace('p ← p · (t − xn[k]) + c[k]', 'p ← p · (t − c[k]) + c[k]');
    ne(at(0.5, {}, bad), at(0.5));
  });

  it('wrong blank init = 0 is wrong', () => {
    ne(at(0.5, { init: '0' }), at(0.5));
  });

  it('wrong blank init = n runs off the array with a teaching message', () => {
    const err = throws(() => at(0.5, { init: 'n' }), 'outside c');
    eq(err.kind, 'index');
  });

  it('the probe set avoids the points where the forward sweep coincides', () => {
    // The forward-sweep distractor is a different cubic, so it crosses the
    // correct one somewhere. A single probe can land on a crossing; this checks
    // that crossings exist and that none of the three chosen probes is near one.
    const fwd = NEWTON_EVAL.replace('for k ← n−2 down to 0:', 'for k ← 1 to n−1:');
    const diff = (t) => at(t, {}, fwd) - at(t);

    let crossings = 0;
    let prev = diff(-2);
    for (let t = -1.9; t <= 8; t += 0.1) {
      const cur = diff(t);
      if (prev === 0 || (prev < 0) !== (cur < 0)) crossings++;
      prev = cur;
    }
    assert(crossings > 0, 'the two cubics have to cross for this test to mean anything');

    for (const t of [0.5, 2.0, 5.0]) {
      assert(Math.abs(diff(t)) > 1e-3,
        `probe t = ${t} sits too close to a crossing (gap ${diff(t)})`);
    }
  });
});

describe('print_dd_table', () => {
  const PRINTER = `
function print_dd_table(x, T):
    n ← length(x)
    for i ← 0 to n−1:
        for j ← 0 to ⟨?rowlen⟩:
            print T[i, j]
`;

  const visits = (blanks, source = PRINTER) => exec(source, {
    blanks, env: { x: PROBE.x, T: REF_TABLE }, call: 'print_dd_table(x, T)',
  }).prints.map((p) => p.subs[0].join(','));

  const reference = visits({ rowlen: 'n−i−1' });

  it('visits the triangle, row i having n−i entries', () => {
    eq(reference.length, 10, '4 + 3 + 2 + 1');
    eq(reference[0], '0,0');
    eq(reference[reference.length - 1], '3,0');
  });

  it('wrong blank n−1 prints the whole square', () => {
    const got = visits({ rowlen: 'n−1' });
    ne(got.length, reference.length);
    eq(got.length, 16);
  });

  it('wrong blank n−j−1 cannot even be evaluated: j is the loop variable', () => {
    throws(() => visits({ rowlen: 'n−j−1' }), 'has no value at this point');
  });

  it('d_swap: the transposed nest prints a different set of entries', () => {
    const swapped = PRINTER
      .replace('for i ← 0 to n−1:', 'for j ← 0 to n−1:')
      .replace('for j ← 0 to ⟨?rowlen⟩:', 'for i ← 0 to n−j−1:');
    const got = visits({ rowlen: 'n−i−1' }, swapped);
    ne(got.join('|'), reference.join('|'));
  });
});

// The two algorithms of lab1-runge, in the pseudocode that lab ships. The
// distractor and wrong-blank cases below are the mathematical reasons the
// build-time validator can separate them; the validator checks the separation
// itself, these check the tell each feedback message names.
describe('chebyshev_nodes', () => {
  const CHEB = `
function chebyshev_nodes(a, b, n):
    x ← zeros(n+1)
    for k ← 0 to n:
        θ ← ((2·k + 1) / ⟨?frac⟩) · π
        u ← cos(θ)
        x[k] ← ⟨?map⟩
    return x
`;
  const BLANKS = { frac: '2·(n+1)', map: '(a+b)/2 + ((b−a)/2)·u' };

  const nodes = (a, b, n, blanks = {}, source = CHEB) => exec(source, {
    blanks: { ...BLANKS, ...blanks }, env: { a, b, n }, call: 'chebyshev_nodes(a, b, n)',
  }).value;

  it('first-kind nodes stay strictly inside [−1, 1]', () => {
    const x = nodes(-1, 1, 3);
    eq(x.length, 4);
    x.forEach((v) => assert(Math.abs(v) < 1, `node ${v} must be interior`));
  });

  it('matches the closed form', () => {
    const n = 4;
    const x = nodes(-1, 1, n);
    for (let k = 0; k <= n; k++) {
      eq(x[k], Math.cos(((2 * k + 1) / (2 * (n + 1))) * Math.PI), `node ${k}`);
    }
  });

  it('rescales into [a, b]', () => {
    const x = nodes(0, 4, 3);
    x.forEach((v) => assert(v > 0 && v < 4, `node ${v} must land inside [0, 4]`));
  });

  it('comes out symmetric about the midpoint of the interval', () => {
    const x = nodes(0, 4, 4);
    x.forEach((v, k) => eq(v + x[x.length - 1 - k], 4, `the pair at ${k}`));
  });

  it('d_second: the second-kind angle lands a node on each endpoint', () => {
    const second = CHEB.replace('θ ← ((2·k + 1) / ⟨?frac⟩) · π', 'θ ← (k / n) · π');
    const x = nodes(0, 4, 3, {}, second);
    assert(x.some((v) => Math.abs(v - 4) < 1e-12) && x.some((v) => Math.abs(v) < 1e-12),
      'projecting the marks rather than the arc midpoints should hit both a and b');
  });

  it('d_short: n slots cannot hold the n+1 nodes', () => {
    const short = CHEB.replace('x ← zeros(n+1)', 'x ← zeros(n)');
    const err = throws(() => nodes(-1, 1, 4, {}, short), 'outside x');
    eq(err.kind, 'index');
  });

  it('frac_past_pi: dividing by n+1 runs past π, and pairs of nodes coincide', () => {
    for (const n of [1, 3, 4, 7]) {
      const x = nodes(-1, 1, n, { frac: 'n+1' });
      const repeats = x.filter((v, k) => x.some((w, l) => l > k && Math.abs(v - w) < 1e-9));
      assert(repeats.length > 0,
        `n = ${n}: the angles for k and n−k are reflections, so their nodes agree`);
    }
  });

  it('frac_arc_count: dividing by 2n overshoots π, and the last two nodes agree', () => {
    for (const n of [2, 3, 5]) {
      const x = nodes(-1, 1, n, { frac: '2·n' });
      eq(x[n], x[n - 1], `n = ${n}: cos(π + π/2n) = cos(π − π/2n)`);
    }
  });

  it('map_no_centre: dropping the centre leaves [a, b]', () => {
    const x = nodes(0, 4, 3, { map: '(b−a)·u' });
    assert(x.some((v) => v < 0), 'without the centre term the nodes straddle zero instead of [0, 4]');
  });

  it('map_centred_on_zero: dropping only the centre keeps the spacing', () => {
    const x = nodes(0, 4, 3, { map: '((b−a)/2)·u' });
    const right = nodes(0, 4, 3);
    x.forEach((v, k) => {
      if (k === 0) return;
      eq(v - x[k - 1], right[k] - right[k - 1], `gap ${k} should match the answer's`);
    });
    // It agrees with the answer on [−1, 1], which is why chebnodes has a second
    // probe on [0, 4].
    eq(nodes(-1, 1, 4, { map: '((b−a)/2)·u' }), nodes(-1, 1, 4));
    ne(x, right, 'on [0, 4] it is off by the centre');
  });

  it('map_full_width: the whole length doubles the interval', () => {
    const x = nodes(0, 4, 4, { map: '(a+b)/2 + (b−a)·u' });
    assert(Math.min(...x) < 0 && Math.max(...x) > 4, 'the outer nodes should fall outside [0, 4]');
    eq(x[0] + x[x.length - 1], 4, 'the centre is still right, so it is the width that is wrong');
  });
});

describe('lagrange_eval', () => {
  const LAGRANGE = `
function lagrange_eval(xn, yn, t):
    m ← length(xn)
    p ← 0
    for i ← 0 to m−1:
        L ← 1
        for j ← 0 to m−1:
            if ⟨?guard⟩:
                L ← L · ⟨?factor⟩
        p ← p + yn[i] · L
    return p
`;
  const BLANKS = { guard: 'j ≠ i', factor: '(t − xn[j]) / (xn[i] − xn[j])' };

  const at = (t, blanks = {}, source = LAGRANGE) => exec(source, {
    blanks: { ...BLANKS, ...blanks }, env: { xn: PROBE.x, yn: PROBE.y, t }, call: 'lagrange_eval(xn, yn, t)',
  }).value;

  it('interpolates the data', () => {
    PROBE.x.forEach((node, k) => eq(at(node), PROBE.y[k], `p(x[${k}])`));
  });

  it('agrees with the Newton form everywhere, since the polynomial is unique', () => {
    for (const t of [0.5, 2.0, 5.0, -1.25]) {
      const newton = exec(NEWTON_EVAL, {
        blanks: { init: 'n−1' }, env: { xn: PROBE.x, c: REF_COEFFS, t }, call: 'newton_eval(xn, c, t)',
      }).value;
      eq(at(t), newton, `Lagrange and Newton must agree at t = ${t}`);
    }
  });

  it('guard_inverted: keeping only j = i divides by zero, and says so', () => {
    const err = throws(() => at(0.5, { guard: 'j = i' }), 'divides by zero');
    eq(err.kind, 'divzero');
  });

  it('a guard that lets every j through divides by zero too', () => {
    const err = throws(() => at(0.5, { guard: 'j ≥ 0' }), 'divides by zero');
    eq(err.kind, 'divzero');
  });

  it('guard_partial: stopping at j = i drops the later nodes', () => {
    caught(() => at(0.5, { guard: 'j < i' }), at(0.5));
  });

  it('factor_sign: an even number of factors would hide a flipped denominator', () => {
    // Why lab1-runge probes lageval with four nodes and not five. Each L_i has
    // m−1 factors, so flipping the sign of every denominator multiplies L_i by
    // (−1)^(m−1): visible when m is even, invisible when m is odd.
    const flipped = { factor: '(t − xn[j]) / (xn[j] − xn[i])' };
    eq(PROBE.x.length, 4, 'the four-node probe is what makes this catchable');
    eq(at(0.5, flipped), -at(0.5), 'four nodes: three factors, so the sign flips');

    const five = { xn: [0, 1, 3, 6, 7], yn: [1, 4, 2, 8, 3] };
    const withFive = (blanks) => exec(LAGRANGE, {
      blanks: { ...BLANKS, ...blanks }, env: { ...five, t: 0.5 }, call: 'lagrange_eval(xn, yn, t)',
    }).value;
    eq(withFive(flipped), withFive({}), 'five nodes: four factors, and the flip cancels');
  });

  it('factor_roles_swapped: exchanging i and j moves the root off x_j', () => {
    caught(() => at(0.5, { factor: '(t − xn[i]) / (xn[j] − xn[i])' }), at(0.5));
  });

  it('d_last: overwriting the sum leaves the last term alone', () => {
    const last = LAGRANGE.replace('p ← p + yn[i] · L', 'p ← yn[i] · L');
    caught(() => at(0.5, {}, last), at(0.5));
  });

  it('d_zero: a product started at zero stays there', () => {
    const zero = LAGRANGE.replace('L ← 1', 'L ← 0');
    eq(at(0.5, {}, zero), 0, 'every L_i is zero, so p is zero');
  });

  it('d_plus: adding the factors is not multiplying them', () => {
    const plus = LAGRANGE.replace('L ← L · ⟨?factor⟩', 'L ← L + ⟨?factor⟩');
    caught(() => at(0.5, {}, plus), at(0.5));
  });
});

describe('spline interior equations', () => {
  const INTERIOR = `
function spline_interior_equations(x, y):
    n ← length(x) − 1
    h ← zeros(n)
    for i ← 0 to n−1:
        h[i] ← x[i+1] − x[i]
    A ← zeros(n+1, n+1)
    d ← zeros(n+1)
    for i ← 1 to n−1:
        A[i, i−1] ← h[i−1]
        A[i, i] ← 2 · (h[i−1] + h[i])
        A[i, i+1] ← h[i]
        d[i] ← ⟨?rhs⟩
    return A, d
`;
  const BLANKS = { rhs: '6 · ((y[i+1] − y[i]) / h[i] − (y[i] − y[i−1]) / h[i−1])' };

  const build = (blanks = {}, source = INTERIOR) => exec(source, {
    blanks: { ...BLANKS, ...blanks }, env: PROBE, call: 'spline_interior_equations(x, y)', trace: ['A', 'd'],
  });

  it('builds the tridiagonal interior rows', () => {
    const { value } = build();
    const [A, d] = value;
    eq(A.length, 4);
    eq(A[0], [0, 0, 0, 0], 'row 0 is left for the boundary condition');
    eq(A[3], [0, 0, 0, 0], 'the last row too');
    // h = [1, 2, 3]; interior row 1: h0, 2(h0+h1), h1
    eq(A[1], [1, 6, 2, 0]);
    eq(A[2], [0, 2, 10, 3]);
    eq(d[1], 6 * ((2 - 4) / 2 - (4 - 1) / 1));
    eq(d[2], 6 * ((8 - 2) / 3 - (2 - 4) / 2));
  });

  it('the loop from 0 reads h[−1] and is caught, where Python would wrap silently', () => {
    const bad = INTERIOR.replace('for i ← 1 to n−1:', 'for i ← 0 to n−1:');
    const err = throws(() => build({}, bad), 'never go negative');
    eq(err.kind, 'index');
  });

  it('dropping the 2 changes the diagonal', () => {
    const bad = INTERIOR.replace('A[i, i] ← 2 · (h[i−1] + h[i])', 'A[i, i] ← h[i−1] + h[i]');
    const got = build({}, bad).value[0];
    ne(got[1], [1, 6, 2, 0]);
  });

  it('the assembled system solves', () => {
    const { value } = build();
    const [A, d] = value;
    // Natural boundary: M[0] = M[n] = 0.
    A[0][0] = 1;
    A[3][3] = 1;
    const M = exec(`
function f(A, d):
    return solve(A, d)
`, { env: { A, d }, call: 'f(A, d)' }).value;
    eq(M[0], 0);
    eq(M[3], 0);
    // Residual check on the interior rows.
    for (const i of [1, 2]) {
      const lhs = A[i].reduce((s, a, k) => s + a * M[k], 0);
      eq(lhs, d[i], `interior equation ${i} must hold`);
    }
  });
});

// ---------------------------------------------------------------------------
// The English notation
// ---------------------------------------------------------------------------
//
// Every step is a sentence. The words are matched by value on a name token
// rather than reserved in the tokenizer, because a, b, n, t, u and in are all
// variables in one lab or another, so the tests below check both that the
// sentences work and that those names still do.

describe('English notation', () => {
  it('let stores a value, into a name or an entry', () => {
    const r = exec([
      'function f, given nothing n:',
      '    let p be 2 · n',
      '    let xs be a list of 3 zeros',
      '    let xs[1] be p',
      '    report xs',
    ].join('\n'), { env: { n: 5 }, call: 'f(n)' });
    eq(r.value, [0, 10, 0]);
  });

  it('a table, a row, a column, and copying into either', () => {
    const r = exec([
      'function f, given values v:',
      '    let T be a table of 2 by 3 zeros',
      '    copy v into row 1 of T',
      '    copy 7 into column 0 of T',
      '    let a be row 1 of T',
      '    let b be column 2 of T',
      '    report a and b and T',
    ].join('\n'), { env: { v: [1, 2, 3] }, call: 'f(v)' });
    eq(r.value[0], [7, 2, 3], 'the row after the column overwrote entry 0');
    eq(r.value[1], [0, 3], 'the column runs down every row');
    eq(r.value[2], [[7, 0, 0], [7, 2, 3]]);
  });

  it('taking a row hands back a copy, not the table’s own row', () => {
    const r = exec([
      'function f, given table T:',
      '    let r be row 0 of T',
      '    let r[0] be 99',
      '    report T',
    ].join('\n'), { env: { T: [[1, 2], [3, 4]] }, call: 'f(T)' });
    eq(r.value, [[1, 2], [3, 4]], 'the table is untouched');
  });

  it('the number of entries in x is length(x)', () => {
    const r = exec([
      'function f, given nodes x:',
      '    let n be the number of entries in x',
      '    report n',
    ].join('\n'), { env: { x: [4, 5, 6] }, call: 'f(x)' });
    eq(r.value, 3);
  });

  it('for each takes the name just before "from" as its variable', () => {
    const r = exec([
      'function f, given a count n:',
      '    let s be 0',
      '    for each row i from 1 to n:',
      '        let s be s + i',
      '    for each k from n down to 1:',
      '        let s be s + 10',
      '    report s',
    ].join('\n'), { env: { n: 3 }, call: 'f(n)' });
    eq(r.value, 36, '1+2+3 then three tens');
  });

  it('report separates its values rather than joining them with "and"', () => {
    const r = exec([
      'function f, given nothing n:',
      '    report n and n + 1',
    ].join('\n'), { env: { n: 4 }, call: 'f(n)' });
    eq(r.value, [4, 5], 'two values, not a boolean');
  });

  it('given names the parameter as the last word of each group', () => {
    const r = exec([
      'function f, given the ends a and b, and the degree n:',
      '    report a + b + n',
    ].join('\n'), { env: { a: 1, b: 2, n: 3 }, call: 'f(a, b, n)' });
    eq(r.value, 6);
  });

  it('the words are not reserved, so a, b, n, t and u stay variables', () => {
    const r = exec([
      'function f, given a, b, n, t and u:',
      '    let row be a + b',
      '    let of be n · t',
      '    report row + of + u',
    ].join('\n'), { env: { a: 1, b: 2, n: 3, t: 4, u: 5 }, call: 'f(a, b, n, t, u)' });
    eq(r.value, 20);
  });

  it('T[i][j] and T[i, j] are the same entry', () => {
    eq(evalExpression('T[1][0]', { T: [[1, 2], [3, 4]] }), 3);
    eq(evalExpression('T[1, 0]', { T: [[1, 2], [3, 4]] }), 3);
    const r = exec([
      'function f, given table T:',
      '    let T[0][1] be 9',
      '    report T[0, 1]',
    ].join('\n'), { env: { T: [[1, 2], [3, 4]] }, call: 'f(T)' });
    eq(r.value, 9);
  });

  it('both notations parse, so a lab can be converted on its own', () => {
    const english = exec([
      'function f, given nodes x:',
      '    let n be the number of entries in x',
      '    report n',
    ].join('\n'), { env: { x: [1, 2] }, call: 'f(x)' });
    const symbolic = exec([
      'function f(x):',
      '    n ← length(x)',
      '    return n',
    ].join('\n'), { env: { x: [1, 2] }, call: 'f(x)' });
    eq(english.value, symbolic.value);
  });

  it('says what it wanted when a sentence is incomplete', () => {
    throws(() => exec('let p 0\n'), 'be', 'a missing "be"');
    throws(() => exec([
      'function f, given nodes x:',
      '    for each i 0 to 3:',
      '        let p be i',
      '    report p',
    ].join('\n')), 'from', 'a missing "from"');
    throws(() => exec([
      'function f, given nodes x:',
      '    copy x into T',
      '    report x',
    ].join('\n')), 'row', 'a copy with no row or column');
  });

  it('a row or column of something that is not a table says so', () => {
    throws(() => exec([
      'function f, given nodes x:',
      '    let r be row 0 of x',
      '    report r',
    ].join('\n'), { env: { x: [1, 2] }, call: 'f(x)' }), 'no rows or columns');
  });
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length === 0) {
  print(`\n  ${passed} tests passed.\n`);
} else {
  print(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) {
    print(`  ✗ ${f.group} :: ${f.name}`);
    print(`      ${f.err.message.split('\n').join('\n      ')}`);
    if (f.err.blockId || f.err.line !== undefined) {
      print(`      (line ${f.err.line}, block ${f.err.blockId})`);
    }
    print('');
  }
}
