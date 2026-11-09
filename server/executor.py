#!/usr/bin/env python3
"""Private Docker execution prototype. No runtime downloads or shell commands."""
import argparse
import collections
import hashlib
import hmac
import json
import os
import re
import selectors
import signal
import subprocess
import sys
import threading
import time
import uuid
import datetime
from observability import Metrics
from mcp_http import MuseumProvider, readonly_token, handle as handle_mcp
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

LABEL = 'code-museum.executor=private-v1'
PREFIX = 'cm-exec-'
MAX_BODY, MAX_CODE, MAX_STDIN, MAX_OUTPUT = 98304, 65536, 16384, 32768
FINAL = {'completed', 'failed', 'compile_error', 'compile_timed_out', 'timed_out', 'cancelled', 'output_limit', 'memory_limit', 'infrastructure_error'}
RUN_SECONDS = {'groovy': 8}  # Includes fresh JVM startup and script compilation on the current node.
COMPILED = {
    'oberon': ('code-museum-oberon', '/opt/obnc/bin/obnc', 512, 10, 'Main.obn', ['/opt/obnc/bin/obnc', '-o', '/work/program', '/work/Main.obn'], ['/work/program']),
    'bcpl': ('code-museum-bcpl', '/opt/bcpl/cintcode/bin/cintsys64', 512, 10, 'main.b', ['/opt/bcpl/cintcode/bin/cintsys64', '-q', '-c', 'bcpl', '/work/main.b', 'to', '/work/program', 't64'], ['/opt/bcpl/cintcode/bin/cintsys64', '-q', '--', '/opt/bcpl/museum-runner']),
    'vhdl': ('code-museum-vhdl', '/usr/bin/ghdl-mcode', 512, 10, 'main.vhd', ['/usr/local/bin/museum-vhdl-compile'], ['/usr/bin/ghdl-mcode', '-r', '--std=08', '--workdir=/work', 'main', '--assert-level=error', '--unbuffered']),
    'verilog': ('code-museum-verilog', '/usr/bin/iverilog', 512, 10, 'main.v', ['/usr/bin/iverilog', '-g2005', '-Wall', '-s', 'main', '-o', '/work/program.vvp', '/work/main.v'], ['/usr/bin/vvp', '-N', '/work/program.vvp', '-none']),
    'x86-assembly': ('code-museum-x86-assembly', '/usr/bin/nasm', 256, 10, 'main.asm', ['/usr/local/bin/museum-nasm-compile'], ['/work/program']),
    'dart': ('code-museum-dart', '/opt/dart-sdk/bin/dart', 768, 15, 'main.dart', ['/opt/dart-sdk/bin/dart', '--suppress-analytics', 'compile', 'exe', '/work/main.dart', '-o', '/work/program'], ['/work/program']),
    'swift': ('code-museum-swift', '/opt/swift/usr/bin/swiftc', 1024, 30, 'main.swift', ['/opt/swift/usr/bin/swiftc', '-swift-version', '6', '-j', '1', '-module-cache-path', '/work/module-cache', '-o', '/work/program', '/work/main.swift'], ['/work/program']),
    'zig': ('code-museum-zig', '/opt/zig/zig', 1024, 30, 'main.zig', ['/usr/local/bin/museum-zig-compile'], ['/work/program']),
    'nim': ('code-museum-nim', '/usr/bin/nim', 768, 20, 'main.nim', ['/usr/bin/nim', 'c', '--cc:gcc', '--parallelBuild:1', '--hints:off', '--warnings:on', '--nimcache:/work/nimcache', '--out:/work/program', '/work/main.nim'], ['/work/program']),
    'd': ('code-museum-d', '/usr/bin/gdc-12', 768, 10, 'main.d', ['/usr/bin/gdc-12', '-O0', '-Wall', '-o', '/work/program', '/work/main.d'], ['/work/program']),
    'f-sharp': ('mcr.microsoft.com/dotnet/sdk', '/usr/bin/dotnet', 1024, 30, 'Main.fs', ['/usr/bin/dotnet', '/usr/share/dotnet/sdk/10.0.403/FSharp/fsc.dll', '--nologo', '--langversion:10.0', '--target:exe', '--targetprofile:netcore', '--noframework', '--simpleresolution', '--out:/work/program.dll', '@/work/refs.rsp', '/work/Main.fs'], ['/usr/bin/dotnet', 'exec', '--runtimeconfig', '/usr/share/dotnet/sdk/10.0.403/dotnet.runtimeconfig.json', '/work/program.dll']),
    'visual-basic.net': ('mcr.microsoft.com/dotnet/sdk', '/usr/bin/dotnet', 1024, 30, 'Main.vb', ['/usr/bin/dotnet', '/usr/share/dotnet/sdk/10.0.403/Roslyn/bincore/vbc.dll', '-nologo', '-noconfig', '-nostdlib', '-optionstrict+', '-define:_MYTYPE="Empty"', '-target:exe', '-out:/work/program.dll', '@/work/refs.rsp', '/work/Main.vb'], ['/usr/bin/dotnet', 'exec', '--runtimeconfig', '/usr/share/dotnet/sdk/10.0.403/dotnet.runtimeconfig.json', '/work/program.dll']),
    'scala': ('code-museum-scala', '/opt/java/openjdk/bin/java', 768, 30, 'Main.scala', ['/opt/java/openjdk/bin/java', '-Xmx384m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-cp', '/opt/scala/*', 'scala.tools.nsc.Main', '-usejavacp', '-release:17', '-d', '/work', '/work/Main.scala'], ['/opt/java/openjdk/bin/java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-cp', '/work:/opt/scala/*', 'Main']),
    'erlang': ('code-museum-erlang', '/usr/bin/erl', 512, 10, 'main.erl', ['/usr/bin/erl', '+S', '1:1', '+A', '1', '+SDcpu', '1', '+SDio', '1', '-noshell', '-eval', 'case compile:file("/work/main.erl",[report_errors,report_warnings,{outdir,"/work"}]) of {ok,main} -> halt(0); _ -> halt(1) end.'], ['/usr/bin/erl', '+S', '1:1', '+A', '1', '+SDcpu', '1', '+SDio', '1', '-noshell', '-pa', '/work', '-eval', 'main:main(),halt().']),
    'kotlin': ('code-museum-kotlin', '/opt/java/openjdk/bin/java', 768, 30, 'Main.kt', ['/opt/java/openjdk/bin/java', '-Xmx384m', '-Djansi.tmpdir=/work', '-Djansi.passthrough=true', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-cp', '/opt/kotlinc/lib/*', 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-kotlin-home', '/opt/kotlinc', '-jvm-target', '17', '-no-reflect', '-include-runtime', '-d', '/work/program.jar', '/work/Main.kt'], ['/opt/java/openjdk/bin/java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-jar', '/work/program.jar']),
    'haskell': ('code-museum-haskell', '/usr/bin/ghc', 768, 20, 'Main.hs', ['/usr/bin/ghc', '-v0', '-O0', '-Wall', '-XHaskell2010', '-outputdir', '/work', '-o', '/work/program', '/work/Main.hs'], ['/work/program']),
    'ocaml': ('code-museum-ocaml', '/usr/bin/ocamlc', 512, 10, 'main.ml', ['/usr/bin/ocamlc', '-w', '+a-70', '-o', '/work/program', '/work/main.ml'], ['/work/program']),
    'ada': ('code-museum-ada', '/usr/bin/gnatmake-12', 512, 10, 'main.adb', ['/usr/bin/gnatmake-12', '-q', '-gnat2012', '-gnatwa', '-o', '/work/program', '/work/main.adb'], ['/work/program']),
    'cobol': ('code-museum-cobol', '/usr/bin/cobc', 512, 10, 'main.cob', ['/usr/bin/cobc', '-x', '-free', '-std=cobol2014', '-Wall', '-o', '/work/program', '/work/main.cob'], ['/work/program']),
    'algol-60': ('code-museum-algol60', '/usr/local/bin/museum-algol60-compile', 512, 10, 'main.alg', ['/usr/local/bin/museum-algol60-compile'], ['/work/program']),
    'pascal': ('code-museum-pascal-r', '/usr/bin/fpc', 512, 10, 'main.pas', ['/usr/bin/fpc', '-n', '-Mobjfpc', '-Sh', '-O-', '-Fu/usr/lib/x86_64-linux-gnu/fpc/3.2.2/units/x86_64-linux/rtl', '-o/work/program', '/work/main.pas'], ['/work/program']),
    'c': ('gcc', '/usr/local/bin/gcc', 512, 10, 'main.c', ['gcc', '-std=c11', '-O0', '-Wall', '-Wextra', '/work/main.c', '-o', '/work/program'], ['/work/program']),
    'cpp': ('gcc', '/usr/local/bin/g++', 512, 10, 'main.cpp', ['g++', '-std=c++17', '-O0', '-Wall', '-Wextra', '/work/main.cpp', '-o', '/work/program'], ['/work/program']),
    'rust': ('rust', '/usr/local/cargo/bin/rustc', 768, 15, 'main.rs', ['rustc', '--edition=2021', '/work/main.rs', '-o', '/work/program'], ['/work/program']),
    'go': ('golang', '/usr/local/go/bin/go', 768, 30, 'main.go', ['go', 'build', '-o', '/work/program', '/work/main.go'], ['/work/program']),
    'java': ('eclipse-temurin', '/opt/java/openjdk/bin/javac', 768, 15, 'Museum.java', ['javac', '-J-Xmx256m', '-J-XX:ActiveProcessorCount=1', '--release', '17', '/work/Museum.java'], ['java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-cp', '/work', 'Museum']),
    'typescript': ('code-museum-cli', '/usr/local/bin/node', 512, 15, 'main.ts', ['node', '/opt/typescript/lib/tsc.js', '--strict', '--noEmitOnError', '--target', 'ES2022', '--module', 'commonjs', '--lib', 'ES2022,DOM', '--outDir', '/work/output', '/work/main.ts'], ['node', '--max-old-space-size=256', '/work/output/main.js']),
    'fortran': ('gcc', '/usr/local/bin/gfortran', 512, 10, 'main.f90', ['gfortran', '-std=f2008', '-O0', '-Wall', '-Wextra', '/work/main.f90', '-o', '/work/program'], ['/work/program']),
    'csharp': ('mcr.microsoft.com/dotnet/sdk', '/usr/bin/dotnet', 1024, 30, 'main.cs', ['/usr/bin/dotnet', '/usr/share/dotnet/sdk/10.0.403/Roslyn/bincore/csc.dll', '-nologo', '-noconfig', '-out:/work/program.dll', '@/work/refs.rsp', '/work/main.cs'], ['/usr/bin/dotnet', 'exec', '--runtimeconfig', '/usr/share/dotnet/sdk/10.0.403/dotnet.runtimeconfig.json', '/work/program.dll'])
}
PREPARE = {
    'f-sharp': ['/bin/sh', '-c', 'find /usr/share/dotnet/packs/Microsoft.NETCore.App.Ref -path "*/ref/net*/*.dll" -printf "-r:%p\\n" > /work/refs.rsp\nprintf "%s\\n" "-r:/usr/share/dotnet/sdk/10.0.403/FSharp/FSharp.Core.dll" >> /work/refs.rsp\ncp /usr/share/dotnet/sdk/10.0.403/FSharp/FSharp.Core.dll /work/FSharp.Core.dll'],
    'visual-basic.net': ['/bin/sh', '-c', 'find /usr/share/dotnet/packs/Microsoft.NETCore.App.Ref -path "*/ref/net*/*.dll" -printf "-r:%p\\n" > /work/refs.rsp\nfind /usr/share/dotnet/packs/Microsoft.NETCore.App.Ref -path "*/ref/net*/Microsoft.VisualBasic.Core.dll" -printf "-vbruntime:%p\\n" >> /work/refs.rsp'],
    'csharp': ['/bin/sh', '-c', 'find /usr/share/dotnet/packs/Microsoft.NETCore.App.Ref -path "*/ref/net*/*.dll" -printf "-r:%p\\n" > /work/refs.rsp']
}
SCRIPTED = {
    'postscript': ('/usr/bin/gs', 'main.ps', ['/usr/bin/gs', '-q', '-dSAFER', '-dNODISPLAY', '-dBATCH', '-dNOPAUSE', '/work/main.ps']),
    'wasm': ('/opt/wasmtime/wasmtime', 'main.wat', ['/opt/wasmtime/wasmtime', 'run', '-W', 'component-model=n,threads=n,max-memories=1,max-memory-size=268435456', '-S', 'inherit-env=n,preview0=n,tcp=n,udp=n,inherit-network=n,allow-ip-name-lookup=n,http=n', '/work/main.wat']),
    'tcsh': ('/usr/bin/tcsh', 'main.tcsh', ['/usr/bin/tcsh', '-f', '/work/main.tcsh']),
    'korn-shell': ('/usr/bin/ksh93', 'main.ksh', ['/usr/bin/ksh93', '-p', '/work/main.ksh']),
    'powershell': ('/usr/bin/pwsh', 'main.ps1', ['/usr/bin/pwsh', '-NoLogo', '-NoProfile', '-NonInteractive', '-File', '/opt/museum/powershell-entry.ps1']),
    'octave': ('/usr/bin/octave-cli', 'main.m', ['/usr/bin/octave-cli', '--no-gui', '--no-window-system', '--norc', '--no-history', '--quiet', '/work/main.m']),
    'julia': ('/opt/julia/bin/julia', 'main.jl', ['/opt/julia/bin/julia', '--startup-file=no', '--history-file=no', '--threads=1', '--compiled-modules=existing', '--pkgimages=existing', '--color=no', '/work/main.jl']),
    'standard-ml': ('/usr/bin/poly', 'main.sml', ['/usr/bin/poly', '--script', '/work/main.sml']),
    'tcl': ('/usr/bin/tclsh8.6', 'main.tcl', ['/usr/bin/tclsh8.6', '/work/main.tcl']),
    'elixir': ('/usr/bin/elixir', 'main.exs', ['/usr/bin/elixir', '--erl', '+S 1:1 +A 1 +SDcpu 1 +SDio 1', '/work/main.exs']),
    'groovy': ('/opt/java/openjdk/bin/java', 'main.groovy', ['/opt/java/openjdk/bin/java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-Dgroovy.grape.enable=false', '-cp', '/opt/groovy/lib/groovy-4.0.26.jar', 'groovy.ui.GroovyMain', '/work/main.groovy']),
    'clojure': ('/opt/java/openjdk/bin/java', 'main.clj', ['/opt/java/openjdk/bin/java', '-Xmx256m', '-XX:ActiveProcessorCount=1', '-XX:+UseSerialGC', '-Dfile.encoding=UTF-8', '-Duser.home=/work', '-Dclojure.main.report=stderr', '-cp', '/opt/clojure/*', 'clojure.main', '/work/main.clj']),
    'smalltalk': ('/opt/smalltalk/bin/gst', 'main.st', ['/opt/smalltalk/bin/gst', '--no-user-files', '-q', '-f', '/work/main.st']),
    'racket': ('/opt/racket/bin/racket', 'main.rkt', ['/opt/racket/bin/racket', '-q', '-U', '-t', '/work/main.rkt']),
    'forth': ('/usr/bin/gforth', 'main.fs', ['/usr/bin/gforth', '--no-dynamic', '-m', '16M', '-d', '1M', '-r', '1M', '/work/main.fs', '-e', 'bye']),
    'prolog': ('/usr/bin/swipl', 'main.pl', ['/usr/bin/swipl', '-q', '-f', 'none', '-F', 'none', '--no-packs', '--no-threads', '--on-error=halt', '--stack-limit=128m', '-s', '/work/main.pl', '-g', 'main', '-t', 'halt']),
    'common-lisp': ('/usr/bin/sbcl', 'main.lisp', ['/usr/bin/sbcl', '--noinform', '--dynamic-space-size', '128', '--control-stack-size', '8', '--no-sysinit', '--no-userinit', '--disable-debugger', '--script', '/work/main.lisp']),
    'r': ('/usr/bin/Rscript', 'main.R', ['/usr/bin/Rscript', '--vanilla', '--default-packages=stats,utils', '/work/main.R']),
    'sql': ('/usr/bin/sqlite3', 'main.sql', ['/usr/bin/sqlite3', '-safe', '-batch', '-bail', '-noheader', ':memory:']),
    'bash': ('/bin/bash', 'main.bash', ['/bin/bash', '--noprofile', '--norc', '/work/main.bash']),
    'awk': ('/usr/bin/gawk', 'main.awk', ['/usr/bin/gawk', '-f', '/work/main.awk', '--']),
    'sed': ('/bin/sed', 'main.sed', ['/bin/sed', '-f', '/work/main.sed', '--']),
    'php': ('/usr/bin/php83', 'main.php', ['/usr/bin/php83', '-n', '-d', 'display_errors=stderr', '-d', 'log_errors=0', '-d', 'html_errors=0', '-d', 'date.timezone=UTC', '-d', 'allow_url_fopen=0', '-d', 'allow_url_include=0', '-d', 'open_basedir=/work:/tmp', '-d', 'disable_functions=exec,passthru,shell_exec,system,proc_open,popen,pcntl_exec,fsockopen,pfsockopen,stream_socket_client,curl_exec,curl_multi_exec', '-f', '/work/main.php']),
    'perl': ('/usr/bin/perl', 'main.pl', ['/usr/bin/perl', '-CS', '/work/main.pl']),
    'xslt': ('/usr/bin/xsltproc', 'main.xsl', ['/usr/bin/xsltproc', '--nonet', '--nowrite', '--nomkdir', '--maxdepth', '100', '/work/main.xsl', '-'])
}
PYTHON_BOOT = "import sys,json,io,runpy; p=json.load(sys.stdin); open('/work/main.py','w').write(p['code']); sys.stdin=io.StringIO(p['stdin']); sys.argv=['/work/main.py']; runpy.run_path('/work/main.py',run_name='__main__')"
RUBY_BOOT = "require 'json'; require 'stringio'; p=JSON.parse(STDIN.read); File.write('/work/main.rb',p['code']); $stdin=StringIO.new(p['stdin']); Object.send(:remove_const,:STDIN); STDIN=$stdin; ARGV.clear; load '/work/main.rb'"


def load_runtimes(file):
    manifest = json.loads(Path(file).read_text())
    rows = manifest.get('runtimes', [])
    if manifest.get('schemaVersion') != 1 or not {'python', 'ruby'} <= {r['id'] for r in rows} or len({r['id'] for r in rows}) != len(rows):
        raise ValueError('Expected unique pinned runtime manifest')
    for r in rows:
        if r['id'] not in {'python', 'ruby', *COMPILED, *SCRIPTED}: raise ValueError('Unsupported runtime')
        if r['id'] in SCRIPTED:
            repository, memory = {'postscript': ('code-museum-postscript', 256), 'wasm': ('code-museum-wasm', 512), 'tcsh': ('code-museum-tcsh', 256), 'korn-shell': ('code-museum-korn-shell', 256), 'powershell': ('code-museum-powershell', 768), 'octave': ('code-museum-octave', 512), 'julia': ('code-museum-julia', 768), 'r': ('code-museum-pascal-r', 512), 'common-lisp': ('code-museum-common-lisp', 512), 'prolog': ('code-museum-prolog', 512), 'forth': ('code-museum-forth', 256), 'racket': ('code-museum-racket', 512), 'smalltalk': ('code-museum-smalltalk', 512), 'clojure': ('code-museum-clojure', 768), 'groovy': ('code-museum-groovy', 768), 'elixir': ('code-museum-elixir', 512), 'tcl': ('code-museum-tcl', 256), 'standard-ml': ('code-museum-standard-ml', 512)}.get(r['id'], ('code-museum-cli', 256))
            executable = SCRIPTED[r['id']][0]
        else:
            repository, executable, memory = COMPILED[r['id']][:3] if r['id'] in COMPILED else (r['id'], '/usr/local/bin/' + r['id'], {'python':256, 'ruby':512}[r['id']])
        # Project-built images are addressed by immutable local image ID, never a mutable tag.
        project_image = repository in {'code-museum-cli', 'code-museum-pascal-r', 'code-museum-algol60', 'code-museum-common-lisp', 'code-museum-prolog', 'code-museum-forth', 'code-museum-racket', 'code-museum-smalltalk', 'code-museum-cobol', 'code-museum-ada', 'code-museum-clojure', 'code-museum-ocaml', 'code-museum-haskell', 'code-museum-kotlin', 'code-museum-groovy', 'code-museum-erlang', 'code-museum-elixir', 'code-museum-tcl', 'code-museum-standard-ml', 'code-museum-scala', 'code-museum-d', 'code-museum-nim', 'code-museum-zig', 'code-museum-swift', 'code-museum-dart', 'code-museum-julia', 'code-museum-octave', 'code-museum-powershell', 'code-museum-korn-shell', 'code-museum-tcsh', 'code-museum-wasm', 'code-museum-x86-assembly', 'code-museum-verilog', 'code-museum-vhdl', 'code-museum-postscript', 'code-museum-bcpl', 'code-museum-oberon'}
        valid_image = r['image'] == r['imageId'] if project_image else re.fullmatch(re.escape(repository) + r'@sha256:[a-f0-9]{64}', r['image'])
        if not valid_image:
            raise ValueError('Runtime must use a pinned official digest or immutable project image ID')
        if project_image and not re.fullmatch('[a-f0-9]{64}', r.get('buildManifestSha256', '')):
            raise ValueError('Project runtime requires a fixed build manifest hash')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', r['imageId']) or r['os'] != 'linux':
            raise ValueError('Invalid image identity')
        if r['executable'] != executable or r['memoryMiB'] != memory or r['architecture'] != 'amd64':
            raise ValueError('Unexpected runtime command or memory limit')
    return {r['id']: r for r in rows}


def select_runtimes(runtimes, languages=None):
    """Select an explicit node inventory after validating the full pinned manifest."""
    if languages is None:
        return runtimes
    if not languages or len(set(languages)) != len(languages) or any(language not in runtimes for language in languages):
        raise ValueError('Expected unique configured runtime IDs for this node')
    return {language: runtimes[language] for language in languages}


def validate_submission(data, runtimes):
    if not isinstance(data, dict) or set(data) - {'language', 'code', 'stdin'} or not {'language', 'code'} <= set(data):
        raise ValueError('Expected language, code and optional stdin')
    if not isinstance(data.get('language'), str) or data['language'] not in runtimes:
        raise ValueError('Unsupported language')
    for field, limit in [('code', MAX_CODE), ('stdin', MAX_STDIN)]:
        value = data.get(field, '')
        if not isinstance(value, str) or len(value.encode('utf-8')) > limit:
            raise ValueError(field + ' exceeds its UTF-8 byte limit')
        if '\0' in value: raise ValueError('NUL is not accepted in text programs or input')
    if data['language'] == 'sql' and data.get('stdin', ''):
        raise ValueError('SQLite reads the SQL program from stdin; separate stdin is not supported')
    return {'language': data['language'], 'code': data['code'], 'stdin': data.get('stdin', '')}


class DockerRunner:
    def __init__(self, runtimes, runtime='runc', namespace='private-v1'):
        if runtime not in ('runc', 'runsc'):
            raise ValueError('Unsupported Docker runtime')
        self.runtimes, self.runtime = runtimes, runtime
        if not re.fullmatch(r'[a-z][a-z0-9-]{0,31}', namespace): raise ValueError('Invalid executor namespace')
        self.namespace = namespace
        self.label = 'code-museum.executor=' + namespace
        self.prefix = PREFIX if namespace == 'private-v1' else 'cm-' + namespace + '-'
        self.healthy = True

    def verify(self):
        info = json.loads(subprocess.check_output(['docker', 'info', '--format', '{{json .}}'], timeout=8))
        if info.get('CgroupVersion') != '2' or self.runtime not in info.get('Runtimes', {}):
            raise ValueError('Requires cgroup v2 and selected Docker runtime')
        warnings = ' '.join(info.get('Warnings') or []).lower()
        if any(s in warnings for s in ['no memory limit', 'no swap limit', 'no cpu cfs', 'no pids limit']):
            raise ValueError('Docker reports missing resource controls')
        if not any('seccomp' in s for s in info.get('SecurityOptions', [])):
            raise ValueError('Docker default seccomp must be available')
        for row in self.runtimes.values():
            image = json.loads(subprocess.check_output(['docker', 'image', 'inspect', row['image']], timeout=8))[0]
            if image['Id'] != row['imageId'] or image['Architecture'] != row['architecture']:
                raise ValueError('Pinned image identity/platform mismatch; provision images explicitly')
        self.cleanup_stale()

    def cleanup_stale(self):
        names = subprocess.check_output(['docker', 'ps', '-a', '--filter', 'label=' + self.label, '--format', '{{.Names}}'], timeout=8).decode().splitlines()
        for name in names:
            if re.fullmatch(self.prefix + r'[a-f0-9]{32}', name):
                self.remove(name)

    def remove(self, name):
        result = subprocess.run(['docker', 'rm', '--force', name], capture_output=True, timeout=8)
        # A watchdog may have removed it already; verify absence, rather than ignoring errors.
        if result.returncode:
            check = subprocess.run(['docker', 'ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}'], capture_output=True, timeout=8)
            if check.returncode or check.stdout.strip():
                self.healthy = False
                raise RuntimeError('Container cleanup failed; runner disabled')

    def command(self, name, language):
        row = self.runtimes[language]
        compiled = language in COMPILED
        command = ['docker', 'create', '--pull=never', '--name', name, '--label', self.label,
                '--runtime', self.runtime, '--network=none', '--read-only', '--init', '--ipc=none',
                '--user=65534:65534', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
                '--memory=' + str(row['memoryMiB']) + 'm', '--memory-swap=' + str(row['memoryMiB']) + 'm',
                '--cpus=1', '--pids-limit=' + ('128' if compiled else '32'), '--ulimit=nofile=' + ('256:256' if language in {'csharp', 'r', 'kotlin', 'visual-basic.net', 'f-sharp', 'powershell'} else '64:64'), '--ulimit=fsize=' + ('2199023255552:2199023255552' if language == 'powershell' else '67108864:67108864' if language in {'csharp','visual-basic.net','f-sharp'} else '16777216:16777216'),
                '--log-driver=none', '--stop-timeout=1', '--workdir=/work',
                '--tmpfs=/work:rw,' + ('exec' if compiled else 'noexec') + ',nosuid,nodev,size=' + ('128m' if compiled else '16m') + ',mode=1777',
                '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=' + ('128m' if compiled else '8m') + ',mode=1777', '-i',
                ]
        if language in {'erlang', 'elixir'}: command += ['--env=ERL_CRASH_DUMP=/dev/null']
        if compiled or language in SCRIPTED:
            command += ['--env=HOME=/work', '--env=GOCACHE=/work/cache', '--env=GOPATH=/work/go', '--env=GOPROXY=off', '--env=GOSUMDB=off', '--env=GOTOOLCHAIN=local', '--env=CGO_ENABLED=0', '--env=GOMAXPROCS=1', '--env=RUSTUP_HOME=/usr/local/rustup', '--env=CARGO_HOME=/usr/local/cargo', '--entrypoint=/bin/sleep', row['image'], '60']
        else:
            command += ['--entrypoint', row['executable'], row['image'], *(['-I', '-u', '-c', PYTHON_BOOT] if language == 'python' else ['-e', RUBY_BOOT])]
        return command

    def compiled_execute(self, job):
        """Stream source into a leased container; optionally compile, then execute with real stdin."""
        name = self.prefix + job['id']; row = self.runtimes[job['language']]
        if job['language'] in COMPILED:
            _, _, _, compile_seconds, filename, compiler, program = COMPILED[job['language']]
        else:
            _, filename, program = SCRIPTED[job['language']]
            compile_seconds, compiler = 0, None
        started = time.monotonic(); watchdog = None
        buffers = {field: bytearray() for field in ('compilerStdout', 'compilerStderr', 'stdout', 'stderr')}
        timings = {}; phase = 'compiling' if compiler else 'running'; exit_code = None
        def capture(args, seconds, payload=b''):
            process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            def write():
                try: process.stdin.write(payload); process.stdin.close()
                except (OSError, ValueError): pass
            writer = threading.Thread(target=write, daemon=True); writer.start()
            reason = None; deadline = time.monotonic() + seconds
            try:
                with selectors.DefaultSelector() as selector:
                    for field in ('stdout', 'stderr'):
                        stream = getattr(process, field); os.set_blocking(stream.fileno(), False)
                        selector.register(stream, selectors.EVENT_READ, ('compilerStdout' if field == 'stdout' else 'compilerStderr') if phase == 'compiling' else field)
                    while selector.get_map():
                        if job['cancel'].is_set(): reason = 'cancelled'; break
                        if time.monotonic() >= deadline: reason = 'compile_timed_out' if phase == 'compiling' else 'timed_out'; break
                        for selected, _ in selector.select(.05):
                            chunk = os.read(selected.fileobj.fileno(),4096)
                            if not chunk: selector.unregister(selected.fileobj); continue
                            available = MAX_OUTPUT - sum(len(b) for b in buffers.values())
                            buffers[selected.data].extend(chunk[:available])
                            if len(chunk) > available: reason = 'output_limit'; break
                        if reason: break
                if reason:
                    # Killing docker exec alone does not stop the process inside the container.
                    process.kill()
                    process.wait(timeout=3)
                    self.remove(name)
                process.wait(timeout=3)
                return reason, process.returncode
            finally:
                if process.poll() is None: process.kill(); process.wait(timeout=3); self.remove(name)
                for stream in (process.stdin,process.stdout,process.stderr):
                    try: stream.close()
                    except OSError: pass
                writer.join(timeout=1)
        try:
            watchdog = subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--namespace',self.namespace,'--lease','60','--watchdog',name],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            subprocess.run(self.command(name,job['language']),check=True,capture_output=True,timeout=8)
            subprocess.run(['docker','start',name],check=True,capture_output=True,timeout=3)
            if job['cancel'].is_set(): return {'state':'cancelled','stdout':'','stderr':'','exitCode':None}
            # Docker cp rejects a read-only rootfs even when the target is tmpfs.
            # Stream bounded source to a fixed filename as the container's non-root user.
            subprocess.run(['docker','exec','-i',name,'/bin/dd','of=/work/'+filename,'status=none'],input=job['code'].encode('utf-8'),check=True,capture_output=True,timeout=8)
            if job['language'] in PREPARE:
                subprocess.run(['docker','exec',name,*PREPARE[job['language']]],check=True,capture_output=True,timeout=8)
            reason = None
            if compiler:
                job['state'] = 'compiling'
                tick = time.monotonic(); reason, exit_code = capture(['docker','exec',name,*compiler],compile_seconds)
                timings['compileMs'] = round((time.monotonic()-tick)*1000)
                if not reason and exit_code: reason = 'compile_error'
            if not reason:
                phase = 'running'; job['state'] = phase
                payload = job['code'] if job['language'] == 'sql' else job['stdin']
                tick = time.monotonic(); reason, exit_code = capture(['docker','exec','-i',name,*program],RUN_SECONDS.get(job['language'],3),payload.encode('utf-8'))
                timings['runMs'] = round((time.monotonic()-tick)*1000)
                reason = reason or ('completed' if exit_code == 0 else 'failed')
            decoded = {}; remaining = MAX_OUTPUT
            for field, raw in buffers.items():
                encoded = raw.decode('utf-8',errors='replace').encode('utf-8')
                if len(encoded)>remaining: reason='output_limit'
                decoded[field] = encoded[:remaining].decode('utf-8',errors='ignore'); remaining -= len(decoded[field].encode('utf-8'))
            return {'state':reason,'phase':phase,'exitCode':exit_code if reason in ('completed','failed','compile_error') else None,**decoded,**timings,'elapsedMs':round((time.monotonic()-started)*1000),'runtimeVersion':row['version']}
        except (OSError,ValueError,subprocess.SubprocessError,RuntimeError):
            return {'state':'cancelled' if job['cancel'].is_set() else 'infrastructure_error','phase':phase,'stdout':'','stderr':'Compilation/execution infrastructure unavailable; no fallback was used.','exitCode':None}
        finally:
            try: self.remove(name)
            except (OSError,subprocess.SubprocessError,RuntimeError): self.healthy=False
            if watchdog:
                try: watchdog.stdin.write(b'done\n');watchdog.stdin.close();watchdog.wait(timeout=10)
                except (OSError,subprocess.SubprocessError): self.healthy=False

    def execute(self, job):
        if job['language'] in COMPILED or job['language'] in SCRIPTED: return self.compiled_execute(job)
        name = self.prefix + job['id']
        process = watchdog = None
        started = time.monotonic()
        output = {'stdout': bytearray(), 'stderr': bytearray()}
        reason = None; run_ms = None
        try:
            # Start the lease before create, covering API death during Docker setup as well.
            watchdog = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--namespace', self.namespace, '--watchdog', name], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            created = subprocess.run(self.command(name, job['language']), capture_output=True, timeout=8)
            if created.returncode:
                raise RuntimeError('Docker could not create the restricted environment')
            # Independent host process removes the container on API death (stdin EOF), or hard lease expiry.
            if job['cancel'].is_set():
                reason = 'cancelled'
            else:
                run_tick = time.monotonic()
                process = subprocess.Popen(['docker', 'start', '--attach', '--interactive', name], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                payload = json.dumps({'code': job['code'], 'stdin': job['stdin']}).encode()
                def send_input():
                    try:
                        process.stdin.write(payload)
                        process.stdin.close()
                    except (BrokenPipeError, OSError, ValueError):
                        pass
                writer = threading.Thread(target=send_input, daemon=True)
                writer.start()
                with selectors.DefaultSelector() as selector:
                    for field in output:
                        stream = getattr(process, field)
                        os.set_blocking(stream.fileno(), False)
                        selector.register(stream, selectors.EVENT_READ, field)
                    deadline = time.monotonic() + 3
                    while selector.get_map():
                        if job['cancel'].is_set():
                            reason = 'cancelled'; break
                        if time.monotonic() >= deadline:
                            reason = 'timed_out'; break
                        for selected, _ in selector.select(.05):
                            chunk = os.read(selected.fileobj.fileno(), 4096)
                            if not chunk:
                                selector.unregister(selected.fileobj); continue
                            available = MAX_OUTPUT - sum(len(v) for v in output.values())
                            output[selected.data].extend(chunk[:available])
                            if len(chunk) > available:
                                reason = 'output_limit'; break
                        if reason: break
                if not reason:
                    process.wait(timeout=1)
                run_ms = round((time.monotonic() - run_tick) * 1000)
            state = json.loads(subprocess.check_output(['docker', 'inspect', '--format', '{{json .State}}', name], timeout=5))
            reason = reason or ('memory_limit' if state.get('OOMKilled') else 'completed' if state.get('ExitCode') == 0 else 'failed')
            decoded = {};remaining = MAX_OUTPUT
            for field, raw in output.items():
                encoded = raw.decode('utf-8', errors='replace').encode('utf-8')
                if len(encoded) > remaining: reason = 'output_limit'
                decoded[field] = encoded[:remaining].decode('utf-8', errors='ignore')
                remaining -= len(decoded[field].encode('utf-8'))
            return {'state': reason, 'exitCode': state.get('ExitCode') if reason in ('completed', 'failed', 'memory_limit') else None,
                    **decoded, **({'runMs': run_ms} if run_ms is not None else {}),
                    'elapsedMs': round((time.monotonic() - started) * 1000), 'runtimeVersion': self.runtimes[job['language']]['version']}
        except (OSError, ValueError, subprocess.SubprocessError, RuntimeError):
            return {'state': 'cancelled' if job['cancel'].is_set() else 'infrastructure_error', 'stdout': '', 'stderr': 'Execution infrastructure unavailable; no fallback was used.', 'exitCode': None}
        finally:
            try:
                self.remove(name)
            except (OSError, subprocess.SubprocessError, RuntimeError):
                self.healthy = False
            if process:
                if process.poll() is None: process.kill()
                process.wait(timeout=3)
                for stream in (process.stdout, process.stderr): stream.close()
            if watchdog:
                try: watchdog.stdin.write(b'done\n');watchdog.stdin.close()
                except (BrokenPipeError, OSError): pass
                try: watchdog.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    self.healthy = False


class Manager:
    def __init__(self, runner, metrics=None):
        self.metrics = metrics or Metrics()
        self.started = time.monotonic()
        self.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.runner, self.jobs = runner, {}
        self.lock = threading.Condition()
        self.pending = collections.deque()
        self.requests = collections.deque()
        self.stopping = False
        self.worker = threading.Thread(target=self.work, daemon=True)
        self.worker.start()

    def submit(self, owner, data):
        data = validate_submission(data, self.runner.runtimes)
        with self.lock:
            now = time.monotonic()
            self.jobs = {k: v for k, v in self.jobs.items() if v['state'] not in FINAL or now - v['updated'] < 300}
            while self.requests and now - self.requests[0][0] > 60: self.requests.popleft()
            if self.stopping or not self.runner.healthy: raise RuntimeError('Runner unavailable')
            if len(self.pending) >= 10 or len(self.jobs) >= 100: raise OverflowError('Queue full')
            if len(self.requests) >= 30 or sum(o == owner for _, o in self.requests) >= 10: raise OverflowError('Request quota exceeded')
            self.requests.append((now, owner))
            job = dict(data, id=uuid.uuid4().hex, owner=owner, state='queued', updated=now, cancel=threading.Event())
            self.jobs[job['id']] = job; self.pending.append(job); self.lock.notify_all()
            return self.public(job)

    def public(self, job):
        return {k: job[k] for k in ('id', 'language', 'state', 'phase', 'stdout', 'stderr', 'exitCode', 'elapsedMs', 'queueMs', 'compileMs', 'runMs', 'compilerStdout', 'compilerStderr', 'runtimeVersion') if k in job}

    def get(self, ident, owner, cancel=False):
        with self.lock:
            job = self.jobs.get(ident)
            if not job or job['owner'] != owner or job['state'] in FINAL and time.monotonic() - job['updated'] >= 300: return None
            if cancel and job['state'] not in FINAL:
                job['cancel'].set()
                if job['state'] == 'queued':
                    job['queueMs'] = round((time.monotonic() - job['updated']) * 1000)
                    self.pending.remove(job);job['state'] = 'cancelled';self.metrics.record(job);job.pop('code', None);job.pop('stdin', None)
                job['updated'] = time.monotonic()
            return self.public(job)

    def work(self):
        while True:
            with self.lock:
                self.lock.wait_for(lambda: self.pending or self.stopping)
                if self.stopping: return
                job = self.pending.popleft()
                job['queueMs'] = round((time.monotonic() - job['updated']) * 1000)
                if not self.runner.healthy:
                    job.update(state='infrastructure_error', stderr='Runner disabled', updated=time.monotonic())
                    self.metrics.record(job);job.pop('code', None);job.pop('stdin', None);continue
                if time.monotonic() - job['updated'] > 30:
                    job.update(state='cancelled', stderr='Queue wait exceeded 30 seconds')
                    self.metrics.record(job);job.pop('code', None);job.pop('stdin', None);continue
                job['state'] = 'running'
            try: result = self.runner.execute(job)
            except Exception: result = {'state': 'infrastructure_error', 'stderr': 'Runner failed'};self.runner.healthy = False
            with self.lock:
                job.update(result, updated=time.monotonic());self.metrics.record(job);job.pop('code', None);job.pop('stdin', None)

    def status(self):
        with self.lock:
            return {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'available':self.runner.healthy and not self.stopping,'processStartedAt':self.started_at,'uptimeSeconds':round(time.monotonic()-self.started),'queue':len(self.pending),'active':sum(j['state'] in ('compiling','running') for j in self.jobs.values()),'metrics':self.metrics.snapshot()}

    def stop(self):
        with self.lock:
            self.stopping = True
            for job in self.jobs.values():
                job['cancel'].set()
                if job['state']=='queued':
                    job.update(state='cancelled',queueMs=round((time.monotonic()-job['updated'])*1000))
                    self.metrics.record(job);job.pop('code',None);job.pop('stdin',None)
            self.pending.clear()
            self.lock.notify_all()
        self.worker.join(timeout=60)


def handler(manager, token, origin, museum_provider=None):
    museum_provider = museum_provider or MuseumProvider(None)
    mcp_token = readonly_token(token)
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup();self.connection.settimeout(5)
        def log_message(self, *args): pass
        def respond(self, status, data, headers=None):
            payload = b'' if data is None else json.dumps(data, ensure_ascii=True).encode()
            self.send_response(status);self.send_header('Content-Type', 'application/json');self.send_header('Cache-Control', 'no-store');self.send_header('Content-Length', str(len(payload)))
            for key,value in (headers or {}).items(): self.send_header(key,value)
            self.end_headers()
            try: self.wfile.write(payload)
            except (BrokenPipeError, OSError): pass
        def owner(self):
            if self.headers.get('Origin') not in (None, origin): return None
            auth = self.headers.get('Authorization', '')
            session = self.headers.get('X-Execution-Session', '')
            if not auth.isascii() or not hmac.compare_digest(auth, 'Bearer ' + token) or not re.fullmatch('[a-f0-9]{32}', session): return None
            return hashlib.sha256((token + ':' + session).encode()).hexdigest()
        def do_GET(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            if self.path == '/api/executor-status':
                if not self.owner(): return self.respond(401, {'error':'Private execution token/session required'})
                return self.respond(200, manager.status())
            if self.path == '/api/runtimes':
                return self.respond(200, {'private': True, 'available': manager.runner.healthy,
                    'runtimes': [{**{k: r[k] for k in ('id', 'version', 'memoryMiB', 'source')}, 'compileSeconds': COMPILED[r['id']][3] if r['id'] in COMPILED else 0, 'runSeconds':RUN_SECONDS.get(r['id'],3)} for r in manager.runner.runtimes.values()],
                    'limits': {'seconds': max((RUN_SECONDS.get(k,3) for k in manager.runner.runtimes),default=3), 'outputBytes': MAX_OUTPUT, 'concurrency': 1, 'network': False}})
            return self.job(False)
        def do_DELETE(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            return self.job(True)
        def job(self, cancel):
            owner = self.owner()
            if not owner: return self.respond(401, {'error': 'Private execution token/session required'})
            match = re.fullmatch('/api/executions/([a-f0-9]{32})', self.path)
            job = manager.get(match[1], owner, cancel) if match else None
            return self.respond(200 if job else 404, job or {'error': 'Job not found'})
        def do_POST(self):
            if self.path == '/mcp': return handle_mcp(self,museum_provider,mcp_token,origin)
            if self.path != '/api/executions': return self.respond(404, {'error': 'Not found'})
            owner = self.owner()
            if not owner: return self.respond(401, {'error': 'Private execution token/session required'})
            if self.headers.get('Transfer-Encoding') or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'Expected length-delimited JSON'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BODY: return self.respond(413, {'error': 'Request too large'})
                body = self.rfile.read(size)
                if len(body) != size: raise ValueError('Incomplete body')
                return self.respond(202, manager.submit(owner, json.loads(body)))
            except (ValueError, TypeError, UnicodeError): return self.respond(400, {'error': 'Invalid code/language/input'})
            except OverflowError: return self.respond(429, {'error': 'Execution quota or queue limit reached'})
            except RuntimeError: return self.respond(503, {'error': 'Runner unavailable'})
    return Handler


class BoundedServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, *args):
        self.slots = threading.BoundedSemaphore(16);super().__init__(*args)
    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close();return
        try: super().process_request(request, client_address)
        except Exception: self.slots.release();raise
    def process_request_thread(self, *args):
        try: super().process_request_thread(*args)
        finally: self.slots.release()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--images', default=str(Path(__file__).with_name('runtime-images.json')))
    parser.add_argument('--languages', nargs='+', help='Only verify and serve these configured runtime IDs on this node')
    parser.add_argument('--nodes', help='Complete static execution-node configuration')
    parser.add_argument('--node', help='Serve the languages assigned to this node ID')
    parser.add_argument('--metrics-db')
    parser.add_argument('--museum-data')
    parser.add_argument('--port', type=int, default=4181)
    parser.add_argument('--origin', default='http://127.0.0.1:4173')
    parser.add_argument('--runtime', choices=['runc', 'runsc'], default='runc')
    parser.add_argument('--watchdog')
    parser.add_argument('--namespace', default='private-v1')
    parser.add_argument('--lease', type=int, choices=[12,60], default=12)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,31}',args.namespace): parser.error('Invalid namespace')
    prefix = PREFIX if args.namespace == 'private-v1' else 'cm-' + args.namespace + '-'
    if args.watchdog:
        if not re.fullmatch(prefix + r'[a-f0-9]{32}', args.watchdog): parser.error('Invalid container name')
        with selectors.DefaultSelector() as selector:
            selector.register(sys.stdin, selectors.EVENT_READ)
            event = selector.select(args.lease)
            clean = bool(event) and sys.stdin.buffer.readline() == b'done\n'
        # On parent death, retry through the setup budget so a late Docker create cannot leak.
        end = time.monotonic() + (0 if clean else 8)
        while True:
            subprocess.run(['docker', 'rm', '--force', args.watchdog], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=8)
            if time.monotonic() >= end: break
            time.sleep(.3)
        return
    token = os.environ.get('EXECUTOR_TOKEN', '')
    if len(token) < 32 or not token.isascii(): parser.error('Set a private ASCII EXECUTOR_TOKEN of at least 32 characters')
    import fcntl
    lock_path = '/tmp/code-museum-executor.lock' if args.namespace == 'private-v1' else '/tmp/code-museum-executor-' + args.namespace + '.lock'
    lock = os.fdopen(os.open(os.environ.get('EXECUTOR_LOCK', lock_path), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600), 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    runtimes = load_runtimes(args.images)
    if bool(args.nodes) != bool(args.node) or args.node and args.languages:
        parser.error('Use --nodes and --node together, without --languages')
    languages = args.languages
    if args.node:
        from execution_nodes import load_nodes
        nodes = load_nodes(args.nodes, runtimes)
        if args.node not in nodes: parser.error('Unknown execution node')
        languages = nodes[args.node]['languages']
    runner = DockerRunner(select_runtimes(runtimes, languages), args.runtime,args.namespace);runner.verify()
    manager = Manager(runner,Metrics(args.metrics_db))
    server = BoundedServer(('127.0.0.1', args.port), handler(manager, token, args.origin,MuseumProvider(args.museum_data)))
    def shutdown(*_): threading.Thread(target=server.shutdown, daemon=True).start()
    signal.signal(signal.SIGTERM, shutdown);signal.signal(signal.SIGINT, shutdown)
    print('Private executor listening on 127.0.0.1:' + str(args.port), flush=True)
    try: server.serve_forever(poll_interval=.1)
    finally: manager.stop();server.server_close();runner.cleanup_stale();lock.close()


if __name__ == '__main__': main()
