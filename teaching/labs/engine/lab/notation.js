// The notation key, and the only copy of it.
//
// It used to be hand-written markup in both `_layouts/lab.html` and
// `tools/demo/lab-demo.html`, which meant two files to edit together and, while
// the two labs were written in different notations, one key that had to describe
// both. It is data here instead: `lab.js` renders it above the puzzles, and which
// notation it describes is read off the lab's own blocks.
//
// So a lab converted to sentences shows the sentences, a lab still written with
// arrows shows the arrows, and neither needs a field in the spec or a line in a
// layout. The key stops being a maintenance problem the moment a notation
// changes, which is the whole reason it moved.

// A gate is written in sentences if any of its steps opens with `let`. That is
// the same test `tools/validate.mjs` uses to decide whether to enforce the
// opener rule, and it is the one opener the arrow notation never produces.
export function detectNotation(puzzles) {
  for (const gate of puzzles || []) {
    const blocks = [...(gate.blocks || []), ...(gate.distractors || [])];
    for (const b of blocks) {
      for (const line of b.lines || []) {
        if (/^\s*let\b/.test(line.text || '')) return 'english';
      }
    }
  }
  return 'symbolic';
}

const SHARED_TAIL = [
  ['a · b', 'a − b'],
  'multiplication and subtraction. In a blank you can type * and - instead.',
  ['i ≠ j', 'i ≤ j', 'π'],
  'likewise !=, <= and pi in a blank.',
  ['abs(x)'],
  'along with sqrt, cos, sin, exp, max, min, sum and solve.',
];

// Each entry is [terms, explanation]. Terms render as <code>, one per <dt>.
const KEYS = {
  english: {
    lede: 'Every step is a sentence. Read one out loud and it says what it does. The words that open a step are the ones code uses: for, if, then, else, while, return, print, and let for storing a value.',
    entries: [
      [['let p be 0'], 'stores a value. Nothing here uses = to store; = only ever compares.'],
      [['let column 0 of T be y', 'let row k of U be row p of U'],
        'stores a whole row or column. Taking a row or a column hands back a copy, so the second line here is half of a swap.'],
      [['let n be the number of entries in x'], 'how long x is.'],
      [['let T be a table of n by n zeros'], 'and "a list of n zeros" for one dimension.'],
      [['for each row i from 0 to 3:'],
        'runs i = 0, 1, 2, 3. Both ends are included, so the bound is the last index visited and not a count. The loop variable is the name just before "from", and the words in front of it are there to be read.'],
      [['for each k from 3 down to 0:', 'for each k from 1 to 9 in steps of 2:'],
        'counting down, and counting in steps.'],
      [['if a < b then:', 'else:'], 'the same if and else as in code. "then" is optional.'],
      [['return p', 'return c and T'],
        'hands the answer back and stops. print p shows a value without stopping.'],
      [['x[0]', 'T[i][j]'],
        'subscripts start at 0. An array takes one; a table takes a row and then an entry along that row.'],
    ],
  },
  symbolic: {
    lede: 'The steps are pseudocode rather than Python.',
    entries: [
      [['a ← b'], 'assigns. = compares and never assigns.'],
      [['for i ← 0 to 3:'],
        'runs i = 0, 1, 2, 3. A range includes both ends, so the bound is the last index visited, not a count.'],
      [['for i ← 3 down to 0:'], 'runs the same four values, counting down.'],
      [['x[0]', 'T[i, j]'], 'subscripts start at 0. Arrays take one, tables take two.'],
      [['x[0..n−1]'], 'a slice, ends included.'],
      [['length(x)', 'zeros(n, n)'], 'the length of an array, and a new array or table of zeros.'],
      [['return p', 'return c, T'], 'hands the answer back and stops.'],
    ],
  },
};

const DEPARTURES = 'Two things differ from Python on purpose. Dividing by zero stops the program instead of returning infinity, and a subscript outside the array stops it instead of wrapping to the other end.';

/**
 * The key as a collapsed <details>, for the given notation.
 *
 * @param {'english'|'symbolic'} notation
 * @param {Document} doc  passed in so the DOM stub can render it in a test
 */
export function buildNotationKey(notation, doc = document) {
  const key = KEYS[notation] || KEYS.english;

  const details = doc.createElement('details');
  details.className = 'lab-notation';
  const summary = doc.createElement('summary');
  summary.textContent = 'Notation used in these puzzles';
  details.appendChild(summary);

  const body = doc.createElement('div');
  body.className = 'lab-notation__body';

  const lede = doc.createElement('p');
  lede.textContent = key.lede;
  body.appendChild(lede);

  const dl = doc.createElement('dl');
  for (const [terms, explanation] of key.entries) {
    const dt = doc.createElement('dt');
    terms.forEach((term, k) => {
      if (k) dt.appendChild(doc.createTextNode(', '));
      const code = doc.createElement('code');
      code.textContent = term;
      dt.appendChild(code);
    });
    dl.appendChild(dt);
    const dd = doc.createElement('dd');
    dd.textContent = explanation;
    dl.appendChild(dd);
  }

  // The rows every notation shares, appended in the same shape.
  for (let i = 0; i < SHARED_TAIL.length; i += 2) {
    const dt = doc.createElement('dt');
    SHARED_TAIL[i].forEach((term, k) => {
      if (k) dt.appendChild(doc.createTextNode(', '));
      const code = doc.createElement('code');
      code.textContent = term;
      dt.appendChild(code);
    });
    dl.appendChild(dt);
    const dd = doc.createElement('dd');
    dd.textContent = SHARED_TAIL[i + 1];
    dl.appendChild(dd);
  }
  body.appendChild(dl);

  const departures = doc.createElement('p');
  departures.textContent = DEPARTURES;
  body.appendChild(departures);

  details.appendChild(body);
  return details;
}

export const __test = { KEYS, SHARED_TAIL };
