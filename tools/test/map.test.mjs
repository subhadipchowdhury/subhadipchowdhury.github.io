// Tests for the concept map engine and for the map data.
//
// The geometry is pure and is tested directly, because an arrow anchored to the
// wrong place is the failure nobody notices in a screenshot. Both built maps are
// swept for the invariants the engine relies on, so a hand-edited JSON is caught
// here as well as by tools/author/mapkit.py. And the mount tests check the exercise.
//
// What is not covered: how any of it looks. The stub lays nothing out, so the mount
// tests fill in node sizes by hand and check the arithmetic, not the page.
//
// The exercise, since 2026-09-10: the arrows are not drawn, and a claim is three
// choices, the sentence and the two boxes it runs between. The tests that went with
// it are the ones that used to click a numbered badge to answer, because before an
// arrow is built there is no badge on the map to click. Gone earlier: the
// write-your-own step, which could not be graded, and the kind question, which
// collapsed to a coin flip when the failing arrows were rewritten.

import { installDom, walk, textOf } from './dom-stub.mjs';
import {
  KINDS, hashString, stampOf, seededShuffle,
  clipToBox, controlPoint, bezierAt, tangentAt, arrowHead, Progress, MapView,
} from '../../teaching/labs/engine/map/map.js';

const teardown = installDom();

const readText = typeof read === 'function'
  ? (p) => read(p)
  : (await import('node:fs')).readFileSync;

const slurp = (p) => JSON.parse(String(readText(p, 'utf8')));

const MAPS = new Map([
  ['series', slurp('teaching/labs/data/maps/series.json')],
  ['func-sequences', slurp('teaching/labs/data/maps/func-sequences.json')],
]);

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
  if (a !== b) fail(`${msg || 'values differ'}\n    expected ${JSON.stringify(b)}\n    actual   ${JSON.stringify(a)}`);
}
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > (tol ?? 1e-9)) fail(`${msg || 'values differ'}\n    expected ${b}\n    actual   ${a}`);
}

/* -------------------------------------------------------------------------- */

describe('clipping an arrow to a box', () => {
  it('leaves through the side when the run is mostly horizontal', () => {
    const p = clipToBox(0, 0, 100, 10, 20, 15, 0);
    near(p.x, 20, 1e-9, 'should sit on the vertical edge');
    near(p.y, 2, 1e-9);
  });

  it('leaves through the top when the run is mostly vertical', () => {
    const p = clipToBox(0, 0, 10, 100, 20, 15, 0);
    near(p.y, 15, 1e-9, 'should sit on the horizontal edge');
    near(p.x, 1.5, 1e-9);
  });

  it('leaves through the corner on the diagonal of the box', () => {
    const p = clipToBox(0, 0, 40, 30, 20, 15, 0);
    near(p.x, 20, 1e-9);
    near(p.y, 15, 1e-9);
  });

  it('pushes out by the gap along the line, not along an axis', () => {
    const bare = clipToBox(0, 0, 100, 0, 20, 15, 0);
    const gapped = clipToBox(0, 0, 100, 0, 20, 15, 6);
    near(gapped.x - bare.x, 6, 1e-9);
  });

  it('does not divide by zero when the two centres coincide', () => {
    const p = clipToBox(5, 5, 5, 5, 20, 15, 4);
    eq(p.x, 5);
    eq(p.y, 5);
  });
});

