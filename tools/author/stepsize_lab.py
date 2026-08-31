"""Seed the lab metadata into numerical_differentiation_optimal_h.ipynb.

Same arrangement as newton_lab.py: the notebook is the source of truth once this
has run, and this file is the readable form of the seed. Running it again
overwrites the lab metadata and nothing else.

Run it with the labs venv active; its path differs per machine.

    python tools/author/stepsize_lab.py

The lab follows Math 212 section 1.3: set the expectation (halve h and the
central difference error falls by four, every time), break it (sweep h over
sixteen decades and the error turns round and climbs), diagnose the cause (a
fixed cancellation error divided by a shrinking step), give the fix as a
construction (combine two estimates so the leading error term cancels), then
ask.

Richardson lives here rather than in a lab of its own. It is the answer to the
question the U-curve poses, and it moves the same picture the lab is built
around: measured on exp at x = 1, the best central-difference error is 2.4e-11
near h = 5.6e-6, and extrapolation takes that to 1.9e-13 near h = 1.8e-3, which
is 127 times more accurate at a step 316 times larger. The derivation of the
error expansion is skipped and the reader is sent to a text for it; what the
brief keeps is the consequence.

Two measurement facts that shaped the design, both worth carrying forward:

- **The probes return derivative estimates, not errors.** `valuesEqual` compares
  with `tol * max(1, |a|, |b|)`, so for values below 1 the tolerance is
  effectively an absolute 1e-9. Error values of 1e-11 or 1e-13 would all compare
  equal to each other and to zero, and the gate would pass anything. Returning
  the estimates keeps every compared number near e, where the relative tolerance
  bites properly.
- **The probe step sizes sit in the truncation-dominated regime**, 0.2 down to
  0.025. Below the U's minimum the error is the leftover of a cancellation and
  swings by an order of magnitude between neighbouring h, so a reference
  computed there would be floating-point noise and an algebraically equivalent
  student answer could fail on rounding alone.

The same noise is why the notebook was rewritten. `show_ucurve` used to report
`err.argmin()` over a sampled curve, which is the minimum of that noise: it
printed a "minimum error" that moved over two orders of magnitude between
x0 = 1.0 and x0 = 1.1, sitting next to a theoretical prediction that does not
move, which made the theory look wrong when it is right. The sweep now reports a
median-per-half-decade envelope, and the envelope lands where the theory says:
3.6e-8 near sqrt(u) for forward, 2.4e-11 near u^(1/3) for central.

Line numbers below are 1-based into each cell's own source. build_labs.py checks
every one against its py_match substring and fails the build when an edit has
shifted them.
"""

import json
import pathlib
import sys

NOTEBOOK = pathlib.Path('teaching/labs/notebooks/na/numerical_differentiation_optimal_h.ipynb')

# Four step sizes, each half the one before, all comfortably above the U's
# minimum for both methods. Halving is what makes the ratios in the setup
# output readable as orders: 4 for the central difference, 16 for Richardson.
HS = [0.2, 0.1, 0.05, 0.025]
HS2 = [0.15, 0.06, 0.03]


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
# Gate 1: the two difference quotients
# ---------------------------------------------------------------------------

