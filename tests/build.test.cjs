const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const { generateCatalogue } = require('../scripts/import-pldb.cjs');
function copySources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-museum-rebuild-'));
  for (const item of ['src', 'public', 'data', 'scripts', 'server', 'package.json']) {
    fs.cpSync(path.join(root, item), path.join(dir, item), { recursive: true });
  }
  return dir;
}
function hashes(dir, base = dir, result = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) hashes(file, base, result);
    else result[path.relative(base, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  return result;
}

test('source-only rebuild is offline, complete, and byte-for-byte repeatable', () => {
  const dir = copySources();
  try {
    assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
    assert.equal(fs.existsSync(path.join(dir, 'node_modules')), false);
    const command = path.join(dir, 'scripts/build.cjs');
    // Invoke outside the project: no reliance on the caller's working directory.
    execFileSync(process.execPath, [command], { cwd: os.tmpdir() });
    const first = hashes(path.join(dir, 'dist'));
    for (const file of ['index.html', 'museum.css', 'museum.js', 'favicon.svg', 'assets/history-river.png', 'data/catalogue.js', 'data/provenance.json', 'data/audit-reviews.json']) {
      assert.ok(first[file], file);
    }
    for (const file of ['index.html', 'museum.css', 'museum.js']) {
      assert.deepEqual(fs.readFileSync(path.join(dir, 'dist', file)), fs.readFileSync(path.join(root, 'src', file)));
    }
    new vm.Script(fs.readFileSync(path.join(dir, 'dist/museum.js'), 'utf8'));
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(dir, 'dist/data/catalogue.js'), 'utf8'), context);
    const db = context.window.MUSEUM_DATA;
    const publishedEvidence = fs.readFileSync(path.join(dir, 'dist', db.meta.reviewEvidence.file));
    const sourceEvidence = fs.readFileSync(path.join(dir, 'data/audit/reviews.json'));
    assert.deepEqual(publishedEvidence, sourceEvidence, 'downloadable evidence preserves the complete input bytes');
    assert.equal(crypto.createHash('sha256').update(publishedEvidence).digest('hex'), db.meta.reviewEvidence.sha256);
    const audit = JSON.parse(publishedEvidence);
    assert.equal(db.meta.reviewEvidence.recordCount, audit.reviews.length);
    assert.equal(db.meta.reviewEvidence.reviewedSourceCount, audit.reviews.reduce((sum, review) => sum + review.sources.filter(source => source.reviewed).length, 0));
    const provenance = JSON.parse(fs.readFileSync(path.join(dir, 'dist/data/provenance.json'), 'utf8'));
    assert.deepEqual(provenance.meta.reviewEvidence, JSON.parse(JSON.stringify(db.meta.reviewEvidence)));
    assert.equal(db.records.length, 5155);
    assert.equal(db.records.filter(r => r.language).length, 4608);
    const originalSh = JSON.parse(fs.readFileSync(path.join(dir, 'data/raw/pldb.json'))).find(r => r.id === 'sh');
    const displayedSh = db.records.find(r => r.id === 'sh');
    assert.equal(originalSh.name, 'sh');
    assert.equal(originalSh.appeared, 1971);
    assert.equal(displayedSh.name, 'Bourne shell (sh)');
    assert.equal(displayedSh.year, 1979);
    assert.deepEqual(JSON.parse(JSON.stringify(displayedSh.review.catalogueCorrection)), audit.reviews.find(r => r.id === 'sh').catalogueCorrection);
    assert.equal(db.meta.mapLanguageCount, JSON.parse(fs.readFileSync(path.join(dir, 'data/audit/map-eligible-ids.json'), 'utf8')).ids.length);
    for (const id of ['java', 'smalltalk', 'fortran', 'basic', 'foxpro', 'pl-sql', 'r', 'matlab', 'assembly-language']) {
      assert.ok(db.records.some(r => r.id === id), id);
    }
    assert.ok(db.edges.some(e => e.from === 'simula' && e.to === 'smalltalk' && e.evidence));
    assert.ok(db.edges.some(e => e.from === 'cpp' && e.to === 'java' && e.evidence));
    assert.ok(db.edges.some(e => e.from === 'java' && e.to === 'csharp' && e.type === 'influencedBy' && e.evidence));
    assert.ok(db.records.find(r => r.id === 'algol-60').mapEligible);
    assert.ok(db.meta.mapLabelIds.includes('algol-60'));
    assert.ok(!db.meta.mapLabelIds.includes('algol'));
    assert.ok(db.records.some(r => r.id === 'algol'), 'Family catalogue record must remain available');
    assert.ok(db.edges.some(e => e.from === 'algol-60' && e.to === 'pascal'));
    assert.ok(!db.edges.some(e => e.from === 'algol' && e.to === 'pascal'), 'Version links must not be moved to the family aggregate');
    const zigInterop = db.ecosystemEdges.find(e => e.from === 'c' && e.to === 'zig');
    assert.equal(zigInterop.type, 'interop');
    assert.equal(zigInterop.source, 'https://ziglang.org/learn/overview/');
    assert.ok(audit.reviews.find(r => r.id === 'zig').sources.some(source => source.url === zigInterop.source && source.reviewed && source.excerpt.includes('@cImport')));
    assert.ok(!db.edges.some(e => e.from === 'c' && e.to === 'zig'), 'Interop evidence must not become a design inheritance claim');
    assert.ok(db.edges.some(e => e.from === 'bcpl' && e.to === 'b' && e.type === 'influencedBy' && e.evidence));
    assert.ok(db.edges.some(e => e.from === 'b' && e.to === 'c' && e.type === 'influencedBy' && e.evidence));
    assert.equal(db.records.find(r => r.id === 'bcpl').category, 'language');
    assert.equal(db.records.find(r => r.id === 'metapi').category, 'pending');
    assert.equal(db.records.find(r => r.id === 'gcc').category, 'related');
    for (const id of ['asciidoc', 'dokuwiki', 'arm', 'mariadb', 'mysql', 'postgresql', 'sqlite', 'make', 'dtrace', 'jasmin']) {
      assert.equal(db.records.find(r => r.id === id).category, 'related', id);
      assert.ok(!db.records.find(r => r.id === id).mapEligible, id);
    }
    assert.ok(db.records.some(r => r.id === 'b' && r.mapEligible));
    assert.ok(db.records.some(r => r.id === 'c' && r.mapEligible));
    assert.ok(!db.records.some(r => r.id === 'gcc' && r.mapEligible));
    const html = fs.readFileSync(path.join(dir, 'dist/index.html'), 'utf8');
    for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (!/^https?:/.test(match[1])) assert.ok(fs.existsSync(path.join(dir, 'dist', match[1])), match[1]);
    }
    for (const match of fs.readFileSync(path.join(dir, 'dist/museum.css'), 'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      assert.ok(fs.existsSync(path.join(dir, 'dist', match[1])), match[1]);
    }
    fs.writeFileSync(path.join(dir, 'dist/stale-output.txt'), 'obsolete');
    execFileSync(process.execPath, [command], { cwd: os.tmpdir() });
    assert.deepEqual(hashes(path.join(dir, 'dist')), first);
    // Bad inputs fail before disturbing the last successful output.
    const reviewFile = path.join(dir, 'data/audit/reviews.json');
    const originalReviews = fs.readFileSync(reviewFile);
    const incompleteReview = JSON.parse(originalReviews);
    const implementationSource = incompleteReview.reviews.find(review => review.id === 'python').sources.find(source => source.role === '实现');
    implementationSource.reviewed = false;
    implementationSource.error = 'Source could not be read.';
    fs.writeFileSync(reviewFile, JSON.stringify(incompleteReview));
    assert.throws(() => execFileSync(process.execPath, [command], { stdio: 'pipe' }), /verified language requires reviewed syntax and implementation sources/);
    assert.deepEqual(hashes(path.join(dir, 'dist')), first);
    const updatedReview = JSON.parse(originalReviews);
    updatedReview.reviews.find(review => review.id === 'python').notes = 'Updated review scope.';
    fs.writeFileSync(reviewFile, JSON.stringify(updatedReview));
    assert.throws(() => execFileSync(process.execPath, [command], { stdio: 'pipe' }), /Map eligibility is stale/);
    assert.deepEqual(hashes(path.join(dir, 'dist')), first);
    fs.writeFileSync(reviewFile, originalReviews);
    fs.appendFileSync(path.join(dir, 'data/raw/pldb.json'), '\n');
    assert.throws(() => execFileSync(process.execPath, [command], { stdio: 'pipe' }), /checksum mismatch/);
    assert.deepEqual(hashes(path.join(dir, 'dist')), first);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('unresolvable curated relationships fail instead of silently disappearing', () => {
  const dir = copySources();
  try {
    fs.writeFileSync(path.join(dir, 'data/relationship-overrides.json'), JSON.stringify([{ from: 'missing-id', to: 'java', type: 'influencedBy', source: 'https://example.com' }]));
    assert.throws(() => generateCatalogue(dir), /Unresolved relationship/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
