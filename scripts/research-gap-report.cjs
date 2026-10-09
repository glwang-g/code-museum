// Turn the existing relationship audit into a compact, actionable research backlog.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function load(file) { return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')); }
function report() {
  const status = load('data/audit/relationship-status.json');
  const reviews = load('data/audit/reviews.json');
  const relations = status.relations || [];
  const issueCount = phrase => relations.filter(r => (r.issues || []).some(issue => issue.includes(phrase))).length;
  const relationGaps = {
    fieldOnly: status.summary?.states?.['field-only'] ?? relations.filter(r => r.state === 'field-only').length,
    excerptRecorded: status.summary?.states?.['excerpt-recorded'] ?? relations.filter(r => r.state === 'excerpt-recorded').length,
    citationWithoutExcerpt: issueCount('缺摘录'),
    directEvidenceMissing: issueCount('直接依据待补'),
    dateWarnings: status.summary?.warnings ?? (status.warnings || []).length,
    designLayerMapGaps: status.summary?.mapDesignGaps ?? null
  };
  const nextSteps = [...new Set(reviews.reviews.filter(r => r.nextStep && r.nextStep.trim()).map(r => r.nextStep.trim()))]
    .map(nextStep => ({ nextStep, catalogueCount: reviews.reviews.filter(r => r.nextStep?.trim() === nextStep).length }));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'Offline inventory of existing evidence gaps; it does not add or infer historical relationships.',
    counts: { relationships: relations.length, reviews: reviews.reviews.length, reviewedSources: reviews.reviews.reduce((n, r) => n + (r.sources || []).filter(s => s.reviewed).length, 0) },
    relationGaps,
    unresolvedResearch: [
      { id: 'objective-c-swift', reason: 'current official page no longer contains the previously cited passage; locate a stable historical/design source' },
      { id: 'java-csharp', reason: 'direct design evidence remains missing; do not infer inheritance from syntax similarity' },
      { id: 'assembly-dart-xslt-zig', reason: 'four visible design-layer map gaps remain; no qualifying source found in the current review batch' }
    ],
    catalogueNextSteps: nextSteps
  };
}
function main(argv = process.argv.slice(2)) {
  const outputIndex = argv.indexOf('--output');
  const output = outputIndex >= 0 ? argv[outputIndex + 1] : null;
  const result = report();
  if (output) fs.writeFileSync(path.resolve(root, output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
if (require.main === module) main();
module.exports = { report };
