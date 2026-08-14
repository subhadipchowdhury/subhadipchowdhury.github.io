/* Concept map engine.
 *
 * A map is a fixed diagram of concepts with numbered arrows and nothing written on
 * them. The work happens on the printed worksheet; this page draws the same diagram
 * and checks it. Click a numbered circle for that one arrow's answer, or open the
 * list at the bottom for all of them at once.
 *
 * It was a graded three-step exercise until 2026-08-13: write your own sentence,
 * then choose whether the relationship holds or fails, then match it out of a
 * shuffled bank of every arrow's statement. All three are gone, and the reasoning is
 * worth recording because it applies to the next map too.
 *
 *   - **The bank was not a test.** Solving one arrow showed a student every
 *     statement, which they could copy or screenshot. A gate that opens on the first
 *     correct answer is not protecting anything, so the list is simply given.
 *   - **The kind question collapsed.** The four kinds became three, and the three
 *     became two once the failing arrows were rewritten (see below), and a two-way
 *     choice a student wins by always guessing the same answer is a formality.
 *   - **The written sentence was never graded** and could not be, so requiring it
 *     before showing the list only added a click.
 *
 * The failing arrows were rewritten rather than kept. Each was a real relationship
 * stated backwards: "terms tending to zero does not give convergence" is the
 * contrapositive of a theorem that runs the other way, and "pointwise convergence
 * does not preserve continuity" names the gap Dini's theorem closes. Every arrow now
 * holds in the direction drawn, so nothing has to be hidden and every head is drawn
 * from the start.
 *
 * Geometry is authored, not computed: coordinates come from the tikz the printed
 * worksheet is drawn with, and tools/author/maptex.py draws the paper version from
 * the same three points this file draws from. Node boxes are measured after MathJax
 * typesets and the arrows are clipped to the measured borders, so a long label
 * cannot leave an arrow hanging in the middle of a box.
 */

/* The two kinds of arrow. `label` appears in the answer list, and the kind decides
 * whether the arrow gets one head or two. See the note above for the two kinds that
 * used to be here.
 */
export const KINDS = {
  holds: { label: 'one way' },
  equiv: { label: 'both ways' }
};

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
    // Which arrows have had their answer looked at. In memory only: there is
    // nothing to earn here, so there is nothing to save, and a reload gives a
    // clean map, which is what someone coming back to practise wants.
    this.shown = new Set();
    this.active = null;
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
      badge.addEventListener('click', () => this.showArrow(e.n));
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
    this.root.appendChild(this.work);
    this.renderIdle();

    this.root.appendChild(this.answerFold());
    this.root.appendChild(this.inventoryFold());
    if (d.benchmarks && d.benchmarks.length) this.root.appendChild(this.benchmarkFold());

    typeset(this.root).then(() => this.layout());
    this.paint();

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
    lede.innerHTML = 'Start on paper. The worksheet has the same diagram with room to ' +
      'write, and nothing on this page is saved, so there is nothing to lose by ' +
      'working it out first and checking here afterwards.';
    box.appendChild(lede);
    const link = el('a', 'cm-btn cm-btn--primary', 'The worksheet (PDF)');
    link.href = this.data.pdf;
    link.target = '_blank';
    link.rel = 'noopener';
    box.appendChild(link);
    return box;
  }

  /**
   * Every answer, behind one toggle.
   *
   * Opening it also reveals every arrow on the map, so the list and the diagram
   * agree. There is no attempt to make this hard to reach: a student who wants the
   * answers has them, and the toggle is there so that a student who wants to think
   * first is not shown them by accident.
   */
  answerFold() {
    const fold = el('details', 'cm-fold cm-fold--answers');
    fold.appendChild(el('summary', null, 'Show the answers'));
    const body = el('div', 'cm-fold__body');

    const ol = document.createElement('ol');
    for (const e of this.data.edges) {
      const from = this.nodeById.get(e.from);
      const to = this.nodeById.get(e.to);
      const li = el('li');
      li.value = e.n;
      li.innerHTML =
        `<span class="cm-named__ends">${this.plainLabel(from)} → ${this.plainLabel(to)}` +
        (e.kind === 'equiv' ? ', both ways' : '') + '</span>' +
        e.statement +
        (e.why ? `<span class="cm-named__why">${e.why}</span>` : '');
      ol.appendChild(li);
    }
    body.appendChild(ol);

    if (this.data.mistakes && this.data.mistakes.length) {
      body.appendChild(el('h2', null, 'Claims that look right and are not'));
      const ul = document.createElement('ul');
      for (const m of this.data.mistakes) {
        const li = el('li');
        li.innerHTML = m;
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }

    fold.appendChild(body);
    fold.addEventListener('toggle', () => {
      if (fold.open) this.revealAll();
      typeset(body);
    });
    return fold;
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
        (this.shown.has(e.n) ? ' cm-edge--shown' : '') +
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
        (this.shown.has(e.n) ? ' cm-arrowhead--shown' : '') +
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

    this.work.appendChild(el('p', 'cm-hint',
      'Click a numbered circle to see what that arrow says.'));
    typeset(this.work);
    this.paint();
  }

  /** One arrow's answer, on its own. */
  showArrow(n) {
    const edge = this.data.edges.find((e) => e.n === n);
    if (!edge) return;
    this.shown.add(n);
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

    const body = el('p', 'cm-work__body');
    body.innerHTML = edge.statement;
    this.work.appendChild(body);

    if (edge.why) {
      const why = el('p', 'cm-hint');
      why.innerHTML = edge.why;
      this.work.appendChild(why);
    }

    typeset(this.work);
    this.paint();
  }

  revealAll() {
    for (const e of this.data.edges) this.shown.add(e.n);
    this.paint();
  }

  /* ---- redraw ---------------------------------------------------------- */

  paint() {
    for (const e of this.data.edges) {
      const badge = this.edgeEls.get(e.n).badge;
      const seen = this.shown.has(e.n);
      badge.className = 'cm-badge' + (seen ? ' cm-badge--shown' : '') +
        (this.active === e.n ? ' cm-badge--active' : '');
      badge.setAttribute('aria-label', `Arrow ${e.n}` + (seen ? ', answer shown' : ''));
    }
    const total = this.data.edges.length;
    this.countEl.textContent = this.shown.size === 0
      ? `${total} arrows`
      : `${this.shown.size} of ${total} arrows looked at`;
    this.layout();
  }

  renderIdle() {
    this.work.textContent = '';
    this.work.appendChild(el('p', 'cm-work__idle',
      'Click a numbered circle for that arrow, or a box to be reminded what it means.'));
  }
}

/** Fetch a map's data and mount it. */
export async function mountMap(root, dataUrl) {
  const res = await fetch(dataUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`could not load the map (${res.status})`);
  const data = await res.json();
  return new MapView(root, data);
}
