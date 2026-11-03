import copy
import threading
import time
import unittest
from pathlib import Path
from executor import DockerRunner, Manager, load_runtimes, validate_submission, MAX_CODE, MAX_OUTPUT

RUNTIMES = load_runtimes(Path(__file__).with_name('runtime-images.json'))


class FakeRunner:
    runtimes = RUNTIMES
    healthy = True
    def __init__(self): self.gate = threading.Event();self.started = threading.Event();self.maximum = self.active = 0
    def execute(self, job):
        self.active += 1;self.maximum = max(self.maximum, self.active);self.started.set()
        while not self.gate.wait(.01):
            if job['cancel'].is_set(): break
        self.active -= 1
        return {'state': 'cancelled' if job['cancel'].is_set() else 'completed', 'stdout': 'real adapter stub for scheduling only'}


class ExecutorTests(unittest.TestCase):
    def test_whitelist_and_utf8_limits(self):
        for data in [{'language':'unknown-shell','code':'x'}, {'language':'python','stdin':'x'}, {'language':'python','code':'x','image':'attacker'}, {'language':[],'code':'x'}, {'language':'python','code':'界'*(MAX_CODE//3+1)}, {'language':'sql','code':'SELECT 1;','stdin':'ambiguous input'}]:
            with self.assertRaises(ValueError): validate_submission(data,RUNTIMES)
        self.assertEqual(validate_submission({'language':'ruby','code':'puts 42'},RUNTIMES)['stdin'],'')

    def test_cli_languages_use_fixed_commands_and_readonly_noexec_workdir(self):
        runner = DockerRunner(RUNTIMES, namespace='cli-unit-check')
        for language in ['typescript', 'sql', 'bash', 'awk', 'sed', 'php', 'perl', 'xslt', 'r']:
            self.assertEqual(validate_submission({'language':language,'code':'x'},RUNTIMES)['language'],language)
            command = runner.command(runner.prefix+'a'*32,language)
            for flag in ['--pull=never','--network=none','--read-only','--user=65534:65534','--cap-drop=ALL','--entrypoint=/bin/sleep']:
                self.assertIn(flag,command)
            self.assertIn('--tmpfs=/work:rw,'+('exec,nosuid,nodev,size=128m,mode=1777' if language=='typescript' else 'noexec,nosuid,nodev,size=16m,mode=1777'),command)
        from executor import COMPILED, SCRIPTED
        self.assertIn('--strict',COMPILED['typescript'][5]);self.assertIn('--noEmitOnError',COMPILED['typescript'][5])
        self.assertIn('-safe',SCRIPTED['sql'][2]);self.assertIn(':memory:',SCRIPTED['sql'][2])
        self.assertIn('--nonet',SCRIPTED['xslt'][2])
        self.assertIn('open_basedir=/work:/tmp',SCRIPTED['php'][2])
        self.assertIn('-std=f2008',COMPILED['fortran'][5])
        self.assertIn('@/work/refs.rsp',COMPILED['csharp'][5])
        self.assertIn('-Mobjfpc',COMPILED['pascal'][5]);self.assertIn('-n',COMPILED['pascal'][5])
        self.assertIn('--vanilla',SCRIPTED['r'][2])
        self.assertIn('--ulimit=nofile=256:256',runner.command(runner.prefix+'a'*32,'r'))

    def test_docker_contract(self):
        runner = DockerRunner(RUNTIMES)
        command = runner.command('cm-exec-'+'a'*32,'python')
        for flag in ['--pull=never','--network=none','--read-only','--init','--ipc=none','--user=65534:65534','--cap-drop=ALL','--security-opt=no-new-privileges:true','--memory=256m','--memory-swap=256m','--cpus=1','--pids-limit=32','--log-driver=none']:
            self.assertIn(flag,command)
        self.assertFalse(any(x.startswith(('--volume','--mount','--privileged','--device')) for x in command))
        self.assertIn(RUNTIMES['python']['image'],command)
        self.assertEqual(MAX_OUTPUT,32768)

    def test_compilation_contract_and_isolated_namespace(self):
        runner=DockerRunner(RUNTIMES,namespace='unit-check')
        for language in ['c','cpp','rust','go','java','fortran','csharp','pascal']:
            if language not in RUNTIMES: continue
            command=runner.command(runner.prefix+'a'*32,language)
            for flag in ['--read-only','--network=none','--user=65534:65534','--pids-limit=128','--entrypoint=/bin/sleep']:
                self.assertIn(flag,command)
            self.assertIn('--ulimit=nofile='+('256:256' if language=='csharp' else '64:64'),command)
            self.assertIn('code-museum.executor=unit-check',command)
            self.assertIn('--tmpfs=/work:rw,exec,nosuid,nodev,size=128m,mode=1777',command)
            self.assertFalse(any(x.startswith(('--volume','--mount','--privileged','--device')) for x in command))
        with self.assertRaises(ValueError): DockerRunner(RUNTIMES,namespace='../private-v1')
        changed=copy.deepcopy(RUNTIMES['c']);changed['image']='attacker@sha256:'+'a'*64
        import json,tempfile
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'images.json';f.write_text(json.dumps({'schemaVersion':1,'runtimes':[RUNTIMES['python'],RUNTIMES['ruby'],changed]}))
            with self.assertRaises(ValueError): load_runtimes(f)

    def test_owner_isolation_cancel_and_source_disposal(self):
        runner=FakeRunner();manager=Manager(runner)
        try:
            first=manager.submit('owner-a',{'language':'python','code':'print(1)'})
            self.assertTrue(runner.started.wait(1))
            second=manager.submit('owner-a',{'language':'ruby','code':'puts 2'})
            self.assertIsNone(manager.get(second['id'],'owner-b'))
            cancelled=manager.get(second['id'],'owner-a',True)
            self.assertEqual(cancelled['state'],'cancelled')
            self.assertGreaterEqual(cancelled['queueMs'],0)
            self.assertNotIn('code',manager.jobs[second['id']])
            manager.get(first['id'],'owner-a',True)
            deadline=time.monotonic()+1
            while manager.get(first['id'],'owner-a')['state']=='running' and time.monotonic()<deadline: time.sleep(.01)
            self.assertEqual(manager.get(first['id'],'owner-a')['state'],'cancelled')
            self.assertNotIn('code',manager.get(first['id'],'owner-a'))
            self.assertNotIn('owner',manager.get(first['id'],'owner-a'))
            self.assertGreaterEqual(manager.get(first['id'],'owner-a')['queueMs'],0)
            self.assertEqual(runner.maximum,1)
            self.assertEqual(manager.status()['metrics']['total'],2)
            manager.get(second['id'],'owner-a',True)
            manager.stop()
            self.assertEqual(manager.status()['metrics']['total'],2)
        finally: runner.gate.set();manager.stop()

    def test_bounded_queue_rate_and_fail_closed(self):
        runner=FakeRunner();manager=Manager(runner)
        try:
            manager.submit('one',{'language':'python','code':'pass'});self.assertTrue(runner.started.wait(1))
            for _ in range(9): manager.submit('one',{'language':'python','code':'pass'})
            with self.assertRaises(OverflowError): manager.submit('one',{'language':'python','code':'pass'})
            manager.submit('other',{'language':'python','code':'pass'})
            with self.assertRaises(OverflowError): manager.submit('another',{'language':'python','code':'pass'})
            runner.healthy=False
            with self.assertRaises(RuntimeError): manager.submit('another',{'language':'python','code':'pass'})
        finally: runner.gate.set();manager.stop()


if __name__=='__main__': unittest.main()
