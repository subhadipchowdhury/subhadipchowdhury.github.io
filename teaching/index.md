---
layout: default
title: Teaching
navigation_weight: 3
has_subnav: 1
---

<div style="border-bottom: 2px  solid #800000;">

## {{ page.title }}


</div>

<div style="border-bottom: 2px  solid #800000;">

### Current Schedule (2023 Spring)

* Math 299: Chaotic Dynamical Systems

* Math 130: Mathematical Foundations of Computing

* Math 110: Applied Differential Calculus
  

#### Office Hours

Office hours will be available in-person only. The times can be found on Moodle.


</div>

<div style="border-bottom: 2px  solid #800000;">

* [Link to sample syllabi, lecture notes, and other resources](/teaching/resources/)

* [Link to past course evaluations](/teaching/evaluations/)

* [Link to statements](/teaching/statement/)

</div>


### Past Courses


#### The College of Wooster


{% for course in site.data.courses_wooster %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}


#### Bowdoin College


{% for course in site.data.courses_bowdoin %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}


#### University of Chicago


{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- {{ coursepage.Duration }} {% endfor %}
</div>
{% endfor %}
  

#### Others


{% for course in site.data.nonteaching_courses_uchicago %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role }} for {{ course.Name }} (Math {% if course.Link %} [{{ course.Code }}]({{ course.Link }})) {% else %} {{ course.Code }}) {% endif %}, taught by Professor [{{ course.Instructor }}]({{ course:Homepage }})

</div>

{% endfor %}

<p></p>

