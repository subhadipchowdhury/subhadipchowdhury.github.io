// The divdiff gate, in the shape the lab spec ships it.
//
// This is the canonical example of the gate schema. It is kept here rather than
// inline in the test so the same object can be fed to the validator, and so the
// notebook metadata that generates it has something to be diffed against.

export const DIVDIFF_GATE = {
  cell_id: 'divdiff',
  concept: 'divided_differences',
  title: 'Build the divided-difference table',
  intro: 'Assemble the algorithm that fills the table. Order and indentation both count. Two blocks contain blanks.',

  blocks: [
    { id: 'def', lines: [{ text: 'function divided_differences(x, y):', indent: 0 }], py: [10, 10], py_match: 'def divided_differences' },
    { id: 'n', lines: [{ text: 'n ← length(x)', indent: 0 }], py: [25, 25], py_match: 'n = len' },
    { id: 'tab', lines: [{ text: 'T ← zeros(n, n)', indent: 0 }], py: [26, 26], py_match: 'np.zeros' },
    { id: 'col0', lines: [{ text: 'T[0..n-1, 0] ← y', indent: 0 }], py: [27, 27], py_match: 'table[:, 0]' },
    { id: 'loopj', lines: [{ text: 'for j ← 1 to n-1:', indent: 0 }], py: [28, 28], py_match: 'for j in range(1, n)' },
    { id: 'loopi', lines: [{ text: 'for i ← 0 to ⟨?bound⟩:', indent: 0 }], py: [29, 29], py_match: 'for i in range(n - j)' },
    { id: 'rec', lines: [{ text: 'T[i, j] ← (T[i+1, j-1] - T[i, j-1]) / ⟨?den⟩', indent: 0 }], py: [30, 30], py_match: 'table[i, j]' },
    { id: 'coef', lines: [{ text: 'c ← T[0, 0..n-1]', indent: 0 }], py: [31, 31], py_match: 'coeffs = table[0' },
    { id: 'ret', lines: [{ text: 'return c, T', indent: 0 }], py: [32, 32], py_match: 'return coeffs' },
  ],

  solution: [
    { id: 'def', indent: 0 },
    { id: 'n', indent: 1 },
    { id: 'tab', indent: 1 },
    { id: 'col0', indent: 1 },
    { id: 'loopj', indent: 1 },
    { id: 'loopi', indent: 2 },
    { id: 'rec', indent: 3 },
    { id: 'coef', indent: 1 },
    { id: 'ret', indent: 1 },
  ],

  blanks: {
    bound: { kind: 'range_end', answer: 'n-j-1', env: ['n', 'j'], width: 8 },
    den: { kind: 'expr', answer: 'x[i+j] - x[i]', env: ['x', 'i', 'j'], width: 14 },
  },

  distractors: [
    {
      id: 'd_num',
      lines: [{ text: 'T[i, j] ← (T[i, j-1] - T[i+1, j-1]) / ⟨?den⟩', indent: 0 }],
      near: 'rec',
      why: 'num_reversed',
    },
    {
      id: 'd_swap',
      lines: [
        { text: 'for i ← 0 to n-1:', indent: 0 },
        { text: 'for j ← 1 to n-i-1:', indent: 1 },
      ],
      near: 'loopj',
      why: 'loops_swapped',
    },
    {
      id: 'd_colc',
      lines: [{ text: 'c ← T[0..n-1, 0]', indent: 0 }],
      near: 'coef',
      why: 'col_not_row',
    },
  ],

  wrong_blanks: {
    den: [
      { text: 'x[j] - x[i]', why: 'den_j_not_ij' },
      { text: 'x[i+1] - x[i]', why: 'den_neighbour' },
    ],
    bound: [
      { text: 'n-1', why: 'bound_full' },
      { text: 'n-j', why: 'bound_off_by_one' },
    ],
  },

  probes: [
    { env: { x: [0, 1, 3, 6], y: [1, 4, 2, 8] }, call: 'divided_differences(x, y)' },
  ],

  trace: ['T'],
  compare: 'value',
  py_glue: [23, 24],
  py_doc: [11, 22],

  feedback: {
    num_reversed: "Your table's off-diagonal columns have the right magnitudes and the wrong signs, alternating by column. A divided difference is built from the later value minus the earlier one. Re-read your numerator.",
    loops_swapped: 'Your loops visit the (i, j) pairs in a different pattern. Ask which direction the table is filled: one full column at a time, or one row at a time? Which entries does T[i, j] need to already exist?',
    col_not_row: 'You returned n values, but they are not the Newton coefficients. The coefficients are the top entry of each column. Which subscript varies along that?',
    den_j_not_ij: 'Your denominator uses the wrong pair of nodes. The entry T[i, j] is the divided difference over the nodes x_i through x_{i+j}; the spread you divide by should span exactly those two.',
    den_neighbour: 'Your denominator is the gap between two adjacent nodes. That is right for the first column and wrong after it: a higher-order difference spans more than one interval.',
    bound_full: 'Your inner loop runs over every row of the table. Column j only has entries where the two neighbours it needs both exist, and that is fewer rows each time j grows.',
    bound_off_by_one: 'Your inner loop runs one row too far. Ask which two entries of the previous column T[i, j] reads, and which row is the last one where both of them exist.',
  },
};

// The reference values, computed by hand from the definition of a divided
// difference, so the tests are not checking the interpreter against itself.
export const REF_TABLE = [
  [1, 3, -4 / 3, (0.6 + 4 / 3) / 6],
  [4, -1, 0.6, 0],
  [2, 2, 0, 0],
  [8, 0, 0, 0],
];

export const REF_COEFFS = REF_TABLE[0].slice();

// A solved submission, for tests that need a valid baseline to perturb.
export const CORRECT = {
  placements: DIVDIFF_GATE.solution.map((s) => ({ ...s })),
  blanks: { bound: 'n-j-1', den: 'x[i+j] - x[i]' },
};

// Swap one block for another, keeping the indent. Returns a fresh submission.
export function swapBlock(submission, fromId, toId, indent) {
  const placements = submission.placements.map((p) => (
    p.id === fromId ? { id: toId, indent: indent ?? p.indent } : { ...p }
  ));
  return { ...submission, placements, blanks: { ...submission.blanks } };
}

export function withBlank(submission, name, text) {
  return {
    placements: submission.placements.map((p) => ({ ...p })),
    blanks: { ...submission.blanks, [name]: text },
  };
}
