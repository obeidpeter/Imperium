import {ADAPTIVE_TACTICS as A,tacticalIdentity} from '../../data/realtime-tactics.js';
import {navGrid,span,walkable} from './navigation.js';
import {sightBlocked} from './sight.js';
import {squadCentre} from './squads.js';
import {unseen} from './squad-sight.js';

const live=a=>a?.alive&&!a.down&&!a.carriedBy;
const point=(world,o)=>o.members?squadCentre(world,o):o;

/** Read-only evidence for a round-boundary decision. At most eight watchers
 * examine sixteen targets; there is no map-wide path search, random draw,
 * hidden target lookup or mutation of perception memory. */
export function observeBattleSituation(world,enemies,friends,escorts=[],hero=null){
  const watchers=enemies.slice(0,A.maxWatchers).map(s=>point(world,s));
  const candidates=[...friends,...escorts,...(hero&&live(hero)?[hero]:[])].slice(0,A.maxTargets);
  const observed=candidates.filter(o=>o.members?!unseen(world,o):!o.hidden).filter(o=>{
    const p=point(world,o);return watchers.some(w=>span(w.x-p.x,w.z-p.z)<=A.senseRange&&!sightBlocked(world,w,p));
  });
  const squads=observed.filter(o=>o.members),visibleEscorts=observed.filter(o=>escorts.includes(o));
  const exposure=s=>s.strength/s.maxStrength-(squads.some(o=>o!==s&&span(o.x-s.x,o.z-s.z)<=A.supportedRange)?0:.25)-(s.broken?.25:s.morale<=A.shakenMorale?.15:0);
  const target=[...squads].sort((a,b)=>exposure(a)-exposure(b)||a.id.localeCompare(b.id))[0]??observed[0]??null;
  const at=target?point(world,target):null,grid=navGrid(world.map),fx=target?.fx??1,fz=target?.fz??0;
  const flankOpen=side=>{
    if(!at)return false;
    for(let i=1;i<=A.flankSteps;i++){const d=A.flankProbe*i/A.flankSteps;if(!walkable(grid,at.x-fz*side*d,at.z+fx*side*d))return false;}
    return true;
  };
  const goal=world.mission?.goal,nearGoal=goal&&observed.some(o=>{const p=point(world,o);return span(p.x-goal.x,p.z-goal.z)<=Math.max(A.objectiveRange,world.mission.radius??0);});
  return {
    observed:observed.map(o=>o.id),targetId:target?.id??null,
    braced:squads.some(s=>s.braced||s.formation==='shield-wall'),
    exposed:squads.some(s=>!squads.some(o=>o!==s&&span(o.x-s.x,o.z-s.z)<=A.supportedRange)),
    wavering:squads.some(s=>s.strength/s.maxStrength<A.weakStrength||s.morale<=A.shakenMorale),
    archers:squads.some(s=>s.role==='archer'),escort:visibleEscorts.length>0,
    leftOpen:flankOpen(-1),rightOpen:flankOpen(1),objectiveThreat:!!nearGoal,
    mobile:enemies.filter(s=>['cavalry','heavy','raider'].includes(s.role)).length,
    ownWeak:enemies.some(s=>s.morale<=A.shakenMorale||s.strength/s.maxStrength<A.weakStrength),
    ownArchers:enemies.some(s=>s.role==='archer'),phase:world.mission?.mode??null,
    identity:tacticalIdentity(world.chapter).id
  };
}

// Base doctrine/faction weights resolve ties; visible evidence determines the
// feasible preference. No extra damage, health, movement or surprise spawns.
export function scoreEnemyPlans(world,pool,situation){
  const identity=tacticalIdentity(world.chapter),s=situation;
  return pool.map(([id,weight])=>{
    let score=0,reasonWeight=0,reason='The enemy is keeping its doctrine while the approach is unobserved.';
    const add=(n,why)=>{score+=n;if(n>reasonWeight){reason=why;reasonWeight=n;}};
    if(s.observed.length){
      if(id===identity.bias)add(1,identity.label+'.');
      if(id==='fix'){
        if(s.wavering)add(6,'A visible formation is wavering; the enemy presses its front.');
        if(s.escort&&identity.pressure==='escort')add(4,'An exposed column is in sight; the pursuers close on its screen.');
        if(s.braced)add(-3,'');
        if(!s.leftOpen&&!s.rightOpen)add(4,'Both flanks are obstructed; the enemy concentrates on the approach.');
      }
      if(id==='flank-left'||id==='flank-right'){
        const open=id==='flank-left'?s.leftOpen:s.rightOpen;
        add(open?1:-8,open?'The lateral approach is passable.':'');
        if(open&&s.braced)add(5,'A braced front is visible; the enemy seeks its open flank.');
        if(open&&s.archers)add(3,'Visible archers need a screen; mobile troops seek their flank.');
        if(open&&s.exposed)add(1,'A visible formation has become separated from its support.');
        if(open&&s.mobile)add(1,'Mobile troops have space to turn the flank.');
      }
      if(id==='pincer'){
        if(!s.leftOpen||!s.rightOpen||s.mobile<2)add(-6,'');
        else{add(3,'Both flanks are open to the enemy’s mobile wings.');if(s.braced)add(3,'A braced centre is visible; the enemy closes around both sides.');}
      }
      if(id==='feint'){
        if(s.ownWeak&&s.ownArchers)add(5,'Wavering foot fall back toward their archers instead of committing head-on.');
        if(s.braced&&s.ownArchers)add(2,'The enemy tries to draw the braced line out of position.');
      }
      if(id==='early-reserve'&&s.objectiveThreat)add(7,'The objective is threatened; the reserve commits early.');
      if(id==='late-reserve'&&!s.objectiveThreat&&s.ownWeak)add(4,'The forward bands are worn; a reserve remains intact behind them.');
    }
    return {id,weight,score,reason};
  });
}
