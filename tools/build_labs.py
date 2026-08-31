"""Turn an annotated notebook into a lab spec.

Run it with the labs venv active. This repo is edited from Windows and from more
than one Mac, so no interpreter path is written down here; the venv lives outside
the synced folder and its path and Python version differ per machine.

    python tools/build_labs.py              # every annotated notebook
    python tools/build_labs.py lab1-newton  # one lab
    python tools/build_labs.py --no-run     # skip the notebook run

The venv is deliberately outside this folder: an in-repo `.venv/` cannot survive
OneDrive, which dereferences the interpreter into a text stub.

A lab page carries the gates and nothing else. Everything else the notebook
holds stays in the notebook, which is what the student opens once the gates are
done. The one exception is a gate's `setup`: where it is the output that raises
the question, that output belongs beside the question. Those are run here and
shipped with the gate they motivate.

A gate is one of two kinds, and its cell metadata says which in `mode`:

- `gated`, a Parsons puzzle. Blocks pinned to Python lines, blanks, probes.
- `quiz`, a concept check. Multiple-choice questions about the mathematics, with
  no Python behind them, so none of the line-number machinery applies. The cell it
  hangs off decides where it sits on the page and nothing more.

So this script does four things:

1. Reads `metadata.lab` from the notebook and from each cell carrying a gate. For
   a puzzle it checks every block's line range against its py_match substring, so
   an edit that shifts line numbers fails here rather than mispointing the reveal.
2. Runs the notebook, then runs each gate's setup code in the same kernel and
   captures what it prints and draws. The run doubles as a check that the thing
   the gates unlock still works.
3. Hands the spec to tools/validate.mjs, which pushes every distractor and every
   wrong answer through the grader.
4. Writes the spec JSON and any setup figures.

The notebook is the source of truth throughout. Nothing here edits it.
"""

import argparse
import base64
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOTEBOOK_DIR = ROOT / 'teaching/labs/notebooks'
SPEC_DIR = ROOT / 'teaching/labs/data/specs'
FIGURE_DIR = ROOT / 'teaching/labs/data/figures'
VALIDATOR = ROOT / 'tools/validate.mjs'
JSC = pathlib.Path(
    '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
)

COLAB_BASE = (
    'https://colab.research.google.com/github/subhadipchowdhury/'
    'subhadipchowdhury.github.io/blob/master/teaching/labs/notebooks/'
)


class BuildError(Exception):
    pass


# A cell carries a gate when its `lab` metadata has one of these modes.
GATE_MODES = ('gated', 'quiz')


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

MATH_PATTERNS = [
    re.compile(r'\$\$.*?\$\$', re.S),
    re.compile(r'\\\[.*?\\\]', re.S),
    re.compile(r'(?<!\\)\$(?!\s).*?(?<!\s)(?<!\\)\$', re.S),
    re.compile(r'\\\(.*?\\\)', re.S),
]


def render_markdown(text):
    """Markdown to HTML with the maths left exactly as written.

    MathJax runs on the page, so the maths has to survive untouched. Left alone,
    a markdown renderer reads the underscores in f[x_i, ..., x_{i+j}] as
    emphasis, so every math span is lifted out first and put back after.
    """
    import markdown

    spans = []

    def stash(match):
        spans.append(match.group(0))
        return f'\x00MATH{len(spans) - 1}\x00'

    protected = text
    for pattern in MATH_PATTERNS:
        protected = pattern.sub(stash, protected)

    html = markdown.markdown(
        protected, extensions=['extra', 'sane_lists'], output_format='html5',
    )

    for i, span in enumerate(spans):
        html = html.replace(f'\x00MATH{i}\x00', span)
    return html


# ---------------------------------------------------------------------------
# Reading and checking
# ---------------------------------------------------------------------------


def cell_source(cell):
    src = cell['source']
    return ''.join(src) if isinstance(src, list) else src


