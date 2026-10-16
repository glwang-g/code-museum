#!/usr/bin/env python3
"""Public guest book for Code Museum: short visitor messages and the visible log.

Python 3 standard library only. Runs inside the existing visit-recorder service
process (see analytics.py) so a release needs no second systemd unit. No IP
address, user agent, e-mail address or account is stored; only a salted-free
hash of the anonymous browser identifier is kept for rate limiting. Messages
are public by default, and an administrator token can hide one. The maintainer
is notified over SMTP when a credential file exists; failed deliveries stay
pending and are retried, and are never reported as sent.
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import smtplib
import sqlite3
import ssl
import threading
import unicodedata
from contextlib import closing
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import parse_qs
from uuid import UUID

MAX_AUTHOR = 24
MAX_BODY = 600
MIN_BODY = 2
MAX_PAGE = 80
MAX_REQUEST = 8192
MAX_LIMIT = 50
DEFAULT_LIMIT = 20
MIN_INTERVAL_SECONDS = 20
DAILY_LIMIT = 8
DEFAULT_MAIL_TO = '1956341482@qq.com'
DEFAULT_ENV_FILE = '/etc/code-museum/messages.env'
CONTROL = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
MESSAGE_ID = re.compile(r'^[a-f0-9]{32}$')


class Rejected(ValueError):
    """A request the service refuses to store, with the status it maps to."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def connect(database):
    db = sqlite3.connect(database, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('''CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        author TEXT NOT NULL,
        body TEXT NOT NULL,
        page TEXT NOT NULL,
        visitor TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        notified_at TEXT,
        notify_attempts INTEGER NOT NULL DEFAULT 0,
        notify_error TEXT)''')
    db.execute('CREATE INDEX IF NOT EXISTS messages_created ON messages(created_at DESC)')
    db.execute('CREATE INDEX IF NOT EXISTS messages_visitor ON messages(visitor, created_at DESC)')
    db.commit()
    return db


def clean_text(value, field, maximum, minimum=1):
    if not isinstance(value, str):
        raise Rejected(400, 'Invalid ' + field)
    normalized = unicodedata.normalize('NFC', value.replace('\r\n', '\n').replace('\r', '\n'))
    normalized = CONTROL.sub('', normalized)
    normalized = re.sub(r'\n{3,}', '\n\n', normalized).strip()
    if len(normalized) < minimum:
        raise Rejected(400, 'Invalid ' + field)
    if len(normalized) > maximum:
        raise Rejected(413, 'Invalid ' + field)
    return normalized


def identifier(value, field):
    if not isinstance(value, str):
        raise Rejected(400, 'Invalid ' + field)
    try:
        canonical = str(UUID(value, version=4))
    except (ValueError, AttributeError, TypeError):
        raise Rejected(400, 'Invalid ' + field)
    if canonical != value:
        raise Rejected(400, 'Invalid ' + field)
    return value


def normalize(data):
    if not isinstance(data, dict):
        raise Rejected(400, 'Invalid payload')
    allowed = {'author', 'body', 'page', 'visitorId', 'eventId'}
    if set(data) - allowed:
        raise Rejected(400, 'Invalid payload')
    body = clean_text(data.get('body'), 'body', MAX_BODY, MIN_BODY)
    author = clean_text(data.get('author', ''), 'author', MAX_AUTHOR, 0) if data.get('author') else ''
    page = clean_text(data.get('page', ''), 'page', MAX_PAGE, 0) if data.get('page') else ''
    return {'author': author or '匿名', 'body': body, 'page': page,
            'visitor': hashlib.sha256(identifier(data.get('visitorId'), 'visitorId').encode()).hexdigest(),
            'id': identifier(data.get('eventId'), 'eventId').replace('-', '')[:32]}


def public_message(row):
    return {'id': row[0], 'createdAt': row[1], 'author': row[2], 'body': row[3], 'page': row[4]}


def create(database, payload):
    record = normalize(payload)
    now = datetime.now(timezone.utc)
    with closing(connect(database)) as db:
        db.execute('BEGIN IMMEDIATE')
        existing = db.execute('SELECT id, created_at, author, body, page FROM messages WHERE id=?', (record['id'],)).fetchone()
        if existing:
            db.commit()
            return public_message(existing), False  # Repeats of one submission never post twice.
        recent = db.execute('SELECT created_at FROM messages WHERE visitor=? ORDER BY created_at DESC LIMIT 1', (record['visitor'],)).fetchone()
        if recent:
            last = datetime.fromisoformat(recent[0])
            if now - last < timedelta(seconds=MIN_INTERVAL_SECONDS):
                db.commit()
                raise Rejected(429, 'Too many messages')
            day = db.execute('SELECT COUNT(*) FROM messages WHERE visitor=? AND created_at>=?', (record['visitor'], (now - timedelta(days=1)).isoformat())).fetchone()[0]
            if day >= DAILY_LIMIT:
                db.commit()
                raise Rejected(429, 'Daily message limit reached')
        db.execute('INSERT INTO messages (id, created_at, author, body, page, visitor, visible) VALUES (?,?,?,?,?,?,1)',
                   (record['id'], now.isoformat(), record['author'], record['body'], record['page'], record['visitor']))
        db.commit()
    return {'id': record['id'], 'createdAt': now.isoformat(), 'author': record['author'], 'body': record['body'], 'page': record['page']}, True


def listing(database, limit=DEFAULT_LIMIT, offset=0, include_hidden=False):
    where = '' if include_hidden else 'WHERE visible=1'
    with closing(connect(database)) as db:
        total = db.execute('SELECT COUNT(*) FROM messages ' + where).fetchone()[0]
        rows = db.execute('SELECT id, created_at, author, body, page FROM messages ' + where +
                          ' ORDER BY created_at DESC LIMIT ? OFFSET ?', (limit, offset)).fetchall()
    return {'messages': [public_message(row) for row in rows], 'total': total,
            'limit': limit, 'offset': offset,
            'policy': '留言公开显示；只保存昵称、内容、页面位置与匿名标识哈希，不保存 IP、邮箱或账号。'}


def set_visibility(database, message_id, visible):
    with closing(connect(database)) as db:
        changed = db.execute('UPDATE messages SET visible=? WHERE id=?', (1 if visible else 0, message_id)).rowcount
        db.commit()
    return bool(changed)


def pending(database, limit=10):
    with closing(connect(database)) as db:
        return db.execute('SELECT id, created_at, author, body, page FROM messages WHERE notified_at IS NULL ORDER BY created_at ASC LIMIT ?', (limit,)).fetchall()


def mark_notified(database, message_id, error=''):
    now = datetime.now(timezone.utc).isoformat()
    with closing(connect(database)) as db:
        if error:
            db.execute('UPDATE messages SET notify_attempts=notify_attempts+1, notify_error=? WHERE id=?', (error[:200], message_id))
        else:
            db.execute('UPDATE messages SET notified_at=?, notify_attempts=notify_attempts+1, notify_error=NULL WHERE id=?', (now, message_id))
        db.commit()


def report(database):
    with closing(connect(database)) as db:
        row = db.execute('SELECT COUNT(*), SUM(visible), SUM(notified_at IS NULL) FROM messages').fetchone()
        return {'total': row[0], 'visible': row[1] or 0, 'pendingNotification': row[2] or 0,
                'note': 'pendingNotification counts stored messages without a confirmed SMTP delivery.'}


def load_mail_config(env_file=DEFAULT_ENV_FILE, environ=None):
    environ = os.environ if environ is None else environ
    values = {}
    path = Path(env_file)
    if path.is_file():
        for line in path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            values[key.strip()] = value.strip().strip('"').strip("'")
    def value(key):
        return environ.get(key) or values.get(key) or ''
    user = value('MESSAGES_SMTP_USER')
    password = value('MESSAGES_SMTP_PASSWORD')
    config = {'host': value('MESSAGES_SMTP_HOST') or 'smtp.qq.com',
              'port': int(value('MESSAGES_SMTP_PORT') or 465),
              'user': user, 'password': password,
              'to': value('MESSAGES_MAIL_TO') or user or DEFAULT_MAIL_TO,
              'admin_token': value('MESSAGES_ADMIN_TOKEN')}
    config['enabled'] = bool(user and password and config['to'])
    return config


def mail_message(record, config):
    created = datetime.fromisoformat(record[1]).astimezone(timezone(timedelta(hours=8)))
    message = EmailMessage()
    message['Subject'] = 'Code Museum 留言 · ' + (record[2] or '匿名')
    message['From'] = config['user']
    message['To'] = config['to']
    message.set_content('\n'.join([
        'Code Museum 收到一条新留言。',
        '',
        '时间：' + created.strftime('%Y-%m-%d %H:%M:%S %z'),
        '昵称：' + (record[2] or '匿名'),
        '位置：' + (record[4] or '未记录'),
        '编号：' + record[0],
        '',
        record[3],
        '',
        '这条留言同时公开显示在网站上。隐藏：python3 server/messages.py --hide ' + record[0],
    ]))
    return message


def send(database, record, config):
    context = ssl.create_default_context()
    if config['port'] == 465:
        client = smtplib.SMTP_SSL(config['host'], config['port'], timeout=20, context=context)
    else:
        client = smtplib.SMTP(config['host'], config['port'], timeout=20)
    try:
        if config['port'] != 465:
            client.starttls(context=context)
        client.login(config['user'], config['password'])
        client.send_message(mail_message(record, config))
    finally:
        try:
            client.quit()
        except smtplib.SMTPException:
            client.close()
    mark_notified(database, record[0])


def deliver_pending(database, config, limit=10):
    if not config['enabled']:
        return 0
    delivered = 0
    for record in pending(database, limit):
        try:
            send(database, record, config)
            delivered += 1
        except (OSError, smtplib.SMTPException) as error:
            mark_notified(database, record[0], type(error).__name__ + ': ' + str(error))
    return delivered


class MailWorker(threading.Thread):
    """Retry pending notifications without blocking a visitor request."""

    def __init__(self, database, config, interval=120):
        super().__init__(daemon=True, name='messages-mail')
        self.database, self.config, self.interval = database, config, interval
        self.stopping = threading.Event()

    def run(self):
        while not self.stopping.is_set():
            try:
                deliver_pending(self.database, self.config)
            except sqlite3.Error:
                pass
            self.stopping.wait(self.interval)

    def stop(self):
        self.stopping.set()


class Messages:
    """Transport-agnostic endpoint logic; analytics.py owns the HTTP server."""

    def __init__(self, database, origin, config):
        self.database, self.origin, self.config = database, origin, config

    @staticmethod
    def visibility_path(path):
        parts = path.split('?')[0].strip('/').split('/')
        if len(parts) == 4 and parts[:2] == ['api', 'messages'] and parts[3] == 'visibility' and MESSAGE_ID.match(parts[2] or ''):
            return parts[2]
        return None

    def read(self, query):
        limit, offset = DEFAULT_LIMIT, 0
        try:
            raw = parse_qs(query or '')
            if 'limit' in raw:
                limit = max(1, min(MAX_LIMIT, int(raw['limit'][0])))
            if 'offset' in raw:
                offset = max(0, min(10000, int(raw['offset'][0])))
        except (ValueError, IndexError):
            return 400, {'error': 'Invalid query'}
        try:
            return 200, listing(self.database, limit, offset)
        except sqlite3.Error:
            return 503, {'error': 'Guest book unavailable'}

    def submit(self, headers, raw):
        if headers.get('Origin') != self.origin:
            return 403, {'error': 'Origin not allowed'}
        if headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return 415, {'error': 'Expected application/json'}
        if len(raw) < 2 or len(raw) > MAX_REQUEST:
            return 413, {'error': 'Invalid size'}
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError):
            return 400, {'error': 'Invalid payload'}
        try:
            message, created = create(self.database, payload)
        except Rejected as rejection:
            return rejection.status, {'error': str(rejection)}
        except sqlite3.Error:
            return 503, {'error': 'Guest book unavailable'}
        return 201, {'message': message, 'created': created,
                     'note': '留言已保存并公开显示。' if created else '重复提交已忽略，返回已保存的留言。'}

    def hide(self, headers, raw, message_id):
        token = self.config.get('admin_token') or ''
        supplied = (headers.get('Authorization') or '').removeprefix('Bearer ')
        if not token or len(supplied) != len(token) or not secrets_equal(supplied, token):
            return 403, {'error': 'Administrator token required'}
        try:
            payload = json.loads(raw or b'{}')
        except (ValueError, UnicodeError):
            return 400, {'error': 'Invalid payload'}
        if not isinstance(payload, dict) or not isinstance(payload.get('visible'), bool):
            return 400, {'error': 'Invalid payload'}
        try:
            changed = set_visibility(self.database, message_id, payload['visible'])
        except sqlite3.Error:
            return 503, {'error': 'Guest book unavailable'}
        return (200 if changed else 404), {'changed': changed}


