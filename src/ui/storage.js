import {CONFIG} from '../config.js';
import {serialize,deserialize} from '../core/game.js';
import {desktopSaveMirror} from './platform.js';

const HISTORY_LIMIT=3;
const conflict=()=>Object.assign(new Error('A newer save exists in another tab. Reload or explicitly take over before continuing.'),{code:'SAVE_CONFLICT'});
const unavailable=()=>Object.assign(new Error('Safe browser storage is unavailable. Continue in memory and export a save code to keep this chronicle.'),{code:'SAVE_UNAVAILABLE'});
const preservationUnavailable=()=>Object.assign(new Error('The unreadable save could not be preserved, so it has not been replaced. Download it in Settings → Saves, then free storage and try again.'),{code:'SAVE_UNAVAILABLE'});
const fileUnavailable=()=>Object.assign(new Error('The save file could not be written. Progress is kept in the app; export a save code to keep a copy.'),{code:'SAVE_FILE_UNAVAILABLE'});
const fileUnreadable=()=>Object.assign(new Error('The save file cannot be read right now. It has not been replaced. Your local progress is kept; try saving again or export a save code.'),{code:'SAVE_FILE_UNAVAILABLE'});
const fileChanged=()=>Object.assign(new Error('The save file changed outside the game. Your local progress is kept. Reopen the game to load the file and review both copies in recovery records.'),{code:'SAVE_FILE_UNAVAILABLE'});
// A startup read failed with no file base on record: nothing shows whether the file changed, only that it was not checked.
const fileUnchecked=()=>Object.assign(new Error('The save file could not be read when the game started, so it has not been checked against your progress or replaced. Your local progress is kept. Reopen the game to load the file and review both copies in recovery records.'),{code:'SAVE_FILE_UNAVAILABLE'});
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
function rawObject(raw){try{return typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}}
function unpack(raw){try{const e=rawObject(raw);if(!e||e.format!==1||typeof e.payload!=='string'||e.checksum!==checksum(e.payload))return null;return {...e,state:deserialize(e.payload)};}catch{return null;}}
function localEnvelope(raw){const e=unpack(raw);return e&&Number.isSafeInteger(e.sequence)&&e.sequence>=0?e:null;}
function compact(e){const {state,recovery,...saved}=e;return saved;}
function fingerprint(e){return e?e.sequence+':'+e.checksum+':'+(e.writerId||'legacy'):'';}
function checkpoint(state){return JSON.stringify([state.chapter,state.phase,state.encounterIndex,state.encounter?.id||null,state.encounter?.status||null,Object.entries(state.decisions).sort(),state.oath]);}
function campaign(e){return e.campaignId||'legacy:'+e.state.seed+':'+e.state.name;}
function recoveryId(e){return e.id||e.sequence+':'+e.checksum;}
function historyKey(e){return e.recoveryKey||campaign(e)+':'+(e.checkpoint||checkpoint(e.state));}
function newest(values){return values.filter(Boolean).sort((a,b)=>b.sequence-a.sequence||String(b.savedAt||'').localeCompare(String(a.savedAt||''))||Number(b.fileBase===fingerprint(b))-Number(a.fileBase===fingerprint(a)))[0]||null;}
function historyFrom(raw){const values=rawObject(raw)?.recovery;return Array.isArray(values)?values.slice(0,HISTORY_LIMIT).map(localEnvelope).filter(Boolean):[];}
function mergedHistory(raws,extra=[],exclude=null){const candidates=[...extra,...raws.flatMap(historyFrom)].filter(Boolean).sort((a,b)=>Number(!!b.recoveryKey)-Number(!!a.recoveryKey)||b.sequence-a.sequence),seen=new Set(),payloads=new Set(),result=[];for(const e of candidates){const key=historyKey(e);if(exclude&&(key===historyKey(exclude)||e.payload===exclude.payload)||seen.has(key)||payloads.has(e.payload))continue;seen.add(key);payloads.add(e.payload);result.push(compact(e));if(result.length===HISTORY_LIMIT)break;}return result;}
const fileRecovery=(e,kind)=>({...e,recoveryKey:`file:${fingerprint(e)}`,recoveryKind:kind});
function fileText(envelope){const {fileBase,recoveryKey,recoveryKind,...saved}=envelope;return JSON.stringify(saved);}
function safeGlobal(name){try{return globalThis[name];}catch{return undefined;}}
// A stored record that no longer validates (damaged or from an incompatible
// edition) is set aside before any write replaces it, never silently dropped.
const QUARANTINE_LIMIT=2,QUARANTINE_LOCAL_LIMIT=1500000;
function rawText(raw){try{return typeof raw==='string'?raw:JSON.stringify(raw);}catch{return null;}}
function unreadable(raw){return raw!==null&&raw!==undefined&&raw!==''&&!localEnvelope(raw);}
function quarantined(value){return Array.isArray(value)?value.filter(item=>item?.type==='unreadable-save'&&typeof item.text==='string'&&typeof item.source==='string').slice(0,QUARANTINE_LIMIT):[];}
function withQuarantine(list,raw,source){const text=rawText(raw);if(!text||list.some(item=>item.text===text))return list;return [{type:'unreadable-save',source,preservedAt:new Date().toISOString(),bytes:text.length,checksum:checksum(text),text},...list].slice(0,QUARANTINE_LIMIT);}

