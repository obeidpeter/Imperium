// Which piece of the board kit (scripts/assets/build-board-kit.py) stands on
// each structure cell (worlds and gameplay plan, release 4): curtains, towers
// and their stairs, gates in every state, breaches, bridges and breastworks.
// Pure: placements are read from the stage encounter (the battle's 2.5 m map,
// its fortification record and its field objects), never from the scene, and
// change nothing. Every piece's face is its local +x; yaw turns it there.
import {gridToWorld,terrainAt} from './environment-layout.js';

export const BOARD_KIT_FAMILIES=Object.freeze(['stone','mudbrick','timber']);
// The record's material names the family (fortifications.js).
export const boardKitFamily=e=>BOARD_KIT_FAMILIES.includes(e?.fortifications?.material)?e.fortifications.material:null;
const YAW=Object.freeze({east:0,north:Math.PI/2,west:Math.PI,south:-Math.PI/2});
const DIRECTION=Object.freeze({'1,0':'east','-1,0':'west','0,1':'south','0,-1':'north'});
// A tower's deck height (src/data/structures.js): its base stands that far below the deck.
const DECK=3.2;
// The kinds the kit draws; the rest of the field's objects stay code-built (fieldwork).
export const BOARD_KIT_KINDS=Object.freeze(['gate','breach','bridge']);

// The side the works face: away from the side that holds the towers (their stairs),
// else east for a curtain running north-south and north for one running east-west.
function faces(e){
  const p=e.fortifications?.platforms?.[0],holder=p?DIRECTION[`${p.steps[0]-p.x},${p.steps[1]-p.y}`]:null;
  return {vertical:holder==='east'?'west':'east',horizontal:holder==='north'?'south':'north'};
}
const wallAt=(e,x,y)=>x>=0&&y>=0&&x<e.width&&y<e.height&&terrainAt(e,x,y)==='wall';
const lineOf=cells=>cells.every(c=>c.x===cells[0].x)?'column':'row';

export function boardKitPieces(e,{tileSize=2.5,height=()=>0}={}){
  const out=[],f=e?.fortifications;if(!f||!boardKitFamily(e))return out;
  const face=faces(e),at=(x,y)=>gridToWorld({x,y},e,tileSize),put=(piece,x,y,yaw,base,extra={})=>{const c=at(x,y);out.push({piece,x:c.x,z:c.z,y:base??height(c.x,c.z),yaw,cell:[x,y],...extra});};
  // Curtain cells: the stage's map shows a breach's and a gate's cells as open ground.
  const wallYaw=(x,y)=>YAW[(wallAt(e,x,y-1)||wallAt(e,x,y+1))&&!(wallAt(e,x-1,y)||wallAt(e,x+1,y))?face.vertical:face.horizontal];
  for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(wallAt(e,x,y))put('wall_block',x,y,wallYaw(x,y));
  for(const p of f.platforms??[]){
    const toStair=DIRECTION[`${p.steps[0]-p.x},${p.steps[1]-p.y}`]??'west',deck=at(p.x,p.y);
    // The deck's open side (-x) faces its stair; the stair rises (+x) toward the deck.
    put('tower',p.x,p.y,YAW[toStair]+Math.PI,height(deck.x,deck.z)-DECK);
    put('tower_stair',p.steps[0],p.steps[1],YAW[toStair]+Math.PI);
  }
  // Field objects arrive one per cell (live-figures.js stageField), each with its line.
  const objects=e.field?.objects??[],byLine=new Map();
  for(const o of objects){if(!o.line)continue;if(!byLine.has(o.line))byLine.set(o.line,[]);byLine.get(o.line).push(o);}
  for(const [,cells]of byLine){
    // A shut gate's line is its gate and a panel on each other cell (gatePanel).
    const kind=(cells.find(o=>!o.gatePanel)??cells[0]).kind,across=lineOf(cells)==='column'?'east':'south';
    if(kind==='gate')for(const o of cells){
      if(o.state==='breached'){put('breach_rubble',o.x,o.y,YAW[across]);continue;}
      if(o.gatePanel){put('gate_panel',o.x,o.y,YAW[across]);continue;}
      put('gate_frame',o.x,o.y,YAW[across]);
      const integrity=Number.isFinite(o.integrity)?o.integrity:100;
      put(o.state==='open'?'gate_open':integrity<=60?'gate_battered':o.holder?'gate_barred':'gate_closed',o.x,o.y,YAW[across]);
    }
    if(kind==='breach')for(const o of cells)put(o.state==='breached'?'breach_rubble':'wall_block',o.x,o.y,o.state==='breached'?YAW[across]:wallYaw(o.x,o.y));
    if(kind==='bridge'){
      // A level deck from bank to bank: the higher of the ground just beyond each end.
      const sorted=[...cells].sort((a,b)=>a.x-b.x||a.y-b.y),first=sorted[0],last=sorted.at(-1),[dx,dy]=across==='east'?[0,1]:[1,0];
      const bank=Math.max(...[[first.x-dx,first.y-dy],[last.x+dx,last.y+dy]].map(([x,y])=>{const c=at(x,y);return height(c.x,c.z);}),0);
      for(const o of sorted)put(o.state==='demolished'?'bridge_stumps':o.state==='damaged'?'bridge_damaged':'bridge_deck',o.x,o.y,YAW[across==='east'?'south':'east'],bank+.12,{walk:o.state==='repaired',deck:bank+.12});
    }
  }
  for(const r of f.ramparts??[])for(const [x,y]of r.cells){
    const c=at(x,y),[dx,dz]={east:[1,0],west:[-1,0],south:[0,1],north:[0,-1]}[r.face];
    put('breastwork',x,y,YAW[r.face],height(c.x+dx*tileSize*.44,c.z+dz*tileSize*.44));
  }
  return out;
}
