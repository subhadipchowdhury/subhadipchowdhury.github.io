/* ========================================================================
   Tab interface for teaching page
   ======================================================================== */

document.addEventListener('DOMContentLoaded', function () {
  var tabButtons = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');

  if (tabButtons.length === 0) return;

  // Restore last active tab from sessionStorage
  var savedTab = sessionStorage.getItem('activeTeachingTab');
  if (savedTab) {
    var savedBtn = document.querySelector('.tab-btn[data-tab="' + savedTab + '"]');
    var savedContent = document.getElementById('tab-' + savedTab);
    if (savedBtn && savedContent) {
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });
      savedBtn.classList.add('active');
      savedContent.classList.add('active');
    }
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabId = this.getAttribute('data-tab');

      // Deactivate all
      tabButtons.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });

      // Activate clicked
      this.classList.add('active');
      var target = document.getElementById('tab-' + tabId);
      if (target) {
        target.classList.add('active');

        // Animate with GSAP if available
        if (typeof gsap !== 'undefined') {
          gsap.fromTo(target,
            { opacity: 0, y: 10 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
          );
        }
      }

      // Save to sessionStorage
      sessionStorage.setItem('activeTeachingTab', tabId);
    });
  });
});
