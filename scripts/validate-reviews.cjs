const fs = require('node:fs');
const path = require('node:path');

const statuses = new Set(['verified-language', 'historical-primary-source', 'bibliographic-only', 'verified-formal-language', 'verified-related-technology', 'review-blocked', 'unreviewed']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const webURL = value => {
  try { const url = new URL(value); return text(value) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
};
const timestamp = value => text(value) && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

function validateReviews(audit) {
  if (audit.schemaVersion !== 1 || !Array.isArray(audit.reviews) || !text(audit.method) || !/^\d{4}-\d{2}-\d{2}$/.test(audit.checkedAt || '') || !Number.isFinite(Date.parse(audit.checkedAt))) {
    throw new Error('Invalid audit review manifest.');
  }
  const ids = new Set();
  for (const review of audit.reviews) {
    const fail = message => { throw new Error(`Invalid audit review ${review.id || '(missing ID)'}: ${message}`); };
    if (!text(review.id) || ids.has(review.id)) fail('missing or duplicate ID.');
    ids.add(review.id);
    if (!statuses.has(review.status)) fail('unknown review status.');
    if (!Array.isArray(review.sources)) fail('source list is required.');
    for (const [index, source] of review.sources.entries()) {
      const sourceFail = message => fail(`source ${index + 1}: ${message}`);
      if (!text(source.role) || !webURL(source.url) || !timestamp(source.checkedAt) || typeof source.reviewed !== 'boolean') sourceFail('role, public URL, timestamp and reviewed flag are required.');
      if (source.finalUrl !== undefined && !webURL(source.finalUrl)) sourceFail('invalid final URL.');
      if (source.reviewed) {
        if (!Number.isInteger(source.httpStatus) || source.httpStatus < 200 || source.httpStatus >= 300) sourceFail('reviewed source must have a successful HTTP status.');
        if (!text(source.title) || !text(source.excerpt) || !/^[a-f0-9]{64}$/.test(source.decodedBodySha256 || '')) sourceFail('title, excerpt and SHA-256 are required for reviewed sources.');
      } else if (!text(source.error)) sourceFail('unread source must record the access failure.');
    }
    const reviewed = review.sources.filter(source => source.reviewed);
    const roles = new Set(reviewed.map(source => source.role));
    if (review.catalogueCorrection !== undefined) {
      const correction = review.catalogueCorrection;
      if (!correction || !text(correction.reason) || !Array.isArray(correction.changes) || !correction.changes.length || !Array.isArray(correction.sources) || !correction.sources.length) fail('correction requires changes, reason and reviewed sources.');
      const fields = new Set();
      for (const change of correction.changes) {
        if (!change || !['name', 'year', 'creators'].includes(change.field) || fields.has(change.field)) fail('invalid or duplicate correction field.');
        fields.add(change.field);
        if (change.fromMissing !== undefined && (change.fromMissing !== true || change.field !== 'creators' || change.from !== null)) fail('invalid missing-field correction marker.');
        if (change.field === 'year' ? (!Number.isInteger(change.from) || !Number.isInteger(change.to) || change.to < 1 || !text(change.event)) : (!(text(change.from) || (change.field === 'creators' && change.from === null)) || !text(change.to))) fail('invalid correction values or missing year event.');
        if (change.from === change.to) fail('correction must change the value.');
      }
      if (correction.sources.some(url => !reviewed.some(source => source.url === url))) fail('correction source must be reviewed in the same record.');
    }
    if (!['unreviewed', 'review-blocked'].includes(review.status) && reviewed.length === 0) fail('conclusion requires a reviewed source.');
    if (review.status === 'verified-language') {
      if (!['programming', 'domain-language'].includes(review.kind) || review.syntax !== 'documented' || review.implementation !== 'documented' || !text(review.implementationName)) fail('verified language requires documented syntax and a named implementation.');
      if (!(roles.has('语法与实现') || (roles.has('语法') && roles.has('实现')))) fail('verified language requires reviewed syntax and implementation sources.');
    }
    if (review.status === 'historical-primary-source' && (review.kind !== 'historical-language' || !roles.has('历史原文'))) fail('historical conclusion requires a historical language classification and a reviewed primary source.');
    if (review.status === 'verified-formal-language' && (review.kind !== 'formal-notation' || !roles.has('规范'))) fail('formal language conclusion requires a formal notation classification and a reviewed specification.');
    if (review.status === 'verified-related-technology' && (!['related-tool', 'encoding-protocol'].includes(review.kind) || !roles.has('技术分类'))) fail('technology conclusion requires a related technology classification and a reviewed classification source.');
  }
  return audit;
}

function applyCatalogueCorrections(records, audit) {
  validateReviews(audit);
  const reviews = new Map(audit.reviews.map(review => [review.id, review]));
  const ids = new Set(records.map(record => record.id));
  for (const review of audit.reviews) if (review.catalogueCorrection && !ids.has(review.id)) throw new Error(`Unknown correction ID: ${review.id}`);
  return records.map(record => {
    const correction = reviews.get(record.id)?.catalogueCorrection;
    if (!correction) return { ...record };
    const result = { ...record };
    for (const change of correction.changes) {
      const key = change.field === 'year' ? 'appeared' : change.field;
      const matches = change.fromMissing === true ? !Object.hasOwn(record, key) : record[key] === change.from;
      if (!matches) throw new Error(`Stale catalogue correction: ${record.id}.${change.field}`);
      result[key] = change.to;
    }
    return result;
  });
}

if (require.main === module) {
  try {
    const audit = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/audit/reviews.json'), 'utf8'));
    validateReviews(audit);
    if (process.argv.includes('--catalogue')) console.log(JSON.stringify(applyCatalogueCorrections(JSON.parse(fs.readFileSync(path.join(__dirname, '../data/raw/pldb.json'), 'utf8')), audit)));
    else console.log(`Validated ${audit.reviews.length} audit reviews.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { validateReviews, applyCatalogueCorrections };
