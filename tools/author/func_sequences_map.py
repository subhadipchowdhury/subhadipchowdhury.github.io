"""The sequences and series of functions concept map, from chapter 3 of
Practice Worksheet 3.

Fourteen boxes and fifteen arrows, with the tikz coordinates carried over. Two
arrows fail and one is an equivalence, so this is the map that uses all three kinds.

Arrow 5 is the one the printed worksheet draws in orange and flags for attention:
uniform convergence of the functions does not give a differentiable limit. It was a
fourth kind of its own until 2026-08-13, when Dip cut that category as vague. It is
honestly a failure, and the fact that the repair is to ask for the derivatives to
converge uniformly belongs in its sentence.

Run it to rewrite teaching/labs/maps/data/func-sequences.json.
"""

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from mapkit import edge, node, write  # noqa: E402


NODES = [
    node("A", "Pointwise\nConvergence", (-6, 0),
         "For each \\(x\\) and each \\(\\varepsilon > 0\\) there is an \\(N\\) depending on both, with \\(|f_n(x) - f(x)| < \\varepsilon\\) for \\(n \\ge N\\)."),
    node("B", "Uniform\nConvergence", (1.5, 0),
         "For each \\(\\varepsilon > 0\\) there is an \\(N\\) depending only on \\(\\varepsilon\\), with \\(|f_n(x) - f(x)| < \\varepsilon\\) for \\(n \\ge N\\) and every \\(x\\) at once."),
    node("C", "Cauchy\nCriterion", (7.5, 0.8),
         "\\(\\{f_n\\}\\) converges uniformly exactly when for each \\(\\varepsilon > 0\\) there is an \\(N\\) with \\(|f_m(x) - f_n(x)| < \\varepsilon\\) for all \\(m, n \\ge N\\) and all \\(x\\)."),
    node("D", "Continuity\nof Limit", (-0.5, -3.3),
         "Each \\(f_n\\) continuous and \\(f_n \\to f\\) uniformly gives \\(f\\) continuous."),
    node("E", "Integrability\nof Limit", (3.5, -3.3),
         "Each \\(f_n\\) integrable and \\(f_n \\to f\\) uniformly gives \\(f\\) integrable, with \\(\\lim \\int f_n = \\int \\lim f_n\\)."),
    node("F", "Differentiability\nof Limit", (7.5, -3.3),
         "\\(f_n \\to f\\) pointwise together with \\(f_n' \\to g\\) uniformly gives \\(f' = g\\). It is the derivatives that have to converge uniformly."),
    node("G", "Dini's\nTheorem", (-5.5, -6.3),
         "\\(f_n \\to f\\) pointwise on \\([a,b]\\), monotonely, with every \\(f_n\\) and \\(f\\) continuous, gives \\(f_n \\to f\\) uniformly."),
    node("H", "Series of Functions\n\\(\\sum f_n\\)", (-1.5, -6.3),
         "\\(\\sum f_n\\) converges when its partial sums \\(S_N(x) = \\sum_{k \\le N} f_k(x)\\) do. A series of functions is a sequence of functions."),
    node("I", "Weierstrass\n\\(M\\)-test", (4, -6.3),
         "If \\(|f_n(x)| \\le M_n\\) for every \\(x\\) and \\(\\sum M_n < \\infty\\), then \\(\\sum f_n\\) converges uniformly and absolutely."),
    node("J", "Power Series\n\\(\\sum a_n(x-c)^n\\)", (0, -9),
         "A series of functions whose \\(n\\)th term is a monomial of degree \\(n\\) centred at \\(c\\)."),
    node("K", "Radius of\nConvergence \\(R\\)", (6, -9),
         "\\(\\sum a_n(x-c)^n\\) converges absolutely for \\(|x - c| < R\\) and diverges for \\(|x - c| > R\\). The endpoints are checked one at a time."),
    node("L", "Term-by-term\nDiff. and Integ.", (-2, -11.3),
         "Inside \\((c-R, c+R)\\) a power series can be differentiated and integrated term by term, and the result has the same radius \\(R\\)."),
    node("M", "Taylor\nSeries", (3, -11.3),
         "\\(\\sum f^{(n)}(a)(x-a)^n/n!\\). The coefficients are forced by differentiating the power series at its centre."),
    node("N", "Taylor series\nconverges to \\(f\\)", (7.5, -11.3),
         "The Taylor series converges to \\(f(x)\\) exactly when the remainder \\(R_N(x) = f(x) - P_N(x)\\) tends to zero."),
]


