"""Produce a full evidence inventory from the pinned snapshot and reviewed sources.

Offline only. Metadata signals never become a manual confirmation automatically.
Run after updating data/audit/reviews.json or runtime-checks.json.
"""
import collections
import csv
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'docs/audit'
STATUS = {
    'verified-language': '已核语法与实现文档',
    'historical-primary-source': '历史语言：一手文献支持',
    'bibliographic-only': '有论文书目：语法与实现待核',
    'verified-formal-language': '已核形式语言/数据语法',
    'verified-related-technology': '已核相关技术：不是独立程序语言',
    'review-blocked': '本次来源访问受阻',
    'unreviewed': '尚未逐条人工核实',
}
KIND = {
    'programming': '编程语言', 'domain-language': '专用/查询/脚本/硬件语言',
    'formal-notation': '标记/样式/数据语法', 'related-tool': '编程相关工具或库',
    'encoding-protocol': '编码或协议', 'historical-language': '历史语言',
    'unresolved': '性质待核', 'programming-candidate': '语言候选（仅按来源分类）',
    'domain-candidate': '专用或形式语言候选', 'notation-candidate': '记法或格式候选',
    'tool-candidate': '工具或库候选', 'standard-candidate': '协议/编码/标准候选',
    'other-candidate': '其他技术/性质待核',
}
GROUPS = {
    'programming-candidate': set('pl esolang visual plzoo'.split()),
    'domain-candidate': set('queryLanguage grammarLanguage template contractLanguage dataValidationLanguage hardwareDescriptionLanguage diagramLang assembly bytecode ir idl dataFlow'.split()),
    'notation-candidate': set('textMarkup stylesheetLanguage dataNotation xmlFormat textDataFormat notation jsonFormat schema configFormat wikiMarkup dataVis musicalNotation headerLang yamlFormat'.split()),
    'tool-candidate': set('library compiler interpreter staticSiteGenerator unixApplication framework application ide editor'.split()),
    'standard-candidate': set('protocol isa standard barCodeFormat numeralSystem characterEncoding textEncodingFormat timeFormat diffFormat'.split()),
}
EXAMPLE_FIELDS = ['example', 'leachim6_example', 'linguistGrammarRepo_example', 'rijuRepl_example', 'wikipedia_example', 'compilerExplorer_example']
LINK_FIELDS = ['spec', 'website', 'githubRepo', 'rijuRepl', 'reference', 'hopl', 'wikipedia', 'specRepo']

def validate_algol60_execution(extra):
    if extra.get('id') != 'algol-60' or extra.get('status') != 'sample-passed' or len(extra.get('samples', [])) != 3:
        raise ValueError('Invalid supplementary ALGOL 60 runtime audit')
    for sample in extra['samples']:
        commands = sample.get('commands', [])
        if (sample.get('status') != 'sample-passed' or len(commands) != 3 or any(c.get('exitCode') != 0 for c in commands)
                or commands[-1].get('stdout', '').strip() != sample.get('expectedStdout')
                or hashlib.sha256(sample.get('sample', '').encode()).hexdigest() != sample.get('sampleSha256')):
            raise ValueError('Inconsistent ALGOL 60 sample execution evidence')
    if extra.get('invalidSyntax', {}).get('exitCode') in (None, 0):
        raise ValueError('Missing ALGOL 60 invalid syntax rejection')
    return extra


