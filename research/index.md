---
layout: default
title: Research
navigation_weight: 4
---

<div class="section" markdown="1">

# {{ page.title }}

</div>

<div class="section reveal" markdown="1">

Link to my Research Statement (Winter 2024): [PDF](/research/Research_Statement.pdf)

</div>

<div class="section reveal" markdown="1">

## Publications/Preprints/Expository Notes

{% for paper in site.data.papers %}
{% if paper.type != "expository" %}
<div class="papers" markdown="1">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}

{% for paper in site.data.papers %}
{% if paper.type == "expository" %}
<div class="papers" markdown="1">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}

</div>

<div class="section reveal" markdown="1">

## Seminar and Conferences

{% for talk in site.data.talks_math %}
<div class="course" markdown="1">
**{{ talk.Location }}** - {{ talk.Duration }}
</div>
{% endfor %}

</div>
