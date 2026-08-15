// Interpreter for the house pseudocode notation.
//
// A small tree-walking interpreter with no dependencies. The notation is a
// closed language, described in the lab design document, section 1.
//
// Input is a list of placed lines rather than a blob of text, since that is
// what the puzzle produces: each line knows its block and its indent level.
// Errors carry the block id back so the page can point at it.
//
// Two departures from IEEE arithmetic, both for teaching reasons:
//   - division by zero raises, which the Lagrange guard puzzle turns on
//   - negative and out-of-range subscripts raise, since Python's silent
//     negative indexing would hide the h[-1] bug the splines puzzle is about
//
// Exports: parseProgram, run, evalExpression, and value helpers for the verifier.

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LabError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'LabError';
    Object.assign(this, detail); // blockId, blank, kind, line
  }
}

// Raised while reading or arranging source. Recoverable at authoring time.
export class ParseError extends LabError {
  constructor(message, detail) {
    super(message, detail);
    this.name = 'ParseError';
  }
}

// Raised while executing. kind is one of:
//   'index' | 'divzero' | 'type' | 'name' | 'shape' | 'cap' | 'arity' | 'return'
export class RuntimeError extends LabError {
  constructor(message, detail) {
    super(message, detail);
    this.name = 'RuntimeError';
  }
}

// ---------------------------------------------------------------------------
// Notation constants
// ---------------------------------------------------------------------------

// The operators are the ones on a keyboard. A student reads exactly what they
// would type, which is Dip's call on 2026-08-14 and the end of a problem the
// notation had from the start: it used to print `·`, `−`, `≠` and `≤` and accept
// `*`, `-`, `!=` and `<=`, so every glyph was one thing to read and another to
// type. `notation.js` says in words what `!=` and `<=` mean, since that is the
// one thing the ASCII spelling does not say for itself.
//
// Names are still allowed to be mathematical: `π` and `θ` are values, not
// operators, and `θ` is what the Chebyshev construction calls that angle.
export const GETS = '←'; // ←, the older notation's assignment; nothing displays it
export const MINUS = '-';
export const TIMES = '*';
export const LE = '<=';
export const GE = '>=';
export const NE = '!=';
export const PI = 'π'; // π
export const BLANK_OPEN = '⟨'; // ⟨
export const BLANK_CLOSE = '⟩'; // ⟩

// Everything folds towards the keyboard.
//
// The glyphs are still read, because material written before the change used them
// and because a student who pastes `≠` in from somewhere should not be punished for
// it. There are five spellings of `!=` for the same reason: a student reaches for
// whichever one they have seen, `!=` from C and Python, `/=` from Ada and Haskell,
// `<>` from Pascal, BASIC, SQL and Excel, `~=` from MATLAB. Guessing the house
// spelling is not what any of these puzzles is testing.
//
// Order matters twice. `<->` and `<-` fold before `<=` so the arrow survives, and
// `=/=` folds before `/=` or the tail goes first and leaves `=!=`.
const FOLD = [
  [/<->/g, GETS],
  [/<-/g, GETS],
  [/≤/g, LE],
  [/≥/g, GE],
  [/=\/=/g, NE],
  [/\/=/g, NE],
  [/<>/g, NE],
  [/~=/g, NE],
  [/≠/g, NE],
  [/·/g, TIMES],
  [/−/g, MINUS],
  [/\bpi\b/g, PI],
];

/** Normalise a line to the keyboard spellings the tokenizer works in. */
export function foldAscii(text) {
  let out = text;
  for (const [re, to] of FOLD) out = out.replace(re, to);
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  'function', 'return', 'for', 'to', 'down', 'while', 'if', 'else',
  'and', 'or', 'not', 'print',
]);

// Longest first inside each family, since the tokenizer takes the first match:
// '..' before '.', and '<=' '>=' '!=' before '<' '>' '='.
const PUNCT = [
  '..', // range, must precede '.'
  GETS, LE, GE, NE,
  '(', ')', '[', ']', ',', ':', '+', '-', '*', '/', '^', '=', '<', '>',
];

function isDigit(c) { return c >= '0' && c <= '9'; }
function isIdentStart(c) { return /[A-Za-z_α-ωΘ]/.test(c); }
function isIdentPart(c) { return /[A-Za-z0-9_α-ωΘ]/.test(c); }

// Tokenizes one line. `where` is attached to every token for error reporting.
function tokenizeLine(text, where) {
  const src = foldAscii(text);
  const toks = [];
  let i = 0;
  const push = (type, value, col) => toks.push({ type, value, col, where });

  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '#') break; // comment to end of line

    // ⟨?name⟩ blank placeholder
    if (c === BLANK_OPEN) {
      const close = src.indexOf(BLANK_CLOSE, i);
      if (close < 0) throw new ParseError('A blank marker is not closed.', { ...where, col: i });
      const inner = src.slice(i + 1, close);
      if (inner[0] !== '?') throw new ParseError('A blank marker must look like ⟨?name⟩.', { ...where, col: i });
      push('blank', inner.slice(1).trim(), i);
      i = close + 1;
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i;
      while (j < src.length && isDigit(src[j])) j++;
      if (src[j] === '.' && src[j + 1] !== '.') { // not the range operator
        j++;
        while (j < src.length && isDigit(src[j])) j++;
      }
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1;
        if (src[k] === '+' || src[k] === '-') k++;
        if (isDigit(src[k])) { k++; while (k < src.length && isDigit(src[k])) k++; j = k; }
      }
      push('number', Number(src.slice(i, j)), i);
      i = j;
      continue;
    }

    if (c === PI) { push('name', PI, i); i++; continue; }

    if (isIdentStart(c)) {
      let j = i;
      while (j < src.length && isIdentPart(src[j])) j++;
      const word = src.slice(i, j);
      push(KEYWORDS.has(word) ? word : 'name', word, i);
      i = j;
      continue;
    }

    const p = PUNCT.find((op) => src.startsWith(op, i));
    if (p) {
      push(p, p, i);
      i += p.length;
      continue;
    }

    throw new ParseError(`This character is not part of the notation: ${c}`, { ...where, col: i });
  }

  push('eol', null, src.length);
  return toks;
}

// ---------------------------------------------------------------------------
// Expression parser (Pratt)
// ---------------------------------------------------------------------------

// Binding powers. Higher binds tighter. `^` is right-associative and binds
// tighter than unary minus, so -x^2 is -(x^2), as on the board.
const BP = {
  'or': 1,
  'and': 2,
  '=': 3, [NE]: 3, '<': 3, '>': 3, [LE]: 3, [GE]: 3,
  '+': 4, [MINUS]: 4,
  [TIMES]: 5, '/': 5,
  '^': 7,
};

class ExprParser {
  // blanks: name -> { source } supplied by the student. A blank parses its own
  // source as a sub-expression, so precedence composes correctly and a syntax
  // error inside a blank is reported against that blank.
  constructor(toks, blanks, depth = 0) {
    this.toks = toks;
    this.pos = 0;
    this.blanks = blanks || {};
    this.depth = depth;
  }

  peek(k = 0) { return this.toks[Math.min(this.pos + k, this.toks.length - 1)]; }
  next() { return this.toks[this.pos++]; }
  at(type) { return this.peek().type === type; }

