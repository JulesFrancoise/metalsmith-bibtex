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
    keystyle: 'numbered',
    sortBy: 'year',
    reverseOrder: true
}));
```

## Options

* `collections`: the collections from different bibtex files. Each collection is accessible in the global context through its key as `bibtex.key`
* `default`: key of the default bibliography
* `style`: Style for rendering bibliographic entries using handlebars helper. Current styles include:
    * `default`
    * `ieeetr`
* `keystyle`: specifies if the style of citation in the text and bibliography keys (nothing if undefined). Possible options are `numbered` and `citekey`.
* `sortBy`: specifies the default field for sorting bibliographies.
* `reverseOrder`: specifies if entries should be sorted in reverse order.

## Handlebars Helpers

### Displaying a bibliography

__Displaying an entire collection__

The plugin defines a handlebars helper for rendering an entire bibtex collection as formatted HTML. It takes a collection as argument, and optionally a style, and key style:

```
{{bibliography <collection> [style=bibtex.style.<styleName>] [keystyle='numbered'|'citekey']}}
```

__Displaying a single entry__

Similarly, the `bibformat` helper renders a single bibtex entry:

```
{{bibformat <entry> [style=bibtex.style.<styleName>]}}
```

__Manipulating CSS__

The rendering helpers wrap all the fields of a bibtex entry in html tags with classes such as `class="bibtex title"`, which allows for further styling.

### Sorting and Grouping

__Sorting__

Collections can be sorted according to any field using the `bibsort` helper:

```
{{bibsort <collection> <field> [bool:reverseOrder]}}
```

Example: rendering a collection sorted by year in descending order:

```
{{bibliography (bibsort bibtex.other _year true)}}
```

__Grouping__

Collections can be grouped by unique values of a given field:

```
{{bibgroup <collection> <field>}}
```

Example of bibliography grouped by entry type:

```
{{#each (bibgroup bibtex.other _entrytype)}}
    <h4>{{group}}</h4>
    {{bibliography entries}}
{{/each}}
```

### Citations inside a page

Another helper allows for referring to publications inside the body of the text, which aggregates the cited items in a local bibtex collection.

The cite command can take the collection as optional argument:
```
{{#bibcite [bibtex.<collection>]}}citekey1 citekey2{{/bibcite}}
```

```html
<p>
Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua {{#bibcite}}mccreight1982complete
wheeler1976techniques{{/bibcite}}. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat
nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa
qui officia deserunt mollit anim id est laborum {{#bibcite
bibtex.other}}Markowitz1996{{/bibcite}}.
</p>

[...]

<h1>References</h1>
{{bibliography citations keystyle=bibtex.keystyle}}
```

### Example

See 'example' folder for use within a metalsmith project.

## Credits

This plugin relies on [bib2json](https://github.com/mayanklahiri/bib2json) (all the hard work is there!).

## License

MIT
