import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {actorKit,createActor,horsePose} from '../src/showcase/actors.js';
import {CHAPTERS} from '../src/data/campaign.js';
import {createBattle} from '../src/core/battle.js';
import {createContest} from '../src/core/contest.js';
import * as Game from '../src/core/game.js';

function metrics(actor){const bounds=new T.Box3();let draws=0,triangles=0;actor.group.updateMatrixWorld(true);actor.group.traverseVisible(o=>{if(o.isMesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});return {draws,triangles,bounds};}

test('Actual campaign factory roles select distinct visual kits without changing rules or defector identity',()=>{
  // Explicit injected visual fixtures: these call all actual factories to audit
  // their emitted roles. They do not claim earned campaign progression.
  const kits=new Map();let encounters=0,cavalry=0,voters=0;
  for(const chapter of CHAPTERS){const state=Game.newGame('Aurelius Marcellus',275);state.chapter=chapter.id;state.rank=chapter.rank;
    for(const data of chapter.encounters){const e=data.kind==='contest'?createContest(state,data):createBattle(state,data),before=JSON.stringify(e);encounters++;
      for(const unit of e.units){const options={chapter:state.chapter,rank:state.rank},kit=actorKit(unit,options);kits.set([kit.role,kit.faction,kit.armor,kit.helmet].join('/'),{unit,options,kit});
        if(unit.role==='cavalry'){cavalry++;assert.ok(kit.mounted);}
        if(['speaker','voter','escort'].includes(unit.role)){assert.equal(kit.armed,false);assert.equal(kit.armor,null);if(unit.role==='voter')voters++;}
        if(unit.side==='enemy'&&!kit.civic&&!kit.trainer){const defected=actorKit({...unit,side:'ally'},options);assert.equal(defected.faction,kit.faction);assert.equal(defected.armor,kit.armor);}
      }
      assert.equal(JSON.stringify(e),before);
    }
  }
  assert.equal(encounters,25);assert.ok(cavalry>=6);assert.equal(voters,54);
  for(const {unit,options,kit} of kits.values()){
    const frozen=Object.freeze({...unit}),a=createActor(frozen,options),measure=metrics(a);assert.equal(a.group.userData.actor.faction,kit.faction);
    if(!kit.armed){for(const name of ['sword','spear','held-javelin','oval-shield','bow','scabbard'])assert.equal(a.group.getObjectByName(name),undefined,`${kit.role} must not carry ${name}`);}
    assert.equal(Boolean(a.group.getObjectByName('horse')),kit.mounted);
    assert.ok(measure.draws<=(kit.mounted?80:55),`${kit.role}/${kit.faction}: ${measure.draws} rigid draw batches`);
    // v0.18 connected costumes and articulated hands/boots measured a maximum
    // 31,204 visible fallback triangles across these 19 factory role/kit sets.
    // Imported anatomy/groom has its own checks; this cap remains fallback-only.
    assert.ok(measure.triangles<=32000,`${kit.role}/${kit.faction}: ${measure.triangles} fallback triangles`);
    assert.ok(measure.bounds.min.y>-.005);assert.ok(measure.bounds.max.y<=a.group.userData.actor.height+.02,'Label height covers visible head/helmet.');
    a.dispose();
  }
});

test('Recruit, later legionary and command rank differ in actual equipment meshes',()=>{
  const unit=Object.freeze({id:'hero',side:'player',role:'soldier'}),a=createActor(unit,{chapter:1,rank:'Tiro'}),b=createActor(unit,{chapter:2,rank:'Miles'}),c=createActor(unit,{chapter:5,rank:'Centurio'});
  assert.equal(a.group.getObjectByName('ridge-helmet'),undefined);assert.ok(b.group.getObjectByName('ridge-helmet'));assert.equal(b.group.getObjectByName('officer-horsehair-crest'),undefined);assert.ok(c.group.getObjectByName('officer-horsehair-crest'));assert.ok(c.group.getObjectByName('command-cloak'));
  for(const actor of [a,b,c])actor.dispose();
});

test('Horse gait has four grounded articulated hoof targets and exact distance-based stance',()=>{
  for(const motion of ['idle','walk','run','attack','hit','withdrawn'])for(let i=0;i<=60;i++){
    const phase=i/20,p=horsePose({motion,phase,time:3.2});assert.deepEqual(p,horsePose({motion,phase,time:3.2}));
    for(let leg=0;leg<4;leg++){
      const {upper,knee,ankle}=p.legs[leg],y=p.bodyY-.53*Math.cos(upper)-.53*Math.cos(upper+knee),z=(leg<2?.54:-.54)-.53*Math.sin(upper)-.53*Math.sin(upper+knee);
      assert.ok([upper,knee,ankle].every(Number.isFinite));assert.ok(Math.abs(y-p.feet[leg].y)<1e-6);assert.ok(Math.abs(z-p.feet[leg].z)<1e-6);assert.ok(p.feet[leg].y>=.075);
    }
  }
  const a=horsePose({motion:'walk',phase:.1}),b=horsePose({motion:'walk',phase:.6});
  assert.equal(a.feet[0].y,.075);assert.equal(b.feet[0].y,.075);assert.ok(Math.abs((.6-.1)*.72+b.feet[0].z-a.feet[0].z)<1e-10);
});

test('Mounted rigs animate real hoof and rider joints, retain caller placement, and reset after withdrawal',()=>{
  const unit=Object.freeze({id:'enemy',name:'Palmyrene cavalry',side:'enemy',role:'cavalry'}),a=createActor(unit,{chapter:9});a.group.position.set(4,2,-3);const names=['fore-left-leg','fore-right-leg','hind-left-leg','hind-right-leg'];
  for(const name of names)assert.ok(a.group.getObjectByName(name));assert.ok(a.group.getObjectByName('saddle'));assert.ok(a.group.getObjectByName('horse-head'));
  a.update({motion:'walk',phase:.2});const first=names.map(name=>a.group.getObjectByName(name).rotation.x);a.update({motion:'walk',phase:.7});assert.notDeepEqual(names.map(name=>a.group.getObjectByName(name).rotation.x),first);
  for(const motion of ['idle','walk','run','attack','throw','brace','hit','withdrawn'])for(const phase of [0,.25,.6,1]){a.update({motion,phase,direction:1.4});assert.deepEqual(a.group.position.toArray(),[4,2,-3]);a.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
  a.update({motion:'idle',phase:0,direction:0});assert.ok(a.group.getObjectByName('horse').rotation.z===0);assert.ok(a.group.getObjectByName('hips').rotation.z===0);assert.ok(metrics(a).bounds.min.y>=1.99);a.dispose();
});

test('Civic withdrawal remains standing and lowered quality retains silhouettes with materially fewer triangles',()=>{
  const unit={id:'member2',name:'Landholders delegate1',side:'neutral',role:'voter',bloc:'Landholders'},civic=createActor(unit,{chapter:11});
  civic.update({motion:'yield',phase:1,health:.05});const bounds=metrics(civic).bounds;assert.ok(bounds.max.y>1.6&&bounds.min.y>=-.005);assert.ok(civic.group.getObjectByName('head').rotation.x>0);assert.ok(civic.group.getObjectByName('rolled-petition'));
  civic.update({motion:'withdrawn',phase:1,health:0});assert.ok(metrics(civic).bounds.max.y>1.6,'Political withdrawal must not collapse like a casualty.');civic.dispose();
  for(const unit of [{id:'hero',side:'player',role:'commander'},{id:'horse',name:'Persian cavalry',side:'enemy',role:'cavalry'}]){
    const full=createActor(unit,{chapter:7,quality:'high'}),low=createActor(unit,{chapter:7,quality:'performance'}),a=metrics(full),b=metrics(low);
    assert.equal(full.group.userData.actor.role,low.group.userData.actor.role);assert.ok(b.draws<=a.draws&&a.draws-b.draws<=3,'High cloth sheen may add at most three material batches; Performance retains fewer draws.');assert.ok(b.triangles<a.triangles*.8,`${b.triangles} <80% of${a.triangles}`);assert.ok(a.bounds.getSize(new T.Vector3()).distanceTo(b.bounds.getSize(new T.Vector3()))<.03);
    full.dispose();low.dispose();
  }
});