SWEEP = {
    'mode': 'gated',
    'cell_id': 'diffsweep',
    'concept': 'finite_differences',
    'title': 'Build the two difference quotients',
    'setup': {
        'intro': (
            'The derivative of $e^x$ at $x = 1$ is $e$, and here is what '
            'ordinary arithmetic knows about it:'
        ),
        'code': (
            "print(f\"f(x) = exp(x),  x0 = {X0},  f'(x0) = e = {EXACT:.15f}\")\n"
            "print(f'unit roundoff u = {U:.3e}')\n"
            "print()\n"
            "print('a first estimate, from two samples a distance h apart:')\n"
            "for h in (0.5, 0.1, 0.01):\n"
            "    q = (np.exp(X0 + h) - np.exp(X0)) / h\n"
            "    print(f'  h = {h:5.2f}   (f(x+h) - f(x))/h = {q:.9f}"
            "   error {abs(q - EXACT):.2e}')"
        ),
        'caption': (
            'The estimate improves as $h$ shrinks, and the error falls by about '
            'a factor of ten each time $h$ does, which is what a first-order '
            'method should do. Nothing here suggests a limit to how far that '
            'can be pushed.'
        ),
    },
    'brief': r'''
The derivative is defined as a limit, and a computer cannot take limits. So let's do the obvious thing and stop early: pick a small $h$ and keep the quotient.

Two ways to pick the samples. The **forward difference** takes the point and one neighbour to its right,

$$D_+(h) = \frac{f(x+h) - f(x)}{h},$$

and Taylor expanding $f(x+h)$ about $x$ leaves $D_+(h) = f'(x) + \tfrac{h}{2}f''(\xi)$, so the error falls in step with $h$. The **central difference** straddles the point instead,

$$D_0(h) = \frac{f(x+h) - f(x-h)}{2h},$$

and here the two expansions do something better. Write both out to third order and subtract: the $f'$ terms add, the $f''$ terms are equal and opposite and cancel, and what survives is $D_0(h) = f'(x) + \tfrac{h^2}{6}f^{(3)}(\xi)$. Symmetry has bought a whole order for the same two evaluations (why?).

Note the $2h$ in the denominator, which is the distance between the two samples rather than the step to either side. Getting that wrong is the commonest way to write this formula incorrectly, and it costs a factor of two on every answer, not an accuracy penalty you might mistake for method error.

So both formulas improve as $h$ shrinks, one at a rate of $h$ and one at a rate of $h^2$, and the arithmetic above agrees. Take $h$ smaller still and the estimates should get better still.

Assemble the sweep. It runs down a list of step sizes and records both estimates at each. The three blanks are the two denominators and the second sample of the central formula.
''',

    'blocks': [
        block('def', 'function difference_sweep, given x, the steps hs and the count n:', [8, 8], 'def difference_sweep'),
        fused('alloc', [
            ('let fwd be a list of n zeros', 0),
            ('let cen be a list of n zeros', 0),
        ], [10, 11], 'fwd = np.zeros'),
        block('loop', 'for each step k from 0 to n-1:', [12, 12], 'for k in range(n)'),
        block('h', 'let h be hs[k]', [13, 13], 'h = hs[k]'),
        block('fwd', 'let fwd[k] be (exp(x+h) - exp(x)) / ⟨?fden⟩', [14, 14], 'fwd[k] ='),
        block('cen', 'let cen[k] be (exp(x+h) - ⟨?back⟩) / ⟨?cden⟩', [15, 15], 'cen[k] ='),
        block('ret', 'return fwd and cen', [16, 16], 'return fwd, cen'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loop', 'indent': 1},
        {'id': 'h', 'indent': 2},
        {'id': 'fwd', 'indent': 2},
        {'id': 'cen', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'fden': {'kind': 'expr', 'answer': 'h', 'env': ['x', 'h'], 'width': 8},
        'back': {'kind': 'expr', 'answer': 'exp(x-h)', 'env': ['x', 'h'], 'width': 12},
        'cden': {'kind': 'expr', 'answer': '2*h', 'env': ['x', 'h'], 'width': 8},
    },

    'distractors': [
        decoy('d_sign', 'let fwd[k] be (exp(x) - exp(x+h)) / ⟨?fden⟩', 'fwd', 'forward_backwards'),
        decoy('d_shift', 'let cen[k] be (exp(x+h) - exp(x)) / ⟨?cden⟩', 'cen', 'central_not_straddling'),
    ],

    'wrong_blanks': {
        'fden': [
            {'text': '2*h', 'why': 'fden_doubled'},
            {'text': 'h*h', 'why': 'fden_squared'},
        ],
        'back': [
            {'text': 'exp(x)', 'why': 'back_is_the_point'},
            {'text': 'exp(h-x)', 'why': 'back_argument_flipped'},
        ],
        'cden': [
            {'text': 'h', 'why': 'cden_single_step'},
            {'text': '2', 'why': 'cden_no_h'},
            {'text': '4*h', 'why': 'cden_four'},
        ],
    },

    'probes': [
        {'env': {'x': 1.0, 'hs': HS, 'n': 4}, 'call': 'difference_sweep(x, hs, n)'},
        {'env': {'x': 0.5, 'hs': HS2, 'n': 3}, 'call': 'difference_sweep(x, hs, n)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 6],
    'py_doc': [9, 9],
    'py_glue': [18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
    'annotations': [
        {
            'blocks': ['fwd', 'cen'],
            'text': "The notation has no way to pass a function as an argument, so the pseudocode calls exp directly where a general routine would take f. The arithmetic is the same either way.",
        },
        {
            'blocks': ['ret'],
            'text': 'Returning two things at once is one statement, the same as the comma in the Python. The word and separates the values rather than joining them into a condition.',
        },
    ],

    'feedback': {
        'forward_backwards': 'The subtraction runs the wrong way, so every estimate comes back with the sign reversed: your first entry is about -3.01 where the derivative of exp at 1 is near +2.72. A difference quotient measures the rise from the earlier sample to the later one, so the later value is the one to subtract from.',
        'central_not_straddling': 'That numerator is the forward difference, spanning from x to x+h, while the denominator is the width of a straddling pair. The two disagree, and the result is roughly half the derivative rather than a better estimate of it. The central formula reaches a step in each direction, so its second sample sits to the left of x.',
        'fden_doubled': "The forward pair is only h apart, so dividing by 2h halves every estimate: yours returns about 1.5 where the derivative is 2.72. The denominator of a difference quotient is the distance between the two samples it uses, and here that distance is h.",
        'fden_squared': 'Dividing by h squared is dimensionally wrong: a difference of values over a length gives a rate, and a length squared gives something that is not a derivative at all. It also blows up as h shrinks rather than converging. The forward samples are h apart.',
        'back_is_the_point': 'That makes both formulas the same, and the second line stops being a central difference: with the point itself as the second sample the pair no longer straddles x, so the cancellation that buys the extra order never happens. The central formula reaches a step to the left as well as to the right.',
        'back_argument_flipped': 'You have negated the whole argument rather than stepping back from x. What is wanted is the function a step to the left of x, at x - h, and yours evaluates at h - x, which for x = 1 and h = 0.2 is -0.8 rather than 0.8.',
        'cden_single_step': 'The two central samples sit at x-h and x+h, so they are 2h apart, and dividing by h alone doubles every estimate. Yours returns about 5.47 where the derivative is 2.72. The denominator is the gap the numerator spans.',
        'cden_no_h': 'Dividing by a constant leaves something that shrinks with h rather than converging to the derivative: your estimates fall towards zero as the steps get smaller. A difference quotient has to divide by the length of the interval it spanned, and that length depends on h.',
        'cden_four': 'The samples are 2h apart, not 4h, so every estimate comes out at half its correct value. Count the distance from x-h to x+h.',
    },
}

# ---------------------------------------------------------------------------
# Gate 2: Richardson extrapolation
# ---------------------------------------------------------------------------

RICH = {
    'mode': 'gated',
    'cell_id': 'richardson',
    'concept': 'richardson_extrapolation',
    'title': 'Cancel the leading error term',
    'setup': {
        'intro': (
            'The central difference again, this time swept over sixteen orders '
            'of magnitude of $h$:'
        ),
        'code': (
            "h_c, e_c = sweep(cen_of)\n"
            "mc2, vc2, hcs, ecs = envelope(h_c, e_c)\n"
            "plt.figure()\n"
            "plt.loglog(h_c, e_c + 1e-20, '.', ms=1.5, color='lightsteelblue', alpha=.5)\n"
            "plt.loglog(mc2, vc2, 'b-', lw=2, label='central, envelope')\n"
            "plt.axvline(U ** (1/3), color='k', ls=':', lw=1, label='h* ~ u^(1/3)')\n"
            "plt.xlabel('step size h'); plt.ylabel('absolute error')\n"
            "plt.legend(); plt.show()\n"
            "print(f'best error {ecs:.2e} at h = {hcs:.1e}')\n"
            "print(f'at h = 1e-10 the error is back up to {abs(cen_of(1e-10) - EXACT):.2e}')"
        ),
        'caption': (
            'The curve turns round. Coming in from the right the error falls '
            'like $h^2$, exactly as the expansion says, until about '
            '$h = 6\\times10^{-6}$; past that it climbs like $1/h$. The reason '
            'is subtraction: $f(x+h)$ and $f(x-h)$ agree in more and more '
            'leading digits as $h$ shrinks, so their difference keeps fewer and '
            'fewer, and that shrinking remainder is then divided by a shrinking '
            '$2h$. The best this formula can do is about $2.4\\times10^{-11}$, '
            'and no choice of $h$ does better. Below the minimum the dots '
            'scatter over an order of magnitude, because down there the error '
            'is whatever a cancellation happened to leave behind.'
        ),
    },
    'brief': r'''
The floor is not a fact about $e^x$, and it isn't a fact about arithmetic being sloppy. It is the meeting point of two errors that move in opposite directions, and lowering it means changing one of them.

The rounding half is not ours to change. Two stored values agreeing to fifteen digits leave a difference good to one or two, whatever we do with it afterwards. So let's attack the other half and make the truncation error shrink faster, which will let us stop at a larger $h$, well before cancellation becomes the problem.

The central difference has an error expansion in even powers,

$$D_0(h) = f'(x) + c_2h^2 + c_4h^4 + \cdots,$$

with coefficients built from the derivatives of $f$ at $x$. We won't derive it here; any numerical analysis text carries it, and what matters is the shape rather than the constants. Evaluate at $h$ and again at half that step:

$$D_0(h) = f'(x) + c_2h^2 + \cdots, \qquad D_0(h/2) = f'(x) + \tfrac{c_2}{4}h^2 + \cdots.$$

Two equations, and the unknown $c_2$ appears in both with a known ratio between them. Eliminate it the way you would from any pair of linear equations: multiply the second by four, subtract the first, and divide by three so the $f'$ terms still come to one. The $h^2$ term is gone, and the leading survivor is $h^4$ rather than $h^3$ (why?).

This is **Richardson extrapolation**, after the British mathematician and meteorologist Lewis Fry Richardson (1881-1953), who also made the first numerical weather forecast, by hand, over six weeks, for a six-hour prediction. Nothing in the argument is specific to differentiation: it works on any quantity whose error is a known power of a step you control.

Assemble it. Each pass computes the coarse estimate, the estimate at half the step, and the combination. The two blanks are the halved-step estimate and the combination itself.
''',

    'blocks': [
        block('def', 'function richardson_sweep, given x, the steps hs and the count n:', [4, 4], 'def richardson_sweep'),
        block('alloc', 'let out be a list of n zeros', [6, 6], 'out = np.zeros'),
        block('loop', 'for each step k from 0 to n-1:', [7, 7], 'for k in range(n)'),
        block('h', 'let h be hs[k]', [8, 8], 'h = hs[k]'),
        block('coarse', 'let coarse be (exp(x+h) - exp(x-h)) / (2*h)', [9, 9], 'coarse ='),
        block('fine', 'let fine be ⟨?fine⟩', [10, 10], 'fine ='),
        block('combo', 'let out[k] be ⟨?combo⟩', [11, 11], 'out[k] ='),
        block('ret', 'return out', [12, 12], 'return out'),
    ],

    'solution': [
        {'id': 'def', 'indent': 0},
        {'id': 'alloc', 'indent': 1},
        {'id': 'loop', 'indent': 1},
        {'id': 'h', 'indent': 2},
        {'id': 'coarse', 'indent': 2},
        {'id': 'fine', 'indent': 2},
        {'id': 'combo', 'indent': 2},
        {'id': 'ret', 'indent': 1},
    ],

    'blanks': {
        'fine': {
            'kind': 'expr',
            'answer': '(exp(x+h/2) - exp(x-h/2)) / h',
            'env': ['x', 'h'],
            'width': 32,
        },
        'combo': {
            'kind': 'expr',
            'answer': '(4*fine - coarse)/3',
            'env': ['fine', 'coarse'],
            'width': 22,
        },
    },

    'distractors': [
        decoy('d_avg', 'let out[k] be (fine + coarse)/2', 'combo', 'averaged_not_extrapolated'),
        decoy('d_fine', 'let out[k] be fine', 'combo', 'kept_the_finer_one'),
    ],

    'wrong_blanks': {
        'fine': [
            {'text': '(exp(x+h/2) - exp(x-h/2)) / (2*h)', 'why': 'fine_denominator_stale'},
            {'text': '(exp(x+h/2) - exp(x-h/2)) / (h/2)', 'why': 'fine_denominator_halved'},
        ],
        'combo': [
            {'text': '(4*coarse - fine)/3', 'why': 'combo_swapped'},
            {'text': '(4*fine - coarse)/4', 'why': 'combo_divided_by_four'},
            {'text': '(fine - coarse)/3', 'why': 'combo_is_the_correction'},
            {'text': '2*fine - coarse', 'why': 'combo_wrong_power'},
        ],
    },

    'probes': [
        {'env': {'x': 1.0, 'hs': HS, 'n': 4}, 'call': 'richardson_sweep(x, hs, n)'},
        {'env': {'x': 0.5, 'hs': HS2, 'n': 3}, 'call': 'richardson_sweep(x, hs, n)'},
    ],
    'trace': [],
    'compare': 'value',

    'py_head': [1, 3],
    'py_doc': [5, 5],
    'py_glue': [14, 15, 16, 17, 18, 19, 20, 21, 22],
    'annotations': [
        {
            'blocks': ['fine'],
            'text': 'The samples are now h/2 either side of x, so they are h apart and h is what the difference is divided by. It is the same central formula as the line above with its step halved, not a different rule.',
        },
    ],

    'feedback': {
        'averaged_not_extrapolated': "An average sits between the two estimates, so it inherits an error between theirs and stays second order. Extrapolation goes past the better one instead: since the finer estimate's error is a quarter of the coarser one's, the gap between them says how much error is left in the finer, and the combination steps that much further in the same direction.",
        'kept_the_finer_one': "That is a central difference at half the step, and nothing has been cancelled: it is four times better than the coarse estimate and still second order, so it inherits the same U-curve one notch down. The coarse estimate is not there to be discarded; it is the second equation that lets the h^2 term be eliminated.",
        'fine_denominator_stale': 'The step changed and the denominator did not. Your two samples sit at x-h/2 and x+h/2, which are h apart, so dividing by 2h halves the estimate. Every central difference divides by the distance between its own two samples.',
        'fine_denominator_halved': 'You divided by the step to either side rather than by the distance between the samples. From x-h/2 to x+h/2 is h, not h/2, so yours comes out at twice the derivative.',
        'combo_swapped': 'The weights are on the wrong estimates. Four goes on the finer one, whose error is the smaller of the two, and the coarse estimate is subtracted off. As written, yours amplifies the worse estimate and gives an answer further from the truth than either input.',
        'combo_divided_by_four': 'The weights have to sum to one, or the combination stops being an estimate of the derivative at all: 4 - 1 = 3, so three is the divisor. Check it on a function whose derivative is constant, where both estimates are exact and any correct combination must return that same value; yours returns three quarters of it.',
        'combo_is_the_correction': "That is the correction alone, not the corrected estimate. The gap between the two divided by three measures what is still wrong with the finer estimate, so it has to be added to that estimate rather than reported instead of it. Yours returns something near zero at every step size.",
        'combo_wrong_power': "Weights of 2 and -1 do sum to one, so this is a genuine extrapolation, but for the wrong order. It would cancel a leading error term proportional to h, which is what the forward difference has. The central difference's leading term goes like h squared, so halving the step divides it by four rather than two, and the weights that cancel it are 4 and -1 over 3.",
    },
}

# ---------------------------------------------------------------------------
# Gate 3: the concept check
# ---------------------------------------------------------------------------
#
# Hangs off the cell that puts the two U-curves side by side, which is what the
# second and third questions read off. The first question is about the shape of
# the curve itself; the notebook's old argmin defect is the reason the third
# one exists at all.


def option(oid, text, why):
    return {'id': oid, 'text': text, 'why': why}


HCHECK = {
    'mode': 'quiz',
    'cell_id': 'hcheck',
    'concept': 'step_size_tradeoff',
    'title': 'Reading the U-curve',
    'brief': r'''
Both formulas are built, so let's read the picture they make. The cell above sweeps $h$ over sixteen orders of magnitude for the central difference and its extrapolation, and reports where each one bottoms out.

Pick one answer for each. A wrong pick tells you what it got wrong rather than what the answer is.
''',

    'questions': [
        {
            'id': 'branches',
            'stem': r'''
On log-log axes the central difference's error falls with slope $2$ as $h$ decreases, turns round near $h = 6\times10^{-6}$, and then climbs with slope $-1$. What is the climbing branch?
''',
            'answer': 'cancellation',
            'options': [
                option(
                    'cancellation',
                    r'$f(x+h)$ and $f(x-h)$ agree in more leading digits as $h$ shrinks, so their difference keeps fewer, and that shrinking remainder is divided by a shrinking $2h$.',
                    r'''
The two stored values each carry an absolute error near $u|f|$, and subtracting nearly equal numbers doesn't reduce it: the difference is good to roughly $u|f|$ no matter how small $h$ gets. Dividing by $2h$ then inflates that fixed error like $1/h$, which is the slope $-1$ branch.

That is why the exponent works out as it does. Setting $\tfrac{h^2}{6}|f^{(3)}| = \tfrac{u|f|}{h}$ and solving gives $h_* \sim u^{1/3}$, about $6\times10^{-6}$, which is where the measured envelope turns. Nothing about the function is unusual; every finite difference does this.
''',
                ),
                option(
                    'expansion',
                    r'The Taylor expansion stops being valid once $h$ is small enough.',
                    r'''
A Taylor expansion gets better as $h$ shrinks, not worse; the remainder term $\tfrac{h^2}{6}f^{(3)}(\xi)$ goes to zero. The mathematics on the truncation branch is in no trouble anywhere on this plot. What fails is the arithmetic used to evaluate the formula, and in exact arithmetic there would be no climbing branch at all: the error would keep falling like $h^2$ forever.
''',
                ),
                option(
                    'underflow',
                    r'$h$ underflows to zero, so the quotient loses meaning.',
                    r'''
The smallest $h$ on the plot is $10^{-16}$, comfortably above the underflow threshold near $10^{-308}$, and it is represented exactly enough for the division. The climb also begins around $10^{-6}$, ten orders of magnitude before anything could underflow, and it rises steadily rather than failing suddenly. Steady growth like $1/h$ points at a fixed error being divided by $h$.
''',
                ),
                option(
                    'thirdderiv',
                    r"$f^{(3)}$ grows as the interval $[x-h, x+h]$ shrinks, so the truncation term stops falling.",
                    r'''
It goes the other way: as $h$ shrinks the interval closes on $x$, so $f^{(3)}(\xi)$ tends to $f^{(3)}(x)$, a fixed number, and for $e^x$ at $x=1$ that is $e$ throughout. The truncation term $\tfrac{h^2}{6}f^{(3)}(\xi)$ therefore keeps falling like $h^2$ on the whole plot. The climb has to come from somewhere other than the error formula.
''',
                ),
            ],
        },
        {
            'id': 'whatrich',
            'stem': r'''
Richardson takes the best error from $2.4\times10^{-11}$ near $h = 5.6\times10^{-6}$ to $1.9\times10^{-13}$ near $h = 1.8\times10^{-3}$: about $127$ times more accurate, at a step about $316$ times larger. Which describes what it did?
''',
            'answer': 'steepened',
            'options': [
                option(
                    'steepened',
                    r'It steepened the truncation branch from slope $2$ to slope $4$ and left the rounding branch alone, so the two now cross further right and further down.',
                    r'''
The fitted slopes confirm it: $2.00$ for the central difference and $4.00$ for the extrapolation, over the same window. The rounding branch is untouched, because the combination is still built from differences of nearly equal stored values, and in fact it is slightly worse: the weights $4$ and $-1$ over $3$ amplify the rounding a little.

So the U survives; it moves. A steeper left branch meeting the same right branch crosses at a larger $h$ and a smaller error, and the practical gain is that you can stop at a step where cancellation has not yet begun to hurt.
''',
                ),
                option(
                    'removed',
                    r'It removed the rounding error, so the curve now falls monotonically.',
                    r'''
The plot still turns round, and the extrapolation still has a floor, at $1.9\times10^{-13}$. Nothing in the construction touches how stored values are subtracted, so the cancellation is exactly as bad as before. What changed is how quickly the other error falls, which moves the meeting point rather than removing it.
''',
                ),
                option(
                    'moreprecision',
                    r'It effectively works in higher precision, so more digits survive the subtraction.',
                    r'''
Every quantity in the extrapolation is an ordinary double, and the subtractions lose exactly the digits they always lose. If precision had risen, the rounding branch would have dropped and the minimum would have moved left, to a smaller $h$. It moved right instead, which is the signature of a steeper truncation branch rather than a quieter rounding one.
''',
                ),
                option(
                    'smallerh',
                    r'It made the method usable at much smaller $h$, where the truncation error is negligible.',
                    r'''
The gain is at a larger $h$, not a smaller one: the new optimum is at $1.8\times10^{-3}$ against the old $5.6\times10^{-6}$. Going smaller is the direction that was already ruined by cancellation, and extrapolation does nothing to repair it. A higher order means you no longer need a tiny step to get a small error.
''',
                ),
            ],
        },
        {
            'id': 'noise',
            'stem': r'''
Below the minimum the sampled error scatters over an order of magnitude between neighbouring $h$: at $h = 1.75\times10^{-8}$ the central difference happens to be $25$ times more accurate than at $h = 1.7\times10^{-8}$. What follows about reporting "the minimum error and the $h$ where it occurs" from a sampled sweep?
''',
            'answer': 'notreproducible',
            'options': [
                option(
                    'notreproducible',
                    r"The pointwise minimum of the sample is a minimum of that scatter, so it isn't reproducible; the envelope of the curve is what the theory predicts.",
                    r'''
Down there the error is the leftover of a cancellation, and whether a particular $h$ leaves a large or a small leftover is an accident of the bit patterns. A sweep that reports its smallest sampled error is reporting the luckiest accident it happened to hit, which changes with the sampling and with the point: run the same experiment at $x_0 = 1.0, 1.1, 1.2$ and the "minimum" moves over two orders of magnitude while the prediction doesn't move at all.

Take a median over each half-decade instead and the noise averages out. That envelope bottoms at $2.4\times10^{-11}$ near $6\times10^{-6}$, which is what the model says it should, and this notebook was changed to report it that way.
''',
                ),
                option(
                    'refine',
                    r'The sweep needs more sample points, so that the true minimum is not missed.',
                    r'''
More samples make it worse rather than better. Every extra point is another chance at a lucky cancellation, so the smallest sampled error drifts downward as the sampling is refined and never settles: it is an extreme of a noisy quantity, and extremes of noise grow with the number of draws. The fix has to average the noise out, not sample it harder.
''',
                ),
                option(
                    'theorywrong',
                    r'The theory is wrong, since it predicts a smooth minimum and the measurement shows scatter.',
                    r'''
The model predicts the size of the error, and it is a bound built from a rounding level that individual evaluations sit at or below. Scatter beneath a bound is exactly what a bound allows. Compare the model against the envelope rather than against the luckiest sample and the agreement is close: $2.4\times10^{-11}$ measured against $10^{-10}$ predicted, at the predicted step size.
''',
                ),
                option(
                    'usemin',
                    r"It doesn't matter much, since either way you learn roughly where the minimum is.",
                    r'''
The location survives roughly, and the reported error doesn't: it moved from $10^{-13}$ to $1.25\times10^{-11}$ across three nearby choices of $x_0$ in this notebook's earlier version, printed next to a prediction that never moves. A reader comparing the two would conclude the theory was out by two orders of magnitude, when the disagreement was entirely in how the measurement was taken.
''',
                ),
            ],
        },
    ],
}

# ---------------------------------------------------------------------------
# Cell-by-cell plan
# ---------------------------------------------------------------------------

CELLS = {
    4: SWEEP,
    7: RICH,
    8: HCHECK,
}

NOTEBOOK_LAB = {
    'lab_id': 'step-size',
    'order': 6,
    'title': 'Numerical differentiation and the optimal step size',
    'blurb': 'Watch a derivative estimate stop improving as the step shrinks, then change the formula so it stops later and lower.',
    'series': ['newton', 'runge', 'splines', 'adaptive-quadrature', 'least-squares', 'step-size'],
    'colab_path': 'na/numerical_differentiation_optimal_h.ipynb',
    'intro': (
        'A derivative is a limit, and a computer cannot take one. It can only '
        'stop early: pick a small step, keep the difference quotient, and hope '
        'the answer is close. Everything about numerical differentiation '
        'follows from asking how small that step should be.\n\n'
        'The obvious answer is as small as possible, and it is wrong. Two '
        'errors are in play and they pull in opposite directions. Truncation, '
        'from stopping short of the limit, falls as the step shrinks. Rounding, '
        'from subtracting two nearly equal stored numbers and dividing by '
        'something tiny, grows. Their sum has a minimum at a step size you can '
        'predict, and below it the answer gets worse.\n\n'
        'The first puzzle builds the two standard quotients, the second builds '
        'the trick that lowers the floor by changing how fast one of those '
        'errors falls, and three questions at the end ask what the resulting '
        'picture is saying.\n\n'
        "We'll differentiate\n\n"
        r"$$f(x) = e^x \quad\text{at}\quad x = 1, \qquad f'(1) = e = 2.718281828\ldots,$$"
        '\n\n'
        'so the exact answer is known to as many digits as we want and every '
        'error on this page is a true error rather than a comparison between '
        'two approximations. Any output you see here came from that function '
        'at that point.\n\n'
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
        '`exp(t)` is the exponential and `abs(t)` the absolute value. '
        'Subscripts start at 0, and `from a to b` includes both $a$ and $b$. '
        '`*` multiplies, `^` raises to a power, `!=` means "is not equal to" '
        'and `<=` means "is at most". Every symbol here is one you can type, '
        'so a blank takes exactly what you read. The key above the puzzles has '
        'the rest.'
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
