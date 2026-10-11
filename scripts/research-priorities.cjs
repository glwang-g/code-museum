// Rank only the relationships that have never entered a recorded research batch.
// The score is triage metadata, not historical evidence or a claim that a primary
// source exists for any candidate.
const fs = require('node:fs');
const path = require('node:path');
const { generateCatalogue } = require('./import-pldb.cjs');

const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

function sameHashes(a, b) {
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
}

function scoreCandidate(row, context) {
  const reasons = [];
  let score = 0;
  const add = (points, reason) => { score += points; reasons.push({ points, reason }); };
  const endpoints = [row.from, row.to];
  if (row.mapVisible) add(40, '两端均在当前地图节点范围内');
  const relationPoints = { supersetOf: 30, successorOf: 24, influencedBy: 15 }[row.type] || 0;
  if (relationPoints) add(relationPoints, '关系类型为 '+row.type);
  for (const id of endpoints) {
    const rank = context.ranks.get(id);
    if (rank) add(32 + (51 - rank), `常显关注语言（TIOBE #${rank}）`);
    if (context.anchors.has(id)) add(20, '历史或关系叙事锚点');
    if (context.learningEndpoints.has(id)) add(12, '当前学习导览直接使用的端点');
    const label = context.labels.get(id);
    if (label?.languageStatus === 'verified-language') add(8, '端点已有语法与实现核验');
    else if (label?.languageStatus === 'historical-primary-source') add(7, '端点已有历史一手资料');
    const record = context.records.get(id);
    if (record?.website) add(10, '馆藏保留了项目网站线索（仍须核验归属）');
    if (record?.creators) add(5, '馆藏保留了作者线索');
    if (record?.category === 'related') add(-16, '端点当前归为相关技术/记法，展示优先级下调');
  }
  return { score, reasons };
}

function generatePriorityReport() {
  const status = read('data/audit/relationship-status.json');
  const coverage = read('data/audit/relationship-research-coverage.json');
  const labels = read('data/audit/label-selection.json');
  const paths = read('data/learning-paths.json');
  const catalogue = generateCatalogue(root);
  if (!sameHashes(status.inputHashes, coverage.source?.statusInputHashes)) {
    throw new Error('Relationship coverage is stale; run npm run research:coverage after npm run relations:audit.');
  }
  const never = coverage.categories?.neverResearched;
  const closed = coverage.categories?.researchedNoResultClosed || [];
  const blocked = coverage.categories?.researchedNoResultBlocked || [];
  if (!Array.isArray(never)) throw new Error('Relationship coverage is missing neverResearched candidates.');
  const excluded = new Set([...closed, ...blocked].map(row => row.key));
  if (never.some(row => excluded.has(row.key))) throw new Error('Research priority candidates include a closed or blocked item.');
  const ranks = new Map((labels.top50 || []).filter(row => row.mapId).map(row => [row.mapId, row.rank]));
  const anchors = new Set([...(labels.historicalAnchors || []), ...(labels.relationshipContext || [])].map(row => row.id));
  const labelRows = new Map((status.labels || []).map(row => [row.id, row]));
  const records = new Map(catalogue.records.map(row => [row.id, row]));
  const learningEndpoints = new Set((paths.routes || []).flatMap(route => route.steps || []).flatMap(step => [step.language, step.left, step.right]).filter(Boolean));
  const context = { ranks, anchors, labels: labelRows, learningEndpoints, records };
  const candidates = never.map(row => {
    const { score, reasons } = scoreCandidate(row, context);
    return {
      key: row.key,
      from: row.from,
      to: row.to,
      type: row.type,
      source: row.source,
      mapVisible: row.mapVisible,
      score,
      reasons,
      sourceStatus: 'PLDB 来源字段；尚未按本排序证明一手或官方来源可用。',
    };
  }).sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return {
    schemaVersion: 1,
    scope: 'A deterministic triage pool for never-researched field-only relationships. Scores prioritize visitor relevance and available project context; they do not verify, infer, or rank historical truth.',
    source: {
      relationshipCoverage: 'data/audit/relationship-research-coverage.json',
      relationshipStatus: 'data/audit/relationship-status.json',
      labelSelection: 'data/audit/label-selection.json',
      learningPaths: 'data/learning-paths.json',
      catalogue: 'data/raw/pldb.json',
      statusInputHashes: status.inputHashes,
    },
    exclusions: {
      researchedNoResultClosed: closed.length,
      researchedNoResultBlocked: blocked.length,
      rule: 'Closed and blocked entries are excluded until their ledger reopenWhen condition is met.',
    },
    scoring: {
      mapVisibleBothEndpoints: 40,
      relationType: { supersetOf: 30, successorOf: 24, influencedBy: 15 },
      top50Endpoint: '32 + (51 - TIOBE rank) per endpoint',
      narrativeAnchorEndpoint: 20,
      learningGuideEndpoint: 12,
      verifiedLanguageEndpoint: 8,
      historicalPrimarySourceEndpoint: 7,
      websiteCueEndpoint: 10,
      creatorCueEndpoint: 5,
      relatedTechnologyOrNotationEndpoint: -16,
      sourceAvailability: 'Not scored: a PLDB source field is only a lead. Each selected item still needs a separately recorded primary or official source.',
    },
    counts: { candidates: candidates.length, top20: Math.min(20, candidates.length) },
    candidates,
  };
}

function writeReport(report = generatePriorityReport()) {
  fs.writeFileSync(path.join(root, 'data/audit/relationship-research-priorities.json'), JSON.stringify(report, null, 2) + '\n');
  const rows = report.candidates.slice(0, 20).map((row, index) =>
    `| ${index + 1} | ${row.key.replaceAll('|', ' → ')} | ${row.score} | ${row.reasons.map(reason => `${reason.reason} (+${reason.points})`).join('；')} |`
  );
  const md = `# 未研究关系优先级候选池

由 \`npm run research:priorities\` 离线生成。它只从当前“从未进入已记录研究批次”的来源字段关系中排序，排除已收口和受阻项；分数用于决定下一批查哪几条，**不是关系已成立、也不是一手资料已经存在的证明**。

## 当前范围

- 候选：${report.counts.candidates} 条（即当前 coverage 的 neverResearched）
- 已排除：${report.exclusions.researchedNoResultClosed} 条已收口、${report.exclusions.researchedNoResultBlocked} 条受阻
- 下一批建议只从本表前列挑 5～8 条；仍须逐条寻找并记录官方或一手原文。找不到合格来源时，按台账标为收口或受阻，之后不会再被放回候选池，除非满足 \`reopenWhen\`。

## 排序规则

- 两端同在当前地图范围、关系类型、常显关注语言、叙事锚点、学习导览端点，以及端点既有核验状态会加分。
- 当前原始来源字段多为 PLDB 线索，不能据此给“官网可得性”加分；实际研究时仍先找规范、作者材料、官方文档或固定官方仓库版本。
- 同分按关系键稳定排序；全量 ${report.counts.candidates} 条及输入哈希见 [机器可读清单](../../data/audit/relationship-research-priorities.json)。

## 前 ${report.counts.top20} 条

| 排名 | 关系 | 分数 | 入选原因 |
| ---: | --- | ---: | --- |
${rows.join('\n')}
`;
  fs.writeFileSync(path.join(root, 'docs/audit/RELATIONSHIP_RESEARCH_PRIORITIES.md'), md);
  return report;
}

if (require.main === module) {
  const report = writeReport();
  console.log(`Wrote ${report.counts.candidates} never-researched relationship priorities.`);
}

module.exports = { generatePriorityReport, scoreCandidate, writeReport };
