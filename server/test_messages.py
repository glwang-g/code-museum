import hashlib
import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock
import messages


VISITOR = '3f6a1c2e-4b5d-4e7f-8a9b-0c1d2e3f4a5b'
EVENT = '9d1e2f3a-4b5c-4d6e-8f70-1a2b3c4d5e6f'


def payload(**overrides):
    data = {'author': ' 张三 ', 'body': '这是一条测试留言。', 'page': '语言检索 · python', 'visitorId': VISITOR, 'eventId': EVENT}
    data.update(overrides)
    return data


class GuestBookTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.database = str(Path(self.directory.name) / 'messages.sqlite3')

    def tearDown(self):
        self.directory.cleanup()

    def test_normalize_cleans_text_and_rejects_bad_payloads(self):
        record = messages.normalize({'author': ' 张三\r\n', 'body': '第一行\r\n\r\n\r\n第二行', 'page': '  ', 'visitorId': VISITOR, 'eventId': EVENT})
        self.assertEqual(record['author'], '张三')
        self.assertEqual(record['body'], '第一行\n\n第二行')
        self.assertEqual(record['page'], '')
        self.assertEqual(record['id'], EVENT.replace('-', ''))
        self.assertEqual(record['visitor'], hashlib.sha256(VISITOR.encode()).hexdigest())
        self.assertNotIn(VISITOR, json.dumps(record))
        for bad in [{'visitorId': VISITOR, 'eventId': EVENT, 'body': 'ok', 'extra': 1},
                    payload(visitorId='not-a-uuid'), payload(eventId='not-a-uuid'),
                    payload(visitorId=VISITOR.upper()), payload(body='一'), payload(body='x' * (messages.MAX_BODY + 1)),
                    payload(author='x' * (messages.MAX_AUTHOR + 1)), payload(author=5), 'not-a-dict']:
            with self.assertRaises(messages.Rejected) as raised:
                messages.normalize(bad)
            self.assertIn(raised.exception.status, (400, 413))
        self.assertEqual(messages.normalize(payload(author='')).get('author'), '匿名')
        self.assertEqual(messages.normalize(payload(author=None))['author'], '匿名')

    def test_create_is_idempotent_and_rate_limited(self):
        record, created = messages.create(self.database, payload())
        self.assertTrue(created)
        again, created = messages.create(self.database, payload())
        self.assertFalse(created)
        self.assertEqual(again['id'], record['id'])
        self.assertEqual(messages.report(self.database)['total'], 1)
        with self.assertRaises(messages.Rejected) as raised:
            messages.create(self.database, payload(eventId='1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', body='第二条'))
        self.assertEqual(raised.exception.status, 429)
        self.assertEqual(str(raised.exception), 'Too many messages')
        self.assertEqual(messages.report(self.database)['total'], 1)

    def test_daily_limit_counts_a_full_day_per_visitor(self):
        visitor = hashlib.sha256(VISITOR.encode()).hexdigest()
        now = datetime.now(timezone.utc)
        with sqlite3.connect(self.database) as db:
            messages.connect(self.database).close()
            for index in range(messages.DAILY_LIMIT):
                db.execute('INSERT INTO messages (id, created_at, author, body, page, visitor, visible) VALUES (?,?,?,?,?,?,1)',
                           (format(index, '032x'), (now - timedelta(seconds=30 + index)).isoformat(), '匿名', '旧留言', '', visitor))
            db.commit()
        with self.assertRaises(messages.Rejected) as raised:
            messages.create(self.database, payload())
        self.assertEqual(str(raised.exception), 'Daily message limit reached')

    def test_listing_and_visibility(self):
        first, _ = messages.create(self.database, payload())
        messages.create(self.database, payload(eventId='1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', body='第二条', visitorId='0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e'))
        listing = messages.listing(self.database)
        self.assertEqual(listing['total'], 2)
        self.assertEqual(listing['limit'], messages.DEFAULT_LIMIT)
        self.assertIn('不保存 IP', listing['policy'])
        self.assertTrue(messages.set_visibility(self.database, first['id'], False))
        self.assertEqual(messages.listing(self.database)['total'], 1)
        self.assertEqual(messages.listing(self.database, include_hidden=True)['total'], 2)
        self.assertFalse(messages.set_visibility(self.database, 'f' * 32, False))
        self.assertEqual(messages.listing(self.database, limit=messages.MAX_LIMIT + 5)['limit'], messages.MAX_LIMIT + 5)

    def test_submit_guards_origin_content_type_and_size(self):
        book = messages.Messages(self.database, 'https://codemuseum.freexlib.com', messages.load_mail_config('/nonexistent', {}))
        self.assertEqual(book.submit({}, b'{}')[0], 403)
        headers = {'Origin': 'https://codemuseum.freexlib.com', 'Content-Type': 'text/plain'}
        self.assertEqual(book.submit(headers, b'{}')[0], 415)
        headers['Content-Type'] = 'application/json; charset=utf-8'
        self.assertEqual(book.submit(headers, b'x' * (messages.MAX_REQUEST + 1))[0], 413)
        self.assertEqual(book.submit(headers, b'[]')[0], 400)
        status, body = book.submit(headers, json.dumps(payload()).encode())
        self.assertEqual(status, 201)
        self.assertTrue(body['created'])
        self.assertIn('公开显示', body['note'])
        self.assertEqual(body['message']['author'], '张三')
        status, body = book.submit(headers, json.dumps(payload()).encode())
        self.assertEqual((status, body['created']), (201, False))
        self.assertNotIn('visitorId', json.dumps(body))
        self.assertEqual(book.read('limit=1')[0], 200)
        self.assertEqual(book.read('limit=abc')[0], 400)
        self.assertEqual(messages.Messages.visibility_path('/api/messages/' + 'a' * 32 + '/visibility'), 'a' * 32)
        self.assertIsNone(messages.Messages.visibility_path('/api/messages/' + 'A' * 32 + '/visibility'))
        self.assertIsNone(messages.Messages.visibility_path('/api/messages'))

    def test_hide_requires_configured_admin_token(self):
        record, _ = messages.create(self.database, payload())
        config = messages.load_mail_config('/nonexistent', {'MESSAGES_ADMIN_TOKEN': 'secret-token'})
        book = messages.Messages(self.database, 'https://codemuseum.freexlib.com', config)
        path = '/api/messages/' + record['id'] + '/visibility'
        self.assertEqual(book.hide({'Authorization': 'Bearer wrong'}, b'{"visible":false}', record['id'])[0], 403)
        self.assertEqual(book.hide({'Authorization': 'Bearer secret-token'}, b'{"visible":"no"}', record['id'])[0], 400)
        status, body = book.hide({'Authorization': 'Bearer secret-token'}, b'{"visible":false}', record['id'])
        self.assertEqual((status, body['changed']), (200, True))
        self.assertEqual(messages.listing(self.database)['total'], 0)
        self.assertNotIn('secret-token', json.dumps(messages.report(self.database)))
        self.assertEqual(messages.Messages(self.database, 'https://codemuseum.freexlib.com', messages.load_mail_config('/nonexistent', {})).hide({}, b'{}', record['id'])[0], 403)


