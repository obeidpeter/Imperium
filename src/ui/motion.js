import {geometry} from './renderer.js';
import {buildEncounterTimeline,sampleEncounterTimeline,MOTION_BUDGETS} from './animation-timeline.js';

// A presentation snapshot contains no references to mutable campaign objects.
export function snapshotEncounter(encounter){
  if(!encounter)return null;
  // The 3D stage also syncs the committed snapshot. Keep field objects,
  // operation state and veteran identity as well as movement/health, otherwise
  // starting an animation erases the scene's gates, bridges and unit details.
  return structuredClone(encounter);
}

// Exported separately so change detection can be tested without a DOM or clock.
export function diffEncounterMotion(before,after){
  if(!before||!after||before.id!==after.id)return [];
  const previous=new Map(before.units.map(unit=>[unit.id,unit])),changes=[];
  for(const unit of after.units){const old=previous.get(unit.id);if(!old||unit.hidden||old.hidden)continue;
    const from={x:old.x,y:old.y},to={x:unit.x,y:unit.y},common={id:unit.id,side:unit.side,from,to};
    if((old.x!==unit.x||old.y!==unit.y)&&(unit.resolve??unit.hp??1)>0)changes.push({...common,type:'move'});
    const stat=Number.isFinite(unit.resolve)?'resolve':'hp';
    if(Number.isFinite(old[stat])&&Number.isFinite(unit[stat])&&unit[stat]!==old[stat])changes.push({...common,type:stat==='resolve'?'resolve':'health',delta:unit[stat]-old[stat],withdrawn:old[stat]>0&&unit[stat]===0});
    for(const type of ['morale','stance'])if(Number.isFinite(unit[type])&&Number.isFinite(old[type])&&unit[type]!==old[type])changes.push({...common,type,delta:unit[type]-old[type]});
    if(unit.side!==old.side)changes.push({...common,type:'allegiance',fromSide:old.side});
  }
  return changes;
}

const active=new WeakMap();
const SVG='http://www.w3.org/2000/svg';
const point=(g,tile)=>({x:g.ox+(tile.x-tile.y)*g.tw/2,y:g.oy+(tile.x+tile.y)*g.th/2});
const color=change=>change.type==='allegiance'?'#bd9954':change.delta<0?'#9c4036':'#175d67';
const label=change=>change.type==='allegiance'?'Defects':`${change.delta>0?'+':''}${change.delta}${change.type==='morale'?' morale':change.type==='stance'?' stance':change.type==='resolve'?' Resolve':''}`;

/**
 * Animate presentation overrides over the committed final board. renderFrame
 * receives a detached timeline frame; null restores the static final drawing.
 * Without that callback, retain the lightweight overlay-only fallback. This
 * never changes rule units, delays commands, consumes RNG, or writes saves.
 * Returns an idempotent cleanup function; call it when replacing the canvas.
 */
