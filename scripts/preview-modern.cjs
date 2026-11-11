// Independent local alternative A; the retained original is built from its tracked snapshot.
const http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {createRequestHandler}=require('./serve.cjs');
function createModernHandler(root=path.resolve(__dirname,'..'),options={}){
 const modern=createRequestHandler(path.join(root,'experiments/modern-preview'),options);
 const classic=createRequestHandler(path.join(root,'dist/classic'),options);
 return(req,res)=>{
  if(req.url==='/classic'){res.writeHead(302,{Location:'/classic/'}).end();return}
  if(req.url.startsWith('/classic/')){req.url=req.url.slice('/classic'.length);return classic(req,res)}
  return modern(req,res);
 };
}
module.exports={createModernHandler};
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 if(!fs.existsSync(path.join(root,'dist/data/catalogue.json')))throw new Error('Run npm run build before the modern preview.');
 const server=http.createServer(createModernHandler(root,{executor:process.env.EXECUTOR_UPSTREAM,explanations:process.env.MUSEUM_EXPLANATION_UPSTREAM}));
 server.on('error',error=>{console.error(error.message);process.exitCode=1});
 server.listen(Number(process.env.MODERN_PREVIEW_PORT||4188),'127.0.0.1',()=>console.log('Code Museum modern preview: http://127.0.0.1:'+server.address().port+'\nOriginal: http://127.0.0.1:'+server.address().port+'/classic/'));
}