describe('the curve', () => {
  it('puts the control point at the midpoint when there is no bend', () => {
    const c = controlPoint(0, 0, 100, 50, 0);
    near(c.x, 50);
    near(c.y, 25);
  });

  it('offsets perpendicular to the chord, by the bend', () => {
    const c = controlPoint(0, 0, 100, 0, 30);
    near(c.x, 50);
    near(c.y, 30, 1e-9, 'a rightward chord bends downward in screen coordinates');
    near(controlPoint(0, 0, 100, 0, -30).y, -30);
  });

  it('bends by the same distance whatever the chord length', () => {
    near(controlPoint(0, 0, 10, 0, 25).y, 25);
    near(controlPoint(0, 0, 1000, 0, 25).y, 25);
  });

  it('passes through both ends and bulges toward the control point', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 0 };
    const c = { x: 50, y: 60 };
    near(bezierAt(0, p0, c, p1).x, 0);
    near(bezierAt(1, p0, c, p1).x, 100);
    near(bezierAt(0.5, p0, c, p1).y, 30, 1e-9,
      'the curve reaches half the control offset at the midpoint');
  });

  it('gives a unit tangent that points along the curve', () => {
    const t = tangentAt(1, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 });
    near(Math.hypot(t.x, t.y), 1);
    near(t.x, 1);
  });

  it('gives a unit tangent even on a degenerate curve', () => {
    const t = tangentAt(0.5, { x: 3, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 3 });
    assert(Number.isFinite(t.x) && Number.isFinite(t.y), 'must not be NaN');
  });
});

describe('the arrowhead', () => {
  it('starts at the tip and closes', () => {
    const d = arrowHead({ x: 100, y: 50 }, { x: 1, y: 0 }, 10);
    assert(d.startsWith('M 100 50 '), `head should start at the tip, got ${d}`);
    assert(d.trim().endsWith('Z'), 'head should be a closed path');
  });

  it('sits behind the tip, on the side the direction came from', () => {
    const d = arrowHead({ x: 100, y: 50 }, { x: 1, y: 0 }, 10);
    const xs = d.match(/-?\d+(\.\d+)?/g).map(Number);
    // M x y L x y L x y: the two back corners share an x of tip - size.
    eq(xs[2], 90);
    eq(xs[4], 90);
  });
});

describe('the scramble', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('keeps every item and leaves the caller\'s array alone', () => {
    const out = seededShuffle(items, 'seed');
    eq(out.slice().sort((a, b) => a - b).join(','), items.join(','));
    eq(items.join(','), '1,2,3,4,5,6,7,8,9,10');
  });

  it('gives the same order for the same seed and a different one otherwise', () => {
    eq(seededShuffle(items, 'abc').join(','), seededShuffle(items, 'abc').join(','));
    assert(seededShuffle(items, 'abc').join(',') !== seededShuffle(items, 'xyz').join(','));
    assert(seededShuffle(items, 'abc').join(',') !== items.join(','), 'it has to reorder');
  });
});

describe('progress', () => {
  const fakeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
    };
  };

  it('records a placement and comes back after a reload', () => {
    const store = fakeStore();
    const first = new Progress('m', 'stamp1', store);
    first.add(3);
    assert(new Progress('m', 'stamp1', store).has(3));
  });

  it('throws away answers saved against different sentences', () => {
    const store = fakeStore();
    new Progress('m', 'stamp1', store).add(3);
    assert(!new Progress('m', 'stamp2', store).has(3), 'an edited map must not restore stale answers');
  });

  it('survives a corrupt store and a blocked one', () => {
    const store = fakeStore();
    store.setItem('cmap:3:m', 'not json');
    eq(new Progress('m', 'stamp1', store).placed.size, 0);
    const blocked = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const p = new Progress('m', 'stamp1', blocked);
    p.add(1);
    assert(p.has(1), 'the in-memory answer stands even when the save fails');
  });

  it('changes its stamp when a statement changes and not when the intro does', () => {
    const data = MAPS.get('series');
    const before = stampOf(data);
    const copy = JSON.parse(JSON.stringify(data));
    copy.intro = 'something else';
    eq(stampOf(copy), before, 'the intro is not part of the answer key');
    copy.edges[2].statement += ' and one more clause';
    assert(stampOf(copy) !== before, 'an edited sentence has to invalidate saved answers');
    assert(hashString('a') !== hashString('b'));
  });
});

/* -------------------------------------------------------------------------- */

