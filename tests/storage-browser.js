import {createSaveStore} from '../src/ui/storage.js';
import {newGame,serialize} from '../src/core/game.js';

const params=new URLSearchParams(location.search),run=params.get('run')||Date.now().toString(36),role=params.get('role')||'controller';
if(!/^[a-z0-9-]{1,60}$/i.test(run))throw Error('Use a short alphanumeric run ID.');
const namespace='sacramentum-test.'+run;
const store=createSaveStore({namespace,useWebLocks:false,localStorage:null});
const channel=new BroadcastChannel(namespace+':harness'),requests=new Map(),results=[],notices=[];
let peerState=null,busy=false;
store.subscribeSaveChanges(data=>notices.push(data));
const status=document.querySelector('#status'),body=document.querySelector('#results');
document.querySelector('#context').textContent='Role: '+role+' · isolated database: '+namespace+' · '+navigator.userAgent;
const peer=new URL(location.href);peer.search='?run='+encodeURIComponent(run)+'&role=peer';document.querySelector('#peer').href=peer.href;
if(role==='peer'){document.querySelector('#controls').hidden=true;status.textContent='Peer ready. Leave this tab open while running the controller.';}
function record(name,pass,details){results.push({name,pass,details,at:new Date().toISOString()});const tr=document.createElement('tr');tr.className=pass?'pass':'fail';for(const value of [name,pass?'PASS':'FAIL',details]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);document.querySelector('#json').textContent=JSON.stringify({run,role,environment:navigator.userAgent,results},null,2);}
function assert(value,message){if(!value)throw Error(message);}
function peerRequest(action){const id=crypto.randomUUID();return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{requests.delete(id);reject(Error('Open the matching peer tab first; no reply within 8 seconds.'));},8000);requests.set(id,{resolve,reject,timeout});channel.postMessage({id,action,from:role});});}
channel.onmessage=async({data})=>{
  if(data.reply){const waiting=requests.get(data.reply);if(waiting){clearTimeout(waiting.timeout);requests.delete(data.reply);waiting.resolve(data.result);}return;}
  if(role!=='peer'||data.from==='peer')return;
  let result;
  try{
    if(data.action==='prepare'){peerState=(await store.loadLocal()).state;assert(peerState,'No test state to prepare.');result={ok:true,sequence:(await store.getSaveSession()).sequence};}
    else if(data.action==='write'){peerState.name='Race peer';await store.saveLocal(peerState);result={ok:true};}
    else if(data.action==='takeover'){const state=await store.takeOverSaveSession({confirmed:true});result={ok:true,name:state.name,sequence:(await store.getSaveSession()).sequence};}
    else if(data.action==='close'){await store.close();result={ok:true};}
  }catch(error){result={ok:false,code:error.code,message:error.message};}
  if(result){channel.postMessage({reply:data.id,result});record('Peer '+data.action,result.ok||result.code==='SAVE_CONFLICT',JSON.stringify(result));}
};
async function modifyRaw(mutator,abort=false){
  await new Promise((resolve,reject)=>{const opening=indexedDB.open(namespace,1);opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('saves','readwrite'),object=tx.objectStore('saves'),request=object.get('campaign');request.onsuccess=()=>{const value=structuredClone(request.result);mutator(value);object.put(value,'campaign');if(abort)tx.abort();};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();abort?resolve():reject(tx.error||Error('Unexpected abort'));};};});
}
const actions={
  async initialize(){await store.saveLocal(newGame('Isolated baseline'),{replace:true});record('Initialize',true,'Wrote only '+namespace);},
  async race(){
    await store.saveLocal(newGame('Race baseline'),{replace:true});const state=(await store.loadLocal()).state,initial=(await store.getSaveSession()).sequence;
    const prepared=await peerRequest('prepare');assert(prepared.ok&&prepared.sequence===initial,'Both tabs must load the same sequence before racing.');
    state.name='Race controller';const remote=peerRequest('write');let local;try{await store.saveLocal(state);local={ok:true};}catch(error){local={ok:false,code:error.code};}
    const other=await remote;assert([local,other].filter(r=>r.ok).length===1,'Exactly one concurrent writer must succeed.');assert([local,other].some(r=>r.code==='SAVE_CONFLICT'),'The other writer must receive SAVE_CONFLICT.');
    const loaded=await store.loadLocal(),after=await store.getSaveSession();assert(after.sequence===initial+1,'Sequence must advance exactly once.');record('Real two-tab IDB race',true,JSON.stringify({local,peer:other,sequence:after.sequence,winner:loaded.state.name}));
  },
  async takeover(){const stale=(await store.loadLocal()).state;assert(stale,'Initialize first.');const prior=notices.length,result=await peerRequest('takeover');assert(result.ok,'Peer takeover failed.');let code;try{await store.saveLocal(stale);}catch(error){code=error.code;}assert(code==='SAVE_CONFLICT','Old tab must not overwrite the takeover.');await new Promise(resolve=>setTimeout(resolve,100));assert(notices.length>prior,'IDB-only peer notification not received.');record('Explicit takeover / notification',true,'Peer reserved sequence '+result.sequence+'; stale controller rejected and BroadcastChannel notice received.');},
  async recovery(){
    for(const name of ['Checkpoint A','Checkpoint B','Checkpoint C','Checkpoint D'])await store.saveLocal(newGame(name),{replace:true});
    const history=await store.listRecoverySaves();assert(history.length===3&&history.map(e=>e.name).join(',')==='Checkpoint C,Checkpoint B,Checkpoint A','History must contain the last three distinct campaigns.');
    const selected=history[0],preview=await store.readRecoverySave(selected.id);assert(preview.name==='Checkpoint C','Preview must validate the selected state.');
    let refused=false;try{await store.restoreRecovery(selected.id);}catch{refused=true;}assert(refused,'Restoration must require explicit confirmation.');
    await store.restoreRecovery(selected.id,{confirmed:true,expectedSequence:selected.currentSequence});assert((await store.loadLocal()).state.name==='Checkpoint C','Confirmed history restoration failed.');
    await modifyRaw(value=>{value.checksum='intentional-test-corruption';});const damaged=await store.loadLocal();assert(damaged.state===null&&damaged.recoveryAvailable>0,'Corruption must expose history without silently rolling back.');
    const [recoverable]=await store.listRecoverySaves();await store.restoreRecovery(recoverable.id,{confirmed:true,expectedSequence:0});assert((await store.loadLocal()).state.name===recoverable.name,'Valid retained checkpoint did not recover.');
    record('Bounded history / corruption / explicit recovery',true,'Three distinct history entries; unconfirmed restoration refused; corrupted current record detected; selected validated history restored.');
  },
  async abort(){const before=(await store.loadLocal()).state;assert(before,'Initialize first.');await modifyRaw(value=>{value.payload='intentionally invalid';},true);const after=(await store.loadLocal()).state;assert(serialize(before)===serialize(after),'An aborted native transaction changed committed progress.');record('Native IndexedDB abort',true,'Explicitly aborted a real readwrite transaction; previous committed campaign remained exact. This is fault injection, not quota/OS testing.');},
  async 'prepare-reload'(){const state=newGame('Reload checkpoint');await store.saveLocal(state,{replace:true});sessionStorage.setItem(namespace+':expected',serialize(state));record('Reload preparation',true,'Click Reload; the new page will compare the real IDB save with this expected state.');},
  async reload(){location.reload();},
  async cleanup(){try{await peerRequest('close');}catch{}await store.close();assert(namespace.startsWith('sacramentum-test.'),'Refusing to delete a production database.');await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase(namespace);r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Close the peer tab and retry cleanup.'));});sessionStorage.removeItem(namespace+':expected');record('Cleanup',true,'Deleted only '+namespace+'. Reload with a new run ID for another test.');}
};
document.querySelector('#controls').addEventListener('click',async event=>{const action=actions[event.target.id];if(!action||busy)return;busy=true;status.textContent='Running '+event.target.id+'…';try{await action();status.textContent='Ready. Results are listed below.';}catch(error){record(event.target.id,false,error.message);status.textContent='Check failed: '+error.message;}finally{busy=false;}});
if(role!=='peer'){
  const expected=sessionStorage.getItem(namespace+':expected');
  if(expected){const loaded=await store.loadLocal();record('Reload restoration',Boolean(loaded.state&&serialize(loaded.state)===expected),loaded.state?'Restored '+loaded.state.name+' from real IndexedDB.':'No valid current test save.');}
  status.textContent='Ready. Initialize, open the peer link, then run each check in order.';
}