class MailTests(unittest.TestCase):
    def test_config_defaults_to_the_maintainer_mailbox_and_reads_the_env_file(self):
        default = messages.load_mail_config('/nonexistent', {})
        self.assertEqual(default['to'], '1956341482@qq.com')
        self.assertEqual((default['host'], default['port']), ('smtp.qq.com', 465))
        self.assertFalse(default['enabled'])
        with tempfile.TemporaryDirectory() as directory:
            env = Path(directory) / 'messages.env'
            env.write_text('# comment\nMESSAGES_SMTP_USER=1956341482@qq.com\nMESSAGES_SMTP_PASSWORD="abc"\nMESSAGES_MAIL_TO=elsewhere@example.com\nMESSAGES_ADMIN_TOKEN=tok\n')
            config = messages.load_mail_config(str(env), {})
            self.assertEqual((config['user'], config['password']), ('1956341482@qq.com', 'abc'))
            self.assertEqual(config['to'], 'elsewhere@example.com')
            self.assertTrue(config['enabled'])
            self.assertEqual(messages.load_mail_config(str(env), {'MESSAGES_MAIL_TO': 'override@example.com'})['to'], 'override@example.com')

    def test_notification_body_names_the_message_and_never_claims_delivery(self):
        record = ('a' * 32, datetime.now(timezone.utc).isoformat(), '张三', '第一条\n第二条', '语言实验台 · python')
        built = messages.mail_message(record, messages.load_mail_config('/nonexistent', {'MESSAGES_SMTP_USER': '1956341482@qq.com', 'MESSAGES_SMTP_PASSWORD': 'p'}))
        body = built.get_content()
        self.assertEqual(built['To'], '1956341482@qq.com')
        self.assertIn('a' * 32, body)
        self.assertIn('第一条\n第二条', body)
        self.assertIn('--hide ' + 'a' * 32, body)
        self.assertIn('+0800', body)

    def test_delivery_marks_success_and_keeps_failures_pending(self):
        with tempfile.TemporaryDirectory() as directory:
            database = str(Path(directory) / 'messages.sqlite3')
            record, _ = messages.create(database, payload())
            config = messages.load_mail_config('/nonexistent', {'MESSAGES_SMTP_USER': 'u@qq.com', 'MESSAGES_SMTP_PASSWORD': 'p'})
            with mock.patch.object(messages, 'send', side_effect=OSError('smtp refused')):
                self.assertEqual(messages.deliver_pending(database, config), 0)
            self.assertEqual(messages.report(database)['pendingNotification'], 1)
            with sqlite3.connect(database) as db:
                self.assertEqual(db.execute('SELECT notify_attempts, notify_error FROM messages').fetchone(), (1, 'OSError: smtp refused'))
            sent = []
            with mock.patch.object(messages, 'send', side_effect=lambda database, record, config: sent.append(record[0]) or messages.mark_notified(database, record[0])):
                self.assertEqual(messages.deliver_pending(database, config), 1)
            self.assertEqual(sent, [record['id']])
            self.assertEqual(messages.report(database)['pendingNotification'], 0)
            self.assertEqual(messages.deliver_pending(database, messages.load_mail_config('/nonexistent', {}), 10), 0)


if __name__ == '__main__':
    unittest.main()