def check_py_refs(gate, lines, cell_index):
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
                f'    {needle!r}\n  but it reads\n    {lines[lo - 1].strip()!r}\n'
                f'  The notebook was edited without updating the lab metadata.'
            )


def build_reveal(gate, lines, cell_index):
    """Pair every Python line with a pseudocode row, or a reason it has none.

    The mapping has to be total: a line with no role is one the reveal would put
    on screen unexplained.
    """
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

    if gate.get('py_head'):
        mark(*gate['py_head'], 'head')
    if gate.get('py_doc'):
        mark(*gate['py_doc'], 'doc')
    for n in gate.get('py_glue', []):
        mark(n, n, 'glue')

    order = {s['id']: i + 1 for i, s in enumerate(gate['solution'])}
    for block in gate['blocks']:
        lo, hi = block['py']
        mark(lo, hi, 'block', blockId=block['id'], num=order.get(block['id']))

    missing = [n for n, role in enumerate(roles, start=1) if role is None]
    if missing:
        raise BuildError(
            f'cell {cell_index}: the reveal mapping is not total. Lines {missing} '
            f'have no role. Put them in py_head, py_doc or py_glue, or give them '
            f'a block.'
        )

    return [
        {'n': n, 'text': lines[n - 1], **roles[n - 1]}
        for n in range(1, len(lines) + 1)
    ]


def build_questions(meta, cell_index):
    """Render a concept check's prose, and check its shape before the validator.

    The markdown goes to HTML here so the page can drop a stem or an option in
    with no renderer of its own, the same way a brief and a setup caption are
    handled. The raw markdown is dropped rather than shipped beside the HTML: two
    copies of one sentence is a drift waiting to happen.
    """
    questions = meta.get('questions') or []
    if not questions:
        raise BuildError(f'cell {cell_index}: a quiz with no questions')

    seen = set()
    out = []
    for question in questions:
        qid = question.get('id')
        where = f'cell {cell_index}, question "{qid}"'
        if not qid:
            raise BuildError(f'cell {cell_index}: a question with no id')
        if qid in seen:
            raise BuildError(f'cell {cell_index}: two questions share the id "{qid}"')
        seen.add(qid)
        if not question.get('stem'):
            raise BuildError(f'{where}: no stem')

        options = question.get('options') or []
        ids = [o.get('id') for o in options]
        if len(set(ids)) != len(ids):
            raise BuildError(f'{where}: two options share an id')
        if question.get('answer') not in ids:
            raise BuildError(
                f'{where}: answer {question.get("answer")!r} is not one of its options '
                f'({", ".join(str(i) for i in ids)})'
            )

        built = {
            'id': qid,
            'stem_html': render_markdown(question['stem'].strip()),
            'answer': question['answer'],
            'options': [],
        }
        if question.get('shuffle') is False:
            built['shuffle'] = False
        for option in options:
            if not option.get('id'):
                raise BuildError(f'{where}: an option with no id')
            if not option.get('text'):
                raise BuildError(f'{where}: option "{option["id"]}" has no text')
            if not option.get('why'):
                raise BuildError(
                    f'{where}: option "{option["id"]}" has no why. Every option needs '
                    'one: a wrong option to say what the pick got wrong, the answer to '
                    'say why it is the answer.'
                )
            built['options'].append({
                'id': option['id'],
                'text_html': render_markdown(option['text'].strip()),
                'why_html': render_markdown(option['why'].strip()),
            })
        out.append(built)
    return out


