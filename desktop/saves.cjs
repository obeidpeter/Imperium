'use strict';
// Atomic desktop saves. A failed read is never absence, and a caller cannot replace a file
// changed since its read. Keep the last readable backup when repairing a damaged primary.
const fs=require('node:fs/promises');
const path=require('node:path');
const SAVE_NAME=/^[a-z0-9-]{1,40}$/,SAVE_LIMIT=16*1024*1024;
function createSaveFiles(directory){
  const fileFor=(name,previous=false)=>{if(!SAVE_NAME.test(String(name)))throw new Error('Invalid save name.');return path.join(directory(),`${name}${previous?'.prev':''}.json`);};
  const readFile=async file=>{try{return await fs.readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return null;throw error;}};
  let tail=Promise.resolve();
  async function write(name,text,options={}){
    if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>SAVE_LIMIT)throw new Error('Invalid save data.');
    const file=fileFor(name),previous=fileFor(name,true),temporary=`${file}.${process.pid}.tmp`;
    const guarded=Object.hasOwn(options,'expected');
    if(guarded&&options.expected!==null&&typeof options.expected!=='string')throw new Error('Invalid expected save.');
    const before=await readFile(file);
    if(guarded&&before!==options.expected)throw new Error('The save file changed; it has not been replaced.');
    await fs.mkdir(directory(),{recursive:true});
    try{
      const handle=await fs.open(temporary,'w');
      try{await handle.writeFile(text,'utf8');await handle.sync();}finally{await handle.close();}
      if(await readFile(file)!==before)throw new Error('The save file changed; it has not been replaced.');
      if(before!==null&&!options.keepPrevious)await fs.copyFile(file,previous);
      await fs.rename(temporary,file);
    }finally{await fs.unlink(temporary).catch(()=>{});}
  }
  return {read:(name,previous=false)=>readFile(fileFor(name,previous)),write:(name,text,options)=>{
    const result=tail.then(()=>write(name,text,options));tail=result.catch(()=>{});return result;
  }};
}
module.exports={createSaveFiles};
