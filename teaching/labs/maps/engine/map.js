/* Concept map engine.
 *
 * A map is a fixed diagram of concepts with numbered arrows and nothing written on
 * them, and a scrambled list of every sentence that belongs on one. The exercise is
 * to put each sentence on its arrow: click an arrow, click the sentence, and the
 * numbered blank fills in and the sentence leaves the list.
 *
 * The list is given in full from the start. It used to be a reward for solving the
 * first arrow, which protected nothing, because solving one arrow showed a student
 * everything and they could copy it. Dip: "might as well give the full list from the
 * get go." What the list cannot give away is which sentence goes with which arrow,
 * and that assignment is the whole exercise.
 *
 * Two steps that used to come before the matching are gone. Writing your own
 * sentence first could not be graded, so requiring it only added a click. And
 * choosing whether the relationship held or failed collapsed when the failing arrows
 * were rewritten: every arrow now holds in the direction drawn, so there is nothing
 * to ask. See the note by KINDS.
 *
 * The scrambled list also carries a few false claims that never leave it. Without
 * them the last arrow is answered by elimination, since a placed sentence is
 * removed, and a wrong pick out of that group earns a different message from a wrong
 * pick out of the real ones.
 *
 * Geometry is authored, not computed: coordinates come from the tikz the printed
 * worksheet is drawn with, and tools/author/maptex.py draws the paper version from
 * the same three points this file draws from. Node boxes are measured after MathJax
 * typesets and the arrows are clipped to the measured borders, so a long label
 * cannot leave an arrow hanging in the middle of a box.
 */

/* The two kinds of arrow. The kind decides whether the arrow gets one head or two.
 *
 * There were four. `caution`, for a theorem whose hypotheses are not the ones its
 * neighbours use, was cut as vague. `fails` went when the four arrows using it were
 * rewritten as the relationships they are: each was a real relationship stated
 * backwards, and "terms tending to zero does not give convergence" is the
 * contrapositive of a theorem that runs the other way.
 */
export const KINDS = {
  holds: { label: 'one way' },
  equiv: { label: 'both ways' }
};

const STORE_VERSION = 3;

/** A cheap stable string hash, for the scramble seed and the progress stamp. */
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
  const parts = data.edges.map((e) => [e.n, e.from, e.to, e.statement].join(''));
  return hashString(parts.join('') + (data.mistakes || []).join(''));
}

/**
 * Deterministic shuffle.
 *
 * The list has to hold one order across reloads and across every render. Reshuffling
 * when a sentence is placed would move everything a student had already read past,
 * which is why this is seeded rather than random.
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

/**
 * Which arrows have been matched, kept across a reload.
 *
 * Placing sixteen sentences takes a while, so losing it to an accidental reload is
 * worth avoiding. Nothing else is stored and nothing leaves the browser.
 */
export class Progress {
  constructor(mapId, stamp, storage) {
    this.key = `cmap:${STORE_VERSION}:${mapId}`;
    this.stamp = stamp;
    this.store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    this.placed = new Set();
    this.load();
  }

  load() {
    if (!this.store) return;
    try {
      const saved = JSON.parse(this.store.getItem(this.key) || 'null');
      // A map whose sentences have been edited discards its own saved answers
      // rather than restoring them against the wrong arrows.
      if (saved && saved.stamp === this.stamp && Array.isArray(saved.placed)) {
        this.placed = new Set(saved.placed);
      }
    } catch (e) { /* a corrupt or unreadable store just means no progress */ }
  }

  save() {
    if (!this.store) return;
    try {
      this.store.setItem(this.key, JSON.stringify({ stamp: this.stamp, placed: [...this.placed] }));
    } catch (e) { /* full or blocked */ }
  }

  has(n) { return this.placed.has(n); }
  add(n) { this.placed.add(n); this.save(); }
  clear() { this.placed.clear(); this.save(); }
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
    this.nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    this.progress = new Progress(data.id, stampOf(data));
    // The arrow a picked sentence will go to. Nothing can be placed until one is
    // chosen, so this is the first click of every pair.
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

    if (d.pdf) this.root.appendChild(this.paperCallout());

