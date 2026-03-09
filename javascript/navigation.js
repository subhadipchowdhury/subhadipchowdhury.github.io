/* ========================================================================
   Navigation: Sticky header, mobile toggle (vanilla JS, no jQuery)
   ======================================================================== */

document.addEventListener('DOMContentLoaded', function () {

  /* ---- Mobile hamburger toggle ---- */
  var trigger = document.getElementById('nav-trigger');
  var mobileNav = document.querySelector('nav#nav-mobile ul');
  var menuIcon = document.querySelector('.wrapper-menu');

  if (trigger && mobileNav) {
    trigger.querySelector('span').addEventListener('click', function () {
      if (mobileNav.classList.contains('expanded')) {
        mobileNav.classList.remove('expanded');
        mobileNav.style.display = 'none';
        if (menuIcon) menuIcon.classList.remove('open');
      } else {
        mobileNav.classList.add('expanded');
        mobileNav.style.display = 'block';
        if (menuIcon) menuIcon.classList.add('open');
      }
    });
  }

  /* ---- Sticky header on scroll ---- */
  var header = document.getElementById('site-header');
  if (header) {
    var stickyThreshold = 80;
    window.addEventListener('scroll', function () {
      if (window.scrollY > stickyThreshold) {
        header.classList.add('sticky');
      } else {
        header.classList.remove('sticky');
      }
    }, { passive: true });
  }

  /* ---- Smooth scroll for anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href.length > 1) {
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
});
