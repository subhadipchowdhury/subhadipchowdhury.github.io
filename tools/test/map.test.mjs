// Tests for the concept map engine and for the map data.
//
// Three groups. The geometry and the small utilities are pure and are tested
// directly, because an arrow anchored to the wrong place is the failure nobody
// notices in a screenshot. Progress is tested against an injected store. And both
// built maps are swept for the invariants the engine relies on, so a hand-edited
// JSON is caught here as well as by tools/author/mapkit.py.
//
// What is not covered: how any of it looks. The stub lays nothing out, so the
// mount test fills in node sizes by hand and checks the arithmetic, not the page.

import { installDom, walk, textOf } from './dom-stub.mjs';
import {
  KINDS, hashString, stampOf, seededShuffle,
  clipToBox, controlPoint, bezierAt, tangentAt, arrowHead,
  Progress, MapView,
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

describe('hashing and the stamp', () => {
  it('is stable and differs on different input', () => {
    eq(hashString('abc'), hashString('abc'));
    assert(hashString('abc') !== hashString('abd'));
  });

  it('changes when an arrow changes, and not when prose elsewhere does', () => {
    const data = MAPS.get('series');
    const before = stampOf(data);
    const copy = JSON.parse(JSON.stringify(data));
    copy.intro = 'something else entirely';
    eq(stampOf(copy), before, 'the intro is not part of the answer key');
    copy.edges[3].kind = copy.edges[3].kind === 'implies' ? 'fails' : 'implies';
    assert(stampOf(copy) !== before, 'a changed kind has to invalidate saved answers');
  });
});

describe('the shuffle', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('keeps every item', () => {
    const out = seededShuffle(items, 'seed');
    eq(out.length, items.length);
    eq(out.slice().sort((a, b) => a - b).join(','), items.join(','));
  });

  it('gives the same order for the same seed', () => {
    eq(seededShuffle(items, 'abc').join(','), seededShuffle(items, 'abc').join(','));
  });

  it('actually reorders, and differently for a different seed', () => {
    assert(seededShuffle(items, 'abc').join(',') !== items.join(','));
    assert(seededShuffle(items, 'abc').join(',') !== seededShuffle(items, 'xyz').join(','));
  });

  it('leaves the array it was handed alone', () => {
    seededShuffle(items, 'abc');
    eq(items.join(','), '1,2,3,4,5,6,7,8,9,10');
  });
});

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
    const back = controlPoint(0, 0, 100, 0, -30);
    near(back.y, -30);
  });

  it('bends by the same distance whatever the chord length', () => {
    const short = controlPoint(0, 0, 10, 0, 25);
    const long = controlPoint(0, 0, 1000, 0, 25);
    near(short.y, 25);
    near(long.y, 25);
  });

  it('passes through both ends and bulges toward the control point', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 0 };
    const c = { x: 50, y: 60 };
    const a = bezierAt(0, p0, c, p1);
    const b = bezierAt(1, p0, c, p1);
    near(a.x, 0); near(a.y, 0);
    near(b.x, 100); near(b.y, 0);
    const mid = bezierAt(0.5, p0, c, p1);
    near(mid.x, 50);
    near(mid.y, 30, 1e-9, 'the curve reaches half the control offset at the midpoint');
  });

  it('gives a unit tangent that points along the curve', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 100, y: 0 };
    const c = { x: 50, y: 0 };
    const t = tangentAt(1, p0, c, p1);
    near(Math.hypot(t.x, t.y), 1);
    near(t.x, 1);
    near(t.y, 0);
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

