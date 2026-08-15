// Smoke tests for the lab page.
//
// The first half runs against every built lab, so a new one is covered the
// moment it exists: the page builds, puzzles open in order, the notebook stays
// shut until they are done, and progress survives a reload. The second half is
// specific to lab1-newton, where the exact wording and the exact wrong answers
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

const index = slurp('teaching/labs/data/specs/index.json');
const specs = new Map(
  index.map((entry) => [entry.lab_id, slurp(`teaching/labs/data/specs/${entry.lab_id}.json`)]),
);

let served = null;
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => served });

const spec = specs.get('lab1-newton');

const { mountLab } = await import('../../teaching/labs/engine/lab/lab.js');

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

const SPEC_URL = '/teaching/labs/data/specs/lab1-newton.json';
const ids = spec.puzzles.map((p) => p.cell_id);

async function open(labSpec, { fresh = true } = {}) {
  served = labSpec;
  if (fresh) localStorage.clear();
  const root = document.createElement('div');
  const lab = await mountLab(root, `/teaching/labs/data/specs/${labSpec.lab_id}.json`);
  return { root, lab };
}

async function freshLab() { return open(spec); }

function gateOf(id) { return spec.puzzles.find((p) => p.cell_id === id); }

function solveIn(lab, labSpec, id) {
  const gate = labSpec.puzzles.find((p) => p.cell_id === id);
  const view = lab.views.get(id);
  if (!view) fail(`gate ${id} has no live view; it is ${lab.status.get(id)}`);
  // A concept check has no arrangement, so answering it is picking the answers.
  if (gate.kind === 'quiz') {
    for (const question of gate.questions) view.pick(question.id, question.answer);
    view.submit();
    return;
  }
  view.placements = gate.solution.map((s) => ({ ...s }));
  view.blanks = Object.fromEntries(
    Object.entries(gate.blanks || {}).map(([name, b]) => [name, b.answer]),
  );
  view.render();
  view.submit();
}

function solve(lab, id) { solveIn(lab, spec, id); }

