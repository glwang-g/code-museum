const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');

test('Python worker uses the bundled runtime for actual output, errors and isolated variables', async () => {
  const runtimeRoot = path.join(root, 'public/assets/pyodide');
  const { loadPyodide } = await import(pathToFileURL(path.join(runtimeRoot, 'pyodide.mjs')).href);
  const messages = [];
  const self = { location: { href: 'http://localhost/python-worker.js' }, postMessage: message => messages.push(message) };
  // Node's Pyodide loader needs a filesystem path rather than the browser HTTP URL.
  // Adapt only module loading; the worker's execution and output handling run unchanged.
  const source = fs.readFileSync(path.join(root, 'src/python-worker.js'), 'utf8').replace(/^import .*;\s*$/gm, '');
  vm.runInNewContext(source, { self, URL, loadPyodide: options => loadPyodide({ ...options, indexURL: runtimeRoot + path.sep }) });
  await self.onmessage({ data: { kind: 'init' } });
  assert.equal(messages.pop().kind, 'ready');
  const execute = async (id, code) => {
    await self.onmessage({ data: { kind: 'run', id, code } });
    return messages.pop();
  };
  const result = await execute(1, 'saved = 7\nprint(sum([1, 2, 3]))');
  assert.equal(result.id, 1);
  assert.equal(result.ok, true);
  assert.equal(result.output, '6');
  const isolated = await execute(2, 'print(saved)');
  assert.equal(isolated.ok, false);
  assert.match(isolated.output, /NameError: name 'saved' is not defined/);
  const failed = await execute(3, 'print("x" * 50000)\nraise ValueError("after full logs")');
  assert.equal(failed.ok, false);
  assert.equal(failed.output.length, 20000);
  assert.match(failed.output, /ValueError: after full logs/);
});
