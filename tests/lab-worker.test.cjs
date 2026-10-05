const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const source = fs.readFileSync(path.join(__dirname, '../src/lab-worker.js'), 'utf8');

// Run the browser worker script in a separate thread with its actual message interface.
// This checks execution and capture; page scheduling and browser integration are separate checks.
function execute(code) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(`
      const {parentPort,workerData}=require('node:worker_threads');
      const self={postMessage:message=>parentPort.postMessage(message)};
      require('node:vm').runInNewContext(workerData.source,{self});
      self.onmessage({data:{id:42,code:workerData.code}});
    `, { eval: true, workerData: { source, code } });
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Worker did not finish.')); }, 3000);
    worker.once('message', result => { clearTimeout(timeout); worker.terminate(); resolve(result); });
    worker.once('error', error => { clearTimeout(timeout); worker.terminate(); reject(error); });
  });
}

test('JavaScript worker returns real asynchronous output and execution errors', async () => {
  const result = await execute('console.log("ready", {value:2}); await Promise.resolve(); console.warn(undefined, null);');
  assert.deepEqual(result, { id: 42, ok: true, output: 'ready {"value":2}\nundefined null' });
  const failed = await execute('console.log("before"); throw new TypeError("bad value");');
  assert.deepEqual(failed, { id: 42, ok: false, output: 'before\nTypeError: bad value' });
  const syntax = await execute('const = 2;');
  assert.equal(syntax.ok, false);
  assert.match(syntax.output, /^SyntaxError:/);
});

test('JavaScript worker bounds captured logs and stops formatting after the output budget', async () => {
  const result = await execute(`
    console.log('x'.repeat(50000));
    console.log({toJSON(){while(true){}}});
    console.log('beyond the capture limit');
  `);
  assert.equal(result.ok, true);
  assert.equal(result.output, 'x'.repeat(20000));
  const failed = await execute('console.log("x".repeat(50000)); throw new TypeError("after full logs");');
  assert.equal(failed.ok, false);
  assert.equal(failed.output.length, 20000);
  assert.ok(failed.output.endsWith('\nTypeError: after full logs'));
});
