import {ROMAN_DETAIL_ATLAS,normalizedRomanAtlas} from './roman-atlas.js';
import {loadArt,peekArt} from './art.js';
import {sampleSpritePose,spriteMesh} from './sprite-poses.js';
import {animationAssets,authoredFrame} from './sprite-frames.js';
import {WORLD_ASSETS} from './world-assets.js';

// Four authored facings; no directional mirroring reverses shield/weapon hands.
export const FACING_COLUMN=Object.freeze({east:0,south:1,north:2,west:3});
const atlases={roman:ROMAN_DETAIL_ATLAS,frontier:'./assets/tactical/units-frontier.webp',civic:'./assets/tactical/units-civic.webp',specialists:'./assets/tactical/units-specialists.webp'};
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
export function tacticalAssets(encounter){const chapter=Number(/^ch(\d+)/.exec(encounter?.id??'')?.[1])||1;return [...new Set([...(encounter?.kind==='contest'?[atlases.civic]:[atlases.roman,atlases.frontier,atlases.specialists]),...(encounter?.units?.some(u=>u.role==='escort')?[atlases.civic]:[]),'./assets/tactical/environment-props.webp',...WORLD_ASSETS,...animationAssets(chapter,encounter?.kind==='contest')])];}
export async function loadTacticalArt(encounter){return Promise.all(tacticalAssets(encounter).map(src=>loadArt(src)));}

export function spriteHeight(g,u){return Math.min(140,Math.max(.1,g.tw*(['cavalry','heavy'].includes(u.role)?1.62:1.36)));}

export function drawUnitSprite(c,g,p,u,chapter,contest,override={}){
  const spec=spriteSpec(u,chapter,contest),raw=peekArt(atlases[spec.atlas]);if(!raw)return false;const sheet=spec.atlas==='roman'?normalizedRomanAtlas(raw):raw;
  const height=spriteHeight(g,u),width=height*.75,scale=height/256;
  const draw=(facing,alpha)=>{
    const frame=authoredFrame(spec,facing,override,u),actionSheet=frame&&peekArt(frame.asset);
    if(actionSheet){
      // Each frame is independently painted. A measured sole anchor prevents
      // export-cell padding from making the character bob or slide at contact.
      const s=height*.92/frame.bodyHeight,[sx,sy,sw,sh]=frame.source;
      c.save();c.globalAlpha*=alpha;
      // Source figures are alpha-separated but their rectangular bounds can
      // overlap at a sword tip. A convex figure clip excludes neighboring cells
      // without reshaping or repainting the authored silhouette.
      c.beginPath();frame.clip.forEach(([x,y],i)=>{const px=(x-frame.anchor.x)*s,py=(y-frame.anchor.y)*s;i?c.lineTo(px,py):c.moveTo(px,py);});c.closePath();c.clip();
      c.drawImage(actionSheet,sx,sy,sw,sh,-frame.anchor.x*s,-frame.anchor.y*s,sw*s,sh*s);c.restore();return;
    }
    const column=FACING_COLUMN[facing]??0,mounted=['cavalry','heavy'].includes(u.role),spear=spec.atlas==='roman'&&spec.row===3||spec.atlas==='frontier'&&[0,2].includes(spec.row)||spec.atlas==='specialists'&&spec.row>=2;
    // Atlas inspection supplies the actual painted hand, never a mirrored body.
    const hand=spear?[[-1,1,1,1],[-1,1,-1,1]][spec.atlas==='roman'?1:0][column]:column<2?-1:1;
    const profile={mounted,civic:spec.atlas==='civic',archer:u.role==='archer',spear,hand,direction:[0,2].includes(column)?1:-1,braced:!!u.braced,shaken:Number.isFinite(u.morale)&&u.morale<35};
    const pose=sampleSpritePose(override,profile),sx=column*192,sy=spec.row*256;
    c.save();c.globalAlpha*=alpha;c.translate(0,pose.rootY*scale);
    if(!pose.active){c.rotate(pose.lean*profile.direction);c.scale(1,1-pose.hip/256);c.drawImage(sheet,sx,sy,192,256,-width/2,-240*scale,width,height);}
    else{
      const {vertices,triangles}=spriteMesh(pose,profile);
      c.translate(-width/2,-240*scale);c.scale(scale,scale);
      for(const ids of triangles){
        const [a,b,d]=ids.map(i=>vertices[i]),den=(b.x-a.x)*(d.y-a.y)-(d.x-a.x)*(b.y-a.y);
        const ax=a.x+a.dx,ay=a.y+a.dy,bx=b.x+b.dx,by=b.y+b.dy,dx=d.x+d.dx,dy=d.y+d.dy;
        const aa=((bx-ax)*(d.y-a.y)-(dx-ax)*(b.y-a.y))/den,bb=((by-ay)*(d.y-a.y)-(dy-ay)*(b.y-a.y))/den;
        const cc=((dx-ax)*(b.x-a.x)-(bx-ax)*(d.x-a.x))/den,dd=((dy-ay)*(b.x-a.x)-(by-ay)*(d.x-a.x))/den;
        c.save();c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(dx,dy);c.closePath();c.clip();
        c.transform(aa,bb,cc,dd,ax-aa*a.x-cc*a.y,ay-bb*a.x-dd*a.y);
        c.drawImage(sheet,sx,sy,192,256,0,0,192,256);c.restore();
      }
    }c.restore();
  };
  c.save();c.translate(p.x,p.y);
  const turn=Number.isFinite(override.turnProgress)?Math.max(0,Math.min(1,override.turnProgress)):1;
  if(override.previousFacing&&turn<1&&override.previousFacing!==(override.facing??u.facing)){draw(override.previousFacing,1-turn);draw(override.facing??u.facing,turn);}else draw(override.facing??u.facing,1);
  if((u.hp??u.resolve??1)/(u.maxHp??u.maxResolve??1)<.35){c.fillStyle='#9c443d';c.fillRect(width*.06,-height*.39,Math.max(1,height*.026),height*.075);}
  c.restore();return true;
}
