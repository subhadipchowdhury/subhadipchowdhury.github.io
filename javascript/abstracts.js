/* Toggles inline abstract panels and preserves hash-based deep links. */

document.addEventListener("DOMContentLoaded", function () {
  var toggles = document.querySelectorAll(".abstract-toggle[data-target]");
  var panelToggles = {};

  function setExpandedState(panelId, isExpanded) {
    var relatedToggles = panelToggles[panelId] || [];

    relatedToggles.forEach(function (toggle) {
      toggle.setAttribute("aria-expanded", String(isExpanded));
    });
  }

  function openPanel(panelId) {
    var panel = document.getElementById(panelId);

    if (!panel || !panel.classList.contains("abstract-panel")) {
      return;
    }

    panel.hidden = false;
    setExpandedState(panelId, true);
  }

  function closePanel(panelId) {
    var panel = document.getElementById(panelId);

    if (!panel || !panel.classList.contains("abstract-panel")) {
      return;
    }

    panel.hidden = true;
    setExpandedState(panelId, false);
  }

  function syncPanelFromHash() {
    var panelId = window.location.hash.slice(1);

    if (!panelId) {
      return;
    }

    openPanel(panelId);
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
