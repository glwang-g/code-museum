const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

test('guest deployment guards preserve live jobs, private state and exact rollback bytes offline', () => {
  const result = spawnSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'server', '-p', 'test_guest_deploy.py'], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 120000
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