    const status = el('div', 'cm-status');
    this.countEl = el('span', 'cm-count');
    status.appendChild(this.countEl);
    const zoom = el('div', 'cm-zoom');
    for (const [label, factor] of [['Smaller', 0.85], ['Larger', 1.18], ['Fit', 0]]) {
      const b = el('button', 'cm-btn', label);
      b.type = 'button';
      b.addEventListener('click', () => (factor ? this.setScale(this.scale * factor) : this.fit()));
      zoom.appendChild(b);
    }
    const over = el('button', 'cm-btn', 'Start over');
    over.type = 'button';
    over.addEventListener('click', () => {
      this.progress.clear();
      this.tries.clear();
      this.active = null;
      this.render();
    });
    zoom.appendChild(over);
    status.appendChild(zoom);
    this.root.appendChild(status);

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
      const head = svgEl('path', { class: 'cm-arrowhead' });
      this.svg.appendChild(head);
      const tail = svgEl('path', { class: 'cm-arrowhead' });
      this.svg.appendChild(tail);

      const badge = el('button', 'cm-badge', String(e.n));
      badge.type = 'button';
      badge.addEventListener('click', () => this.pick(e.n));
      this.stage.appendChild(badge);

      this.edgeEls.set(e.n, { path, head, tail, badge });
    }

    this.frame.appendChild(this.stage);
    this.root.appendChild(this.frame);

    const legend = el('div', 'cm-legend');
    for (const [text, both] of [['one way', false], ['both ways', true]]) {
      const item = el('div', 'cm-legend__item');
      item.append(el('span', 'cm-legend__sample' + (both ? ' cm-legend__sample--both' : '')),
                  el('span', null, text));
      legend.appendChild(item);
    }
    this.root.appendChild(legend);

    this.work = el('div', 'cm-work cm-panel');
    this.work.appendChild(el('p', 'cm-work__body',
      'Click an arrow on the map, then click the sentence that belongs on it.'));
    this.root.appendChild(this.work);

    // The numbered sheet and the scrambled list, side by side on a wide screen.
    const board = el('div', 'cm-board');
    this.sheetEl = el('ol', 'cm-sheet');
    const sheetCol = el('div', 'cm-board__col');
    sheetCol.appendChild(el('h2', null, 'The arrows'));
    sheetCol.appendChild(this.sheetEl);
    const listCol = el('div', 'cm-board__col');
    listCol.appendChild(el('h2', null, 'The sentences'));
    listCol.appendChild(el('p', 'cm-hint',
      'Click an arrow on the map or a numbered line, then click the sentence that ' +
      'belongs on it. A few of these are false and belong nowhere.'));
    this.listEl = el('div', 'cm-list');
    listCol.appendChild(this.listEl);
    board.append(sheetCol, listCol);
    this.root.appendChild(board);

    // Every answer, for a student who is stuck. It fills the sheet in rather than
    // printing a second copy of it somewhere else.
    const giveUp = el('details', 'cm-fold');
    giveUp.appendChild(el('summary', null, 'Fill in the ones I have not got'));
    const giveBody = el('div', 'cm-fold__body');
    giveBody.appendChild(el('p', 'cm-hint',
      'This places every remaining sentence. The reason behind each one is worth ' +
      'reading even when the sentence was handed to you.'));
    const giveBtn = el('button', 'cm-btn', 'Fill them all in');
    giveBtn.type = 'button';
    giveBtn.addEventListener('click', () => this.revealAll());
    giveBody.appendChild(giveBtn);
    giveUp.appendChild(giveBody);
    this.root.appendChild(giveUp);

    this.root.appendChild(this.inventoryFold());
    if (d.benchmarks && d.benchmarks.length) this.root.appendChild(this.benchmarkFold());

    this.render();
    typeset(this.root).then(() => this.layout());

    // MathJax finishing, a font arriving, or a resize all change a node's measured
    // box, and every arrow is clipped to those boxes.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.layout());
      for (const box of this.nodeEls.values()) ro.observe(box);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.fit());
      this.fit();
    }
  }

  /** The worksheet, up front, because that is where the work is meant to happen. */
  paperCallout() {
    const box = el('div', 'cm-paper');
    const lede = el('p', 'cm-paper__lede');
    lede.innerHTML = 'Start on paper if you can. The worksheet has the same diagram ' +
      'with room to write your own sentence for each arrow, which is harder than ' +
      'picking one off a list and worth more to you.';
    box.appendChild(lede);
    const link = el('a', 'cm-btn cm-btn--primary', 'The worksheet (PDF)');
    link.href = this.data.pdf;
    link.target = '_blank';
    link.rel = 'noopener';
    box.appendChild(link);
    return box;
  }

  plainLabel(node) {
    return node.label.replace(/\n/g, ' ');
  }

  inventoryFold() {
    const fold = el('details', 'cm-fold');
    fold.appendChild(el('summary', null, 'What each box means'));
    const body = el('div', 'cm-fold__body');
    const dl = document.createElement('dl');
    for (const n of this.data.nodes) {
      const dt = el('dt');
      dt.innerHTML = (n.letter ? n.letter + '. ' : '') + this.plainLabel(n);
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
    fold.appendChild(el('summary', null, 'Counterexamples and benchmarks'));
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
      const bend = e.bend || 0;
      const ctrl = controlPoint(a.x, a.y, b.x, b.y, bend);
      const p0 = clipToBox(a.x, a.y, ctrl.x, ctrl.y, from.offsetWidth / 2, from.offsetHeight / 2, 3);
      const p1 = clipToBox(b.x, b.y, ctrl.x, ctrl.y, to.offsetWidth / 2, to.offsetHeight / 2, 5);
      const c = controlPoint(p0.x, p0.y, p1.x, p1.y, bend);

      parts.path.setAttribute('d', `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`);
      parts.path.setAttribute('class', 'cm-edge' +
        (this.progress.has(e.n) ? ' cm-edge--shown' : '') +
        (this.active === e.n ? ' cm-edge--active' : ''));

      // Every arrow keeps its head. Nothing is being withheld: the direction is the
      // information the diagram is for.
      const dirEnd = tangentAt(1, p0, c, p1);
      parts.head.setAttribute('d', arrowHead(p1, dirEnd, 10));
      if (e.kind === 'equiv') {
        const dirStart = tangentAt(0, p0, c, p1);
        parts.tail.setAttribute('d', arrowHead(p0, { x: -dirStart.x, y: -dirStart.y }, 10));
      } else {
        parts.tail.setAttribute('d', '');
      }
      const headCls = 'cm-arrowhead' +
        (this.progress.has(e.n) ? ' cm-arrowhead--shown' : '') +
        (this.active === e.n ? ' cm-arrowhead--active' : '');
      parts.head.setAttribute('class', headCls);
      parts.tail.setAttribute('class', headCls);

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

  /* ---- the panel ------------------------------------------------------- */

  showDefinition(node) {
    for (const [id, box] of this.nodeEls) box.classList.toggle('cm-node--lit', id === node.id);
    this.active = null;
    this.work.textContent = '';

    const head = el('div', 'cm-work__head');
    head.appendChild(el('span', 'cm-work__tag', 'Box ' + (node.letter || '')));
    const name = el('span', 'cm-work__name');
    name.innerHTML = this.plainLabel(node);
    head.appendChild(name);
    this.work.appendChild(head);

    const body = el('p', 'cm-work__body');
    body.innerHTML = node.definition || '';
    this.work.appendChild(body);

    typeset(this.work);
    this.render();
  }

  /**
   * Choose the arrow the next picked sentence belongs to.
   *
   * An arrow that is already filled in shows what was put on it and why, so this is
   * both the first half of a match and the way to read back an answer.
   */
  pick(n) {
    const edge = this.data.edges.find((e) => e.n === n);
    if (!edge) return;
    this.active = n;

    for (const box of this.nodeEls.values()) box.classList.remove('cm-node--lit');
    this.nodeEls.get(edge.from).classList.add('cm-node--lit');
    this.nodeEls.get(edge.to).classList.add('cm-node--lit');

    this.work.textContent = '';
    const head = el('div', 'cm-work__head');
    head.appendChild(el('span', 'cm-work__tag', 'Arrow ' + edge.n));
    const ends = el('span', 'cm-work__name');
    ends.innerHTML = `${this.plainLabel(this.nodeById.get(edge.from))} → ` +
      `${this.plainLabel(this.nodeById.get(edge.to))}` +
      (edge.kind === 'equiv' ? ' <em>(and back)</em>' : '');
    head.appendChild(ends);
    this.work.appendChild(head);

    if (this.progress.has(n)) {
      const body = el('p', 'cm-work__body');
      body.innerHTML = edge.statement;
      this.work.appendChild(body);
      if (edge.why) {
        const why = el('p', 'cm-hint');
        why.innerHTML = edge.why;
        this.work.appendChild(why);
      }
    } else {
      this.work.appendChild(el('p', 'cm-work__body',
        'Now click the sentence that belongs on this arrow.'));
    }

    typeset(this.work);
    this.render();
  }

  /** Try a sentence against the chosen arrow. */
  offer(item, button) {
    if (this.active === null) {
      this.say('Choose an arrow first, on the map or in the numbered list.', false);
      return;
    }
    const edge = this.data.edges.find((e) => e.n === this.active);
    if (this.progress.has(edge.n)) {
      this.say(`Arrow ${edge.n} is already filled in. Choose another arrow.`, false);
      return;
    }

    if (item.n === edge.n) {
      this.progress.add(edge.n);
      this.active = null;
      this.render();
      this.pick(edge.n);
      return;
    }

    this.tries.set(edge.n, (this.tries.get(edge.n) || 0) + 1);
    button.classList.add('cm-option--spent');
    // A sentence that belongs to no arrow earns a different answer from one that
    // belongs to a different arrow.
    this.say(item.n === null
      ? 'That sentence is false. Find the step in it that fails.'
      : `That one belongs on another arrow. Check which two boxes arrow ${edge.n} joins.`, false);
  }

  say(message, ok) {
    const note = el('p', ok ? 'cm-verdict cm-verdict--ok' : 'cm-verdict cm-verdict--no', message);
    const old = this.work.querySelector ? this.work.querySelector('.cm-verdict') : null;
    if (old) old.remove();
    this.work.appendChild(note);
  }

  /** Fill in every arrow that is still empty. */
  revealAll() {
    for (const e of this.data.edges) this.progress.add(e.n);
    this.active = null;
    this.render();
  }

  /* ---- redraw ---------------------------------------------------------- */

  /** Everything the placed set decides: the badges, the sheet, the list, the count. */
  render() {
    for (const e of this.data.edges) {
      const badge = this.edgeEls.get(e.n).badge;
      const done = this.progress.has(e.n);
      badge.className = 'cm-badge' + (done ? ' cm-badge--shown' : '') +
        (this.active === e.n ? ' cm-badge--active' : '');
      badge.setAttribute('aria-label', `Arrow ${e.n}` + (done ? ', filled in' : ', empty'));
    }

    const total = this.data.edges.length;
    const done = this.progress.placed.size;
    this.countEl.textContent = `${done} of ${total} arrows filled in`;

    this.renderSheet();
    this.renderList();
    this.layout();
  }

  /** The numbered lines, blank until their sentence is placed. */
  renderSheet() {
    this.sheetEl.textContent = '';
    for (const e of this.data.edges) {
      const li = el('li', 'cm-sheet__row' + (this.active === e.n ? ' is-active' : ''));
      li.value = e.n;
      const slot = el('button', 'cm-slot' + (this.progress.has(e.n) ? ' cm-slot--full' : ''));
      slot.type = 'button';
      if (this.progress.has(e.n)) slot.innerHTML = e.statement;
      else slot.textContent = 'empty';
      slot.addEventListener('click', () => this.pick(e.n));
      li.appendChild(slot);
      this.sheetEl.appendChild(li);
    }
    typeset(this.sheetEl);
  }

  /**
   * The scrambled sentences that are still unplaced, plus the false ones.
   *
   * The order comes from a seed, so placing a sentence removes one line and moves
   * nothing else. A fresh shuffle on every render would rearrange everything a
   * student had already read past.
   */
  renderList() {
    this.listEl.textContent = '';
    const items = this.bank();
    if (items.length === 0) {
      this.listEl.appendChild(el('p', 'cm-hint', 'Every sentence is placed.'));
      return;
    }
    for (const item of items) {
      const b = el('button', 'cm-option');
      b.type = 'button';
      b.innerHTML = item.statement;
      b.addEventListener('click', () => this.offer(item, b));
      this.listEl.appendChild(b);
    }
    typeset(this.listEl);
  }

  /**
   * Unplaced sentences and the false ones, in one stable scrambled order.
   *
   * The whole list is scrambled first and the placed ones are filtered out after.
   * Scrambling the shorter list instead reorders all of it: Fisher-Yates on n-1
   * items draws a different permutation from the same seed, so every placement
   * rearranged the page. There is a test for this.
   */
  bank() {
    const all = this.data.edges.map((e) => ({ n: e.n, statement: e.statement }));
    for (const m of this.data.mistakes || []) all.push({ n: null, statement: m });
    return seededShuffle(all, this.progress.stamp)
      .filter((i) => i.n === null || !this.progress.has(i.n));
  }
}

/** Fetch a map's data and mount it. */
export async function mountMap(root, dataUrl) {
  const res = await fetch(dataUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load the map (${res.status})`);
  const data = await res.json();
  return new MapView(root, data);
}
