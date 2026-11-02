import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as G from '../src/core/game.js';
import {createSoldier,packAdd} from '../src/core/soldier.js';
import {WORN_PLACES,PACK,ITEMS} from '../src/data/items.js';
import {inventoryScreen,dropCommand,selectionOf,otherFor,DOLL} from '../src/ui/inventory-views.js';
import {pieceOf,cellAt,nearestPiece} from '../src/ui/inventory-input.js';
import {Document} from './mini-dom.mjs';

// Release 13: the inventory screen and what a drop means. Every drop is a soldier command the rules already
// know (or a stated reason it cannot be), so dragging changes nothing a button could not.

const fixture=JSON.parse(readFileSync(new URL('./fixtures/graphics-scenes.json',import.meta.url),'utf8'));
const scene=n=>G.deserialize(JSON.stringify(fixture.scenes.find(s=>s.id===`camp-${n}`).state));
const camp=(extra={})=>({chapter:1,phase:'camp',decisions:{},company:[{id:'lucan',commendations:0}],chapterCapabilities:{},
  rng:{seed:7,state:123456789},soldier:createSoldier({path:'legionary'}),...extra});
const doc=html=>{const d=new Document();d.body.innerHTML=html;return d;};
const piece=(state,uid)=>{const e=state.soldier.pack.find(p=>p.uid===uid),item=ITEMS[e.id];return {from:'pack',uid,id:e.id,x:e.x,y:e.y,w:item.shape.w,h:item.shape.h};};
const run=(state,r)=>{assert.ok(r?.command,`a command: ${JSON.stringify(r)}`);const out=G.soldierCommand(state,r.command);assert.equal(out.ok,true,out.message);return out;};

test('the inventory shows every worn place, every pack piece in its shape, the ground and the sheet, and changes nothing',()=>{
  for(const n of [1,5,9,12]){
    const s=scene(n),before=G.serialize(s),d=doc(inventoryScreen(s));
    const sockets=d.querySelectorAll('.worn-socket');assert.equal(sockets.length,WORN_PLACES.length,`chapter ${n}: fifteen places`);
    assert.deepEqual(new Set(sockets.map(b=>b.dataset.place)),new Set(WORN_PLACES));
    assert.deepEqual([...DOLL.left,...DOLL.right].sort(),[...WORN_PLACES].sort(),'the doll holds each place once');
    const items=d.querySelectorAll('.pack-grid .pack-item');assert.equal(items.length,s.soldier.pack.length);
    for(const e of s.soldier.pack){
      const b=d.querySelector(`.pack-item[data-id="${e.uid}"]`),shape=ITEMS[e.id].shape;assert.ok(b,e.id);
      assert.match(b.getAttribute('style'),new RegExp(`grid-column:${e.x+1}/span ${shape.w};grid-row:${e.y+1}/span ${shape.h}`));
      assert.match(b.getAttribute('aria-label'),new RegExp(`column ${e.x+1}, row ${e.y+1}`));
    }
    assert.equal(d.querySelector('.pack-grid').dataset.drop,'pack');
    assert.ok(d.querySelector('[data-section="ground"]'));assert.match(d.querySelector('.inv-other').textContent,/training points/);
    assert.ok(d.querySelector('[data-soldier-preview]'),'his figure is in the middle');
    assert.equal(G.serialize(s),before,'rendering never changes the campaign or its generator');
  }
});

