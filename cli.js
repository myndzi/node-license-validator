#!/usr/bin/env node

'use strict';

var cmd = require('path').basename(process.argv[1]);

var yargs = require('yargs')
    .usage('Usage: '+cmd+' [dirname] [options]')
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
    .boolean('deep')
    .alias('d', 'deep')
    .describe('deep', 'Perform a deep search against all sub-dependencies.')
    .default('deep', false)
    .alias('l', 'list-licenses')
    .boolean('list-licenses')
    .describe('list-licenses', 'Don\'t validate; just list the licenses in use.')
    .boolean('warn')
    .describe('warn', 'Only print invalid licenses, don\'t exit with error')
    .default('warn', false)
    .boolean('production')
    .alias('p', 'production')
    .describe('production', 'Only traverse dependencies, no dev-dependencies')
    .default('p', false)
    .config('config')
    .alias('c', 'config')
    .default('config', 'node-license-validator.json')
    .array('allow-licenses')
    .describe('allow-licenses', 'A list of licenses to allow. Validation will fail if a package is present that is not licensed under any of the licenses in this list.')
    .array('allow-packages')
    .describe('allow-packages', 'A list of packages to allow. Can be used to allow packages for which the license is not detected correctly (can happen with old package.json formats). Optionally may use package.json-style semver directives to match a version or range of versions.')
    .example(cmd+' ~/project --allow-licenses WTFPL ISC MIT', 'Allow the WTFPL, ISC, and MIT licenses.')
    .example(cmd+' ~/project --allow-packages convict', 'Allow the package \'convict\'.')
    .example(cmd+' ~/project --allow-packages pg@^3.6.0', 'Allow the package \'pg\' (3.6.0 and up, but not 4.0.0 or higher).')
;

yargs.wrap(Math.max(140), yargs.terminalWidth());

var argv = yargs.argv;

if (argv.h) {
    yargs.showHelp();
    process.exit(2);
}

var DIR = argv.dir || argv._[0] || process.cwd(),
    QUIET = !argv['list-licenses'] && argv.q,
    VERBOSE = !argv.q && argv.v;

var log = (QUIET? function () { } : console.log);

function stringsort(a, b) {
    if (a < b) { return -1; }
    if (a > b) { return 1; }
    return 0;
}

var warn = QUIET ? function () { } : console.warn.bind(console, 'WARN:');

require('./index')(DIR, {
    licenses: argv['allow-licenses'] || [ ],
    packages: argv['allow-packages'] || [ ],
    listOnly: !!argv['list-licenses'],
    deep: !!argv['deep'],
    production: argv['production'],
    warn: warn
}, function (err, res) {
    if (err) {
        console.error('\nError: %s\n', err.message);
        yargs.showHelp();
        process.exit(2);
    }
    
    var LICENSES = res.licenses,
        PACKAGES = res.packages,
        INVALIDS = res.invalids,
        LIST_ONLY = !!argv['list-licenses'];
    
    if (!QUIET) {
        var list = LICENSES.map(function (a) {
            if (/,/.test(a)) { return '[' + a + ']'; }
            return a;
        }).join(', ');
        log('Identified licenses: %s', list);
    }
    
    if (!LIST_ONLY && INVALIDS.length) {
        INVALIDS.forEach(function (pkg) {
            var lic = PACKAGES[pkg];
            log('Invalid license: %s: %s', pkg, lic);
        });
        process.exit(argv.warn ? 0 : 1);
    }
    
    if (VERBOSE) {
        Object.keys(PACKAGES)
        .sort(stringsort)
        .forEach(function (pkg) {
            console.log('- %s: %s', pkg, PACKAGES[pkg]);
        });
    }
    
    if (!LIST_ONLY && !QUIET) {
        log('All licenses ok.');
    }
});
