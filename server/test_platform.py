import hashlib
import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from observability import Metrics
from mcp_http import MuseumProvider, readonly_token, handle

class PlatformTests(unittest.TestCase):
    def test_aggregate_persistence_and_privacy(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'metrics.sqlite';metrics=Metrics(str(file))
            metrics.record({'language':'rust','state':'completed','queueMs':10,'compileMs':20,'runMs':30,'code':'secret code','stdin':'secret stdin','stdout':'secret output','owner':'secret owner','id':'secret job'})
            metrics.record({'language':'rust','state':'compile_error','queueMs':0,'compileMs':40})
            metrics.record({'language':'python','state':'failed','queueMs':5,'runMs':10})
            before=metrics.snapshot();metrics.db.close();metrics=Metrics(str(file));after=metrics.snapshot()
            self.assertEqual(before,after);self.assertEqual(after['total'],3)
            self.assertEqual(after['timings']['compile'],{'samples':2,'meanMs':30.0})
            self.assertEqual(after['timings']['run'],{'samples':2,'meanMs':20.0})
            self.assertEqual(after['states']['infrastructure_error'],0)
            with self.assertRaises(ValueError):metrics.record({'language':'rust','state':'running'})
            columns=[r[1] for r in metrics.db.execute('PRAGMA table_info(totals)')]
            self.assertFalse(set(columns)&{'code','stdin','stdout','stderr','id','owner'})
            metrics.db.close();payload=file.read_bytes()
            for value in [b'secret code',b'secret stdin',b'secret output',b'secret owner',b'secret job']:self.assertNotIn(value,payload)

    def fixture(self,directory,name='Python'):
        directory.mkdir(exist_ok=True)
        files={'catalogue.json':{'meta':{'count':1,'sha256':'fixture-sha256'},'records':[{'id':'python','name':name,'aliases':'','year':1991,'language':True,'category':'language','mapEligible':True,'review':None}]},'audit-reviews.json':{'reviews':[]},'relationship-status.json':{'summary':{},'relations':[],'scope':'test fixture'},'execution-capabilities.json':{'languages':[]}}
        hashes={}
        for name,body in files.items():
            raw=json.dumps(body).encode();(directory/name).write_bytes(raw);hashes[name]=hashlib.sha256(raw).hexdigest()
        (directory/'mcp-manifest.json').write_text(json.dumps(hashes))

    def test_provider_refreshes_release_and_refuses_corrupt_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);self.fixture(root/'first');self.fixture(root/'second','Changed Python')
            current=root/'current';current.symlink_to(root/'first');provider=MuseumProvider(current)
            self.assertEqual(provider.get().records['python']['name'],'Python')
            current.unlink();current.symlink_to(root/'second')
            self.assertEqual(provider.get().records['python']['name'],'Changed Python')
            (root/'second'/'catalogue.json').write_text('{}')
            # Change manifest hash signature as a release update would; loader must validate all bytes.
            (root/'second'/'mcp-manifest.json').write_text((root/'second'/'mcp-manifest.json').read_text()+' ')
            with self.assertRaises(ValueError):provider.get()

    def test_http_auth_protocol_limits_notifications_and_readonly_tools(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);self.fixture(root);provider=MuseumProvider(root);token=readonly_token('x'*40)
            self.assertNotEqual(token,'x'*40);self.assertEqual(token,readonly_token('x'*40))
            self.assertNotEqual(token,readonly_token('y'*40))
            def request(body=None,headers=None,command='POST'):
                raw=json.dumps(body or {'jsonrpc':'2.0','id':1,'method':'tools/list'}).encode()
                fields={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream','Content-Length':str(len(raw)),'MCP-Protocol-Version':'2025-06-18'}
                fields.update(headers or {})
                result=[];handler=SimpleNamespace(command=command,headers=fields,rfile=io.BytesIO(raw),respond=lambda status,data,headers=None:result.append((status,data,headers)))
                handle(handler,provider,token,'https://museum.test');return result[0]
            self.assertEqual(request(headers={'Authorization':'Bearer '+ 'x'*40})[0],401)
            self.assertEqual(request(headers={'Origin':'https://wrong.test'})[0],403)
            self.assertEqual(request(command='GET')[0],405)
            self.assertEqual(request(headers={'MCP-Protocol-Version':'unknown'})[0],400)
            self.assertEqual(request(headers={'Accept':'text/event-stream'})[0],406)
            self.assertEqual(request(headers={'Transfer-Encoding':'chunked'})[0],415)
            self.assertEqual(request(headers={'Content-Length':'70000'})[0],413)
            status,data,_=request();self.assertEqual(status,200);self.assertEqual(len(data['result']['tools']),5)
            self.assertTrue(all(t['annotations']['readOnlyHint'] for t in data['result']['tools']))
            self.assertEqual(request({'jsonrpc':'2.0','method':'notifications/initialized'})[:2],(202,None))
            _,data,_=request({'jsonrpc':'2.0','id':2,'method':'initialize','params':{'protocolVersion':'2024-11-05'}})
            self.assertEqual(data['result']['protocolVersion'],'2025-11-25')
            _,data,_=request({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'search_languages','arguments':{'query':'python'}}})
            self.assertEqual(json.loads(data['result']['content'][0]['text'])['results'][0]['id'],'python')
            _,data,_=request({'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'execute_code','arguments':{'code':'print(1)'}}})
            self.assertTrue(data['result']['isError'])

if __name__=='__main__':unittest.main()
