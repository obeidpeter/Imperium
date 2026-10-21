import {TP} from '../data/soldier.js';
import {ERRANDS} from '../data/dialogue.js';
import {CHAPTERS} from '../data/campaign.js';
import {PATHS} from '../data/soldier.js';
import {createBattle} from './battle.js';
import {newGame,CHAPTER_CAPABILITIES} from './game.js';

// The training points the campaign can grant (build brief §3.5, G33): there is
// no grinding, so the most a soldier can earn by each chapter is fixed. For each
// chapter: every encounter's objective TP; one per capability the chapter
// requires; at most ten kills an encounter, and no more than the enemies who
// take the field; the commendations a won fight can name (two TP for bringing
// every companion home, which needs a party, one for keeping one's feet, one for
// an ambush); and the errands, a training path's own errand only for its path.
// A 0.38 chronicle migrated into 0.40 receives the total to its chapter. Pure.

const COMMENDATION={allHome:2,steady:1,ambush:1};
function enemiesIn(chapter,index,data){
  const s=newGame('Audit',275,{featureEdition:35,progression:true});s.chapter=chapter;s.encounterIndex=index;
  const e=createBattle(s,data,{});return e.units.filter(u=>u.side==='enemy'&&u.role!=='trainer').length+(e.mission?.waves?.length??0);
}
export function tpAuditChapter(chapter,path='legionary'){
  const ch=CHAPTERS.find(c=>c.id===chapter);if(!ch)return null;
  const rows=ch.encounters.map((data,index)=>{
    const objective=TP.objective[data.id]??2,battle=data.kind==='battle'&&data.type!=='training';
    const kills=battle?Math.min(TP.killCap,enemiesIn(chapter,index,data)):0;
    const commendations=battle?COMMENDATION.steady+COMMENDATION.ambush+(chapter>=3?COMMENDATION.allHome:0):0;
    return {id:data.id,title:data.title,objective,kills,commendations};
  });
  const capabilities=(CHAPTER_CAPABILITIES[chapter]??[]).length*TP.perCapability;
  const errands=Object.values(ERRANDS).filter(e=>e.chapter===chapter&&(!e.path||e.path===path)).reduce((n,e)=>n+(e.reward.tp??0),0);
  const encounters=rows.reduce((n,r)=>n+r.objective+r.kills+r.commendations,0);
  return {chapter,rows,capabilities,errands,total:encounters+capabilities+errands};
}
// The most a soldier of this path can have earned once the given chapter is complete.
export function tpAuditTotal(throughChapter,path='legionary'){
  let n=0;for(let c=1;c<=throughChapter;c++)n+=tpAuditChapter(c,path)?.total??0;return n;
}
export const AUDIT_PATHS=PATHS;
