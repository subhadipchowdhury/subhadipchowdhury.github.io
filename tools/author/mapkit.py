"""Shared machinery for authoring a concept map.

A map's source of truth is the tikz picture in the print worksheet, so the
coordinates here are given in tikz units and converted once. Nothing about the
geometry is computed at runtime: the engine measures node boxes and clips the
arrows to them, but where a box sits is the author's decision, as it is on paper.

The editorial rules are not restated here. They are read out of
``tools/validate.mjs``, which is the one place they live for the labs, so a
phrase added to the tic list starts failing map prose in the same commit.

Run a map's own script to write its JSON:

    ~/.venvs/labs/bin/python tools/author/series_map.py
"""

import json
import pathlib
import re
import sys

import maptex

ROOT = pathlib.Path(__file__).resolve().parents[2]
VALIDATOR = ROOT / "tools" / "validate.mjs"
OUT_DIR = ROOT / "teaching" / "labs" / "maps" / "data"

KINDS = ("implies", "fails", "equiv", "caution")

# tikz units are about 1cm; 58px reads at roughly the size the printed worksheet
# does on screen. The offsets put the leftmost and topmost node far enough inside
# the stage that a wide box cannot be clipped by it.
SCALE = 58
X_SHIFT = 9.4
Y_SHIFT = 1.6


def px(x, y):
    """A tikz coordinate as a pixel coordinate on the stage."""
    return round((x + X_SHIFT) * SCALE), round((-y + Y_SHIFT) * SCALE)


def stage_size(nodes, pad=110):
    """A stage big enough that the widest box at the edge still fits inside it."""
    width = max(n["x"] for n in nodes) + pad
    height = max(n["y"] for n in nodes) + 70
    return width, height


def node(letter, label, tikz, definition):
    x, y = px(*tikz)
    return {
        "id": letter,
        "letter": letter,
        "label": label,
        "x": x,
        "y": y,
        # The tikz coordinate is kept as well as the pixel one, because
        # tools/author/maptex.py draws the paper version from it. Converting back
        # from pixels would round.
        "tikz": list(tikz),
        "definition": definition,
    }


def edge(n, src, dst, kind, statement, why, hint=None, bend=0, at=0.5):
    out = {
        "n": n,
        "from": src,
        "to": dst,
        "kind": kind,
        "statement": statement,
        "why": why,
        "bend": bend,
        "at": at,
    }
    if hint:
        out["hint"] = hint
    return out


# --------------------------------------------------------------------------
# The editorial rules, read out of the lab validator
# --------------------------------------------------------------------------


def _js_array(name):
    """The string literals of a top-level ``const NAME = [...]`` in validate.mjs."""
    src = VALIDATOR.read_text()
    m = re.search(r"^const " + name + r" = \[(.*?)^\];", src, re.S | re.M)
    if not m:
        raise SystemExit(f"could not find {name} in {VALIDATOR}")
    # Each entry is either 'phrase' or ['phrase', 'reason']; the first literal on
    # a line is the phrase either way.
    out = []
    for line in m.group(1).splitlines():
        for lit in re.findall(r"'((?:[^'\\]|\\.)*)'", line):
            out.append(lit)
            break
    return out


TICS = _js_array("TICS")
PRESUMED = _js_array("PRESUMED")


def _text(value):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", str(value))).strip()


# --------------------------------------------------------------------------
# Geometry: does any arrow run through a box it has nothing to do with?
#
# The engine measures the real boxes at runtime, so this works on a nominal one.
# It is the check that cannot be done by reading the file, and there is no browser
# here to look in, so an approximate warning is worth more than nothing. NOMINAL
# is generous on purpose: a warning on an arrow that in fact clears the box costs
# a look, and a miss costs an arrow drawn through a word.
# --------------------------------------------------------------------------

def nominal_size(label):
    """A rough box for a node label, in the stage's pixels.

    One constant for every node was too generous: it flagged three arrows in the
    series map that in fact pass between two narrow boxes. Sizing off the label
    gets close enough, and the runtime measures the real thing anyway. The LaTeX
    is stripped down to what it renders as, since the source is much longer than
    the output.
    """
    lines = str(label).split("\n")
    widest = 0
    for line in lines:
        plain = re.sub(r"\\[a-zA-Z]+|[\\{}$]|\\\(|\\\)", "", line)
        widest = max(widest, len(plain))
    # 0.8rem text in the brand sans runs near 6.2px per character, plus the
    # 0.6rem of side padding on .cm-node. No cap: .cm-node is nowrap and carries
    # no max-width, so a box is as wide as its widest authored line and the label
    # breaks only where the author put a \n.
    return round(widest * 6.2) + 20, round(len(lines) * 17) + 14


