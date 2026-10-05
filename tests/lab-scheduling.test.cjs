const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/lab.js'), 'utf8');

function lab() {
  const elements = new Map(), workers = [], timers = new Map();
  let now = 0, timerId = 0;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', textContent: '', dataset: {}, hidden: selector === '#lab', listeners: new Map(),
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      dispatchEvent(event) { this.listeners.get(event.type)?.(event); },
      focus() { document.activeElement = this; }, click() { this.onclick?.(); }
    });
    return elements.get(selector);
  };
  class FakeWorker {
    constructor(url) { this.url = url; this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(data) { this.messages.push(structuredClone(data)); }
    terminate() { this.terminated = true; }
    emit(data) { this.onmessage?.({ data }); }
  }
  const window = {
    MUSEUM_LAB_EXAMPLES: [{ id: 'javascript', code: 'console.log(1)' }, { id: 'python', code: 'print(1)' }],
    MUSEUM_DATA: { records: [{ id: 'javascript', name: 'JavaScript' }, { id: 'python', name: 'Python' }] }
  };
  const document = { hidden: false, querySelector: element, listeners: new Map(), addEventListener(type, callback) { this.listeners.set(type, callback); } };
  element('#lab-view').onclick = () => {
    const wasHidden = element('#lab').hidden;
    element('#lab').hidden = false;
    if (wasHidden) window.MUSEUM_LAB.onTabChange(true);
  };
  vm.runInNewContext(source, {
    window, document, Worker: FakeWorker,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  return {
    api: window.MUSEUM_LAB, workers, element, document,
    edit(code) { element('#lab-code').value = code; element('#lab-code').dispatchEvent({ type: 'input' }); },
    leave() { element('#lab').hidden = true; window.MUSEUM_LAB.onTabChange(false); },
    visible(value) { document.hidden = !value; document.listeners.get('visibilitychange')?.(); },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next; now = timer.at; timers.delete(id); timer.callback();
      }
      now = end;
    }
  };
}
const runs = worker => worker.messages.filter(message => message.kind === 'run');
const finish = (worker, output) => worker.emit({ kind: 'result', id: runs(worker).at(-1).id, ok: true, output });

test('direct lab entry identifies available runtimes and focuses the editor without losing the draft', () => {
  const page = lab();
  assert.equal(page.api.canRun('javascript'), true);
  assert.equal(page.api.canRun('python'), true);
  for (const id of ['rust', 'c', 'unknown']) assert.equal(page.api.canRun(id), false);
  page.api.open('python');
  assert.equal(page.document.activeElement, page.element('#lab-code'));
  page.edit('print(42)');
  page.leave();
  page.api.open('python');
  assert.equal(page.document.activeElement, page.element('#lab-code'));
  assert.equal(page.element('#lab-code').value, 'print(42)');
});

test('reopening the same Python language preserves loading, draft, result and ready worker', () => {
  const page = lab();
  assert.equal(page.workers.length, 0, 'hidden lab does not start a worker');
  page.api.open('python');
  const worker = page.workers[0];
  page.api.open('python');
  assert.equal(page.workers.length, 1, 'opening while loading does not restart Pyodide');
  worker.emit({ kind: 'ready' });
  finish(worker, '1');
  page.edit('print(9)'); page.advance(650); finish(worker, '9');
  page.leave(); page.advance(60000); page.api.open('python');
  assert.equal(page.workers.length, 1, 'ready worker is reused from the language archive');
  assert.equal(worker.terminated, false);
  assert.equal(page.element('#lab-code').value, 'print(9)');
  assert.equal(page.element('#lab-result').textContent, '9');
  assert.equal(runs(worker).length, 2, 'returning does not run completed code again');
});

