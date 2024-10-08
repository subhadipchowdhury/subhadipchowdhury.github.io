---
layout: default
title: Research
navigation_weight: 4
---

<div style="border-bottom: 2px  solid #800000;">

## {{ page.title }}

</div>

<!--A pdf copy of my Research Statement as of Winter 2024 can be found here: [[Short](Research_Statement.pdf)], [[Long](Research_Statement_long.pdf)].-->


<div style="border-bottom: 2px  solid #800000;">

### Pedagogy

#### Seminar and Conferences

{% for talk in site.data.talks_pedagogy %}
<div class="course">
**{{ talk.Title }}** - [{{ talk.Duration }}]({{ talk.Link }}), {{ talk.Location }}, [:Abstract](#x-collab-learning)

#### :x collab learning

__Abstract__: {{talk.Abstract}}
</div>
{% endfor %}


</div>

<div style="border-bottom: 2px  solid #800000;">


#### Papers/Preprints

{% for paper in site.data.papers %}
{% if paper.type != "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}




#### Expository Notes

{% for paper in site.data.papers %}
{% if paper.type == "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}




#### Seminar and Conferences

</div>
