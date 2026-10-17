import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {newGame,choose,startEncounter,endTurn,serialize,deserialize} from '../src/core/game.js';
import {CONFIG} from '../src/config.js';
import {createSaveStore,saveCode,restoreCode} from '../src/ui/storage.js';

let activeOptions;
const importStorage=async()=>({...createSaveStore(activeOptions),saveCode,restoreCode});

// Direct module tests with transactional doubles; real-browser harness is separate.
async function withPlatform(run){
  const previous=new Map(['CompressionStream','DecompressionStream'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const env={local:new Map(),idb:null,localFails:false,idbOpenFails:false,idbWriteFails:false,delayCommit:false,pending:[],persistCalls:0,lockCalls:0};
  let transactionTail=Promise.resolve(),lockTail=Promise.resolve();
  const db={close(){},transaction(name,mode='readonly'){
    const operations=[],writes=[];let aborted=false;
    const tx={abort(){aborted=true;},objectStore(){return {
      get(key){const request={};operations.push(()=>{request.result=structuredClone(env.idb);request.onsuccess?.();});return request;},
      put(value,key){writes.push(structuredClone(value));}
    };}};
    const execute=async()=>{
      for(const operation of operations){if(aborted)break;operation();}
      if(aborted){tx.onabort?.();return;}
      if(writes.length){if(env.delayCommit)await new Promise(resolve=>env.pending.push(resolve));if(env.idbWriteFails){tx.onabort?.();return;}env.idb=writes.at(-1);}
      tx.oncomplete?.();
    };
    transactionTail=transactionTail.then(execute);return tx;
  }};
  const indexedDB={open(name,version){assert.equal(name,'sacramentum');assert.equal(version,1);const request={};queueMicrotask(()=>{if(env.idbOpenFails){request.onerror?.();return;}request.result=db;request.onsuccess?.();});return request;}};
  const localStorage={getItem(key){if(env.localFails)throw Error('localStorage unavailable');return env.local.get(key)??null;},setItem(key,value){if(env.localFails)throw Error('localStorage unavailable');env.local.set(key,value);}};
  const navigator={locks:{request(name,fn){assert.equal(name,'sacramentum-save');env.lockCalls++;const result=lockTail.then(fn);lockTail=result.catch(()=>{});return result;}},storage:{persist:async()=>{env.persistCalls++;return true;}}};
  const channels=new Set();
  class Channel{constructor(name){assert.equal(name,'sacramentum-save-changes');this.name=name;channels.add(this);}postMessage(data){for(const channel of channels)if(channel!==this&&channel.name===this.name)queueMicrotask(()=>channel.onmessage?.({data}));}close(){channels.delete(this);}}
  activeOptions={indexedDB,localStorage,navigator,BroadcastChannel:Channel};env.options=activeOptions;
  try{await run(env);}finally{for(const channel of channels)channel.close();for(const[name,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
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

test('SAV-13 atomic IDB compare-and-write rejects one simultaneous writer without Web Locks or localStorage',async()=>withPlatform(async env=>{
  env.options.useWebLocks=false;env.localFails=true;
  const a=await importStorage(),b=await importStorage();await a.saveLocal(newGame('Initial'));
  const sa=(await a.loadLocal()).state,sb=(await b.loadLocal()).state;sa.name='Tab A';sb.name='Tab B';
  const outcomes=await Promise.allSettled([a.saveLocal(sa),b.saveLocal(sb)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(outcomes.find(r=>r.status==='rejected').reason.code,'SAVE_CONFLICT');
  assert.equal(env.idb.sequence,2);assert.equal(JSON.parse(env.idb.payload).name,'Tab A');assert.equal(env.lockCalls,0);
}));

test('SAV-13 localStorage-only mode without atomic IDB or Web Locks fails closed',async()=>withPlatform(async env=>{
  env.options.useWebLocks=false;env.idbOpenFails=true;
  const store=await importStorage(),state=newGame('Memory remains usable');
  await assert.rejects(store.saveLocal(state),e=>e.code==='SAVE_UNAVAILABLE');assert.equal(env.local.size,0);
  assert.deepEqual(await restoreCode(await saveCode(state)),state);
}));

test('SAV-04 recovery keeps three distinct replaced campaigns',async()=>withPlatform(async env=>{
  const store=await importStorage();for(const name of ['A','B','C','D'])await store.saveLocal(newGame(name),{replace:true});
  const history=await store.listRecoverySaves();assert.deepEqual(history.map(e=>e.name),['C','B','A']);
  assert.equal(env.idb.recovery.length,3);assert.ok(env.idb.recovery.every(e=>!('recovery'in e)&&!('state'in e)));
  assert.equal((await store.loadLocal()).state.name,'D');
}));

test('SAV-13 a denied Web Locks request still uses atomic IDB and never unsafe local fallback',async()=>withPlatform(async env=>{
  env.options.navigator.locks.request=async()=>{throw new DOMException('Denied','SecurityError');};
  const store=await importStorage();await store.saveLocal(newGame('Atomic fallback'));
  assert.equal(env.idb.sequence,1);assert.equal((await store.getSaveSession()).webLocks,false);
  const priorLocal=env.local.get(CONFIG.saveKey);env.idbWriteFails=true;
  await assert.rejects(store.saveLocal(newGame('Cannot safely fall back')),e=>e.code==='SAVE_UNAVAILABLE');
  assert.equal(env.local.get(CONFIG.saveKey),priorLocal);
}));

test('SAV-04 turn autosaves do not crowd distinct encounter checkpoints out of recovery',async()=>withPlatform(async()=>{
  const store=await importStorage(),state=newGame('Checkpoints');await store.saveLocal(state);
  choose(state,'cover');await store.saveLocal(state);startEncounter(state);await store.saveLocal(state);
  assert.equal((await store.listRecoverySaves()).length,2);
  endTurn(state);await store.saveLocal(state);await store.saveLocal(state);
  const history=await store.listRecoverySaves();assert.equal(history.length,2);assert.ok(history.every(e=>e.phase==='camp'));
  assert.equal((await store.loadLocal()).state.encounter.turn,2);
}));

test('SAV-04 recovery preview is read-only and restore requires confirmation plus expected sequence',async()=>withPlatform(async env=>{
  const store=await importStorage();await store.saveLocal(newGame('Old'),{replace:true});await store.saveLocal(newGame('Current'),{replace:true});
  const [item]=await store.listRecoverySaves(),before=JSON.stringify(env.idb);
  assert.equal((await store.readRecoverySave(item.id)).name,'Old');assert.equal(JSON.stringify(env.idb),before);
  await assert.rejects(store.restoreRecovery(item.id),/Confirm replacement/);assert.equal(JSON.stringify(env.idb),before);
  await assert.rejects(store.restoreRecovery(item.id,{confirmed:true,expectedSequence:item.currentSequence-1}),e=>e.code==='SAVE_CONFLICT');
  assert.equal(JSON.stringify(env.idb),before);
  const restored=await store.restoreRecovery(item.id,{confirmed:true,expectedSequence:item.currentSequence});assert.equal(restored.name,'Old');
  assert.ok((await store.listRecoverySaves()).some(e=>e.name==='Current'));assert.equal((await store.loadLocal()).state.name,'Old');
}));

test('SAV-05 corrupt current payload exposes valid history without silently rolling back',async()=>withPlatform(async env=>{
  const store=await importStorage();await store.saveLocal(newGame('Recoverable'),{replace:true});await store.saveLocal(newGame('Current'),{replace:true});
  env.idb.checksum='invalid';env.local.set(CONFIG.saveKey,JSON.stringify(env.idb));
  const reader=await importStorage(),loaded=await reader.loadLocal();assert.equal(loaded.state,null);assert.equal(loaded.recoveryAvailable,1);
  const [item]=await reader.listRecoverySaves();assert.equal(item.name,'Recoverable');
  await reader.restoreRecovery(item.id,{confirmed:true,expectedSequence:0});assert.equal((await reader.loadLocal()).state.name,'Recoverable');
}));

test('SAV-05 corrupt recovery entries are rejected without touching the current save',async()=>withPlatform(async env=>{
  const store=await importStorage();await store.saveLocal(newGame('Old'),{replace:true});await store.saveLocal(newGame('Current'),{replace:true});
  const [item]=await store.listRecoverySaves();env.idb.recovery[0].checksum='broken';env.local.set(CONFIG.saveKey,JSON.stringify(env.idb));const before=JSON.stringify(env.idb);
  assert.equal((await store.listRecoverySaves()).length,0);await assert.rejects(store.restoreRecovery(item.id,{confirmed:true}),/unavailable or failed validation/);
  assert.equal(JSON.stringify(env.idb),before);
}));

test('SAV-13 confirmed takeover reserves current state and notifies IDB-only peers',async()=>withPlatform(async env=>{
  env.localFails=true;env.options.useWebLocks=false;
  const a=await importStorage(),b=await importStorage();await a.saveLocal(newGame('Latest'));const old=(await a.loadLocal()).state;
  const notices=[];const stop=a.subscribeSaveChanges(data=>notices.push(data));
  await assert.rejects(b.takeOverSaveSession(),/Confirm takeover/);
  const adopted=await b.takeOverSaveSession({confirmed:true});assert.equal(adopted.name,'Latest');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(notices.at(-1).sequence,2);
  assert.equal((await a.getSaveSession()).isCurrent,false);assert.equal((await b.getSaveSession()).isCurrent,true);
  await assert.rejects(a.saveLocal(old),e=>e.code==='SAVE_CONFLICT');stop();
}));

test('SAV-05 legacy v1 envelopes without history or writer metadata remain loadable',async()=>withPlatform(async env=>{
  const store=await importStorage();await store.saveLocal(newGame('Legacy'));
  for(const key of ['recovery','writerId','campaignId','checkpoint','id'])delete env.idb[key];env.local.clear();
  const reader=await importStorage();assert.equal((await reader.loadLocal()).state.name,'Legacy');assert.deepEqual(await reader.listRecoverySaves(),[]);
  await reader.saveLocal((await reader.loadLocal()).state);assert.equal(env.idb.sequence,2);
}));

test('Imperium continues a frozen pre-rename checkpoint in the original stores and portable formats',async()=>withPlatform(async env=>{
  const fixture=JSON.parse(readFileSync(new URL('./compatibility/v06-ui-checkpoints.json',import.meta.url),'utf8'));
  const payload=JSON.stringify(fixture.scenes.find(scene=>scene.id==='board-ch1-road').state);
  let digest=2166136261;for(const character of payload){digest^=character.charCodeAt(0);digest=Math.imul(digest,16777619);}
  const legacy={format:1,sequence:41,savedAt:'2026-10-12T12:00:00.000Z',payload,checksum:(digest>>>0).toString(16)};
  env.idb=structuredClone(legacy);env.local.set('sacramentum.campaign.v1',JSON.stringify(legacy));env.local.set('unrelated-app','untouched');
  const expected=serialize(deserialize(payload)),store=await importStorage(),loaded=await store.loadLocal();
  assert.equal(serialize(loaded.state),expected);assert.deepEqual(env.idb,legacy,'Loading must not rewrite the old checkpoint.');
  for(const code of ['SAC1.'+gzipSync(JSON.stringify(legacy)).toString('base64'),'SAC1J.'+Buffer.from(JSON.stringify(legacy)).toString('base64'),'SAC1J.'+Buffer.from(payload).toString('base64')])assert.equal(serialize(await restoreCode(code)),expected);
  const notifications=[],oldTab=new env.options.BroadcastChannel('sacramentum-save-changes');oldTab.onmessage=event=>notifications.push(event.data);
  loaded.state.name='Imperium continued chronicle';await store.saveLocal(loaded.state);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(env.idb.sequence,42);assert.equal(notifications.at(-1).sequence,42);
  assert.equal(JSON.parse(env.local.get('sacramentum.campaign.v1')).sequence,42);
  assert.deepEqual([...env.local.keys()].sort(),['sacramentum.campaign.v1','unrelated-app']);assert.equal(env.local.get('unrelated-app'),'untouched');
  assert.equal((await(await importStorage()).loadLocal()).state.name,'Imperium continued chronicle');
}));

for(const useWebLocks of [false,true])test(`SAV-13 failed takeover retains stale-write protection (${useWebLocks?'with':'without'} Web Locks)`,async()=>withPlatform(async env=>{
  env.options.useWebLocks=useWebLocks;env.localFails=true;
  const latestTab=await importStorage(),staleTab=await importStorage();
  await latestTab.saveLocal(newGame('Original campaign'));
  const staleState=(await staleTab.loadLocal()).state;
  await latestTab.saveLocal(newGame('Newer campaign'),{replace:true});
  const before=structuredClone(env.idb);
  assert.equal((await staleTab.getSaveSession()).isCurrent,false);
  env.idbWriteFails=true;
  await assert.rejects(staleTab.takeOverSaveSession({confirmed:true}),e=>e.code==='SAVE_UNAVAILABLE');
  assert.deepEqual(env.idb,before);
  assert.equal((await staleTab.getSaveSession()).isCurrent,false);
  env.idbWriteFails=false;
  await assert.rejects(staleTab.saveLocal(staleState),e=>e.code==='SAVE_CONFLICT');
  assert.deepEqual(env.idb,before);
  const adopted=await staleTab.takeOverSaveSession({confirmed:true});
  assert.equal(adopted.name,'Newer campaign');
  assert.equal(env.idb.campaignId,before.campaignId);
  assert.equal((await staleTab.getSaveSession()).isCurrent,true);
  adopted.name='Continued after explicit retry';await staleTab.saveLocal(adopted);
  assert.equal(JSON.parse(env.idb.payload).name,adopted.name);
}));