for (const [id, data] of MAPS) {
  describe(`${id}: the data`, () => {
    it('names itself and gives a stage', () => {
      eq(data.id, id);
      assert(data.title && data.intro && data.reflection, 'wants a title, an intro and a closing question');
      assert(data.width > 0 && data.height > 0, 'wants a stage size');
    });

    it('numbers its arrows 1 to N', () => {
      const ns = data.edges.map((e) => e.n);
      eq(ns.join(','), ns.map((_, i) => i + 1).join(','));
    });

    it('sits inside its own stage', () => {
      for (const n of data.nodes) {
        assert(n.x > 0 && n.x < data.width, `node ${n.id} is off the stage horizontally`);
        assert(n.y > 0 && n.y < data.height, `node ${n.id} is off the stage vertically`);
      }
    });

    it('points every arrow at a box that exists', () => {
      const ids = new Set(data.nodes.map((n) => n.id));
      for (const e of data.edges) {
        assert(ids.has(e.from), `arrow ${e.n} starts nowhere`);
        assert(ids.has(e.to), `arrow ${e.n} ends nowhere`);
        assert(e.from !== e.to, `arrow ${e.n} is a loop`);
      }
    });

    it('uses only the two kinds that are left', () => {
      for (const e of data.edges) {
        assert(KINDS[e.kind], `arrow ${e.n} has the unknown kind ${e.kind}`);
      }
    });

    it('has no failing arrows, which were rewritten out', () => {
      // Every arrow is a relationship that holds in the direction drawn. A `fails`
      // kind reappearing means someone reintroduced an arrow stated backwards.
      for (const e of data.edges) {
        assert(e.kind !== 'fails', `arrow ${e.n} is a failure; state it as the relationship it is`);
      }
    });

    it('gives every arrow a statement of its own and a reason', () => {
      const seen = new Set();
      for (const e of data.edges) {
        assert(e.statement && e.statement.length > 40, `arrow ${e.n} has no real statement`);
        assert(e.why && e.why.length > 30, `arrow ${e.n} has no reason`);
        assert(!seen.has(e.statement), `arrow ${e.n} repeats another statement`);
        seen.add(e.statement);
      }
    });

    it('lists false claims to check against, distinct from the answers', () => {
      assert((data.mistakes || []).length >= 3, 'wants at least three listed mistakes');
      const real = new Set(data.edges.map((e) => e.statement));
      for (const m of data.mistakes) assert(!real.has(m), 'a listed mistake repeats an answer');
    });

    it('leaves every box on some arrow', () => {
      const touched = new Set();
      for (const e of data.edges) { touched.add(e.from); touched.add(e.to); }
      for (const n of data.nodes) {
        assert(touched.has(n.id), `box ${n.id} has no arrow, so nothing asks about it`);
      }
    });

    it('defines every box', () => {
      for (const n of data.nodes) {
        assert(n.definition && n.definition.length > 20, `box ${n.id} has no definition`);
      }
    });

    it('names a worksheet that exists', () => {
      eq(data.pdf, `/teaching/labs/worksheets/${id}.pdf`, `unexpected pdf path ${data.pdf}`);
      // The JSON claiming a worksheet that was never built would put a dead link in
      // the callout at the top of the page.
      const bytes = readText('teaching' + data.pdf.slice('/teaching'.length));
      assert(bytes.length > 20000, `${data.pdf} is too small to be the worksheet`);
    });
  });
}

/* -------------------------------------------------------------------------- */

let uniq = 0;
function freshView(data, sized) {
  const copy = JSON.parse(JSON.stringify(data));
  copy.id = `${data.id}-test-${++uniq}`;
  const view = new MapView(document.createElement('div'), copy);
  if (sized) {
    for (const box of view.nodeEls.values()) { box.offsetWidth = 140; box.offsetHeight = 46; }
    view.layout();
  }
  return view;
}

/** The bank item for an arrow, as a student would click it. */
function itemFor(view, n) {
  const found = view.bank().find((i) => i.n === n);
  if (!found) fail(`arrow ${n} is not on the list`);
  return found;
}

const boxOf = (view, id) => view.nodeById.get(id);

