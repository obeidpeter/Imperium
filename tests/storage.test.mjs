import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {newGame,choose,startEncounter,serialize} from '../src/core/game.js';
import {CONFIG} from '../src/config.js';

let instance=0;
const importStorage=()=>import(`../src/ui/storage.js?storage-test=${++instance}`);

// These are platform-service tests, not real-browser IndexedDB or multi-tab tests.
// Every test gets isolated globals and fresh module-local sequence/cache state.
async function withPlatform(run){
  const names=['indexedDB','localStorage','navigator','CompressionStream','DecompressionStream'];
  const previous=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const env={local:new Map(),idb:null,localFails:false,idbOpenFails:false,idbWriteFails:false,
    delayCommit:false,pending:[],persistCalls:0,lockCalls:0};
  let lockTail=Promise.resolve();
  const db={transaction(){
    const tx={objectStore(){return {
      get(){const request={};queueMicrotask(()=>{request.result=structuredClone(env.idb);request.onsuccess?.();});return request;},
      put(value){const copy=structuredClone(value);const finish=()=>{
        if(env.idbWriteFails){tx.onabort?.();return;}
        env.idb=copy;tx.oncomplete?.();
      };if(env.delayCommit)env.pending.push(finish);else queueMicrotask(finish);}
    };}};
    return tx;
  }};
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){
    const request={};queueMicrotask(()=>{
      if(env.idbOpenFails){request.onerror?.();return;}
      request.result=db;request.onsuccess?.();
    });return request;
  }}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem(key){if(env.localFails)throw new Error('localStorage unavailable');return env.local.get(key)??null;},
    setItem(key,value){if(env.localFails)throw new Error('localStorage unavailable');env.local.set(key,value);}
  }});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{
    locks:{request(name,fn){assert.equal(name,'sacramentum-save');env.lockCalls++;const result=lockTail.then(fn);lockTail=result.catch(()=>{});return result;}},
    storage:{persist:async()=>{env.persistCalls++;return true;}}
  }});
  try{await run(env);}finally{
    for(const [name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
  }
}

test('SAV-03 save resolves only after the IndexedDB transaction completes',async()=>withPlatform(async env=>{
  env.localFails=true;env.delayCommit=true;
  const storage=await importStorage();let resolved=false;
  const writing=storage.saveLocal(newGame()).then(()=>{resolved=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(resolved,false);assert.equal(env.idb,null);assert.equal(env.pending.length,1);
  env.pending.shift()();await writing;
  assert.equal(resolved,true);assert.equal(env.idb.sequence,1);assert.equal(env.persistCalls,1);
}));

test('SAV-03 localStorage fallback preserves progress when IndexedDB cannot open',async()=>withPlatform(async env=>{
  env.idbOpenFails=true;
  const storage=await importStorage(),state=newGame('Local fallback');
  const savedAt=await storage.saveLocal(state);
  assert.ok(Number.isFinite(Date.parse(savedAt)));assert.equal(env.idb,null);
  const loaded=await (await importStorage()).loadLocal();assert.deepEqual(loaded.state,state);assert.equal(loaded.error,null);
}));

test('SAV-03 IndexedDB preserves progress when localStorage is unavailable',async()=>withPlatform(async env=>{
  env.localFails=true;const storage=await importStorage(),state=newGame('IDB fallback');
  await storage.saveLocal(state);await storage.saveLocal(state);
  assert.equal(env.local.size,0);assert.equal(env.idb.sequence,2);assert.equal(env.persistCalls,1);
  assert.deepEqual((await (await importStorage()).loadLocal()).state,state);
}));

test('SAV-12 both stores failing rejects the write and preserves the prior good save',async()=>withPlatform(async env=>{
  const storage=await importStorage(),state=newGame('Previous safe checkpoint');await storage.saveLocal(state);
  const previousIDB=structuredClone(env.idb),previousLocal=env.local.get(CONFIG.saveKey);
  env.localFails=true;env.idbWriteFails=true;state.name='Unsaved memory-only progress';
  await assert.rejects(storage.saveLocal(state),/storage is unavailable/i);
  assert.deepEqual(env.idb,previousIDB);assert.equal(env.local.get(CONFIG.saveKey),previousLocal);
  const exported=await storage.saveCode(state);assert.equal((await storage.restoreCode(exported)).name,state.name);
}));

test('SAV-11 load selects newer localStorage progress after IndexedDB write failures',async()=>withPlatform(async env=>{
  const storage=await importStorage(),state=newGame('Older IDB checkpoint');await storage.saveLocal(state);
  env.idbWriteFails=true;state.name='Newer local checkpoint';await storage.saveLocal(state);
  assert.equal(env.idb.sequence,1);assert.equal(JSON.parse(env.local.get(CONFIG.saveKey)).sequence,2);
  env.idbWriteFails=false;const loaded=await (await importStorage()).loadLocal();assert.equal(loaded.state.name,state.name);
}));

test('SAV-11 load selects newer IndexedDB progress after localStorage write failures',async()=>withPlatform(async env=>{
  const storage=await importStorage(),state=newGame('Older local checkpoint');await storage.saveLocal(state);
  env.localFails=true;state.name='Newer IDB checkpoint';await storage.saveLocal(state);
  env.localFails=false;assert.equal(JSON.parse(env.local.get(CONFIG.saveKey)).sequence,1);assert.equal(env.idb.sequence,2);
  const loaded=await (await importStorage()).loadLocal();assert.equal(loaded.state.name,state.name);
}));

test('SAV-13 stale tab is rejected against newer IDB when localStorage fails',async()=>withPlatform(async env=>{
  env.localFails=true;
  const tabA=await importStorage(),tabB=await importStorage(),stateA=newGame('Initial');
  await tabA.saveLocal(stateA);const stateB=(await tabB.loadLocal()).state;
  stateA.name='Newer progress in tab A';await tabA.saveLocal(stateA);
  stateB.name='Stale tab B';await assert.rejects(tabB.saveLocal(stateB),/newer save exists in another tab/i);
  assert.equal(env.idb.sequence,2);assert.equal(JSON.parse(env.idb.payload).name,stateA.name);
  assert.equal(env.lockCalls,3);
}));

test('SAV-13 stale tab is rejected against newer localStorage when IDB fails',async()=>withPlatform(async env=>{
  env.idbOpenFails=true;
  const tabA=await importStorage(),tabB=await importStorage(),stateA=newGame('Initial');
  await tabA.saveLocal(stateA);const stateB=(await tabB.loadLocal()).state;
  stateA.name='Newer local-only progress';await tabA.saveLocal(stateA);
  await assert.rejects(tabB.saveLocal(stateB),/newer save exists in another tab/i);
  assert.equal(JSON.parse(JSON.parse(env.local.get(CONFIG.saveKey)).payload).name,stateA.name);
}));

test('SAV-05 invalid newer local checksum falls back to valid IDB without deleting data',async()=>withPlatform(async env=>{
  const storage=await importStorage(),state=newGame('Valid IDB');await storage.saveLocal(state);
  const broken=JSON.parse(env.local.get(CONFIG.saveKey));broken.sequence=99;broken.payload=broken.payload.replace('Valid IDB','Corrupted');
  const badText=JSON.stringify(broken);env.local.set(CONFIG.saveKey,badText);
  const loaded=await (await importStorage()).loadLocal();assert.deepEqual(loaded.state,state);
  assert.equal(env.local.get(CONFIG.saveKey),badText);
}));

test('SAV-06 compressed save code round-trips complete active encounter and start snapshot',async()=>withPlatform(async()=>{
  assert.equal(typeof CompressionStream,'function');
  const storage=await importStorage(),state=newGame('Aurelius Test',875);
  assert.equal(choose(state,'cover').ok,true);assert.equal(startEncounter(state).ok,true);
  const before=serialize(state),code=await storage.saveCode(state);
  assert.ok(code.startsWith('SAC1.'));
  const envelope=JSON.parse(gunzipSync(Buffer.from(code.slice(5),'base64')).toString('utf8'));
  assert.equal(envelope.format,1);assert.equal(typeof envelope.checksum,'string');assert.equal(envelope.payload,before);
  assert.deepEqual(await storage.restoreCode(code),state);assert.equal(serialize(state),before);
}));

test('SAV-06 checksum detects structurally valid altered save payload and changes no local save',async()=>withPlatform(async env=>{
  const storage=await importStorage(),state=newGame('Original name');await storage.saveLocal(state);
  const priorLocal=env.local.get(CONFIG.saveKey),priorIDB=structuredClone(env.idb),code=await storage.saveCode(state);
  const envelope=JSON.parse(gunzipSync(Buffer.from(code.slice(5),'base64')).toString('utf8'));
  envelope.payload=JSON.stringify({...JSON.parse(envelope.payload),name:'Changed name'});
  const corrupt='SAC1.'+gzipSync(JSON.stringify(envelope)).toString('base64');
  await assert.rejects(storage.restoreCode(corrupt),/invalid or incompatible/i);
  assert.equal(env.local.get(CONFIG.saveKey),priorLocal);assert.deepEqual(env.idb,priorIDB);
}));

test('SAV-06 uncompressed fallback remains portable when CompressionStream is missing',async()=>withPlatform(async()=>{
  Object.defineProperty(globalThis,'CompressionStream',{value:undefined,configurable:true});
  const storage=await importStorage(),state=newGame('Uncompressed backup');const code=await storage.saveCode(state);
  assert.ok(code.startsWith('SAC1J.'));assert.deepEqual(await storage.restoreCode(code),state);
}));

test('SAV-05 malformed and incompatible imports are rejected before storage writes',async()=>withPlatform(async env=>{
  const storage=await importStorage();
  for(const code of ['invalid-prefix','SAC1.!bad-base64','SAC1J.'+Buffer.from('{oops').toString('base64'),JSON.stringify({...newGame(),version:999})]){
    await assert.rejects(storage.restoreCode(code));
  }
  assert.equal(env.idb,null);assert.equal(env.local.size,0);
}));
