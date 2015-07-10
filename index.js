'use strict';

var nlf = require('nlf'),
    npa = require('npm-package-arg'),
    semver = require('semver');

module.exports = function (rootDir, opts, cb) {
    opts = opts || { };
    
    var whitelistLicenses = opts.licenses.reduce(function (acc, cur) {
        acc[cur.toLowerCase()] = cur;
        return acc;
    }, { });
    
    var whitelistPackages = opts.packages.reduce(function (acc, cur) {
        var parsed = npa(cur);
        acc[parsed.name] = parsed;
        return acc;
    }, { });
    
    
    nlf.find({
        directory: __dirname,
        depth: 0
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
        }
        
        // nlf's return data sucks, and the standard formatter does a lot more than just making it pretty
        // so instead we just call the formatter and parse the return data
        nlf.standardFormatter.render(data, function (err, output) {
            if (err) { cb(err); return; }
            
            var re = new RegExp(/(.*?@\d+\.[^ ]+) \[license\(s\): (.*)\]$/mg),
                match, candidates = [ ];
            
            while (( match = re.exec(output) )) {
                candidates.push(match);
            }
            
            candidates.forEach(function (match) {
                // get the first license in the whitelist that applies to this package
                var license = match[2].split(', ').reduce(function (acc, cur) {
                    return acc || (cur.toLowerCase() in whitelistLicenses ? cur : null);
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
                        PACKAGES[match[1]] = 'Whitelisted: ' + (target.rawSpec || '*');
                        return;
                    }
                }

                PACKAGES[match[1]] = match[2];
                INVALIDS.push(match[1]);
            });
            
            cb(null, {
                packages: PACKAGES,
                licenses: LICENSES,
                invalids: INVALIDS
            });
        });
    });
};