test('a pack piece dragged within the pack moves; to his figure or a worn place it is worn; to the ground it is left',()=>{
  const s=camp(),cloak=packAdd(s.soldier,'sagum'),charm=packAdd(s.soldier,'amulet_mars'),eye=packAdd(s.soldier,'eye_amulet');
  assert.equal(dropCommand(s,piece(s,cloak.uid),{to:'pack',x:cloak.x,y:cloak.y}),null,'dropped where it lies: nothing');
  assert.match(dropCommand(s,piece(s,cloak.uid),{to:'pack',x:9,y:0}).refusal,/does not fit/);
  const before=JSON.stringify(s);
  assert.match(dropCommand(s,piece(s,cloak.uid),{to:'worn',place:'head:1'}).refusal,/worn as a cloak/);
  assert.equal(JSON.stringify(s),before,'a refused drop sends nothing and changes nothing');
  run(s,dropCommand(s,piece(s,cloak.uid),{to:'pack',x:6,y:3}));assert.deepEqual([s.soldier.pack.find(p=>p.uid===cloak.uid).x,s.soldier.pack.find(p=>p.uid===cloak.uid).y],[6,3]);
  run(s,dropCommand(s,piece(s,cloak.uid),{to:'doll'}));assert.equal(s.soldier.worn['body:3'],'sagum');
  run(s,dropCommand(s,piece(s,charm.uid),{to:'worn',place:'charm:1'}));assert.equal(s.soldier.worn['charm:1'],'amulet_mars','the charm takes the place it is dropped on');
  run(s,dropCommand(s,piece(s,eye.uid),{to:'ground'}));assert.deepEqual(s.soldier.ground['camp:1'].map(g=>g.id),['eye_amulet']);
  // A piece he cannot use yet stays where it is, and says why.
  s.soldier.base.str=10;const axe=packAdd(s.soldier,'axe');assert.match(dropCommand(s,piece(s,axe.uid),{to:'doll'}).refusal,/Strength 12/);
  const quest=packAdd(s.soldier,'legion_records');assert.match(dropCommand(s,piece(s,quest.uid),{to:'doll'}).refusal,/cannot be worn/);
});

test('a worn piece goes to a chosen cell or the ground; a ground piece to a cell or onto him',()=>{
  const s=camp(),helmet={from:'worn',place:'head:1',id:'galea',w:2,h:2};
  assert.equal(dropCommand(s,helmet,{to:'worn',place:'head:1'}),null);
  run(s,dropCommand(s,helmet,{to:'pack',x:8,y:4}));const g=s.soldier.pack.find(p=>p.id==='galea');assert.deepEqual([g.x,g.y],[8,4]);
  const shield={from:'worn',place:'shield:0',id:'training_shield',w:2,h:4};
  run(s,dropCommand(s,shield,{to:'ground'}));const strip=s.soldier.ground['camp:1'];assert.deepEqual(strip.map(e=>e.id),['training_shield']);
  const lying={from:'ground',uid:strip[0].uid,id:'training_shield',w:2,h:4};
  assert.match(dropCommand(s,lying,{to:'pack',x:9,y:0}).refusal,/does not fit/);
  run(s,dropCommand(s,lying,{to:'doll'}));assert.equal(s.soldier.worn['shield:0'],'training_shield');assert.equal(s.soldier.ground['camp:1'],undefined);
  // The oath's seal is kept, worn or carried.
  s.soldier.worn['charm:0']='signaculum';assert.match(dropCommand(s,{from:'worn',place:'charm:0',id:'signaculum',w:1,h:1},{to:'ground'}).refusal,/keep/);
});

test('a chest gives a piece to the cell it is dropped on; a trader sells to a cell and buys what is dropped on him',()=>{
  const s=camp();s.soldier.denarii=200;
  const chest={from:'container',container:'c1-spare-kit',index:1,id:'calcei',w:2,h:1};
  assert.match(dropCommand(s,chest,{to:'doll'}).refusal,/Take it first/);
  run(s,dropCommand(s,chest,{to:'pack',x:3,y:5}));const boots=s.soldier.pack.find(p=>p.id==='calcei');assert.deepEqual([boots.x,boots.y],[3,5]);
  assert.deepEqual(s.soldier.opened,['c1-spare-kit:1']);
  const ware={from:'shop',shop:'smith',id:'tunic_winter',w:2,h:2};
  assert.match(dropCommand(s,ware,{to:'doll'}).refusal,/Buy it first/);
  run(s,dropCommand(s,ware,{to:'pack',x:8,y:0}));const tunic=s.soldier.pack.find(p=>p.id==='tunic_winter');assert.deepEqual([tunic.x,tunic.y],[8,0]);
  const purse=s.soldier.denarii;run(s,dropCommand(s,piece(s,tunic.uid),{to:'shop',shop:'smith'}));
  assert.ok(s.soldier.denarii>purse,'sold');assert.equal(s.soldier.pack.some(p=>p.id==='tunic_winter'),false);
  assert.match(dropCommand(s,{from:'worn',place:'head:1',id:'galea',w:2,h:2},{to:'shop',shop:'smith'}).refusal,/Take it off first/);
  const seal=packAdd(s.soldier,'signaculum');assert.match(dropCommand(s,piece(s,seal.uid),{to:'shop',shop:'smith'}).refusal,/keep/);
});

