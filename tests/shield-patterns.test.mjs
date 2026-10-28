import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three/three.module.js';
import {SHIELD_DESIGNS,shieldDesign,shieldDecals,shieldFaceZ} from '../src/showcase/shield-patterns.js';
import {actorKit} from '../src/showcase/actor-kit.js';
import {actorIdentity} from '../src/showcase/actor-identity.js';
import {createActor} from '../src/showcase/actors.js';

// Shields from a pattern library (worlds and gameplay plan, release 6): each faction carries
// its own designs, a unit one design, and every design lies on the shield's face.
const ROMAN=['wreath','rosette','rings','rays','wings'],NAMED=['sun','chevron','bars'];
const design=(unit,chapter)=>{const kit=actorKit(unit,{chapter});return shieldDesign(kit,actorIdentity(unit,kit)).id;};

test('each faction carries its own designs: no Goth, Persian or Palmyrene bears the Roman wings', () => {
  const seen={};
  for(const [faction,chapter]of [['Roman',3],['Gothic',3],['Persian',5],['Palmyrene',9]])for(let i=0;i<120;i++){
    const unit={id:`u${i}`,name:faction==='Roman'?`Roman line ${i}`:`${faction} band ${i}`,side:faction==='Roman'?'ally':'enemy',role:faction==='Roman'?'infantry':'raider'};
    const id=design(unit,chapter);(seen[faction]??=new Set()).add(id);assert.equal(design(unit,chapter),id,'a unit keeps its design');
  }
  assert.deepEqual([...seen.Roman].sort(),[...ROMAN].sort(),'Romans use every Roman design');
  assert.deepEqual([...seen.Gothic].sort(),['halved','quartered','rimmed','ringed']);
  assert.deepEqual([...seen.Persian],['wicker']);assert.deepEqual([...seen.Palmyrene].sort(),['round-rings','round-rosette']);
  for(const faction of ['Gothic','Persian','Palmyrene'])for(const id of [...ROMAN,...NAMED])assert.ok(!seen[faction].has(id),`${faction} never carries ${id}`);
  assert.equal(design({id:'veteran-lucan',veteranId:'lucan',name:'Aurelius Lucan',side:'ally',role:'infantry'},4),'sun');
  assert.equal(design({id:'veteran-sabinus',veteranId:'sabinus',name:'Gaius Sabinus',side:'ally',role:'infantry'},4),'chevron');
  assert.equal(design({id:'varro',name:'Varro',side:'ally',role:'infantry'},2),'bars');
  assert.equal(design({id:'hero',name:'Marcellus',side:'player',role:'soldier'},4),'wreath');
});

test('every design lies on the shield\'s face, inside its rim, and stays cheap', () => {
  for(const id of SHIELD_DESIGNS){
    const parts=shieldDecals(id);let triangles=0;
    for(const {paint,geometry}of parts){
      assert.ok(['motif','field','dark'].includes(paint));const p=geometry.attributes.position,index=geometry.index;triangles+=index.count/3;
      const uv=i=>[p.getX(i)/.257,(p.getY(i)-.03)/.392];
      for(let i=0;i<p.count;i++){const [u,v]=uv(i);assert.ok(u*u+v*v<=.985**2+1e-6,`${id}: inside the rim`);assert.ok(Math.abs(p.getZ(i)-shieldFaceZ(u,v)-.0022)<1e-6,`${id}: on the face`);}
      for(let t=0;t<index.count;t+=3){
        const [a,b,c]=[0,1,2].map(k=>index.getX(t+k)),cu=(uv(a)[0]+uv(b)[0]+uv(c)[0])/3,cv=(uv(a)[1]+uv(b)[1]+uv(c)[1])/3,cz=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
        assert.ok(cz>shieldFaceZ(cu,cv)+.0008,`${id}: a triangle's middle stays over the curved face`);
        const ab=new T.Vector3(p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),0),ac=new T.Vector3(p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),0);
        assert.ok(ab.cross(ac).z>0,`${id}: faces outward`);
      }
    }
    // No more than the old emblem's cost plus a little: the code-built figures keep their cap.
    assert.ok(triangles>0&&triangles<=200,`${id}: ${triangles} triangles`);
  }
});

test('a figure paints its design into the shield\'s own surface: no new draw or kind of surface', () => {
  // Parts merge by material kind with their colours baked per vertex, so a design's field
  // joins the board's surface; its colour shows in that surface's vertex colours.
  const hue=(r,g,b)=>new T.Color(r,g,b).getHSL({}).h,near=(a,b)=>Math.min(Math.abs(a-b),1-Math.abs(a-b))<.03;
  const surfaceHues=actor=>{const hues=[];actor.group.traverse(o=>{if(o.isMesh&&o.material.name==='painted wooden shield'){const c=o.geometry.attributes.color;for(let i=0;i<c.count;i++)hues.push(hue(c.getX(i),c.getY(i),c.getZ(i)));}});return hues;};
  const goth=createActor({id:'g',name:'Gothic band 7',side:'enemy',role:'raider'},{chapter:3}),kit=actorKit({name:'Gothic band 7',side:'enemy',role:'raider'},{chapter:3});
  const chosen=shieldDesign(kit,actorIdentity({name:'Gothic band 7'},kit));assert.equal(goth.group.userData.actor.shieldDesign,chosen.id);assert.ok(chosen.field);
  const hues=surfaceHues(goth),field=hue(...new T.Color(chosen.field).toArray());
  assert.ok(hues.some(h=>near(h,field)),'the field\'s colour is on the board\'s surface');
  let surfaces=0;goth.group.traverse(o=>{if(o.isMesh&&o.material.name==='painted shield field')surfaces++;});assert.equal(surfaces,0,'no surface of its own');
  const persian=createActor({id:'p',name:'Persian band 2',side:'enemy',role:'raider'},{chapter:5});
  assert.equal(persian.group.userData.actor.shieldDesign,'wicker');assert.ok(surfaceHues(persian).some(h=>near(h,hue(...new T.Color(0x9a7d56).toArray()))),'raw hide over the wickerwork');
  goth.dispose();persian.dispose();
});
