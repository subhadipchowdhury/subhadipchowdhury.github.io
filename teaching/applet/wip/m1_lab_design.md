# Gated Lab Pages for the Applet Library: Design

Revision note (rev 4). The notebooks are no longer immutable, so the design gains a second instrument: when a notebook's structure fights the lab, restructure the notebook. Applied to all three M1 notebooks (revised .ipynb files ship alongside this document, executed and verified), which deletes two pieces of page machinery from the first implementation pass: multi-region cells and the `witness` field are gone from the v1 schema, replaced by one-algorithm-per-cell and real demo cells. Section 4 states the notebook revision principles; section 9 is rewritten against the revised files. Also fixed in this pass: the reveal wireframe in 5.3 carried fabricated coefficient values; the numbers there now come from executing the demo cell.

Revision note (rev 3). The five open questions of section 10 are resolved (four by your answers, one by delegated judgment) and the resolutions are folded into the body: `defer` mode for prose that answers a puzzle (section 4, applied in 9.1 and 9.3), student-trace-visible verification (6.1), multi-frame `capture` (4, applied in all three specs), and a park-and-bring-to-office-hours stage 5 with no in-page solution reveal (6.2, 7.2). Section 10's list now records the decisions and the one policy left under review. (Rev 4 supersedes parts of this rev where noted.)

Revision note (rev 2). All three M1 notebooks are now in hand and section 9.1 is built from the real file rather than a reconstruction. Three findings from that file changed the design rather than only the spec: `divided_differences` and `newton_eval` share one cell, so the two-regions-per-cell mechanism first written for the splines notebook is required in the very first lab; the gated cells are definition cells with no output of their own, which forced a new `witness` field (section 4); and docstrings inside gated cells state the algorithms verbatim, which forced a third render style in the reveal (section 5.3). The invented incremental-table puzzle from rev 1 is gone; no such cell exists.

---

## 1. The pseudocode notation

Design principle, stated once and enforced everywhere: **loose about words, strict about indices.** Any token that is an identifier, a subscript, a bound, or an operand is exact and machine-checked. Everything else reads like the board.

A second principle with more consequences than it looks: **pseudocode is pointwise.** A pseudocode function evaluates at a scalar `t`; it never operates on "an array of query points" elementwise. Vectorization over a grid is a NumPy realization detail, and it is surfaced exactly once, in the reveal, where `result = result * (x - x_nodes[k]) + coeffs[k]` is annotated as the vectorized form of the scalar update the student assembled. This keeps the notation honest (the recurrence on the board is scalar), keeps the interpreter small (no broadcasting semantics), and makes the "programming is not the point" claim concrete instead of rhetorical.

### 1.1 The spec (handout artifact)

```
HOUSE PSEUDOCODE  (used on the board, in handouts, and in every lab)

Values      real numbers, integers, 1-D arrays, 2-D arrays (tables)
Indexing    0-based, always. x[i] is the (i+1)-th entry. T[i, j] is row i, column j.
            There is no shorthand for "a whole row": you write the bounds.
              T[0, 0..n−1]     row 0 of an n×n table
              T[0..n−1, 0]     column 0
            a..b is an inclusive range: a, a+1, ..., b. Empty if a > b.

Assignment  x ← expr                     (= is comparison, never assignment)
            a, b ← f(x)                  unpack a two-value return
            T[0..n−1, 0] ← y             assign an array into a slice of equal length

Operators   + − · / ^        · is multiplication and is always written
            = ≠ < ≤ > ≥      comparisons
            and or not       logic
            When typing into a blank: * for ·, <= for ≤, sqrt() etc. accepted.

Loops       for i ← a to b:              i = a, a+1, ..., b   (inclusive; empty if a > b)
                body
            for k ← b down to a:         k = b, b−1, ..., a
                body
            while cond:
                body
            The body is one indentation level in (4 spaces on the page).

Branches    if cond:
                body
            else if cond:
                body
            else:
                body

Functions   function name(p1, p2):
                body
                return e1            or   return e1, e2
            Called as name(args).

Builders    zeros(n)         1-D array of n zeros
            zeros(m, n)      m×n table of zeros
            [e1, e2, e3]     literal array
            length(x)        number of entries
            solve(A, b)      the vector v with A·v = b   (a primitive here;
                             how to compute it is a later module's problem)

Library     abs, sqrt, cos, sin, exp, max, min, sum, π    (closed set; grows only
            when a lab needs a new name, and the handout is updated when it does)

Comments    # like this
Blanks      ⟨?⟩ on screen, ____ on the board. A blank always holds an
            expression, never a statement.
```

Two deliberate exclusions. There is no `:` slice shorthand and no "top row of T" in words, because which axis you read is exactly the row-versus-column distinction the divided-difference lab tests; the notation forces the student to commit to `T[0, 0..n−1]` or `T[0..n−1, 0]` and those two strings differ only where it matters. And there are no compound assignments (`+←`); every update names its target in full, so `p ← p · (t − xn[k]) + c[k]` shows the accumulator on both sides.

### 1.2 The worked algorithm in the notation

```
function divided_differences(x, y):
    n ← length(x)
    T ← zeros(n, n)
    T[0..n−1, 0] ← y
    for j ← 1 to n−1:
        for i ← 0 to n−j−1:
            T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / (x[i+j] − x[i])
    c ← T[0, 0..n−1]
    return c, T

function newton_eval(xn, c, t):
    n ← length(c)
    p ← c[n−1]
    for k ← n−2 down to 0:
        p ← p · (t − xn[k]) + c[k]
    return p
```

### 1.3 Where the brief's example blocks are loose

Your `for i ← 0 to n-j-1` versus `for i ← 0 to n-1` contrast is already strict where it needs to be, with one caveat: it only carries the intended meaning once `to` is declared inclusive, globally, in writing. A student trained on Python's half-open `range` will read `to n−1` as "stop before n−1" unless the handout kills that reading on day one. The spec above declares it; the first lab's first puzzle should also surface it (the `for j ← 1 to n−1:` block is a natural place, since the Python reveal pairs it with `range(1, n)` and the reveal annotation states the off-by-one convention shift explicitly).

The distractor "reading the coefficients off the first column instead of the first row" is loose if written in words. In this notation it becomes `c ← T[0..n−1, 0]` against `c ← T[0, 0..n−1]`, a minimal pair distinguishable only by reading subscripts, which is the skill under test.

The natural blank "the denominator" hides a strictness inversion worth naming. String-matching a blank is strict about surface form (rejects `−(x[i] − x[i+j])`, rejects spacing) and loose about meaning. The right strictness is semantic: a blank is checked by evaluating the entered expression at probe values (section 6), so every algebraically equivalent form passes and every sign error fails.

---

## 2. Execution decision

**Decision: (e), composed as (b) + (a) + (c).** The student's assembled pseudocode is interpreted in JavaScript for verification and feedback. The revealed Python is never executed in the page; its output is captured at build time by a local script and shipped as static text and PNG. Live execution, sliders included, is the finale in Colab.

### Why (b) for verification