test('in a fight the screen can be read but nothing is dropped, and the selection names only what is there',()=>{
  const s=camp(),cap=packAdd(s.soldier,'arming_cap');
  const field={...s,phase:'encounter',encounter:{id:'ch1-road'}};
  assert.match(dropCommand(field,piece(s,cap.uid),{to:'doll'}).refusal,/in camp/);
  const d=doc(inventoryScreen(field));assert.equal(d.querySelectorAll('[data-piece]').length,0,'nothing is draggable in a fight');
  assert.equal(d.querySelectorAll('[data-drop="pack"]').length,1);assert.equal(d.querySelector('[data-drop="doll"]'),null);
  assert.deepEqual(selectionOf(s,cap.uid),{from:'pack',uid:cap.uid,id:'arming_cap',x:cap.x,y:cap.y});
  assert.deepEqual(selectionOf(s,'worn:head:1'),{from:'worn',place:'head:1',id:'galea'});
  assert.equal(selectionOf(s,'worn:head:9'),null);assert.equal(selectionOf(s,'i999'),null);
  assert.equal(selectionOf(s,'shop:tunic_winter'),null,'a trader’s piece only while trading');
  assert.equal(selectionOf(s,'shop:tunic_winter',{other:otherFor('smith')})?.from,'shop');
  assert.equal(selectionOf(s,'box:c1-armoury:0',{other:otherFor('container','c1-armoury')}),null,'a locked chest’s contents cannot be chosen');
  assert.equal(selectionOf(s,'box:c1-spare-kit:2',{other:otherFor('container','c1-spare-kit')})?.id,'key_c1');
});

test('the drag reads its piece from the page, finds the cell under the pointer and the next piece for an arrow key',()=>{
  const d=doc('<button data-piece="pack" data-uid="i4" data-item="galea" data-w="2" data-h="2" data-x="3" data-y="1"></button>'+
    '<button data-piece="container" data-container="c1-locker" data-index="1" data-item="wine_skin" data-w="1" data-h="2"></button>');
  const [a,b]=d.querySelectorAll('button');
  assert.deepEqual(pieceOf(a),{id:'galea',w:2,h:2,from:'pack',uid:'i4',x:3,y:1});
  assert.deepEqual(pieceOf(b),{id:'wine_skin',w:1,h:2,from:'container',container:'c1-locker',index:1});
  const rect={left:100,top:50};
  assert.deepEqual(cellAt(rect,40,{clientX:100+40*5+10,clientY:50+40*2+10},{w:2,h:2}),{x:4,y:1},'held by its middle, it lies where its picture is');
  assert.deepEqual(cellAt(rect,40,{clientX:100+40*5+10,clientY:50+40*2+10},{w:2,h:2},{x:.25,y:.25}),{x:5,y:2},'held by its top left corner');
  assert.deepEqual(cellAt(rect,40,{clientX:100+40*9+30,clientY:50+40*5+30},{w:2,h:3}),{x:8,y:3},'never past the pack’s edge');
  assert.deepEqual(cellAt(rect,40,{clientX:20,clientY:10},{w:1,h:1}),{x:0,y:0});
  const pieces=[{x:0,y:0,w:2,h:2},{x:2,y:0,w:1,h:3},{x:0,y:2,w:2,h:1},{x:5,y:4,w:1,h:1}];
  assert.equal(nearestPiece(pieces,pieces[0],'ArrowRight'),pieces[1]);
  assert.equal(nearestPiece(pieces,pieces[0],'ArrowDown'),pieces[2]);
  assert.equal(nearestPiece(pieces,pieces[0],'ArrowLeft'),null);
  assert.equal(nearestPiece(pieces,pieces[2],'ArrowRight'),pieces[1],'the nearest across, then along');
  assert.equal(PACK.cols*PACK.rows,60);
});
