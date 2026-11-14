---
layout: default
title: Mastery Gradebook
parentnav: Pedagogy
subnav_weight: 33
blurb: My dashboard for standards-based grading with Gradescope and Canvas.
description: A dashboard for standards-based grading. It turns Gradescope exports into one Canvas mark per standard and runs on your own computer.
---

{% comment %}
  Each screenshot comes in a light and a dark version, and css/stylesheet.scss
  (SCREENSHOTS) shows the one that matches the site's theme. Both versions are
  of the invented demo course; the light ones were captured on 2026-11-13 from
  the demo copy, the dark ones the same evening at the same window size.

  Each figure carries markdown="0". _config.yml sets parse_block_html, and
  without the attribute kramdown reads the caption as a paragraph that swallows
  </figcaption> and </figure>, nesting every later figure inside the one before.
{% endcomment %}

{% include page_title.html title=page.title %}

{% include section_open.html %}

I use mastery-based grading (also called standards-based grading) in my courses. Each standard gets its own question on my Gradescope assessments and its own assignment in my Canvas gradebook. But Gradescope passes only an assessment's total score back to Canvas, and from the total I can't tell which standards a student has mastered. In October 2026 I made this dashboard with Claude Code to fill in those Canvas assignments from the Gradescope exports.

It keeps each student's best mark on each standard across all assessments, including office-hour reassessments and revisions. From those marks it writes a file that I import into Canvas. It also shows a summary of the whole class and a record for each student, and it writes an Excel workbook and a read-only page for my phone. Anything I type in by hand, such as a note or the final grade, is saved as soon as I leave the cell. It runs on my own computer and doesn't send student data anywhere.

If you grade by standards and give each standard its own question in Gradescope, it should work for your course too. On its Setup tab you choose the mark levels, which of them count as mastered, and the checklist for the base grade.

The course and the students in the screenshots below are made up.

<figure class="shot" markdown="0">
  <img class="shot__light" src="/pedagogy/gradebook/summary.png" width="1600" height="1337" loading="lazy" alt="The Summary tab, with a bar for each standard showing how many students have mastered it and a chart of the median number of standards mastered after each assessment.">
  <img class="shot__dark" src="/pedagogy/gradebook/summary-dark.png" width="1600" height="1337" loading="lazy" alt="The Summary tab, with a bar for each standard showing how many students have mastered it and a chart of the median number of standards mastered after each assessment.">
  <figcaption>The Summary tab.</figcaption>
</figure>

<figure class="shot" markdown="0">
  <img class="shot__light" src="/pedagogy/gradebook/students.png" width="1600" height="1061" loading="lazy" alt="The Students tab, with one row per student giving the base grade, the number of standards mastered, the homework percentage and the mark on each standard.">
  <img class="shot__dark" src="/pedagogy/gradebook/students-dark.png" width="1600" height="1061" loading="lazy" alt="The Students tab, with one row per student giving the base grade, the number of standards mastered, the homework percentage and the mark on each standard.">
  <figcaption>The Students tab, with one row per student and the base grade from the checklist.</figcaption>
</figure>

<figure class="shot" markdown="0">
  <img class="shot__light" src="/pedagogy/gradebook/student-record.png" width="1600" height="937" loading="lazy" alt="One student's record, giving the standards mastered, homework, pending revisions and base grade, and then each standard's marks at every assessment in order.">
  <img class="shot__dark" src="/pedagogy/gradebook/student-record-dark.png" width="1600" height="937" loading="lazy" alt="One student's record, giving the standards mastered, homework, pending revisions and base grade, and then each standard's marks at every assessment in order.">
  <figcaption>One student’s record, with each standard’s marks from the first assessment to the last.</figcaption>
</figure>

<figure class="shot shot--phone" markdown="0">
  <img class="shot__light" src="/pedagogy/gradebook/phone.png" width="720" height="1599" loading="lazy" alt="The read-only phone page, with the same summary laid out for a phone screen.">
  <img class="shot__dark" src="/pedagogy/gradebook/phone-dark.png" width="720" height="1599" loading="lazy" alt="The read-only phone page, with the same summary laid out for a phone screen.">
  <figcaption>The phone page.</figcaption>
</figure>

[Download the folder](/pedagogy/gradebook/mastery-gradebook.zip) (zip, 72 KB). It needs Python 3.11 or later. If Python or one of the packages the dashboard uses is missing, the launchers for Mac and Windows offer to install it. The README in the folder explains the setup.

{% include section_close.html %}
