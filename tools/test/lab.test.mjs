// Smoke tests for the lab page.
//
// The first half runs against every built lab, so a new one is covered the
// moment it exists: the page builds, puzzles open in order, the notebook stays
// shut until they are done, and progress survives a reload. The second half is
// specific to m1-newton, where the exact wording and the exact wrong answers
// are worth pinning.
//
// These run on a DOM stub, so nothing here says how anything looks. Editorial
// rules about the writing live in tools/validate.mjs, where they fail the build
// of any lab rather than only the one this file names.

import { installDom, walk, textOf } from './dom-stub.mjs';

const teardown = installDom();

const readText = typeof read === 'function'
  ? (p) => read(p)
  : (await import('node:fs')).readFileSync;

const slurp = (p) => JSON.parse(String(readText(p, 'utf8')));

const index = slurp('teaching/applet/lab/specs/index.json');
const specs = new Map(
  index.map((entry) => [entry.lab_id, slurp(`teaching/applet/lab/specs/${entry.lab_id}.json`)]),
);

let served = null;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => served });

const spec = specs.get('m1-newton');

const { mountLab } = await import('../../teaching/applet/lab/engine/lab.js');

let passed = 0;
const failures = [];
let group = '';

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
  if (!String(text).includes(needle)) {
    fail(`${msg || 'missing'}: expected "${needle}" in "${String(text).slice(0, 240)}"`);
  }
}

const SPEC_URL = '/teaching/applet/lab/specs/m1-newton.json';
const ids = spec.puzzles.map((p) => p.cell_id);

async function open(labSpec, { fresh = true } = {}) {
  served = labSpec;
  if (fresh) localStorage.clear();
  const root = document.createElement('div');
  const lab = await mountLab(root, `/teaching/applet/lab/specs/${labSpec.lab_id}.json`);
  return { root, lab };
}

async function freshLab() { return open(spec); }

function gateOf(id) { return spec.puzzles.find((p) => p.cell_id === id); }

function solveIn(lab, labSpec, id) {
  const gate = labSpec.puzzles.find((p) => p.cell_id === id);
  const view = lab.views.get(id);
  if (!view) fail(`puzzle ${id} has no live view; it is ${lab.status.get(id)}`);
  view.placements = gate.solution.map((s) => ({ ...s }));
  view.blanks = Object.fromEntries(
    Object.entries(gate.blanks || {}).map(([name, b]) => [name, b.answer]),
  );
  view.render();
  view.submit();
}

function solve(lab, id) {
  const gate = gateOf(id);
  const view = lab.views.get(id);
  if (!view) fail(`puzzle ${id} has no live view; it is ${lab.status.get(id)}`);
  view.placements = gate.solution.map((s) => ({ ...s }));
  view.blanks = Object.fromEntries(
    Object.entries(gate.blanks || {}).map(([name, b]) => [name, b.answer]),
  );
  view.render();
  view.submit();
}

// ---------------------------------------------------------------------------
// Every built lab
// ---------------------------------------------------------------------------

