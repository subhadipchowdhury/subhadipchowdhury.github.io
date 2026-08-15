// The concept-check block: a few multiple-choice questions, graded as a unit.
//
// A puzzle asks whether a student can build the algorithm. This asks whether
// they can say what it means, so its questions are about the analysis and never
// about the code. They are graded together on purpose: one question with four
// options is three guesses from a pass, and a block of three is not.
//
// The view owns the picks and nothing else, which is the same split PuzzleView
// keeps. Grading is verifyQuiz in verify.js and the page controller decides what
// a verdict means.

import { stableOrder } from './puzzle.js';

const COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five'];

export class QuizView {
  /**
   * @param {HTMLElement} root
   * @param {Object} gate   the gate spec, with `questions`
   * @param {Object} opts
   *   onSubmit(submission)   the Check button
   *   onChange(state)        any pick, for persistence
   *   onReset()
   *   typeset(node)          hand a freshly built node to MathJax
   *   state                  restored { picks, attempts }
   */
  constructor(root, gate, opts = {}) {
    this.root = root;
    this.gate = gate;
    this.opts = opts;
    this.frozen = false;
    this.questions = gate.questions || [];

    this.picks = { ...(opts.state?.picks ?? {}) };
    this._attempts = opts.state?.attempts ?? 0;
    // question id -> 'right' | 'wrong', from the last check. Cleared by a change,
    // so a mark never describes a pick the student has since moved off.
    this.marks = new Map();

    this.build();
    this.render();
  }

  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  build() {
    this.root.innerHTML = '';
    this.root.className = 'lab-quiz';

    const head = el('header', 'lq-head');
    const title = el('h3', 'lq-title');
    title.textContent = this.gate.title;
    head.appendChild(title);
    const note = el('p', 'lq-note');
    const n = this.questions.length;
    note.textContent = `${cap(COUNT_WORD[n] || String(n))} questions, answered together.`;
    head.appendChild(note);
    this.root.appendChild(head);

    this.list = el('ol', 'lq-questions');
    this.rows = new Map();

    for (const question of this.questions) {
      const item = el('li', 'lq-question');
      item.dataset.q = question.id;

      const stem = el('div', 'lq-stem');
      const stemId = `${this.gate.cell_id}-${question.id}-stem`;
      stem.setAttribute('id', stemId);
      stem.innerHTML = question.stem_html || question.stem || '';
      item.appendChild(stem);

      const group = el('div', 'lq-options');
      group.setAttribute('role', 'radiogroup');
      group.setAttribute('aria-labelledby', stemId);

      const inputs = new Map();
      for (const optionId of optionOrder(this.gate, question)) {
        const option = question.options.find((o) => o.id === optionId);
        if (!option) continue;

        const label = el('label', 'lq-option');
        const input = el('input', 'lq-radio');
        input.type = 'radio';
        input.setAttribute('name', `${this.gate.cell_id}:${question.id}`);
        input.setAttribute('value', option.id);
        input.addEventListener('change', () => this.pick(question.id, option.id));
        label.appendChild(input);

        const text = el('span', 'lq-option__text');
        text.innerHTML = option.text_html || option.text || '';
        label.appendChild(text);

        group.appendChild(label);
        inputs.set(option.id, { input, label });
      }
      item.appendChild(group);

      const verdict = el('div', 'lq-verdict');
      verdict.setAttribute('role', 'status');
      item.appendChild(verdict);

      this.rows.set(question.id, { item, inputs, verdict });
      this.list.appendChild(item);
    }
    this.root.appendChild(this.list);

    const foot = el('footer', 'lq-foot');
    this.checkBtn = el('button', 'lq-check');
    this.checkBtn.type = 'button';
    this.checkBtn.textContent = 'Check my answers';
    this.checkBtn.addEventListener('click', () => this.submit());
    foot.appendChild(this.checkBtn);

    this.attemptLabel = el('span', 'lq-attempts');
    foot.appendChild(this.attemptLabel);

    this.resetBtn = el('button', 'lq-reset');
    this.resetBtn.type = 'button';
    this.resetBtn.textContent = 'Clear my answers';
    this.resetBtn.addEventListener('click', () => this.reset());
    foot.appendChild(this.resetBtn);
    this.root.appendChild(foot);
  }

