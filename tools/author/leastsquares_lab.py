"""Seed the lab metadata into least_squares_orthogonal_polys.ipynb.

Same arrangement as newton_lab.py: the notebook is the source of truth once this
has run, and this file is the readable form of the seed. Running it again
overwrites the lab metadata and nothing else.

Run it with the labs venv active; its path differs per machine.

    python tools/author/leastsquares_lab.py

The lab follows Math 212 section 1.3: set the expectation (fit by solving the
normal equations, which is what everyone is taught), break it (the Gram matrix
is dense and forming it squares the condition number, so by degree 12 the two
routes disagree in the sixth digit), diagnose the cause (no two monomials are
orthogonal, so every coefficient is coupled to every other), give the fix as a
construction (Gram-Schmidt the basis, then the system falls apart into
independent divisions), then ask.

The two gates are the same fit computed twice. The first builds G and b and
calls solve. The second builds nothing and calls nothing: with an orthogonal
basis each coefficient is one quotient. That contrast is the lab, and it is why
the second gate's decoy is a `solve` that is no longer needed.

The demo data is five nodes at -1, -0.5, 0, 0.5, 1 with y = 2, 1, 3, 5, 9.
Gram-Schmidt on the monomials at those nodes gives exactly P0 = 1, P1 = x,
P2 = x^2 - 1/2, and a diagonal Gram matrix with entries 5, 2.5, 0.875, so every
number a student meets on the page is short enough to check by hand. The y
values were chosen so that no projection comes out zero: an earlier set had
<y, P2> = 0, which would have hidden a wrong denominator completely.

The second probe is four nodes at 0, 1, 3, 4 fitted by a line. It is asymmetric
and starts away from the origin, which is what catches an index transposed from
V[i][j] to V[j][i]: on a symmetric node set centred at 0 several of those slips
survive.

Note the pair of facts the notebook now prints side by side: the discrete
orthogonal basis at these nodes has P2 = x^2 - 1/2, while Legendre, orthogonal
under the integral inner product, has P2 = x^2 - 1/3. Same construction, two
inner products, two answers. The third concept-check question turns on it.

The notebook was restructured for this lab. `fit_normal` and `fit_orthogonal`
were written as explicit loops rather than matrix products so every pseudocode
step pairs with one Python line, Gram-Schmidt on the columns was added as given
code, and the conditioning demo now prints cond(V), cond(V^T V) and the gap
between the two routes in one table. `sympy` had to be added to the labs venv;
it was missing from the dependency list because no lab had been built from a
symbolic notebook before.

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/least_squares_orthogonal_polys.ipynb')

# Five nodes, the monomial design matrix there, and the orthogonal basis
# Gram-Schmidt produces from it. Written out as the doubles numpy produces, so
# the numbers the grader works with are the ones the setup prints.
V_DEMO = [[1.0, -1.0, 1.0],
          [1.0, -0.5, 0.25],
          [1.0, 0.0, 0.0],
          [1.0, 0.5, 0.25],
          [1.0, 1.0, 1.0]]
P_DEMO = [[1.0, -1.0, 0.5],
          [1.0, -0.5, -0.25],
          [1.0, 0.0, -0.5],
          [1.0, 0.5, -0.25],
          [1.0, 1.0, 0.5]]
Y_DEMO = [2.0, 1.0, 3.0, 5.0, 9.0]

# Four asymmetric nodes at 0, 1, 3, 4 fitted by a line.
V2 = [[1.0, 0.0], [1.0, 1.0], [1.0, 3.0], [1.0, 4.0]]
P2 = [[1.0, -2.0], [1.0, -1.0], [1.0, 1.0], [1.0, 2.0]]
Y2 = [1.0, 3.0, 2.0, 5.0]


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
# Gate 1: the normal equations
# ---------------------------------------------------------------------------

NORMAL = {
    'mode': 'gated',
    'cell_id': 'normaleq',
    'concept': 'normal_equations',
    'title': 'Form the normal equations',
    'setup': {
        'intro': (
            'Five data points, and the design matrix $V$ holding each monomial '
            '$1, x, x^2$ evaluated at each of them:'
        ),
        'code': (
            "print('x =', X_DEMO)\n"
            "print('y =', Y_DEMO)\n"
            "print('V =');  print(V_DEMO)\n"
            "print('\\nG = V^T V, the Gram matrix of the monomial basis:')\n"
            "print(V_DEMO.T @ V_DEMO)"
        ),
        'caption': (
            'Five points and three coefficients, so there is no polynomial '
            'through all of them and the best we can do is come close. Look at '
            '$G$: the entry in row $0$, column $2$ is $2.5$ rather than $0$, '
            'which says the constant function and $x^2$ overlap. Every '
            'off-diagonal entry that is not zero is one coefficient reaching '
            'into another, so the coefficients have to be found together '
            'rather than one at a time.'
        ),
    },
    'brief': r'''
Interpolation put the curve through every point. That is the wrong thing to ask of noisy data, since a curve forced through twenty-five noisy samples is mostly fitting the noise. So let's ask for less: fix a small family of functions, and find the member of it that comes closest.

Write the family as combinations of basis functions $\phi_0,\dots,\phi_m$, which for now are the monomials $1, x, \dots, x^m$. Collect the basis evaluated at the data into the **design matrix** $V$, with $V_{ij} = \phi_j(x_i)$, so that a coefficient vector $c$ produces the fitted values $Vc$. We want the $c$ that minimises

$$\|Vc - y\|_2^2 = \sum_i \Bigl(\sum_j V_{ij}c_j - y_i\Bigr)^2.$$

Differentiate with respect to each $c_j$ and set the result to zero. What comes out is a square system, the **normal equations**,

$$Gc = b, \qquad G_{jk} = \sum_i V_{ij}V_{ik} = \langle \phi_j, \phi_k\rangle, \qquad b_j = \sum_i V_{ij}y_i = \langle \phi_j, f\rangle.$$

$G$ is the **Gram matrix** of the basis: entry $jk$ is the inner product of basis function $j$ with basis function $k$, sampled at the data. It is symmetric, and it is dense whenever the basis functions overlap, which the monomials thoroughly do. The right-hand side is the same inner product taken against the data.

Geometrically this says the residual is orthogonal to everything we can build (why?): the closest point of a subspace is the one whose error has no component left inside it, and each equation of $Gc = b$ is that statement tested against one basis function.

Assemble it. Build $b$ and $G$ one entry at a time, then hand the system to `solve`. The two blanks are the summand of each.
''',

    'blocks': [
        block('def', 'function fit_normal, given V, y, the point count n and the degree m:', [9, 9], 'def fit_normal'),
        fused('alloc', [
            ('let G be a table of m+1 by m+1 zeros', 0),
            ('let b be a list of m+1 zeros', 0),
        ], [11, 12], 'G = np.zeros'),
        block('loopj', 'for each column j from 0 to m:', [13, 13], 'for j in range(m + 1)'),
        block('loopib', 'for each point i from 0 to n-1:', [14, 14], 'for i in range(n)'),
        block('bacc', 'let b[j] be b[j] + ⟨?rhs⟩', [15, 15], 'b[j] = b[j] +'),
        block('loopk', 'for each column k from 0 to m:', [16, 16], 'for k in range(m + 1)'),
        block('loopig', 'for each point i from 0 to n-1:', [17, 17], 'for i in range(n)'),
        block('gacc', 'let G[j][k] be G[j][k] + ⟨?prod⟩', [18, 18], 'G[j][k] = G[j][k] +'),
        block('ret', 'return solve(G, b)', [19, 19], 'return np.linalg.solve'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loopj', 'indent': 1},
        {'id': 'loopib', 'indent': 2},
        {'id': 'bacc', 'indent': 3},
        {'id': 'loopk', 'indent': 2},
        {'id': 'loopig', 'indent': 3},
        {'id': 'gacc', 'indent': 4},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'rhs': {'kind': 'expr', 'answer': 'V[i][j]*y[i]', 'env': ['V', 'y', 'i', 'j'], 'width': 14},
        'prod': {'kind': 'expr', 'answer': 'V[i][j]*V[i][k]', 'env': ['V', 'i', 'j', 'k'], 'width': 18},
    },

    'distractors': [
        decoy('d_over', 'let G[j][k] be V[i][j]*V[i][k]', 'gacc', 'gram_overwritten'),
        decoy('d_swap', 'return solve(b, G)', 'ret', 'solve_args_swapped'),
    ],

    'wrong_blanks': {
        'rhs': [
            {'text': 'V[i][j]*y[j]', 'why': 'rhs_wrong_index'},
            {'text': 'y[i]', 'why': 'rhs_no_basis'},
            {'text': 'V[j][i]*y[i]', 'why': 'rhs_transposed'},
        ],
        'prod': [
            {'text': 'V[i][j]*V[j][k]', 'why': 'prod_transposed'},
            {'text': 'V[i][j]', 'why': 'prod_one_factor'},
            {'text': 'V[i][k]*V[i][k]', 'why': 'prod_same_column'},
        ],
    },

    # The second probe is asymmetric and starts away from the origin, which is
    # what separates an index transposed from V[i][j] to V[j][i].
    'probes': [
        {'env': {'V': V_DEMO, 'y': Y_DEMO, 'n': 5, 'm': 2}, 'call': 'fit_normal(V, y, n, m)'},
        {'env': {'V': V2, 'y': Y2, 'n': 4, 'm': 1}, 'call': 'fit_normal(V, y, n, m)'},
    ],
    'trace': ['G'],
    'compare': 'value',

    'py_head': [1, 7],
    'py_doc': [10, 10],
    'py_glue': [21, 22, 23, 24],
    'annotations': [
        {
            'blocks': ['ret'],
            'text': 'solve here is Gaussian elimination with partial pivoting, the same thing np.linalg.solve does. The point of the next puzzle is that with the right basis there is nothing left for it to do.',
        },
        {
            'blocks': ['loopib', 'loopig'],
            'text': "The pseudocode says from 0 to n-1 and includes both ends, while Python's range(n) stops before n. Both run over all n data points.",
        },
    ],

    'feedback': {
        'gram_overwritten': 'Each pass throws away what the passes before it accumulated, so G[j][k] ends up holding the contribution of the last data point alone. An inner product is a sum over every point, so the entry has to carry the running total from one point to the next.',
        'solve_args_swapped': 'The arguments are the wrong way round. solve(G, b) reads as "solve G c = b", so the matrix comes first and the right-hand side second, and yours hands a list where the matrix belongs.',
        'rhs_wrong_index': "y is indexed by data point and j counts basis functions, so y[j] asks for the jth data value while the loop is standing at point i. On this data the two agree only by accident when i and j happen to coincide. Every term of b[j] pairs the basis value at a point with the data value at the same point.",
        'rhs_no_basis': 'That sums the data and forgets the basis function, so every entry of b comes out the same and the system stops knowing which coefficient is which. b[j] is an inner product: it weights each data value by the jth basis function evaluated at that point.',
        'rhs_transposed': 'The subscripts are the wrong way round. V has one row per data point and one column per basis function, so V[i][j] is basis function j at point i; V[j][i] asks for point j of basis function i, which on this data runs off the end of the matrix.',
        'prod_transposed': 'The second factor is transposed. Both factors are evaluated at the same data point i, one for column j and one for column k, so both carry i as their first subscript. Yours mixes a point index into the column position and the resulting G is not even symmetric.',
        'prod_one_factor': 'One factor is missing, so every column of G comes out identical and the matrix is singular; solve has nothing unique to return. The Gram entry is a product of two basis values, one from column j and one from column k.',
        'prod_same_column': 'Both factors come from column k, so every row of G is the same and the matrix is singular. Entry jk pairs basis function j with basis function k, one subscript from each; using k for both leaves no trace of j anywhere in the matrix.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: projection onto an orthogonal basis
# ---------------------------------------------------------------------------

ORTHO = {
    'mode': 'gated',
    'cell_id': 'project',
    'concept': 'orthogonal_projection',
    'title': 'Project onto an orthogonal basis',
    'setup': {
        'intro': (
            'Gram-Schmidt applied to the columns of $V$, and the Gram matrix of '
            'what comes out:'
        ),
        'code': (
            "print('the orthogonal basis at these five nodes:')\n"
            "print(P_DEMO)\n"
            "print('\\nas polynomials: P0 = 1,  P1 = x,  P2 = x^2 - 1/2')\n"
            "print('\\nits Gram matrix:')\n"
            "print(np.round(P_DEMO.T @ P_DEMO, 12))"
        ),
        'caption': (
            'Every off-diagonal entry is now zero, so no basis function overlaps '
            'any other and the three diagonal entries $5$, $2.5$ and $0.875$ are '
            'all that is left of $G$. The new basis spans exactly the same '
            'polynomials as $1, x, x^2$, so it can fit nothing the old one could '
            'not. What has changed is that the coefficients have stopped '
            'depending on each other.'
        ),
    },
    'brief': r'''
Let's look at what a diagonal $G$ does to $Gc = b$. Row $k$ reads $G_{kk}c_k = b_k$, with no other coefficient in it, so the system was never really a system: it is $m+1$ separate divisions, and each one can be done without knowing any of the others. Written out,

$$c_k = \frac{b_k}{G_{kk}} = \frac{\langle P_k, f\rangle}{\langle P_k, P_k\rangle}.$$

That is a projection, in the sense that the geometry has meant all along. Each coefficient measures how much of the data points along one basis direction, divided by how long that direction is, and orthogonality is exactly the condition that lets the measurements be taken independently.

Getting such a basis is Gram-Schmidt, which the cell above ran: take the monomials in order and, at each step, subtract from the newcomer its projection onto everything already orthogonalised. Nothing about the span changes, since we only ever subtract combinations of earlier basis functions, so the fitted polynomial at the end is the same one. Only its coordinates are different. Look at which numbers moved: the fit's $c_1$ is $3.6$ in both bases while $c_0$ goes from $2.571$ to $4$ (why?).

One warning before you build it. The basis above is orthogonal **at these five nodes**, under $\langle u,v\rangle = \sum_i u_iv_i$. Change the nodes and it stops being orthogonal. Change to the integral $\langle p,q\rangle = \int_{-1}^1 pq\,dx$ and Gram-Schmidt on the same monomials returns Legendre polynomials instead, whose quadratic is $x^2 - \tfrac13$ rather than $x^2 - \tfrac12$. There is no such thing as an orthogonal basis on its own; there is only a basis orthogonal under some inner product.

Assemble the projection. Note what is absent: no matrix is built and `solve` is never called. The two blanks are the second accumulator and the coefficient it feeds.
''',

    'blocks': [
        block('def', 'function fit_orthogonal, given P, y, the point count n and the degree m:', [8, 8], 'def fit_orthogonal'),
        block('alloc', 'let c be a list of m+1 zeros', [10, 10], 'c = np.zeros'),
        block('loopk', 'for each column k from 0 to m:', [11, 11], 'for k in range(m + 1)'),
        fused('init', [
            ('let num be 0', 0),
            ('let den be 0', 0),
        ], [12, 13], 'num = 0.0'),
        block('loopi', 'for each point i from 0 to n-1:', [14, 14], 'for i in range(n)'),
        block('numacc', 'let num be num + P[i][k]*y[i]', [15, 15], 'num = num +'),
        block('denacc', 'let den be den + ⟨?den⟩', [16, 16], 'den = den +'),
        block('ck', 'let c[k] be ⟨?ratio⟩', [17, 17], 'c[k] ='),
        block('ret', 'return c', [18, 18], 'return c'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loopk', 'indent': 1},
        {'id': 'init', 'indent': 2},
        {'id': 'loopi', 'indent': 2},
        {'id': 'numacc', 'indent': 3},
        {'id': 'denacc', 'indent': 3},
        {'id': 'ck', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'den': {'kind': 'expr', 'answer': 'P[i][k]*P[i][k]', 'env': ['P', 'y', 'i', 'k'], 'width': 18},
        'ratio': {'kind': 'expr', 'answer': 'num/den', 'env': ['num', 'den'], 'width': 10},
    },

    # d_solve is the decoy this lab exists for: a student who reaches for solve
    # here has not seen that the diagonal already did the work.
    'distractors': [
        decoy('d_over', 'let num be P[i][k]*y[i]', 'numacc', 'num_overwritten'),
        decoy('d_solve', 'return solve(P, y)', 'ret', 'solve_not_needed'),
    ],

    'wrong_blanks': {
        'den': [
            {'text': 'P[i][k]', 'why': 'den_not_squared'},
            {'text': 'P[i][k]*y[i]', 'why': 'den_is_numerator'},
            {'text': 'y[i]*y[i]', 'why': 'den_uses_data'},
        ],
        'ratio': [
            {'text': 'den/num', 'why': 'ratio_upside_down'},
            {'text': 'num', 'why': 'ratio_unnormalised'},
            {'text': 'num*den', 'why': 'ratio_multiplied'},
        ],
    },

    'probes': [
        {'env': {'P': P_DEMO, 'y': Y_DEMO, 'n': 5, 'm': 2}, 'call': 'fit_orthogonal(P, y, n, m)'},
        {'env': {'P': P2, 'y': Y2, 'n': 4, 'm': 1}, 'call': 'fit_orthogonal(P, y, n, m)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 6],
    'py_doc': [9, 9],
    'py_glue': [20, 21, 22, 23, 24, 25],
    'annotations': [
        {
            'blocks': ['init'],
            'text': 'Both accumulators are reset inside the k loop, once per coefficient. A pair of sums that carried over from one column to the next would be adding up inner products belonging to different basis functions.',
        },
    ],

    'feedback': {
        'num_overwritten': 'Each pass overwrites the last, so num finishes holding the contribution of the final data point rather than the sum over all of them. An inner product accumulates across every point, which is what the running total in the line above the fault does correctly.',
        'solve_not_needed': "There is no system here to solve, and no matrix either: P is the basis sampled at the data, not a square coefficient matrix, so solve refuses it. That refusal is the point of this puzzle. A diagonal Gram matrix has already reduced the normal equations to one division per coefficient, which is the loop you have just written.",
        'den_not_squared': "That sums the basis values rather than their squares, and for this basis the sum comes out zero for P1 and P2, so the division fails outright. The denominator is the inner product of P_k with itself, which is a sum of squares and so can only vanish if the basis function is identically zero at every data point.",
        'den_is_numerator': 'Both accumulators now compute the same thing, so every coefficient comes out as 1. The numerator pairs the basis function with the data; the denominator pairs the basis function with itself, and the ratio is what turns a raw overlap into a coordinate.',
        'den_uses_data': 'The denominator has to describe the basis function, not the data. Yours divides every coefficient by the same number, the squared length of y, so the three coefficients keep their relative sizes and all come out on the wrong scale. Each c_k is divided by the squared length of its own basis direction.',
        'ratio_upside_down': 'The quotient is inverted. c_k is how much of the data lies along P_k, measured in units of P_k, so the overlap with the data is on top and the basis function’s own squared length underneath.',
        'ratio_unnormalised': 'That is the raw inner product, not the coefficient. It grows if you scale P_k up, which a coordinate must not do: doubling a basis function has to halve its coefficient, and the division by the squared length is what arranges that.',
        'ratio_multiplied': 'Multiplying makes the coefficient grow when the basis function does, which is backwards, and it has the wrong units besides. Scale P_k up by a factor of two and its coordinate has to halve; only the quotient does that.',
    },
}

# ---------------------------------------------------------------------------
# Gate 3: the concept check
# ---------------------------------------------------------------------------
#
# Hangs off the conditioning cell, whose table the first question quotes. The
# third question is about the thing the two gates most easily leave implicit:
# orthogonality is a property of a basis together with an inner product, and
# the notebook prints two different answers from the same Gram-Schmidt to make
# that concrete.


def option(oid, text, why):
    return {'id': oid, 'text': text, 'why': why}


LSCHECK = {
    'mode': 'quiz',
    'cell_id': 'lscheck',
    'concept': 'least_squares_conditioning',
    'title': 'What the basis costs you',
    'brief': r'''
Both routes are built, so let's ask what separates them. The table above fits the same twenty-five noisy points at rising degree, and reports the condition number of $V$, the condition number of $G = V^{\top}V$, and how far the normal-equations answer has drifted from the QR answer.

Pick one answer for each. A wrong pick tells you what it got wrong rather than what the answer is.
''',

    'questions': [
        {
            'id': 'squaring',
            'stem': r'''
At degree $9$ the table reports $\operatorname{cond}(V) = 1.243\times10^{3}$ and $\operatorname{cond}(V^{\top}V) = 1.546\times10^{6}$, and $1.243\times10^{3}$ squared is $1.546\times10^{6}$ exactly. Why does forming the normal equations matter?
''',
            'answer': 'squares',
            'options': [
                option(
                    'squares',
                    r'$\operatorname{cond}(V^{\top}V) = \operatorname{cond}(V)^2$, so the solve starts from a matrix carrying twice the error sensitivity, and roughly half the available digits are gone before it begins.',
                    r'''
The singular values of $V^{\top}V$ are the squares of those of $V$, so the ratio of largest to smallest squares too. In round terms you lose $\log_{10}\operatorname{cond}(V)$ digits solving with $V$ and twice that solving with $V^{\top}V$: at degree $12$, $\operatorname{cond}(V) \approx 2\times10^{4}$ costs about four digits, while $\operatorname{cond}(V^{\top}V) \approx 4\times10^{8}$ costs about eight, and double precision only has sixteen to give.

That is what the last column is watching. The two routes agree to $10^{-15}$ at degree $3$ and to only $5\times10^{-4}$ at degree $15$, and it is the normal-equations answer that has moved. QR factorises $V$ itself and never forms the square, which is why libraries solve least squares that way.
''',
                ),
                option(
                    'illposed',
                    r'The least-squares problem itself becomes ill-posed at high degree, so no method could do better.',
                    r'''
The problem is not what degrades; the route to it is. QR solves the same problem on the same data at the same degree and stays accurate, which it could not do if the problem itself had gone bad. The table separates the two precisely so this is visible: one column is a property of $V$, and the drift in the last column belongs to the method that squares it.
''',
                ),
                option(
                    'noise',
                    r'The data carries $0.15$ of noise, and squaring the matrix amplifies that noise.',
                    r'''
The noise is fixed across the whole table, and both routes see exactly the same noisy $y$. What changes down the rows is the degree and therefore the conditioning of $V$. The gap in the last column is between two answers to the same noisy problem, so it measures arithmetic loss rather than anything about the data. The same growth appears on noiseless data.
''',
                ),
                option(
                    'size',
                    r'$V^{\top}V$ is smaller than $V$, and information is lost in the reduction from $25$ rows to $10$.',
                    r'''
$V^{\top}V$ is smaller, and it isn't lossy in the way that suggests: it retains everything the least-squares solution depends on, which is why the normal equations give the right answer in exact arithmetic at every degree in the table. What the reduction costs is conditioning, not information, and the two are different complaints.
''',
                ),
            ],
        },
        {
            'id': 'decouple',
            'stem': r'''
The second puzzle solved the same fitting problem with no matrix and no call to `solve`. What made that possible?
''',
            'answer': 'diagonal',
            'options': [
                option(
                    'diagonal',
                    r'Orthogonality makes $G$ diagonal, so row $k$ of $Gc = b$ reads $G_{kk}c_k = b_k$ and involves no other coefficient.',
                    r'''
A linear system is only genuinely a system because its equations share unknowns. Every off-diagonal entry $G_{jk}$ is one coefficient reaching into another, and it equals $\langle \phi_j,\phi_k\rangle$, so it vanishes exactly when the two basis functions are orthogonal. Kill every off-diagonal entry and the coupling goes with it, leaving $m+1$ independent divisions.

The setup output makes it concrete: the monomial Gram matrix has $G_{02} = 2.5$, and after Gram-Schmidt the largest off-diagonal entry anywhere is $2\times10^{-15}$, which is zero as far as the arithmetic is concerned.
''',
                ),
                option(
                    'better',
                    r'The orthogonal basis fits the data better, so it needs fewer coefficients.',
                    r'''
It fits exactly as well, and that is worth being clear about. Gram-Schmidt only ever subtracts combinations of earlier basis functions, so the span is untouched and both bases can express precisely the same polynomials. The notebook checks it: the two routes produce different coefficients and the same fitted curve. What changed is the coordinates, not the curve.
''',
                ),
                option(
                    'smaller',
                    r'The orthogonal basis functions are smaller, so the arithmetic is better behaved.',
                    r'''
Size is not the property at work, and it isn't even fixed: scaling any $P_k$ up or down changes nothing, because the division by $\langle P_k,P_k\rangle$ cancels the scale out of the coefficient exactly. Orthogonality is about the angle between basis functions rather than their length, which is why an orthogonal basis need not be normalised to decouple the system.
''',
                ),
                option(
                    'square',
                    r'$P$ is square, so the system can be solved by back substitution rather than elimination.',
                    r'''
$P$ has the same shape as $V$, five rows by three columns here, so it isn't square and no substitution applies to it. It is the Gram matrix $G$ that is square, and in the orthogonal basis it is diagonal, which is one step past triangular: there is nothing to substitute back into, only a division per row.
''',
                ),
            ],
        },
        {
            'id': 'whichinner',
            'stem': r'''
Gram-Schmidt on $1, x, x^2$ gave $P_2 = x^2 - \tfrac12$ at the five nodes, while the notebook's symbolic section runs the same construction and gets the Legendre polynomial $x^2 - \tfrac13$. Both are correct. What accounts for the difference?
''',
            'answer': 'innerproduct',
            'options': [
                option(
                    'innerproduct',
                    r'They are orthogonal under different inner products: a sum over five nodes in one case, an integral over $[-1,1]$ in the other.',
                    r'''
Orthogonality is not a property a basis has by itself. It is a property of a basis together with an inner product, and "orthogonal polynomials" is always shorthand for orthogonal under a stated one. Gram-Schmidt is the same algorithm in both places; only $\langle\cdot,\cdot\rangle$ changed, and the output changed with it.

You can see which one produced $\tfrac12$: it is $\langle x^2,1\rangle/\langle 1,1\rangle$, and with five nodes at $-1,-\tfrac12,0,\tfrac12,1$ that is $2.5/5$. The integral gives $\int_{-1}^{1}x^2dx / \int_{-1}^{1}1\,dx = \tfrac{2}{3}/2 = \tfrac13$. Move the nodes and the discrete answer moves again.
''',
                ),
                option(
                    'roundoff',
                    r'The discrete computation is in floating point and the symbolic one is exact, so $\tfrac12$ is a rounded $\tfrac13$.',
                    r'''
$\tfrac12$ and $\tfrac13$ differ by $0.167$, which no rounding in double precision could produce from data of this size. The discrete value is also exactly representable and exactly computed here: $2.5/5$ is $\tfrac12$ to the last bit. Two exact answers to two different questions, rather than one answer computed twice.
''',
                ),
                option(
                    'ordering',
                    r'Gram-Schmidt depends on the order the monomials are processed, and the two runs used different orders.',
                    r'''
Both runs take $1, x, x^2$ in that order, and the order is fixed by the construction, since each step subtracts projections onto everything already done. Order does matter to Gram-Schmidt in general, and changing it would give a different basis, but it is held constant across these two runs and so cannot be what separates them.
''',
                ),
                option(
                    'normalisation',
                    r'The Legendre polynomials are normalised differently, and rescaling $x^2-\tfrac12$ gives $x^2-\tfrac13$.',
                    r'''
No scalar multiple of $x^2 - \tfrac12$ is $x^2 - \tfrac13$: matching the leading coefficient forces the multiplier to be $1$, and then the constants disagree. The two are genuinely different polynomials rather than one polynomial in two normalisations, and each is orthogonal to $1$ and to $x$ under its own inner product and not under the other.
''',
                ),
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# The two fitting routes carry the puzzles, and the concept check hangs off the
# conditioning table its first question quotes. The design matrix, Gram-Schmidt,
# the noisy-fit picture and the symbolic Legendre section stay in the notebook.

CELLS = {
    4: NORMAL,
    6: ORTHO,
    7: LSCHECK,
}

NOTEBOOK_LAB = {
    'lab_id': 'least-squares',
    'order': 5,
    'title': 'Least squares and orthogonal polynomials',
    'blurb': 'Fit noisy data by solving the normal equations, then watch the right basis dissolve the system into independent divisions.',
    'series': ['newton', 'runge', 'splines', 'adaptive-quadrature', 'least-squares'],
    'colab_path': 'na/least_squares_orthogonal_polys.ipynb',
    'intro': (
        'Interpolation forces a curve through every point, which is the wrong '
        'thing to ask of measurements that carry noise. Least squares asks for '
        'less and gets more: fix a small family of functions and find the '
        'member of it that comes closest, in the sense of the smallest total '
        'squared error.\n\n'
        'The coefficients that do it satisfy a square system called the normal '
        'equations, whose matrix collects the inner products of the basis '
        'functions with each other. Both puzzles here solve the same fitting '
        'problem, and the two differ in one respect only. With the monomials the '
        'matrix is dense and every coefficient is entangled with every other; '
        'with an orthogonal basis it is diagonal and each coefficient is one '
        'division that knows nothing about the rest. Three '
        'questions at the end ask what the first basis costs and what '
        'orthogonality actually means.\n\n'
        'The puzzles run on five points,\n\n'
        r'$$x = -1,\; -\tfrac12,\; 0,\; \tfrac12,\; 1 \qquad '
        r'y = 2,\; 1,\; 3,\; 5,\; 9,$$'
        '\n\n'
        'fitted by a quadratic. Five points and three coefficients, so nothing '
        'passes through all of them and coming close is the best on offer. '
        'Orthogonalising the monomials at these particular nodes gives '
        '$P_0 = 1$, $P_1 = x$ and $P_2 = x^2 - \\tfrac12$, and every number '
        'you meet on this page is small enough to check by hand.\n\n'
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
        '`solve(A, b)` solves a square linear system, `V[i][j]` is row $i$ '
        'and column $j$ of a table. Subscripts start at 0, and `from a to b` '
        'includes both $a$ and $b$. `*` multiplies, `^` raises to a power, '
        '`!=` means "is not equal to" and `<=` means "is at most". Every '
        'symbol here is one you can type, so a blank takes exactly what you '
        'read. The key above the puzzles has the rest.'
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
