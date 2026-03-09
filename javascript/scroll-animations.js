/* ========================================================================
   Scroll-triggered reveal animations (GSAP ScrollTrigger)
   ======================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  // Wait for GSAP to load
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  // Respect reduced motion
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReduced.matches) {
    // Make everything visible without animation
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('visible');
    });
    return;
  }

  /* ---- Reveal sections on scroll ---- */
  var revealElements = document.querySelectorAll('.reveal');
  revealElements.forEach(function (el) {
    gsap.fromTo(el,
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true
        }
      }
    );
  });

  /* ---- Stagger timeline items ---- */
  var timelineItems = document.querySelectorAll('.timeline-item');
  if (timelineItems.length > 0) {
    gsap.fromTo(timelineItems,
      { opacity: 0, x: function (i) { return i % 2 === 0 ? -40 : 40; } },
      {
        opacity: 1,
        x: 0,
        duration: 0.6,
        stagger: 0.15,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.timeline',
          start: 'top 80%',
          once: true
        }
      }
    );
  }

  /* ---- Stagger list items within sections ---- */
  document.querySelectorAll('.section ul, .section ol').forEach(function (list) {
    var items = list.querySelectorAll('li');
    if (items.length > 0) {
      gsap.fromTo(items,
        { opacity: 0, x: -15 },
        {
          opacity: 1,
          x: 0,
          duration: 0.4,
          stagger: 0.08,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: list,
            start: 'top 85%',
            once: true
          }
        }
      );
    }
  });

  /* ---- Paper / course items ---- */
  document.querySelectorAll('.papers, .course').forEach(function (item) {
    gsap.fromTo(item,
      { opacity: 0, y: 12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: item,
          start: 'top 90%',
          once: true
        }
      }
    );
  });

  /* ---- Tab content animation ---- */
  document.querySelectorAll('.tab-content').forEach(function (tab) {
    if (tab.classList.contains('active')) {
      gsap.fromTo(tab,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
      );
    }
  });
});