describe('progress', () => {
  const fakeStore = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      _map: map,
    };
  };

  it('starts empty and records a solve', () => {
    const p = new Progress('m', 'stamp1', fakeStore());
    assert(!p.isSolved(3));
    p.solve(3);
    assert(p.isSolved(3));
  });

  it('does not record the same arrow twice', () => {
    const p = new Progress('m', 'stamp1', fakeStore());
    p.solve(3);
    p.solve(3);
    eq(p.state.solved.length, 1);
  });

  it('comes back after a reload', () => {
    const store = fakeStore();
    const first = new Progress('m', 'stamp1', store);
    first.solve(2);
    first.note(2, 'my own sentence');
    first.reflection('arrow 5');
    const second = new Progress('m', 'stamp1', store);
    assert(second.isSolved(2));
    eq(second.note(2), 'my own sentence');
    eq(second.reflection(), 'arrow 5');
  });

  it('throws away answers saved against a different set of arrows', () => {
    const store = fakeStore();
    const first = new Progress('m', 'stamp1', store);
    first.solve(2);
    first.note(2, 'written against the old question');
    const edited = new Progress('m', 'stamp2', store);
    assert(!edited.isSolved(2), 'an edited map must not restore stale answers');
    eq(edited.note(2), '');
  });

  it('survives a corrupt store rather than throwing', () => {
    const store = fakeStore();
    store.setItem('cmap:1:m', 'not json at all');
    const p = new Progress('m', 'stamp1', store);
    eq(p.state.solved.length, 0);
  });

  it('survives a store that refuses to be written to', () => {
    const blocked = {
      getItem: () => null,
      setItem: () => { throw new Error('quota'); },
    };
    const p = new Progress('m', 'stamp1', blocked);
    p.solve(1);
    assert(p.isSolved(1), 'the in-memory answer stands even when the save fails');
  });

  it('clears everything', () => {
    const p = new Progress('m', 'stamp1', fakeStore());
    p.solve(1);
    p.note(1, 'x');
    p.reflection('y');
    p.clear();
    eq(p.state.solved.length, 0);
    eq(p.note(1), '');
    eq(p.reflection(), '');
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

    it('uses only the four kinds the legend shows', () => {
      for (const e of data.edges) {
        assert(KINDS[e.kind], `arrow ${e.n} has the unknown kind ${e.kind}`);
      }
    });

    it('gives every arrow a statement of its own', () => {
      const seen = new Set();
      for (const e of data.edges) {
        assert(e.statement && e.statement.length > 40, `arrow ${e.n} has no real statement`);
        assert(!seen.has(e.statement), `arrow ${e.n} repeats another statement`);
        seen.add(e.statement);
      }
    });

    it('carries decoys, so the last arrow is not free', () => {
      assert((data.decoys || []).length >= 3, 'wants at least three decoys');
      const real = new Set(data.edges.map((e) => e.statement));
      for (const d of data.decoys) assert(!real.has(d), 'a decoy repeats a real statement');
    });

    it('leaves every box reachable by some arrow', () => {
      const touched = new Set();
      for (const e of data.edges) { touched.add(e.from); touched.add(e.to); }
      for (const n of data.nodes) {
        assert(touched.has(n.id), `box ${n.id} has no arrow, so nothing on the map asks about it`);
      }
    });

    it('defines every box', () => {
      for (const n of data.nodes) {
        assert(n.definition && n.definition.length > 20, `box ${n.id} has no definition`);
      }
    });

    it('names a paper version that exists', () => {
      assert(data.pdf === `/teaching/labs/maps/${id}.pdf`, `unexpected pdf path ${data.pdf}`);
      // The JSON claiming a worksheet that was never built would put a dead link
      // in the status bar of the page.
      const bytes = readText('teaching' + data.pdf.slice('/teaching'.length));
      assert(bytes.length > 20000, `${data.pdf} is too small to be the worksheet`);
    });

    it('hints at every failing arrow', () => {
      for (const e of data.edges) {
        if (e.kind === 'fails') assert(e.hint, `arrow ${e.n} fails and has no hint`);
      }
    });
  });
}

/* -------------------------------------------------------------------------- */

