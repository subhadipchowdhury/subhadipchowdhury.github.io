"""Prepare content notebooks for JupyterLite before building.

The Pyodide runtime bundles numpy/matplotlib/sympy/mpmath but NOT ipywidgets,
and imports only auto-load Pyodide packages. So any notebook that uses widgets
must install ipywidgets once per browser session via piplite. This script
inserts a `%pip install ipywidgets` cell ahead of the first code cell of every
content notebook that imports ipywidgets and doesn't already have the install.

Idempotent: safe to re-run after re-copying notebooks from the source repo.

Usage (from this folder, with the build venv):
    .venv/Scripts/python prepare_content.py
"""

import json
import pathlib

CONTENT = pathlib.Path(__file__).parent / "content"
INSTALL_SRC = "%pip install ipywidgets"
MARKER = "pip install ipywidgets"


def cell_text(cell):
    src = cell.get("source", "")
    return src if isinstance(src, str) else "".join(src)


def main():
    changed = []
    for nb_path in sorted(CONTENT.rglob("*.ipynb")):
        nb = json.loads(nb_path.read_text(encoding="utf-8"))
        cells = nb.get("cells", [])
        code = [c for c in cells if c.get("cell_type") == "code"]
        uses_widgets = any("ipywidgets" in cell_text(c) for c in code)
        already = any(MARKER in cell_text(c) for c in code)
        if not uses_widgets or already:
            continue
        install_cell = {
            "cell_type": "code",
            "metadata": {},
            "execution_count": None,
            "outputs": [],
            "source": [INSTALL_SRC],
        }
        first_code_idx = next(
            (i for i, c in enumerate(cells) if c.get("cell_type") == "code"), 0
        )
        cells.insert(first_code_idx, install_cell)
        nb["cells"] = cells
        nb_path.write_text(json.dumps(nb, indent=1, ensure_ascii=False), encoding="utf-8")
        changed.append(nb_path.name)

    print(f"injected install cell into {len(changed)} notebook(s):")
    for n in changed:
        print(f"  {n}")


if __name__ == "__main__":
    main()
