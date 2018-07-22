---
layout: default
title: List of Courses Taught
parentnav: Teaching
subnav_weight: 32
---

## {{ page.title }}

### University of Chicago

{% for course in site.data.courses %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role  }} for {{ course.Name }} (Math [{{ course.Code }}]({{ course.link }})) {% if course.Instructor %} taught by Prof. [{{ course.Instructor }}]({{ course.Homepage}}) {% endif %} 
</div>
{% endfor %}
  
---
