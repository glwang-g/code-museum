const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateReviews, applyCatalogueCorrections } = require('./validate-reviews.cjs');

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const words = value => String(value || '').split(/\s+/).filter(Boolean);

function generateCatalogue(root = path.resolve(__dirname, '..')) {
  const raw = fs.readFileSync(path.join(root, 'data/raw/pldb.json'));
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/raw/pldb.snapshot.json'), 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(path.join(root, 'data/relationship-overrides.json'), 'utf8'));
  const ecosystemRelations = JSON.parse(fs.readFileSync(path.join(root, 'data/ecosystem-relations.json'), 'utf8'));
  const mapEligibility = JSON.parse(fs.readFileSync(path.join(root, 'data/audit/map-eligible-ids.json'), 'utf8'));
  const labelSelection = JSON.parse(fs.readFileSync(path.join(root, 'data/audit/label-selection.json'), 'utf8'));
  const mapCuration = JSON.parse(fs.readFileSync(path.join(root, 'data/audit/map-curation.json'), 'utf8'));
  const aliasCuration = JSON.parse(fs.readFileSync(path.join(root, 'data/audit/alias-curation.json'), 'utf8'));
  const auditBytes = fs.readFileSync(path.join(root, 'data/audit/reviews.json'));
  const audit = JSON.parse(auditBytes);
  validateReviews(audit);
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  if (digest !== snapshot.sha256) throw new Error('PLDB snapshot checksum mismatch. Check data/raw/pldb.json and its manifest.');
  if (mapEligibility.snapshot_sha256 !== digest || !Array.isArray(mapEligibility.ids)) throw new Error('Map eligibility does not match the pinned PLDB snapshot.');
  for (const [field, file] of [['reviews_sha256', 'reviews.json'], ['curation_sha256', 'map-curation.json']]) {
    const current = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'data/audit', file))).digest('hex');
    if (mapEligibility[field] !== current) throw new Error('Map eligibility is stale for ' + file + '. Run npm run audit before building.');
  }
  const mapIds = new Set(mapEligibility.ids);
  const rankedLabels = labelSelection.top50;
  if (!Array.isArray(rankedLabels) || rankedLabels.length !== 50 || rankedLabels.some((entry, index) =>
    entry.rank !== index + 1 || typeof entry.name !== 'string' ||
    (entry.mapId !== null && typeof entry.mapId !== 'string'))) {
    throw new Error('Invalid pinned TIOBE top-50 label selection.');
  }
  if (rankedLabels.some(entry => entry.mapId !== null && !mapIds.has(entry.mapId))) {
    throw new Error('Pinned TIOBE label ID is not eligible for the map.');
  }
  const rankedIds = rankedLabels.map(entry => entry.mapId).filter(Boolean);
  if (new Set(rankedIds).size !== rankedIds.length) throw new Error('Duplicate pinned TIOBE map label ID.');
  const anchorLabels = [...labelSelection.historicalAnchors, ...labelSelection.relationshipContext];
  if (anchorLabels.some(entry => !mapIds.has(entry.id) || !entry.reason || !/^https?:\/\//.test(entry.source))) {
    throw new Error('Invalid curated map label anchor.');
  }
  const labelIds = new Set([...rankedIds,
    ...anchorLabels.map(entry => entry.id)]);
  const curationReasons = new Map(mapCuration.exclude.map(item => [item.id, item.reason]));
  const excludedIds = new Set(curationReasons.keys());
  const relatedTags = new Set('textMarkup stylesheetLanguage dataNotation xmlFormat textDataFormat notation jsonFormat schema configFormat wikiMarkup dataVis musicalNotation headerLang yamlFormat library compiler interpreter staticSiteGenerator unixApplication framework application ide editor protocol isa standard barCodeFormat numeralSystem characterEncoding textEncodingFormat timeFormat diffFormat'.split(' '));
  const reviews = new Map(audit.reviews.map(review => [review.id, review]));
  const aliasExclusions = new Map(aliasCuration.map(item => [item.id, new Set(item.exclude.map(alias => alias.toLowerCase()))]));
  if (aliasExclusions.size !== aliasCuration.length) throw new Error('Duplicate alias curation ID.');
  if (mapIds.size !== mapEligibility.ids.length) throw new Error('Duplicate map eligibility ID.');
  if (excludedIds.size !== mapCuration.exclude.length || [...excludedIds].some(id => mapIds.has(id))) throw new Error('Invalid map curation exclusion.');
  if (reviews.size !== audit.reviews.length) throw new Error('Duplicate audit review ID.');
  const input = applyCatalogueCorrections(JSON.parse(raw), audit);
  if (!Array.isArray(input) || input.length !== snapshot.count) throw new Error('PLDB snapshot record count mismatch.');
  for (const item of aliasCuration) {
    const record = input.find(r => r.id === item.id);
    const sourceAliases = new Set(String(record?.githubLanguage_aliases || '').split(/\s+or\s+/).map(alias => alias.toLowerCase()));
    if (!record || !Array.isArray(item.exclude) || item.exclude.some(alias => !sourceAliases.has(alias.toLowerCase()))) {
      throw new Error('Alias curation does not match the pinned PLDB snapshot: ' + item.id);
    }
  }
  const records = input.map(r => {
    if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string') throw new Error('Invalid PLDB record.');
    const review = reviews.get(r.id);
    const category = mapIds.has(r.id) ? 'language' : (!r.isLanguage || excludedIds.has(r.id) || relatedTags.has(r.primaryTag) || ['verified-related-technology', 'verified-formal-language'].includes(review?.status) ? 'related' : 'pending');
    return {
      id: r.id, name: r.name, year: Number(r.appeared) || null, mapEligible: mapIds.has(r.id), curationReason: curationReasons.get(r.id) || '',
      language: !!r.isLanguage, category, tags: r.tags || '', creators: r.creators || '',
      aliases: String(r.githubLanguage_aliases || '').split(/\s+or\s+/).filter(alias =>
        !aliasExclusions.get(r.id)?.has(alias.toLowerCase())).join(' or '),
      website: r.website || '', wiki: r.wikipedia || '',
      source: 'https://github.com/breck7/pldb/blob/main/concepts/' + r.id + '.scroll',
      influencedBy: words(r.influencedBy), supersetOf: words(r.supersetOf),
      review: review ? {
        status: review.status, notes: review.notes || '', catalogueCorrection: review.catalogueCorrection || null,
        sources: (review.sources || []).filter(source => source.reviewed && /^https?:\/\//.test(source.url)).map(source => ({ role: source.role, url: source.url }))
      } : null
    };
  });
  // Explicit code-point ordering: independent of the host's locale / ICU version.
  records.sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.name, b.name) || compare(a.id, b.id));
  const ids = new Set(records.map(r => r.id));
  if (ids.size !== records.length) throw new Error('Duplicate PLDB identifiers.');
  if ([...excludedIds].some(id => !ids.has(id))) throw new Error('Map curation contains an unknown ID.');
  if ([...reviews.keys()].some(id => !ids.has(id))) throw new Error('Audit review contains an unknown ID.');
  if ([...aliasExclusions.keys()].some(id => !ids.has(id))) throw new Error('Alias curation contains an unknown ID.');
  if ([...mapIds].some(id => !ids.has(id) || !records.find(r => r.id === id).language)) throw new Error('Map eligibility contains an unknown or non-language ID.');
  const languages = records.filter(r => r.language).length;
  if (languages !== snapshot.languageCount) throw new Error('PLDB language count mismatch.');
  const edgeMap = new Map();
  function add(edge) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error('Unresolved relationship: ' + edge.from + ' -> ' + edge.to);
    if (!['influencedBy', 'supersetOf', 'successorOf', 'implementationOf', 'compatibleWith'].includes(edge.type)) throw new Error('Unsupported relationship type.');
    if (!/^https?:\/\//.test(edge.source)) throw new Error('Relationship source URL is required.');
    if (edge.sourceSha256 && !/^[a-f0-9]{64}$/.test(edge.sourceSha256)) throw new Error('Invalid relationship source checksum.');
    edgeMap.set([edge.from, edge.to, edge.type].join('\0'), edge);
  }
  for (const r of records) for (const type of ['influencedBy', 'supersetOf']) {
    for (const from of r[type]) add({ from, to: r.id, type, source: r.source });
  }
  for (const edge of overrides) {
    if (edge.replacesType !== undefined) {
      const oldKey=[edge.from,edge.to,edge.replacesType].join('\0');
      const previous=edgeMap.get(oldKey);
      if (!['influencedBy','supersetOf'].includes(edge.replacesType) || edge.replacesType===edge.type || !previous || previous.evidence || !edge.evidence || !edge.sourceSha256) throw new Error('Invalid reviewed relationship replacement: '+edge.from+' -> '+edge.to);
      const review=audit.reviews.find(r=>r.id===edge.to);
      if (!review?.sources.some(s=>s.reviewed && s.url===edge.source && s.decodedBodySha256===edge.sourceSha256)) throw new Error('Relationship replacement requires matching reviewed source.');
      edgeMap.delete(oldKey);
    }
    add(edge);
  }
  const edges = [...edgeMap.values()].sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.type, b.type));
  const ecosystemKeys = new Set();
  for (const edge of ecosystemRelations) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) throw new Error('Invalid ecosystem relationship endpoint.');
    if (!['extensionInterface', 'hostRuntime', 'interop'].includes(edge.type)) throw new Error('Unsupported ecosystem relationship type.');
    if (!/^https?:\/\//.test(edge.source) || !edge.evidence || !edge.label) throw new Error('Ecosystem relationship requires a source and explanation.');
    const key = [edge.from, edge.to, edge.type].join('\0');
    if (ecosystemKeys.has(key)) throw new Error('Duplicate ecosystem relationship.');
    ecosystemKeys.add(key);
  }
  const ecosystemEdges = ecosystemRelations.slice().sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.type, b.type));
  return {
    meta: {
      source: snapshot.source, license: snapshot.license, retrieved: snapshot.retrieved,
      sha256: digest, count: records.length, languages, mapLanguageCount: mapIds.size,
      reviewEvidence: {
        file: 'data/audit-reviews.json', sha256: crypto.createHash('sha256').update(auditBytes).digest('hex'),
        checkedAt: audit.checkedAt, recordCount: audit.reviews.length,
        reviewedSourceCount: audit.reviews.reduce((sum, review) => sum + review.sources.filter(source => source.reviewed).length, 0),
        scope: audit.method
      },
      mapLabelIds: [...labelIds].sort(compare), edgeCount: edges.length, ecosystemEdgeCount: ecosystemEdges.length, unresolved: 0
    },
    records, edges, ecosystemEdges
  };
}

module.exports = { generateCatalogue };
if (require.main === module) {
  console.log(JSON.stringify(generateCatalogue().meta, null, 2));
}
