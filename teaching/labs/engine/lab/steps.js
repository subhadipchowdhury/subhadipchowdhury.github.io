// Locating a failure in the student's own arrangement.
//
// The rest of the grader answers "is this right?". This answers "where does it
// go wrong?", which is the question a student who has run out of ideas is
// actually asking, and it answers it in two cases:
//
//   - the algorithm stopped, and we say at which step and on which pass
//   - the algorithm finished and the numbers are wrong, and we say which entry
//     came out wrong first, which step wrote it, and on which pass
//
// Neither discloses a reference value, and neither says what to change. Naming
// the step is not disclosure: the step is the student's own line, and the board
// is already showing it.
//
// The second case is why interp.js keeps a write log. Comparing a run against
// the reference step by step is only sound where the two runs write the same
// entries, so what is compared is the *last* write to each entry: the value that
// survives. Intermediate writes are skipped, so an algorithm that legitimately
// overwrites an entry is not accused of getting it wrong on the way.

import { run, valuesEqual, isArr2 } from './interp.js';

// ---------------------------------------------------------------------------
// Naming things the student can see
// ---------------------------------------------------------------------------

/**
 * The assembled line at `index`, with each blank replaced by what the student
 * typed into it, so the quoted step reads exactly as it does on the board.
 */
export function stepText(lines, index, blanks = {}) {
  const line = lines?.[index];
  if (!line) return null;
  return line.text.replace(/⟨\?([^⟩]+)⟩/g, (_, name) => {
    const filled = String(blanks[name.trim()] ?? '').trim();
    if (filled === '') return '___';
    // A blank parses as a sub-expression, so its contents are bracketed however
    // the student wrote them. Quoting "/ x[j] - x[i]" would read as something
    // else entirely, so anything with an operator in it keeps its brackets.
    return /[-+*/^]/.test(filled) && !/^\(.*\)$/.test(filled) ? `(${filled})` : filled;
  });
}

/** "with j = 2 and i = 0", outermost loop first, or null at the top level. */
export function passPhrase(loops) {
  if (!loops || !loops.length) return null;
  const parts = loops.map((f) => `${f.name} = ${f.value}`);
  if (parts.length === 1) return `with ${parts[0]}`;
  return `with ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** T[0][2] for a table entry, c[3] for an array entry, as the blocks write it. */
export function describeCell(name, cell) {
  if (!cell || !cell.length) return name;
  return name + cell.map((k) => `[${k}]`).join('');
}

// ---------------------------------------------------------------------------
// The algorithm stopped
// ---------------------------------------------------------------------------

/**
 * Where a runtime error happened, in the student's own terms.
 *
 * @param {RuntimeError} err   carries blockId, line and (from run) loops
 * @param {Array}  lines       the assembled lines, as verify built them
 * @param {Object} blanks      the student's blank text
 * @param {string} on          probe label, e.g. "the test input x = [0, 1, 3, 6]"
 * @returns {{message: string, detail: string|null}}
 */
export function crashReport(err, lines, blanks, on) {
  const step = err.line === undefined || err.line === null
    ? null
    : stepText(lines, err.line, blanks);
  const pass = passPhrase(err.loops);

  const where = [
    step ? `at the step "${step}"` : null,
    pass ? `on the pass ${pass}` : null,
  ].filter(Boolean).join(', ');

  if (err.kind === 'cap') {
    const stuck = where
      ? `On ${on}, your algorithm never finished. It was still running ${where}.`
      : `On ${on}, your algorithm never finished.`;
    return { message: stuck, detail: 'Something in a loop never shrinks, so the same work keeps coming round again.' };
  }

  const message = where
    ? `On ${on}, your algorithm stopped ${where}.`
    : `On ${on}, your algorithm stopped.`;

  const detail = err.kind === 'index'
    ? `${err.message} A subscript outside the array stops the program here, it doesn't wrap round to the other end.`
    : err.message;

  return { message, detail };
}

// ---------------------------------------------------------------------------
// The algorithm finished and the numbers are wrong
// ---------------------------------------------------------------------------

/**
 * The first entry the student's run finished with a wrong value in it, or the
 * first entry a correct run fills in and theirs never touches.
 *
 * Both runs are re-run with logging on, which is why this is only called once a
 * submission has already failed: the graded run itself carries no logging cost.
 *
 * @returns {Object|null} { why, message, detail, blockId } or null when the
 *   write logs say nothing useful (a scalar accumulator, mostly)
 */
