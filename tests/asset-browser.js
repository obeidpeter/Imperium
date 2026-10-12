import {prefetchChapter,clearArtCache,artCacheStats} from '../src/ui/art.js';

const button=document.querySelector('#run'),status=document.querySelector('#status'),rows=document.querySelector('#rows'),result=document.querySelector('#result');
button.addEventListener('click',async()=>{
  button.disabled=true;rows.replaceChildren();result.textContent='';clearArtCache();
  const records=[];
  try{
    for(let chapter=1;chapter<=12;chapter++){
      const start=performance.now();
      const loaded=await prefetchChapter(chapter,{next:false,onProgress:p=>{status.textContent=`Chapter ${chapter}: ${p.completed}/${p.total} resolved, ${p.failed} unavailable`;}});
      const stats=artCacheStats(),elapsedMs=Number((performance.now()-start).toFixed(2));
      records.push({chapter,elapsedMs,failed:loaded.failed,...stats});
      const row=document.createElement('tr');
      for(const value of [chapter,elapsedMs,loaded.failed,stats.entries,(stats.estimatedBytes/1048576).toFixed(2)]){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}
      rows.append(row);
    }
    const passed=records.every(r=>r.failed===0&&r.entries<=r.maxEntries&&r.estimatedBytes<=r.maxBytes&&r.peakActive<=2);
    const report={passed,browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight},measurement:'Actual local asset load/decode and retained Canvas-loader reference estimate; not total browser/GPU memory or FPS',records};
    status.textContent=passed?'PASS: all chapter groups decoded within retained-reference/concurrency limits.':'FAIL: missing/failed art or a loader limit was exceeded.';
    result.textContent=JSON.stringify(report,null,2);
  }catch(error){status.textContent='FAIL: '+error.message;}
  finally{button.disabled=false;}
});
