/* Concept map engine.
 *
 * A map is a fixed diagram of concepts with numbered, unlabelled arrows. Each
 * arrow asks three things in order:
 *
 *   1. Write your own sentence for it. Never graded, never sent anywhere, but it
 *      has to be there before step 2 opens. Recognising the right answer in a
 *      list is much easier than producing it, and the produced version is the one
 *      worth having.
 *   2. Does the relationship hold, fail, or is it an equivalence? On paper the
 *      line style gives this away before the student reads anything, so here the
 *      style is hidden until the arrow is named.
 *   3. Pick the statement out of a shared bank holding every arrow's statement.
 *      The distractors are the other real answers, so there is nothing to author
 *      and no pattern to exploit. A solved statement leaves the bank.
 *
 * The whole map is visible from the start. It is not revealed outward from a
 * start node, because the closing question asks which single arrow matters most
 * and that cannot be answered without seeing the shape.
 *
 * Geometry is authored, not computed: coordinates come from the tikz the print
 * worksheet is drawn with. Node boxes are measured after MathJax typesets, and
 * the edges are clipped to the measured borders, so a long label cannot leave an
 * arrow hanging in the middle of a box.
 */

const STORE_VERSION = 1;
const MIN_NOTE = 15;

export const KINDS = {
  implies: { word: 'It holds', label: 'holds', ask: 'The source establishes the target.' },
  fails: { word: 'It fails', label: 'fails', ask: 'The implication is false in this direction.' },
  equiv: { word: 'They are equivalent', label: 'equivalent', ask: 'Each one implies the other.' },
  caution: { word: 'It holds, but not on the hypotheses you would guess', label: 'different hypotheses', ask: 'It holds, but its hypotheses are not the ones its neighbours use.' }
};

const KIND_ORDER = ['implies', 'fails', 'equiv', 'caution'];

/* -----------------------------------------------------------------------------
 * Small utilities
 * -------------------------------------------------------------------------- */

/** A cheap stable string hash. Used to stamp saved progress and to seed the shuffle. */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** The fingerprint saved progress is stamped with. An edited map discards it. */
export function stampOf(data) {
  const parts = data.edges.map((e) => [e.n, e.from, e.to, e.kind, e.statement].join(''));
  return hashString(parts.join(''));
}

/**
 * Deterministic shuffle. The bank has to keep one order across reloads, or a
 * student who comes back finds the list rearranged and has to re-read all of it.
 */
export function seededShuffle(items, seed) {
  const out = items.slice();
  let state = 0;
  for (let i = 0; i < seed.length; i++) state = (Math.imul(state, 31) + seed.charCodeAt(i)) >>> 0;
  const next = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const spare = out[i]; out[i] = out[j]; out[j] = spare;
  }
  return out;
}

/* -----------------------------------------------------------------------------
 * Geometry
 * -------------------------------------------------------------------------- */

/**
 * Where the segment from (cx, cy) toward (tx, ty) leaves the box of half-width
 * `hw` and half-height `hh` centred at (cx, cy), pushed out by `gap`.
 */
export function clipToBox(cx, cy, tx, ty, hw, hh, gap) {
  const dx = tx - cx;
  const dy = ty - cy;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: cx, y: cy };
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const s = Math.min(sx, sy) + (gap || 0) / len;
  return { x: cx + dx * s, y: cy + dy * s };
}

/** The control point of the quadratic curve, offset perpendicular to the chord. */
export function controlPoint(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  if (!bend) return { x: mx, y: my };
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx - (dy / len) * bend, y: my + (dx / len) * bend };
}

/** A point on the quadratic Bezier. */
export function bezierAt(t, p0, c, p1) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y
  };
}

