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

### Current Schedule (2021 Fall)

#### [Math 115: Theoretical Differential Calculus]()

#### [Math 215: Transition to Advanced Mathematics]()

#### Office Hours

Office hours will be be online on MS Teams. The booking link can be found on Moodle.


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

