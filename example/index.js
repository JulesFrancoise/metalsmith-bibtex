#!/usr/bin/env node

var handlebars = require('handlebars');
var metalsmith = require('metalsmith');
var markdown = require('metalsmith-markdown');
var layouts = require('metalsmith-layouts');
var inplace = require('metalsmith-in-place');
var bibtex = require('metalsmith-bibtex');

var templateConfig = {
    engine: 'handlebars',
    directory: './layouts/',
    partials: './partials/'
};

// Handlebar for testing string equality
handlebars.registerHelper('if_eq', function(a, b, options) {
    if (a == b) // Or === depending on your needs
        return options.fn(this);
    else
        return options.inverse(this);
});

metalsmith(__dirname)
    .metadata({
        title: 'metalsmith-bibtex example',
        description: 'Example use of the metalsmith-bibtex plugin',
        generator: 'Metalsmith',
        url: 'http://www.metalsmith.io/'
    })
    .source('./src')
    .destination('./build')
    .clean(false)
    .use(bibtex({
        collections: {
            publications: 'bib/publications.bib',
            other: 'bib/other.bib',
            ieee: 'bib/IEEEexample.bib'
        },
        default: 'publications',
        style: 'default', // available styles: ['default', 'ieeetr']
        keystyle: 'numbered',
        sortBy: 'year',
        reverseOrder: true
    }))
    .use(markdown())
    .use(layouts(templateConfig))
    .use(inplace(templateConfig))
    .build(function(err) {
        if (err) {
            throw err;
        }
    });