/** Build one arrow the way a student does: the sentence, then the two boxes. */
function claim(view, edge, reversed) {
  view.tapItem(itemFor(view, edge.n));
  view.tapNode(boxOf(view, reversed ? edge.to : edge.from));
  view.tapNode(boxOf(view, reversed ? edge.from : edge.to));
}

describe('the stylesheet', () => {
  // The stub has no cascade, so `hidden` works there whatever the CSS says. This is
  // the only way the suite can see the trap that shipped a dead Hide button: an
  // author `display` on a container beats the UA's `[hidden] { display: none }`.
  const css = String(readText('teaching/labs/engine/map/map.css', 'utf8'));

  it('makes the hidden attribute work inside .cm', () => {
    assert(/\.cm \[hidden\]\s*\{[^}]*display:\s*none/.test(css),
      'map.css needs `.cm [hidden] { display: none }`, or every element the engine ' +
      'hides that carries an author display stays visible');
  });

  it('still sets a display on the board, which is why the guard is needed', () => {
    assert(/\.cm-board\s*\{[^}]*display:\s*grid/.test(css),
      'if .cm-board stops being a grid, check whether the guard is still load-bearing');
  });

  it('draws the claim dashed rather than in a colour of its own', () => {
    // A claim is told apart from a finished arrow by the drawing, not by hue, which
    // is the standing rule for this page. Nothing else can check that here.
    assert(/\.cm-ghost\s*\{[^}]*stroke-dasharray/.test(css), 'the claim should be dashed');
    assert(/\.cm-node--to\s*\{[^}]*border-style:\s*dashed/.test(css),
      "the claim's far end should be dashed too");
  });
});

describe('the map before anything is claimed', () => {
  const data = MAPS.get('series');

  it('builds a badge per arrow and a box per node', () => {
    const view = freshView(data);
    const all = walk(view.root);
    eq(all.filter((n) => String(n.className).startsWith('cm-node')).length, data.nodes.length);
    eq(all.filter((n) => String(n.className).startsWith('cm-badge')).length, data.edges.length);
  });

  it('draws none of the arrows, and hides every number', () => {
    const view = freshView(data, true);
    for (const e of data.edges) {
      const parts = view.edgeEls.get(e.n);
      eq(parts.path.getAttribute('d'), '', `arrow ${e.n} is drawn before it is earned`);
      eq(parts.head.getAttribute('d'), '', `arrow ${e.n} has a head before it is earned`);
      assert(parts.badge.hidden, `arrow ${e.n}'s number shows before it is earned`);
    }
  });

  it('counts nothing drawn and offers every sentence', () => {
    const view = freshView(data);
    eq(view.progress.placed.size, 0);
    assert(textOf(view.countEl).startsWith('0 of'), textOf(view.countEl));
    eq(view.bank().length, data.edges.length + data.mistakes.length,
      'the list holds every sentence plus the false ones');
  });

  it('asks for all three parts in the panel', () => {
    const view = freshView(data);
    const said = textOf(view.work);
    assert(said.includes('starts at') && said.includes('ends at'), said);
  });

  it('does not scramble into the authored order', () => {
    const view = freshView(data);
    const offered = view.bank().map((i) => i.n).join(',');
    assert(!offered.startsWith(data.edges.map((e) => e.n).join(',')),
      'the list should not be in arrow order');
  });

  it('links the worksheet at the top', () => {
    const view = freshView(data);
    // The property, not getAttribute: a browser reflects `a.href = x` into the
    // attribute and the stub does not, so reading the attribute here would test the
    // stub rather than the page.
    const link = walk(view.root).find((n) => n.tagName === 'A' && n.href === data.pdf);
    assert(link, 'wants a link to the worksheet');
    eq(link.target, '_blank', 'the worksheet should not replace the map');
  });
});

