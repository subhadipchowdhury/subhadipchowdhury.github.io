# Changelog — Website Revamp (March 2026)

## Overview
Interactive & dynamic redesign of the personal academic website while staying on Jekyll/GitHub Pages and keeping the UChicago maroon palette.

---

## New Files Created

| File | Purpose |
|------|---------|
| `_data/career.yml` | Structured data for the career timeline (positions, institutions, years, logos) |
| `_includes/timeline.html` | Liquid template component that renders an animated vertical timeline from career data |
| `javascript/animations.js` | Homepage hero: animated Canvas background with floating geometric particles and connection lines |
| `javascript/scroll-animations.js` | GSAP ScrollTrigger-based reveal animations for sections, lists, timeline items, and course entries |
| `javascript/tabs.js` | Tab interface logic for the teaching page with sessionStorage persistence |

---

## Files Modified

### `css/stylesheet.scss`
- **Background:** Changed from grey (`#D9D9D9`) to warm off-white (`#f5f2ee`)
- **Line height:** Increased from 1.25 to 1.5 for readability
- **Navigation:** Rewrote hover effects — replaced fill animation with clean underline slide; added dropdown shadow and transform; improved active state
- **Header:** Added sticky behavior (fixed on scroll with compact padding and subtle shadow)
- **Hero section:** New full-width dark gradient hero with photo, contact info, and institutional shields; responsive layout
- **Timeline:** Full component styles — centered vertical line, alternating left/right cards, color-coded dots (maroon for appointments, lake blue for education), hover lift effect
- **Tabs:** Tab button bar with underline indicator, fade-in animation on content switch, vertical stacking on mobile
- **Sections:** New `.section` class replacing inline `style="border-bottom:..."` across all pages
- **Scroll reveals:** `.reveal` class with opacity/transform transitions
- **Papers/courses:** Added hover background tint; changed borders from dotted to solid light
- **Footer:** Dark lake background, rounded corners, lighter text with accent link colors
- **Filter controls:** Pill-shaped filter buttons and search input (kept for future use)
- **Accessibility:** Added `prefers-reduced-motion` media query to disable all animations
- **Cleanup:** Removed all vendor prefixes (`-webkit-`, `-moz-`, `-ms-`); modernized flex syntax

### `_includes/head.html`
- Removed jQuery 3.3.1 dependency
- Added GSAP 3.12.5 and ScrollTrigger plugin (both deferred)
- All scripts now use `defer` attribute
- Wrapped Nutshell.js initialization in `DOMContentLoaded` listener (needed since scripts are deferred)
- Improved meta description with actual content

### `_layouts/default.html`
- Added `id="site-header"` to header for sticky nav JS targeting
- Added page-specific script includes (animations.js for Home, tabs.js for Teaching)
- Added global scroll-animations.js include
- Removed filters.js reference (publications filtering not needed)

### `javascript/navigation.js`
- Complete rewrite from jQuery to vanilla JavaScript
- Added sticky header detection via scroll listener
- Added smooth scroll for anchor links
- Mobile hamburger toggle preserved but rewritten without jQuery

### `index.md` (Homepage)
- Replaced `.about` div with new `<section class="hero">` containing Canvas background, photo, contact info, and institutional logos
- Replaced `.experience` and `.education` divs with `{% include timeline.html %}`
- Wrapped all content sections in `.section.reveal` divs for scroll animations
- All content preserved; only structural markup changed

### `teaching/index.md`
- Replaced inline `style="border-bottom:..."` divs with `.section` class
- Wrapped course lists in tab interface: University of Chicago, College of Wooster, Bowdoin College, UChicago (GSL)
- Existing Liquid loops preserved inside tab panels
- Cleaned up link text ("Go to this Link" → cleaner formatting)

### `pedagogy/index.md`
- Replaced all inline `style="border-bottom:..."` divs with `.section.reveal` classes
- No content changes

### `research/index.md`
- Replaced all inline `style="border-bottom:..."` divs with `.section.reveal` classes
- No content changes

### `mentoring/index.md`
- Replaced all inline `style="border-bottom:..."` divs with `.section.reveal` classes
- No content changes

### `_includes/footer.html`
- Simplified and modernized: cleaner layout, removed inline JavaScript for last-modified date
- Updated tech credits (removed YAML/Sass mentions)
- Kept Creative Commons and GitHub source link

---

## Dependencies Changed

| Before | After |
|--------|-------|
| jQuery 3.3.1 (CDN) | **Removed** |
| — | GSAP 3.12.5 (CDN, ~100KB) |
| — | GSAP ScrollTrigger 3.12.5 (CDN, ~50KB) |

All other dependencies (MathJax, Font Awesome, Google Fonts, Nutshell.js) unchanged.

---

## What's Preserved
- All existing URLs (permalink: pretty)
- All YAML data files (courses, papers, talks) — untouched except new `career.yml`
- All assets (photos, PDFs, logos, icons)
- Teaching sub-pages (applets, evaluations, recommendations, resources) — unchanged
- UChicago color palette (maroon #800000, lake blues, greystone)
- Font stack (EB Garamond, Raleway, Alegreya Sans SC)
- MathJax rendering
- Nutshell.js expandable sections
- Creative Commons license
