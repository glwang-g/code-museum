const test=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');

test('current map gap summary removes resolved labels and is deterministic',t=>{
  const available=spawnSync('python3',['--version'],{encoding:'utf8'});
  if(available.error?.code==='ENOENT'){t.skip('Optional audit generation requires Python 3');return;}
  assert.equal(available.status,0,available.stderr);
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'museum-map-summary-'));
  try{
    const code=`
import runpy, sys
from pathlib import Path
writer=runpy.run_path(sys.argv[1])['write_map_status']
writer.__globals__['OUT']=Path(sys.argv[2])
summary={'map_nodes':2,'map_nodes_without_visible_links':2,'map_label_nodes':2,'relationship_count':0,'relationship_evidence_status_counts':{}}
rows=[{'id':'kotlin','name':'Kotlin','map_link_count':0,'links_to_nonmap_items':0,'phrase_leads_on_map':1},{'id':'assembly','name':'Assembly | dialect','map_link_count':0,'links_to_nonmap_items':2,'phrase_leads_on_map':0}]
writer(summary,rows)
file=Path(sys.argv[2])/'MAP_STATUS.md'
text=file.read_text()
assert '| Kotlin |' in text
assert chr(92)+'|' in text
rows[0]['map_link_count']=1
summary['map_nodes_without_visible_links']=1
summary['relationship_count']=1
writer(summary,rows)
text=file.read_bytes()
assert b'| Kotlin |' not in text
writer(summary,rows)
assert text==file.read_bytes()
`;
    const result=spawnSync('python3',['-c',code,path.resolve(__dirname,'../scripts/audit-integrity.py'),output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const text=fs.readFileSync(path.join(output,'MAP_STATUS.md'),'utf8');
    assert.match(text,/常显标签 2 个：1 个有设计层地图内关系，1 个暂无该层连线/);
    assert.match(text,/缺失记录不表示没有上游/);
  }finally{fs.rmSync(output,{recursive:true,force:true});}
});

test('ALGOL 60 execution audit rejects changed samples, wrong output and missing syntax rejection',t=>{
  const available=spawnSync('python3',['--version'],{encoding:'utf8'});
  if(available.error?.code==='ENOENT'){t.skip('Optional execution audit validation requires Python 3');return;}
  assert.equal(available.status,0,available.stderr);
  const code=`
import copy, json, runpy, sys
validate=runpy.run_path(sys.argv[1])['validate_algol60_execution']
record=json.load(open(sys.argv[2]))
validate(record)
def reject(change):
    altered=copy.deepcopy(record)
    change(altered)
    try: validate(altered)
    except ValueError: return
    raise AssertionError('Inconsistent execution evidence accepted')
reject(lambda r: r['samples'][0]['commands'][-1].update(stdout='54'))
reject(lambda r: r['samples'][0].update(sample='different program'))
reject(lambda r: r['invalidSyntax'].update(exitCode=0))
reject(lambda r: r['samples'][0]['commands'][0].update(exitCode=1))
`;
  const result=spawnSync('python3',['-c',code,path.resolve(__dirname,'../scripts/audit-catalogue.py'),path.resolve(__dirname,'../data/audit/algol60-runtime-checks.json')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('XSLT audit rejects altered inputs, outputs, commands and invalid-expression evidence',t=>{
  const available=spawnSync('python3',['--version'],{encoding:'utf8'});
  if(available.error?.code==='ENOENT'){t.skip('Optional execution evidence validation requires Python 3');return;}
  assert.equal(available.status,0,available.stderr);
  const code=`
import copy, json, runpy, sys
validate=runpy.run_path(sys.argv[1])['validate_xslt_execution']
record=json.load(open(sys.argv[2]))
validate(record)
def reject(change):
    altered=copy.deepcopy(record)
    change(altered)
    try: validate(altered)
    except ValueError: return
    raise AssertionError('Inconsistent XSLT evidence accepted')
reject(lambda r: r.update(input='changed'))
reject(lambda r: r['samples'][0].update(sample='changed'))
reject(lambda r: r['samples'][0]['command'].update(stdout='54'))
reject(lambda r: r['samples'][0]['command'].update(exitCode=1))
reject(lambda r: r['samples'][0]['command'].update(commandTemplate=['xsltproc']))
reject(lambda r: r['invalidSyntax'].update(exitCode=0))
reject(lambda r: r['invalidSyntax'].update(sample='changed'))
`;
  const result=spawnSync('python3',['-c',code,path.resolve(__dirname,'../scripts/audit-catalogue.py'),path.resolve(__dirname,'../data/audit/xslt-runtime-checks.json')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('ksh93 audit rejects altered programs, results, syntax checks and version claims',t=>{
  const available=spawnSync('python3',['--version'],{encoding:'utf8'});
  if(available.error?.code==='ENOENT'){t.skip('Optional execution evidence validation requires Python 3');return;}
  assert.equal(available.status,0,available.stderr);
  const code=`
import copy, json, runpy, sys
validate=runpy.run_path(sys.argv[1])['validate_ksh93_execution']
record=json.load(open(sys.argv[2]))
validate(record)
def reject(change):
    altered=copy.deepcopy(record)
    change(altered)
    try: validate(altered)
    except ValueError: return
    raise AssertionError('Inconsistent ksh93 evidence accepted')
reject(lambda r: r.update(version='unknown'))
reject(lambda r: r.update(versionExitCode=2))
reject(lambda r: r['samples'][0].update(sample='changed'))
reject(lambda r: r['samples'][0]['command'].update(stdout='54'))
reject(lambda r: r['samples'][0]['syntaxCheck'].update(exitCode=1))
reject(lambda r: r['samples'][0]['syntaxCheck'].update(commandTemplate=['ksh']))
reject(lambda r: r['invalidSyntax'].update(exitCode=0))
reject(lambda r: r['invalidSyntax'].update(sample='changed'))
`;
  const result=spawnSync('python3',['-c',code,path.resolve(__dirname,'../scripts/audit-catalogue.py'),path.resolve(__dirname,'../data/audit/ksh93-runtime-checks.json')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
