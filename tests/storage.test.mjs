import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
import {newGame,choose,startEncounter,endTurn,serialize,deserialize,soldierCommand} from '../src/core/game.js';
import {CONFIG} from '../src/config.js';
import {createSaveStore,saveCode,restoreCode} from '../src/ui/storage.js';

let activeOptions;
const importStorage=async()=>({...createSaveStore(activeOptions),saveCode,restoreCode});

// Direct module tests with transactional doubles; real-browser harness is separate.
async function withPlatform(run){
  const previous=new Map(['CompressionStream','DecompressionStream'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const env={local:new Map(),idb:null,idbOther:new Map(),localFails:false,idbOpenFails:false,idbWriteFails:false,delayCommit:false,pending:[],persistCalls:0,lockCalls:0};
  let transactionTail=Promise.resolve(),lockTail=Promise.resolve();
  const db={close(){},transaction(name,mode='readonly'){
    const operations=[],writes=[];let aborted=false;
    const tx={abort(){aborted=true;},objectStore(){return {
      // env.idb is the campaign record; other keys (the unreadable quarantine) are kept separately.
      get(key){let ready=false,value;const request={get result(){if(!ready)throw new DOMException('The request has not finished.','InvalidStateError');return value;}};operations.push(()=>{value=structuredClone(key==='campaign'?env.idb:env.idbOther.get(key)??null);ready=true;request.onsuccess?.();});return request;},
      put(value,key){writes.push({key,value:structuredClone(value)});},
      delete(key){writes.push({key,remove:true});}
    };}};
    const execute=async()=>{
      for(const operation of operations){if(aborted)break;operation();}
      if(aborted){tx.onabort?.();return;}
      if(writes.length){if(env.delayCommit)await new Promise(resolve=>env.pending.push(resolve));if(env.idbWriteFails){tx.onabort?.();return;}for(const {key,value,remove}of writes){if(remove){if(key==='campaign')env.idb=null;else env.idbOther.delete(key);}else if(key==='campaign')env.idb=value;else env.idbOther.set(key,value);}}
      tx.oncomplete?.();
    };
    transactionTail=transactionTail.then(execute);return tx;
  }};
  const indexedDB={open(name,version){assert.equal(name,'sacramentum');assert.equal(version,1);const request={};queueMicrotask(()=>{if(env.idbOpenFails){request.onerror?.();return;}request.result=db;request.onsuccess?.();});return request;}};
  const localStorage={getItem(key){if(env.localFails)throw Error('localStorage unavailable');return env.local.get(key)??null;},setItem(key,value){if(env.localFails)throw Error('localStorage unavailable');env.local.set(key,value);},
    removeItem(key){if(env.localFails)throw Error('localStorage unavailable');env.local.delete(key);}};
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


test('SAV-14 an unreadable stored chronicle is preserved before a new save replaces it, and can be read back exactly',async()=>withPlatform(async env=>{
  // An incompatible edition's record: valid JSON, but not a readable envelope.
  const foreign=JSON.stringify({format:7,payload:'{"version":99}',checksum:'0'}),idbForeign={format:9,payload:'not a campaign',checksum:'1'};
  env.local.set(CONFIG.saveKey,foreign);env.idb=structuredClone(idbForeign);
  const storage=await importStorage(),loaded=await storage.loadLocal();
  assert.equal(loaded.state,null);assert.match(loaded.error,/damaged or incompatible/);
  // Listing works before any write: nothing has to be overwritten to be offered.
  const before=await storage.listUnreadableSaves();assert.equal(before.length,2);assert.ok(before.every(item=>!('text' in item)&&item.bytes>0));
  await storage.saveLocal(newGame('Fresh start'));
  const after=await storage.listUnreadableSaves(),sources=after.map(item=>item.source).sort();
  assert.deepEqual(sources,['indexedDB','localStorage'],'Both stores keep their own unreadable record');
  const texts=await Promise.all(after.map(item=>storage.readUnreadableSave(item.index)));
  assert.ok(texts.includes(foreign),'The localStorage record is byte-identical');
  assert.ok(texts.some(text=>JSON.stringify(JSON.parse(text))===JSON.stringify(idbForeign)),'The IndexedDB record is preserved');
  assert.equal(JSON.parse(JSON.parse(env.local.get(CONFIG.saveKey)).payload).name,'Fresh start','The new chronicle is saved normally');
  await storage.saveLocal(newGame('Second save'));assert.equal((await storage.listUnreadableSaves()).filter(item=>item.source==='localStorage').length,1,'Repeated saves do not duplicate a preserved record');
  await assert.rejects(storage.readUnreadableSave(99),/unavailable/);
}));

test('SAV-15 oversized unreadable local data is archived in IndexedDB before replacement',async()=>withPlatform(async env=>{
  const raw=JSON.stringify({format:99,payload:'x'.repeat(1500000)});env.local.set(CONFIG.saveKey,raw);
  const store=await importStorage();await store.saveLocal(newGame('Preserved large record'));
  const entries=await store.listUnreadableSaves();assert.equal(entries.length,1);
  assert.equal(await store.readUnreadableSave(entries[0].index),raw);
  assert.equal((await store.loadLocal()).state.name,'Preserved large record');
}));

for(const reason of ['too large','quota'])test(`SAV-15 refuses replacement when the unreadable local archive fails: ${reason}`,async()=>withPlatform(async env=>{
  env.idbOpenFails=true;
  const raw=JSON.stringify({format:99,payload:reason==='too large'?'x'.repeat(1500000):'old chronicle'});env.local.set(CONFIG.saveKey,raw);
  if(reason==='quota'){
    const set=env.options.localStorage.setItem;
    env.options.localStorage.setItem=(key,value)=>{if(key.endsWith('.unreadable'))throw new DOMException('Quota exceeded','QuotaExceededError');set(key,value);};
  }
  const store=await importStorage();await assert.rejects(store.saveLocal(newGame('Replacement')),error=>error.code==='SAVE_UNAVAILABLE'&&/could not be preserved/.test(error.message));
  assert.equal(env.local.get(CONFIG.saveKey),raw);
  assert.equal(await store.readUnreadableSave(0),raw);
}));

// The player's discard (Settings → Saves), after downloading: every copy of the one record, and nothing else.
test('SAV-16 discarding a downloaded unreadable record removes every copy of it and keeps everything else',async()=>withPlatform(async env=>{
  const local=JSON.stringify({format:99,payload:'damaged local save'}),idb=JSON.stringify({format:98,payload:'damaged database save'});
  env.local.set(CONFIG.saveKey,local);env.idb=idb;
  const store=await importStorage();await store.saveLocal(newGame('Kept'));
  const listed=await store.listUnreadableSaves();assert.equal(listed.length,2,'both damaged records were archived before the save');
  const entry=listed.find(e=>e.source==='localStorage'),other=listed.find(e=>e!==entry);
  assert.equal(await store.readUnreadableSave(entry.index),local,'the player downloads it first');
  assert.ok(await store.discardUnreadableSave(entry.checksum)>=2,'its copies in both archives are removed');
  const left=await store.listUnreadableSaves();assert.deepEqual(left.map(e=>e.checksum),[other.checksum],'the other damaged record stays');
  assert.equal(await store.readUnreadableSave(left[0].index),idb);
  assert.equal(await store.discardUnreadableSave('not-a-record'),0,'an unknown record removes nothing');
  assert.equal((await store.loadLocal()).state.name,'Kept','the chronicle is untouched');
}));

test('SAV-16 a damaged record that could not be preserved can be downloaded and discarded, and saving goes on',async()=>withPlatform(async env=>{
  env.idbOpenFails=true;const raw=JSON.stringify({format:99,payload:'x'.repeat(1500000)});env.local.set(CONFIG.saveKey,raw);
  const store=await importStorage();
  await assert.rejects(store.saveLocal(newGame('Blocked')),error=>/discard it there/.test(error.message),'the refusal names the way out');
  const [entry]=await store.listUnreadableSaves();assert.equal(await store.readUnreadableSave(entry.index),raw);
  assert.equal(await store.discardUnreadableSave(entry.checksum),1,'the live record goes');assert.equal(env.local.has(CONFIG.saveKey),false);
  await store.saveLocal(newGame('After discard'));assert.equal((await store.loadLocal()).state.name,'After discard');
  assert.deepEqual(await store.listUnreadableSaves(),[]);
}));

test('SAV-16 a readable save is never discarded, whatever record is named',async()=>withPlatform(async env=>{
  const store=await importStorage();await store.saveLocal(newGame('Readable'));
  const text=env.local.get(CONFIG.saveKey),sum=JSON.parse(text).checksum;
  for(const digest of [sum,'0'])assert.equal(await store.discardUnreadableSave(digest),0);
  assert.equal(env.local.get(CONFIG.saveKey),text);assert.equal((await store.loadLocal()).state.name,'Readable');
}));

// The desktop app's save file (platform.js desktopSaveMirror; the Steam plan, docs/steam-plan.md). A fake file stands in
// for the bridge: the store must treat it as the chronicle without losing what it replaces.
const fakeFile=(text=null)=>{const file={text,writes:0,fail:false};
  return Object.assign(file,{mirror:{read:async()=>file.text,write:async next=>{if(file.fail)throw Error('disk full');file.writes++;file.text=next;}}});};

for(const archive of [true,false])test(`DESK-14 adopting a cloud save ${archive?'archives the damaged profile':'refuses to replace an unarchivable profile'}`,async()=>withPlatform(async env=>{
  const file=fakeFile();await createSaveStore({...env.options,mirror:file.mirror}).saveLocal(newGame('Cloud'));
  const original=file.text,raw=JSON.stringify({format:99,payload:'x'.repeat(1500000)});
  env.local.set(CONFIG.saveKey,raw);env.idb=null;env.idbOpenFails=!archive;
  const store=createSaveStore({...env.options,mirror:file.mirror}),loaded=await store.loadLocal();
  if(archive)assert.equal(loaded.state.name,'Cloud');
  else{assert.equal(loaded.state,null);assert.match(loaded.fileProblem,/could not be loaded/);assert.equal(env.local.get(CONFIG.saveKey),raw);}
  assert.equal(await store.readUnreadableSave(0),raw);assert.equal(file.text,original);
}));

test('DESK-01 every desktop save is written to its file, and an empty profile loads the chronicle from it',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror});
  await desk.saveLocal(newGame('Desk'));
  const written=JSON.parse(file.text);
  assert.equal(file.writes,1);assert.equal(written.sequence,env.idb.sequence);assert.equal(written.payload,env.idb.payload);assert.equal(written.checksum,env.idb.checksum);
  // Another PC, or a reinstall: an empty profile with the synced file.
  env.idb=null;env.local.clear();
  const fresh=createSaveStore({...env.options,mirror:file.mirror}),loaded=await fresh.loadLocal();
  assert.equal(loaded.state.name,'Desk');assert.equal(env.idb.sequence,written.sequence,'Adopted as it is, with its own sequence');
  await fresh.saveLocal(loaded.state);assert.equal(JSON.parse(file.text).sequence,written.sequence+1,'Saving continues from the file');
}));

