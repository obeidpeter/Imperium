// A capture and its evidence are one recoverable transaction. If interrupted
// between renames, the journal completes the pair before any further capture.
import * as fs from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';

export const CAPTURE_RECORD='docs/evidence/steam-screenshots.json';
const JOURNAL=CAPTURE_RECORD+'.pending';
export const imageDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const imagePath=entry=>{
  if(!/^[a-z0-9-]+$/.test(entry.id)||entry.file!==`desktop/steam/screenshots/${entry.id}.jpg`)throw Error('Invalid screenshot path.');
  return entry.file;
};
async function atomicWrite(path,bytes,io){
  await io.mkdir(dirname(path),{recursive:true});
  const temp=path+'.'+randomUUID()+'.tmp';
  try{await io.writeFile(temp,bytes);await io.rename(temp,path);}finally{await io.rm(temp,{force:true});}
}
export async function readScreenshotRecord(root,io=fs){
  try{return JSON.parse(await io.readFile(join(root,CAPTURE_RECORD),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}
export async function recoverScreenshots(root,io=fs){
  let pending;
  try{pending=JSON.parse(await io.readFile(join(root,JOURNAL),'utf8'));}
  catch(error){if(error.code==='ENOENT')return false;throw error;}
  const entry=pending.record?.screenshots?.find(s=>s.id===pending.id);
  if(!entry||!/^[a-f0-9]{64}$/.test(entry.imageSha256))throw Error('Invalid screenshot recovery record.');
  const path=join(root,imagePath(entry)),staged=path+'.pending';
  let bytes;
  try{bytes=await io.readFile(staged);}catch(error){if(error.code!=='ENOENT')throw error;bytes=await io.readFile(path);}
  if(imageDigest(bytes)!==entry.imageSha256||bytes.length!==entry.imageBytes)throw Error('Screenshot recovery hash mismatch; files have been retained.');
  try{await io.rename(staged,path);}catch(error){if(error.code!=='ENOENT')throw error;}
  await atomicWrite(join(root,CAPTURE_RECORD),JSON.stringify(pending.record,null,2)+'\n',io);
  await io.rm(join(root,JOURNAL));return true;
}
export async function writeScreenshot(root,record,entry,bytes,io=fs){
  if(await recoverScreenshots(root,io))record=await readScreenshotRecord(root,io);
  const path=join(root,imagePath(entry));
  const completed={...entry,imageSha256:imageDigest(bytes),imageBytes:bytes.length};
  const next={...record,screenshots:record.screenshots.filter(s=>s.id!==entry.id).concat(completed).sort((a,b)=>a.id.localeCompare(b.id))};
  await atomicWrite(path+'.pending',bytes,io);
  await atomicWrite(join(root,JOURNAL),JSON.stringify({id:entry.id,record:next},null,2)+'\n',io);
  await recoverScreenshots(root,io);return next;
}
// Hold one writer across the run. Never reclaim an existing lock automatically:
// two starters can both observe a dead PID, then one can unlink the other's
// newly acquired lock. Manual removal requires checking that no capture runs.
export async function withCaptureLock(root,run){
  const path=join(root,CAPTURE_RECORD+'.lock');await fs.mkdir(dirname(path),{recursive:true});
  let handle;
  try{handle=await fs.open(path,'wx');}
  catch(error){
    if(error.code!=='EEXIST')throw error;
    const recovery=`Verify that no screenshot capture process is running, then remove ${path} and retry (or run --recover).`;
    const pid=Number(await fs.readFile(path,'utf8'));
    if(!Number.isSafeInteger(pid)||pid<=0)throw Error(`Invalid capture lock. ${recovery}`);
    try{process.kill(pid,0);}
    catch(check){
      if(check.code==='ESRCH')throw Error(`Stale screenshot capture lock (PID ${pid}). ${recovery}`);
      throw Error(`Cannot verify screenshot capture lock (PID ${pid}). ${recovery}`);
    }
    throw Error(`Screenshot capture is already running (PID ${pid}).`);
  }
  try{await handle.writeFile(String(process.pid));return await run();}
  finally{await handle.close();await fs.rm(path,{force:true});}
}
