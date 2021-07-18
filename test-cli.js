'use strict';

const Runner = require('./test-cli-runner');
const runner = new Runner();

describe('CLI', function () {

    it('should validate licenses and don\'t print to stderr', async function () {
        return runner.start('node', ['cli.js', '--allow-licenses', 'MIT/X11', 'CC0-1.0', 'ISC', 'MIT', 'Apache-2.0', '--production', '--deep']);
    });
});