test('DESK-02 a save file that differs wins at load, and the chronicle it replaces stays a recovery checkpoint',async()=>withPlatform(async env=>{
  const plain=createSaveStore(env.options);
  await plain.saveLocal(newGame('Cloud'));const cloud=JSON.stringify(env.idb);
  await plain.saveLocal(newGame('Local'),{replace:true});
  const file=fakeFile(cloud),desk=createSaveStore({...env.options,mirror:file.mirror}),loaded=await desk.loadLocal();
  assert.equal(loaded.state.name,'Cloud','Steam Cloud’s copy is the chronicle');
  assert.equal(JSON.parse(env.local.get(CONFIG.saveKey)).payload,JSON.parse(cloud).payload);
  assert.ok((await desk.listRecoverySaves()).some(e=>e.name==='Local'),'The replaced chronicle can be restored');
  assert.equal(file.writes,0,'Adopting the file does not rewrite it');
}));

test('DESK-03 a chronicle only the profile holds is written to the missing file at load',async()=>withPlatform(async env=>{
  await createSaveStore(env.options).saveLocal(newGame('Profile only'));
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror});
  assert.equal((await desk.loadLocal()).state.name,'Profile only');
  assert.equal(JSON.parse(file.text).payload,env.idb.payload);assert.equal(JSON.parse(file.text).sequence,env.idb.sequence);
}));

