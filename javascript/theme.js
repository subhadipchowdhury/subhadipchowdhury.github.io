/* Dark-mode toggle. The theme is applied pre-paint by an inline script in the
   head (the saved choice, or else the operating system's), and each button's
   icon and label are swapped by CSS off the same html[data-theme] attribute,
   so this file only has to flip the attribute and remember the choice.

   Until the visitor uses the toggle, the page also follows the operating
   system if it switches while the page is open. A choice made with the
   toggle is saved and wins from then on.

   The button is rendered twice (footer pill on desktop, last item of the mobile
   menu below 900px), hence the query for all of them rather than one id. */

document.addEventListener("DOMContentLoaded", function () {
  var toggles = document.querySelectorAll(".theme-toggle");
  var root = document.documentElement;
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function apply(theme) {
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }

  function saved() {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  }

  function switchTheme() {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    apply(next);

    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  }

  systemDark.addEventListener("change", function (event) {
    if (saved() === null) {
      apply(event.matches ? "dark" : "light");
    }
  });

  Array.prototype.forEach.call(toggles, function (toggle) {
    toggle.addEventListener("click", switchTheme);
  });
});