describe('making a claim', () => {
  const data = MAPS.get('series');
  const edge = data.edges[0];

  it('draws the arrow when the sentence and both boxes are right', () => {
    const view = freshView(data, true);
    claim(view, edge);
    assert(view.progress.has(edge.n), 'a correct claim should draw its arrow');
    assert(view.edgeEls.get(edge.n).path.getAttribute('d'), 'and set its path');
    assert(view.edgeEls.get(edge.n).head.getAttribute('d'), 'and its head');
    assert(!view.edgeEls.get(edge.n).badge.hidden, 'and show its number');
    eq(view.sel.item, null, 'the sentence is spent');
    eq(view.shownEdge, edge.n, 'and the panel reads the new arrow back');
  });

  it('takes the two boxes first and the sentence last', () => {
    const view = freshView(data);
    view.tapNode(boxOf(view, edge.from));
    view.tapNode(boxOf(view, edge.to));
    assert(!view.progress.has(edge.n), 'two boxes alone are not a claim');
    view.tapItem(itemFor(view, edge.n));
    assert(view.progress.has(edge.n), 'the order of the three choices should not matter');
  });

  it('grades nothing until all three are chosen', () => {
    const view = freshView(data);
    view.tapItem(itemFor(view, edge.n));
    view.tapNode(boxOf(view, edge.from));
    eq(view.msg, null, 'one box in, nothing should have been graded');
    eq(view.progress.placed.size, 0);
  });

  it('takes the sentence off the list and leaves the other arrows alone', () => {
    const view = freshView(data, true);
    const before = view.bank().length;
    claim(view, edge);
    eq(view.bank().length, before - 1, 'a drawn arrow keeps its sentence');
    for (const other of data.edges) {
      if (other.n === edge.n) continue;
      eq(view.edgeEls.get(other.n).path.getAttribute('d'), '', `arrow ${other.n} leaked`);
    }
    assert(textOf(view.countEl).startsWith('1 of'), textOf(view.countEl));
  });

  it('reads an arrow back, with its reason, when its number is clicked', () => {
    const view = freshView(data, true);
    const e = data.edges[5];
    claim(view, e);
    view.tapNode(boxOf(view, data.nodes[0].id));   // move the panel off the arrow
    view.showEdge(e.n);
    const text = textOf(view.work);
    assert(text.includes(e.statement.slice(0, 40)), 'the sentence should be shown');
    assert(text.includes(e.why.slice(0, 30)), 'and the reason with it');
  });

  it('lists the arrows drawn so far, and nothing before that', () => {
    const view = freshView(data);
    assert(textOf(view.foundEl).includes('Nothing yet'), textOf(view.foundEl));
    const e = data.edges[1];
    claim(view, e);
    assert(textOf(view.foundEl).includes(e.statement.slice(0, 24)), textOf(view.foundEl));
  });

  it('keeps the list order when a sentence is placed', () => {
    const view = freshView(data);
    const before = view.bank().map((i) => i.key);
    const e = data.edges[4];
    claim(view, e);
    eq(view.bank().map((i) => i.key).join(','), before.filter((k) => k !== 'e' + e.n).join(','),
      'placing a sentence should remove one line and move nothing else');
  });

  it('keeps the false sentences on the list to the end', () => {
    const view = freshView(data);
    for (const e of data.edges) claim(view, e);
    eq(view.bank().length, data.mistakes.length, 'the false ones never leave');
  });

  it('leaves the last arrow a real choice', () => {
    const view = freshView(data);
    for (const e of data.edges.slice(0, -1)) claim(view, e);
    eq(view.bank().length, 1 + data.mistakes.length, 'one true sentence among the false ones');
  });
});