/** The unit tangent of the quadratic Bezier, pointing along increasing t. */
export function tangentAt(t, p0, c, p1) {
  const u = 1 - t;
  const dx = 2 * (u * (c.x - p0.x) + t * (p1.x - c.x));
  const dy = 2 * (u * (c.y - p0.y) + t * (p1.y - c.y));
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** The three points of a filled arrowhead sitting at `tip` and pointing along `dir`. */
export function arrowHead(tip, dir, size) {
  const back = { x: tip.x - dir.x * size, y: tip.y - dir.y * size };
  const half = size * 0.42;
  const nx = -dir.y * half;
  const ny = dir.x * half;
  return `M ${tip.x} ${tip.y} L ${back.x + nx} ${back.y + ny} L ${back.x - nx} ${back.y - ny} Z`;
}

/* -----------------------------------------------------------------------------
 * Progress
 * -------------------------------------------------------------------------- */

export class Progress {
  constructor(mapId, stamp, storage) {
    this.key = `cmap:${STORE_VERSION}:${mapId}`;
    this.stamp = stamp;
    this.store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    this.state = { stamp, solved: [], notes: {}, reflection: '' };
    this.load();
  }

  load() {
    if (!this.store) return;
    try {
      const raw = this.store.getItem(this.key);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // A map whose arrows have been edited invalidates its own saved answers
      // rather than restoring them against the wrong questions.
      if (saved && saved.stamp === this.stamp) {
        this.state = {
          stamp: this.stamp,
          solved: Array.isArray(saved.solved) ? saved.solved : [],
          notes: saved.notes && typeof saved.notes === 'object' ? saved.notes : {},
          reflection: typeof saved.reflection === 'string' ? saved.reflection : ''
        };
      }
    } catch (e) { /* a corrupt or unreadable store just means no progress */ }
  }

  save() {
    if (!this.store) return;
    try { this.store.setItem(this.key, JSON.stringify(this.state)); } catch (e) { /* full or blocked */ }
  }

  isSolved(n) { return this.state.solved.indexOf(n) !== -1; }

  solve(n) {
    if (!this.isSolved(n)) { this.state.solved.push(n); this.save(); }
  }

  note(n, text) {
    if (text === undefined) return this.state.notes[String(n)] || '';
    this.state.notes[String(n)] = text;
    this.save();
    return text;
  }

  reflection(text) {
    if (text === undefined) return this.state.reflection;
    this.state.reflection = text;
    this.save();
    return text;
  }

  clear() {
    this.state = { stamp: this.stamp, solved: [], notes: {}, reflection: '' };
    this.save();
  }
}

/* -----------------------------------------------------------------------------
 * Rendering
 * -------------------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
}

function typeset(target) {
  const mj = typeof window === 'undefined' ? null : window.MathJax;
  if (mj && mj.typesetPromise) return mj.typesetPromise([target]).catch(() => {});
  if (mj && mj.startup && mj.startup.promise) {
    return mj.startup.promise.then(() => mj.typesetPromise([target])).catch(() => {});
  }
  return Promise.resolve();
}

export class MapView {
  constructor(root, data) {
    this.root = root;
    this.data = data;
    this.progress = new Progress(data.id, stampOf(data));
    this.nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    this.active = null;
    this.tries = new Map();
    this.scale = 1;
    this.build();
  }

  /* ---- markup ---------------------------------------------------------- */

  build() {
    const d = this.data;
    this.root.textContent = '';

    this.root.appendChild(el('h1', null, d.title));

    const intro = el('p', 'cm-intro');
    intro.innerHTML = d.intro;
    this.root.appendChild(intro);

    // Status bar
    const status = el('div', 'cm-status');
    this.countEl = el('span', 'cm-count');
    status.appendChild(this.countEl);

    // The same worksheet on paper, generated from this same data by
    // tools/author/maptex.py. No `download` attribute: opening it in the browser's
    // own viewer and saving from there is friendlier than forcing a file.
    if (d.pdf) {
      const paper = el('a', 'cm-btn', 'Paper version (PDF)');
      paper.href = d.pdf;
      paper.target = '_blank';
      paper.rel = 'noopener';
      status.appendChild(paper);
    }
    const clear = el('button', 'cm-btn', 'Start over');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      this.progress.clear();
      this.tries.clear();
      this.active = null;
      this.refresh();
    });
    const zoom = el('div', 'cm-zoom');
    for (const [label, factor] of [['Smaller', 0.85], ['Larger', 1.18], ['Fit', 0]]) {
      const b = el('button', 'cm-btn', label);
      b.type = 'button';
      b.addEventListener('click', () => (factor ? this.setScale(this.scale * factor) : this.fit()));
      zoom.appendChild(b);
    }
    zoom.appendChild(clear);
    status.appendChild(zoom);
    this.root.appendChild(status);

    // Diagram
    this.frame = el('div', 'cm-frame');
    this.stage = el('div', 'cm-stage');
    this.stage.style.width = d.width + 'px';
    this.stage.style.height = d.height + 'px';
    this.svg = svgEl('svg', { class: 'cm-edges', width: d.width, height: d.height });
    this.stage.appendChild(this.svg);

    this.nodeEls = new Map();
    for (const n of d.nodes) {
      const box = el('div', 'cm-node');
      box.style.left = n.x + 'px';
      box.style.top = n.y + 'px';
      box.type = 'button';
      box.setAttribute('role', 'button');
      box.tabIndex = 0;
      box.innerHTML = (n.letter ? `<span class="cm-node__letter">${n.letter}</span>` : '') +
        n.label.replace(/\n/g, '<br>');
      const show = () => this.showDefinition(n);
      box.addEventListener('click', show);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(); }
      });
      this.stage.appendChild(box);
      this.nodeEls.set(n.id, box);
    }

    this.edgeEls = new Map();
    for (const e of d.edges) {
      const path = svgEl('path', { class: 'cm-edge' });
      this.svg.appendChild(path);
      const head = svgEl('path', { class: 'cm-edge', 'stroke-width': 0 });
      this.svg.appendChild(head);
      const tail = svgEl('path', { class: 'cm-edge', 'stroke-width': 0 });
      this.svg.appendChild(tail);
      const cross = svgEl('text', { class: 'cm-cross', 'text-anchor': 'middle' });
      cross.textContent = '×';
      this.svg.appendChild(cross);

      const badge = el('button', 'cm-badge', String(e.n));
      badge.type = 'button';
      badge.addEventListener('click', () => this.open(e.n));
      this.stage.appendChild(badge);

      this.edgeEls.set(e.n, { path, head, tail, cross, badge });
    }

    this.frame.appendChild(this.stage);
    this.root.appendChild(this.frame);

    // Legend. The words matter as much as the colours.
    const legend = el('div', 'cm-legend');
    for (const kind of KIND_ORDER) {
      const item = el('div', 'cm-legend__item');
      const sample = el('span', 'cm-legend__sample cm-legend__sample--' + kind);
      sample.style.borderTopStyle = kind === 'fails' ? 'dashed' : kind === 'caution' ? 'dotted' : 'solid';
      sample.style.borderTopColor = `var(--cm-${kind})`;
      item.append(sample, el('span', null, KINDS[kind].label));
      legend.appendChild(item);
    }
    const idle = el('div', 'cm-legend__item');
    const idleSample = el('span', 'cm-legend__sample');
    idleSample.style.borderTopColor = 'var(--cm-idle)';
    idle.append(idleSample, el('span', null, 'not named yet'));
    legend.appendChild(idle);
    this.root.appendChild(legend);

    // Work panel
    this.work = el('div', 'cm-work cm-panel');
    this.root.appendChild(this.work);

    // Named list
    this.named = el('div', 'cm-named');
    this.root.appendChild(this.named);

    // Inventory and benchmarks
    this.root.appendChild(this.inventoryFold());
    if (d.benchmarks && d.benchmarks.length) this.root.appendChild(this.benchmarkFold());

    // Reflection, hidden until the map is finished
    this.done = el('div', 'cm-done cm-panel');
    this.done.hidden = true;
    this.root.appendChild(this.done);

    typeset(this.root).then(() => this.layout());
    this.refresh();

    // MathJax finishing, a font arriving, or a window resize all change a node's
    // measured box, and every arrow is clipped to those boxes.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.layout());
      for (const box of this.nodeEls.values()) ro.observe(box);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.fit());
      this.fit();
    }
  }

  inventoryFold() {
    const fold = el('details', 'cm-fold');
    fold.appendChild(el('summary', null, 'What each box means'));
    const body = el('div', 'cm-fold__body');
    const dl = document.createElement('dl');
    for (const n of this.data.nodes) {
      const dt = el('dt');
      dt.innerHTML = (n.letter ? n.letter + '. ' : '') + n.label.replace(/\n/g, ' ');
      const dd = el('dd');
      dd.innerHTML = n.definition || '';
      dl.append(dt, dd);
    }
    body.appendChild(dl);
    fold.appendChild(body);
    return fold;
  }

  benchmarkFold() {
    const fold = el('details', 'cm-fold');
    fold.appendChild(el('summary', null, 'Examples worth keeping to hand'));
    const body = el('div', 'cm-fold__body');
    const ul = document.createElement('ul');
    for (const item of this.data.benchmarks) {
      const li = el('li');
      li.innerHTML = item;
      ul.appendChild(li);
    }
    body.appendChild(ul);
    fold.appendChild(body);
    return fold;
  }

  /* ---- geometry -------------------------------------------------------- */

  layout() {
    for (const e of this.data.edges) {
      const parts = this.edgeEls.get(e.n);
      const from = this.nodeEls.get(e.from);
      const to = this.nodeEls.get(e.to);
      if (!parts || !from || !to) continue;

      const a = this.nodeById.get(e.from);
      const b = this.nodeById.get(e.to);
      // offsetWidth is layout px, so the stage transform does not enter here and
      // the whole calculation stays in authored coordinates.
      const ahw = from.offsetWidth / 2;
      const ahh = from.offsetHeight / 2;
      const bhw = to.offsetWidth / 2;
      const bhh = to.offsetHeight / 2;

      const bend = e.bend || 0;
      const ctrl = controlPoint(a.x, a.y, b.x, b.y, bend);
      const p0 = clipToBox(a.x, a.y, ctrl.x, ctrl.y, ahw, ahh, 3);
      const p1 = clipToBox(b.x, b.y, ctrl.x, ctrl.y, bhw, bhh, 5);
      const c = controlPoint(p0.x, p0.y, p1.x, p1.y, bend);

      parts.path.setAttribute('d', `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`);

      const solved = this.progress.isSolved(e.n);
      const kindCls = solved ? ' cm-edge--' + e.kind : '';
      const activeCls = this.active === e.n ? ' cm-edge--active' : '';
      parts.path.setAttribute('class', 'cm-edge' + kindCls + activeCls);

      // Heads only once the arrow is named. Before that every arrow is drawn the
      // same way, so the drawing cannot answer step 2 for the student.
      if (solved) {
        const dirEnd = tangentAt(1, p0, c, p1);
        parts.head.setAttribute('d', arrowHead(p1, dirEnd, 11));
        parts.head.setAttribute('class', 'cm-edge cm-edge--' + e.kind);
        parts.head.setAttribute('fill', `var(--cm-${e.kind})`);
        parts.head.setAttribute('stroke-width', '0');
        if (e.kind === 'equiv') {
          const dirStart = tangentAt(0, p0, c, p1);
          parts.tail.setAttribute('d', arrowHead(p0, { x: -dirStart.x, y: -dirStart.y }, 11));
          parts.tail.setAttribute('fill', `var(--cm-${e.kind})`);
          parts.tail.setAttribute('stroke-width', '0');
        } else {
          parts.tail.setAttribute('d', '');
        }
        if (e.kind === 'fails') {
          const at = bezierAt(0.55, p0, c, p1);
          parts.cross.setAttribute('x', at.x);
          parts.cross.setAttribute('y', at.y + 5);
          parts.cross.style.display = '';
        } else {
          parts.cross.style.display = 'none';
        }
      } else {
        parts.head.setAttribute('d', '');
        parts.tail.setAttribute('d', '');
        parts.cross.style.display = 'none';
      }

      const at = bezierAt(typeof e.at === 'number' ? e.at : 0.5, p0, c, p1);
      parts.badge.style.left = at.x + 'px';
      parts.badge.style.top = at.y + 'px';
    }
  }

  setScale(next) {
    this.scale = Math.max(0.4, Math.min(1.6, next));
    this.stage.style.transform = `scale(${this.scale})`;
    // The frame's scrollable area is the untransformed box unless it is told the
    // scaled size, so a scaled-up map would be clipped rather than scrollable.
    this.stage.style.marginRight = (this.data.width * (this.scale - 1)) + 'px';
    this.stage.style.marginBottom = (this.data.height * (this.scale - 1)) + 'px';
  }

  /** Scale so the whole width fits the frame, never enlarging past 1. */
  fit() {
    const room = this.frame.clientWidth - 12;
    if (room > 0) this.setScale(Math.min(1, room / this.data.width));
  }

  /* ---- the answer panel ------------------------------------------------ */

  showDefinition(node) {
    for (const [id, box] of this.nodeEls) box.classList.toggle('cm-node--lit', id === node.id);
    this.active = null;
    this.layout();
    this.work.textContent = '';
    const head = el('div', 'cm-step__head');
    head.appendChild(el('span', 'cm-step__num', 'Box ' + (node.letter || '')));
    const ask = el('span', 'cm-step__ask');
    ask.innerHTML = node.label.replace(/\n/g, ' ');
    head.appendChild(ask);
    this.work.appendChild(head);
    const body = el('p', 'cm-ends');
    body.innerHTML = node.definition || '';
    this.work.appendChild(body);
    const back = el('p', 'cm-hint', 'Click a numbered circle to name the arrow it sits on.');
    this.work.appendChild(back);
    typeset(this.work);
    this.paintBadges();
  }

  open(n) {
    this.active = n;
    for (const box of this.nodeEls.values()) box.classList.remove('cm-node--lit');
    const edge = this.data.edges.find((e) => e.n === n);
    this.nodeEls.get(edge.from).classList.add('cm-node--lit');
    this.nodeEls.get(edge.to).classList.add('cm-node--lit');
    this.layout();
    this.paintBadges();
    this.renderPanel(edge);
  }

  renderPanel(edge) {
    const solved = this.progress.isSolved(edge.n);
    const from = this.nodeById.get(edge.from);
    const to = this.nodeById.get(edge.to);
    this.work.textContent = '';

    const head = el('div', 'cm-step__head');
    head.appendChild(el('span', 'cm-step__num', 'Arrow ' + edge.n));
    const ends = el('span', 'cm-step__ask');
    ends.innerHTML = `${from.label.replace(/\n/g, ' ')} → ${to.label.replace(/\n/g, ' ')}`;
    head.appendChild(ends);
    this.work.appendChild(head);

    if (solved) {
      const v = el('p', 'cm-verdict cm-verdict--ok');
      v.innerHTML = `<strong>${KINDS[edge.kind].label}.</strong> ${edge.statement}`;
      this.work.appendChild(v);
      if (edge.why) {
        const why = el('p', 'cm-hint');
        why.innerHTML = edge.why;
        this.work.appendChild(why);
      }
      const mine = this.progress.note(edge.n);
      if (mine) {
        const own = el('p', 'cm-hint');
        own.innerHTML = '<strong>What you wrote:</strong> ' + mine.replace(/</g, '&lt;');
        this.work.appendChild(own);
      }
      typeset(this.work);
      return;
    }

    // Step 1: write it yourself.
    const step1 = el('div', 'cm-step');
    const h1 = el('div', 'cm-step__head');
    h1.appendChild(el('span', 'cm-step__num', 'Step 1'));
    h1.appendChild(el('span', 'cm-step__ask', 'Say what this arrow claims, in one sentence.'));
    step1.appendChild(h1);
    const area = el('textarea', 'cm-note');
    area.value = this.progress.note(edge.n);
    area.setAttribute('aria-label', 'Your sentence for arrow ' + edge.n);
    step1.appendChild(area);
    const ready = el('button', 'cm-btn cm-btn--primary', 'That is my answer');
    ready.type = 'button';
    ready.style.marginTop = '0.5rem';
    step1.appendChild(ready);
    const note1 = el('p', 'cm-hint', 'Nobody marks this and it never leaves your browser. Writing it before you see the list is the part that does the work.');
    step1.appendChild(note1);
    this.work.appendChild(step1);

    const rest = el('div');
    rest.hidden = area.value.trim().length < MIN_NOTE;
    this.work.appendChild(rest);

    ready.addEventListener('click', () => {
      const text = area.value.trim();
      if (text.length < MIN_NOTE) {
        note1.className = 'cm-verdict cm-verdict--no';
        note1.textContent = 'Write a sentence first, even a rough one. A guess you have committed to is what makes the list below useful.';
        return;
      }
      this.progress.note(edge.n, text);
      note1.className = 'cm-hint';
      note1.textContent = 'Saved on this machine. You can keep editing it.';
      rest.hidden = false;
    });

    // Step 2: which kind.
    const step2 = el('div', 'cm-step');
    const h2 = el('div', 'cm-step__head');
    h2.appendChild(el('span', 'cm-step__num', 'Step 2'));
    h2.appendChild(el('span', 'cm-step__ask', 'Does the relationship hold?'));
    step2.appendChild(h2);
    const kindBox = el('div', 'cm-choices');
    step2.appendChild(kindBox);
    const kindVerdict = el('p', 'cm-hint', 'The line style is hidden until you have named the arrow, so this is a real question here even though the printed worksheet gives it away.');
    step2.appendChild(kindVerdict);
    rest.appendChild(step2);

    const step3 = el('div', 'cm-step');
    step3.hidden = true;
    const h3 = el('div', 'cm-step__head');
    h3.appendChild(el('span', 'cm-step__num', 'Step 3'));
    h3.appendChild(el('span', 'cm-step__ask', 'Now find your sentence in the list.'));
    step3.appendChild(h3);
    const bankBox = el('div', 'cm-choices');
    step3.appendChild(bankBox);
    const bankVerdict = el('p', 'cm-hint');
    step3.appendChild(bankVerdict);
    rest.appendChild(step3);

    for (const kind of KIND_ORDER) {
      const b = el('button', 'cm-choice', KINDS[kind].word);
      b.type = 'button';
      b.addEventListener('click', () => {
        if (kind === edge.kind) {
          kindVerdict.className = 'cm-verdict cm-verdict--ok';
          kindVerdict.textContent = KINDS[kind].ask;
          for (const other of kindBox.children) other.disabled = true;
          b.classList.add('cm-choice--spent');
          step3.hidden = false;
        } else {
          this.bump(edge.n);
          kindVerdict.className = 'cm-verdict cm-verdict--no';
          kindVerdict.textContent = 'Not that. Look at what the source alone gives you, and ask whether a counterexample is available.';
          b.classList.add('cm-choice--spent');
        }
      });
      kindBox.appendChild(b);
    }

    for (const item of this.bank()) {
      const b = el('button', 'cm-choice');
      b.type = 'button';
      b.innerHTML = item.statement;
      b.addEventListener('click', () => {
        if (item.n === edge.n) {
          this.progress.solve(edge.n);
          this.refresh();
          this.renderPanel(edge);
          return;
        }
        this.bump(edge.n);
        b.classList.add('cm-choice--spent');
        bankVerdict.className = 'cm-verdict cm-verdict--no';
        // A decoy is not on the map at all, and saying so is a different piece of
        // information from "you have the wrong arrow".
        bankVerdict.innerHTML = (this.tries.get(edge.n) || 0) >= 2 && edge.hint
          ? edge.hint
          : item.n === null
            ? 'That sentence is not true. Find the false step in it before you move on.'
            : 'That one belongs to a different arrow. Check which two boxes it is about.';
      });
      bankBox.appendChild(b);
    }

    typeset(this.work);
  }

  bump(n) {
    this.tries.set(n, (this.tries.get(n) || 0) + 1);
  }

  /**
   * Every statement not yet placed, plus the decoys, in one stable order.
   *
   * The decoys never leave. Without them the last arrow is answered by
   * elimination, since a solved statement is taken out, and a map that hands over
   * its final answer has stopped asking anything.
   */
  bank() {
    const open = this.data.edges.filter((e) => !this.progress.isSolved(e.n));
    const items = open.map((e) => ({ n: e.n, statement: e.statement }));
    for (const decoy of this.data.decoys || []) items.push({ n: null, statement: decoy });
    return seededShuffle(items, this.progress.stamp);
  }

  /* ---- redraw ---------------------------------------------------------- */

  paintBadges() {
    for (const e of this.data.edges) {
      const badge = this.edgeEls.get(e.n).badge;
      const solved = this.progress.isSolved(e.n);
      badge.className = 'cm-badge' +
        (solved ? ' cm-badge--solved is-' + e.kind : '') +
        (this.active === e.n ? ' cm-badge--active' : '');
      badge.setAttribute('aria-label', solved
        ? `Arrow ${e.n}, named, ${KINDS[e.kind].label}`
        : `Arrow ${e.n}, not named yet`);
    }
  }

  refresh() {
    const total = this.data.edges.length;
    const count = this.data.edges.filter((e) => this.progress.isSolved(e.n)).length;
    this.countEl.textContent = `${count} of ${total} arrows named`;
    this.paintBadges();
    this.layout();
    this.renderNamed();
    this.renderDone(count === total);
    if (this.active === null && !this.work.textContent) this.renderIdle();
  }

  renderIdle() {
    this.work.textContent = '';
    const p = el('p', 'cm-work__idle', 'Click a numbered circle on the map to start. Click a box to see what it means.');
    this.work.appendChild(p);
  }

  renderNamed() {
    this.named.textContent = '';
    this.named.appendChild(el('h2', null, 'The arrows you have named'));
    const ol = document.createElement('ol');
    for (const e of this.data.edges) {
      const li = el('li');
      li.value = e.n;
      if (this.progress.isSolved(e.n)) {
        li.innerHTML = `<span class="cm-named__kind is-${e.kind}">${KINDS[e.kind].label}</span>${e.statement}` +
          (e.why ? `<span class="cm-named__why">${e.why}</span>` : '');
      } else {
        li.className = 'cm-named__todo';
        li.textContent = 'not named yet';
      }
      ol.appendChild(li);
    }
    this.named.appendChild(ol);
    typeset(this.named);
  }

  renderDone(complete) {
    this.done.hidden = !complete;
    if (!complete || this.done.dataset.built === '1') return;
    this.done.dataset.built = '1';
    this.done.appendChild(el('h2', null, 'One last question'));
    const lede = el('p', 'cm-done__lede');
    lede.innerHTML = this.data.reflection;
    this.done.appendChild(lede);
    const area = el('textarea', 'cm-note');
    area.value = this.progress.reflection();
    area.setAttribute('aria-label', 'Your answer to the closing question');
    area.addEventListener('input', () => this.progress.reflection(area.value));
    this.done.appendChild(area);
    this.done.appendChild(el('p', 'cm-hint', 'Saved on this machine, like your sentences above. Bring it to class if you want to argue about it.'));
    typeset(this.done);
  }
}

/** Fetch a map's data and mount it. */
export async function mountMap(root, dataUrl) {
  const res = await fetch(dataUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load the map (${res.status})`);
  const data = await res.json();
  return new MapView(root, data);
}