  expect(type, what) {
    if (!this.at(type)) {
      const got = this.peek();
      throw new ParseError(
        `Expected ${what || `"${type}"`} but found ${describeToken(got)}.`,
        { ...got.where, col: got.col },
      );
    }
    return this.next();
  }

  parseExpression(minBp = 0) {
    let left = this.parseUnary();
    for (;;) {
      const t = this.peek();
      const bp = BP[t.type];
      if (bp === undefined || bp < minBp) break;
      this.next();
      // ^ is right-associative: recurse at the same power, not one above.
      const right = this.parseExpression(t.type === '^' ? bp : bp + 1);
      left = { node: 'binary', op: t.type, left, right, where: t.where, col: t.col };
    }
    return left;
  }

  parseUnary() {
    const t = this.peek();
    if (t.type === MINUS) {
      this.next();
      // Unary minus binds looser than ^ (see BP) so -x^2 parses as -(x^2).
      return { node: 'unary', op: MINUS, operand: this.parseExpression(6), where: t.where, col: t.col };
    }
    if (t.type === 'not') {
      this.next();
      return { node: 'unary', op: 'not', operand: this.parseExpression(2), where: t.where, col: t.col };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let e = this.parsePrimary();
    for (;;) {
      if (this.at('(')) {
        const open = this.next();
        const args = [];
        if (!this.at(')')) {
          do { args.push(this.parseExpression()); } while (this.eat(','));
        }
        this.expect(')', 'a closing parenthesis');
        if (e.node !== 'name') {
          throw new ParseError('Only a named function can be called.', { ...open.where, col: open.col });
        }
        e = { node: 'call', name: e.name, args, where: e.where, col: e.col };
      } else if (this.at('[')) {
        const open = this.next();
        const subs = [];
        do { subs.push(this.parseSubscript()); } while (this.eat(','));
        this.expect(']', 'a closing bracket');
        // T[i][j] is T[i, j]. Merging here rather than nesting means the
        // evaluator, the error messages and the write log see one shape whichever
        // way the author wrote it.
        e = e.node === 'index'
          ? { ...e, subs: e.subs.concat(subs) }
          : { node: 'index', target: e, subs, where: e.where, col: e.col };
        if (e.subs.length > 2) {
          throw new ParseError('The notation has 1-D arrays and 2-D tables, so at most two subscripts.', { ...open.where, col: open.col });
        }
      } else {
        return e;
      }
    }
  }

  // A subscript is either a single expression or an inclusive range a..b.
  parseSubscript() {
    const lo = this.parseExpression();
    if (this.eat('..')) {
      const hi = this.parseExpression();
      return { kind: 'range', lo, hi };
    }
    return { kind: 'point', at: lo };
  }

  eat(type) {
    if (this.at(type)) { this.next(); return true; }
    return false;
  }

  // The English notation's words are matched by value on a `name` token rather
  // than reserved in the tokenizer, because `a`, `b`, `n`, `t`, `u` and `in` are
  // all variables in one lab or another and reserving them would break the
  // symbolic notation. The cost is that a handful of words cannot be variable
  // names in a position where the grammar is looking for them; see WORDS.
  atWord(w) {
    const t = this.peek();
    return t.type === 'name' && t.value === w;
  }

  atAnyWord(...ws) { return ws.some((w) => this.atWord(w)); }

  eatWord(w) {
    if (this.atWord(w)) { this.next(); return true; }
    return false;
  }

  expectWord(w, what) {
    if (!this.atWord(w)) {
      const got = this.peek();
      throw new ParseError(
        `Expected ${what || `"${w}"`} but found ${describeToken(got)}.`,
        { ...got.where, col: got.col },
      );
    }
    return this.next();
  }

  parsePrimary() {
    const t = this.peek();
    if (t.type === 'number') { this.next(); return { node: 'number', value: t.value, where: t.where, col: t.col }; }
    if (t.type === 'name') { this.next(); return { node: 'name', name: t.value, where: t.where, col: t.col }; }
    if (t.type === '(') {
      this.next();
      const e = this.parseExpression();
      this.expect(')', 'a closing parenthesis');
      return e;
    }
    if (t.type === '[') {
      this.next();
      const items = [];
      if (!this.at(']')) {
        do { items.push(this.parseExpression()); } while (this.eat(','));
      }
      this.expect(']', 'a closing bracket');
      return { node: 'array', items, where: t.where, col: t.col };
    }
    if (t.type === 'blank') {
      this.next();
      return this.parseBlank(t);
    }
    throw new ParseError(`Expected a value here but found ${describeToken(t)}.`, { ...t.where, col: t.col });
  }

  parseBlank(t) {
    const name = t.value;
    if (this.depth > 4) {
      throw new ParseError('Blanks are nested too deeply.', { ...t.where, col: t.col });
    }
    const filled = this.blanks[name];
    if (filled === undefined || filled === null || String(filled).trim() === '') {
      return { node: 'blankHole', blank: name, where: t.where, col: t.col };
    }
    const where = { ...t.where, blank: name };
    let toks;
    try {
      toks = tokenizeLine(String(filled), where);
    } catch (err) {
      throw new ParseError(blankMessage(name, err.message), { ...where, col: t.col, blank: name });
    }
    const sub = new ExprParser(toks, this.blanks, this.depth + 1);
    let expr;
    try {
      expr = sub.parseExpression();
      sub.expect('eol', 'the end of the blank');
    } catch (err) {
      throw new ParseError(blankMessage(name, err.message), { ...where, col: t.col, blank: name });
    }
    // Wrapped so the blank's extent is known for error reporting; evaluation
    // just passes through to the inner expression.
    return { node: 'blank', blank: name, expr, where, col: t.col };
  }
}

function blankMessage(name, detail) {
  const cleaned = detail.replace(/\.$/, '');
  return `The blank cannot be read as an expression: ${cleaned}.`;
}

function describeToken(t) {
  if (t.type === 'eol') return 'the end of the line';
  if (t.type === 'number') return `the number ${t.value}`;
  if (t.type === 'name') return `"${t.value}"`;
  if (t.type === 'blank') return 'a blank';
  return `"${t.value}"`;
}

// ---------------------------------------------------------------------------
// Statement parser
// ---------------------------------------------------------------------------

// A placed line: { text, indent, blockId, blockLine }
// Lines are grouped into blocks by indent, Python style, but the indent is a
// level the student chose in the UI rather than a count of spaces.

export function linesFromSource(source, blockId = null) {
  // Authoring convenience: derive indent from leading 4-space groups.
  const out = [];
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  raw.forEach((line, k) => {
    if (line.trim() === '' || line.trim().startsWith('#')) return;
    const lead = line.match(/^ */)[0].length;
    if (lead % 4 !== 0) {
      throw new ParseError(`Indentation must be a multiple of four spaces (line ${k + 1}).`, { line: k + 1 });
    }
    out.push({ text: line.trim(), indent: lead / 4, blockId, blockLine: k });
  });
  return out;
}

function parseHeaderless(line, blanks) {
  const toks = tokenizeLine(line.text, { blockId: line.blockId, line: line.index });
  return { toks, parser: new ExprParser(toks, blanks) };
}

// Builds the statement tree from the flat, indented line list.
function parseBlock(lines, start, indent, blanks, out) {
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) {
      throw new ParseError(
        'This line is indented further than the line above it opens for.',
        { blockId: line.blockId, line: line.index },
      );
    }
    const { stmt, next } = parseStatement(lines, i, blanks);
    out.push(stmt);
    i = next;
  }
  return i;
}

