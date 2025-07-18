---
layout: default
title: Teaching
navigation_weight: 2
has_subnav: 1
---


<div style="border-bottom: 2px  solid #800000;">

# {{ page.title }}


</div>

<div style="border-bottom: 2px  solid #800000;">

<!-- * [Go to this link](/teaching/resources/) to access my past lecture notes and LaTeX templates.-->

* [Go to this Link](/teaching/evaluations/) to see my past course evaluations.

* [Go to this link](/teaching/recommendations/) if you are considering asking me to be reference or for a letter of recommendation.

</div>

<div style="border-bottom: 2px  solid #800000;">

## Past Courses

### University of Chicago


{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}


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


### University of Chicago (GSL)


{% for course in site.data.courses_uchicago_gsl %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- {{ coursepage.Duration }} {% endfor %}
</div>
{% endfor %}

<p></p>  
</div>


<div style="border-bottom: 2px  solid #800000;">

## Others


### Teaching Assistant

{% for course in site.data.nonteaching_courses_uchicago %}
<div class="course">
{{ course.Role }} for **{{ course.Name }} (Math {{ course.Code }})**, taught by Professor [{{ course.Instructor }}]({{ course.Homepage }}) - {% if course.Link %} [{{ course.Duration }}]({{ course.Link }}) {% else %} {{ course.Duration }} {% endif %}

</div>
{% endfor %}


### UChicago Warmup Program

These are notes from [Math review sessions](https://math.uchicago.edu/womp/) for incoming grad students at UChicago.

<div class="course">
**Gaussian Curvature and the Gauss-Bonnet Theorem** - [WOMP 2016](/assets/problemsets/2016WOMP.pdf) 
</div>
<div class="course">
**Covering Spaces and the Fundamental Group** - [WOMP 2015](/assets/problemsets/2015WOMP.pdf), with Oishee Banerjee
</div>
<div class="course">
**Covering Spaces and the Fundamental Group** - [WOMP 2014](/assets/problemsets/2014WOMP.pdf), with Nick Salter 
</div>
 


### Math Olympiad Training

These are old problem sets from Math Olympiad training camps for high school students in Karnataka, India.

<div class="course">
**Indian National Math Olympiad Training Camp** - [2010](/assets/problemsets/2010kinmotc.pdf) - [2011](/assets/problemsets/2011kinmotc.pdf) - [2012](/assets/problemsets/2012kinmotc.pdf)
</div>

<p></p>
</div>


