/* Shared helpers for the applet pages.
 *
 * A canvas cannot inherit a CSS custom property, so every applet that draws has
 * to read the --ap-* plot colours out of the stylesheet and re-read them when
 * the site's theme toggle flips. That is the whole reason this file exists;
 * without it each page would hardcode a light palette and go unreadable in dark
 * mode, which is what all three DE pages did before 2026-08-13.
 *
 * Loaded as a module, so anything here is opt-in per page.
 */

const PLOT_TOKENS = {
  bg: '--ap-plot-bg',
  axis: '--ap-plot-axis',
  grid: '--ap-plot-grid',
  label: '--ap-plot-label',
  annot: '--ap-plot-annot',
  series1: '--ap-series-1',
  series1Fill: '--ap-series-1-fill',
  series2: '--ap-series-2',
  ink: '--color-text',
  muted: '--color-muted',
  surface: '--color-surface'
};

/**
 * The current plot palette, resolved to concrete colours.
 *
 * Read off :root rather than off the figure, because that is where applet.css
 * declares them and where the dark overrides land.
 */
export function plotColors() {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, prop] of Object.entries(PLOT_TOKENS)) {
    out[key] = cs.getPropertyValue(prop).trim();
  }
  return out;
}

/**
 * Call `fn` whenever the site theme changes, and once immediately.
 *
 * theme.js sets data-theme on <html>, so an attribute observer catches every
 * flip without the page having to know about the toggle button. Returns a
 * function that stops observing.
 */
export function onTheme(fn) {
  const root = document.documentElement;
  const run = () => fn(root.getAttribute('data-theme') === 'dark');
  const obs = new MutationObserver(run);
  obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  run();
  return () => obs.disconnect();
}

/**
 * Size a canvas to its CSS box at device resolution and return the 2D context
 * already scaled to CSS pixels, so drawing code can work in CSS units.
 *
 * Setting width or height resets the context, transform included, which is why
 * the scale is reapplied here on every call rather than once at startup.
 */
export function fitCanvas(canvas, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.clientWidth || 1;
  const h = cssHeight || rect.height || canvas.clientHeight || 1;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: w, height: h };
}

/**
 * Redraw on resize, coalesced to one call per frame.
 *
 * A resize event can fire many times per drag, and every applet's draw is a
 * full recompute of a few hundred points.
 */
export function onResize(fn) {
  let queued = false;
  const handler = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}

/**
 * Typeset LaTeX that was written into an element after page load.
 *
 * MathJax is loaded with `defer` from head.html, so an applet that renders a
 * formula during startup can run before MathJax exists. Nothing here waits for
 * it: the raw LaTeX stays visible until it arrives, and this is a no-op if it
 * never does.
 */
export function typeset(el) {
  const mj = window.MathJax;
  if (mj && mj.typesetPromise) {
    return mj.typesetPromise([el]).catch(() => {});
  }
  if (mj && mj.startup && mj.startup.promise) {
    return mj.startup.promise.then(() => mj.typesetPromise([el])).catch(() => {});
  }
  return Promise.resolve();
}
