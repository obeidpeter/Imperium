import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBattle} from '../src/ui/renderer.js';

function recordCanvas(){
  const calls=[],stack=[];let properties={globalAlpha:1},gradient=0;
  const c=new Proxy({}, {get(_,key){
    if(key==='save')return()=>stack.push({...properties});if(key==='restore')return()=>{properties=stack.pop()??properties;};
    if(key==='createLinearGradient'||key==='createRadialGradient')return(...args)=>{calls.push([key,...args]);return {id:++gradient,addColorStop(...stops){calls.push(['stop',...stops]);}};};
    if(key==='measureText')return text=>({width:String(text).length*7});if(key in properties)return properties[key];
    return(...args)=>calls.push([key,...args,properties.globalAlpha,typeof properties.fillStyle==='object'?properties.fillStyle.id:properties.fillStyle]);
  },set(_,key,value){properties[key]=value;return true;}});
  return {width:360,height:196,calls,getBoundingClientRect:()=>({left:0,top:0,width:360,height:196}),getContext:()=>c};
}
const u=(id,x,y,extra={})=>({id,name:id,x,y,hp:12,maxHp:12,side:'ally',role:'infantry',facing:'east',...extra});
const encounter=kind=>({id:'saved-mid-encounter',kind,width:8,height:8,terrain:Array.from({length:8},()=>Array(8).fill(kind==='contest'?'chamber':'grass')),units:[u('hero',1,3,{side:'player',...(kind==='contest'?{resolve:12,maxResolve:12}:{} )}),u('withdrawn',3,3,{hp:0,...(kind==='contest'?{resolve:0,maxResolve:12}:{} )}),u('hidden',4,4,{hidden:true})]});

test('Arrival animation never resurrects a withdrawn battle unit or political speaker from a resumed save',()=>{
  for(const kind of ['battle','contest']){
    const e=encounter(kind),before=JSON.stringify(e),without=structuredClone(e);without.units=without.units.filter(unit=>unit.id==='hero');
    for(const time of [0,250,5800]){
      const full=recordCanvas(),expected=recordCanvas();drawBattle(full,e,'hero',[],null,kind==='contest'?11:2,{ambientTime:time});drawBattle(expected,without,'hero',[],null,kind==='contest'?11:2,{ambientTime:time});
      assert.deepEqual(full.calls,expected.calls,'Invisible/withdrawn units must submit no additional drawing during ambient frames');
    }
    assert.equal(JSON.stringify(e),before);
  }
});

test('Explicit action retreat frames still draw the withdrawing unit, then remove it at alpha zero',()=>{
  const e=encounter('battle');e.units=e.units.filter(unit=>!unit.hidden);
  const staticBoard=recordCanvas(),retreat=recordCanvas(),finished=recordCanvas();drawBattle(staticBoard,e,'hero',[],null,1,{animation:{time:250,unitOverrides:{},effects:[]}});
  const frame=alpha=>({time:250,unitOverrides:{withdrawn:{x:3,y:3,pose:'retreat',progress:.5,alpha,lean:0,bob:0}},effects:[]});
  drawBattle(retreat,e,'hero',[],null,1,{animation:frame(.5)});drawBattle(finished,e,'hero',[],null,1,{animation:frame(0)});
  assert.ok(retreat.calls.length>staticBoard.calls.length,'A withdrawing figure remains visible during its departure');assert.deepEqual(finished.calls,staticBoard.calls,'The figure disappears when the action timeline reaches zero alpha');
});
