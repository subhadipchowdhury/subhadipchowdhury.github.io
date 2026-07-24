# Handoff: Interactive Math Applet Library

## Overview
A catalog / launcher page for interactive math activities, to live under
`https://subhadipchowdhury.github.io/teaching/applet/`. Students browse activities
across courses (Numerical Analysis, Differential Equations, Calculus, Real Analysis),
search/filter/sort them, and click **Launch** to open each activity. Each activity is a
Python notebook meant to run **in the browser via JupyterLite (Pyodide)** — no server, no
login. This bundle is the finished **front-end**; the remaining work is (1) deploying the
page and (2) wiring each Launch button to a JupyterLite notebook.

## About the Design Files
The files in this bundle are **design references created as HTML** (a streaming
"Design Component" prototype). They show the intended look and behavior — they are not a
production framework component to copy verbatim. The task is to **recreate this design in
the target environment** and wire up the real backend. Two reasonable paths:

- **Ship close to as-is (simplest).** The prototype is plain HTML + one third-party web-component
  library (Jelly UI) loaded from a CDN `<script>`. It can be flattened into a single static
  `index.html` that drops straight into the Jekyll site with almost no rework. This is the
  recommended path given the site is static GitHub Pages.
- **Reimplement in a framework** (React/Vue/etc.) if you prefer. In that case treat the HTML
  as a pixel spec and rebuild using your own components; the data model and tokens below are
  everything you need.

Either way, **the design is done — the real work is the JupyterLite integration** (see that
section).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate the UI
pixel-for-pixel. All exact values are in **Design Tokens** below.

## The one integration point: JupyterLite

This is the part to build. Everything else is presentational.

### Current state
Every activity has a `thumb` field holding its **notebook filename** (e.g.
`runge_chebyshev.ipynb`, or for the three existing HTML applets, `HeatEquation3D.html`).
Each card renders two links, both currently `href="#"`:
- **▶ Launch** — should open the activity's JupyterLite notebook.
- **Notebook** — should link to the raw `.ipynb` source (e.g. on GitHub) for download.

### What to implement
1. **Deploy a JupyterLite site** (its own GitHub Pages deployment or a subfolder, e.g.
   `/teaching/applet/lite/`). Bundle the course notebooks into it via `jupyter lite build`
   with the notebooks in `content/`. The demos use `numpy, matplotlib, sympy, mpmath,
   ipywidgets` — all available in the Pyodide kernel; `ipywidgets` needs
   `jupyterlite-pyodide-kernel` and the widgets extension enabled.
2. **Point Launch at the deployed notebook.** JupyterLite opens a notebook by URL, e.g.
   `…/lite/lab/index.html?path=<notebook>.ipynb` (JupyterLab UI) or
   `…/lite/notebooks/index.html?path=<notebook>.ipynb` (single-notebook "Retro" UI, better
   for students — less chrome). Add a `launchUrl` (and optional `sourceUrl`) field to each
   activity record and build the href from it instead of `#`.
3. **First-launch cost.** The first notebook download pulls the Pyodide runtime (~20 s /
   tens of MB), then it's cached. The footer already tells students this — keep that copy.

### Data contract for the developer
The page is driven by one array (`ACT`) of activity records. Add link fields:
```js
{
  id: '01',
  course: 'na',                       // 'na' | 'de' | 'calc' | 'analysis'
  module: 'M1 · Interpolation',       // "<label> · <Topic>" or just "<Topic>"; the Topic
                                      // (text after " · ") is shown as the card tag
  title: "Runge's phenomenon & Chebyshev nodes",
  blurb: 'Watch equispaced interpolation diverge, then Chebyshev nodes tame the error.',
  libs: ['numpy','matplotlib','ipywidgets'],
  status: 'finalized',                // 'finalized' → "Ready" | 'drafted' → "Draft" | 'planned' → "Planned"
  thumb: 'runge_chebyshev.ipynb',     // notebook filename (shown on the card thumbnail)
  // --- ADD THESE ---
  launchUrl: '/teaching/applet/lite/notebooks/index.html?path=runge_chebyshev.ipynb',
  sourceUrl: 'https://github.com/subhadipchowdhury/numerical_analysis_demos/blob/master/01_interpolation_runge_chebyshev/…'
}
```
The module-order/topic scheme is intentionally quarter-agnostic (per the instructor, the
sequence changes between quarters): the card tag shows only the **topic**, never a module
number, and the default sort is labeled "Default order" (it is simply the array order — reorder
`ACT` to change it).

## Screens / Views

