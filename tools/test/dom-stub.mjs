// A DOM small enough to smoke-test the lab page under a JS shell.
//
// This is not a browser and does not pretend to be one: no layout, no cascade,
// no real events. What it does give is enough of the element API for lab.js and
// puzzle.js to build their whole tree, so a typo or a missing method surfaces
// here instead of as a blank page. Anything that depends on measurement or on
// the cascade has to be checked in a browser; that is the honest boundary.

class ClassList {
  constructor(el) { this.el = el; }
  get set() {
    return new Set((this.el.className || '').split(/\s+/).filter(Boolean));
  }
  write(set) { this.el.className = Array.from(set).join(' '); }
  add(...names) { const s = this.set; names.forEach((n) => s.add(n)); this.write(s); }
  remove(...names) { const s = this.set; names.forEach((n) => s.delete(n)); this.write(s); }
  contains(name) { return this.set.has(name); }
  toggle(name, force) {
    const has = this.contains(name);
    const want = force === undefined ? !has : !!force;
    if (want) this.add(name); else this.remove(name);
    return want;
  }
}

class Style {
  constructor() { this.props = new Map(); }
  setProperty(name, value) { this.props.set(name, String(value)); }
  getPropertyValue(name) { return this.props.get(name) ?? ''; }
  removeProperty(name) { this.props.delete(name); }
}

class TextNode {
  constructor(text) { this.nodeType = 3; this.textContent = String(text); this.parentElement = null; }
  get children() { return []; }
  get outerText() { return this.textContent; }
}

