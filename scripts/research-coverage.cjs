const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const status = read('data/audit/relationship-status.json');
const ledger = read('data/audit/relationship-research-ledger.json');
const ledgerById = new Map(ledger.entries.map(entry => [entry.id, entry]));

// The ledger is the single source of truth for what has been researched. A relation
// counts as "researched without result" only when its ledger entry is closed or blocked;
// a verified entry means the relation should already carry an excerpt.
const researchedNoResultStatuses = new Set(['closed-no-qualifying-source', 'blocked']);

// One source question can cover several PLDB relation types; keep those aliases explicit
// so every field-only edge still lands in exactly one bucket.
const topicAliases = {
  'python|mojo|supersetOf': 'python|mojo|influencedBy',
};

function topicFor(key) {
  return ledgerById.get(topicAliases[key] || key) || null;
}

function compact(row, extra = {}) {
  return {
    key: row.key,
    from: row.from,
    to: row.to,
    type: row.type,
    source: row.source,
    mapVisible: row.mapVisible,
    state: row.state,
    ...extra,
  };
}

const relations = status.relations;
const fieldOnly = relations.filter(row => row.state === 'field-only');
const excerptRecorded = relations.filter(row => row.state === 'excerpt-recorded');
const verifiedFieldOnly = fieldOnly.filter(row => topicFor(row.key)?.status === 'verified');
if (verifiedFieldOnly.length) {
  throw new Error(`Verified ledger entries still field-only: ${verifiedFieldOnly.map(row => row.key).join(', ')}`);
}
const researchedNoResultKeys = new Set(
  fieldOnly.filter(row => researchedNoResultStatuses.has(topicFor(row.key)?.status)).map(row => row.key),
);
const researchedNoResult = fieldOnly.filter(row => researchedNoResultKeys.has(row.key));
const neverResearched = fieldOnly.filter(row => !researchedNoResultKeys.has(row.key));

if (researchedNoResult.length + neverResearched.length !== fieldOnly.length) throw new Error('Coverage buckets do not partition field-only relations');
for (const row of researchedNoResult) {
  if (!topicFor(row.key)) throw new Error(`Missing research ledger entry for ${row.key}`);
}

const report = {
  schemaVersion: 1,
  scope: 'Relation-level coverage of the current field-only backlog; this report classifies research history and does not infer historical relationships.',
  source: {
    relationshipStatus: 'data/audit/relationship-status.json',
    researchLedger: 'data/audit/relationship-research-ledger.json',
    statusInputHashes: status.inputHashes,
  },
  counts: {
    allRelations: relations.length,
    fieldOnly: fieldOnly.length,
    excerptRecorded: excerptRecorded.length,
    fieldOnlyResearchedNoResult: researchedNoResult.length,
    fieldOnlyNeverResearched: neverResearched.length,
  },
  categories: {
    researchedNoResultClosed: researchedNoResult.filter(row => topicFor(row.key).status === 'closed-no-qualifying-source').map(row => compact(row, {research: topicFor(row.key)})),
    researchedNoResultBlocked: researchedNoResult.filter(row => topicFor(row.key).status === 'blocked').map(row => compact(row, {research: topicFor(row.key)})),
    neverResearched: neverResearched.map(row => compact(row)),
    completedWithResult: excerptRecorded.map(row => compact(row)),
  },
};

const output = path.join(root, 'data/audit/relationship-research-coverage.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');

const closed = report.categories.researchedNoResultClosed;
const blocked = report.categories.researchedNoResultBlocked;
const md = `# 关系研究覆盖盘点

由 npm run research:coverage 根据当前关系审计和研究台账生成。它只记录“哪些关系已经进入过研究批次”，不把来源字段当作历史证据，也不推断未记录关系。

## 当前分桶

- 全量关系：${report.counts.allRelations}
- 已有原文摘录（不属于当前待处理 ${report.counts.fieldOnly} 条）：${report.counts.excerptRecorded}
- 当前来源字段待核：${report.counts.fieldOnly}
- 待核中已研究但未升级：${report.counts.fieldOnlyResearchedNoResult}
  - 已收口、没有合格来源：${closed.length}
  - 来源或端点受阻：${blocked.length}
- 待核中从未进入已记录研究批次：${report.counts.fieldOnlyNeverResearched}

“从未进入已记录研究批次”不等于历史上没有关系，只表示当前台账没有这条关系的研究记录。后续可以从这里挑选新批次；“已收口”项目除非满足 reopenWhen，不再重复搜索。

## 已研究但没有结果：已收口

| 关系 | 批次 | 结论 |
| --- | --- | --- |
${closed.map(row => '| ' + row.key.replaceAll('|', ' → ') + ' | ' + row.research.batch + ' | ' + row.research.note + ' |').join('\n')}

## 已研究但没有结果：受阻

| 关系 | 批次 | 重开条件 |
| --- | --- | --- |
${blocked.map(row => '| ' + row.key.replaceAll('|', ' → ') + ' | ' + row.research.batch + ' | ' + row.research.reopenWhen + ' |').join('\n')}

## 全量逐条清单

完整的 ${report.counts.fieldOnlyNeverResearched} 条“从未研究”和 ${report.counts.excerptRecorded} 条“已有结果”逐条记录在 [机器可读清单](../../data/audit/relationship-research-coverage.json)。以后生成研究候选时，应排除 researchedNoResultClosed 和 researchedNoResultBlocked，除非满足对应重开条件。
`;
fs.writeFileSync(path.join(root, 'docs/audit/RELATIONSHIP_RESEARCH_COVERAGE.md'), md);
console.log(`Wrote coverage: ${researchedNoResult.length} researched without result, ${neverResearched.length} never researched, ${excerptRecorded.length} with result.`);
