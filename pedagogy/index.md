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

**Collaborative Learning Pedagogy and Content Analysis Training** - [Autumn 2024](/assets/syllabi/2024AU_CL1.pdf) - [Winter 2025](/assets/syllabi/2025SP_CL2.pdf)

</div>

<div style="border-bottom: 2px  solid #800000;">

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

</div>

<div style="border-bottom: 2px  solid #800000;">

## Exploratory Teaching Group for Instructional Faculty

**Discussion on Implementing Alternate Grading and Redesigning Assessment in Math** - [AY2024-25](https://teaching.uchicago.edu/programs/exploratory-teaching-groups), co-led with Prof. [Kale Davies](https://mathematics.uchicago.edu/people/profile/kale-davies/)

</div>

<div style="border-bottom: 2px  solid #800000;">

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
