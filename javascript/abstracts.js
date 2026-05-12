/* Toggles inline abstract panels and preserves hash-based deep links. */

document.addEventListener("DOMContentLoaded", function () {
  var toggles = document.querySelectorAll(".abstract-toggle[data-target]");
  var panelToggles = {};
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clearPendingAnimation(panel) {
    if (panel._animationFrame) {
      window.cancelAnimationFrame(panel._animationFrame);
      panel._animationFrame = null;
    }

    if (panel._transitionCleanup) {
      panel.removeEventListener("transitionend", panel._transitionCleanup);
      panel._transitionCleanup = null;
    }
  }

  function setExpandedState(panelId, isExpanded) {
    var relatedToggles = panelToggles[panelId] || [];

    relatedToggles.forEach(function (toggle) {
      toggle.setAttribute("aria-expanded", String(isExpanded));
    });
  }

  function openPanel(panelId, skipAnimation) {
    var panel = document.getElementById(panelId);

    if (!panel || !panel.classList.contains("abstract-panel")) {
      return;
    }

    clearPendingAnimation(panel);
    panel.hidden = false;
    panel.classList.add("is-open");
    setExpandedState(panelId, true);

    if (skipAnimation || prefersReducedMotion) {
      panel.style.maxHeight = "none";
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0)";
      return;
    }

    panel.style.maxHeight = "0px";
    panel.style.opacity = "0";
    panel.style.transform = "translateY(-0.35rem)";

    panel._animationFrame = window.requestAnimationFrame(function () {
      panel.style.maxHeight = panel.scrollHeight + "px";
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0)";
      panel._animationFrame = null;
    });

    panel._transitionCleanup = function (event) {
      if (event.propertyName !== "max-height") {
        return;
      }

      panel.style.maxHeight = "none";
      panel.removeEventListener("transitionend", panel._transitionCleanup);
      panel._transitionCleanup = null;
    };

    panel.addEventListener("transitionend", panel._transitionCleanup);
  }

  function closePanel(panelId) {
    var panel = document.getElementById(panelId);

    if (!panel || !panel.classList.contains("abstract-panel")) {
      return;
    }

    clearPendingAnimation(panel);
    setExpandedState(panelId, false);

    if (prefersReducedMotion) {
      panel.classList.remove("is-open");
      panel.style.maxHeight = "0px";
      panel.style.opacity = "0";
      panel.style.transform = "translateY(-0.35rem)";
      panel.hidden = true;
      return;
    }

    panel.style.maxHeight = panel.scrollHeight + "px";
    panel.offsetHeight;
    panel.classList.remove("is-open");

    panel._animationFrame = window.requestAnimationFrame(function () {
      panel.style.maxHeight = "0px";
      panel.style.opacity = "0";
      panel.style.transform = "translateY(-0.35rem)";
      panel._animationFrame = null;
    });

    panel._transitionCleanup = function (event) {
      if (event.propertyName !== "max-height") {
        return;
      }

      panel.hidden = true;
      panel.removeEventListener("transitionend", panel._transitionCleanup);
      panel._transitionCleanup = null;
    };

    panel.addEventListener("transitionend", panel._transitionCleanup);
  }

  function syncPanelFromHash() {
    var panelId = window.location.hash.slice(1);

    if (!panelId) {
      return;
    }

    openPanel(panelId, true);
    
    // Scroll the panel into view for deep links
    var panel = document.getElementById(panelId);
    if (panel && panel.scrollIntoView) {
      var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  if (!toggles.length) {
    return;
  }

  toggles.forEach(function (toggle) {
    var panelId = toggle.getAttribute("data-target");
    var panel = document.getElementById(panelId);

    if (!panel) {
      return;
    }

    if (!panelToggles[panelId]) {
      panelToggles[panelId] = [];
    }

    panelToggles[panelId].push(toggle);
    toggle.setAttribute("aria-controls", panelId);
    toggle.setAttribute("aria-expanded", String(!panel.hidden));

    toggle.addEventListener("click", function () {
      var shouldOpen = panel.hidden;

      if (shouldOpen) {
        openPanel(panelId);
        if (window.location.hash !== "#" + panelId) {
          history.replaceState(null, "", "#" + panelId);
        }
      } else {
        closePanel(panelId);
        if (window.location.hash === "#" + panelId) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }
    });
  });

  syncPanelFromHash();
  window.addEventListener("hashchange", syncPanelFromHash);
});
