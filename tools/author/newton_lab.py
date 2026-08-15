"""Seed the lab metadata into newton_divided_differences.ipynb.

The notebook is the source of truth once this has run: the `lab` keys live in
cell metadata, beside the Python they describe, and Colab ignores them. This
file is the readable form of that first seed, kept because the puzzles are still
being revised daily and hand-editing JSON inside an .ipynb is unpleasant.

Running it again overwrites the lab metadata and nothing else. If you have since
edited the metadata in JupyterLab's property inspector, update this file to
match before running, or your edit is lost.

    ~/.venvs/labs/bin/python tools/author/newton_lab.py

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them. The concept check has none of that: it has no Python behind it, and
the cell it hangs off decides where it sits on the page and nothing more.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/newton_divided_differences.ipynb')

# The reference divided-difference table for x = [0, 1, 3, 6], y = [1, 4, 2, 8].
# Kept whole, though only its top row is used now, because the top row is only
# meaningful next to the table it came out of.
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
Newton's form builds the interpolating polynomial one node at a time. Start with $p_0(x) = c_0$ and set $c_0 = y_0$. At each later step, add a term that vanishes at every node already matched:

$$p_k(x) = p_{k-1}(x) + c_k(x-x_0)(x-x_1)\cdots(x-x_{k-1}).$$

Since the new term is zero at $x_0,\dots,x_{k-1}$, the earlier data stay interpolated, and the single condition $p_k(x_k) = y_k$ pins down $c_k$. Solve for the $c_k$ and they turn out to be **divided differences**, given by the recurrence

$$f[x_i] = y_i, \qquad f[x_i,\dots,x_{i+j}] = \frac{f[x_{i+1},\dots,x_{i+j}] - f[x_i,\dots,x_{i+j-1}]}{x_{i+j}-x_i},$$

so a difference of order $j$ comes from two differences of order $j-1$. Let's collect them in a table $T$ with

$$T[i][j] = f[x_i,\dots,x_{i+j}],$$

so column $j$ holds every difference of order $j$, and column $0$ is the data itself. A difference of order $j$ needs $j+1$ consecutive nodes to exist, so column $j$ runs $j$ entries shorter than column $0$, and the part of the table that gets filled in is a triangle. The coefficients $c_0,\dots,c_{n-1}$ sit along its top row.

Turn that recurrence into an algorithm that works for any $n$: fill $T$ one column at a time, then read the coefficients off the top row. Two expressions are left blank.

Let's settle the notation first. A range includes both of its ends, so `for each k from 0 to 3` runs $k = 0, 1, 2, 3$. The bound you write is the last index the loop visits, not the number of passes it makes.

Column $j$ is shorter than column $j-1$, so the inner loop can't reach every row. Write the index of the last row that column $j$ fills. Then write the two nodes that belong in the denominator.
''',

    'blocks': [
        block('def', 'function divided_differences, given nodes x and values y:', [10, 10], 'def divided_differences'),
        block('n', 'let n be the number of entries in x', [25, 25], 'n = len'),
        block('tab', 'let T be a table of n by n zeros', [26, 26], 'np.zeros'),
        block('col0', 'let column 0 of T be y', [27, 27], 'table[:, 0]'),
        block('loopj', 'for each order j from 1 to n-1:', [28, 28], 'for j in range(1, n)'),
        block('loopi', 'for each row i from 0 to ⟨?bound⟩:', [29, 29], 'for i in range(n - j)'),
        block('rec', 'let T[i][j] be (T[i+1][j-1] - T[i][j-1]) / ⟨?den⟩', [30, 30], 'table[i, j]'),
        block('coef', 'let c be row 0 of T', [31, 31], 'coeffs = table[0'),
        block('ret', 'return c and T', [32, 32], 'return coeffs'),
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
        'bound': {'kind': 'range_end', 'answer': 'n-j-1', 'env': ['n', 'i', 'j'], 'width': 8},
        'den': {'kind': 'expr', 'answer': 'x[i+j] - x[i]', 'env': ['x', 'i', 'j'], 'width': 14},
    },

    'distractors': [
        decoy('d_num', 'let T[i][j] be (T[i][j-1] - T[i+1][j-1]) / ⟨?den⟩', 'rec', 'num_reversed'),
        fused(
            'd_swap',
            ['for each row i from 0 to n-1:', 'for each order j from 1 to n-i-1:'],
            'loopj',
            'loops_swapped',
        ),
        decoy('d_colc', 'let c be column 0 of T', 'coef', 'col_not_row'),
    ],

    'wrong_blanks': {
        'den': [
            {'text': 'x[j] - x[i]', 'why': 'den_j_not_ij'},
            {'text': 'x[i+1] - x[i]', 'why': 'den_neighbour'},
        ],
        'bound': [
            {'text': 'n-1', 'why': 'bound_full'},
            {'text': 'n-j', 'why': 'bound_off_by_one'},
        ],
    },

    # Strictly unequal spacing on purpose: it separates x[i+j]-x[i] from
    # x[i+1]-x[i] and from x[j]-x[i] at several entries at once.
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
            'text': "The pseudocode says from 1 to n-1 and includes both ends, while Python's range(1, n) stops before n. Both give j = 1, 2, ..., n-1, so the two describe the same loop.",
        },
        {
            'blocks': ['coef'],
            'text': "Taking row 0 of the table hands back a copy of it, which is what the .copy() in the Python does too, so writing to the coefficients afterwards won't change the table. It doesn't affect any value computed.",
        },
    ],

    'feedback': {
        'num_reversed': 'The magnitudes in your table are right, but the signs alternate from one column to the next. Look again at the order of subtraction in your numerator: a divided difference subtracts the earlier value from the later one.',
        'loops_swapped': 'Your loops visit the (i, j) pairs in a different order. Computing T[i][j] reads two entries out of column j-1, so the whole of that column has to be finished before column j starts. Which loop has to be on the outside for that?',
        'col_not_row': "You returned n values, but they aren't the coefficients. The coefficients are the top entry of each column, and the top entries lie along row 0.",
        'den_j_not_ij': 'T[i][j] is the divided difference over the nodes x_i through x_{i+j}. Your denominator uses a different pair. Which two of those nodes are the outer ones?',
        'den_neighbour': 'You divided by the gap between two adjacent nodes. That works in column 1, where a difference does span a single interval, but a difference of order j spans j of them.',
        'bound_full': 'Your inner loop runs over every row. Column j has an entry in row i only when both of the entries it reads from column j-1 exist, and that fails one row earlier each time j grows.',
        'bound_off_by_one': 'Your inner loop goes one row too far. If you were counting how many rows column j fills, that count is one more than the last index, and the bound here is the index. Computing T[i][j] reads T[i][j-1] and T[i+1][j-1], so find the largest i for which both of those were filled in.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: the concept check
# ---------------------------------------------------------------------------
#
# Three questions about what the table means, in the slot the printing puzzle
# used to hold. They sit after divdiff and before neweval, so nothing here may
# depend on the evaluation algorithm: at this point the student has built the
# table and nothing else.
#
# One question per idea, and each one is a fact a student can carry out of the
# lab: the linear algebra the Newton basis is doing, the order-k difference of a
# degree-k polynomial, and what a reordering of the nodes does and does not
# change. Every wrong option is a mistake somebody actually makes, which is why
# each has a diagnosis rather than a verdict.


def option(oid, text, why):
    return {'id': oid, 'text': text, 'why': why}


DDCHECK = {
    'mode': 'quiz',
    'cell_id': 'ddcheck',
    'concept': 'newton_basis',
    'title': 'What the table is telling you',
    'brief': r'''
You've built the table. Before we evaluate anything with it, let's ask what it means, because the recurrence is the mechanical half of Newton's form and this is the other half.

Pick one answer for each of the three. A wrong pick tells you what it got wrong rather than what the answer is, and none of them needs code.
''',

    'questions': [
        {
            'id': 'matrix',
            'stem': r'''
Let's put the interpolation conditions in matrix form. Write the polynomial in the Newton basis,

$$p(x) = \sum_{j=0}^{n-1} c_j N_j(x), \qquad N_0(x) = 1, \quad N_j(x) = (x-x_0)(x-x_1)\cdots(x-x_{j-1}),$$

and impose $p(x_i) = y_i$ at each of the $n$ nodes. That's a square system $Ac = y$ with $A_{ij} = N_j(x_i)$. What does $A$ look like?
''',
            'answer': 'lower',
            'options': [
                option(
                    'lower',
                    r"It's lower triangular, and its diagonal entries are all nonzero.",
                    r'''
$N_j$ was built to vanish at $x_0,\dots,x_{j-1}$, so $A_{ij} = 0$ whenever $j > i$: row $i$ runs out at column $i$. The diagonal entry $N_i(x_i) = \prod_{k<i}(x_i-x_k)$ is a product of nonzero gaps, so it never vanishes and the system has exactly one solution.

Now solve it by forward substitution and watch what the first rows give you: $c_0 = y_0$, then $c_1 = (y_1-c_0)/(x_1-x_0)$. That's the divided-difference recurrence, arrived at from the linear algebra instead of from the telescoping argument, and the $\mathcal{O}(n^2)$ cost of filling the table is the cost of the substitution. It also says in one line why appending a node is cheap: a new node adds a row at the bottom, and forward substitution never revisits a row it has passed.
''',
                ),
                option(
                    'upper',
                    r"It's upper triangular, and its diagonal entries are all nonzero.",
                    r'''
You have the triangle the right shape and the wrong way up. Which entries of $A$ are forced to vanish? $N_j$ is zero at the nodes $x_0,\dots,x_{j-1}$, so the zeros land where the basis function's index runs ahead of the node's, and $A_{ij} = 0$ for $j > i$ puts them above the diagonal.
''',
                ),
                option(
                    'vander',
                    r"It's dense: it's the Vandermonde matrix $A_{ij} = x_i^{\,j}$ all over again.",
                    r'''
That's the matrix the monomial basis $1, x, x^2, \dots$ gives, and getting away from it is most of the reason for changing basis: it has no forced zeros and it conditions badly as $n$ grows. A Newton basis function vanishes at every node before its own, and each of those zeros is an entry of $A$ you get for free.
''',
                ),
                option(
                    'ident',
                    r"It's the identity matrix.",
                    r'''
That's the Lagrange basis, where $\ell_i(x_j)$ is $1$ if $i = j$ and $0$ otherwise, which is exactly why those coefficients need no solving: $c = y$. Newton's basis functions aren't $1$ at one node and $0$ at the others. Each vanishes at every node before it and is generally nonzero at every node after it, which leaves a triangle rather than a diagonal.
''',
                ),
            ],
        },
        {
            'id': 'leading',
            'stem': r'''
Take $f(x) = x^3$ and any four distinct nodes $x_0, x_1, x_2, x_3$. What is $f[x_0,x_1,x_2,x_3]$?

You can answer this without computing a single difference.
''',
            'answer': 'one',
            # A natural order, so it keeps the one it was written in.
            'shuffle': False,
            'options': [
                option('zero', r"It's $0$.", r'''
The *fourth* difference of a cubic is $0$, and so is every higher one. An order $k$ difference annihilates every polynomial of degree less than $k$; at degree exactly $k$ something survives. What survives at $k = 3$ for a cubic?
'''),
                option('one', r"It's $1$, whatever the nodes are.", r'''
The order $k$ divided difference of a degree $k$ polynomial is its leading coefficient. Let's see that two ways.

With calculus: $f[x_0,\dots,x_k] = f^{(k)}(\xi)/k!$ for some $\xi$ between the outermost nodes, and $f^{(3)}(x) = 6$ is constant, so the difference is $6/3! = 1$ wherever $\xi$ happened to land.

Without: $f[x_0,x_1,x_2,x_3]$ is the coefficient of the highest Newton term, so it's the coefficient of $x^3$ in the interpolating cubic. The cubic through four points of $x^3$ is $x^3$ itself, by uniqueness, so that coefficient is $1$.

In general, order $k$ differences kill everything of degree below $k$ and return the leading coefficient at degree exactly $k$, which is also why the last column of a table built from polynomial data goes quiet.
'''),
                option('six', r"It's $6$, whatever the nodes are.", r'''
You've found $f^{(3)}$ and stopped one step early. The relation between a divided difference and a derivative carries a factorial,

$$f[x_0,\dots,x_k] = \frac{f^{(k)}(\xi)}{k!},$$

so what a difference of order $k$ returns is the $k$th Taylor coefficient rather than the $k$th derivative. Divide by $3!$.
'''),
                option('depends', r'It depends on the nodes.', r'''
The intermediate differences do depend on the nodes, so this is a reasonable guess. The top one doesn't. Compute it on the four nodes of this lab and then on four others: $f[x_0,x_1,x_2,x_3]$ is the coefficient of $x^3$ in the cubic interpolating $x^3$ at those four points, and that cubic is $x^3$ whichever four points you pick.
'''),
            ],
        },
        {
            'id': 'reorder',
            'stem': r'''
We fixed the node order at the start and nothing forced that choice. Suppose you reverse the list, feeding in $x_3, x_2, x_1, x_0$ with their values, and build the table again. What changes?
''',
            'answer': 'same_poly',
            'options': [
                option(
                    'same_poly',
                    r'The polynomial is the same, and so is the last coefficient, but the ones in between generally change.',
                    r'''
Three separate things are going on here. The polynomial can't change, since there's exactly one polynomial of degree less than $n$ through $n$ points with distinct $x$ values, and reordering data doesn't change the data. The last coefficient can't change either: $f[x_0,\dots,x_{n-1}]$ takes every node as an argument and a divided difference is symmetric in its arguments. There's a second reason for that one, which needs no symmetry at all, since it's the coefficient of $x^{n-1}$ in $p$ and therefore a property of $p$ alone.

What does change is everything in between, because $c_k = f[x_0,\dots,x_k]$ depends on *which* $k+1$ nodes come first in the list, and reversing it changes that set. So the same polynomial comes out in a different nested form, with $c_0$ going from $y_0$ to $y_{n-1}$.
''',
                ),
                option(
                    'diff_poly',
                    r'The polynomial itself changes, since its coefficients do.',
                    r'''
The coefficients do change, and that still doesn't move the polynomial. They're coordinates in a basis that depends on the node order itself, since $N_j(x) = (x-x_0)\cdots(x-x_{j-1})$ is built from the first $j$ nodes in the list. Different coordinates in a different basis can perfectly well describe the same vector, and uniqueness says that here they have to.
''',
                ),
                option(
                    'nothing',
                    r'Nothing changes at all, because a divided difference is symmetric in its arguments.',
                    r'''
That symmetry does save the *last* coefficient: $f[x_0,\dots,x_{n-1}]$ takes all $n$ nodes as arguments, so permuting them changes nothing. But $c_1 = f[x_0,x_1]$ takes two, and which two depends on the order. Symmetry in the arguments isn't symmetry in which arguments the function is handed.
''',
                ),
                option(
                    'only_c0',
                    r"Only $c_0$ changes, since it's the one coefficient that names a single node.",
                    r'''
$c_0$ does change, from $y_0$ to $y_{n-1}$, so half of this is right. Now look at $c_1 = f[x_0,x_1]$, a difference over the first two nodes in the list. Are those the same two nodes after the reversal?
''',
                ),
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Gate 3: nested evaluation
# ---------------------------------------------------------------------------
#
# The printing puzzle that used to sit in the middle slot is gone, the concept
# check above has taken that slot, and the puzzle's exposition (the square array
# with its padding zeros, and the triangle) is now this gate's setup. It was never a Parsons puzzle: every line was pre-placed and
# the whole of it was one loop bound, n-i-1 over rows against the n-j-1 over
# columns next door. That contrast cannot be set up without warning the student
# about it, and the warning is the answer, so the gate had nothing left to ask.
# The Python was string building too, which made most of its reveal dimmed
# bookkeeping. print_dd_table still lives in the notebook and still prints the
# triangle here; it just isn't something the student has to rebuild.

NEWEVAL = {
    'mode': 'gated',
    'cell_id': 'neweval',
    'concept': 'newton_eval',
    'title': 'Evaluate the polynomial at a point',
    'setup': {
        'intro': (
            'Running the algorithm you just built on those four points fills this '
            "table. Let's print it twice, first as the square array it lives in "
            'and then as the triangle it really is:'
        ),
        'code': (
            "print('nodes  x =', x_data)\n"
            "print('values y =', y_data)\n"
            "print()\n"
            "print(np.array2string(table, precision=4, suppress_small=True))\n"
            "print()\n"
            "print_dd_table(x_data, table)\n"
            "print()\n"
            "print('c =', np.array2string(coeffs, precision=4))"
        ),
        'caption': (
            "Most of the entries in that square aren't data. Column $j$ has one "
            'fewer entry than column $j-1$, so nothing below the anti-diagonal '
            'was ever assigned, and the zeros sitting there are what `np.zeros` '
            'left behind. The triangle drops them. Row $i$ of it starts at node '
            '$x_i$ and lists the divided differences that begin there, $f[x_i]$, '
            'then $f[x_i,x_{i+1}]$, and so on until the next one would need a '
            'node past $x_{n-1}$.\n\n'
            "The coefficients we're after are the first row of that triangle. "
            "Reading them into Newton's form, the cubic through our four points "
            'is\n\n'
            '$$p(x) = 1 + 3(x-0) - 1.3333(x-0)(x-1) + 0.3222(x-0)(x-1)(x-3).$$\n\n'
            "So we have the polynomial. We still can't get a number out of it, "
            'though: nothing built so far will tell us what $p(2.5)$ is.'
        ),
    },
    'brief': r'''
Written out term by term,

$$p(t) = c_0 + c_1(t-x_0) + c_2(t-x_0)(t-x_1) + \cdots + c_{n-1}(t-x_0)\cdots(t-x_{n-2}),$$

the $k$th term costs $k$ multiplications, so the whole sum costs $\mathcal{O}(n^2)$ at every point we ask about. That is wasteful, since each term rebuilds a product the term before it had already computed. What if we factor the shared pieces out? The sum nests:

$$p(t) = c_0 + (t-x_0)\Bigl(c_1 + (t-x_1)\bigl(c_2 + \cdots + (t-x_{n-2})\,c_{n-1}\bigr)\Bigr),$$

and now each step is one multiplication and one addition, so the cost drops to $\mathcal{O}(n)$. This is Horner's rule, applied to the Newton basis instead of to the powers of $x$.

Read the nested form from the inside out: start with the value in the innermost bracket, then repeatedly multiply by $(t - x_k)$ and add $c_k$, working outward until you reach $c_0$.

Write that sweep as a loop. Two things decide it: which coefficient you start from, and which way $k$ runs.
''',

    'blocks': [
        block('def', 'function newton_eval, given nodes xn, coefficients c and point t:', [4, 4], 'def newton_eval'),
        block('n', 'let n be the number of entries in c', [18, 18], 'n = len(coeffs)'),
        block('init', 'let p be c[⟨?init⟩]', [19, 19], 'np.full_like'),
        block('loop', 'for each k from n-2 down to 0:', [20, 20], 'for k in range(n - 2'),
        block('upd', 'let p be p * (t - xn[k]) + c[k]', [21, 21], 'result = result *'),
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
        'init': {'kind': 'index', 'answer': 'n-1', 'env': ['n'], 'width': 6},
    },

    'distractors': [
        decoy('d_fwd', 'for each k from 1 to n-1:', 'loop', 'sweep_forward'),
        decoy('d_node', 'let p be p * (t - c[k]) + c[k]', 'upd', 'shift_by_coeff'),
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
            'text': 'The Python evaluates a whole array of query points at once. np.full_like is the vectorized twin of "let p be c[n-1]", and the update line runs on every point simultaneously. It is the arithmetic you wrote, applied to many values of t at a time.',
        },
    ],

    'feedback': {
        'sweep_forward': "You're sweeping from k = 1 upward. The nesting is evaluated from the innermost bracket outward, and the innermost bracket holds c[n-1], so k has to run the other way.",
        'shift_by_coeff': "You subtracted a coefficient from t. Every factor in Newton's form looks like (t - x_k), measuring how far t sits from a node, so what gets subtracted has to be a node.",
        'init_first': 'c[0] is the outermost coefficient and gets added last. The loop runs downward from k = n-2, so p has to start at whatever sits in the innermost bracket.',
        'init_past_end': "There's no coefficient at that index. There are n of them and the subscripts start at 0, so the last one is c[n-1].",
    },
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# The lab page carries the gates and nothing else. Every other cell stays in the
# notebook, which is what the student opens once the gates are done. The concept
# check hangs off cell 5, the cell that produces the table it asks about, which
# also puts it between the two puzzles where it belongs.

CELLS = {
    3: DIVDIFF,
    5: DDCHECK,
    7: NEWEVAL,
}

NOTEBOOK_LAB = {
    'lab_id': 'lab1-newton',
    'order': 1,
    'title': 'Newton form and divided differences',
    'blurb': 'Build the divided-difference table, then the nested evaluation that uses it.',
    'series': ['lab1-newton', 'lab2-runge', 'lab3-splines'],
    'colab_path': 'na/newton_divided_differences.ipynb',
    'intro': (
        "Through $n$ points with distinct $x$ values there's exactly one "
        'polynomial of degree less than $n$. Finding it is one thing; computing '
        'with it is another. These three steps build the machinery and then ask '
        'what it means: the coefficients first, then three questions about the '
        'table they come out of, then a cheap way to evaluate the polynomial at '
        'a point.\n\n'
        "We'll work throughout with the same four points,\n\n"
        r'$$x = 0,\; 1,\; 3,\; 6 \qquad y = 1,\; 4,\; 2,\; 8,$$' '\n\n'
        "so the polynomial we're after is a cubic. Any output you see on this "
        'page came from running these algorithms on those four points.\n\n'
        'The first and last hand you the steps of an algorithm in scrambled '
        'order. Drag them into the workspace, set the indentation, and check '
        'your answer. Indentation counts as much as order, since a step one '
        'level in runs once for every pass of the loop above it. The middle one '
        'asks three multiple-choice questions about the mathematics rather than '
        'the code, and answers them together. The notebook opens once all three '
        'are done.\n\n'
        'The steps are pseudocode rather than Python, and each one is a sentence '
        'you can read out loud. `let` stores a value, and `for`, `if`, `else`, '
        '`while` and `return` do what they do in code. Subscripts start at 0, '
        'and `from a to b` includes both $a$ and $b$. '
        '`*` multiplies, `!=` means "is not equal to" and `<=` means "is at '
        'most". Every symbol here is one you can type, so a blank takes '
        'exactly what you read. The key above the puzzles has the rest.'
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
    seeded = [p['cell_id'] for p in CELLS.values()]
    print(f'seeded {NOTEBOOK} with {len(seeded)} gates: {", ".join(seeded)}')


if __name__ == '__main__':
    main()