test('DESK-04 an unreadable save file is set aside and the profile’s chronicle loads',async()=>withPlatform(async env=>{
  await createSaveStore(env.options).saveLocal(newGame('Kept'));
  const file=fakeFile('{"format":9,"payload":"not a campaign"}'),desk=createSaveStore({...env.options,mirror:file.mirror});
  assert.equal((await desk.loadLocal()).state.name,'Kept');
  const preserved=await desk.listUnreadableSaves(),item=preserved.find(entry=>entry.source==='file');
  assert.ok(item,'The unreadable file is kept for export');assert.equal(await desk.readUnreadableSave(item.index),'{"format":9,"payload":"not a campaign"}');
}));

test('DESK-05 a save file that cannot be written is reported, while the store keeps the save',async()=>withPlatform(async env=>{
  const file=fakeFile();file.fail=true;
  const desk=createSaveStore({...env.options,mirror:file.mirror});
  await assert.rejects(desk.saveLocal(newGame('Written')),error=>error.code==='SAVE_FILE_UNAVAILABLE'&&/save file could not be written/.test(error.message));
  assert.equal((await createSaveStore(env.options).loadLocal()).state.name,'Written','The profile kept the save');
  file.fail=false;await desk.saveLocal(newGame('Written'));assert.equal(JSON.parse(file.text).payload,env.idb.payload,'The next save writes the file');
}));

