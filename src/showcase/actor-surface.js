import {installCloudShadows} from './atmosphere.js';
// Original, periodic material fields. No browser state, image decoder, clock or
// gameplay randomness: identical inputs produce identical bounded texels.
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),fract=v=>v-Math.floor(v);
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const hash=(x,y)=>((Math.imul(x+11,374761393)^Math.imul(y+37,668265263))>>>0)/4294967295;
const wrap=(x,n)=>(x%n+n)%n;
function noise(u,v,n){
  const x=fract(u)*n,y=fract(v)*n,ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy);
  const at=(dx,dy)=>hash(wrap(ix+dx,n),wrap(iy+dy,n));
  return (at(0,0)*(1-a)+at(1,0)*a)*(1-b)+(at(0,1)*(1-a)+at(1,1)*a)*b;
}
const grain=(u,v)=>noise(u,v,12)*.6+noise(u,v,36)*.4;
export const ACTOR_SURFACE_SPEC=Object.freeze({
  skin:Object.freeze({repeat:[2,2],normalGain:.010,normalScale:.42,roughness:1,metalness:0}),
  cloth:Object.freeze({repeat:[5,4],normalGain:.008,normalScale:.7,roughness:1,metalness:0}),
  wool:Object.freeze({repeat:[4,4],normalGain:.006,normalScale:.55,roughness:1,metalness:0}),
  leather:Object.freeze({repeat:[2,2],normalGain:.012,normalScale:.72,roughness:1,metalness:0}),
  mail:Object.freeze({repeat:[3,3],normalGain:.020,normalScale:.85,roughness:1,metalness:.70}),
  scale:Object.freeze({repeat:[3,3],normalGain:.020,normalScale:.8,roughness:1,metalness:.76}),
  metal:Object.freeze({repeat:[2,2],normalGain:.020,normalScale:.52,roughness:1,metalness:.88}),
  hair:Object.freeze({repeat:[2,2],normalGain:.006,normalScale:.6,roughness:1,metalness:0}),
  horse:Object.freeze({repeat:[2,2],normalGain:.003,normalScale:.45,roughness:1,metalness:0}),
  paint:Object.freeze({repeat:[2,2],normalGain:.006,normalScale:.5,roughness:1,metalness:0}),
});
for(const spec of Object.values(ACTOR_SURFACE_SPEC))Object.freeze(spec.repeat);
export const actorSurfaceKind=kind=>Object.hasOwn(ACTOR_SURFACE_SPEC,kind)?kind:'paint';

// Alternating tilted ellipses overlap at both sides of the next row. Taking the
// upper wire surface keeps crossings raised, rather than drawing black circles.
function mail(u,v){
  const x=u*6,y=v*8,row=Math.floor(y);let height=.26,wire=0,polish=0;
  for(let j=row-1;j<=row+1;j++){
    const stagger=wrap(j,2)*.5,center=Math.floor(x-stagger);
    for(let i=center-1;i<=center+1;i++){
      const dx=x-(i+stagger+.5),dy=y-(j+.5),tilt=(wrap(j,2)?1:-1)*.24;
      const radius=Math.hypot((dx+dy*tilt)/.66,dy/.72),distance=Math.abs(radius-1),profile=Math.sqrt(Math.max(0,1-(distance/.22)**2));
      const h=.26+profile*.44+(wrap(j,2)?dy:-dy)*profile*.055;
      if(h>height){height=h;wire=profile;polish=.5+.5*Math.sin(Math.atan2(dy,dx)+j*Math.PI);}
    }
  }
  return [height,.57+wire*.31,.88-wire*(.10+.04*polish)];
}

