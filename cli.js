#!/usr/bin/env node

'use strict';

var yargs = require('yargs')
    .usage('Usage: $0 [dirname] [options]')
    .boolean('h')
    .alias('h', 'help')
    .describe('h', 'Show help.')
    .boolean('q')
    .alias('q', 'quiet')
    .describe('q', 'Don\'t output anything.')
    .boolean('v')
    .alias('v', 'verbose')
    .describe('v', 'Detailed list of package licenses.')
    .nargs('dir', 1)
    .describe('dir', 'Base directory of package to validate. Defaults to current working directory.')
    .array('allow-licenses')
    .describe('allow-licenses', 'A list of licenses to allow. Validation will fail if a package is present that is not licensed under any of the licenses in this list.')
    .array('allow-packages')
    .describe('allow-packages', 'A list of packages to allow. Can be used to allow packages for which the license is not detected correctly (can happen with old package.json formats). Optionally may use package.json-style semver directives to match a version or range of versions.')
    .example('$0 ~/project --allow-licenses WTFPL ISC MIT', 'Allow the WTFPL, ISC, and MIT licenses.')
    .example('$0 ~/project --allow-packages convict', 'Allow the package \'convict\'.')
    .example('$0 ~/project --allow-packages pg@^3.6.0', 'Allow the package \'pg\' (3.6.0 and up, but not 4.0.0 or higher).')
;

yargs.wrap(Math.max(120), yargs.terminalWidth());

var argv = yargs.argv;

if (argv.h) {
    yargs.showHelp();
    process.exit(2);
}

var DIR = argv.dir || argv._[0] || process.cwd(),
    QUIET = argv.q,
    VERBOSE = !argv.q && argv.v;

var log = (QUIET? function () { } : console.log);

function stringsort(a, b) {
    if (a < b) { return -1; }
    if (a > b) { return 1; }
    return 0;
}

require('./index')(DIR, {
    licenses: argv['allow-licenses'] || [ ],
    packages: argv['allow-packages'] || [ ]
}, function (err, res) {
    if (err) {
        console.error('\nError: %s\n', err.message);
        yargs.showHelp();
        process.exit(2);
    }
    
    var LICENSES = res.licenses,
        PACKAGES = res.packages,
        INVALIDS = res.invalids;
    
    if (INVALIDS.length) {
        INVALIDS.forEach(function (pkg) {
            var lic = PACKAGES[pkg];
            log('Invalid license: %s: %s', pkg, lic);
        });
        process.exit(1);
    }
    
    if (QUIET) { return; }
    
    log('Identified licenses: %s', LICENSES);
    
    if (VERBOSE) {
        Object.keys(PACKAGES)
        .sort(stringsort)
        .forEach(function (pkg) {
            console.log('- %s: %s', pkg, PACKAGES[pkg]);
        });
    }
    
    log('All licenses ok.');
});
