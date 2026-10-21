import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const defaultRoot=new URL('../',import.meta.url);
async function edition(root){const base=root instanceof URL?root:pathToFileURL(resolve(root)+'/');return {game:await import(new URL('src/core/game.js',base)),debug:await import(new URL('src/core/debug.js',base)),data:await import(new URL('src/data/campaign.js',base)),auto:await import(new URL('scripts/autoplay.mjs',base))};}
function setup(api,chapter,id,seed){const {game:g,data,debug}=api,s=debug.debugJump(g.newGame('Labelled combat diagnostic',seed),chapter,true);g.choose(s,data.CHAPTERS[chapter-1].decision.options[0].id);s.encounterIndex=data.CHAPTERS[chapter-1].encounters.findIndex(e=>e.id===id);
 if(chapter===1){s.oath=true;s.chapterCapabilities[1]=['move','strike','brace','throw','oath'];}if(chapter===7)g.prepare(s,'drill');if(chapter===8)g.negotiate(s,'safe-passage');if(chapter===9)g.selectStratagem(s,'flank');if(chapter===10){g.allocate(s,{river:2,farms:2,town:2});g.judge(s,'shared');}const r=g.startEncounter(s);if(!r.ok)throw new Error(r.message);return s;}
const near=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
function beginner(api,s){const g=api.game;
 for(let i=0;i<25&&s.encounter.status==='active';i++){const e=s.encounter,h=e.units.find(u=>u.id==='hero'),enemies=e.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.hidden),ally=e.units.find(u=>u.side==='ally'&&u.hp>0),nearest=[...enemies].sort((a,b)=>near(h,a)-near(h,b))[0];
  const issue=(action,targets=g.getTargets(s,h.id,action))=>{if(!g.getActions(s,h.id).includes(action)||!targets.length)return false;api.auto.command(s,h,action,targets[0]);return true;};
  if(!g.getTargets(s,h.id,'strike').length&&!g.getTargets(s,h.id,'throw').length&&nearest){const positions=g.getTargets(s,h.id,'move');positions.sort((a,b)=>near(a,nearest)-near(b,nearest)+(ally?(near(a,ally)-near(b,ally))*.15:0));issue('move',positions);}
  const finishingStrike=g.getTargets(s,h.id,'strike').find(t=>enemies.find(u=>u.id===t.unitId)?.hp<=2);if(finishingStrike)issue('strike',[finishingStrike]);
  if(h.hp<=8&&enemies.filter(u=>near(h,u)<=2).length>1)issue('brace');
  issue('strike');issue('throw');if(!h.acted)issue('brace');if(e.status==='active')g.endTurn(s);
 }return {status:s.encounter.status,turns:s.encounter.turn,losses:s.encounter.units.filter(u=>u.side==='ally'&&u.hp<=0).length,heroHealth:s.encounter.units.find(u=>u.id==='hero').hp};}
function objective(e){const m=e.mission;if(e.status==='won')return 1;if(m.points.length)return m.points.filter(p=>p.secured).length/m.points.length;if(m.mode==='hold')return m.holdProgress/m.holdRequired;if(m.escortIds.length)return m.escortIds.filter(id=>{const u=e.units.find(u=>u.id===id);return u.hp>0&&near(u,e.goal)<=1;}).length/m.escortIds.length;const army=e.units.filter(u=>u.side==='enemy');return army.length?army.filter(u=>u.hp<=0).length/army.length:0;}
export async function combatDiagnostics({root=defaultRoot,seeds=[17,275,913],scenarios=[[1,'ch1-road'],[2,'ch2-marsh'],[4,'ch4-gate'],[5,'ch5-mine'],[6,'ch6-wells'],[8,'ch8-ferry'],[9,'ch9-wing'],[10,'ch10-road']]}={}){
 const api=await edition(root),runs=[];
 for(const [chapter,id]of scenarios)for(const seed of seeds)for(const policy of ['simple','tactical',...(chapter===1?['beginner']:[])]){const s=setup(api,chapter,id,seed),initialStrength=s.encounter.units.filter(u=>['player','ally'].includes(u.side)).reduce((n,u)=>n+u.hp,0),initialHash=createHash('sha256').update(JSON.stringify(s)).digest('hex'),mapHash=createHash('sha256').update(JSON.stringify(s.encounter.terrain)).digest('hex');const outcome=policy==='beginner'?beginner(api,s):api.auto.playEncounter(s,{style:policy==='simple'?'greedy':'tactical'}),e=s.encounter;const remainingStrength=e.units.filter(u=>['player','ally'].includes(u.side)).reduce((n,u)=>n+u.hp,0);
  runs.push({encounter:id,chapter,seed,policy,initialHash,mapHash,status:outcome.status,turns:outcome.turns,withdrawals:outcome.losses,commanderHealth:outcome.heroHealth,initialStrength,remainingStrength,integrity:e.defence,objectiveFraction:Number(objective(e).toFixed(3))});
 }
 const summaries=Object.fromEntries(['simple','tactical','beginner'].map(policy=>{const list=runs.filter(r=>r.policy===policy);return [policy,{runs:list.length,wins:list.filter(r=>r.status==='won').length,losses:list.filter(r=>r.status!=='won').length,meanTurns:mean(list,'turns'),meanRemainingStrength:mean(list,'remainingStrength'),meanObjectiveFraction:mean(list,'objectiveFraction'),meanIntegrity:mean(list,'integrity'),withdrawals:list.reduce((n,r)=>n+r.withdrawals,0)}];}));
 return {kind:'Seeded diagnostic; injected starting campaign, every encounter command uses public preview/act/endTurn; not human playtesting',policies:{simple:'Existing objective-aware immediate-action policy; no discretionary command coordination.',tactical:'Legal path/position evaluation, protection, Rally and command coordination.',beginner:'First road only: nearby strike/throw, finish an adjacent opponent at two health before bracing, stay near companion, brace when low and surrounded; no scored planner.'},seeds,summaries,runs};
}
function mean(rows,key){return rows.length?Number((rows.reduce((n,r)=>n+r[key],0)/rows.length).toFixed(3)):null;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const root=process.argv.find(a=>a.startsWith('--root='))?.slice(7),out=process.argv.find(a=>a.startsWith('--out='))?.slice(6),report=await combatDiagnostics(root?{root}:{});if(out)await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summaries,null,2));}