def secrets_equal(left, right):
    return hmac.compare_digest(left.encode(), right.encode())


def main():
    parser = argparse.ArgumentParser(description='Code Museum guest book maintenance')
    parser.add_argument('--database', default=os.environ.get('MESSAGES_DB', '/var/lib/code-museum/messages.sqlite3'))
    parser.add_argument('--env-file', default=os.environ.get('MESSAGES_ENV_FILE', DEFAULT_ENV_FILE))
    parser.add_argument('--report', action='store_true')
    parser.add_argument('--list', type=int, metavar='N', help='Print the newest N messages, including hidden ones')
    parser.add_argument('--hide', metavar='ID')
    parser.add_argument('--show', metavar='ID')
    parser.add_argument('--deliver', action='store_true', help='Retry pending notifications once')
    args = parser.parse_args()
    if args.hide or args.show:
        identifier_to_set = args.hide or args.show
        if not MESSAGE_ID.match(identifier_to_set):
            parser.error('Expected a 32-character message id')
        changed = set_visibility(args.database, identifier_to_set, bool(args.show))
        print(('Updated ' if changed else 'No message matched ') + identifier_to_set)
        return
    if args.deliver:
        print('Delivered ' + str(deliver_pending(args.database, load_mail_config(args.env_file))))
        return
    if args.list:
        for row in listing(args.database, min(MAX_LIMIT, args.list), 0, include_hidden=True)['messages']:
            print(row['createdAt'], row['id'], row['author'], row['page'], json.dumps(row['body'], ensure_ascii=False))
        return
    print(json.dumps(report(args.database), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
