import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetLoader,constrainedConnection,prefetchFiles} from '../src/ui/asset-loader.js';
import {chapterAssets,heroPortrait,speakerPortrait} from '../src/ui/art.js';
import {CHAPTERS} from '../src/data/campaign.js';

const fake=(name,width=100,height=100)=>({name,width,height});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('ART-01 simultaneous consumers share one decode and retained images are reused',async()=>{
  let calls=0;
  const image=fake('shared'),loader=createAssetLoader({decode:async()=>{calls++;return image;}});
  const [first,second]=await Promise.all([loader.load('atlas'),loader.load('atlas')]);
  assert.equal(first,image);assert.equal(second,image);assert.equal(await loader.load('atlas'),image);
  assert.equal(calls,1);assert.equal(loader.stats().entries,1);
});
test('ART-02 decode concurrency is bounded and progress accounts for failures',async()=>{
  const pending=[],loader=createAssetLoader({concurrency:2,decode:src=>new Promise(resolve=>pending.push({src,resolve}))});
  const progress=[],loading=loader.prefetch(['one','two','three'],{onProgress:p=>progress.push(p)});
  await flush();assert.equal(pending.length,2);assert.equal(loader.stats().active,2);
  pending.shift().resolve(fake('one'));await flush();assert.equal(pending.length,2);
  pending.shift().resolve(null);pending.shift().resolve(fake('three'));
  assert.deepEqual(await loading,{completed:3,total:3,failed:1});
  assert.equal(progress.at(-1).percent,100);assert.equal(loader.stats().peakActive,2);
});
test('ART-03 least-recently-used references are evicted within entry and estimated byte caps',async()=>{
  const calls=[],loader=createAssetLoader({maxEntries:2,maxBytes:80000,decode:async src=>{calls.push(src);return fake(src);}});
  await loader.load('a');await loader.load('b');loader.peek('a');await loader.load('c');
  assert.equal(loader.peek('b'),null);assert.ok(loader.peek('a'));assert.ok(loader.peek('c'));
  assert.equal(loader.stats().estimatedBytes,80000);assert.equal(loader.stats().evictions,1);
  await loader.load('b');assert.equal(calls.filter(src=>src==='b').length,2);
  assert.ok(loader.stats().entries<=2);assert.ok(loader.stats().estimatedBytes<=80000);
});
test('ART-04 failed art returns a null fallback, throttles retries, and can explicitly retry',async()=>{
  let calls=0,time=0;
  const loader=createAssetLoader({now:()=>time,failureRetryMs:100,decode:async()=>{calls++;if(calls<3)throw Error('offline');return fake('returned');}});
  assert.equal(await loader.load('missing'),null);assert.equal(await loader.load('missing'),null);assert.equal(calls,1);
  time=101;assert.equal(await loader.load('missing'),null);
  assert.ok(await loader.load('missing',{retry:true}));assert.equal(calls,3);
});
test('ART-05 a single oversized decode is returned but never retained past the memory cap',async()=>{
  const image=fake('large',1024,1024),loader=createAssetLoader({maxBytes:100000,decode:async()=>image});
  assert.equal(await loader.load('large'),image);assert.equal(loader.peek('large'),null);
  assert.equal(loader.stats().estimatedBytes,0);
});
test('ART-06 reduced-data and slow connections suppress optional next-chapter prefetch',()=>{
  for(const connection of [{saveData:true},{effectiveType:'slow-2g'},{effectiveType:'2g'},{downlink:.8}])assert.equal(constrainedConnection(connection),true);
  assert.equal(constrainedConnection({effectiveType:'4g',downlink:4}),false);
  assert.equal(constrainedConnection(undefined),false);
});
test('ART-07 chapter groups cover earned portraits and every implemented encounter kind',()=>{
  for(const chapter of CHAPTERS){
    const assets=chapterAssets(chapter.id);
    assert.equal(new Set(assets).size,assets.length);
    assert.ok(assets.includes(heroPortrait(chapter.rank)),`chapter ${chapter.id} rank`);
    assert.ok(assets.includes(heroPortrait(chapter.promotion)),`chapter ${chapter.id} promotion`);
    for(const encounter of chapter.encounters)assert.ok(assets.includes(`./assets/tactical/units-${encounter.kind==='contest'?'civic':'roman-v031'}.webp`),`chapter ${chapter.id} ${encounter.kind}`);
    if(chapter.id<12)assert.ok(!assets.includes('./assets/portraits/hero-emperor.webp'));
  }
});
test('ART-08 each authored speaker and expression can be shown from its chapter asset group',()=>{
  for(const chapter of CHAPTERS)for(const stage of ['intro','aftermath'])for(const line of chapter[stage]){
    const image=speakerPortrait(line.speaker);
    if(image){assert.ok(chapterAssets(chapter.id).includes(image),`${chapter.id} ${line.speaker}`);assert.ok(chapterAssets(chapter.id).includes(speakerPortrait(line.speaker,'intense')),`${chapter.id} ${line.speaker} intense`);}
  }
});
test('ART-09 next chapter warms compressed responses with two fetches at most and no image decoder',async()=>{
  const pending=[],calls=[];
  const work=prefetchFiles(['one','two','one','three'],{fetcher:(src,options)=>{calls.push({src,options});return new Promise(resolve=>pending.push(()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(5)})));}});
  assert.equal(pending.length,2);pending.shift()();await flush();assert.equal(pending.length,2);
  pending.shift()();pending.shift()();assert.deepEqual(await work,{completed:3,total:3,failed:0});
  assert.deepEqual(calls.map(call=>call.src),['one','two','three']);assert.ok(calls.every(call=>call.options.cache==='force-cache'));
});
test('ART-10 an obsolete next-chapter request stops queueing additional asset fetches',async()=>{
  let current=true;const pending=[];
  const work=prefetchFiles(['one','two','three','four'],{shouldContinue:()=>current,fetcher:()=>new Promise(resolve=>pending.push(()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)})))});
  current=false;pending.splice(0).forEach(resolve=>resolve());
  assert.deepEqual(await work,{completed:2,total:4,failed:0});
});
