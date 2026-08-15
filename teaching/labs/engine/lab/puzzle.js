// The drag-and-drop puzzle: one workspace, one tray, indentation by position.
//
// Pointer, tap and keyboard all end up calling the same "move this block to
// (list, index, indent)" operation, which is why the internals are written
// against that rather than against drag events.
//
// The view owns the arrangement and nothing else. Grading is in verify.js and
// the page controller decides what a verdict means.

const MOVE_THRESHOLD = 4; // px before a press becomes a drag

export class PuzzleView {
  /**
   * @param {HTMLElement} root
   * @param {Object} gate   the gate spec
   * @param {Object} opts
   *   onSubmit(submission)     the Check button, or Ctrl/Cmd+Enter
   *   onChange(state)          any arrangement change, for persistence
   *   onReset()
   *   state                    restored { placements, blanks }
   *   shuffle                  deterministic tray order (array of ids)
   */
  constructor(root, gate, opts = {}) {
    this.root = root;
    this.gate = gate;
    this.opts = opts;
    this.frozen = false;

    this.blocks = new Map();
    for (const b of gate.blocks) this.blocks.set(b.id, { ...b, decoy: false });
    for (const d of gate.distractors || []) this.blocks.set(d.id, { ...d, decoy: true });

    this.maxIndent = Math.max(...gate.solution.map((s) => s.indent));

    this.seed(opts.state ?? initialState(gate));

    this.selected = null; // { list, id } for tap-to-place
    this.flying = null;   // { id, index, indent, origin } while grabbed
    this.drag = null;
    this.focus = { list: 'tray', index: 0 };

    this.build();
    this.render();
  }

