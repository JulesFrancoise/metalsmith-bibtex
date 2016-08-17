# metalsmith-bibtex

A metalsmith plugin to load and render bibtex bibliographies.

## Installation

```
$ npm install metalsmith-bibtex
```

## Javascript Usage

Pass the options to `Metalsmith#use`:

```javascript
var bibtex = require('metalsmith-bibtex');

metalsmith.use(bibtex({
    collections: {
        publications: 'bib/publications.bib',
        other: 'bib/other.bib'
    },
    default: 'publications',
    style: 'default', // available styles: ['default', 'ieeetr']
    numbered: false
}));
```

## Options

* `collections`: the collections from different bibtex files. Each collection is accessible in the global context through its key as `bibtex.key`
* `default`: key of the default bibliography
* `style`: Style for rendering bibliographic entries using handlebars helper. Current styles include:
    * `default`
    * `ieeetr`
* `numbered`: specifies if the citation in the text and bibliography should be numbered or use cite-keys.

## handlebars Helpers

### Displaying a bibliography

The plugin defines a handlebars helper for rendering bibtex entries as formatted HTML. It takes an entry as argument, and optionally a style:

Usage:
```
{{bibformat <entry> [style=bibtex.style.<styleName>]}}
```

For example, to render the full bibliography for collection `publications`:

```html
<ul>
{{#each bibtex.publications}}
    <li id="bibentry_{{@key}}">[{{@key}}] {{bibformat this}}
    </li>
{{/each}}
</ul>
```

### Citations inside a page

Another helper allows for referring to publications inside the body of the text, which aggregates the cited items in a local bibtex collection.

The cite command can take the collection as optional argument:
```
{{#bibcite [bibtex.<collection>]}}citekey1 citekey2{{/bibcite}}
```

```html
<p>
    Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua {{#bibcite}}mccreight1982complete wheeler1976techniques{{/bibcite}}. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum {{#bibcite bibtex.other}}Markowitz1996{{/bibcite}}.
</p>

[...]

<h1>References</h1>
<ul>
{{#each citations}}
    <li id="bibentry_{{@key}}">[{{#if @root.bibtex.numbered}}{{@index}}{{else}}{{@key}}{{/if}}] {{bibformat this}}
    </li>
{{/each}}
</ul>
```

### Example

See 'example' folder for use within a metalsmith project.

## License

MIT