def _bezier(t, p0, c, p1):
    u = 1 - t
    return (
        u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
        u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    )


def _control(p0, p1, bend):
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    if not bend:
        return mx, my
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = (dx * dx + dy * dy) ** 0.5 or 1
    return mx - dy / length * bend, my + dx / length * bend


def _to_tikz(point):
    """A stage pixel back to a tikz coordinate, which is what maptex draws in."""
    x, y = point
    return round(x / SCALE - X_SHIFT, 3), round(-(y / SCALE - Y_SHIFT), 3)


def _boxes(data):
    out = {}
    for n in data["nodes"]:
        w, h = nominal_size(n["label"])
        out[n["id"]] = (n["x"], n["y"], w, h)
    return out


def _hits_for(boxes, e, bend):
    """The ids of boxes this arrow passes through at the given bend."""
    p0 = boxes[e["from"]][:2]
    p1 = boxes[e["to"]][:2]
    c = _control(p0, p1, bend)
    out = []
    for other, (bx, by, bw, bh) in boxes.items():
        if other in (e["from"], e["to"]):
            continue
        for i in range(3, 58):
            x, y = _bezier(i / 60, p0, c, p1)
            if abs(x - bx) < bw / 2 + 4 and abs(y - by) < bh / 2 + 4:
                out.append(other)
                break
    return out


def crossings(data):
    """Arrows that pass through a box that is not one of their own endpoints."""
    boxes = _boxes(data)
    hits = []
    for e in data["edges"]:
        for other in _hits_for(boxes, e, e.get("bend", 0)):
            hits.append((e["n"], other))
    return hits


# --------------------------------------------------------------------------
# The rest of what a drawing can get wrong, which reading the file cannot catch.
#
# Added after the first look at a rendered map, which showed two faults the
# box-crossing check above is blind to: arrows 13 and 14 of the series map drawn on
# top of each other, and arrow 8's numbered badge sitting on the border of a box.
# --------------------------------------------------------------------------

BADGE_R = 12          # .cm-badge is 1.5rem across
ARROW_GAP = 22        # two arrows closer than this read as one


def _clip(cx, cy, tx, ty, hw, hh, gap):
    """clipToBox from maps/engine/map.js, so the two agree on where an arrow starts."""
    dx, dy = tx - cx, ty - cy
    length = (dx * dx + dy * dy) ** 0.5
    if length == 0:
        return cx, cy
    sx = float("inf") if dx == 0 else hw / abs(dx)
    sy = float("inf") if dy == 0 else hh / abs(dy)
    s = min(sx, sy) + gap / length
    return cx + dx * s, cy + dy * s


def _curve(boxes, e):
    """The drawn curve: both ends clipped to their measured boxes, as the page does."""
    ax, ay, aw, ah = boxes[e["from"]]
    bx, by, bw, bh = boxes[e["to"]]
    bend = e.get("bend", 0)
    ctrl = _control((ax, ay), (bx, by), bend)
    p0 = _clip(ax, ay, ctrl[0], ctrl[1], aw / 2, ah / 2, 3)
    p1 = _clip(bx, by, ctrl[0], ctrl[1], bw / 2, bh / 2, 5)
    return p0, _control(p0, p1, bend), p1


def _samples(boxes, e, n=48):
    p0, c, p1 = _curve(boxes, e)
    return [_bezier(i / n, p0, c, p1) for i in range(n + 1)]


def badge_at(boxes, e):
    p0, c, p1 = _curve(boxes, e)
    return _bezier(e.get("at", 0.5), p0, c, p1)


