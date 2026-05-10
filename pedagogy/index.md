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

### The University of Chicago, co-led with Prof. [Sarah Ziesler](https://mathematics.uchicago.edu/people/profile/sarah-ziesler/)


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

**Discussion on Implementing Alternate Grading and Redesigning Assessment in Math** - [AY2024-25](https://teaching.uchicago.edu/programs/exploratory-teaching-groups), co-led with Prof. [Kale Davies](https://mathematics.uchicago.edu/people/profile/kale-davies/)

{% include section_close.html %}

{% include section_open.html %}

## Invited Presentations

{% for talk in site.data.talks_pedagogy %}
<div class="course">
**"{{ talk.Title }}"** - [{{ talk.Duration }}]({{ talk.Link }}), [{{ talk.Location }}]({{ talk.Website }})
</div>
{% endfor %}
{% include section_close.html %}