// Each view gets its own map id, because progress is keyed on it and two views
// of one map would otherwise share a store and read each other's answers.
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
  let view;

  it('builds a badge per arrow and a box per node', () => {
    view = freshView(data);
    const all = walk(view.root);
    eq(all.filter((n) => n.className === 'cm-node').length, data.nodes.length);
    eq(all.filter((n) => String(n.className).startsWith('cm-badge')).length, data.edges.length);
  });

  it('reports nothing solved to begin with', () => {
    assert(textOf(view.countEl).startsWith('0 of'), textOf(view.countEl));
  });

  it('offers every statement plus every decoy in the bank', () => {
    eq(view.bank().length, data.edges.length + data.decoys.length);
  });

  it('takes a statement out of the bank once its arrow is named', () => {
    const before = view.bank().length;
    view.progress.solve(1);
    view.refresh();
    eq(view.bank().length, before - 1);
    assert(textOf(view.countEl).startsWith('1 of'));
  });

  it('draws no arrowhead on an arrow nobody has named', () => {
    const parts = view.edgeEls.get(2);
    assert(!view.progress.isSolved(2), 'arrow 2 should still be open here');
    eq(parts.head.getAttribute('d'), '', 'an unnamed arrow must not reveal its direction or kind');
    eq(parts.path.getAttribute('class'), 'cm-edge', 'and must be drawn in the neutral style');
  });

  it('styles an arrow by its kind once it is named', () => {
    const edge = data.edges.find((e) => e.kind === 'fails');
    view.progress.solve(edge.n);
    view.refresh();
    const parts = view.edgeEls.get(edge.n);
    assert(String(parts.path.getAttribute('class')).includes('cm-edge--fails'), parts.path.getAttribute('class'));
    assert(parts.head.getAttribute('d'), 'a named arrow gets a head');
  });

  it('puts a head at both ends of an equivalence and at one end otherwise', () => {
    const fs = MAPS.get('func-sequences');
    const both = freshView(fs, true);
    const equiv = fs.edges.find((e) => e.kind === 'equiv');
    const plain = fs.edges.find((e) => e.kind === 'implies');
    both.progress.solve(equiv.n);
    both.progress.solve(plain.n);
    both.refresh();
    assert(both.edgeEls.get(equiv.n).tail.getAttribute('d'), 'an equivalence needs a head at each end');
    eq(both.edgeEls.get(plain.n).tail.getAttribute('d'), '', 'a one-way arrow has one head');
  });

  it('clips an arrow to the measured box rather than to the node centre', () => {
    const fresh = freshView(data);
    const edge = data.edges[0];
    const from = fresh.nodeById.get(edge.from);
    // Zero-sized boxes put the path at the two centres; a real box moves it in.
    const bare = fresh.edgeEls.get(edge.n).path.getAttribute('d');
    const startX = Number(bare.split(' ')[1]);
    const startY = Number(bare.split(' ')[2]);
    // Not exactly the centre: clipToBox pushes out by its 3px gap even when the
    // box has no size, so the arrow never starts under its own node's border.
    near(Math.hypot(startX - from.x, startY - from.y), 3, 1e-6,
      'with no box the path starts one gap from the centre');
    for (const box of fresh.nodeEls.values()) { box.offsetWidth = 140; box.offsetHeight = 46; }
    fresh.layout();
    const clipped = fresh.edgeEls.get(edge.n).path.getAttribute('d');
    assert(bare !== clipped, 'measuring the boxes has to move the endpoints');
  });

  it('keeps the badge on the curve', () => {
    const fresh = freshView(data, true);
    for (const e of data.edges) {
      const badge = fresh.edgeEls.get(e.n).badge;
      const x = parseFloat(badge.style.left);
      const y = parseFloat(badge.style.top);
      assert(Number.isFinite(x) && Number.isFinite(y), `arrow ${e.n} badge has no position`);
      assert(x > -40 && x < data.width + 40, `arrow ${e.n} badge is off the stage at x=${x}`);
      assert(y > -40 && y < data.height + 40, `arrow ${e.n} badge is off the stage at y=${y}`);
    }
  });

  it('holds the reflection back until every arrow is named', () => {
    const fresh = freshView(data);
    assert(fresh.done.hidden, 'the closing question should not be showing yet');
    for (const e of data.edges) fresh.progress.solve(e.n);
    fresh.refresh();
    assert(!fresh.done.hidden, 'and should show once the map is finished');
  });

  it('still offers the decoys once every arrow is named', () => {
    const fresh = freshView(data);
    for (const e of data.edges) fresh.progress.solve(e.n);
    fresh.refresh();
    eq(fresh.bank().length, data.decoys.length, 'the decoys never leave the bank');
  });

  it('leaves the last arrow a real choice', () => {
    const fresh = freshView(data);
    for (const e of data.edges.slice(0, -1)) fresh.progress.solve(e.n);
    fresh.refresh();
    eq(fresh.bank().length, 1 + data.decoys.length, 'one true statement among the decoys');
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
