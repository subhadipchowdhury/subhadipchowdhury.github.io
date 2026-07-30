// The lab page: a notebook read top to bottom, with its algorithms gated.
//
// Cells unlock in order. Prose stays readable ahead of the frontier, except
// prose marked `defer`, which would answer the puzzle below it, and except a
// demo cell, which would print the answer. Nothing here ever shows a solution:
// a puzzle that will not come out can be parked, and the Python behind it is
// then only in the notebook at the end.

import { PuzzleView } from './puzzle.js';
import { buildReference, verify } from './verify.js';
import { buildFeedbackCard, applyLadder, attemptSnapshot, ladderStage } from './feedback.js';

const STORE_VERSION = 1;

export async function mountLab(root, specUrl) {
  const response = await fetch(specUrl, { cache: 'no-cache' });
  if (!response.ok) {
    root.appendChild(errorCard(`The lab could not be loaded (${response.status}).`, specUrl));
    return null;
  }
  const spec = await response.json();
  const lab = new LabController(root, spec, specUrl);
  lab.render();
  return lab;
}

// ---------------------------------------------------------------------------
// Stored progress
// ---------------------------------------------------------------------------
//
// Keyed per gate, not per lab, and stamped with that gate's hash. Fixing a typo
// in one puzzle therefore resets that puzzle and leaves the rest of a student's
// work alone.

class Progress {
  constructor(labId) {
    this.labId = labId;
  }

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

  clear(cellId) {
    try { localStorage.removeItem(this.key(cellId)); } catch { /* ignore */ }
  }

  markConcept(name) {
    if (!name) return;
    try {
      localStorage.setItem(`concept:${STORE_VERSION}:${name}`, JSON.stringify({
        lab: this.labId, at: new Date().toISOString().slice(0, 10),
      }));
    } catch { /* ignore */ }
  }

