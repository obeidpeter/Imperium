import {loadArt,peekArt} from './art.js';

// Four authored facings; no directional mirroring reverses shield/weapon hands.
export const FACING_COLUMN=Object.freeze({east:0,south:1,north:2,west:3});
const atlases={roman:'./assets/tactical/units-roman.webp',frontier:'./assets/tactical/units-frontier.webp',civic:'./assets/tactical/units-civic.webp',specialists:'./assets/tactical/units-specialists.webp'};
function militaryFaction(unit,chapter){
  // The factories name ordinary opponents by faction. IDs retain origin when
  // a finale pledge changes side/name; a player's chosen name is never gear.
  if(unit.id==='hero')return 'roman';
  const name=unit.name??'';
  if(/persian/i.test(name))return 'persian';
  if(/palmyrene/i.test(name))return 'palmyrene';
  if(/roman|civil-war|pledged cohort/i.test(name))return 'roman';
  if(/goth/i.test(name))return 'gothic';
  if(unit.side==='enemy'||/^(enemy|reinforce)\d+$/.test(unit.id??''))return [5,6].includes(chapter)?'persian':chapter===9?'palmyrene':chapter>=11?'roman':'gothic';
  return 'roman';
}
export function spriteSpec(unit,chapter=1,contest=false){
  if(contest)return {atlas:'civic',row:unit.role==='voter'?3:unit.id==='hero'?(chapter>=11?1:0):unit.side==='enemy'?2:0};
  if(unit.role==='trainer')return {atlas:'roman',row:0};
  if(unit.role==='escort')return /varro/i.test(unit.name)?{atlas:'roman',row:2}:/lucan|survivor|squad|eagle-bearer/i.test(unit.name)?{atlas:'roman',row:1}:{atlas:'civic',row:/envoy|records/i.test(unit.name)?0:3};
  const faction=militaryFaction(unit,chapter);
  if(['cavalry','heavy'].includes(unit.role))return {atlas:'frontier',row:['persian','palmyrene'].includes(faction)?2:3};
  if(unit.role==='archer')return faction==='roman'?{atlas:'specialists',row:1}:faction==='gothic'?{atlas:'specialists',row:0}:{atlas:'frontier',row:1};
  if(faction==='persian')return {atlas:'specialists',row:2};
  if(faction==='palmyrene')return {atlas:'specialists',row:3};
  if(faction==='gothic')return {atlas:'frontier',row:0};
  return {atlas:'roman',row:unit.id==='hero'?(chapter===1?0:chapter<5?1:chapter<7?2:3):/varro/i.test(unit.name)?2:unit.role==='escort'?0:1};
}
export function tacticalAssets(encounter){return [...new Set([...(encounter?.kind==='contest'?[atlases.civic]:[atlases.roman,atlases.frontier,atlases.specialists]),...(encounter?.units?.some(u=>u.role==='escort')?[atlases.civic]:[]),'./assets/tactical/environment-props.webp'])];}
export async function loadTacticalArt(encounter){return Promise.all(tacticalAssets(encounter).map(src=>loadArt(src)));}

export function spriteHeight(g,u){return Math.min(100,Math.max(.1,g.tw*(['cavalry','heavy'].includes(u.role)?1.62:1.36)));}

export function drawUnitSprite(c,g,p,u,chapter,contest,override={}){
  const spec=spriteSpec(u,chapter,contest),sheet=peekArt(atlases[spec.atlas]);if(!sheet)return false;
  const height=spriteHeight(g,u),width=height*.75,scale=height/256;
  const walking=['walk','run','cavalry-move','retreat'].includes(override.pose);
  const stride=walking?Math.sin((override.progress??0)*Math.PI*8):0;
  const bob=(override.bob??0)*height/72;
  c.save();c.translate(p.x,p.y+bob);c.rotate(override.lean??0);
  // The mild shear suggests weight transfer without stretching the head/torso.
  if(walking)c.transform(1,stride*.012,0,1+Math.abs(stride)*.012,0,0);
  const draw=(facing,alpha)=>{c.save();c.globalAlpha*=alpha;
    const stamp=(dx=0,dy=0)=>c.drawImage(sheet,(FACING_COLUMN[facing]??0)*192,spec.row*256,192,256,-width/2+dx,-240*scale+dy,width,height);
    if(walking&&!contest&&spec.atlas!=='civic'){
      const seam=-height*.24;
      c.save();c.beginPath();c.rect(-width,-height*1.2,width*2,height*1.2+seam);c.clip();stamp();c.restore();
      for(const sign of[-1,1]){c.save();c.beginPath();c.rect(sign<0?-width:0,seam,width,height*.4);c.clip();stamp(stride*sign*height*.015,-Math.max(0,stride*sign)*height*.024);c.restore();}
    }else stamp();c.restore();};
  if(override.previousFacing&&override.turnProgress<1){draw(override.previousFacing,1-override.turnProgress);draw(override.facing,override.turnProgress);}else draw(override.facing??u.facing,1);
  // Steel glints and short arcs follow the committed action's impact window.
  if(['attack','cavalry-attack','throw'].includes(override.pose)&&override.weapon!==0){
    const direction=['east','north'].includes(override.facing??u.facing)?1:-1;
    c.save();c.translate(direction*width*.19,-height*.4);c.rotate(direction*(override.weapon-.5)*1.2);c.strokeStyle='#fcf0c9';c.lineWidth=Math.max(1,height*.022);c.beginPath();c.moveTo(0,0);c.lineTo(direction*height*.23,-height*.24);c.stroke();c.restore();
  }
  if(['speak','rally','order','formation'].includes(override.pose)){
    const direction=['east','north'].includes(override.facing??u.facing)?1:-1,gesture=Math.max(0,override.weapon??Math.sin((override.progress??0)*Math.PI));
    c.save();c.translate(direction*width*.13,-height*.57);c.rotate(-direction*gesture*.7);
    c.strokeStyle=contest?'#e2d4b3':'#b2a78c';c.lineWidth=height*.047;c.lineCap='round';c.beginPath();c.moveTo(0,0);c.lineTo(direction*height*.09,-height*.1);c.stroke();c.strokeStyle='#c8a17a';c.lineWidth=height*.035;c.beginPath();c.moveTo(direction*height*.09,-height*.1);c.lineTo(direction*height*.12,-height*.19);c.stroke();c.restore();
  }
  if(u.braced||override.shield>.4){c.strokeStyle='#cddbd5';c.lineWidth=Math.max(1,height*.018);c.beginPath();c.ellipse(-width*.17,-height*.32,width*.15,height*.17,-.15,Math.PI*.55,Math.PI*1.7);c.stroke();}
  if((u.hp??u.resolve??1)/(u.maxHp??u.maxResolve??1)<.35){c.fillStyle='#9c443d';c.fillRect(width*.06,-height*.39,Math.max(1,height*.026),height*.075);}
  c.restore();return true;
}