  // Load an arrangement, whether restored from storage or freshly seeded, and
  // put whatever it does not place into the tray.
  seed(state) {
    this.placements = state?.placements?.map((p) => ({ ...p })) ?? [];
    this.blanks = { ...(state?.blanks ?? {}) };
    this.removed = new Set(state?.removed ?? []); // decoys taken away by a hint
    const placed = new Set(this.placements.map((p) => p.id));
    this.tray = (this.opts.shuffle ?? defaultOrder(this.gate))
      .filter((id) => this.blocks.has(id) && !placed.has(id) && !this.removed.has(id));
  }

  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  build() {
    const g = this.gate;
    const decoyCount = (g.distractors || []).length;
    this.root.innerHTML = '';
    this.root.className = 'lab-puzzle';

    const head = el('header', 'lp-head');
    const title = el('h3', 'lp-title');
    title.textContent = g.title;
    head.appendChild(title);
    if (g.intro) {
      const intro = el('p', 'lp-intro');
      intro.textContent = g.intro;
      head.appendChild(intro);
    }
    if (decoyCount) {
      const note = el('p', 'lp-decoy-note');
      note.textContent = decoyCount === 1
        ? 'One block in the tray is not part of the answer.'
        : `${decoyCount} blocks in the tray are not part of the answer.`;
      head.appendChild(note);
    }
    if (g.prefill === 'all') {
      const note = el('p', 'lp-decoy-note');
      note.textContent = 'The lines are already in order. Fill in what is missing.';
      head.appendChild(note);
    }
    this.root.appendChild(head);

    const body = el('div', 'lp-body');

    const wsWrap = el('div', 'lp-workspace-wrap');
    const guides = el('div', 'lp-guides');
    guides.setAttribute('aria-hidden', 'true');
    this.guideEls = [];
    for (let i = 0; i <= this.maxIndent; i++) {
      const guide = el('span', 'lp-guide');
      guide.style.left = `calc(var(--lp-indent) * ${i})`;
      guides.appendChild(guide);
      this.guideEls.push(guide);
    }
    wsWrap.appendChild(guides);

    this.workspace = el('ol', 'lp-workspace');
    this.workspace.setAttribute('aria-label', 'Workspace');
    wsWrap.appendChild(this.workspace);

    this.emptyHint = el('p', 'lp-empty');
    this.emptyHint.textContent = 'Drag blocks here, or tap one and then tap where it goes.';
    wsWrap.appendChild(this.emptyHint);
    body.appendChild(wsWrap);

    const trayWrap = el('div', 'lp-tray-wrap');
    const trayHead = el('p', 'lp-tray-head');
    trayHead.textContent = 'Tray';
    trayWrap.appendChild(trayHead);
    this.trayList = el('ol', 'lp-tray');
    this.trayList.setAttribute('aria-label', 'Tray');
    trayWrap.appendChild(this.trayList);
    body.appendChild(trayWrap);

    this.root.appendChild(body);

    const foot = el('footer', 'lp-foot');
    this.checkBtn = el('button', 'lp-check');
    this.checkBtn.type = 'button';
    this.checkBtn.textContent = 'Check my algorithm';
    this.checkBtn.addEventListener('click', () => this.submit());
    foot.appendChild(this.checkBtn);

    this.attemptLabel = el('span', 'lp-attempts');
    foot.appendChild(this.attemptLabel);

    this.resetBtn = el('button', 'lp-reset');
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'Reset this puzzle';
    this.resetBtn.addEventListener('click', () => this.reset());
    foot.appendChild(this.resetBtn);
    this.root.appendChild(foot);

    this.live = el('div', 'lp-live');
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('role', 'status');
    this.root.appendChild(this.live);

    this.root.addEventListener('keydown', (e) => this.onKeyDown(e));
    this.workspace.addEventListener('pointerdown', (e) => this.onPointerDown(e, 'workspace'));
    this.trayList.addEventListener('pointerdown', (e) => this.onPointerDown(e, 'tray'));
    // Clicking empty workspace space with a selection places the block at the end.
    wsWrap.addEventListener('click', (e) => {
      if (this.selected && !e.target.closest('.lp-block') && !e.target.closest('.lp-slot')) {
        this.placeSelected(this.placements.length, 0);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  render() {
    this.renderWorkspace();
    this.renderTray();
    this.emptyHint.hidden = this.placements.length > 0 || !!this.flying;
    this.attemptLabel.textContent = this.attempts
      ? `${this.attempts} attempt${this.attempts === 1 ? '' : 's'}`
      : '';
    this.syncTabStops();
  }

  renderWorkspace() {
    this.workspace.innerHTML = '';
    const rows = this.rowsWithFlying();
    rows.forEach((row, index) => {
      if (row.slot) {
        this.workspace.appendChild(this.buildFlyingRow(row));
        return;
      }
      this.workspace.appendChild(this.buildRow(row.placement, index, 'workspace'));
    });

    // Drop targets between rows appear only while a block is selected for
    // tap-to-place. A pointer drag shows its target with the placeholder row.
    if (this.selected && !this.flying) this.decorateSlots();
  }

  rowsWithFlying() {
    const rows = this.placements.map((p) => ({ placement: p }));
    if (this.flying) {
      rows.splice(this.flying.index, 0, { slot: true, ...this.flying });
    }
    return rows;
  }

  buildFlyingRow(row) {
    const li = el('li', 'lp-row lp-row--flying');
    li.style.setProperty('--indent', String(row.indent));
    const block = this.renderBlock(this.blocks.get(row.id), { interactive: false });
    block.classList.add('lp-block--grabbed');
    li.appendChild(block);
    return li;
  }

  decorateSlots() {
    const rows = Array.from(this.workspace.children);
    const insert = (index) => {
      const slot = el('li', 'lp-slot');
      slot.setAttribute('role', 'presentation');
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.placeSelected(index, this.suggestIndent(index));
      });
      return slot;
    };
    for (let i = rows.length; i >= 0; i--) {
      this.workspace.insertBefore(insert(i), rows[i] ?? null);
    }
  }

  renderTray() {
    this.trayList.innerHTML = '';
    this.tray.forEach((id, index) => {
      this.trayList.appendChild(this.buildRow({ id, indent: 0 }, index, 'tray'));
    });
    if (this.tray.length === 0) {
      const li = el('li', 'lp-tray-empty');
      li.textContent = 'The tray is empty.';
      this.trayList.appendChild(li);
    }
  }

  buildRow(placement, index, list) {
    const li = el('li', 'lp-row');
    if (list === 'workspace') li.style.setProperty('--indent', String(placement.indent));
    const block = this.renderBlock(this.blocks.get(placement.id), {
      interactive: true,
      placed: list === 'workspace',
    });
    block.dataset.id = placement.id;
    block.dataset.list = list;
    block.dataset.index = String(index);
    if (this.selected && this.selected.id === placement.id) block.classList.add('lp-block--selected');
    li.appendChild(block);

    if (list === 'workspace' && this.selected && this.selected.id === placement.id) {
      li.appendChild(this.buildIndentButtons(index));
    }
    return li;
  }

  buildIndentButtons(index) {
    const wrap = el('span', 'lp-indent-buttons');
    const mk = (label, delta, title) => {
      const b = el('button', 'lp-indent-btn');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeIndent(index, delta);
      });
      return b;
    };
    wrap.appendChild(mk('‹', -1, 'Move out one level'));
    wrap.appendChild(mk('›', +1, 'Move in one level'));
    return wrap;
  }