// A solved puzzle shows a one-line bar, and the two columns are built on the
// first press of its toggle. Anything asserting about the reveal has to press it
// first, which is also the check that the toggle is wired.
function expand(root, id) {
  const scope = id ? root.querySelector(`.lab-gate[data-gate="${id}"]`) : root;
  const toggle = scope?.querySelector('.lab-doc-toggle');
  if (!toggle) fail(`no reveal toggle on ${id || 'the solved puzzle'}`);
  toggle.dispatch('click');
  return toggle;
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

  // The key is generated rather than written into a layout, so the property to
  // check is that every lab gets one and that it describes the notation the
  // blocks are actually in.
  await it('carries the notation key, matching the notation of its blocks', async () => {
    const { root } = await open(labSpec);
    const key = root.querySelector('.lab-notation');
    assert(key, 'no notation key');
    const text = textOf(key);
    has(text, 'let p be 0', 'the key has to show how a step stores a value');
    has(text, 'Dividing by zero', 'and the two departures from Python');

    const blockText = labSpec.puzzles
      .flatMap((g) => [...(g.blocks || []), ...(g.distractors || [])])
      .flatMap((b) => b.lines.map((l) => l.text))
      .join('\n');
    // Every operator a student reads is one they could type. validate.mjs fails
    // the build over this too; here it is checked on the rendered page, which is
    // where a glyph would actually be seen.
    for (const glyph of ['\u00b7', '\u2212', '\u2260', '\u2264', '\u2265', '\u2190']) {
      assert(!blockText.includes(glyph), `a block still shows "${glyph}"`);
      assert(!textOf(root.querySelector('.lab-intro')).includes(glyph),
        `the intro still shows "${glyph}"`);
    }
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

  // A finished lab has to be able to go back to blank, for a student who wants
  // the practice a second time.
  await it('goes back to blank once it is finished, and stays blank', async () => {
    const { root, lab } = await open(labSpec);
    const box = root.querySelector('.lab-restart');
    assert(box, 'the notebook card carries no way to start over');
    eq(box.hidden, true, 'and it should not offer one before the lab is done');

    for (const gate of labSpec.puzzles) solveIn(lab, labSpec, gate.cell_id);
    eq(box.hidden, false, 'a finished lab should offer a fresh start');
    box.querySelector('.lp-action').dispatch('click');

    eq(lab.allDone(), false, 'the lab should be blank now');
    eq(lab.status.get(labSpec.puzzles[0].cell_id), 'open');
    for (const gate of labSpec.puzzles.slice(1)) {
      eq(lab.status.get(gate.cell_id), 'locked', `${gate.cell_id} should be shut again`);
    }
    eq(root.querySelector('.lab-launch').getAttribute('aria-disabled'), 'true');
    eq(root.querySelector('.lab-restart').hidden, true, 'and it should stop offering');

    const again = await open(labSpec, { fresh: false });
    for (const gate of labSpec.puzzles) {
      assert(!again.lab.done(gate.cell_id), `${gate.cell_id} came back done after a reload`);
    }
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
// lab1-newton in particular
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
  // What the intro has to carry, not the words it carries it in. These used to
  // quote the copy, so every rewording broke a green test for no reason.
  const intro = textOf(root.querySelector('.lab-intro'));
  has(intro, 'scrambled order', 'the intro must say what a puzzle is');
  assert(/indentation/i.test(intro), 'the intro must say indentation counts');
  // Either notation, since `let` and the arrow both need saying and a lab may be
  // written in either.
  assert(/\blet\b|\u2190/.test(intro), 'the intro must say how a step stores a value');
  has(intro, 'includes both', 'and say that a range is inclusive');
  has(textOf(root.querySelector('.lab-progress')), `0 of ${ids.length} done`);
});

await it('assumes nothing about the course around it', async () => {
  const { root } = await freshLab();
  const text = textOf(root).toLowerCase();
  for (const presumed of ['this week', 'on the board', 'in class', 'lecture', 'last lab', 'homework']) {
    assert(!text.includes(presumed), `the page should not say "${presumed}"`);
  }
});

// validate.mjs enforces this over the spec, which is where the briefs and the
// feedback live. This covers the other half: the chrome lab.js and feedback.js
// write themselves, which no spec check can see.
await it('does not write like a machine', async () => {
  const { root } = await freshLab();
  const text = textOf(root).toLowerCase();
  const tics = [
    'your job', 'your task', 'worth noticing', 'worth asking', 'it is worth',
    'that is what makes', 'the key insight', 'ask which', 'ask yourself',
    'keep in mind', 'delve', 'crucial', 'powerful', 'elegant', 'straightforward',
    'housekeeping rather than', 'rather than algorithm',
  ];
  for (const tic of tics) {
    assert(!text.includes(tic), `the page should not say "${tic}"`);
  }
  assert(!textOf(root).includes('\u2014'), 'the page should have no em dashes');
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
  assert(/four points/i.test(intro), 'the lab must name the data it is working with');
  for (const value of ['0', '1', '3', '6']) has(intro, value);
});

await it('nothing refers to output the student has not been shown', async () => {
  const { root, lab } = await freshLab();
  // The evaluation puzzle talks about a filled table, so it has to show one first.
  solve(lab, 'divdiff');
  solve(lab, 'ddcheck');
  const later = root.querySelector('.lab-puzzle-block[data-gate="neweval"]');
  const setup = later.querySelector('.lab-setup');
  assert(setup, 'the evaluation puzzle has to show the table it is reacting to');
  has(textOf(setup), 'algorithm you just built', 'and say where the numbers came from');
  has(textOf(setup), '0.3222', 'and the actual numbers in it');
});

await it('every puzzle explains itself before asking anything', async () => {
  for (const gate of spec.puzzles) {
    // A quiz's brief only frames its questions, which carry the mathematics
    // themselves, so it is held to the lower bar validate.mjs holds it to.
    const floor = gate.kind === 'quiz' ? 200 : 400;
    assert(gate.brief_html && gate.brief_html.length > floor,
      `${gate.cell_id} has no real brief`);
  }
});

await it('the first brief gives the definition and the table it goes in', async () => {
  const { root } = await freshLab();
  const brief = textOf(root.querySelector('.lab-brief'));
  has(brief, 'divided differences', 'the brief has to define them');
  has(brief, 'top row', 'and say where the coefficients are');
  assert(/\bTurn\b|\bWrite\b|\bBuild\b/.test(brief), 'and give an instruction');
});

await it('the evaluation puzzle shows the coefficients that raise the question', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  solve(lab, 'ddcheck');
  const section = root.querySelector('.lab-puzzle-block[data-gate="neweval"]');
  const setup = section.querySelector('.lab-setup');
  assert(setup, 'the last puzzle should open with the output that motivates it');
  // The printing gate that used to sit here is gone and its exposition moved
  // into this setup, so the setup now has to carry all three: the padding the
  // square array shows, the triangle without it, and the coefficient row.
  has(textOf(setup), 'anti-diagonal', 'the square array needs its zeros accounted for');
  has(textOf(setup), 'first row of that triangle', 'and the coefficients located in it');
  has(textOf(setup), 'c = [');
  has(textOf(setup), 'p(2.5)', 'and name the question the coefficients cannot answer');
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
  has(textOf(root.querySelector('.lab-progress')), `1 of ${ids.length}`);
});

await it('the notebook is shut until every puzzle is done', async () => {
  const { root, lab } = await freshLab();
  eq(root.querySelector('.lab-launch').getAttribute('aria-disabled'), 'true');
  has(textOf(root.querySelector('.lab-finale')), `${ids.length} more to go`);
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
  ids.slice(1).forEach((id) => solve(lab, id));
  assert(!root.querySelector('.lab-launch').getAttribute('aria-disabled'));
});

group = 'the reveal';
await it('stays shut on a solve, behind a toggle on a one-line bar', async () => {
  const { root, lab } = await freshLab();
  solve(lab, ids[0]);
  const bar = root.querySelector(`.lab-gate[data-gate="${ids[0]}"] .lab-solved`);
  assert(bar, 'a solved puzzle should still say so');
  has(textOf(bar), 'Solved');
  assert(!bar.querySelector('.lab-reveal'), 'the reveal must not be open on the solve');
  const toggle = expand(root, ids[0]);
  const body = bar.querySelector('.lab-solved__body');
  assert(body?.querySelector('.lab-reveal'), 'the toggle should build it');
  // One press opens it. It used to take two: toggling `hidden` on the element it
  // had just built set the flag rather than clearing it.
  eq(body.hidden, false, 'one press should leave it open');
  eq(toggle.textContent, 'hide what you built');
  toggle.dispatch('click');
  eq(body.hidden, true, 'a second press should shut it again');
  eq(toggle.textContent, 'show what you built');
  toggle.dispatch('click');
  eq(body.hidden, false, 'and a third should reopen the one it already built');
});

await it('pairs each row you built with a line of the Python', async () => {
  const { root, lab } = await freshLab();
  solve(lab, ids[0]);
  expand(root, ids[0]);
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
  expand(root, 'divdiff');
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
  expand(root, 'divdiff');
  const notes = textOf(root.querySelector('.lab-reveal__notes'));
  has(notes, 'Line 8.', 'one line is a Line, not Lines');
  has(notes, 'Lines 5 and 6.', 'two are Lines');
});

await it('lists three annotated lines rather than chaining them on "and"', async () => {
  // lab2-runge/lageval is the first annotation to name three blocks.
  const runge = specs.get('lab2-runge');
  const { root, lab } = await open(runge);
  solveIn(lab, runge, 'chebnodes');
  solveIn(lab, runge, 'lageval');
  expand(root, 'lageval');
  const notes = textOf(root.querySelector('.lab-gate[data-gate="lageval"] .lab-reveal__notes'));
  has(notes, 'Lines 3, 5 and 8.', 'three lines are a list');
  assert(!notes.includes('5 and 8 and'), 'no line should chain on a second "and"');
});

await it('quotes the blanks the student typed, not the model answer', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution.map((s) => ({ ...s }));
  view.blanks = { bound: 'n-j-1', den: '-(x[i] - x[i+j])' };
  view.submit();
  expand(root, 'divdiff');
  has(textOf(root.querySelector('.lab-solved')), '-(x[i] - x[i+j])');
});

group = 'the concept check';
const quizGate = gateOf('ddcheck');

await it('is a gate like any other, and opens when the puzzle above it is solved', async () => {
  const { root, lab } = await freshLab();
  eq(lab.status.get('ddcheck'), 'locked');
  solve(lab, 'divdiff');
  eq(lab.status.get('ddcheck'), 'open');
  const section = root.querySelector('.lab-puzzle-block[data-gate="ddcheck"]');
  eq(section.dataset.kind, 'quiz');
  assert(section.querySelector('.lab-quiz'), 'no quiz board');
  assert(!section.querySelector('.lp-workspace'), 'a quiz has no workspace');
});

await it('asks about the mathematics, and never shows a line of code', async () => {
  // The whole point of the format. A stem that quotes Python is a puzzle in the
  // wrong clothes, and validate.mjs says so too.
  for (const question of quizGate.questions) {
    const text = [question.stem_html, ...question.options.map((o) => o.text_html)].join(' ');
    assert(!/&lt;|\bdef |\brange\(|np\./.test(text), `${question.id} shows code`);
  }
});

await it('holds every question, with every option offered', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const board = root.querySelector('.lab-quiz');
  eq(board.querySelectorAll('.lq-question').length, quizGate.questions.length);
  for (const question of quizGate.questions) {
    const item = board.querySelector(`.lq-question[data-q="${question.id}"]`);
    assert(item, `${question.id} is not on the page`);
    eq(item.querySelectorAll('.lq-option').length, question.options.length);
  }
});

await it('will not pass until every question is answered', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddcheck');
  view.pick('matrix', 'lower');
  view.submit();
  eq(lab.status.get('ddcheck'), 'open');
  has(textOf(root.querySelector('.lq-feedback')), 'still unanswered');
  // An incomplete block is not an attempt: nothing was checked.
  eq(view.attempts, 0);
});

