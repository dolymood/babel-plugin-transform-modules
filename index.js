var camel = require('lodash.camelcase');
var kebab = require('lodash.kebabcase');
var snake = require('lodash.snakecase');
var pathLib = require('path');

function barf(msg) {
    throw new Error('babel-plugin-transform-modules: ' + msg);
}

function transform(transformOption, importName, styleName, hasImportName) {
    var isFunction = typeof transformOption === 'function';
    if (/\.js$/i.test(transformOption) || isFunction) {
        var transformFn;

        try {
            transformFn = isFunction ? transformOption : require(transformOption);
        } catch (error) {
            barf('failed to require transform file ' + transformOption);
        }

        if (typeof transformFn !== 'function') {
            barf('expected transform function to be exported from ' + transformOption);
        }

        return transformFn(importName, styleName, hasImportName);
    }
    if (styleName) {
        if (!hasImportName && importName === styleName) {
            importName += '.css'
        } else {
            importName += '/' + styleName + '.css'
        }
    }
    return transformOption.replace(/\$\{\s?member\s?\}/ig, importName);
}

function parseStyleOption(style) {
    var styleOption;
    if (style === true) {
        styleOption = {
            name: 'style',
            ignore: []
        };
    } else if (typeof style === 'string') {
        styleOption = {
            name: style,
            ignore: []
        };
    } else {
        styleOption = {
            name: style.name || 'style',
            ignore: style.ignore || []
        };
    }
    return styleOption;
}
function handleStyleImport(opts, styleTransforms, types, importName) {
    if (opts.style) {
        var styleOption = parseStyleOption(opts.style);
        var styleName = styleOption.name;
        var ignore = styleOption.ignore;
        var hasImportName = !!importName;
        if (!importName) {
            importName = styleName;
        }
        if (ignore.indexOf(importName) >= 0) {
            return
        }
        var replace = transform(opts.transform, importName, styleName, hasImportName);
        styleTransforms.push(types.importDeclaration([], types.stringLiteral(replace)))
    }
}

module.exports = function(babel) {
    var types = babel.types;
    return {
        visitor: {
            ImportDeclaration: function (path, state) {
                // https://github.com/babel/babel/tree/master/packages/babel-types#timportdeclarationspecifiers-source

                // path.node has properties 'source' and 'specifiers' attached.
                // path.node.source is the library/module name, aka 'react-bootstrap'.
                // path.node.specifiers is an array of ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier

                var source = path.node.source.value;

                // This block handles relative paths, such as ./components, ../../components, etc.
                if (!(source in state.opts) && source.match(/^\.{0,2}\//)) {
                    source = pathLib.resolve(pathLib.join(
                        source[0] === '/' ? '' : pathLib.dirname(state.file.opts.filename),
                        source
                    ));
                }

                if (source in state.opts) {
                    var opts = state.opts[source];

                    if (!opts.transform) {
                        barf('transform option is required for module ' + source);
                    }

                    var transforms = [];
                    var styleTransforms = [];

                    var fullImports = path.node.specifiers.filter(function(specifier) { return specifier.type !== 'ImportSpecifier' });
                    var memberImports = path.node.specifiers.filter(function(specifier) { return specifier.type === 'ImportSpecifier' });

                    if (fullImports.length > 0) {
                        // Examples of "full" imports:
                        //      import * as name from 'module'; (ImportNamespaceSpecifier)
                        //      import name from 'module'; (ImportDefaultSpecifier)

                        if (opts.preventFullImport) {
                            barf('import of entire module ' + source + ' not allowed due to preventFullImport setting');
                        }

                        if (memberImports.length > 0) {
                            // Swap out the import with one that doesn't include member imports.  Member imports should each get their own import line
                            // transform this:
                            //      import Bootstrap, { Grid } from 'react-bootstrap';
                            // into this:
                            //      import Bootstrap from 'react-bootstrap';
                            transforms.push(types.importDeclaration(fullImports, types.stringLiteral(source)));
                        }
                        handleStyleImport(opts, styleTransforms, types);
                    }
                    var hasFullStyleImports = styleTransforms.length > 0
                    memberImports.forEach(function(memberImport) {
                        // Examples of member imports:
                        //      import { member } from 'module'; (ImportSpecifier)
                        //      import { member as alias } from 'module' (ImportSpecifier)

                        // transform this:
                        //      import { Grid as gird } from 'react-bootstrap';
                        // into this:
                        //      import gird from 'react-bootstrap/lib/Grid';
                        // or this, if skipDefaultConversion = true:
                        //      import { Grid as gird } from 'react-bootstrap/lib/Grid';

                        var importName = memberImport.imported.name;
                        if (opts.camelCase) importName = camel(importName);
                        if (opts.kebabCase) importName = kebab(importName);
                        if (opts.snakeCase) importName = snake(importName);

                        var replace = transform(opts.transform, importName);

                        var newImportSpecifier = (opts.skipDefaultConversion)
                            ? memberImport
                            : types.importDefaultSpecifier(types.identifier(memberImport.local.name));

                        transforms.push(types.importDeclaration(
                            [newImportSpecifier],
                            types.stringLiteral(replace)
                        ));
                        !hasFullStyleImports && handleStyleImport(opts, styleTransforms, types, importName);
                    });

                    if (transforms.length > 0) {
                        path.replaceWithMultiple(transforms.concat(styleTransforms));
                    } else if (styleTransforms.length) {
                        path.insertAfter(styleTransforms);
                    }
                }
            }
        }
    }
}