/** Isolated stores are for development harnesses; normal app imports use the singleton below. */
export function createSaveStore(options={}){
  // These pre-Imperium IDs are a persistence protocol, not visible branding.
  // Keep the database, lock and channel shared with older open tabs and saves.
  const namespace=options.namespace||'',dbName=namespace||'sacramentum',key=namespace||CONFIG.saveKey;
  const idb='indexedDB'in options?options.indexedDB:safeGlobal('indexedDB');
  const ls='localStorage'in options?options.localStorage:safeGlobal('localStorage');
  const nav='navigator'in options?options.navigator:safeGlobal('navigator');
  const Channel='BroadcastChannel'in options?options.BroadcastChannel:safeGlobal('BroadcastChannel');
  // The desktop app's save file (platform.js desktopSaveMirror): {read(), write(text)}, both async. The file is what
  // Steam Cloud syncs and what a reinstall restores. A changed file is adopted with a recovery copy; a newer
  // pending local write wins against its unchanged file base. Every save attempts to write through.
  // The store itself (IndexedDB and localStorage in the app's own profile) keeps its locks, history and quarantine.
  const mirror='mirror'in options?options.mirror:null;
  const sessionId=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const takeoverToken=Symbol('confirmed takeover');
  let useLocks=options.useWebLocks!==false&&typeof nav?.locks?.request==='function';
  const lockName=namespace?namespace+':save':'sacramentum-save';
  const channelName=namespace?namespace+':changes':'sacramentum-save-changes';
  let dbPromise,sequence=0,observed='',campaignId=null,persistAsked=false,channel=null,closed=false,observedFile,deferredFileBase;
  const listeners=new Set();
  function localRaw(){try{return ls?.getItem(key)||null;}catch{return null;}}
  const quarantineKey=key+'.unreadable';
  function localQuarantine(){try{return quarantined(JSON.parse(ls?.getItem(quarantineKey)||'[]'));}catch{return [];}}
  function keepLocal(raw,source){if(!unreadable(raw))return true;const list=withQuarantine(localQuarantine(),raw,source);try{const text=JSON.stringify(list);if(ls&&text.length<=QUARANTINE_LOCAL_LIMIT){ls.setItem(quarantineKey,text);return true;}}catch{}return false;}
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
  async function mirrorRead(previous=false){
    if(!mirror||(previous&&typeof mirror.readPrevious!=='function'))return {kind:'missing',raw:null};
    try{const raw=await (previous?mirror.readPrevious():mirror.read());
      if(raw===null||raw===undefined)return {kind:'missing',raw:null};
      const envelope=localEnvelope(raw);return {kind:envelope?'valid':'invalid',raw,envelope};
    }catch{return {kind:'error'};}
  }
  async function preserveFile(raw,source='file'){
    const local=keepLocal(raw,source),db=await database();if(!db)return local;
    const kept=await new Promise(resolve=>{try{const tx=db.transaction('saves','readwrite'),s=tx.objectStore('saves'),r=s.get('unreadable');
      r.onsuccess=()=>s.put(withQuarantine(quarantined(r.result),raw,source),'unreadable');
      tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);tx.onerror=()=>{};
    }catch{resolve(false);}});return kept||local;
  }
  async function writeMirror(envelope,disk){
    if(!mirror)return true;
    if(disk.kind==='error')throw fileUnreadable();
    // A failed startup read has not adopted the file. Retry only against the last known base;
    // otherwise reopening must reconcile it and keep the local alternative before any replacement.
    if(deferredFileBase===null)throw fileUnchecked();
    if(deferredFileBase!==undefined&&(!['valid','missing'].includes(disk.kind)||deferredFileBase!==fingerprint(disk.envelope)))throw fileChanged();
    if(observedFile!==undefined&&disk.raw!==observedFile)throw fileChanged();
    if(disk.kind==='invalid'&&!await preserveFile(disk.raw))throw fileUnreadable();
    const text=fileText(envelope);
    try{await mirror.write(text,{expected:disk.raw,keepPrevious:disk.kind==='invalid'});observedFile=text;deferredFileBase=undefined;}catch{return false;}
    await markFileSynced(envelope);return true;
  }
  async function markFileSynced(envelope){
    // Acknowledge only this revision, without replacing a later save or its recovery records.
    // Persisting the acknowledgement distinguishes a cloud rollback from a failed local write.
    const expected=fingerprint(envelope),db=await database();
    if(db)await new Promise(resolve=>{try{const tx=db.transaction('saves','readwrite'),s=tx.objectStore('saves'),r=s.get('campaign');
      r.onsuccess=()=>{const current=localEnvelope(r.result);if(current&&fingerprint(current)===expected)s.put({...rawObject(r.result),fileBase:expected},'campaign');};
      tx.oncomplete=()=>resolve();tx.onabort=()=>resolve();tx.onerror=()=>{};
    }catch{resolve();}});
    try{const raw=localRaw(),current=localEnvelope(raw);if(current&&fingerprint(current)===expected)ls?.setItem(key,JSON.stringify({...rawObject(raw),fileBase:expected}));}catch{}
  }
  // Put an envelope as the store's current record as it is (adopting the file): no new sequence, writer or history.
  async function putEnvelope(envelope){
    // Adopting a desktop file must preserve unreadable profile records too.
    const raws=await records();
    for(const [index,raw] of raws.entries())if(unreadable(raw)&&!await preserveFile(raw,index?'indexedDB':'localStorage'))return false;
    const db=await database();
    let kept=false;
    if(db)kept=await new Promise(resolve=>{try{const tx=db.transaction('saves','readwrite');tx.objectStore('saves').put(envelope,'campaign');tx.oncomplete=()=>resolve(true);tx.onabort=()=>resolve(false);tx.onerror=()=>{};}catch{resolve(false);}});
    try{if(ls){ls.setItem(key,JSON.stringify(envelope));kept=true;}}catch{}
    return kept;
  }
  // Reconcile file and local progress without mistaking a failed write for a cloud update.
  // Corrupt files are set aside; temporary read errors leave the file untouched.
  async function adoptMirror(){
    if(!mirror)return {};
    const disk=await mirrorRead(),raws=await records(),current=newest(raws.map(localEnvelope));
    if(disk.kind==='error'){
      if(observedFile===undefined&&deferredFileBase===undefined)deferredFileBase=current?.fileBase??null;
      return {fileProblem:fileUnreadable().message};
    }
    observedFile=disk.raw;deferredFileBase=undefined;
    const previous=await mirrorRead(true),backup=previous.envelope;
    if(disk.kind==='invalid')await preserveFile(disk.raw);
    if(previous.kind==='invalid')await preserveFile(previous.raw,'file backup');
    const file=disk.envelope;
    // A pending local write wins only against the exact file it was based on. A changed cloud file
    // still wins, with the displaced local payload preserved even within the same checkpoint.
    const pending=current&&typeof current.fileBase==='string'&&current.fileBase===fingerprint(file)&&fingerprint(current)!==fingerprint(file);
    const selected=pending?current:file||current||backup;
    if(!selected)return disk.kind==='invalid'?{fileProblem:'The save file is damaged or incompatible. Restore a save code or start a new chronicle; the original file is preserved.'}:{};
    const alternatives=[];
    if(file&&current&&selected===file&&file.payload!==current.payload)alternatives.push(fileRecovery(current,'Local copy before file recovery'));
    if(backup&&backup.payload!==selected.payload)alternatives.push(fileRecovery(backup,'Previous save file'));
    const {state:_state,...saved}=selected;
    const adopted={...saved,recovery:mergedHistory([disk.raw,...raws],alternatives,selected)};
    if(!await putEnvelope(adopted))return {fileProblem:'The save file could not be loaded into local storage. Its original copy has not been changed.'};
    const warning=pending?'Recovered local progress that had not reached the save file.':!file&&selected===backup?'Recovered the previous save file.':alternatives.some(e=>e.recoveryKind.startsWith('Local'))?'Loaded the changed save file. Your other local progress is available in recovery records.':null;
    if(disk.kind==='invalid')return {warning,fileProblem:'The current save file is damaged. Your recovered progress is available; the original will be preserved when you save.'};
    if(pending||disk.kind==='missing'){
      try{if(!await writeMirror(adopted,disk))return {warning,fileProblem:fileUnavailable().message};}
      catch(error){return {warning,fileProblem:error.message};}
    }
    return {warning};
  }
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
    if(mirror)next.fileBase=settings.fileBase??current?.fileBase??'';
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
        tx=db.transaction('saves','readwrite');const store=tx.objectStore('saves'),request=store.get('campaign'),held=store.get('unreadable');
        // Requests complete in issue order. Wait for the archive read as well:
        // native IDBRequest.result throws while that request is still pending.
        held.onsuccess=()=>{
          try{
            next=prepareEnvelope(payload,[localRaw(),request.result||null],settings);
            // Preserve an unreadable record in the same transaction, before it is replaced.
            if(unreadable(request.result))store.put(withQuarantine(quarantined(held.result),request.result,'indexedDB'),'unreadable');
            store.put(next,'campaign');
          }
          catch(error){rejection=error;try{tx.abort();}catch{reject(error);}}
        };
        request.onerror=held.onerror=()=>{try{tx.abort();}catch{resolve(null);}};
        tx.oncomplete=()=>resolve(next||null);
        tx.onabort=()=>rejection?reject(rejection):resolve(null);
        tx.onerror=()=>{}; // onabort is the terminal failure signal.
      }catch(error){if(error.code==='SAVE_CONFLICT')reject(error);else{dbPromise=null;resolve(null);}}
    });
  }
  async function loadLocal(){
    const fileStatus=await adoptMirror();
    const raws=await records(),current=newest(raws.map(localEnvelope)),recoveries=mergedHistory(raws);
    if(current){adopt(current);return {state:current.state,error:null,recoveryAvailable:recoveries.length,...fileStatus};}
    return {state:null,error:raws.some(Boolean)?'The current chronicle is damaged or incompatible. Review recovery checkpoints or restore a save code.':null,recoveryAvailable:recoveries.length,...fileStatus};
  }
  async function saveLocal(state,settings={}){
    // Capture and validate before asynchronous persistence; never mutate caller state.
    const payload=serialize(state);deserialize(payload);
    const write=async(locked=false)=>{
      const disk=mirror?await mirrorRead():null;
      const saveSettings={...settings};
      // On a read failure retain the last known base, and save locally before reporting the file problem.
      if(mirror&&deferredFileBase!==undefined){if(typeof deferredFileBase==='string')saveSettings.fileBase=deferredFileBase;}
      else if(mirror&&disk.kind!=='error'&&(observedFile===undefined||observedFile===disk.raw))saveSettings.fileBase=fingerprint(disk.envelope);
      else if(mirror&&observedFile!==undefined)saveSettings.fileBase=fingerprint(localEnvelope(observedFile));
      // Archive first, using IndexedDB if the local archive is too large or full.
      // A failed archive must never turn the only unreadable copy into a new save.
      const local=localRaw();
      if(unreadable(local)&&!await preserveFile(local,'localStorage'))throw preservationUnavailable();
      let next=await atomicIDB(payload,saveSettings);
      if(!next){
        // localStorage has no cross-tab compare-and-swap. Never pretend it is safe without a lock.
        if(!locked)throw unavailable();
        next=prepareEnvelope(payload,await records(),saveSettings);
        try{if(!ls)throw unavailable();ls.setItem(key,JSON.stringify(next));}catch{throw unavailable();}
      }else{
        // History and current payload are mirrored in one atomic localStorage value.
        try{ls?.setItem(key,JSON.stringify(next));}catch{}
      }
      adopt({...next,state:deserialize(next.payload)});broadcast(next);
      if(!persistAsked){persistAsked=true;try{nav?.storage?.persist?.().catch(()=>{});}catch{}}
      // The store has the save; the file must have it too, or Steam Cloud and a reinstall would not.
      if(!await writeMirror(next,disk))throw fileUnavailable();
      return next.savedAt;
    };
    if(!useLocks)return write(false);
    let entered=false;
    try{return await nav.locks.request(lockName,()=>{entered=true;return write(true);});}
    catch(error){if(entered)throw error;useLocks=false;return write(false);}
  }
  async function listRecoverySaves(){
    const raws=await records(),current=newest(raws.map(localEnvelope));
    return mergedHistory(raws).map(saved=>{const e=localEnvelope(saved);return {id:recoveryId(e),name:e.state.name,chapter:e.state.chapter,rank:e.state.rank,phase:e.state.phase,encounter:e.state.encounter?.title||null,savedAt:e.savedAt,sequence:e.sequence,currentSequence:current?.sequence||0,source:e.recoveryKind||null};});
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
  // Unreadable records set aside before a write, newest first, for export.
  async function listUnreadableSaves(){
    let stored=[];const db=await database();
    if(db)stored=await new Promise(resolve=>{try{const tx=db.transaction('saves'),r=tx.objectStore('saves').get('unreadable');r.onsuccess=()=>resolve(quarantined(r.result));r.onerror=()=>resolve([]);tx.onabort=()=>resolve([]);}catch{resolve([]);}});
    const seen=new Set(),list=[];for(const item of [...stored,...localQuarantine()])if(!seen.has(item.text)){seen.add(item.text);list.push(item);}
    // A live record that fails validation is also offered, so nothing needs a write first.
    for(const [raw,source]of [[localRaw(),'localStorage'],[await idbRaw(),'indexedDB']]){const text=unreadable(raw)?rawText(raw):null;if(text&&!seen.has(text)){seen.add(text);list.unshift({type:'unreadable-save',source,preservedAt:null,bytes:text.length,checksum:checksum(text),text});}}
    return list.map(({text,...item},index)=>({...item,index}));
  }
  async function readUnreadableSave(index){
    const list=await listUnreadableSaves(),item=list.find(entry=>entry.index===index);if(!item)throw new Error('That preserved record is unavailable.');
    const db=await database();let stored=[];
    if(db)stored=await new Promise(resolve=>{try{const r=db.transaction('saves').objectStore('saves').get('unreadable');r.onsuccess=()=>resolve(quarantined(r.result));r.onerror=()=>resolve([]);}catch{resolve([]);}});
    const live=[[localRaw(),'localStorage'],[await idbRaw(),'indexedDB']].filter(([raw])=>unreadable(raw)).map(([raw,source])=>({source,text:rawText(raw),checksum:checksum(rawText(raw))}));
    const match=[...live,...stored,...localQuarantine()].find(entry=>entry.checksum===item.checksum);
    if(!match)throw new Error('That preserved record is unavailable.');return match.text;
  }
  function subscribeSaveChanges(listener){listeners.add(listener);listen();return()=>listeners.delete(listener);}
  async function close(){closed=true;channel?.close();channel=null;const db=await dbPromise;db?.close?.();listeners.clear();}
  return {loadLocal,saveLocal,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,getSaveSession,subscribeSaveChanges,listUnreadableSaves,readUnreadableSave,close};
}
const defaultStore=createSaveStore({mirror:desktopSaveMirror()});
export const {loadLocal,saveLocal,listRecoverySaves,readRecoverySave,restoreRecovery,takeOverSaveSession,getSaveSession,subscribeSaveChanges,listUnreadableSaves,readUnreadableSave}=defaultStore;
// SAC1/SAC1J identify the portable format; retain both across the Imperium rename.
export async function saveCode(state){const payload=serialize(state);const raw=new TextEncoder().encode(JSON.stringify({format:1,payload,checksum:checksum(payload)}));let bytes=raw,prefix='SAC1J.';if(globalThis.CompressionStream){bytes=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());prefix='SAC1.';}let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return prefix+btoa(binary);}
export async function restoreCode(code){const text=code.trim();if(text.length>3000000)throw new Error('Save code is too large.');if(text.startsWith('{'))return deserialize(text);let bytes;try{const parts=text.split('.');if(!['SAC1','SAC1J'].includes(parts[0])||parts.length!==2)throw new Error();bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));if(parts[0]==='SAC1'){if(!globalThis.DecompressionStream)throw new Error('This browser cannot read compressed save codes. Use a recent browser.');const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();const chunks=[];let total=0;for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>2000000){await reader.cancel();throw new Error('Expanded save exceeds the size limit.');}chunks.push(value);}bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}}const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const parsed=JSON.parse(decoded);if(parsed.format===1){const checked=unpack(parsed);if(!checked)throw new Error('Checksum or save validation failed.');return checked.state;}return deserialize(decoded);}catch(error){throw new Error(error.message?.includes('browser')?error.message:'This save code is invalid or incompatible. Your existing chronicle has not been changed.');}}


