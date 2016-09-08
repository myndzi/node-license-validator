'use strict';

var fs = require('fs'),
    npa = require('npm-package-arg'),
    satisfies = require('spdx-satisfies'),
    validate = require('spdx-expression-validate'),
    semver = require('semver'),
    format = require('util').format;

/* istanbul ignore next */
function stringsort(a, b) {
    if (a < b) { return -1; }
    if (a > b) { return 1; }
    return 0;
}

function validateArgs(rootDir, opts, cb) { // jshint maxcomplexity: 12
    function fail(err) {
        if (typeof cb === 'function') { cb(err); }
        else { throw err; }
        return true;
    }
    if (typeof rootDir !== 'string') {
        return fail(Error('nlf-validator: invalid rootDir: ' + rootDir));
    }
    
    try {
        var stat = fs.statSync(rootDir);
        if (!stat.isDirectory()) {
            return fail(new Error('nlf-validator: not a directory: ' + rootDir));
        }
    } catch (e) {
        return fail(new Error('nlf-validator: invalid rootDir: ' + rootDir + ': ' + e.message));
    }
    
    if (!opts || typeof opts !== 'object') {
        return fail(new Error('nlf-validator: invalid options: ' + opts));
    }
    
    if (!cb || typeof cb !== 'function') {
        return fail(new Error('nlf-validator: no callback specified'));
    }
    
    if (opts.listOnly) { return; }
    
    if ( (!Array.isArray(opts.licenses) ? 0 : opts.licenses.length) +
         (!Array.isArray(opts.packages) ? 0 : opts.packages.length) === 0 )
    {
        return fail(new Error('nlf-validator: no licenses or packages specified'));
    }
}
module.exports = function (rootDir, opts, cb) {
    if (validateArgs(rootDir, opts, cb)) { return; }
    
    var warn = opts.warn || function () { };
    
    var nlf = opts.__nlf || require('nlf');

    opts.licenses = opts.licenses || [ ];
    opts.packages = opts.packages || [ ];
    
    var whitelistLicenses = opts.licenses.reduce(function (acc, cur) {
        acc[cur.toLowerCase()] = cur;
        return acc;
    }, { });
    
    // not all of the licenses we specify might be valid spdx identifiers
    // but when we are comparing licenses, package.json may specify spdx expressions
    // so we need to construct something to compare against spdx expressions
    // our comparison must contain only valid identifiers
    
    // we build a string like (MIT OR ISC OR JSON OR BSD-3-Clause) with all the licenses
    // we have deemed acceptable; if a package has an 'AND' specification, it will validate
    // correctly as long as we specify both parts
    var whitelistSPDX = '(' + opts.licenses.filter(validate).join(' OR ') + ')';
    
    var whitelistPackages = opts.packages.reduce(function (acc, cur) {
        var parsed = npa(cur);
        var pkg = parsed.name;
        if (acc.hasOwnProperty(pkg)) {
            warn(pkg + ' is specified more than once in allowed packages. Use the SPDX `||` operator to specify multiple versions of a single package.');
        }
        if (parsed.rawSpec === '') {
          parsed.spec = '*';
        }
        acc[pkg] = parsed;
        return acc;
    }, { });
    
    
    nlf.find({
        directory: rootDir,
        depth: opts.deep ? Infinity : 0,
        production: !!opts.production
    }, function (err, data) {
        if (err) { cb(err); return; }
        
        var PACKAGES = { },
            LICENSES = { },
            INVALIDS = [ ];
        
        if (!data || !Array.isArray(data)) {
            cb(new Error('NLF returned invalid data'));
            return;
        }

        if (data.length === 0) {
            cb(new Error('NLF found no licenses'));
            return;
        }
        
        // nlf's return data sucks, and the standard formatter does a lot more than just making it pretty
        // so instead we just call the formatter and parse the return data
        nlf.standardFormatter.render(data, {}, function (err, output) {
            if (err) { cb(err); return; }
            
            var re = new RegExp(/(.*?@\d+\.[^ ]+) \[license\(s\): (.*)\]$/mg),
                match, packages = [ ], seenPackages = { };
            
            while (( match = re.exec(output) )) {
                packages.push(match);
            }
            
            packages.forEach(function (match) {
                // get the first license in the whitelist that applies to this package
                
                var pkgName = npa(match[1]).name.toLowerCase();
                seenPackages[pkgName] = 1;
                
                var license = match[2].split(', ').reduce(function (acc, cur) {
                    if (acc) { return acc; }
                    
                    // if the license from the file is a valid spdx expression,
                    // compare it against our spdx whitelist expression
                    if (validate(cur) && validate(whitelistSPDX) && satisfies(cur, whitelistSPDX)) {
                        return cur;
                    }
                    
                    // otherwise do a simple string comparison
                    if (cur.toLowerCase() in whitelistLicenses) {
                        return cur;
                    }
                    
                    return null;
                }, null);
                
                if (license !== null) {
                    PACKAGES[match[1]] = license;
                    LICENSES[license] = (LICENSES[license] || 0) + 1;
                    return;
                }
                
                var parsed = npa(match[1]);
                
                if (parsed.spec && parsed.name in whitelistPackages) {
                    var target = whitelistPackages[parsed.name],
                        spec = parsed.spec.replace(/[-+].*/, ''); // semver won't match '*' against prerelease versions
                    
                    if (semver.satisfies(spec, target.spec)) {
                        PACKAGES[match[1]] = format('%s (exception: %s)', match[2], target.raw);
                        return;
                    }
                }

                LICENSES[match[2]] = (LICENSES[match[2]] || 0) + 1;
                PACKAGES[match[1]] = match[2];
                INVALIDS.push(match[1]);
            });
            
            var unseenPackages = Object.keys(whitelistPackages).reduce(function (acc, cur) {
                if (!seenPackages[cur]) { acc.push(cur); }
                return acc;
            }, [ ]);
            
            if (unseenPackages.length) {
                warn('Packages were listed as exceptions but not found in the project: ' + unseenPackages.join(', '));
            }
            
            cb(null, {
                packages: PACKAGES,
                licenses: Object.keys(LICENSES).sort(stringsort),
                invalids: INVALIDS
            });
        });
    });
};
