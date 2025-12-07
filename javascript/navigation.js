const mobileNav = document.getElementById('nav-mobile');
const trigger = document.getElementById('nav-trigger-button');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function closeMenu() {
  mobileNav?.classList.remove('expanded');
  trigger?.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  if (!mobileNav || !trigger) return;
  const isOpen = mobileNav.classList.toggle('expanded');
  trigger.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && !prefersReducedMotion) {
    mobileNav.style.maxHeight = `${mobileNav.scrollHeight}px`;
  } else {
    mobileNav.style.maxHeight = '';
  }
}

function initNavigation() {
  if (!trigger) return;
  trigger.addEventListener('click', toggleMenu);
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) {
      closeMenu();
    }
  });
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

document.addEventListener('DOMContentLoaded', initNavigation);