  renderBlock(block, { interactive, placed = false }) {
    const div = el('div', 'lp-block');
    // Decoy status is kept out of the DOM. It is in the spec JSON, but a data
    // attribute would put it one right-click away.
    if (interactive) {
      div.tabIndex = -1;
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', describeBlock(block, placed));
    }
    block.lines.forEach((line) => {
      const row = el('span', 'lp-line');
      if (line.indent) row.style.setProperty('--rel', String(line.indent));
      this.renderLineText(row, line.text, { placed, interactive });
      div.appendChild(row);
    });
    return div;
  }

  // Splits a line at its ⟨?name⟩ markers and drops an input in each gap.
  renderLineText(row, text, { placed, interactive }) {
    const parts = text.split(/(⟨\?[^⟩]+⟩)/g);
    for (const part of parts) {
      const m = part.match(/^⟨\?([^⟩]+)⟩$/);
      if (!m) {
        if (part) row.appendChild(document.createTextNode(part));
        continue;
      }
      const name = m[1].trim();
      const spec = (this.gate.blanks || {})[name] || {};
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'lp-blank';
      input.dataset.blank = name;
      input.value = this.blanks[name] ?? '';
      input.size = spec.width || 10;
      input.spellcheck = false;
      input.autocapitalize = 'off';
      input.autocomplete = 'off';
      input.setAttribute('aria-label', `blank ${name}`);
      // A blank is only editable once its block is in the workspace.
      input.disabled = !placed || !interactive || this.frozen;
      input.addEventListener('input', () => {
        this.blanks[name] = input.value;
        this.changed();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          input.closest('.lp-block')?.focus();
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) return; // let submit through
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
          e.stopPropagation(); // typing in a blank is not block navigation
        }
      });
      row.appendChild(input);
    }
  }

  syncTabStops() {
    // Roving tabindex: each list is a single tab stop.
    for (const [list, container] of [['workspace', this.workspace], ['tray', this.trayList]]) {
      const blocks = container.querySelectorAll('.lp-block[data-id]');
      blocks.forEach((b, i) => {
        const active = this.focus.list === list && this.focus.index === i;
        b.tabIndex = active ? 0 : -1;
      });
      if (blocks.length && !Array.from(blocks).some((b) => b.tabIndex === 0)) {
        blocks[0].tabIndex = 0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Arrangement operations
  // -------------------------------------------------------------------------

  suggestIndent(index) {
    // Default to the indent of the row above, one deeper if that row opens a
    // block.
    const above = this.placements[index - 1];
    if (!above) return 0;
    const block = this.blocks.get(above.id);
    const last = block.lines[block.lines.length - 1];
    const base = above.indent + (last.indent || 0);
    return Math.min(this.maxIndent, opensBlock(last.text) ? base + 1 : base);
  }

  place(id, index, indent) {
    if (this.frozen) return;
    const from = this.placements.findIndex((p) => p.id === id);
    if (from >= 0) {
      const [moved] = this.placements.splice(from, 1);
      const at = from < index ? index - 1 : index;
      moved.indent = clamp(indent, 0, this.maxIndent);
      this.placements.splice(at, 0, moved);
    } else {
      const t = this.tray.indexOf(id);
      if (t >= 0) this.tray.splice(t, 1);
      this.placements.splice(index, 0, { id, indent: clamp(indent, 0, this.maxIndent) });
    }
    this.selected = null;
    this.announce(`${blockLabel(this.blocks.get(id))} placed at row ${Math.min(index, this.placements.length - 1) + 1} of ${this.placements.length}, indent ${clamp(indent, 0, this.maxIndent)}.`);
    this.changed();
    this.render();
  }

  toTray(id) {
    if (this.frozen) return;
    const i = this.placements.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.placements.splice(i, 1);
    this.tray.push(id);
    this.selected = null;
    this.announce(`${blockLabel(this.blocks.get(id))} returned to the tray.`);
    this.changed();
    this.render();
  }

  changeIndent(index, delta) {
    const p = this.placements[index];
    if (!p || this.frozen) return;
    const next = clamp(p.indent + delta, 0, this.maxIndent);
    if (next === p.indent) return;
    p.indent = next;
    this.announce(`Indent level ${next}.`);
    this.changed();
    this.render();
    this.refocus();
  }

  placeSelected(index, indent) {
    if (!this.selected) return;
    this.place(this.selected.id, index, indent);
  }

  reset() {
    if (this.frozen) return;
    // Back to the seeded arrangement, which for a pre-placed puzzle is the
    // blocks in position with the blanks empty, not an empty workspace.
    this.seed(initialState(this.gate));
    this.selected = null;
    this.flying = null;
    this.attempts = 0;
    this.setFeedback(null);
    this.changed();
    this.render();
    this.opts.onReset?.();
    this.announce('Puzzle reset.');
  }

  // -------------------------------------------------------------------------
  // Pointer
  // -------------------------------------------------------------------------

  onPointerDown(e, list) {
    if (this.frozen) return;
    if (e.target.closest('.lp-blank') || e.target.closest('button')) return;
    const blockEl = e.target.closest('.lp-block[data-id]');
    if (!blockEl) return;
    if (e.button !== undefined && e.button !== 0) return;

    const id = blockEl.dataset.id;
    const start = { x: e.clientX, y: e.clientY };
    this.drag = { id, list, start, active: false, pointerId: e.pointerId };

    const move = (ev) => this.onPointerMove(ev);
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.onPointerUp(ev);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  onPointerMove(e) {
    const d = this.drag;
    if (!d) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) < MOVE_THRESHOLD) return;
      d.active = true;
      this.beginDrag(d.id, e);
    }
    e.preventDefault();

    // Indent follows the block's own left edge, not the pointer, so what the
    // ghost shows is where the block lands.
    const leadingX = e.clientX - d.grabDX;
    const target = this.hitTest(leadingX, e.clientY, this.flying.indent);

    if (target.list === 'tray') {
      this.flying.overTray = true;
      this.moveGhost(e.clientX - d.grabDX, e.clientY - d.grabDY);
    } else {
      this.flying.overTray = false;
      this.flying.index = target.index;
      this.flying.indent = target.indent;
      this.updateFlying();
      // Over the workspace the ghost snaps horizontally to the indent guide it
      // would drop into, so the snap is visible rather than inferred.
      const box = this.workspace.getBoundingClientRect();
      this.moveGhost(box.left + this.indentStep() * target.indent, e.clientY - d.grabDY);
    }
    this.root.classList.toggle('lp-over-tray', !!this.flying.overTray);
  }

  // Light path used during a drag: move the placeholder, do not rebuild.
  updateFlying() {
    if (!this.flyingEl) return;
    this.flyingEl.style.setProperty('--indent', String(this.flying.indent));
    const rows = Array.from(this.workspace.querySelectorAll('.lp-row:not(.lp-row--flying)'));
    const before = rows[this.flying.index] ?? null;
    if (this.flyingEl.nextElementSibling !== before || this.flyingEl.parentElement !== this.workspace) {
      this.workspace.insertBefore(this.flyingEl, before);
    }
  }

  onPointerUp(e) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (!d.active) {
      this.toggleSelect(d.id, d.list);
      return;
    }
    const flying = this.flying;
    this.endGhost();
    this.flying = null;
    this.flyingEl = null;
    this.root.classList.remove('lp-over-tray');
    if (flying.overTray) {
      if (flying.origin.list === 'workspace') {
        this.tray.push(flying.id);
        this.announce(`${blockLabel(this.blocks.get(flying.id))} returned to the tray.`);
      } else {
        this.tray.splice(Math.min(flying.origin.index, this.tray.length), 0, flying.id);
      }
      this.changed();
      this.render();
      return;
    }
    this.place(flying.id, flying.index, flying.indent);
  }

  beginDrag(id, event) {
    const source = this.root.querySelector(`.lp-block[data-id="${id}"]`);
    const box = source?.getBoundingClientRect();
    this.drag.grabDX = box ? event.clientX - box.left : 0;
    this.drag.grabDY = box ? event.clientY - box.top : 0;
    this.drag.step = this.measureIndentStep();

    const origin = this.detach(id);
    this.flying = {
      id,
      index: origin.list === 'workspace' ? Math.min(origin.index, this.placements.length) : this.placements.length,
      indent: origin.indent ?? 0,
      origin,
    };
    this.startGhost(id, box);
    this.render();
    this.flyingEl = this.workspace.querySelector('.lp-row--flying');
  }

  detach(id) {
    const w = this.placements.findIndex((p) => p.id === id);
    if (w >= 0) {
      const [p] = this.placements.splice(w, 1);
      return { list: 'workspace', index: w, indent: p.indent };
    }
    const t = this.tray.indexOf(id);
    if (t >= 0) {
      this.tray.splice(t, 1);
      return { list: 'tray', index: t, indent: 0 };
    }
    return { list: 'tray', index: this.tray.length, indent: 0 };
  }

  restore(origin, id) {
    if (origin.list === 'workspace') {
      this.placements.splice(origin.index, 0, { id, indent: origin.indent });
    } else {
      this.tray.splice(Math.min(origin.index, this.tray.length), 0, id);
    }
  }

  hitTest(x, y, currentIndent) {
    const trayBox = this.trayList.getBoundingClientRect();
    if (x >= trayBox.left && x <= trayBox.right && y >= trayBox.top - 8 && y <= trayBox.bottom + 8) {
      return { list: 'tray' };
    }
    const rows = Array.from(this.workspace.querySelectorAll('.lp-row:not(.lp-row--flying)'));
    let index = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const box = rows[i].getBoundingClientRect();
      if (y < box.top + box.height / 2) { index = i; break; }
    }
    const wsBox = this.workspace.getBoundingClientRect();
    const step = this.indentStep();
    const raw = (x - wsBox.left) / step;
    return {
      list: 'workspace',
      index,
      indent: snapIndent(raw, currentIndent, this.maxIndent),
    };
  }

  indentStep() {
    if (this.drag?.step) return this.drag.step;
    return this.measureIndentStep();
  }

  measureIndentStep() {
    const guides = this.guideEls;
    if (guides && guides.length > 1) {
      const step = guides[1].getBoundingClientRect().left - guides[0].getBoundingClientRect().left;
      if (step > 1) return step;
    }
    // Fallback for a single-level puzzle, where there is no pair to measure.
    const raw = getComputedStyle(this.root).getPropertyValue('--lp-indent').trim();
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return 30;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return /rem|em/.test(raw) ? n * rootPx : n;
  }

  startGhost(id, box) {
    this.ghost = this.renderBlock(this.blocks.get(id), { interactive: false });
    this.ghost.classList.add('lp-ghost');
    if (box) {
      this.ghost.style.width = `${box.width}px`;
      this.ghost.style.height = `${box.height}px`;
    }
    // Inside the puzzle, not on document.body: --lp-indent is scoped to .lab,
    // and without it a multi-line block loses its per-line indent.
    this.root.appendChild(this.ghost);
  }

  moveGhost(x, y) {
    if (!this.ghost) return;
    this.ghost.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  endGhost() {
    this.ghost?.remove();
    this.ghost = null;
  }

  toggleSelect(id, list) {
    if (this.selected && this.selected.id === id) {
      this.selected = null;
      this.announce('Selection cleared.');
    } else if (this.selected && list === 'workspace') {
      // Tapping a placed block while holding a selection drops the held block
      // just above the tapped one.
      const index = this.placements.findIndex((p) => p.id === id);
      this.place(this.selected.id, index, this.suggestIndent(index));
      return;
    } else {
      this.selected = { id, list };
      this.announce(`${blockLabel(this.blocks.get(id))} selected. Choose a place in the workspace.`);
    }
    this.render();
  }

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  onKeyDown(e) {
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      this.submit();
      return;
    }
    if (this.frozen) return;
    if (e.target.closest('.lp-blank')) return;

    if (this.flying) return this.onKeyDownFlying(e);

    const blockEl = e.target.closest('.lp-block[data-id]');
    if (!blockEl) return;
    const list = blockEl.dataset.list;
    const index = Number(blockEl.dataset.index);

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const count = list === 'workspace' ? this.placements.length : this.tray.length;
        const next = clamp(index + (e.key === 'ArrowDown' ? 1 : -1), 0, count - 1);
        this.focus = { list, index: next };
        this.syncTabStops();
        this.refocus();
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        this.grab(blockEl.dataset.id, list, index);
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (list !== 'workspace') return;
        e.preventDefault();
        this.focus = { list: 'workspace', index: Math.max(0, index - 1) };
        this.toTray(blockEl.dataset.id);
        this.refocus();
        break;
      }
      default:
        break;
    }
  }

  onKeyDownFlying(e) {
    const f = this.flying;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        f.index = clamp(f.index + (e.key === 'ArrowDown' ? 1 : -1), 0, this.placements.length);
        f.indent = Math.min(f.indent, this.maxIndent);
        this.render();
        this.announce(`Row ${f.index + 1} of ${this.placements.length + 1}, indent ${f.indent}.`);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        e.preventDefault();
        f.indent = clamp(f.indent + (e.key === 'ArrowRight' ? 1 : -1), 0, this.maxIndent);
        this.render();
        this.announce(`Indent level ${f.indent}.`);
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const { id, index, indent } = f;
        this.flying = null;
        this.place(id, index, indent);
        this.focus = { list: 'workspace', index: Math.min(index, this.placements.length - 1) };
        this.syncTabStops();
        this.refocus();
        break;
      }
      case 'Escape': {
        e.preventDefault();
        const { id, origin } = f;
        this.flying = null;
        this.restore(origin, id);
        this.announce('Cancelled.');
        this.render();
        this.focus = { list: origin.list, index: origin.index };
        this.syncTabStops();
        this.refocus();
        break;
      }
      default:
        break;
    }
  }

  grab(id, list, index) {
    const origin = this.detach(id);
    this.flying = {
      id,
      index: origin.list === 'workspace' ? origin.index : this.placements.length,
      indent: origin.list === 'workspace' ? origin.indent : this.suggestIndent(this.placements.length),
      origin,
    };
    this.selected = null;
    this.render();
    this.announce(
      `Grabbed ${blockLabel(this.blocks.get(id))}. Up and down move it, left and right change its indent, Enter drops it, Escape cancels.`,
    );
    // Focus must survive the re-render, and the grabbed row is not focusable,
    // so the list keeps the key handling via the container.
    this.root.querySelector('.lp-row--flying .lp-block')?.setAttribute('tabindex', '0');
    this.root.querySelector('.lp-row--flying .lp-block')?.focus();
  }

  refocus() {
    const container = this.focus.list === 'workspace' ? this.workspace : this.trayList;
    const blocks = container.querySelectorAll('.lp-block[data-id]');
    const target = blocks[Math.min(this.focus.index, blocks.length - 1)];
    target?.focus();
  }

  // -------------------------------------------------------------------------
  // Submission, hints, freezing
  // -------------------------------------------------------------------------

  get attempts() { return this._attempts ?? 0; }

  set attempts(v) { this._attempts = v; }

  getSubmission() {
    return {
      placements: this.placements.map((p) => ({ ...p })),
      blanks: { ...this.blanks },
    };
  }

  getState() {
    return {
      placements: this.placements.map((p) => ({ ...p })),
      blanks: { ...this.blanks },
      removed: Array.from(this.removed),
      attempts: this.attempts,
    };
  }

  submit() {
    if (this.frozen) return;
    this.opts.onSubmit?.(this.getSubmission());
  }

  changed() {
    this.opts.onChange?.(this.getState());
  }

  setFeedback(node) {
    this.root.querySelector('.lp-feedback')?.remove();
    if (!node) return;
    node.classList.add('lp-feedback');
    this.root.insertBefore(node, this.root.querySelector('.lp-foot'));
  }

  announce(text) {
    this.live.textContent = text;
  }

  /** Ladder stage 2: outline the region a message is about. */
  highlight(blockIds) {
    this.root.querySelectorAll('.lp-block--implicated')
      .forEach((n) => n.classList.remove('lp-block--implicated'));
    for (const id of blockIds || []) {
      this.root.querySelector(`.lp-block[data-id="${id}"]`)?.classList.add('lp-block--implicated');
    }
  }

  /** Ladder stage 3: take one unused decoy out of the tray. */
  removeDecoy() {
    const candidates = this.tray.filter((id) => this.blocks.get(id)?.decoy);
    if (!candidates.length) return null;
    const id = candidates[0];
    this.tray = this.tray.filter((x) => x !== id);
    this.removed.add(id);
    this.changed();
    this.render();
    return id;
  }

  /** Ladder stage 4a: set the indents of blocks that are in a correct relative order. */
  fixIndents() {
    const wanted = new Map(this.gate.solution.map((s) => [s.id, s.indent]));
    let changedAny = false;
    for (const p of this.placements) {
      if (wanted.has(p.id) && p.indent !== wanted.get(p.id)) {
        p.indent = wanted.get(p.id);
        changedAny = true;
      }
    }
    if (changedAny) { this.changed(); this.render(); }
    return changedAny;
  }

  /** Ladder stage 4b: eject a placed decoy back to the tray. */
  ejectDecoy() {
    const placed = this.placements.find((p) => this.blocks.get(p.id)?.decoy);
    if (!placed) return null;
    this.toTray(placed.id);
    return placed.id;
  }

  freeze() {
    this.frozen = true;
    this.root.dataset.frozen = 'true';
    this.root.querySelectorAll('.lp-blank').forEach((i) => { i.disabled = true; });
    this.checkBtn.disabled = true;
    this.resetBtn.disabled = true;
    this.selected = null;
    this.flying = null;
    this.render();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// How far past a level, as a fraction of one level's width, a block has to
// travel before the level changes. At 0.5 this is plain rounding, which leaves
// a knife edge at each midpoint; above it, every level keeps a band it holds.
export const INDENT_STICK = 0.72;

/**
 * Snap a fractional indent position to a level, holding the current level
 * until the block is clearly past it.
 *
 * @param {number} raw      position in levels, measured from the left guide
 * @param {number|null|undefined} current  the level the block is at now
 * @param {number} max
 */
export function snapIndent(raw, current, max) {
  const nearest = clamp(Math.round(raw), 0, max);
  if (current === null || current === undefined) return nearest;
  const held = clamp(current, 0, max);
  if (raw > held + INDENT_STICK || raw < held - INDENT_STICK) return nearest;
  return held;
}

function opensBlock(text) { return /:\s*$/.test(text.replace(/\s*#.*$/, '')); }

/**
 * The arrangement a puzzle starts from.
 *
 * `prefill` puts the first n solution blocks in place, or all of them with
 * "all". A fully pre-placed puzzle is one whose content is in its blanks. The
 * reduced rebuild of a concept met in an earlier lab uses the same mechanism
 * with a single anchor block.
 */
export function initialState(gate) {
  const prefill = gate.prefill;
  if (!prefill) return { placements: [], blanks: {} };
  const count = prefill === 'all' ? gate.solution.length : Number(prefill) || 0;
  return { placements: gate.solution.slice(0, count).map((s) => ({ ...s })), blanks: {} };
}

// A stable pseudo-shuffle: the tray order must not change between visits, and
// must not be the solution order. Derived from the ids so it needs no RNG.
export function defaultOrder(gate) {
  const ids = [...gate.solution.map((s) => s.id), ...(gate.distractors || []).map((d) => d.id)];
  return stableOrder(gate.cell_id, ids);
}

/**
 * The same shuffle, for anything else that has to scramble a short list of ids
 * once and then keep that order for good. quiz.js orders a question's options
 * with it.
 */
export function stableOrder(seed, ids) {
  return [...ids]
    .map((id) => ({ id, key: hash(`${seed}:${id}`) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.id);
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function blockLabel(block) {
  return block ? speak(block.lines[0].text) : 'block';
}

function describeBlock(block, placed) {
  const text = block.lines.map((l) => speak(l.text)).join(', then ');
  return placed ? text : `${text}. In the tray.`;
}

// A screen reader reads "!=" as punctuation or as nothing, so the label spells the
// operators out. Two-character operators go first, or "<=" is read as "less than"
// and then an orphaned "equals".
function speak(text) {
  return text
    .replace(/⟨\?[^⟩]+⟩/g, ' blank ')
    .replace(/←/g, ' gets ')
    .replace(/<=/g, ' at most ')
    .replace(/>=/g, ' at least ')
    .replace(/!=/g, ' is not ')
    .replace(/\*/g, ' times ')
    .replace(/-/g, ' minus ')
    .replace(/\.\./g, ' through ')
    .replace(/\[/g, ' sub ')
    .replace(/\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