### Applet Library (single page)
- **Purpose:** browse, search, and launch activities.
- **Layout:** single centered column, `max-width: 1240px`, horizontal padding `32px`,
  bottom padding `80px`. Page background `#FBF9F6`. Three stacked regions: header → sticky
  controls → results grid → footer.

**Header** (`padding: 52px 0 8px`)
- Eyebrow: IBM Plex Mono, 11px, `letter-spacing:.15em`, uppercase, `#4F7FE0`, weight 500 —
  "UChicago · Department of Mathematics".
- H1: Bricolage Grotesque, weight 800, `clamp(38px,6vw,58px)`, `line-height:.98`,
  `letter-spacing:-.03em`, `#161512` — "The Applet Library".
- Subtitle: IBM Plex Sans, 16px, `line-height:1.55`, `#000000a6`, `max-width:600px`.
- Search row (`max-width:600px`): a `<jelly-input type="search">` (flex:1) + a hint
  "press `/`" using `<jelly-kbd>`.

**Sticky controls bar** (`position:sticky; top:0; z-index:5`)
- Background `#FBF9F6f2` + `backdrop-filter: blur(10px)`; bottom border `1px solid #00000012`;
  `padding:16px 0`.
- Row 1 — course filter chips: `<jelly-button>` per course, flex-wrap, `gap:8px`. Active chip
  uses the course's Jelly variant (`graphite` for "All", else `mint`/`azure`/`amber`/`rose`);
  inactive uses variant `white`. Each label is "`<Course>` `<count>`" (count at `opacity:.5`,
  tabular-nums).
- Row 2 (`margin-top:14px`, space-between): left = results count "Showing **N** of M
  activities" (IBM Plex Mono 12.5px, `#000000a6`, N in `#161512`); right = "Sort"
  `<jelly-select>` (options: Default order / Title A–Z / By course) and a
  `<jelly-switch>` labeled "Ready only".

**Results grid** (`margin-top:26px`)
- `display:grid; grid-template-columns:repeat(auto-fill,minmax(278px,1fr)); gap:20px`.
- One **ActivityCard** per activity (see component below).
- **Empty state** (no matches): centered, `padding:80px 20px`. Bricolage 22px `#161512`
  "No activities match that." + 14px `#00000080` hint + a `graphite` "Clear filters" button.

**Footer** (`margin-top:64px; padding-top:28px; border-top:1px solid #00000012`; two columns,
space-between)
- Left (`max-width:520px`): "🐍 How the activities run" (Bricolage 15px, weight 700) + 13px
  `#000000a6` paragraph explaining JupyterLite/Pyodide.
- Right (`max-width:300px`, 12px `#00000080`): mono label "SUBHADIP CHOWDHURY", title lines,
  and "Content licensed [CC BY-NC-SA 4.0]".

### Component: ActivityCard
Fixed vertical card, fills its grid cell.
- **Container:** `background:#fff; border:1px solid #00000010; border-radius:20px;
  box-shadow:0 14px 32px -22px #00000066; overflow:hidden`. Hover (transition
  `.18s ease`): `transform:translateY(-4px); box-shadow:0 24px 48px -22px #00000073`.
- **Thumbnail band** (`height:126px`): placeholder = a diagonal hatch
  `repeating-linear-gradient(135deg,#0000 0 13px,#0000000a 13px 14px)` over
  `linear-gradient(135deg,#F5F2EC,#ECE8E1)`. Overlays:
  - top-left course pill: white `#ffffffec` pill, 11px weight 600, with an 8px dot in the
    **course accent** color + course name.
  - top-right status chip: bg/fg from the **status** tokens, 10px weight 700, uppercase,
    `letter-spacing:.05em`.
  - bottom-left filename chip: IBM Plex Mono 10.5px `#00000066` on `#ffffffd6`.
- **Body** (`padding:15px 16px 18px; gap:9px`):
  - **Topic tag:** IBM Plex Mono 10px, weight 500, `letter-spacing:.06em`, uppercase, text =
    course accent, background = course accentSoft, pill radius. (Text after " · " in `module`.)
  - **Title:** Bricolage Grotesque, weight 700, 16.5px, `line-height:1.2`,
    `letter-spacing:-.01em`, `#161512`, `text-wrap:pretty`.
  - **Blurb:** IBM Plex Sans 12.5px, `line-height:1.5`, `#00000099`, `flex:1`.
  - **Library tags:** flex-wrap `gap:6px`, each IBM Plex Mono 10px `#00000073`, bg
    `#00000008`, border `1px solid #0000000f`, pill.
  - **Actions row** (`gap:8px`): **▶ Launch** = solid button, background = course accent,
    white text, weight 600, 12.5px, radius 12px, `flex:1`, centered. **Notebook** = ghost
    button, `#00000099` text, border `1px solid #00000016`, radius 12px.

