// Build-time validation of a lab spec.
//
//     node tools/validate.mjs teaching/labs/data/specs/lab2-newton.json
//     jsc -m tools/validate.mjs -- teaching/labs/data/specs/lab2-newton.json
//
// build_labs.py runs this and refuses to ship a spec it rejects. The main check
// pushes every distractor and every wrong answer through the real grader, and
// requires two things of each: that it is rejected, and that it comes back with
// the message written for it. A distractor the probes cannot separate from the
// answer lets a student pass while wrong, and a message nothing can reach may
// as well not be written.

import { buildReference, verify } from '../teaching/labs/engine/lab/verify.js';
import { evalExpression } from '../teaching/labs/engine/lab/interp.js';

// ---------------------------------------------------------------------------
// Runtime compatibility: node and the JavaScriptCore shell
// ---------------------------------------------------------------------------

const isNode = typeof process !== 'undefined' && !!process.versions?.node;
const argv = isNode ? process.argv.slice(2) : (globalThis.arguments ?? []);
const say = typeof print === 'function' ? print : console.log;

async function readText(path) {
  if (isNode) {
    const fs = await import('node:fs');
    return fs.readFileSync(path, 'utf8');
  }
  return globalThis.read(path);
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

const problems = [];
const notes = [];

function bad(where, message) { problems.push(`${where}: ${message}`); }

// ---------------------------------------------------------------------------
// Editorial rules
// ---------------------------------------------------------------------------
//
// These are the rules a lab kept breaking while the first one was written: a
// puzzle that asked for work it had not given the student enough to do, output
// that arrived with no account of where it came from, and copy that invented
// facts about the course. They run against every lab, so a new one cannot be
// built without them.

const PRESUMED = [
  'this week', 'last week', 'on the board', 'in class', 'in lecture',
  'as we saw', 'as discussed', 'last lab', 'next lab', 'homework', 'problem set',
  'we covered', 'you learned',
];

// Phrasing that reads as machine-written. Most of these are filler that says
// nothing ("worth noticing"), a flourish standing in for an explanation ("that
// is what makes"), or a stock instruction repeated until it is wallpaper ("your
// job"). The rhythm they belong to cannot be caught by a list, but the phrases
// can, and every one below was in the first draft of this lab.
const TICS = [
  ['your job', 'a stock label in every brief; write the instruction as a sentence'],
  ['your task', 'same'],
  ['worth noticing', 'says nothing; either it matters or cut it'],
  ['worth asking', 'same'],
  ['it is worth', 'same'],
  ['that is what makes', 'a flourish where an explanation should be'],
  ['this is where', 'same'],
  ['at its core', 'same'],
  ['the beauty of', 'same'],
  ['the key insight', 'same'],
  ['ask which', 'say what to look at rather than telling the student to ask'],
  ['ask yourself', 'same'],
  ['keep in mind', 'filler'],
  ['bear in mind', 'filler'],
  ['it is important to', 'filler'],
  ['simply ', 'tells a stuck student the thing they are stuck on is easy'],
  ['straightforward', 'same'],
  ['powerful', 'inflated'],
  ['elegant', 'inflated'],
  ['crucial', 'inflated'],
  ['delve', 'nobody writes this'],
];

// Verbs a brief can open its instruction with. The rule below wants at least
// one sentence that starts with one, which is what an instruction looks like.
const IMPERATIVES = [
  'write', 'build', 'turn', 'fill', 'print', 'arrange', 'complete', 'decide',
  'evaluate', 'place', 'drag', 'find', 'state', 'rearrange', 'reconstruct',
  'assemble', 'sort', 'give', 'compute', 'solve', 'derive', 'read', 'replace',
];

function textOf(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Sentences, roughly. Block tags end a sentence whether or not the author put a
// full stop before the closing tag, and a decimal point does not start one.
function sentencesOf(html) {
  const flat = String(html || '')
    .replace(/<\/(p|li|h[1-6]|pre|div|blockquote|td|th)>/gi, '  ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');
  return flat
    .split(/(?<=[.:?!])\s+(?=[^\d])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function wordsOf(text) {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) || [];
}

function everyString(spec) {
  const out = [['intro', spec.intro_html], ['blurb', spec.blurb]];
  for (const gate of spec.puzzles || []) {
    out.push([`${gate.cell_id} brief`, gate.brief_html]);
    out.push([`${gate.cell_id} title`, gate.title]);
    if (gate.setup) {
      out.push([`${gate.cell_id} setup intro`, gate.setup.intro_html]);
      out.push([`${gate.cell_id} setup caption`, gate.setup.caption_html]);
    }
    for (const message of Object.values(gate.feedback || {})) {
      out.push([`${gate.cell_id} feedback`, message]);
    }
  }
  return out;
}

// "Housekeeping, not algorithm." "Same iterations, different fence." A very
// short sentence built round a comma is almost always a verbless aphorism
// standing where a clause belonged. Four words catches every one of those and
// leaves room for a real short sentence like "There's a trap here, though."
function checkFragments(where, what, html) {
  for (const sentence of sentencesOf(html)) {
    if (!sentence.includes(',')) continue;
    const words = wordsOf(sentence);
    if (words.length && words.length <= 4) {
      bad(where, `${what} has the fragment "${sentence}"; write it as a full sentence`);
    }
  }
}

// The same construction reused across every puzzle stops being phrasing and
// becomes a template. Only a warning: some repetition is the house notation
// doing its job.
function checkFormula(where, spec) {
  const counts = new Map();
  for (const [what, html] of everyString(spec)) {
    const words = wordsOf(textOf(html));
    const local = new Set();
    for (let i = 0; i + 4 <= words.length; i++) {
      local.add(words.slice(i, i + 4).join(' '));
    }
    for (const gram of local) {
      if (!counts.has(gram)) counts.set(gram, []);
      counts.get(gram).push(what);
    }
  }
  // A repeated seven-word phrase shows up as four overlapping four-grams.
  // Chain them back into one before reporting, or one lapse reads as four.
  const flagged = [...counts].filter(([, w]) => w.length >= 3);
  const byPlaces = new Map();
  for (const [gram, wheres] of flagged) {
    const key = wheres.join('|');
    if (!byPlaces.has(key)) byPlaces.set(key, { wheres, grams: new Set() });
    byPlaces.get(key).grams.add(gram);
  }
  for (const { wheres, grams } of byPlaces.values()) {
    // A gram whose first three words are some other gram's last three is the
    // middle of a longer phrase; only the leftmost one is worth reporting.
    const tails = new Set([...grams].map((g) => g.split(' ').slice(1).join(' ')));
    for (const gram of grams) {
      if (tails.has(gram.split(' ').slice(0, 3).join(' '))) continue;
      let phrase = gram;
      let grown = true;
      while (grown) {
        grown = false;
        const suffix = phrase.split(' ').slice(-3).join(' ');
        for (const other of grams) {
          if (other.split(' ').slice(0, 3).join(' ') === suffix) {
            phrase += ' ' + other.split(' ')[3];
            grown = true;
            break;
          }
        }
      }
      notes.push(`${where}: "${phrase}" appears in ${wheres.length} places (${wheres.join(', ')}); `
        + 'check it is notation and not a formula you keep reaching for');
    }
  }
}

function checkEditorial(spec) {
  const where = spec.lab_id;

  const intro = textOf(spec.intro_html);
  if (intro.length < 200) {
    bad(where, 'the lab has no real intro. Say what the puzzles build and name '
      + 'the worked example their output comes from');
  }

  // Nothing may assume when the lab is set, what order it is done in, or what
  // was said in a room.
  for (const [what, html] of everyString(spec)) {
    const text = textOf(html).toLowerCase();
    for (const phrase of PRESUMED) {
      if (text.includes(phrase)) {
        bad(where, `${what} says "${phrase}", which assumes something about the course around the lab`);
      }
    }
    for (const [phrase, why] of TICS) {
      if (text.includes(phrase)) {
        bad(where, `${what} says "${phrase.trim()}": ${why}`);
      }
    }
    if (textOf(html).includes('—')) {
      bad(where, `${what} has an em dash; use a comma, a full stop or brackets`);
    }
    checkFragments(where, what, html);
  }

  checkFormula(where, spec);

  for (const gate of spec.puzzles || []) {
    const at = `${where}/${gate.cell_id}`;
    const brief = textOf(gate.brief_html);

    if (brief.length < 300) {
      bad(at, 'the brief is too thin to solve from. State the mathematics the '
        + 'puzzle turns on, then what is being asked');
    }
    // An instruction is a sentence that opens with a verb. Asking for that,
    // rather than for a stock phrase, leaves the wording free.
    const instructs = sentencesOf(gate.brief_html).some((s) => {
      const first = (wordsOf(s)[0] || '');
      return IMPERATIVES.includes(first);
    });
    if (brief && !instructs) {
      bad(at, 'no sentence in the brief opens with an instruction, so it never '
        + `says plainly what to do. Start one with ${IMPERATIVES.slice(0, 4).join(', ')} or similar`);
    }
    if (!gate.title || gate.title.length < 8) {
      bad(at, 'no usable title');
    }

    // Output with nothing to say what it is, is the thing this rule exists for.
    const setup = gate.setup;
    if (setup && (setup.stdout || (setup.figures || []).length)) {
      if (!textOf(setup.intro_html)) {
        bad(at, 'the setup shows output with no sentence saying what it is or '
          + 'where it came from');
      }
    }
    if (setup && !setup.stdout && !(setup.figures || []).length) {
      notes.push(`${at}: the setup produced no output; is its code doing anything?`);
    }
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkStructure(gate, where) {
  const blockIds = new Set(gate.blocks.map((b) => b.id));
  const decoyIds = new Set((gate.distractors || []).map((d) => d.id));

  for (const id of decoyIds) {
    if (blockIds.has(id)) bad(where, `"${id}" is both a block and a distractor`);
  }

  const solutionIds = gate.solution.map((s) => s.id);
  for (const id of solutionIds) {
    if (!blockIds.has(id)) bad(where, `the solution places "${id}", which is not a block`);
  }
  for (const id of blockIds) {
    if (!solutionIds.includes(id)) {
      bad(where, `block "${id}" is never placed by the solution; it should be a distractor`);
    }
  }
  if (new Set(solutionIds).size !== solutionIds.length) {
    bad(where, 'the solution places the same block twice');
  }

  if (!gate.probes?.length) bad(where, 'no probes, so nothing can be graded');

  // Every written message needs something that can reach it.
  const feedback = gate.feedback || {};
  for (const d of gate.distractors || []) {
    if (!d.why) bad(where, `distractor "${d.id}" has no why`);
    else if (!feedback[d.why]) bad(where, `distractor "${d.id}" points at feedback "${d.why}", which is not written`);
    if (!blockIds.has(d.near)) bad(where, `distractor "${d.id}" sits near "${d.near}", which is not a block`);
  }
  for (const [name, alternatives] of Object.entries(gate.wrong_blanks || {})) {
    if (!gate.blanks?.[name]) bad(where, `wrong_blanks names "${name}", which is not a blank`);
    for (const alt of alternatives) {
      if (!alt.why) bad(where, `a wrong answer for "${name}" has no why`);
      else if (!feedback[alt.why]) bad(where, `wrong answer "${alt.text}" points at feedback "${alt.why}", which is not written`);
    }
  }
  for (const key of Object.keys(feedback)) {
    const reachable = (gate.distractors || []).some((d) => d.why === key)
      || Object.values(gate.wrong_blanks || {}).some((xs) => xs.some((a) => a.why === key));
    if (!reachable) notes.push(`${where}: feedback "${key}" is never reachable`);
  }

  // Blanks appear in block text; a blank nothing mentions is dead weight.
  const allText = [...gate.blocks, ...(gate.distractors || [])]
    .flatMap((b) => b.lines.map((l) => l.text)).join('\n');
  for (const name of Object.keys(gate.blanks || {})) {
    if (!allText.includes(`⟨?${name}⟩`)) bad(where, `blank "${name}" appears in no block`);
  }
  for (const m of allText.matchAll(/⟨\?([^⟩]+)⟩/g)) {
    if (!gate.blanks?.[m[1].trim()]) bad(where, `block text uses blank "${m[1].trim()}", which is not declared`);
  }

  checkBlockLines(gate, where);
}

// Two rules about a tile staying a tile. Neither is about grammar: the
// interpreter already rejects a line it cannot read.

// Every step of the English notation opens with one of these. `return` is not
// among them on purpose, because `report` is the word in that notation.
const OPENERS = ['function', 'let', 'copy', 'for', 'if', 'else', 'while', 'report', 'print'];

// Only these three can open a line in the English notation and nothing else, so
// seeing one means the gate has been converted and the opener rule applies. A
// gate still written with arrows is left alone, and starts being checked on the
// commit that converts it.
const ENGLISH_ONLY = ['let', 'copy', 'report'];

// A tile wider than this scrolls sideways on a phone, and a step a reader has to
// scroll is a step they skip. The widest line in either lab is 57.
const LINE_LIMIT = 64;

function checkBlockLines(gate, where) {
  const lines = [...gate.blocks, ...(gate.distractors || [])]
    .flatMap((b) => b.lines.map((l) => ({ id: b.id, text: String(l.text) })));
  const opener = (text) => text.trim().split(/\s+/)[0];
  const english = lines.some((l) => ENGLISH_ONLY.includes(opener(l.text)));

  for (const line of lines) {
    // A blank shows as an input roughly its declared width, not as its marker.
    const shown = line.text.replace(/⟨\?([^⟩]+)⟩/g, (_, name) => {
      const w = gate.blanks?.[name.trim()]?.width;
      return 'x'.repeat(Number.isFinite(w) ? w : 10);
    });
    if (shown.length > LINE_LIMIT) {
      bad(where, `block "${line.id}" is ${shown.length} characters wide, over the ${LINE_LIMIT} a tile shows without scrolling`);
    }
    if (english && !OPENERS.includes(opener(line.text))) {
      bad(where, `block "${line.id}" starts with "${opener(line.text)}"; in this notation a step opens with one of ${OPENERS.join(', ')}`);
    }
  }
}

function correctSubmission(gate) {
  const blanks = {};
  for (const [name, spec] of Object.entries(gate.blanks || {})) blanks[name] = spec.answer;
  return { placements: gate.solution.map((s) => ({ ...s })), blanks };
}

// A distractor with L lines stands in for its `near` block and the L−1 blocks
// after it in the solution, so a fused two-line decoy replaces a pair of loop
// headers.
function substituteDistractor(gate, distractor) {
  const at = gate.solution.findIndex((s) => s.id === distractor.near);
  if (at < 0) return null;
  const span = distractor.lines.length;
  const placements = gate.solution.map((s) => ({ ...s }));
  placements.splice(at, span, { id: distractor.id, indent: gate.solution[at].indent });
  return placements;
}

function checkDistractors(gate, reference, where) {
  for (const d of gate.distractors || []) {
    const placements = substituteDistractor(gate, d);
    if (!placements) continue;
    const submission = { ...correctSubmission(gate), placements };

    let verdict;
    try {
      verdict = verify(gate, submission, reference);
    } catch (err) {
      bad(where, `distractor "${d.id}" crashed the grader: ${err.message}`);
      continue;
    }

    if (verdict.ok) {
      bad(where, `distractor "${d.id}" passes. The probes cannot tell it from the answer; `
        + 'change the probe or drop the distractor');
      continue;
    }
    if (verdict.why !== d.why) {
      bad(where, `distractor "${d.id}" is caught but reports "${verdict.why}" instead of `
        + `"${d.why}", so the student sees the wrong message:\n      ${verdict.message}`);
    }
  }
}

function checkWrongBlanks(gate, reference, where) {
  for (const [name, alternatives] of Object.entries(gate.wrong_blanks || {})) {
    const answer = gate.blanks?.[name]?.answer;
    for (const alt of alternatives) {
      const submission = correctSubmission(gate);
      submission.blanks[name] = alt.text;

      let verdict;
      try {
        verdict = verify(gate, submission, reference);
      } catch (err) {
        bad(where, `wrong answer "${alt.text}" for "${name}" crashed the grader: ${err.message}`);
        continue;
      }
      if (verdict.ok) {
        bad(where, `"${alt.text}" is listed as a wrong answer for "${name}" but passes. `
          + `Either it is right, or the probes cannot separate it from ${answer}`);
        continue;
      }
      if (verdict.why !== alt.why) {
        bad(where, `wrong answer "${alt.text}" for "${name}" reports "${verdict.why}" `
          + `instead of "${alt.why}":\n      ${verdict.message}`);
      }
    }
  }
}

function checkBlankAnswers(gate, where) {
  for (const [name, spec] of Object.entries(gate.blanks || {})) {
    if (!spec.answer || !String(spec.answer).trim()) {
      bad(where, `blank "${name}" has no answer`);
      continue;
    }
    if (!spec.env?.length) {
      notes.push(`${where}: blank "${name}" declares no env, so wrong-answer matching cannot sample it`);
    }
    // Only a parse failure is the answer's fault. Whether it evaluates depends
    // on data this check does not have, and buildReference below settles that
    // by running the solution for real.
    try {
      evalExpression(String(spec.answer), {}, { maxSteps: 5000 });
    } catch (err) {
      if (err.name === 'ParseError') {
        bad(where, `blank "${name}" answer "${spec.answer}" does not read as an expression: ${err.message}`);
      }
    }
  }
}

function checkReveal(gate, where) {
  if (!gate.reveal?.length) {
    bad(where, 'no reveal mapping');
    return;
  }
  const numbered = gate.reveal.filter((l) => l.role === 'block');
  const ids = new Set(numbered.map((l) => l.blockId));
  for (const b of gate.blocks) {
    if (!ids.has(b.id)) bad(where, `block "${b.id}" has no Python line in the reveal`);
  }
  for (const line of gate.reveal) {
    if (!line.role) bad(where, `reveal line ${line.n} has no role`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const specPath = argv[0];
if (!specPath) {
  say('usage: validate.mjs <spec.json>');
  say('VALIDATION FAILED');
  if (isNode) process.exit(2); else quit();
}

const spec = JSON.parse(await readText(specPath));
const gates = spec.puzzles ?? [];

if (!gates.length) notes.push(`${spec.lab_id}: no puzzles`);

checkEditorial(spec);

let checked = 0;
for (const gate of gates) {
  const where = `${spec.lab_id}/${gate.cell_id}`;
  checkStructure(gate, where);
  checkBlankAnswers(gate, where);
  checkReveal(gate, where);

  let reference;
  try {
    reference = buildReference(gate);
  } catch (err) {
    bad(where, `the solution itself does not run: ${err.message}`);
    continue;
  }

  // The solution has to pass its own grader. Less circular than it sounds: the
  // reference and a submission take different paths through it.
  const self = verify(gate, correctSubmission(gate), reference);
  if (!self.ok) {
    bad(where, `the solution does not pass its own grader: ${self.message}`);
    continue;
  }

  checkDistractors(gate, reference, where);
  checkWrongBlanks(gate, reference, where);
  checked += 1;

  const decoys = (gate.distractors || []).length;
  const wrongs = Object.values(gate.wrong_blanks || {}).reduce((n, xs) => n + xs.length, 0);
  say(`  ${gate.cell_id}: ${gate.solution.length} blocks, ${decoys} decoys, `
    + `${wrongs} wrong answers, ${gate.probes.length} probe${gate.probes.length === 1 ? '' : 's'} — all separated`);
}

for (const note of notes) say(`  note: ${note}`);

if (problems.length) {
  say('');
  for (const p of problems) say(`  ${p}`);
  say('VALIDATION FAILED');
  if (isNode) process.exit(1); else quit();
}

say(`  validated ${checked} puzzle${checked === 1 ? '' : 's'}, editorial rules included`);
