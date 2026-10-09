const fs=require('node:fs'),path=require('node:path');
function executionCapabilities(root){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'),'utf8'));
  const budgets={c:10,cpp:10,rust:15,go:30,java:15};
  const local=[{id:'javascript',engine:'Browser native Worker',runSeconds:2,requiresDownload:false},{id:'python',engine:'Pyodide 314.0.7',runSeconds:3,requiresDownload:true},{id:'lua',engine:'Wasmoon 1.16.0 / Lua 5.4.5 Wasm',runSeconds:2,requiresDownload:true},{id:'scheme',engine:'BiwaScheme 0.8.3 JavaScript interpreter (subset, not Wasm)',runSeconds:2,requiresDownload:true}];
  const ids=[...new Set([...local.map(r=>r.id),...manifest.runtimes.map(r=>r.id)])].sort();
  return {schemaVersion:1,availability:'configured, not live-checked',languages:ids.map(id=>({id,defaultMode:manifest.runtimes.some(r=>r.id===id)?'remote':'local',local:local.find(r=>r.id===id)||null,remote:manifest.runtimes.find(r=>r.id===id)?{...manifest.runtimes.find(r=>r.id===id),requiresToken:true,compileSeconds:budgets[id]||0,runSeconds:3}:null})),remoteLimits:{sourceBytes:65536,stdinBytes:16384,outputBytes:32768,concurrency:1,network:false},scope:'Private remote execution only; no automatic runtime download or fallback. Configured support does not prove service connectivity, token validity or whole-language conformance.'};
}
module.exports={executionCapabilities};