export function divergenceReport({ gate, program, refProgram, probe, lines, blanks }) {
  const tol = gate.tolerance ?? 1e-9;
  const opts = {
    env: probe.env,
    call: probe.call,
    trace: gate.trace || [],
    maxSteps: gate.maxSteps || 1e6,
    log: true,
  };

  let mine;
  let theirs;
  try {
    mine = run(program, opts);
    theirs = run(refProgram, opts);
  } catch {
    return null; // the crash path owns this case
  }

  // A gate whose answer is a single number writes no entries at all, so the
  // lookup is empty and the two checks below the loop are the whole diagnosis.
  const refValue = referenceLookup(theirs) || (() => undefined);

  // Only the surviving write to each entry is judged; see the note at the top.
  const lastWrite = new Map();
  mine.writes.forEach((w, k) => { if (w.cell.length) lastWrite.set(w.key, k); });

  for (let k = 0; k < mine.writes.length; k++) {
    const w = mine.writes[k];
    if (!w.cell.length || lastWrite.get(w.key) !== k) continue;
    const want = refValue(w.name, w.cell);
    if (want === undefined || typeof w.value !== 'number') continue;
    if (valuesEqual(w.value, want, tol)) continue;

    const cell = describeCell(w.name, w.cell);
    const pass = passPhrase(w.loops);
    const step = stepText(lines, w.line, blanks);
    const unfilled = unfilledDetail(mine, k);

    return {
      why: 'first_wrong_entry',
      blockId: w.blockId ?? null,
      unfilled: !!unfilled,
      message: pass
        ? `Your algorithm ran to the end, and the first entry it gets wrong is ${cell}, written on the pass ${pass}. The entries it finished before that pass are all right.`
        : `Your algorithm ran to the end, and the first entry it gets wrong is ${cell}.`,
      detail: unfilled || (step ? `The step that writes it is "${step}".` : null),
    };
  }

  // Nothing wrong in what they wrote, so something they never wrote is missing.
  const missing = firstMissing(theirs, mine);
  if (missing) {
    return {
      why: 'entry_never_written',
      blockId: null,
      message: `Your algorithm ran to the end, and every entry it fills in is right. It never fills in ${missing}.`,
      detail: `${missing} still holds whatever the table started with.`,
    };
  }

  // Nothing written wrong and nothing left unwritten, so the remaining structural
  // fault visible in a log is an input the algorithm never looks at. This is the
  // one that reaches a gate whose answer is a single number, where there are no
  // entries to compare and the classifiers have nothing to say either.
  const unread = firstUnreadInput(theirs, mine, probe);
  if (unread) {
    return {
      why: 'input_never_read',
      blockId: null,
      message: `Your algorithm ran to the end, and it never uses ${unread}.`,
      detail: 'Which entries does your loop actually visit?',
    };
  }

  return null;
}

// A read of an entry nothing had written yet, at or before the write that first
// went wrong. This is the shape every wrong loop bound takes, and it explains
// the wrong value without saying what the right one is.
function unfilledDetail(mine, writeIndex) {
  const hit = (mine.unfilled || []).find((u) => u.after <= writeIndex);
  if (!hit) return null;
  const cell = describeCell(hit.name, hit.cell);
  const pass = passPhrase(hit.loops);
  return pass
    ? `On the pass ${pass} it read ${cell}, which nothing had written to yet.`
    : `It read ${cell}, which nothing had written to yet.`;
}

// The value a correct run leaves in an entry. Prefers the traced structure, so
// an entry no write touched (a zero left by zeros) still has an answer.
function referenceLookup(theirs) {
  const traced = theirs.trace || {};
  const final = new Map();
  for (const w of theirs.writes) if (w.cell.length) final.set(w.key, w.value);
  if (!final.size && !Object.keys(traced).length) return null;

  return (name, cell) => {
    const box = traced[name];
    if (box !== undefined) {
      const v = readCell(box, cell);
      if (v !== undefined) return v;
    }
    const key = `${name}|${cell.join(',')}`;
    return final.has(key) ? final.get(key) : undefined;
  };
}

function readCell(box, cell) {
  if (cell.length === 1) return Array.isArray(box) && !isArr2(box) ? box[cell[0]] : undefined;
  if (cell.length === 2) return isArr2(box) ? (box[cell[0]] || [])[cell[1]] : undefined;
  return undefined;
}

// The first entry of an input array that a correct run reads and this one never
// does. Restricted to the probe's own inputs, so an internal table half-filled
// on purpose is not reported as unread. Set iteration is insertion order, which
// here is the order a correct run reads them in.
function firstUnreadInput(theirs, mine, probe) {
  const inputs = new Set(
    Object.entries(probe.env || {})
      .filter(([, v]) => Array.isArray(v))
      .map(([k]) => k),
  );
  if (!inputs.size) return null;
  for (const key of theirs.readKeys) {
    if (mine.readKeys.has(key)) continue;
    const cut = key.indexOf('|');
    const name = key.slice(0, cut);
    if (!inputs.has(name) || mine.created.has(name)) continue;
    const cell = key.slice(cut + 1);
    if (!cell) continue;
    return describeCell(name, cell.split(','));
  }
  return null;
}

function firstMissing(theirs, mine) {
  const written = new Set(mine.writes.filter((w) => w.cell.length).map((w) => w.key));
  for (const w of theirs.writes) {
    if (!w.cell.length) continue;
    if (!written.has(w.key)) return describeCell(w.name, w.cell);
  }
  return null;
}

export const __test = { referenceLookup, firstMissing, unfilledDetail };
