---
layout: default
title: Worksheet Template
parentnav: Teaching
subnav_weight: 21
description: A LaTeX class for building course workbooks and standalone worksheets.
---

{% include page_title.html title=page.title %}

{% include section_open.html %}

I wrote a LaTeX document class, `workbook.cls`, for producing course materials from a single source: a full bound workbook (lecture notes plus appendices) and standalone worksheet-style assignments that share the same macros and styling. The [template repository](https://github.com/subhadipchowdhury/math_worksheet_template) is a minimal working example organized as a small course repository.

The class supports two output modes from the same code base. Workbook mode compiles `main.tex` into a complete workbook with chapters and appendices, while worksheet mode compiles each file in `assignments/` as an independent problem set. Both modes draw on the same set of features: title metadata, theorem-like environments, warning / note / digression / proof-skeleton blocks, lecture-plan and staff-note blocks, math macros, figure inclusion with cross-references, and a `biblatex` bibliography.

To use it, clone the repository and build with a standard TeX toolchain (`pdflatex` plus `biber` for the bibliography). Keep `workbook.cls` at the repository root, put lecture material in `chapters/` and `appendices/`, and keep each worksheet as a standalone file in `assignments/`. Full directory layout and compile instructions are in the [repository README](https://github.com/subhadipchowdhury/math_worksheet_template).

{% include section_close.html %}
