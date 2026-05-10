---
layout: default
title: Research
navigation_weight: 4
description: Publications, preprints, expository writing, and research talks.
---

{% include page_title.html title=page.title %}

{% include section_open.html %}

Link to my Research Statement (Winter 2024): [PDF](/research/Research_Statement.pdf)

{% include section_close.html %}

{% include section_open.html %}


## Publications/Preprints/Expository Notes

{% for paper in site.data.papers %}
{% if paper.type != "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {% assign collaborators = paper.with | split: ', ' %}{% for collaborator in collaborators %}{% assign parts = collaborator | split: ' ' %}{% for part in parts %}{% if forloop.last %}<span class="lastname">{{ part }}</span>{% else %}{{ part }} {% endif %}{% endfor %}{% unless forloop.last %}, {% endunless %}{% endfor %}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

<div class="research-link-row">
{% for link in paper.links %}<a class="abstract-toggle" href="{{ link[1] }}" target="_blank" rel="noopener noreferrer">{{ link[0] }}</a>{% endfor %}
</div>
</div>
{% endif %}
{% endfor %}

{% for paper in site.data.papers %}
{% if paper.type == "expository" %}
<div class="papers">
**{{ paper.title }}**{% if paper.with %} (with {% assign collaborators = paper.with | split: ', ' %}{% for collaborator in collaborators %}{% assign parts = collaborator | split: ' ' %}{% for part in parts %}{% if forloop.last %}<span class="lastname">{{ part }}</span>{% else %}{{ part }} {% endif %}{% endfor %}{% unless forloop.last %}, {% endunless %}{% endfor %}){% endif %}{% if paper.comment %}<br/> *{{ paper.comment }}.*{% endif %}

<div class="research-link-row">
{% for link in paper.links %}<a class="abstract-toggle" href="{{ link[1] }}" target="_blank" rel="noopener noreferrer">{{ link[0] }}</a>{% endfor %}
</div>
</div>
{% endif %}
{% endfor %}

{% include section_close.html %}

{% include section_open.html %}

## Seminar and Conferences

{% for talk in site.data.talks_math %}
<div class="course">
**{{ talk.Location }}** - {{ talk.Duration }}
</div>
{% endfor %}

<p></p>
{% include section_close.html %}
