'use strict';

var fs = require('fs'),
    npa = require('npm-package-arg'),
    spdx = require('spdx'),
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
    
    if ( (!Array.isArray(opts.licenses) ? 0 : opts.licenses.length) +
         (!Array.isArray(opts.packages) ? 0 : opts.packages.length) === 0 )
    {
        return fail(new Error('nlf-validator: no licenses or packages specified'));
    }
    
    if (!cb || typeof cb !== 'function') {
        return fail(new Error('nlf-validator: no callback specified'));
    }
}
module.exports = function (rootDir, opts, cb) {
    if (validateArgs(rootDir, opts, cb)) { return; }
    
    var nlf = opts.__nlf || require('nlf');
    
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
    var whitelistSPDX = '(' + opts.licenses.filter(spdx.valid).join(' OR ') + ')';
    
    var whitelistPackages = opts.packages.reduce(function (acc, cur) {
        var parsed = npa(cur);
        acc[parsed.name] = parsed;
        return acc;
    }, { });
    
    
    nlf.find({
        directory: rootDir,
        depth: typeof opts.depth === 'undefined' ? 1 : opts.depth,
        production: typeof opts.production === 'undefined' ? false : opts.production
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
        nlf.standardFormatter.render(data, function (err, output) {
            if (err) { cb(err); return; }
            
            var re = new RegExp(/(.*?@\d+\.[^ ]+) \[license\(s\): (.*)\]$/mg),
                match, packages = [ ];
            
            while (( match = re.exec(output) )) {
                packages.push(match);
            }
            
            packages.forEach(function (match) {
                // get the first license in the whitelist that applies to this package
                
                var license = match[2].split(', ').reduce(function (acc, cur) {
                    if (acc) { return acc; }
                    
                    // if the license from the file is a valid spdx expression,
                    // compare it against our spdx whitelist expression
                    if (spdx.valid(cur) && spdx.valid(whitelistSPDX) && spdx.satisfies(cur, whitelistSPDX)) {
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
                    var target = whitelistPackages[parsed.name];
                    if (semver.satisfies(parsed.spec, target.spec)) {
                        PACKAGES[match[1]] = format('%s (exception: %s)', match[2], target.raw);
                        return;
                    }
                }

                PACKAGES[match[1]] = match[2];
                INVALIDS.push(match[1]);
            });
            
            cb(null, {
                packages: PACKAGES,
                licenses: Object.keys(LICENSES).sort(stringsort),
                invalids: INVALIDS
            });
        });
    });
};
