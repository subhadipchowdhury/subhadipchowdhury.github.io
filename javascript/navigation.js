/* Controls sticky-header shrink behavior and mobile navigation toggle. */

document.addEventListener("DOMContentLoaded", function () {
  var body = document.body;
  var menuTrigger = document.querySelector("#nav-trigger button");
  var menuIcon = document.querySelector("#nav-trigger .wrapper-menu");
  var mobileMenu = document.getElementById("nav-mobile-menu");
  var mobileNav = document.getElementById("nav-mobile");

  function applyScrolledState() {
    if (!body) {
      return;
    }

    if (window.scrollY > 20) {
      body.classList.add("is-scrolled");
    } else {
      body.classList.remove("is-scrolled");
    }
  }

  function setMobileMenuState(isOpen) {
    if (!menuTrigger || !mobileMenu || !menuIcon) {
      return;
    }

    menuTrigger.setAttribute("aria-expanded", String(isOpen));
    mobileMenu.classList.toggle("expanded", isOpen);
    menuIcon.classList.toggle("open", isOpen);
  }

  function isDesktopLayout() {
    return window.matchMedia("(min-width: 901px)").matches;
  }

  applyScrolledState();
  window.addEventListener("scroll", applyScrolledState, { passive: true });

  if (!menuTrigger || !mobileMenu || !menuIcon || !mobileNav) {
    return;
  }

  setMobileMenuState(false);

  menuTrigger.addEventListener("click", function () {
    var isOpen = menuTrigger.getAttribute("aria-expanded") === "true";
    setMobileMenuState(!isOpen);
  });

  mobileMenu.addEventListener("click", function (event) {
    if (event.target instanceof Element && event.target.closest("a")) {
      setMobileMenuState(false);
    }
  });

  document.addEventListener("click", function (event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (!mobileNav.contains(event.target) && !menuTrigger.contains(event.target)) {
      setMobileMenuState(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setMobileMenuState(false);
    }
  });

  window.addEventListener("resize", function () {
    if (isDesktopLayout()) {
      setMobileMenuState(false);
    }
  });
});