for (const entry of index) {
  const labSpec = specs.get(entry.lab_id);
  group = `every lab :: ${entry.lab_id}`;

  await it('builds a page with a header, its puzzles, and the notebook card', async () => {
    const { root } = await open(labSpec);
    assert(root.querySelector('.lab-head'), 'no header');
    assert(root.querySelector('.lab-finale'), 'no notebook card');
    eq(root.querySelectorAll('.lab-puzzle-block').length, labSpec.puzzles.length);
    assert(walk(root).length > 30, 'the tree is suspiciously small');
  });

  await it('opens the first puzzle and shuts the rest', async () => {
    const { root, lab } = await open(labSpec);
    const order = labSpec.puzzles.map((p) => p.cell_id);
    eq(lab.status.get(order[0]), 'open');
    for (const id of order.slice(1)) eq(lab.status.get(id), 'locked', `${id} should be shut`);
    eq(root.querySelectorAll('.lab-locked').length, order.length - 1);
  });

  await it('every puzzle can be solved, in order, and each opens the next', async () => {
    const { lab } = await open(labSpec);
    for (const gate of labSpec.puzzles) {
      eq(lab.status.get(gate.cell_id), 'open', `${gate.cell_id} should be open by now`);
      solveIn(lab, labSpec, gate.cell_id);
      eq(lab.status.get(gate.cell_id), 'solved', `${gate.cell_id} did not accept its own solution`);
    }
    eq(lab.allDone(), true);
  });

  await it('keeps the notebook shut until the puzzles are done', async () => {
    const { root, lab } = await open(labSpec);
    eq(root.querySelector('.lab-launch').getAttribute('aria-disabled'), 'true');
    for (const gate of labSpec.puzzles) solveIn(lab, labSpec, gate.cell_id);
    const launch = root.querySelector('.lab-launch');
    assert(!launch.getAttribute('aria-disabled'), 'the notebook should be open now');
    has(launch.getAttribute('href'), 'colab.research.google.com');
  });

  await it('remembers a solved puzzle across a reload', async () => {
    const first = await open(labSpec);
    const firstId = labSpec.puzzles[0].cell_id;
    solveIn(first.lab, labSpec, firstId);
    const again = await open(labSpec, { fresh: false });
    eq(again.lab.status.get(firstId), 'solved');
  });

  await it('shows every puzzle a brief before asking anything', async () => {
    const { root, lab } = await open(labSpec);
    for (const gate of labSpec.puzzles) {
      if (!lab.views.get(gate.cell_id)) solveIn(lab, labSpec, [...lab.views.keys()][0]);
      const section = root.querySelector(`.lab-puzzle-block[data-gate="${gate.cell_id}"]`);
      if (section.querySelector('.lab-locked')) continue;
      assert(section.querySelector('.lab-brief'), `${gate.cell_id} has no brief on the page`);
    }
  });
}

// ---------------------------------------------------------------------------
// m1-newton in particular
// ---------------------------------------------------------------------------

served = spec;

group = 'the page builds';
await it('renders without throwing', async () => {
  const { root } = await freshLab();
  assert(walk(root).length > 40, 'expected a real tree');
  assert(root.querySelector('.lab-head'), 'no header');
  assert(root.querySelector('.lab-finale'), 'no finale card');
  eq(root.querySelectorAll('.lab-puzzle-block').length, ids.length);
});

await it('carries the lab intro and the puzzle count', async () => {
  const { root } = await freshLab();
  has(textOf(root.querySelector('.lab-head')), 'Newton form and divided differences');
  has(textOf(root.querySelector('.lab-intro')), 'Rebuild each algorithm');
  has(textOf(root.querySelector('.lab-intro')), 'includes both ends');
  has(textOf(root.querySelector('.lab-progress')), `0 of ${ids.length} done`);
});

await it('assumes nothing about the course around it', async () => {
  const { root } = await freshLab();
  const text = textOf(root).toLowerCase();
  for (const presumed of ['this week', 'on the board', 'in class', 'lecture', 'last lab', 'homework']) {
    assert(!text.includes(presumed), `the page should not say "${presumed}"`);
  }
});

await it('holds nothing but puzzles, their briefs, and the notebook', async () => {
  const { root } = await freshLab();
  // Everything that used to be an orphan cell now lives in the notebook.
  for (const gone of ['Show the Python', 'still frames', 'opens with the puzzle below']) {
    assert(!textOf(root).toLowerCase().includes(gone.toLowerCase()),
      `"${gone}" should no longer be on the page`);
  }
});

group = 'briefs';
await it('introduces its data before any output refers to it', async () => {
  const { root } = await freshLab();
  const intro = textOf(root.querySelector('.lab-intro'));
  // Every number a puzzle shows comes from one worked example, and a student
  // meeting a table of numbers with no provenance is the failure this catches.
  has(intro, 'worked example', 'the lab must say what data it is working with');
  for (const value of ['0', '1', '3', '6']) has(intro, value);
});

await it('nothing refers to output the student has not been shown', async () => {
  const { root, lab } = await freshLab();
  // Puzzle 2 talks about a filled table, so it has to show one first.
  solve(lab, 'divdiff');
  const second = root.querySelector('.lab-puzzle-block[data-gate="ddprint"]');
  const setup = second.querySelector('.lab-setup');
  assert(setup, 'the printing puzzle has to show the table it is reacting to');
  has(textOf(setup), 'the table it fills');
  has(textOf(setup), '0.3222', 'and the actual numbers in it');
});

