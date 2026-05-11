/* Toggles the mobile navigation menu without jQuery. */

document.addEventListener("DOMContentLoaded", function () {
  var triggerButton = document.querySelector("#nav-trigger button");
  var mobileNavList = document.querySelector("nav#nav-mobile ul");
  var menuIcon = document.querySelector(".wrapper-menu");
  var body = document.body;

  if (triggerButton && mobileNavList && menuIcon) {
    triggerButton.addEventListener("click", function () {
      var isExpanded = mobileNavList.classList.toggle("expanded");
      menuIcon.classList.toggle("open", isExpanded);
      triggerButton.setAttribute("aria-expanded", String(isExpanded));
    });
  }

  if (!body) {
    return;
  }

  function syncHeaderState() {
    body.classList.toggle("is-scrolled", window.scrollY > 48);
  }

  syncHeaderState();
  window.addEventListener("scroll", syncHeaderState, { passive: true });
});
