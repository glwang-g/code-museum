const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateReviews, applyCatalogueCorrections } = require('../scripts/validate-reviews.cjs');
const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/audit/reviews.json'), 'utf8'));

test('review conclusions require traceable sources and matching evidence roles', () => {
  const cases = [
    ['SHA-256', review => { delete review.sources[0].decodedBodySha256; }],
    ['SHA-256', review => { review.sources[0].decodedBodySha256 = 'unverified'; }],
    ['successful HTTP status', review => { review.sources[0].httpStatus = 403; }],
    ['timestamp', review => { review.sources[0].checkedAt = 'unknown'; }],
    ['public URL', review => { review.sources[0].url = 'javascript:alert(1)'; }],
    ['documented syntax', review => { review.syntax = 'not-reviewed'; }],
    ['syntax and implementation sources', review => { review.sources = review.sources.filter(source => source.role !== '实现'); }],
    ['access failure', review => { review.sources[0].reviewed = false; }]
  ];
  for (const [message, change] of cases) {
    const audit = structuredClone(original);
    change(audit.reviews.find(review => review.id === 'python'));
    assert.throws(() => validateReviews(audit), new RegExp(message), message);
  }
});

test('reviewed creator completion distinguishes missing fields from changed raw values', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/raw/pldb.json')));
  const source = raw.find(record => record.id === 'korn-shell');
  assert.equal(Object.hasOwn(source, 'creators'), false);
  assert.equal(applyCatalogueCorrections(raw, original).find(record => record.id === 'korn-shell').creators, 'David G. Korn');
  assert.equal(Object.hasOwn(source, 'creators'), false, 'Raw record must not be mutated');
  for (const value of [null, '', 'Different author']) {
    const changed = structuredClone(raw);
    changed.find(record => record.id === 'korn-shell').creators = value;
    assert.throws(() => applyCatalogueCorrections(changed, original), /Stale catalogue correction/);
  }
  for (const marker of [false, 'true']) {
    const audit = structuredClone(original);
    audit.reviews.find(review => review.id === 'korn-shell').catalogueCorrection.changes[0].fromMissing = marker;
    assert.throws(() => validateReviews(audit), /missing-field correction marker/);
  }
});

test('catalogue corrections preserve raw input and require reviewed sources and exact original values', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/raw/pldb.json')));
  const corrected = applyCatalogueCorrections(raw, original).find(record => record.id === 'sh');
  assert.equal(raw.find(record => record.id === 'sh').appeared, 1971);
  assert.equal(raw.find(record => record.id === 'sh').name, 'sh');
  assert.equal(corrected.appeared, 1979);
  assert.equal(corrected.name, 'Bourne shell (sh)');
  for (const [pattern, mutate] of [
    [/same record/, correction => { correction.sources = ['https://example.com/unread']; }],
    [/missing year event/, correction => { delete correction.changes[1].event; }],
    [/duplicate correction field/, correction => { correction.changes.push(correction.changes[0]); }],
    [/invalid or duplicate/, correction => { correction.changes[0].field = 'id'; }],
    [/Stale catalogue correction/, correction => { correction.changes[1].from = 1972; }]
  ]) {
    const audit = structuredClone(original);
    mutate(audit.reviews.find(review => review.id === 'sh').catalogueCorrection);
    assert.throws(() => applyCatalogueCorrections(raw, audit), pattern);
  }
  const { generateCatalogue } = require('../scripts/import-pldb.cjs');
  const data = generateCatalogue();
  assert.deepEqual(data.records.find(record => record.id === 'sh').review.catalogueCorrection, original.reviews.find(review => review.id === 'sh').catalogueCorrection);
  assert.ok(data.edges.some(edge => edge.from === 'sh' && edge.to === 'powershell' && edge.type === 'influencedBy'));
  assert.ok(data.records.some(record => record.id === 'bourne-shell'), 'Overlapping raw record must remain available for identity review');
  assert.ok(!data.edges.some(edge => ['sh', 'bourne-shell'].includes(edge.from) && ['sh', 'bourne-shell'].includes(edge.to)), 'An identity overlap must not become a lineage edge');
  for (const id of ['sh', 'korn-shell', 'c-shell']) assert.ok(data.edges.some(edge => edge.from === id && edge.to === 'bash' && edge.type === 'influencedBy'));
  assert.equal(data.records.find(record => record.id === 'xslt').review.status, 'verified-language');
  for (const id of ['sh', 'c-shell', 'c']) assert.ok(data.edges.some(edge => edge.from === id && edge.to === 'korn-shell' && edge.type === 'influencedBy'));
  assert.equal(data.records.find(record => record.id === 'korn-shell').review.status, 'historical-primary-source');
});
