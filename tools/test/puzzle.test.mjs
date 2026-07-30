// Tests for the puzzle view's pure helpers.
//
// The view itself needs a DOM, but the two pieces that decide how the drag
// feels do not, and both have already been wrong once: the indent step was read
// as 1.9 (the number in "1.9rem") instead of ~30 pixels, which made every level
// two pixels wide, and plain rounding left the middle levels impossible to park
// in. Sweeping across the workspace and asserting that every level is reachable
// and held is the regression test for both.

import { snapIndent, INDENT_STICK, defaultOrder } from '../../teaching/applet/lab/engine/puzzle.js';
import { DIVDIFF_GATE } from './fixtures/divdiff-gate.mjs';

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
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) fail(`${msg || 'values differ'}\n    expected ${JSON.stringify(b)}\n    actual   ${JSON.stringify(a)}`);
}

const MAX = 3;

describe('snapIndent', () => {
  it('rounds to the nearest level when nothing is held', () => {
    eq(snapIndent(0.0, null, MAX), 0);
    eq(snapIndent(0.4, null, MAX), 0);
    eq(snapIndent(0.6, null, MAX), 1);
    eq(snapIndent(2.9, null, MAX), 3);
  });

  it('clamps to the available levels', () => {
    eq(snapIndent(-4, null, MAX), 0);
    eq(snapIndent(99, null, MAX), MAX);
    eq(snapIndent(99, 1, MAX), MAX);
  });

  it('holds the current level inside the sticky band', () => {
    for (const level of [0, 1, 2, 3]) {
      eq(snapIndent(level + INDENT_STICK - 0.02, level, MAX), level,
        `level ${level} should hold just inside the band`);
      eq(snapIndent(level - INDENT_STICK + 0.02, level, MAX), level,
        `level ${level} should hold just inside the band on the left`);
    }
  });

  it('lets go once the block is clearly past', () => {
    eq(snapIndent(1 + INDENT_STICK + 0.05, 1, MAX), 2);
    eq(snapIndent(2 - INDENT_STICK - 0.05, 2, MAX), 1);
  });

  it('the band is wider than plain rounding, which is the whole point', () => {
    assert(INDENT_STICK > 0.5, 'a stick of 0.5 or less is just rounding');
    // A block sitting at level 1 and nudged a third of a level right stays put.
    eq(snapIndent(1.33, 1, MAX), 1);
    // Plain rounding would already have moved it at 1.5.
    eq(snapIndent(1.5, null, MAX), 2);
  });
});

describe('a slow sweep across the workspace', () => {
  // Walk the leading edge from the far left to the far right in small steps,
  // the way a hand moves a mouse, and record the levels visited.
  const sweep = (from, to, stepSize) => {
    const seen = [];
    let current = null;
    for (let raw = from; raw <= to + 1e-9; raw += stepSize) {
      current = snapIndent(raw, current, MAX);
      if (seen[seen.length - 1] !== current) seen.push(current);
    }
    return seen;
  };

  it('visits every level on the way out, in order', () => {
    eq(sweep(0, 3, 0.02), [0, 1, 2, 3]);
  });

  it('visits every level on the way back', () => {
    const seen = [];
    let current = 3;
    for (let raw = 3; raw >= -1e-9; raw -= 0.02) {
      current = snapIndent(raw, current, MAX);
      if (seen[seen.length - 1] !== current) seen.push(current);
    }
    eq(seen, [3, 2, 1, 0]);
  });

  it('never skips a level, however coarse the sampling', () => {
    for (const stepSize of [0.02, 0.1, 0.25, 0.5]) {
      const seen = sweep(0, 3, stepSize);
      for (let i = 1; i < seen.length; i++) {
        assert(Math.abs(seen[i] - seen[i - 1]) === 1,
          `sampling at ${stepSize} jumped from ${seen[i - 1]} to ${seen[i]}`);
      }
    }
  });

  it('a jitter of a fifth of a level never changes the level', () => {
    // The complaint was that the smallest movement threw the block to an end.
    let current = 1;
    for (const jitter of [0.2, -0.2, 0.15, -0.18, 0.1, -0.05]) {
      current = snapIndent(1 + jitter, current, MAX);
      eq(current, 1, `a jitter of ${jitter} moved the block off level 1`);
    }
  });

  it('each level owns a band at least half a level wide', () => {
    // Measures the parkable width of level 2, which is the awkward middle one.
    let lo = null;
    let hi = null;
    for (let raw = 0; raw <= 3; raw += 0.001) {
      if (snapIndent(raw, 2, MAX) === 2) {
        if (lo === null) lo = raw;
        hi = raw;
      }
    }
    assert(hi - lo > 0.9, `level 2 is only ${(hi - lo).toFixed(2)} levels wide`);
  });
});

describe('tray order', () => {
  it('is stable across calls', () => {
    eq(defaultOrder(DIVDIFF_GATE), defaultOrder(DIVDIFF_GATE));
  });

  it('is not the solution order', () => {
    const solution = DIVDIFF_GATE.solution.map((s) => s.id);
    const tray = defaultOrder(DIVDIFF_GATE).filter((id) => solution.includes(id));
    assert(tray.join('|') !== solution.join('|'), 'the tray must not arrive pre-sorted');
  });

  it('holds every block and every decoy exactly once', () => {
    const order = defaultOrder(DIVDIFF_GATE);
    const want = [...DIVDIFF_GATE.blocks, ...DIVDIFF_GATE.distractors].map((b) => b.id).sort();
    eq([...order].sort(), want);
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