await it('passes when all of them are right, and not when one is not', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddcheck');
  view.pick('matrix', 'lower');
  view.pick('leading', 'one');
  view.pick('reorder', 'nothing');
  view.submit();
  eq(lab.status.get('ddcheck'), 'open', 'two of three is not a pass');
  has(textOf(root.querySelector('.lq-feedback')), '2 of 3 are right');

  view.pick('reorder', 'same_poly');
  view.submit();
  eq(lab.status.get('ddcheck'), 'solved');
});

await it('puts the diagnosis for the option picked under that question', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddcheck');
  view.pick('matrix', 'ident');
  view.pick('leading', 'six');
  view.pick('reorder', 'same_poly');
  view.submit();

  const board = root.querySelector('.lab-quiz');
  const matrix = board.querySelector('.lq-question[data-q="matrix"]');
  has(textOf(matrix.querySelector('.lq-verdict')), 'Lagrange basis',
    'the identity matrix is the Lagrange basis, and the note has to say so');
  const leading = board.querySelector('.lq-question[data-q="leading"]');
  has(textOf(leading.querySelector('.lq-verdict')), 'factorial');
  // The one that is right says so and gives nothing away.
  const reorder = board.querySelector('.lq-question[data-q="reorder"]');
  has(textOf(reorder.querySelector('.lq-verdict')), 'Right.');
  assert(!textOf(reorder.querySelector('.lq-verdict')).includes('symmetric in its arguments'),
    'the reason an answer is right belongs in the reveal, not beside a half-right block');
});