EDGES = [
    edge(1, "B", "A", "implies",
         "Uniform convergence is pointwise convergence with an \\(N\\) that does not depend on \\(x\\), so it is the stronger of the two.",
         "One quantifier moves and everything in the chapter follows from where it lands. Pointwise lets \\(N\\) chase \\(x\\); uniform does not."),

    edge(2, "A", "D", "fails",
         "Pointwise convergence does not carry continuity to the limit, and \\(x^n\\) on \\([0,1]\\) is the witness.",
         "Every \\(x^n\\) is continuous, the pointwise limit is \\(0\\) on \\([0,1)\\) and \\(1\\) at \\(x = 1\\), and that limit is not continuous.",
         hint="Two arrows on this map fail. This one starts at the weaker of the two kinds of convergence, the one that lets \\(N\\) chase \\(x\\), and the counterexample is a sequence of continuous functions you have met."),

    edge(3, "B", "D", "implies",
         "A uniform limit of continuous functions is continuous.",
         "The three-epsilon argument: get near \\(f_n\\) uniformly, use the continuity of that one \\(f_n\\), and come back."),

    edge(4, "B", "E", "implies",
         "A uniform limit of integrable functions is integrable, and the limit of the integrals is the integral of the limit.",
         "Uniform closeness bounds the difference of the integrals by the length of the interval times \\(\\varepsilon\\), which is what lets the two operations swap."),

    edge(5, "B", "F", "fails",
         "Uniform convergence of the functions themselves does not carry differentiability to the limit, and what does is uniform convergence of the derivatives.",
         "\\(\\sqrt{x^2 + 1/n^2}\\) converges uniformly to \\(|x|\\), which is not differentiable at \\(0\\). The theorem that does work asks for \\(f_n \\to f\\) pointwise and \\(f_n' \\to g\\) uniformly, and concludes \\(f' = g\\). Look also at \\((1/n)\\sin(n^2x)\\), where the functions converge uniformly to \\(0\\) and the derivatives diverge.",
         hint="Continuity and integrability both survive a uniform limit. This is the one that does not, and the repair is to ask for something else to converge uniformly.",
         bend=0),

    edge(6, "C", "B", "equiv",
         "A sequence of functions converges uniformly exactly when it is uniformly Cauchy, so neither statement needs the limit named in advance.",
         "This is what makes the \\(M\\)-test possible: you can prove uniform convergence of a series without ever writing down its sum."),

    edge(7, "G", "B", "implies",
         "On a closed bounded interval, monotone pointwise convergence of continuous functions to a continuous limit is already uniform.",
         "Every hypothesis is doing work. Drop compactness, monotonicity, or the continuity of the limit and there is a counterexample waiting."),

    edge(8, "H", "A", "implies",
         "A series of functions is the sequence of its partial sums, so every statement about sequences of functions applies to it unchanged.",
         "Nothing about series of functions is new. It is the sequence \\(\\{S_N\\}\\) wearing different notation."),

    edge(9, "I", "B", "implies",
         "Bounding each term by a constant whose series converges gives uniform and absolute convergence of the series of functions.",
         "The bound has to hold for every \\(x\\) with one constant per term, which is exactly how the \\(x\\) is got out of the way.",
         bend=-50),

    edge(10, "J", "K", "implies",
         "A power series converges absolutely inside one radius and diverges outside it, and that radius is what the ratio or root test computes.",
         "The trichotomy is the theorem. What happens at the two endpoints is decided separately and can go either way."),

    edge(11, "J", "B", "implies",
         "Inside its radius a power series converges uniformly on every closed bounded subinterval, which is what licenses working on it term by term.",
         "Uniform on compact subsets, not on the whole open interval. That distinction is why the statement names a closed bounded subinterval."),

    edge(12, "J", "L", "implies",
         "Because the convergence is uniform on compact subintervals, a power series can be differentiated and integrated term by term, and the result keeps the same radius.",
         "The interchange theorems supply this, and the radius is unchanged because the ratio or root test sees the same limit for the derived series."),

    edge(13, "L", "M", "implies",
         "Differentiating term by term at the centre forces the coefficients to be \\(f^{(n)}(c)/n!\\), so a function has at most one power series about a point.",
         "Uniqueness comes free. Any two power series agreeing near a point have the same coefficients, because both sets are computed from the same derivatives."),

    edge(14, "M", "N", "implies",
         "The Taylor series converges to \\(f\\) at a point exactly when the remainder tends to zero there, which is a statement about \\(f\\) and not about the coefficients.",
         "A series can have every Taylor coefficient of \\(f\\), converge everywhere, and still not converge to \\(f\\). The remainder is what decides it."),

    edge(15, "H", "D", "implies",
         "Applying the interchange theorems to the partial sums gives the matching statements for the sum of a series of functions.",
         "A uniformly convergent series of continuous functions has a continuous sum, and can be integrated term by term, for exactly the reason the sequence version holds."),
]