/** [relative relief, neutral diffuse multiplier, perceptual roughness]. */
export function actorSurfaceSample(input,u,v){
  const kind=actorSurfaceKind(input);u=fract(u);v=fract(v);
  if(kind==='mail')return mail(u,v);
  const n=grain(u,v),broad=noise(u,v,4),micro=noise(u,v,48);
  if(kind==='cloth'||kind==='wool'){
    // Opposing yarns take turns on top. Rounded thread crowns and fine fibers
    // make a weave rather than a regular embossed square checkerboard.
    const x=u*12,y=v*12,warp=(.5+.5*Math.cos(TAU*x))**1.7,weft=(.5+.5*Math.cos(TAU*y))**1.7,over=.5+.5*Math.cos(Math.PI*x)*Math.cos(Math.PI*y);
    const crown=warp*(.065+.125*over)+weft*(.19-.125*over),fiber=Math.sin(TAU*(u*48+v*12))*.008;
    if(kind==='wool')return [.44+crown*.55+fiber*.7+.045*(n-.5),.82+crown*.22+.065*(broad-.5),.94+.025*(n-.5)];
    return [.37+crown+fiber+.025*(n-.5),.81+crown*.38+.055*(broad-.5),.88+.07*(1-crown/.255)+.02*(n-.5)];
  }
  if(kind==='leather'){
    const crease=Math.pow(Math.max(0,1-Math.abs(noise(u,v,12)-.49)*9),5),worn=smooth((broad-.5)*3);
    return [.52+.10*(n-.5)-.055*crease+.022*(micro-.5),.81+.10*(broad-.5)-.045*crease+.045*worn,.66+.10*(n-.5)-.16*worn];
  }
  if(kind==='skin')return [.5+.018*(micro-.5)+.012*(n-.5),.92+.025*(broad-.5)+.012*(n-.5),.62+.12*(broad-.5)+.045*(micro-.5)];
  if(kind==='scale'){
    const row=Math.floor(v*8),x=fract(u*8+wrap(row,2)*.5)-.5,y=fract(v*8),edge=1-smooth(Math.abs(y-(.77-.48*x*x))/.07),ridge=(.5+.5*Math.cos(TAU*x))*.045;
    return [.34+y*.19+ridge-edge*.11,.78+y*.08-edge*.15+.025*(n-.5),.40+edge*.23+.08*(n-.5)];
  }
  if(kind==='metal'){
    const hammer=noise(u,v,12),scratches=Math.pow(.5+.5*Math.sin(TAU*(u*36+.035*Math.sin(v*TAU))),18);
    return [.5+.10*(hammer-.5)-scratches*.014,.86+.06*(broad-.5)-scratches*.025,.32+.13*(hammer-.5)+.10*scratches];
  }
  if(kind==='hair'){
    const strand=Math.sin(TAU*(u*48+.09*Math.sin(v*TAU*2))),secondary=Math.sin(TAU*(u*24+.07*Math.cos(v*TAU*4)));
    return [.5+strand*.021+secondary*.009+.008*(n-.5),.83+strand*.022+secondary*.014+.035*(broad-.5),.79+.055*(n-.5)-strand*.025];
  }
  if(kind==='horse'){
    const hair=Math.sin(TAU*(u*36+.06*Math.sin(v*TAU*4)));
    return [.5+hair*.014+.015*(n-.5),.86+.055*(broad-.5)+hair*.018,.56+.09*(n-.5)+hair*.025];
  }
  const wood=Math.sin(TAU*(u*8+.11*Math.sin(v*TAU)));
  return [.5+wood*.045+.02*(n-.5),.84+.04*wood+.045*(broad-.5),.72+.10*(n-.5)];
}

function textureSize(value){if(!Number.isInteger(value)||value<16||value>256)throw new RangeError('Actor surface tiles must be 16–256 pixels');return value;}
const byte=value=>Math.round(clamp(value)*255);
export function actorSurfaceAlbedo(kind,size=96){
  textureSize(size);const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,c=byte(actorSurfaceSample(kind,(x+.5)/size,(y+.5)/size)[1]);data.set([c,c,c,255],i);}
  return data;
}
export function createActorSurfaceData(input,{size=96,normalSize=192}={}){
  textureSize(size);textureSize(normalSize);const kind=actorSurfaceKind(input),spec=ACTOR_SURFACE_SPEC[kind];
  const color=new Uint8Array(size*size*4),height=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4),normal=new Uint8Array(normalSize*normalSize*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const [h,c,r]=actorSurfaceSample(kind,(x+.5)/size,(y+.5)/size),i=(y*size+x)*4;
    for(const [data,value]of [[color,c],[height,h],[roughness,r]]){const b=byte(value);data.set([b,b,b,255],i);}
  }
  const d=1/normalSize,relief=new Float32Array(normalSize*normalSize);
  for(let y=0;y<normalSize;y++)for(let x=0;x<normalSize;x++)relief[y*normalSize+x]=actorSurfaceSample(kind,(x+.5)/normalSize,(y+.5)/normalSize)[0];
  for(let y=0;y<normalSize;y++)for(let x=0;x<normalSize;x++){
    const dx=(relief[y*normalSize+wrap(x+1,normalSize)]-relief[y*normalSize+wrap(x-1,normalSize)])/(2*d)*spec.normalGain,dy=(relief[wrap(y+1,normalSize)*normalSize+x]-relief[wrap(y-1,normalSize)*normalSize+x])/(2*d)*spec.normalGain;
    const length=Math.hypot(dx,dy,1),i=(y*normalSize+x)*4;
    normal.set([byte(.5-dx/length*.5),byte(.5-dy/length*.5),byte(.5+.5/length),255],i);
  }
  return {size,normalSize,color,height,roughness,normal};
}

