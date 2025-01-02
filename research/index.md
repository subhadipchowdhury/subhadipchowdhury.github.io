---
layout: default
title: Research
navigation_weight: 4
---

<div style="border-bottom: 2px  solid #800000;">

# {{ page.title }}

</div>

<div style="border-bottom: 2px  solid #800000;">

Link to my Research Statement (Winter 2024): [PDF](/research/Research_Statement.pdf)

</div>

<div style="border-bottom: 2px  solid #800000;">


## Publications/Preprints/Expository Notes

{% for paper in site.data.papers %}
{% if paper.type != "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}

{% for paper in site.data.papers %}
{% if paper.type == "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}

</div>

<div style="border-bottom: 2px  solid #800000;">

## Seminar and Conferences

{% for talk in site.data.talks_math %}
<div class="course">
**{{ talk.Location }}** - {{ talk.Duration }}
</div>
{% endfor %}

<p></p>
</div>
