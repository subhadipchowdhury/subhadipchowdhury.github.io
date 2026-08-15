// The notation key, and the only copy of it.
//
// It used to be hand-written markup in both `_layouts/lab.html` and
// `tools/demo/lab-demo.html`, which meant two files to edit together and no way
// for the key to follow the notation. It is data here instead, and `lab.js`
// renders it above the puzzles. One notation, one key, one file to edit.
//
// It briefly held a second table for the arrow notation, while `lab2-newton` was
// converted to sentences and `lab1-runge` was not. Both are converted now, and
// `tools/validate.mjs` requires every step to open with one of the keywords
// listed here, so a gate cannot go back to arrows without failing the build. The
// interpreter still reads the arrow notation, and the fixture under
// `tools/test/fixtures/` is deliberately written in it to keep that path covered.

const LEDE = 'Every step is a sentence. Read one out loud and it says what it does. The words that open a step are the ones code uses: for, if, then, else, while, return and print, plus let for storing a value.';

// [terms, explanation]. Each term renders as its own <code> inside one <dt>.
const ENTRIES = [
  [['let p be 0'],
    'stores a value. Nothing here uses = to store; = only ever compares.'],
  [['let column 0 of T be y', 'let row k of U be row p of U'],
    'stores a whole row or column. Taking a row or a column hands back a copy, so the second line here is half of a swap.'],
  [['let n be the number of entries in x'],
    'how long x is.'],
  [['let T be a table of n by n zeros'],
    'and "a list of n zeros" for one dimension.'],
  [['for each row i from 0 to 3:'],
    'runs i = 0, 1, 2, 3. Both ends are included, so the bound is the last index visited and not a count. The loop variable is the name just before "from", and the words in front of it are there to be read.'],
  [['for each k from 3 down to 0:', 'for each k from 1 to 9 in steps of 2:'],
    'counting down, and counting in steps.'],
  [['if a < b then:', 'else:'],
    'the same if and else as in code. The "then" is optional.'],
  [['return p', 'return c and T'],
    'hands the answer back and stops. print p shows a value without stopping.'],
  [['x[0]', 'T[i][j]'],
    'subscripts start at 0. An array takes one; a table takes a row and then an entry along that row.'],
  [['a · b', 'a − b'],
    'multiplication and subtraction. In a blank you can type * and - instead.'],
  [['i ≠ j', 'i ≤ j', 'π'],
    'likewise <= and pi in a blank. For ≠ any of !=, /=, <> and ~= will do, since there is no key for it and you may have met a different one.'],
  [['abs(x)'],
    'along with sqrt, cos, sin, exp, max, min, sum and solve.'],
];

const DEPARTURES = 'Two things differ from Python on purpose. Dividing by zero stops the program instead of returning infinity, and a subscript outside the array stops it instead of wrapping to the other end.';

/**
 * The key as a collapsed <details>.
 *
 * @param {Document} doc  passed in so the DOM stub can render it in a test
 */
export function buildNotationKey(doc = document) {
  const details = doc.createElement('details');
  details.className = 'lab-notation';

  const summary = doc.createElement('summary');
  summary.textContent = 'Notation used in these puzzles';
  details.appendChild(summary);

  const body = doc.createElement('div');
  body.className = 'lab-notation__body';

  const lede = doc.createElement('p');
  lede.textContent = LEDE;
  body.appendChild(lede);

  const dl = doc.createElement('dl');
  for (const [terms, explanation] of ENTRIES) {
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
  body.appendChild(dl);

  const departures = doc.createElement('p');
  departures.textContent = DEPARTURES;
  body.appendChild(departures);

  details.appendChild(body);
  return details;
}

export const __test = { LEDE, ENTRIES, DEPARTURES };
