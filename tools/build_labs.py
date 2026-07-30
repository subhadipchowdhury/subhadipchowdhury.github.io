"""Turn an annotated notebook into a lab spec the page can serve.

    .venv/bin/python tools/build_labs.py                 # every annotated notebook
    .venv/bin/python tools/build_labs.py m1-newton       # one lab
    .venv/bin/python tools/build_labs.py --skip-execute  # reuse captured output

Four steps per notebook.

1. Read `metadata.lab` from the notebook and from every cell, and check each
   gated block's `py` line range against its `py_match` substring, so an edit
   that shifts line numbers fails here rather than mispointing the reveal.
2. Execute with nbclient and capture stdout and figures. Cells whose metadata
   carries `capture` get those calls run in the same kernel right after them,
   because an ipywidgets interact emits a widget, not a picture.
3. Hand the spec to tools/validate.mjs, which runs every distractor and every
   authored wrong blank through the real interpreter and fails the build if any
   of them produces the same answer as the solution on the probes.
4. Write the spec JSON and the figures.

The notebook is the source of truth throughout. Nothing here edits it.
"""

import argparse
import base64
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTEBOOK_DIR = ROOT / 'teaching/applet/notebooks'
SPEC_DIR = ROOT / 'teaching/applet/lab/specs'
OUT_DIR = ROOT / 'teaching/applet/lab/out'
VALIDATOR = ROOT / 'tools/validate.mjs'
JSC = pathlib.Path(
    '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
)

COLAB_BASE = (
    'https://colab.research.google.com/github/subhadipchowdhury/'
    'subhadipchowdhury.github.io/blob/master/teaching/applet/notebooks/'
)


class BuildError(Exception):
    pass


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

MATH_PATTERNS = [
    (re.compile(r'\$\$.*?\$\$', re.S), 'display'),
    (re.compile(r'\\\[.*?\\\]', re.S), 'display'),
    (re.compile(r'(?<!\\)\$(?!\s).*?(?<!\s)(?<!\\)\$', re.S), 'inline'),
    (re.compile(r'\\\(.*?\\\)', re.S), 'inline'),
]


def render_markdown(text):
    """Markdown to HTML, with the maths left exactly as written.

    MathJax runs on the page, so the maths must survive untouched. A markdown
    renderer would otherwise read the underscores in f[x_i, ..., x_{i+j}] as
    emphasis, so every math span is lifted out first and put back after.
    """
    import markdown

    spans = []

    def stash(match):
        spans.append(match.group(0))
        return f'\x00MATH{len(spans) - 1}\x00'

    protected = text
    for pattern, _ in MATH_PATTERNS:
        protected = pattern.sub(stash, protected)

    html = markdown.markdown(
        protected,
        extensions=['extra', 'sane_lists'],
        output_format='html5',
    )

    for i, span in enumerate(spans):
        html = html.replace(f'\x00MATH{i}\x00', span)
    return html


def first_heading(text):
    for line in text.split('\n'):
        stripped = line.strip()
        if stripped.startswith('#'):
            return stripped.lstrip('#').strip()
    return None


# ---------------------------------------------------------------------------
# Reading and checking the notebook
# ---------------------------------------------------------------------------


def cell_source(cell):
    src = cell['source']
    return ''.join(src) if isinstance(src, list) else src


def check_py_refs(gate, source, cell_index):
    """Every block names a line range and a substring that range must contain."""
    lines = cell_source_lines(source)
    for block in gate['blocks']:
        lo, hi = block['py']
        if lo < 1 or hi > len(lines):
            raise BuildError(
                f'cell {cell_index}, block "{block["id"]}": lines {lo}-{hi} are '
                f'outside the cell, which has {len(lines)}'
            )
        needle = block.get('py_match')
        if needle and needle not in lines[lo - 1]:
            raise BuildError(
                f'cell {cell_index}, block "{block["id"]}": line {lo} should contain\n'
                f'    {needle!r}\n'
                f'  but it reads\n'
                f'    {lines[lo - 1].strip()!r}\n'
                f'  The notebook was edited without updating the lab metadata.'
            )


