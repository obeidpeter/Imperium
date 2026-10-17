import {CONFIG} from '../config.js';
import {serialize,deserialize} from '../core/game.js';

const HISTORY_LIMIT=3;
const conflict=()=>Object.assign(new Error('A newer save exists in another tab. Reload or explicitly take over before continuing.'),{code:'SAVE_CONFLICT'});
const unavailable=()=>Object.assign(new Error('Safe browser storage is unavailable. Continue in memory and export a save code to keep this chronicle.'),{code:'SAVE_UNAVAILABLE'});
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
function rawObject(raw){try{return typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}}
function unpack(raw){try{const e=rawObject(raw);if(!e||e.format!==1||typeof e.payload!=='string'||e.checksum!==checksum(e.payload))return null;return {...e,state:deserialize(e.payload)};}catch{return null;}}
function localEnvelope(raw){const e=unpack(raw);return e&&Number.isSafeInteger(e.sequence)&&e.sequence>=0?e:null;}
function compact(e){const {state,recovery,...saved}=e;return saved;}
function fingerprint(e){return e?e.sequence+':'+e.checksum+':'+(e.writerId||'legacy'):'';}
function checkpoint(state){return JSON.stringify([state.chapter,state.phase,state.encounterIndex,state.encounter?.id||null,state.encounter?.status||null,Object.entries(state.decisions).sort(),state.oath]);}
function campaign(e){return e.campaignId||'legacy:'+e.state.seed+':'+e.state.name;}
function recoveryId(e){return e.id||e.sequence+':'+e.checksum;}
function historyKey(e){return campaign(e)+':'+(e.checkpoint||checkpoint(e.state));}
function newest(values){return values.filter(Boolean).sort((a,b)=>b.sequence-a.sequence||String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0]||null;}
function historyFrom(raw){const values=rawObject(raw)?.recovery;return Array.isArray(values)?values.slice(0,HISTORY_LIMIT).map(localEnvelope).filter(Boolean):[];}
function mergedHistory(raws,extra=[],exclude=null){const candidates=[...extra,...raws.flatMap(historyFrom)].filter(Boolean).sort((a,b)=>b.sequence-a.sequence),seen=new Set(),result=[];for(const e of candidates){const key=historyKey(e);if(exclude&&(key===historyKey(exclude)||e.payload===exclude.payload)||seen.has(key))continue;seen.add(key);result.push(compact(e));if(result.length===HISTORY_LIMIT)break;}return result;}
function safeGlobal(name){try{return globalThis[name];}catch{return undefined;}}

