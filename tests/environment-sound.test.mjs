import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ENVIRONMENT_SOUND_KINDS,environmentSoundSamples,regionalSoundPalette} from '../src/ui/environment-sound.js';

test('Original environmental performances are distinct, finite, deterministic and short, with click-free endpoints',()=>{
  const hashes=new Set(),original=Math.random;Math.random=()=>{throw Error('Audio must not use gameplay randomness');};
  try{for(const kind of ENVIRONMENT_SOUND_KINDS){
    const {samples,sampleRate}=environmentSoundSamples(kind);assert.ok(samples.length/sampleRate<=1.61);
    assert.equal(samples[0],0);assert.equal(Math.abs(samples.at(-1)),0);assert.ok(samples.every(value=>Number.isFinite(value)&&Math.abs(value)<=.801));
    assert.deepEqual(samples,environmentSoundSamples(kind).samples);assert.ok(samples.some(value=>Math.abs(value)>.02));
    hashes.add(createHash('sha256').update(new Uint8Array(samples.buffer)).digest('hex'));
  }}finally{Math.random=original;}
  assert.equal(hashes.size,ENVIRONMENT_SOUND_KINDS.length);assert.equal(environmentSoundSamples('unrecognized'),null);
});

test('Each chapter selects supported local sound textures without exposing a mutable shared palette',()=>{
  const palettes=[];for(let chapter=1;chapter<=12;chapter++){
    const sounds=regionalSoundPalette(chapter);assert.equal(sounds.length,2);assert.ok(sounds.every(sound=>ENVIRONMENT_SOUND_KINDS.includes(sound)));
    palettes.push(sounds.join(','));sounds[0]='invalid';assert.notEqual(regionalSoundPalette(chapter)[0],'invalid');
  }
  assert.ok(new Set(palettes).size>=9);
});
