"""Seed the lab metadata into newton_divided_differences.ipynb.

The notebook is the source of truth once this has run: the `lab` keys live in
cell metadata, beside the Python they describe, and Colab ignores them. This
file is the readable form of that first seed, kept because the puzzles are still
being revised daily and hand-editing JSON inside an .ipynb is unpleasant.

Running it again overwrites the lab metadata and nothing else. If you have since
edited the metadata in JupyterLab's property inspector, update this file to
match before running, or your edit is lost.

    .venv/bin/python tools/author/newton_lab.py

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/applet/notebooks/na/newton_divided_differences.ipynb')

# The reference divided-difference table for x = [0, 1, 3, 6], y = [1, 4, 2, 8],
# used as the input to the printing puzzle, which has no table of its own.
REF_TABLE = [
    [1.0, 3.0, -4 / 3, (0.6 + 4 / 3) / 6],
    [4.0, -1.0, 0.6, 0.0],
    [2.0, 2.0, 0.0, 0.0],
    [8.0, 0.0, 0.0, 0.0],
]
REF_COEFFS = list(REF_TABLE[0])

NODES = [0.0, 1.0, 3.0, 6.0]
VALUES = [1.0, 4.0, 2.0, 8.0]


def block(bid, text, py, match, indent=0):
    return {'id': bid, 'lines': [{'text': text, 'indent': indent}], 'py': py, 'py_match': match}


def fused(bid, texts, near, why):
    return {
        'id': bid,
        'lines': [{'text': t, 'indent': k} for k, t in enumerate(texts)],
        'near': near,
        'why': why,
    }


def decoy(bid, text, near, why):
    return {'id': bid, 'lines': [{'text': text, 'indent': 0}], 'near': near, 'why': why}


# ---------------------------------------------------------------------------
# Gate 1: the divided-difference table
# ---------------------------------------------------------------------------

DIVDIFF = {
    'mode': 'gated',
    'cell_id': 'divdiff',
    'concept': 'divided_differences',
    'title': 'Build the divided-difference table',
    'brief': r'''
Newton's form writes the interpolating polynomial through $(x_0,y_0),\dots,(x_{n-1},y_{n-1})$ as

$$p(x) = c_0 + c_1(x-x_0) + c_2(x-x_0)(x-x_1) + \cdots + c_{n-1}(x-x_0)\cdots(x-x_{n-2}).$$

The coefficients $c_k$ are **divided differences**, defined by

$$f[x_i] = y_i, \qquad f[x_i,\dots,x_{i+j}] = \frac{f[x_{i+1},\dots,x_{i+j}] - f[x_i,\dots,x_{i+j-1}]}{x_{i+j}-x_i}.$$

Each one is built from two differences of one lower order. Store them in a table $T$, where

$$T[i,\,j] = f[x_i,\dots,x_{i+j}],$$

so column $j$ holds the differences of order $j$. Column $0$ is just the data, and every later column is one entry shorter than the one before it, because a difference of order $j$ needs $j+1$ consecutive nodes to exist. That is what makes the table a triangle. The coefficients $c_0,\dots,c_{n-1}$ you need for $p$ are the top row.

**Your job.** Turn that definition into an algorithm for any $n$ points: fill the table one column at a time, then read the coefficients off the top row. Two things are left blank. How far does the inner loop run, given that column $j$ is shorter than column $j-1$? And which two nodes does the denominator span?
''',

    'blocks': [
        block('def', 'function divided_differences(x, y):', [10, 10], 'def divided_differences'),
        block('n', 'n ← length(x)', [25, 25], 'n = len'),
        block('tab', 'T ← zeros(n, n)', [26, 26], 'np.zeros'),
        block('col0', 'T[0..n−1, 0] ← y', [27, 27], 'table[:, 0]'),
        block('loopj', 'for j ← 1 to n−1:', [28, 28], 'for j in range(1, n)'),
        block('loopi', 'for i ← 0 to ⟨?bound⟩:', [29, 29], 'for i in range(n - j)'),
        block('rec', 'T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / ⟨?den⟩', [30, 30], 'table[i, j]'),
        block('coef', 'c ← T[0, 0..n−1]', [31, 31], 'coeffs = table[0'),
        block('ret', 'return c, T', [32, 32], 'return coeffs'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'n', 'indent': 1},
        {'id': 'tab', 'indent': 1},
        {'id': 'col0', 'indent': 1},
        {'id': 'loopj', 'indent': 1},
        {'id': 'loopi', 'indent': 2},
        {'id': 'rec', 'indent': 3},
        {'id': 'coef', 'indent': 1},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'bound': {'kind': 'range_end', 'answer': 'n−j−1', 'env': ['n', 'i', 'j'], 'width': 8},
        'den': {'kind': 'expr', 'answer': 'x[i+j] − x[i]', 'env': ['x', 'i', 'j'], 'width': 14},
    },

    'distractors': [
        decoy('d_num', 'T[i, j] ← (T[i, j−1] − T[i+1, j−1]) / ⟨?den⟩', 'rec', 'num_reversed'),
        fused('d_swap', ['for i ← 0 to n−1:', 'for j ← 1 to n−i−1:'], 'loopj', 'loops_swapped'),
        decoy('d_colc', 'c ← T[0..n−1, 0]', 'coef', 'col_not_row'),
    ],

    'wrong_blanks': {
        'den': [
            {'text': 'x[j] − x[i]', 'why': 'den_j_not_ij'},
            {'text': 'x[i+1] − x[i]', 'why': 'den_neighbour'},
        ],
        'bound': [
            {'text': 'n−1', 'why': 'bound_full'},
            {'text': 'n−j', 'why': 'bound_off_by_one'},
        ],
    },

    # Strictly unequal spacing on purpose: it separates x[i+j]−x[i] from
    # x[i+1]−x[i] and from x[j]−x[i] at several entries at once.
    'probes': [
        {'env': {'x': NODES, 'y': VALUES}, 'call': 'divided_differences(x, y)'},
    ],
    'trace': ['T'],
    'compare': 'value',

    'py_head': [1, 9],
    'py_doc': [11, 22],
    'py_glue': [23, 24],
    'annotations': [
        {
            'blocks': ['loopj', 'loopi'],
            'text': 'A convention shift worth noticing: "to n−1" in the notation is inclusive, while Python\'s range(1, n) stops before n. Same iterations, different fence.',
        },
        {
            'blocks': ['coef'],
            'text': 'The .copy() is there so the returned coefficients do not alias the table\'s top row. Housekeeping, not algorithm.',
        },
    ],

    'feedback': {
        'num_reversed': "Your table's off-diagonal columns have the right magnitudes and the wrong signs, alternating by column. A divided difference is built from the later value minus the earlier one. Re-read your numerator.",
        'loops_swapped': 'Your loops visit the (i, j) pairs in a different pattern. Ask which direction the table fills: one full column at a time, or one row at a time? Which entries does T[i, j] need to already exist?',
        'col_not_row': 'You returned n values, but they are not the Newton coefficients. The coefficients are the top entry of each column. Which subscript varies along that?',
        'den_j_not_ij': 'Your denominator uses the wrong pair of nodes. The entry T[i, j] is the divided difference over the nodes x_i through x_{i+j}, so the spread you divide by should span exactly those two.',
        'den_neighbour': 'Your denominator is the gap between two adjacent nodes. That is right for the first column and wrong after it: a higher-order difference spans more than one interval.',
        'bound_full': 'Your inner loop runs over every row of the table. Column j only has entries where both of the neighbours it reads exist, and that is one fewer row each time j grows.',
        'bound_off_by_one': 'Your inner loop runs one row too far. Ask which two entries of the previous column T[i, j] reads, and which row is the last one where both of them exist.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: printing the triangle
# ---------------------------------------------------------------------------
#
# Pre-placed on purpose. The whole reason this gate exists is one contrast: the
# cell above bounds the shrinking dimension by n−j−1 over columns, this one
# bounds it by n−i−1 over rows, and a student who pattern-matched the first
# bound writes the wrong one here. Arranging five obvious lines around that adds
# nothing, and the Python is string building, so most of the reveal would be
# dimmed bookkeeping. The transposed-nest decoy is gone too: it teaches the same
# which-loop-is-outer lesson the previous puzzle just finished teaching.

DDPRINT = {
    'mode': 'gated',
    'cell_id': 'ddprint',
    'concept': 'print_dd_table',
    'title': 'Print the table as a triangle',
    'setup': {
        'intro': 'Run the algorithm you just built on the four points and this is the table it fills:',
        'code': (
            "print('nodes  x =', x_data)\n"
            "print('values y =', y_data)\n"
            "print()\n"
            "print(np.array2string(table, precision=4, suppress_small=True))"
        ),
        'caption': (
            'Half of that is zeros, and they are not data. Column $j$ holds the '
            'differences of order $j$, and there is one fewer of them each time '
            '$j$ grows, so everything past the anti-diagonal was never written '
            'to. Printed as a square, the table is mostly padding.'
        ),
    },
    'brief': r'''
Print it as the triangle it is instead, one row per node:

```
  x_i   |  f[.] (order increases left -> right)
 0.000  |    1.0000    3.0000   -1.3333    0.3222
 1.000  |    4.0000   -1.0000    0.6000
 3.000  |    2.0000    2.0000
 6.000  |    8.0000
```

Row $i$ starts at node $x_i$ and runs along the differences that begin there: $f[x_i]$, then $f[x_i,x_{i+1}]$, then $f[x_i,x_{i+1},x_{i+2}]$, and so on. It stops when the next one would need a node past $x_{n-1}$.

**Your job.** The lines are already in order and only the inner bound is missing. Write the index of the last entry on row $i$.

Careful: the previous puzzle bounded the *columns*, which shrink as the order $j$ grows. This one bounds the *rows*, which shrink as the starting node $i$ moves down. They are not the same bound.
''',
    'prefill': 'all',

    'blocks': [
        block('def', 'function print_dd_table(x, T):', [4, 4], 'def print_dd_table'),
        block('n', 'n ← length(x)', [9, 9], 'n = len(x)'),
        block('loopi', 'for i ← 0 to n−1:', [12, 12], 'for i in range(n)'),
        block('loopj', 'for j ← 0 to ⟨?rowlen⟩:', [14, 14], 'for j in range(n - i)'),
        block('pr', 'print T[i, j]', [15, 15], 'row +='),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'n', 'indent': 1},
        {'id': 'loopi', 'indent': 1},
        {'id': 'loopj', 'indent': 2},
        {'id': 'pr', 'indent': 3},
    ],

    'blanks': {
        'rowlen': {'kind': 'range_end', 'answer': 'n−i−1', 'env': ['n', 'i', 'j'], 'width': 8},
    },

    'distractors': [],

    'wrong_blanks': {
        'rowlen': [
            {'text': 'n−1', 'why': 'rowlen_square'},
            {'text': 'n−j−1', 'why': 'rowlen_uses_j'},
            {'text': 'n−i', 'why': 'rowlen_off_by_one'},
        ],
    },

    'probes': [
        {'env': {'x': NODES, 'T': REF_TABLE}, 'call': 'print_dd_table(x, T)'},
    ],
    'trace': [],
    'compare': 'prints',

    'py_head': [1, 3],
    'py_doc': [5, 8],
    'py_glue': [10, 11, 13, 16],
    'annotations': [
        {
            'blocks': ['pr'],
            'text': 'The Python collects a row into a string and prints it once at the end of the row, rather than printing each entry as it goes. Same entries, same order.',
        },
    ],

    'feedback': {
        'rowlen_square': 'You printed the whole square, including entries that no column ever wrote to. Those zeros are not part of the table.',
        'rowlen_uses_j': 'j is the variable this loop is about to bind, so it cannot appear in its own bound. Which index tells you how far down the table this row starts?',
        'rowlen_off_by_one': 'One entry too many on every row. Count the differences that start at node i: the first is the value there, and the last is the one that reaches the final node.',
    },
}

# ---------------------------------------------------------------------------
# Gate 3: nested evaluation
# ---------------------------------------------------------------------------

NEWEVAL = {
    'mode': 'gated',
    'cell_id': 'neweval',
    'concept': 'newton_eval',
    'title': 'Evaluate the polynomial at a point',
    'setup': {
        'intro': 'The Newton coefficients are the top row of the triangle you just printed:',
        'code': "print('c =', np.array2string(coeffs, precision=4))",
        'caption': (
            'Reading those into Newton\'s form, the cubic through the four points is\n\n'
            '$$p(x) = 1 + 3(x-0) - 1.3333(x-0)(x-1) + 0.3222(x-0)(x-1)(x-3).$$\n\n'
            'That is the polynomial written down. Nothing you have built so far '
            'evaluates it, so there is still no way to ask what $p(2.5)$ is.'
        ),
    },
    'brief': r'''
Evaluating

$$p(t) = c_0 + c_1(t-x_0) + c_2(t-x_0)(t-x_1) + \cdots + c_{n-1}(t-x_0)\cdots(t-x_{n-2})$$

by computing each product from scratch costs $\mathcal{O}(n^2)$ multiplications. Factoring out the shared factors nests the whole thing:

$$p(t) = c_0 + (t-x_0)\Bigl(c_1 + (t-x_1)\bigl(c_2 + \cdots + (t-x_{n-2})\,c_{n-1}\bigr)\Bigr).$$

That costs $\mathcal{O}(n)$. It is the same rearrangement as Horner's rule for a polynomial in powers of $x$.

Read it from the inside out. Start from the value in the innermost bracket, then repeatedly multiply by $(t - x_k)$ and add $c_k$, working outward until you reach $c_0$.

**Your job.** Build that sweep. Two questions decide it: which coefficient sits in the innermost bracket, and which direction does $k$ run?
''',

    'blocks': [
        block('def', 'function newton_eval(xn, c, t):', [4, 4], 'def newton_eval'),
        block('n', 'n ← length(c)', [18, 18], 'n = len(coeffs)'),
        block('init', 'p ← c[⟨?init⟩]', [19, 19], 'np.full_like'),
        block('loop', 'for k ← n−2 down to 0:', [20, 20], 'for k in range(n - 2'),
        block('upd', 'p ← p · (t − xn[k]) + c[k]', [21, 21], 'result = result *'),
        block('ret', 'return p', [22, 22], 'return result'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'n', 'indent': 1},
        {'id': 'init', 'indent': 1},
        {'id': 'loop', 'indent': 1},
        {'id': 'upd', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'init': {'kind': 'index', 'answer': 'n−1', 'env': ['n'], 'width': 6},
    },

    'distractors': [
        decoy('d_fwd', 'for k ← 1 to n−1:', 'loop', 'sweep_forward'),
        decoy('d_node', 'p ← p · (t − c[k]) + c[k]', 'upd', 'shift_by_coeff'),
    ],

    'wrong_blanks': {
        'init': [
            {'text': '0', 'why': 'init_first'},
            {'text': 'n', 'why': 'init_past_end'},
        ],
    },

    # Three query points, because a wrong assembly can agree with the right one
    # at an isolated t; the interpreter tests check these three are clear of the
    # places where the forward-sweep distractor crosses the correct polynomial.
    'probes': [
        {'env': {'xn': NODES, 'c': REF_COEFFS, 't': 0.5}, 'call': 'newton_eval(xn, c, t)'},
        {'env': {'xn': NODES, 'c': REF_COEFFS, 't': 2.0}, 'call': 'newton_eval(xn, c, t)'},
        {'env': {'xn': NODES, 'c': REF_COEFFS, 't': 5.0}, 'call': 'newton_eval(xn, c, t)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 3],
    'py_doc': [5, 16],
    'py_glue': [17],
    'annotations': [
        {
            'blocks': ['init', 'upd'],
            'text': 'The Python evaluates at a whole array of query points at once, so np.full_like is the vectorized twin of p ← c[n−1] and the update runs on every point in parallel. Your pseudocode is the same arithmetic at one t.',
        },
    ],

    'feedback': {
        'sweep_forward': 'A forward sweep pairs with starting from the first coefficient. This nesting is read from the innermost parenthesis outward, and the innermost one holds the last coefficient.',
        'shift_by_coeff': 'The factors (t − x_k) shift by the nodes. You are shifting by the coefficients, which are values of the function, not places on the axis.',
        'init_first': 'Starting from c[0] pairs with a forward sweep. This loop runs backward, so ask which coefficient the innermost parenthesis holds.',
        'init_past_end': 'There is no coefficient at that index. The array holds n of them, and the subscripts run from 0.',
    },
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# The lab page carries the puzzles and nothing else. Every other cell stays in
# the notebook, which is what the student opens once the puzzles are done.

CELLS = {
    3: DIVDIFF,
    4: DDPRINT,
    7: NEWEVAL,
}

NOTEBOOK_LAB = {
    'lab_id': 'm1-newton',
    'module': 'M1',
    'order': 2,
    'title': 'Newton form and divided differences',
    'blurb': 'Build the divided-difference table, then the nested evaluation that uses it.',
    'series': ['m1-runge', 'm1-newton', 'm1-splines'],
    'colab_path': 'na/newton_divided_differences.ipynb',
    'intro': (
        'These three puzzles build the polynomial that passes through a set of '
        'points: its coefficients first, then a way to look at them, then a way '
        'to evaluate the polynomial at a point.\n\n'
        'The worked example throughout is four points,\n\n'
        '$$x = 0,\\; 1,\\; 3,\\; 6 \\qquad y = 1,\\; 4,\\; 2,\\; 8,$$\n\n'
        'and exactly one cubic passes through all four. Every number you see '
        'below comes from running these algorithms on those points.\n\n'
        'Rebuild each algorithm from the scrambled steps; the notebook opens '
        'once all three are done. Where a step goes and how far it is indented '
        'are both part of the answer: a line one level further in runs once for '
        'every pass of the loop above it.\n\n'
        'The steps are pseudocode. `←` assigns, `·` multiplies, subscripts start '
        'at 0, and a range written `a to b` includes both ends.'
    ),
}


def main():
    if not NOTEBOOK.exists():
        sys.exit(f'not found: {NOTEBOOK}')
    nb = json.loads(NOTEBOOK.read_text())

    nb['metadata']['lab'] = NOTEBOOK_LAB
    # Clear any earlier seeding so a cell that stops being a puzzle stops being
    # one in the file too.
    for cell in nb['cells']:
        cell.get('metadata', {}).pop('lab', None)
    for index, plan in CELLS.items():
        if index >= len(nb['cells']):
            sys.exit(f'the notebook has no cell {index}; the plan is out of date')
        nb['cells'][index].setdefault('metadata', {})['lab'] = plan

    NOTEBOOK.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + '\n')
    gated = [p['cell_id'] for p in CELLS.values()]
    print(f'seeded {NOTEBOOK} with {len(gated)} puzzles: {", ".join(gated)}')


if __name__ == '__main__':
    main()
