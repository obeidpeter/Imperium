import {serialize,deserialize} from '../core/game.js';

// Quick save (F2) and five named saves (guide "Saving", build brief §3.17):
// complete chronicles kept on this device beside its automatic save, each
// with a picture of the moment. A new chronicle replaces them all.

const KEY='imperium.slots';
export const SLOT_IDS=Object.freeze(['quick','1','2','3','4','5']);
const checksum=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
function read(storage){try{const all=JSON.parse(storage?.getItem(KEY)??'{}');return all&&typeof all==='object'?all:{};}catch{return {};}}
// What each slot holds, without reading the chronicles in it.
export function listSlots(storage=globalThis.localStorage){
  const all=read(storage);
  return SLOT_IDS.map(id=>{const e=all[id];return e?{id,name:e.name,savedAt:e.savedAt,summary:e.summary,thumbnail:e.thumbnail??null}:{id,empty:true};});
}
export function writeSlot(id,state,{name='',summary='',thumbnail=null}={},storage=globalThis.localStorage){
  if(!SLOT_IDS.includes(id))throw new Error('Unknown save slot.');
  const all=read(storage),payload=serialize(state);
  all[id]={name:String(name).slice(0,60),summary:String(summary).slice(0,120),thumbnail:typeof thumbnail==='string'&&thumbnail.length<120000?thumbnail:null,
    savedAt:new Date().toISOString(),payload,checksum:checksum(payload)};
  try{storage.setItem(KEY,JSON.stringify(all));}catch{throw new Error('This device has no room for another save. Clear a slot, or copy a save code.');}
}
// The chronicle in a slot; a damaged one is refused, never half-loaded.
export function readSlot(id,storage=globalThis.localStorage){
  const e=read(storage)[id];if(!e)throw new Error('That save is empty.');
  if(typeof e.payload!=='string'||e.checksum!==checksum(e.payload))throw new Error('That save is damaged and cannot be loaded.');
  return deserialize(e.payload);
}
export function clearSlots(storage=globalThis.localStorage){try{storage.removeItem(KEY);}catch{}}