// The downloaded illustration contributes restrained wear only. Keep relief
// and diffuse link positions aligned, particularly across mail's recesses.
export function composeActorAlbedo(painted,kind,size){
  if(painted.length!==size*size*4)throw new RangeError('Actor albedo dimensions do not match');
  const native=actorSurfaceAlbedo(kind,size),strength=kind==='mail'?.10:kind==='skin'?.20:.38;
  for(let i=0;i<native.length;i+=4)for(let channel=0;channel<3;channel++)native[i+channel]=Math.round(clamp(native[i+channel]*(1+strength*(painted[i+channel]/220-1)),kind==='mail'?125:kind==='skin'?200:80,250));
  return native;
}

export function evaluateActorShading(input,ndotl=0.5,ndotv=0.5){
  const kind=actorSurfaceKind(input),l=clamp(ndotl),v=clamp(ndotv);
  if(kind==='skin'){
    const subsurface=Math.pow(clamp(1-l*0.75),1.6)*(0.28+0.22*(1-v));
    return {kind,subsurface,sheen:0.06*(1-v),anisotropy:0,roughnessScale:0.94};
  }
  if(kind==='cloth'){
    const sheen=Math.pow(1-v,2.4)*0.34;
    return {kind,subsurface:0.05*(1-l),sheen,anisotropy:0,roughnessScale:0.96};
  }
  if(['mail','scale','metal'].includes(kind)){
    const anisotropy=Math.pow(clamp(v*0.65+l*0.35),3.2)*(kind==='metal'?0.38:0.28);
    return {kind,subsurface:0,sheen:0.12*(1-v),anisotropy,roughnessScale:kind==='metal'?0.86:0.9};
  }
  return {kind,subsurface:0.02*(1-l),sheen:Math.pow(1-v,2.8)*0.14,anisotropy:0,roughnessScale:0.95};
}

export function finishActorMaterial(material,kind){
  if(!material?.isMeshStandardMaterial)return material;
  const resolved=actorSurfaceKind(kind??material.normalMap?.userData?.actorSurface??material.map?.userData?.actorSurface??material.userData?.actorFinish);
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);
    let color='',roughness='';
    if(resolved==='skin'){
      color='diffuseColor.rgb*=vec3(1.0,.99,.985);';
      roughness='roughnessFactor=clamp(roughnessFactor,.46,.86);';
    }else if(resolved==='cloth'){
      color='diffuseColor.rgb*=1.04;';
      roughness='roughnessFactor*=.96;';
    }else if(['mail','scale','metal'].includes(resolved)){
      color='diffuseColor.rgb*=1.03;';
      roughness=`roughnessFactor*=${resolved==='metal'?'.86':'.90'};`;
    }else{
      roughness='roughnessFactor*=.95;';
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${color}`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\n${roughness}`);
    if(resolved==='skin')shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      // Bounded warm grazing fill, driven by existing indirect illumination.
      // This is an art-directed approximation, not screen-space subsurface scattering.
      float skinGrazing=pow(1.0-clamp(dot(normal,geometryViewDir),0.0,1.0),2.0);
      reflectedLight.indirectDiffuse+=irradiance*diffuseColor.rgb*vec3(.055,.020,.012)*skinGrazing;
    `);
  };
  material.customProgramCacheKey=()=>`${oldKey}:actor-finish-v035:${resolved}`;
  material.userData.actorFinish=resolved;
  // Figures dim under passing cloud like the ground they stand on.
  installCloudShadows(material);
  return material;
}