/** Isolated stores are for development harnesses; normal app imports use the singleton below. */
export function createSaveStore(options={}){
  // These pre-Imperium IDs are a persistence protocol, not visible branding.
  // Keep the database, lock and channel shared with older open tabs and saves.
  const namespace=options.namespace||'',dbName=namespace||'sacramentum',key=namespace||CONFIG.saveKey;
  const idb='indexedDB'in options?options.indexedDB:safeGlobal('indexedDB');
  const ls='localStorage'in options?options.localStorage:safeGlobal('localStorage');
  const nav='navigator'in options?options.navigator:safeGlobal('navigator');
  const Channel='BroadcastChannel'in options?options.BroadcastChannel:safeGlobal('BroadcastChannel');
  const sessionId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const takeoverToken=Symbol('confirmed takeover');
  let useLocks=options.useWebLocks!==false&&typeof nav?.locks?.request==='function';
  const lockName=namespace?namespace+':save':'sacramentum-save';
  const channelName=namespace?namespace+':changes':'sacramentum-save-changes';
  let dbPromise,sequence=0,observed='',campaignId=null,persistAsked=false,channel=null,closed=false;
  const listeners=new Set();
  function localRaw(){try{return ls?.getItem(key)||null;}catch{return null;}}
  async function database(){
    if(!idb||closed)return null;
    return dbPromise??=new Promise(resolve=>{try{
      const r=idb.open(dbName,1);
      r.onupgradeneeded=()=>{if(!r.result.objectStoreNames?.contains('saves'))r.result.createObjectStore('saves');};
      r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();dbPromise=null;};resolve(db);};
      r.onerror=()=>{dbPromise=null;resolve(null);};r.onblocked=()=>{dbPromise=null;resolve(null);};
    }catch{dbPromise=null;resolve(null);}});
  }
  async function idbRaw(){
    const db=await database();if(!db)return null;
    return new Promise(resolve=>{try{const tx=db.transaction('saves'),r=tx.objectStore('saves').get('campaign');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);tx.onabort=()=>resolve(null);}catch{dbPromise=null;resolve(null);}});
  }
  async function records(){return [localRaw(),await idbRaw()];}
  function adopt(e){sequence=e.sequence;observed=fingerprint(e);campaignId=campaign(e);}
  function listen(){
    if(channel||!Channel||closed)return;
    try{channel=new Channel(channelName);channel.onmessage=event=>{const data=event.data;if(data?.type==='saved'&&data.writerId!==sessionId)for(const listener of listeners)listener(data);};channel.unref?.();}catch{}
  }
  function broadcast(e){listen();try{channel?.postMessage({type:'saved',sequence:e.sequence,writerId:sessionId,savedAt:e.savedAt});}catch{}}
  function assertCurrent(latest,{replace=false,expectedSequence,takeover}={}){
    if(expectedSequence!==undefined&&(latest?.sequence||0)!==expectedSequence)throw conflict();
    if(!replace&&takeover!==takeoverToken&&latest&&(latest.sequence>sequence||(latest.sequence===sequence&&observed&&fingerprint(latest)!==observed)))throw conflict();
  }
  function prepareEnvelope(payload,raws,settings){
    const current=newest(raws.map(localEnvelope));assertCurrent(current,settings);
    const state=deserialize(payload),freshCampaign=settings.replace||!campaignId;
    const nextCampaign=settings.takeover===takeoverToken?campaign(current):freshCampaign?sessionId+':'+Date.now()+':'+(current?.sequence||0):(campaignId||campaign(current));
    const next={format:1,sequence:Math.max(sequence,current?.sequence||0,...raws.flatMap(historyFrom).map(e=>e.sequence))+1,
      checksum:checksum(payload),savedAt:new Date().toISOString(),payload,writerId:sessionId,campaignId:nextCampaign,checkpoint:checkpoint(state)};
    next.id=next.sequence+':'+next.checksum+':'+sessionId;
    const previous=raws.map(localEnvelope).filter(Boolean);
    // One representative per checkpoint, never three adjacent turn autosaves.
    next.recovery=mergedHistory(raws,previous,next);
    return next;
  }
  async function atomicIDB(payload,settings){
    const db=await database();if(!db)return null;
    return new Promise((resolve,reject)=>{
      let tx,next,rejection=null;
      try{
        tx=db.transaction('saves','readwrite');const store=tx.objectStore('saves'),request=store.get('campaign');
        request.onsuccess=()=>{
          try{next=prepareEnvelope(payload,[localRaw(),request.result||null],settings);store.put(next,'campaign');}
          catch(error){rejection=error;try{tx.abort();}catch{reject(error);}}
        };
        request.onerror=()=>{try{tx.abort();}catch{resolve(null);}};
        tx.oncomplete=()=>resolve(next||null);
        tx.onabort=()=>rejection?reject(rejection):resolve(null);
        tx.onerror=()=>{}; // onabort is the terminal failure signal.
      }catch(error){if(error.code==='SAVE_CONFLICT')reject(error);else{dbPromise=null;resolve(null);}}
    });
  }
  async function loadLocal(){
    const raws=await records(),current=newest(raws.map(localEnvelope)),recoveries=mergedHistory(raws);
    if(current){adopt(current);return {state:current.state,error:null,recoveryAvailable:recoveries.length};}
    return {state:null,error:raws.some(Boolean)?'The current chronicle is damaged or incompatible. Review recovery checkpoints or restore a save code.':null,recoveryAvailable:recoveries.length};
  }
  async function saveLocal(state,settings={}){
    // Capture and validate before asynchronous persistence; never mutate caller state.
    const payload=serialize(state);deserialize(payload);
    const write=async(locked=false)=>{
      let next=await atomicIDB(payload,settings);
      if(!next){
        // localStorage has no cross-tab compare-and-swap. Never pretend it is safe without a lock.
        if(!locked)throw unavailable();
        next=prepareEnvelope(payload,await records(),settings);
        try{if(!ls)throw unavailable();ls.setItem(key,JSON.stringify(next));}catch{throw unavailable();}
      }else{
        // History and current payload are mirrored in one atomic localStorage value.
        try{ls?.setItem(key,JSON.stringify(next));}catch{}
      }
      adopt({...next,state:deserialize(next.payload)});broadcast(next);
      if(!persistAsked){persistAsked=true;try{nav?.storage?.persist?.().catch(()=>{});}catch{}}
      return next.savedAt;
    };
    if(!useLocks)return write(false);
    let entered=false;
    try{return await nav.locks.request(lockName,()=>{entered=true;return write(true);});}
    catch(error){if(entered)throw error;useLocks=false;return write(false);}
  }
  async function listRecoverySaves(){
    const raws=await records(),current=newest(raws.map(localEnvelope));
    return mergedHistory(raws).map(saved=>{const e=localEnvelope(saved);return {id:recoveryId(e),name:e.state.name,chapter:e.state.chapter,rank:e.state.rank,phase:e.state.phase,encounter:e.state.encounter?.title||null,savedAt:e.savedAt,sequence:e.sequence,currentSequence:current?.sequence||0};});
  }
  async function readRecoverySave(id){
    const saved=mergedHistory(await records()).find(e=>recoveryId(e)===id);
    if(!saved)throw new Error('That recovery checkpoint is unavailable or failed validation.');
    return deserialize(saved.payload);
  }
  async function restoreRecovery(id,{confirmed=false,expectedSequence}={}){
    if(!confirmed)throw new Error('Confirm replacement before restoring a recovery checkpoint.');
    const state=await readRecoverySave(id);await saveLocal(state,{replace:true,expectedSequence});return state;
  }
  async function takeOverSaveSession({confirmed=false}={}){
    if(!confirmed)throw new Error('Confirm takeover before replacing this tab’s in-memory campaign.');
    // Reading a candidate must not acknowledge its revision before the takeover commits.
    // If persistence fails, this tab's old in-memory state must still fail stale-write checks.
    const current=newest((await records()).map(localEnvelope));
    if(!current)throw new Error('No valid current chronicle is available to take over.');
    await saveLocal(current.state,{expectedSequence:current.sequence,takeover:takeoverToken});
    return current.state;
  }
  async function getSaveSession(){
    const current=newest((await records()).map(localEnvelope));
    return {sequence:current?.sequence||0,writerId:current?.writerId||null,isCurrent:!current||fingerprint(current)===observed,atomicIndexedDB:Boolean(await database()),webLocks:useLocks};
  }
  function subscribeSaveChanges(listener){listeners.add(listener);listen();return()=>listeners.delete(listener);}
  async function close(){closed=true;channel?.close();channel=null;const db=await dbPromise;db?.close?.();listeners.clear();}
  return {loadLocal,saveLocal,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,getSaveSession,subscribeSaveChanges,close};
}
const defaultStore=createSaveStore();
export const {loadLocal,saveLocal,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,getSaveSession,subscribeSaveChanges}=defaultStore;
// SAC1/SAC1J identify the portable format; retain both across the Imperium rename.
export async function saveCode(state){const payload=serialize(state);const raw=new TextEncoder().encode(JSON.stringify({format:1,payload,checksum:checksum(payload)}));let bytes=raw,prefix='SAC1J.';if(globalThis.CompressionStream){bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());prefix='SAC1.';}let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return prefix+btoa(binary);}
export async function restoreCode(code){const text=code.trim();if(text.length>3000000)throw new Error('Save code is too large.');if(text.startsWith('{'))return deserialize(text);let bytes;try{const parts=text.split('.');if(!['SAC1','SAC1J'].includes(parts[0])||parts.length!==2)throw new Error();bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));if(parts[0]==='SAC1'){if(!globalThis.DecompressionStream)throw new Error('This browser cannot read compressed save codes. Use a recent browser.');const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2000000){await reader.cancel();throw new Error('Expanded save exceeds the size limit.');}chunks.push(value);}bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}}const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const parsed=JSON.parse(decoded);if(parsed.format===1){const checked=unpack(parsed);if(!checked)throw new Error('Checksum or save validation failed.');return checked.state;}return deserialize(decoded);}catch(error){throw new Error(error.message?.includes('browser')?error.message:'This save code is invalid or incompatible. Your existing chronicle has not been changed.');}}