await it('retires a diagnosis once the student moves off that option', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddcheck');
  view.pick('matrix', 'ident');
  view.pick('leading', 'one');
  view.pick('reorder', 'same_poly');
  view.submit();
  const matrix = () => root.querySelector('.lab-quiz .lq-question[data-q="matrix"]');
  has(textOf(matrix().querySelector('.lq-verdict')), 'Lagrange basis');
  view.pick('matrix', 'upper');
  eq(textOf(matrix().querySelector('.lq-verdict')), '',
    'a note about the identity matrix must not sit under a pick of upper triangular');
});

await it('offers a way onward after two checks, like a puzzle does', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  const view = lab.views.get('ddcheck');
  for (const attempt of [1, 2]) {
    view.pick('matrix', 'upper');
    view.pick('leading', 'six');
    view.pick('reorder', 'nothing');
    view.submit();
    eq(view.attempts, attempt);
  }
  const park = root.querySelector('.lq-feedback__actions .lp-action');
  assert(park, 'no way to set the block aside after two checks');
  park.dispatch('click');
  eq(lab.status.get('ddcheck'), 'parked');
  eq(lab.status.get('neweval'), 'open', 'setting it aside opens the rest of the lab');
});

await it('the reveal is the reason each answer is the answer', async () => {
  const { root, lab } = await freshLab();
  solve(lab, 'divdiff');
  solve(lab, 'ddcheck');
  const host = root.querySelector('.lab-gate[data-gate="ddcheck"]');
  has(textOf(host.querySelector('.lab-solved')), 'All right');
  const toggle = host.querySelector('.lab-doc-toggle');
  has(textOf(toggle), 'why these are the answers');
  toggle.dispatch('click');
  const why = textOf(host.querySelector('.lab-solved__body'));
  has(why, 'forward substitution', 'the linear-algebra answer explains itself');
  has(why, 'leading coefficient', 'and so does the one about the top difference');
  // Every question, and the answer named rather than only argued for.
  eq(host.querySelectorAll('.lq-why__item').length, quizGate.questions.length);
});

