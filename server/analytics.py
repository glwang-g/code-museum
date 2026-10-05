#!/usr/bin/env python3
"""Same-origin page-load counters. Python 3 standard library only."""
import argparse
import hashlib
import json
import os
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID


def connect(database):
    db = sqlite3.connect(database, timeout=10)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, first_seen TEXT NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS pageviews (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, created_at TEXT NOT NULL)")
    db.execute("INSERT OR IGNORE INTO metadata VALUES ('started_at', ?)", (datetime.now(timezone.utc).isoformat(),))
    db.commit()
    return db


def record_visit(database, visitor_id, event_id):
    visitor = hashlib.sha256(visitor_id.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    with closing(connect(database)) as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT 1 FROM pageviews WHERE id=?", (event_id,)).fetchone():
            db.execute("INSERT OR IGNORE INTO visitors VALUES (?, ?)", (visitor, now))
            db.execute("INSERT INTO pageviews VALUES (?, ?, ?)", (event_id, visitor, now))
        db.commit()


def report(database):
    with closing(connect(database)) as db:
        return {"uv": db.execute("SELECT COUNT(*) FROM visitors").fetchone()[0],
                "pv": db.execute("SELECT COUNT(*) FROM pageviews").fetchone()[0],
                "startedAt": db.execute("SELECT value FROM metadata WHERE key='started_at'").fetchone()[0],
                "definition": "UV: distinct anonymous browser IDs; PV: deduplicated page-load events"}


def handler(database, origin):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, format, *args):
            pass  # Do not persist IPs, identifiers or request bodies in application logs.

        def respond(self, status):
            self.send_response(status)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):
            self.respond(204 if self.path == "/healthz" else 404)

        def do_POST(self):
            if self.path != "/api/visits":
                return self.respond(404)
            if self.headers.get("Origin") != origin:
                return self.respond(403)
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                return self.respond(415)
            if re.search(r"bot|crawler|spider|headless|slurp", self.headers.get("User-Agent", ""), re.I):
                return self.respond(204)
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 1 or length > 1024:
                    return self.respond(413)
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict) or set(data) != {"visitorId", "eventId"}:
                    return self.respond(400)
                for key in ("visitorId", "eventId"):
                    value = data[key]
                    if not isinstance(value, str) or str(UUID(value, version=4)) != value:
                        return self.respond(400)
                record_visit(database, data["visitorId"], data["eventId"])
            except (ValueError, TypeError, UnicodeError):
                return self.respond(400)
            except sqlite3.Error:
                return self.respond(503)
            self.respond(204)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", default=os.environ.get("ANALYTICS_DB", "/var/lib/code-museum/visits.sqlite3"))
    parser.add_argument("--origin", default="https://codemuseum.freexlib.com")
    parser.add_argument("--port", type=int, default=4180)
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--backup", metavar="FILE")
    args = parser.parse_args()
    if not Path(args.database).is_file() and (args.report or args.backup):
        parser.error("No statistics database exists yet")
    if args.backup:
        with sqlite3.connect(args.database) as source, sqlite3.connect(args.backup) as target:
            source.backup(target)
        return
    if args.report:
        print(json.dumps(report(args.database), ensure_ascii=False, indent=2))
        return
    parsed = urlsplit(args.origin)
    if parsed.scheme != "https" or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
        parser.error("--origin must be an HTTPS origin without a path")
    Path(args.database).parent.mkdir(parents=True, exist_ok=True)
    connect(args.database).close()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler(args.database, args.origin))
    server.timeout = 10
    print("Code Museum visit recorder on 127.0.0.1:" + str(args.port), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
