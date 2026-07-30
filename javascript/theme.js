/* Dark-mode toggle. The saved theme is applied pre-paint by an inline script
   in the head, and each button's icon and label are swapped by CSS off the same
   html[data-theme] attribute, so this file only has to flip the attribute and
   remember the choice.

   The button is rendered twice (footer pill on desktop, last item of the mobile
   menu below 900px), hence the query for all of them rather than one id. */

document.addEventListener("DOMContentLoaded", function () {
  var toggles = document.querySelectorAll(".theme-toggle");
  var root = document.documentElement;

  function switchTheme() {
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";

    if (next === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }

    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  }

  Array.prototype.forEach.call(toggles, function (toggle) {
    toggle.addEventListener("click", switchTheme);
  });
});