await it('remembers its answers across a reload', async () => {
  localStorage.clear();
  const first = await mountLab(document.createElement('div'), SPEC_URL);
  solve(first, 'divdiff');
  first.views.get('ddcheck').pick('leading', 'one');
  const again = await mountLab(document.createElement('div'), SPEC_URL);
  eq(again.views.get('ddcheck').picks, { leading: 'one' });
});

await it('an edited question starts the block over and leaves the others alone', async () => {
  localStorage.clear();
  const lab1 = await mountLab(document.createElement('div'), SPEC_URL);
  solve(lab1, 'divdiff');
  solve(lab1, 'ddcheck');

  // What build_labs.py does when a question is reworded: the gate hash covers
  // `questions`, so the saved picks stop matching.
  const edited = JSON.parse(JSON.stringify(spec));
  edited.puzzles[1].hash = 'reworded';
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => edited });
  const lab2 = await mountLab(document.createElement('div'), SPEC_URL);
  eq(lab2.status.get('divdiff'), 'solved', 'the puzzle above keeps its work');
  eq(lab2.status.get('ddcheck'), 'open');
  eq(lab2.views.get('ddcheck').picks, {});
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => spec });
});

group = 'wrong answers';
await it('a decoy gets the message written for it', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution
    .map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n-j-1', den: 'x[i+j] - x[i]' };
  view.submit();
  eq(lab.status.get('divdiff'), 'open');
  has(textOf(root.querySelector('.lp-feedback')), 'signs alternate');
  assert(!root.querySelector('.lab-solved'), 'no reveal on a wrong answer');
});

await it('shows the student their own table and never the reference', async () => {
  const { root, lab } = await freshLab();
  const view = lab.views.get('divdiff');
  view.placements = gateOf('divdiff').solution
    .map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n-j-1', den: 'x[i+j] - x[i]' };
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

await it('starting over gives back the board a first-time student sees', async () => {
  localStorage.clear();
  const root = document.createElement('div');
  const lab = await mountLab(root, SPEC_URL);
  const blank = JSON.stringify(lab.views.get(ids[0]).getState());
  for (const id of ids) solve(lab, id);

  root.querySelector('.lab-restart .lp-action').dispatch('click');
  eq(JSON.parse(JSON.stringify(lab.views.get(ids[0]).getState())), JSON.parse(blank));
  assert(!root.querySelector('.lab-solved'), 'a solved bar survived');
  eq(root.querySelectorAll('.lab-locked').length, ids.length - 1);
});

group = 'the office-hours snapshot';
await it('describes the attempt without describing the answer', async () => {
  const { lab } = await freshLab();
  const gate = gateOf('divdiff');
  const view = lab.views.get('divdiff');
  view.placements = gate.solution.map((s) => (s.id === 'rec' ? { id: 'd_num', indent: 3 } : { ...s }));
  view.blanks = { bound: 'n-j-1', den: 'x[i+j] - x[i]' };
  view.submit();

  const { attemptSnapshot } = await import('../../teaching/labs/engine/lab/feedback.js');
  const text = attemptSnapshot({
    lab: spec, gate, view, verdict: { message: 'Not yet.' }, attempts: 5,
  });
  has(text, 'Newton form and divided differences');
  has(text, 'function divided_differences, given nodes x and values y:');
  has(text, '            let T[i][j] be', 'indentation preserved');
  has(text, '⟨?den⟩ = x[i+j] - x[i]');
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
