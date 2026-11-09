const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validateAlgol60Runtime}=require('../scripts/algol60-runtime.cjs');
const {validateCommonLispRuntime}=require('../scripts/common-lisp-runtime.cjs');
const {validateFixedRuntime}=require('../scripts/fixed-runtime.cjs');
const {executionCapabilities}=require('../scripts/execution-capabilities.cjs');
const root=path.resolve(__dirname,'..');
test('planned runtime source assets and pinned image identities reject tampering',()=>{
 for(const [name,validate] of [['algol60',validateAlgol60Runtime],['common-lisp',validateCommonLispRuntime],['prolog',root=>validateFixedRuntime(root,'prolog','prolog')],['forth',root=>validateFixedRuntime(root,'forth','forth')],['racket',root=>validateFixedRuntime(root,'racket','racket')],['smalltalk',root=>validateFixedRuntime(root,'smalltalk','smalltalk')],['cobol',root=>validateFixedRuntime(root,'cobol','cobol')],['ada',root=>validateFixedRuntime(root,'ada','ada')],['clojure',root=>validateFixedRuntime(root,'clojure','clojure')],['ocaml',root=>validateFixedRuntime(root,'ocaml','ocaml')],['haskell',root=>validateFixedRuntime(root,'haskell','haskell')],['kotlin',root=>validateFixedRuntime(root,'kotlin','kotlin')],['groovy',root=>validateFixedRuntime(root,'groovy','groovy')],['erlang',root=>validateFixedRuntime(root,'erlang','erlang')],['elixir',root=>validateFixedRuntime(root,'elixir','elixir')],['tcl',root=>validateFixedRuntime(root,'tcl','tcl')],['standard-ml',root=>validateFixedRuntime(root,'standard-ml','standard-ml')],['scala',root=>validateFixedRuntime(root,'scala','scala')],['d',root=>validateFixedRuntime(root,'d','d')],['nim',root=>validateFixedRuntime(root,'nim','nim')],['zig',root=>validateFixedRuntime(root,'zig','zig')],['swift',root=>validateFixedRuntime(root,'swift','swift')],['dart',root=>validateFixedRuntime(root,'dart','dart')],['julia',root=>validateFixedRuntime(root,'julia','julia')],['octave',root=>validateFixedRuntime(root,'octave','octave')],['powershell',root=>validateFixedRuntime(root,'powershell','powershell')],['korn-shell',root=>validateFixedRuntime(root,'korn-shell','korn-shell')],['tcsh',root=>validateFixedRuntime(root,'tcsh','tcsh')],['wasm',root=>validateFixedRuntime(root,'wasm','wasm')],['x86-assembly',root=>validateFixedRuntime(root,'x86-assembly','x86-assembly')],['verilog',root=>validateFixedRuntime(root,'verilog','verilog')],['vhdl',root=>validateFixedRuntime(root,'vhdl','vhdl')],['postscript',root=>validateFixedRuntime(root,'postscript','postscript')],['bcpl',root=>validateFixedRuntime(root,'bcpl','bcpl',{mode:'public-metadata'})],['oberon',root=>validateFixedRuntime(root,'oberon','oberon')]]){
  const manifest=validate(root);assert.ok(manifest.files.some(f=>f.file.startsWith('assets/')));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-planned-'));
  try{
   fs.cpSync(path.join(root,'server/runtimes',name),path.join(dir,'server/runtimes',name),{recursive:true});
   fs.copyFileSync(path.join(root,'server/runtime-images.json'),path.join(dir,'server/runtime-images.json'));
   if(name==='bcpl'){fs.mkdirSync(path.join(dir,'data'));fs.copyFileSync(path.join(root,'data/runtime-input-policy.json'),path.join(dir,'data/runtime-input-policy.json'));}
   const asset=path.join(dir,'server/runtimes',name,manifest.files.find(f=>f.file.startsWith('assets/')&&!manifest.publication?.privateFiles.includes(f.file)).file);
   fs.appendFileSync(asset,'tamper');assert.throws(()=>validate(dir),/checksum mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 }
 const sandbox={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'src/lab-examples.js'),'utf8'),sandbox);
 const exampleIds=sandbox.window.MUSEUM_LAB_EXAMPLES.map(row=>row.id);assert.equal(new Set(exampleIds).size,exampleIds.length,'language examples must not silently overwrite one another');
 const caps=executionCapabilities(root);
 for(const id of ['algol-60','common-lisp','prolog','forth','racket','smalltalk','cobol','ada','clojure','ocaml','haskell','kotlin','groovy','erlang','elixir','tcl','standard-ml','scala','visual-basic.net','f-sharp','d','nim','zig','swift','dart','julia','octave','powershell','korn-shell','tcsh','wasm','x86-assembly','verilog','vhdl','postscript','bcpl','oberon']){
  const row=caps.languages.find(r=>r.id===id);assert.equal(row.local,null);assert.equal(row.remote.requiresToken,false);
  assert.equal(row.remote.compileSeconds,['kotlin','scala','visual-basic.net','f-sharp','zig','swift'].includes(id)?30:['haskell','nim'].includes(id)?20:['algol-60','cobol','ada','ocaml','erlang','d','x86-assembly','verilog','vhdl','bcpl','oberon'].includes(id)?10:id==='dart'?15:0);
 }
});

test('a rehashed Dockerfile cannot silently replace the fixed base with a mutable tag',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'museum-fixed-base-'));
 try{
  const base=path.join(dir,'server/runtimes/clojure');
  fs.cpSync(path.join(root,'server/runtimes/clojure'),base,{recursive:true});
  fs.copyFileSync(path.join(root,'server/runtime-images.json'),path.join(dir,'server/runtime-images.json'));
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
  const file=path.join(base,'Dockerfile');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(manifest.baseImage,'eclipse-temurin:latest'));
  const bytes=fs.readFileSync(file),row=manifest.files.find(r=>r.file==='Dockerfile');
  row.bytes=bytes.length;row.sha256=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(manifest));
  assert.throws(()=>validateFixedRuntime(dir,'clojure','clojure'),/declared pinned base/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