## Interactions & Behavior
- **Search:** live filter on `input` (and `change`) across title + blurb + course + topic +
  libs, case-insensitive substring.
- **Course chips:** click sets the active course filter (`'all'` shows everything). Active
  chip is color-filled.
- **Sort:** `module` (array order, labeled "Default order"), `az` (title A–Z), `course`
  (group by course name).
- **Ready only switch:** filters to `status === 'finalized'`.
- **Keyboard:** `/` focuses the search box (unless already typing in a field); `Esc` clears
  the query when non-empty. Cards are anchor links (tab-focusable).
- **Hover:** cards lift `-4px` with a deeper shadow over `.18s ease`.
- **Empty state:** shown when the filtered list is empty; "Clear filters" resets course,
  query, and the Ready-only switch.
- **Responsive:** grid auto-fills at a 278px min column; header H1 uses `clamp()`; controls
  bar wraps.

## State Management
Four state variables drive the whole page:
- `courseFilter: 'all' | 'na' | 'de' | 'calc' | 'analysis'`
- `query: string`
- `finalizedOnly: boolean`
- `sort: 'module' | 'az' | 'course'`
Derived each render: the filtered+sorted list, the result count, per-course counts, and
`hasResults`. No data fetching — the activity list is a static array (see data contract).
Two configurable options (rendered as host "Tweaks" in the prototype, but really just
top-level config): `hideUnready` (force Ready-only, for a public view) and `defaultCourse`
(which filter is active on load).

## Design Tokens

**Fonts** (Google Fonts)
- Display: `Bricolage Grotesque` (weights 400–800)
- Text: `IBM Plex Sans` (400/500/600)
- Mono / tags / filenames: `IBM Plex Mono` (400/500)

**Core colors**
- Page background: `#FBF9F6`
- Text: `#161512`
- Link: `#4F7FE0`; link hover: `#3a63bd`
- Hairline borders: `#00000012` / `#00000010`

**Course accents** (accent / accentSoft background)
- Numerical Analysis (`na`): `#2FA97D` / `#E6F5EF` — Jelly variant `mint`
- Differential Equations (`de`): `#4F7FE0` / `#EAF0FD` — Jelly variant `azure`
- Calculus (`calc`): `#CE8A2C` / `#F8EFDD` — Jelly variant `amber`
- Real Analysis (`analysis`): `#D65C82` / `#FBE9EF` — Jelly variant `rose`

**Status chips** (background / foreground / label)
- `finalized`: `#DFF3EA` / `#1E7A57` / "Ready"
- `drafted`: `#FBEFD6` / `#9A6B15` / "Draft"
- `planned`: `#ECEAE6` / `#6B6B6B` / "Planned"

**Radii:** cards 20px; buttons/tags 12px; pills/chips 999px.
**Card shadow:** rest `0 14px 32px -22px #00000066`; hover `0 24px 48px -22px #00000073`.
**Grid:** `repeat(auto-fill,minmax(278px,1fr))`, gap 20px. **Page:** max-width 1240px, pad 32px.

## Third-party library: Jelly UI
Interactive controls use **Jelly UI** (MIT, dependency-free web components), loaded from a
single module script:
```html
<script type="module" src="https://jelly-ui.com/package.js"></script>
```
Components used: `jelly-theme` (wrap the page, `mode="light"`), `jelly-input`, `jelly-button`
(`variant`), `jelly-select` + `jelly-option`, `jelly-switch`, `jelly-kbd`. Font tokens are
overridden to the fonts above via `:root { --jelly-font-display/-text/-mono }`. If you'd
rather not depend on the CDN, self-host `package.js` + its `dist/` (see the Jelly UI repo),
or rebuild these few controls natively — they're standard form controls.

## Assets
- **No image assets.** Thumbnails are pure-CSS striped placeholders with the notebook
  filename shown in monospace. If real preview images are added later, drop them into the
  thumbnail band in place of the gradient.
- Fonts load from Google Fonts; Jelly UI from its CDN. Everything else is inline CSS.

## Files
- `Applet Library.dc.html` — the page (markup + logic + the `ACT` data array).
- `ActivityCard.dc.html` — the card component (pure template; reads one `activity` object).

Both are self-contained HTML that open directly in a browser. The `.dc.html` format is a
streaming component wrapper; the meaningful parts for reimplementation are the inline styles
(the pixel spec) and the `ACT` array + filtering logic in the `<script>` class. A developer
can open them in a browser to see the exact target.