await it('every puzzle explains itself before asking anything', async () => {
  for (const gate of spec.puzzles) {
    assert(gate.brief_html && gate.brief_html.length > 400,
      `${gate.cell_id} has no real brief`);
  }
});

await it('the first brief gives the definition and the table it goes in', async () => {
  const { root } = await freshLab();
  const brief = textOf(root.querySelector('.lab-brief'));
  has(brief, 'divided differences');
  has(brief, 'Your job');
});

await it('the evaluation puzzle shows the coefficients that raise the question', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  solve(lab, 'ddprint');
  const section = root.querySelector('.lab-puzzle-block[data-gate="neweval"]');
  const setup = section.querySelector('.lab-setup');
  assert(setup, 'the third puzzle should open with the output that motivates it');
  has(textOf(setup), 'top row of the triangle you just printed');
  has(textOf(setup), 'c = [');
  has(textOf(setup), 'what $p(2.5)$ is');
});

group = 'progression';
await it('opens only the first puzzle', async () => {
  const { root, lab } = await freshLab();
  eq(lab.status.get(ids[0]), 'open');
  eq(lab.status.get(ids[1]), 'locked');
  eq(root.querySelectorAll('.lab-locked').length, ids.length - 1);
});

await it('a solve opens the next one', async () => {
  const { root, lab } = await freshLab();
  solve(lab, ids[0]);
  eq(lab.status.get(ids[0]), 'solved');
  eq(lab.status.get(ids[1]), 'open');
  eq(lab.status.get(ids[2]), 'locked');
  has(textOf(root.querySelector('.lab-progress')), '1 of 3');
});

await it('the notebook is shut until every puzzle is done', async () => {
  const { root, lab } = await freshLab();
  eq(root.querySelector('.lab-launch').getAttribute('aria-disabled'), 'true');
  has(textOf(root.querySelector('.lab-finale')), '3 puzzles to go');
  ids.forEach((id) => solve(lab, id));
  const launch = root.querySelector('.lab-launch');
  assert(!launch.getAttribute('aria-disabled'), 'the notebook should be open now');
  has(launch.getAttribute('href'), 'colab.research.google.com');
});

await it('setting a puzzle aside also opens the notebook', async () => {
  const { root, lab } = await freshLab();
  lab.park(gateOf(ids[0]), lab.views.get(ids[0]));
  eq(lab.status.get(ids[0]), 'parked');
  eq(lab.status.get(ids[1]), 'open');
  assert(!root.querySelector('.lab-solved'), 'setting aside must not reveal anything');
  solve(lab, ids[1]);
  solve(lab, ids[2]);
  assert(!root.querySelector('.lab-launch').getAttribute('aria-disabled'));
});

group = 'the reveal';
await it('pairs each row you built with a line of the Python', async () => {
  const { root, lab } = await freshLab();
  solve(lab, ids[0]);
  const reveal = root.querySelector('.lab-solved');
  const pairs = reveal.querySelectorAll('.lab-pair[data-pair]');
  const numbers = new Set(pairs.map((p) => p.dataset.pair));
  eq(numbers.size, gateOf(ids[0]).solution.length);
  for (const n of numbers) {
    assert(reveal.querySelectorAll(`.lab-pair[data-pair="${n}"]`).length >= 2,
      `row ${n} is only on one side`);
  }
});

await it('shows the algorithm only, with no comments or docstring', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const python = textOf(root.querySelectorAll('.lab-reveal__col')[1]);
  has(python, 'def divided_differences');
  has(python, 'table[i, j] =', 'the recurrence has to be there');
  assert(!python.includes('#'), 'no comment lines belong in the reveal');
  assert(!python.includes('Parameters'), 'the docstring belongs in the notebook');
  assert(!python.includes(String.fromCharCode(34, 34, 34)), 'not even the docstring quotes');
});

await it('numbers a single annotated line in the singular', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const notes = textOf(root.querySelector('.lab-reveal__notes'));
  has(notes, 'Line 8.', 'one line is a Line, not Lines');
  has(notes, 'Lines 5 and 6.', 'two are Lines');
});

