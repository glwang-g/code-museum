"""Bounded aggregate execution metrics. Never stores jobs, source, stdin or output."""
import datetime
import sqlite3
import threading

STATES = {'completed','failed','compile_error','compile_timed_out','timed_out','cancelled','output_limit','memory_limit','infrastructure_error'}
PHASES = ('queue','compile','run')

class Metrics:
    def __init__(self, filename=None):
        self.lock = threading.RLock()
        self.db = sqlite3.connect(filename or ':memory:', check_same_thread=False, timeout=2)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        self.db.execute('INSERT OR IGNORE INTO meta VALUES (?,?)', ('startedAt',datetime.datetime.now(datetime.timezone.utc).isoformat()))
        self.db.execute('CREATE TABLE IF NOT EXISTS totals (language TEXT, state TEXT, count INTEGER NOT NULL, queueSum INTEGER NOT NULL, queueCount INTEGER NOT NULL, compileSum INTEGER NOT NULL, compileCount INTEGER NOT NULL, runSum INTEGER NOT NULL, runCount INTEGER NOT NULL, PRIMARY KEY(language,state))')
        self.db.commit()
        self.persistent = bool(filename)
        self.missed = 0

    def record(self, job):
        if job.get('state') not in STATES: raise ValueError('Not a final execution state')
        values=[]
        for phase in PHASES:
            ms=job.get(phase+'Ms')
            valid=type(ms) is int and 0<=ms<=3600000
            values.extend((ms if valid else 0, int(valid)))
        with self.lock:
            try:
                self.db.execute('INSERT INTO totals VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(language,state) DO UPDATE SET count=count+1, queueSum=queueSum+excluded.queueSum, queueCount=queueCount+excluded.queueCount, compileSum=compileSum+excluded.compileSum, compileCount=compileCount+excluded.compileCount, runSum=runSum+excluded.runSum, runCount=runCount+excluded.runCount', (job['language'],job['state'],1,*values))
                self.db.commit()
            except sqlite3.Error:
                self.db.rollback(); self.missed += 1

    def snapshot(self):
        with self.lock:
            rows=self.db.execute('SELECT * FROM totals ORDER BY language,state').fetchall()
            counts={state:0 for state in sorted(STATES)}; languages={}
            sums={phase:[0,0] for phase in PHASES}
            for language,state,count,*values in rows:
                counts[state]+=count
                group=languages.setdefault(language,{'total':0,'states':{}})
                group['total']+=count;group['states'][state]=count
                for i,phase in enumerate(PHASES):
                    sums[phase][0]+=values[i*2];sums[phase][1]+=values[i*2+1]
            return {'startedAt':self.db.execute("SELECT value FROM meta WHERE key='startedAt'").fetchone()[0], 'persistent':self.persistent,'missedRecordsSinceRestart':self.missed,'total':sum(counts.values()),'states':counts,'languages':languages,'timings':{p:{'samples':n,'meanMs':round(total/n,1) if n else None} for p,(total,n) in sums.items()},'scope':'Terminal tasks only; program errors and resource limits are distinct from infrastructure failure. No source, input, output, owner or job IDs stored.'}
