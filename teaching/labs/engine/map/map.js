/* Concept map engine.
 *
 * A map is a fixed set of concepts as boxes, and a scrambled list of sentences, each
 * of which names the relationship one arrow between two of those boxes carries. The
 * arrows are not on the page. A claim is three choices: the sentence and the two
 * boxes it runs between, in either order. Get all three right and the arrow is drawn,
 * in its authored direction, with its head and its number, and it stays.
 *
 * So a student rebuilds the diagram rather than annotating one. That is the change of
 * 2026-09-10, and the reason for it: with all sixteen arrows drawn from the first
 * paint, a student who half knows the chapter can place a sentence by looking at
 * which two boxes an arrow already joins. The structure was given away, and the
 * structure is what an exam asks for.
 *
 * Which of the two boxes the relationship starts at is **not** asked. Dip's call on
 * 2026-09-10, the same day the arrows came off the page: picking the two ideas a
 * sentence joins is the recall being trained, and making a student also nominate the
 * hypothesis turned every claim into two questions, one of which a wrong guess
 * punishes twice. The drawn arrow still carries its head, so the direction is
 * something the map tells you rather than something it examines.
 *
 * The list is given in full from the start. It used to be a reward for solving the
 * first arrow, which protected nothing, because solving one arrow showed a student
 * everything and they could copy it. Dip: "might as well give the full list from the
 * get go." What the list cannot give away is which two boxes a sentence joins.
 *
 * Two steps that used to come before the matching are gone. Writing your own
 * sentence first could not be graded, so requiring it only added a click; the printed
 * worksheet is where that happens now. And choosing whether the relationship held or
 * failed collapsed when the failing arrows were rewritten: every arrow now holds in
 * the direction drawn, so there is nothing to ask. See the note by KINDS.
 *
 * The scrambled list also carries a few false claims that never leave it. Without
 * them the last arrow is answered by elimination, since a placed sentence is
 * removed, and a wrong pick out of that group earns a different message from a real
 * sentence put in the wrong place.
 *
 * Geometry is authored, not computed: coordinates come from the tikz the printed
 * worksheet is drawn with, and tools/author/maptex.py draws the paper version from
 * the same three points this file draws from. Node boxes are measured after MathJax
 * typesets and the arrows are clipped to the measured borders, so a long label
 * cannot leave an arrow hanging in the middle of a box.
 */

/* The two kinds of arrow. The kind decides whether the arrow gets one head or two.
 * It has no part in grading: a claim names two boxes and not an order, so `holds` and
 * `equiv` are graded identically.
 *
 * There were four. `caution`, for a theorem whose hypotheses are not the ones its
 * neighbours use, was cut as vague. `fails` went when the four arrows using it were
 * rewritten as the relationships they are: each was a real relationship stated
 * backwards, and "terms tending to zero does not give convergence" is the
 * contrapositive of a theorem that runs the other way.
 */
export const KINDS = {
  holds: { label: 'one way' },
  equiv: { label: 'both ways', both: true }
};

/** Does this kind of arrow get a head at each end? */
function bothWays(kind) {
  return !!(KINDS[kind] && KINDS[kind].both);
}

// 4 since 2026-09-10. A saved set of arrow numbers meant "matched" under the old
// exercise and means "built" under this one, and a student halfway through the old
// one has no sensible state here, so the bump discards it.
const STORE_VERSION = 4;

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
 * Which arrows have been drawn, kept across a reload.
 *
 * Building sixteen arrows takes a while, so losing it to an accidental reload is
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
  const s = Math.min(sx, sy);
  const out = (s * len + gap) / len;
  return { x: cx + dx * out, y: cy + dy * out };
}

/** The control point of the quadratic curve, offset perpendicular to the chord. */
export function controlPoint(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  if (!bend) return { x: mx, y: my };
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx + (-dy / len) * bend, y: my + (dx / len) * bend };
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
  const x = 2 * (1 - t) * (c.x - p0.x) + 2 * t * (p1.x - c.x);
  const y = 2 * (1 - t) * (c.y - p0.y) + 2 * t * (p1.y - c.y);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

/** The three points of a filled arrowhead sitting at `tip` and pointing along `dir`. */
export function arrowHead(tip, dir, size) {
  const back = { x: tip.x - dir.x * size, y: tip.y - dir.y * size };
  const nx = -dir.y * size * 0.42;
  const ny = dir.x * size * 0.42;
  return `M ${tip.x} ${tip.y} L ${back.x + nx} ${back.y + ny} L ${back.x - nx} ${back.y - ny} Z`;
}

