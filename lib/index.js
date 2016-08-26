var parse = require('bib2json');
var extname = require('path').extname;
var handlebars = require('handlebars');

/**
 * Adds information from bibtex files to the global context and defines a set
 * of handlebars helpers for citing and formatting bibliographies
 *
 * @param  {Object} options - module options
 */
module.exports = function(options) {

    'use strict';

    var keys = Object.keys(options.collections);

    return function(files, metalsmith, done) {

        var meta = metalsmith.metadata();
        meta.bibtex = {};

        // Register style for bibliography
        // available: 'ieeetr' (default)
        meta.bibtex.style = ('style' in options) ? options['style'] : 'default';

        // Register type of inline citation (numbered vs citekey)
        meta.bibtex.keystyle = ('keystyle' in options) && options['keystyle'];

        // Register key of the default collection
        meta.bibtex.default = ('default' in options) ? options['default'] : keys[0];

        // Register sort order
        meta.bibtex.sortBy = ('sortBy' in options) && options['sortBy'];

        // Register sort order
        meta.bibtex.reverseOrder = ('reverseOrder' in options) && options['reverseOrder'];

        keys.forEach(function(coll) {
            let filename = options.collections[coll];
            if (!(filename in files) || !bibtex(filename)) {
                throw new Error('Cannot find file ' + filename);
            }
            var bibdata_raw = parse(files[filename].contents.toString());
            var bibdata = {};
            bibdata_raw.entries.forEach(function(entry) {
                bibdata[entry.EntryKey] = entry.Fields;
                bibdata[entry.EntryKey]['entrytype'] = entry.EntryType;
                bibdata[entry.EntryKey]['citekey'] = entry.EntryKey;
            });
            if (meta.bibtex.sortBy) {
                bibdata = sortBibCollection(bibdata,
                    meta.bibtex.sortBy,
                    meta.bibtex.reverseOrder);
            }
            meta.bibtex[coll] = bibdata;
            delete files[filename];
        });

        // available styles: default, ieeetr
        meta.bibtex.styles = {
            'default': 'default',
            'ieeetr': 'ieeetr'
        };

        // Handlebar Helper for inline citations
        // all cited articles on a page are stored in a local 'citations'
        // collection
        handlebars.registerHelper('bibcite', function(bibfile, opt) {
            if (opt === undefined) {
                opt = bibfile;
                bibfile = meta.bibtex[meta.bibtex.default];
                if (bibfile === undefined) {
                    throw new Error('metalsmith-bibtex Error: Cannot find bibtex colection');
                }
            } else if (bibfile === undefined) {
                throw new Error('metalsmith-bibtex Error: Cannot find bibtex colection');
            }
            if (!('citations' in opt.data.root)) {
                opt.data.root['citations'] = {};
            }
            var citekeys = opt.fn(this).split(' ');
            var html_str = '[' +
                citekeys.map(function(entry) {
                    if (entry in bibfile) {
                        opt.data.root['citations'][entry] = bibfile[entry];
                        if (meta.bibtex.keystyle == 'numbered') {
                            return '<a href="#bibentry_' + entry + '">' + Object.keys(opt.data.root['citations']).length + '</a>';
                        } else {
                            return '<a href="#bibentry_' + entry + '">' + entry + '</a>';
                        }
                    } else {
                        opt.data.root['citations'][entry] = {};
                        if (meta.bibtex.keystyle == 'numbered') {
                            return '<a href="#bibentry_' + entry + '" style="color: red;">XX</a>';
                        } else {
                            return '<a href="#bibentry_' + entry + '" style="color: red;">' + entry + '</a>';
                        }
                    }

                }).join(', ') +
                ']';
            return new handlebars.SafeString(html_str);
        });

        // Handlebar Helper for sorting bibliographies according to a field
        handlebars.registerHelper('bibsort', function(collection, sortField, reverseOrder, opt) {
            if (opt === undefined) {
                if (reverseOrder === undefined) {
                    throw new Error('metalsmith-bibtex Error [helper bibliography]: no valid sorting field provided');
                } else {
                    opt = reverseOrder;
                    reverseOrder = false;
                }
            }
            if (!sortField) {
                throw new Error('metalsmith-bibtex Error [helper bibliography]: no valid sorting field provided');
            }
            return sortBibCollection(collection, sortField, reverseOrder);
        });

        // Handlebar Helper for grouping bibliographies accoring to unique
        // field values
        handlebars.registerHelper('bibgroup', function(collection, groupField, reverseOrder, opt) {
            if (opt === undefined) {
                if (reverseOrder === undefined) {
                    throw new Error('metalsmith-bibtex Error [helper bibliography]: no valid grouping field provided');
                } else {
                    opt = reverseOrder;
                    reverseOrder = false;
                }
            }
            if (!groupField) {
                throw new Error('metalsmith-bibtex Error [helper bibliography]: no valid grouping field provided');
            }
            return groupBibCollection(collection, groupField, reverseOrder);
        });

        // Handlebar Helper for sorting bibliographies
        handlebars.registerHelper('bibliography', function(collection, opt) {
            if (opt === undefined) {
                throw new Error('metalsmith-bibtex Error [helper bibliography]: No collection provided');
            }
            if (collection === undefined) {
                throw new Error('metalsmith-bibtex Error [helper bibliography]: No collection provided');
            }
            var style = ('style' in opt.hash) ?
                opt.hash.style :
                meta.bibtex.style;
            var keystyle = ('keystyle' in opt.hash) &&
                opt.hash.keystyle;
            var html_str = '<ul class="bibtex bibliography">';
            Object.keys(collection).forEach(function(key, index) {
                html_str += '<li class="bibtex entry">';
                if (keystyle) {
                    if (keystyle == 'numbered') {
                        html_str += '<span class="bibtex key">[' + (1 + index) + ']</span> ';
                    } else {
                        html_str += '<span class="bibtex key">[' + key + ']</span> ';
                    }
                }
                html_str += bibtexRenderHtml(collection[key], style);
                html_str += '</li>';
            });
            html_str += '</ul>';
            return new handlebars.SafeString(html_str);
        });

        // Handlebar Helper for formatting bibliographic entries
        handlebars.registerHelper('bibformat', function(entry, opt) {
            if (opt === undefined || entry === undefined) {
                throw new Error('metalsmith-bibtex Error [bibformat]: No valid entry provided');
            }
            var style = ('style' in opt.hash) ?
                opt.hash.style :
                meta.bibtex.style;
            return new handlebars.SafeString(
                bibtexRenderHtml(entry, style));
        });

        done();
    };

};

