/* Enables live style mockup switching on selected section pages. */

document.addEventListener("DOMContentLoaded", function () {
  var switcher = document.querySelector(".style-preview-switcher");

  if (!switcher) {
    return;
  }

  var body = document.body;
  var options = switcher.querySelectorAll(".style-preview-option[data-style-variant]");
  var storageKey = "section-style-variant";
  var allowed = {
    base: true,
    a: true,
    b: true,
  };

  function applyVariant(variant) {
    body.classList.remove("style-variant-a", "style-variant-b");

    if (variant === "a") {
      body.classList.add("style-variant-a");
    }

    if (variant === "b") {
      body.classList.add("style-variant-b");
    }

    options.forEach(function (button) {
      var isActive = button.getAttribute("data-style-variant") === variant;
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function normalizeVariant(value) {
    if (value && allowed[value]) {
      return value;
    }

    return "base";
  }

  var initialVariant = normalizeVariant(window.localStorage.getItem(storageKey));
  applyVariant(initialVariant);

  options.forEach(function (button) {
    button.addEventListener("click", function () {
      var variant = normalizeVariant(button.getAttribute("data-style-variant"));
      applyVariant(variant);
      window.localStorage.setItem(storageKey, variant);
    });
  });
});