def cell_source_lines(source):
    return source.split('\n')


def build_reveal(gate, source, cell_index):
    """Pair every Python line with a pseudocode row, or with a reason it has none.

    The mapping has to be total. A line with no role is a line the reveal would
    show unexplained, and that is the one thing the reveal is for.
    """
    lines = cell_source_lines(source)
    roles = [None] * len(lines)

    def mark(lo, hi, role, **extra):
        for n in range(lo, hi + 1):
            if roles[n - 1] is not None and roles[n - 1]['role'] != 'space':
                raise BuildError(
                    f'cell {cell_index}: line {n} is claimed by both '
                    f'{roles[n - 1]["role"]} and {role}'
                )
            roles[n - 1] = {'role': role, **extra}

    for n, text in enumerate(lines, start=1):
        if text.strip() == '':
            roles[n - 1] = {'role': 'space'}

    head = gate.get('py_head')
    if head:
        mark(head[0], head[1], 'head')
    doc = gate.get('py_doc')
    if doc:
        mark(doc[0], doc[1], 'doc')
    for n in gate.get('py_glue', []):
        mark(n, n, 'glue')

    order = {s['id']: i + 1 for i, s in enumerate(gate['solution'])}
    for block in gate['blocks']:
        lo, hi = block['py']
        mark(lo, hi, 'block', blockId=block['id'], num=order.get(block['id']))

    missing = [n for n, role in enumerate(roles, start=1) if role is None]
    if missing:
        raise BuildError(
            f'cell {cell_index}: the reveal mapping is not total. '
            f'Lines {missing} have no role. Add them to py_head, py_doc or '
            f'py_glue, or give them a block.'
        )

    return [
        {'n': n, 'text': lines[n - 1], **roles[n - 1]}
        for n in range(1, len(lines) + 1)
    ]


