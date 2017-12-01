---
layout: default
title: Research
navigation_weight: 2
---

## {{ page.title }}

### Papers/Preprints

{% for paper in site.research.papers %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {{ paper.with }}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

{% for link in paper.links %} [\[{{ link[0] }}\]]({{ link[1] }}) {% endfor %}
</div>
{% endfor %}
