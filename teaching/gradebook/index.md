---
layout: default
title: Mastery Gradebook
parentnav: Teaching
subnav_weight: 25
description: A dashboard for courses graded by standards that turns Gradescope exports into one Canvas mark per standard. It runs on your own computer.
---

{% comment %}
  Each screenshot comes in a light and a dark version, and css/stylesheet.scss
  (SCREENSHOTS) shows the one that matches the site's theme. Both versions are
  of the invented demo course; the light ones were captured on 2026-11-13 from
  the demo copy, the dark ones the same evening at the same window size.
{% endcomment %}

{% include page_title.html title=page.title %}

{% include section_open.html %}

Gradescope passes only an assessment's total score back to Canvas. My standards assessments have one question per standard, and my Canvas gradebook has one assignment per standard. In October 2026 I made this dashboard, with Claude Code, to go in between.

It keeps each student's best mark on each standard across all assessments, office-hour reassessments and revisions included, and writes a file to import into Canvas. It also shows where the class and each student stand, and writes an Excel workbook and a read-only page for my phone. Anything I enter by hand is saved as soon as I leave the cell. It runs on my own computer, and no data leaves it.

If you grade by standards and use Gradescope, it should work for your course too. You set the mark levels, what counts as mastered, and the checklist for the base grade.

The screenshots below show an invented course with made-up students.

<figure class="shot">
  <img class="shot__light" src="/teaching/gradebook/summary.png" width="1600" height="1337" loading="lazy" alt="The Summary tab, with a bar for each standard showing how many students have mastered it and a chart of the median number of standards mastered after each assessment.">
  <img class="shot__dark" src="/teaching/gradebook/summary-dark.png" width="1600" height="1337" loading="lazy" alt="The Summary tab, with a bar for each standard showing how many students have mastered it and a chart of the median number of standards mastered after each assessment.">
  <figcaption>The summary page.</figcaption>
</figure>

<figure class="shot">
  <img class="shot__light" src="/teaching/gradebook/students.png" width="1600" height="1061" loading="lazy" alt="The Students tab, with one row per student giving the base grade, the number of standards mastered, the homework percentage and the mark on each standard.">
  <img class="shot__dark" src="/teaching/gradebook/students-dark.png" width="1600" height="1061" loading="lazy" alt="The Students tab, with one row per student giving the base grade, the number of standards mastered, the homework percentage and the mark on each standard.">
  <figcaption>One row per student, with the base grade from the checklist.</figcaption>
</figure>

<figure class="shot">
  <img class="shot__light" src="/teaching/gradebook/student-record.png" width="1600" height="937" loading="lazy" alt="One student's record, giving the standards mastered, homework, pending revisions and base grade, and then each standard's marks at every assessment in order.">
  <img class="shot__dark" src="/teaching/gradebook/student-record-dark.png" width="1600" height="937" loading="lazy" alt="One student's record, giving the standards mastered, homework, pending revisions and base grade, and then each standard's marks at every assessment in order.">
  <figcaption>One student's record, with each standard's marks in order.</figcaption>
</figure>

<figure class="shot shot--phone">
  <img class="shot__light" src="/teaching/gradebook/phone.png" width="720" height="1599" loading="lazy" alt="The read-only phone page, with the same summary laid out for a phone screen.">
  <img class="shot__dark" src="/teaching/gradebook/phone-dark.png" width="720" height="1599" loading="lazy" alt="The read-only phone page, with the same summary laid out for a phone screen.">
  <figcaption>The phone page.</figcaption>
</figure>

[Download the folder](/teaching/gradebook/mastery-gradebook.zip) (zip, 72 KB). It has launchers for Mac and Windows and a README, and it needs Python 3.11 or later. The launchers offer to install what is missing.

{% include section_close.html %}
