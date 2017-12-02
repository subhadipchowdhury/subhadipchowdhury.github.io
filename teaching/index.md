---
layout: default
title: Teaching
navigation_weight: 3
---


## {{ page.title }}

### University of Chicago
<hr>

{% for course in site.data.courses %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role  }} for {{ course.Name }} (Math [{{ course.Code }}]({{ course.link }}) ) {% if course.Instructor %} taught by [{{ course.Instructor }}]({{ course.Homepage}}) {% endif %} 
</div>
{% endfor %}
