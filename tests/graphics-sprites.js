import {drawUnitSprite,spriteSpec} from '../src/ui/unit-sprites.js';
import {loadArt,artCacheStats} from '../src/ui/art.js';
const $=selector=>document.querySelector(selector),canvas=$('#sprite-sheet'),c=canvas.getContext('2d'),label=new URLSearchParams(location.search).get('label')??'current';
const definitions=[
  ['Recruit walk','board-ch1-training','hero','walk'],['Recruit melee','board-ch1-training','hero','attack'],
  ['Recruit throw','board-ch1-training','hero','throw'],['Recruit brace','board-ch1-training','hero','brace'],
  ['Gothic archer','board-ch1-road','enemy1','throw'],['Persian archer','board-ch5-mine','enemy1','throw'],
  ['Roman archer','board-ch7-legion','ally4','throw'],['Senate speaker','board-ch11-adlection','hero','speak'],
  ['Mounted travel','board-ch9-wing','enemy0','cavalry-move'],['Mounted attack','board-ch9-wing','enemy0','cavalry-attack']
];
let rows,baseline,fixtures,report;
function render(){
  if(!rows)return;const progress=Number($('#sprite-phase').value),facings=['east','south','north','west'],dark=$('#sprite-background').value==='dark';
  canvas.width=960;canvas.height=rows.length*210+60;c.fillStyle='#e1d7c0';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#243d35';c.font='20px Georgia';c.fillText(`${label} · isolated pose sheet · ${Math.round(progress*100)}% · 2× magnification`,15,28);
  const drawn=[];
  rows.forEach((row,index)=>facings.forEach((facing,column)=>{
    const x=column*240,y=index*210+45;c.fillStyle=dark?(index%2?'#17251e':'#24382d'):(index%2?'#d8cdb4':'#e9dfc9');c.fillRect(x,y,239,209);c.fillStyle=dark?'#eee5d4':'#273b33';c.font='13px system-ui';c.fillText(`${row.label} · ${facing}`,x+8,y+19);
    c.strokeStyle='#9c9981';c.lineWidth=1;c.beginPath();c.moveTo(x+12,y+192);c.lineTo(x+225,y+192);c.stroke();
    c.save();c.translate(x+120,y+192);c.scale(2,2);
    const override={pose:row.pose,progress,facing,alpha:1,phase:progress<.2?'anticipation':progress>.8?'recovery':'impact',stridePhase:progress*Math.PI*4};
    const ok=drawUnitSprite(c,{tw:44},{x:0,y:0},row.unit,row.chapter,row.contest,override);c.restore();
    if(!ok)throw new Error('Sprite artwork missing for '+row.label);drawn.push({label:row.label,scene:row.scene,unitId:row.unit.id,role:row.unit.role,pose:row.pose,facing,progress,sprite:spriteSpec(row.unit,row.chapter,row.contest)});
  }));
  const unchanged=JSON.stringify(fixtures)===baseline;if(!unchanged)throw new Error('Sprite diagnostic mutated its source fixture.');
  report={format:'sacramentum-sprite-diagnostic-v1',label,capturedAt:new Date().toISOString(),userAgent:navigator.userAgent,devicePixelRatio,canvas:{width:canvas.width,height:canvas.height,magnification:2},source:fixtures.source,progress,background:dark?'dark':'light',cells:drawn.length,stateUnchanged:unchanged,rows:drawn,assetCache:artCacheStats(),scope:'Deliberately isolated pose/facing overrides over legally sourced unit identities. Not an action replay, actual encounter, physical-device test or performance benchmark.'};
  $('#sprite-json').value=JSON.stringify(report,null,2);$('#sprite-status').textContent=`Ready: ${drawn.length} cells; inputs unchanged. Inspect actual pixels for seams and anatomy.`;
}
function failed(error){$('#sprite-errors').textContent=error.message;$('#sprite-status').textContent='Diagnostic failed; no visual pass is implied.';}
$('#sprite-render').addEventListener('click',()=>{try{render();}catch(error){failed(error);}});
$('#sprite-download').addEventListener('click',()=>{if(!report)return;canvas.toBlob(blob=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${label}-sprites-${Math.round(report.progress*100)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});});
try{
  const response=await fetch(new URL('./fixtures/graphics-scenes.json',import.meta.url));if(!response.ok)throw new Error('Legal fixtures unavailable.');fixtures=await response.json();baseline=JSON.stringify(fixtures);
  rows=definitions.map(([caption,id,unitId,pose])=>{const scene=fixtures.scenes.find(value=>value.id===id),unit=scene?.state.encounter.units.find(value=>value.id===unitId);if(!unit)throw new Error('Fixture unit unavailable: '+id+'/'+unitId);return {label:caption,scene:id,unit,pose,chapter:scene.chapter,contest:scene.state.encounter.kind==='contest'};});
  const atlases=[...new Set(rows.map(row=>`./assets/tactical/units-${spriteSpec(row.unit,row.chapter,row.contest).atlas==='roman'?'roman':spriteSpec(row.unit,row.chapter,row.contest).atlas}.webp`))];
  const images=await Promise.all(atlases.map(path=>loadArt(path)));if(images.some(image=>!image))throw new Error('One or more required sprite atlases failed to load.');render();
}catch(error){failed(error);}
