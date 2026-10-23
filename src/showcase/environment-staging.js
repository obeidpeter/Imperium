import {terrainAt,gridToWorld,clamp,smooth} from './environment-layout.js';

// These are place compositions, never mission markers or collision data.
// The stage may borrow yaw/pitch, but must retain its own fit and clearance.
const plans={
  'ch1-training':['recruit-parade','The fort parade ground','west','east','parade',.65,.68],
  'ch1-road':['boundary-watch','The watch road and baggage court','west','east','checkpoint',.82,.62],
  'ch2-marsh':['broken-causeway','A raised road through the flooded landing','west','east','causeway',.75,.67],
  'ch2-rearguard':['reed-redoubt','The rear guard at a timber refuge','west','south','refuge',.42,.66],
  'ch3-station':['courier-court','The deserted courier courtyard','west','north','courier',.70,.66],
  'ch3-rolls':['archive-departure','The archive cart departure road','west','east','archive',.55,.64],
  'ch4-gate':['fort-gate','The inner gate forecourt','west','east','gate',.70,.65],
  'ch4-wall':['wall-sally','A sally passage beneath the curtain','west','north','sally',.62,.67],
  'ch5-mine':['siege-breach','The siege works and cracked tower','west','east','breach',.65,.65],
  'ch5-wall':['euphrates-gate','The defended river-gate terrace','west','north','gate',.72,.65],
  'ch6-wells':['well-caravan','The abandoned well caravanserai','west','east','well',.70,.66],
  'ch6-eagle':['standard-retreat','The stripped convoy court','west','east','convoy',.50,.65],
  'ch7-council':['legion-principia','The open principia council','south','north','council',.45,.70],
  'ch7-legion':['legion-street','A legion assembled beside its tent street','west','east','camp',.70,.65],
  'ch8-parley':['ford-pavilion','The neutral landing above the ford','south','north','pavilion',.55,.68],
  'ch8-ferry':['evacuation-quay','The ferry departure court','west','north','quay',.70,.68],
  'ch8-crossing':['bridgehead','The far-bank bridgehead','west','east','bridgehead',.65,.68],
  'ch9-wing':['desert-avenue','The open avenue outside Palmyra','west','east','avenue',.42,.65],
  'ch9-city':['palmyra-threshold','The city gate and portico court','west','east','city-gate',.58,.68],
  'ch10-road':['grain-distribution','The granary loading court','west','east','granary',.62,.68],
  'ch10-tribunal':['provincial-basilica','The governor’s basilica and record desk','south','north','tribunal',.42,.70],
  'ch11-accounts':['senate-audit','The Senate’s treasury hearing','south','north','accounts',.40,.70],
  'ch11-adlection':['senate-admission','The Senate’s admission chamber','south','north','admission',.64,.70],
  'ch12-legitimacy':['imperial-recognition','The recognition audience','south','north','recognition',.45,.70],
  'ch12-confrontation':['rome-approach','The rival standards at the Roman gate','west','east','imperial-gate',.60,.67],
  // The walkable camps (0.40): a tent street inside the palisade, the gate to the south.
  'ch1-camp':['legion-camp','The legionary base at Novae','south','north','camp',.62,.66],
  'ch2-camp':['march-camp','The march camp on the causeway','south','north','camp',.62,.66],
  'ch3-camp':['station-camp','The camp below the road station','south','north','camp',.62,.66]
};
export function getEncounterStaging(encounter={}, {chapter=1,civic=encounter.kind==='contest',training=false}={}){
  const record=plans[encounter.id]??(training?plans['ch1-training']:plans[`ch${chapter}-${civic?'council':'road'}`])??[civic?'audience-court':'field-approach',civic?'The audience court':'The field approach',civic?'south':'west',civic?'north':'east',civic?'council':'checkpoint',.65,.68];
  const [key,title,entranceEdge,landmarkEdge,form,yaw,pitch]=record;
  // Look along the approach toward the destination. An east-side camera
  // looked away from the eastern fortress, leaving only scattered props.
  const bearing=!civic&&!training?({east:-1.05,west:1.05,north:.32,south:2.8}[landmarkEdge]??yaw):yaw;
  return Object.freeze({key,title,entranceEdge,landmarkEdge,axis:`${entranceEdge}-${landmarkEdge}`,form,camera:Object.freeze({yaw:bearing,pitch})});
}

// Use real edge-road coordinates where they exist; never redirect a road
// through a river or an invented passage inside the authored board.
export function stagingEdge(encounter,edge,tileSize=2.5,offset=0){
  const width=encounter.width,height=encounter.height,values=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(terrainAt(encounter,x,y)==='road'&&((edge==='west'&&x===0)||(edge==='east'&&x===width-1)||(edge==='north'&&y===0)||(edge==='south'&&y===height-1))){const p=gridToWorld({x,y},encounter,tileSize);values.push(edge==='west'||edge==='east'?p.z:p.x);}
  const along=values.length?values.sort((a,b)=>Math.abs(a)-Math.abs(b)||a-b)[0]:0,hx=width*tileSize/2,hz=height*tileSize/2;
  return edge==='west'?{x:-hx-offset,z:along,angle:-Math.PI/2}:edge==='east'?{x:hx+offset,z:along,angle:Math.PI/2}:edge==='north'?{x:along,z:-hz-offset,angle:Math.PI}:{x:along,z:hz+offset,angle:0};
}
export function stagingRouteWeight(x,z,e,staging,tileSize=2.5){
  return createStagingRouteSampler(e,staging,tileSize)(x,z);
}
export function createStagingRouteSampler(e,staging,tileSize=2.5){
  const hx=e.width*tileSize/2,hz=e.height*tileSize/2,routes=[staging.entranceEdge,staging.landmarkEdge].map(edge=>({edge,...stagingEdge(e,edge,tileSize)}));
  return (x,z)=>{
    if(Math.abs(x)<=hx&&Math.abs(z)<=hz)return 0;let weight=0;
    for(const p of routes){const edge=p.edge,side=edge==='west'||edge==='east',out=side?Math.abs(x)-hx:Math.abs(z)-hz,lateral=side?Math.abs(z-p.z):Math.abs(x-p.x);
      if((edge==='west'&&x>0)||(edge==='east'&&x<0)||(edge==='north'&&z>0)||(edge==='south'&&z<0))continue;
      weight=Math.max(weight,(1-smooth((lateral-2)/2))*(1-smooth((out-15)/9))*smooth(out/.7));
    }return clamp(weight);
  };
}
