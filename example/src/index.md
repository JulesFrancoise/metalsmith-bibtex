---
title: 'metalsmith-bibtex example'
description: 'A metalsmith plugin to load and render bibtex bibliographies.'
layout: page.html
---

## Example of bibliography using handlebars helpers

<ul>
{{#each bibtex.other}}
    <li id="bibentry_{{@key}}">[{{@key}}] {{bibformat this}}
    </li>
{{/each}}
</ul>

## Example of citations within the page

Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua {{#bibcite}}mccreight1982complete wheeler1976techniques{{/bibcite}}. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum {{#bibcite bibtex.other}}Markowitz1996{{/bibcite}}.

### References (cited in the extract)
<ul>
{{#each citations}}
    <li id="bibentry_{{@key}}">[{{#if @root.bibtex.numbered}}{{@index}}{{else}}{{@key}}{{/if}}] {{bibformat this}}
    </li>
{{/each}}
</ul>

## Example of bibliography using handlebars partials

<ul>
{{#each bibtex.publications}}
    <li id="bibentry_{{@key}}">[{{@key}}] {{\>bibentry this}}
    </li>
{{/each}}
</ul>

## Example of bibliography using handlebars partials (ieeetr style)

<ul>
{{#each bibtex.ieee}}
    <li id="bibentry_{{@key}}">[{{@key}}] {{bibformat this style=@root/bibtex.styles.ieeetr}}
    </li>
{{/each}}
</ul>
