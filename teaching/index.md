---
layout: default
title: Teaching
navigation_weight: 2
has_subnav: 1
---


<div class="section">

# {{ page.title }}

</div>

<div class="section">

* [Course evaluations](/teaching/evaluations/) from past semesters.

* [Recommendation letters](/teaching/recommendations/) — information for students considering asking me for a reference.

</div>

<div class="section">

## Past Courses

</div>

<div class="tab-container">
<div class="tab-buttons">
<div class="tab-btn active" data-tab="uchicago">University of Chicago</div>
<div class="tab-btn" data-tab="wooster">College of Wooster</div>
<div class="tab-btn" data-tab="bowdoin">Bowdoin College</div>
<div class="tab-btn" data-tab="gsl">UChicago (GSL)</div>
</div>
</div>

<div class="tab-content active" id="tab-uchicago">

{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

</div>

<div class="tab-content" id="tab-wooster">

{% for course in site.data.courses_wooster %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

</div>

<div class="tab-content" id="tab-bowdoin">

{% for course in site.data.courses_bowdoin %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}

</div>

<div class="tab-content" id="tab-gsl">

{% for course in site.data.courses_uchicago_gsl %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- {{ coursepage.Duration }} {% endfor %}
</div>
{% endfor %}

</div>


<div class="section">

## Other Teaching


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

</div>