for(const backend of ['both','idb','local'])test(`DESK-06 failed file writes survive relaunch within one checkpoint (${backend})`,async()=>withPlatform(async env=>{
  env.localFails=backend==='idb';env.idbOpenFails=backend==='local';
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame();
  await desk.saveLocal(state);const old=file.text;
  assert.equal(soldierCommand(state,{kind:'takeOff',place:'shield:0'}).ok,true);
  file.fail=true;await assert.rejects(desk.saveLocal(state),{code:'SAVE_FILE_UNAVAILABLE'});
  assert.equal(file.text,old);file.fail=false;
  const relaunched=createSaveStore({...env.options,mirror:file.mirror}),loaded=await relaunched.loadLocal();
  assert.deepEqual(loaded.state,state,'The latest equipment state is retained, not replaced by the old file');
  assert.match(loaded.warning,/Recovered local progress/);
  assert.equal(JSON.parse(file.text).payload,serialize(state),'The failed write is safely retried');
  assert.equal(JSON.parse(file.text).fileBase,undefined,'Local sync bookkeeping is not the cloud file');
}));

test('DESK-07 read errors do not masquerade as missing files at load or save',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame('Local');
  await desk.saveLocal(state);const old=file.text,writes=file.writes;
  const failing={...file.mirror,read:async()=>{throw Error('sharing violation');}};
  const relaunched=createSaveStore({...env.options,mirror:failing}),loaded=await relaunched.loadLocal();
  assert.equal(loaded.state.name,'Local');assert.match(loaded.fileProblem,/cannot be read/);
  assert.equal(file.writes,writes);assert.equal(file.text,old);
  soldierCommand(state,{kind:'takeOff',place:'shield:0'});
  await assert.rejects(relaunched.saveLocal(state),{code:'SAVE_FILE_UNAVAILABLE'});
  assert.equal(file.text,old);assert.equal(file.writes,writes);
  assert.deepEqual((await createSaveStore(env.options).loadLocal()).state,state,'Local progress is still durable');
}));

test('DESK-07b a startup read error with no file base on record says the file was not checked, not that it changed',async()=>withPlatform(async env=>{
  // Local progress saved before the app had a file (so it records no file base), then a file the first read cannot open.
  const state=newGame('Unchecked');await createSaveStore(env.options).saveLocal(state);
  const file=fakeFile('{"held":"by another program"}'),writes=file.writes,old=file.text;
  const failing={...file.mirror,read:async()=>{throw Error('sharing violation');}};
  const desk=createSaveStore({...env.options,mirror:failing}),loaded=await desk.loadLocal();
  assert.equal(loaded.state.name,'Unchecked');assert.match(loaded.fileProblem,/cannot be read/);
  // The file is readable again but was never checked: saving still refuses to replace it, and says why.
  const readable=createSaveStore({...env.options,mirror:failing});await readable.loadLocal();
  failing.read=file.mirror.read;
  await assert.rejects(readable.saveLocal(state),error=>error.code==='SAVE_FILE_UNAVAILABLE'&&/could not be read when the game started/.test(error.message)&&!/changed outside/.test(error.message));
  assert.equal(file.text,old);assert.equal(file.writes,writes,'The unchecked file is never replaced');
  assert.deepEqual((await createSaveStore(env.options).loadLocal()).state,state,'Local progress is still durable');
}));

