import * as T from '../../vendor/three/three.module.js';
import {closeRadialNormals} from './actor-geometry.js';
const bell=(v,c,w)=>Math.exp(-(((v-c)/w)**2)*2);
// Original landmark sculpt over an owned garment mesh. Joint origins and soles
// are unchanged: anatomy shapes the surface without stretching the contact rig.
export function sculptActorGeometry(geometry,region,identity={build:1}){
  const p=geometry.attributes.position,colours=[],build=identity.build??1;
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=Math.max(0,z)/Math.max(.01,Math.hypot(x,z)),shade=1;
    if(region==='torso'){
      const chest=bell(y,.33,.14),waist=bell(y,.13,.12),shoulder=bell(y,.41,.085);
      x*=1+(build-1)*(.7*chest+.2*waist);
      z+=front*(.012*chest*(bell(x,-.12,.11)+bell(x,.12,.11))-.007*chest*bell(x,0,.035)+.010*waist);
      if(z<0)z-=.009*shoulder*(bell(x,-.12,.10)+bell(x,.12,.10));
      // Broad diagonal tension across the belt, not periodic corrugation.
      z+=front*.004*Math.sin(y*32+x*11)*waist;
      if(identity.female)x*=1-.045*waist;
    }else if(region==='shoulder'){
      // Sleeve crown nests inside the torso slope; the joint stays put. The
      // old high centered dome looked like a separate armored shoulder ball.
      x-=(identity.side??1)*.028*bell(y,.006,.10);
    }else if(region==='thigh'){
      const muscle=bell(y,-.15,.13);x*=1+(build-1)*muscle*.7;z+=front*.009*muscle;
    }else if(region==='calf'){
      z-=.012*bell(y,-.15,.11)*(1-front);x*=1+.025*bell(y,-.15,.10);
    }else if(region==='arm'){
      z+=front*.007*bell(y,-.20,.08);x*=1+(build-1)*bell(y,-.20,.09);
    }else if(region==='forearm'){
      x*=1+.07*bell(y,-.06,.07);z+=.004*bell(y,-.08,.08)*front;
    }else if(region==='horse-barrel'){
      const rump=bell(y,-.54,.22),shoulder=bell(y,.40,.18);
      // Withers, a deep ribcage and tucked flank; local profile Y becomes the
      // horse's fore/aft axis. Joint origins and saddle contacts stay fixed.
      x*=1+.035*rump+.025*shoulder-.070*bell(y,-.12,.20);
      const upper=Math.max(0,-z)/Math.max(.01,Math.hypot(x,z));
      z-=upper*(.043*shoulder+.018*rump);
      z+=front*(.015*bell(y,.20,.24)-.030*bell(y,-.30,.22));
      shade=.95+.05*(1-front);
    }else if(region==='horse-neck'){
      x*=1+.025*bell(y,.27,.19)-.075*bell(y,.64,.15);
      z+=.018*bell(y,.24,.20)*front-.012*bell(y,.58,.18)*(1-front);
      shade=.94+.06*bell(y,.44,.40);
    }
    p.setXYZ(i,x,y,z);colours.push(shade,shade,shade);
  }
  if(region.startsWith('horse'))geometry.setAttribute('color',new T.Float32BufferAttribute(colours,3));
  p.needsUpdate=true;
  if(geometry.userData.radialClosed)closeRadialNormals(geometry,geometry.userData.radialColumns,geometry.userData.radialRows);else geometry.computeVertexNormals();
  geometry.userData.anatomy=region;return geometry;
}
