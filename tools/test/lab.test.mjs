// Smoke tests for the lab page, against the generated m1-newton spec.
//
// These run on a DOM stub, so they say nothing about how anything looks or
// measures. What they do cover is the part I otherwise cannot see: that the
// whole page builds without throwing, that a gate locks and unlocks in the
// right order, that solving one opens the prose and the demo it was hiding, and
// that progress survives a reload. A blank page is the failure mode these exist
// to catch.

import { installDom, walk, textOf } from './dom-stub.mjs';

const teardown = installDom();

const spec = JSON.parse(
  typeof read === 'function'
    ? read('teaching/applet/lab/specs/m1-newton.json')
    : (await import('node:fs')).readFileSync('teaching/applet/lab/specs/m1-newton.json', 'utf8'),
);

// mountLab fetches; hand it the spec we already have.
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => spec });

const { mountLab } = await import('../../teaching/applet/lab/engine/lab.js');
const { buildReference } = await import('../../teaching/applet/lab/engine/verify.js');

let passed = 0;
const failures = [];
let group = '';

function describe(name, fn) {
  group = name;
  try { fn(); } catch (err) { failures.push({ group, name: '(setup)', err }); }
}
async function it(name, fn) {
  try { await fn(); passed++; } catch (err) { failures.push({ group, name, err }); }
}
function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg || 'assertion failed'); }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail(`${msg || 'values differ'}\n    expected ${JSON.stringify(b)}\n    actual   ${JSON.stringify(a)}`);
  }
}
function has(text, needle, msg) {
  if (!String(text).includes(needle)) fail(`${msg || 'missing'}: expected "${needle}" in "${String(text).slice(0, 200)}"`);
}

const SPEC_URL = '/teaching/applet/lab/specs/m1-newton.json';

async function freshLab() {
  localStorage.clear();
  const root = document.createElement('div');
  const lab = await mountLab(root, SPEC_URL);
  return { root, lab };
}

// Solve a gate the way a student would: hand its own solution to onSubmit.
function solve(lab, cellId) {
  const entry = lab.gates.find(({ cell }) => cell.gate.cell_id === cellId);
  const gate = entry.cell.gate;
  const view = lab.views.get(cellId);
  if (!view) fail(`gate ${cellId} has no live view; it is ${lab.status.get(cellId)}`);
  const blanks = {};
  for (const [name, blank] of Object.entries(gate.blanks || {})) blanks[name] = blank.answer;
  view.placements = gate.solution.map((s) => ({ ...s }));
  view.blanks = blanks;
  view.render();
  view.submit();
}

group = 'the page builds';
await it('renders every cell without throwing', async () => {
  const { root } = await freshLab();
  const nodes = walk(root);
  assert(nodes.length > 50, `expected a real tree, got ${nodes.length} nodes`);
  assert(root.querySelector('.lab-head'), 'no header');
  assert(root.querySelector('.lab-finale'), 'no finale card');
});

await it('shows the title and the puzzle count', async () => {
  const { root } = await freshLab();
  has(textOf(root.querySelector('.lab-head')), 'Newton form and divided differences');
  has(textOf(root.querySelector('.lab-progress')), '0 of 3 puzzles solved');
});

await it('opens only the first gate', async () => {
  const { root, lab } = await freshLab();
  eq(lab.status.get('divdiff'), 'open');
  eq(lab.status.get('ddprint'), 'locked');
  eq(lab.status.get('neweval'), 'locked');
  const locked = root.querySelectorAll('.lab-locked');
  eq(locked.length, 2, 'two gates should be showing a locked placeholder');
});

await it('the first puzzle has its blocks in the tray, not the answer order', async () => {
  const { lab } = await freshLab();
  const view = lab.views.get('divdiff');
  eq(view.placements.length, 0, 'the workspace starts empty');
  eq(view.tray.length, 12, 'nine blocks and three decoys');
});

