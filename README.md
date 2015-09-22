# Node-license-validator

This module is a programmatic and command line tool to help you validate the licenses of your dependencies against an allowed list. It is suitable for use in a build process. It utilizes [nlf](https://www.npmjs.com/packages/nlf), [semver](https://www.npmjs.com/packages/semver), and [spdx](https://www.npmjs.com/packages/spdx).

# Installation

### Global command

    npm install -g node-license-validator

### Package local

    npm install --save node-license-validator

For easy access, modify `package.json` to include it as a script:

    {
      "scripts": {
        "nlv": "node-license-validator"
      }
    }

And run it with `npm run nlv -- --allow-licenses [etc]`. Note that you need `npm` >= 2.0 to pass arguments in this way to scripts.

# Command line usage

Courtesy of [yargs](https://www.npmjs.com/packages/yargs):

    Usage: node-license-validator [dirname] [options]

    Options:
      -h, --help        Show help.                                                                                                     [boolean]
      -q, --quiet       Don't output anything.                                                                                         [boolean]
      -v, --verbose     Detailed list of package licenses.                                                                             [boolean]
      --dir             Base directory of package to validate. Defaults to current working directory.
      --list-licenses   Don't validate; just list the licenses in use.                                                                 [boolean]
      --warn            Only print invalid licenses, don't exit with error                                            [boolean] [default: false]
      --allow-licenses  A list of licenses to allow. Validation will fail if a package is present that is not licensed under any of the licenses
                        in this list.                                                                                                    [array]
      --allow-packages  A list of packages to allow. Can be used to allow packages for which the license is not detected correctly (can happen
                        with old package.json formats). Optionally may use package.json-style semver directives to match a version or range of
                        versions.                                                                                                        [array]
      -d, --deep        Perform a deep search against all sub-dependencies.                                           [boolean] [default: false]
      -p, --production  Only traverse dependencies, no dev-dependencies                                               [boolean] [default: false]

    Examples:
      node-license-validator ~/project --allow-licenses WTFPL ISC MIT  Allow the WTFPL, ISC, and MIT licenses.
      node-license-validator ~/project --allow-packages convict        Allow the package 'convict'.
      node-license-validator ~/project --allow-packages pg@^3.6.0      Allow the package 'pg' (3.6.0 and up, but not 4.0.0 or higher).



Sample successful output:

    $ node-license-validator --allow-licenses ISC MIT BSD-3-Clause
    Identified licenses: BSD-3-Clause,ISC,MIT
    All licenses ok.

Verbose output:

    $ node-license-validator -v --allow-licenses ISC MIT BSD-3-Clause
    Identified licenses: BSD-3-Clause,ISC,MIT
    - istanbul@0.3.17: BSD-3-Clause
    - jshint@2.8.0: MIT
    - mocha@2.2.5: MIT
    - nlf@1.3.1: MIT
    - node-license-validator@1.0.0: ISC
    - npm-package-arg@4.0.1: ISC
    - semver@4.3.6: ISC
    - should@7.0.2: MIT
    - spdx@0.4.1: MIT
    - yargs@3.15.0: MIT
    All licenses ok.

Failure output:

    $ node-license-validator -v --allow-licenses ISC MIT
    Invalid license: istanbul@0.3.17: BSD-3-Clause

# Exit codes

`node-license-validator` exits with a 0 on success, a 1 on license failure, and a 2 on an error.

# Programmatic usage

All arguments are required (including the licenses and packages arrays, even if empty)

    var nlv = require('node-license-validator');
    nlv(packageDir, {
        licenses: [ 'MIT', 'ISC' ],
        packages: [ ]
    }, function (err, data) {
        // ...
    });

`data` will contain an object that looks like this:

    {
        packages: {
            'foo@1.0.0': 'BSD-3-Clause, Apache-2.0',
            'bar@1.2.3': 'MIT',
            'baz@0.0.9': 'ISC'
        },
        licenses: [ 'MIT', 'ISC' ],
        invalids: [ 'foo@1.0.0' ]
    }

`packages` contains an object mapping the exact module names and versions that are installed to the licenses they specify. If `node-license-validator` was unable to validate a module's license(s), the license string will include any and all possible licenses that could be found (by `nlf`) for that module. If a module *was* valid, the license string will be the first license or spdx rule that was acceptable.

`licenses` is just a convenience that collects the set of distinct licenses represented by the target module's dependencies.

`invalids` contains a list of module references for all dependencies that failed to validate.

# Specifying licenses

This is fairly straightforward but there are some details. `node-license-validator` first attempts to interpret allowed licenses as [spdx license IDs](https://spdx.org/licenses/), as expected by [the latest package.json documentation](https://docs.npmjs.com/files/package.json#license). When the inspected dependency's `license` specification is a valid SPDX license expression, and at least one of the allowed licenses is a valid SPDX license ID, they are compared to determine compatibility.

If the SPDX check fails, a plain string comparison is attempted between the dependency's specified license(s) and the complete list of allowed licenses.

If both license checks fail, the dependency is checked against the exceptions (below); if this check also fails, the dependency fails validation.

Caveat: if `nlv` cannot determine any license for a package, it will specify the license as `Unknown`. It is valid to add this as an acceptable license, but not advisable.

# Specifying exceptions

If for some reason `nlv` is unable to parse a module's `package.json`, or if you want to allow a specific module without allowing its license globally, you may specify allowed packages individually. You do this with the `--allow-packages` command line switch or the `packages` options key. Allowed packages are strings that contain either a package name or an `npm install`-compatible package specification. For example, you can specify `pg@^3.6.0` or `convict` or `@scope/private-module`. 