/**
 * Check if a `file` is bibtex.
 *
 * @param {String} file
 * @return {Boolean}
 */
function bibtex(file) {
    return /\.bib|\.bibtex/.test(extname(file));
}

/**
 * Sort a bibtex collection using a given field
 * @param  {Object}  collection           bibtex collection
 * @param  {string}  sortField            Field used for sorting
 * @param  {Boolean} [reverseOrder=false] specifies reverse order
 * @return {Object}                       Sorted bibtex collection
 */
function sortBibCollection(collection, sortField, reverseOrder) {
    'use strict';
    const bibkeys = Object.keys(collection);
    var bibarray = bibkeys.map(function(citekey) {
        return {
            'citekey': citekey,
            'sortkey': (sortField in collection[citekey]) ? collection[citekey][sortField].toLowerCase() : null
        };
    }).sort(function(a, b) {
        return +(a.sortkey > b.sortkey) || +(a.sortkey === b.sortkey) - 1;
    });
    if (reverseOrder) {
        bibarray.reverse();
    }
    bibarray = bibarray.map(function(elt) {
        return elt.citekey;
    });
    var newbib = {};
    bibarray.forEach(function(citekey) {
        newbib[citekey] = collection[citekey];
    });
    return newbib;
}

/**
 * Group a bibtex collection using unique values from a given field
 * @param  {Object}  collection           bibtex collection
 * @param  {string}  groupField           Field used for grouping
 * @param  {Boolean} [reverseOrder=false] specifies reverse order
 * @return {Array[Object]}                       Grouped bibtex collection
 */
