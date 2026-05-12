/* Toggles the navigation menu for small devices without jQuery. */

document.addEventListener("DOMContentLoaded", function () {
  var trigger = document.querySelector("#nav-trigger button");
  var menu = document.getElementById("nav-mobile-list");
  var menuIcon = document.querySelector(".wrapper-menu");

  if (!trigger || !menu || !menuIcon) {
    return;
  }

  function setExpanded(isExpanded) {
    trigger.setAttribute("aria-expanded", String(isExpanded));
    menu.hidden = !isExpanded;
    menu.classList.toggle("expanded", isExpanded);
    menuIcon.classList.toggle("open", isExpanded);
  }

  trigger.addEventListener("click", function () {
    var isExpanded = trigger.getAttribute("aria-expanded") === "true";
    setExpanded(!isExpanded);
  });

  menu.addEventListener("click", function (event) {
    var target = event.target;
    if (target && target.tagName === "A") {
      setExpanded(false);
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 900) {
      setExpanded(false);
    }
  });
});
