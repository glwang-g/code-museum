const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalRuntime } = require('../scripts/check-production-consistency.cjs');
const { report } = require('../scripts/research-gap-report.cjs');

test('production consistency canonicalizes the same phase budgets as the executor', () => {
  assert.deepEqual(canonicalRuntime({ id: 'rust', version: 'rustc test', memoryMiB: 768, source: 'source' }), {
    id: 'rust', version: 'rustc test', memoryMiB: 768, source: 'source', compileSeconds: 15, runSeconds: 3
  });
  assert.equal(canonicalRuntime({ id: 'python', version: 'Python test', memoryMiB: 256, source: 'source' }).compileSeconds, 0);
});

test('research gap report preserves explicit unresolved items without inventing relations', () => {
  const result = report();
  assert.equal(result.scope.includes('does not add'), true);
  assert.ok(result.relationGaps.fieldOnly >= 0);
  assert.deepEqual(result.unresolvedResearch.map(item => item.id), ['assembly-xslt-zig']);
});