  hasConcept(name) {
    try { return !!localStorage.getItem(`concept:${STORE_VERSION}:${name}`); } catch { return false; }
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

class LabController {
  constructor(root, spec, specUrl) {
    this.root = root;
    this.spec = spec;
    this.base = specUrl.replace(/specs\/[^/]*$/, '');
    this.progress = new Progress(spec.lab_id);

    this.gates = spec.cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.gate);

    this.status = new Map(); // cell_id -> 'locked' | 'open' | 'parked' | 'solved'
    this.views = new Map();
    this.saved = new Map();

    for (const { cell } of this.gates) {
      const gate = cell.gate;
      const saved = this.progress.read(gate.cell_id, gate.hash);
      this.saved.set(gate.cell_id, saved && !saved.reset ? saved : null);
      this.status.set(gate.cell_id, saved && !saved.reset ? (saved.status || 'open') : 'locked');
      if (saved?.reset) this.wasReset = true;
    }
    this.relock();
  }

  // The frontier is the first gate that is neither solved nor parked; every
  // gate after it is locked, whatever the store says.
  relock() {
    let frontierPassed = false;
    for (const { cell } of this.gates) {
      const id = cell.gate.cell_id;
      const status = this.status.get(id);
      if (frontierPassed) {
        if (status !== 'solved' && status !== 'parked') this.status.set(id, 'locked');
      } else if (status !== 'solved' && status !== 'parked') {
        this.status.set(id, 'open');
        frontierPassed = true;
      }
    }
  }

  done(cellId) {
    const s = this.status.get(cellId);
    return s === 'solved' || s === 'parked';
  }

  allDone() {
    return this.gates.every(({ cell }) => this.done(cell.gate.cell_id));
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  render() {
    this.root.innerHTML = '';
    this.root.appendChild(this.buildHeader());
    if (this.wasReset) {
      this.root.appendChild(errorCard(
        'One of these puzzles changed since you were last here, so its saved progress was cleared. The others are as you left them.',
      ));
      this.wasReset = false;
    }

    this.cellNodes = [];
    this.spec.cells.forEach((cell, index) => {
      const node = this.buildCell(cell, index);
      if (node) {
        this.root.appendChild(node);
        this.cellNodes[index] = node;
      }
    });

    this.root.appendChild(this.buildFinale());
    this.typeset(this.root);
    this.updateProgressLabel();
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
    this.progressLabel = el('p', 'lab-progress');
    head.appendChild(this.progressLabel);
    return head;
  }

  updateProgressLabel() {
    if (!this.progressLabel) return;
    const total = this.gates.length;
    const solved = this.gates.filter(({ cell }) => this.status.get(cell.gate.cell_id) === 'solved').length;
    const parked = this.gates.filter(({ cell }) => this.status.get(cell.gate.cell_id) === 'parked').length;
    const bits = [`${solved} of ${total} puzzle${total === 1 ? '' : 's'} solved`];
    if (parked) bits.push(`${parked} parked`);
    this.progressLabel.textContent = bits.join(', ');
  }

  buildCell(cell, index) {
    if (cell.kind === 'markdown') return this.buildMarkdownCell(cell, index);
    return this.buildCodeCell(cell, index);
  }

  buildMarkdownCell(cell, index) {
    const wrap = el('section', 'lab-cell');

    if (cell.mode === 'defer' && !this.done(cell.until)) {
      const bar = el('div', 'lab-defer');
      const glyph = el('span', 'lab-defer__glyph');
      glyph.textContent = '▸';
      glyph.setAttribute('aria-hidden', 'true');
      bar.appendChild(glyph);
      const text = el('span');
      text.textContent = `${cell.heading} · opens with the puzzle below`;
      bar.appendChild(text);
      wrap.appendChild(bar);
      wrap.dataset.deferUntil = cell.until;
      return wrap;
    }

    const body = el('div', 'lab-prose');
    body.innerHTML = cell.html;
    wrap.appendChild(body);
    if (cell.mode === 'defer') wrap.dataset.deferUntil = cell.until;
    return wrap;
  }

  buildCodeCell(cell, index) {
    // The setup cell has nothing to say to a reader.
    if (cell.quiet) return null;

    const wrap = el('section', 'lab-cell');
    wrap.dataset.cell = String(index);

    if (cell.mode === 'gated') {
      wrap.appendChild(this.buildGate(cell, index));
      return wrap;
    }

    // A demo cell prints the answer to the puzzle it demonstrates.
    if (cell.demo_for && !this.done(cell.demo_for)) {
      wrap.hidden = true;
      wrap.dataset.demoFor = cell.demo_for;
      return wrap;
    }

    wrap.appendChild(this.buildCode(cell));
    return wrap;
  }

  buildCode(cell) {
    const frag = document.createDocumentFragment();
    const pre = el('pre', 'lab-code');
    const code = el('code');
    code.textContent = cell.python;
    pre.appendChild(code);
    frag.appendChild(pre);
    if (cell.stdout) {
      const out = el('pre', 'lab-out');
      out.textContent = cell.stdout;
      frag.appendChild(out);
    }
    if (cell.figures?.length) frag.appendChild(this.buildFigures(cell));
    return frag;
  }

  buildFigures(cell) {
    const strip = el('div', 'lab-figures');
    for (const fig of cell.figures) {
      const figure = el('figure', 'lab-figure');
      const img = el('img');
      img.src = this.base + fig.src;
      img.loading = 'lazy';
      img.alt = fig.caption || 'Figure from this cell';
      figure.appendChild(img);
      const caption = el('figcaption');
      caption.textContent = cell.static_frames && fig === cell.figures[cell.figures.length - 1]
        ? `${fig.caption}${fig.caption ? '. ' : ''}These are static frames; the sliders are in the notebook you open at the end.`
        : fig.caption;
      if (caption.textContent) figure.appendChild(caption);
      strip.appendChild(figure);
    }
    return strip;
  }

  // -------------------------------------------------------------------------
  // Gates
  // -------------------------------------------------------------------------

  buildGate(cell, index) {
    const gate = cell.gate;
    const id = gate.cell_id;
    const status = this.status.get(id);
    const host = el('div', 'lab-gate');
    host.dataset.gate = id;

    if (status === 'locked') {
      host.appendChild(this.buildLocked(gate));
      return host;
    }

    if (status === 'solved') {
      const saved = this.saved.get(id);
      host.appendChild(this.buildSolvedBar(cell, saved));
      return host;
    }

    const mount = el('div');
    host.appendChild(mount);

    let reference;
    try {
      reference = buildReference(gate);
    } catch (err) {
      host.appendChild(errorCard(`This puzzle could not be prepared: ${err.message}`));
      return host;
    }

    const saved = this.saved.get(id);
    const view = new PuzzleView(mount, gate, {
      state: saved,
      onChange: (state) => {
        this.progress.write(id, gate.hash, { status: this.status.get(id), ...state });
      },
      onReset: () => {
        this.progress.write(id, gate.hash, { status: 'open', attempts: 0 });
      },
      onSubmit: (submission) => this.onSubmit(cell, view, reference, submission),
    });
    if (saved?.attempts) view.attempts = saved.attempts;
    if (status === 'parked') {
      const bar = el('p', 'lp-feedback__hint');
      bar.textContent = 'Parked. The rest of the lab is open; this puzzle is still here whenever you want it.';
      host.insertBefore(bar, mount);
    }
    view.render();
    this.views.set(id, view);
    return host;
  }

  buildLocked(gate) {
    const box = el('div', 'lab-locked');
    box.textContent = `${gate.title} — opens when the puzzle above is done.`;
    return box;
  }

  onSubmit(cell, view, reference, submission) {
    const gate = cell.gate;
    const id = gate.cell_id;
    const verdict = verify(gate, submission, reference);

    if (verdict.ok) {
      view.setFeedback(null);
      view.freeze();
      this.status.set(id, 'solved');
      this.progress.markConcept(gate.concept);
      this.progress.write(id, gate.hash, {
        status: 'solved', ...view.getState(),
      });
      this.saved.set(id, view.getState());
      this.relock();

      const host = this.root.querySelector(`.lab-gate[data-gate="${id}"]`);
      const reveal = this.buildReveal(cell, view.getSubmission());
      host?.appendChild(reveal);
      this.openDeferred(id);
      this.showDemo(id);
      this.openNextGate();
      this.updateProgressLabel();
      this.typeset(reveal);
      reveal.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }

    view.attempts += 1;
    const ladderNote = applyLadder(view, verdict, view.attempts);
    view.setFeedback(buildFeedbackCard(verdict, {
      gate,
      attempts: view.attempts,
      ladderNote,
      onPark: () => this.park(cell, view),
      onCopy: () => attemptSnapshot({
        lab: this.spec, gate, view, verdict, attempts: view.attempts,
      }),
    }));
    view.render();
    this.progress.write(id, gate.hash, { status: 'open', ...view.getState() });
  }

  park(cell, view) {
    const id = cell.gate.cell_id;
    this.status.set(id, 'parked');
    this.progress.write(id, cell.gate.hash, { status: 'parked', ...view.getState() });
    this.relock();
    this.openDeferred(id);
    this.openNextGate();
    this.updateProgressLabel();
    view.setFeedback(null);
    const host = this.root.querySelector(`.lab-gate[data-gate="${id}"]`);
    if (host && !host.querySelector('.lab-parked-note')) {
      const note = el('p', 'lp-feedback__hint lab-parked-note');
      note.textContent = 'Parked. The rest of the lab is open, and this puzzle stays here for when you come back to it.';
      host.prepend(note);
    }
  }

  // A deferred markdown cell opens in place once the puzzle it answers is done.
  openDeferred(gateId) {
    this.spec.cells.forEach((cell, index) => {
      if (cell.kind !== 'markdown' || cell.mode !== 'defer' || cell.until !== gateId) return;
      const node = this.cellNodes[index];
      if (!node) return;
      node.innerHTML = '';
      const body = el('div', 'lab-prose');
      body.innerHTML = cell.html;
      node.appendChild(body);
      this.typeset(body);
    });
  }

  showDemo(gateId) {
    this.spec.cells.forEach((cell, index) => {
      if (cell.demo_for !== gateId) return;
      const node = this.cellNodes[index];
      if (!node || !node.hidden) return;
      node.hidden = false;
      node.appendChild(this.buildCode(cell));
    });
  }

  openNextGate() {
    for (const { cell, index } of this.gates) {
      const id = cell.gate.cell_id;
      const node = this.cellNodes[index];
      if (!node) continue;
      const host = node.querySelector(`.lab-gate[data-gate="${id}"]`);
      if (!host) continue;
      if (this.status.get(id) === 'open' && host.querySelector('.lab-locked')) {
        host.innerHTML = '';
        const fresh = this.buildGate(cell, index);
        host.replaceWith(fresh);
      }
    }
    this.updateFinale();
  }

  // -------------------------------------------------------------------------
  // The reveal
  // -------------------------------------------------------------------------

  buildReveal(cell, submission) {
    const gate = cell.gate;
    const box = el('div', 'lab-solved');

    const head = el('div', 'lab-solved__head');
    head.textContent = '✓ Solved. Your algorithm, and the Python that implements it.';
    box.appendChild(head);

    const grid = el('div', 'lab-reveal');

    const left = el('div', 'lab-reveal__col');
    const leftHead = el('h4');
    leftHead.textContent = 'Your pseudocode';
    left.appendChild(leftHead);
    const rowOf = new Map();
    gate.solution.forEach((step, k) => {
      rowOf.set(step.id, k + 1);
      const block = [...gate.blocks].find((b) => b.id === step.id);
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
    rightHead.textContent = 'The implementation';
    right.appendChild(rightHead);
    right.appendChild(this.buildPythonPane(gate));
    grid.appendChild(right);

    const notes = el('div', 'lab-reveal__notes');
    notes.appendChild(this.buildGlueNote(gate));
    for (const note of gate.annotations || []) {
      const p = el('p');
      const rows = (note.blocks || []).map((id) => rowOf.get(id)).filter(Boolean);
      const label = rows.length ? `${rows.map((n) => `${n}`).join(' and ')}. ` : '';
      p.textContent = label + note.text;
      notes.appendChild(p);
    }
    grid.appendChild(notes);
    box.appendChild(grid);

    if (cell.stdout || cell.figures?.length) {
      const out = el('div', 'lab-reveal__output');
      box.appendChild(out);
    }

    wirePairing(box);
    return box;
  }

  buildPythonPane(gate) {
    const pane = el('div');
    let docStart = null;

    for (const line of gate.reveal) {
      if (line.role === 'doc') {
        if (docStart === null) {
          docStart = line.n;
          pane.appendChild(this.buildDocStub(gate));
        }
        continue;
      }
      const row = el('span', 'lab-pair');
      if (line.role === 'block') {
        row.dataset.pair = String(line.num);
      } else if (line.role === 'glue' || line.role === 'head') {
        row.classList.add('lab-pair--glue');
      }
      const num = el('span', 'lab-pair__num');
      num.textContent = line.role === 'block' ? String(line.num) : '';
      row.appendChild(num);
      row.appendChild(document.createTextNode(line.text || ' '));
      pane.appendChild(row);
    }
    return pane;
  }

  // The docstring would swamp the pairing, so it collapses to a stub. In this
  // notebook it is worth opening at least once.
  buildDocStub(gate) {
    const wrap = el('span', 'lab-pair lab-pair--doc');
    const num = el('span', 'lab-pair__num');
    wrap.appendChild(num);
    const toggle = el('button', 'lab-doc-toggle');
    toggle.type = 'button';
    toggle.textContent = '"""…""" show documentation';
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
      toggle.textContent = body.hidden ? '"""…""" show documentation' : '"""…""" hide documentation';
    });
    wrap.appendChild(toggle);
    const frag = document.createDocumentFragment();
    frag.appendChild(wrap);
    frag.appendChild(body);
    return frag;
  }

  buildGlueNote(gate) {
    const p = el('p');
    const count = gate.reveal.filter((l) => l.role === 'glue').length;
    p.textContent = count
      ? 'The dimmed lines are bookkeeping rather than algorithm, which is why you did not assemble them.'
      : 'Every line of the implementation pairs with a line you assembled.';
    return p;
  }

  buildSolvedBar(cell, saved) {
    const wrap = el('div');
    const bar = el('div', 'lab-solved__head');
    bar.style.borderRadius = '8px';
    const label = el('span');
    label.textContent = `✓ ${cell.gate.title}`;
    bar.appendChild(label);
    const toggle = el('button', 'lab-doc-toggle');
    toggle.type = 'button';
    toggle.textContent = 'show what you built';
    toggle.style.marginLeft = 'auto';
    bar.appendChild(toggle);
    wrap.appendChild(bar);

    let reveal = null;
    toggle.addEventListener('click', () => {
      if (!reveal) {
        reveal = this.buildReveal(cell, {
          placements: saved?.placements ?? cell.gate.solution,
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
  // Finale
  // -------------------------------------------------------------------------

  buildFinale() {
    const card = el('section', 'lab-finale');
    const h2 = el('h2');
    h2.textContent = 'Open the notebook';
    card.appendChild(h2);
    const p = el('p');
    p.textContent = 'The whole notebook, with the sliders live and every cell yours to edit, runs in Google Colab. Nothing is installed, and your changes are not saved back here, so use File then Save a copy in Drive to keep them.';
    card.appendChild(p);
    this.launch = el('a', 'lab-launch');
    this.launch.setAttribute('href', this.spec.colab);
    this.launch.target = '_blank';
    this.launch.rel = 'noopener';
    this.launch.textContent = '▶ Launch in Colab';
    card.appendChild(this.launch);
    this.finaleNote = el('p', 'lab-progress');
    card.appendChild(this.finaleNote);
    this.finaleCard = card;
    this.updateFinale();
    return card;
  }

  updateFinale() {
    if (!this.launch) return;
    const left = this.gates.filter(({ cell }) => !this.done(cell.gate.cell_id)).length;
    if (left) {
      this.launch.setAttribute('aria-disabled', 'true');
      this.launch.removeAttribute('href');
      this.finaleNote.textContent = `${left} puzzle${left === 1 ? '' : 's'} still to go.`;
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
// Helpers
// ---------------------------------------------------------------------------

function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function fillBlanks(text, blanks) {
  return text.replace(/⟨\?([^⟩]+)⟩/g, (_, name) => (blanks?.[name.trim()] ?? '⟨?⟩'));
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Hovering or focusing either side of a pair lights both, and the pairing is
// also exposed to a screen reader as text, since hover is not available there.
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

function errorCard(message, detail) {
  const box = el('div', 'lab-locked');
  box.textContent = message;
  if (detail) {
    const small = el('p');
    small.style.fontSize = '0.8em';
    small.textContent = detail;
    box.appendChild(small);
  }
  return box;
}