def validate_xslt_execution(extra):
    if extra.get('id') != 'xslt' or extra.get('status') != 'sample-passed' or not extra.get('version'):
        raise ValueError('Invalid supplementary XSLT execution audit')
    if hashlib.sha256(extra.get('input', '').encode()).hexdigest() != extra.get('inputSha256'):
        raise ValueError('Changed XSLT input evidence')
    samples = extra.get('samples', [])
    if len(samples) != 2 or [s.get('expectedStdout') for s in samples] != ['55', '8,9,10,']:
        raise ValueError('Missing XSLT sample cases')
    for sample in samples:
        command = sample.get('command', {})
        if (sample.get('status') != 'sample-passed' or command.get('exitCode') != 0
                or command.get('stdout') != sample['expectedStdout']
                or hashlib.sha256(sample.get('sample', '').encode()).hexdigest() != sample.get('sampleSha256')
                or '--nonet' not in command.get('commandTemplate', [])):
            raise ValueError('Inconsistent XSLT execution evidence')
    invalid = extra.get('invalidSyntax', {})
    if (not isinstance(invalid.get('exitCode'), int) or invalid['exitCode'] == 0 or not invalid.get('stderr')
            or hashlib.sha256(invalid.get('sample', '').encode()).hexdigest() != invalid.get('sampleSha256')):
        raise ValueError('Missing XSLT invalid expression rejection')
    return extra


def validate_ksh93_execution(extra):
    if (extra.get('id') != 'korn-shell' or extra.get('status') != 'sample-passed'
            or '93' not in extra.get('version', '') or extra.get('versionExitCode') != 0):
        raise ValueError('Invalid supplementary ksh93 execution audit')
    samples = extra.get('samples', [])
    if len(samples) != 2 or [s.get('expectedStdout') for s in samples] != ['55\n', '12\n']:
        raise ValueError('Missing ksh93 sample cases')
    for sample in samples:
        command, syntax = sample.get('command', {}), sample.get('syntaxCheck', {})
        if (sample.get('status') != 'sample-passed' or command.get('exitCode') != 0 or syntax.get('exitCode') != 0
                or command.get('stdout') != sample['expectedStdout']
                or hashlib.sha256(sample.get('sample', '').encode()).hexdigest() != sample.get('sampleSha256')
                or syntax.get('commandTemplate') != ['ksh', '-n', sample.get('name', '')+'.ksh']
                or command.get('commandTemplate') != ['ksh', sample.get('name', '')+'.ksh']):
            raise ValueError('Inconsistent ksh93 execution evidence')
    invalid = extra.get('invalidSyntax', {})
    if (not isinstance(invalid.get('exitCode'), int) or invalid['exitCode'] == 0 or not invalid.get('stderr')
            or invalid.get('commandTemplate') != ['ksh', '-n', 'invalid-syntax.ksh']
            or hashlib.sha256(invalid.get('sample', '').encode()).hexdigest() != invalid.get('sampleSha256')):
        raise ValueError('Missing ksh93 syntax rejection')
    return extra


def validate_tcsh_execution(extra):
    if (extra.get('id') != 'tcsh' or extra.get('status') != 'sample-passed'
            or not extra.get('version', '').startswith('tcsh ') or extra.get('versionExitCode') != 0
            or extra.get('versionCommand') != ['tcsh', '--version']):
        raise ValueError('Invalid supplementary tcsh execution audit')
    samples = extra.get('samples', [])
    if len(samples) != 2 or [s.get('expectedStdout') for s in samples] != ['55\n', 'Lisp\n']:
        raise ValueError('Missing tcsh sample cases')
    for sample in samples:
        command, syntax = sample.get('command', {}), sample.get('syntaxCheck', {})
        if (sample.get('status') != 'sample-passed' or command.get('exitCode') != 0 or syntax.get('exitCode') != 0
                or command.get('stdout') != sample['expectedStdout']
                or hashlib.sha256(sample.get('sample', '').encode()).hexdigest() != sample.get('sampleSha256')
                or syntax.get('commandTemplate') != ['tcsh', '-f', '-n', sample.get('name', '')+'.tcsh']
                or command.get('commandTemplate') != ['tcsh', '-f', sample.get('name', '')+'.tcsh']):
            raise ValueError('Inconsistent tcsh execution evidence')
    invalid = extra.get('invalidSyntax', {})
    if (not isinstance(invalid.get('exitCode'), int) or invalid['exitCode'] == 0 or not invalid.get('stderr')
            or invalid.get('commandTemplate') != ['tcsh', '-f', '-n', 'invalid-syntax.tcsh']
            or hashlib.sha256(invalid.get('sample', '').encode()).hexdigest() != invalid.get('sampleSha256')):
        raise ValueError('Missing tcsh syntax rejection')
    return extra