def overlaps(data):
    """Everything that will read as a mistake in the drawing.

    Three kinds, all of which happened on the first draft:
      - a numbered badge sitting on or inside a box
      - two badges on top of each other
      - two arrows running close enough together to look like one arrow
    """
    boxes = _boxes(data)
    out = []

    spots = {e["n"]: badge_at(boxes, e) for e in data["edges"]}

    for e in data["edges"]:
        bxp, byp = spots[e["n"]]
        for nid, (bx, by, bw, bh) in boxes.items():
            if abs(bxp - bx) < bw / 2 + BADGE_R and abs(byp - by) < bh / 2 + BADGE_R:
                out.append(f"badge {e['n']} sits on box {nid}")

    numbers = [e["n"] for e in data["edges"]]
    for i, a in enumerate(numbers):
        for b in numbers[i + 1:]:
            ax, ay = spots[a]
            bx, by = spots[b]
            if ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5 < 2 * BADGE_R + 3:
                out.append(f"badges {a} and {b} overlap")

    curves = {e["n"]: _samples(boxes, e) for e in data["edges"]}
    for i, e in enumerate(data["edges"]):
        for f in data["edges"][i + 1:]:
            # Two arrows that share an endpoint necessarily meet at it, so only the
            # middle of each is compared.
            close = 0
            for x1, y1 in curves[e["n"]][6:-6]:
                for x2, y2 in curves[f["n"]][6:-6]:
                    if ((x1 - x2) ** 2 + (y1 - y2) ** 2) ** 0.5 < ARROW_GAP:
                        close += 1
                        break
            # One near-crossing is a crossing and is fine. A long stretch of them is
            # two arrows drawn on top of each other.
            if close > 4:
                out.append(f"arrows {e['n']} and {f['n']} run together over {close} samples")
    return out


def suggest_bends(data):
    """For each crossing arrow, the smallest bend that clears every other box.

    Bending an arrow by hand and rebuilding is a slow loop with no browser to look
    in, so this does the search. `None` means no bend in the range clears it, and
    the map wants a box moved rather than an arrow bent.
    """
    boxes = _boxes(data)
    out = []
    for e in data["edges"]:
        if not _hits_for(boxes, e, e.get("bend", 0)):
            continue
        best = None
        for size in range(0, 281, 10):
            for bend in ((size, -size) if size else (0,)):
                if not _hits_for(boxes, e, bend):
                    best = bend
                    break
            if best is not None:
                break
        out.append((e["n"], e.get("bend", 0), best))
    return out


def _prose_of(data):
    """Every string a student reads, with a label for the error message."""
    yield "intro", data["intro"]
    yield "reflection", data["reflection"]
    for n in data["nodes"]:
        yield f"node {n['letter']} label", n["label"]
        yield f"node {n['letter']} definition", n["definition"]
    for e in data["edges"]:
        yield f"edge {e['n']} statement", e["statement"]
        yield f"edge {e['n']} why", e["why"]
        if e.get("hint"):
            yield f"edge {e['n']} hint", e["hint"]
    for i, d in enumerate(data.get("decoys", [])):
        yield f"decoy {i + 1}", d
    for i, b in enumerate(data.get("benchmarks", [])):
        yield f"benchmark {i + 1}", b


