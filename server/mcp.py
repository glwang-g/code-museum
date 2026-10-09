#!/usr/bin/env python3
"""Read-only MCP stdio server, standard library only. Never runs submitted code."""
import argparse
import difflib
import hashlib
import json
import sys
from pathlib import Path

PROTOCOLS = ('2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05')
LIMIT = 65536
TOOLS = [
    ('search_languages', 'Search the full pinned collection (not just map nodes). Returns coverage and review status.', {'query':{'type':'string','maxLength':200},'category':{'type':'string','enum':['all','language','pending','related']},'offset':{'type':'integer','minimum':0},'limit':{'type':'integer','minimum':1,'maximum':50}}, ['query']),
    ('get_language', 'Get a language/technology archive and reviewed source excerpts. An unreviewed entry is not a verified language.', {'id':{'type':'string','maxLength':200}}, ['id']),
    ('get_lineage', 'Query recorded upstream/downstream relations, bounded to 1–3 hops. Missing links do not mean no influence. Evidence states retained.', {'id':{'type':'string','maxLength':200},'direction':{'type':'string','enum':['upstream','downstream','both']},'layer':{'type':'string','enum':['design','ecosystem','all']},'depth':{'type':'integer','minimum':1,'maximum':3},'offset':{'type':'integer','minimum':0},'limit':{'type':'integer','minimum':1,'maximum':50}}, ['id']),
    ('get_relationship', 'Read the explanation, original excerpts, citations, hashes and unresolved issues for an exact relationship key.', {'key':{'type':'string','maxLength':600}}, ['key']),
    ('get_execution_capabilities', 'Describe configured browser/private server runtimes and limits. Configuration is not a live availability check; no execution tool.', {'id':{'type':'string','maxLength':200}}, [])
]


class Museum:
    def __init__(self, directory):
        directory = Path(directory)
        hashes = json.loads((directory/'mcp-manifest.json').read_text())
        expected = {'catalogue.json','audit-reviews.json','relationship-status.json','execution-capabilities.json'}
        if set(hashes) != expected: raise ValueError('Unexpected MCP input manifest')
        loaded = {}
        for name, digest in hashes.items():
            payload = (directory/name).read_bytes()
            if hashlib.sha256(payload).hexdigest() != digest: raise ValueError('MCP input hash mismatch: '+name)
            loaded[name] = json.loads(payload)
        self.catalogue = loaded['catalogue.json']; self.relations = loaded['relationship-status.json']
        self.records = {r['id']:r for r in self.catalogue['records']}
        self.reviews = {r['id']:r for r in loaded['audit-reviews.json']['reviews']}
        self.capabilities = loaded['execution-capabilities.json']; self.hashes = hashes

    def coverage(self):
        return {'catalogue':self.catalogue['meta'], 'relationships':self.relations['summary'], 'hashes':self.hashes,
                'limitations':'Pinned snapshot; full catalogue is not complete historical coverage. Source-marked language is not independent verification. Excerpts do not prove all relations. Missing links do not imply no ancestors.'}

    def call(self, name, args):
        spec = next((s for s in TOOLS if s[0] == name), None)
        if not spec: raise ValueError('Unknown read-only tool')
        if not isinstance(args,dict) or set(args)-set(spec[2]) or set(spec[3])-set(args): raise ValueError('Invalid tool arguments')
        for key,value in args.items():
            rule = spec[2][key]
            if rule['type']=='string' and (not isinstance(value,str) or len(value)>rule.get('maxLength',200)): raise ValueError('Invalid '+key)
            if rule['type']=='integer' and (type(value) is not int or value<rule.get('minimum',0) or value>rule.get('maximum',100000)): raise ValueError('Invalid '+key)
            if 'enum' in rule and value not in rule['enum']: raise ValueError('Invalid '+key)
        ident = args.get('id')
        if ident is not None and ident not in self.records: raise ValueError('Unknown catalogue ID; use search_languages')
        offset,limit = args.get('offset',0),args.get('limit',20)
        if name=='search_languages':
            query = args['query'].strip().casefold(); category=args.get('category','all')
            def score(r):
                terms=[r['id'].casefold(),r['name'].casefold(),*[v.casefold() for v in r['aliases'].split(' or ') if v]]
                if not query: return 1
                if query in terms: return 4
                if any(t.startswith(query) for t in terms): return 3
                if any(query in t for t in terms): return 2
                # C++ and C# remain distinct; do not erase punctuation for fuzzy matches.
                if len(query)<3 or '+' in query or '#' in query: return 0
                similarity=max(difflib.SequenceMatcher(None,query,t).ratio() for t in terms)
                return similarity if similarity>=.72 else 0
            found=[(score(r),r) for r in self.records.values() if category=='all' or r['category']==category]
            found=sorted((p for p in found if p[0]),key=lambda p:(-p[0],p[1]['name'].casefold(),p[1]['id']))
            return {'total':len(found),'offset':offset,'results':[{k:r[k] for k in ('id','name','year','language','category','mapEligible','review')} for _,r in found[offset:offset+limit]],'snapshotSha256':self.catalogue['meta']['sha256'],'scope':'Full pinned collection; language is the upstream classification, category/review describe museum evidence.'}
        if name=='get_language': return {'record':self.records[ident],'evidence':self.reviews.get(ident),'scope':'No review means unreviewed, not disproven. Syntax documentation is not a runtime conformance test.'}
        if name=='get_relationship':
            result=next((r for r in self.relations['relations'] if r['key']==args['key']),None)
            if not result: raise ValueError('Unknown relationship key')
            return result
        if name=='get_lineage':
            direction=args.get('direction','both'); layer=args.get('layer','design'); depth=args.get('depth',1)
            edges=[r for r in self.relations['relations'] if layer=='all' or r['layer']==layer]
            selected={}
            # Traverse each direction independently: upstream does not fan out into siblings.
            for way in (['upstream','downstream'] if direction=='both' else [direction]):
                seen={ident}; frontier={ident}
                for _ in range(depth):
                    following=set()
                    for r in edges:
                        a,b=(r['to'],r['from']) if way=='upstream' else (r['from'],r['to'])
                        if a in frontier: selected[r['key']]=r;following.add(b)
                    frontier=following-seen;seen|=following
            values=sorted(selected.values(),key=lambda r:r['key']); page=values[offset:offset+limit]
            ids={ident}|{r[k] for r in page for k in ('from','to')}
            return {'id':ident,'direction':direction,'layer':layer,'depth':depth,'total':len(values),'offset':offset,'relations':page,'nodes':[{k:self.records[i][k] for k in ('id','name','year','category')} for i in sorted(ids)],'scope':self.relations['scope']}
        return {'configured':self.capabilities if ident is None else {**self.capabilities,'languages':[r for r in self.capabilities['languages'] if r['id']==ident]},'liveAvailabilityChecked':False,'scope':'Configured runtimes only. Browser enablement and private API connectivity/token must be checked in the application. No code execution via MCP.'}