await it('quotes the blanks the student typed, not the model answer', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution.map((s) => ({ ...s }));
  view.blanks = { bound: 'n−j−1', den: '−(x[i] − x[i+j])' };
  view.submit();
  has(textOf(root.querySelector('.lab-solved')), '−(x[i] − x[i+j])');
});

group = 'a pre-placed puzzle';
await it('arrives in order with an empty tray', async () => {
  const { lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddprint');
  eq(view.placements.map((p) => p.id), ['def', 'n', 'loopi', 'loopj', 'pr']);
  eq(view.tray.length, 0);
  eq(view.blanks, {});
});

await it('is answered by the blank alone, and rejects the bound from above', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddprint');
  view.blanks = { rowlen: 'n−j−1' };
  view.submit();
  eq(lab.status.get('ddprint'), 'open');
  has(textOf(root.querySelector('.lp-feedback')), 'cannot appear in its own bound');
  view.blanks = { rowlen: 'n−i−1' };
  view.submit();
  eq(lab.status.get('ddprint'), 'solved');
});

group = 'wrong answers';
await it('a decoy gets the message written for it', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution
    .map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();
  eq(lab.status.get('divdiff'), 'open');
  has(textOf(root.querySelector('.lp-feedback')), 'alternating by column');
  assert(!root.querySelector('.lab-solved'), 'no reveal on a wrong answer');
});

await it('shows the student their own table and never the reference', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution
    .map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();
  const text = root.querySelector('.lp-feedback__trace').textContent;
  has(text, '-3', 'their own sign-flipped column');
  has(text, '-0.322222', 'their value, negated');
  assert(!/(^|[^-\d])0\.322222/.test(text), 'the correct value must not appear unsigned');
});

group = 'progress';
await it('a solved puzzle comes back solved', async () => {
  localStorage.clear();
  const first = document.createElement('div');
  solve(await mountLab(first, SPEC_URL), ids[0]);
  const lab2 = await mountLab(document.createElement('div'), SPEC_URL);
  eq(lab2.status.get(ids[0]), 'solved');
  eq(lab2.status.get(ids[1]), 'open');
});

await it('an unfinished arrangement comes back as it was left', async () => {
  localStorage.clear();
  const lab1 = await mountLab(document.createElement('div'), SPEC_URL);
  lab1.views.get(ids[0]).place('def', 0, 0);
  lab1.views.get(ids[0]).place('n', 1, 1);
  const lab2 = await mountLab(document.createElement('div'), SPEC_URL);
  eq(lab2.views.get(ids[0]).placements.map((p) => p.id), ['def', 'n']);
});

await it('revising one puzzle resets only that one', async () => {
  localStorage.clear();
  const lab1 = await mountLab(document.createElement('div'), SPEC_URL);
  solve(lab1, ids[0]);
  solve(lab1, ids[1]);

  const edited = JSON.parse(JSON.stringify(spec));
  edited.puzzles[1].hash = 'changed-hash';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => edited });

  const root = document.createElement('div');
  const lab2 = await mountLab(root, SPEC_URL);
  eq(lab2.status.get(ids[0]), 'solved', 'the untouched puzzle keeps its progress');
  eq(lab2.status.get(ids[1]), 'open', 'the revised one starts over');
  has(textOf(root), 'has changed since you were last here');

  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => spec });
});

group = 'the office-hours snapshot';
await it('describes the attempt without describing the answer', async () => {
  const { lab } = await freshLab();
  const gate = gateOf('divdiff');
  const view = lab.views.get('divdiff');
  view.placements = gate.solution.map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n−j−1', den: 'x[i+j] − x[i]' };
  view.submit();

  const { attemptSnapshot } = await import('../../teaching/applet/lab/engine/feedback.js');
  const text = attemptSnapshot({
    lab: spec, gate, view, verdict: { message: 'Not yet.' }, attempts: 5,
  });
  has(text, 'Newton form and divided differences');
  has(text, 'function divided_differences(x, y):');
  has(text, '            T[i, j] ←', 'indentation preserved');
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
