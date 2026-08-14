"""The infinite series concept map, from chapter 2 of Practice Worksheet 3.

Fifteen boxes and sixteen arrows, with the tikz coordinates carried over so the
screen version and the printed version have the same shape.

Every arrow is a relationship that holds in the direction drawn. Arrows 5 and 14
used to be failures, drawn dashed with a cross: "terms tending to zero does not give
convergence" and "convergence does not give absolute convergence". Dip had both
rewritten on 2026-08-13, because each is a genuine relationship stated backwards. 5
is now C to E, a convergent series has terms tending to zero, with the divergence
test as its contrapositive. 14 is now C to N, which is the definition of conditional
convergence. Both counterexamples survive in the reason lines and in the benchmarks.

Run it to rewrite teaching/labs/maps/data/series.json.
"""

import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from mapkit import edge, node, write  # noqa: E402


NODES = [
    node("A", "Infinite Series\n\\(\\sum a_n\\)", (1.5, 0),
         "The expression \\(a_1 + a_2 + a_3 + \\cdots\\). It has no meaning until the partial sums give it one."),
    node("B", "Partial Sums\n\\(\\{s_n\\}\\)", (-1.5, -2),
         "\\(s_n = a_1 + \\cdots + a_n\\). An ordinary sequence, so everything you know about sequences applies to it."),
    node("C", "Convergent\nSeries", (-4, -5.8),
         "\\(\\sum a_n\\) converges when \\(\\{s_n\\}\\) has a finite limit, and the sum is that limit."),
    node("D", "Divergent\nSeries", (7, -5.8),
         "\\(\\sum a_n\\) diverges when \\(\\{s_n\\}\\) fails to converge, whether it runs away or oscillates."),
    node("E", "Divergence\nTest", (6, -3),
         "If \\(a_n \\not\\to 0\\) then \\(\\sum a_n\\) diverges. It is a test for divergence only, and it never certifies convergence."),
    node("F", "Geometric\nSeries", (-1, -3.8),
         "\\(\\sum ar^n\\), which converges exactly when \\(|r| < 1\\), with sum \\(a/(1-r)\\) and partial sums \\(a(1-r^n)/(1-r)\\)."),
    node("G", "Telescoping\nSeries", (3, -3.8),
         "\\(\\sum (b_n - b_{n+1})\\), whose partial sums collapse to \\(b_1 - b_{n+1}\\)."),
    node("H", "\\(p\\)-Series\n\\(\\sum 1/n^p\\)", (-0.5, -11),
         "Converges exactly when \\(p > 1\\). The boundary \\(p = 1\\) is the harmonic series, which diverges."),
    node("I", "Nonneg Series\n\\(+\\) MCT", (-6.5, -8.5),
         "If \\(a_n \\ge 0\\) the partial sums increase, so the monotone convergence theorem turns convergence into boundedness."),
    node("J", "Comparison\nTests", (-7.5, -11),
         "Direct: \\(0 \\le a_n \\le cb_n\\) eventually and \\(\\sum b_n\\) convergent gives \\(\\sum a_n\\) convergent. Limit: \\(\\lim a_n/b_n \\in (0,\\infty)\\) gives the same behaviour for both."),
    node("K", "Integral\nTest", (-4, -11),
         "If \\(f\\) is positive, continuous and eventually decreasing with \\(f(n) = a_n\\), then \\(\\sum a_n\\) and \\(\\int_1^\\infty f\\) converge or diverge together."),
    node("L", "Dirichlet's\nTest", (-2, -8.5),
         "If \\(a_n\\) decreases to \\(0\\) and the partial sums of \\(b_n\\) are bounded, then \\(\\sum a_n b_n\\) converges. Proved by summation by parts."),
    node("M", "Absolute\nConvergence", (2.5, -8.5),
         "\\(\\sum a_n\\) converges absolutely when \\(\\sum |a_n|\\) converges. This is strictly stronger than convergence."),
    node("N", "Conditional\nConvergence", (4, -11),
         "\\(\\sum a_n\\) converges conditionally when it converges and \\(\\sum |a_n|\\) does not. The convergence rests on cancellation."),
    node("O", "Ratio and\nRoot Tests", (7, -8.5),
         "With \\(L = \\lim |a_{n+1}/a_n|\\) or \\(L = \\limsup |a_n|^{1/n}\\): absolutely convergent if \\(L < 1\\), divergent if \\(L > 1\\), and no conclusion if \\(L = 1\\)."),
]


