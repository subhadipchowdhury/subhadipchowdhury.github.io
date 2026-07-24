/*
 * Public hosted entry point.
 *
 *   <script type="module" src="https://jelly-ui.com/package.js"></script>
 *
 * Re-exporting the barrel evaluates it once, registers every component and
 * keeps the same named exports available to JavaScript consumers.
 */

export * from './dist/jelly.js';
