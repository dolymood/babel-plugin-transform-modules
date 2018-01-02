# babel-plugin-transform-modules [![Build Status](https://travis-ci.org/dolymood/babel-plugin-transform-modules.svg?branch=master)](https://travis-ci.org/dolymood/babel-plugin-transform-modules?branch=master) [![codecov.io](http://codecov.io/github/dolymood/babel-plugin-transform-modules/coverage.svg?branch=master)](http://codecov.io/github/dolymood/babel-plugin-transform-modules?branch=master)

Fork from https://bitbucket.org/amctheatres/babel-transform-imports , and support import style files like [babel-plugin-component](https://github.com/QingWei-Li/babel-plugin-component).

Transforms member style imports:

```javascript
import { Dialog } from 'cube-ui'
```

...into default style imports:

```javascript
import Dialog from 'cube-ui/lib/dialog'
```

If set `style:true` config, then it will be transformed to:

```javascript
import Dialog from 'cube-ui/lib/dialog'
import 'cube-ui/lib/dialog/style.css'
```

Or set `style: "index"` config, then it will be transformed to:

```javascript
import Dialog from 'cube-ui/lib/dialog'
import 'cube-ui/lib/dialog/index.css'
```

## That's stupid, why would you do that?

When Babel encounters a member style import such as:

```javascript
import { Grid, Row, Col } from 'react-bootstrap';
```

it will generate something similarish to:

```javascript
var reactBootstrap = require('react-bootstrap');
var Grid = reactBootstrap.Grid;
var Row = reactBootstrap.Row;
var Col = reactBootstrap.Col;
```

Some libraries, such as react-bootstrap and lodash, are rather large and
pulling in the entire module just to use a few pieces would cause unnecessary
bloat to your client optimized (webpack etc.) bundle.  The only way around
this is to use default style imports:

```javascript
import Grid from 'react-bootstrap/lib/Grid';
import Row from 'react-bootstrap/lib/Row';
import Col from 'react-bootstrap/lib/Col';
```

But, the more pieces we need, the more this sucks.  This plugin will allow you
to pull in just the pieces you need, without a separate import for each item.
Additionally, it can be configured to throw when somebody accidentally writes
an import which would cause the entire module to resolve, such as:

```javascript
import Bootstrap, { Grid } from 'react-bootstrap';
// -- or --
import * as Bootstrap from 'react-bootstrap';
```

## Installation

```
npm install --save-dev babel-plugin-transform-modules
```

## Usage

*In .babelrc:*

```json
{
    "plugins": [
        ["transform-modules", {
            "cube-ui": {
                "transform": "cube-ui/lib/${member}",
                "preventFullImport": true
            }
        }]
    ]
}
```

## Advanced Transformations

In cases where the provided default string replacement transformation is not
sufficient (for example, needing to execute a RegExp on the import name), you
may instead provide a path to a .js file which exports a function to run
instead.  Keep in mind that the .js file will be `require`d relative from this
plugin's path, likely located in `/node_modules/babel-plugin-transform-modules`.
You may provide any filename, as long as it ends with `.js`.

.babelrc:
```json
{
    "plugins": [
        ["transform-modules", {
            "my-library": {
                "transform": "../../path/to/transform.js",
                "preventFullImport": true
            }
        }]
    ]
}
```

/path/to/transform.js:
```js
module.exports = function(importName, styleName, hasImportName) {
    if (styleName) {
        // set `style: true` option to transform style
        if (!hasImportName && importName === styleName) {
            // full import
            // eg: `import xx from 'my-library'`
            // will be transformed add `require('my-library/etc/style.css')`
            return 'my-library/etc/' + styleName + '.css'
        } else {
            // member import
            // eg: `import {xx} from 'my-library'`
            // will be transformed add `require('my-library/etc/XX/style.css')`
            return 'my-library/etc/' + importName.toUpperCase() + '/' + styleName + '.css'
        }
    }
    return 'my-library/etc/' + importName.toUpperCase();
};
```

This is a little bit hacky, but options are a bit limited due to .babelrc being
a JSON5 file which does not support functions as a type.  In Babel 7.0, it
appears .babelrc.js files will be supported, at which point this plugin will be
updated to allow transform functions directly in the configuration file.
See: https://github.com/babel/babel/pull/4892

## Webpack

This can be used as a plugin with babel-loader.

webpack.config.js:
```js
module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
            loader: 'babel-loader',
                query: {
                    plugins: [
                        [require('babel-plugin-transform-modules'), {
                            "my-library": {
                                "transform": function(importName) {
                                    return 'my-library/etc/' + importName.toUpperCase();
                                },
                                preventFullImport: true
                            }
                        }]
                    ]
                }
            }
        }
    ]
}
```

## Options

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `transform` | `string` | yes | `undefined` | The library name to use instead of the one specified in the import statement.  `${member}` will be replaced with the member, aka Grid/Row/Col/etc.  Alternatively, pass a path to a .js file which exports a function to process the transform (see Advanced Transformations) |
| `style` | `boolean,string,object` | no | `false` | Whether or not auto add css style import, if set to `true`, it will be same as set to `'style'`. If set to `{name:'sty',ignore:['x', 'y']}`, it means all member modules except `['x', 'y']` will be auto add css import with name 'sty.css' |
| `preventFullImport` | `boolean` | no | `false` | Whether or not to throw when an import is encountered which would cause the entire module to be imported. |
| `camelCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.camelCase. |
| `kebabCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.kebabCase. |
| `snakeCase` | `boolean` | no | `false` | When set to `true`, runs `${member}` through _.snakeCase. |
| `skipDefaultConversion` | `boolean` | no | `false` | When set to `true`, will preserve `import { X }` syntax instead of converting to `import X`. |
