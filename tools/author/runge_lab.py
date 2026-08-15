"""Seed the lab metadata into interpolation_runge_chebyshev.ipynb.

Same arrangement as newton_lab.py: the notebook is the source of truth once this
has run, and this file is the readable form of the seed. Running it again
overwrites the lab metadata and nothing else.

    ~/.venvs/labs/bin/python tools/author/runge_lab.py

The lab follows Math 212 section 1.3: set the expectation, break it, name and
attribute the phenomenon, diagnose the cause, give the fix as a numbered
construction, then ask. The break is the first puzzle's setup figure, and the
construction reaches the closed form only at the end of that puzzle's brief,
because the picture is what raises the question the formula answers.

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them. Cells 5 and 7 were rewritten for this lab: chebyshev_nodes is the
loop it describes rather than three vectorized lines, and lagrange_eval takes
its length before allocating, so the Python lines pair with the pseudocode in
the order the reveal shows them.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/interpolation_runge_chebyshev.ipynb')

# Four equally spaced nodes on [-1, 1] and Runge's function there. Written out
# as the doubles np.linspace and 1/(1 + 25x^2) produce, so the numbers the
# grader works with are the ones the setup prints.
DATA_X = [-1.0, -0.33333333333333337, 0.33333333333333326, 1.0]
DATA_Y = [0.038461538461538464, 0.2647058823529412, 0.26470588235294124,
          0.038461538461538464]

# A second, deliberately lopsided set: four equally spaced nodes on [0, 1] with
# the same function. The set above is symmetric about 0, so its cubic term
# vanishes and the cubic through all four points is the same polynomial as the
# quadratic through the first three. That makes dropping the last node invisible,
# and a decoy that dropped it passed the grader on every probe until this set
# existed. The decoy is gone and this stays: any future block or blank that costs
# the algorithm its last node is graded against data where the last node matters.
DATA2_X = [0.0, 0.3333333333333333, 0.6666666666666666, 1.0]
DATA2_Y = [1.0, 0.2647058823529412, 0.08256880733944955, 0.038461538461538464]


def block(bid, text, py, match, indent=0):
    return {'id': bid, 'lines': [{'text': text, 'indent': indent}], 'py': py, 'py_match': match}


def decoy(bid, text, near, why):
    return {'id': bid, 'lines': [{'text': text, 'indent': 0}], 'near': near, 'why': why}


# ---------------------------------------------------------------------------
# Gate 1: where the nodes go
# ---------------------------------------------------------------------------

CHEBNODES = {
    'mode': 'gated',
    'cell_id': 'chebnodes',
    'concept': 'chebyshev_nodes',
    'title': 'Build the Chebyshev nodes',
    'setup': {
        'intro': (
            'You might expect a polynomial through more of the data to fit '
            'better than one through less of it. Here is Runge’s function '
            'interpolated at equally spaced nodes on $[-1,1]$ at three '
            'degrees, with the largest error anywhere on the interval beside '
            'each one, and then the degree-20 fit drawn out:'
        ),
        'code': (
            "for deg in (4, 12, 20):\n"
            "    print(f'degree {deg:2d}   nodes {deg + 1:2d}   "
            "max |f - p| = {max_error(runge, equispaced_nodes, deg):8.3f}')\n"
            "show_interpolation(degree=20, node_type='equispaced')"
        ),
        'caption': (
            'The degree-20 polynomial passes through all 21 nodes and misses '
            'the function by nearly 60 between them. Read the right-hand '
            'panel for where it misses: across the middle half of the '
            'interval the error stays under a fiftieth, in the second gap '
            'from the end it reaches four, and in the last gap it reaches 60. '
            'This is Runge’s phenomenon, after the German mathematician and '
            'physicist Carl David Tolmé Runge, who published it in 1901. It '
            'is not roundoff, it does not go away in exact arithmetic, and '
            'the only thing left to blame is where the nodes are.'
        ),
    },
    'brief': r'''
The error is no mystery. If $f$ has $n+1$ continuous derivatives on $[a,b]$, then interpolation at the nodes $x_0,\dots,x_n$ leaves

$$f(x) - p_n(x) = \frac{f^{(n+1)}(\xi)}{(n+1)!}\,\omega(x), \qquad \omega(x) = (x-x_0)(x-x_1)\cdots(x-x_n),$$

for some $\xi$ between the smallest and largest of $x, x_0, \dots, x_n$. The first factor belongs to $f$ and we can't do anything about it. The second one depends on nothing but where we put the nodes, and the nodes are ours to choose. For equally spaced nodes $|\omega|$ peaks near the two ends of the interval and is orders of magnitude smaller in the middle, and the gap between the two grows with $n$: at $n = 20$ it is a factor of about 7000. That is the same lopsidedness the figure above has. So let's put more nodes near the ends.

How many more, and where? A good answer came from the Russian mathematician Pafnuty Chebyshev (1821-1894), and it starts as a picture rather than a formula:

1. Draw a semicircle with the interval $[a,b]$ as its diameter.
2. Mark $n+2$ equally spaced points along the arc, both endpoints included, so the arc is cut into $n+1$ equal pieces.
3. Take the midpoint of each piece, which gives $n+1$ points on the arc.
4. Drop each one straight down onto the interval.

Equal steps along the arc come down as short steps where the arc is steep, so the nodes crowd towards $a$ and $b$ and thin out in the middle. That is the shape $\omega$ wanted.

Now turn the picture into arithmetic. Measure $\theta$ from the right-hand end of the interval, so the arc runs from $\theta = 0$ to $\theta = \pi$ and a point at angle $\theta$ on the unit semicircle over $[-1,1]$ sits above $u = \cos\theta$. Write the two blanks: the denominator that lands $\theta$ at the midpoint of the $k$th piece, given the $2k+1$ already sitting in the numerator, and the map that carries $u$ to the matching point of $[a,b]$. The map has to send $u = -1$ to $a$ and $u = 1$ to $b$.

The nodes come out running from near $b$ down to near $a$. Interpolation doesn't mind.
''',

    'blocks': [
        block('def', 'function chebyshev_nodes, given the ends a and b, and the degree n:', [4, 4], 'def chebyshev_nodes'),
        block('alloc', 'let x be a list of n+1 zeros', [16, 16], 'x = np.zeros'),
        block('loop', 'for each k from 0 to n:', [17, 17], 'for k in range'),
        block('theta', 'let θ be ((2·k + 1) / ⟨?frac⟩) · π', [18, 18], 'theta ='),
        block('proj', 'let u be cos(θ)', [19, 19], 'u = np.cos'),
        block('node', 'let x[k] be ⟨?map⟩', [20, 20], 'x[k] ='),
        block('ret', 'return x', [21, 21], 'return x'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loop', 'indent': 1},
        {'id': 'theta', 'indent': 2},
        {'id': 'proj', 'indent': 2},
        {'id': 'node', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'frac': {'kind': 'expr', 'answer': '2·(n+1)', 'env': ['n', 'k'], 'width': 10},
        'map': {'kind': 'expr', 'answer': '(a+b)/2 + ((b−a)/2)·u', 'env': ['a', 'b', 'u'], 'width': 24},
    },

    # Two decoys, which is where this started and where Dip wants it: seven
    # blocks and nine tiles on the board. A third was tried on 2026-08-14 and
    # taken back out, on the grounds that a longer tray is a reading task rather
    # than a harder puzzle. Where the pressure goes instead is `wrong_blanks`,
    # which cost nothing on the board.
    'distractors': [
        decoy('d_second', 'let θ be (k / n) · π', 'theta', 'angle_second_kind'),
        decoy('d_short', 'let x be a list of n zeros', 'alloc', 'count_off_by_one'),
    ],

    'wrong_blanks': {
        'frac': [
            {'text': 'n+1', 'why': 'frac_past_pi'},
            {'text': '2·n', 'why': 'frac_arc_count'},
            {'text': '2·n + 1', 'why': 'frac_odd_denominator'},
        ],
        'map': [
            {'text': '(b−a)·u', 'why': 'map_no_centre'},
            {'text': '((b−a)/2)·u', 'why': 'map_centred_on_zero'},
            {'text': '(a+b)/2 + (b−a)·u', 'why': 'map_full_width'},
        ],
    },

    # Two intervals on purpose. On [-1, 1] the affine map is the identity, so a
    # missing rescale can only be caught somewhere else.
    'probes': [
        {'env': {'a': -1.0, 'b': 1.0, 'n': 4}, 'call': 'chebyshev_nodes(a, b, n)'},
        {'env': {'a': 0.0, 'b': 4.0, 'n': 3}, 'call': 'chebyshev_nodes(a, b, n)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 3],
    'py_doc': [5, 15],
    'py_glue': [],
    'annotations': [
        {
            'blocks': ['loop'],
            'text': "The pseudocode says from 0 to n and includes both ends, while Python's range(n + 1) stops before n + 1. Both give k = 0, 1, ..., n, which is the n+1 nodes.",
        },
        {
            'blocks': ['node'],
            'text': 'The notebook multiplies by 0.5 twice instead of dividing by 2 twice. It is the same map.',
        },
    ],

    'feedback': {
        'angle_second_kind': 'Those angles divide the arc into n equal steps and include both of its ends, so your first and last nodes land exactly on b and a. The construction projects the midpoint of each piece, and a midpoint is never one of the points that cut the arc up. (Nodes that do include the endpoints are the Chebyshev nodes of the second kind, which are a good set of nodes and not the ones being built here.)',
        'count_off_by_one': 'There is nowhere to put the last node. A polynomial of degree n is pinned down by n+1 values, and the construction produces exactly that many: cutting the arc at n+2 marks leaves n+1 pieces, and every piece contributes a node.',
        'frac_past_pi': 'Your angles run past pi and on around the circle, so the later nodes come back through the interval a second time and land on top of the earlier ones. The arc is a semicircle, so the last midpoint has to sit just short of pi.',
        'frac_arc_count': 'You divided the arc into n pieces rather than n+1. Count the pieces again: the n+2 marks, both ends included, have n+1 gaps between them, and each gap holds one node.',
        'frac_odd_denominator': 'The denominator has to be twice the number of pieces, and 2n+1 is odd, so it is not twice anything. Yours sends the last angle to exactly pi, which puts the last node exactly on a, and the midpoint of a piece never lands on the end of the arc.',
        'map_no_centre': 'Your nodes are spread twice as wide as they should be, and nothing in your map mentions where the interval sits. Check the two ends of it: the map has to send u = -1 to a and u = +1 to b, and yours sends them to a-b and b-a instead.',
        'map_centred_on_zero': 'The length is right and the position is not. Your nodes are centred on 0 wherever [a, b] happens to lie, so both ends miss: u = -1 lands on (a-b)/2 rather than a, and u = +1 on (b-a)/2 rather than b.',
        'map_full_width': 'The centre is right and the width is twice what it should be, so the nodes nearest the ends fall outside the interval altogether. From the centre of [a, b] to either end is half its length.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: the interpolant itself
# ---------------------------------------------------------------------------

LAGEVAL = {
    'mode': 'gated',
    'cell_id': 'lageval',
    'concept': 'lagrange_form',
    'title': 'Build the interpolant in the Lagrange basis',
    'setup': {
        'intro': (
            'Node placement is settled. Here is the other half of the problem, '
            'four equally spaced nodes on $[-1,1]$ with Runge’s function '
            'sampled at each of them:'
        ),
        'code': (
            "data_x = equispaced_nodes(-1.0, 1.0, 3)\n"
            "print('nodes  x =', np.array2string(data_x, precision=4))\n"
            "print('values y =', np.array2string(runge(data_x), precision=4))"
        ),
        'caption': (
            'Four points, so the polynomial of degree 3 or less through them '
            'is unique. Nothing built so far will tell us what that '
            'polynomial is between the nodes, which is the only place the '
            'question is interesting.'
        ),
    },
    'brief': r'''
One route to that polynomial is to write $p(x) = c_0 + c_1x + c_2x^2 + c_3x^3$, substitute the four points and solve for the $c_k$. Let's not. If we choose the basis to suit the data, the coefficients turn out to be the data.

Ask for one polynomial per node, $L_0,\dots,L_n$, each of them equal to $1$ at its own node and $0$ at every other node. Then

$$p(x) = y_0L_0(x) + y_1L_1(x) + \cdots + y_nL_n(x)$$

interpolates: at $x_k$ every term but the $k$th is zero, and the term left standing is $y_k \cdot 1$. This is the Lagrange form, named for the Italian-French mathematician Joseph-Louis Lagrange, who published it in 1795, though Edward Waring had written it down in 1779.

So we need the $L_i$, and each one is a product built up one factor at a time. Two requirements decide the factors. $L_i$ has to vanish at the $n$ nodes other than $x_i$, and a factor can supply one of those roots. $L_i$ also has to equal $1$ at $x_i$, which fixes what each factor gets divided by. Count them and you get $n$ factors, so every $L_i$ has degree exactly $n$ and $p$ has degree at most $n$. It can come out lower: our four values are symmetric about $x = 0$, so the cubic term cancels and $p$ is really a quadratic.

Assemble the loops that build the sum at a single query point $t$. This algorithm is handed the data rather than a degree, so it counts what it was given: $m$ is the number of nodes, one more than the degree. Two expressions are blank: the condition on $j$ that decides which factors go into $L_i$, and the factor itself.
''',

    'blocks': [
        block('def', 'function lagrange_eval, given nodes xn, values yn and point t:', [4, 4], 'def lagrange_eval'),
        block('m', 'let m be the number of entries in xn', [17, 17], 'm = len(nodes)'),
        block('p0', 'let p be 0', [18, 18], 'result = np.zeros_like'),
        block('loopi', 'for each term i from 0 to m−1:', [19, 19], 'for i in range(m)'),
        block('L1', 'let L be 1', [20, 20], 'Li = np.ones_like'),
        block('loopj', 'for each node j from 0 to m−1:', [21, 21], 'for j in range(m)'),
        block('guard', 'if ⟨?guard⟩ then:', [22, 22], 'if j != i'),
        block('prod', 'let L be L · ⟨?factor⟩', [23, 23], 'Li = Li *'),
        block('add', 'let p be p + yn[i] · L', [24, 24], 'result = result +'),
        block('ret', 'return p', [25, 25], 'return result'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'm', 'indent': 1},
        {'id': 'p0', 'indent': 1},
        {'id': 'loopi', 'indent': 1},
        {'id': 'L1', 'indent': 2},
        {'id': 'loopj', 'indent': 2},
        {'id': 'guard', 'indent': 3},
        {'id': 'prod', 'indent': 4},
        {'id': 'add', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'guard': {'kind': 'cond', 'answer': 'j ≠ i', 'env': ['i', 'j'], 'width': 8},
        'factor': {
            'kind': 'expr',
            'answer': '(t − xn[j]) / (xn[i] − xn[j])',
            'env': ['t', 'xn', 'i', 'j'],
            'width': 32,
        },
    },

    # Three decoys, as originally, and thirteen tiles on the board is already the
    # most of any gate in the repo. Three more were tried on 2026-08-14 and taken
    # back out; see the note in HANDOFF.md, and note that one of them is what
    # found the degenerate probe set the fourth probe below now covers.
    'distractors': [
        decoy('d_last', 'let p be yn[i] · L', 'add', 'sum_overwritten'),
        decoy('d_zero', 'let L be 0', 'L1', 'product_starts_at_zero'),
        decoy('d_plus', 'let L be L + ⟨?factor⟩', 'prod', 'terms_added'),
    ],

    'wrong_blanks': {
        'guard': [
            {'text': 'j = i', 'why': 'guard_inverted'},
            {'text': 'j < i', 'why': 'guard_partial'},
        ],
        'factor': [
            {'text': '(t − xn[j]) / (xn[j] − xn[i])', 'why': 'factor_sign'},
            {'text': '(t − xn[i]) / (xn[j] − xn[i])', 'why': 'factor_roles_swapped'},
            {'text': '(t − xn[j])', 'why': 'factor_no_denominator'},
        ],
    },

    # Four nodes rather than five, and it matters: with an odd number of nodes
    # each L_i has an even number of factors, and flipping the sign of every
    # denominator then cancels out and cannot be caught. The third probe is a
    # node, where the answer has to be that node's own value. The fourth uses the
    # lopsided data set, because the first three cannot see a missing last node;
    # see the note on DATA2_X.
    'probes': [
        {'env': {'xn': DATA_X, 'yn': DATA_Y, 't': 0.9}, 'call': 'lagrange_eval(xn, yn, t)'},
        {'env': {'xn': DATA_X, 'yn': DATA_Y, 't': -0.55}, 'call': 'lagrange_eval(xn, yn, t)'},
        {'env': {'xn': DATA_X, 'yn': DATA_Y, 't': DATA_X[2]}, 'call': 'lagrange_eval(xn, yn, t)'},
        {'env': {'xn': DATA2_X, 'yn': DATA2_Y, 't': 0.9}, 'call': 'lagrange_eval(xn, yn, t)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 3],
    'py_doc': [5, 12],
    'py_glue': [13, 14, 15],
    'annotations': [
        {
            'blocks': ['p0', 'L1', 'prod'],
            'text': 'The Python evaluates a whole array of query points at once. np.zeros_like(xq) is "let p be 0" at every one of them, np.ones_like(xq) is "let L be 1", and the product line runs on all of them simultaneously. It is the arithmetic you wrote, applied to many values of t at a time.',
        },
        {
            'blocks': ['loopi', 'loopj'],
            'text': "The pseudocode says from 0 to m−1 and includes both ends, while Python's range(m) stops before m, so both run over all m nodes.",
        },
    ],

    'feedback': {
        'sum_overwritten': 'Each pass throws away what the passes before it worked out, so what comes back is the last term on its own. Every one of the n+1 terms belongs in the answer, so p has to carry the running total from one pass to the next.',
        'product_starts_at_zero': 'A product that starts at zero stays at zero, so all of your L_i came out zero and so did p. The product of no factors at all is 1, the same way the sum of no terms at all is 0.',
        'terms_added': 'L_i is the product of its factors, not the sum of them. A single factor going to zero has to take the whole of L_i to zero with it, and that is what a product does and a sum does not.',
        'guard_inverted': 'That keeps the one factor the product has to leave out and drops the rest. It also divides by x_i minus x_i, which is zero. Which node is the one L_i must not vanish at?',
        'guard_partial': 'Your product stops at j = i, so it leaves out every node after x_i and L_i comes out with degree i instead of n. The product runs over all the nodes but one.',
        'factor_sign': 'Every factor has the right size and the wrong sign. A factor is divided by its own value at t = x_i, so it comes out to 1 there. Put t = x_i into yours and you get -1.',
        'factor_roles_swapped': 'You have exchanged the roles of i and j. The factor that supplies the root at x_j has to vanish at t = x_j, and yours vanishes at t = x_i instead. That is the one node where L_i is not allowed to be zero.',
        'factor_no_denominator': 'Every root is in the right place, so your L_i does vanish at all the other nodes. Nothing has made it 1 at its own node, though: put its own node in and out comes the product of the gaps from that node to each of the others, which is no particular number. Divide each factor by its own value there and every one of them turns into 1 at that node.',
    },
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# The lab page carries the puzzles and nothing else. The plots of omega, the
# error sweep and the sliders stay in the notebook, which is what the student
# opens once the puzzles are done.

CELLS = {
    5: CHEBNODES,
    7: LAGEVAL,
}

NOTEBOOK_LAB = {
    'lab_id': 'lab1-runge',
    'order': 1,
    'title': "Runge's phenomenon and Chebyshev nodes",
    'blurb': 'Place the nodes where the error formula says they belong, then build the interpolant that shows the difference.',
    'series': ['lab1-runge', 'lab2-newton', 'lab3-splines'],
    'colab_path': 'na/interpolation_runge_chebyshev.ipynb',
    'intro': (
        'Adding more data points ought to improve a polynomial fit. It does '
        'not always: on equally spaced nodes the error for a perfectly smooth '
        'function can grow without bound as the degree goes up.\n\n'
        'These two puzzles build the pair of algorithms behind that story: '
        'where to put the interpolation nodes so the error stays under '
        'control, and how to write down the polynomial through them without '
        'solving for a single coefficient.\n\n'
        "We'll work throughout on $[-1,1]$ with Runge's function\n\n"
        r'$$f(x) = \frac{1}{1 + 25x^2},$$' '\n\n'
        'and every number and figure on this page was computed with the nodes '
        'equally spaced. The Chebyshev half of the comparison is in the '
        'notebook.\n\n'
        'Each puzzle hands you the steps of an algorithm in scrambled order. '
        'Drag them into the workspace, set the indentation, fill in the '
        'blanks, and check your answer. Indentation counts as much as order, '
        'since a step one level in runs once for every pass of the loop above '
        'it. The notebook opens once both puzzles are done.\n\n'
        'The steps are pseudocode rather than Python, and each one is a '
        'sentence you can read out loud. `let` stores a value, and `for`, '
        '`if`, `else`, `while` and `return` do what they do in code. '
        'Subscripts start at 0, and `from a to b` includes both $a$ and $b$. '
        'The key above the puzzles has the rest.'
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
