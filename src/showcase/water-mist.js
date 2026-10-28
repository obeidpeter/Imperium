import * as T from '../../vendor/three/three.module.js';
import {createParticleMaterial,installParticleAttributes} from './stage-particles.js';
import {sampleWorldWind} from './world-weather.js';
import {terrainAt,gridToWorld,distantRiverCentre,RIVER_WATER_LEVEL,MARSH_WATER_LEVEL} from './environment-layout.js';

// Mist banks over water (worlds and gameplay plan, release 5): soft, slow veils lying over
// the board's river, ford and marsh and the distant river, at dawn, at night and in mist or
// rain. They are the weather's own mist particles (stage-particles.js), each bank a cloud
// that drifts inside the water's box, so they share its one shader program. Presentation
// only, and none on Performance or indoors.
export function mistBankStrength(profile={}){
  if(profile.civic||profile.timeOfDay==='interior')return 0;
  return {mist:.1,rain:.06}[profile.weather]??(profile.timeOfDay==='dawn'?.08:profile.timeOfDay==='night'?.05:0);
}
const PER=Object.freeze({balanced:64,high:120});

/** The boxes of water a bank lies over: {minX,maxX,minZ,maxZ,level}. */
export function mistBankRegions(e,{tileSize=2.5,distantWater=false}={}){
  const regions=[],add=(cells,level)=>{if(!cells.length)return;const xs=cells.map(c=>c.x),zs=cells.map(c=>c.z);
    regions.push({minX:Math.min(...xs)-tileSize*.4,maxX:Math.max(...xs)+tileSize*.4,minZ:Math.min(...zs)-tileSize*.4,maxZ:Math.max(...zs)+tileSize*.4,level});};
  const cells=type=>{const out=[];for(let y=0;y<e.height;y++)for(let x=0;x<e.width;x++)if(type.includes(terrainAt(e,x,y)))out.push(gridToWorld({x,y},e,tileSize));return out;};
  add(cells(['river','ford']),RIVER_WATER_LEVEL);add(cells(['marsh']),MARSH_WATER_LEVEL);
  if(distantWater){const z=distantRiverCentre(e,tileSize);regions.push({minX:-62,maxX:62,minZ:z-6,maxZ:z+6,level:-1.24});}
  return regions;
}

export function createMistBanks(group,{e,profile,mask,quality='balanced',tileSize=2.5}){
  const strength=mistBankStrength(profile),per=PER[quality];if(!strength||!per)return null;
  const banks=mistBankRegions(e,{tileSize,distantWater:profile.distantWater}).map((r,k)=>{
    const w=r.maxX-r.minX,d=r.maxZ-r.minZ,count=Math.max(12,Math.min(per,Math.round(w*d/14))),positions=new Float32Array(count*3);
    for(let i=0;i<count;i++)positions.set([((i*.754877666+k*.31)%1)-.5,(i*.569840296)%1,((i*.438579+k*.17)%1)-.5],i*3);
    const geometry=installParticleAttributes(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)));
    const material=createParticleMaterial(mask,{mode:1,color:profile.timeOfDay==='night'?'#a3afb7':'#dfe8e4',size:3.6,opacity:strength,alphaTest:.001});
    const u=material.userData.particleUniforms;u.weatherMode.value=3;u.weatherFall.value=.012;
    // The bank's box: a metre deep above the water, wrapping inside its plan.
    u.weatherSpan.value.set(w,1,d);u.weatherAnchor.value.set((r.minX+r.maxX)/2,r.level+.5,(r.minZ+r.maxZ)/2);
    const cloud=new T.Points(geometry,material);cloud.name='water mist bank';cloud.renderOrder=4;cloud.frustumCulled=false;cloud.userData.mistBank=r;group.add(cloud);
    return {cloud,u};
  });
  return {
    banks:banks.length,
    update(time=0,{reducedMotion=false}={}){
      const t=reducedMotion?0:(Number.isFinite(time)?time%3600:0),wind=sampleWorldWind(t,{chapter:profile.chapter,weather:profile.weather,reducedMotion});
      for(const {u}of banks){u.weatherTime.value=t;u.weatherWind.value.set(wind.x*.18,wind.z*.18);}
    },
    dispose(){for(const {cloud}of banks){cloud.removeFromParent();cloud.geometry.dispose();cloud.material.dispose();}banks.length=0;}
  };
}
