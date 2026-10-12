import {FRAME_ATLASES} from './animation-catalog.js';

// Independent of the asset loader, so chapter prefetch can share this catalog.
export const ANIMATION_ASSETS=Object.freeze(Object.values(FRAME_ATLASES).map(a=>a.file));
export function animationAssets(chapter=1,contest=false){
  if(contest)return chapter>=11?[FRAME_ATLASES['civic-actions'].file]:[];
  return [...(chapter===1?[FRAME_ATLASES['recruit-actions'].file,FRAME_ATLASES['recruit-responses'].file]:[]),
    FRAME_ATLASES['roman-actions'].file,...(![5,6,9,11,12].includes(chapter)?[FRAME_ATLASES['gothic-actions'].file]:[])];
}
const finite=n=>Number.isFinite(n)?n:0;
const clamp=n=>Math.max(0,Math.min(1,finite(n)));
const front={east:0,south:1},directions={east:0,south:1,north:2,west:3};
const walkPoses=new Set(['walk','run','cavalry-move']);
export function actionFrameIndex(pose,progress=0,stridePhase){
  if(walkPoses.has(pose)){
    const phase=Number.isFinite(stridePhase)?stridePhase:clamp(progress)*Math.PI*2;
    return Math.min(5,Math.floor(((phase%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*6));
  }
  const p=clamp(progress),cuts=pose==='throw'?[.12,.28,.5,.66,.84]:pose==='hit'?[.08,.2,.4,.64,.84]:[.14,.32,.46,.64,.84];
  return cuts.filter(c=>p>=c).length;
}

/** Authored artwork only for the exact identity, action and facing it depicts.
 * Uncovered roles/directions return null: never mirror equipment or substitute
 * a helmet/toga for a different campaign costume. Inputs remain untouched. */
export function authoredFrame(spec,facing,override={},unit={}){
  const raw=override.pose??'idle',pose=raw==='hurt'||raw==='retreat'?'hit':raw==='formation'?'brace':raw;
  let id,row,sequence=pose;
  const walking=walkPoses.has(pose),rest=pose==='idle'||pose==='turn';
  if(spec.atlas==='roman'&&spec.row===0){
    if(walking){id='recruit-actions';row=directions[facing];}
    else if(pose==='attack'||rest&&!unit.braced){id='recruit-actions';row=front[facing]===undefined?undefined:front[facing]+4;}
    else if(['brace','hit','throw'].includes(pose)||rest&&unit.braced){id='recruit-responses';sequence=rest?'brace':pose;row=front[facing]===undefined?undefined:front[facing]+({brace:0,hit:2,throw:4}[sequence]);}
    if(rest&&row===undefined){id='recruit-actions';row=directions[facing];sequence='walk';}
  }else if(spec.atlas==='roman'&&spec.row===1){
    id='roman-actions';row=front[facing]===undefined?undefined:front[facing]+(walking?0:2);
    if(!walking&&pose!=='attack'&&!rest)row=undefined;
  }else if(spec.atlas==='frontier'&&spec.row===0){
    id='gothic-actions';const rear={west:0,north:1};row=rear[facing]===undefined?undefined:rear[facing]+(walking?0:2);
    if(!walking&&pose!=='attack'&&!rest)row=undefined;
  }else if(spec.atlas==='civic'&&spec.row===1&&(pose==='speak'||rest)){
    id='civic-actions';row=directions[facing];sequence='speak';
  }
  const atlas=FRAME_ATLASES[id];if(!atlas||row===undefined)return null;
  const frame=rest?(unit.braced&&id==='recruit-responses'?2:sequence==='walk'?0:5):actionFrameIndex(sequence,override.progress,override.stridePhase);
  const source=atlas.frames[row*6+frame];
  return {asset:atlas.file,sequence,frame,row,source:source.source,anchor:source.anchor,clip:source.clip,bodyHeight:atlas.bodyHeight};
}