function requireBody(lines, i, indent, blanks, opener) {
  if (i >= lines.length || lines[i].indent <= indent) {
    throw new ParseError(
      `"${opener}" opens a block, so at least one line must sit one level further in.`,
      { blockId: lines[i - 1].blockId, line: lines[i - 1].index },
    );
  }
  if (lines[i].indent > indent + 1) {
    throw new ParseError(
      'This line is indented two or more levels past the line that opens its block.',
      { blockId: lines[i].blockId, line: lines[i].index },
    );
  }
  const body = [];
  const next = parseBlock(lines, i, indent + 1, blanks, body);
  return { body, next };
}

function parseStatement(lines, i, blanks) {
  const line = lines[i];
  const { toks, parser } = parseHeaderless(line, blanks);
  const head = toks[0];
  const where = { blockId: line.blockId, line: line.index };

  const endOfHeader = (kw) => {
    parser.expect(':', `a colon after "${kw}"`);
    parser.expect('eol', 'the end of the line');
  };

  if (head.type === 'function') {
    parser.next();
    const name = parser.expect('name', 'a function name').value;
    // Two spellings of the same header. "function f(x, y):" is the symbolic one;
    // "function f, given nodes x and values y:" is the English one, where each
    // group of words before a separator ends in the parameter it describes.
    const params = [];
    if (parser.eat(',')) {
      parser.expectWord('given', 'the word "given" after the function name');
      for (;;) {
        const words = [];
        while (parser.at('name')) words.push(parser.next().value);
        if (words.length) params.push(words[words.length - 1]);
        if (parser.eat(',') || parser.eat('and')) continue;
        break;
      }
      if (!params.length) {
        throw new ParseError('"given" has to name at least one thing the function is handed.', where);
      }
    } else {
      parser.expect('(', 'an opening parenthesis, or a comma and "given"');
      if (!parser.at(')')) {
        do { params.push(parser.expect('name', 'a parameter name').value); } while (parser.eat(','));
      }
      parser.expect(')', 'a closing parenthesis');
    }
    endOfHeader('function');
    const { body, next } = requireBody(lines, i + 1, line.indent, blanks, 'function');
    return { stmt: { node: 'funcdef', name, params, body, where }, next };
  }

  if (head.type === 'for') {
    parser.next();
    // "for j ← 1 to n−1:" against "for each order j from 1 to n−1:". The arrow
    // decides, and it can only be the second token in the symbolic form.
    const symbolic = parser.peek(1).type === GETS;
    let varName;
    if (symbolic) {
      varName = parser.expect('name', 'a loop variable').value;
      parser.expect(GETS, 'an arrow after the loop variable');
    } else {
      // Everything between "for" and "from" is the reader's, except the last
      // word, which is the loop variable.
      let tok = parser.expect('name', 'a loop variable');
      while (parser.at('name') && parser.peek().value !== 'from') tok = parser.next();
      varName = tok.value;
      parser.expectWord('from', 'the word "from" before the first value');
    }
    const from = parser.parseExpression();
    let descending = false;
    if (parser.eat('down')) { descending = true; }
    parser.expect('to', descending ? 'the word "to" after "down"' : 'the word "to"');
    const to = parser.parseExpression();
    // "in steps of 2" for a loop that skips. Written out rather than spelled as
    // a modulo test in the body, because the step is a property of the loop.
    let step = null;
    if (parser.eatWord('in')) {
      parser.expectWord('steps', 'the word "steps" after "in"');
      parser.expectWord('of', 'the word "of" after "steps"');
      step = parser.parseExpression();
    }
    endOfHeader('for');
    const { body, next } = requireBody(lines, i + 1, line.indent, blanks, 'for');
    return { stmt: { node: 'for', varName, from, to, step, descending, body, where }, next };
  }

  if (head.type === 'while') {
    parser.next();
    const cond = parser.parseExpression();
    endOfHeader('while');
    const { body, next } = requireBody(lines, i + 1, line.indent, blanks, 'while');
    return { stmt: { node: 'while', cond, body, where }, next };
  }

  if (head.type === 'if') {
    parser.next();
    const cond = parser.parseExpression();
    parser.eatWord('then');
    endOfHeader('if');
    const { body, next } = requireBody(lines, i + 1, line.indent, blanks, 'if');
    const { chain, after } = parseElseChain(lines, next, line.indent, blanks);
    return { stmt: { node: 'if', cond, body, orelse: chain, where }, next: after };
  }

  if (head.type === 'else') {
    throw new ParseError('This "else" has no "if" above it at the same level.', where);
  }

  // "return c, T" and "return c and T" are the same statement. The values parse
  // above the binding power of the boolean "and", so the word separates them
  // rather than joining them into a conjunction; nothing in this notation
  // returns a true/false value, so no reading is lost.
  if (head.type === 'return') {
    parser.next();
    const values = [];
    if (!parser.at('eol')) {
      do { values.push(parser.parseExpression(BP.and + 1)); } while (parser.eat(',') || parser.eat('and'));
    }
    parser.expect('eol', 'the end of the line');
    return { stmt: { node: 'return', values, where }, next: i + 1 };
  }

  if (head.type === 'print') {
    parser.next();
    const values = [];
    if (!parser.at('eol')) {
      do { values.push(parser.parseExpression()); } while (parser.eat(','));
    }
    parser.expect('eol', 'the end of the line');
    return { stmt: { node: 'print', values, where }, next: i + 1 };
  }

  // One keyword for every kind of assignment:
  //   let n be the number of entries in x
  //   let T[i][j] be (…) / (…)
  //   let column 0 of T be y
  //   let row k of U be row p of U        (which is how a swap is written)
  if (head.type === 'name' && head.value === 'let') {
    parser.next();
    const target = looksLikeAxisTarget(parser)
      ? parseAxisTarget(parser, where)
      : parseTarget(parser);
    parser.expectWord('be', 'the word "be" after what is being set');
    const value = parseWordedValue(parser, where);
    parser.expect('eol', 'the end of the line');
    return { stmt: { node: 'assign', targets: [target], value, where }, next: i + 1 };
  }

  // Assignment. Targets are names or indexed names; the arrow separates.
  const targets = [];
  do { targets.push(parseTarget(parser)); } while (parser.eat(','));
  parser.expect(GETS, 'an arrow (←). In this notation "=" compares and "←" assigns');
  const value = parser.parseExpression();
  parser.expect('eol', 'the end of the line');
  return { stmt: { node: 'assign', targets, value, where }, next: i + 1 };
}

// The words the English notation looks for. They are matched by value, not
// reserved, so any of them can still be a variable somewhere the grammar is not
// looking for it. Do not name a variable after one of these anyway.
export const WORDS = [
  'let', 'be', 'given', 'each', 'from', 'then', 'steps',
  'row', 'column', 'of', 'a', 'an', 'the', 'list', 'table', 'by',
  'number', 'entries', 'in', 'zeros',
];

