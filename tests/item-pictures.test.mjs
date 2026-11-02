// Release 13: the inventory's item pictures. Every item shows a rendered picture from the one item atlas, or keeps
// its drawn silhouette by name; each picture's place lies inside the atlas, which ships at its recorded size within
// its budget, and every picture's model is a recorded, paid generation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ITEMS} from '../src/data/items.js';
import {ITEM_ATLAS,ITEM_DRAWN,ITEM_PICTURES} from '../src/data/item-pictures.js';
import {itemPicture} from '../src/ui/item-art.js';
import {chapterAssets} from '../src/ui/art.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url));
const plan=JSON.parse(read('art-source/items/item-pictures.json'));

test('every item has a rendered picture or keeps its drawn silhouette, never both',()=>{
  for(const id of Object.keys(ITEMS))assert.ok(!!ITEM_PICTURES[id]!==ITEM_DRAWN.includes(id),`${id}: a picture or drawn`);
  for(const id of [...Object.keys(ITEM_PICTURES),...ITEM_DRAWN])assert.ok(ITEMS[id],`${id} is an item`);
  // The data is the plan's: each picture serves exactly its listed items.
  assert.deepEqual(Object.keys(ITEM_PICTURES).sort(),Object.values(plan.pictures).flatMap(p=>p.items).sort());
  assert.deepEqual([...ITEM_DRAWN].sort(),[...plan.drawn].sort());
});

test('each picture lies inside the atlas at its planned shape, and pictures do not overlap',()=>{
  const slots=new Map();
  for(const [name,picture]of Object.entries(plan.pictures)){
    const [cw,ch]=picture.cells.split('x').map(Number),places=picture.items.map(id=>ITEM_PICTURES[id]);
    for(const place of places)assert.deepEqual(place,places[0],`${name}: one place for all its items`);
    const [x,y,w,h]=places[0];
    assert.ok(x>=0&&y>=0&&x+w<=ITEM_ATLAS.width&&y+h<=ITEM_ATLAS.height,`${name} inside the atlas`);
    assert.deepEqual([w,h],[cw*ITEM_ATLAS.cell,ch*ITEM_ATLAS.cell],`${name}: ${picture.cells} cells`);
    slots.set(name,places[0]);
  }
  const all=[...slots];
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    const [a,[ax,ay,aw,ah]]=all[i],[b,[bx,by,bw,bh]]=all[j];
    assert.ok(ax+aw<=bx||bx+bw<=ax||ay+ah<=by||by+bh<=ay,`${a} and ${b} overlap`);
  }
});

test('the atlas ships as a WebP of its recorded size and dimensions, within its budget, in every chapter',()=>{
  const file=read(ITEM_ATLAS.src.replace(/^\.\//,''));
  assert.equal(file.length,ITEM_ATLAS.bytes,'The recorded byte count');
  assert.ok(file.length<=120*1024,`${file.length} bytes: the plan's 120 KB`);
  assert.equal(file.toString('latin1',0,4),'RIFF');assert.equal(file.toString('latin1',8,12),'WEBP');
  // An extended WebP (alpha) names its canvas in the VP8X chunk: 24-bit width and height, less one.
  assert.equal(file.toString('latin1',12,16),'VP8X');
  assert.equal(file.readUIntLE(24,3)+1,ITEM_ATLAS.width);assert.equal(file.readUIntLE(27,3)+1,ITEM_ATLAS.height);
  for(let chapter=1;chapter<=12;chapter++)assert.ok(chapterAssets(chapter).includes(ITEM_ATLAS.src),`Chapter ${chapter} carries the atlas`);
});

test('a pictured item shows its place in the atlas; a drawn one keeps its silhouette; both are decorative',()=>{
  const id=Object.keys(ITEM_PICTURES)[0],html=itemPicture(id),[x,y,w,h]=ITEM_PICTURES[id];
  assert.match(html,new RegExp(`<svg class="kit-art kit-picture" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"`));
  assert.match(html,new RegExp(`<image href="${ITEM_ATLAS.src.replace(/[.]/g,'\\.')}" width="${ITEM_ATLAS.width}" height="${ITEM_ATLAS.height}"/>`));
  const drawn=itemPicture(ITEM_DRAWN[0]);
  assert.doesNotMatch(drawn,/<image/);assert.match(drawn,/<svg class="kit-art" viewBox="0 0 64 64" aria-hidden="true"/);
  // A fine piece shares its kind's picture in its own finish.
  const tinned=Object.keys(ITEM_PICTURES).find(i=>ITEMS[i].visuals?.finish==='tinned');
  assert.ok(tinned);assert.match(itemPicture(tinned),/data-finish="tinned"/);
  assert.doesNotMatch(itemPicture('nonexistent'),/<image/,'An unknown id draws the plain silhouette');
});

test('every picture comes from a recorded generation paid from the item-pictures credits',()=>{
  const ledger=JSON.parse(read('art-source/models/item-pictures-credits.json'));
  const tasks=new Map(ledger.batches.flatMap(b=>b.tasks.map(t=>[t.id,t])));
  for(const [name,picture]of Object.entries(plan.pictures)){
    const request=JSON.parse(read(`art-source/models/requests/${picture.request}.json`));
    assert.equal(request.provenance.program,'item-pictures',`${name}: the item-pictures program`);
    assert.equal(tasks.get(picture.request)?.taskId,request.provenance.taskId,`${name}: its task is in the ledger`);
    assert.match(request.status,/^accepted/,`${name}: its model was accepted at review`);
  }
  const spent=ledger.batches.reduce((sum,b)=>sum+b.tasks.reduce((s,t)=>s+t.accountedCredits,0),0);
  assert.equal(ledger.spentCredits,spent);assert.ok(spent<=ledger.authorization.credits,'Within the authorised credits');
  assert.equal(ledger.remainingAuthorization,ledger.authorization.credits-spent);
});
