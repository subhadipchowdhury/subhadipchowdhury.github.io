// Build-time validation of a lab spec.
//
//     node tools/validate.mjs teaching/labs/data/specs/newton.json
//     jsc -m tools/validate.mjs -- teaching/labs/data/specs/newton.json
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
  'pick', 'choose', 'answer', 'take', 'suppose',
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
    // A concept check is nothing but prose, so every part of it goes through the
    // same rules a brief does.
    for (const question of gate.questions || []) {
      out.push([`${gate.cell_id}/${question.id} stem`, question.stem_html]);
      for (const option of question.options || []) {
        out.push([`${gate.cell_id}/${question.id} option ${option.id}`, option.text_html]);
        out.push([`${gate.cell_id}/${question.id} why ${option.id}`, option.why_html]);
      }
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

    // A puzzle's brief has to be solvable-from on its own. A quiz's brief only
    // has to frame the questions, which carry the mathematics themselves.
    const floor = gate.kind === 'quiz' ? 150 : 300;
    if (brief.length < floor) {
      bad(at, `the brief is ${brief.length} characters, under the ${floor} this gate `
        + 'needs. State the mathematics it turns on, then what is being asked');
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
  if (gate.kind === 'quiz') {
    checkQuiz(gate, where);
    return;
  }
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

// A concept check has no program behind it, so nothing here can be settled by
// running anything. What can be checked is that the question is answerable and
// that every option a student can pick has something written for picking it.
//
// The block size is 2 to 4. One question is three guesses from a pass, which is
// the reason a block is graded as a unit in the first place, and past four the
// block stops being a check and becomes a quiz to sit.
const QUIZ_MIN = 2;
const QUIZ_MAX = 4;
const OPTIONS_MIN = 3;
const OPTIONS_MAX = 5;

function checkQuiz(gate, where) {
  const questions = gate.questions || [];
  if (questions.length < QUIZ_MIN || questions.length > QUIZ_MAX) {
    bad(where, `${questions.length} question(s); a block holds ${QUIZ_MIN} to ${QUIZ_MAX}`);
  }

  const seen = new Set();
  for (const question of questions) {
    const at = `${where}/${question.id}`;
    if (seen.has(question.id)) bad(where, `two questions share the id "${question.id}"`);
    seen.add(question.id);

    const stem = textOf(question.stem_html);
    if (stem.length < 40) {
      bad(at, `the stem is ${stem.length} characters. Say what is being asked in a sentence`);
    }
    // The point of a concept check is the concept, so a stem that quotes code is
    // usually a puzzle in the wrong clothes.
    if (/\bdef |\brange\(|np\./.test(stem)) {
      notes.push(`${at}: the stem mentions Python. A concept check asks about the `
        + 'mathematics; if it needs code, it wants to be a puzzle');
    }

    const options = question.options || [];
    if (options.length < OPTIONS_MIN || options.length > OPTIONS_MAX) {
      bad(at, `${options.length} option(s); a question offers ${OPTIONS_MIN} to ${OPTIONS_MAX}`);
    }

    const ids = new Set();
    const texts = new Map();
    for (const option of options) {
      if (!option.id) bad(at, 'an option with no id');
      if (ids.has(option.id)) bad(at, `two options share the id "${option.id}"`);
      ids.add(option.id);

      const text = textOf(option.text_html).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!text) bad(at, `option "${option.id}" has no text`);
      else if (texts.has(text)) {
        bad(at, `options "${texts.get(text)}" and "${option.id}" say the same thing`);
      } else texts.set(text, option.id);

      // Every option, not only the wrong ones. A student who picks the answer is
      // owed the reason it is the answer, and that text is what the solved block
      // shows in place of a reveal.
      const why = textOf(option.why_html);
      if (!why) {
        bad(at, `option "${option.id}" has no why. A wrong option says what the pick `
          + 'got wrong; the answer says why it is the answer');
      } else if (why.length < 40) {
        notes.push(`${at}: the why for "${option.id}" is ${why.length} characters, which `
          + 'is probably a verdict rather than a diagnosis');
      }
    }

    if (!ids.has(question.answer)) {
      bad(at, `the answer "${question.answer}" is not one of the options`);
    }
  }
}

// Two rules about a tile staying a tile. Neither is about grammar: the
// interpreter already rejects a line it cannot read.

// Every step opens with one of these, and they are the keywords a reader of
// pseudocode already knows. The English notation adds exactly one word to the
// list, `let`, and replaces no keyword: `if`, `then`, `else`, `for`, `while`,
// `return` and `print` are all still the words they are in code.
const OPENERS = ['function', 'let', 'for', 'if', 'else', 'while', 'return', 'print'];

// How wide a step may be, in characters, counting a blank as its declared width.
//
// The number is the tablet bound, worked out rather than picked. IBM Plex Mono
// advances 0.6em, `.lp-block` is 0.72rem below the 820px breakpoint, and the
// deepest indent in any lab is four levels at `--lp-indent: 1.4rem`. Subtract the
// 2rem page gutters, the workspace padding and the block's own padding and an
// 820px viewport shows 91 characters at that depth. So 88 is "no sideways scroll
// on anything down to a small tablet", with a little room.
//
// It was 64 for one day, on the stated grounds that a wider tile scrolls on a
// phone. That reason is wrong: the same arithmetic gives 29 characters at indent
// four on a 390px phone, so *every* step in both labs scrolls there whatever this
// number is, and no notation could avoid it. `.lp-block` carries
// `overflow-x: auto` for exactly that case, and its comment already called it a
// last resort on a narrow phone. 64 was also below the widest line the arrow
// notation shipped, and it cost real copy: `chebnodes` lost the articles from its
// header to fit under it, for nothing.
const LINE_LIMIT = 88;

// Operators a student cannot type. The interpreter still reads all of them, so
// nothing breaks if one appears; what breaks is the promise that a blank takes
// exactly what the block shows. π is not here on purpose: it is a value, like θ,
// and no blank in any lab needs it typed.
const GLYPHS = [
  ['·', '*'], ['−', '-'], ['≠', '!='], ['≤', '<='], ['≥', '>='], ['←', 'let … be …'],
];

function checkBlockLines(gate, where) {
  const lines = [...gate.blocks, ...(gate.distractors || [])]
    .flatMap((b) => b.lines.map((l) => ({ id: b.id, text: String(l.text) })));
  const opener = (text) => text.trim().split(/\s+/)[0];

  // Also over the blank answers and the wrong answers, since those are compared
  // against what a student types.
  const typed = [
    ...Object.entries(gate.blanks || {}).map(([n, s]) => ({ id: `blank ${n}`, text: String(s.answer) })),
    ...Object.entries(gate.wrong_blanks || {}).flatMap(([n, xs]) => xs.map((a) => ({ id: `wrong answer for ${n}`, text: String(a.text) }))),
  ];
  for (const line of [...lines, ...typed]) {
    for (const [glyph, ascii] of GLYPHS) {
      if (line.text.includes(glyph)) {
        bad(where, `${line.id} uses "${glyph}", which is not on a keyboard; write "${ascii}"`);
      }
    }
  }

  for (const line of lines) {
    // A blank shows as an input roughly its declared width, not as its marker.
    const shown = line.text.replace(/⟨\?([^⟩]+)⟩/g, (_, name) => {
      const w = gate.blanks?.[name.trim()]?.width;
      return 'x'.repeat(Number.isFinite(w) ? w : 10);
    });
    if (shown.length > LINE_LIMIT) {
      bad(where, `block "${line.id}" is ${shown.length} characters wide, over the ${LINE_LIMIT} a tile shows without scrolling`);
    }
    if (!OPENERS.includes(opener(line.text))) {
      bad(where, `block "${line.id}" starts with "${opener(line.text)}"; a step opens with one of ${OPENERS.join(', ')}`);
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

if (!gates.length) notes.push(`${spec.lab_id}: no gates`);

checkEditorial(spec);

let checked = 0;
for (const gate of gates) {
  const where = `${spec.lab_id}/${gate.cell_id}`;
  checkStructure(gate, where);

  // A concept check has no program, so every check below it is about something
  // it does not have. Its own rules ran inside checkStructure.
  if (gate.kind === 'quiz') {
    const questions = gate.questions || [];
    const options = questions.reduce((n, q) => n + (q.options || []).length, 0);
    checked += 1;
    say(`  ${gate.cell_id}: ${questions.length} questions, ${options} options, `
      + `${options - questions.length} written diagnoses — every option accounted for`);
    continue;
  }

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

say(`  validated ${checked} gate${checked === 1 ? '' : 's'}, editorial rules included`);