/**
 * The right-hand side of a `let`. Four worded forms, then any expression.
 *
 *   the number of entries in x        length(x)
 *   a list of n+1 zeros              zeros(n+1)
 *   a table of n by n zeros          zeros(n, n)
 *   row 0 of T  /  column 0 of T     the whole row or column
 */
function parseWordedValue(parser, where) {
  if (parser.atWord('the') && parser.peek(1).type === 'name' && parser.peek(1).value === 'number') {
    parser.next();
    parser.next();
    parser.expectWord('of', 'the word "of" after "the number"');
    parser.expectWord('entries', 'the word "entries" after "the number of"');
    parser.expectWord('in', 'the word "in" after "entries"');
    const arg = parser.parseExpression();
    return { node: 'call', name: 'length', args: [arg], where, col: 0 };
  }

  if (parser.atAnyWord('a', 'an') && parser.peek(1).type === 'name'
      && (parser.peek(1).value === 'list' || parser.peek(1).value === 'table')) {
    parser.next();
    const kind = parser.next().value;
    parser.expectWord('of', `the word "of" after "${kind}"`);
    const args = [parser.parseExpression()];
    if (kind === 'table') {
      parser.expectWord('by', 'the word "by" between the two sizes of a table');
      args.push(parser.parseExpression());
    }
    parser.expectWord('zeros', 'the word "zeros" at the end');
    return { node: 'call', name: 'zeros', args, where, col: 0 };
  }

  if (parser.atAnyWord('row', 'column')) return parseAxisSlice(parser, where);

  return parser.parseExpression();
}

// Whether the target of a `let` is "row 3 of T" rather than a variable that
// happens to be called row. It opens with row or column, and an "of" reaches the
// "be" ahead of it. Deciding this by lookahead rather than by reserving the two
// words keeps `let row be a + b` legal, which a test pins.
function looksLikeAxisTarget(parser) {
  if (!parser.atAnyWord('row', 'column')) return false;
  for (let k = 1; ; k++) {
    const t = parser.peek(k);
    if (t.type === 'eol') return false;
    if (t.type === 'name' && t.value === 'be') return false;
    if (t.type === 'name' && t.value === 'of') return true;
  }
}

// "row 0 of T" or "column 0 of T", as a value.
function parseAxisSlice(parser, where) {
  const axis = parser.next().value;
  const at = parser.parseExpression();
  parser.expectWord('of', `the word "of" after the ${axis} number`);
  const t = parser.expect('name', 'the name of a table');
  return { node: 'axisSlice', axis, at, name: t.value, where, col: t.col };
}

// The same thing as somewhere to store into.
function parseAxisTarget(parser, where) {
  const slice = parseAxisSlice(parser, where);
  return { kind: 'axisSlice', axis: slice.axis, at: slice.at, name: slice.name, where: slice.where, col: slice.col };
}

function parseElseChain(lines, i, indent, blanks) {
  if (i >= lines.length || lines[i].indent !== indent) return { chain: null, after: i };
  const line = lines[i];
  const { toks, parser } = parseHeaderless(line, blanks);
  if (toks[0].type !== 'else') return { chain: null, after: i };
  parser.next();
  const where = { blockId: line.blockId, line: line.index };

  if (parser.at('if')) {
    parser.next();
    const cond = parser.parseExpression();
    parser.eatWord('then');
    parser.expect(':', 'a colon after "else if"');
    parser.expect('eol', 'the end of the line');
    const { body, next } = requireBody(lines, i + 1, indent, blanks, 'else if');
    const rest = parseElseChain(lines, next, indent, blanks);
    return { chain: [{ node: 'if', cond, body, orelse: rest.chain, where }], after: rest.after };
  }

  parser.expect(':', 'a colon after "else"');
  parser.expect('eol', 'the end of the line');
  const { body, next } = requireBody(lines, i + 1, indent, blanks, 'else');
  return { chain: body, after: next };
}

function parseTarget(parser) {
  const t = parser.peek();
  const name = parser.expect('name', 'something to assign to').value;
  if (!parser.at('[')) return { kind: 'name', name, where: t.where, col: t.col };
  // T[i][j] and T[i, j] are the same target; see the merge in parsePostfix.
  const subs = [];
  while (parser.at('[')) {
    const open = parser.next();
    do { subs.push(parser.parseSubscript()); } while (parser.eat(','));
    parser.expect(']', 'a closing bracket');
    if (subs.length > 2) {
      throw new ParseError('The notation has 1-D arrays and 2-D tables, so at most two subscripts.', { ...open.where, col: open.col });
    }
  }
  return { kind: 'index', name, subs, where: t.where, col: t.col };
}

/**
 * Parse a placed assembly into a program.
 *
 * @param {Array<{text:string,indent:number,blockId?:string}>} lines
 * @param {Object<string,string>} blanks  blank name -> student's text
 * @returns {{body:Array, funcs:Object}}
 */
