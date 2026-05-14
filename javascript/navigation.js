/* Controls sticky-header shrink behavior and mobile navigation toggle. */

document.addEventListener("DOMContentLoaded", function () {
  var body = document.body;
  var menuTrigger = document.querySelector("#nav-trigger button");
  var menuIcon = document.querySelector("#nav-trigger .wrapper-menu");
  var mobileMenu = document.getElementById("nav-mobile-menu");
  var mobileNav = document.getElementById("nav-mobile");


  // Add hysteresis to prevent jitter at the scroll threshold
  var lastScrolledState = null;
  var SCROLL_ADD_THRESHOLD = 40;    // Add class above this
  var SCROLL_REMOVE_THRESHOLD = 5;  // Remove class below this

  function applyScrolledState() {
    if (!body) {
      return;
    }

    var isScrolled = body.classList.contains("is-scrolled");
    var y = window.scrollY;

    if (!isScrolled && y > SCROLL_ADD_THRESHOLD) {
      body.classList.add("is-scrolled");
    } else if (isScrolled && y < SCROLL_REMOVE_THRESHOLD) {
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