function groupBibCollection(collection, groupField, reverseOrder) {
    'use strict';
    const bibkeys = Object.keys(collection);
    var groups = Array.from(new Set(bibkeys
        .map(function(citekey) {
            return (groupField in collection[citekey]) ? collection[citekey][groupField].toLowerCase() : null;
        })))
        .sort();
    if (reverseOrder) {
        groups.reverse();
    }
    var groupedBib = [];
    var undefColl = {};
    groups.forEach(groupVal => {
        let coll = {};
        bibkeys.forEach(citekey => {
            if (groupField in collection[citekey]) {
                if (collection[citekey][groupField] == groupVal) {
                    coll[citekey] = collection[citekey];
                }
            } else {
                undefColl[citekey] = collection[citekey];
            }
        });
        groupedBib.push({
            group: groupVal,
            entries: coll
        });
    });
    if (Object.keys(undefColl).length > 0) {
        groupedBib.push({
            group: 'undefined',
            entries: undefColl
        });
    }
    return groupedBib;
}

/**
 * Render a bibtex entry as HTML
 *
 * @param {Object} entry - bibtex entry object
 * @param {string} style - Latex style to used for rendering
 * @return {string}
 */
function bibtexRenderHtml(entry, style) {
    if (style === 'default') {
        return bibtexRenderHtmlDefault(entry);
    } else if (style === 'ieeetr') {
        return bibtexRenderHtmlIeeetr(entry);
    } else {
        throw new Error('metalsmith-bibtex Error: Style not implemented');
    }
}

/**
 * Render a bibtex entry as HTML using default style
 *
 * @param {Object} entry - bibtex entry object
 * @return {string} string - string containing html-formatted citation
 */
function bibtexRenderHtmlDefault(entry) {
    // See http://tug.ctan.org/tex-archive/macros/latex/contrib/IEEEtran/bibtex/IEEEtran_bst_HOWTO.pdf

    function extractAuthorListDefault(authors_string) {
        var authors = authors_string.split(' and ').map(function(author) {
            var namespl = author.split(', ');
            if (namespl.length == 2) {
                var lastName = author.split(', ')[0];
                var firstName = author.split(', ')[1];
                return firstName + ' ' + lastName;
            } else {
                return author;
            }
        });
        if (authors.length > 1) {
            authors = authors.slice(0, -1)
                .reduceRight(function(previousValue, currentValue) {
                    return currentValue + ', ' + previousValue;
                }, 'and ' + authors.slice(-1));
        } else {
            authors = authors[0];
        }
        return authors;
    }

    var authors = ('author' in entry) ?
        extractAuthorListDefault(entry['author']) :
        '';

    return bibtexRenderHtmlIeeetr_internal(entry, authors);
}

/**
 * Render a bibtex entry as HTML using ieeetr style
 *
 * @param {Object} entry - bibtex entry object
 * @return {string} string - string containing html-formatted citation
 */
function bibtexRenderHtmlIeeetr(entry) {
    // See http://tug.ctan.org/tex-archive/macros/latex/contrib/IEEEtran/bibtex/IEEEtran_bst_HOWTO.pdf

    function extractAuthorListIeeetr(authors_string) {
        var authors = authors_string.split(' and ').map(function(author) {
            var namespl = author.split(', ');
            var lastName, firstName;
            if (namespl.length == 2) {
                lastName = author.split(', ')[0];
                firstName = author.split(', ')[1];
                return firstName[0] + '. ' + lastName;
            } else if (namespl.length == 1) {
                var namespldot = author.split('.');
                if (namespldot.length > 1) {
                    firstName = namespldot.slice(0, -1).join('.') + '.';
                    firstName = firstName.split(' ').map(function(elt) {
                        return elt[0] + '.';
                    }).join(' ');
                    lastName = namespldot.slice(-1)[0];
                    return firstName + lastName;
                } else {
                    firstName = author.split(' ').slice(0, -1).map(function(elt) {
                        return elt[0] + '.';
                    }).join(' ');
                    lastName = author.split(' ').slice(-1)[0];
                    return firstName + lastName;
                }
            } else {
                return author;
            }
        });
        if (authors.length > 1) {
            authors = authors.slice(0, -1)
                .reduceRight(function(previousValue, currentValue) {
                    return currentValue + ', ' + previousValue;
                }, 'and ' + authors.slice(-1));
        } else {
            authors = authors[0];
        }
        return authors;
    }

    var authors = ('author' in entry) ?
        extractAuthorListIeeetr(entry['author']) :
        '';

    return bibtexRenderHtmlIeeetr_internal(entry, authors);
}

