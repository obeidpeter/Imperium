import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {EventEmitter} from 'node:events';
import {summarizeResources,summarizeServerRequests,journeyDurations} from './interface-metrics.js';
import {createInterfaceServer} from './interface-server.mjs';

test('Entry metrics distinguish body/transfer sizes and preserve zero-transfer uncertainty',()=>{
  const data=summarizeResources([{entryType:'navigation',name:'https://game.test/',transferSize:600,encodedBodySize:300,decodedBodySize:1000,startTime:0,responseEnd:60,duration:60},{entryType:'resource',name:'https://game.test/art.webp',initiatorType:'img',transferSize:0,encodedBodySize:1200,decodedBodySize:1200,startTime:70,responseEnd:80,duration:10,workerStart:72}], 'https://game.test');
  assert.equal(data.transferBytes,600);assert.equal(data.encodedBodyBytes,1500);assert.equal(data.decodedBodyBytes,2200);assert.equal(data.zeroTransferEntries,1);assert.equal(data.resources[1].workerStartMs,72);
});
test('Server metrics include later worker assets and failed requests while excluding measurement overhead',()=>{
  const rows=[{path:'/index.html',status:200,encodedBodyBytes:100,uncompressedBodyBytes:200,finishedMs:2},{path:'/assets/chapter-1.webp',status:200,encodedBodyBytes:900,uncompressedBodyBytes:950,finishedMs:10},{path:'/sw.js',status:404,encodedBodyBytes:15,uncompressedBodyBytes:9,finishedMs:4},{path:'/tests/interface-load.js',status:200,encodedBodyBytes:500,uncompressedBodyBytes:700,finishedMs:1}];
  const result=summarizeServerRequests(rows);assert.equal(result.requests,3);assert.equal(result.encodedBodyBytes,1015);assert.equal(result.lastResponseMs,10);assert.deepEqual(result.failed,[{path:'/sw.js',status:404}]);
});
test('Journey metrics separate human delay from click-to-ready and never invent a missing endpoint',()=>{
  const values=[{name:'landing-ready',atMs:100},{name:'begin-click',atMs:10000},{name:'chapter-visible',atMs:10100},{name:'enter-click',atMs:30000},{name:'board-visible',atMs:30100},{name:'board-artwork-settled',atMs:30500}];
  assert.deepEqual(journeyDurations(values),{landingReadyMs:100,beginToChapterMs:100,enterToBoardMs:100,enterToArtworkSettledMs:500,observedLandingToBoardMs:30500,humanDwellIncluded:true});
  assert.equal(journeyDurations(values.slice(0,3)).enterToArtworkSettledMs,null);
});
test('Development server handler emits exact gzip bodies, resets only its ledger, and reads the unchanged application',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'sacramentum-interface-'));
  const source='<h1>Actual application file</h1>'.repeat(30);await writeFile(join(directory,'index.html'),source);
  const server=createInterfaceServer({root:directory,label:'fixture'}),handler=server.listeners('request')[0];
  const request=(url,method='GET',headers={})=>new Promise((resolve,reject)=>{
    const response=new EventEmitter();let status,outputHeaders;
    response.writeHead=(code,values)=>{status=code;outputHeaders=values||{};};
    response.end=body=>{const bytes=Buffer.from(body||'');response.emit('finish');resolve({status,headers:outputHeaders,bytes,text:()=>outputHeaders['Content-Encoding']==='gzip'?gunzipSync(bytes).toString():bytes.toString()});};
    Promise.resolve(handler({url,method,headers:{host:'127.0.0.1:4195',...headers}},response)).catch(reject);
  });
  try{
    assert.equal((await request('/__interface/start','POST')).status,200);
    const response=await request('/','GET',{'accept-encoding':'gzip'});assert.equal(response.headers['Content-Encoding'],'gzip');assert.equal(response.headers['Cache-Control'],'no-store');assert.equal(response.text(),source);
    let report=JSON.parse((await request('/__interface/metrics')).text());assert.equal(report.label,'fixture');assert.equal(report.requests.length,1);assert.equal(report.requests[0].encodedBodyBytes,gzipSync(Buffer.from(source)).length);assert.equal(report.requests[0].uncompressedBodyBytes,Buffer.byteLength(source));
    assert.equal((await request('/__interface/start','POST',{origin:'https://unrelated.test'})).status,403);
    assert.equal((await request('/tests/interface-load.html')).status,200,'The lab is served separately from the selected application root');
    await request('/__interface/start','POST');report=JSON.parse((await request('/__interface/metrics')).text());assert.equal(report.requests.length,0);
  }finally{assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));await rm(directory,{recursive:true,force:true});}
});
