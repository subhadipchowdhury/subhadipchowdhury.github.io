---
layout: default
title: Teaching
navigation_weight: 3
has_subnav: 1
---

## {{ page.title }}

### Current Schedule (2021 Fall)

#### [Math 111: Calculus & Analytical Geometry I]()

#### [Math 215: Transition to Advanced Mathematics]()

#### Office Hours

Office hours will be be online on MS Teams. The booking link can be found on Moodle.


<div class='anchor'>

## Past Courses



### The College of Wooster

{% for course in site.data.courses_wooster %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

### Bowdoin College

{% for course in site.data.courses_bowdoin %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

### University of Chicago

{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- {{ coursepage.Duration }} {% endfor %}
</div>
{% endfor %}
  
### Others

{% for course in site.data.nonteaching_courses_uchicago %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role }} for {{ course.Name }} (Math {% if course.Link %} [{{ course.Code }}]({{ course.Link }})) {% else %} {{ course.Code }}) {% endif %}, taught by Professor [{{ course.Instructor }}]({{ course:Homepage }})
</div>
{% endfor %}



<div class='anchor'>

### Teaching Experience

* [Documents](/teaching/statements): You can find pdf version of my teaching statement, diversity statement, and teaching portfolio here.
* [Student Evaluations](/teaching/evaluations): This page contains a selection of students evaluations for courses taught at Bowdoin College from 2018-2019 and at University of Chicago from 2014-2018.



---
