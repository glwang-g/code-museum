"""Audit the pinned collection and relationship graph without promoting leads to facts.

Run with: python3 scripts/audit-integrity.py
Outputs are deterministic for the checked-in inputs and require no network access.
"""

import collections
import csv
import hashlib
import json
import re
import subprocess
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/audit'
CUES = re.compile(r'\b(derived from|based on|modelled on|modeled on|successor to|'
                  r'dialect of|implementation of|influenced by|evolved from|extension of)\b', re.I)


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def write_json(path, value):
    (OUT / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def write_csv(path, rows, fields):
    with (OUT / path).open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            # These files are often opened in a spreadsheet.
            writer.writerow({key: "'" + value if isinstance(value, str) and value.startswith(('=', '+', '-', '@')) else value
                             for key, value in row.items()})



def write_map_status(summary, label_review):
    """Keep the reader-facing current gap list tied to the same audited rows."""
    missing = [row for row in label_review if row['map_link_count'] == 0]
    linked = summary['map_nodes'] - summary['map_nodes_without_visible_links']
    linked_labels = summary['map_label_nodes'] - len(missing)
    field_only = summary['relationship_evidence_status_counts'].get('record-field-only', 0)
    lines = [
        '# 当前地图关系审计状态', '',
        '由 `npm run audit` 从固定快照、人工关系及地图资格输入生成。研究说明见 [地图关系复核](MAP_LINEAGE.md)。', '',
        '## 覆盖与证据', '',
        f"- 地图节点 {summary['map_nodes']} 个：{linked} 个参与设计层地图内关系，{summary['map_nodes_without_visible_links']} 个暂无该层连线。",
        f"- 常显标签 {summary['map_label_nodes']} 个：{linked_labels} 个有设计层地图内关系，{len(missing)} 个暂无该层连线。",
        f"- 规范化关系 {summary['relationship_count']} 条，其中 {field_only} 条仍只有来源字段级依据，尚需逐条史料复核。", '',
        '缺失记录不表示没有上游；地图外关系不自动成为地图内连线。实现与生态边独立展示，不计入这里的设计层数量。', '',
        '## 暂无设计层地图内连线的常显标签', '',
        '| 语言 | 馆藏 ID | 地图外关系数 | 待核语句线索数 |',
        '| --- | --- | ---: | ---: |'
    ]
    for row in missing:
        name = row['name'].replace('|', chr(92) + '|').replace('\n', ' ')
        lines.append(f"| {name} | `{row['id']}` | {row['links_to_nonmap_items']} | {row['phrase_leads_on_map']} |")
    if not missing:
        lines.append('| 当前没有缺口条目 | — | 0 | 0 |')
    lines += ['', '语句线索仅供研究，不作为已确认关系。完整节点及来源逐项表见 [地图表](map-lineage-review.csv)、[标签表](label-lineage-review.csv)与[关系表](relationship-review.csv)。', '']
    (OUT / 'MAP_STATUS.md').write_text('\n'.join(lines), encoding='utf-8')


def normalized(value):
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKC', value).casefold()).strip('-')


def words(value):
    return str(value or '').split()


def linguist_entries(text):
    """Read only the top-level name and type fields of Linguist's simple YAML map."""
    entries = []
    for line in text.splitlines():
        if line and not line[0].isspace() and not line.startswith('#') and line != '---' and line.endswith(':'):
            entries.append({'name': line[:-1].strip().strip('"\''), 'type': ''})
        elif line.startswith('  type: ') and entries:
            entries[-1]['type'] = line.split(':', 1)[1].strip()
    if not entries or any(not entry['type'] for entry in entries):
        raise ValueError('Cannot read Linguist language names and types')
    return entries


def main():
    raw = (ROOT / 'data/raw/pldb.json').read_bytes()
    snapshot = read_json('data/raw/pldb.snapshot.json')
    digest = hashlib.sha256(raw).hexdigest()
    if digest != snapshot['sha256']:
        raise ValueError('PLDB snapshot checksum mismatch')
    records = json.loads(raw)
    corrected_records = json.loads(subprocess.check_output(['node', str(ROOT/'scripts/validate-reviews.cjs'), '--catalogue']))
    by_id = {record['id']: record for record in corrected_records}
    if len(by_id) != len(records) or len(records) != snapshot['count']:
        raise ValueError('Duplicate IDs or snapshot count mismatch')
    reviews = {review['id']: review for review in read_json('data/audit/reviews.json')['reviews']}
    alias_curation = read_json('data/audit/alias-curation.json')
    map_ids = set(read_json('data/audit/map-eligible-ids.json')['ids'])
    label_selection = read_json('data/audit/label-selection.json')
    label_ids = {row['mapId'] for row in label_selection['top50'] if row['mapId']}
    label_ids.update(row['id'] for row in label_selection['historicalAnchors'] + label_selection['relationshipContext'])
    if not label_ids <= map_ids:
        raise ValueError('Map label selection contains an ineligible ID')
    overrides = read_json('data/relationship-overrides.json')
    if not (set(reviews) | map_ids) <= set(by_id):
        raise ValueError('Unknown reviewed or map ID')
    OUT.mkdir(parents=True, exist_ok=True)

    # 1. Identity and source coverage. A shared name or alias is a review lead.
    names = collections.defaultdict(list)
    for record in records:
        names[normalized(record['name'])].append(record['id'])
    issues = []
    # Display corrections can expose a second raw record for the same name.
    # This is an identity lead, not permission to merge IDs or invent lineage.
    for ident, review in reviews.items():
        for change in review.get('catalogueCorrection', {}).get('changes', []):
            if change['field'] != 'name':
                continue
            corrected_name = re.sub(r'\s*\([^)]*\)\s*$', '', change['to'])
            other_ids = sorted(set(names.get(normalized(corrected_name), [])) - {ident})
            if other_ids:
                issues.append({'kind': 'corrected-name-overlap', 'name_or_alias': corrected_name,
                               'record_ids': ident + ' | ' + ' | '.join(other_ids),
                               'finding': 'Reviewed display name overlaps another pinned record; resolve identity and date events before merging or treating as distinct languages.'})
    for key, ids in sorted(names.items()):
        if len(ids) > 1:
            issues.append({'kind': 'same-display-name', 'name_or_alias': key, 'record_ids': ' | '.join(sorted(ids)),
                           'finding': 'Check whether these are homonyms, versions, or duplicates.'})
    for record in records:
        for alias in re.split(r'\s+or\s+', record.get('githubLanguage_aliases') or ''):
            alias = alias.strip()
            if not alias:
                continue
            other_ids = sorted(set(names.get(normalized(alias), [])) - {record['id']})
            if other_ids:
                issues.append({'kind': 'alias-equals-other-name', 'name_or_alias': alias,
                               'record_ids': record['id'] + ' | ' + ' | '.join(other_ids),
                               'finding': 'The source alias may merge distinct languages; review before indexing.'})
    for item in alias_curation:
        if item['id'] not in by_id:
            raise ValueError('Unknown alias curation ID: ' + item['id'])
        for alias in item['exclude']:
            issues.append({'kind': 'curated-false-alias', 'name_or_alias': alias, 'record_ids': item['id'],
                           'finding': item['reason']})
    issues.sort(key=lambda item: (item['kind'], normalized(item['name_or_alias']), item['record_ids']))
    write_csv('identity-issues.csv', issues, ['kind', 'name_or_alias', 'record_ids', 'finding'])

    linguist_file = (ROOT / 'data/raw/linguist-languages.yml').read_bytes()
    linguist_manifest = read_json('data/raw/linguist.snapshot.json')
    if hashlib.sha256(linguist_file).hexdigest() != linguist_manifest['sha256']:
        raise ValueError('Linguist snapshot checksum mismatch')
    if hashlib.sha256((ROOT / linguist_manifest['licenseFile']).read_bytes()).hexdigest() != linguist_manifest['licenseSha256']:
        raise ValueError('Linguist license checksum mismatch')
    aliases = collections.defaultdict(set)
    alias_exclusions = {item['id']: {normalized(alias) for alias in item['exclude']} for item in alias_curation}
    for record in records:
        for alias in re.split(r'\s+or\s+', record.get('githubLanguage_aliases') or ''):
            if alias.strip() and normalized(alias.strip()) not in alias_exclusions.get(record['id'], set()):
                aliases[normalized(alias.strip())].add(record['id'])
    crosscheck = []
    linguist = linguist_entries(linguist_file.decode('utf-8'))
    for entry in linguist:
        if entry['type'] != 'programming':
            continue
        key = normalized(entry['name'])
        exact = names.get(key, [])
        alias_matches = sorted(aliases.get(key, set()))
        id_candidate = [slug(entry['name'])] if slug(entry['name']) in by_id else []
        crosscheck.append({'linguist_name': entry['name'], 'linguist_type': entry['type'],
                           'match_status': 'exact-name' if exact else 'source-alias' if alias_matches else
                               'id-slug-candidate' if id_candidate else 'name-unmatched',
                           'pldb_ids': ' | '.join(sorted(exact or alias_matches or id_candidate)),
                           'review_note': 'A name mismatch alone does not prove PLDB is missing this language.'})
    crosscheck.sort(key=lambda row: normalized(row['linguist_name']))
    write_csv('linguist-crosscheck.csv', crosscheck,
              ['linguist_name', 'linguist_type', 'match_status', 'pldb_ids', 'review_note'])

    source_fields = ('hopl', 'hoplId', 'spec', 'website', 'githubRepo', 'wikipedia', 'semanticScholar')
    source_counts = {field: sum(bool(record.get(field)) for record in records) for field in source_fields}
    reviewed_sources = [source for review in reviews.values() for source in review.get('sources', []) if source.get('reviewed')]
    review_gaps = []
    for record in records:
        review = reviews.get(record['id'])
        if not review:
            continue
        if review['status'] == 'verified-language':
            roles = {source.get('role') for source in review.get('sources', []) if source.get('reviewed')}
            missing = []
            if review.get('syntax') != 'documented' or not roles.intersection({'语法', '语法与实现'}):
                missing.append('syntax')
            if review.get('implementation') != 'documented' or not roles.intersection({'实现', '语法与实现'}):
                missing.append('implementation')
            if missing:
                review_gaps.append({'id': record['id'], 'name': record['name'], 'missing': ' | '.join(missing)})
    write_csv('review-gaps.csv', review_gaps, ['id', 'name', 'missing'])

    # 2. Every edge gets a separate evidence status. A PLDB concept link only
    # proves where the field came from; it does not verify the historical claim.
    edges = {}
    for record in records:
        for relation_type in ('influencedBy', 'supersetOf'):
            for parent in words(record.get(relation_type)):
                edge = {'from': parent, 'to': record['id'], 'type': relation_type,
                        'origin': 'pldb-field', 'source': 'https://github.com/breck7/pldb/blob/main/concepts/' + record['id'] + '.scroll',
                        'evidence': '', 'evidence_status': 'record-field-only'}
                edges[parent, record['id'], relation_type] = edge
    for item in overrides:
        if item.get('replacesType'):
            old_key = (item['from'], item['to'], item['replacesType'])
            if old_key not in edges or item['replacesType'] == item['type']:
                raise ValueError('Invalid reviewed relationship replacement')
            del edges[old_key]
        edge = {'from': item['from'], 'to': item['to'], 'type': item['type'], 'origin': 'curated-override',
                'source': item.get('source', ''), 'source_sha256': item.get('sourceSha256', ''), 'evidence': item.get('evidence', ''),
                'evidence_status': 'claim-with-citation' if item.get('source') and item.get('evidence') else 'citation-or-excerpt-missing'}
        edges[edge['from'], edge['to'], edge['type']] = edge
    edge_rows = []
    incident = collections.Counter()
    known_pairs = set()
    for edge in sorted(edges.values(), key=lambda e: (e['from'], e['to'], e['type'])):
        parent, child = by_id.get(edge['from']), by_id.get(edge['to'])
        if not parent or not child:
            raise ValueError('Unknown relationship endpoint: ' + edge['from'] + ' -> ' + edge['to'])
        incident[parent['id']] += 1
        incident[child['id']] += 1
        known_pairs.add((parent['id'], child['id']))
        parent_year, child_year = parent.get('appeared'), child.get('appeared')
        try:
            chronology = 'parent-year-later' if parent_year and child_year and int(parent_year) > int(child_year) else ''
        except (TypeError, ValueError):
            chronology = 'year-unparseable'
        edge_rows.append({**edge, 'from_name': parent['name'], 'to_name': child['name'],
                          'from_year': parent_year or '', 'to_year': child_year or '',
                          'map_visible': parent['id'] in map_ids and child['id'] in map_ids,
                          'chronology_flag': chronology,
                          'self_link': parent['id'] == child['id'],
                          'nonlanguage_endpoint': not (parent.get('isLanguage') and child.get('isLanguage'))})
    write_csv('relationship-review.csv', edge_rows,
              ['from', 'from_name', 'to', 'to_name', 'type', 'origin', 'source', 'source_sha256', 'evidence', 'evidence_status',
               'from_year', 'to_year', 'map_visible', 'chronology_flag', 'self_link', 'nonlanguage_endpoint'])

    # 3. Phrase matches are only research leads. Related-links are deliberately ignored.
    target_names = [(record['id'], record['name']) for record in records if record['id'] in map_ids and len(record['name']) >= 4]
    target_patterns = [(ident, name, re.compile(r'(?<!\w)' + re.escape(name) + r'(?!\w)', re.I))
                       for ident, name in target_names]
    leads = {}
    for child in records:
        if not child.get('isLanguage'):
            continue
        for field in ('wikipedia_summary', 'description'):
            prose = child.get(field) or ''
            for cue in CUES.finditer(prose):
                fragment = prose[cue.end():cue.end() + 180].split('.')[0]
                own_name = re.search(r'(?<!\w)' + re.escape(child['name']) + r'(?!\w)', fragment, re.I)
                matches = [(match.start(), -len(name), ident, name) for ident, name, pattern in target_patterns
                           if ident != child['id'] for match in [pattern.search(fragment)]
                           if match and (not own_name or match.start() <= own_name.start())]
                if not matches:
                    continue
                _, _, parent_id, parent_name = min(matches)
                if (parent_id, child['id']) in known_pairs:
                    continue
                key = (parent_id, child['id'])
                excerpt = prose[max(0, cue.start() - 50):min(len(prose), cue.end() + 180)].replace('\n', ' ')
                leads.setdefault(key, {'from': parent_id, 'from_name': parent_name, 'to': child['id'],
                                       'to_name': child['name'], 'cue': cue.group(1).lower(), 'source_field': field,
                                       'source_record': 'https://github.com/breck7/pldb/blob/main/concepts/' + child['id'] + '.scroll',
                                       'secondary_source': child.get('wikipedia') or '',
                                       'excerpt': excerpt, 'map_visible_if_confirmed': parent_id in map_ids and child['id'] in map_ids,
                                       'status': 'candidate-needs-source-review'})
    lead_rows = sorted(leads.values(), key=lambda row: (not row['map_visible_if_confirmed'], row['to'], row['from']))
    write_csv('relationship-candidates.csv', lead_rows,
              ['from', 'from_name', 'to', 'to_name', 'cue', 'source_field', 'source_record', 'secondary_source', 'excerpt',
               'map_visible_if_confirmed', 'status'])
    isolates = [{'id': ident, 'name': by_id[ident]['name'], 'year': by_id[ident].get('appeared') or '',
                 'review_status': reviews.get(ident, {}).get('status', 'unreviewed')}
                for ident in sorted(map_ids) if incident[ident] == 0]
    write_csv('map-isolates.csv', isolates, ['id', 'name', 'year', 'review_status'])

    # One row per map point, including links to items outside the map. This is a
    # completeness checklist, not a claim that a missing link does not exist.
    map_links = collections.defaultdict(list)
    all_links = collections.defaultdict(list)
    map_leads = collections.defaultdict(list)
    for edge in edge_rows:
        for ident in (edge['from'], edge['to']):
            if ident in map_ids:
                all_links[ident].append(edge)
                if edge['map_visible']:
                    map_links[ident].append(edge)
    for lead in lead_rows:
        if lead['map_visible_if_confirmed']:
            map_leads[lead['from']].append(lead)
            map_leads[lead['to']].append(lead)
    map_review = []
    for ident in sorted(map_ids):
        visible = map_links[ident]
        incoming = sorted(edge['from'] for edge in visible if edge['to'] == ident)
        outgoing = sorted(edge['to'] for edge in visible if edge['from'] == ident)
        curated = sum(edge['evidence_status'] == 'claim-with-citation' for edge in visible)
        field_only = sum(edge['evidence_status'] == 'record-field-only' for edge in visible)
        status = ('no-map-link' if not visible else 'field-only' if not curated else
                  'cited-and-field' if field_only else 'cited-only')
        map_review.append({
            'id': ident, 'name': by_id[ident]['name'], 'year': by_id[ident].get('appeared') or '',
            'language_review': reviews.get(ident, {}).get('status', 'unreviewed'),
            'map_upstream': ' | '.join(incoming), 'map_downstream': ' | '.join(outgoing),
            'map_link_count': len(visible), 'cited_map_links': curated,
            'field_only_map_links': field_only,
            'links_to_nonmap_items': len(all_links[ident]) - len(visible),
            'phrase_leads_on_map': len(map_leads[ident]),
            'phrase_lead_ids': ' | '.join(sorted({
                (lead['from'] if lead['to'] == ident else lead['to']) for lead in map_leads[ident]})),
            'relation_review_state': status
        })
    write_csv('map-lineage-review.csv', map_review,
              ['id', 'name', 'year', 'language_review', 'map_upstream', 'map_downstream',
               'map_link_count', 'cited_map_links', 'field_only_map_links', 'links_to_nonmap_items',
               'phrase_leads_on_map', 'phrase_lead_ids', 'relation_review_state'])
    label_review = [row for row in map_review if row['id'] in label_ids]
    write_csv('label-lineage-review.csv', label_review,
              ['id', 'name', 'year', 'language_review', 'map_upstream', 'map_downstream',
               'map_link_count', 'cited_map_links', 'field_only_map_links', 'links_to_nonmap_items',
               'phrase_leads_on_map', 'phrase_lead_ids', 'relation_review_state'])

    summary = {
        'snapshot_sha256': digest, 'records': len(records), 'source_marked_languages': sum(bool(r.get('isLanguage')) for r in records),
        'independent_catalogue_comparison': 'limited-name-crosscheck-with-linguist; HOPL full roster not licensed for copying',
        'linguist_commit': linguist_manifest['commit'],
        'linguist_entries': len(linguist), 'linguist_programming_entries': len(crosscheck),
        'linguist_match_status_counts': dict(collections.Counter(row['match_status'] for row in crosscheck)),
        'source_field_counts': source_counts, 'manual_reviews': len(reviews),
        'reviewed_source_links': len(reviewed_sources), 'reviewed_source_links_with_url_hash_excerpt':
            sum(bool(s.get('url') and s.get('decodedBodySha256') and s.get('excerpt')) for s in reviewed_sources),
        'verified_language_review_gaps': len(review_gaps), 'identity_issue_rows': len(issues),
        'relationship_count': len(edge_rows), 'relationship_evidence_status_counts':
            dict(collections.Counter(row['evidence_status'] for row in edge_rows)),
        'relationship_chronology_flags': sum(bool(row['chronology_flag']) for row in edge_rows),
        'relationship_self_links': sum(bool(row['self_link']) for row in edge_rows),
        'relationship_nonlanguage_endpoints': sum(bool(row['nonlanguage_endpoint']) for row in edge_rows),
        'map_nodes': len(map_ids), 'map_isolates': len(isolates),
        'map_nodes_without_visible_links': sum(row['map_link_count'] == 0 for row in map_review),
        'map_nodes_with_field_only_links': sum(row['relation_review_state'] == 'field-only' for row in map_review),
        'map_label_nodes': len(label_review),
        'map_labels_without_visible_links': sum(row['map_link_count'] == 0 for row in label_review),
        'phrase_based_relationship_candidates': len(lead_rows)
    }
    write_json('integrity-summary.json', summary)
    write_map_status(summary, label_review)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
