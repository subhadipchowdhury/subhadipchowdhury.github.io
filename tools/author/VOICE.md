# Voice

A model of how Dip writes to students, extracted from two full sets of his lecture
notes: `Spring2026_Math163_Lecture_Notes.pdf` (Honors Calculus III, 121 numbered
questions) and `Winter2026_Math212_Lecture_Notes.pdf` (Advanced Numerical
Analysis, 78 numbered questions). Every rule below is followed by a quotation
from one of those two documents. Where a rule forbids something, the forbidden
example is real copy from an earlier draft of the Newton lab.

This governs student-facing text: lab intros, puzzle briefs, setup captions,
feedback messages, and page chrome. It does not govern code comments.

## The voice in one paragraph

He writes the way someone talks while working a problem at a board, for an
audience he assumes is capable. The mathematics stays exact and the register
stays informal: contractions throughout, `Let's` as the default transition,
`we` doing the mathematics and `you` doing the work. He motivates before he
defines, names the people involved, admits when something is hard or when he is
skipping a proof, and signposts what is coming. He asks real questions and
leaves real blanks. He does not write aphorisms.

## Rules

### 1. `Let's` is the default transition

It appears roughly twenty times across the two documents and is the single most
recognisable feature of the voice.

> Let's warm up with some intuition.
> Let's see definition 4 in action by verifying the simplest case.
> Let's put theorem 14 to work on some examples.
> So, let's prove that instead.
> Let's start by defining what we mean by "best".
> Let's start with a quick Linear Algebra detour.
> Let's collect the logical dependencies of what we have proved.

Use it. It is not filler here; it is the sound of the two of you doing the work
in the same room.

### 2. `we` do the mathematics, `you` do the work

The split is consistent and never violated.

> we call our "dots" data points in the xy-plane
> we can show that this matrix is invertible
> we dodge the measure-theoretic complexities

against

> Your input should be n.
> Use your code to build the Vandermonde interpolation polynomial
> You will see in your homework that we cannot drop any one of the three hypotheses

### 3. Contractions, always

`we're`, `you've`, `don't`, `can't`, `doesn't`, `let's`, `we'll`, `it's`,
`that's`, `Here's`. Never expand them for formality.

> Now that we're all grown up, we call our "dots" data points
> So clearly, we can't use the GMVT to pull out a f⁽³⁾(η) term
> This approach doesn't require special interpolation points

### 4. Motivate, then define

The order is: the problem, why the obvious thing fails, the definition, an
example, then the question. Never definition first.

> In practice, the comparison test can be awkward because it requires the
> inequality aₙ ≤ cbₙ to hold exactly. The following variant is often easier to
> apply: if two series have the same rate of growth, they should converge or
> diverge together.

> One problem with a linear splines can be that they are not necessarily
> differentiable where two different linear pieces meet. Still, these functions
> are easy to construct and cheap to evaluate [...] To get around these issues,
> we can use quadratic or cubic splines instead.

### 5. A rhetorical question is the standard transition into new material

> But does it always make sense to talk about the sum of infinitely many terms?
> So how do we deal with a series that has both positive and negative terms?
> What additional condition guarantees that the full sequence converges?
> But what is distance, really?
> What if we wanted a diagonal A?
> So, why would anyone do this?
> What invisible obstacle prevents it from extending past x = ±1?

### 6. Name the people, with a nationality or a fact

Consistent enough to count as a habit.

> the Russian mathematician Pafnuty Chebyshev (1821-1894)
> the German mathematician and physicist Carl David Tolmé Runge
> The Romanian mathematician Isaac Jacob Schoenberg is credited with...
> British mathematician John Couch Adams, who also famously used mathematics to
> predict the existence and position of the planet Neptune
> The following grouping argument is due to Nicole Oresme (c. 1350).
> in 1848, Stokes and Seidel (independently and almost simultaneously)

### 7. Leave real blanks, and label the steps

His proofs are scaffolded with literal gaps and run-in step labels. This is the
direct ancestor of the puzzle format.