test('DESK-08 a changed cloud file preserves even a same-checkpoint local alternative through further saves',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame();
  await desk.saveLocal(state);const cloud=file.text;
  soldierCommand(state,{kind:'takeOff',place:'shield:0'});await desk.saveLocal(state);
  file.text=cloud;
  const relaunched=createSaveStore({...env.options,mirror:file.mirror}),loaded=await relaunched.loadLocal();
  assert.ok(loaded.state.soldier.worn['shield:0']);
  let history=await relaunched.listRecoverySaves();assert.equal(history.length,1);
  assert.match(history[0].source,/Local copy/);assert.deepEqual(await relaunched.readRecoverySave(history[0].id),state);
  await relaunched.saveLocal(loaded.state);history=await relaunched.listRecoverySaves();
  assert.deepEqual(await relaunched.readRecoverySave(history[0].id),state);
}));

test('DESK-09 a failed write followed by an unrelated cloud update keeps both versions',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame();
  await desk.saveLocal(state);soldierCommand(state,{kind:'takeOff',place:'shield:0'});
  file.fail=true;await assert.rejects(desk.saveLocal(state));file.fail=false;
  // A distinct cloud writer, represented by a valid envelope from another isolated store.
  const otherLocal=new Map(),other=createSaveStore({...env.options,indexedDB:null,localStorage:{getItem:k=>otherLocal.get(k),setItem:(k,v)=>otherLocal.set(k,v)},mirror:file.mirror});
  await other.saveLocal(newGame('Other PC'));
  const relaunched=createSaveStore({...env.options,mirror:file.mirror});
  assert.equal((await relaunched.loadLocal()).state.name,'Other PC');
  const history=await relaunched.listRecoverySaves();
  assert.deepEqual(await relaunched.readRecoverySave(history.find(e=>e.source?.includes('Local')).id),state);
}));

test('DESK-10 a live external change is not overwritten by the next autosave',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame();
  await desk.saveLocal(state);file.text='external edit';
  await assert.rejects(desk.saveLocal(state),/changed outside the game/);assert.equal(file.text,'external edit');
}));

test('DESK-11 a valid previous file recovers an empty profile without rotating the corrupt primary over it',async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame('Backup');
  await desk.saveLocal(state);const backup=file.text;env.idb=null;env.local.clear();file.text='broken primary';
  let options;const mirror={...file.mirror,readPrevious:async()=>backup,write:async(text,opts)=>{options=opts;await file.mirror.write(text);}};
  const relaunched=createSaveStore({...env.options,mirror}),loaded=await relaunched.loadLocal();
  assert.deepEqual(loaded.state,state);assert.match(loaded.warning,/previous save file/);assert.match(loaded.fileProblem,/damaged/);
  assert.equal(file.text,'broken primary');
  const preserved=await relaunched.listUnreadableSaves();assert.equal(await relaunched.readUnreadableSave(preserved[0].index),'broken primary');
  await relaunched.saveLocal(state);assert.equal(options.keepPrevious,true);assert.equal(options.expected,'broken primary');
}));

test('DESK-12 missing-file write failures are surfaced during load',async()=>withPlatform(async env=>{
  await createSaveStore(env.options).saveLocal(newGame());const file=fakeFile();file.fail=true;
  const loaded=await createSaveStore({...env.options,mirror:file.mirror}).loadLocal();
  assert.ok(loaded.state);assert.match(loaded.fileProblem,/could not be written/);
}));