def gate_hash(gate):
    """Per-gate, so fixing a typo in one puzzle does not reset a student's
    progress on the others in the same lab."""
    payload = {
        key: gate.get(key)
        for key in ('blocks', 'solution', 'blanks', 'distractors', 'wrong_blanks', 'probes')
    }
    text = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(text.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Execution and capture
# ---------------------------------------------------------------------------


def execute(nb_path, nb):
    """Run the notebook once, with the capture calls spliced in after their cell.

    Splicing rather than appending keeps each capture in the state its own cell
    left behind, which matters as soon as a later cell rebinds a name.
    """
    import nbformat
    from nbclient import NotebookClient

    # Through the reader, not from_dict: an .ipynb stores `source` as a list of
    # lines, and only the reader rejoins them into the string nbclient wants.
    work = nbformat.reads(json.dumps(nb), as_version=4)
    spliced = []
    for index, cell in enumerate(work.cells):
        cell.metadata['_origin'] = index
        spliced.append(cell)
        for k, shot in enumerate(cell.metadata.get('lab', {}).get('capture', []) or []):
            extra = nbformat.v4.new_code_cell(source=shot['code'])
            extra.metadata['_origin'] = index
            extra.metadata['_capture'] = k
            spliced.append(extra)
    work.cells = spliced

    client = NotebookClient(
        work,
        timeout=300,
        kernel_name='python3',
        resources={'metadata': {'path': str(nb_path.parent)}},
        allow_errors=True,
    )
    client.execute()

    failures = []
    for cell in work.cells:
        for out in cell.get('outputs', []) or []:
            if out.get('output_type') == 'error':
                failures.append(
                    f'  cell {cell.metadata["_origin"]}: '
                    f'{out["ename"]}: {out["evalue"]}'
                )
    if failures:
        raise BuildError('the notebook raised while executing:\n' + '\n'.join(failures))

    return work


def collect_outputs(work):
    """Group the executed cells' outputs by the original cell index."""
    grouped = {}
    for cell in work.cells:
        origin = cell.metadata['_origin']
        entry = grouped.setdefault(origin, {'stdout': [], 'images': [], 'captures': []})
        is_capture = '_capture' in cell.metadata
        for out in cell.get('outputs', []) or []:
            kind = out.get('output_type')
            if kind == 'stream' and out.get('name') == 'stdout':
                text = ''.join(out['text']) if isinstance(out['text'], list) else out['text']
                entry['stdout'].append(text)
            elif kind in ('display_data', 'execute_result'):
                data = out.get('data', {})
                if 'image/png' in data:
                    png = data['image/png']
                    png = ''.join(png) if isinstance(png, list) else png
                    target = entry['captures'] if is_capture else entry['images']
                    target.append({'png': png, 'capture': cell.metadata.get('_capture')})
                elif 'text/plain' in data and not is_capture:
                    # A bare expression at the end of a cell. Widgets land here
                    # too, as a repr; those are dropped by the widget check.
                    text = data['text/plain']
                    text = ''.join(text) if isinstance(text, list) else text
                    if 'Widget' not in text and 'interactive' not in text:
                        entry['stdout'].append(text + '\n')
    return grouped


def write_images(lab_id, cell_index, entries, out_dir, seen):
    """Write the figures, reusing a file when the bytes are identical.

    A capture frame often repeats a plot the cell above already produced, and
    shipping the same 37 KB twice is the kind of thing that turns into 566 files.
    """
    paths = []
    for k, entry in enumerate(entries):
        raw = base64.b64decode(entry['png'])
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen:
            paths.append(seen[digest])
            continue
        name = f'cell{cell_index:02d}-{k}.png'
        (out_dir / name).write_bytes(raw)
        rel = f'out/{lab_id}/{name}'
        seen[digest] = rel
        paths.append(rel)
    return paths


# ---------------------------------------------------------------------------
# Assembling the spec
# ---------------------------------------------------------------------------


def build_spec(nb_path, nb, outputs, lab_id, out_dir):
    lab = nb['metadata']['lab']
    cells = []
    seen_images = {}

    for index, cell in enumerate(nb['cells']):
        meta = cell.get('metadata', {}).get('lab', {'mode': 'shown'})
        mode = meta.get('mode', 'shown')
        source = cell_source(cell)
        captured = outputs.get(index, {'stdout': [], 'images': [], 'captures': []})

        if cell['cell_type'] == 'markdown':
            entry = {
                'kind': 'markdown',
                'mode': mode,
                'html': render_markdown(source),
            }
            if mode == 'defer':
                entry['until'] = meta['until']
                entry['heading'] = meta.get('heading') or first_heading(source) or 'More'
            if meta.get('finale'):
                entry['finale'] = True
            cells.append(entry)
            continue

        entry = {
            'kind': 'code',
            'mode': mode,
            'python': source,
            'stdout': ''.join(captured['stdout']).rstrip('\n'),
        }
        if meta.get('quiet'):
            entry['quiet'] = True
        if meta.get('demo_for'):
            entry['demo_for'] = meta['demo_for']

        shots = meta.get('capture') or []
        if shots:
            paths = write_images(lab_id, index, captured['captures'], out_dir, seen_images)
            entry['figures'] = [
                {'src': path, 'caption': shots[k]['caption'] if k < len(shots) else ''}
                for k, path in enumerate(paths)
            ]
            entry['static_frames'] = True
        else:
            paths = write_images(lab_id, index, captured['images'], out_dir, seen_images)
            if paths:
                entry['figures'] = [{'src': p, 'caption': ''} for p in paths]

        if mode == 'gated':
            gate = {k: v for k, v in meta.items() if k not in ('mode',)}
            check_py_refs(gate, source, index)
            gate['reveal'] = build_reveal(gate, source, index)
            gate['hash'] = gate_hash(gate)
            entry['gate'] = gate

        cells.append(entry)

    rel = nb_path.relative_to(NOTEBOOK_DIR).as_posix()
    return {
        'lab_id': lab_id,
        'module': lab.get('module'),
        'order': lab.get('order'),
        'title': lab['title'],
        'blurb': lab.get('blurb', ''),
        'series': lab.get('series', []),
        'source': f'notebooks/{rel}',
        'colab': COLAB_BASE + rel,
        'cells': cells,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def run_validator(spec_path):
    if not VALIDATOR.exists():
        raise BuildError(f'missing {VALIDATOR}')

    import shutil

    node = shutil.which('node')
    if node:
        cmd = [node, str(VALIDATOR), str(spec_path)]
    elif JSC.exists():
        cmd = [str(JSC), '-m', str(VALIDATOR), '--', str(spec_path)]
    else:
        raise BuildError('no node and no JavaScriptCore shell; cannot validate')

    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    output = (proc.stdout or '') + (proc.stderr or '')
    # jsc's quit() takes no exit code, so the marker is the reliable signal.
    if proc.returncode != 0 or 'VALIDATION FAILED' in output:
        raise BuildError('the validator rejected the spec:\n' + output.rstrip())
    return output.rstrip()


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def annotated_notebooks():
    found = []
    for path in sorted(NOTEBOOK_DIR.rglob('*.ipynb')):
        try:
            nb = json.loads(path.read_text())
        except json.JSONDecodeError as err:
            print(f'  skipping {path.name}: not readable as JSON ({err})')
            continue
        if 'lab' in nb.get('metadata', {}):
            found.append((path, nb))
    return found


def build_one(nb_path, nb, skip_execute):
    lab_id = nb['metadata']['lab']['lab_id']
    print(f'{lab_id}  ({nb_path.relative_to(ROOT)})')

    out_dir = OUT_DIR / lab_id
    out_dir.mkdir(parents=True, exist_ok=True)
    if not skip_execute:
        for stale in out_dir.glob('*.png'):
            stale.unlink()
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    spec_path = SPEC_DIR / f'{lab_id}.json'

    if skip_execute and spec_path.exists():
        print('  reusing the previous run\'s captured output')
        previous = json.loads(spec_path.read_text())
        outputs = {}
        for index, cell in enumerate(previous['cells']):
            outputs[index] = {
                'stdout': [cell.get('stdout', '')],
                'images': [],
                'captures': [],
            }
    else:
        print('  executing')
        work = execute(nb_path, nb)
        outputs = collect_outputs(work)

    spec = build_spec(nb_path, nb, outputs, lab_id, out_dir)

    gates = [c['gate'] for c in spec['cells'] if c.get('gate')]
    figures = sum(len(c.get('figures', [])) for c in spec['cells'])
    print(f'  {len(spec["cells"])} cells, {len(gates)} gates, {figures} figures')

    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + '\n')
    print(f'  wrote {spec_path.relative_to(ROOT)}')

    report = run_validator(spec_path)
    for line in report.split('\n'):
        if line.strip():
            print(f'  {line}')
    return spec


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('lab_id', nargs='?', help='build only this lab')
    parser.add_argument('--skip-execute', action='store_true',
                        help='reuse the previous captured output; figures are not rewritten')
    args = parser.parse_args()

    notebooks = annotated_notebooks()
    if args.lab_id:
        notebooks = [
            (p, nb) for p, nb in notebooks
            if nb['metadata']['lab']['lab_id'] == args.lab_id
        ]
        if not notebooks:
            sys.exit(f'no annotated notebook with lab_id {args.lab_id!r}')

    if not notebooks:
        sys.exit('no notebook carries a `lab` key in its metadata')

    failures = 0
    for nb_path, nb in notebooks:
        try:
            build_one(nb_path, nb, args.skip_execute)
        except BuildError as err:
            failures += 1
            print(f'  FAILED: {err}\n')
    if failures:
        sys.exit(f'{failures} lab(s) failed to build')
    print('\nall labs built')


if __name__ == '__main__':
    main()
