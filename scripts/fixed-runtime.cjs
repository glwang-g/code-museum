const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// This exception is tied to one already-built BCPL manifest, never a generic
// permission to omit a runtime's inputs or change its deployed image evidence.
const BCPL_MANIFEST='dae20967456a7a8753be8c99290776986581d63343d88b7628c1b67b29da9776';
const BCPL_PRIVATE_FILES=['assets/bcpl-20261109.tar.gz.part00','assets/bcpl-20261109.tar.gz.part01','assets/bcpl-20261109.tar.gz.part02','assets/cintcode-noninteractive.patch','licenses/upstream-README.txt','metadata/upstream-sysboot.b'];
function publicationPolicy(root,directory,id,manifestSha256){
 if(id!=='bcpl')return null;
 const file=path.join(root,'data/runtime-input-policy.json');
 if(fs.lstatSync(file).isSymbolicLink())throw new Error('Runtime publication policy must not be a symlink');
 const policy=JSON.parse(fs.readFileSync(file)),row=policy.runtimes?.bcpl;
 if(directory!=='bcpl'||policy.schemaVersion!==1||JSON.stringify(Object.keys(policy.runtimes||{}))!==JSON.stringify(['bcpl'])||!row||row.manifestSha256!==BCPL_MANIFEST||manifestSha256!==BCPL_MANIFEST||row.publicRepoToolchainComplete!==false||!Array.isArray(row.privateFiles)||JSON.stringify([...row.privateFiles].sort())!==JSON.stringify([...BCPL_PRIVATE_FILES].sort())||row.source!=='https://www.cl.cam.ac.uk/~mr10/BCPL.html'||typeof row.note!=='string'||!row.note.trim())throw new Error('Invalid restricted BCPL input publication policy');
 return row;
}
function validateFixedRuntime(root,directory,id,{mode='full'}={}){
 if(!['full','public-metadata'].includes(mode))throw new Error('Invalid fixed runtime validation mode');
 if(!/^[a-z][a-z0-9-]*$/.test(directory)||!/^[a-z][a-z0-9.-]*$/.test(id))throw new Error('Invalid fixed runtime directory or ID');
 const base=path.join(root,'server/runtimes',directory),bytes=fs.readFileSync(path.join(base,'manifest.json')),manifest=JSON.parse(bytes);
 if(manifest.schemaVersion!==1||manifest.platform!=='linux/amd64'||!/^(?:gcc|eclipse-temurin)@sha256:[a-f0-9]{64}$/.test(manifest.baseImage)||manifest.runtime?.id!==id||!Array.isArray(manifest.files))throw new Error('Invalid fixed runtime manifest: '+id);
 const publication=mode==='public-metadata'?publicationPolicy(root,directory,id,hash(bytes)):null,privateFiles=new Set(publication?.privateFiles||[]);
 const inventory=[];
 function walk(dir){for(const file of fs.readdirSync(dir)){const p=path.join(dir,file),stat=fs.lstatSync(p);if(stat.isSymbolicLink())throw new Error('Runtime input must not be a symlink');if(stat.isDirectory())walk(p);else if(stat.isFile())inventory.push(path.relative(base,p).split(path.sep).join('/'));else throw new Error('Invalid runtime input')}}
 walk(base);
 const expected=manifest.files.map(r=>r.file);
 const actual=inventory.filter(f=>f!=='manifest.json');
 if(new Set(expected).size!==expected.length||actual.some(file=>!expected.includes(file))||expected.some(file=>!actual.includes(file)&&!privateFiles.has(file)))throw new Error('Fixed runtime inventory mismatch: '+id+(id==='bcpl'&&mode==='full'?'; full image rebuilding requires the exact private BCPL inputs':''));
 for(const row of manifest.files){
  if(!/^(Dockerfile|NOTICE\.md|acquisition\.json|(?:assets|licenses|metadata)\/[A-Za-z0-9_.+~-]+)$/.test(row.file)||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<0)throw new Error('Invalid fixed runtime asset');
  if(!actual.includes(row.file)&&privateFiles.has(row.file))continue;
  const data=fs.readFileSync(path.join(base,row.file));if(data.length!==row.bytes||hash(data)!==row.sha256)throw new Error('Fixed runtime checksum mismatch: '+row.file);
 }
 const dockerfile=fs.readFileSync(path.join(base,'Dockerfile'),'utf8');
 const from=[...dockerfile.matchAll(/^\s*FROM\s+([^\r\n]+)$/gmi)].map(m=>m[1].trim());
 if(from.length!==1||from[0]!==manifest.baseImage||/^\s*ADD\s+(?:--\S+\s+)*https?:\/\//mi.test(dockerfile))throw new Error('Fixed runtime requires the declared pinned base and local inputs');
 const rows=JSON.parse(fs.readFileSync(path.join(root,'server/runtime-images.json'))).runtimes.filter(r=>r.id===id);
 if(rows.length!==1||rows[0].image!==rows[0].imageId||!/^sha256:[a-f0-9]{64}$/.test(rows[0].imageId)||rows[0].buildManifestSha256!==hash(bytes)||rows[0].memoryMiB!==manifest.runtime.memoryMiB||rows[0].executable!==manifest.runtime.executable)throw new Error('Fixed runtime image/build evidence mismatch: '+id);
 return {directory,...manifest,...(publication?{publication}:{})};
}
module.exports={validateFixedRuntime};