describe('getting a claim wrong', () => {
  const data = MAPS.get('series');
  const edge = data.edges.find((e) => e.kind === 'holds');

  it('names the reversal when the pair is right and the direction is not', () => {
    const view = freshView(data);
    claim(view, edge, true);
    assert(!view.progress.has(edge.n), 'a reversed one-way arrow is wrong');
    assert(view.msg && view.msg.includes('other way'), view.msg);
    eq(view.sel.from, null, 'the boxes are cleared to try again');
    assert(view.sel.item, 'and the sentence is kept, since it is still unplaced');
  });

  it('says nothing about where the arrows are on a plain miss', () => {
    const view = freshView(data);
    const far = data.nodes.filter((n) => n.id !== edge.from && n.id !== edge.to);
    view.tapItem(itemFor(view, edge.n));
    view.tapNode(boxOf(view, far[0].id));
    view.tapNode(boxOf(view, far[1].id));
    assert(view.msg && view.msg.includes("doesn't run between"), view.msg);
    assert(!/joined|another arrow/.test(view.msg),
      'a miss should not report where the other arrows are');
    eq(view.progress.placed.size, 0);
  });

  it('turns a false sentence away whatever boxes it is given', () => {
    const view = freshView(data);
    const bogus = view.bank().find((i) => i.n === null);
    view.tapItem(bogus);
    view.tapNode(boxOf(view, data.edges[0].from));
    view.tapNode(boxOf(view, data.edges[0].to));
    assert(view.msg && view.msg.includes('false'), view.msg);
    eq(view.progress.placed.size, 0, 'nothing is drawn for a false sentence');
    assert(view.bank().some((i) => i.n === null), 'and it stays on the list');
  });
});

describe('an arrow that runs both ways', () => {
  const data = MAPS.get('func-sequences');
  const both = data.edges.find((e) => e.kind === 'equiv');
  const oneWay = data.edges.find((e) => e.kind === 'holds');

  it('exists in the func-sequences map, or these are vacuous', () => {
    assert(both, 'no equiv arrow to test');
    assert(KINDS.equiv, 'the kind should still be known to the engine');
  });

  it('takes its two boxes in either order', () => {
    const a = freshView(data);
    claim(a, both);
    assert(a.progress.has(both.n), 'the authored direction should be accepted');
    const b = freshView(data);
    claim(b, both, true);
    assert(b.progress.has(both.n), 'and so should the other one');
  });

  it('gets a head at each end, and a one-way arrow only gets one', () => {
    const view = freshView(data, true);
    claim(view, both);
    claim(view, oneWay);
    assert(view.edgeEls.get(both.n).tail.getAttribute('d'), 'both ways needs a head at each end');
    eq(view.edgeEls.get(oneWay.n).tail.getAttribute('d'), '', 'one way has one head');
  });
});

describe('choosing and unchoosing', () => {
  const data = MAPS.get('series');

  it('unsets a box when it is clicked again', () => {
    const view = freshView(data);
    const first = data.nodes[0].id;
    view.tapNode(boxOf(view, first));
    eq(view.sel.from, first);
    view.tapNode(boxOf(view, first));
    eq(view.sel.from, null, 'a second click on the origin should put it back');
  });

  it('starts a new pair when a third box is clicked', () => {
    const view = freshView(data);
    const [a, b, c] = data.nodes.map((n) => n.id);
    view.tapNode(boxOf(view, a));
    view.tapNode(boxOf(view, b));
    view.tapNode(boxOf(view, c));
    eq(view.sel.from, c, 'the third click becomes the new origin');
    eq(view.sel.to, null);
  });

  it('unsets the sentence when it is clicked again', () => {
    const view = freshView(data);
    view.tapItem(itemFor(view, data.edges[2].n));
    assert(view.sel.item);
    view.tapItem(itemFor(view, data.edges[2].n));
    eq(view.sel.item, null, 'clicking the held sentence should put it back');
  });

  it('shows the definition of the box just clicked', () => {
    const view = freshView(data);
    view.tapNode(boxOf(view, data.nodes[2].id));
    const text = textOf(view.work);
    assert(text.includes(data.nodes[2].letter), text);
    assert(text.includes(data.nodes[2].definition.slice(0, 25)), 'and its definition');
  });

  it('draws the claim dashed once both boxes are chosen', () => {
    const view = freshView(data, true);
    eq(view.ghost.getAttribute('d'), '', 'nothing to draw yet');
    view.tapNode(boxOf(view, data.edges[0].from));
    eq(view.ghost.getAttribute('d'), '', 'one box is not a line');
    view.tapNode(boxOf(view, data.edges[0].to));
    assert(view.ghost.getAttribute('d'), 'two boxes should show the claim');
    assert(view.ghostHead.getAttribute('d'), 'with a head, so the direction is visible');
  });
});

