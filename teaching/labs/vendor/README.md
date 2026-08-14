# Vendored dependencies

No front matter on purpose: Jekyll copies this file verbatim instead of
rendering it as a page of the site.

One directory per library. Both are pinned copies, tracked in git rather than
fetched from a CDN, and neither is edited here: to change a version, replace the
file and update this note.

| Directory | Version | Licence | Used by |
|---|---|---|---|
| `jelly/` | Jelly UI, `dist/jelly.js` | MIT, © 2026 bmson (`jelly/LICENSE`) | `teaching/labs/index.html`, for `jelly-input`, `jelly-select`, `jelly-button` and `jelly-switch` |
| `plotly/` | plotly.js 2.27.0, gl3d partial bundle, minified | MIT, © 2012-2023 Plotly, Inc. (header of the file) | `applets/de/heat-forced-3d.html`, whose `surface` trace needs gl3d |

The gl3d bundle rather than the full one: a `surface` trace needs gl3d and
nothing else on that page does, and the full bundle is more than twice the size.

Plotly is vendored rather than fetched because it is the only dependency whose
absence makes a page do nothing at all. MathJax failing leaves readable LaTeX
and a missing font falls back, but no Plotly means no plot.
