# AI guidelines

Design guidelines for the computational labs, adopted from the [Leiden
Declaration on Artificial Intelligence and Mathematics](https://leidendeclaration.ai/)
(2 June 2026), "Recommendations for individual mathematicians".

These sit alongside `VOICE.md`. `VOICE.md` governs how student-facing text
sounds; this governs how the labs are built, disclosed and attributed. Read both
before authoring a lab.

The eleven recommendations are quoted or summarised below, each followed by what
it means for this project specifically. Where a recommendation has no bearing
here, that is said rather than padded.

## 1. Disclose tool use

> Transparently disclose the use of automated tools, including large language
> models, machine learning systems, proof assistants, and other mathematical
> software.

The labs are built with substantial AI assistance: the engine, the build
pipeline, most puzzle prose and every feedback message. That is disclosed on
every lab page, not buried in a repository README a student will never open.
The disclosure names what was assisted and what was verified by a human, because
"AI was used" on its own tells the reader nothing actionable.

## 2. Support the needs of reviewing

Aimed at peer review, so it applies only by analogy. The analogue here is that
another instructor should be able to check a lab. The build is reproducible from
the notebook, `validate.mjs` states its rules in one file, and every distractor
carries the message it is required to trigger. Keep it that way.

## 3. Adhere to principles of open science

The repository is public and the content is CC BY-NC-SA. The notebooks are
plain `.ipynb` and open in Colab without an account barrier beyond Google's.
Nothing in a lab depends on a service that could withdraw it.

## 4. Retain the responsibility for correctness

> Authors bear exclusive responsibility for the correctness, adequacy, and
> proper citation of results obtained through automated techniques.

The load-bearing one for our workflow. Every mathematical claim in a brief,
every feedback message, and every "wrong answer" classification is Dip's
responsibility regardless of what generated it. Generated prose is a draft until
he has read it. The `bound_off_by_one` message that shipped telling students to
count entries, when the count was exactly the wrong answer they had just given,
is the standing example of why.

## 5. Affirm the humanity of authorship

> Credit and responsibility belong to humans; automated systems should not
> receive attribution.

Dip is the sole author of these labs. No AI system is credited as an author,
co-author or contributor anywhere student-facing.

This extends to the commit history. Commits carried a `Co-Authored-By: Claude`
trailer until 2026-08-13; it has been dropped, because the word "co-authored" is
an authorship claim whatever the intent behind it. Tool use is disclosed on the
lab pages and in this file, which is recommendation 1's business, not
recommendation 5's. Do not reintroduce the trailer.

## 6. Put effort into proper attribution

> Proactively seek and credit sources contributing to new results, explicitly
> stating when satisfactory attribution is impossible.

Already the house style: `VOICE.md` rule 6 requires naming the mathematician
with a nationality or a fact. Newton, Chebyshev, Runge, Schoenberg, Lagrange.
Extend it to sources beyond people: where a lab's framing comes from a
particular text, say so.

## 7. Participate in public discourse

No direct bearing on lab construction. The disclosure on the lab pages is a
small contribution to it.

## 8. Stay informed about emerging technologies

No design implication. It is a reason the labs exist at all: students arrive
already using these tools.

## 9. Welcome new contributors

Make the standards explicit and accessible. In practice: the build refuses to
ship a lab that fails the editorial rules, and those rules are readable in one
file rather than tacit. Anyone should be able to author a lab from `VOICE.md`,
this file, and an existing `*_lab.py`.

## 10. Consider carefully which tools to use

> Evaluate whether tools align with the declaration's provisions and consider
> non-proprietary or energy-efficient alternatives.

What ships to the student is the relevant question, and nothing AI-based does.
The engine is dependency-free JavaScript, the puzzles are graded locally in the
browser, and no request leaves the page. That is worth stating in the
disclosure, because a student reading "built with AI" will reasonably wonder
whether their work is being sent somewhere.

## 11. Evaluate the ethical consequences of your work

For a teaching tool the consequences are student-facing:

- No telemetry. Progress lives in `localStorage` and nothing is transmitted.
- The gate is pedagogical, not punitive. A student can set a puzzle aside.
- The puzzles are trivially solvable by any chatbot. Design accordingly: the
  point is the reasoning, and a lab whose only defence is obscurity is not
  worth building.

## Where the disclosure lives

`_layouts/lab.html` carries it, in the footer of every lab page. Three parts:

1. A visible lede, never collapsed, because a disclosure behind a closed toggle
   is not a disclosure. It says the labs were built with AI assistance, that the
   mathematics was checked by a human, and that nothing leaves the browser.
2. "How this lab was built", addressed to anyone. Tool use, human
   responsibility, and the fact that no request goes to an AI service.
3. "Using AI on this lab", addressed to the student. What the puzzles are for
   and why solving them with a chatbot wastes their own time.

Parts 2 and 3 are separate headings on purpose. Disclosing Dip's tool use and
setting expectations for a student's are different statements in different
voices, and blending them into one paragraph reads as though the second is
excusing the first.

A shorter version, the same three points compressed into three paragraphs, sits
in the footer of the library index at `teaching/labs/index.html` under
`.cl-ai`. A student who never opens a lab still sees it there.

The whole disclosure is duplicated in `tools/demo/lab-demo.html`, which stands in
for the layout locally. Change one and change the other. That makes three copies
of this text in total; keep them in step.

Keep it plain. The first draft of this disclosure carried lines like "Both are
mistakes, and stopping is more use to you than quietly carrying on" and "asks
for this kind of disclosure and I think it's right", which are throat-clearing
rather than information. Dip cut them on 2026-08-13. State the fact and stop.

Note a gap: `lab.test.mjs` runs the tic list over the page `lab.js` renders, so
it does not see this footer, which Jekyll emits. Nothing machine-checks the
disclosure prose against `VOICE.md`.
