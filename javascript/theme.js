/* Dark-mode toggle. The saved theme is applied pre-paint by an inline script
   in the head; this file wires up the header button and persists the choice. */

document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }

  var root = document.documentElement;

  function apply(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
      toggle.setAttribute("aria-label", "Switch to light mode");
    } else {
      root.removeAttribute("data-theme");
      toggle.setAttribute("aria-label", "Switch to dark mode");
    }
  }

  // Sync the button label with the theme the inline head script already set.
  apply(root.getAttribute("data-theme") === "dark" ? "dark" : "light");

  toggle.addEventListener("click", function () {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  });
});
