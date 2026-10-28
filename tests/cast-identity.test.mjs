import test from 'node:test';
import assert from 'node:assert/strict';
import {actorIdentity,castMember} from '../src/showcase/actor-identity.js';
import {actorKit} from '../src/showcase/actor-kit.js';

// Who a figure is drawn as (worlds and gameplay plan, release 6): a name draws the person
// it names, never those he leads or keeps, and a wound comes from the story, not a name.

test('a name draws its own person, not his men, his horse or his advocate', () => {
  for(const [name,key]of [['Varro','varro'],['Campidoctor Varro','varro'],['Aurelius Lucan','lucan'],['Wounded Lucan','lucan'],['Varro and his wounded guard','varro'],
    ['Explorator Brennus','brennus'],['Signifer Quintus','quintus'],['Tribune Crispus','crispus'],['Aelia Dacia','aelia']])assert.equal(castMember(name),key,name);
  for(const name of ['Lucan’s squad','Lucan’s horse',"Lucan's squad",'Felix’s archers','Crispus’s advocate','Roman line','The duty clerk','Settler families'])assert.equal(castMember(name),null,name);
  assert.equal(actorIdentity({name:'Lucan’s squad',side:'ally',role:'infantry'},{chapter:7}).key.startsWith('figure-'),true,'A squad named for Lucan is drawn as one of his men');
  assert.equal(actorIdentity({name:'Crispus’s advocate',role:'speaker'},{chapter:11}).key.startsWith('figure-'),true,'Crispus’s advocate has his own face');
  assert.equal(actorIdentity({name:'Lucan’s squad',veteranId:'lucan',side:'ally'},{chapter:4}).key,'lucan','A company veteran is drawn as himself');
});

test('a wound shows only where the story gives it: never on Varro in the camps', () => {
  const camp=name=>actorKit({name,side:'neutral'},{chapter:2});
  assert.equal(camp('Varro').wounded,false,'Varro in camp carries no sling');assert.equal(camp('Campidoctor Varro').wounded,false);
  assert.equal(actorKit({name:'Varro and his wounded guard',role:'escort',side:'ally'},{chapter:6}).wounded,true,'Chapter VI’s wounded column');
  assert.equal(actorKit({name:'Wounded Lucan',role:'escort',side:'ally'},{chapter:2}).wounded,true,'Lucan in the marsh');
  assert.equal(actorKit({name:'The eagle-bearer',role:'escort',side:'ally'},{chapter:6}).wounded,false);
});

test('the shared head blinks over its painted eyes, and frowns at its brows', async () => {
  const T=await import('../vendor/three/three.module.js'),{readFile}=await import('node:fs/promises');
  const {GLTFLoader}=await import('../vendor/three/addons/loaders/GLTFLoader.js'),{MeshoptDecoder}=await import('../vendor/three/addons/libs/meshopt_decoder.module.js');
  const {clipBodyAtNeck,sculptGeneratedHead,HEAD_FEATURES,IDENTITY_HEAD_BODY}=await import('../src/showcase/generated-identity.js');
  const bytes=await readFile(new URL(`../assets/models/characters/${IDENTITY_HEAD_BODY}.glb`,import.meta.url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(()=>({name:'NODE_IMAGE_PLACEHOLDER',loadTexture:async()=>new T.Texture()}));loader.pluginCallbacks.unshift(loader.pluginCallbacks.pop());
  const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const head=sculptGeneratedHead(clipBodyAtNeck(gltf.scene.getObjectByName('body').geometry,{above:true}),actorIdentity({name:'Naso'},{chapter:5}));
  const p=head.attributes.position,[,focus,,blink]=head.morphAttributes.position;
  // Where each morph moves the face most: the blink's lids meet on the eyes' own line, the frown's brows lie just above them.
  const peak=a=>{let best=0,at=0;for(let i=0;i<a.count;i++){const d=Math.hypot(a.getX(i),a.getY(i),a.getZ(i));if(d>best){best=d;at=p.getY(i);}}return {at,best};};
  const lids=peak(blink),brows=peak(focus);
  assert.ok(Math.abs(lids.at-HEAD_FEATURES.eyes)<.012&&lids.best>.004,`the lids close on the eyes (${lids.at.toFixed(3)} m)`);
  assert.ok(brows.at>HEAD_FEATURES.eyes&&brows.at<HEAD_FEATURES.brows+.025,`the frown sits at the brows (${brows.at.toFixed(3)} m)`);
  let above=0;for(let i=0;i<p.count;i++)if(p.getY(i)>HEAD_FEATURES.brows+.012)above=Math.max(above,Math.abs(blink.getY(i)));
  assert.ok(above<.001,`the forehead stays still in a blink (${above.toFixed(4)} m)`);
  head.dispose();
});
