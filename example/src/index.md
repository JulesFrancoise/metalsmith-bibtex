---
title: 'metalsmith-bibtex example'
description: 'A metalsmith plugin to load and render bibtex bibliographies.'
layout: page.html
_numbered: numbered
_year: year
_citekey: citekey
_entrytype: entrytype
---

# 1. Rendering a bibliography using handlebars helpers

## 1.1. Default rendering

{{bibliography bibtex.other}}

## 1.2. Changing style and keystyle

{{bibliography bibtex.other style=bibtex.styles.ieeetr keystyle=_numbered}}

# 2. Sorting and grouping bibliographies

## 2.1. Sorting

bibliographies can be sorted according to any field, for example year in descending order:

{{bibliography (bibsort bibtex.other _year true) keystyle=_citekey}}

## 2.2. Grouping

bibliographies can be grouped by unique values of a given field, for example by entry type:

{{#each (bibgroup bibtex.other _entrytype)}}
<h4>{{group}}</h4>
{{bibliography entries}}
{{/each}}

# 3. Citing references within the page

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua {{#bibcite}}mccreight1982complete wheeler1976techniques{{/bibcite}}. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum {{#bibcite bibtex.other}}Markowitz1996{{/bibcite}}.

### References (cited in the extract)

{{bibliography citations keystyle=bibtex.keystyle}}

# 4. Example of bibliography using handmade handlebars partials

<ul>
{{#each bibtex.publications}}
    <li id="bibentry_{{@key}}">[{{@key}}] {{\>bibentry this}}
    </li>
{{/each}}
</ul>

# 5. Example of the IEEE test bibliography (ieeetr style)

{{bibliography bibtex.ieee style=bibtex.styles.ieeetr keystyle=_citekey}}
