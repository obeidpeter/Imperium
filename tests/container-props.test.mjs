import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three/three.module.js';
import * as Game from '../src/core/game.js';
import {CONTAINER_KINDS,FIELD_CONTAINERS} from '../src/data/containers.js';
import {campFor} from '../src/data/camps.js';
import {createContainerProps,containerShape} from '../src/showcase/container-props.js';
import {stageContainers} from '../src/showcase/live-figures.js';
import {campRuntimeKey} from '../src/ui/camp-runtime.js';
import {createFlatPresenter} from '../src/showcase/flat-stage.js';
import {CAMP_CONTAINERS} from '../src/data/containers.js';

// Release 11: the chests, caches and the armourer's forge as the stage draws them. Presentation
// only: built from the scenery's own pieces, kept off the stage while hidden, and never a reason
// to rebuild the camp's scenery.
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const campState=chapter=>{const s=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`camp-${chapter}`).state));s.decisions.ch2??='carry';return s;};
const fieldOf=id=>{const s=Game.deserialize(JSON.stringify(fixtures.scenes.find(x=>x.id===`board-${id}`).state));assert.ok(Game.restartInRealtime(s).ok,id);return s;};

test('every kind of container builds closed, open, emptied and locked from the fieldwork kit’s own materials, batched',()=>{
  const scene=new T.Scene(),props=createContainerProps(scene,{heightAt:()=>0});
  const list=Object.keys(CONTAINER_KINDS).flatMap((box,i)=>[
    {id:`${box}-shut`,box,x:i*3,z:0,face:[0,1],open:false,empty:false,lockable:true,locked:true},
    {id:`${box}-open`,box,x:i*3,z:3,face:[1,0],open:true,empty:false,lockable:true,locked:false},
    {id:`${box}-empty`,box,x:i*3,z:6,face:[0,-1],open:true,empty:true,lockable:false,locked:false}]);
  assert.ok(props.sync(list));
  const materials=new Set();props.group.traverse(o=>{if(o.isMesh){materials.add(o.material);assert.ok(o.material.isMeshStandardMaterial,'the scenery’s program family');}});
  assert.ok([...materials].every(m=>/^fieldwork /.test(m.name)),'only the fieldwork kit’s materials');
  const stats=props.stats();assert.equal(stats.containers,list.length);
  assert.ok(stats.drawBatches<=materials.size+2,`batched by material: ${stats.drawBatches} draws for ${materials.size} materials`);
  assert.equal(props.sync(list),false,'the same containers rebuild nothing');
  // An open chest stands taller than a shut one: its lid leans back.
  const height=id=>{const one=createContainerProps(new T.Scene());one.sync([list.find(c=>c.id===id)]);const b=new T.Box3().setFromObject(one.group);one.dispose();return b.max.y;};
  assert.ok(height('chest-open')>height('chest-shut')+.2);
  for(const box of Object.keys(CONTAINER_KINDS))assert.ok(containerShape(box),box);
  props.dispose();assert.equal(scene.children.length,0);
  // In the scenery's own palette (environment.js lends it), only its materials are drawn, and they are never disposed here.
  const palette=Object.fromEntries(['wood','darkWood','iron','cloth','rope','stone'].map(k=>[k,new T.MeshStandardMaterial({name:`palette ${k}`})]));
  let disposedPalette=0;for(const m of Object.values(palette))m.addEventListener('dispose',()=>disposedPalette++);
  const lent=createContainerProps(new T.Scene(),{palette});lent.sync(list);
  const used=new Set();lent.group.traverse(o=>{if(o.isMesh)used.add(o.material);});
  assert.ok([...used].every(m=>Object.values(palette).includes(m)),'only the palette’s materials');
  lent.dispose();assert.equal(disposedPalette,0,'the scenery’s materials are left to the scenery');
});