let nextId = 1;

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.classList = new ClassList(this);
    this.style = new Style();
    this.dataset = {};
    this.attributes = new Map();
    this.childNodes = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.tabIndex = -1;
    this._id = nextId++;
  }

  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }

  get firstElementChild() { return this.children[0] ?? null; }

  get nextElementSibling() {
    const kids = this.parentElement?.children ?? [];
    return kids[kids.indexOf(this) + 1] ?? null;
  }

  get textContent() {
    return this.childNodes.map((n) => n.textContent ?? '').join('');
  }

  set textContent(value) {
    this.childNodes = [];
    if (value !== '' && value != null) this.appendChild(new TextNode(value));
  }

  // Good enough for the two things the page does with it: clearing a node, and
  // dropping in a block of pre-rendered prose whose internals are never queried.
  get innerHTML() { return this._html ?? this.textContent; }

  set innerHTML(value) {
    this.childNodes = [];
    this._html = value;
    if (value) this.appendChild(new TextNode(stripTags(value)));
  }

  appendChild(node) {
    if (node instanceof Fragment) {
      node.childNodes.slice().forEach((c) => this.appendChild(c));
      return node;
    }
    node.parentElement?.removeChild(node);
    node.parentElement = this;
    this.childNodes.push(node);
    return node;
  }

  prepend(node) { return this.insertBefore(node, this.childNodes[0] ?? null); }

  insertBefore(node, ref) {
    if (node instanceof Fragment) {
      node.childNodes.slice().forEach((c) => this.insertBefore(c, ref));
      return node;
    }
    node.parentElement?.removeChild(node);
    node.parentElement = this;
    const at = ref ? this.childNodes.indexOf(ref) : -1;
    if (at < 0) this.childNodes.push(node); else this.childNodes.splice(at, 0, node);
    return node;
  }

  removeChild(node) {
    const at = this.childNodes.indexOf(node);
    if (at >= 0) this.childNodes.splice(at, 1);
    node.parentElement = null;
    return node;
  }

  remove() { this.parentElement?.removeChild(this); }

  replaceWith(other) {
    const parent = this.parentElement;
    if (!parent) return;
    const at = parent.childNodes.indexOf(this);
    parent.childNodes.splice(at, 1, other);
    other.parentElement = parent;
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name === 'hidden') this.hidden = true;
  }

  getAttribute(name) {
    if (name === 'class') return this.className;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) { return name === 'class' ? !!this.className : this.attributes.has(name); }

  removeAttribute(name) { this.attributes.delete(name); if (name === 'hidden') this.hidden = false; }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    const at = list.indexOf(fn);
    if (at >= 0) list.splice(at, 1);
  }

  // Synchronous and local: enough to drive a button in a test.
  dispatch(type, event = {}) {
    for (const fn of this.listeners.get(type) || []) {
      fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event });
    }
  }

  focus() { doc.activeElement = this; }

  blur() { if (doc.activeElement === this) doc.activeElement = null; }

  scrollIntoView() { /* no layout, nothing to scroll */ }

  matches(selector) { return matches(this, selector); }

  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  querySelectorAll(selector) {
    const out = [];
    const groups = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const walk = (node) => {
      for (const child of node.children) {
        if (groups.some((g) => matchesDescendant(child, g))) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  getBoundingClientRect() {
    // No layout. Anything that steers by measurement must be tested in a browser.
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  get offsetLeft() { return 0; }
}

class Fragment {
  constructor() { this.childNodes = []; this.nodeType = 11; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  appendChild(node) {
    node.parentElement?.removeChild?.(node);
    this.childNodes.push(node);
    return node;
  }
  removeChild(node) {
    const at = this.childNodes.indexOf(node);
    if (at >= 0) this.childNodes.splice(at, 1);
    return node;
  }
}

function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '');
}

// A small selector subset: tag, .class, #id, [attr], [attr="value"],
// :not(.class), and the descendant combinator. That is everything the page uses.
function matchesSimple(node, part) {
  if (node.nodeType !== 1) return false;
  const tokens = part.match(/(\:not\([^)]*\)|\[[^\]]*\]|[.#]?[\w-]+)/g) || [];
  for (const token of tokens) {
    if (token.startsWith(':not(')) {
      const inner = token.slice(5, -1);
      if (matchesSimple(node, inner)) return false;
    } else if (token.startsWith('.')) {
      if (!node.classList.contains(token.slice(1))) return false;
    } else if (token.startsWith('#')) {
      if (node.getAttribute('id') !== token.slice(1)) return false;
    } else if (token.startsWith('[')) {
      const body = token.slice(1, -1);
      const eq = body.indexOf('=');
      if (eq < 0) {
        if (!hasAttrLike(node, body)) return false;
      } else {
        const name = body.slice(0, eq);
        const want = body.slice(eq + 1).replace(/^["']|["']$/g, '');
        if (attrLike(node, name) !== want) return false;
      }
    } else if (node.tagName !== token.toUpperCase()) {
      return false;
    }
  }
  return tokens.length > 0;
}

function attrLike(node, name) {
  if (name.startsWith('data-')) {
    const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return node.dataset[key];
  }
  return node.getAttribute(name);
}

function hasAttrLike(node, name) {
  const v = attrLike(node, name);
  return v !== undefined && v !== null;
}

function matches(node, selector) {
  return selector.split(',').some((g) => matchesSimple(node, g.trim().split(/\s+/).pop()));
}

function matchesDescendant(node, selector) {
  const parts = selector.trim().split(/\s+/);
  if (!matchesSimple(node, parts[parts.length - 1])) return false;
  let ancestor = node.parentElement;
  for (let i = parts.length - 2; i >= 0; i--) {
    let found = false;
    while (ancestor) {
      if (matchesSimple(ancestor, parts[i])) { found = true; ancestor = ancestor.parentElement; break; }
      ancestor = ancestor.parentElement;
    }
    if (!found) return false;
  }
  return true;
}

const doc = {
  activeElement: null,
  createElement: (tag) => new Element(tag),
  createTextNode: (text) => new TextNode(text),
  createDocumentFragment: () => new Fragment(),
  documentElement: new Element('html'),
  body: new Element('body'),
};

/** Install the stub as the ambient DOM. Returns a teardown function. */
export function installDom({ store = new Map() } = {}) {
  const g = globalThis;
  const previous = {
    document: g.document, window: g.window, localStorage: g.localStorage,
    fetch: g.fetch, navigator: g.navigator, setTimeout: g.setTimeout,
  };

  g.document = doc;
  g.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  g.window = {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    MathJax: null,
    getComputedStyle: () => ({ getPropertyValue: () => '', fontSize: '16px' }),
  };
  g.getComputedStyle = g.window.getComputedStyle;
  g.navigator = { clipboard: { writeText: async () => {} } };
  if (typeof g.setTimeout !== 'function') g.setTimeout = (fn) => { fn(); return 0; };

  return () => Object.assign(g, previous);
}

export { Element, TextNode, doc };

/** Every element in the tree, for assertions. */
export function walk(node, out = []) {
  for (const child of node.children) {
    out.push(child);
    walk(child, out);
  }
  return out;
}

/** Flatten to text, one line per element that holds text directly. */
export function textOf(node) {
  return node.textContent.replace(/\s+/g, ' ').trim();
}