/**
 * Format bibtex entry as HTML string using ieeetr style given the formatted
 * authors string.
 *
 * @param  {Object} entry   - Object representing a bibtex entry
 * @param  {string} authors - Formatted string representing the author list.
 * @return {string}         - string containing html-formatted citation
 */
function bibtexRenderHtmlIeeetr_internal(entry, authors) {
    var html_str = '<span class="bibtex author">';
    html_str += (authors === '') ? '</span>' : authors + '</span>, ';

    if (entry['entrytype'] === 'article') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('journal' in entry) {
            html_str += '<i class="bibtex journal">' + entry.journal + '</i>, ';
        }
        if ('volume' in entry) {
            html_str += '<span class="bibtex volume">vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += '</span>, ';
        }
    } else if (entry['entrytype'] === 'inproceedings') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('booktitle' in entry) {
            html_str += 'in <i class="bibtex booktitle">' + entry.booktitle;
            if ('series' in entry) {
                html_str += ' <span class="bibtex series">(' + entry.series + ')</span>';
            }
            html_str += '</i>, ';
        }
        if ('volume' in entry) {
            html_str += '<span class="bibtex volume">vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>, ';
        }
        if ('publisher' in entry) {
            html_str += '<span class="bibtex publisher">' + entry.publisher + '</span>, ';
        }
    } else if (entry['entrytype'] === 'book') {
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>';
        }
        if ('publisher' in entry) {
            html_str += ': <span class="bibtex publisher">' + entry.publisher + '</span>.';
        }
    } else if (entry['entrytype'] === 'phdthesis') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        html_str += '<span class="bibtex type">PhD Dissertation</span>, ';
        if ('school' in entry) {
            html_str += '<span class="bibtex school">' + entry.school + '</span>';
        }
        if ('address' in entry) {
            html_str += ', <span class="bibtex address">' + entry.address + '</span>';
        }
        if ('publisher' in entry) {
            html_str += ': <span class="bibtex publisher">' + entry.publisher + '</span>';
        }
        html_str += '. ';
    } else if (entry['entrytype'] === 'mastersthesis') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        html_str += '<span class="bibtex type">Master\'s Thesis</span>, ';
        if ('school' in entry) {
            html_str += '<span class="bibtex school">' + entry.school + '</span>';
        }
        if ('address' in entry) {
            html_str += ', <span class="bibtex address">' + entry.address + '</span>, ';
        }
        if ('publisher' in entry) {
            html_str += ': <span class="bibtex publisher">' + entry.publisher + '</span>';
        }
        html_str += '. ';
    } else if (entry['entrytype'] === 'inbook' || entry['entrytype'] === 'incollection') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('booktitle' in entry) {
            html_str += 'in <i class="bibtex booktitle">' + entry.booktitle;
            if ('series' in entry) {
                html_str += ' <span class="bibtex series">(' + entry.series + ')</span>';
            }
            html_str += '</i>, ';
        }
        if ('editor' in entry) {
            html_str += '<span class="bibtex editor">' + entry.editor + ', Ed</span>';
        }
        html_str += '.';
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>';
        }
        if ('publisher' in entry) {
            html_str += ': <span class="bibtex publisher">' + entry.publisher + '</span>, ';
        }
    } else if (entry['entrytype'] === 'booklet') {
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>, ';
        }
        if ('editor' in entry) {
            html_str += '<span class="bibtex editor">' + entry.editor + ', Ed</span>';
        }
        if ('publisher' in entry) {
            html_str += ': <span class="bibtex publisher">' + entry.publisher + '</span>.';
        }
    } else if (entry['entrytype'] === 'manual') {
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('edition' in entry) {
            html_str += '<span class="bibtex edition">' + entry.edition + '</span>, ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>, ';
        }
    } else if (entry['entrytype'] === 'proceedings') {
        if ('editor' in entry) {
            html_str += '<span class="bibtex editor">' + entry.editor + '</span>, ';
        }
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('volume' in entry) {
            html_str += '<span class="bibtex volume">vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += '</span>, ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>, ';
        }
        if ('publisher' in entry) {
            html_str += '<span class="bibtex publisher">' + entry.publisher + '</span>, ';
        }
    } else if (entry['entrytype'] === 'techreport') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('institution' in entry) {
            html_str += '<span class="bibtex institution">' + entry.institution + '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>, ';
        }
        if ('type' in entry) {
            html_str += '<span class="bibtex type">' + entry.type + '</span>, ';
        }
        if ('number' in entry) {
            html_str += '<span class="bibtex number">' + entry.number + '</span>, ';
        }
    } else if (entry['entrytype'] === 'unpublished') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>, ';
        }
    } else if (entry['entrytype'] === 'electronic') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>. ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>. ';
        }
    } else if (entry['entrytype'] === 'patent') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('nationality' in entry) {
            html_str += '<span class="bibtex nationality">' + entry.nationality + '</span> ';
        }
        if ('number' in entry) {
            html_str += '<span class="bibtex patent">Patent ' + entry.number + '</span>, ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>. ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>. ';
        }
    } else if (entry['entrytype'] === 'periodical') {
        if ('editor' in entry) {
            html_str += '<span class="bibtex editor">' + entry.editor + '</span>, ';
        }
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('series' in entry) {
            html_str += ' <span class="bibtex series">(' + entry.series + ')</span>, ';
        }
        if ('volume' in entry) {
            html_str += '<span class="bibtex volume">vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += '</span>, ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>. ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>. ';
        }
    } else if (entry['entrytype'] === 'standard') {
        if ('title' in entry) {
            html_str += '<i class="bibtex title">' + entry.title + '</i>. ';
        }
        if ('type' in entry) {
            html_str += '<span class="bibtex type">' + entry.type + '</span>, ';
        }
        if ('number' in entry) {
            html_str += '<span class="bibtex number">' + entry.number + '</span>, ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>. ';
        } else if ('institution' in entry) {
            html_str += '<span class="bibtex institution">' + entry.institution + '</span>. ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>. ';
        }
    } else if (entry['entrytype'] === 'misc') {
        if ('title' in entry) {
            html_str += '<span class="bibtex title">&ldquo;' + entry.title + ',&rdquo;</span> ';
        }
        if ('organization' in entry) {
            html_str += '<span class="bibtex organization">' + entry.organization + '</span>. ';
        } else if ('institution' in entry) {
            html_str += '<span class="bibtex institution">' + entry.institution + '</span>. ';
        }
        if ('address' in entry) {
            html_str += '<span class="bibtex address">' + entry.address + '</span>. ';
        }
        if ('note' in entry) {
            html_str += '<span class="bibtex note">' + entry.note + '</span>. ';
        }
    } else {
        html_str += '<b style="color: red;">Entry Type Not Implemented: ' + entry['entrytype'] + '</b>';
    }

    html_str += ('month' in entry) ? entry.month + ' ' : '';
    html_str += ('year' in entry) ? entry.year : '';
    if ('chapter' in entry && (entry['entrytype'] === 'inbook' || entry['entrytype'] === 'incollection')) {
        html_str += ', <span class="bibtex chapter">ch. ' + entry['chapter'] + '</span>';
    }
    if ('pages' in entry) {
        html_str += ', <span class="bibtex pages">pp. ' + entry['pages'] + '</span>';
    }
    if ('language' in entry) {
        html_str += '(in ' + entry['language'] + ')';
    }
    html_str += '.';

    if ('doi' in entry) {
        html_str += ' <span class="bibtex doi">DOI: <a href="http://dx.doi.org/' + entry.doi + '">' + entry.doi + '</a>.</span> ';
    }
    if ('url' in entry) {
        html_str += ' <span class="bibtex link"><a href="' + entry.url + '">' + entry.url + '</a>.</span> ';
    }

    return html_str;
}