export function parseProgram(lines, blanks = {}) {
  const indexed = lines.map((l, k) => ({ ...l, index: k }));
  if (indexed.length && indexed[0].indent !== 0) {
    throw new ParseError('The first line cannot be indented.', {
      blockId: indexed[0].blockId, line: 0,
    });
  }
  const body = [];
  const end = parseBlock(indexed, 0, 0, blanks, body);
  if (end !== indexed.length) {
    const line = indexed[end];
    throw new ParseError('This line is indented further than anything above it opens for.', {
      blockId: line.blockId, line: end,
    });
  }
  return { body };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------
// Scalars are JS numbers. A 1-D array is a JS array of numbers. A 2-D table is
// a JS array of arrays. Booleans exist only inside conditions and never reach a
// variable.

export function isArr1(v) { return Array.isArray(v) && (v.length === 0 || typeof v[0] === 'number'); }
export function isArr2(v) { return Array.isArray(v) && v.length > 0 && Array.isArray(v[0]); }
export function isNum(v) { return typeof v === 'number'; }

export function deepCopy(v) {
  if (Array.isArray(v)) return v.map(deepCopy);
  return v;
}

export function shapeOf(v) {
  if (v === undefined) return 'nothing (that call returns no value)';
  if (isNum(v)) return 'a number';
  if (isArr2(v)) return `a ${v.length}×${v[0].length} table`;
  if (Array.isArray(v)) return `an array of ${v.length}`;
  if (typeof v === 'boolean') return 'a true/false value';
  return 'an unknown value';
}

export function fmtNum(x) {
  if (!Number.isFinite(x)) return String(x);
  if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
  const r = Number(x.toPrecision(6));
  return String(r);
}

// ---------------------------------------------------------------------------
// Built-ins
// ---------------------------------------------------------------------------

function needNum(v, name, where) {
  if (!isNum(v)) throw new RuntimeError(`${name} needs a number but got ${shapeOf(v)}.`, { kind: 'type', ...where });
  return v;
}

function needArr(v, name, where) {
  if (!Array.isArray(v)) throw new RuntimeError(`${name} needs an array but got ${shapeOf(v)}.`, { kind: 'type', ...where });
  return v;
}

function needInt(v, what, where) {
  needNum(v, what, where);
  if (!Number.isInteger(v)) {
    throw new RuntimeError(`${what} must be a whole number; this one is ${fmtNum(v)}.`, { kind: 'type', ...where });
  }
  return v;
}

const BUILTINS = {
  length: (a, w) => { arity(a, 1, 'length', w); return needArr(a[0], 'length', w).length; },
  abs: (a, w) => { arity(a, 1, 'abs', w); return Math.abs(needNum(a[0], 'abs', w)); },
  sqrt: (a, w) => {
    arity(a, 1, 'sqrt', w);
    const x = needNum(a[0], 'sqrt', w);
    if (x < 0) throw new RuntimeError(`sqrt of the negative number ${fmtNum(x)}.`, { kind: 'domain', ...w });
    return Math.sqrt(x);
  },
  cos: (a, w) => { arity(a, 1, 'cos', w); return Math.cos(needNum(a[0], 'cos', w)); },
  sin: (a, w) => { arity(a, 1, 'sin', w); return Math.sin(needNum(a[0], 'sin', w)); },
  exp: (a, w) => { arity(a, 1, 'exp', w); return Math.exp(needNum(a[0], 'exp', w)); },
  max: (a, w) => reduceNums(a, 'max', Math.max, -Infinity, w),
  min: (a, w) => reduceNums(a, 'min', Math.min, Infinity, w),
  sum: (a, w) => {
    if (a.length === 1 && Array.isArray(a[0])) return flat(a[0]).reduce((s, x) => s + x, 0);
    return a.reduce((s, x) => s + needNum(x, 'sum', w), 0);
  },
  zeros: (a, w) => {
    if (a.length === 1) {
      const n = needInt(a[0], 'The length given to zeros', w);
      if (n < 0) throw new RuntimeError(`zeros needs a length of zero or more; got ${n}.`, { kind: 'shape', ...w });
      return new Array(n).fill(0);
    }
    if (a.length === 2) {
      const m = needInt(a[0], 'The row count given to zeros', w);
      const n = needInt(a[1], 'The column count given to zeros', w);
      if (m < 0 || n < 0) throw new RuntimeError('zeros needs sizes of zero or more.', { kind: 'shape', ...w });
      return Array.from({ length: m }, () => new Array(n).fill(0));
    }
    throw new RuntimeError('zeros takes one size for an array or two for a table.', { kind: 'arity', ...w });
  },
  solve: (a, w) => { arity(a, 2, 'solve', w); return gaussianSolve(a[0], a[1], w); },
};

function arity(args, n, name, where) {
  if (args.length !== n) {
    throw new RuntimeError(`${name} takes ${n} argument${n === 1 ? '' : 's'}, not ${args.length}.`, { kind: 'arity', ...where });
  }
}

function flat(v) {
  return isArr2(v) ? v.flat() : v;
}

function reduceNums(args, name, f, seed, where) {
  const xs = args.length === 1 && Array.isArray(args[0]) ? flat(args[0]) : args;
  if (xs.length === 0) throw new RuntimeError(`${name} of nothing is undefined.`, { kind: 'domain', ...where });
  return xs.reduce((acc, x) => f(acc, needNum(x, name, where)), seed);
}

// Gaussian elimination with partial pivoting. The labs treat solve as a
// primitive; how to compute it is a later module's problem.
function gaussianSolve(A, b, where) {
  if (!isArr2(A)) throw new RuntimeError(`solve needs a table as its first argument but got ${shapeOf(A)}.`, { kind: 'type', ...where });
  if (!Array.isArray(b) || isArr2(b)) throw new RuntimeError(`solve needs an array as its second argument but got ${shapeOf(b)}.`, { kind: 'type', ...where });
  const n = A.length;
  if (A[0].length !== n) throw new RuntimeError(`solve needs a square table; this one is ${n}×${A[0].length}.`, { kind: 'shape', ...where });
  if (b.length !== n) throw new RuntimeError(`solve got a ${n}×${n} table and a right-hand side of ${b.length}.`, { kind: 'shape', ...where });

  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-14) {
      throw new RuntimeError('solve was given a system with no unique solution (the matrix is singular).', { kind: 'domain', ...where });
    }
    if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

const RETURN = Symbol('return');

class Scope {
  constructor(parent = null) {
    this.vars = new Map();
    this.parent = parent;
  }
  has(name) { return this.vars.has(name) || (this.parent ? this.parent.has(name) : false); }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  set(name, value) { this.vars.set(name, value); }
}

class Interp {
  constructor(opts) {
    this.maxSteps = opts.maxSteps ?? 1e6;
    this.steps = 0;
    this.funcs = new Map();
    this.prints = [];
    this.snapshots = null;
    this.traceNames = opts.trace || [];
    this.callDepth = 0;

    // The enclosing for loops, outermost first, live rather than snapshotted:
    // a frame is pushed on entry and popped after the loop finishes normally, so
    // when an error propagates the stack still holds the pass it happened on.
    this.loops = [];

    // Off unless a caller asks for it, since it allocates per write. The grader
    // runs a probe without logging and only re-runs the one that failed.
    this.logging = !!opts.log;
    this.logCap = opts.logCap ?? 20000;
    this.writes = [];      // { blockId, line, name, cell, value, loops }
    this.created = new Set();  // arrays and tables this run built, by name
    this.filled = new Set();   // "name|i,j" written at least once
    this.readKeys = new Set(); // "name|i,j" read at least once, in read order
    this.unfilled = [];    // reads of an entry this run has not written yet
  }

  loopState() {
    return this.loops.map((f) => ({ name: f.name, value: f.value }));
  }

  // One write to one entry. Called after the store, so `value` is what landed.
  noteWrite(name, cell, value, where) {
    if (!this.logging) return;
    const key = `${name}|${cell.join(',')}`;
    this.filled.add(key);
    if (this.writes.length >= this.logCap) return;
    this.writes.push({
      name, cell, key, value, loops: this.loopState(),
      blockId: where?.blockId ?? null, line: where?.line ?? null,
    });
  }

  // Every subscripted read, in order, deduplicated. Two things are asked of it:
  // which entries of the inputs an algorithm never looks at, and whether it read
  // an entry of something it built and had not filled in yet. The second is only
  // ever reported alongside a wrong answer, so a legitimate read of an untouched
  // zero costs nothing.
  noteRead(name, cell) {
    if (!this.logging || !name) return;
    const key = `${name}|${cell.join(',')}`;
    if (this.readKeys.size < this.logCap) this.readKeys.add(key);
    if (!this.created.has(name)) return;
    if (this.filled.has(key) || this.unfilled.length >= 200) return;
    this.unfilled.push({ name, cell, loops: this.loopState(), after: this.writes.length });
  }

  tick(where) {
    if (++this.steps > this.maxSteps) {
      throw new RuntimeError(
        'Your algorithm ran far past the point where it should have finished. Something in a loop never shrinks.',
        { kind: 'cap', ...where },
      );
    }
  }

  execBlock(body, scope) {
    for (const stmt of body) {
      const r = this.exec(stmt, scope);
      if (r && r.type === RETURN) return r;
    }
    return null;
  }

  exec(stmt, scope) {
    this.tick(stmt.where);
    switch (stmt.node) {
      case 'funcdef':
        this.funcs.set(stmt.name, stmt);
        return null;

      case 'assign': {
        const value = this.eval(stmt.value, scope);
        if (value === undefined) {
          throw new RuntimeError(
            'The right-hand side of this line produces no value, so there is nothing to store.',
            { kind: 'type', ...stmt.where },
          );
        }
        if (stmt.targets.length === 1) {
          this.assignTo(stmt.targets[0], value, scope);
        } else {
          if (!Array.isArray(value) || value.length !== stmt.targets.length || !value.__tuple) {
            throw new RuntimeError(
              `This line unpacks ${stmt.targets.length} values, but the right-hand side produced ${value && value.__tuple ? value.length : 'one value'}.`,
              { kind: 'shape', ...stmt.where },
            );
          }
          stmt.targets.forEach((t, k) => this.assignTo(t, value[k], scope));
        }
        return null;
      }

      case 'for': {
        const from = needInt(this.eval(stmt.from, scope), 'A loop bound', stmt.where);
        const to = needInt(this.eval(stmt.to, scope), 'A loop bound', stmt.where);
        const step = stmt.step === null || stmt.step === undefined
          ? 1
          : needInt(this.eval(stmt.step, scope), 'A loop step', stmt.where);
        if (step < 1) {
          throw new RuntimeError(
            `A loop step has to be 1 or more; this one is ${step}. Use "down to" to count backwards.`,
            { kind: 'shape', ...stmt.where },
          );
        }
        // Not popped in a finally, on purpose: an error propagating out of the
        // body should leave the stack holding the pass it happened on.
        const frame = { name: stmt.varName, value: from };
        this.loops.push(frame);
        if (stmt.descending) {
          for (let v = from; v >= to; v -= step) {
            scope.set(stmt.varName, v);
            frame.value = v;
            this.tick(stmt.where);
            const r = this.execBlock(stmt.body, scope);
            if (r) { this.loops.pop(); return r; }
          }
        } else {
          for (let v = from; v <= to; v += step) {
            scope.set(stmt.varName, v);
            frame.value = v;
            this.tick(stmt.where);
            const r = this.execBlock(stmt.body, scope);
            if (r) { this.loops.pop(); return r; }
          }
        }
        this.loops.pop();
        return null;
      }

      case 'while': {
        for (;;) {
          this.tick(stmt.where);
          const c = this.eval(stmt.cond, scope);
          if (!truthy(c, stmt.where)) break;
          const r = this.execBlock(stmt.body, scope);
          if (r) return r;
        }
        return null;
      }

      case 'if': {
        if (truthy(this.eval(stmt.cond, scope), stmt.where)) return this.execBlock(stmt.body, scope);
        if (stmt.orelse) return this.execBlock(stmt.orelse, scope);
        return null;
      }

      case 'print': {
        const values = stmt.values.map((e) => this.eval(e, scope));
        // Index subscripts are recorded too: the printing puzzle is graded on
        // which entries were visited, not only on what they held.
        const subs = stmt.values.map((e) => (e.node === 'index' ? this.lastSubs.get(e) ?? null : null));
        this.prints.push({ values: values.map(deepCopy), subs });
        return null;
      }

      case 'return': {
        const values = stmt.values.map((e) => this.eval(e, scope));
        this.captureSnapshot(scope);
        return { type: RETURN, values };
      }

      default:
        throw new RuntimeError(`Unsupported statement (${stmt.node}).`, { kind: 'type', ...stmt.where });
    }
  }

  captureSnapshot(scope) {
    if (!this.traceNames.length || this.snapshots) return;
    const snap = {};
    for (const name of this.traceNames) {
      if (scope.has(name)) snap[name] = deepCopy(scope.get(name));
    }
    this.snapshots = snap;
  }

  // A table by name, for the row and column forms, with its shape checked once.
  axisTable(name, node, scope) {
    if (!scope.has(name)) {
      throw new RuntimeError(`"${name}" has no value at this point.`, { kind: 'name', name, ...node.where });
    }
    const container = scope.get(name);
    if (!isArr2(container)) {
      throw new RuntimeError(
        `"${name}" is ${shapeOf(container)}, so it has no rows or columns.`,
        { kind: 'shape', ...node.where },
      );
    }
    return { container, rows: container.length, cols: container[0].length };
  }

  assignTo(target, value, scope) {
    if (target.kind === 'axisSlice') {
      const { container, rows, cols } = this.axisTable(target.name, target, scope);
      const at = needInt(this.eval(target.at, scope), `A ${target.axis} number`, target.where);
      if (target.axis === 'row') {
        const i = this.checkIndex(at, rows, target.name, 0, target.where);
        const idx = Array.from({ length: cols }, (_, k) => k);
        assignSlice1(container[i], idx, value, target);
        idx.forEach((j) => this.noteWrite(target.name, [i, j], container[i][j], target.where));
        return;
      }
      const j = this.checkIndex(at, cols, target.name, 1, target.where);
      const idx = Array.from({ length: rows }, (_, k) => k);
      const vals = spreadValues(value, rows, target);
      idx.forEach((i, k) => { container[i][j] = vals[k]; });
      idx.forEach((i) => this.noteWrite(target.name, [i, j], container[i][j], target.where));
      return;
    }

    if (target.kind === 'name') {
      scope.set(target.name, value);
      if (this.logging) {
        if (Array.isArray(value)) this.created.add(target.name);
        this.noteWrite(target.name, [], value, target.where);
      }
      return;
    }

    const container = scope.get(target.name);
    if (container === undefined) {
      throw new RuntimeError(
        `"${target.name}" has no value yet, so there is nothing to store into. Create it first (with zeros, for example).`,
        { kind: 'name', ...target.where },
      );
    }
    const subs = target.subs.map((s) => this.evalSubscript(s, scope, target.where));

    if (subs.length === 1) {
      if (isArr2(container)) {
        throw new RuntimeError(`"${target.name}" is ${shapeOf(container)}, so it needs two subscripts.`, { kind: 'shape', ...target.where });
      }
      needArr(container, `"${target.name}"`, target.where);
      if (subs[0].kind === 'point') {
        const i = this.checkIndex(subs[0].at, container.length, target.name, null, target.where);
        container[i] = requireScalar(value, target.name, target.where);
        this.noteWrite(target.name, [i], container[i], target.where);
      } else {
        const idx = this.rangeIndices(subs[0], container.length, target.name, null, target.where);
        assignSlice1(container, idx, value, target);
        idx.forEach((i) => this.noteWrite(target.name, [i], container[i], target.where));
      }
      return;
    }

    if (!isArr2(container)) {
      throw new RuntimeError(`"${target.name}" is ${shapeOf(container)}, so it takes one subscript, not two.`, { kind: 'shape', ...target.where });
    }
    const rows = container.length;
    const cols = container[0].length;
    const [rs, cs] = subs;

    if (rs.kind === 'point' && cs.kind === 'point') {
      const i = this.checkIndex(rs.at, rows, target.name, 0, target.where);
      const j = this.checkIndex(cs.at, cols, target.name, 1, target.where);
      container[i][j] = requireScalar(value, target.name, target.where);
      this.noteWrite(target.name, [i, j], container[i][j], target.where);
      return;
    }
    if (rs.kind === 'point') {
      const i = this.checkIndex(rs.at, rows, target.name, 0, target.where);
      const idx = this.rangeIndices(cs, cols, target.name, 1, target.where);
      assignSlice1(container[i], idx, value, target);
      idx.forEach((j) => this.noteWrite(target.name, [i, j], container[i][j], target.where));
      return;
    }
    if (cs.kind === 'point') {
      const j = this.checkIndex(cs.at, cols, target.name, 1, target.where);
      const idx = this.rangeIndices(rs, rows, target.name, 0, target.where);
      const vals = spreadValues(value, idx.length, target);
      idx.forEach((i, k) => { container[i][j] = vals[k]; });
      idx.forEach((i) => this.noteWrite(target.name, [i, j], container[i][j], target.where));
      return;
    }
    const ri = this.rangeIndices(rs, rows, target.name, 0, target.where);
    const ci = this.rangeIndices(cs, cols, target.name, 1, target.where);
    if (isArr2(value)) {
      if (value.length !== ri.length || (value[0] || []).length !== ci.length) {
        throw new RuntimeError(`The table being stored is ${shapeOf(value)} but the destination is ${ri.length}×${ci.length}.`, { kind: 'shape', ...target.where });
      }
      ri.forEach((i, a) => ci.forEach((j, b) => { container[i][j] = value[a][b]; }));
    } else {
      const s = requireScalar(value, target.name, target.where);
      ri.forEach((i) => ci.forEach((j) => { container[i][j] = s; }));
    }
    ri.forEach((i) => ci.forEach((j) => this.noteWrite(target.name, [i, j], container[i][j], target.where)));
  }

  evalSubscript(sub, scope, where) {
    if (sub.kind === 'point') {
      return { kind: 'point', at: needInt(this.eval(sub.at, scope), 'A subscript', where) };
    }
    return {
      kind: 'range',
      lo: needInt(this.eval(sub.lo, scope), 'A range bound', where),
      hi: needInt(this.eval(sub.hi, scope), 'A range bound', where),
    };
  }

  // axis is null for a 1-D array, 0 for a table's rows, 1 for its columns.
  checkIndex(i, n, name, axis, where) {
    if (i < 0 || i >= n) {
      const hint = i < 0
        ? ' Subscripts start at 0 and never go negative in this notation.'
        : '';
      throw new RuntimeError(
        `The ${axisName(axis)} ${i} is outside ${name}, whose ${axisPlural(axis)} run 0 to ${n - 1}.${hint}`,
        { kind: 'index', index: i, extent: n, axis, ...where },
      );
    }
    return i;
  }

  rangeIndices(r, n, name, axis, where) {
    if (r.lo > r.hi) return []; // a..b is empty when a > b, by definition
    if (r.lo < 0 || r.hi >= n) {
      throw new RuntimeError(
        `The range ${r.lo}..${r.hi} runs outside ${name}, whose ${axisPlural(axis)} run 0 to ${n - 1}.`,
        { kind: 'index', index: r.lo < 0 ? r.lo : r.hi, extent: n, axis, ...where },
      );
    }
    const out = [];
    for (let i = r.lo; i <= r.hi; i++) out.push(i);
    return out;
  }

  eval(expr, scope) {
    this.tick(expr.where);
    switch (expr.node) {
      case 'number': return expr.value;

      case 'name': {
        if (expr.name === PI) return Math.PI;
        if (!scope.has(expr.name)) {
          throw new RuntimeError(`"${expr.name}" has no value at this point.`, { kind: 'name', name: expr.name, ...expr.where });
        }
        return scope.get(expr.name);
      }

      case 'blank': return this.eval(expr.expr, scope);

      case 'blankHole':
        throw new RuntimeError('A blank is still empty.', { kind: 'blank', blank: expr.blank, ...expr.where });

      case 'array': return expr.items.map((e) => requireScalar(this.eval(e, scope), 'an array literal', expr.where));

      case 'unary': {
        const v = this.eval(expr.operand, scope);
        if (expr.op === 'not') return !truthy(v, expr.where);
        return -requireScalar(v, 'a negation', expr.where);
      }

      case 'binary': return this.evalBinary(expr, scope);

      case 'index': return this.evalIndex(expr, scope);

      case 'axisSlice': {
        const { container, rows, cols } = this.axisTable(expr.name, expr, scope);
        const at = needInt(this.eval(expr.at, scope), `A ${expr.axis} number`, expr.where);
        if (expr.axis === 'row') {
          const i = this.checkIndex(at, rows, expr.name, 0, expr.where);
          // A copy, so "let c be row 0 of T" does not alias the table. This is
          // the .copy() the notebook's Python does on the same line.
          return container[i].slice();
        }
        const j = this.checkIndex(at, cols, expr.name, 1, expr.where);
        return container.map((r) => r[j]);
      }

      case 'call': return this.evalCall(expr, scope);

      default:
        throw new RuntimeError(`Unsupported expression (${expr.node}).`, { kind: 'type', ...expr.where });
    }
  }

  evalBinary(expr, scope) {
    const op = expr.op;
    if (op === 'and' || op === 'or') {
      const l = truthy(this.eval(expr.left, scope), expr.where);
      if (op === 'and') return l ? truthy(this.eval(expr.right, scope), expr.where) : false;
      return l ? true : truthy(this.eval(expr.right, scope), expr.where);
    }
    const a = this.eval(expr.left, scope);
    const b = this.eval(expr.right, scope);

    if (op === '=' || op === NE) {
      const eq = valuesEqual(a, b, 0);
      return op === '=' ? eq : !eq;
    }

    const x = requireScalar(a, 'this comparison or arithmetic', expr.where);
    const y = requireScalar(b, 'this comparison or arithmetic', expr.where);
    switch (op) {
      case '<': return x < y;
      case '>': return x > y;
      case LE: return x <= y;
      case GE: return x >= y;
      case '+': return x + y;
      case MINUS: return x - y;
      case TIMES: return x * y;
      case '/':
        if (y === 0) {
          throw new RuntimeError('This divides by zero.', { kind: 'divzero', ...expr.where });
        }
        return x / y;
      case '^': return Math.pow(x, y);
      default:
        throw new RuntimeError(`Unsupported operator "${op}".`, { kind: 'type', ...expr.where });
    }
  }

  evalIndex(expr, scope) {
    const container = this.eval(expr.target, scope);
    const name = expr.target.node === 'name' ? expr.target.name : 'that value';
    const subs = expr.subs.map((s) => this.evalSubscript(s, scope, expr.where));

    // Remember the concrete subscripts so `print T[i, j]` can record which
    // entry was visited.
    if (!this.lastSubs) this.lastSubs = new Map();
    this.lastSubs.set(expr, subs.map((s) => (s.kind === 'point' ? s.at : [s.lo, s.hi])));

    if (subs.length === 1) {
      if (isArr2(container)) {
        throw new RuntimeError(`${name} is ${shapeOf(container)}, so it needs a row and a column.`, { kind: 'shape', ...expr.where });
      }
      needArr(container, name, expr.where);
      if (subs[0].kind === 'point') {
        const i = this.checkIndex(subs[0].at, container.length, name, null, expr.where);
        this.noteRead(name, [i]);
        return container[i];
      }
      return this.rangeIndices(subs[0], container.length, name, null, expr.where).map((i) => container[i]);
    }

    if (!isArr2(container)) {
      throw new RuntimeError(`${name} is ${shapeOf(container)}, so it takes one subscript, not two.`, { kind: 'shape', ...expr.where });
    }
    const rows = container.length;
    const cols = container[0].length;
    const [rs, cs] = subs;

    if (rs.kind === 'point' && cs.kind === 'point') {
      const i = this.checkIndex(rs.at, rows, name, 0, expr.where);
      const j = this.checkIndex(cs.at, cols, name, 1, expr.where);
      this.noteRead(name, [i, j]);
      return container[i][j];
    }
    if (rs.kind === 'point') {
      const i = this.checkIndex(rs.at, rows, name, 0, expr.where);
      return this.rangeIndices(cs, cols, name, 1, expr.where).map((j) => container[i][j]);
    }
    if (cs.kind === 'point') {
      const j = this.checkIndex(cs.at, cols, name, 1, expr.where);
      return this.rangeIndices(rs, rows, name, 0, expr.where).map((i) => container[i][j]);
    }
    const ri = this.rangeIndices(rs, rows, name, 0, expr.where);
    const ci = this.rangeIndices(cs, cols, name, 1, expr.where);
    return ri.map((i) => ci.map((j) => container[i][j]));
  }

  evalCall(expr, scope) {
    const args = expr.args.map((e) => this.eval(e, scope));
    const where = expr.where;

    const fn = this.funcs.get(expr.name);
    if (fn) {
      if (args.length !== fn.params.length) {
        throw new RuntimeError(
          `${expr.name} takes ${fn.params.length} argument${fn.params.length === 1 ? '' : 's'}, but ${args.length} were given.`,
          { kind: 'arity', ...where },
        );
      }
      if (++this.callDepth > 200) {
        this.callDepth--;
        throw new RuntimeError('Functions are calling each other without ever stopping.', { kind: 'cap', ...where });
      }
      const inner = new Scope(null);
      fn.params.forEach((p, k) => inner.set(p, deepCopy(args[k])));
      const r = this.execBlock(fn.body, inner);
      this.callDepth--;
      // Falling off the end is legal: a printing procedure returns nothing.
      // Using that nothing as a value is what gets caught, at the point of use.
      if (!r) { this.captureSnapshot(inner); return undefined; }
      if (r.values.length === 0) return undefined;
      if (r.values.length === 1) return r.values[0];
      const tuple = r.values.slice();
      Object.defineProperty(tuple, '__tuple', { value: true, enumerable: false });
      return tuple;
    }

    const builtin = BUILTINS[expr.name];
    if (builtin) return builtin(args, where);

    throw new RuntimeError(`There is no function called "${expr.name}" in this notation.`, { kind: 'name', name: expr.name, ...where });
  }
}

// axis is null for a 1-D array, 0 for a table's rows, 1 for its columns. The
// plural is spelled out because "indexs" is what the obvious template produces.
function axisName(axis) {
  return axis === null ? 'index' : axis === 0 ? 'row' : 'column';
}

function axisPlural(axis) {
  return axis === null ? 'subscripts' : `${axisName(axis)}s`;
}

function truthy(v, where) {
  if (typeof v === 'boolean') return v;
  throw new RuntimeError(`A condition must be true or false, but this one is ${shapeOf(v)}.`, { kind: 'type', ...where });
}

function requireScalar(v, what, where) {
  if (typeof v === 'number') return v;
  throw new RuntimeError(`${what} needs a single number but got ${shapeOf(v)}.`, { kind: 'type', ...where });
}

function spreadValues(value, n, target) {
  if (Array.isArray(value) && !isArr2(value)) {
    if (value.length !== n) {
      throw new RuntimeError(
        `The array being stored has ${value.length} entries but the destination holds ${n}.`,
        { kind: 'shape', ...target.where },
      );
    }
    return value;
  }
  const s = requireScalar(value, `"${target.name}"`, target.where);
  return new Array(n).fill(s);
}

function assignSlice1(container, idx, value, target) {
  const vals = spreadValues(value, idx.length, target);
  idx.forEach((i, k) => { container[i] = vals[k]; });
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Run a parsed program, then call one function in it.
 *
 * @param {{body:Array}} program
 * @param {Object} options
 *   env      {Object<string, value>}  variables in scope for the call
 *   call     {string}                 pseudocode call expression, e.g. "f(x, y)"
 *   trace    {string[]}               locals to snapshot at the call's return
 *   maxSteps {number}
 *   log      {boolean}                record every write, and every read of an
 *                                     entry this run has not filled in yet
 * @returns {{value, trace, prints, steps, writes, unfilled}}
 */
export function run(program, options = {}) {
  const interp = new Interp(options);
  const global = new Scope(null);
  for (const [k, v] of Object.entries(options.env || {})) global.set(k, deepCopy(v));

  // A runtime error carries the pass it happened on. The loop stack is not
  // unwound on the way out (see the `for` case), so it is still accurate here.
  const report = (value) => ({
    value,
    trace: interp.snapshots || {},
    prints: interp.prints,
    steps: interp.steps,
    writes: interp.writes,
    unfilled: interp.unfilled,
    readKeys: interp.readKeys,
    created: interp.created,
  });
  const withLoops = (err) => {
    if (err instanceof LabError && err.loops === undefined) err.loops = interp.loopState();
    throw err;
  };

  let top;
  try {
    top = interp.execBlock(program.body, global);
  } catch (err) { withLoops(err); }
  if (top && top.type === RETURN) {
    return report(top.values.length === 1 ? top.values[0] : top.values);
  }

  let value;
  if (options.call) {
    const toks = tokenizeLine(options.call, { blockId: null, line: -1 });
    const parser = new ExprParser(toks, {});
    const expr = parser.parseExpression();
    parser.expect('eol', 'the end of the call');
    try {
      value = interp.eval(expr, global);
    } catch (err) { withLoops(err); }
  }
  return report(value);
}

/**
 * Evaluate a standalone expression, used for probing a blank's contents.
 */
export function evalExpression(source, env = {}, options = {}) {
  const toks = tokenizeLine(source, { blockId: null, line: -1, blank: options.blankName || null });
  const parser = new ExprParser(toks, {});
  const expr = parser.parseExpression();
  parser.expect('eol', 'the end of the expression');
  const interp = new Interp(options);
  const scope = new Scope(null);
  for (const [k, v] of Object.entries(env)) scope.set(k, deepCopy(v));
  return interp.eval(expr, scope);
}

/**
 * Structural equality with a relative tolerance. Shapes must match exactly;
 * numbers compare relatively, so 1e-9 means nine agreeing significant digits.
 */
export function valuesEqual(a, b, tol = 1e-9) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (a === b) return true;
    if (tol === 0) return false;
    return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!valuesEqual(a[i], b[i], tol)) return false;
    return true;
  }
  return false;
}

export const __test = { tokenizeLine, gaussianSolve };
