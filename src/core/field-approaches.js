import {CHAPTERS} from '../data/campaign.js';
import {OPERATIONAL_PLANS} from '../data/command-campaign.js';
import {alive,clamp,note,result} from './shared.js';

export const FIELD_APPROACHES=Object.freeze([
  {id:'balanced',label:'Direct deployment',cost:0,description:'Keep the normal deployment and enemy response.'},
  {id:'breach',label:'Engineering approach',cost:2,description:'Open gates, repair bridges and add 10 defence. While carrying tools in rounds one and two, the commander has march range −1. Enemy archers prioritize the exposed commander.'},
  {id:'diversion',label:'Diversion',cost:1,description:'Delay pending reinforcements by two rounds. One visible enemy screens a false approach through round two. Your company begins with 8 less cohesion.'},
  {id:'advance',label:'Defensive advance',cost:0,description:'Begin braced with 12 extra cohesion. The commander has march range −1 in rounds one and two. Enemy cavalry attempts the open flank instead of charging the shield front.'}
].map(Object.freeze));
const enabled=s=>s?.tacticsEdition===35;
const option=id=>FIELD_APPROACHES.find(p=>p.id===id);
export const fieldApproachSummary=e=>enabled(e)?option(e.fieldApproach):null;
const next=s=>CHAPTERS[s.chapter-1]?.encounters[s.encounterIndex];
const field=s=>s.chapter>=3&&next(s)?.kind==='battle'&&next(s)?.type!=='training';
export const initialFieldApproaches=on=>on?{tacticsEdition:35,fieldApproach:'balanced'}:{};
export function enableFieldApproaches(s){
  if(s.phase!=='camp'||s.encounter||enabled(s)||s.campaignEdition!==34)return result(false,'Enable field approaches once, at a command-campaign camp checkpoint.');
  Object.assign(s,initialFieldApproaches(true));return result(true,'Field approaches are available before battles from Chapter III.');
}
export const fieldApproachCost=s=>enabled(s)&&field(s)?option(s.fieldApproach)?.cost??0:0;
function otherCosts(s){return ({none:0,recovery:2,rearm:2,support:3}[s.companyOrders?.package??'none']??0)+(OPERATIONAL_PLANS.find(p=>p.id===s.commandCampaign?.plan)?.cost??0);}
export function fieldApproachView(s){
  const available=enabled(s)&&s.phase==='camp'&&field(s),cost=otherCosts(s);
  return {edition:enabled(s),enabled:available,selected:s.fieldApproach??'balanced',options:FIELD_APPROACHES.map(p=>({...p,available:Boolean(available&&(p.id==='balanced'||s.supplies>=p.cost+cost)),reason:p.id!=='balanced'&&s.supplies<p.cost+cost?'The approach, preparation and company package must all be affordable.':''}))};
}
export function chooseFieldApproach(s,id){
  const p=fieldApproachView(s).options.find(p=>p.id===id);if(!p?.available)return result(false,p?.reason||'Choose an approach before a field encounter from Chapter III.');
  s.fieldApproach=id;return result(true,`${p.label}. ${p.description}`);
}
export function fieldApproachProblem(s){
  if(!enabled(s)||!field(s))return null;
  return !option(s.fieldApproach)?'Choose a valid field approach.':s.supplies<fieldApproachCost(s)+otherCosts(s)?'The approach, preparation and company package must all be affordable.':null;
}
export function departFieldApproach(s){s.supplies-=fieldApproachCost(s);}
export function initializeFieldApproach(s){
  if(!enabled(s))return;
  const e=s.encounter,id=field(s)?s.fieldApproach:'balanced',p=option(id);
  e.tacticsEdition=35;e.fieldApproach=id;e.approachMarchPenalty=0;
  if(id==='balanced')return;
  const friends=e.units.filter(u=>u.side!=='enemy'&&u.side!=='neutral'&&alive(u)),hero=e.units.find(u=>u.id==='hero');
  if(id==='breach'){
    for(const o of e.field?.objects??[]){if(o.kind==='gate')o.state='open';if(o.kind==='bridge'){o.state='repaired';e.terrain[o.y][o.x]='ford';}}
    e.defence+=10;e.approachMarchPenalty=hero.move>1?1:0;hero.move-=e.approachMarchPenalty;
  }else if(id==='diversion'){
    for(const wave of e.mission?.waves??[])if(!wave.arrived)wave.turn=Math.min(30,wave.turn+2);
    for(const u of friends)u.cohesion=clamp(u.cohesion-8);
  }else if(id==='advance'){
    for(const u of friends){u.braced=true;u.cohesion=clamp(u.cohesion+12);}
    e.approachMarchPenalty=hero.move>1?1:0;hero.move-=e.approachMarchPenalty;
  }
  note(e,`${p.label}: ${p.description}`);
}
// Like the operational preparation, an approach covers one field encounter;
// the next camp starts from the free direct deployment again.
export function commitFieldApproach(s){if(enabled(s))s.fieldApproach='balanced';}
export function advanceFieldApproach(e){
  if(!enabled(e)||e.turn<3||!e.approachMarchPenalty)return;
  const hero=e.units.find(u=>u.id==='hero');if(hero)hero.move+=e.approachMarchPenalty;
  e.approachMarchPenalty=0;note(e,'The opening approach is complete. The commander’s normal march range is restored.');
}
export function approachAssignment(e,u){
  if(!enabled(e)||u.side!=='enemy'||e.mission?.mode==='settlement')return null;
  const hero=e.units.find(u=>u.id==='hero'&&alive(u)&&!u.hidden);if(!hero)return null;
  if(e.fieldApproach==='breach'&&u.role==='archer')return {role:'Suppress engineers',targetId:hero.id,goal:hero};
  if(e.fieldApproach==='diversion'&&e.turn<=2){
    const screen=e.units.filter(u=>u.side==='enemy'&&alive(u)&&!u.hidden).sort((a,b)=>a.id.localeCompare(b.id))[0];
    if(screen?.id===u.id)return {role:'Investigate diversion',targetId:null,goal:{x:clamp(hero.x+2,0,e.width-1),y:hero.y<e.height/2?e.height-2:1},hold:false};
  }
  if(e.fieldApproach==='advance'&&['cavalry','raider'].includes(u.role))return {role:'Turn the shield flank',targetId:hero.id,goal:{x:clamp(hero.x-1,0,e.width-1),y:clamp(hero.y+(u.y<=hero.y?-2:2),0,e.height-1)}};
  return null;
}
export function validateFieldApproaches(s,fail){
  if(s.tacticsEdition===undefined){if(s.fieldApproach!==undefined||s.encounter?.tacticsEdition!==undefined)fail('unexpected field approach.');return;}
  if(s.tacticsEdition!==35||s.campaignEdition!==34||!option(s.fieldApproach))fail('field approach edition.');
  if(s.phase==='encounter'){
    const e=s.encounter;
    if(e?.tacticsEdition!==35||!option(e.fieldApproach)||e.fieldApproach!==(field(s)?s.fieldApproach:'balanced')||s.snapshot?.tacticsEdition!==35||s.snapshot?.fieldApproach!==s.fieldApproach)fail('field approach checkpoint.');
    if(![0,1].includes(e?.approachMarchPenalty)||e.approachMarchPenalty&&(!['breach','advance'].includes(e.fieldApproach)||e.turn>=3))fail('field approach march penalty.');
  }
}