  render() {
    for (const question of this.questions) {
      const row = this.rows.get(question.id);
      if (!row) continue;
      const picked = this.picks[question.id];

      for (const [optionId, { input, label }] of row.inputs) {
        input.checked = optionId === picked;
        if (optionId === picked) input.setAttribute('checked', 'checked');
        else input.removeAttribute('checked');
        input.disabled = this.frozen;
        label.classList.toggle('is-picked', optionId === picked);
      }

      const mark = this.marks.get(question.id);
      row.item.classList.toggle('is-right', mark === 'right');
      row.item.classList.toggle('is-wrong', mark === 'wrong');
    }

    this.attemptLabel.textContent = this.attempts
      ? `${this.attempts} check${this.attempts === 1 ? '' : 's'} so far`
      : '';
    this.checkBtn.disabled = this.frozen;
    this.resetBtn.disabled = this.frozen;
  }

  // -------------------------------------------------------------------------
  // Answering
  // -------------------------------------------------------------------------

  /** Record one answer. The DOM calls this, and so do the tests. */
  pick(questionId, optionId) {
    if (this.frozen) return;
    this.picks[questionId] = optionId;
    // A mark describes a pick. Moving off that pick retires the mark rather than
    // leaving a diagnosis sitting under an answer it is no longer about.
    if (this.marks.has(questionId)) {
      this.marks.delete(questionId);
      this.setVerdict(questionId, null);
    }
    this.changed();
    this.render();
  }

  answered() {
    return this.questions.every((q) => this.picks[q.id]);
  }

  get attempts() { return this._attempts ?? 0; }

  set attempts(v) { this._attempts = v; }

  getSubmission() {
    return { picks: { ...this.picks } };
  }

  getState() {
    return { picks: { ...this.picks }, attempts: this.attempts };
  }

  submit() {
    if (this.frozen) return;
    if (!this.answered()) {
      const missing = this.questions.filter((q) => !this.picks[q.id]).length;
      this.setFeedback(message(missing === 1
        ? 'One question is still unanswered. All of them are checked together.'
        : `${cap(COUNT_WORD[missing] || String(missing))} questions are still unanswered. `
          + 'They are checked together.'));
      return;
    }
    this.setFeedback(null);
    this.opts.onSubmit?.(this.getSubmission());
  }

  reset() {
    this.picks = {};
    this.marks.clear();
    for (const question of this.questions) this.setVerdict(question.id, null);
    this.setFeedback(null);
    this.opts.onReset?.();
    this.render();
  }

  changed() {
    this.opts.onChange?.(this.getState());
  }

  /**
   * Show the result of one check. `results` is question id -> { ok, why_html },
   * where `why` on a wrong answer is the diagnosis written for the option the
   * student picked, and not the answer.
   */
  mark(results) {
    for (const question of this.questions) {
      const result = results?.[question.id];
      if (!result) continue;
      this.marks.set(question.id, result.ok ? 'right' : 'wrong');
      this.setVerdict(question.id, result);
    }
    this.render();
  }

  setVerdict(questionId, result) {
    const row = this.rows.get(questionId);
    if (!row) return;
    const box = row.verdict;
    box.innerHTML = '';
    if (!result) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const lead = el('p', 'lq-verdict__lead');
    lead.textContent = result.ok ? 'Right.' : 'Not this one.';
    box.appendChild(lead);
    if (!result.ok && (result.why_html || result.why)) {
      const why = el('div', 'lq-verdict__why');
      why.innerHTML = result.why_html || result.why;
      box.appendChild(why);
    }
    this.opts.typeset?.(box);
  }

  setFeedback(node) {
    this.root.querySelector('.lq-feedback')?.remove();
    if (!node) return;
    node.classList.add('lq-feedback');
    this.root.insertBefore(node, this.root.querySelector('.lq-foot'));
    this.opts.typeset?.(node);
  }

  /** A block the student has set aside keeps its picks and stops accepting new ones. */
  freeze() {
    this.frozen = true;
    this.root.dataset.frozen = 'true';
    this.render();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The order the options are shown in, shuffled stably from the ids so that the
 * answer does not sit in the position it was authored in, and does not move
 * between visits. A question that has a natural order (a list of numbers, a
 * sequence of steps) sets `shuffle: false` and keeps the order it was written in.
 */
export function optionOrder(gate, question) {
  const ids = (question.options || []).map((o) => o.id);
  if (question.shuffle === false) return ids;
  return stableOrder(`${gate.cell_id}:${question.id}`, ids);
}

function message(text) {
  const box = document.createElement('div');
  const p = document.createElement('p');
  p.className = 'lq-feedback__lead';
  p.textContent = text;
  box.appendChild(p);
  return box;
}

function cap(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function el(tag, className) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}