> Sketch of Proof:
> Setup: Let ε > 0.
> Choose: Consider a natural number N with N > ____ which exists by the
> Archimedean property of natural numbers.
> Verify: Then, for n > N, we have |aₙ − 0| = 1/n < 1/N < ____.

> (a) Step 1: Show that Cauchy sequences are bounded. [...] the terms
> a_{N+1}, a_{N+2}, ... all lie in the interval ( ____ , ____ ).
> (b) Step 2: Extract a convergent subsequence.
> (c) Step 3: Show that the full sequence converges to l.

### 8. `(why?)` is the hint

A bare parenthetical question, not an instruction to go and think.

> Each sₙ is integrable (why?), and sₙ ⇉ f.
> The sequence {s′ₙ} converges uniformly (why?).
> Strict diagonal dominance implies that A is nonsingular (Why?).
> (Why does this also give part (2) of the theorem for free?)

Never `Ask which...` or `Ask yourself...`. Ask the question.

### 9. Say plainly when something is hard, unproved, or unsatisfying

> Determination of the coefficients is rather complicated and requires
> multivariate Taylor series computations.
> Although we will not prove it here, one can show that...
> We will also make a claim without proof.
> After the positive results for continuity and integrability, the situation for
> differentiability is disappointing.
> This may sound as though we are assuming what it is we would like to prove,
> and there is some validity to this complaint.
> The situation for arctan is more mysterious.

### 10. Dry humour, used sparingly, and real exclamation marks

> Since we want to sound more fancy than a calculus course, we will use the
> exotic new term quadrature
> The idea behind interpolation is something you've practiced since Kindergarten:
> Connecting the dots.
> We will start with a result that I am comfortable labeling as an "obviously"
> true statement.
> and voila! Suddenly, the product is a function of x that is negative everywhere
> The identity function does nothing, yet it is continuous in one direction and
> not the other!
> (We don't know what l is, but that's fine!)
> A set that is both open and closed is called clopen!

One per section at most. It lands because the surrounding prose is straight.

### 11. Quotation marks around a term being introduced or used loosely

> our "dots"
> what we mean by "best"
> "Flatter" f ⟹ better fit
> two "types" of series
> a "remainder" function r(x)
> a kind of pseudo-spline
> the "ε = 1 trick"
> the "inverse problem"
> beyond the first and final 'ducks'

### 12. Point forward and back

> which will be a central topic in your Analysis course next year
> we will revisit this question in the next section
> You have already seen a tool for this in Math 162.
> As we will see in lab assignment 3.5, this indeed reduces the error
> This is essentially true until n = 8.

Inside a lab this has to stay inside the lab (nothing may presume the course
schedule; see the `PRESUMED` list in `tools/validate.mjs`), but the *habit* of
telling the reader where a thing leads carries over.

### 13. Restate the hard sentence

> In other words, ...        (about ten occurrences)
> In simpler words, there is a unique C¹ solution to the IVP that...
> In plain language, proposition 55 says that uniformly convergent series of
> continuous functions can be integrated term by term
> That is, if lim aₙ = l and lim aₙ = m, then l = m.

### 14. `So`, `Now`, `Then`, `Next` open sentences freely

> So our iteration takes the form
> Now note that in the interval [xᵢ, xᵢ+h], the product is always negative.
> Then we can write
> Next, consider another interesting example.

## The structural moves

**Module opener.** Where we were → the shift → the goal → a hook → warm up.

> Over the past two quarters, we have developed a rigorous theory of limits,
> continuity, differentiability, and integration for functions f : R → R. This
> quarter, we shift our attention to a seemingly simpler object: infinite lists
> of numbers [...] Our goal in this chapter is to make precise what it means for
> such a list to "converge," and to develop tools for proving convergence when
> the limit is not obvious. [...] Let's warm up with some intuition.

**Lab brief.** This is Math 212 §1.3 and it is the exact template for a puzzle
brief: set the expectation, break it, name and attribute the phenomenon,
diagnose the cause, give the fix as a numbered construction, then ask.

