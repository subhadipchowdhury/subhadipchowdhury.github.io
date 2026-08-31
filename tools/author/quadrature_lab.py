"""Seed the lab metadata into quadrature_newton_cotes_adaptive.ipynb.

Same arrangement as newton_lab.py: the notebook is the source of truth once this
has run, and this file is the readable form of the seed. Running it again
overwrites the lab metadata and nothing else.

Run it with the labs venv active; its path differs per machine.

    python tools/author/quadrature_lab.py

The lab follows Math 212 section 1.3: set the expectation (one parabola per
interval, order 4), break it (on sqrt the observed order is 1.5, not 4),
diagnose the cause (99.6% of the error sits in the first sixteenth of the
interval, and a uniform rule refines all of it equally), give the fix as a
construction (compare one estimate against two halves and subdivide only where
they disagree), then ask.

The integrand is sqrt(x) throughout. It is the case where adaptivity genuinely
pays, and the notebook now measures that rather than asserting it: on a merely
peaked but smooth integrand adaptive Simpson costs about twice what a uniform
rule of the same accuracy costs, and the old claim in this notebook was wrong.
See the cells the concept check hangs off.

Two things the notation cannot do, both handled by annotation rather than
worked around:

- It cannot pass a function as an argument, so the pseudocode calls sqrt
  directly where the Python takes f. That is why the puzzles are written for
  one integrand and the Python stays general.
- A pseudocode block must pin to a Python line in its own cell, so the second
  gate spells each half-panel estimate out inline rather than calling
  simpson_panel, whose Python lives in the previous cell.

Cells 6 and 7 were split apart and rewritten for this lab so every pseudocode
step pairs with exactly one Python line. This is the first lab whose gates use
recursion and one function calling another; both were checked against
engine/lab/interp.js before authoring, along with `or` in a condition and a
blank inside a called function.

`maxSteps` is set to 25000 on the recursion gate. The reference needs 567 steps
at worst, and the cap makes the runaway decoy fail in a fraction of a second
rather than burning the default million.

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/quadrature_newton_cotes_adaptive.ipynb')

# One Simpson panel on [a, b] applied to sqrt. The probes below avoid a = 0 in
# two of three cases: at a = 0 the midpoint (a+b)/2 and the half-width (b-a)/2
# are the same number, so a probe anchored at the origin cannot tell a location
# from a length. [1,4] and [1,3] can.
PANEL_PROBES = ['simpson_panel(1, 4)', 'simpson_panel(0, 1)', 'simpson_panel(1, 3)']

# The whole-interval estimate each recursion starts from, written out so the
# probe carries the exact relationship rather than a rounded constant.
def _whole(a, b):
    return f'(({b}-{a})/6) * (sqrt({a}) + 4*sqrt(({a}+{b})/2) + sqrt({b}))'


def block(bid, text, py, match, indent=0):
    return {'id': bid, 'lines': [{'text': text, 'indent': indent}], 'py': py, 'py_match': match}


def decoy(bid, text, near, why):
    return {'id': bid, 'lines': [{'text': text, 'indent': 0}], 'near': near, 'why': why}


# ---------------------------------------------------------------------------
# Gate 1: one Simpson estimate
# ---------------------------------------------------------------------------

PANEL = {
    'mode': 'gated',
    'cell_id': 'simpsonpanel',
    'concept': 'simpson_rule',
    'title': 'Build one Simpson estimate',
    'setup': {
        'intro': (
            'Here is $\\sqrt{x}$ on $[0,1]$, and the parabola through its two '
            'ends and its midpoint:'
        ),
        'code': (
            "a, b = 0.0, 1.0\n"
            "nodes = np.array([a, 0.5*(a+b), b])\n"
            "coef = np.polyfit(nodes, np.sqrt(nodes), 2)\n"
            "xs = np.linspace(a, b, 400)\n"
            "plt.figure()\n"
            "plt.plot(xs, np.sqrt(xs), 'b-', lw=2, label='sqrt(x)')\n"
            "plt.plot(xs, np.polyval(coef, xs), 'r--', lw=2, label='the parabola')\n"
            "plt.plot(nodes, np.sqrt(nodes), 'ko', ms=7)\n"
            "plt.legend(); plt.xlabel('x'); plt.show()\n"
            "print(f'area under the parabola: {simpson_panel(f_root, a, b):.6f}')\n"
            "print(f'exact integral:          {2/3:.6f}')"
        ),
        'caption': (
            'The parabola agrees with $\\sqrt{x}$ at the three marked points '
            'and misses it in between, most visibly near the origin where the '
            'square root turns vertical. Integrating the parabola instead of '
            'the function gives $0.638071$ against the true $0.666667$, so '
            'this one estimate is already good to about four percent from '
            'three evaluations.'
        ),
    },
    'brief': r'''
We want $\int_a^b f$, and all we can do is evaluate $f$ at points of our choosing. So let's do the obvious thing: run a polynomial through a few of those values and integrate the polynomial instead, which is something we can do exactly. That single idea, an **interpolatory quadrature rule**, produces every rule on this page.

Take three points, the two ends and the midpoint $c = (a+b)/2$, and let $p$ be the parabola through them. In Lagrange form,

$$p(x) = f(a)L_a(x) + f(c)L_c(x) + f(b)L_b(x),$$

so integrating $p$ costs no more than integrating the three basis polynomials once and for all:

$$\int_a^b p = f(a)\!\int_a^b\! L_a + f(c)\!\int_a^b\! L_c + f(b)\!\int_a^b\! L_b.$$

The three integrals come out to $(b-a)/6$, $4(b-a)/6$ and $(b-a)/6$, which gives

$$\int_a^b f \;\approx\; \frac{b-a}{6}\Bigl(f(a) + 4f(c) + f(b)\Bigr).$$

This is **Simpson's rule**, named for the British mathematician Thomas Simpson (1710-1761), who published it in 1743, though Kepler had used the same formula more than a century earlier to gauge the volume of wine barrels.

Two things about those weights are worth having straight. They sum to $b-a$, which they must, since a rule that cannot integrate the constant function $1$ correctly is not worth writing down. And the middle point carries four times the weight of either end, which is why the rule is so much better than it looks: fitting a parabola should buy exactness for polynomials up to degree $2$, but Simpson's rule integrates every cubic exactly as well. The cubic term is antisymmetric about the midpoint, so what it adds on one side it removes on the other (why?). That free extra degree is where the order-$4$ convergence comes from.

Assemble the rule. The two blanks are the midpoint and the weight the middle value carries.
''',

    'blocks': [
        block('def', 'function simpson_panel, given the ends a and b:', [8, 8], 'def simpson_panel'),
        block('mid', 'let c be ⟨?mid⟩', [10, 10], 'c = (a + b)'),
        block('h', 'let h be b - a', [11, 11], 'h = b - a'),
        block('weighted', 'let weighted be sqrt(a) + ⟨?four⟩*sqrt(c) + sqrt(b)', [12, 12], 'weighted ='),
        block('ret', 'return h * weighted / 6', [13, 13], 'return h * weighted'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'mid', 'indent': 1},
        {'id': 'h', 'indent': 1},
        {'id': 'weighted', 'indent': 1},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'mid': {'kind': 'expr', 'answer': '(a+b)/2', 'env': ['a', 'b'], 'width': 12},
        'four': {'kind': 'expr', 'answer': '4', 'env': ['a', 'b', 'c'], 'width': 6},
    },

    # Two decoys, both versions of the same confusion: the h in the textbook's
    # h/3 form is the half-width, and the h here is the whole width.
    'distractors': [
        decoy('d_halfh', 'let h be (b - a)/2', 'h', 'h_is_half_width'),
        decoy('d_div3', 'return h * weighted / 3', 'ret', 'divided_by_three'),
    ],

    'wrong_blanks': {
        'mid': [
            {'text': '(b-a)/2', 'why': 'mid_is_a_length'},
            {'text': 'a+b/2', 'why': 'mid_precedence'},
        ],
        'four': [
            {'text': '2', 'why': 'weight_two'},
            {'text': '1', 'why': 'weight_one'},
            {'text': '6', 'why': 'weight_six'},
        ],
    },

    'probes': [
        {'env': {}, 'call': PANEL_PROBES[0]},
        {'env': {}, 'call': PANEL_PROBES[1]},
        {'env': {}, 'call': PANEL_PROBES[2]},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 6],
    'py_doc': [9, 9],
    'py_glue': [15, 16, 17, 19, 20, 21, 22],
    'annotations': [
        {
            'blocks': ['weighted'],
            'text': 'The Python takes the integrand as an argument, so one function serves every integral. The notation has no way to pass a function, so the pseudocode calls sqrt directly. Everything else about the two is the same arithmetic.',
        },
        {
            'blocks': ['ret'],
            'text': 'Textbooks usually write this as (h/3)(f(a) + 4f(c) + f(b)) with h the half-width (b-a)/2. Put that h in and the two forms agree: (b-a)/2 divided by 3 is (b-a)/6.',
        },
    ],

    'feedback': {
        'h_is_half_width': "That is the half-width, the h of the textbook's (h/3) form, and this line divides by 6 rather than 3. Halving twice over, the estimate comes out at half what it should be: on [0,1] you get 0.319036 where the parabola's area is 0.638071. Pick one convention and let the divisor match it.",
        'divided_by_three': 'Dividing the whole width by 3 makes the weights sum to 2(b-a) rather than b-a, so your rule returns twice the area of anything, the constant function included. The (h/3) you are remembering has h as the half-width; this h is the whole width.',
        'mid_is_a_length': "That is how wide the interval is, not where its middle is. The two agree whenever a = 0, which is why the [0,1] probe cannot tell them apart, and on [1,4] yours evaluates the square root at 1.5 rather than at 2.5. A location has to depend on where the interval sits.",
        'mid_precedence': 'In this notation / binds tighter than +, the same way it does in ordinary algebra, so what you typed is a plus half of b rather than half of a plus b. On [1,4] that lands on 3 instead of 2.5. Bracket the sum before halving it.',
        'weight_two': 'Your three weights are 1, 2 and 1 over 6, which sum to 4/6 rather than 1, so the rule loses a third of the area of even the constant function. The weights are the integrals of the three Lagrange basis polynomials, and they have to add up to the length of the interval.',
        'weight_one': 'Equal weights 1, 1, 1 over 6 sum to half the interval length, so your rule reports half the area of any constant. Equal weights would also mean the midpoint counts for no more than an endpoint, and the midpoint is the only sample that sees what happens between them.',
        'weight_six': 'The weights now sum to 8/6 of the interval length, so the rule overstates the area of every constant by a third. Check the requirement that pins the middle weight down: with ends weighted 1 and 1, the three have to total 6 for the rule to integrate 1 exactly.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: the recursion
# ---------------------------------------------------------------------------

ADAPT = {
    'mode': 'gated',
    'cell_id': 'adaptive',
    'concept': 'adaptive_quadrature',
    'title': 'Subdivide only where it is needed',
    'setup': {
        'intro': (
            'Composite Simpson on $\\sqrt{x}$ over $[0,1]$, doubling the panel '
            'count, and then where the error of the 32-panel run actually sits:'
        ),
        'code': (
            "for n in (2, 8, 32, 128, 512):\n"
            "    e = abs(composite_simpson(f_root, 0.0, 1.0, n) - 2/3)\n"
            "    print(f'{n:5d} panels   error {e:.3e}')\n"
            "print()\n"
            "n = 32; xg = np.linspace(0.0, 1.0, n + 1); per = []\n"
            "for k in range(n // 2):\n"
            "    lo, hi = xg[2*k], xg[2*k + 2]\n"
            "    per.append(abs(simpson_panel(f_root, lo, hi) - 2/3*(hi**1.5 - lo**1.5)))\n"
            "tot = sum(per)\n"
            "print(f'first pair  [0, 0.0625]   {per[0]:.3e}   {100*per[0]/tot:.1f}% of the total')\n"
            "print(f'other 15 pairs           {tot - per[0]:.3e}   {100*(tot - per[0])/tot:.1f}%')"
        ),
        'caption': (
            'Four times the panels buys eight times the accuracy, so the '
            'observed order is $1.5$, not the $4$ Simpson is supposed to '
            'deliver. The second block says why: $99.6\\%$ of the error lives '
            'in the first sixteenth of the interval, where $\\sqrt{x}$ turns '
            'vertical and its fourth derivative is unbounded. The uniform rule '
            'refines that sixteenth and the other fifteen at exactly the same '
            'rate, so almost all of the work goes where there was no error to '
            'remove.'
        ),
    },
    'brief': r'''
Let's spend the evaluations where the error is. That means two questions: how do we know, without the exact answer, how much error a piece of the interval still carries, and what do we do about it.

The first has a classical answer. Suppose we estimate $\int_a^b f$ twice, once with a single Simpson panel and once with two half-panels, calling the results $S_1$ and $S_2$. Simpson's local error scales as the fifth power of the panel width, and $S_2$ is two panels of half the width, so its error is smaller than $S_1$'s by a factor of $2^4 = 16$ (why?):

$$S_1 = I + E, \qquad S_2 = I + \tfrac{E}{16}.$$

Neither $I$ nor $E$ is available to us, but the difference of the two estimates is:

$$S_2 - S_1 = -\tfrac{15}{16}E \quad\Longrightarrow\quad I - S_2 = -\tfrac{E}{16} = \frac{S_2 - S_1}{15}.$$

So the gap between the two estimates, divided by $15$, is the error of the better one, and it costs nothing beyond the two estimates we already have. This is **Richardson extrapolation**, after the British mathematician and meteorologist Lewis Fry Richardson (1881-1953), who also made the first numerical weather forecast, by hand, over six weeks, for a six-hour prediction.

Two things follow. Rearranged as $I \approx S_2 + (S_2-S_1)/15$ it hands back a better answer than $S_2$ for free, so we may as well add the correction on. Read as a size, $|I - S_2| = |S_2 - S_1|/15$, it tells us whether we are done: to make the error of $S_2$ no more than a tolerance, demand that the gap between the estimates be no more than $15$ times that tolerance.

Now the second question. Check the gap on the interval. If it is small enough, accept the corrected value and stop. If it isn't, cut the interval in half and ask the same question of each piece, which is a recursion, and each piece already carries the estimate it needs: the half-panel value computed here becomes the whole-interval estimate one level down. A depth cap stops the descent on an integrand that never satisfies us.

Assemble it. The two blanks are the test that decides whether this piece is finished and the correction added to the value we accept.
''',

    'blocks': [
        block('def', 'function adapt, given a, b, tol, the estimate whole and the depth d:', [11, 11], 'def adaptive_simpson'),
        block('mid', 'let c be (a+b)/2', [13, 13], 'c = (a + b)'),
        block('left', 'let left be ((c-a)/6) * (sqrt(a) + 4*sqrt((a+c)/2) + sqrt(c))', [14, 14], 'left = simpson_panel'),
        block('right', 'let right be ((b-c)/6) * (sqrt(c) + 4*sqrt((c+b)/2) + sqrt(b))', [15, 15], 'right = simpson_panel'),
        block('refined', 'let refined be left + right', [16, 16], 'refined = left + right'),
        block('test', 'if d >= 30 or abs(refined - whole) <= ⟨?test⟩ then:', [17, 17], 'if depth >= 30'),
        block('accept', 'return refined + ⟨?corr⟩', [18, 18], 'return refined +'),
        block('recurse', 'return adapt(a, c, tol, left, d+1) + adapt(c, b, tol, right, d+1)', [19, 20], 'return (adaptive_simpson'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'mid', 'indent': 1},
        {'id': 'left', 'indent': 1},
        {'id': 'right', 'indent': 1},
        {'id': 'refined', 'indent': 1},
        {'id': 'test', 'indent': 1},
        {'id': 'accept', 'indent': 2},
        {'id': 'recurse', 'indent': 1},
    ],

    'blanks': {
        'test': {'kind': 'expr', 'answer': '15*tol', 'env': ['tol'], 'width': 10},
        'corr': {
            'kind': 'expr',
            'answer': '(refined - whole)/15',
            'env': ['refined', 'whole'],
            'width': 22,
        },
    },

    # d_stale is the bug this algorithm actually attracts in practice, and its
    # symptom is the lesson: a child handed the parent's whole-interval estimate
    # can never see the gap close, so the recursion runs to the depth cap
    # everywhere. maxSteps below makes that fail promptly.
    'distractors': [
        decoy('d_coarse', 'return whole + ⟨?corr⟩', 'accept', 'corrects_the_coarse_one'),
        decoy(
            'd_stale',
            'return adapt(a, c, tol, whole, d+1) + adapt(c, b, tol, whole, d+1)',
            'recurse',
            'stale_baseline',
        ),
    ],

    'wrong_blanks': {
        'test': [
            {'text': 'tol', 'why': 'test_no_fifteen'},
            {'text': 'tol/15', 'why': 'test_divides'},
            {'text': '15/tol', 'why': 'test_inverted'},
        ],
        'corr': [
            {'text': '(refined - whole)', 'why': 'corr_no_fifteen'},
            {'text': '(whole - refined)/15', 'why': 'corr_backwards'},
            {'text': '(refined - whole)/16', 'why': 'corr_sixteen'},
        ],
    },

    # Three intervals and two tolerances. [1,4] keeps the integrand smooth, so
    # the recursion terminates on the tolerance rather than on the singularity,
    # which is the path the depth cap would otherwise hide.
    'probes': [
        {'env': {}, 'call': f'adapt(0, 1, 0.001, {_whole(0, 1)}, 0)'},
        {'env': {}, 'call': f'adapt(0, 4, 0.001, {_whole(0, 4)}, 0)'},
        {'env': {}, 'call': f'adapt(1, 4, 0.0001, {_whole(1, 4)}, 0)'},
    ],
    'trace': [],
    'compare': 'value',
    'maxSteps': 25000,

    'py_head': [1, 9],
    'py_doc': [12, 12],
    'py_glue': [22, 23],
    'annotations': [
        {
            'blocks': ['left', 'right'],
            'text': 'The Python calls simpson_panel, the function from the previous puzzle. The pseudocode writes the same formula out, because a pseudocode step has to pair with a line of this cell and simpson_panel is defined in the cell before it.',
        },
        {
            'blocks': ['recurse'],
            'text': 'The pseudocode calls the function adapt where the Python calls it adaptive_simpson; the shorter name keeps the step on one line. The Python also wraps this one return across two lines to keep it readable, and it is a single statement either way.',
        },
    ],

    'feedback': {
        'corrects_the_coarse_one': 'You added the correction to the wrong estimate. The derivation says I is approximately S2 plus the correction, where S2 is the finer value, the one built from the two halves. Yours starts from the single-panel estimate, which is sixteen times worse, and then applies a correction sized for the better one.',
        'stale_baseline': 'Each half is handed the estimate for the whole interval rather than the estimate for itself. Nothing then improves as the recursion descends: a child compares its own two halves against a number that describes an interval twice its size, the gap never closes, and the descent runs to the depth cap on every branch. The value the parent already computed for that half is what belongs there.',
        'test_no_fifteen': "Dropping the 15 asks for a gap fifteen times smaller than the tolerance requires, so the method keeps subdividing after it has already met your accuracy target. It isn't wrong so much as wasteful: the answers it returns are better than asked for, and it pays for them. The gap between the estimates is 15 times the error of the finer one, so 15 times the tolerance is the gap that corresponds to your target.",
        'test_divides': 'Dividing by 15 tightens the test by a factor of 225 against what the tolerance calls for, since the gap should be compared against 15 times the tolerance rather than a fifteenth of it. Every piece is refined far past the point of usefulness.',
        'test_inverted': 'With tol below 1, dividing 15 by it produces something enormous, so the test passes immediately on every interval and the method accepts a single subdivision everywhere. Yours returns 0.657757 on [0,1] where the answer is 0.666667. The tolerance has to multiply the 15, not divide it.',
        'corr_no_fifteen': 'The gap between the two estimates is 15 times the error of the finer one, so adding the whole gap overshoots by a factor of 15. Yours lands on 0.669632 on [0,1] where the corrected value should be 0.663516, further from the truth than the uncorrected 2/3 estimate it started from.',
        'corr_backwards': 'The sign is inverted, so the correction pulls away from the answer instead of toward it. Work it through from S2 = I + E/16 and S1 = I + E: the exact value sits on the far side of S2 from S1, so the correction has to point away from the coarse estimate.',
        'corr_sixteen': 'Close, and 16 is the right number in the wrong place. Halving the panel divides the error by 16, which makes the difference of the two estimates 15/16 of the coarse error and therefore 15 times the fine one. The 16 is what the error shrinks by; the 15 is what the gap measures.',
    },
}

# ---------------------------------------------------------------------------
# Gate 3: the concept check
# ---------------------------------------------------------------------------
#
# Hangs off the cell that runs the method on a wider interval and watches it
# fail, which is the evidence the third question turns on. The first two
# questions are about the 15 and about what adaptivity actually buys; the
# notebook's own numbers say it buys nothing on a smooth peak, which is the
# claim the old version of that notebook had backwards.


def option(oid, text, why):
    return {'id': oid, 'text': text, 'why': why}


BCCHECK = {
    'mode': 'quiz',
    'cell_id': 'adaptcheck',
    'concept': 'adaptive_limits',
    'title': 'What the method buys, and what it misses',
    'brief': r'''
The algorithm is built, so let's ask what it buys. Three questions, about the mathematics rather than the code, and every number quoted below is in the output on this page or in the notebook.

Pick one answer for each. A wrong pick tells you what it got wrong rather than what the answer is.
''',

    'questions': [
        {
            'id': 'fifteen',
            'stem': r'''
The acceptance test compares the gap between two estimates against $15$ times the tolerance. Where does the $15$ come from?
''',
            'answer': 'richardson',
            'options': [
                option(
                    'richardson',
                    r'Halving a panel divides its error by $2^4 = 16$, so the gap between the coarse and fine estimates is $15/16$ of the coarse error, which is $15$ times the fine one.',
                    r'''
Write $S_1 = I + E$ and $S_2 = I + E/16$. Subtracting, $S_2 - S_1 = -15E/16$, and the quantity we care about is the fine estimate's error $I - S_2 = -E/16$, which is the gap over $15$.

So the $15$ is not a safety margin; it is the exact conversion factor between something we can measure, the gap, and something we cannot, the error. Everything else in the method follows from it: the same equation rearranged gives the free correction that gets added to every accepted value.
''',
                ),
                option(
                    'squared',
                    r'The rule has order $4$, and $4^2 = 16$, one more than $15$.',
                    r'''
The $16$ is right and the reasoning is not, which matters as soon as the rule changes. The refinement ratio is the base and the order is the exponent, so the factor is $2^{\,p}$ for a rule of order $p$, not $p^2$. Both readings give $4$ for a second-order rule and $16$ for a fourth-order one, so they agree exactly where you are most likely to meet them. At order $3$ they part company: $2^3 = 8$ against $3^2 = 9$.
''',
                ),
                option(
                    'safety',
                    r'It is an empirical safety factor, chosen because it works well in practice.',
                    r'''
It is derived rather than tuned, and the derivation is two lines from the error's dependence on the panel width. Nothing in the method is fitted to experiment. You can see that it is exact rather than approximate from the second use it is put to: the same $15$ appears in the correction $(S_2-S_1)/15$ added to every accepted value, and a fudge factor would not improve an answer.
''',
                ),
                option(
                    'depth',
                    r'A recursion that descends four levels produces $2^4 - 1 = 15$ subintervals above the leaves.',
                    r'''
The $15$ has nothing to do with how deep the recursion has gone; the test is applied identically at every level, including the very first call before any subdivision has happened. It compares two estimates of the same integral over the same interval, and the factor relating their errors is fixed by the order of the rule, not by the shape of the tree above them.
''',
                ),
            ],
        },
        {
            'id': 'whenpays',
            'stem': r'''
On $\sqrt{x}$ over $[0,1]$ to an error near $10^{-8}$, adaptive Simpson uses $97$ evaluations against a uniform rule's $32{,}769$. On the narrow Gaussian bump $e^{-200(x-1/2)^2}$ over the same interval, to the same accuracy, adaptive uses $121$ and uniform only $65$, so adaptivity *loses*. What separates the two cases?
''',
            'answer': 'smoothness',
            'options': [
                option(
                    'smoothness',
                    r"A uniform rule's error is set by the largest fourth derivative anywhere on the interval, so it is forced fine everywhere only when smoothness fails somewhere. The Gaussian is smooth; $\sqrt{x}$ is not, at the origin.",
                    r'''
Adaptivity is not free. It re-evaluates $f$ as it recurses and spends evaluations on the error estimate itself, so it starts every comparison at a disadvantage and wins only by avoiding work the uniform rule cannot avoid. A Gaussian has bounded derivatives of every order, the uniform rule's $h^4$ is in no trouble, and there is no wasted work to recover.

At the origin $\sqrt{x}$ has an unbounded second derivative, let alone a fourth, so a uniform rule has to be fine across the whole interval to control the one place that misbehaves. That is the wasted work adaptivity recovers, and the margin grows as the tolerance tightens: about $4\times$ at $10^{-4}$, $338\times$ at $10^{-8}$, $2372\times$ at $10^{-10}$.
''',
                ),
                option(
                    'narrowness',
                    r'The bump is not narrow enough relative to $[0,1]$. A sharper spike would flip the result.',
                    r'''
Narrowness is not the criterion, and this is the intuition the measurement is there to correct. The bump already occupies about a twentieth of the interval and still loses. Making the feature narrower relative to the interval doesn't rescue adaptivity here either; the notebook widens the interval to $[0,4]$, which sharpens the ratio considerably, and the method fails outright rather than winning. What decides the contest is whether the integrand stays smooth, not how concentrated it is.
''',
                ),
                option(
                    'cheapereval',
                    r'$\sqrt{x}$ is cheaper to evaluate than an exponential, so the same count of evaluations costs less.',
                    r'''
Both columns count evaluations, not seconds, and the comparison is between two methods applied to the same integrand, so the cost per evaluation cancels out of every ratio on the page. On the Gaussian both methods pay the same price per call and adaptive still needs nearly twice as many calls.
''',
                ),
                option(
                    'tolerance',
                    r'At a looser tolerance adaptive would win on the Gaussian too; $10^{-8}$ happens to favour the uniform rule.',
                    r'''
It goes the other way. At $10^{-4}$ the two are level on the bump, at $10^{-8}$ adaptive costs about twice as much, and at $10^{-10}$ about five times. Tightening the tolerance makes adaptivity look worse on a smooth integrand and better on a non-smooth one, so the tolerance changes the size of the gap rather than its direction.
''',
                ),
            ],
        },
        {
            'id': 'blind',
            'stem': r'''
Take that same bump $e^{-200(x-1/2)^2}$, whose integral is $0.125331$, and integrate it over $[0,4]$ instead of $[0,1]$, tolerance $10^{-8}$. The method returns $0.000000$ after $5$ evaluations. What happened?
''',
            'answer': 'unsampled',
            'options': [
                option(
                    'unsampled',
                    r'The first samples land at $0$, $2$ and $4$, where the bump is indistinguishable from zero, so every estimate is $0$, their difference is $0$, and the test passes on the first try.',
                    r'''
The error estimate is built entirely out of the samples taken, and those samples never came near $x = 1/2$. Both half-panel estimates agree with the whole-panel estimate perfectly, because all three are zero, and perfect agreement is exactly what the method treats as proof that no subdivision is needed.

This is the standing limitation of every error estimate of this kind: it measures how much the answer *changed* when the sampling was refined, which is a good proxy for error only when the sampling was dense enough to see the function in the first place. The usual defences are a minimum recursion depth before any acceptance and a smarter starting grid, and neither is a guarantee.
''',
                ),
                option(
                    'depthcap',
                    r'The depth cap cut the recursion off before it reached the bump.',
                    r'''
The cap never came into play. It stops a descent at depth $30$, and this run accepted at depth $0$ after $5$ evaluations, so it never descended at all. A run stopped by the cap looks the opposite of this one: enormously many evaluations and an answer that is close but not converged.
''',
                ),
                option(
                    'toolose',
                    r'The tolerance $10^{-8}$ was too loose for an integrand this sharp.',
                    r'''
Tightening it changes nothing. The gap the test measures is exactly $0$ here, since every estimate involved is $0$, and $0$ is below any positive tolerance you care to name. A test that compares a measured gap against a threshold cannot be rescued by lowering the threshold when the measured gap is zero for the wrong reason.
''',
                ),
                option(
                    'underflow',
                    r'$e^{-200(x-1/2)^2}$ underflows to zero in floating point at $x = 2$ and $x = 4$, so the arithmetic lost the bump.',
                    r'''
It does underflow at those points, and that is a symptom rather than the cause. The same failure happens with an integrand that stays comfortably above the smallest representable number: all that is required is that the three initial samples miss the feature, so that the refined and unrefined estimates agree. Exact arithmetic would return $0$ here too.
''',
                ),
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

# Gate 1 on the panel cell, gate 2 on the recursion cell, and the concept check
# on the cell that watches the method fail on a wider interval. The composite
# rules, the convergence sweep, the exactness check and the cost comparison all
# stay in the notebook.

CELLS = {
    6: PANEL,
    7: ADAPT,
    9: BCCHECK,
}

NOTEBOOK_LAB = {
    'lab_id': 'adaptive-quadrature',
    'order': 4,
    'title': 'Adaptive quadrature',
    'blurb': 'Build Simpson’s rule, then the recursion that decides for itself where to spend the next evaluation.',
    'series': ['newton', 'runge', 'splines', 'adaptive-quadrature'],
    'colab_path': 'na/quadrature_newton_cotes_adaptive.ipynb',
    'intro': (
        'Every quadrature rule on this page comes from one idea: run a '
        'polynomial through a few values of $f$ and integrate that instead, '
        'since a polynomial is something we can integrate exactly. Three '
        'points and a parabola give Simpson’s rule, and applying it on '
        'many small panels converges at order four, which is usually the end '
        'of the story.\n\n'
        'It isn’t the end of the story when the integrand misbehaves in one '
        'place. Then a uniform grid has to be fine everywhere to cope with a '
        'fault that lives in a corner of the interval, and almost all of the '
        'work goes where there was nothing to fix. The second puzzle builds '
        'the standard escape: a method that estimates its own error on each '
        'piece and subdivides only the pieces that need it.\n\n'
        'We’ll integrate\n\n'
        r'$$f(x) = \sqrt{x}, \qquad \int_0^1 \sqrt{x}\,dx = \frac{2}{3},$$'
        '\n\n'
        'which is smooth everywhere except at the origin, where its slope '
        'turns vertical. That single bad point is enough to drag the uniform '
        'rule from order four down to order one and a half, and it is where '
        'the adaptive method earns its keep. Any output you see on this page '
        'came from this integrand.\n\n'
        'Each of the first two hands you the steps of an algorithm in '
        'scrambled order. Drag them into the workspace, set the indentation, '
        'fill in the blanks, and check your answer. Indentation counts as much '
        'as order, since a step one level in runs once for every pass of the '
        'loop above it. The last one is multiple choice, about the mathematics '
        'rather than the code, and its three questions are answered together. '
        'The notebook opens once all three are done.\n\n'
        'The steps are pseudocode rather than Python, and each one is a '
        'sentence you can read out loud. `let` stores a value, and `for`, '
        '`if`, `else`, `while` and `return` do what they do in code. A '
        'function can call itself, which is how the second algorithm '
        'subdivides. Subscripts start at 0, and `from a to b` includes both '
        '$a$ and $b$. `*` multiplies, `^` raises to a power, `!=` means "is '
        'not equal to" and `<=` means "is at most". Every symbol here is one '
        'you can type, so a blank takes exactly what you read. The key above '
        'the puzzles has the rest.'
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
