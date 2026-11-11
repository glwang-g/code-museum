// Local alternative B, sharing validated interactions without replacing alternative A.
const http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {createRequestHandler}=require('./serve.cjs');
const {createModernHandler}=require('./preview-modern.cjs');
function createGalleryHandler(root=path.resolve(__dirname,'..'),options={}){
 const gallery=createRequestHandler(path.join(root,'experiments/gallery-preview'),options);
 const shared=createRequestHandler(path.join(root,'experiments/modern-preview'),options);
 const original=createModernHandler(root,options);
 return(req,res)=>{
  if(req.url==='/classic'||req.url.startsWith('/classic/'))return original(req,res);
  if(req.url.startsWith('/shared/')){req.url=req.url.slice('/shared'.length);return shared(req,res)}
  return gallery(req,res);
 };
}
module.exports={createGalleryHandler};
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 if(!fs.existsSync(path.join(root,'dist/data/catalogue.json')))throw new Error('Run npm run build before the gallery preview.');
 const server=http.createServer(createGalleryHandler(root,{explanations:process.env.MUSEUM_EXPLANATION_UPSTREAM}));
 server.on('error',error=>{console.error(error.message);process.exitCode=1});
 server.listen(Number(process.env.GALLERY_PREVIEW_PORT||4189),'127.0.0.1',()=>console.log('Code Museum gallery preview: http://127.0.0.1:'+server.address().port+'\nAlternative A: http://127.0.0.1:4188/\nOriginal: http://127.0.0.1:'+server.address().port+'/classic/'));
}
