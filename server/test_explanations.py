import concurrent.futures
import contextlib
import copy
import http.client
import io
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from explanations import DeepSeek, Explanations, Failure, MAX_CODE, handler, load_env, source, validate

RESULT = {'overview': '累加并输出', 'stdin': '不读取标准输入。', 'steps': [
    {'from': 1, 'to': 1, 'title': '输出', 'detail': '<script>文本不能作为HTML执行</script>'}],
    'review': {'verdict': 'ok', 'summary': '未发现明显问题。', 'intent': '输出计算结果。', 'issues': []}, 'correction': None}


class ModelTests(unittest.TestCase):
    def service(self, provider=None, **kwargs):
        service = Explanations(provider or (lambda *args: copy.deepcopy(RESULT)), ':memory:', 'fixture-secret', **kwargs)
        self.addCleanup(service.db.close)
        return service

    def test_validation_before_any_provider_request(self):
        called = []
        service = self.service(lambda *args: called.append(args))
        for data in ({}, {'language': 'python', 'code': ''}, {'language': 'python', 'code': 'x'*(MAX_CODE+1)},
                     {'language': 'python', 'code': 'x\n'*400}, {'language': 'python', 'code': 'x', 'stdin': 'private'},
                     {'language': 'python', 'code': '\ud800'}, {'language': '../foo', 'code': 'x'}):
            with self.assertRaises(Failure):
                service.explain(data, 'client')
        self.assertEqual(called, [])
        self.assertEqual(service.db.execute('SELECT count(*) FROM usage').fetchone()[0], 0)

    def test_output_line_ranges_types_and_text_are_bounded(self):
        self.assertEqual(validate(RESULT, 1), RESULT)
        for edit in (lambda r: r.update(steps=[]), lambda r: r['steps'][0].update(to=2),
                     lambda r: r['steps'][0].update({'from': True}), lambda r: r.update(overview=''),
                     lambda r: r['steps'][0].update(detail='x'*501)):
            value = copy.deepcopy(RESULT); edit(value)
            with self.assertRaises(ValueError):
                validate(value, 1)

    def test_review_patches_preserve_every_untouched_line_and_uncertainty_cannot_rewrite(self):
        code = '# keep this requirement\nvalues = [2, 3, 5]\ntotal = 0\nfor value in values:\n    total += vale\nprint(total)\n'
        issue = {'from': 5, 'to': 5, 'title': '变量名错误', 'detail': 'vale没有定义',
                 'suggestion': '使用循环变量value，保持求和需求', 'replacement': '    total += value'}
        result = copy.deepcopy(RESULT); result['steps'] = []; result['review'].update(verdict='issues', issues=[issue])
        normalized = validate(result, 7, code)
        self.assertEqual(normalized['correction'], code.replace('total += vale', 'total += value'))
        for edit in (lambda r: r['review'].update(verdict='ok'), lambda r: r['review'].update(verdict='uncertain'),
                     lambda r: r['review']['issues'].append(copy.deepcopy(issue)),
                     lambda r: r['review']['issues'][0].update(to=100),
                     lambda r: r['review']['issues'][0].update(replacement='x'*4097),
                     lambda r: r['review']['issues'][0].update(replacement='    total += vale')):
            changed = copy.deepcopy(result); edit(changed)
            with self.assertRaises(ValueError): validate(changed, 7, code)
        uncertain = copy.deepcopy(result); uncertain['review'].update(verdict='uncertain'); uncertain['review']['issues'][0]['replacement'] = None
        self.assertIsNone(validate(uncertain, 7, code)['correction'])
        ambiguous = copy.deepcopy(RESULT); ambiguous['steps'] = []; ambiguous['review'].update(verdict='uncertain', issues=[])
        self.assertIsNone(validate(ambiguous, 7, code)['correction'])

    def test_intent_changes_cache_identity_and_legacy_pages_receive_diagnosis_without_false_clean_status(self):
        calls = []
        def provider(*args): calls.append(args); return RESULT
        service = self.service(provider)
        data = {'language': 'python', 'code': 'print(1)', 'intent': '输出数字1'}
        self.assertFalse(service.explain(data, 'a')['cached'])
        self.assertTrue(service.explain({**data, 'intent': ' 输出数字1 '}, 'a')['cached'])
        self.assertFalse(service.explain({**data, 'intent': '输出数字2'}, 'a')['cached'])
        self.assertEqual(calls[0][3], '输出数字1'); self.assertEqual(len(calls), 2)
        for intent in (None, 1, 'x'*601, '\ud800'):
            with self.assertRaises(Failure): source({**data, 'intent': intent})
        uncertain = copy.deepcopy(RESULT); uncertain['steps'] = []; uncertain['review'].update(verdict='uncertain', issues=[])
        service = self.service(lambda *args: uncertain)
        legacy = service.explain({'language': 'python', 'code': 'print(rate)'}, 'a')
        self.assertEqual(legacy['explanation']['review']['verdict'], 'uncertain')
        self.assertEqual(len(legacy['explanation']['steps']), 1)
        modern = service.explain({'language': 'python', 'code': 'print(rate)', 'intent': ''}, 'a')
        self.assertEqual(modern['explanation']['steps'], [])

    def test_concurrent_identical_code_has_one_provider_attempt(self):
        started, finish = threading.Event(), threading.Event(); calls = []
        def provider(*args):
            calls.append(args); started.set(); finish.wait(3); return RESULT
        service = self.service(provider)
        data = {'language': 'python', 'code': 'print(1)'}
        with concurrent.futures.ThreadPoolExecutor(3) as pool:
            first = pool.submit(service.explain, data, 'client-a'); self.assertTrue(started.wait(2))
            second = pool.submit(service.explain, data, 'client-b'); finish.set()
            self.assertFalse(first.result()['cached']); self.assertTrue(second.result()['cached'])
        self.assertEqual(len(calls), 1)
        self.assertTrue(service.explain(data, 'client-c')['cached'])
        self.assertEqual(service.db.execute("SELECT count FROM usage WHERE actor='*'").fetchone()[0], 1)
        service.explain({**data, 'language': 'javascript'}, 'client-a'); self.assertEqual(len(calls), 2)

    def test_provider_failure_is_shared_without_retry_and_releases_slot(self):
        calls = []
        def provider(*args):
            calls.append(args); raise Failure(502, 'fixture', 'Unavailable')
        service = self.service(provider)
        with self.assertRaises(Failure):
            service.explain({'language': 'python', 'code': 'print(1)'}, 'client')
        self.assertEqual(len(calls), 1); self.assertEqual(service.pending, {}); self.assertEqual(len(service.cache), 0)

    def test_two_provider_slots_reject_a_third_before_charging(self):
        started = threading.Barrier(3); finish = threading.Event()
        def provider(*args):
            started.wait(3); finish.wait(3); return RESULT
        service = self.service(provider)
        with concurrent.futures.ThreadPoolExecutor(2) as pool:
            first = pool.submit(service.explain, {'language': 'python', 'code': 'one'}, 'a')
            second = pool.submit(service.explain, {'language': 'python', 'code': 'two'}, 'b')
            started.wait(3)
            try:
                with self.assertRaises(Failure) as error:
                    service.explain({'language': 'python', 'code': 'three'}, 'c')
                self.assertEqual(error.exception.code, 'busy')
                self.assertEqual(service.db.execute("SELECT count FROM usage WHERE actor='*'").fetchone()[0], 2)
            finally:
                finish.set()
            first.result(); second.result()

    def test_persistent_daily_budget_cache_hits_and_privacy(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = str(Path(tmp)/'usage.sqlite3')
            service = Explanations(lambda *args: RESULT, db, 'fixture-secret', daily=2, actor_daily=1)
            service.explain({'language': 'python', 'code': 'one'}, '192.0.2.1')
            self.assertTrue(service.explain({'language': 'python', 'code': 'one'}, '192.0.2.1')['cached'])
            with self.assertRaises(Failure) as error:
                service.explain({'language': 'python', 'code': 'two'}, '192.0.2.1')
            self.assertEqual(error.exception.code, 'daily_limit')
            service.db.close()
            service = Explanations(lambda *args: RESULT, db, 'fixture-secret', daily=2, actor_daily=1)
            service.explain({'language': 'python', 'code': 'two'}, '192.0.2.2')
            with self.assertRaises(Failure):
                service.explain({'language': 'python', 'code': 'three'}, '192.0.2.3')
            dumped = '\n'.join(service.db.iterdump()); service.db.close()
            for secret in ('192.0.2.1', '192.0.2.2', 'fixture-secret', 'print('):
                self.assertNotIn(secret, dumped)

    def test_cache_expiry_bounded_retention_and_day_rollover(self):
        now = [86400.0]
        service = self.service(clock=lambda: now[0], daily=200, actor_daily=200)
        for n in range(66): service.explain({'language': 'python', 'code': str(n)}, 'client')
        self.assertEqual(len(service.cache), 64)
        now[0] += 3601
        self.assertFalse(service.explain({'language': 'python', 'code': '65'}, 'client')['cached'])
        now[0] += 86400
        service.explain({'language': 'python', 'code': 'next'}, 'client')
        self.assertEqual(service.db.execute("SELECT count FROM usage WHERE actor='*'").fetchone()[0], 1)

    def test_deepseek_request_disables_thinking_and_has_no_tools_or_retry(self):
        provider = DeepSeek({'DEEPSEEK_API_KEY': 'fixture-key'})
        raw = {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(RESULT)}}]}
        class Response(io.BytesIO):
            pass
        with patch.object(provider.opener, 'open', return_value=Response(json.dumps(raw).encode())) as call:
            self.assertEqual(provider('python', 'print(1)', 1), RESULT)
        req = call.call_args.args[0]; payload = json.loads(req.data)
        self.assertEqual(req.full_url, 'https://api.deepseek.com/chat/completions')
        self.assertEqual(payload['thinking'], {'type': 'disabled'})
        self.assertEqual(payload['max_tokens'], 3200); self.assertFalse(payload['stream'])
        self.assertNotIn('tools', payload); self.assertEqual(payload['response_format']['type'], 'json_object')
        self.assertEqual(json.loads(payload['messages'][1]['content'])['code'], 'print(1)')
        with patch.object(provider.opener, 'open', side_effect=TimeoutError('fixture-key')) as call:
            with self.assertRaises(Failure) as error: provider('python', 'print(1)', 1)
        self.assertEqual(call.call_count, 1); self.assertNotIn('fixture-key', error.exception.message)
        for content, finish in [('   ', 'stop'), ('{}', 'length'), ('{"steps":[]}', 'stop')]:
            raw['choices'][0] = {'finish_reason': finish, 'message': {'content': content}}
            with patch.object(provider.opener, 'open', return_value=Response(json.dumps(raw).encode())):
                with self.assertRaises(Failure): provider('python', 'print(1)', 1)

    def test_local_config_is_literal_and_redirects_never_forward_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'model.env'; p.write_text('DEEPSEEK_API_KEY="$(touch do-not-run)"\nDEEPSEEK_MODEL=deepseek-flash\n')
            self.assertEqual(load_env(p)['DEEPSEEK_API_KEY'], '$(touch do-not-run)')
        from explanations import NoRedirect
        self.assertIsNone(NoRedirect().redirect_request(None, None, 302, 'moved', {}, 'https://other.example'))
        for base in ('http://api.deepseek.com', 'https://user:secret@host', 'https://host/?key=secret'):
            with self.assertRaises(ValueError): DeepSeek({'DEEPSEEK_API_KEY': 'fixture-key', 'DEEPSEEK_BASE_URL': base})

    def test_http_origin_body_limits_and_no_secret_or_source_logs(self):
        service = self.service()
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler(service, 'http://127.0.0.1:4173'))
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        self.addCleanup(lambda: (server.shutdown(), server.server_close(), thread.join()))
        def request(path='/api/explanations', data=None, origin='http://127.0.0.1:4173', method='POST', extra=None):
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=3)
            headers = {'Origin': origin, 'Content-Type': 'application/json', **(extra or {})}
            conn.request(method, path, json.dumps(data if data is not None else {'language': 'python', 'code': 'print(1)'}), headers)
            r = conn.getresponse(); body = r.read(); status = r.status; conn.close(); return status, body
        output = io.StringIO()
        with contextlib.redirect_stderr(output), contextlib.redirect_stdout(output):
            self.assertEqual(request(origin='https://evil.example')[0], 403)
            self.assertEqual(request(extra={'Sec-Fetch-Site': 'cross-site'})[0], 403)
            self.assertEqual(request(data={'language': 'python', 'code': 'x'*33000})[0], 413)
            self.assertEqual(request('/api/other')[0], 404)
            self.assertEqual(request('/healthz', method='GET')[0], 200)
            status, body = request(); self.assertEqual(status, 200); self.assertIn(b'explanation', body)
        self.assertEqual(output.getvalue(), '')

    def test_initial_installation_accepts_only_reviewed_bundle_and_private_config(self):
        spec = importlib.util.spec_from_file_location('install_explanation', Path(__file__).resolve().parents[1]/'deploy/install-explanation.py')
        installer = importlib.util.module_from_spec(spec); spec.loader.exec_module(installer)
        config = b'DEEPSEEK_API_KEY="fixture-key"\nDEEPSEEK_BASE_URL=https://api.deepseek.com\nDEEPSEEK_MODEL=deepseek-flash\n'
        self.assertEqual(installer.private_config(config), config)
        for invalid in (config + b'OTHER=private\n', config.replace(b'fixture-key', b''), config.replace(b'https:', b'http:'), b'x'*8193):
            with self.assertRaises(ValueError): installer.private_config(invalid)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); manifest = {}
            for name in installer.FILES:
                p = root/name; p.parent.mkdir(exist_ok=True); p.write_bytes(name.encode())
                manifest[name] = hashlib.sha256(p.read_bytes()).hexdigest()
            raw = json.dumps(manifest).encode(); (root/'manifest.json').write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest()
            self.assertEqual(set(installer.checked_bundle(root, digest)), set(installer.FILES))
            (root/'server/explanations.py').write_text('altered')
            with self.assertRaises(ValueError): installer.checked_bundle(root, digest)
            with self.assertRaises(ValueError): installer.checked_bundle(root, '0'*64)

    def test_upgrade_checks_source_bytes_syntax_and_atomic_modes_without_reading_credentials(self):
        spec = importlib.util.spec_from_file_location('upgrade_explanation', Path(__file__).resolve().parents[1]/'deploy/upgrade-explanation.py')
        upgrade = importlib.util.module_from_spec(spec); spec.loader.exec_module(upgrade)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root/'source.py'; raw = b'print("public fixture")\n'; source.write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest(); self.assertEqual(upgrade.checked_source(source, digest), raw)
            with self.assertRaises(ValueError): upgrade.checked_source(source, '0'*64)
            target = root/'target.py'; target.write_text('old')
            upgrade.replace(target, raw, 0o600); self.assertEqual(target.read_bytes(), raw); self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            self.assertFalse(list(root.glob('.review-*')))
            source.write_text('invalid ( syntax')
            with self.assertRaises(SyntaxError): upgrade.checked_source(source, hashlib.sha256(source.read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
