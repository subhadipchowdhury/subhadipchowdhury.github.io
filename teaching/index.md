---
layout: default
title: Teaching
navigation_weight: 2
has_subnav: 1
---


<div style="border-bottom: 2px  solid #800000;">

## {{ page.title }}


</div>

<div style="border-bottom: 2px  solid #800000;">

* [Link to lecture notes and other resources](/teaching/resources/)

* [Link to past course evaluations](/teaching/evaluations/)

* [Link to statements](/teaching/statement/)

</div>

<div style="border-bottom: 2px  solid #800000;">

### Past Courses

#### University of Chicago


{% for course in site.data.courses_uchicago %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- [{{ coursepage.Duration }}]({{coursepage.Link}}) {% endfor %}
</div>
{% endfor %}


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


#### University of Chicago (GSL)


{% for course in site.data.courses_uchicago_gsl %}
<div class="course">
**{{ course.Name }} (Math {{ course.Code }})** {% for coursepage in course.Coursepages %}- {{ coursepage.Duration }} {% endfor %}
</div>
{% endfor %}

<p></p>  
</div>


<div style="border-bottom: 2px  solid #800000;">

### Others

#### Pedagogy Seminar

These are talks I have given in [UChicago Math Pedagogy Seminar](https://math.uchicago.edu/~pedagogyseminar/).

{% for talk in site.data.talks_pedagogy %}
<div class="course">
**{{ talk.Title }}** - [{{ talk.Duration }}]({{ talk.Link }}), {{ talk.Location }}, [:Abstract](#x-collab-learning)

#### :x collab learning

__Abstract__: {{talk.Abstract}}
</div>
{% endfor %}


#### Teaching Assistant

{% for course in site.data.nonteaching_courses_uchicago %}
<div class="course">
**{{ course.Duration }}**: {{ course.Role }} for {{ course.Name }} (Math {% if course.Link %} [{{ course.Code }}]({{ course.Link }})) {% else %} {{ course.Code }}) {% endif %}, taught by Professor [{{ course.Instructor }}]({{ course:Homepage }})

</div>
{% endfor %}


#### UChicago Warmup Program

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
 


#### Math Olympiad Training

These are old problem sets from Math Olympiad training camps for high school students in Karnataka, India.

<div class="course">
**Indian National Math Olympiad Training Camp** - [2010](/assets/problemsets/2010kinmotc.pdf) - [2011](/assets/problemsets/2011kinmotc.pdf) - [2012](/assets/problemsets/2012kinmotc.pdf)
</div>

<p></p>
</div>


### Expository Talks in Student Seminars

Note that some of the talks are very much of an outline in nature.

{% for talk in site.data.talks_expository %}
<div class="course">
**{{ talk.Title }}** - [{{ talk.Duration }}]({{ talk.Link }}), {{ talk.Location }}
</div>
{% endfor %}

