#!/usr/bin/env python3
"""Explicit opt-in Linux/Docker integration check. Own temporary API, private token, no public listener."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
from executor import DockerRunner, load_runtimes

def main():
    runtimes=load_runtimes(ROOT/'server/runtime-images.json')
    namespace='check-'+secrets.token_hex(6)
    runner=DockerRunner(runtimes,namespace=namespace);runner.verify()
    with socket.socket() as s: s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    token=secrets.token_urlsafe(40)
    process=subprocess.Popen([sys.executable,str(ROOT/'server/executor.py'),'--namespace',namespace,'--port',str(port)],env=dict(os.environ,EXECUTOR_TOKEN=token,EXECUTOR_LOCK='/tmp/code-museum-executor-'+namespace+'.lock'),stdout=subprocess.DEVNULL)
    checks=[]
    def request(method,path,data=None,auth=True,session=None,origin='http://127.0.0.1:4173'):
        headers={'Origin':origin,'Content-Type':'application/json'}
        if auth: headers.update(Authorization='Bearer '+token,**{'X-Execution-Session':session or secrets.token_hex(16)})
        req=urllib.request.Request('http://127.0.0.1:'+str(port)+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
        try:
            with urllib.request.urlopen(req,timeout=10) as response:return response.status,json.load(response)
        except urllib.error.HTTPError as error:return error.code,json.load(error)
    def run(name,language,code,expected,state='completed',stdin=''):
        session=secrets.token_hex(16);status,job=request('POST','executions',dict(language=language,code=code,stdin=stdin),session=session);assert status==202,(name,status,job)
        started=time.monotonic()
        while job['state'] in ('queued','compiling','running'):
            assert time.monotonic()-started<60,(name,job)
            time.sleep(.08);status,job=request('GET','executions/'+job['id'],session=session)
        assert job['state']==state,(name,job)
        if expected is not None:assert job.get('stdout')==expected,(name,job)
        assert len(job.get('stdout','').encode())+len(job.get('stderr','').encode())<=32768,(name,job)
        checks.append({'name':name,'language':language,'code':code,'stdin':stdin,'result':{k:v for k,v in job.items() if k!='id'}})
        print('PASS '+name,flush=True)
        return job
    try:
        for _ in range(100):
            try:
                if request('GET','runtimes',auth=False)[0]==200:break
            except OSError: pass
            if process.poll() is not None:raise RuntimeError('API startup failed')
            time.sleep(.1)
        else:raise RuntimeError('API startup timed out')
        assert request('POST','executions',{'language':'python','code':'pass'},auth=False)[0]==401
        assert request('POST','executions',{'language':'python','code':'pass'},origin='https://wrong.invalid')[0]==401
        assert request('POST','executions',{'language':'shell','code':'pass'})[0]==400
        assert request('POST','executions',{'language':'python','code':'pass','image':'attacker'})[0]==400
        checks.append({'name':'Private authorization, origin and language/image whitelist','passed':True})
        run('Python actual execution and stdin','python','print(sum(range(1,11))); print(input())','55\nhello\n',stdin='hello\n')
        run('Ruby actual execution and stdin','ruby','puts (1..10).sum; puts STDIN.gets','55\nhello\n',stdin='hello\n')
        run('Python syntax rejection','python','def broken(:',None,'failed')
        run('Ruby syntax rejection','ruby','def broken(',None,'failed')
        samples={
            'c':('#include <stdio.h>\nint main(void){char s[32];scanf("%31s",s);printf("55\\n%s\\n",s);}', '#include <stdio.h>\nint main(void){while(1){}}', '#include <stdio.h>\nint main(void){while(1) puts("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");}'),
            'cpp':('#include <iostream>\n#include <string>\nint main(){std::string s;std::cin>>s;std::cout<<"55\\n"<<s<<"\\n";}', 'int main(){while(true){}}', '#include <iostream>\nint main(){while(true) std::cout<<"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\\n";}'),
            'rust':('use std::io;fn main(){let mut s=String::new();io::stdin().read_line(&mut s).unwrap();println!("55\\n{}",s.trim());}', 'fn main(){loop{}}', 'fn main(){loop{println!("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");}}'),
            'go':('package main\nimport("fmt";"bufio";"os")\nfunc main(){s:=bufio.NewScanner(os.Stdin);s.Scan();fmt.Println(55);fmt.Println(s.Text())}', 'package main\nfunc main(){for{}}', 'package main\nimport "fmt"\nfunc main(){for{fmt.Println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")}}'),
            'java':('import java.util.Scanner;class Museum{public static void main(String[]a){System.out.println(55);System.out.println(new Scanner(System.in).nextLine());}}', 'class Museum{public static void main(String[]a){while(true){}}}', 'class Museum{public static void main(String[]a){while(true)System.out.println("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");}}')}
        for language,(code,loop,output) in samples.items():
            job=run(language+' actual compilation, execution and stdin',language,code,'55\nhello\n',stdin='hello\n')
            assert job.get('compileMs',0)>0 and job.get('runMs',0)>0
            error=run(language+' compiler diagnostic',language,'not valid source !!!',None,'compile_error')
            assert error.get('stderr') and 'runMs' not in error
            run(language+' runtime timeout',language,loop,None,'timed_out')
            run(language+' combined output budget',language,output,None,'output_limit')
        compiler_loop='#![allow(long_running_const_eval)]\nconst X:u32={loop{}};fn main(){println!("{}",X);}'
        timeout=run('Rust compile timeout does not run the program','rust',compiler_loop,None,'compile_timed_out')
        assert 'runMs' not in timeout and timeout.get('phase')=='compiling'
        # Global request quota is per minute; use an isolated manager reset, not sleep or touch production.
        process.terminate();process.wait(timeout=60)
        process=subprocess.Popen([sys.executable,str(ROOT/'server/executor.py'),'--namespace',namespace,'--port',str(port)],env=dict(os.environ,EXECUTOR_TOKEN=token,EXECUTOR_LOCK='/tmp/code-museum-executor-'+namespace+'.lock'),stdout=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if request('GET','runtimes',auth=False)[0]==200:break
            except OSError: pass
            time.sleep(.1)
        run('Separate environment first task','python','secret=42; print(secret)','42\n')
        run('Separate environment next task','python','print(secret)',None,'failed')
        run('Non-root, no-new-privileges, no host socket and read-only root','python',"import os\nprint(os.getuid())\nprint('NoNewPrivs:\\t1' in open('/proc/self/status').read())\nprint(os.path.exists('/var/run/docker.sock'))\ntry: open('/etc/cm-write-test','w')\nexcept OSError: print('root blocked')",'65534\nTrue\nFalse\nroot blocked\n')
        run('Network blocked including cloud metadata','python',"import socket\nfor host in ['1.1.1.1','169.254.169.254']:\n try: socket.create_connection((host,80),timeout=.3); print('unexpected')\n except OSError: print('blocked')",'blocked\nblocked\n')
        run('Temporary filesystem capacity','python',"import os\ntry:\n for i in range(20): open('/work/f'+str(i),'wb').write(b'x'*2000000)\nexcept OSError: print('disk bounded')",'disk bounded\n')
        run('Output limit','python',"print('x'*200000)",None,'output_limit')
        run('Invalid UTF-8 output remains within byte budget','python',"import os; os.write(1,bytes([255])*50000)",None,'output_limit')
        run('Memory limit','python',"x=bytearray(600*1024*1024); print(len(x))",None,'memory_limit')
        run('Process count limit','python',"import os,time\nchildren=[]\ntry:\n for i in range(100):\n  pid=os.fork()\n  if pid==0: time.sleep(10); os._exit(0)\n  children.append(pid)\nexcept OSError: print('pids bounded',len(children)<32)\nfinally:\n for pid in children: os.kill(pid,9)\n for pid in children: os.waitpid(pid,0)",'pids bounded True\n')
        run('Wall time termination','python','while True: pass',None,'timed_out')
        run('Ruby wall time termination','ruby','loop {}',None,'timed_out')
        session=secrets.token_hex(16);status,job=request('POST','executions',{'language':'python','code':'while True: pass'},session=session);assert status==202
        assert request('GET','executions/'+job['id'])[0]==404
        time.sleep(.2);assert request('DELETE','executions/'+job['id'],session=session)[0]==200
        for _ in range(100):
            _,end=request('GET','executions/'+job['id'],session=session)
            if end['state']=='cancelled':break
            time.sleep(.1)
        assert end['state']=='cancelled',end
        checks.append({'name':'Owner isolation and active cancellation','passed':True})
        run('Recovery after restricted cases','ruby','puts 42','42\n')
        session=secrets.token_hex(16)
        for _ in range(10): assert request('POST','executions',{'language':'python','code':'pass'},session=session)[0]==202
        assert request('POST','executions',{'language':'python','code':'pass'},session=session)[0]==429
        checks.append({'name':'HTTP request quota/queue rejection','passed':True})
        # Finish those queued tasks, then deliberately crash the API during an active task.
        time.sleep(10)
        session=secrets.token_hex(16);status,job=request('POST','executions',{'language':'rust','code':compiler_loop},session=session);assert status==202,(status,job)
        for _ in range(100):
            _,current=request('GET','executions/'+job['id'],session=session)
            if current['state']=='compiling':break
            time.sleep(.1)
        else:raise AssertionError('Task did not reach container execution')
        process.kill();process.wait()
        for _ in range(60):
            remaining=subprocess.check_output(['docker','ps','-a','--filter','label='+runner.label,'--format','{{.Names}}']).decode().strip()
            if not remaining:break
            time.sleep(.2)
        assert not remaining,'Host watchdog must clean up after API crash'
        checks.append({'name':'Independent watchdog removes compilation container after API SIGKILL','passed':True})
    finally:
        if process.poll() is None: process.terminate()
        try:process.wait(timeout=25)
        except subprocess.TimeoutExpired:process.kill();process.wait();raise
        runner.cleanup_stale()
    leftovers=subprocess.check_output(['docker','ps','-a','--filter','label='+runner.label,'--format','{{.Names}}']).decode().strip();assert not leftovers,leftovers
    report={'scope':'Private ephemeral loopback API on xshow; Docker runc with cgroup v2/default seccomp; not a public deployment or a container-escape proof. No user tokens, sessions or job IDs saved.', 'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'inputs':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'server/executor.py',ROOT/'server/runtime-images.json',Path(__file__).resolve()]},'runtimes':list(runtimes.values()),'checks':checks,'leftoverContainers':0}
    output=Path(os.environ.get('EXECUTOR_CHECK_OUTPUT','/tmp/code-museum-executor-checks.json'));output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Report '+str(output))

if __name__=='__main__':main()
