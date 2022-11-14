---
layout: default
title: Research
navigation_weight: 2
---

<div style="border-bottom: 2px  solid #800000;">

## {{ page.title }}

</div>

A pdf copy of my Research Statement as of Fall 2022 can be found here: [[Short](Research_Statement_v2022_short.pdf)], [[Long](Research_Statement.pdf)].


### Papers/Preprints

{% for paper in site.data.papers %}
{% if paper.type != "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}



### Expository Notes

{% for paper in site.data.papers %}
{% if paper.type == "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endif %}
{% endfor %}



### Invited Research Talks

- *January 2021*: Joint Mathematical Meetings, Virtual
- *April 2018*: Special Session on Quantization for Probability Distributions and Dynamical Systems, American Mathematical Society Spring Southeastern Sectional Meeting, Vanderbilt University, Nashville, TN, USA
- *January 2018*: AMS Special Session on Dynamical Systems: Smooth, Symbolic, and Measurable, Joint Mathematical Meetings, San Diego, California, USA
- *September 2017*: Special Session on Geometric Group Theory, American Mathematical Society Fall Eastern Sectional Meeting, SUNY, Buffalo, USA
- *December 2016*: Session on Geometric Group Theory and Topology in Low Dimensions, Canadian Mathematical Society Winter Meeting, ON, Canada
