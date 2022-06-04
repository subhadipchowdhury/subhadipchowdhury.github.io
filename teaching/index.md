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

### Current Schedule (2022 Spring)

* Math 327: Numerical Analysis

* Math 212: Multivariable Calculus
  
* Math 130: Mathematical Foundations of Computing

#### Office Hours

Office hours will be be available both in-person and online on MS Teams. The booking link can be found on Moodle.


</div>

<div style="border-bottom: 2px  solid #800000;">

* [LLink to sample syllabi, lecture notes, and other resources]

* [Link to past course evaluations]

* [Link to statements]

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