> You might expect polynomial interpolation to converge as n → ∞. Surprisingly,
> this is not the case if you take equally-spaced nodes xᵢ. This was shown by
> Runge in a famous 1901 paper.
>
> [Question 17 (a)–(e): build the nodes, build the interpolant, plot, predict,
> plot the error.]
>
> What you are seeing here is referred to as "Runge phenomenon" [...] This is not
> an issue of numerical instability but rather a fatal flaw associated with
> uniformly spaced interpolation points.
>
> The problem is (largely) coming from the polynomial w(x) = (x−x₀)...(x−xₙ)
> that showed up in the expression of Eₙ(x) in the last section. Check that the
> problem is mostly occurring near the ends of the interval, so it would be
> logical to put more nodes there to reduce the error. A good choice was first
> proposed by the Russian mathematician Pafnuty Chebyshev (1821-1894). The idea
> is as follows:
> • Draw a semicircle above the closed interval on which you are interpolating.
> • Pick (n+2) equally spaced points, including the end points, along the
>   semicircle (i.e. same arc length between each point).
> • Then choose the midpoints of each of these arcs to get a list of (n+1) points.
> • Project the (n+1) points on the semicircle down to the interval.

Note the order: the geometric picture first, and only then `Show that the
Chebyshev nodes are given by xⱼ = cos((2j+1)π/(2(n+1)))`. The formula is the
answer to a question the picture has already raised.

**Module close.** Pull the thread, then say where it goes.

> We end the quarter where most of mathematics begins, with the recognition that
> the same ideas, expressed at the right level of generality, apply across a vast
> range of settings. [...] The language will be new, but the ideas are the ones
> you have been building all year.

## Question verbs he actually uses

Prove · Show that · Check that · Explain why · Use X to Y · Find · Determine
whether · Give an example of · Consider · Define · Write down · Write code ·
Compute · Apply · Investigate · Sketch · Draw · Test whether · Fill in the
details · Fill in the blanks · Complete the argument · Verify · Solve for ·
Count · Discuss · Interpret · Report · Compare · Repeat

Question-form questions he actually asks:

> Is the converse true?
> Can you think of a sequence that diverges but not to ±∞?
> What are the advantages of using the Newton basis over the monomial basis?
> What did you observe?
> Does this match your expectations? Why or why not?
> What does this plot tell you about Vandermonde interpolation?
> Which one did a better job of estimating the function near the endpoints?

## Banned

Things that appear zero times in 145 pages of his writing, and that the earlier
lab copy was full of.

| Banned | What was there | Write instead |
|---|---|---|
| A verbless fragment built on a comma | `Housekeeping, not algorithm.` `Same iterations, different fence.` `Same entries, same order.` | A sentence with a subject and a verb. He has essentially none of these. |
| A stock task label | `**Your job.**` at the head of every brief | An imperative sentence: `Show that...`, `Write down...`, `Turn the recurrence into...` |
| Telling the student to ask | `Ask which direction the table fills` | The bare question, or `(why?)` |
| Filler emphasis | `A convention shift worth noticing:` | Say the thing, or cut it |
| Flourish in place of explanation | `That is what makes the table a triangle.` | The reason: `A difference of order j needs j+1 consecutive nodes, so column j has j fewer entries than column 0.` |
| Inflation | `crucial`, `powerful`, `elegant` | Nothing. He calls one thing elegant in 145 pages and it is a genuine reformulation of continuity. |
| `simply`, `straightforward` | tells a stuck student their problem is easy | cut |
| Em dash | | comma, full stop, or brackets (standing rule in `CLAUDE.md`; his notes use a few, mine do not) |

## What the validator checks

`tools/validate.mjs` enforces the mechanical half of this against every lab spec
and fails the build:

- the banned phrase list (`TICS`)
- em dashes
- comma fragments of five words or fewer
- an imperative sentence somewhere in every brief
- no phrase presuming the course schedule (`PRESUMED`)
- a warning when a four-word phrase turns up in three or more places

`tools/test/lab.test.mjs` runs the tic list over the rendered page, which covers
the chrome that `lab.js` and `feedback.js` write and no spec check can see.

The rest of this document is not machine-checkable. Read it before writing a
lab, and reread the Math 212 §1.3 block above before writing a brief.
