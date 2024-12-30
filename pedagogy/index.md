---
layout: default
title: Pedagogy
navigation_weight: 3
---



<div style="border-bottom: 2px  solid #800000;">

# {{ page.title }}

</div>





<div style="border-bottom: 2px  solid #800000;">


## Training in Collaborative Learning for Undergraduate TAs

**Collaborative Learning Pedagogy and Content Analysis Training** - [Autumn 2024]() - [Winter 2025]()

## Professional Development Training for Graduate Student Lecturers

### co-led with Prof. [Sarah Ziesler](https://mathematics.uchicago.edu/people/profile/sarah-ziesler/), The University of Chicago

<div class="course">
**Selecting and Creating Rich Mathematical Tasks** - [Autumn 2024]() 
</div>

<div class="course">
**Designing Exam Standards and Questions in Alignment** - [Autumn 2024]()
</div>
<!--## : -->

## Exploratory Teaching Group for Instructional Faculty

**Discussion on Implementing Alternate Grading and Redesigning Assessment in Math** - [AY2024-25](https://teaching.uchicago.edu/programs/exploratory-teaching-groups), co-led with Prof. [Kale Davies](https://mathematics.uchicago.edu/people/profile/kale-davies/))

## Seminar and Conferences

{% for talk in site.data.talks_pedagogy %}
<div class="course">
**{{ talk.Title }}** - [{{ talk.Duration }}]({{ talk.Link }}), [{{ talk.Location }}]({{ talk.Website }}), [:Abstract](#{{ talk.Nutshell }})

### :{{ talk.Nutshell }}

__Abstract__: {{talk.Abstract}}
</div>
{% endfor %}

<p></p>

</div>
