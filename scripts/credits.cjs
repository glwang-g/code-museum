const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function generateCredits(root){
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const credits=read('data/credits.json'),ids=new Set();
  for(const group of credits.groups){
    for(const entry of group.entries){
      if(ids.has(entry.id)||!/^[a-z][a-z-]+$/.test(entry.id))throw new Error('Invalid credit identity');
      ids.add(entry.id);
      if(entry.manifest){
        const manifest=read(entry.manifest);
        entry.version=manifest.version;entry.license=manifest.license;
        entry.versionLabel=manifest.luaVersion?`Wasmoon ${manifest.version} · Lua ${manifest.luaVersion}`:`${entry.name} ${manifest.version}`;
        entry.source=manifest.source;entry.files=manifest.files;
        entry.commit=manifest.sourceCommit||manifest.wasmoonCommit;
      }
      if(entry.snapshot){
        const snapshot=read(entry.snapshot);
        entry.retrieved=snapshot.retrieved;entry.source=snapshot.source;
        entry.sha256=snapshot.sha256;entry.commit=snapshot.commit;entry.license=snapshot.license;
        entry.versionLabel=`固定快照 · ${snapshot.retrieved.slice(0,10)}`;
      }
      if(entry.ranking){
        const source=read(entry.ranking).source;
        entry.versionLabel=`榜单 · ${source.period}`;entry.retrieved=source.retrievedAt;
        entry.source=source.url;entry.sha256=source.htmlSha256;
      }
    }
  }
  const linguist=read('data/raw/linguist.snapshot.json');
  const linguistLicense=fs.readFileSync(path.join(root,'data/raw/linguist-LICENSE'));
  if(crypto.createHash('sha256').update(linguistLicense).digest('hex')!==linguist.licenseSha256)throw new Error('Linguist license checksum mismatch');
  return {credits,linguistLicense};
}
module.exports={generateCredits};
