var parse = require('bib2json');
var extname = require('path').extname;
var basename = require('path').basename;
var dirname = require('path').dirname;
var handlebars = require("handlebars");

/**
 * Adds information from bibtex files to the global context and defines a set
 * of handlebars helpers for citing and printing bibliographies
 *
 * @param  {Object} options - module options
 */
module.exports = function(options) {
    'use strict';

    var keys = Object.keys(options.collections);

    return function(files, metalsmith, done) {

        var meta = metalsmith.metadata()
        meta.bibtex = {};

        // Check for bibtex files and register them in collections
        Object.keys(files).forEach(function(file) {
            if (!bibtex(file)) return;
            var bibdata_raw = parse(files[file].contents.toString());
            var bibdata = {};
            bibdata_raw.entries.forEach(function(entry) {
                bibdata[entry.EntryKey] = entry.Fields;
                bibdata[entry.EntryKey]['type'] = entry.EntryType;
            })
            for (let i in keys) {
                if (options.collections[keys[i]] === file) {
                    meta.bibtex[keys[i]] = bibdata;
                }
            }
            delete files[file];
        });

        // available styles: default, ieeetr
        meta.bibtex.styles = {
            'default': 'default',
            'ieeetr': 'ieeetr'
        };

        // Register style for bibliography
        // available: 'ieeetr' (default)
        meta.bibtex.style = ('style' in options) ? options['style'] : 'default';

        // Register type of inline citation (numbered vs citekey)
        meta.bibtex.numbered = ('numbered' in options) ? options['numbered'] : false;

        // Register key of the default collection
        meta.bibtex.default = ('default' in options) ? options['default'] : keys[0];

        // Handlebar Helper for inline citations
        // all cited articles on a page are stored in 'citations'
        handlebars.registerHelper('bibcite', function(bibfile, opt) {
            if (opt === undefined) {
                opt = bibfile;
                bibfile = meta.bibtex[meta.bibtex.default]
                if (bibfile === undefined) {
                    throw "metalsmith-bibtex Error: Cannot find bibtex colection";
                }
            } else if (bibfile === undefined) {
                throw "metalsmith-bibtex Error: Cannot find bibtex colection";
            }
            if (!('citations' in opt.data.root)) {
                opt.data.root['citations'] = {};
            }
            var citekeys = opt.fn(this).split(' ');
            var html_str = '[' +
                citekeys.map(function(entry) {
                    if (entry in bibfile) {
                        opt.data.root['citations'][entry] = bibfile[entry];
                        if (meta.bibtex.numbered) {
                            return '<a href="#bibentry_' + entry + '">' + Object.keys(opt.data.root['citations']).length + '</a>';
                        } else {
                            return '<a href="#bibentry_' + entry + '">' + entry + '</a>';
                        }
                    } else {
                        opt.data.root['citations'][entry] = {};
                        if (meta.bibtex.numbered) {
                            return '<a href="#bibentry_' + entry + '" style="color: red;">XX</a>';
                        } else {
                            return '<a href="#bibentry_' + entry + '" style="color: red;">' + entry + '</a>';
                        }
                    }

                }).join(', ') +
                ']';
            return new handlebars.SafeString(html_str);
        });

        // Handlebar Helper for formatting bibliographic entries
        handlebars.registerHelper('bibformat', function(entry, opt) {
            if (opt === undefined) {
                throw "metalsmith-bibtex Error: Cannot format without argument";
            }
            if (entry === undefined) {
                return;
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
 * Render a bibtex entry as HTML
 *
 * @param {Object} entry - bibtex entry object
 * @param {string} style - Latex style to used for renderring
 * @return {string}
 */
function bibtexRenderHtml(entry, style) {
    if (style === 'default') {
        return bibtexRenderHtmlDefault(entry);
    } else if (style === 'ieeetr') {
        return bibtexRenderHtmlIeeetr(entry);
    } else {
        throw "Style not implemented"
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
                var lastName = author.split(', ')[0]
                var firstName = author.split(', ')[1]
                return firstName + ' ' + lastName;
            } else {
                return author;
            }
        });
        if (authors.length > 1) {
            authors = authors.slice(0, -1)
                .reduceRight(function(previousValue, currentValue, currentIndex) {
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
            if (namespl.length == 2) {
                var lastName = author.split(', ')[0]
                var firstName = author.split(', ')[1]
                return firstName[0] + '. ' + lastName;
            } else if (namespl.length == 1) {
                var namespldot = author.split('.');
                if (namespldot.length > 1) {
                    var firstName = namespldot.slice(0, -1).join('.') + '.';
                    firstName = firstName.split(' ').map(function(elt) {
                        return elt[0] + '.';
                    }).join(' ');
                    var lastName = namespldot.slice(-1)[0];
                    return firstName + lastName;
                } else {
                    var firstName = author.split(' ').slice(0, -1).map(function(elt) {
                        return elt[0] + '.';
                    }).join(' ');
                    var lastName = author.split(' ').slice(-1)[0];
                    return firstName + lastName;
                }
            } else {
                return author;
            }
        });
        if (authors.length > 1) {
            authors = authors.slice(0, -1)
                .reduceRight(function(previousValue, currentValue, currentIndex) {
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
    var html_str = (authors === '') ? '' : authors + ', ';

    if (entry['type'] === 'article') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('journal' in entry) {
            html_str += '<i>' + entry.journal + '</i>, ';
        }
        if ('volume' in entry) {
            html_str += 'vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += ', ';
        }
    } else if (entry['type'] === 'inproceedings') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('booktitle' in entry) {
            html_str += 'in <i>' + entry.booktitle;
            if ('series' in entry) {
                html_str += ' (' + entry.series + ')';
            }
            html_str += '</i>, ';
        }
        if ('volume' in entry) {
            html_str += 'vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
        if ('publisher' in entry) {
            html_str += entry.publisher + ', ';
        }
    } else if (entry['type'] === 'book') {
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('address' in entry) {
            html_str += entry.address;
        }
        if ('publisher' in entry) {
            html_str += ': ' + entry.publisher + '.';
        }
    } else if (entry['type'] === 'phdthesis') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('type' in entry) {
            html_str += entry.type + ', ';
        } else {
            html_str += 'PhD Dissertation, ';
        }
        if ('school' in entry) {
            html_str += entry.school;
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
        if ('publisher' in entry) {
            html_str += ': ' + entry.publisher + '.';
        }
    } else if (entry['type'] === 'mastersthesis') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('type' in entry) {
            html_str += entry.type + ', ';
        } else {
            html_str += "Master's Thesis, ";
        }
        if ('school' in entry) {
            html_str += entry.school;
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
        if ('publisher' in entry) {
            html_str += ': ' + entry.publisher + '.';
        }
    } else if (entry['type'] === 'inbook' || entry['type'] === 'incollection') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('booktitle' in entry) {
            html_str += 'in <i>' + entry.booktitle;
            if ('series' in entry) {
                html_str += ' (' + entry.series + ')';
            }
            html_str += '</i>, ';
        }
        if ('editor' in entry) {
            html_str += entry.editor + ', Ed';
        }
        html_str += '.';
        if ('address' in entry) {
            html_str += entry.address;
        }
        if ('publisher' in entry) {
            html_str += ': ' + entry.publisher + ', ';
        }
    } else if (entry['type'] === 'booklet') {
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('address' in entry) {
            html_str += entry.address;
        }
        if ('editor' in entry) {
            html_str += entry.editor + ', Ed';
        }
        if ('publisher' in entry) {
            html_str += ': ' + entry.publisher + '.';
        }
    } else if (entry['type'] === 'manual') {
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('edition' in entry) {
            html_str += entry.edition + ', ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
    } else if (entry['type'] === 'proceedings') {
        if ('editor' in entry) {
            html_str += entry.editor + ', ';
        }
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('volume' in entry) {
            html_str += 'vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += ', ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
        if ('publisher' in entry) {
            html_str += entry.publisher + ', ';
        }
    } else if (entry['type'] === 'techreport') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('institution' in entry) {
            html_str += entry.institution + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + ', ';
        }
        if ('type' in entry) {
            html_str += entry.type + ', ';
        }
        if ('number' in entry) {
            html_str += entry.number + ', ';
        }
    } else if (entry['type'] === 'unpublished') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('note' in entry) {
            html_str += entry.note + ', ';
        }
    } else if (entry['type'] === 'electronic') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + '. ';
        }
        if ('note' in entry) {
            html_str += entry.note + '. ';
        }
    } else if (entry['type'] === 'patent') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('nationality' in entry) {
            html_str += entry.nationality + ' ';
        }
        if ('number' in entry) {
            html_str += 'Patent ' + entry.number + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + '. ';
        }
        if ('note' in entry) {
            html_str += entry.note + '. ';
        }
    } else if (entry['type'] === 'periodical') {
        if ('editor' in entry) {
            html_str += entry.editor + ', ';
        }
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('series' in entry) {
            html_str += ' (' + entry.series + '), ';
        }
        if ('volume' in entry) {
            html_str += 'vol. ' + entry.volume;
            if ('number' in entry) {
                html_str += ', no. ' + entry.number;
            }
            html_str += ', ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + '. ';
        }
        if ('note' in entry) {
            html_str += entry.note + '. ';
        }
    } else if (entry['type'] === 'standard') {
        if ('title' in entry) {
            html_str += '<i>' + entry.title + '</i>. ';
        }
        if ('type' in entry) {
            html_str += entry.type + ', ';
        }
        if ('number' in entry) {
            html_str += entry.number + ', ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + '. ';
        } else if ('institution' in entry) {
            html_str += entry.institution + '. ';
        }
        if ('note' in entry) {
            html_str += entry.note + '. ';
        }
    } else if (entry['type'] === 'misc') {
        if ('title' in entry) {
            html_str += '&ldquo;' + entry.title + ',&rdquo; ';
        }
        if ('organization' in entry) {
            html_str += entry.organization + ', ';
        } else if ('institution' in entry) {
            html_str += entry.institution + ', ';
        }
        if ('address' in entry) {
            html_str += entry.address + '. ';
        }
        if ('note' in entry) {
            html_str += entry.note + '. ';
        }
    } else {
        html_str += '<b style="color: red;">Entry Type Not Implemented: ' + entry['type'] + '</b>';
    }

    html_str += ('month' in entry) ? entry.month + ' ' : '';
    html_str += ('year' in entry) ? entry.year : '';
    if ('chapter' in entry && (entry['type'] === 'inbook' || entry['type'] === 'incollection')) {
        html_str += ', ch. ' + entry['chapter'];
    }
    if ('pages' in entry) {
        html_str += ', pp. ' + entry['pages'];
    }
    if ('language' in entry) {
        html_str += '(in ' + entry['language'] + ')';
    }
    html_str += '.';

    if ('doi' in entry) {
        html_str += ' DOI: <a href="http://dx.doi.org/' + entry.doi + '">' + entry.doi + '</a>.';
    }
    if ('url' in entry) {
        html_str += ' <a href="' + entry.url + '">' + entry.url + '</a>.';
    }

    return html_str;
}