group = 'deferred prose and demo cells';
await it('holds back the prose that answers the puzzle', async () => {
  const { root } = await freshLab();
  const bars = root.querySelectorAll('.lab-defer');
  eq(bars.length, 2, 'both deferred cells should be collapsed');
  has(textOf(bars[0]), 'opens with the puzzle below');
  assert(!textOf(root).includes('the top row of the triangular table'),
    'the deferred prose must not be in the page while its puzzle is open');
});

await it('hides the demo cell that would print the answer', async () => {
  const { root } = await freshLab();
  assert(!textOf(root).includes('Newton coefficients c0..c3'),
    "the divdiff demo's output must not be visible before the puzzle is solved");
});

group = 'solving';
await it('solving the first gate unlocks the second and opens its prose', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');

  eq(lab.status.get('divdiff'), 'solved');
  eq(lab.status.get('ddprint'), 'open');
  eq(lab.status.get('neweval'), 'locked', 'the third gate stays shut');

  has(textOf(root.querySelector('.lab-progress')), '1 of 3');
  has(textOf(root), 'the top row of the triangular table',
    'the deferred prose should now be open');
  has(textOf(root), 'Newton coefficients c0..c3',
    'the demo output should now be visible');
});

await it('the reveal pairs every pseudocode row with a Python line', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const reveal = root.querySelector('.lab-solved');
  assert(reveal, 'no reveal after solving');

  const pairs = reveal.querySelectorAll('.lab-pair[data-pair]');
  const numbers = new Set(pairs.map((p) => p.dataset.pair));
  eq(numbers.size, 9, 'nine pseudocode rows, nine paired Python lines');
  for (const n of numbers) {
    const both = reveal.querySelectorAll(`.lab-pair[data-pair="${n}"]`);
    assert(both.length >= 2, `row ${n} is only on one side of the reveal`);
  }
});

await it('the reveal shows the blanks the student actually typed', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = lab.spec.cells[3].gate.solution.map((s) => ({ ...s }));
  // An equivalent but differently written denominator, which passes.
  view.blanks = { bound: 'n−j−1', den: '−(x[i] − x[i+j])' };
  view.submit();
  has(textOf(root.querySelector('.lab-solved')), '−(x[i] − x[i+j])',
    'the reveal should quote the student, not the model answer');
});

await it('solving all three enables the Colab launch', async () => {
  const { root, lab } = await freshLab();
  assert(root.querySelector('.lab-launch').getAttribute('aria-disabled') === 'true',
    'the launch starts disabled');
  solve(lab, 'divdiff');
  solve(lab, 'ddprint');
  solve(lab, 'neweval');
  eq(lab.allDone(), true);
  const launch = root.querySelector('.lab-launch');
  assert(!launch.getAttribute('aria-disabled'), 'the launch should be live now');
  has(launch.getAttribute('href'), 'colab.research.google.com');
});

group = 'wrong answers';
await it('a decoy is rejected with the message written for it', async () => {
  const { root, lab } = await freshLab();
  const gate = lab.spec.cells[3].gate;
  const view = lab.views.get('divdiff');
  view.placements = gate.solution.map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();

  eq(lab.status.get('divdiff'), 'open', 'a wrong answer must not unlock anything');
  const card = root.querySelector('.lp-feedback');
  assert(card, 'no feedback card');
  has(textOf(card), 'alternating by column');
  assert(!root.querySelector('.lab-solved'), 'no reveal on a wrong answer');
});

await it('the failure card shows the student trace and never the answer', async () => {
  const { root, lab } = await freshLab();
  const gate = lab.spec.cells[3].gate;
  const view = lab.views.get('divdiff');
  view.placements = gate.solution.map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();

  const trace = root.querySelector('.lp-feedback__trace');
  assert(trace, 'the failure card should carry the student trace');
  const text = trace.textContent;
  has(text, '-3', 'their own sign-flipped column 1 should be on show');
  // The reversed numerator negates the odd columns, so the top-right entry is
  // their -0.322222, not the reference 0.322222. Checking the digits alone
  // would pass on either, so the sign is what is asserted.
  has(text, '-0.322222', 'the trace should show what they computed');
  assert(!/(^|[^-\d])0\.322222/.test(text),
    'the correct top-right coefficient must not appear unsigned anywhere');
});

