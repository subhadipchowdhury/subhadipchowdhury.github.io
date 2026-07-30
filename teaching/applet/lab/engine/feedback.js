// The failure card and the hint ladder.
//
// The ladder follows the intra-problem adaptation of adaptive Parsons problems
// (Ericson, Margulieux and Rick, ICER 2017; Parsons and Haden 2006 for the
// format; js-parsons, Karavirta, Helminen and Ihantola 2012 for the mechanics).
// Their adaptation moves are removing a distractor, combining blocks, and
// providing indentation. Diagnostic information comes first, structural help
// second, and no stage shows the answer.

import { renderTriangle } from './verify.js';
import { fmtNum, isArr2 } from './interp.js';

export const LADDER = {
  1: 'diagnose',   // the message alone
  2: 'highlight',  // outline the implicated region
  3: 'remove',     // take one unused decoy out of the tray
  4: 'assist',     // fix indents, or eject a placed decoy
  5: 'park',       // park it, or take it to office hours
};

export function ladderStage(attempts) {
  return Math.min(5, Math.max(1, attempts));
}

/**
 * Apply the structural half of the ladder to the view. The message half is
 * rendered by buildFeedbackCard.
 *
 * @returns {string|null} a sentence describing what was done, if anything
 */
export function applyLadder(view, verdict, attempts) {
  const stage = ladderStage(attempts);

  if (stage >= 2) {
    view.highlight(implicatedBlocks(view, verdict));
  }
  if (stage === 3) {
    const removed = view.removeDecoy();
    if (removed) return 'One block that was never part of the answer has been taken out of the tray.';
  }
  if (stage === 4) {
    const ejected = view.ejectDecoy();
    if (ejected) return 'A block that is not part of the answer has been sent back to the tray.';
    const fixed = view.fixIndents();
    if (fixed) return 'The indentation of the blocks you have placed has been set for you. The order is still up to you.';
  }
  return null;
}

function implicatedBlocks(view, verdict) {
  if (verdict.blockId) return [verdict.blockId];
  if (verdict.placedDecoys?.length) return verdict.placedDecoys;
  // Nothing specific: outline the loop nest, since that is where most of these
  // mistakes live, rather than a single line.
  const ids = view.placements.filter((p) => p.indent > 0).map((p) => p.id);
  return ids.length > 1 ? ids : [];
}

/**
 * @param {Object} verdict   from verify()
 * @param {Object} ctx
 *   gate, attempts, probeEnvName, onPark, onCopy
 * @returns {HTMLElement}
 */
export function buildFeedbackCard(verdict, ctx) {
  const { gate, attempts } = ctx;
  const card = document.createElement('div');
  card.setAttribute('role', 'status');

  const lead = document.createElement('p');
  lead.className = 'lp-feedback__lead';
  lead.textContent = verdict.message;
  card.appendChild(lead);

  if (verdict.detail) {
    const d = document.createElement('p');
    d.className = 'lp-feedback__detail';
    d.textContent = verdict.detail;
    card.appendChild(d);
  }

  if (ctx.ladderNote) {
    const n = document.createElement('p');
    n.className = 'lp-feedback__hint';
    n.textContent = ctx.ladderNote;
    card.appendChild(n);
  }

  // The student's own trace, never the reference: this is evidence they
  // generated and should be reading.
  const probe = gate.probes?.[verdict.probeIndex ?? 0];
  const traceNode = buildTrace(verdict, gate, probe);
  if (traceNode) {
    const label = document.createElement('p');
    label.className = 'lp-feedback__probe';
    label.textContent = `On ${describeProbe(probe)}, your algorithm produced:`;
    card.appendChild(label);
    card.appendChild(traceNode);
  }

  if (ladderStage(attempts) >= 5) {
    card.appendChild(buildStageFive(ctx));
  }

  return card;
}

function buildTrace(verdict, gate, probe) {
  const name = (gate.trace || [])[0];
  const table = verdict.trace?.[name];
  if (isArr2(table)) {
    const pre = document.createElement('pre');
    pre.className = 'lp-feedback__trace';
    const nodes = probe?.env?.x;
    pre.textContent = renderTriangle(table, Array.isArray(nodes) && !isArr2(nodes) ? nodes : null);
    return pre;
  }
  if (verdict.prints?.length) {
    const pre = document.createElement('pre');
    pre.className = 'lp-feedback__trace';
    pre.textContent = verdict.prints
      .map((p) => p.values.map((v) => (Array.isArray(v) ? `[${v.map(fmtNum).join(', ')}]` : fmtNum(v))).join('  '))
      .join('\n');
    return pre;
  }
  return null;
}

function describeProbe(probe) {
  if (!probe) return 'the test input';
  const parts = Object.entries(probe.env || {})
    .filter(([, v]) => Array.isArray(v) && !isArr2(v))
    .slice(0, 2)
    .map(([k, v]) => `${k} = [${v.map(fmtNum).join(', ')}]`);
  return parts.length ? parts.join(', ') : 'the test input';
}

// Stage 5 offers a way onward and a way to get help, and no answer.
function buildStageFive(ctx) {
  const wrap = document.createElement('div');
  wrap.className = 'lp-feedback__actions';

  const park = document.createElement('button');
  park.type = 'button';
  park.className = 'lp-action';
  park.textContent = 'Set this one aside and carry on';
  park.title = 'Opens the rest of the lab. This puzzle stays here to come back to.';
  park.addEventListener('click', () => ctx.onPark?.());
  wrap.appendChild(park);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'lp-action';
  copy.textContent = 'Copy my attempt';
  copy.title = 'Copies your arrangement as plain text, for an email or office hours.';
  copy.addEventListener('click', async () => {
    const text = ctx.onCopy?.();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      // Clipboard is blocked in some contexts; fall back to a selectable box.
      const ta = document.createElement('textarea');
      ta.className = 'lp-feedback__trace';
      ta.rows = 12;
      ta.value = text;
      ta.readOnly = true;
      wrap.parentElement.appendChild(ta);
      ta.select();
      copy.textContent = 'Select and copy the text below';
    }
    setTimeout(() => { copy.textContent = 'Copy my attempt'; }, 4000);
  });
  wrap.appendChild(copy);

  return wrap;
}

/**
 * Plain text to bring to office hours: the arrangement as placed, indentation
 * and all, plus the blanks and the last message.
 */
export function attemptSnapshot({ lab, gate, view, verdict, attempts }) {
  const byId = new Map();
  for (const b of gate.blocks) byId.set(b.id, b);
  for (const d of gate.distractors || []) byId.set(d.id, d);

  const lines = [];
  for (const p of view.placements) {
    const block = byId.get(p.id);
    if (!block) continue;
    for (const line of block.lines) {
      lines.push('    '.repeat(p.indent + (line.indent || 0)) + line.text);
    }
  }

  const blanks = Object.entries(view.blanks)
    .filter(([, v]) => String(v).trim() !== '')
    .map(([k, v]) => `  ⟨?${k}⟩ = ${v}`);

  return [
    `Lab: ${lab?.title ?? ''} (${lab?.lab_id ?? ''})`,
    `Puzzle: ${gate.title}`,
    `Attempts: ${attempts}`,
    '',
    'What I placed:',
    ...(lines.length ? lines : ['  (nothing placed)']),
    '',
    ...(blanks.length ? ['Blanks I filled in:', ...blanks, ''] : []),
    'Last feedback:',
    `  ${verdict?.message ?? '(none yet)'}`,
    ...(verdict?.detail ? [`  ${verdict.detail}`] : []),
  ].join('\n');
}
