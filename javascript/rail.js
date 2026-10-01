/* Marks the rail entry for the section being read: the last section whose top
   has passed the side rail's own top edge. That edge sits a rem below where a
   jump to an anchor stops ($header-clearance in css/stylesheet.scss), so a
   section just jumped to is the one marked. */

document.addEventListener("DOMContentLoaded", function () {
  var rail = document.querySelector(".rail--side");

  if (!rail) {
    return;
  }

  // Every rail on a page links the same sections, so each id collects the
  // links to it from all of them.
  var linksById = {};

  document.querySelectorAll('.rail a[href^="#"]').forEach(function (link) {
    var id = link.getAttribute("href").slice(1);
    (linksById[id] = linksById[id] || []).push(link);
  });

  // Pointing at an entry, or tabbing to it, outlines the section it leads to:
  // an h2's whole section block where it has one, otherwise the target
  // itself. Only where there is a pointer to hover with, so a tap on a phone
  // does not leave an outline behind.
  if (window.matchMedia("(hover: hover)").matches) {
    Object.keys(linksById).forEach(function (id) {
      var target = document.getElementById(id);

      if (!target) {
        return;
      }

      var outlined = (target.matches("h2") && target.closest(".section-block")) || target;

      linksById[id].forEach(function (link) {
        function show() { outlined.classList.add("is-previewed"); }
        function hide() { outlined.classList.remove("is-previewed"); }

        link.addEventListener("mouseenter", show);
        link.addEventListener("mouseleave", hide);
        link.addEventListener("focus", show);
        link.addEventListener("blur", hide);
      });
    });
  }

  var sections = Object.keys(linksById)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean)
    .sort(function (a, b) {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

  if (!sections.length) {
    return;
  }

  var current = null;
  var queued = false;

  function paint() {
    queued = false;

    var trigger = parseFloat(getComputedStyle(rail).top);
    var id = sections[0].id;

    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top > trigger) {
        break;
      }
      id = sections[i].id;
    }

    // The final section can be too short to ever reach the trigger, so
    // hitting the bottom of the page always selects it. Measure against the
    // document's scroll height, not the body box, which excludes the
    // wrapper's bottom margin and would fire this early.
    var bottom = document.documentElement.scrollHeight - window.innerHeight;

    if (window.scrollY >= bottom - 2) {
      id = sections[sections.length - 1].id;
    }

    if (id !== current) {
      (linksById[current] || []).forEach(function (link) {
        link.classList.remove("is-current");
      });
      linksById[id].forEach(function (link) {
        link.classList.add("is-current");
      });
      current = id;
    }
  }

  function schedule() {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(paint);
    }
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  paint();
});