group = 'progress';
await it('a solved gate comes back solved after a reload', async () => {
  localStorage.clear();
  const first = document.createElement('div');
  const lab1 = await mountLab(first, SPEC_URL);
  solve(lab1, 'divdiff');

  const second = document.createElement('div');
  const lab2 = await mountLab(second, SPEC_URL);
  eq(lab2.status.get('divdiff'), 'solved');
  eq(lab2.status.get('ddprint'), 'open');
  has(textOf(second.querySelector('.lab-progress')), '1 of 3');
});

await it('an unfinished arrangement comes back as it was left', async () => {
  localStorage.clear();
  const first = document.createElement('div');
  const lab1 = await mountLab(first, SPEC_URL);
  const view = lab1.views.get('divdiff');
  view.place('def', 0, 0);
  view.place('n', 1, 1);

  const second = document.createElement('div');
  const lab2 = await mountLab(second, SPEC_URL);
  eq(lab2.views.get('divdiff').placements.map((p) => p.id), ['def', 'n']);
});

await it('editing one puzzle resets only that puzzle', async () => {
  localStorage.clear();
  const first = document.createElement('div');
  const lab1 = await mountLab(first, SPEC_URL);
  solve(lab1, 'divdiff');
  solve(lab1, 'ddprint');

  // Simulate a revision to the second puzzle only.
  const edited = JSON.parse(JSON.stringify(spec));
  edited.cells[4].gate.hash = 'changed-hash';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => edited });

  const second = document.createElement('div');
  const lab2 = await mountLab(second, SPEC_URL);
  eq(lab2.status.get('divdiff'), 'solved', 'the untouched puzzle keeps its progress');
  eq(lab2.status.get('ddprint'), 'open', 'the edited one is reset');
  has(textOf(second), 'One of these puzzles changed');

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => spec });
});

group = 'parking';
await it('parking opens the rest of the lab without revealing anything', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  lab.park(lab.spec.cells[3], view);

  eq(lab.status.get('divdiff'), 'parked');
  eq(lab.status.get('ddprint'), 'open', 'the next puzzle opens');
  assert(!root.querySelector('.lab-solved'), 'parking must not produce a reveal');
  has(textOf(root), 'the top row of the triangular table', 'the deferred prose opens');
});

await it('the launch stays available with a parked puzzle', async () => {
  const { root, lab } = await freshLab();
  lab.park(lab.spec.cells[3], lab.views.get('divdiff'));
  solve(lab, 'ddprint');
  solve(lab, 'neweval');
  assert(!root.querySelector('.lab-launch').getAttribute('aria-disabled'),
    'a parked puzzle should not block the notebook');
});

group = 'the office-hours snapshot';
await it('describes the attempt without describing the answer', async () => {
  const { lab } = await freshLab();
  const gate = lab.spec.cells[3].gate;
  const view = lab.views.get('divdiff');
  view.placements = gate.solution.map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();

  const { attemptSnapshot } = await import('../../teaching/applet/lab/engine/feedback.js');
  const text = attemptSnapshot({
    lab: lab.spec, gate, view, verdict: { message: 'Not yet.' }, attempts: 5,
  });
  has(text, 'Newton form and divided differences');
  has(text, 'function divided_differences(x, y):');
  has(text, '            T[i, j] ←', 'indentation is preserved for reading aloud');
  has(text, '⟨?den⟩ = x[i+j] − x[i]');
  has(text, 'Attempts: 5');
});

teardown();

if (failures.length === 0) {
  print(`\n  ${passed} tests passed.\n`);
} else {
  print(`\n  ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) {
    print(`  ✗ ${f.group} :: ${f.name}`);
    print(`      ${String(f.err.stack || f.err.message).split('\n').slice(0, 4).join('\n      ')}`);
    print('');
  }
}
