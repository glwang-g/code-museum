const fs=require('node:fs'),path=require('node:path');
function executionNodes(root,runtimes){
 const file=path.join(root,'server/execution-nodes.json');
 if(fs.lstatSync(file).isSymbolicLink())throw new Error('Execution nodes must be a regular source file');
 const config=JSON.parse(fs.readFileSync(file,'utf8'));
 const keys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...names].sort().join(',');
 if(!keys(config,['schemaVersion','nodes'])||config.schemaVersion!==1||!Array.isArray(config.nodes)||config.nodes.length<1||config.nodes.length>8)throw new Error('Invalid execution nodes');
 const ids=new Set(),urls=new Set(),tokens=new Set(),placed=new Set(),configured=new Set(runtimes.map(r=>r.id));
 for(const node of config.nodes){
  if(!keys(node,['id','url','tokenEnv','languages'])||typeof node.id!=='string'||!/^[a-z][a-z0-9-]{0,23}$/.test(node.id)||ids.has(node.id))throw new Error('Invalid execution node identity');
  const url=typeof node.url==='string'&&node.url.match(/^http:\/\/(127\.0\.0\.1|\[::1\]):([1-9]\d{0,4})$/);
  if(!url||Number(url[2])>65535||urls.has(node.url))throw new Error('Expected unique loopback execution URL');
  if(typeof node.tokenEnv!=='string'||!/^EXECUTOR_NODE_[A-Z0-9_]+_TOKEN$/.test(node.tokenEnv)||tokens.has(node.tokenEnv))throw new Error('Invalid node token environment name');
  if(!Array.isArray(node.languages)||!node.languages.length)throw new Error('Node must have configured languages');
  for(const language of node.languages){if(typeof language!=='string'||!configured.has(language)||placed.has(language))throw new Error('Execution node languages must form a unique configured partition');placed.add(language)}
  ids.add(node.id);urls.add(node.url);tokens.add(node.tokenEnv);
 }
 if(placed.size!==configured.size)throw new Error('Execution node partition must cover every runtime');
 return config;
}
module.exports={executionNodes};