/* -----------------------------------------------------------------------------
 * Markup helpers
 * -------------------------------------------------------------------------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function svgEl(tag, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
}

function typeset(target) {
  const mj = typeof window !== 'undefined' ? window.MathJax : null;
  if (mj && mj.typesetPromise) return mj.typesetPromise([target]).catch(() => {});
  return Promise.resolve();
}

export class MapView {
  constructor(root, data) {
    this.root = root;
    this.data = data;
    this.nodeById = new Map(data.nodes.map((n) => [n.id, n]));
    this.progress = new Progress(data.id, stampOf(data));

    // The claim under construction: a sentence and up to two boxes. `boxes` is a
    // list rather than a from/to pair because the order is not part of the claim.
    // Nothing is graded until all three parts are chosen, in any order.
    this.sel = { item: null, boxes: [] };
    // The last box clicked, whose definition sits under the claim, and the last
    // arrow drawn, whose reason sits there when no claim is open.
    this.lastNode = null;
    this.shownEdge = null;
    this.msg = null;

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
      this.clearClaim();
      this.shownEdge = null;
      this.lastNode = null;
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

    // The claim, drawn dashed between the two chosen boxes. First into the SVG, so
    // an arrow that has been earned always wins the pixel. No head on it: a head
    // would show a direction, and the claim does not carry one.
    this.ghost = svgEl('path', { class: 'cm-ghost' });
    this.svg.appendChild(this.ghost);

    this.nodeEls = new Map();
    for (const n of d.nodes) {
      const box = el('div', 'cm-node');
      box.style.left = n.x + 'px';
      box.style.top = n.y + 'px';
      box.setAttribute('role', 'button');
      box.tabIndex = 0;
      box.innerHTML = (n.letter ? `<span class="cm-node__letter">${n.letter}</span>` : '') +
        n.label.replace(/\n/g, '<br>');
      const hit = () => this.tapNode(n);
      box.addEventListener('click', hit);
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); }
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

      // The badge exists from the start and is shown once its arrow is drawn.
      // Reading an answer back is all it does now: it cannot be the way in to
      // answering, because until the arrow is built there is nothing on the map to
      // click.
      const badge = el('button', 'cm-badge', String(e.n));
      badge.type = 'button';
      badge.hidden = true;
      badge.addEventListener('click', () => this.showEdge(e.n));
      this.stage.appendChild(badge);

      this.edgeEls.set(e.n, { path, head, tail, badge });
    }

    this.frame.appendChild(this.stage);
    this.root.appendChild(this.frame);

    // Built from KINDS, so the legend cannot end up naming a kind the engine does
    // not draw. It used to hold its own copy of the same two labels.
    const legend = el('div', 'cm-legend');
    for (const kind of Object.keys(KINDS)) {
      const item = el('div', 'cm-legend__item');
      item.append(el('span', 'cm-legend__sample' + (bothWays(kind) ? ' cm-legend__sample--both' : '')),
                  el('span', null, KINDS[kind].label));
      legend.appendChild(item);
    }
    this.root.appendChild(legend);

    this.work = el('div', 'cm-work cm-panel');
    this.root.appendChild(this.work);

    // Both columns are open from the start. The sentences come first and take the
    // wider track: they are what a student acts on, and the column beside them is
    // empty until an arrow has been drawn.
    //
    // There used to be a Start matching button hiding all of this, so that a student
    // who had come to look at the shape of the chapter saw the shape first. There is
    // no shape to see until the work is done, so there is nothing left to hide it
    // for.
    const board = el('div', 'cm-board');
    const listCol = el('div', 'cm-board__col');
    listCol.appendChild(el('h2', null, 'The sentences'));
    listCol.appendChild(el('p', 'cm-hint',
      'Click a sentence, then the two boxes it connects. A few of them are false, ' +
      'so they belong nowhere on the map.'));
    this.listEl = el('div', 'cm-list');
    listCol.appendChild(this.listEl);
    this.foundEl = el('div', 'cm-found');
    const foundCol = el('div', 'cm-board__col');
    foundCol.appendChild(el('h2', null, 'Arrows you have drawn'));
    foundCol.appendChild(this.foundEl);
    board.append(listCol, foundCol);
    this.root.appendChild(board);

    // Every answer, for a student who is stuck. It draws the arrows rather than
    // printing a second copy of the sentences somewhere else.
    const giveUp = el('details', 'cm-fold');
    this.giveUp = giveUp;
    giveUp.appendChild(el('summary', null, "Draw the arrows I haven't found"));
    const giveBody = el('div', 'cm-fold__body');
    giveBody.appendChild(el('p', 'cm-hint',
      "This draws every arrow that's left and puts its sentence on it. Read the " +
      "reason on each one, including the ones you didn't get."));
    const giveBtn = el('button', 'cm-btn', 'Draw them all');
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
    lede.innerHTML = "Start on paper if you can. The worksheet has the diagram with " +
      'every arrow drawn and numbered, and room to write your own sentence for each ' +
      "one. That's harder than picking a sentence off a list, and it's worth more to " +
      'you.';
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

  /** The three points of an arrow between two boxes, in authored coordinates. */
  curveFor(fromId, toId, bend) {
    const a = this.nodeById.get(fromId);
    const b = this.nodeById.get(toId);
    const from = this.nodeEls.get(fromId);
    const to = this.nodeEls.get(toId);
    if (!a || !b || !from || !to) return null;
    // offsetWidth is a layout measurement, so the stage's transform: scale() does not
    // enter the arithmetic and the whole calculation stays in authored coordinates.
    const ctrl = controlPoint(a.x, a.y, b.x, b.y, bend);
    const p0 = clipToBox(a.x, a.y, ctrl.x, ctrl.y, from.offsetWidth / 2, from.offsetHeight / 2, 3);
    const p1 = clipToBox(b.x, b.y, ctrl.x, ctrl.y, to.offsetWidth / 2, to.offsetHeight / 2, 5);
    return { p0, p1, c: controlPoint(p0.x, p0.y, p1.x, p1.y, bend) };
  }

  layout() {
    for (const e of this.data.edges) {
      const parts = this.edgeEls.get(e.n);
      if (!parts) continue;

      // An arrow nobody has built is not on the page at all. Drawing it faintly
      // would give away where the arrows are, which is half of what is being asked.
      if (!this.progress.has(e.n)) {
        parts.path.setAttribute('d', '');
        parts.head.setAttribute('d', '');
        parts.tail.setAttribute('d', '');
        parts.badge.hidden = true;
        continue;
      }

      const curve = this.curveFor(e.from, e.to, e.bend || 0);
      if (!curve) continue;
      const { p0, p1, c } = curve;

      parts.path.setAttribute('d', `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`);
      parts.path.setAttribute('class', 'cm-edge cm-edge--shown' +
        (this.shownEdge === e.n ? ' cm-edge--active' : ''));

      const dirEnd = tangentAt(1, p0, c, p1);
      parts.head.setAttribute('d', arrowHead(p1, dirEnd, 10));
      if (bothWays(e.kind)) {
        const dirStart = tangentAt(0, p0, c, p1);
        parts.tail.setAttribute('d', arrowHead(p0, { x: -dirStart.x, y: -dirStart.y }, 10));
      } else {
        parts.tail.setAttribute('d', '');
      }
      const headCls = 'cm-arrowhead cm-arrowhead--shown' +
        (this.shownEdge === e.n ? ' cm-arrowhead--active' : '');
      parts.head.setAttribute('class', headCls);
      parts.tail.setAttribute('class', headCls);

      const at = bezierAt(typeof e.at === 'number' ? e.at : 0.5, p0, c, p1);
      parts.badge.hidden = false;
      parts.badge.style.left = at.x + 'px';
      parts.badge.style.top = at.y + 'px';
    }

    this.layoutGhost();
  }

  /**
   * The claim, drawn dashed while it is being made.
   *
   * Unbent and headless: the bend is authored and belongs to the real arrow, and a
   * head would claim a direction. A dashed line on the chord says "these two" and
   * nothing more.
   */
  layoutGhost() {
    const [a, b] = this.sel.boxes;
    if (!a || !b || a === b) {
      this.ghost.setAttribute('d', '');
      return;
    }
    const curve = this.curveFor(a, b, 0);
    if (!curve) return;
    const { p0, p1, c } = curve;
    this.ghost.setAttribute('d', `M ${p0.x} ${p0.y} Q ${c.x} ${c.y} ${p1.x} ${p1.y}`);
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

  /* ---- making a claim -------------------------------------------------- */

  clearClaim() {
    this.sel = { item: null, boxes: [] };
    this.msg = null;
  }

  /**
   * A box was clicked. It joins the claim, and its definition shows under the claim
   * either way.
   *
   * A box already in the claim comes back out, and a third box starts a fresh pair
   * with itself, which is the only sensible reading of a third click.
   *
   * There is no separate look-up-a-definition mode. A box click always counts toward
   * the claim, because the alternative is a modifier key or a second hit area, and
   * every definition is in the fold below as well.
   */
  tapNode(node) {
    const boxes = this.sel.boxes;
    this.lastNode = node.id;
    this.msg = null;

    const at = boxes.indexOf(node.id);
    if (at !== -1) boxes.splice(at, 1);
    else if (boxes.length < 2) boxes.push(node.id);
    else this.sel.boxes = [node.id];

    this.shownEdge = null;
    this.grade();
    this.render();
  }

  /** A sentence was clicked. Clicking the held one again puts it back. */
  tapItem(item) {
    this.sel.item = this.sel.item && this.sel.item.key === item.key ? null : item;
    this.msg = null;
    this.shownEdge = null;
    this.grade();
    this.render();
  }

  /**
   * Grade the claim, once a sentence and two boxes are chosen.
   *
   * The two boxes are a pair and not an ordered pair, so either order is right and
   * the kind of the arrow makes no difference here.
   */
  grade() {
    const { item, boxes } = this.sel;
    if (!item || boxes.length < 2) return;

    if (item.n === null) {
      this.sel.boxes = [];
      this.say("That one's false, so it doesn't belong anywhere on the map. Which " +
        'step in it fails?');
      return;
    }

    const want = this.data.edges.find((e) => e.n === item.n);
    const joins = boxes.includes(want.from) && boxes.includes(want.to);

    if (joins) {
      this.progress.add(want.n);
      this.clearClaim();
      this.showEdge(want.n);
      return;
    }

    this.sel.boxes = [];
    // Whether those two boxes are joined by some other arrow is deliberately not
    // reported: it would say where an arrow is, which is what the exercise asks for.
    this.say("That sentence doesn't run between those two boxes. Which two ideas " +
      'does it connect?');
  }

  /**
   * The one thing the panel says back that is not a box or an arrow.
   *
   * There is no success message and no `ok` variant: a right claim draws its arrow
   * and the panel shows that arrow's card, which is a better answer than a line of
   * green text saying the same thing.
   */
  say(message) {
    this.msg = message;
  }

  /**
   * Read an arrow back: what was put on it and why.
   *
   * This puts back a claim in progress, so the panel is either about a claim or
   * about a finished arrow and never about both. It costs a click if a student was
   * midway through one, and the alternative is a panel showing two things at once.
   */
  showEdge(n) {
    this.clearClaim();
    this.shownEdge = n;
    this.lastNode = null;
    this.render();
  }

  /** Draw every arrow that is still missing. */
  revealAll() {
    for (const e of this.data.edges) this.progress.add(e.n);
    this.clearClaim();
    this.shownEdge = null;
    this.render();
  }

  /* ---- redraw ---------------------------------------------------------- */

  /** Everything the placed set decides: the boxes, the badges, the panel, the lists. */
  render() {
    const total = this.data.edges.length;
    const done = this.progress.placed.size;
    this.countEl.textContent = `${done} of ${total} arrows drawn`;

    for (const [id, box] of this.nodeEls) {
      box.className = 'cm-node' +
        (this.sel.boxes.includes(id) ? ' cm-node--picked' : '') +
        (this.shownEdge !== null && this.edgeTouches(this.shownEdge, id) ? ' cm-node--lit' : '');
    }

    for (const e of this.data.edges) {
      const badge = this.edgeEls.get(e.n).badge;
      badge.className = 'cm-badge cm-badge--shown' +
        (this.shownEdge === e.n ? ' cm-badge--active' : '');
      badge.setAttribute('aria-label', `Arrow ${e.n}, ` +
        `${this.plainLabel(this.nodeById.get(e.from))} to ` +
        `${this.plainLabel(this.nodeById.get(e.to))}`);
    }

    this.renderWork();
    this.renderFound();
    this.renderList();
    this.layout();
  }

  edgeTouches(n, nodeId) {
    const e = this.data.edges.find((x) => x.n === n);
    return !!e && (e.from === nodeId || e.to === nodeId);
  }

  /**
   * The panel under the diagram: the claim being made, then whichever of the box
   * definition or the finished arrow was the last thing clicked.
   */
  renderWork() {
    this.work.textContent = '';
    const { item, boxes } = this.sel;
    const claiming = !!item || boxes.length > 0;

    if (claiming) {
      this.work.appendChild(this.claimStrip());
    } else if (this.shownEdge !== null) {
      this.work.appendChild(this.edgeCard(this.shownEdge));
    } else {
      this.work.appendChild(el('p', 'cm-work__body',
        'Pick a sentence, then click the two boxes it runs between, in either order. ' +
        "Get all three right and we'll draw the arrow."));
    }

    if (this.lastNode) {
      const node = this.nodeById.get(this.lastNode);
      const def = el('p', 'cm-hint');
      def.innerHTML = `<strong>${node.letter ? node.letter + '. ' : ''}` +
        `${this.plainLabel(node)}.</strong> ${node.definition || ''}`;
      this.work.appendChild(def);
    }

    if (this.msg) this.work.appendChild(el('p', 'cm-verdict cm-verdict--no', this.msg));

    typeset(this.work);
  }

  /**
   * The three parts of the claim. Clicking one puts that choice back.
   *
   * The two box chips are labelled "One box" and "The other box" rather than From and
   * To, because the order is not part of the claim and a From label would ask a
   * student for something nothing checks.
   */
  claimStrip() {
    const strip = el('div', 'cm-claim');
    const { item, boxes } = this.sel;

    const chip = (kind, tag, label, filled, onClear) => {
      const b = el('button', 'cm-chip cm-chip--' + kind + (filled ? ' is-set' : ''));
      b.type = 'button';
      b.innerHTML = `<span class="cm-chip__tag">${tag}</span>` +
        `<span class="cm-chip__val">${label}</span>`;
      if (filled) b.addEventListener('click', onClear);
      else b.disabled = true;
      return b;
    };

    const drop = (id) => () => {
      this.sel.boxes = this.sel.boxes.filter((x) => x !== id);
      this.msg = null;
      this.render();
    };

    strip.appendChild(chip('item', 'Sentence',
      item ? item.statement : 'pick one from the list',
      !!item, () => { this.sel.item = null; this.msg = null; this.render(); }));
    strip.appendChild(chip('box', 'One box',
      boxes[0] ? this.plainLabel(this.nodeById.get(boxes[0])) : 'click a box',
      !!boxes[0], drop(boxes[0])));
    strip.appendChild(chip('box', 'The other box',
      boxes[1] ? this.plainLabel(this.nodeById.get(boxes[1])) : 'click a second box',
      !!boxes[1], drop(boxes[1])));

    const clear = el('button', 'cm-btn', 'Clear all three');
    clear.type = 'button';
    clear.addEventListener('click', () => { this.clearClaim(); this.render(); });
    strip.appendChild(clear);
    return strip;
  }

  /** An arrow that has been drawn: the two boxes, the sentence, and the reason. */
  edgeCard(n) {
    const edge = this.data.edges.find((e) => e.n === n);
    const card = el('div');
    const head = el('div', 'cm-work__head');
    head.appendChild(el('span', 'cm-work__tag', 'Arrow ' + edge.n));
    const ends = el('span', 'cm-work__name');
    ends.innerHTML = `${this.plainLabel(this.nodeById.get(edge.from))} → ` +
      `${this.plainLabel(this.nodeById.get(edge.to))}` +
      (bothWays(edge.kind) ? ' <em>(and back)</em>' : '');
    head.appendChild(ends);
    card.appendChild(head);

    const body = el('p', 'cm-work__body');
    body.innerHTML = edge.statement;
    card.appendChild(body);
    if (edge.why) {
      const why = el('p', 'cm-hint');
      why.innerHTML = edge.why;
      card.appendChild(why);
    }
    return card;
  }

  /** The arrows drawn so far, in the order the map numbers them. */
  renderFound() {
    this.foundEl.textContent = '';
    const found = this.data.edges.filter((e) => this.progress.has(e.n));
    if (found.length === 0) {
      this.foundEl.appendChild(el('p', 'cm-hint',
        "Nothing yet. The map is just the boxes until you put an arrow on it."));
      return;
    }
    for (const e of found) {
      const b = el('button', 'cm-found__row' + (this.shownEdge === e.n ? ' is-active' : ''));
      b.type = 'button';
      b.innerHTML = `<span class="cm-found__ends">${e.n}. ` +
        `${this.plainLabel(this.nodeById.get(e.from))} ${bothWays(e.kind) ? '↔' : '→'} ` +
        `${this.plainLabel(this.nodeById.get(e.to))}</span>` +
        `<span class="cm-found__what">${e.statement}</span>`;
      b.addEventListener('click', () => this.showEdge(e.n));
      this.foundEl.appendChild(b);
    }
    typeset(this.foundEl);
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
      const b = el('button', 'cm-option' +
        (this.sel.item && this.sel.item.key === item.key ? ' is-chosen' : ''));
      b.type = 'button';
      b.innerHTML = item.statement;
      b.addEventListener('click', () => this.tapItem(item));
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
    const all = this.data.edges.map((e) => ({ key: 'e' + e.n, n: e.n, statement: e.statement }));
    (this.data.mistakes || []).forEach((m, i) => all.push({ key: 'm' + i, n: null, statement: m }));
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
