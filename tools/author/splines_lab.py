"""Seed the lab metadata into cubic_splines.ipynb.

Same arrangement as newton_lab.py: the notebook is the source of truth once this
has run, and this file is the readable form of the seed. Running it again
overwrites the lab metadata and nothing else.

Run it with the labs venv active; its path differs per machine.

    python tools/author/splines_lab.py

The lab follows Math 212 section 1.3: set the expectation (connect the dots),
break it (the corners), diagnose the cause (a jump in the first derivative),
give the fix as a construction (one cubic per panel, glued smooth), then ask.
The first gate's setup prints the slope jumps of the piecewise-linear
interpolant, because the right-hand side of the tridiagonal system is six times
exactly those numbers: the system arrives from the corner it exists to remove.

The demo data is the same four points as the Newton lab, x = 0, 1, 3, 6 and
y = 1, 4, 2, 8. The panel widths 1, 2, 3 are unequal on purpose: the swapped
off-diagonal, the swapped denominators and the uniform-grid diagonal 4h all
agree with the correct assembly when the widths tie, and these never tie.
The evaluation gate's probes sit away from every panel midpoint, because at a
midpoint a = b and swapping the two distances is invisible.

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them. The concept check has no Python behind it; the cell it hangs off
(the error-table cell) decides where it sits on the page.

Cell 7 was rewritten for this lab, the way runge rewrote its cells: the
vectorized np.searchsorted panel lookup became an explicit per-point scan, so
every pseudocode line pairs with its own Python line and the overshoot decoy
can swap one while line for another. The Python keeps a guard the pseudocode
drops (i < len(x) - 2, which serves an out-of-range query from the last panel),
and the annotation on the while block says so.

The interpreter raises on negative subscripts precisely so the loop-from-zero
decoy fails loudly on h[-1]; see the header of engine/lab/interp.js, which
names this puzzle.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/cubic_splines.ipynb')

# The four demo points and what follows from them. h = [1, 2, 3],
# panel slopes [3, -1, 2], jumps [-4, 3], so d = [0, -24, 18, 0] with the
# natural rows in place, and the moments below solve that system exactly
# (M_1 = -69/14, M_2 = 39/14). Written out as the doubles numpy produces, so
# the numbers the grader works with are the ones the setup prints.
DEMO_X = [0.0, 1.0, 3.0, 6.0]
DEMO_Y = [1.0, 4.0, 2.0, 8.0]
DEMO_M = [0.0, -4.928571428571428, 2.7857142857142856, 0.0]

# A second set for the assembly gate: five nodes, widths 0.5, 1, 0.5, 2, values
# with sign changes. A different node count exercises the loop bounds again,
# and the repeated width 0.5 in non-adjacent panels costs nothing because no
# two ADJACENT widths agree.
DATA2_X = [0.0, 0.5, 1.5, 2.0, 4.0]
DATA2_Y = [2.0, -1.0, 0.5, 3.0, 2.5]


def block(bid, text, py, match, indent=0):
    return {'id': bid, 'lines': [{'text': text, 'indent': indent}], 'py': py, 'py_match': match}


def fused(bid, texts_indents, py, match):
    return {
        'id': bid,
        'lines': [{'text': t, 'indent': k} for t, k in texts_indents],
        'py': py,
        'py_match': match,
    }


def decoy(bid, text, near, why):
    return {'id': bid, 'lines': [{'text': text, 'indent': 0}], 'near': near, 'why': why}


# ---------------------------------------------------------------------------
# Gate 1: the tridiagonal system
# ---------------------------------------------------------------------------

INTERIOR = {
    'mode': 'gated',
    'cell_id': 'splinesys',
    'concept': 'spline_system',
    'title': 'Assemble the interior equations',
    'setup': {
        'intro': (
            'Four data points, the interpolant that connects them with '
            'straight segments, and the slope of each segment:'
        ),
        'code': (
            "x = np.array([0.0, 1.0, 3.0, 6.0]); y = np.array([1.0, 4.0, 2.0, 8.0])\n"
            "slopes = np.diff(y) / np.diff(x)\n"
            "print(\"slope on each panel:\", slopes)\n"
            "print(\"jump at the interior nodes:\", np.diff(slopes))\n"
            "xx = np.linspace(0.0, 6.0, 400)\n"
            "plt.figure(); plt.plot(xx, piecewise_linear(x, y, xx), \"g-\", lw=2); "
            "plt.plot(x, y, \"bo\", ms=6); plt.show()"
        ),
        'caption': (
            'There is a corner at each interior node: at $x = 1$ the slope '
            'drops from $3$ to $-1$, a jump of $-4$, and at $x = 3$ it climbs '
            'from $-1$ to $2$, a jump of $+3$. A corner is a jump in the '
            'first derivative, and more data only makes more corners. The '
            'cubic spline keeps the panels and spends its extra coefficients '
            "making $s'$ and $s''$ continuous where the pieces meet."
        ),
    },
    'brief': r'''
Connecting the dots was already an interpolant, and not a bad one: it's local, it's cheap, and it converges as the data fills in. Its one flaw is on display above, and no amount of data removes the corners.

So let's keep the panels and upgrade the pieces. Ask for a cubic on each panel, glued so that the function, the first derivative and the second derivative all continue across every interior node. A curve pieced together this way is a **spline**, after the draftsman's tool: a thin elastic ruler, pinned down at a row of points and left to relax between them. The Romanian mathematician Isaac Jacob Schoenberg is credited with turning it into mathematics in 1946.

Count what we're asking for. With $n+1$ nodes there are $n$ panels, and a cubic on each is $4n$ coefficients to choose. Matching the data at both ends of every panel is $2n$ conditions, and continuity of $s'$ and of $s''$ at the $n-1$ interior nodes adds $2(n-1)$ more. That's $4n-2$, two short, and the two that close the count are the boundary conditions, whose price is this page's last question.

The unknowns that make this tractable were chosen well before the computer: take $M_i = s''(x_i)$, the curvature of the spline at each node. The classical name is **moments**. On one panel $s$ is a cubic, so $s''$ is a straight line (why?), and a straight line on $[x_i, x_{i+1}]$ is pinned by its end values $M_i$ and $M_{i+1}$. Integrate twice and the panel's cubic is recovered up to two constants, which the panel's two data conditions fix. So the moments determine the whole spline, continuity of $s''$ holds because neighbouring panels share the $M$ at their common node, and the data is matched by construction. Exactly one family of conditions is left standing: continuity of $s'$.

Write $h_i = x_{i+1} - x_i$ for the width of panel $i$. Impose the remaining condition at interior node $i$ and out comes, after algebra we won't reproduce here,

$$h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)\,M_i + h_i M_{i+1} \;=\; 6\left(\frac{y_{i+1}-y_i}{h_i} - \frac{y_i-y_{i-1}}{h_{i-1}}\right).$$

Read the right side against the setup: it's six times the jump in slope at node $i$, the size of the corner that connecting the dots would have kept. The left side weighs the three nearest curvatures, each moment by the width of the panel it acts across, and $M_i$ is counted from both of its sides. The equation asks the spline to bend, in total, by enough to swallow the corner.

One equation per interior node gives $n-1$ equations for $n+1$ moments, and each row touches only its three neighbours, so the matrix is tridiagonal and the system solves in $\mathcal{O}(n)$ once the two boundary rows arrive.

Assemble the loop that builds $A$ and $d$. Rows $0$ and $n$ stay zero on purpose; they aren't yours to fill. Two expressions are blank: the diagonal entry, and the jump inside the $6(\cdot)$.
''',

    'blocks': [
        block('def', 'function spline_interior_equations, given nodes x and values y:', [9, 9], 'def spline_interior_equations'),
        fused('n', [
            ('let m be the number of entries in x', 0),
            ('let n be m - 1', 0),
        ], [26, 26], 'n = len(x) - 1'),
        fused('h', [
            ('let h be a list of n zeros', 0),
            ('for each panel i from 0 to n-1:', 0),
            ('let h[i] be x[i+1] - x[i]', 1),
        ], [27, 27], 'h = np.diff(x)'),
        fused('alloc', [
            ('let A be a table of n+1 by n+1 zeros', 0),
            ('let d be a list of n+1 zeros', 0),
        ], [28, 29], 'A = np.zeros'),
        block('loop', 'for each interior node i from 1 to n-1:', [30, 30], 'for i in range(1, n)'),
        block('sub', 'let A[i][i-1] be h[i-1]', [31, 31], 'A[i, i - 1]'),
        block('diag', 'let A[i][i] be ⟨?diag⟩', [32, 32], 'A[i, i]'),
        block('sup', 'let A[i][i+1] be h[i]', [33, 33], 'A[i, i + 1]'),
        block('rhs', 'let d[i] be 6*(⟨?jump⟩)', [34, 34], 'd[i] = 6'),
        block('ret', 'return A and d', [35, 35], 'return A, d'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'n', 'indent': 1},
        {'id': 'h', 'indent': 1},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loop', 'indent': 1},
        {'id': 'sub', 'indent': 2},
        {'id': 'diag', 'indent': 2},
        {'id': 'sup', 'indent': 2},
        {'id': 'rhs', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'diag': {'kind': 'expr', 'answer': '2*(h[i-1] + h[i])', 'env': ['h', 'i'], 'width': 20},
        'jump': {
            'kind': 'expr',
            'answer': '(y[i+1] - y[i])/h[i] - (y[i] - y[i-1])/h[i-1]',
            'env': ['y', 'h', 'i'],
            'width': 46,
        },
    },

    # Two decoys, per the standing rule; the pressure goes into wrong_blanks.
    # The loop-from-zero decoy is the one the interpreter was built to catch:
    # negative subscripts raise precisely so h[-1] fails loudly.
    'distractors': [
        decoy('d_zero', 'for each interior node i from 0 to n-1:', 'loop', 'loop_at_zero'),
        decoy('d_sub', 'let A[i][i-1] be h[i]', 'sub', 'offdiag_swapped'),
    ],

    'wrong_blanks': {
        'diag': [
            {'text': 'h[i-1] + h[i]', 'why': 'diag_factor_two'},
            {'text': '4*h[i]', 'why': 'diag_uniform'},
        ],
        'jump': [
            {'text': '(y[i] - y[i-1])/h[i-1] - (y[i+1] - y[i])/h[i]', 'why': 'jump_backwards'},
            {'text': '(y[i+1] - y[i])/h[i-1] - (y[i] - y[i-1])/h[i]', 'why': 'jump_denominators_swapped'},
            {'text': '(y[i+1] - y[i-1])/(h[i-1] + h[i])', 'why': 'jump_central'},
            {'text': 'y[i+1] - y[i]/h[i] - (y[i] - y[i-1])/h[i-1]', 'why': 'jump_precedence'},
        ],
    },

    # Unequal widths on purpose, in both sets: 1, 2, 3 and 0.5, 1, 0.5, 2. The
    # off-diagonal swap, the denominator swap and 4h all coincide with the
    # correct assembly exactly when adjacent widths tie. The widths ride along
    # in each env because the blanks name h: matchWrongBlank samples a blank's
    # env names from the probe, and a name the probe lacks is sampled as a
    # scalar, which no h[i-1] survives.
    'probes': [
        {'env': {'x': DEMO_X, 'y': DEMO_Y, 'h': [1.0, 2.0, 3.0]}, 'call': 'spline_interior_equations(x, y)'},
        {'env': {'x': DATA2_X, 'y': DATA2_Y, 'h': [0.5, 1.0, 0.5, 2.0]}, 'call': 'spline_interior_equations(x, y)'},
    ],
    'trace': ['A'],
    'compare': 'value',

    'py_head': [1, 7],
    'py_doc': [10, 23],
    'py_glue': [24, 25],
    'annotations': [
        {
            'blocks': ['n'],
            'text': 'Two sentences where the Python has one: n = len(x) - 1 counts the entries and steps down in the same line. Either way n is the index of the last node, so the nodes run 0 to n and the panels 0 to n-1.',
        },
        {
            'blocks': ['h'],
            'text': 'np.diff computes every width in one call. The loop says what each one is: h[i] spans from x[i] to x[i+1], which is why there are n of them and none for the last node.',
        },
    ],

    'feedback': {
        'loop_at_zero': "Your loop starts the recurrence at i = 0, and the row for node 0 reaches for h[-1] and y[-1], the width and value of a panel to the left of the first node. There's no such panel: node 0 has only one neighbour, so the first equation continuity can write is at i = 1. Row 0 belongs to the boundary condition.",
        'offdiag_swapped': "You've weighted the left neighbour's moment by the right panel's width. M[i-1] acts on node i across the panel the two nodes share, which is the one from x[i-1] to x[i], of width h[i-1]. The widths here are 1, 2 and 3, so no two adjacent panels agree and the swap shows; on an equally spaced grid it wouldn't.",
        'diag_factor_two': "The setup printed the middle row of the four-point system as 1, 6, 2, and yours builds 1, 3, 2. The 6 is 2(h[0] + h[1]). The factor of two comes from continuity's bookkeeping: node i's own moment appears in the slope of both panels that meet there, once from each side, so it's weighted twice per panel width while each neighbour is felt across only the one panel it shares.",
        'diag_uniform': "2(h[i-1] + h[i]) collapses to 4h[i] only when the two panels tie, which is the equally spaced case the textbook tables are written for, and these widths are 1, 2 and 3. The general row has to name both panels, the same two whose widths divide the slopes on the right.",
        'jump_backwards': "Yours takes the earlier slope minus the later one, so every corner changes sign. Check it against the setup: at x = 1 the slope falls from 3 to -1, a jump of -4, and the equation wants d[1] = -24, a negative curvature to absorb a downward corner. With the subtraction reversed the spline bends upward at exactly the nodes where the data turns down.",
        'jump_denominators_swapped': "Each slope is divided by the other panel's width. A slope is rise over its own run: the panel from x[i] to x[i+1] rises y[i+1] - y[i] over h[i]. On this data the mix-up moves d[1] from -24 to -21, close enough to look plausible and wrong enough to move every moment.",
        'jump_central': "That's the slope of the chord from x[i-1] to x[i+1], one average slope across the double panel, and one slope can't measure a corner. The right side needs the difference of the two panel slopes: on data lying along a straight line, yours is nonzero while every true jump is 0.",
        'jump_precedence': 'In this notation / binds tighter than -, the same way it does in ordinary algebra, so what you typed divides single values rather than differences. Bracket each rise before dividing it by its run.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: evaluating the spline
# ---------------------------------------------------------------------------

EVAL = {
    'mode': 'gated',
    'cell_id': 'splineeval',
    'concept': 'spline_evaluation',
    'title': 'Evaluate the spline one panel at a time',
    'setup': {
        'intro': (
            'The same four points, their interior system, and the two '
            'boundary rows filled with the condition the notebook calls '
            '"natural", $M_0 = M_3 = 0$, then the solve:'
        ),
        'code': (
            "A, d = spline_interior_equations(x_demo, y_demo)\n"
            "apply_boundary(A, d, x_demo, y_demo, \"natural\")\n"
            "print(\"M =\", np.round(np.linalg.solve(A, d), 4))"
        ),
        'caption': (
            'Four curvatures, one per node, and the outer two are $0$ by '
            'decree rather than by computation. The solve is cheap, since a '
            'tridiagonal system row-reduces in $\\mathcal{O}(n)$. What we '
            "hold now is $s''$ at the nodes; what we want is $s(t)$ at every "
            '$t$ in between.'
        ),
    },
    'brief': r'''
The moments are numbers now, so let's collect what they promised: $s$ itself, anywhere between the nodes.

Fix a query point $t$ and let $i$ be the panel that holds it, so $x_i \le t \le x_{i+1}$. Two lengths locate $t$ inside its panel:

$$a = x_{i+1} - t, \qquad b = t - x_i,$$

the distances from $t$ to the right end and to the left end, with $a + b = h_i$.

Start from what the panel knows. $s''$ is the straight line through $M_i$ at the left end and $M_{i+1}$ at the right, which in these variables reads

$$s''(t) = \frac{M_i\,a + M_{i+1}\,b}{h_i}.$$

Check an end: at $t = x_i$ we have $a = h_i$ and $b = 0$, and the line hands back $M_i$. Look at which distance carries which moment. $a$, the distance to the right end, is the weight on the left end's value, and it has to be (why?): $a$ is the length still at full size when $t$ sits on the left node.

Integrate twice. The cubes arrive with a $6$ under them, and the two constants of integration form a straight line, which we can also write in $a$ and $b$. Choosing that line so that $s(x_i) = y_i$ and $s(x_{i+1}) = y_{i+1}$ gives the panel's finished formula:

$$s(t) = \frac{M_i a^3 + M_{i+1} b^3}{6h_i} + \left(\frac{y_i}{h_i} - \frac{M_i h_i}{6}\right) a + \left(\frac{y_{i+1}}{h_i} - \frac{M_{i+1} h_i}{6}\right) b.$$

Test it at $t = x_i$ the way we tested $s''$: with $b = 0$ both $b$ terms are gone, and the $a$ terms give $M_i h_i^2/6 + y_i - M_i h_i^2/6 = y_i$. The cubic term alone had the curvature right and the value wrong, and the linear terms settle the difference.

Arrange the steps that evaluate one query: find the panel by scanning, measure the two distances, and apply the formula. The distances are the blanks. The scan stops at the panel whose right node is the first one not below $t$, so a $t$ that lands exactly on a node is served by the panel to its left, and the formula doesn't mind which side serves a node (why?).
''',

    'blocks': [
        block('def', 'function cubic_spline_eval, given nodes x, values y, moments M and point t:', [4, 4], 'def cubic_spline_eval'),
        block('i0', 'let i be 0', [15, 15], 'i = 0'),
        block('wh', 'while x[i+1] < t:', [16, 16], 'while x[i + 1] < t'),
        block('inc', 'let i be i + 1', [17, 17], 'i = i + 1'),
        block('a', 'let a be ⟨?adist⟩', [18, 18], 'a = x[i + 1] - t'),
        block('b', 'let b be ⟨?bdist⟩', [19, 19], 'b = t - x[i]'),
        block('h', 'let h be x[i+1] - x[i]', [20, 20], 'h = x[i + 1] - x[i]'),
        block('formula', 'let s be (M[i]*a^3+M[i+1]*b^3)/(6*h) + (y[i]/h-M[i]*h/6)*a + (y[i+1]/h-M[i+1]*h/6)*b', [21, 23], 'out[k] ='),
        block('ret', 'return s', [24, 24], 'return out'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'i0', 'indent': 1},
        {'id': 'wh', 'indent': 1},
        {'id': 'inc', 'indent': 2},
        {'id': 'a', 'indent': 1},
        {'id': 'b', 'indent': 1},
        {'id': 'h', 'indent': 1},
        {'id': 'formula', 'indent': 1},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'adist': {'kind': 'expr', 'answer': 'x[i+1] - t', 'env': ['x', 'i', 't'], 'width': 12},
        'bdist': {'kind': 'expr', 'answer': 't - x[i]', 'env': ['x', 'i', 't'], 'width': 10},
    },

    'distractors': [
        decoy('d_wh', 'while x[i] < t:', 'wh', 'panel_overshoot'),
        decoy('d_cubic', 'let s be (M[i]*a^3+M[i+1]*b^3)/(6*h)', 'formula', 'constants_dropped'),
    ],

    'wrong_blanks': {
        'adist': [
            {'text': 't - x[i]', 'why': 'a_measures_left'},
            {'text': 't - x[i+1]', 'why': 'a_backwards'},
        ],
        'bdist': [
            {'text': 'x[i+1] - t', 'why': 'b_measures_right'},
            {'text': 'x[i] - t', 'why': 'b_backwards'},
        ],
    },

    # No probe sits at a panel midpoint, where a = b would make swapping the
    # two distances invisible. The midpoints are 0.5, 2.0 and 4.5; the probes
    # are 0.25, 1.5, 5.0 and the node 3.0, where the formula has to collapse
    # to the data value.
    'probes': [
        {'env': {'x': DEMO_X, 'y': DEMO_Y, 'M': DEMO_M, 't': 0.25}, 'call': 'cubic_spline_eval(x, y, M, t)'},
        {'env': {'x': DEMO_X, 'y': DEMO_Y, 'M': DEMO_M, 't': 1.5}, 'call': 'cubic_spline_eval(x, y, M, t)'},
        {'env': {'x': DEMO_X, 'y': DEMO_Y, 'M': DEMO_M, 't': 3.0}, 'call': 'cubic_spline_eval(x, y, M, t)'},
        {'env': {'x': DEMO_X, 'y': DEMO_Y, 'M': DEMO_M, 't': 5.0}, 'call': 'cubic_spline_eval(x, y, M, t)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 3],
    'py_doc': [5, 10],
    'py_glue': [11, 12, 13, 14],
    'annotations': [
        {
            'blocks': ['wh'],
            'text': "The Python while carries a second clause, i < len(x) - 2, which keeps a query beyond the last node inside the last panel. The pseudocode leaves it off because every query here lies inside the data.",
        },
        {
            'blocks': ['formula'],
            'text': 'The Python evaluates a whole array of query points, which is what the loop over k and the out[k] are for. It is the arithmetic you wrote, applied to one query at a time.',
        },
    ],

    'feedback': {
        'panel_overshoot': "Your scan walks until the panel's left node reaches t, which is one panel too far: for t = 0.25 it stops at i = 1 and measures b = t - x[1] = -0.75, a negative distance to a left end that sits to the right of t. Stop when the right node, x[i+1], is the first one not below t, and both distances come out between 0 and h.",
        'constants_dropped': 'The cubic term alone knows the curvatures and nothing else: at t = x[i] it returns M[i]*h^2/6, whatever the data says. Integrating s'' twice leaves two free constants on every panel, and the two linear terms are those constants, chosen so the panel passes through its own two data points. Without them the spline has the right bends in the wrong places.',
        'a_measures_left': "That's the distance to the left end, which is b's job. With both distances measured from the same end the formula loses its balance: at t = x[i] both would vanish and s would come out 0 rather than y[i]. a is measured to the right end exactly so that it's the length still standing when t sits on the left node.",
        'a_backwards': "Yours measures from the right end but runs the wrong way, so it's negative or zero across the whole panel. The cube keeps the sign and the linear term flips with it, and nothing cancels back. Both distances in this formula are lengths: each is at least 0, and together they add up to h.",
        'b_measures_right': "That's a, the distance to the right end. With the same expression in both blanks the two ends trade places wherever b appears: at t = x[i] you'd have b = h as well as a = h, and the formula hands back y[i] + y[i+1], both ends at once.",
        'b_backwards': "That's -b, negative across the whole panel. The odd powers keep the sign, so the M[i+1] and y[i+1] terms subtract where they should add, and the panel's right end pulls the spline the wrong way.",
    },
}

# ---------------------------------------------------------------------------
# Gate 3: the concept check
# ---------------------------------------------------------------------------
#
# Hangs off the error-table cell, which is the evidence the three questions
# interrogate. Each wrong option is a position a student can hold coherently
# after finishing both puzzles. The "natural sounds safe" trap is the one worth
# having: the name does the misleading all by itself.


def option(oid, text, why):
    return {'id': oid, 'text': text, 'why': why}


BCCHECK = {
    'mode': 'quiz',
    'cell_id': 'bccheck',
    'concept': 'boundary_conditions',
    'title': 'What the boundary condition costs',
    'brief': r'''
Both halves of the machine are built. What's left is the pair of rows the interior equations refused to write, and the notebook fills them in two ways: "natural", which sets $M_0 = M_n = 0$, and "clamped", which imposes the true end slopes $f'(x_0)$ and $f'(x_n)$ when someone can supply them. On a plot the two splines are hard to tell apart; both interpolate every data point and both look smooth. The difference shows up when you measure. For $f(x) = \cos(x)\,e^{-0.15x}$ sampled at $9$ points on $[0,10]$, the notebook's error table puts the largest error on the two end panels at $8.5\times 10^{-2}$ for natural against $4.7\times 10^{-3}$ for clamped, a factor of eighteen, while on the middle third of the interval the two sit at $4.7\times 10^{-3}$ and $4.1\times 10^{-3}$, nearly tied.

Answer the three questions below, which are about what that table means rather than about how any code works. A wrong pick tells you what it got wrong rather than what the answer is.
''',

    'questions': [
        {
            'id': 'natural',
            'stem': r'''
The word "natural" sounds like the safe default, and the natural spline needs no information beyond the data. Yet its end-panel error is eighteen times the clamped one's. What is the natural condition actually doing?
''',
            'answer': 'asserts',
            'options': [
                option(
                    'asserts',
                    r"It asserts something about $f$, namely $f''=0$ at the two endpoints, and for most functions that assertion is false.",
                    r'''
$M_0 = 0$ is not bookkeeping; it's data, a claimed value of $f''(x_0)$, and our $f$ has $f''(0) \ne 0$. The spline is interpolating one wrong pair of values, curvatures instead of heights, and the panels nearest the ends absorb most of the lie: eighteen times at the end panels shrinks to a near tie on the middle third.

The name is honest about the ruler, not about $f$. A draftsman's spline runs straight beyond the last pin, since past it there's nothing left to bend the ruler, so zero end curvature is exactly what the physical tool does. Whether it's what your function does is a separate question, and it usually isn't.
''',
                ),
                option(
                    'illcond',
                    r'The natural rows make the system ill-conditioned, and the end error is amplified noise from the solve.',
                    r'''
The matrix says otherwise. Every interior row has diagonal $2(h_{i-1}+h_i)$ against off-diagonal total $h_{i-1}+h_i$, and the natural rows are a lone $1$ on the diagonal, so the system is strictly diagonally dominant either way and the solve is as clean as solves get. Noise also wouldn't fall by a steady factor of $4$ at every doubling of the node count, and this error does.
''',
                ),
                option(
                    'stops_interp',
                    r'Near the ends the natural spline stops passing through the data points, and that gap is what the table measures.',
                    r'''
Both splines pass through every data point exactly. $s(x_0) = y_0$ is one of the $2n$ interpolation conditions built into the moment construction, and no boundary row touches it. What the natural rows override is a curvature, not a value, so the spline is wrong between the nodes while remaining right at them. That's also why the plot looks fine: your eye checks the nodes.
''',
                ),
                option(
                    'ends_only',
                    r'Only the two end panels are affected, because the boundary rows involve only $M_0$ and $M_n$.',
                    r'''
A tridiagonal system passes information along the whole chain: every moment depends on every row, so the false end curvatures move every $M_i$, not just the outer two. The table shows the middle third at $4.7\times 10^{-3}$ against the clamped $4.1\times 10^{-3}$: worse, just not much worse. The boundary error leaks inward and dies off with distance, which is different from stopping at the first node.
''',
                ),
            ],
        },
        {
            'id': 'rates',
            'stem': r'''
Now double the node count, repeatedly. The natural spline's end-panel error falls by a factor of about $4$ per doubling and its middle-third error by about $16$; the clamped spline's error falls by about $16$ everywhere. Doubling the count halves $h$, and an error behaving like $h^p$ falls by $2^p$ when $h$ halves. What are the convergence rates?
''',
            'answer': 'orders',
            'options': [
                option(
                    'orders',
                    r'Natural is second order at the ends and fourth order in the middle; clamped is fourth order everywhere.',
                    r'''
$4 = 2^2$ and $16 = 2^4$, so the factors are exponents in disguise. The false end curvature contributes an error of size $h^2$ concentrated near the boundary, while everything the interior equations control rides at $h^4$. And the exponent is what compounds: by $129$ nodes the two conditions sit at $2.9\times 10^{-4}$ against $8.3\times 10^{-8}$ on the end panels, a factor of several thousand out of the same data.
''',
                ),
                option(
                    'four_is_four',
                    r'A factor of $4$ per doubling means fourth order.',
                    r'''
The factor per doubling is $2^p$, not $p$. Read $4$ as $2^p$ and the exponent is $p = 2$: second order. A fourth-order error drops by $2^4 = 16$ when $h$ halves, which is what the clamped column does and the natural end panels don't.
''',
                ),
                option(
                    'no_conv',
                    r"The natural spline isn't converging at the ends at all.",
                    r'''
Not converging looks like errors that plateau or grow, the way the equispaced polynomial's do in the comparison further down the notebook. Here the end-panel error falls by four at every doubling, from $8.5\times 10^{-2}$ down to $2.9\times 10^{-4}$ and still falling. Slow convergence and no convergence differ by everything: one is a rate you can budget for, the other is a method you discard.
''',
                ),
                option(
                    'middle_secretly_2',
                    r"The natural spline's middle is really second order too; the table just hasn't refined far enough to show it.",
                    r'''
If the middle-third error carried any $h^2$ term, however small its coefficient, enough halvings would make that term the whole error and drag the observed factor down toward $4$. The factor sits at $16$ through $129$ nodes and isn't drifting. The second-order contamination decays sharply with distance from the boundary, so the middle keeps its fourth order honestly rather than provisionally.
''',
                ),
            ],
        },
        {
            'id': 'vspoly',
            'stem': r'''
The notebook's last experiment samples Runge's function $f(x) = 1/(1+25x^2)$ at $21$ equally spaced nodes and interpolates twice through the same points: the degree-$20$ polynomial misses $f$ by up to $59.8$, the natural cubic spline by $3.2\times 10^{-3}$. Adding nodes had been making the polynomial worse, and it makes the spline better. What's the difference?
''',
            'answer': 'degree_fixed',
            'options': [
                option(
                    'degree_fixed',
                    r'Refining the spline adds panels without raising the degree, so its error involves $f^{(4)}$ and $h^4$ forever; refining the polynomial raises the degree, and its error term is what blows up.',
                    r'''
Adding a node changes the polynomial's question: one more factor in $\omega$, one more derivative of $f$ in the numerator, and for this $f$ those derivatives grow like $(n+1)!\,5^{\,n+1}$. The spline never asks about more than the fourth derivative, however many nodes arrive, and $h^4 \max|f^{(4)}|$ per panel only shrinks as the panels narrow. Locality does the rest: each cubic takes its instructions from nearby data, so the ends can't poison the middle.
''',
                ),
                option(
                    'cheb_secret',
                    r'The spline succeeds for the same reason Chebyshev nodes do: its construction concentrates flexibility near the ends of the interval.',
                    r'''
Both rows of the experiment used the same $21$ equally spaced nodes, so node placement can't be what separates them. Chebyshev spacing is the fix that keeps a single polynomial through all the data viable; the spline takes the other exit and gives up on a single polynomial instead. Two different escapes from the same error formula, and this experiment only ran one of them.
''',
                ),
                option(
                    'unfair',
                    r'The comparison is rigged: the spline received extra information about $f$ through its boundary condition.',
                    r'''
The natural condition supplied $M_0 = M_n = 0$, and for this $f$ that is false information, since $f''(\pm 1) \ne 0$. The spline won by four orders of magnitude while carrying two wrong values it was never allowed to correct. Handing it the true end slopes instead (the clamped condition) would tighten the ends further, not level the contest.
''',
                ),
                option(
                    'roundoff_again',
                    r'Evaluating a degree-$20$ polynomial is numerically unstable, and the $59.8$ is mostly roundoff.',
                    r'''
The notebook evaluates each Lagrange basis polynomial as a short product of well-scaled factors, and $59.8$ is what the error formula predicts in exact arithmetic: the overshoot near the ends is a property of the interpolant, not of the arithmetic. Doubts about that are checked by the smooth, geometric way the error grows with the degree; roundoff doesn't behave like that.
''',
                ),
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# Gates on the assembly cell and the evaluation cell; the concept check hangs
# off the error-table cell, whose output its questions quote. The boundary
# cell (5) and the demos stay in the notebook.

CELLS = {
    4: INTERIOR,
    7: EVAL,
    11: BCCHECK,
}

NOTEBOOK_LAB = {
    'lab_id': 'splines',
    'order': 3,
    'title': 'Cubic splines and boundary conditions',
    'blurb': 'Pin down the curvatures with a tridiagonal system, evaluate panel by panel, then measure what the boundary condition costs.',
    'series': ['newton', 'runge', 'splines'],
    'colab_path': 'na/cubic_splines.ipynb',
    'intro': (
        'A single polynomial through all the data is one answer to '
        'interpolation, and its trouble grows with its degree. This page '
        'takes the other route: keep the degree at three and split the '
        'interval instead, one cubic per panel, glued smooth at the joints. '
        'The result is the cubic spline, and it is what most plotting '
        'software draws through your points.\n\n'
        "Two puzzles build it: the tridiagonal system that pins down the "
        "spline's curvatures at the nodes, and the panel-by-panel formula "
        'that turns those curvatures into values. Three questions at the end '
        'ask what the boundary condition, the one ingredient left free, '
        'actually costs.\n\n'
        "We'll work throughout with the four points\n\n"
        r'$$x = 0,\; 1,\; 3,\; 6 \qquad y = 1,\; 4,\; 2,\; 8,$$' '\n\n'
        'whose panel widths are 1, 2 and 3. Unequal on purpose: several '
        'wrong assemblies below agree with the right one exactly when '
        "adjacent panels tie, and these don't. Any output you see on this "
        'page came from these four points.\n\n'
        'Each of the first two hands you the steps of an algorithm in '
        'scrambled order. Drag them into the workspace, set the indentation, '
        'fill in the blanks, and check your answer. Indentation counts as much '
        'as order, since a step one level in runs once for every pass of the '
        'loop above it. The last one is multiple choice, about the mathematics '
        'rather than the code, and its three questions are answered together. '
        'The notebook opens once all three are done.\n\n'
        'The steps are pseudocode rather than Python, and each one is a '
        'sentence you can read out loud. `let` stores a value, and `for`, '
        '`if`, `else`, `while` and `return` do what they do in code. '
        'Subscripts start at 0, and `from a to b` includes both $a$ and $b$. '
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