def rpc(museum, request, initialized=False):
    """Shared transport-independent dispatcher; HTTP is explicitly stateless."""
    try:
        if not isinstance(request,dict) or request.get('jsonrpc')!='2.0' or not isinstance(request.get('method'),str): raise ValueError('Invalid JSON-RPC request')
        ident=request.get('id');method=request['method'];params=request.get('params',{})
        if 'id' not in request: return None,initialized
        if not (isinstance(ident,(str,int)) and not isinstance(ident,bool)): raise ValueError('Invalid request ID')
        if not isinstance(params,dict): raise ValueError('Invalid params')
        if method=='initialize':
            version=params.get('protocolVersion');initialized=True
            result={'protocolVersion':version if version in PROTOCOLS else PROTOCOLS[0],'capabilities':{'tools':{'listChanged':False},'resources':{'subscribe':False,'listChanged':False}},'serverInfo':{'name':'code-museum','version':'1.1.0'},'instructions':museum.coverage()['limitations']}
        elif method=='ping': result={}
        elif not initialized: raise ValueError('Initialize the MCP connection first')
        elif method=='tools/list': result={'tools':[{'name':n,'description':d,'inputSchema':{'type':'object','properties':p,'required':r,'additionalProperties':False},'annotations':{'readOnlyHint':True,'destructiveHint':False,'idempotentHint':True,'openWorldHint':False}} for n,d,p,r in TOOLS]}
        elif method=='tools/call':
            try:
                value=museum.call(params.get('name'),params.get('arguments',{}));result={'content':[{'type':'text','text':json.dumps(value,ensure_ascii=False)}],'isError':False}
            except ValueError as error: result={'content':[{'type':'text','text':str(error)}],'isError':True}
        elif method=='resources/list': result={'resources':[{'uri':'museum://coverage','name':'coverage','description':'Pinned dataset coverage, evidence states and input hashes','mimeType':'application/json'}]}
        elif method=='resources/read':
            if params.get('uri')!='museum://coverage': raise ValueError('Unknown read-only resource')
            result={'contents':[{'uri':'museum://coverage','mimeType':'application/json','text':json.dumps(museum.coverage(),ensure_ascii=False)}]}
        else: return {'jsonrpc':'2.0','id':ident,'error':{'code':-32601,'message':'Method not found'}},initialized
        return {'jsonrpc':'2.0','id':ident,'result':result},initialized
    except (ValueError,TypeError):
        return {'jsonrpc':'2.0','id':request.get('id') if isinstance(request,dict) else None,'error':{'code':-32602,'message':'Invalid request or parameters'}},initialized


def serve(museum, input_stream=None, output_stream=None):
    input_stream=input_stream or sys.stdin.buffer;output_stream=output_stream or sys.stdout
    initialized=False
    while True:
        raw=input_stream.readline(LIMIT+1)
        if not raw: break
        if len(raw)>LIMIT:
            while raw and not raw.endswith(b'\n'): raw=input_stream.readline(LIMIT+1)
            response={'jsonrpc':'2.0','id':None,'error':{'code':-32700,'message':'Request line exceeds 64 KiB'}}
        else:
            try: response,initialized=rpc(museum,json.loads(raw),initialized)
            except (json.JSONDecodeError,UnicodeError): response={'jsonrpc':'2.0','id':None,'error':{'code':-32700,'message':'Parse error'}}
        if response is not None:
            output_stream.write(json.dumps(response,ensure_ascii=False)+'\n');output_stream.flush()


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data',default=str(Path(__file__).resolve().parents[1]/'dist/data'));args=parser.parse_args()
    try: serve(Museum(args.data))
    except (OSError,ValueError,KeyError) as error: print('MCP startup failed: '+str(error),file=sys.stderr);sys.exit(1)
