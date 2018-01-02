import assert from 'assert';
import * as babel from 'babel-core';
import path from 'path';

function createOptions({
    preventFullImport = false,
    transform = 'react-bootstrap/lib/${member}',
    style = false,
    camelCase = false,
    kebabCase = false,
    snakeCase = false,
    skipDefaultConversion = false,
    libraryName = 'react-bootstrap'
}) {
    return {
        [libraryName]: { transform, style, preventFullImport, camelCase, kebabCase, snakeCase, skipDefaultConversion }
    };
};

const fullImportRegex = /require\('react-bootstrap'\);$/gm;
const memberImportRegex = /require\('react-bootstrap\/lib\/.+'\);$/gm;
const fullImportStyleRegex = /require\('react-bootstrap\/lib\/style\.css'\);$/gm;
const memberImportStyleRegex = /require\('react-bootstrap\/lib\/.+\/style\.css'\);$/gm;

function occurrences(regex, test) {
    return (test.match(regex) || []).length;
}

function transform(code, options = createOptions({})) {
    return babel.transform(code, {
        presets: ['es2015'],
        plugins: [['./index', options]]
    }).code;
}

describe('import transformations', function() {
    it('should handle default imports', function() {
        const code = transform(`import Bootstrap from 'react-bootstrap';`);

        assert.equal(occurrences(fullImportRegex, code), 1, 'number of full imports should be 1');
        assert.equal(occurrences(memberImportRegex, code), 0, 'number of member imports should be 0');
        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of member imports with style should be 0');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });

    it('should handle namespace imports', function() {
        const code = transform(`import * as Bootstrap from 'react-bootstrap';`);

        assert.equal(occurrences(fullImportRegex, code), 1, 'number of full imports should be 1');
        assert.equal(occurrences(memberImportRegex, code), 0, 'number of member imports should be 0');
        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of member imports with style should be 0');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });

    it('should handle member imports', function() {
        const code = transform(`import { Grid, Row as row } from 'react-bootstrap';`);

        assert.equal(occurrences(fullImportRegex, code), 0, 'number of full imports should be 0');
        assert.equal(occurrences(memberImportRegex, code), 2, 'number of member imports should be 2');
        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of member imports with style should be 0');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });

    it('should handle a mix of member and default import styles', function() {
        const code = transform(`import Bootstrap, { Grid, Row as row } from 'react-bootstrap';`);

        assert.equal(occurrences(fullImportRegex, code), 1, 'number of full imports should be 1');
        assert.equal(occurrences(memberImportRegex, code), 2, 'number of member imports should be 2');
        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of member imports with style should be 0');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });

    it('should handle relative filenames', function() {
        const libraryName = path.join(__dirname, '../local/path');
        const _transform = path.join(__dirname, '../local/path/${member}');
        const options = createOptions({ libraryName, transform: _transform })
        const code = transform(`import { LocalThing } from './local/path'`, options);

        assert.equal(/require\('.*LocalThing'\);$/m.test(code), true, 'LocalThing should be directly required');
    });
});

describe('style plugin option', function() {
    var defStyleOptions = createOptions({ style: true });
    it('should add style.css - default imports', function() {
        const code = transform(`import Bootstrap from 'react-bootstrap';`, defStyleOptions);

        assert.equal(occurrences(fullImportStyleRegex, code), 1, 'number of full imports with style should be 1');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });
    it('should add style.css - namespace imports', function() {
        const code = transform(`import * as Bootstrap from 'react-bootstrap';`, defStyleOptions);

        assert.equal(occurrences(fullImportStyleRegex, code), 1, 'number of full imports with style should be 1');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });
    it('should add each member style.css - member imports', function() {
        const code = transform(`import { Grid, Row as row } from 'react-bootstrap';`, defStyleOptions);

        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of full imports with style should be 0');
        assert.equal(occurrences(memberImportStyleRegex, code), 2, 'number of member imports with style should be 2');
    });
    it('should add each member index.css - member imports', function() {
        const code = transform(`import { Grid, Row as row } from 'react-bootstrap';`, createOptions({ style: 'index' }));

        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of full imports with style should be 0');
        assert.equal(occurrences(/require\('react-bootstrap\/lib\/.+\/index\.css'\);$/gm, code), 2, 'number of member imports with style should be 2');
    });
    it('should add full style.css but not add each member style.css - a mix of member and default import styles', function() {
        const code = transform(`import Bootstrap, { Grid, Row as row } from 'react-bootstrap';`, defStyleOptions);

        assert.equal(occurrences(fullImportStyleRegex, code), 1, 'number of full imports with style should be 1');
        assert.equal(occurrences(memberImportStyleRegex, code), 0, 'number of member imports with style should be 0');
    });

    it('should add style.css - relative filenames', function() {
        const libraryName = path.join(__dirname, '../local/path');
        const _transform = path.join(__dirname, '../local/path/${member}');
        const options = createOptions({ libraryName, transform: _transform, style: true });
        const code = transform(`import { LocalThing } from './local/path'`, options);

        assert.equal(/require\('.*LocalThing'\);$/m.test(code), true, 'LocalThing should be directly required');
        assert.equal(/require\('.*LocalThing\/style\.css'\);$/m.test(code), true, 'LocalThing style.css should be required too');
    });

    it('should ignore some style modules - member imports', function() {
        const options = createOptions({
            kebabCase: true,
            style: {
                ignore: ['row']
            }
        });
        const code = transform(`import { Style, Grid, Row as row } from 'react-bootstrap';`, options);

        assert.equal(occurrences(fullImportStyleRegex, code), 0, 'number of full imports with style should be 0');
        assert.equal(occurrences(/require\('react-bootstrap\/lib\/.+\/style\.css'\);$/gm, code), 2, 'number of member imports with style should be 2');
    });
});

describe('camelCase plugin option', function() {
    it('should use camel casing when set', function() {
        const options = createOptions({ camelCase: true });

        const code = transform(`import { CamelMe } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('camelMe'), -1, 'member name CamelMe should be transformed to camelMe');
    });
});

describe('kebabCase plugin option', function() {
    it('should use kebab casing when set', function() {
        const options = createOptions({ kebabCase: true });

        const code = transform(`import { KebabMe } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('kebab-me'), -1, 'member name KababMe should be transformed to kebab-me');
    });
    it('should use kebab casing when set - with style', function() {
        const options = createOptions({ kebabCase: true, style: true });

        const code = transform(`import { KebabMe } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('kebab-me'), -1, 'member name KababMe should be transformed to kebab-me');
        assert.notEqual(code.indexOf('kebab-me/style.css'), -1, 'member name KababMe should be transformed to kebab-me with style.css');
    });
    it('should use kebab casing when set - with style ignore', function() {
        const options = createOptions({
            kebabCase: true,
            style: {
                name: 'sty',
                ignore: ['kebab-other']
            }
        });

        const code = transform(`import { KebabMe, KebabOther } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('kebab-me'), -1, 'member name KababMe should be transformed to kebab-me');
        assert.notEqual(code.indexOf('kebab-other'), -1, 'member name KebabOther should be transformed to kebab-me');
        assert.notEqual(code.indexOf('kebab-me/sty.css'), -1, 'member name KababMe should be transformed to kebab-me with sty.css');
        assert.equal(code.indexOf('kebab-other/sty.css'), -1, 'member name KebabOther should be transformed to kebab-other without sty.css');
    });
});

describe('snakeCase plugin option', function() {
    it('should use snake casing when set', function() {
        const options = createOptions({ snakeCase: true });

        const code = transform(`import { SnakeMe } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('snake_me'), -1, 'member name SnakeMe should be transformed to snake_me');
    });
});

describe('transform as function', function() {
    it('should throw when provided filename is invalid', function() {
        const options = createOptions({ transform: 'missingFile.js' });

        assert.throws(() => {transform(`import { Row } from 'react-bootstrap';`, options)});
    });

    it('should throw when provided filename does not resolve to a function', function() {
        const options = createOptions({ transform: './test/invalidTransform.js' });

        assert.throws(() => {transform(`import { Row } from 'react-bootstrap';`, options)});
    });

    it('should properly execute transform function when provided', function() {
        const options = createOptions({ transform: './test/transform.js' });

        const code = transform(`import { upperCaseMe } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('UPPERCASEME'), -1, 'member name upperCaseMe should be transformed to UPPERCASEME');
    });

    it('should call the transform as a function when provided as so', function() {
        const options = createOptions({ transform: function(input) { return `path/${input}`; } });

        const code = transform(`import { somePath } from 'react-bootstrap';`, options);

        assert.notEqual(code.indexOf('path/somePath'), -1, 'function should transform somePath to path/somePath');
    });
});

describe('preventFullImport plugin option', function() {
    it('should throw on default imports when truthy', function() {
        const options = createOptions({ preventFullImport: true });

        assert.throws(() => {transform(`import Bootstrap from 'react-bootstrap';`, options)});
    });

    it('should throw on namespace imports when truthy', function() {
        const options = createOptions({ preventFullImport: true });

        assert.throws(() => {transform(`import * as Bootstrap from 'react-bootstrap';`, options)});
    });

    it('should not throw on member imports when truthy', function() {
        const options = createOptions({ preventFullImport: true });

        assert.doesNotThrow(() => {transform(`import { Grid, Row as row } from 'react-bootstrap';`, options)});
    });
});

describe('skipDefaultConversion plugin option', function() {
    it('should retain named import syntax when enabled', function() {
        const options = createOptions({ skipDefaultConversion: true });

        const code = transform(`import { Grid, Row as row } from 'react-bootstrap';`, options);

        assert.equal(code.indexOf('_interopRequireDefault'), -1, 'skipDefaultConversion should not allow conversion to default import');
    })
});

describe('edge cases', function() {
    it('should throw when transform plugin option is missing', function() {
        const options = createOptions({ transform: null });

        assert.throws(() => {transform(`import Bootstrap from 'react-bootstrap';`, options)});
    });
});
