// The lab page: a short run of puzzles, then the notebook.
//
// Each puzzle gets the mathematics it needs to be solvable, and where the
// output is what raises the question, that output sits above it. Everything
// else the notebook holds stays in the notebook, which opens at the end.

import { PuzzleView } from './puzzle.js';
import { buildReference, verify } from './verify.js';
import { buildFeedbackCard, applyLadder, attemptSnapshot } from './feedback.js';

const STORE_VERSION = 2;
const DEV_KEY = 'lab:dev';

// Test mode. Turn it on with ?dev=1 on the URL and off with ?dev=0, or with the
// button in the bar it adds. It sticks in localStorage so it survives reloads,
// and it puts a Solve button on each puzzle so the later ones can be reached
// without doing the earlier ones by hand. Nothing about it is meant to be
// student-proof; it is here while the labs are being written.
function devMode() {
  try {
    const query = new URLSearchParams(window.location?.search || '');
    if (query.has('dev')) {
      const on = query.get('dev') !== '0';
      localStorage.setItem(DEV_KEY, on ? '1' : '');
      return on;
    }
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

export async function mountLab(root, specUrl) {
  const response = await fetch(specUrl, { cache: 'no-cache' });
  if (!response.ok) {
    root.innerHTML = '';
    root.appendChild(notice(`This lab could not be loaded (${response.status}).`));
    return null;
  }
  const spec = await response.json();
  const lab = new LabController(root, spec, specUrl);
  lab.render();
  return lab;
}

// ---------------------------------------------------------------------------
// Saved progress
// ---------------------------------------------------------------------------
//
// Keyed per puzzle and stamped with that puzzle's hash, so revising one puzzle
// resets that puzzle and leaves the rest of a student's work alone.

class Progress {
  constructor(labId) { this.labId = labId; }

  key(cellId) { return `lab:${STORE_VERSION}:${this.labId}:${cellId}`; }

  read(cellId, hash) {
    try {
      const raw = localStorage.getItem(this.key(cellId));
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.hash !== hash) {
        localStorage.removeItem(this.key(cellId));
        return { reset: true };
      }
      return saved;
    } catch {
      return null;
    }
  }

  write(cellId, hash, data) {
    try {
      localStorage.setItem(this.key(cellId), JSON.stringify({ hash, ...data }));
    } catch {
      // A full or disabled store costs the student their place, nothing more.
    }
  }

  markConcept(name) {
    if (!name) return;
    try {
      localStorage.setItem(`concept:${STORE_VERSION}:${name}`, this.labId);
    } catch { /* ignore */ }
  }

  hasConcept(name) {
    try { return !!localStorage.getItem(`concept:${STORE_VERSION}:${name}`); } catch { return false; }
  }
}

// ---------------------------------------------------------------------------

class LabController {
  constructor(root, spec, specUrl) {
    this.root = root;
    this.spec = spec;
    this.base = specUrl.replace(/specs\/[^/]*$/, '');
    this.progress = new Progress(spec.lab_id);
    this.puzzles = spec.puzzles || [];
    this.dev = devMode();

    this.status = new Map();
    this.views = new Map();
    this.saved = new Map();
    this.sections = new Map();

    for (const gate of this.puzzles) {
      const saved = this.progress.read(gate.cell_id, gate.hash);
      const usable = saved && !saved.reset ? saved : null;
      this.saved.set(gate.cell_id, usable);
      this.status.set(gate.cell_id, usable ? (usable.status || 'open') : 'locked');
      if (saved?.reset) this.wasReset = true;
    }
    this.relock();
  }

  // The frontier is the first puzzle neither solved nor set aside. Everything
  // past it is shut, whatever the store says.
  relock() {
    let past = false;
    for (const gate of this.puzzles) {
      const id = gate.cell_id;
      const status = this.status.get(id);
      if (past) {
        if (status !== 'solved' && status !== 'parked') this.status.set(id, 'locked');
      } else if (status !== 'solved' && status !== 'parked') {
        this.status.set(id, 'open');
        past = true;
      }
    }
  }

  done(id) {
    const s = this.status.get(id);
    return s === 'solved' || s === 'parked';
  }

  allDone() { return this.puzzles.every((g) => this.done(g.cell_id)); }

  // -------------------------------------------------------------------------

  render() {
    this.root.innerHTML = '';
    if (this.dev) this.root.appendChild(this.buildDevBar());
    this.root.appendChild(this.buildHeader());
    if (this.wasReset) {
      this.root.appendChild(notice(
        'One of these puzzles has changed since you were last here, so it has '
        + 'started over. The others are as you left them.',
      ));
      this.wasReset = false;
    }

    this.puzzles.forEach((gate, index) => {
      const section = this.buildPuzzle(gate, index);
      this.sections.set(gate.cell_id, section);
      this.root.appendChild(section);
    });

    this.root.appendChild(this.buildFinale());
    this.typeset(this.root);
    this.updateProgressLabel();
  }

  buildDevBar() {
    const bar = el('div', 'lab-dev');
    const label = el('span', 'lab-dev__label');
    label.textContent = 'Test mode';
    bar.appendChild(label);

    const solveAll = el('button', 'lab-dev__btn');
    solveAll.type = 'button';
    solveAll.textContent = 'Solve everything';
    solveAll.addEventListener('click', () => {
      for (const gate of this.puzzles) {
        if (!this.done(gate.cell_id)) this.solveForTesting(gate.cell_id);
      }
    });
    bar.appendChild(solveAll);

    const wipe = el('button', 'lab-dev__btn');
    wipe.type = 'button';
    wipe.textContent = 'Clear progress';
    wipe.addEventListener('click', () => {
      for (const gate of this.puzzles) {
        try { localStorage.removeItem(this.progress.key(gate.cell_id)); } catch { /* ignore */ }
      }
      window.location?.reload?.();
    });
    bar.appendChild(wipe);

    const off = el('button', 'lab-dev__btn');
    off.type = 'button';
    off.textContent = 'Turn off';
    off.addEventListener('click', () => {
      try { localStorage.setItem(DEV_KEY, ''); } catch { /* ignore */ }
      this.dev = false;
      this.render();
    });
    bar.appendChild(off);
    return bar;
  }

  /** Fill in a puzzle's own solution and submit it. Test mode only. */
  solveForTesting(cellId) {
    const gate = this.puzzles.find((g) => g.cell_id === cellId);
    const view = this.views.get(cellId);
    if (!gate || !view) return;
    view.placements = gate.solution.map((s) => ({ ...s }));
    view.blanks = Object.fromEntries(
      Object.entries(gate.blanks || {}).map(([name, blank]) => [name, blank.answer]),
    );
    view.render();
    view.submit();
  }

  buildHeader() {
    const head = el('header', 'lab-head');
    const h1 = el('h1');
    h1.textContent = this.spec.title;
    head.appendChild(h1);
    if (this.spec.blurb) {
      const p = el('p', 'lab-blurb');
      p.textContent = this.spec.blurb;
      head.appendChild(p);
    }
    if (this.spec.intro_html) {
      const intro = el('div', 'lab-intro');
      intro.innerHTML = this.spec.intro_html;
      head.appendChild(intro);
    }
    this.progressLabel = el('p', 'lab-progress');
    head.appendChild(this.progressLabel);
    return head;
  }

  updateProgressLabel() {
    if (!this.progressLabel) return;
    const total = this.puzzles.length;
    const solved = this.puzzles.filter((g) => this.status.get(g.cell_id) === 'solved').length;
    const parked = this.puzzles.filter((g) => this.status.get(g.cell_id) === 'parked').length;
    const bits = [`${solved} of ${total} done`];
    if (parked) bits.push(`${parked} set aside`);
    this.progressLabel.textContent = bits.join(', ');
  }

  // -------------------------------------------------------------------------
  // One puzzle: what raised the question, what you need, then the puzzle
  // -------------------------------------------------------------------------

  buildPuzzle(gate, index) {
    const section = el('section', 'lab-puzzle-block');
    section.dataset.gate = gate.cell_id;

    const eyebrow = el('p', 'lab-gate__eyebrow');
    eyebrow.textContent = `${index + 1} of ${this.puzzles.length}`;
    section.appendChild(eyebrow);

    const heading = el('h2', 'lab-puzzle-title');
    heading.textContent = gate.title;
    section.appendChild(heading);

    if (this.status.get(gate.cell_id) === 'locked') {
      section.appendChild(this.buildLocked());
      return section;
    }

    if (gate.setup) section.appendChild(this.buildSetup(gate));
    if (gate.brief_html) {
      const brief = el('div', 'lab-brief');
      brief.innerHTML = gate.brief_html;
      section.appendChild(brief);
    }

    section.appendChild(this.buildBoard(gate));
    return section;
  }

  buildLocked() {
    const box = el('div', 'lab-locked');
    box.textContent = 'Opens once the one above is done, or set aside.';
    return box;
  }

  // Where the output is what raises the question, it belongs above the question.
  buildSetup(gate) {
    const box = el('div', 'lab-setup');
    if (gate.setup.intro_html) {
      const intro = el('div', 'lab-setup__text');
      intro.innerHTML = gate.setup.intro_html;
      box.appendChild(intro);
    }
    if (gate.setup.stdout) {
      const out = el('pre', 'lab-out');
      out.textContent = gate.setup.stdout;
      box.appendChild(out);
    }
    for (const src of gate.setup.figures || []) {
      const img = el('img', 'lab-setup__figure');
      img.src = this.base + src;
      img.loading = 'lazy';
      img.alt = 'Output from the notebook';
      box.appendChild(img);
    }
    if (gate.setup.caption_html) {
      const caption = el('div', 'lab-setup__text');
      caption.innerHTML = gate.setup.caption_html;
      box.appendChild(caption);
    }
    return box;
  }

  buildBoard(gate) {
    const id = gate.cell_id;
    const host = el('div', 'lab-gate');
    host.dataset.gate = id;

    if (this.status.get(id) === 'solved') {
      host.appendChild(this.buildSolvedBar(gate, this.saved.get(id)));
      return host;
    }

    let reference;
    try {
      reference = buildReference(gate);
    } catch (err) {
      host.appendChild(notice(`This puzzle could not be set up: ${err.message}`));
      return host;
    }

    if (this.status.get(id) === 'parked') host.appendChild(this.parkedNote());

    const mount = el('div');
    host.appendChild(mount);

    const saved = this.saved.get(id);
    const view = new PuzzleView(mount, gate, {
      state: saved,
      onChange: (state) => this.progress.write(id, gate.hash, { status: this.status.get(id), ...state }),
      onReset: () => this.progress.write(id, gate.hash, { status: 'open', attempts: 0 }),
      onSubmit: (submission) => this.onSubmit(gate, view, reference, submission),
    });
    if (saved?.attempts) view.attempts = saved.attempts;
    view.render();
    this.views.set(id, view);

    if (this.dev) {
      const solve = el('button', 'lab-dev__btn lab-dev__btn--inline');
      solve.type = 'button';
      solve.textContent = 'Solve this one';
      solve.addEventListener('click', () => this.solveForTesting(id));
      host.appendChild(solve);
    }
    return host;
  }

  parkedNote() {
    const note = el('p', 'lab-parked-note');
    note.textContent = 'Set aside. The rest of the lab is open, and this one is still here whenever you want it.';
    return note;
  }

  onSubmit(gate, view, reference, submission) {
    const id = gate.cell_id;
    const verdict = verify(gate, submission, reference);

    if (verdict.ok) {
      view.setFeedback(null);
      view.freeze();
      this.status.set(id, 'solved');
      this.progress.markConcept(gate.concept);
      this.progress.write(id, gate.hash, { status: 'solved', ...view.getState() });
      this.saved.set(id, view.getState());
      this.relock();

      const host = this.root.querySelector(`.lab-gate[data-gate="${id}"]`);
      const reveal = this.buildReveal(gate, view.getSubmission());
      host?.appendChild(reveal);
      this.openNext();
      this.updateProgressLabel();
      this.typeset(reveal);
      reveal.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }

    view.attempts += 1;
    const ladderNote = applyLadder(view, verdict, view.attempts);
    view.setFeedback(buildFeedbackCard(verdict, {
      gate,
      attempts: view.attempts,
      ladderNote,
      onPark: () => this.park(gate, view),
      onCopy: () => attemptSnapshot({ lab: this.spec, gate, view, verdict, attempts: view.attempts }),
    }));
    view.render();
    this.progress.write(id, gate.hash, { status: 'open', ...view.getState() });
  }

  park(gate, view) {
    const id = gate.cell_id;
    this.status.set(id, 'parked');
    this.progress.write(id, gate.hash, { status: 'parked', ...view.getState() });
    this.relock();
    this.openNext();
    this.updateProgressLabel();
    view.setFeedback(null);
    const host = this.root.querySelector(`.lab-gate[data-gate="${id}"]`);
    if (host && !host.querySelector('.lab-parked-note')) host.prepend(this.parkedNote());
  }

  // Swap the "opens once the one above is done" placeholder for the puzzle.
  openNext() {
    this.puzzles.forEach((gate, index) => {
      const id = gate.cell_id;
      if (this.status.get(id) !== 'open') return;
      const section = this.sections.get(id);
      if (!section || !section.querySelector('.lab-locked')) return;
      const fresh = this.buildPuzzle(gate, index);
      this.sections.set(id, fresh);
      section.replaceWith(fresh);
      this.typeset(fresh);
    });
    this.updateFinale();
  }

  // -------------------------------------------------------------------------
  // The reveal
  // -------------------------------------------------------------------------

  buildReveal(gate, submission) {
    const box = el('div', 'lab-solved');
    const head = el('div', 'lab-solved__head');
    head.textContent = 'Solved. Here is the same algorithm in the notebook\u2019s Python.';
    box.appendChild(head);

    const grid = el('div', 'lab-reveal');

    const left = el('div', 'lab-reveal__col');
    const leftHead = el('h4');
    leftHead.textContent = 'What you built';
    left.appendChild(leftHead);

    const rowOf = new Map();
    gate.solution.forEach((step, k) => {
      rowOf.set(step.id, k + 1);
      const block = gate.blocks.find((b) => b.id === step.id);
      block.lines.forEach((line, li) => {
        const row = el('span', 'lab-pair');
        row.dataset.pair = String(k + 1);
        const num = el('span', 'lab-pair__num');
        num.textContent = li === 0 ? `${k + 1}` : '';
        row.appendChild(num);
        const indent = '    '.repeat(step.indent + (line.indent || 0));
        row.appendChild(document.createTextNode(indent + fillBlanks(line.text, submission.blanks)));
        left.appendChild(row);
      });
    });
    grid.appendChild(left);

    const right = el('div', 'lab-reveal__col');
    const rightHead = el('h4');
    rightHead.textContent = 'The Python';
    right.appendChild(rightHead);
    right.appendChild(this.buildPythonPane(gate));
    grid.appendChild(right);

    const notes = el('div', 'lab-reveal__notes');
    if (gate.reveal.some((l) => l.role === 'glue')) {
      const p = el('p');
      p.textContent = 'The greyed lines are housekeeping rather than algorithm, so they were not part of the puzzle.';
      notes.appendChild(p);
    }
    for (const note of gate.annotations || []) {
      const p = el('p');
      const rows = (note.blocks || []).map((bid) => rowOf.get(bid)).filter(Boolean);
      p.textContent = (rows.length ? `Lines ${rows.join(' and ')}. ` : '') + note.text;
      notes.appendChild(p);
    }
    if (notes.children.length) grid.appendChild(notes);

    box.appendChild(grid);
    wirePairing(box);
    return box;
  }

  buildPythonPane(gate) {
    const pane = el('div');
    let docShown = false;
    for (const line of gate.reveal) {
      if (line.role === 'doc') {
        if (!docShown) { docShown = true; pane.appendChild(this.buildDocStub(gate)); }
        continue;
      }
      const row = el('span', 'lab-pair');
      if (line.role === 'block') row.dataset.pair = String(line.num);
      else if (line.role === 'glue' || line.role === 'head') row.classList.add('lab-pair--glue');
      const num = el('span', 'lab-pair__num');
      num.textContent = line.role === 'block' ? String(line.num) : '';
      row.appendChild(num);
      row.appendChild(document.createTextNode(line.text || ' '));
      pane.appendChild(row);
    }
    return pane;
  }

  buildDocStub(gate) {
    const wrap = el('span', 'lab-pair lab-pair--doc');
    wrap.appendChild(el('span', 'lab-pair__num'));
    const toggle = el('button', 'lab-doc-toggle');
    toggle.type = 'button';
    toggle.textContent = 'show the docstring';
    const body = el('div');
    body.hidden = true;
    for (const line of gate.reveal.filter((l) => l.role === 'doc')) {
      const row = el('span', 'lab-pair lab-pair--doc');
      row.appendChild(el('span', 'lab-pair__num'));
      row.appendChild(document.createTextNode(line.text || ' '));
      body.appendChild(row);
    }
    toggle.addEventListener('click', () => {
      body.hidden = !body.hidden;
      toggle.textContent = body.hidden ? 'show the docstring' : 'hide the docstring';
    });
    wrap.appendChild(toggle);
    const frag = document.createDocumentFragment();
    frag.appendChild(wrap);
    frag.appendChild(body);
    return frag;
  }

  buildSolvedBar(gate, saved) {
    const wrap = el('div');
    const bar = el('div', 'lab-solved__head lab-solved__head--bar');
    const label = el('span');
    label.textContent = 'Done';
    bar.appendChild(label);
    const toggle = el('button', 'lab-doc-toggle');
    toggle.type = 'button';
    toggle.textContent = 'show what you built';
    bar.appendChild(toggle);
    wrap.appendChild(bar);

    let reveal = null;
    toggle.addEventListener('click', () => {
      if (!reveal) {
        reveal = this.buildReveal(gate, {
          placements: saved?.placements ?? gate.solution,
          blanks: saved?.blanks ?? {},
        });
        wrap.appendChild(reveal);
        this.typeset(reveal);
      }
      reveal.hidden = !reveal.hidden;
      toggle.textContent = reveal.hidden ? 'show what you built' : 'hide what you built';
    });
    return wrap;
  }

  // -------------------------------------------------------------------------

  buildFinale() {
    const card = el('section', 'lab-finale');
    const h2 = el('h2');
    h2.textContent = 'The notebook';
    card.appendChild(h2);
    const p = el('p');
    p.textContent = 'The notebook has the plots, the sliders and the code to '
      + 'change. It opens in Google Colab. Edits there are not saved back here, '
      + 'so use File then Save a copy in Drive to keep them.';
    card.appendChild(p);
    this.launch = el('a', 'lab-launch');
    this.launch.setAttribute('href', this.spec.colab);
    this.launch.target = '_blank';
    this.launch.rel = 'noopener';
    this.launch.textContent = 'Open the notebook';
    card.appendChild(this.launch);
    this.finaleNote = el('p', 'lab-progress');
    card.appendChild(this.finaleNote);
    this.updateFinale();
    return card;
  }

  updateFinale() {
    if (!this.launch) return;
    const left = this.puzzles.filter((g) => !this.done(g.cell_id)).length;
    if (left) {
      this.launch.setAttribute('aria-disabled', 'true');
      this.launch.removeAttribute('href');
      this.finaleNote.textContent = left === 1 ? 'One puzzle to go.' : `${left} puzzles to go.`;
    } else {
      this.launch.removeAttribute('aria-disabled');
      this.launch.setAttribute('href', this.spec.colab);
      this.finaleNote.textContent = '';
    }
  }

  typeset(node) {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([node]).catch(() => { /* leave the source visible */ });
    }
  }
}

// ---------------------------------------------------------------------------

function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function fillBlanks(text, blanks) {
  return text.replace(/⟨\?([^⟩]+)⟩/g, (_, name) => (blanks?.[name.trim()] ?? '⟨?⟩'));
}

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Hovering or focusing either side of a pair lights both. Screen readers get
// the pairing as text on each row, since hover is not available to them.
function wirePairing(scope) {
  const rows = scope.querySelectorAll('.lab-pair[data-pair]');
  const setPair = (pair, on) => {
    scope.querySelectorAll(`.lab-pair[data-pair="${pair}"]`)
      .forEach((n) => n.classList.toggle('is-paired', on));
  };
  rows.forEach((row) => {
    row.tabIndex = 0;
    const pair = row.dataset.pair;
    row.setAttribute('aria-label', `Line ${pair}: ${row.textContent.trim()}`);
    row.addEventListener('mouseenter', () => setPair(pair, true));
    row.addEventListener('mouseleave', () => setPair(pair, false));
    row.addEventListener('focus', () => setPair(pair, true));
    row.addEventListener('blur', () => setPair(pair, false));
  });
}

function notice(message) {
  const box = el('div', 'lab-locked');
  box.textContent = message;
  return box;
}