def gate_hash(gate):
    """Per gate, so revising one puzzle does not reset a student's progress on
    the others in the same lab."""
    payload = {
        key: gate.get(key)
        for key in ('blocks', 'solution', 'blanks', 'distractors', 'wrong_blanks',
                    'probes', 'questions')
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Notebook health check
# ---------------------------------------------------------------------------


def setups(nb):
    """(cell_id, setup) for every gate that ships a motivating output."""
    found = []
    for cell in nb['cells']:
        meta = cell.get('metadata', {}).get('lab') or {}
        if meta.get('mode') in GATE_MODES and meta.get('setup', {}).get('code'):
            found.append((meta['cell_id'], meta['setup']))
    return found


def run_notebook(nb_path, nb):
    """Execute the notebook, then each puzzle's setup code in the same kernel.

    The notebook is what the puzzles unlock, so a broken notebook is worth
    catching here. The setups run last, when everything the notebook defines is
    in scope.
    """
    import nbformat
    from nbclient import NotebookClient

    work = nbformat.reads(json.dumps(nb), as_version=4)
    original = len(work.cells)
    for cell_id, setup in setups(nb):
        extra = nbformat.v4.new_code_cell(source=setup['code'])
        extra.metadata['_setup_for'] = cell_id
        work.cells.append(extra)

    client = NotebookClient(
        work,
        timeout=300,
        kernel_name='python3',
        resources={'metadata': {'path': str(nb_path.parent)}},
        allow_errors=True,
    )
    client.execute()

    failures = []
    for index, cell in enumerate(work.cells):
        for out in cell.get('outputs', []) or []:
            if out.get('output_type') == 'error':
                where = (f'setup for {cell.metadata["_setup_for"]}'
                         if index >= original else f'cell {index}')
                failures.append(f'  {where}: {out["ename"]}: {out["evalue"]}')
    if failures:
        raise BuildError('the notebook raised while executing:\n' + '\n'.join(failures))

    captured = {}
    for cell in work.cells[original:]:
        captured[cell.metadata['_setup_for']] = collect(cell)
    return captured


def collect(cell):
    """Pull stdout and PNGs out of one executed cell."""
    text = []
    images = []
    for out in cell.get('outputs', []) or []:
        kind = out.get('output_type')
        if kind == 'stream' and out.get('name') == 'stdout':
            body = out['text']
            text.append(''.join(body) if isinstance(body, list) else body)
        elif kind in ('display_data', 'execute_result'):
            data = out.get('data', {})
            if 'image/png' in data:
                png = data['image/png']
                images.append(''.join(png) if isinstance(png, list) else png)
            elif 'text/plain' in data:
                body = data['text/plain']
                body = ''.join(body) if isinstance(body, list) else body
                if 'Widget' not in body and 'interactive' not in body:
                    text.append(body + '\n')
    return {'stdout': ''.join(text).rstrip('\n'), 'images': images}


def write_setup_images(lab_id, cell_id, images, fig_dir):
    if not images:
        return []
    fig_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    seen = {}
    for k, png in enumerate(images):
        raw = base64.b64decode(png)
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen:
            paths.append(seen[digest])
            continue
        name = f'{cell_id}-{k}.png'
        (fig_dir / name).write_bytes(raw)
        rel = f'figures/{lab_id}/{name}'
        seen[digest] = rel
        paths.append(rel)
    return paths


# ---------------------------------------------------------------------------
# Assembling the spec
# ---------------------------------------------------------------------------


def build_spec(nb_path, nb, captured, carried):
    lab = nb['metadata']['lab']
    lab_id = lab['lab_id']
    puzzles = []
    # A lab whose setups only print text gets no directory at all, rather than an
    # empty one. write_setup_images creates it when it has something to put in it.
    fig_dir = FIGURE_DIR / lab_id
    if captured:
        for stale in fig_dir.glob('*.png'):
            stale.unlink()

    for index, cell in enumerate(nb['cells']):
        meta = cell.get('metadata', {}).get('lab')
        if not meta or meta.get('mode') not in GATE_MODES:
            continue

        source = cell_source(cell)
        lines = source.split('\n')
        gate = {k: v for k, v in meta.items() if k not in ('mode', 'brief')}
        if meta['mode'] == 'quiz':
            gate['kind'] = 'quiz'
            gate['questions'] = build_questions(meta, index)
        else:
            gate['kind'] = 'puzzle'
            check_py_refs(gate, lines, index)
            gate['reveal'] = build_reveal(gate, lines, index)
            gate['python'] = source
        gate['hash'] = gate_hash(gate)
        if meta.get('brief'):
            gate['brief_html'] = render_markdown(meta['brief'].strip())

        # An output that raises the question belongs beside the question.
        setup = meta.get('setup')
        if setup:
            shot = captured.get(meta['cell_id'], {'stdout': '', 'images': []})
            kept = carried.get(meta['cell_id'], {})
            gate['setup'] = {
                'intro_html': render_markdown(setup['intro'].strip()) if setup.get('intro') else '',
                'caption_html': render_markdown(setup['caption'].strip()) if setup.get('caption') else '',
                'stdout': shot['stdout'] if captured else kept.get('stdout', ''),
                'figures': (write_setup_images(lab_id, meta['cell_id'], shot['images'], fig_dir)
                            if captured else kept.get('figures', [])),
            }
        puzzles.append(gate)

    if not puzzles:
        raise BuildError('no cell carries a `lab` key in a gate mode')

    rel = nb_path.relative_to(NOTEBOOK_DIR).as_posix()
    return {
        'lab_id': lab_id,
        'order': lab.get('order'),
        'title': lab['title'],
        'blurb': lab.get('blurb', ''),
        'intro_html': render_markdown(lab['intro'].strip()) if lab.get('intro') else '',
        'series': lab.get('series', []),
        'source': f'notebooks/{rel}',
        'colab': COLAB_BASE + rel,
        'puzzles': puzzles,
    }


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def run_validator(spec_path):
    if not VALIDATOR.exists():
        raise BuildError(f'missing {VALIDATOR}')

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


def build_one(nb_path, nb, run):
    lab_id = nb['metadata']['lab']['lab_id']
    print(f'{lab_id}  ({nb_path.relative_to(ROOT)})')
    previous = SPEC_DIR / f'{lab_id}.json'
    carried = {}
    if not run and previous.exists():
        for gate in json.loads(previous.read_text()).get('puzzles', []):
            if gate.get('setup'):
                carried[gate['cell_id']] = gate['setup']

    captured = {}
    if run:
        print('  running the notebook')
        captured = run_notebook(nb_path, nb)
    elif setups(nb):
        print('  --no-run: puzzle setups keep whatever was captured last time')

    spec = build_spec(nb_path, nb, captured, carried)
    SPEC_DIR.mkdir(parents=True, exist_ok=True)
    spec_path = SPEC_DIR / f'{lab_id}.json'
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + '\n')
    print(f'  {len(spec["puzzles"])} gates, wrote {spec_path.relative_to(ROOT)}')

    for line in run_validator(spec_path).split('\n'):
        if line.strip():
            print(f'  {line}')
    return spec


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('lab_id', nargs='?', help='build only this lab')
    parser.add_argument('--no-run', action='store_true',
                        help='skip executing the notebook')
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
            build_one(nb_path, nb, run=not args.no_run)
        except BuildError as err:
            failures += 1
            print(f'  FAILED: {err}\n')
    if failures:
        sys.exit(f'{failures} lab(s) failed to build')

    write_index()
    print('\nall labs built')


def write_index():
    """List the built specs, so the page tests can run over all of them.

    A JS shell cannot read a directory, so the list has to be a file.
    """
    entries = []
    for path in sorted(SPEC_DIR.glob('*.json')):
        if path.name == 'index.json':
            continue
        spec = json.loads(path.read_text())
        entries.append({
            'lab_id': spec['lab_id'],
            'title': spec['title'],
            'order': spec.get('order'),
            'puzzles': len(spec.get('puzzles', [])),
        })
    # By `order`, then by id. The labs are not assigned in a fixed sequence, so
    # `order` is only here to give this file a stable order to be read in.
    entries.sort(key=lambda e: (e.get('order') or 0, e['lab_id']))
    (SPEC_DIR / 'index.json').write_text(json.dumps(entries, indent=1) + '\n')
    print(f'  index lists {len(entries)} lab(s)')


if __name__ == '__main__':
    main()
