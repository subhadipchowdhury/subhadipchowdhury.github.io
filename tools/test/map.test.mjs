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
// The exercise is matching: click an arrow, click the sentence that belongs on it.
// Gone from the three-step version it replaced: the write-your-own step, which could
// not be graded, and the kind question, which collapsed to a coin flip when the
// failing arrows were rewritten.

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

function el() {
  // A throwaway button for offer() to dim when a pick is wrong.
  return document.createElement('button');
}

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
});

describe('mounting a map', () => {
  const data = MAPS.get('series');

  it('builds a badge per arrow and a box per node', () => {
    const view = freshView(data);
    const all = walk(view.root);
    eq(all.filter((n) => n.className === 'cm-node').length, data.nodes.length);
    eq(all.filter((n) => String(n.className).startsWith('cm-badge')).length, data.edges.length);
  });

  it('helper for the offer tests, which need a button to dim', () => {
    // `offer` marks the button it was handed; the tests pass a throwaway one.
    assert(typeof el === 'function');
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

  it('opens on the diagram alone, with the list shut', () => {
    const view = freshView(data);
    assert(view.board.hidden, 'the sheet and the sentences should start hidden');
    assert(view.giveUp.hidden, 'and so should the fill-them-in toggle');
    eq(textOf(view.boardBtn), 'Start matching');
    assert(textOf(view.work).includes('Open the list below'), textOf(view.work));
  });

  it('opens the list when the button is used, and shuts it again', () => {
    const view = freshView(data);
    view.toggleBoard();
    assert(!view.board.hidden);
    eq(textOf(view.boardBtn), 'Hide the list');
    assert(textOf(view.work).includes('then click the sentence'), textOf(view.work));
    view.toggleBoard();
    assert(view.board.hidden, 'and shuts again');
  });

  it('opens the list when an arrow is clicked, since that is half a match', () => {
    const view = freshView(data);
    view.pick(3);
    assert(!view.board.hidden, 'clicking an arrow should open the list');
    eq(view.active, 3);
  });

  it('starts with every arrow empty and the whole list scrambled on offer', () => {
    const view = freshView(data);
    eq(view.progress.placed.size, 0);
    eq(view.bank().length, data.edges.length + data.mistakes.length,
      'the list holds every sentence plus the false ones');
    assert(textOf(view.countEl).startsWith('0 of'), textOf(view.countEl));
  });

  it('does not scramble into the authored order', () => {
    const view = freshView(data);
    const offered = view.bank().map((i) => i.n).join(',');
    const authored = data.edges.map((e) => e.n).join(',');
    assert(!offered.startsWith(authored), 'the list should not be in arrow order');
  });

  it('keeps the same order when a sentence is placed', () => {
    const view = freshView(data);
    const before = view.bank().map((i) => i.statement);
    view.pick(4);
    view.offer({ n: 4, statement: data.edges[3].statement }, el());
    const after = view.bank().map((i) => i.statement);
    // Placing removes one line and moves nothing else.
    eq(after.join('|'), before.filter((x) => x !== data.edges[3].statement).join('|'));
  });

  it('refuses a sentence until an arrow is chosen', () => {
    const view = freshView(data);
    view.offer({ n: 1, statement: data.edges[0].statement }, el());
    eq(view.progress.placed.size, 0, 'nothing should be placed');
    assert(textOf(view.work).includes('Choose an arrow first'), textOf(view.work));
  });

  it('places the right sentence and takes it off the list', () => {
    const view = freshView(data);
    const edge = data.edges[3];
    const before = view.bank().length;
    view.pick(edge.n);
    view.offer({ n: edge.n, statement: edge.statement }, el());
    assert(view.progress.has(edge.n), 'the arrow should be filled in');
    eq(view.bank().length, before - 1, 'and its sentence should leave the list');
    assert(textOf(view.countEl).startsWith('1 of'), textOf(view.countEl));
  });

  it('rejects a sentence that belongs on a different arrow', () => {
    const view = freshView(data);
    view.pick(2);
    view.offer({ n: 7, statement: data.edges[6].statement }, el());
    assert(!view.progress.has(2), 'nothing should be placed');
    assert(!view.progress.has(7), 'and certainly not the arrow the sentence came from');
    assert(textOf(view.work).includes('another arrow'), textOf(view.work));
  });

  it('says a false sentence is false rather than misfiled', () => {
    const view = freshView(data);
    view.pick(2);
    view.offer({ n: null, statement: data.mistakes[0] }, el());
    assert(textOf(view.work).includes('false'), textOf(view.work));
  });

  it('keeps the false sentences on the list to the end', () => {
    const view = freshView(data);
    for (const e of data.edges) {
      view.pick(e.n);
      view.offer({ n: e.n, statement: e.statement }, el());
    }
    eq(view.bank().length, data.mistakes.length, 'the false ones never leave');
  });

  it('leaves the last arrow a real choice', () => {
    const view = freshView(data);
    for (const e of data.edges.slice(0, -1)) {
      view.pick(e.n);
      view.offer({ n: e.n, statement: e.statement }, el());
    }
    eq(view.bank().length, 1 + data.mistakes.length, 'one true sentence among the false ones');
  });

  it('shows what was placed, and why, when a filled arrow is chosen again', () => {
    const view = freshView(data);
    const edge = data.edges[5];
    view.pick(edge.n);
    view.offer({ n: edge.n, statement: edge.statement }, el());
    view.pick(edge.n);
    const text = textOf(view.work);
    assert(text.includes(edge.statement.slice(0, 40)), 'the sentence should be shown');
    assert(text.includes(edge.why.slice(0, 30)), 'and the reason with it');
  });

  it('fills in everything on request', () => {
    const view = freshView(data, true);
    view.revealAll();
    eq(view.progress.placed.size, data.edges.length);
    for (const e of data.edges) {
      assert(String(view.edgeEls.get(e.n).path.getAttribute('class')).includes('cm-edge--shown'),
        `arrow ${e.n} should be marked once everything is filled in`);
    }
  });

  it('empties the sheet again on Start over', () => {
    const view = freshView(data);
    view.revealAll();
    view.progress.clear();
    view.render();
    eq(view.progress.placed.size, 0);
    eq(view.bank().length, data.edges.length + data.mistakes.length);
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
