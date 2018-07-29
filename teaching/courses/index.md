---
layout: default
title: List of Courses Taught
parentnav: Teaching
subnav_weight: 32
---

## {{ page.title }}

Below is a list of courses I have taught in the past. This page contains all the assignments. Select materials from some courses can be found on the [Sample Course Materials](/teaching/materials) page.

### Bowdoin College

{% for course in site.data.courses_bowdoin %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role  }} for {{ course.Name }} (Math [{{ course.Code }}]({{ course.link }})) 
</div>
{% endfor %}

### University of Chicago

{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role  }} for {{ course.Name }} (Math [{{ course.Code }}]({{ course.link }})) {% if course.Instructor %} taught by Prof. [{{ course.Instructor }}]({{ course.Homepage}}) {% endif %} 
</div>
{% endfor %}
  


---