test('rapid Python edits run only the latest waiting code and ignore obsolete output', () => {
  const page = lab(); page.api.open('python');
  const worker = page.workers[0];
  page.edit('print(2)'); page.advance(100); page.edit('print(3)');
  worker.emit({ kind: 'ready' });
  assert.equal(runs(worker).length, 0, 'loading completes during debounce');
  page.advance(650);
  assert.equal(runs(worker)[0].code, 'print(3)');
  page.edit('print(4)'); page.advance(650); page.edit('print(5)');
  finish(worker, 'obsolete');
  assert.notEqual(page.element('#lab-result').textContent, 'obsolete');
  page.advance(650);
  assert.deepEqual(runs(worker).map(run => run.code), ['print(3)', 'print(5)']);
  finish(worker, '5');
  assert.equal(page.element('#lab-result').textContent, '5');
});

test('leaving an active Python run stops it and idle runtime expires after three minutes', () => {
  const page = lab(); page.api.open('python');
  const old = page.workers[0]; old.emit({ kind: 'ready' });
  page.edit('print(8)'); page.advance(650); page.leave();
  assert.equal(old.terminated, true);
  page.advance(3000);
  assert.equal(page.workers.length, 1, 'hidden lab does not restart interrupted work');
  old.emit({ kind: 'result', id: runs(old)[0].id, ok: true, output: 'obsolete' });
  assert.notEqual(page.element('#lab-result').textContent, 'obsolete');
  page.api.open('python');
  const fresh = page.workers[1]; fresh.emit({ kind: 'ready' });
  assert.equal(runs(fresh)[0].code, 'print(8)'); finish(fresh, '8');
  page.leave(); page.advance(179999);
  assert.equal(fresh.terminated, false);
  page.advance(1);
  assert.equal(fresh.terminated, true);
  page.api.open('python');
  assert.equal(page.workers.length, 3);
});

test('Python timeout restarts for the latest pending code and rejects late worker messages', () => {
  const page = lab(); page.api.open('python');
  const old = page.workers[0]; old.emit({ kind: 'ready' });
  page.edit('print(6)'); page.advance(650); page.advance(2350);
  assert.equal(old.terminated, true);
  assert.equal(page.workers.length, 2);
  const fresh = page.workers[1]; fresh.emit({ kind: 'ready' });
  assert.equal(runs(fresh)[0].code, 'print(6)');
  finish(old, 'obsolete');
  assert.notEqual(page.element('#lab-result').textContent, 'obsolete');
  finish(fresh, '6');
  assert.equal(page.element('#lab-result').textContent, '6');
});

test('backgrounding the page stops active Python and resumes only the latest draft when visible', () => {
  const page = lab(); page.api.open('python');
  const old = page.workers[0]; old.emit({ kind: 'ready' });
  page.edit('print(7)'); page.advance(650); page.visible(false);
  assert.equal(old.terminated, true);
  page.advance(30000);
  assert.equal(page.workers.length, 1, 'no background restart after an interrupted run');
  finish(old, 'obsolete');
  assert.notEqual(page.element('#lab-result').textContent, 'obsolete');
  page.visible(true);
  const fresh = page.workers[1]; fresh.emit({ kind: 'ready' });
  assert.equal(runs(fresh)[0].code, 'print(7)'); finish(fresh, '7');
});

test('a background page cancels JavaScript debounce and does not initialize a newly selected runtime', () => {
  const page = lab(); page.api.open('javascript');
  page.edit('console.log(8)'); page.visible(false); page.advance(2000);
  assert.equal(page.workers.length, 1);
  assert.equal(page.workers[0].terminated, true);
  page.api.open('python');
  assert.equal(page.workers.length, 1, 'opening a language while backgrounded does not load it');
  page.visible(true);
  assert.equal(page.workers.length, 2);
  assert.equal(page.workers[1].url, 'python-worker.js');
});

test('idle Python is reused on a quick browser-tab return and expires while the page is backgrounded', () => {
  const page = lab(); page.api.open('python');
  const worker = page.workers[0]; worker.emit({ kind: 'ready' }); finish(worker, '1');
  page.visible(false); page.advance(60000); page.visible(true);
  assert.equal(page.workers.length, 1);
  assert.equal(worker.terminated, false);
  assert.equal(page.element('#lab-result').textContent, '1');
  page.visible(false); page.advance(180000);
  assert.equal(worker.terminated, true);
  page.visible(true);
  assert.equal(page.workers.length, 2);
});
