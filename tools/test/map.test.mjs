// Tests for the concept map engine and for the map data.
//
// The geometry is pure and is tested directly, because an arrow anchored to the
// wrong place is the failure nobody notices in a screenshot. Both built maps are
// swept for the invariants the engine relies on, so a hand-edited JSON is caught
// here as well as by tools/author/mapkit.py. And the mount tests check the reveal
// behaviour, which is all the page does now.
//
// What is not covered: how any of it looks. The stub lays nothing out, so the mount
// tests fill in node sizes by hand and check the arithmetic, not the page.
//
// Gone with the three-step exercise on 2026-08-13: the Progress store, the seeded
// shuffle, the answer bank and the kind question. There is nothing to save and
// nothing to grade, so there is nothing to test about either.

import { installDom, walk, textOf } from './dom-stub.mjs';
import {
  KINDS, clipToBox, controlPoint, bezierAt, tangentAt, arrowHead, MapView,
} from '../../teaching/labs/maps/engine/map.js';

const teardown = installDom();

const readText = typeof read === 'function'
  ? (p) => read(p)
  : (await import('node:fs')).readFileSync;

const slurp = (p) => JSON.parse(String(readText(p, 'utf8')));

const MAPS = new Map([
  ['series', slurp('teaching/labs/maps/data/series.json')],
  ['func-sequences', slurp('teaching/labs/maps/data/func-sequences.json')],
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
      eq(data.pdf, `/teaching/labs/maps/${id}.pdf`, `unexpected pdf path ${data.pdf}`);
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

describe('mounting a map', () => {
  const data = MAPS.get('series');

  it('builds a badge per arrow and a box per node', () => {
    const view = freshView(data);
    const all = walk(view.root);
    eq(all.filter((n) => n.className === 'cm-node').length, data.nodes.length);
    eq(all.filter((n) => String(n.className).startsWith('cm-badge')).length, data.edges.length);
  });

  it('says how many arrows there are before any are looked at', () => {
    const view = freshView(data);
    eq(textOf(view.countEl), `${data.edges.length} arrows`);
  });

  it('draws every arrowhead from the start', () => {
    const view = freshView(data, true);
    for (const e of data.edges) {
      assert(view.edgeEls.get(e.n).head.getAttribute('d'),
        `arrow ${e.n} has no head; the direction is the information here`);
    }
  });

  it('puts a second head on an arrow that runs both ways and not otherwise', () => {
    const fs = MAPS.get('func-sequences');
    const view = freshView(fs, true);
    const both = fs.edges.find((e) => e.kind === 'equiv');
    const oneWay = fs.edges.find((e) => e.kind === 'holds');
    assert(view.edgeEls.get(both.n).tail.getAttribute('d'), 'both ways needs a head at each end');
    eq(view.edgeEls.get(oneWay.n).tail.getAttribute('d'), '', 'one way has one head');
  });

  it('shows one arrow and marks only that one', () => {
    const view = freshView(data, true);
    view.showArrow(4);
    eq(view.shown.size, 1);
    assert(String(view.edgeEls.get(4).badge.className).includes('cm-badge--shown'));
    assert(!String(view.edgeEls.get(5).badge.className).includes('cm-badge--shown'));
    assert(textOf(view.work).includes('Arrow 4'), textOf(view.work));
  });

  it('puts the arrow statement and its reason in the panel', () => {
    const view = freshView(data, true);
    const edge = data.edges[3];
    view.showArrow(edge.n);
    const text = textOf(view.work);
    assert(text.includes(edge.statement.slice(0, 40)), 'the statement should be shown');
    assert(text.includes(edge.why.slice(0, 30)), 'and the reason with it');
  });

  it('counts the arrows looked at', () => {
    const view = freshView(data, true);
    view.showArrow(1);
    view.showArrow(2);
    view.showArrow(1);
    eq(view.shown.size, 2, 'the same arrow twice is one arrow');
    assert(textOf(view.countEl).startsWith('2 of'), textOf(view.countEl));
  });

  it('reveals every arrow at once', () => {
    const view = freshView(data, true);
    view.revealAll();
    eq(view.shown.size, data.edges.length);
    for (const e of data.edges) {
      assert(String(view.edgeEls.get(e.n).path.getAttribute('class')).includes('cm-edge--shown'),
        `arrow ${e.n} should be marked after revealing everything`);
    }
  });

  it('carries every answer in the page, behind the toggle', () => {
    const view = freshView(data);
    const fold = walk(view.root).find((n) => String(n.className).includes('cm-fold--answers'));
    assert(fold, 'wants an answers fold');
    const text = textOf(fold);
    for (const e of data.edges) {
      assert(text.includes(e.statement.slice(0, 40)), `arrow ${e.n} is missing from the answer list`);
    }
    for (const m of data.mistakes) {
      assert(text.includes(m.slice(0, 30)), 'a listed mistake is missing from the answer list');
    }
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

  it('shows a box definition when the box is clicked', () => {
    const view = freshView(data);
    view.showDefinition(data.nodes[2]);
    const text = textOf(view.work);
    assert(text.includes('Box ' + data.nodes[2].letter), text);
    assert(text.includes(data.nodes[2].definition.slice(0, 25)), 'and its definition');
  });

  it('clips an arrow to the measured box rather than to the node centre', () => {
    const view = freshView(data);
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
