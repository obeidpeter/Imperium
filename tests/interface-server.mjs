// Test-only HTTP recorder. Not imported or copied by the production build.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
const harnessRoot=resolve(fileURLToPath(new URL('.',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
export function createInterfaceServer({root,label='current',now=()=>performance.now()}={}){
  root=resolve(root||'.');let started=now(),requests=[],run=0;
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__interface/start'){
      if(req.method!=='POST'||(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)){res.writeHead(403);res.end();return;}
      requests=[];started=now();run++;
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({run,label,policy:'gzip responses, no-store; fresh dedicated origin required'}));return;
    }
    if(url.pathname==='/__interface/metrics'){
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({run,label,elapsedMs:now()-started,requests}));return;
    }
    const began=now()-started;let body,status=200,path=url.pathname;
    try{
      path=decodeURIComponent(path);if(path.endsWith('/'))path+='index.html';
      const harness=/^\/tests\/interface-(?:load|lab|metrics)(?:\.html|\.js)$/.test(path)||path==='/tests/fixtures/graphics-scenes.json';
      const directory=harness?harnessRoot:root,relative=harness?path.slice('/tests/'.length):'.'+path;
      const file=resolve(directory,relative);
      if(file!==directory&&!file.startsWith(directory+sep))throw new Error('Outside test root');
      if(!(await stat(file)).isFile())throw new Error('Not a file');body=await readFile(file);
    }catch{status=404;body=Buffer.from('Not found');}
    const gzip=Boolean(req.headers['accept-encoding']?.includes('gzip')),encoded=gzip?gzipSync(body):body;
    const headers={'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':encoded.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if(gzip)headers['Content-Encoding']='gzip';
    res.once('finish',()=>requests.push({path,status,startedMs:began,finishedMs:now()-started,encodedBodyBytes:encoded.length,uncompressedBodyBytes:body.length,gzip}));
    res.writeHead(status,headers);res.end(encoded);
  });
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=resolve(process.argv[2]||'.'),port=Number(process.argv[3]||4195),label=process.argv[4]||'current';
  createInterfaceServer({root,label}).listen(port,'127.0.0.1',()=>console.log(`Interface test server (${label}): http://127.0.0.1:${port}/tests/interface-load.html\nServing ${root}; no production code instrumentation or save deletion.`));
}