def main():
    raw = (ROOT/'data/raw/pldb.json').read_bytes()
    snapshot = json.loads((ROOT/'data/raw/pldb.snapshot.json').read_text())
    if hashlib.sha256(raw).hexdigest() != snapshot['sha256']:
        raise ValueError('Pinned snapshot hash mismatch')
    # Use the same evidence guard as the offline Node build before writing audit outputs.
    subprocess.run(['node', str(ROOT/'scripts/validate-reviews.cjs')], check=True)
    original_records = {r['id']: r for r in json.loads(raw)}
    records = json.loads(subprocess.check_output(['node', str(ROOT/'scripts/validate-reviews.cjs'), '--catalogue']))
    review_file = json.loads((ROOT/'data/audit/reviews.json').read_text())
    reviews = {r['id']: r for r in review_file['reviews']}
    curation = json.loads((ROOT/'data/audit/map-curation.json').read_text())
    exclusions = {item['id']: item['reason'] for item in curation['exclude']}
    notation_exceptions = {item['id'] for item in curation['allowNotation']}
    ids = {r['id'] for r in records}
    if len(reviews) != len(review_file['reviews']) or not reviews.keys() <= ids:
        raise ValueError('Duplicate or unknown reviewed ID')
    if (len(exclusions) != len(curation['exclude']) or len(notation_exceptions) != len(curation['allowNotation'])
            or not (exclusions.keys() | notation_exceptions) <= ids or exclusions.keys() & notation_exceptions):
        raise ValueError('Invalid map curation ID')
    runtime = json.loads((ROOT/'data/audit/runtime-checks.json').read_text())
    executions = {r['id']: r for r in runtime['results']}
    extra_path = ROOT/'data/audit/algol60-runtime-checks.json'
    if extra_path.is_file():
        extra = json.loads(extra_path.read_text())
        validate_algol60_execution(extra)
        executions[extra['id']] = extra
    xslt_path = ROOT/'data/audit/xslt-runtime-checks.json'
    if xslt_path.is_file():
        extra = validate_xslt_execution(json.loads(xslt_path.read_text()))
        executions[extra['id']] = extra
    ksh_path = ROOT/'data/audit/ksh93-runtime-checks.json'
    if ksh_path.is_file():
        extra = validate_ksh93_execution(json.loads(ksh_path.read_text()))
        executions[extra['id']] = extra
    tcsh_path = ROOT/'data/audit/tcsh-runtime-checks.json'
    if tcsh_path.is_file():
        extra = validate_tcsh_execution(json.loads(tcsh_path.read_text()))
        executions[extra['id']] = extra
    rows = []
    for record in sorted(records, key=lambda r: (r['name'].casefold(), r['id'])):
        ident = record['id']
        tag = record.get('primaryTag', '')
        kind = next((k for k,v in GROUPS.items() if tag in v), 'other-candidate')
        review = reviews.get(ident, {})
        signals = [k for k in LINK_FIELDS if record.get(k)]
        example_fields = [k for k in EXAMPLE_FIELDS if record.get(k)]
        if example_fields:
            signals += ['示例字段：'+','.join(example_fields)]
        if record.get('compilerExplorer'):
            signals += ['Compiler Explorer 收录线索']
        if record.get('githubLanguage_interpreters'):
            signals += ['解释器名称：'+record['githubLanguage_interpreters']]
        if record.get('description'):
            signals += ['简介字段']
        syntax_hint = bool(record.get('spec') or example_fields)
        runtime_hint = any(record.get(k) for k in ['rijuRepl','compilerExplorer','githubLanguage_interpreters'])
        rich_hint = any(record.get(k) for k in ['website','spec','githubRepo','description',*EXAMPLE_FIELDS])
        tier = '语法/示例与执行工具线索' if syntax_hint and runtime_hint else ('官网/规范/代码/说明线索' if rich_hint else '仅目录、百科或引文等线索')
        source_links = [str(record[k]) for k in LINK_FIELDS if record.get(k)]
        runtime_result = executions.get(ident, {})
        reviewed_sources = review.get('sources', [])
        next_step = review.get('nextStep', '阅读一手语法资料；确认对应编译器/解释器/处理器与方言；用固定版本运行独立示例。')
        rows.append({
            'id': ident, 'name': record['name'], 'source_name': original_records[ident]['name'],
            'source_year': original_records[ident].get('appeared',''), 'display_year': record.get('appeared',''),
            'source_creators': original_records[ident].get('creators',''),
            'source_creators_present': 'creators' in original_records[ident], 'display_creators': record.get('creators',''),
            'catalogue_correction': review.get('catalogueCorrection', {}).get('reason', ''),
            'source_is_language': bool(record.get('isLanguage')), 'source_primary_tag': tag,
            'review_status': review.get('status','unreviewed'),
            'classification': 'related-tool' if ident in exclusions else review.get('kind',kind), 'snapshot_evidence_tier': tier,
            'snapshot_signals': ' | '.join(signals), 'snapshot_source_links': ' | '.join(source_links),
            'syntax_evidence': review.get('syntax','not-reviewed'),
            'implementation_evidence': review.get('implementation','not-reviewed'),
            'implementation_name': review.get('implementationName',''),
            'reviewed_source_links': ' | '.join(s['url'] for s in reviewed_sources if s.get('reviewed')),
            'local_execution': runtime_result.get('status','not-tested'),
            'local_version': runtime_result.get('version','').replace('\n',' | '),
            'notes': review.get('notes',exclusions.get(ident,'来源 isLanguage 标记不是本项目核实结论。')),
            'next_step': next_step,
        })
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT/'catalogue.csv').open('w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        # Prefix spreadsheet formula introducers without dropping the original ID.
        for row in rows:
            writer.writerow({k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@')) else v) for k,v in row.items()})
    source_languages = [r for r in rows if r['source_is_language']]
    statuses = collections.Counter(r['review_status'] for r in rows)
    suspicious = [r for r in source_languages if r['classification'] in ['tool-candidate','standard-candidate','related-tool','encoding-protocol']]
    sparse = [r for r in source_languages if r['snapshot_evidence_tier']=='仅目录、百科或引文等线索']
    confirmed = [r for r in rows if r['review_status']=='verified-language']
    # The map is a provenanced overview, not a mirror of every upstream isLanguage flag.
    # Require a syntax/example signal and an execution-tool signal, or a manual review.
    excluded_kinds = {'tool-candidate','standard-candidate','notation-candidate','formal-notation','related-tool','encoding-protocol','verified-related-technology','verified-formal-language'}
    eligible = [r for r in rows if r['source_is_language'] and r['id'] not in exclusions and
        (r['classification'] not in excluded_kinds or r['id'] in notation_exceptions) and (
        r['snapshot_evidence_tier']=='语法/示例与执行工具线索' or
        r['review_status'] in {'verified-language','historical-primary-source'}
    )]
    (ROOT/'data/audit/map-eligible-ids.json').write_text(json.dumps({
        'snapshot_sha256':snapshot['sha256'],
        'reviews_sha256':hashlib.sha256((ROOT/'data/audit/reviews.json').read_bytes()).hexdigest(),
        'curation_sha256':hashlib.sha256((ROOT/'data/audit/map-curation.json').read_bytes()).hexdigest(),
        'criteria':'Source marks it as a language and snapshot has syntax/example plus compiler/interpreter/runner evidence, or manual review confirms a historical language or its syntax and implementation. Notation, tool, protocol, encoding, and format categories are excluded unless a curated executable language exception is recorded. Explicit product and tool exclusions are recorded in map-curation.json.',
        'ids':[r['id'] for r in eligible]
    },ensure_ascii=False,indent=2)+'\n')
    runtime_counts = collections.Counter(r.get('status') for r in executions.values())
    summary = {'snapshot_sha256': snapshot['sha256'], 'reviewed_at': review_file['checkedAt'],
        'records':len(rows), 'source_languages':len(source_languages), 'status_counts':dict(statuses),
        'verified_language_count':len(confirmed), 'map_eligible_count':len(eligible), 'curated_map_exclusions':len(exclusions), 'sparse_source_language_count':len(sparse),
        'source_language_tool_or_standard_candidates':len(suspicious),
        'runtime_counts':dict(runtime_counts), 'language_evidence_tiers':dict(collections.Counter(r['snapshot_evidence_tier'] for r in source_languages))}
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    lines = ['# 馆藏语言证据审查', '', '核查日期：'+review_file['checkedAt']+'。', '',
      f'全量初筛覆盖 **{len(rows):,}** 条馆藏，其中来源标为语言的 **{len(source_languages):,}** 条。逐项外部文档核查覆盖 **{len(reviews)}** 条；其余条目的证据线索已逐条列出，仍未完成人工核实。', '',
      f'已核到语法资料和实现依据的语言/方言 **{len(confirmed)}** 条；本机独立示例通过 **{runtime_counts["sample-passed"]}** 条。主图按明确的语法/执行线索收录 **{len(eligible)}** 个节点。二者是不同维度。', '',
      '## 查看结果', '',
      '- [全量清单 catalogue.csv](catalogue.csv)：每条记录的来源分类、证据线索、审查结果、运行状态及下一步。',
      '- [覆盖与关系完整性审计](INTEGRITY.md)：独立目录对照、别名冲突、关系来源与缺口队列。',
      '- [人工审查记录与原文摘录](../../data/audit/reviews.json)：来源地址、取回时间、内容摘要哈希、短摘录、访问失败记录及判断范围。',
      '- 构建后可从网站 `/data/audit-reviews.json` 下载同一审查输入；`/data/provenance.json` 的 `meta.reviewEvidence` 提供文件路径、SHA-256 和覆盖数量。下载记录不等于完整原网页归档，也不代表全馆已核。',
      '- [本机执行记录](../../data/audit/runtime-checks.json)：原创样例、命令、版本、实际标准输出与错误。',
      '- [ALGOL 60 独立执行记录](../../data/audit/algol60-runtime-checks.json)：临时构建的 MARST，三条原创样例及无效语法拒绝。',
      '- [主图收录节点](../../data/audit/map-eligible-ids.json)。',
      '- [地图人工分类决定](../../data/audit/map-curation.json)：明显的工具/产品排除及可执行的记法类例外。',
      '- [汇总数据](summary.json)。', '',
      '## 判断口径', '',
      '1. **语言身份**：编程语言、DSL、查询语言、硬件描述语言可保留；标记/样式/数据语法单列；库、编译器、协议和编码单列为相关技术。',
      '2. **语法依据**：已阅读的官方手册、语言规范或实现项目文档；快照中的示例和语法高亮仓库仅作为线索。',
      '3. **实现依据**：有对应编译器、解释器、数据库执行器、仿真器或其他处理器文档；下载页面和手册不等于已经本机运行。',
      '4. **执行依据**：仅将本次成功运行的原创小程序标为通过，记录具体方言与版本。这不是完整标准符合性测试，也不代表馆内实验台已接入该运行时。',
      '5. **历史语言**：有一手资料可以确认其历史存在，即使没有核到现代可运行环境。没有证据不能直接判为不存在。', '',
      '证据强弱不按使用人数、排名、年份或热门程度决定。自动字段分组不构成逐项确认；缺少这些字段也不等于语言没有语法或实现。', '',
      '审计与构建使用同一审查记录校验：已阅读的来源必须带 URL、读取时间、成功响应状态、标题、摘录和 SHA-256；“已核语言”必须同时具备语法和实现来源，或明确标为二者合一的来源。地图筛选结果固定审查记录与分类决定的哈希，输入变化后必须重跑审计。校验只检查记录的完整性与一致性，不能代替阅读原文，也不能单凭哈希证明史料真实。', '',
      '## 汇总', '', '|审查结果|条数|','|---|---:|']
    lines += [f'|{STATUS[k]}|{v}|' for k,v in sorted(statuses.items())]
    lines += ['',f'来源标为语言但主分类属于工具、协议、编码或标准等的候选共 **{len(suspicious)}** 条。这是分类复核队列，不能仅凭主标签批量否定语言身份（例如某些工具也附带 DSL）。', '',
      f'来源语言中，缺少官网、规范、代码仓库、简介和代码示例字段的有 **{len(sparse)}** 条；其中可能仍有 HOPL、论文或百科线索。', '',
      '## 已核语法与实现的清单', '',
      '“文档已核”表示存在可追溯的语法和实现资料；“示例通过”仅针对本机记录的版本。BASIC、Scheme 等家族条目以备注中的具体方言为准。', '',
      '|条目|实现/方言|本机执行|语法与实现来源|范围说明|','|---|---|---|---|---|']
    runtime_label = {'sample-passed':'示例通过','sample-failed':'示例失败','check-error':'执行受阻','not-installed':'未安装','not-tested':'未测试'}
    for row in confirmed:
        rev=reviews[row['id']]
        refs=' · '.join(f'[{s["role"]}]({s["url"]})' for s in rev['sources'] if s.get('reviewed'))
        lines.append(f'|{row["name"]}|{row["implementation_name"]}|{runtime_label[row["local_execution"]]}|{refs}|{row["notes"]}|')
    lines += ['', '## 历史、形式语言、相关技术与受阻条目', '', '|条目|结论|说明与来源|','|---|---|---|']
    for row in rows:
        if row['review_status'] in ['unreviewed','verified-language']:continue
        rev=reviews[row['id']]
        refs=' · '.join(f'[{s["role"]}]({s["url"]})' for s in rev['sources'])
        lines.append(f'|{row["name"]}|{STATUS[row["review_status"]]}|{row["notes"]} {refs}|')
    lines += ['', '## 界限与下一步', '',
      '- 主图仅显示有语法/示例及执行环境线索、或已人工核实的条目；明显属于工具、协议、编码、标记/数据格式的项目不作为语言节点。可执行的领域语言例外与工具/产品排除记录在 map-curation.json。证据不足的项目留在全馆目录供检索，并标为待核。原始快照完整保留。',
      '- METAPI 的论文书目支持其与语言研究相关；全文语法与实现仍待查证。快照年代与论文出版年不能混作同一日期。',
      '- 本机 Lua 可执行文件因 CPU 架构不兼容而失败，不能据此否定 Lua 的实现；其他环境未安装的语言未伪造执行结果。',
      '- 审查语法和实现文档不保证任意版本互相兼容；现代实现不能证明同名历史初版已重现。官方站点访问失败也不等于对应语言不真实。',
      '- 后续按全量 CSV 的下一步逐项补证。只有人工审查记录可升级为已核，补充源码仓库或示例不会自动升级。', '',
      '## 离线重生成', '', '```sh', 'python3 scripts/audit-catalogue.py', '```', '',
      '输入为固定原始快照、人工审查记录及本机执行记录，不联网；需要 Node.js 与 Python 3，以调用与构建相同的审查记录校验器。需要重新运行本机样例时，单独执行 `python3 scripts/verify-language-samples.py`，只使用现有解释器和编译器，不安装或下载软件。', '',
      'CSV 标签对照：`verified-language`＝已核语法与实现；`historical-primary-source`＝历史一手资料；`bibliographic-only`＝书目支持；`verified-formal-language`＝形式语法；`verified-related-technology`＝相关技术；`review-blocked`＝访问受阻；`unreviewed`＝尚未逐条人工核实。', '']
    (OUT/'README.md').write_text('\n'.join(lines))
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
