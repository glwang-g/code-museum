"""Private stateless Streamable HTTP JSON transport. No execution or write tools."""
import hashlib
import hmac
import json
import threading
from pathlib import Path
from mcp import Museum, PROTOCOLS, LIMIT, rpc

HTTP_PROTOCOLS=PROTOCOLS[:3]
TOKEN_PURPOSE=b'code-museum-readonly-mcp-v1'

def readonly_token(executor_token):
    return hmac.new(executor_token.encode('ascii'),TOKEN_PURPOSE,hashlib.sha256).hexdigest()

class MuseumProvider:
    def __init__(self,directory):
        self.directory=Path(directory) if directory else None
        self.lock=threading.Lock();self.signature=None;self.museum=None
    def get(self):
        if self.directory is None: raise ValueError('MCP is not configured')
        with self.lock:
            directory=self.directory.resolve()
            signature=(str(directory),hashlib.sha256((directory/'mcp-manifest.json').read_bytes()).hexdigest())
            if signature!=self.signature:
                museum=Museum(directory)
                self.museum= museum;self.signature=signature
            return self.museum

def handle(handler,provider,token,origin):
    if handler.headers.get('Origin') not in (None,origin):
        handler.respond(403,{'error':'Origin not allowed'});return
    auth=handler.headers.get('Authorization','')
    if not auth.isascii() or not hmac.compare_digest(auth,'Bearer '+token):
        handler.respond(401,{'error':'Private read-only MCP token required'},headers={'WWW-Authenticate':'Bearer realm="code-museum-readonly"'});return
    if handler.command!='POST':
        handler.respond(405,{'error':'Stateless JSON transport uses POST; no SSE stream or session deletion'},headers={'Allow':'POST'});return
    version=handler.headers.get('MCP-Protocol-Version')
    if version is not None and version not in HTTP_PROTOCOLS:
        handler.respond(400,{'error':'Unsupported MCP protocol version'});return
    accept=handler.headers.get('Accept','')
    if 'application/json' not in accept and '*/*' not in accept:
        handler.respond(406,{'error':'Accept must allow application/json'});return
    if handler.headers.get('Transfer-Encoding') or handler.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
        handler.respond(415,{'error':'Expected length-delimited JSON'});return
    try:
        size=int(handler.headers.get('Content-Length','0'))
        if not 0<size<=LIMIT:
            handler.respond(413,{'error':'MCP request is limited to 64 KiB'});return
        body=handler.rfile.read(size)
        if len(body)!=size: raise ValueError('Incomplete body')
        request=json.loads(body)
        # Responses from clients and JSON-RPC batches are not part of this request-only service.
        if not isinstance(request,dict) or request.get('jsonrpc')!='2.0' or not isinstance(request.get('method'),str):
            handler.respond(400,{'error':'Expected one JSON-RPC request or notification'});return
    except (ValueError,UnicodeError):
        handler.respond(400,{'jsonrpc':'2.0','id':None,'error':{'code':-32700,'message':'Invalid JSON request'}});return
    try: museum=provider.get()
    except (OSError,ValueError,KeyError):
        handler.respond(503,{'error':'Verified museum data unavailable; no stale fallback'});return
    response,_=rpc(museum,request,initialized=True)
    if response is None:
        handler.respond(202,None);return
    if request['method']=='initialize' and 'result' in response:
        negotiated=response['result']['protocolVersion']
        if negotiated not in HTTP_PROTOCOLS:response['result']['protocolVersion']=HTTP_PROTOCOLS[0]
    handler.respond(200,response)
