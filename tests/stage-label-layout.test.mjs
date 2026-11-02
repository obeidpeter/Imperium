import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutStageLabels,labelsOverlap} from '../src/showcase/stage-label-layout.js';

test('Crowded political labels remain within the viewport and never overlap',()=>{
  for(const width of [320,345,640,1368]){
    const input=Array.from({length:13},(_,i)=>Object.freeze({id:`member-${i}`,x:width/2+(i%4-1.5)*28,y:210+Math.floor(i/4)*24,width:i===0?132:34,height:i===0?48:19,priority:i===0?100:30,visible:true}));
    Object.freeze(input);const encoded=JSON.stringify(input),layout=layoutStageLabels(input,{width,height:420}),visible=[...layout.values()].filter(r=>r.visible);
    assert.ok(layout.get('member-0').visible,'The selected speaker has priority.');assert.ok(visible.length>=10,'Compact labels preserve a useful view of the electorate.');
    for(const [i,r]of visible.entries()){
      assert.ok(r.x>=8&&r.y>=8&&r.x+r.width<=width-8&&r.y+r.height<=412);
      assert.ok(visible.slice(i+1).every(other=>!labelsOverlap(r,other)));
    }
    assert.equal(JSON.stringify(input),encoded);assert.deepEqual([...layout],[...layoutStageLabels(input,{width,height:420})]);
  }
});

test('Offscreen and hidden figures cannot claim label space, and priorities survive an overcrowded viewport',()=>{
  const items=[{id:'selected',x:65,y:65,width:80,height:35,priority:100,visible:true},...Array.from({length:30},(_,i)=>({id:`crowd-${i}`,x:65,y:65,width:60,height:24,priority:1,visible:true})),{id:'hidden',x:65,y:65,width:80,height:35,priority:999,visible:false},{id:'outside',x:-2,y:40,width:20,height:12,visible:true}];
  const result=layoutStageLabels(items,{width:130,height:130});assert.ok(result.get('selected').visible);assert.equal(result.get('hidden').reason,'offscreen');assert.equal(result.get('outside').reason,'offscreen');assert.ok([...result.values()].some(r=>r.reason==='occluded'));
  const rows=[...result.values()].filter(r=>r.visible);assert.ok(rows.every((a,i)=>rows.slice(i+1).every(b=>!labelsOverlap(a,b))));
});

test('Horizon labels leave the selected body clear, preferring its label above rather than over its face',()=>{
  const body=Object.freeze({id:'hero',x:151,y:142,width:42,height:78}),items=Object.freeze([
    Object.freeze({id:'hero',x:172,y:150,width:135,height:48,priority:100,visible:true}),
    Object.freeze({id:'companion',x:177,y:201,width:100,height:24,priority:30,visible:true}),
    Object.freeze({id:'objective:exit',x:173,y:203,width:106,height:26,priority:60,visible:true}),
    Object.freeze({id:'enemy',x:194,y:208,width:82,height:24,priority:30,visible:true})
  ]),options=Object.freeze({width:345,height:384,obstacles:Object.freeze([body])}),before=JSON.stringify({items,options});
  const result=layoutStageLabels(items,options),hero=result.get('hero'),visible=[...result.values()].filter(r=>r.visible);
  assert.ok(hero.visible);assert.ok(hero.y+hero.height<body.y,'Selected name/health badge sits above the figure');
  for(const [i,label]of visible.entries()){assert.ok(!labelsOverlap(label,body,4),'No companion or objective badge covers the reserved silhouette');assert.ok(visible.slice(i+1).every(other=>!labelsOverlap(label,other)));}
  assert.equal(JSON.stringify({items,options}),before);assert.deepEqual([...result],[...layoutStageLabels(items,options)]);
});

test('Follow places a badge beside a tall figure near the top edge and hides labels when no clear space exists',()=>{
  const body={id:'mounted',x:100,y:10,width:100,height:220},item={id:'mounted',x:150,y:12,width:80,height:40,priority:100,visible:true};
  const visible=layoutStageLabels([item],{width:320,height:260,obstacles:[body]}).get('mounted');assert.ok(visible.visible);assert.ok(!labelsOverlap(visible,body,4));assert.ok(visible.x+visible.width<body.x||visible.x>body.x+body.width);
  const full={id:'mounted',x:0,y:0,width:320,height:260};const hidden=layoutStageLabels([item],{width:320,height:260,obstacles:[full]}).get('mounted');assert.equal(hidden.visible,false);assert.equal(hidden.reason,'occluded','Do not claim visibility by painting a name over the actor');
});

