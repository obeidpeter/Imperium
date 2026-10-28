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
