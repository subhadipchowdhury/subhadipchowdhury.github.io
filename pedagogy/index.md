---
layout: default
title: Pedagogy
navigation_weight: 3
description: Pedagogy talks, collaborative learning materials, and faculty development work.
---

{% include page_title.html title=page.title %}




{% include section_open.html %}


## Training in Collaborative Learning for Undergraduate TAs

**Collaborative Learning Pedagogy and Content Analysis Training** - [Autumn 2024](/assets/syllabi/2024AU_CL1.pdf) - [Winter 2025](/assets/syllabi/2025WI_CL2.pdf) - [Spring 2025](/assets/syllabi/2025SP_CL3.pdf)

{% include section_close.html %}

{% include section_open.html %}

## Professional Development Training for Graduate Student Lecturers

These sessions were co-led with Prof. <a href="https://mathematics.uchicago.edu/people/profile/sarah-ziesler/">Sarah <span class="lastname">Ziesler</span></a> at the University of Chicago.


<div class="course">
**Understanding cognitive demand - selecting appropriate mathematical tasks to foster student engagement** - [Autumn 2024]() 
</div>

<div class="course">
**Selecting and designing exam questions that align with learning goals** - [Autumn 2024]()
</div>

<div class="course">
**How to interpret and act on student evaluation feedback** - [Winter 2025]()
</div>

<div class="course">
**How to write a syllabus and why** - [Winter 2025]()
</div>
<p></p>

{% include section_close.html %}

{% include section_open.html %}

## Exploratory Teaching Group for Instructional Faculty

Exploratory Teaching Groups are year-long faculty learning communities supported by the [Chicago Center for Teaching and Learning](https://teaching.uchicago.edu/past-exploratory-teaching-groups).

<div class="course">
**Discussion on Implementing Alternate Grading and Redesigning Assessment in Math** - AY2024-25, co-led with Prof. <a href="https://mathematics.uchicago.edu/people/profile/kale-davies/">Kale <span class="lastname">Davies</span></a>
</div>

{% include section_close.html %}

{% include section_open.html accent=true %}

## Invited Presentations

{% for talk in site.data.talks_pedagogy %}
<div class="course">
**{{ talk.Title }}** - {{ talk.Duration }}, {% if talk.Website %}[{{ talk.Location }}]({{ talk.Website }}){% else %}{{ talk.Location }}{% endif %}
{% if talk.AbstractId %}<button class="abstract-toggle" type="button" data-target="{{ talk.AbstractId }}" aria-expanded="false">Abstract</button>
<div class="abstract-panel" id="{{ talk.AbstractId }}" hidden>
<p><strong>Abstract.</strong> {{ talk.Abstract }}</p>
</div>{% endif %}
</div>
{% endfor %}
{% include section_close.html %}
