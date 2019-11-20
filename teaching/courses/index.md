---
layout: default
title: List of Courses Taught
parentnav: Teaching
subnav_weight: 32
---

## {{ page.title }}

Below is a list of courses I have taught in the past. This page contains the syllabi, assignments, class notes, exams etc. 

Select materials from some courses can be found on the [Sample Course Materials](/teaching/materials) page.

### Bowdoin College

{% for course in site.data.courses_bowdoin %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

### University of Chicago

{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}
  
### Others

{% for course in site.data.nonteaching_courses_uchicago %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role}} for {{ course.Name }} (Math [{{ course.Code }}]({{ course.Link }})), taught by Professor [{{ course.Instructor }}]({{ course:Homepage }})
</div>
{% endfor %}
---
