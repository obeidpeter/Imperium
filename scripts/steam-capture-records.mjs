// A capture and its evidence are one recoverable transaction. If interrupted
// between renames, the journal completes the pair before any further capture.
// Two kinds of capture share it: the screenshots (an image each) and the trailer (a video each).
import * as fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';

// Where each kind keeps its files and its record, and what the record calls a file's digest and size.
export const CAPTURE_KINDS=Object.freeze({
  screenshot:Object.freeze({name:'screenshot',record:'docs/evidence/steam-screenshots.json',list:'screenshots',dir:'desktop/steam/screenshots',ext:'jpg',digest:'imageSha256',bytes:'imageBytes'}),
  trailer:Object.freeze({name:'trailer',record:'docs/evidence/steam-trailer.json',list:'trailers',dir:'desktop/steam/trailer',ext:'mp4',digest:'videoSha256',bytes:'videoBytes'}),
});
const SCREENSHOT=CAPTURE_KINDS.screenshot;
export const CAPTURE_RECORD=SCREENSHOT.record;
export const imageDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const journal=kind=>kind.record+'.pending';
const titled=kind=>kind.name[0].toUpperCase()+kind.name.slice(1);
const capturePath=(kind,entry)=>{
  if(!/^[a-z0-9-]+$/.test(entry.id)||entry.file!==`${kind.dir}/${entry.id}.${kind.ext}`)throw Error(`Invalid ${kind.name} path.`);
  return entry.file;
};
async function atomicWrite(path,bytes,io){
  await io.mkdir(dirname(path),{recursive:true});
  const temp=path+'.'+randomUUID()+'.tmp';
  try{await io.writeFile(temp,bytes);await io.rename(temp,path);}finally{await io.rm(temp,{force:true});}
}
export async function readCaptureRecord(root,kind=SCREENSHOT,io=fs){
  try{return JSON.parse(await io.readFile(join(root,kind.record),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function recoverCapture(root,kind=SCREENSHOT,io=fs){
  let pending;
  try{pending=JSON.parse(await io.readFile(join(root,journal(kind)),'utf8'));}
  catch(error){if(error.code==='ENOENT')return false;throw error;}
  const entry=pending.record?.[kind.list]?.find(s=>s.id===pending.id);
  if(!entry||!/^[a-f0-9]{64}$/.test(entry[kind.digest]))throw Error(`Invalid ${kind.name} recovery record.`);
  const path=join(root,capturePath(kind,entry)),staged=path+'.pending';
  let bytes;
  try{bytes=await io.readFile(staged);}catch(error){if(error.code!=='ENOENT')throw error;bytes=await io.readFile(path);}
  if(imageDigest(bytes)!==entry[kind.digest]||bytes.length!==entry[kind.bytes])throw Error(`${titled(kind)} recovery hash mismatch; files have been retained.`);
  try{await io.rename(staged,path);}catch(error){if(error.code!=='ENOENT')throw error;}
  await atomicWrite(join(root,kind.record),JSON.stringify(pending.record,null,2)+'\n',io);
  await io.rm(join(root,journal(kind)));return true;
}
export async function writeCapture(root,kind,record,entry,bytes,io=fs){
  if(await recoverCapture(root,kind,io))record=await readCaptureRecord(root,kind,io);
  const path=join(root,capturePath(kind,entry));
  const completed={...entry,[kind.digest]:imageDigest(bytes),[kind.bytes]:bytes.length};
  const next={...record,[kind.list]:(record[kind.list]??[]).filter(s=>s.id!==entry.id).concat(completed).sort((a,b)=>a.id.localeCompare(b.id))};
  await atomicWrite(path+'.pending',bytes,io);
  await atomicWrite(join(root,journal(kind)),JSON.stringify({id:entry.id,record:next},null,2)+'\n',io);
  await recoverCapture(root,kind,io);return next;
}
// The screenshots' own names (scripts/steam-screenshots.mjs).
export const readScreenshotRecord=(root,io=fs)=>readCaptureRecord(root,SCREENSHOT,io);
export const recoverScreenshots=(root,io=fs)=>recoverCapture(root,SCREENSHOT,io);
export const writeScreenshot=(root,record,entry,bytes,io=fs)=>writeCapture(root,SCREENSHOT,record,entry,bytes,io);
// Hold one writer across the run. Never reclaim an existing lock automatically:
// two starters can both observe a dead PID, then one can unlink the other's
// newly acquired lock. Manual removal requires checking that no capture runs.
export async function withCaptureLock(root,run,kind=SCREENSHOT){
  const path=join(root,kind.record+'.lock');await fs.mkdir(dirname(path),{recursive:true});
  let handle;
  try{handle=await fs.open(path,'wx');}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    const recovery=`Verify that no ${kind.name} capture process is running, then remove ${path} and retry (or run --recover).`;
    const pid=Number(await fs.readFile(path,'utf8'));
    if(!Number.isSafeInteger(pid)||pid<=0)throw Error(`Invalid capture lock. ${recovery}`);
    try{process.kill(pid,0);}
    catch(check){
      if(check.code==='ESRCH')throw Error(`Stale ${kind.name} capture lock (PID ${pid}). ${recovery}`);
      throw Error(`Cannot verify ${kind.name} capture lock (PID ${pid}). ${recovery}`);
    }
    throw Error(`${titled(kind)} capture is already running (PID ${pid}).`);
  }
  try{await handle.writeFile(String(process.pid));return await run();}
  finally{await handle.close();await fs.rm(path,{force:true});}
}
