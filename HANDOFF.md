# Handoff

State of the guided-lab project as of 2026-07-30. Written so a new session on a
new machine can pick up cold. Read this, then `tools/author/VOICE.md`, then the
"Next up" list at the bottom.

`CLAUDE.md` is gitignored, so it travels through OneDrive, not git. If the repo
was cloned fresh rather than synced, `CLAUDE.md` is missing and needs restoring.

`HANDOFF.md` is in `_config.yml`'s exclude list, so Jekyll does not publish it.

---

## The project

Dip's numerical analysis students click Launch on a Colab notebook and
Shift-Enter through it without reading anything. The fix: put the algorithms
behind Parsons-style drag-and-drop puzzles. A student reconstructs each
algorithm from scrambled **pseudocode** blocks (not Python, because the course
is about analysing algorithms), and the notebook only opens once all the puzzles
in that lab are solved.

The lab page carries **only the puzzles**. Plots, tables, sliders and Python all
live in the notebook. The exception is output that raises the question a puzzle
answers; that may sit above the puzzle as a `setup`.

Every card in the library will eventually be a guided lab. One is built
(`m1-newton`); the rest are marked `drafted` and hidden.

Timeline: usable by roughly early September 2026.

---

## Where everything is

### Runtime, shipped to the browser

| Path | Lines | What it is |
|---|---|---|
| `teaching/applet/lab/engine/interp.js` | 1206 | Pseudocode interpreter: tokenizer, Pratt parser, tree-walking evaluator with a step cap. Exports `parseProgram`, `run`, `evalExpression`, `valuesEqual`, `fmtNum`, `ParseError`, `RuntimeError`. |
| `teaching/applet/lab/engine/verify.js` | 687 | The grader. Five stages: completeness, parse, interpret, compare, diagnose. Exports `buildReference`, `verify`, `renderTriangle`. |
| `teaching/applet/lab/engine/puzzle.js` | 956 | The drag/tap board. `PuzzleView`, `defaultOrder`, `snapIndent`, `INDENT_STICK`. |
| `teaching/applet/lab/engine/feedback.js` | 215 | Failure card and the five-stage hint ladder. |
| `teaching/applet/lab/engine/lab.js` | 623 | Page controller. `mountLab`, `LabController`, `Progress`, `devMode`. |
| `teaching/applet/lab/engine/lab.css` | 765 | Built on the site's tokens (`--color-surface`, `--accent`, `--border-color`, `--focus-ring`) with a `--lab-*` layer on top. |

### Build and check, never shipped (`tools/` is in `_config.yml` exclude)

| Path | Lines | What it is |
|---|---|---|
| `tools/build_labs.py` | 468 | Reads lab metadata out of notebook cell metadata, checks every pinned line number against its `py_match`, executes the notebook, runs the `setup` snippets, builds the `reveal` mapping, writes the spec JSON, the setup figures and `specs/index.json`. |
| `tools/validate.mjs` | 493 | Build-time spec validation. Mechanical checks plus editorial rules. `build_labs.py` refuses to ship a spec this rejects. |
| `tools/author/newton_lab.py` | 429 | Readable source for the Newton lab's metadata. Running it overwrites the `lab` keys in the notebook and nothing else. |
| `tools/author/VOICE.md` | 260 | The voice model, extracted from two of Dip's lecture-note PDFs. Governs all student-facing text. |
| `tools/test/*.test.mjs` | 1682 | 137 tests: interp 64, lab 32, puzzle 13, verify 28. |
| `tools/test/dom-stub.mjs` | 333 | Fake DOM with a mini CSS selector engine, so `lab.js` can be tested without a browser. |
| `tools/demo/*.html` | | Standalone pages for poking at the puzzle and the lab locally. |

### Site

| Path | What it is |
|---|---|
| `teaching/applet/index.html` | The card library. Single self-contained file: front matter, CSS, markup, controller. Now titled **Computational Labs**. |
| `teaching/applet/lab/m1-newton.html` | Front matter only. `layout: lab`, `lab_id: m1-newton`, `robots: false`. One of these per lab. |
| `_layouts/lab.html` | Loads `lab.css`, mounts `lab.js` against `specs/{lab_id}.json`. |
| `teaching/applet/lab/specs/*.json` | Generated. Do not hand-edit. |
| `teaching/applet/notebooks/na/*.ipynb` | 15 numerical analysis notebooks. Source of truth for lab metadata. |
| `teaching/applet/wip/m1_lab_design.md` | The original design doc from Fable 5, 710 lines. Excluded from the build. Historical; the implementation has moved past it in places. |

