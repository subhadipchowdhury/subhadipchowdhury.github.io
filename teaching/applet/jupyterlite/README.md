# JupyterLite build workspace

This folder builds the in-browser notebook site served at
`/teaching/applet/lite/`. The built output (`../lite/`) is committed into the
site repo and served as static files by GitHub Pages, so **the live site has no
dependency on this workspace or on the notebook source repo** — a rebuild is
only needed when the notebooks change.

## Layout

- `content/` — the notebooks that get published (one per Applet Library card).
  Add or update a notebook here, then rebuild. The filename here must match the
  `?path=` in the card's `launchUrl` in `../index.html`.
- `requirements.txt` — build-time Python packages (not installed on the server).

## Rebuild

From a shell with the Python launcher available (Windows `py`, or `python3`):

```sh
# 1. one-time: create a build venv and install the stack
py -3.14 -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # POSIX: .venv/bin/python

# 2. build content/ into ../lite/  (run from this folder)
.venv/Scripts/jupyter lite build --contents content --output-dir ../lite

# 3. strip source maps (~50 MB of debug-only .map files the site never needs)
find ../lite -name '*.map' -delete            # PowerShell: gci ../lite -r -filter *.map | rm

# 4. commit the changed files under ../lite/ and ./content/
```

The first Launch in a browser downloads the Pyodide runtime (~20 s), then it is
cached. numpy, matplotlib, sympy, mpmath and ipywidgets all run in the Pyodide
kernel; `ipywidgets` works because `jupyterlab-widgets` is in the build env.

## Notes

- Notebooks are flattened to bare filenames in `content/` (the source repo keeps
  them in numbered folders). Keep filenames unique.
- To publish a new activity: drop its `.ipynb` in `content/`, rebuild, and add a
  record with a `launchUrl` to the `ACT` array in `../index.html`.