describe('the way out and the way back', () => {
  const data = MAPS.get('series');

  it('draws every arrow on request', () => {
    const view = freshView(data, true);
    view.revealAll();
    eq(view.progress.placed.size, data.edges.length);
    for (const e of data.edges) {
      assert(String(view.edgeEls.get(e.n).path.getAttribute('class')).includes('cm-edge--shown'),
        `arrow ${e.n} should be marked once everything is drawn`);
      assert(!view.edgeEls.get(e.n).badge.hidden, `arrow ${e.n}'s number should show`);
    }
    eq(view.bank().length, data.mistakes.length, 'only the false sentences are left');
  });

  it('empties the map again on Start over', () => {
    const view = freshView(data, true);
    view.revealAll();
    view.progress.clear();
    view.render();
    eq(view.progress.placed.size, 0);
    for (const e of data.edges) {
      eq(view.edgeEls.get(e.n).path.getAttribute('d'), '', `arrow ${e.n} survived the reset`);
    }
    eq(view.bank().length, data.edges.length + data.mistakes.length);
    assert(textOf(view.countEl).startsWith('0 of'), textOf(view.countEl));
  });

  it('keeps its answers across a remount, and drops them if the map is edited', () => {
    const seed = JSON.parse(JSON.stringify(data));
    seed.id = 'series-persist-test';
    const edge = seed.edges[0];

    const first = new MapView(document.createElement('div'), seed);
    claim(first, edge);
    assert(first.progress.has(edge.n));

    const again = new MapView(document.createElement('div'), JSON.parse(JSON.stringify(seed)));
    assert(again.progress.has(edge.n), 'a reload should keep the arrows already drawn');

    const edited = JSON.parse(JSON.stringify(seed));
    edited.edges[3].statement = edited.edges[3].statement + ' (reworded)';
    const third = new MapView(document.createElement('div'), edited);
    eq(third.progress.placed.size, 0, 'an edited map should discard its saved answers');
  });
});

describe('the geometry a drawn arrow gets', () => {
  const data = MAPS.get('series');

  it('clips an arrow to the measured box rather than to the node centre', () => {
    const view = freshView(data);
    view.revealAll();
    const edge = data.edges[0];
    const from = view.nodeById.get(edge.from);
    const bare = view.edgeEls.get(edge.n).path.getAttribute('d');
    const startX = Number(bare.split(' ')[1]);
    const startY = Number(bare.split(' ')[2]);
    // Not exactly the centre: clipToBox pushes out by its 3px gap even when the box
    // has no size, so the arrow never starts under its own node's border.
    near(Math.hypot(startX - from.x, startY - from.y), 3, 1e-6,
      'with no box the path starts one gap from the centre');
    for (const box of view.nodeEls.values()) { box.offsetWidth = 140; box.offsetHeight = 46; }
    view.layout();
    assert(bare !== view.edgeEls.get(edge.n).path.getAttribute('d'),
      'measuring the boxes has to move the endpoints');
  });

  it('keeps every badge on the stage', () => {
    const view = freshView(data, true);
    view.revealAll();
    for (const e of data.edges) {
      const badge = view.edgeEls.get(e.n).badge;
      const x = parseFloat(badge.style.left);
      const y = parseFloat(badge.style.top);
      assert(Number.isFinite(x) && Number.isFinite(y), `arrow ${e.n} badge has no position`);
      assert(x > -40 && x < data.width + 40, `arrow ${e.n} badge is off the stage at x=${x}`);
      assert(y > -40 && y < data.height + 40, `arrow ${e.n} badge is off the stage at y=${y}`);
    }
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

teardown();