for(const changed of [false,true])test(`DESK-13 after a startup read error, retry ${changed?'protects an external change':'writes to the unchanged file'}`,async()=>withPlatform(async env=>{
  const file=fakeFile(),desk=createSaveStore({...env.options,mirror:file.mirror}),state=newGame('Earlier file');
  await desk.saveLocal(state);const rollback=file.text;
  state.name='Local progress';await desk.saveLocal(state);
  let blocked=true;
  const mirror={...file.mirror,read:async()=>{if(blocked)throw Error('sharing violation');return file.text;}};
  const relaunched=createSaveStore({...env.options,mirror});
  assert.match((await relaunched.loadLocal()).fileProblem,/cannot be read/);
  assert.ok(soldierCommand(state,{kind:'takeOff',place:'shield:0'}).ok);
  await assert.rejects(relaunched.saveLocal(state),{code:'SAVE_FILE_UNAVAILABLE'});
  blocked=false;if(changed)file.text=rollback;
  if(changed){
    await assert.rejects(relaunched.saveLocal(state),/changed outside the game/);
    assert.equal(file.text,rollback,'The recovered external file is never overwritten');
    assert.deepEqual((await createSaveStore(env.options).loadLocal()).state,state,'New local progress stays durable');
    const reconciled=createSaveStore({...env.options,mirror:file.mirror});
    assert.equal((await reconciled.loadLocal()).state.name,'Earlier file');
    const local=(await reconciled.listRecoverySaves()).find(e=>e.source?.includes('Local'));
    assert.ok(local);assert.deepEqual(await reconciled.readRecoverySave(local.id),state);
  }else{
    await relaunched.saveLocal(state);assert.equal(JSON.parse(file.text).payload,serialize(state));
  }
}));

// The discard (SAV-16) on the desktop: the damaged data may also be the save file itself, which the archive took it from.
for(const chronicle of [true,false])test(`DESK-15 a discarded damaged save file ${chronicle?'is replaced at once with the chronicle':'is replaced by the first save'} and not archived again`,async()=>withPlatform(async env=>{
  if(chronicle)await createSaveStore(env.options).saveLocal(newGame('Kept'));
  const damaged='{"format":9,"payload":"not a campaign"}',file=fakeFile(damaged),desk=createSaveStore({...env.options,mirror:file.mirror});
  const loaded=await desk.loadLocal();assert.equal(loaded.state?.name??null,chronicle?'Kept':null);assert.equal(file.text,damaged,'loading leaves the file to the next save');
  const item=(await desk.listUnreadableSaves()).find(entry=>entry.source==='file');
  assert.equal(await desk.readUnreadableSave(item.index),damaged,'the player downloads it first');
  assert.ok(await desk.discardUnreadableSave(item.checksum)>=1);
  assert.deepEqual(await desk.listUnreadableSaves(),[],'no copy is left in the archives');
  if(chronicle)assert.equal(JSON.parse(file.text).payload,env.idb.payload,'the file holds the chronicle now');
  else assert.equal(file.text,damaged,'with no chronicle to write, the file waits for the first save');
  const state=loaded.state??newGame('Fresh');await desk.saveLocal(state);
  assert.equal(JSON.parse(file.text).payload,serialize(state),'the save is written to the file');
  assert.deepEqual(await desk.listUnreadableSaves(),[],'and the discarded data is not archived again');
}));

test('DESK-15 a discarded damaged backup file is rotated out by writing the chronicle, and a relaunch finds nothing to archive',async()=>withPlatform(async env=>{
  const file=fakeFile();await createSaveStore({...env.options,mirror:file.mirror}).saveLocal(newGame('Kept'));
  // The bridge's backup rotation (desktop/saves.cjs): a write copies the current file to the backup unless keepPrevious.
  const damaged='{"format":9,"payload":"damaged backup"}';let previous=damaged;
  const mirror={read:async()=>file.text,readPrevious:async()=>previous,write:async(text,{keepPrevious=false}={})=>{if(!keepPrevious)previous=file.text;file.text=text;}};
  const desk=createSaveStore({...env.options,mirror});assert.equal((await desk.loadLocal()).state.name,'Kept');
  const item=(await desk.listUnreadableSaves()).find(entry=>entry.source==='file backup');
  assert.equal(await desk.readUnreadableSave(item.index),damaged,'the player downloads it first');
  assert.ok(await desk.discardUnreadableSave(item.checksum)>=2);
  assert.equal(JSON.parse(previous).payload,env.idb.payload,'the backup is the readable file now');
  assert.deepEqual(await desk.listUnreadableSaves(),[]);
  const relaunched=createSaveStore({...env.options,mirror});assert.equal((await relaunched.loadLocal()).state.name,'Kept');
  assert.deepEqual(await relaunched.listUnreadableSaves(),[]);
}));