test('the stage shows a battlefield cache only once it is found, and the field’s containers face the board',()=>{
  const [id,list]=Object.entries(FIELD_CONTAINERS).find(([,l])=>l.some(c=>c.hidden)),state=fieldOf(id),world=Game.realtimeWorld(state);
  const cache=world.objects.find(o=>o.kind==='container'&&o.hidden);
  assert.ok(!stageContainers(world).some(c=>c.id===cache.id),'hidden: not drawn');
  cache.hidden=false;const shown=stageContainers(world).find(c=>c.id===cache.id);
  assert.ok(shown&&!shown.open&&!shown.empty);assert.ok(Math.abs(Math.hypot(...shown.face)-1)<.01);
  assert.equal(stageContainers(world).length,list.length);
});

test('opening a camp chest changes the camp world, never its scenery; every camp has its forge behind the armourer',()=>{
  const state=campState(1),scenery=JSON.stringify(Game.campPresentationFor(state)),runtime=campRuntimeKey(state);
  assert.ok(Game.soldierCommand(state,{kind:'takeFrom',containerId:'c1-spare-kit'}).ok);
  assert.equal(JSON.stringify(Game.campPresentationFor(state)),scenery,'the scenery is not rebuilt');
  assert.notEqual(campRuntimeKey(state),runtime,'the camp world shows the emptied chest');
  const world=Game.createCampWorld(state),chest=world.objects.find(o=>o.container==='c1-spare-kit');
  assert.ok(chest.empty);assert.ok(stageContainers(world).find(c=>c.id===chest.id).empty);
  for(let chapter=1;chapter<=12;chapter++){
    const s=campState(chapter),p=Game.campPresentationFor(s),camp=campFor(chapter),w=Game.createCampWorld(s);
    const smith=w.actors.find(a=>a.id==='smith'),hx=w.map.width*1.25,hz=w.map.height*1.25;
    assert.ok(p.smithy,`chapter ${chapter}: the forge`);assert.ok(smith,`chapter ${chapter}: the armourer`);
    const at={x:p.smithy.x+hx,z:p.smithy.z+hz},place=w.places[camp.people.find(x=>x.id==='smith').place];
    assert.ok(Math.hypot(at.x-place.x,at.z-place.z)>Math.hypot(smith.x-place.x,smith.z-place.z),`chapter ${chapter}: behind him, away from the place's centre`);
    for(const o of w.objects)assert.ok(Math.hypot(o.x-at.x,o.z-at.z)>1.2,`chapter ${chapter}: clear of ${o.id}`);
  }
});

test('the 2D view draws the forge and the containers in sight, a lock while locked, and never a hidden cache',()=>{
  const [chapter,list]=Object.entries(CAMP_CONTAINERS).find(([,l])=>l.some(c=>c.hidden)),world=Game.createCampWorld(campState(Number(chapter)));
  // The view names what it draws where there is room (stage-label-layout.js): a stand-in canvas that measures text, as
  // the suite's others do, and the camp spread across a view a little larger than it.
  const S=40,draw=()=>{const calls=[],c=new Proxy({},{get:(t,k)=>k==='measureText'?text=>({width:String(text).length*7}):k in t?t[k]:(...a)=>{calls.push([k,a]);},
    set:(t,k,v)=>{t[k]=v;return true;}});
    createFlatPresenter({},{world:()=>world,alpha:()=>1}).draw(c,{tw:32,th:16,w:(world.map.width*2.5+20)*S,h:(world.map.height*2.5+20)*S},{screen:(v,x,z)=>({x:x*S,y:z*S})},0);return calls;};
  const texts=calls=>calls.filter(([k])=>k==='fillText').map(([,a])=>a[0]);
  const hidden=list.find(c=>c.hidden),locked=list.find(c=>c.lock);
  let calls=draw();
  assert.ok(!texts(calls).some(t=>t.startsWith(hidden.name)),'a hidden cache is not drawn');
  assert.ok(texts(calls).includes(`${locked.name} (locked)`),'a locked chest says so');
  const forge=world.campPresentation.smithy,fx=forge.x+world.map.width*1.25;
  assert.ok(calls.some(([k,a])=>k==='fillRect'&&Math.abs(a[0]-(fx*S-32*.18))<1e-6),'the forge is drawn where it stands');
  world.objects.find(o=>o.container===hidden.id).hidden=false;
  assert.ok(texts(draw()).some(t=>t.startsWith(hidden.name)),'found, it is drawn');
});
