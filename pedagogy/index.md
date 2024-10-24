---
layout: default
title: Pedagogy
navigation_weight: 2
---



<div style="border-bottom: 2px  solid #800000;">

# {{ page.title }}

</div>





<div style="border-bottom: 2px  solid #800000;">


## Collaborative Learning Pedagogy Training for Undergraduate TAs

**Collaborative Learning Pedagogy and Content Analysis Training** - [Autumn 2024]()

## Professional Development Training for Graduate Student Lecturers

**Selecting and Creating Rich Mathematical Tasks** - [Autumn 2024]()

<!--## Exploratory Teaching Group: Discussion on Implementing Alternate Grading and Redesigning Assessment in Math-->

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
