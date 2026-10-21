import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
// HOST=0.0.0.0 lets a phone on the same trusted network open the page (for the arena's performance check); the default stays local.
const root=resolve(process.argv[2]||'.');const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.md':'text/plain; charset=utf-8'};
export async function serveRequest(req,res,rootDirectory=root){const root=resolve(rootDirectory);try{const url=new URL(req.url,'http://localhost');let requested=decodeURIComponent(url.pathname);if(requested.endsWith('/'))requested+='index.html';const path=resolve(root,'.'+requested);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return;}const info=await stat(path);if(!info.isFile())throw new Error();const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});res.end(body);}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=http.createServer((req,res)=>serveRequest(req,res));
  server.listen(port,host,()=>console.log(`Imperium static preview: http://${host==='0.0.0.0'?'<this computer\'s address>':host}:${server.address().port}\nServing ${root}`));
}