The alternative, structural matching against accepted orderings, fails on exactly the notebooks shipping first. `divided_differences` admits reorderings (`n ← length(x)` can float; the two returns' construction order is free) that either get hand-enumerated as equivalence groups across fifteen labs or get wrongly rejected. Interpretation makes ordering equivalence fall out for free: any assembly that computes the right table is right. It also buys the feedback this course is about. Comparing the student's `T` against the reference `T` entry by entry yields "your column 1 has the right magnitudes with the wrong sign," which is a statement about the algorithm, and no structural checker can say it.

The reference values come from running the instructor's correct block assembly through the same interpreter in the browser at load time. Same semantics on both sides, so no Python-to-JS numeric drift can cause false rejections; the only cross-language comparison anywhere is a build-time sanity check (section 3).

Honest cost estimate for the interpreter. The grammar is the closed notation of section 1: one statement form per line, expression grammar with ~12 operators, four compound statements, scalars plus 1-D and 2-D arrays with inclusive slices, `solve` as a built-in (Gaussian elimination with partial pivoting, ~80 lines, adequate for probe sizes n ≤ 10). Tokenizer ~150 lines, recursive-descent/Pratt parser ~450, tree-walking evaluator with an instruction cap ~500, array and slice semantics ~250, built-ins ~150, trace capture and diff classification ~350, verification harness ~200. **Roughly 2,000 to 2,600 lines of dependency-free JS; 20 to 25 KB minified; 8 to 10 KB gzipped.** Two to four weeks of implementation effort including tests, and the tests matter more than usual because the interpreter is the grader. The instruction cap (10⁶ steps, then "your loop did not terminate on the test input") is mandatory; students will assemble infinite loops.

### Why (a) for the revealed Python, and why (d) is rejected

The revealed Python's job is to be read, mapped line-by-line to the assembled pseudocode, and seen to work. A static captured output does that. Running it live in-page requires (d), and (d) fails on your own numbers: Pyodide core plus NumPy plus Matplotlib is 25 to 40 MB of WASM and wheels, several seconds to first run on campus wifi and much worse off it, and it still lacks ipywidgets, so the ~40 `interact` calls across 17 notebooks would each need a hand-built HTML control panel. That is a second product. The JupyterLite history already priced one of these two costs; (d) pays the other one too. Rejected.

Captured outputs cost kilobytes: stdout text inline in the spec JSON, plots as PNGs fetched lazily when a cell unlocks (30 to 120 KB each, two to four per lab). For `interact` cells the build script cannot capture the widget, so the cell's metadata names a concrete call to capture instead (e.g. `show_ucurve()` with defaults), and the page shows that single frame with a caption stating that the sliders live in Colab. The Colab launch at the finale is where interactivity actually happens, which is (c) doing the one job it is good at.

### Totals

| | payload (gzipped) | first paint | forecloses |
|---|---|---|---|
| chosen (b+a+c) | ~12–15 KB JS + ~5 KB CSS + 15–30 KB spec JSON; PNGs lazy | < 200 ms, no WASM, works offline after first load | no live parameter play in-page; sliders are Colab-only |
| (a) alone | ~6 KB JS | same | rich feedback; hand-authored equivalence groups forever |
| (d) | 25–40 MB | 5–30 s | ipywidgets; and it solves a problem (running Python) the design defines away |

What the chosen design forecloses, stated plainly: the page can never run the student's own *Python*, and never will; if the course later wants in-page live Python, this design does not grow into it, Colab remains that venue.

---

## 3. Architecture

All static, all committed, one generated artifact per lab.

```
teaching/
  applet/notebooks/na/newton_divided_differences.ipynb   # source of truth, unchanged
                                                          # semantics; lab spec lives in
                                                          # its cell metadata (section 4)
  labs/
    m1-newton-divided-differences.md      # Jekyll page: front matter only
    m1-runge-chebyshev.md                 #   layout: lab, lab_id: m1-newton, title
    m1-cubic-splines.md
    specs/
      m1-newton.json                      # GENERATED, committed. Everything the page
      m1-runge.json                       #   needs: prose as HTML, blocks, distractors,
      m1-splines.json                     #   probes, captured text output, Python source
    out/
      m1-newton/cell03.png ...            # GENERATED, committed. Captured plots.
assets/lab/
  lab.js          # interpreter + puzzle UI + state, one bundle, no dependencies
  lab.css         # uses the site's CSS variables; honors html[data-theme="dark"]
_layouts/lab.html # shell: header, theme toggle hookup, <main id="lab">, script tag
tools/
  build_labs.py   # the one local script: extract, execute, validate, emit
  validate.mjs    # Node harness importing the same interpreter module as lab.js
```

**`build_labs.py`** does four things per notebook. (1) Reads `metadata.lab` from the notebook and each cell, converts markdown cells to HTML (Python-side, so the page ships no markdown renderer). (2) Executes the notebook with `nbclient` and captures stdout and PNGs for shown and gated cells, using each cell's `capture` override where `interact` would otherwise emit a widget. (3) Calls `node validate.mjs`, which parses every block and blank through the real interpreter, runs the reference assembly on the probes, then runs **every distractor substitution and every authored wrong-blank** and asserts each one produces output distinguishable from the reference on those probes. A distractor the probes cannot catch fails the build with a message telling you to fix the probe. (4) Emits the spec JSON and images. Requires local Python plus Node; both already plausible on a machine that runs Jekyll.

This is the count-of-committed-artifacts answer to the JupyterLite history: one JSON and a handful of PNGs per lab, ~60 files for the whole library against 566.

**Page lifecycle.** Static HTML shell paints immediately. `lab.js` fetches the spec JSON, renders prose cells and cell shells top to bottom, restores progress from localStorage, marks the first unsolved gated cell active, and instantiates its puzzle. On submit: parse, interpret with instruction cap (fast enough on the main thread; probes are n = 4 or 5), diff against the reference computed once at load, render feedback or the reveal, unlock the next cell, persist. The finale card's Colab URL is the same GitHub-path link the applet library already uses.

---

## 4. Content model

The pseudocode is authored **inside the notebook, in cell metadata**, under a single `lab` key. This is the only location that satisfies "beside the code it describes": edit a cell's Python and its pseudocode is on screen in the same JSON object two lines away, it travels with the cell through reorderings, the `.ipynb` remains valid, and Colab ignores unknown metadata so Launch is unaffected. The cost is that editing cell metadata is clunky in the classic notebook UI; in JupyterLab the Property Inspector edits it directly, and editing the `.ipynb` as text works too. `build_labs.py` validates on every run, so a typo is caught at build, never in class.

Notebook-level metadata:

```json
"metadata": {
  "lab": {
    "lab_id": "m1-newton",
    "module": "M1",
    "order": 2,
    "title": "Newton Form and Divided Differences",
    "series": ["m1-runge", "m1-newton", "m1-splines"]
  }
}
```

Cell-level metadata for the primary worked cell. `py` gives 1-based line ranges into the cell's own source; `py_match` is a substring the first line of that range must contain, so the build fails loudly when an edit shifts line numbers. Lines listed in `py_glue` render dimmed in the reveal as bookkeeping (section 5.3).

```json
"metadata": {
  "lab": {
    "mode": "gated",
    "cell_id": "divdiff",
    "concept": "divided_differences",
    "title": "Build the divided-difference table",
    "intro": "Assemble the algorithm that fills the table. Order and indentation both count. Two blocks contain blanks.",
    "blocks": [
      {"id":"def",  "text":"function divided_differences(x, y):",                        "indent":0, "py":[10,10], "py_match":"def divided_differences"},
      {"id":"n",    "text":"n ← length(x)",                                              "indent":1, "py":[25,25], "py_match":"n = len"},
      {"id":"tab",  "text":"T ← zeros(n, n)",                                            "indent":1, "py":[26,26], "py_match":"np.zeros"},
      {"id":"col0", "text":"T[0..n−1, 0] ← y",                                           "indent":1, "py":[27,27], "py_match":"table[:, 0]"},
      {"id":"loopj","text":"for j ← 1 to n−1:",                                          "indent":1, "py":[28,28], "py_match":"for j in range(1, n)"},
      {"id":"loopi","text":"for i ← 0 to ⟨?bound⟩:",                                     "indent":2, "py":[29,29], "py_match":"for i in range(n - j)"},
      {"id":"rec",  "text":"T[i, j] ← (T[i+1, j−1] − T[i, j−1]) / ⟨?den⟩",               "indent":3, "py":[30,30], "py_match":"table[i, j]"},
      {"id":"coef", "text":"c ← T[0, 0..n−1]",                                           "indent":1, "py":[31,31], "py_match":"coeffs = table[0"},
      {"id":"ret",  "text":"return c, T",                                                "indent":1, "py":[32,32], "py_match":"return coeffs"}
    ],
    "blanks": {
      "bound": {"kind":"range_end", "answer":"n−j−1", "env":["n","j"]},
      "den":   {"kind":"expr",      "answer":"x[i+j] − x[i]", "env":["x","i","j"]}
    },
    "distractors": [
      {"id":"d_num",  "text":"T[i, j] ← (T[i, j−1] − T[i+1, j−1]) / ⟨?den⟩", "near":"rec",
       "why":"num_reversed"},
      {"id":"d_swap", "text":"for i ← 0 to n−1:\\n    for j ← 1 to n−i−1:", "near":"loopj", "compound":true,
       "why":"loops_swapped"},
      {"id":"d_colc", "text":"c ← T[0..n−1, 0]", "near":"coef",
       "why":"col_not_row"}
    ],
    "wrong_blanks": {
      "den":   ["x[j] − x[i]", "x[i+1] − x[i]"],
      "bound": ["n−1", "n−j"]
    },
    "probes": [
      {"env":{"x":[0,1,3,6], "y":[1,4,2,8]}, "call":"divided_differences(x, y)"}
    ],
    "trace": ["T"],
    "py_glue": [23,24],
    "feedback": {
      "num_reversed": "Your table's off-diagonal columns have the right magnitudes and the wrong signs, alternating by column. A divided difference is built from the later value minus the earlier one. Re-read your numerator.",
      "loops_swapped": "Your loops visit (i, j) pairs in a different pattern. Ask which direction the table is filled: one full column at a time, or one row at a time? Which entries does T[i, j] need to already exist?",
      "col_not_row": "You returned n values, but they are not the Newton coefficients. The coefficients are the top entry of each column. Which subscript varies along that?"
    }
  }
}
```

Line references are against the revised notebook shipped with this document (cell 3 as split in rev 4); the `.copy()` on line 31 is annotated separately rather than listed in `py_glue`, since the line is half algorithm, half bookkeeping. Notes on the shape. `wrong_blanks` are the anticipated wrong fills; they get authored feedback if the student's blank evaluates equal to one of them at the probe (which catches equivalent misspellings of the same mistake too). The probe `x = [0, 1, 3, 6]` has strictly unequal spacing on purpose: it separates `x[i+j]−x[i]` from `x[i+1]−x[i]` and from `x[j]−x[i]` at multiple table entries, which `validate.mjs` verifies mechanically. `trace: ["T"]` tells the interpreter to snapshot `T` at function return for diffing, which is what powers the sign-pattern message. `compound: true` marks a distractor that is a fused two-line block (the swapped loops travel together, otherwise each half is individually placeable somewhere defensible).

A shown cell's metadata is one line, or two when it holds `interact`:

```json
"metadata": {"lab": {"mode": "shown"}}
"metadata": {"lab": {"mode": "shown", "capture": [
  {"code": "show_newton(5)",  "caption": "five nodes"},
  {"code": "show_newton(12)", "caption": "twelve: Runge's phenomenon does not care about the representation"}
]}}
```

`capture` is a list; each entry runs in the notebook namespace and yields one frame, and the page renders the frames as a captioned strip. One entry is the common case; `interact` cells should usually carry two or three at parameter values chosen so the frames tell the cell's story against each other, since a single frame of a slider demo says almost nothing.

**Notebook revision principles (rev 4).** The notebooks are editable, so structural mismatches between notebook and lab are fixed at the source instead of absorbed by page machinery. Five rules, applied to all three M1 files and to any notebook drafted from now on:

1. *One algorithm per code cell.* A cell is the puzzle unit; a cell holding two functions is two puzzles and gets split. This deleted the multi-region mechanism from the v1 schema.
2. *Docstrings state the interface, never the algorithm.* Parameters and returns stay; recurrences, sweep descriptions, and "the coefficients are the top row" move to markdown cells, where `defer` controls when the page shows them and the Colab notebook still reads well. The reveal keeps its docstring stub style, but nothing load-bearing hangs on hiding docstrings anymore; the validator's role shrinks to a lint that warns when a gated cell's docstring contains index expressions.
3. *Every gated definition is followed by a demo cell* that runs it on small concrete data and prints the result, using the same data the puzzle's probes use. This is the witness, now a real cell: the notebook gains immediate feedback after each definition (an improvement in Colab on its own), the build captures its output like any other, and the `witness` metadata field is deleted from the v1 schema.
4. *Gated bodies carry no inline comments and no Python-isms without a notation counterpart.* `coeffs[-1]` became `coeffs[n - 1]`; commentary lives in markdown and reveal annotations, so every line in a gated body maps to exactly one block.
5. *Identifiers match the house notation.* Query points are `xq` everywhere (they were `x`, colliding with the nodes' name across functions in the same notebook), so the reveal pairing `xn, c, t ↔ x_nodes, coeffs, xq` reads without translation.

Two schema features are demoted to reserve status by these rules, kept in this document because not every future notebook may be restructurable: `regions` (multiple puzzles in one cell) and `witness` (capture-only code in metadata). Neither is implemented in the first pass; nothing in M1 uses them.

A shown cell's metadata is one line, or two when it holds `interact`:

```json
"metadata": {"lab": {"mode": "shown"}}
"metadata": {"lab": {"mode": "shown", "capture": [
  {"code": "show_newton(5)",  "caption": "five nodes"},
  {"code": "show_newton(12)", "caption": "twelve: Runge's phenomenon does not care about the representation"}
]}}
```

`capture` is a list; each entry runs in the notebook namespace and yields one frame, and the page renders the frames as a captioned strip. One entry is the common case; `interact` cells should usually carry two or three at parameter values chosen so the frames tell the cell's story against each other, since a single frame of a slider demo says almost nothing.

**Deferred prose.** A markdown cell whose content answers a puzzle below it is marked

```json
"metadata": {"lab": {"mode": "defer", "until": "divdiff"}}
```

On the lab page it renders in place as a collapsed bar showing only its heading and a lock glyph ("Divided differences · opens with the puzzle below"); when the named region is solved or parked it expands in place, and the solved card links back up to it ("the notation for what you just built is now open above"). The notebook is untouched, so Colab and the lab page tell the story in different orders, deliberately: on the page, the algorithm is reconstructed first and its formal statement is the debrief. The sanctioned during-puzzle reference is the textbook and the notation handout, which is the IBL posture stated once here rather than per cell. The validator requires `until` to name a real gated region and warns when that region precedes the deferred cell, where deferral would be a no-op.

Cells with no `lab` key default to `shown`, so an unannotated notebook degrades to a readable page with a Colab button, never a broken one.



---

## 5. Interaction design

### 5.1 Puzzle state

One workspace, one tray, indentation carried by horizontal position. Desktop shows them side by side; under 700 px the tray docks below the workspace.

```
┌─ Cell 3 · Build the divided-difference table ──────────────────────────────┐
│ Order and indentation both count. Two blocks contain blanks. 2 blocks in   │
│ the tray will not be used.                                                 │
│                                                                            │
│  WORKSPACE                          ┆   TRAY  (7 remaining)                │
│  ┆0   ┆1   ┆2   ┆3                  ┆                                      │
│  [function divided_differences(x,y):┆   [ T ← zeros(n, n)              ]   │
│      [ n ← length(x)          ]     ┆   [ for i ← 0 to [____]:         ]   │
│      [ T[0..n−1, 0] ← y       ]     ┆   [ T[i,j] ← (T[i,j−1] −         ]   │
│      ▐▌◀ insertion caret            ┆   [    T[i+1,j−1]) / [____]      ]   │
│      [ for j ← 1 to n−1:      ]     ┆   [ c ← T[0..n−1, 0]             ]   │
│                                     ┆   [ c ← T[0, 0..n−1]             ]   │
│  ⟨ selected block follows the       ┆   [ T[i,j] ← (T[i+1,j−1] −       ]   │
│    caret; ←/→ change its indent ⟩   ┆   [    T[i,j−1]) / [____]        ]   │
│                                     ┆   [ return c, T                  ]   │
│                                                                            │
│  [ Check my algorithm ]                    attempts: 0     [ reset cell ]  │
└────────────────────────────────────────────────────────────────────────────┘
```

The workspace's left edge shows four faint indent guides (`┆0..┆3`). A block sits at exactly one level; there is no free-form horizontal placement. Blanks (`[____]`) are 10-character text inputs embedded in the block, editable only after the block is placed in the workspace, and they join the tab order at their block's position. The banner states the distractor count ("2 blocks will not be used") because hiding it just converts the puzzle into counting.

**Pointer mechanics.** Drag uses pointer events, so mouse and touch share one path. Lift a block from either list; while dragging over the workspace, a caret shows the insertion row and the block's horizontal position snaps to the nearest indent guide, so depth is chosen by where you drop, in one gesture. Drop on the tray (or press Delete, or drag out) returns a block. Tap-to-place is fully supported as a no-drag alternative: tap a block (it highlights), tap a gap in the workspace (carets appear between every pair of rows on selection), then adjust indent with the ‹ › buttons that appear on the selected block. Every action available by drag is available by tap.

**Keyboard model**, exactly:

```
Tab / Shift-Tab   enter and leave the workspace list, the tray list, buttons, blanks
↑ / ↓             move focus between blocks within the focused list
Enter or Space    on a focused block: pick up ("grabbed" state)
   then ↑ / ↓     move the grabbed block a row at a time (workspace) or point at
                  a workspace row while grabbing from the tray
   then ← / →     change the grabbed block's indent one level
   then Enter     drop in place
   then Esc       cancel; the block returns to where it started
Delete            on a workspace block: send it back to the tray
inside a blank    normal text editing; Esc returns focus to the block
Ctrl/Cmd+Enter    submit (same as the Check button)
```

This is the roving-tabindex pattern; the two lists are each one tab stop.

### 5.2 Solved state

On success the workspace freezes, blocks tint to the success color, and the reveal expands directly beneath it, pushing the next cell (now unlocked) into view but never auto-scrolling past the reveal.

### 5.3 The reveal

The screen where "the algorithm is the content" and "here is real code" coexist. Two aligned panes, correspondence by number, pairing on hover and on focus.

```
┌─ Solved ✓ · Your algorithm, and the Python that implements it ─────────────┐
│                                                                            │
│  YOUR PSEUDOCODE                    │  THE IMPLEMENTATION                  │
│                                     │  def divided_differences(x, y):  ①  │
│ ① function divided_differences(x,y):│      x = np.asarray(x, dtype=float)  │
│                                     │      y = np.asarray(y, dtype=float)  │
│ ② n ← length(x)                     │      n = len(x)                  ②  │
│ ③ T ← zeros(n, n)                   │      table = np.zeros((n, n))    ③  │
│ ④ T[0..n−1, 0] ← y                  │      table[:, 0] = y             ④  │
│ ⑤ for j ← 1 to n−1:                 │      for j in range(1, n):       ⑤  │
│ ⑥     for i ← 0 to n−j−1:           │        for i in range(n - j):    ⑥  │
│ ⑦         T[i,j] ← (T[i+1,j−1]      │          table[i, j] = (         ⑦  │
│              − T[i,j−1])            │            table[i+1, j-1]           │
│              / (x[i+j] − x[i])      │            - table[i, j-1]) / (      │
│                                     │            x[i+j] - x[i])            │
│ ⑧ c ← T[0, 0..n−1]                  │      coeffs = table[0, :].copy() ⑧  │
│ ⑨ return c, T                       │      return coeffs, table        ⑨  │
│                                     │                                      │
│  Dimmed lines are bookkeeping: converting inputs to float arrays, and     │
│  .copy() so the returned coefficients do not alias the table. They are    │
│  not part of the algorithm; this is why you did not assemble them.        │
│                                                                            │
│  ⑤⑥  Convention shift: pseudocode "to n−1" is inclusive; Python's         │
│       range(1, n) stops before n. Same iterations, different fence.       │
│                                                                            │
│  OUTPUT (from the demo cell below, shown here after the solve)             │
│  Newton coefficients c0..c3: [ 1.      3.     -1.3333  0.3222]             │
│  ... and the printed triangle, once cell 4's printer is built              │
└────────────────────────────────────────────────────────────────────────────┘
```

Rules for this screen. Every pseudocode row carries a number; every Python line carries a matching number, a dimmed bookkeeping style, or the docstring style, so the mapping is total and the leftover lines are explained rather than ignored. Docstrings collapse to a one-line `"""..."""` stub with a "show documentation" toggle, since expanding them inline would swamp the pairing; the toggle is worth pressing at least once in this notebook, where the `newton_eval` docstring writes out the Horner sweep in what is nearly the house notation already. Hovering or focusing either side of a pair highlights both. Annotations are authored per cell, at most two, reserved for genuine convention shifts (the `range` fence, vectorization in `newton_eval`, `np.diff` replacing an explicit `h` loop). The captured output sits below, inside the same card, so "and it works" lands on the same screen. When the cell is an `interact` cell downstream, the captured frames render as a captioned strip and the closing caption reads "static frames; the sliders are in the notebook you unlock at the end."

---

## 6. Verification and feedback

### 6.1 Pipeline

On submit, in order, stopping at the first failure class:

1. **Completeness.** Workspace has all required rows and no empty blanks. Message names the count, never the content ("one block is still in the tray").
2. **Parse.** Blocks always parse (they are authored); blanks might not. A bad blank gets a syntax message pointing at that blank only.
3. **Interpret.** Run the assembly on each probe under the instruction cap. Nontermination: "on the test input x = [0, 1, 3, 6], your loops did not finish; something never shrinks." Runtime error (index out of range): reported with the offending subscript's value, "at j = 3, i = 2 you read T[3, 2] before anything wrote it," which is itself divided-difference feedback.
4. **Compare.** Return values and traced variables against the reference, entrywise, relative tolerance 1e−9. Equal: solved, regardless of ordering, which is how behaviorally equivalent orderings are accepted without any equivalence-group authoring.
5. **Diagnose.** On mismatch, three sources compose one message, in this priority: (i) if a placed distractor or a wrong-blank match is present, its authored `feedback` string; (ii) a diff classifier over the trace that recognizes structural patterns (sign flip by column, transpose, single wrong column, correct table but wrong return); (iii) a generic fallback that shows the smallest wrong entry: "T[0, 2] should be −0.5; yours is 0.3."

The worked case from the brief: student places the reversed-numerator block. Interpretation produces a table whose column j is (−1)^j times correct; the classifier detects "match in magnitude, sign alternating by column," the distractor's authored string is present, and the student sees:

> Not yet. Your table's off-diagonal columns have the right magnitudes and the wrong signs, alternating by column. A divided difference is built from the later value minus the earlier one. Re-read your numerator.

The message states an observation about their computation and a question-shaped pointer. It never names the block to move; that is the ladder's later job.

**Trace visibility.** Alongside every failure card, the student sees the probe input and their own computed trace: their table, printed as the triangle. The reference table is never displayed. The distinction is the IBL line: the student's own wrong output is experimental evidence they generated and should be reading (diagnosing a computation from its output is course skill W10 in miniature), while the correct table is the answer key. The one leak permitted is the generic fallback's single anchor entry ("T[0, 2] should be −0.5; yours is 0.3"), which functions as one measurement, standard in any lab report, and does not reconstruct the recurrence for anyone who could not already.

Indentation-only errors (right blocks, right order, wrong nesting) interpret to something wrong or nonterminating, and the classifier additionally checks the specific pattern "sequence equals solution, indents differ," producing "your lines are in the right order; the question is which of them are inside which loop."

### 6.2 Hint escalation ladder

Modeled on the intra-problem adaptation of adaptive Parsons problems (Ericson, Margulieux and Rick, ICER 2017, showing Parsons with adaptation matches code-writing learning gains at lower time cost; Ericson and Foley's follow-ups on intra-problem adaptation triggered by repeated failure; mechanics descended from js-parsons, Karavirta, Helminen and Ihantola 2012; the format itself from Parsons and Haden 2006). Their adaptation moves are removing a distractor, combining blocks, and providing indentation; the ladder below uses all three, ordered so that diagnostic information precedes structural help.

```
fail 1   diagnostic message (section 6.1), nothing else
fail 2   same class of message, plus the implicated workspace region is
         outlined (the loop nest, not the single block)
fail 3   adaptation: one distractor that is currently in the tray is removed,
         with notice ("removed a decoy that was not part of the answer")
fail 4   adaptation: indentation is fixed for all currently placed blocks
         that are in a correct relative order, or, if a known distractor is
         placed, it is ejected to the tray with its feedback string
fail 5+  no in-page solution, ever. Two things appear instead:
         "Park this puzzle": marks the cell parked, unlocks the next cell,
           leaves this puzzle open to return to. Parked cells do not block
           the finale either.
         "Bring it to office hours", with a Copy my attempt button that
           produces a plain-text snapshot: the assembly as placed (house
           notation, indentation preserved), blank contents, attempt count,
           and the last feedback message. Paste into an email or bring it
           on a phone; it is exactly the artifact a five-minute office-hours
           conversation needs, and it is the only way any state leaves
           localStorage.
```

Attempt counts are per cell, persist in localStorage, and reset with the cell. Messages never stack; each failure shows one card.

---

## 7. Progression and state

### 7.1 Within a lab

Cells unlock strictly top to bottom; gated cell k + 1 is inert until k is solved or parked (section 6.2). Prose is always readable, including prose past the frontier, except cells in `defer` mode, because the mathematics should be skimmable before the puzzle that implements it. A parked cell's reveal stays closed; the real Python behind an unsolved puzzle is visible only in the finale notebook, which keeps the reveal worth earning without walling off the rest of the lab. The finale card (Colab launch) is visible from the start but disabled, with the count of remaining gates on it; it enables when the last gate opens. Disabled here means visually and semantically (aria-disabled), while the underlying notebook URL stays reachable from the applet library page as today. The gate is an invitation structure, and honesty about that is cheaper than pretending otherwise.

### 7.2 Persistence

localStorage, no backend:

```
lab:{lab_id}:{spec_hash}      per-cell: status (locked | open | parked | solved),
                              attempt count, placements, blank contents
concept:{name}                set when a cell with that concept is solved
                              (parked does not count); records lab_id and date
```

`spec_hash` hashes only the gated-cell definitions, so editing prose or shown cells never invalidates progress; editing a puzzle does, which is correct because saved placements may no longer fit. On hash mismatch the page says progress was reset because the lab changed, rather than silently wiping.

"Reset cell" reshuffles that cell's tray and clears its placements and attempts. "Reset lab" (footer, confirm dialog) clears the lab's keys and any `concept:` flags this lab set. A returning student sees solved cells collapsed to a one-line solved bar (expandable to the full reveal), parked cells collapsed to a bar with their attempt count and a resume button, and lands scrolled to the frontier cell.

### 7.3 Across the three M1 labs

Progression state crosses lab boundaries through concepts, never through lock-out: **no lab is locked by another lab.** A student who starts at the splines lab gets a complete experience; requiring lab order on a public course site punishes review before exams and shoppers alike.

What crosses is recap treatment. When a gated cell's `concept` is already flagged (the splines notebook's `lagrange_eval` cell, concept `lagrange_eval`, solved back in the Runge lab), the cell renders as a **reduced rebuild**: same solution blocks, zero distractors, one anchor block pre-placed, banner "you built this in Lab 1; rebuild it from memory." That is retrieval practice at perhaps a quarter of the original cost, and it answers the brief's question with a third option: neither hand it over (forgoes the retrieval benefit and breaks the rule that gates precede reveals) nor re-puzzle in full (punishes compliance with busywork). If the concept flag is absent, the cell is a full puzzle, so out-of-order students are handled by the same rule. The divided-difference recurrence itself does not recur in the splines notebook, so in this shipment the mechanism fires exactly once, on `lagrange_eval`; it exists because M2 and later modules reuse M1 machinery constantly.

---

## 8. Accessibility

**Keyboard.** The full model of section 5.1; every pointer action has a keyboard equivalent; the two lists are single tab stops with roving tabindex; grabbed state is visually distinct beyond color (elevation and a dashed outline) and announced.

**Screen reader.** Blocks are buttons inside lists labeled "workspace, 5 of 9 blocks placed" and "tray." One `aria-live="polite"` region announces every state change with position and indent: "Grabbed: for i, zero to blank." "Moved to row 6 of 9, indent level 2." "Dropped." "Returned to tray." Feedback cards are announced on render; the reveal announces "solved" and then exposes the mapping as paired list items ("pseudocode row 5 pairs with Python line 7") rather than relying on hover. Blanks are labeled by their block's text plus "blank" ("for i, zero to, blank").

**Touch.** Tap-to-place is primary on touch (drag also works via pointer events). Minimum target 44 × 44 px; the ‹ › indent buttons appear on the selected block rather than requiring horizontal drag precision; under 700 px the tray docks below the workspace and the workspace scrolls horizontally if a block at indent 3 overflows, with indent guides sticky.

**Reduced motion.** Under `prefers-reduced-motion: reduce`, block movement, reveal expansion, and unlock transitions are instant swaps; nothing conveys meaning by animation alone anywhere, so nothing is lost.

**Color and themes.** All colors come from the site palette variables with lab-specific aliases (`--lab-block-bg: var(--card-bg)` and so on) plus success, error, and dimmed roles defined per theme; every text-on-background pair meets WCAG AA 4.5:1 in both themes, and the dimmed bookkeeping style in the reveal must be checked explicitly since dimming is where dark themes usually fail contrast. Status is never color-only: solved shows a check glyph and the word, errors show text, the grabbed state has the outline. The page listens for changes to `html[data-theme]` via a MutationObserver so a mid-session toggle restyles live.

---

## 9. Worked lab specs

### 9.1 `newton_divided_differences.ipynb` (revised), full spec

Revised inventory, 18 cells, 11 code, 3 gates. Everything the original said is still said; what moved is where.

```
 0  md   title, Newton form motivation                               SHOWN
 1  code setup, imports, widget manager                              SHOWN
 2  md   the recurrence in subscript notation; coefficients are      DEFER until divdiff
         the top row
 3  code divided_differences (alone, docstring interface-only)       GATED  divdiff
 4  code print_dd_table                                              GATED  ddprint, light
 5  code demo: the table for x=[0,1,3,6], y=[1,4,2,8], printed,      SHOWN, captured
         plus the coefficient row
 6  md   nested evaluation, the Horner-like sweep written out        DEFER until neweval
         (new cell; absorbs what the old docstring gave away)
 7  code newton_eval (xq rename, coeffs[n-1], docstring trimmed)     GATED  neweval
 8  code demo: p at three query points; p(x_i) reproduces y_i        SHOWN, captured
 9  code f_demo, show_newton, show_newton(5)                         SHOWN, captured
10  code interact(show_newton, ...)                                  SHOWN, capture:
         show_newton(5) · show_newton(12)  (twelve nodes: Runge's
         phenomenon arrives, indifferent to the representation)
11  code appended nodes versus rebuilt equispaced set                SHOWN, captured
12  md   divided differences and derivatives                         SHOWN
13  code Taylor coefficient check, k = 1, 2, 3                       SHOWN, captured
14  md   coincident nodes and roundoff                               SHOWN
15  code the eps/h sweep                                             SHOWN, captured
16  md   summary                                                     SHOWN
17  md   things to try                                               SHOWN; finale card
```

The demo cells 5 and 8 are new notebook content, doing double duty: in Colab they give immediate feedback after each definition, and on the lab page their captured output is the reveal's "and it works" panel, computed on the same data the verifier's probes use. Cell 5's output is the exact triangle and coefficient row `[1, 3, −1.3333, 0.3222]` shown in the section 5.3 wireframe; those numbers now come from executing the cell.

Classification calls carried over from rev 2 and still holding: cell 11's `coeffs_for` is a three-line wrapper with the argument in its printed lists, no algorithm to assemble; cells 13 and 15 are measurement harnesses whose lessons are their tables. Three gates, an estimated 12 to 25 minutes.

**Gate `divdiff`, cell 3.** The literal spec of section 4, with line references against the revised cell: blocks map to lines 10 and 25 through 32, `py_glue` is the two `asarray` conversions on 23 and 24, the docstring (11 to 22, now interface-only) renders as the collapsed stub, and `.copy()` on 31 gets its aliasing annotation. Blanks `bound` and `den`, distractors `d_num`, `d_swap`, `d_colc`, wrong-blank sets, probe `x = [0,1,3,6]`, `y = [1,4,2,8]`, trace on `T`, feedback strings: all as written there. With cell 2 deferred, every one of these now tests reconstruction; the during-puzzle references are the textbook and the notation handout.

**Gate `ddprint`, cell 4, light.**

```
solution blocks                              indent   py
function print_dd_table(x, T):                 0      4
    n ← length(x)                              1      9
    for i ← 0 to n−1:                          1      12
        for j ← 0 to ⟨?rowlen⟩:                2      14
            print T[i, j]                      3      15
py_glue  10, 11, 13, 16   (header lines, row-string building, the print)
doc      5-8

blank      rowlen: answer n−i−1.
           wrong answers  n−1   ("you printed the whole square, including
             entries no column ever wrote")
                          n−j−1 ("j is the loop variable you are bounding;
             the row length cannot depend on it")
distractor d_swap: for j ← 0 to n−1: / for i ← 0 to n−j−1: (fused,
           transposed nest; "you printed the table by columns; the triangle
           you want has row i of length n−i")
verify     the interpreter's print trace: the sequence of (i, j) pairs
           printed, against the reference sequence, on the reference T
```

The reason this gate exists is unchanged: cell 3 bounds the shrinking dimension by `n−j−1` over columns, this cell bounds it by `n−i−1` over rows, and a student who pattern-matched the first bound writes the wrong one here and is told exactly that.

**Gate `neweval`, cell 7.**

```
solution blocks                              indent   py
function newton_eval(xn, c, t):                0      4
    n ← length(c)                              1      18
    p ← c[⟨?init⟩]                             1      19
    for k ← n−2 down to 0:                     1      20
        p ← p · (t − xn[k]) + c[k]             2      21
    return p                                   1      22
py_glue  17 (asarray)
doc      5-16

blanks     init: answer n−1. Wrong answers 0 ("starting from c[0] pairs
           with a forward sweep; this loop runs backward") and n (runtime
           index message does the teaching).
distractors
  d_fwd    for k ← 1 to n−1:   ("nesting builds from the innermost
           parenthesis outward, which is the LAST coefficient")
  d_node   p ← p · (t − c[k]) + c[k]   ("the factors (t − x_k) use the
           NODES; you are shifting by coefficients")
probes     xn = [0,1,3,6], c = the reference coefficients from divdiff,
           t ∈ {0.5, 2.0, 5.0}; return values only, three t so the
           constant-polynomial failure cannot pass by luck
reveal     annotation ①: the Python line is vectorized over an array xq of
           query points; your pseudocode is the same update at one t, and
           np.full_like is the vectorized twin of p ← c[n−1].
           The line 19 pairing p ← c[n−1] ↔ coeffs[n - 1] is now exact,
           which is why the notebook dropped coeffs[-1].
```

Cell 6, deferred, opens when `neweval` is solved or parked: the nested form with the inside-out reading is the debrief, in prose instead of a docstring.

### 9.2 `interpolation_runge_chebyshev.ipynb` (revised), sketch

Revised inventory, 20 cells, 9 code. The old two-function node cell is split; two new markdown cells (Chebyshev formula, Lagrange form) absorb what the docstrings gave away and defer on the page.

```
 0 md    intro                                  SHOWN
 1 code  setup                                  SHOWN
 2 md    error formula, the node polynomial     SHOWN (motivates; does not
                                                answer any gate)
 3 code  equispaced_nodes                       SHOWN (three lines around
                                                linspace; nothing to gate)
 4 md    Chebyshev nodes, the cos formula,      DEFER until chebnodes
         the semicircle picture, the rescale
 5 code  chebyshev_nodes                        GATED  chebnodes
         Blocks: for k ← 0 to n:, θ ← ((2·k+1) / ⟨?frac⟩) · π,
         x[k] ← cos(θ), rescale x[k] ← ⟨?map⟩ per k.
         Blanks: frac = 2·(n+1); map = (a+b)/2 + ((b−a)/2)·x[k].
         Distractors: the second-kind angle k/n · π (probe puts nodes AT
         ±1: "your nodes include the endpoints; first-kind nodes do not");
         rescale (b−a)·x[k] (probe a=0, b=4 lands nodes outside [a, b]).
         Probes: (a,b,n) = (−1,1,3) and (0,4,3).
         Reveal: the np.arange / vectorized cos pairing is the vectorization
         annotation; the docstring is interface-only now.
 6 md    the Lagrange form, p = Σ y_i L_i,      DEFER until lageval
         the L_i product formula
 7 code  lagrange_eval (xq rename)              GATED  lageval, concept
                                                lagrange_eval
         Pointwise: outer i-loop, inner j-loop building L as a running
         product with guard j ≠ i, accumulate values[i] · L.
         Blanks: the product factor (t − xn[j]) / (xn[i] − xn[j]); the
         guard. Distractors: guard omitted (division by zero at j = i;
         the runtime message is the lesson); the accumulator init at the
         wrong depth (same text as the real init block; the canonical
         indentation-matters puzzle).
 8 code  test-function registry                 SHOWN
 9 code  show_interpolation plotting            SHOWN
10 md    node polynomial prose                  SHOWN
11 code  omega + the max table                  GATED-LITE: two blocks, the
         running product again, no distractors (rev 3 policy: structural
         cousin of lageval, hand-tuned down)
12 md    the pessimistic bound                  SHOWN
13 md    error against degree                   SHOWN
14 code  max_error sweep                        SHOWN, captured
15 md    reading the four curves                SHOWN
16 md    controls prose                         SHOWN
17 code  interact                               SHOWN, capture (three frames):
         show_interpolation(8, "equispaced", ...) ·
         show_interpolation(20, "equispaced", ...) ·
         show_interpolation(20, "Chebyshev", ...)
18 md    summary                                SHOWN
19 md    things to try                          SHOWN; finale card
```

### 9.3 `cubic_splines.ipynb` (revised), sketch

Revised inventory, 18 cells, 10 code. The one big moments cell is now three: interior equations (the algorithmic core, gated whole), boundary plus wrapper (shown), and evaluation (gated). No regions, no context blocks; the split IS the region mechanism, done in the notebook where it belongs. A new demo cell prints the assembled system for the same `[0,1,3,6]` data family the other labs probe with.

```
 0 md    intro                                  SHOWN
 1 code  setup                                  SHOWN
 2 md    the tridiagonal system, full interior  DEFER until interior
         equation displayed
 3 code  piecewise_linear                       SHOWN
 4 code  spline_interior_equations              GATED  interior
         Blocks: n ← length(x) − 1; the h loop (for i ← 0 to n−1:
         h[i] ← x[i+1] − x[i], with np.diff as its vectorized reveal
         pair); A ← zeros(n+1, n+1); d ← zeros(n+1); for i ← 1 to n−1:;
         the three A-row assignments; d[i] ← ⟨?rhs⟩.
         Blank: rhs = 6·((y[i+1]−y[i])/h[i] − (y[i]−y[i−1])/h[i−1]).
         Distractors: for i ← 0 to n: (touches the boundary rows and reads
         h[−1] at i = 0, a runtime index error in the interpreter, and the
         reveal annotates that Python's silent negative indexing would have
         hidden exactly this bug); A[i, i] ← h[i−1] + h[i] missing the 2
         (wrong M everywhere; generic entry diff carries it).
         Probe: x = [0,1,3,6], y = [1,4,2,8]; trace on A and d.
 5 code  apply_boundary + cubic_spline_moments  SHOWN. Natural and clamped
         wrapper (calls interior, boundary,     rows, the solve behind the
         np.linalg.solve)                       `solve(A, d)` primitive; the
                                                reveal annotation defers HOW
                                                to Module 4
 6 code  demo: A, d, and M for the small mesh   SHOWN, captured
 7 code  cubic_spline_eval                      GATED  spleval
         Pointwise at one t: panel index i as a fixed context block
         ("i ← the panel with x[i] ≤ t ≤ x[i+1]", searchsorted dimmed
         behind it), a ← x[i+1] − t, b ← t − x[i], the moment formula
         with blank ⟨?⟩ = 6·h[i]. Distractor: a and b swapped (probe at
         an asymmetric t: "your spline is mirrored within each panel").
 8 code  show_spline comparison                 SHOWN, captured
 9 code  interact                               SHOWN, capture (three frames):
         show_spline(7,"cubic","natural") · show_spline(7,"cubic","clamped")
         · show_spline(7,"linear")
10 md    the cost of the boundary condition     SHOWN
11 code  error_split study                      SHOWN, captured
12 md    reading the rates                      SHOWN
13 md    against a single polynomial            SHOWN
14 code  runge + lagrange_eval + head-to-head   RECAP on lagrange_eval
                                                (concept flag from Lab 1 →
                                                reduced rebuild; full puzzle
                                                without it); the comparison
                                                printout captured
15 md    why the spline wins                    SHOWN
16 md    summary                                SHOWN
17 md    things to try                          SHOWN; finale card
```

The `spline_interior_equations` / `apply_boundary` split is defensible as Python independent of the lab: interior continuity supplies n−1 equations and the boundary condition supplies 2, and the code now says so structurally. The `cubic_spline_moments` wrapper keeps the original signature, so every downstream cell is untouched.

## 10. Failure modes and open questions

**Degradation to the loop-free notebooks, in one paragraph.** `floating_point_cancellation` and `numerical_differentiation_optimal_h` are sequences of expressions where ordering carries little content (the U-curve cell is a sweep and a plot; the substance is in expressions like `(f(x+h) − f(x))/h` and the error model). Parsons ordering is the wrong instrument there, and forcing it would produce guessable shuffles. The design degrades by shifting weight to the other two mechanisms it already has: blank-dominant cells (one or two fixed-order blocks whose blanks are the finite-difference formulas, the predicted `h* ≈ sqrt(u)` and `u^(1/3)` exponents, the Richardson combination `(4·D(h/2) − D(h))/3` coefficients) verified by the same expression evaluation, and `accept_with_note` for near-miss formulas. No new machinery, but the authoring center of gravity moves from distractor design to wrong-blank design, and a lab that is all blanks reads as a worksheet rather than a puzzle. That is acceptable for two notebooks out of nineteen; if it grates, those two want a third cell mode (predict-the-output multiple choice before reveal) that this design leaves unbuilt.

**A schema feature with no instance in M1.** `accept_with_note` marks a block that is behaviorally correct and pedagogically wrong, verified structurally rather than by probe, accepted with a post-solve note. Rev 1 motivated it with an incremental-table puzzle that does not exist in the real notebook. It stays in the schema because the case is real (an assembly that recomputes what it could reuse, or expands products where Horner nests, passes every probe by construction), but nothing in M1 exercises it, so it is unbuilt until a later module produces one. Do not implement it in the first pass.

**Where it is likely to break or annoy.**

- *Metadata authoring ergonomics.* JSON-in-cell-metadata with embedded `⟨?⟩` markers and escaped newlines in compound distractors is unpleasant to write by hand. Mitigation is the validator catching every mistake at build time, and optionally a small `tools/lab_edit.py` that round-trips a cell's `lab` block to a YAML temp file. If authoring friction turns out to dominate, that tool is the first thing to build in the implementation pass.
- *`py` line-range rot.* `py_match` substrings catch most drift, and the validator fails the build on mismatch, but a refactor that keeps the matched substring on a moved line passes wrongly. The reveal then highlights the wrong Python line. Low frequency, cosmetic blast radius, but you revise often; the discipline is to re-run `build_labs.py` after every notebook edit, so it belongs in whatever you already run before committing.
- *Interpreter-versus-NumPy semantic drift.* The pointwise rule and the `solve` primitive eliminate the big divergences, and JS doubles are IEEE 754 binary64, the same as float64, so arithmetic agrees. Residual risk sits in library functions (`cos` at the last ulp) and is absorbed by the 1e−9 relative tolerance and by the design choice that reference values come from the same interpreter, so student-versus-reference comparisons can never drift at all. The build-time Python-versus-JS sanity check exists only to catch authoring errors in the reference blocks themselves.
- *Colab round-trips.* If you ever open the repo notebook in Colab, edit, and commit the download back, Colab rewrites metadata and may drop or mangle the `lab` keys. The validator will fail loudly rather than ship a broken lab, but the recovery is manual. Rule: notebooks are edited in Jupyter or a text editor, never round-tripped through Colab.
- *Guessability.* English-shaped blocks leak structure; the counters are the minimal-edit distractor rule (every distractor differs from a real block only inside brackets, bounds, or operands), no comment or decorative blocks in any tray, and blanks carrying the highest-value content so that pure shape-matching still leaves the student facing the denominator. A student who solves by elimination has still read every index, which is most of the point.
- *Inspectability.* The spec JSON contains solution order, blank answers, and every feedback string; view-source defeats everything. Accepted for formative use. Where it bites: (1) these labs can never be promoted to graded assessment without a rebuild, and it is worth writing that down now so it is not discovered under deadline; (2) feedback strings double as a solution manual for anyone who looks, which slightly cheapens assigning the labs as pre-class prep if you also want the mistakes to be discussable cold in class.
- *Demo cells drift.* The demo cells added in rev 4 hard-code the probe data, and the probes live in metadata; nothing forces them to stay equal. If one is edited without the other, the reveal's captured numbers stop matching what the verifier checked. Cheap fix, worth doing: the validator compares each gated cell's probe env against its demo cell's literals and warns on mismatch.
- *Progress wipes.* `spec_hash` invalidation on any gated-cell edit means active-term puzzle fixes reset student progress in that lab. Scoped to the edited lab and announced on the page, but a mid-week distractor typo fix will annoy whoever was on cell 3 of 3.
- *Puzzle fatigue.* Three to four gates per lab at an estimated 3 to 10 minutes each puts a lab at 20 to 40 minutes before Colab. That is a feature for assigned prep and a wall for casual browsing; the applet library's ungated Launch remains the casual path, and the labs should be linked as the assigned one.

**Decisions taken in rev 3** (formerly the open questions).

1. *Prose that answers the puzzle.* Resolved: `defer` mode, per your call, with the textbook and notation handout as the sanctioned during-puzzle references. Applied in rev 4 to Newton cells 2 and 6, Runge cells 4 and 6, and splines cell 2; the Runge deferrals exist because the rev 4 docstring trim moved the Chebyshev formula and the Lagrange form out of docstrings and into markdown cells, where deferral can govern them.
2. *Probe visibility.* Delegated, decided on the IBL principle: the student's own computed trace is always visible next to the failure card, and the reference table never is. Their wrong table is evidence they generated and should be reading; the correct table is an answer key. Section 6.1 carries the full statement.
3. *`interact` capture.* Multiple frames, per your call. The schema takes a list of captioned capture calls; all three specs now name two or three frames chosen to argue with each other (degree 8 against degree 20 against Chebyshev; natural against clamped against linear).
4. *Ladder stage 5.* Reworked, per your direction: no in-page solution exists at any stage. Stage 5 offers parking (unlocks the rest of the lab, leaves the puzzle open) and a "copy my attempt" snapshot built for an office-hours conversation: the assembly as placed, blank contents, attempt count, last feedback message. The real Python behind an unsolved puzzle is visible only in the finale notebook. Consequence accepted knowingly: a determined student can park through an entire lab at five failed attempts per gate; that is enough friction for formative work and the snapshot trail means they arrive at office hours with the right artifact anyway.

**Still under review.**

5. *Reduced-rebuild scope.* Default policy, adopted for now: the recap mechanism fires on exact concept match only, and structural cousins (`omega` against `lagrange_eval`'s inner loop) are hand-tuned per cell, with gated-lite as the usual answer. No taxonomy will make this call reliably; revisit after teaching M1 once, when you will know whether the hand-tuned cells felt like recaps or like busywork.