test('Missing, offscreen and invalid body bounds preserve the established label layout',()=>{
  const items=[{id:'hero',x:100,y:140,width:90,height:30,visible:true}],viewport={width:320,height:260},before=layoutStageLabels(items,viewport);
  const obstacles=[{x:NaN,y:0,width:100,height:100},{x:0,y:0,width:0,height:100},{x:400,y:0,width:100,height:100},{x:0,y:-120,width:100,height:100}];
  assert.deepEqual([...layoutStageLabels(items,{...viewport,obstacles})],[...before]);
});

// The 2D view places its names the same way (after Gate 4): in every camp, at a desktop and a phone's size, no two
// names it draws overlap, the soldier you control is named and no other name covers him, and a lasting mark keeps its
// room in its name's place. Presentation only: the world is read, never written, and the same frame places the same.
test('The 2D view names a camp without overlaps, clear of the soldier, keeping a mark’s room',async()=>{
  const G=await import('../src/core/game.js'),{FlatStage,createFlatPresenter}=await import('../src/showcase/flat-stage.js');
  const camp=chapter=>{const s=G.newGame('T',275,{featureEdition:35,progression:true,path:'legionary'});s.chapter=chapter;s.encounterIndex=0;s.phase='camp';return G.createCampWorld(s);};
  const frame=(world,width,height,marks={},notes=[])=>{
    const stage={screen:FlatStage.prototype.screen},texts=[];
    const v=FlatStage.prototype.view.call({canvas:{getBoundingClientRect:()=>({width,height})},cameraView:'follow',zoomLevel:1,lookOffset:{x:0,z:0}},world);
    const c=new Proxy({},{get:(t,k)=>k==='measureText'?text=>({width:String(text).length*7}):k in t?t[k]:(...a)=>{if(k==='fillText')texts.push({text:a[0],x:a[1],y:a[2]});},
      set:(t,k,value)=>{t[k]=value;return true;}});
    const presenter=createFlatPresenter({},{world:()=>world,alpha:()=>1});presenter.setMarks(marks);for(const [id,text]of notes)presenter.note(id,text);presenter.draw(c,v,stage,0);
    return {boxes:stage.labelBoxes,texts,v};
  };
  for(let chapter=1;chapter<=12;chapter++)for(const [width,height]of [[1280,640],[390,560]]){
    const world=camp(chapter),before=JSON.stringify(world),{boxes,v}=frame(world,width,height),where=`Chapter ${chapter} at ${width}`;
    assert.ok(boxes.length>=3,`${where}: names are drawn`);
    for(const [i,box]of boxes.entries()){
      assert.ok(boxes.slice(i+1).every(other=>!labelsOverlap(box,other)),`${where}: ${box.id} overlaps no other name`);
      assert.ok(box.x>=8&&box.y>=8&&box.x+box.width<=width-8&&box.y+box.height<=height-8,`${where}: ${box.id} is inside the view`);
    }
    const hero=world.actors.find(a=>a.id===world.controlled),p=FlatStage.prototype.screen(v,hero.x,hero.z);
    const body={x:p.x-v.tw*.22,y:p.y-v.th*2.6,width:v.tw*.44,height:v.th*2.9};
    assert.ok(boxes.some(b=>b.id===`actor:${hero.id}`),`${where}: the soldier is named`);
    assert.ok(boxes.every(b=>!labelsOverlap(b,body,4)),`${where}: no name covers the soldier`);
    assert.deepEqual(frame(world,width,height).boxes,boxes,`${where}: the same frame places the same`);
    assert.equal(JSON.stringify(world),before,`${where}: the world is unchanged`);
  }
  // A lasting mark rides above its name inside the name's place, so no other name can cover it.
  const world=camp(2),other=world.actors.find(a=>a.id!==world.controlled&&a.alive),id=`actor:${other.id}`;
  const plain=frame(world,1280,640).boxes.find(b=>b.id===id),marked=frame(world,1280,640,{[other.id]:{text:'!',color:'#fff'}});
  const box=marked.boxes.find(b=>b.id===id),mark=marked.texts.find(t=>t.text==='!');
  assert.ok(plain&&box&&mark,'the marked name and its mark are drawn');
  assert.ok(box.height>plain.height,'its place is taller by the mark');
  assert.ok(mark.y>box.y&&mark.y<box.y+box.height,'the mark is drawn inside it');
  // A passing number over every figure at once: each is placed after the names, clear of them, and no name moves.
  const crowd=camp(2),names=frame(crowd,1280,640).boxes,busy=frame(crowd,1280,640,{},crowd.actors.filter(a=>a.alive).map(a=>[a.id,'−7']));
  const floats=busy.boxes.filter(b=>b.id.startsWith('float:'));
  assert.ok(floats.length>=3,'the numbers are drawn');
  assert.deepEqual(busy.boxes.filter(b=>!b.id.startsWith('float:')),names,'no name moves for them');
  for(const f of floats)assert.ok(busy.boxes.every(b=>b===f||!labelsOverlap(f,b)),`${f.id} crosses no name or number`);
});