---

## How to run it

There is **no node** on the machine. JavaScript runs under macOS's JavaScriptCore
shell:

    /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc

It supports `-m` for modules, `globalThis.arguments` after `--`, `read()`,
`print()` and `quit()`. `quit()` takes no exit code, so `tools/test/run.sh` and
`build_labs.py` both look for a marker string in the output instead.

Python is the project venv, which has numpy, matplotlib, nbclient and nbformat.
The system python has none of them.

    # rewrite the Newton lab metadata into the notebook
    .venv/bin/python tools/author/newton_lab.py

    # execute the notebooks, build every spec, validate
    .venv/bin/python tools/build_labs.py
    .venv/bin/python tools/build_labs.py m1-newton      # one lab
    .venv/bin/python tools/build_labs.py --no-run       # skip execution

    # 137 tests
    bash tools/test/run.sh

    # validate a spec on its own
    jsc -m tools/validate.mjs -- teaching/applet/lab/specs/m1-newton.json

    # local preview
    python3 -m http.server 8817        # then tools/demo/lab-demo.html

### Test mode on a lab page

`?dev=1` on the URL, or `localStorage.setItem('lab:dev', '1')`. Adds a "Solve
everything" button, a per-puzzle "Solve this one", and "Clear progress", so the
page can be walked without doing the puzzles. `tools/demo/lab-demo.html` turns it
on automatically.

Student progress is in `localStorage` under `lab:2:{labId}:{cellId}`, stamped
with a hash of the gate so an edited puzzle discards stale saved state.

---

## The pipeline, end to end

1. **Author** writes the lab spec as Python dicts in `tools/author/<lab>_lab.py`
   and runs it. That writes a `lab` key into the metadata of the relevant
   notebook cells. The notebook is the source of truth from then on; Colab
   ignores unknown metadata.
2. **`build_labs.py`** walks the notebooks, finds cells with `lab` metadata,
   checks every pinned line number against its `py_match` substring (so an edit
   to the Python that shifts a line fails the build), executes the notebook with
   nbclient, runs each `setup` snippet against the executed namespace, captures
   stdout and figures, builds the `reveal` mapping from pseudocode block to
   Python line, renders the markdown to HTML, and writes the spec.
3. **`validate.mjs`** runs against the spec before it ships. It pushes every
   distractor and every wrong blank answer through the real grader and requires
   two things of each: that it is rejected, and that it comes back carrying the
   message written for it. Then the editorial rules.
4. **The page** loads the spec, mounts one `PuzzleView` per gate, grades
   submissions with `verify.js`, and unlocks the Colab link when all gates are
   solved or set aside.

### Grading is behavioural

There are no hand-authored equivalence groups. A submission is assembled into a
program, run on the gate's probes, and compared against the reference built from
the solution. Any arrangement that computes the right thing passes.

Two deliberate departures from IEEE, both pedagogical: division by zero raises
(`kind: 'divzero'`) and an out-of-range subscript raises (`kind: 'index'`)
instead of wrapping.

---

## Rules that are enforced, and where

### `tools/validate.mjs`, fails the build