# Claims a student might make about this chapter, all false. They stay in the bank
# whatever else has been solved, so the last arrow is still a decision.
DECOYS = [
    "A uniform limit of differentiable functions is differentiable.",
    "A power series and the series obtained by differentiating it term by term have different radii of convergence.",
    "A function with derivatives of every order at a point is the sum of its Taylor series near that point.",
    "Pointwise convergence on a closed bounded interval is automatically uniform.",
    "A series of continuous functions that converges pointwise has a continuous sum.",
]


DATA = {
    "id": "func-sequences",
    "title": "Sequences and series of functions",
    "intro": (
        "Fourteen ideas from the chapter on sequences and series of functions, with "
        "fifteen arrows between them and nothing written on any arrow. An arrow is a "
        "relationship, and not always an implication: sometimes the first box gives "
        "you the second, sometimes it doesn't and there's a counterexample, and "
        "sometimes each gives the other. The picture does not say which. For each "
        "arrow write down your own description first, then decide which of the three "
        "it is, then find your sentence in the list. Click any box to be reminded "
        "what it means."
    ),
    "reflection": (
        "Which single arrow carries the most of this chapter? Say why in one sentence. "
        "If you pick one of the two that fail, say what you would have expected "
        "instead and what the counterexample costs you."
    ),
    "nodes": NODES,
    "edges": EDGES,
    "decoys": DECOYS,
    "benchmarks": [
        "\\(x^n\\) on \\([0,1]\\) takes continuous functions to a discontinuous limit, pointwise.",
        "\\(\\sqrt{x^2 + 1/n^2} \\to |x|\\) uniformly, and the limit is not differentiable at \\(0\\).",
        "\\((1/n)\\sin(n^2x) \\to 0\\) uniformly while its derivatives diverge.",
        "\\(x/(1 + n^2x^2) \\to 0\\) uniformly, and the derivative of the limit is not the limit of the derivatives at \\(0\\).",
        "\\(e^{-1/x^2}\\) extended by \\(0\\) is infinitely differentiable at \\(0\\) with every Taylor coefficient zero, so its Taylor series converges and not to it.",
    ],
}


if __name__ == "__main__":
    write(DATA)