export function playEncounterMotion(canvas,before,after,{command=null,reducedMotion=false,quality='balanced',renderFrame=null}={}){
  active.get(canvas)?.();
  const doc=canvas?.ownerDocument??globalThis.document,changes=diffEncounterMotion(before,after),timeline=buildEncounterTimeline(before,after,{command,quality});
  if(!canvas||!doc||reducedMotion||doc.hidden||!canvas.isConnected||(!changes.length&&!timeline.duration)){renderFrame?.(null);return ()=>{};}
  const box=canvas.getBoundingClientRect();if(box.width<=34||box.height<=80){renderFrame?.(null);return ()=>{};}
  const g=geometry(canvas,after),layer=doc.createElement('div'),animations=[];
  layer.setAttribute('aria-hidden','true');layer.setAttribute('data-encounter-motion','');
  Object.assign(layer.style,{position:'fixed',left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`,pointerEvents:'none',overflow:'hidden',zIndex:'20',contain:'strict'});
  const svg=doc.createElementNS(SVG,'svg');svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);svg.setAttribute('width','100%');svg.setAttribute('height','100%');Object.assign(svg.style,{position:'absolute',inset:'0',overflow:'visible'});layer.append(svg);
  const duration=340,animate=(element,frames,options={})=>{if(typeof element.animate==='function')animations.push(element.animate(frames,{duration,easing:'cubic-bezier(.2,.65,.3,1)',fill:'both',...options}));};
  for(const change of (renderFrame?[]:changes.filter(item=>item.type==='move').slice(0,8))){
    const a=point(g,change.from),b=point(g,change.to),path=doc.createElementNS(SVG,'path');path.setAttribute('d',`M ${a.x} ${a.y+2} L ${b.x} ${b.y+2}`);path.setAttribute('fill','none');path.setAttribute('stroke','#277c82');path.setAttribute('stroke-width',String(Math.max(1.5,g.tw*.04)));path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-dasharray','3 4');svg.append(path);animate(path,[{opacity:.5},{opacity:0}],{duration:300});
    const marker=doc.createElement('span');Object.assign(marker.style,{position:'absolute',left:`${a.x-3}px`,top:`${a.y-1}px`,width:'6px',height:'6px',border:'1px solid #f4ecd6',borderRadius:'50%',background:'#277c82'});layer.append(marker);animate(marker,[{transform:'translate(0,0)',opacity:.85},{transform:`translate(${b.x-a.x}px,${b.y-a.y}px)`,opacity:0}],{duration:300});
  }
  const perUnit=new Map();let feedbackEnd=0;
  for(const change of changes.filter(item=>item.type!=='move').slice(0,12)){
    const count=perUnit.get(change.id)??0;if(count>=2)continue;perUnit.set(change.id,count+1);
    const cue=timeline.effects.find(effect=>effect.at?.x===change.to.x&&effect.at?.y===change.to.y&&(effect.type===change.type||['health','resolve'].includes(change.type)&&['impact','shield','ring'].includes(effect.type))),delay=renderFrame?(cue?.start??0):0;
    const p=point(g,change.to),scale=Math.min(1.3,g.tw/48),badge=doc.createElement('span');badge.textContent=label(change);feedbackEnd=Math.max(feedbackEnd,delay+(renderFrame?950:360));
    Object.assign(badge.style,{position:'absolute',left:`${Math.max(4,Math.min(box.width-68,p.x+9*scale))}px`,top:`${Math.max(4,p.y-44*scale+count*18)}px`,font:'600 13px/1.25 system-ui,sans-serif',whiteSpace:'nowrap',padding:'4px 7px',borderRadius:'3px',background:'#f4ecd6f5',color:color(change),border:`1px solid ${color(change)}77`,boxShadow:'0 2px 8px #10181380'});layer.append(badge);animate(badge,[{transform:'translateY(5px)',opacity:0},{transform:'translateY(-2px)',opacity:1,offset:.12},{transform:'translateY(-6px)',opacity:1,offset:.72},{transform:'translateY(-13px)',opacity:0}],{duration:renderFrame?950:360,delay});
    if(!renderFrame&&(change.type==='health'||change.type==='resolve')){
      const ring=doc.createElementNS(SVG,'ellipse');ring.setAttribute('cx',String(p.x));ring.setAttribute('cy',String(p.y));ring.setAttribute('rx',String(13*scale));ring.setAttribute('ry',String(6*scale));ring.setAttribute('fill','none');ring.setAttribute('stroke',color(change));ring.setAttribute('stroke-width','2');svg.append(ring);animate(ring,[{opacity:.8},{opacity:0}],{duration:230});
    }
  }
  doc.body.append(layer);
  let finished=false,canvasSettled=false,timer,frameId;const win=doc.defaultView;
  const requestFrame=win?.requestAnimationFrame?.bind(win)??(fn=>setTimeout(()=>fn(globalThis.performance?.now()??Date.now()),16));
  const cancelFrame=win?.cancelAnimationFrame?.bind(win)??clearTimeout;
  const now=()=>win?.performance?.now()??globalThis.performance?.now()??Date.now();
  function cleanup(){
    if(finished)return;finished=true;if(timer)clearTimeout(timer);if(frameId!==undefined)cancelFrame(frameId);
    for(const animation of animations)animation.cancel();layer.remove();doc.removeEventListener('visibilitychange',visibility);
    win?.removeEventListener('scroll',cleanup,true);win?.removeEventListener('resize',cleanup);
    if(active.get(canvas)===cleanup)active.delete(canvas);if(!canvasSettled){canvasSettled=true;renderFrame?.(null);}
  }
  function visibility(){if(doc.hidden)cleanup();}
  doc.addEventListener('visibilitychange',visibility);win?.addEventListener('scroll',cleanup,{capture:true,passive:true});win?.addEventListener('resize',cleanup,{passive:true});
  active.set(canvas,cleanup);
  if(renderFrame&&timeline.duration){
    const start=now(),interval=1000/(MOTION_BUDGETS[quality]?.fps??60),end=Math.max(timeline.duration,feedbackEnd);let last=-Infinity,settled=false;
    const tick=timestamp=>{
      if(finished)return;if(doc.hidden||!canvas.isConnected){cleanup();return;}
      const elapsed=Math.max(0,timestamp-start);
      if(!settled&&(elapsed-last>=interval-.5||elapsed>=timeline.duration)){last=elapsed;renderFrame(sampleEncounterTimeline(timeline,elapsed));if(elapsed>=timeline.duration){settled=true;canvasSettled=true;renderFrame(null);}}
      if(elapsed>=end)cleanup();else frameId=requestFrame(tick);
    };
    renderFrame(sampleEncounterTimeline(timeline,0));frameId=requestFrame(tick);
    timer=setTimeout(cleanup,end+120);
  }else timer=setTimeout(cleanup,390);
  return cleanup;
}