- Every distractor and wrong blank is caught **and** reports its own message.
- Intro at least 200 characters; brief at least 300; title at least 8.
- Every brief has a sentence that opens with an imperative verb (`IMPERATIVES`).
- Nothing presumes the course around the lab (`PRESUMED`: "this week", "in
  class", "on the board", "homework", …). Dip does not fix the order labs are
  assigned in, so copy may not assume it.
- No machine-writing tics (`TICS`: "your job", "worth noticing", "that is what
  makes", "ask which", "crucial", "elegant", …).
- No em dashes.
- No comma fragment of four words or fewer ("Housekeeping, not algorithm.").
- Output shown in a `setup` must carry a sentence saying what it is.
- Warns when a four-word phrase appears in three or more places.

### `tools/test/lab.test.mjs`

Sweeps every spec in `specs/index.json`, and runs the tic list over the
**rendered page**, which catches the chrome that `lab.js` and `feedback.js`
write and no spec check can see.

### `tools/author/VOICE.md`

The half that cannot be machine-checked. Fourteen rules with a quotation from
Dip's lecture notes behind each one, the three structural templates he reuses,
and a table of what he never does. Read it before writing any student-facing
text.

Note: he has said the lecture notes themselves are old and will be rewritten.
They are a model of **register**, not a content reference.

---

## Decisions already made

Do not relitigate these without a reason.

- **Pseudocode, not Python.** The course is about analysing algorithms.
- **The lab page is puzzles only.** Everything else moved to the notebook. The
  one exception is output that raises the question a puzzle answers.
- **No Launch button and no `.ipynb` download** anywhere. The lab is what opens
  the notebook; a direct link would be a way around the puzzles.
- **Work in progress is hidden by default.** The switch reveals it.
- **No new navbars.** Labs are reached from the library card, not the subnav.
- **Keyboard mode in `puzzle.js` stays but is not being invested in.** Dip asked
  to focus on mouse and touch. The keyboard code already existed and passes;
  removing it would lose the accessibility, so it sits there.
- **Editorial rules live in the validator, not in tests.** Dip asked whether
  quality checks were being built for future labs. They are, and they fail the
  build of any lab, not just Newton's.
- **Commit and push automatically.** He reviews after the push. Small focused
  commits, imperative mood, no trailing period.

---

## What happened on 2026-07-30

Commits, oldest first:

| | |
|---|---|
| `5ad73c6` | M1 lab design document and revised notebooks |
| `e0160fb` | Pseudocode interpreter and its test suite |
| `6ceca1f` | Grader, diff classifier, hint ladder |
| `d7596cd` | Puzzle view and the lab stylesheet |
| `edcfe0f` | Browser demo for the puzzle mechanics |
| `7ca7b35` | Fix the drag ghost; stop rebuilding the workspace on every pointer move |
| `974337d` | Measure the indent step in pixels; give each level a sticky band |
| `19bb53d` | Lab build pipeline and spec validator |
| `786d325` | Lab page: cell progression, deferred prose, reveal, saved progress |
| `d2e1bc8` | Cut the arranging from the printing puzzle, keep the contrast |
| `cea669f` | Link the guided lab from its card |
| `baa6133` | Stop the page promising a slider it cannot produce |
| `3488d87` | Hold the printed table back until the puzzle about its rows is done |
| `caf8340` | Stack the tray under the workspace; stop the site right-aligning h3 |
| `fda1a99` | Rebuild the lab page around the puzzles; give each a real brief |
| `de9d2ce` | Test mode; stop the copy assuming things about the course |
| `7e615f5` | Introduce the data before any puzzle refers to it |
| `441f1f5` | Make the lab checks run over every lab |
| `954237f` | Trim the reveal to the algorithm; stop its columns overlapping |
| `7db93ef` | Rewrite the copy out of its verbal tics; make the validator catch them |
| `b608b34` | Voice model from the Math 163 and 212 lecture notes |
| `cfac422` | Rewrite the Newton lab and notebook in the house voice; rename the library |
| `a4e4864` | Every card a guided lab; hide the unbuilt ones; fix the banner overlap |

Bugs worth remembering because they will recur:

- `getComputedStyle().getPropertyValue('--lp-indent')` returns the **authored
  token** (`"1.9rem"`), so `parseFloat` gave 1.9 pixels per indent level. The
  indent step is now measured off the rendered guide elements.
- The drag ghost was appended to `document.body`, outside `.lab`, where the
  `--lab-*` tokens are not in scope, so it rendered as bare text. It lives
  inside the puzzle root now.
- Grid children default to `min-width: auto` and refuse to shrink below their
  content, so a long line in the reveal drew across the gutter into the next
  column. Both columns carry `min-width: 0`.
- `nbformat.from_dict` does not rejoin a `source` list. Use
  `nbformat.reads(json.dumps(nb), as_version=4)`.
- `demo_for` on a setup leaked an answer: the printed triangle is the *answer* to
  the printing puzzle, and showing it as soon as the previous puzzle was solved
  gave it away. `demo_for` now takes a list and waits for all of them.

---

## Next up

### 1. Rename the `al-` prefix  ← start here

`al-` stands for "applet library". The page is now **Computational Labs**, so in
a year the prefix will mean nothing. Everything is in one self-contained file,
`teaching/applet/index.html`.

Rename `al-` to **`cl-`**. Not `lab-`: `teaching/applet/lab/engine/lab.css` uses
`.lab-*` for the lab page itself and the two would read as one namespace.

Three families, all in that one file:

- CSS custom properties: `--al-maroon`, `--al-ink`, `--al-page`, `--al-sticky`,
  `--al-text`, `--al-soft`, `--al-faint`, `--al-fainter`, `--al-card-bg`,
  `--al-card-border`, `--al-card-shadow`, `--al-card-shadow-hover`,
  `--al-banner-from`, `--al-banner-to`, `--al-banner-hatch`, `--al-pill-bg`,
  `--al-course-fg`, `--al-chip-bg`, `--al-chip-border`, `--al-hairline`,
  `--al-launch-fg`, `--al-draft-bg`, `--al-draft-fg`, `--al-plan-bg`,
  `--al-plan-fg`, `--al-accent`, `--al-accent-tint`, `--al-accent-light`,
  `--al-accent-dark`, `--al-accent-soft`, `--al-serif`, `--al-sans`,
  `--al-light`, `--al-semi`, `--al-mono`.
- CSS classes: `.al-head`, `.al-head-text`, `.al-head-search`, `.al-title`,
  `.al-sub`, `.al-sticky`, `.al-count`, `.al-tool-label`, `.al-card`,
  `.al-banner`, `.al-course`, `.al-course-name`, `.al-dot`, `.al-status`,
  `.al-status-progress`, `.al-status-planned`, `.al-topic`, `.al-lib`,
  `.al-card-title`, `.al-blurb`, `.al-actions`, `.al-lab`, `.al-empty`,
  `.al-empty-title`, `.al-footer-head`, `.al-footnote`, `.al-foot`.
- DOM ids: `al-search`, `al-chips`, `al-shown`, `al-total`, `al-results`,
  `al-sort`, `al-drafts`, `al-clear`.

Two things that must **not** change:

- `--jelly-font-display`, `--jelly-font-text`, `--jelly-font-mono`. Those are
  Jelly UI's own API, set on the container so the web components inherit the
  site's type. Renaming them silently breaks the fonts inside the components.
- `body.page-computational-labs`. That class is generated in
  `_layouts/default.html:9` from `page.title | downcase | replace: ' ', '-'`, so
  it tracks the page name, not the prefix. If the page title ever changes again,
  the two selectors that use it have to change with it. There is a comment in
  the file saying so.

Two names worth improving while renaming rather than transliterating:

- `--al-launch-fg` → `--cl-start-fg`. There is no Launch button any more; it is
  the ink on the Start button.
- `.al-lab` → `.cl-start`. Every card is a lab now, so "lab" no longer
  distinguishes this button from anything.

One class name is **built by concatenation** and a class-list rename will miss
it: `cardHTML` writes `'al-status-' + a.statusKey`. Grep for the bare prefix,
not only for whole names.

A blind `sed 's/al-/cl-/g'` is wrong. Anchor on a word boundary (`\bal-`) and
count before and after:

    grep -o '\bal-[a-z-]*' teaching/applet/index.html | sort -u | wc -l    # 70

35 custom properties, 28 classes, 8 ids, plus the `al-status-` stem. Nothing
outside this one file uses the prefix.

Verify by re-running the harness below, which should give the same numbers as
the table under it.

### 2. Author the Runge/Chebyshev lab (`m1-runge`)

Notebook: `teaching/applet/notebooks/na/interpolation_runge_chebyshev.ipynb`.

Follow **Math 212 §1.3**, quoted in full in `tools/author/VOICE.md`. It is
already the lab, and the shape is: set the expectation, break it, name and
attribute the phenomenon, diagnose the cause, give the fix as a numbered
construction, then ask. Critically, he gives the **semicircle picture first**
and only then asks the student to show that the nodes are
`cos((2j+1)π/(2(n+1)))`. Give the picture before the formula.

This is the canonical "output raises the question" case, so the first puzzle
should open with a `setup` showing the equispaced interpolant oscillating at 20
nodes.

Planned gates: `chebnodes` (blanks for the angle denominator `2·(n+1)` and the
affine map `(a+b)/2 + ((b−a)/2)·x[k]`; distractors: the second-kind angle
`k/n·π`, which puts nodes at ±1, and a rescale `(b−a)·x[k]` that escapes
`[a,b]`), and `lageval` (the `j ≠ i` guard and the product factor).

Both algorithms already have tests in `tools/test/interp.test.mjs`. Before
writing, dump the notebook cell by cell and confirm the line numbers and
`py_match` substrings; the design doc's sketch refers to a restructured file.

### 3. Author the cubic splines lab (`m1-splines`)

Notebook: `teaching/applet/notebooks/na/cubic_splines.ipynb`. The tridiagonal
system arrives from nowhere unless the setup derives it. The spline tridiagonal
system is already covered in `tools/test/interp.test.mjs`.

### 4. Voice pass over the other notebooks

The same tics are in the other notebook markdown, at volume, and it matters more
now that all the prose lives there. Examples: "That climb is roundoff, not
approximation error" and "A divergent bound tells you nothing about the error it
bounds" (Runge), "Direct to express, though not the fastest" (Runge), "That is
what makes Newton's form convenient" (was in Newton, now fixed). Fifteen
notebooks in `na/`, plus `de/`, `intro/`.

### 5. The remaining labs

Twelve more numerical analysis notebooks, then the DE, calculus and analysis
ones. Each needs a `tools/author/<name>_lab.py`, a
`teaching/applet/lab/<lab-id>.html` stub, and a flip from `drafted` to
`finalized` in the card data once its lab is built.

---

## Verifying `teaching/applet/index.html`

There is no browser and no node, but the controller is plain ES5 in one
`<script>` block, so it can be pulled out and run under `jsc` against a stub
DOM. This caught the chip-count bug (chips advertising cards the draft toggle
was hiding).

```python
import pathlib
body = pathlib.Path('teaching/applet/index.html').read_text().rsplit('<script>',1)[1].split('</script>')[0]
body = body.replace('})();', '  globalThis.__probe = { ACT: ACT, state: state, render: render };\n})();')
harness = """
var NODES = {};
function el(id){ if(!NODES[id]) NODES[id]={id:id,innerHTML:'',textContent:'',
  addEventListener:function(){},closest:function(){return null;}}; return NODES[id]; }
var document = { getElementById: el, addEventListener: function(){}, readyState:'complete' };
""" + body + """
function report(tag) {
  var cards = NODES['al-results'].innerHTML;
  print(tag + '  shown/of ' + NODES['al-shown'].textContent + '/' + NODES['al-total'].textContent
    + '  cards ' + (cards.match(/class="al-card"/g)||[]).length
    + '  enabled ' + (cards.match(/<a class="al-lab"/g)||[]).length
    + '  disabled ' + (cards.match(/al-lab is-off/g)||[]).length
    + '  pills ' + (cards.match(/class="al-status /g)||[]).length);
}
report('default');
__probe.state.showDrafts = true; __probe.render();
report('drafts on');
"""
pathlib.Path('/tmp/al.js').write_text(harness)
```

Expected today (update the class names after the rename):

| | cards | enabled | disabled | status pills | chips |
|---|---|---|---|---|---|
| default | 1 | 1 | 0 | 0 | 1 · 0 · 1 · 0 · 0 · 0 |
| drafts on | 28 | 1 | 27 | 27 | 28 · 1 · 15 · 5 · 4 · 3 |

---

## Open and deferred

- **The URL is still `/teaching/applet/`.** Moving it to `/teaching/labs/` would
  break any link already given to students and would also move the spec paths,
  `_layouts/lab.html`, `build_labs.py`, the tests and the demos. Doable with
  `redirect_from` on the old path. Outward-facing, so ask first.
- **The reveal panel** (side-by-side pseudocode and Python after a solve) is
  expanded by default. Whether it should collapse behind a toggle or go entirely
  was raised and never answered.
- **`al-`/`cl-` in `wip/m1_lab_design.md`** does not need updating; the doc is
  historical.
- **Em dashes.** `CLAUDE.md` bans them and the validator enforces it. Dip's own
  lecture notes use a few. The ban stands for generated text; the discrepancy is
  recorded in `VOICE.md`.
- **Jelly UI** is vendored at `teaching/applet/vendor/jelly/` and provides
  `jelly-input`, `jelly-select`, `jelly-button`, `jelly-switch` on the library
  page. It is pinned to the site theme by a `MutationObserver` on
  `html[data-theme]`, because left alone it follows the OS preference and would
  go dark while the site is light.