def validate(data):
    """Every check a map has to pass. Returns a list of complaints."""
    bad = []
    ids = [n["id"] for n in data["nodes"]]

    if len(set(ids)) != len(ids):
        bad.append("two nodes share an id")

    for n in data["nodes"]:
        for key in ("id", "letter", "label", "definition"):
            if not n.get(key):
                bad.append(f"node {n.get('id')} has no {key}")
        if not isinstance(n["x"], int) or not isinstance(n["y"], int):
            bad.append(f"node {n['id']} has a non-integer coordinate")

    numbers = [e["n"] for e in data["edges"]]
    if numbers != list(range(1, len(numbers) + 1)):
        bad.append("edge numbers are not 1..N in order")

    statements = set()
    for e in data["edges"]:
        if e["from"] not in ids:
            bad.append(f"edge {e['n']} starts at the unknown node {e['from']}")
        if e["to"] not in ids:
            bad.append(f"edge {e['n']} ends at the unknown node {e['to']}")
        if e["from"] == e["to"]:
            bad.append(f"edge {e['n']} starts and ends at the same node")
        if e["kind"] not in KINDS:
            bad.append(f"edge {e['n']} has the unknown kind {e['kind']}")
        # The bank is the answer key. Two arrows offering the same sentence would
        # make one of them unanswerable, since solving either removes both from
        # nothing and neither from the other.
        if e["statement"] in statements:
            bad.append(f"edge {e['n']} repeats another arrow's statement")
        statements.add(e["statement"])
        if not e["statement"].endswith((".", "?")):
            bad.append(f"edge {e['n']} statement does not end in a full stop")
        if len(_text(e["statement"])) < 40:
            bad.append(f"edge {e['n']} statement is too short to be a description")
        if len(_text(e["why"])) < 30:
            bad.append(f"edge {e['n']} why is too short to add anything")

    # An arrow whose kind fails wants a hint, because the two failing arrows in a
    # chapter are the pair a student is most likely to confuse with each other.
    for e in data["edges"]:
        if e["kind"] == "fails" and not e.get("hint"):
            bad.append(f"edge {e['n']} fails and has no hint")

    for d in data.get("decoys", []):
        if d in statements:
            bad.append("a decoy repeats a real statement")

    # Without decoys the last arrow is answered by elimination, since solving an
    # arrow takes its statement out of the bank.
    if len(data.get("decoys", [])) < 3:
        bad.append("a map wants at least three decoys in the bank")

    for label, value in _prose_of(data):
        text = _text(value)
        low = text.lower()
        if "—" in text:
            bad.append(f"{label} contains an em dash")
        for tic in TICS:
            if tic in low:
                bad.append(f"{label} contains the tic {tic!r}")
        for phrase in PRESUMED:
            if phrase in low:
                bad.append(f"{label} presumes the course with {phrase!r}")
        # The comma-fragment rule, matching checkFragments in validate.mjs: a whole
        # sentence built round a comma and four words or fewer, which is the
        # verbless aphorism VOICE.md bans. A trailing phrase inside a real
        # sentence is not that, and an earlier version of this check flagged
        # several of them.
        for sentence in re.split(r"(?<=[.?!])\s+", text):
            if "," not in sentence:
                continue
            words = re.findall(r"[A-Za-z0-9]+", sentence)
            if 0 < len(words) <= 4:
                bad.append(f"{label} has the comma fragment {sentence!r}")

    return bad


def write(data):
    """Validate, then write the map's JSON. Refuses to write a map that fails."""
    problems = validate(data)
    if problems:
        print(f"{data['id']}: {len(problems)} problem(s)", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        raise SystemExit(1)

    data["width"], data["height"] = stage_size(data["nodes"])

    # The paper version, from this same data, so the two cannot drift. Done before
    # the JSON is written so the served PDF's path can go into it.
    #
    # Each arrow's badge point is worked out here, in the stage's pixels, and handed
    # over converted to tikz units. Letting tikz place it with `pos=` put it
    # somewhere else on every bent arrow; see the note in maptex._diagram.
    # The tex is handed the whole drawn curve, converted to tikz units, rather than
    # its endpoints and a bend. Two reasons: the control point of the drawn curve is
    # recomputed from the *clipped* endpoints, not from the node centres, so
    # rebuilding it in the tex from a bend gave a different curve and left the
    # numbered badge floating beside the arrow instead of on it. And sharing the
    # geometry means overlaps() predicts the PDF as well as the page.
    boxes = _boxes(data)
    for e in data["edges"]:
        p0, c, p1 = _curve(boxes, e)
        e["draw"] = [_to_tikz(p0), _to_tikz(c), _to_tikz(p1)]
        e["badge_tikz"] = _to_tikz(badge_at(boxes, e))
    data["pdf"] = maptex.build(data)
    for e in data["edges"]:
        del e["badge_tikz"], e["draw"]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{data['id']}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(
        f"wrote {path.relative_to(ROOT)}  "
        f"{len(data['nodes'])} nodes, {len(data['edges'])} arrows, "
        f"{len(data.get('decoys', []))} decoys, stage {data['width']}x{data['height']}"
    )
    print(f"  and {data['pdf']} plus tools/author/tex/{data['id']}-solutions.pdf")

    hits = crossings(data)
    if hits:
        print(f"  {len(hits)} crossing(s) against the nominal box:")
        for n, other in hits:
            print(f"    arrow {n} crosses box {other}")
        print("  smallest bend that clears, per arrow:")
        for n, was, best in suggest_bends(data):
            note = "no bend clears it; move a box" if best is None else f"bend={best}"
            print(f"    arrow {n}: currently {was}, {note}")

    laps = overlaps(data)
    if laps:
        print(f"  {len(laps)} thing(s) drawn on top of something else:")
        for line in laps:
            print("    " + line)