EDGES = [
    edge(1, "A", "B", "holds",
         "Convergence of the series is defined to be convergence of its sequence of partial sums.",
         "Nothing else defines it. Every test in this chapter is a statement about the partial sums, reached without ever computing them."),

    edge(2, "B", "C", "holds",
         "If the partial sums have a finite limit then the series converges, and its sum is that limit.",
         "The definition read from left to right."),

    edge(3, "B", "D", "holds",
         "If the partial sums fail to converge then the series diverges, and running off to infinity is only one of the ways that happens.",
         "Divergence is the negation of convergence, so unbounded partial sums and oscillating ones are both covered by it.",
         bend=-110),

    edge(4, "E", "D", "holds",
         "Terms that do not tend to zero leave the partial sums unable to settle, so the series diverges.",
         "The difference \\(s_n - s_{n-1}\\) is \\(a_n\\). If \\(s_n\\) had a limit, that difference would have to tend to zero."),

    edge(5, "C", "E", "holds",
         "A convergent series has terms tending to zero, and the divergence test is that theorem read in contrapositive form.",
         "The two are one statement. \\(s_n - s_{n-1} = a_n\\), so a convergent \\(s_n\\) forces \\(a_n \\to 0\\). Read the other way it is a test for divergence and nothing else: \\(1/n \\to 0\\) while \\(\\sum 1/n\\) diverges, so the condition is necessary and not sufficient.",
         bend=100),

    edge(6, "F", "C", "holds",
         "A geometric series converges exactly when its ratio has modulus below one, and then the closed form for the partial sums gives the sum.",
         "One of the two series here whose partial sums you can write down, which is why the comparison tests are run against it."),

    edge(7, "G", "C", "holds",
         "In a telescoping series consecutive terms cancel, so the partial sums collapse and converge exactly when \\(b_n\\) does.",
         "The other series whose partial sums you can write down. The sum is \\(b_1\\) minus the limit of \\(b_n\\)."),

    edge(8, "I", "C", "holds",
         "For a series of nonnegative terms the partial sums increase, so the series converges exactly when they are bounded above.",
         "This is what every test for a nonnegative series is really using. Boundedness has replaced the limit, and a bound is something you can find without knowing the sum."),

    edge(9, "I", "J", "holds",
         "Bounding a nonnegative series term by term against a series you already know bounds its partial sums.",
         "Direct comparison bounds the partial sums; limit comparison compares growth rates instead and reaches the same conclusion for both series."),

    edge(10, "I", "K", "holds",
         "Comparing a decreasing positive term with the area under the matching function bounds the partial sums by an improper integral.",
         "The rectangles drawn on either side of the graph give the two inequalities, and both of them need \\(f\\) positive, continuous and eventually decreasing."),

    edge(11, "K", "H", "holds",
         "The integral test is the one tool here that settles the \\(p\\)-series, and applied to \\(1/x^p\\) it puts the threshold at \\(p = 1\\).",
         "\\(\\int_1^\\infty x^{-p}\\,dx\\) is finite exactly when \\(p > 1\\), and \\(p = 1\\) is the harmonic series on the wrong side of the line. Nothing else on this map reaches it: the ratio and root tests both return one for every \\(p\\), and comparison needs a benchmark, which for a \\(p\\)-series means another \\(p\\)-series."),

    edge(12, "L", "C", "holds",
         "A sequence decreasing to zero paired with bounded partial sums gives a convergent series, and the alternating series test is the case where the second factor is \\((-1)^n\\).",
         "The proof is summation by parts, which is the discrete version of integration by parts. For a case that is not alternating at all, look at \\(\\sum \\sin(n\\theta)/n\\)."),

    edge(13, "M", "C", "holds",
         "A series whose terms are absolutely summable converges, so the absolute version is the stronger property.",
         "The Cauchy criterion gives it: by the triangle inequality the tails of \\(\\sum |a_n|\\) control the tails of \\(\\sum a_n\\)."),

    edge(14, "C", "N", "holds",
         "A series that converges while its absolute version diverges is what conditional convergence means.",
         "The alternating harmonic series is the case to hold on to: \\(\\sum (-1)^{n+1}/n\\) converges to \\(\\ln 2\\) and \\(\\sum 1/n\\) diverges. Dropping the signs destroys the cancellation the convergence was resting on, which is why absolute convergence is the stronger property and not the same one."),

    edge(15, "O", "M", "holds",
         "The ratio and root tests compare the sizes of the terms against a geometric series, so what they establish is the absolute version.",
         "Both of them run on \\(|a_n|\\), and both are silent at the value one, where \\(\\sum 1/n\\) and \\(\\sum 1/n^2\\) sit on opposite sides of the answer."),

    edge(16, "L", "N", "holds",
         "Dirichlet's test certifies convergence without ever looking at the absolute version, which is how a conditionally convergent series is produced.",
         "The alternating harmonic series again: Dirichlet's test gives the convergence and the harmonic series denies the absolute version, which is what conditional convergence means."),
]


# False claims a student might reasonably make. They were distractors in the answer
# bank until 2026-08-13; with the bank gone they are a list of things to check your
# own sentences against, shown with the answers.
MISTAKES = [
    "A series of nonnegative terms converges exactly when its terms tend to zero.",
    "Bounded partial sums are enough for a series to converge.",
    "Rearranging the terms of a convergent series never changes its sum.",
    "The integral test applies to any series whose terms are positive.",
    "A series that passes the ratio test at \\(L = 1\\) diverges.",
]


DATA = {
    "id": "series",
    "title": "Infinite series",
    "intro": (
        "Fifteen ideas from the chapter on series, with sixteen arrows between them and "
        "nothing written on any arrow. Every arrow is a relationship that holds in the "
        "direction drawn, and it does not have to be an implication: often one box is "
        "the tool that settles the other, and sometimes one is defined in terms of the "
        "other. Work out what each arrow says, in your own words, and then check "
        "yourself against the list at the bottom. Click any box to be reminded what it "
        "means, and click a numbered circle to see that one arrow's answer on its own."
    ),
    "reflection": (
        "Which single arrow carries the most of this chapter? There is more than one "
        "defensible answer, and the argument is the useful part."
    ),
    "nodes": NODES,
    "edges": EDGES,
    "mistakes": MISTAKES,
    "benchmarks": [
        "The harmonic series \\(\\sum 1/n\\) diverges even though its terms tend to zero.",
        "The alternating harmonic series \\(\\sum (-1)^{n+1}/n\\) converges conditionally, to \\(\\ln 2\\).",
        "\\(\\sum \\sin(n\\theta)/n\\) converges by Dirichlet's test and is not alternating.",
        "Summation by parts is the discrete integration by parts, and it is what proves Dirichlet's test.",
        "The Cauchy criterion for series: control every far enough tail at once, not one chosen tail.",
    ],
}


if __name__ == "__main__":
    write(DATA)
