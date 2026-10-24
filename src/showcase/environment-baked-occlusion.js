import * as T from '../../vendor/three/three.module.js';

// Ambient occlusion baked once per scene from what is already built: the
// ground's relief and the static scenery standing on it. Each texel records how
// much open sky that patch of ground sees and the ground's height there, so any
// environment surface can darken where it meets the ground or stands in a
// narrow, walled or wooded place. Every quality tier samples it; it is the only
// occlusion on Performance, which renders without the screen-space pass and
// without scenery shadows. Deterministic, presentation only, no download.
//
// The same bake holds the sun's static shadows: for each texel, how high a
// point must stand to see the sun past the relief and scenery toward it (one
// sweep from the sun's side). The ground takes them across the whole field at
// every distance, the long shadows of dawn and dusk included, beyond the box
// the live shadow map covers near the camera (which still casts the figures).
export const BAKED_AO_TEXELS_PER_METRE=4;
export const BAKED_AO_STRENGTH=Object.freeze({performance:.9,balanced:.55,high:.5});
// Shadow heights are kept up to this many metres above the ground.
export const SUN_SHADOW_RANGE=16;
export const SUN_SHADOW_STRENGTH=Object.freeze({performance:.85,balanced:.9,high:.9});
const DIRECTIONS=8,STEPS=[.25,.5,.8,1.2,1.8,2.6,3.6],LIFT=.05;

export function createOcclusionField({minX,minZ,maxX,maxZ,resolution=BAKED_AO_TEXELS_PER_METRE,groundAt}){
  const nx=Math.max(2,Math.ceil((maxX-minX)*resolution)),nz=Math.max(2,Math.ceil((maxZ-minZ)*resolution)),cell=1/resolution;
  const ground=new Float32Array(nx*nz),top=new Float32Array(nx*nz).fill(-Infinity);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const y=groundAt(minX+(ix+.5)*cell,minZ+(iz+.5)*cell);ground[iz*nx+ix]=Number.isFinite(y)?y:0;}
  let samples=0;
  const at=(x,z)=>{const ix=Math.floor((x-minX)*resolution),iz=Math.floor((z-minZ)*resolution);return ix<0||iz<0||ix>=nx||iz>=nz?-1:iz*nx+ix;};
  const mark=(x,z,y)=>{const i=at(x,z);if(i>=0&&y>top[i])top[i]=y;};
  // A surface marks every texel its plan covers with its height there. Edges
  // are traced at half-texel spacing, so vertical faces (walls, posts, cloth)
  // mark their line up to their top; wider faces also fill their footprint.
  function edge(x0,y0,z0,x1,y1,z1){
    const n=Math.max(1,Math.ceil(Math.sqrt((x1-x0)*(x1-x0)+(z1-z0)*(z1-z0))*resolution*2));
    for(let k=0;k<=n;k++){const t=k/n;mark(x0+(x1-x0)*t,z0+(z1-z0)*t,y0+(y1-y0)*t);}samples+=n+1;
  }
  function triangle(ax,ay,az,bx,by,bz,cx,cy,cz){
    if(Math.max(ax,bx,cx)<minX||Math.min(ax,bx,cx)>maxX||Math.max(az,bz,cz)<minZ||Math.min(az,bz,cz)>maxZ)return;
    const area=(bx-ax)*(cz-az)-(cx-ax)*(bz-az),plan=Math.abs(area)*resolution*resolution;
    const longest=Math.max((bx-ax)*(bx-ax)+(bz-az)*(bz-az),(cx-ax)*(cx-ax)+(cz-az)*(cz-az),(cx-bx)*(cx-bx)+(cz-bz)*(cz-bz));
    // Vertical and sliver faces are traced; their interiors would miss texel centres.
    if(plan<2||Math.abs(area)<longest*.1){edge(ax,ay,az,bx,by,bz);edge(bx,by,bz,cx,cy,cz);edge(cx,cy,cz,ax,ay,az);if(plan<2)return;}
    const ix0=Math.max(0,Math.floor((Math.min(ax,bx,cx)-minX)*resolution)),ix1=Math.min(nx-1,Math.floor((Math.max(ax,bx,cx)-minX)*resolution));
    const iz0=Math.max(0,Math.floor((Math.min(az,bz,cz)-minZ)*resolution)),iz1=Math.min(nz-1,Math.floor((Math.max(az,bz,cz)-minZ)*resolution)),inverse=1/area;
    for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
      const px=minX+(ix+.5)*cell,pz=minZ+(iz+.5)*cell,wa=((bx-px)*(cz-pz)-(cx-px)*(bz-pz))*inverse,wb=((cx-px)*(az-pz)-(ax-px)*(cz-pz))*inverse,wc=1-wa-wb;samples++;
      if(wa<-1e-6||wb<-1e-6||wc<-1e-6)continue;
      const y=wa*ay+wb*by+wc*cy,i=iz*nx+ix;if(y>top[i])top[i]=y;
    }
  }
  function box(x0,x1,z0,z1,y){
    const ix0=Math.max(0,Math.floor((x0-minX)*resolution)),ix1=Math.min(nx-1,Math.floor((x1-minX)*resolution)),iz0=Math.max(0,Math.floor((z0-minZ)*resolution)),iz1=Math.min(nz-1,Math.floor((z1-minZ)*resolution));
    for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){const i=iz*nx+ix;if(y>top[i])top[i]=y;samples++;}
  }
  // Sky visibility: in eight directions, the steepest rise of ground or
  // scenery within 3.6 m; open ground sees nearly all of the sky.
  function finish(){
    const surface=new Float32Array(nx*nz),raw=new Float32Array(nx*nz),count=STEPS.length,tapX=new Int32Array(DIRECTIONS*count),tapZ=new Int32Array(DIRECTIONS*count),tapD2=new Float32Array(DIRECTIONS*count);
    for(let i=0;i<nx*nz;i++)surface[i]=Math.max(ground[i],top[i]);
    // Each direction's taps as whole-texel offsets with their true distances.
    for(let k=0;k<DIRECTIONS;k++){const a=(k+.5)*Math.PI*2/DIRECTIONS;for(let s=0;s<count;s++){const n=k*count+s,ox=Math.round(Math.cos(a)*STEPS[s]*resolution),oz=Math.round(Math.sin(a)*STEPS[s]*resolution);tapX[n]=ox;tapZ[n]=oz;tapD2[n]=(ox*ox+oz*oz)*cell*cell||cell*cell*.25;}}
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
      const i=iz*nx+ix,g=ground[i];
      // Covered ground (under a canopy, an awning or the scenery itself) sees
      // little sky; under solid scenery it is hidden anyway.
      if(top[i]>g+.15){raw[i]=top[i]>g+1.2?.5:.62;continue;}
      const base=g+LIFT;let seen=0;
      for(let k=0;k<DIRECTIONS;k++){
        let rise=0;
        for(let s=0;s<count;s++){const n=k*count+s,x=ix+tapX[n],z=iz+tapZ[n];if(x<0||z<0||x>=nx||z>=nz)break;const r=surface[z*nx+x]-base;if(r>0){const v=r/Math.sqrt(r*r+tapD2[n]);if(v>rise)rise=v;}}
        // Cosine-weighted: low horizons cost little light, steep walls a lot.
        seen+=1-rise*rise;
      }
      raw[i]=seen/DIRECTIONS;
    }
    // A light 3x3 blur keeps texel steps out of the shading.
    const ao=new Float32Array(nx*nz);
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){let sum=0,w=0;for(let oz=-1;oz<=1;oz++)for(let ox=-1;ox<=1;ox++){const x=ix+ox,z=iz+oz;if(x<0||z<0||x>=nx||z>=nz)continue;const k=(ox||oz)?(ox&&oz?.5:1):2;sum+=raw[z*nx+x]*k;w+=k;}ao[iz*nx+ix]=sum/w;}
    return ao;
  }
  return {nx,nz,minX,minZ,maxX,maxZ,cell,ground,top,triangle,box,finish,get samples(){return samples;}};
}

/**
 * For each texel, how far above its ground a point must stand to see the sun
 * (`sun` points toward it): the highest of the relief and scenery toward the
 * sun, lowered by the sun's rise over the distance. One sweep from the sun's
 * side, each texel reading the one a step sunward of it. 0 where the ground is
 * lit; all 0 with the sun overhead or below the horizon.
 */
export function sunShadowHeights(field,sun){
  const {nx,nz,ground,top,cell}=field,out=new Float32Array(nx*nz),flat=Math.hypot(sun?.[0]??0,sun?.[2]??0);
  if(!(sun?.[1]>0)||flat<1e-6)return out;
  const along=Math.abs(sun[0])>=Math.abs(sun[2]),main=along?sun[0]/flat:sun[2]/flat,cross=along?sun[2]/flat:sun[0]/flat;
  const step=Math.sign(main),slope=cross/Math.abs(main),drop=cell/Math.abs(main)*sun[1]/flat;
  // The highest surface seen looking sunward from each texel, itself included.
  const highest=new Float32Array(nx*nz).fill(-Infinity),lines=along?nx:nz,width=along?nz:nx;
  const index=(line,k)=>along?k*nx+line:line*nx+k;
  for(let n=0;n<lines;n++){
    const line=step>0?lines-1-n:n,previous=line+step;
    for(let k=0;k<width;k++){
      const i=index(line,k);let shade=-Infinity;
      if(previous>=0&&previous<lines){
        const at=k+slope,k0=Math.floor(at),f=at-k0,a=k0>=0&&k0<width?highest[index(previous,k0)]:-Infinity,b=k0+1>=0&&k0+1<width?highest[index(previous,k0+1)]:-Infinity;
        shade=(a===-Infinity||b===-Infinity?Math.max(a,b):a+(b-a)*f)-drop;
      }
      out[i]=Math.max(0,shade-ground[i]);highest[i]=Math.max(ground[i],top[i],shade);
    }
  }
  return out;
}

const corners=Array.from({length:8},()=>new T.Vector3());
const worldBox=(box,matrix,out)=>{let i=0;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])corners[i++].set(x,y,z).applyMatrix4(matrix);return out.setFromPoints(corners);};
// Static meshes that stand on the ground and block sky. Grass tufts, water,
// translucent and unlit effects, and the ground itself do not.
export function occluderEligible(object){
  if(!object.isMesh||object.isSkinnedMesh||object.userData.environmentGround||object.userData.bakedOcclusion===false)return false;
  const material=Array.isArray(object.material)?object.material[0]:object.material;
  if(!material||material.transparent||material.isMeshBasicMaterial||material.userData?.environmentFinish==='water')return false;
  return !/meadow grass|fern leaves/.test(object.name);
}
export function rasterizeOccluders(field,root,{exclude=new Set()}={}){
  const matrix=new T.Matrix4(),instanceMatrix=new T.Matrix4(),bounds=new T.Box3();let meshes=0,instances=0,world=new Float32Array(0);
  root.updateMatrixWorld(true);
  root.traverse(object=>{
    if(exclude.has(object)||!occluderEligible(object))return;
    for(let p=object.parent;p;p=p.parent)if(exclude.has(p)||p.userData.bakedOcclusion===false)return;
    const geometry=object.geometry,position=geometry?.attributes?.position;if(!position)return;
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    const index=geometry.index,count=object.isInstancedMesh?object.count:1;meshes++;
    for(let n=0;n<count;n++){
      if(object.isInstancedMesh){object.getMatrixAt(n,instanceMatrix);matrix.multiplyMatrices(object.matrixWorld,instanceMatrix);}else matrix.copy(object.matrixWorld);
      worldBox(geometry.boundingBox,matrix,bounds);
      if(bounds.max.x<field.minX||bounds.min.x>field.maxX||bounds.max.z<field.minZ||bounds.min.z>field.maxZ)continue;
      instances++;
      // Small parts (leaf sprays, stones, posts) mark their plan box; larger
      // ones their real triangles, so a diagonal wall shades only its line.
      if(bounds.max.x-bounds.min.x<1.2&&bounds.max.z-bounds.min.z<1.2){field.box(bounds.min.x,bounds.max.x,bounds.min.z,bounds.max.z,bounds.max.y);continue;}
      // Each vertex is placed once; triangles then read the placed positions.
      if(world.length<position.count*3)world=new Float32Array(position.count*3);
      const m=matrix.elements;
      for(let v=0;v<position.count;v++){const x=position.getX(v),y=position.getY(v),z=position.getZ(v);world[v*3]=m[0]*x+m[4]*y+m[8]*z+m[12];world[v*3+1]=m[1]*x+m[5]*y+m[9]*z+m[13];world[v*3+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
      const triangles=(index?index.count:position.count)/3;
      for(let t=0;t<triangles;t++){
        const p=(index?index.getX(t*3):t*3)*3,q=(index?index.getX(t*3+1):t*3+1)*3,r=(index?index.getX(t*3+2):t*3+2)*3;
        field.triangle(world[p],world[p+1],world[p+2],world[q],world[q+1],world[q+2],world[r],world[r+1],world[r+2]);
      }
    }
  });
  return {meshes,instances};
}
// R: sky visibility; G: ground height across the field's height range;
// B: the sun's shadow height above the ground, over SUN_SHADOW_RANGE.
export function occlusionTexture(field,ao,shadow=null){
  let low=Infinity,high=-Infinity;for(const y of field.ground){low=Math.min(low,y);high=Math.max(high,y);}
  const range=Math.max(.01,high-low),bytes=new Uint8Array(field.nx*field.nz*4);
  for(let i=0;i<field.nx*field.nz;i++){bytes[i*4]=Math.round(Math.max(0,Math.min(1,ao[i]))*255);bytes[i*4+1]=Math.round((field.ground[i]-low)/range*255);
    bytes[i*4+2]=shadow?Math.round(Math.min(1,shadow[i]/SUN_SHADOW_RANGE)*255):0;bytes[i*4+3]=255;}
  const texture=new T.DataTexture(bytes,field.nx,field.nz,T.RGBAFormat);
  texture.name='Imperium baked scene occlusion';texture.colorSpace=T.NoColorSpace;texture.magFilter=texture.minFilter=T.LinearFilter;texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.needsUpdate=true;
  return {texture,low,range};
}
// The same uniforms for materials that outlive a scene (the generated scenery,
// shared through its model cache): each new bake points them at its own field.
export const SCENE_OCCLUSION=Object.freeze({imperiumAoMap:{value:null},imperiumAoBounds:{value:new T.Vector4(0,0,0,0)},imperiumAoHeight:{value:new T.Vector2(0,1)},
  imperiumAoStrength:{value:0},imperiumSunShadow:{value:0},imperiumLiveShadow:{value:new T.Vector3(0,0,0)}});
let sceneBake=null;
const pointScene=uniforms=>{for(const key of Object.keys(SCENE_OCCLUSION))SCENE_OCCLUSION[key].value=uniforms[key].value;};
export function bakeEnvironmentOcclusion(root,{groundAt,bounds,quality='balanced',exclude,sun=null}={}){
  const started=globalThis.performance?.now?.()??Date.now();
  const field=createOcclusionField({...bounds,groundAt}),raster=rasterizeOccluders(field,root,{exclude}),ao=field.finish(),shadow=sunShadowHeights(field,sun);
  const {texture,low,range}=occlusionTexture(field,ao,shadow);
  const uniforms={
    imperiumAoMap:{value:texture},
    imperiumAoBounds:{value:new T.Vector4(field.minX,field.minZ,1/(field.maxX-field.minX),1/(field.maxZ-field.minZ))},
    imperiumAoHeight:{value:new T.Vector2(low,range)},
    imperiumAoStrength:{value:BAKED_AO_STRENGTH[quality]??BAKED_AO_STRENGTH.balanced},
    imperiumSunShadow:{value:SUN_SHADOW_STRENGTH[quality]??SUN_SHADOW_STRENGTH.balanced},
    // Where the live shadow map already casts the scenery: centre x, z and half-width (0: nowhere).
    imperiumLiveShadow:{value:new T.Vector3(0,0,0)}
  };
  let mean=0;for(const v of ao)mean+=v;mean/=ao.length;let darkest=1;for(const v of ao)darkest=Math.min(darkest,v);
  let shaded=0;for(const v of shadow)if(v>.05)shaded++;
  const stats={width:field.nx,height:field.nz,meshes:raster.meshes,instances:raster.instances,samples:field.samples,mean,darkest,strength:uniforms.imperiumAoStrength.value,
    sunShadow:shaded/shadow.length,milliseconds:(globalThis.performance?.now?.()??Date.now())-started};
  const bake={field,ao,shadow,texture,uniforms,stats,
    setQuality(value){uniforms.imperiumAoStrength.value=BAKED_AO_STRENGTH[value]??BAKED_AO_STRENGTH.balanced;uniforms.imperiumSunShadow.value=SUN_SHADOW_STRENGTH[value]??SUN_SHADOW_STRENGTH.balanced;stats.strength=uniforms.imperiumAoStrength.value;if(sceneBake===bake)pointScene(uniforms);},
    // The live map's box this frame, or none (its scenery does not cast at Performance).
    setLiveShadow(x=0,z=0,half=0){uniforms.imperiumLiveShadow.value.set(x,z,half);},
    dispose(){texture.dispose();if(sceneBake===bake){sceneBake=null;pointScene(EMPTY);}}};
  sceneBake=bake;pointScene(uniforms);
  return bake;
}
const EMPTY={imperiumAoMap:{value:null},imperiumAoBounds:{value:new T.Vector4(0,0,0,0)},imperiumAoHeight:{value:new T.Vector2(0,1)},imperiumAoStrength:{value:0},imperiumSunShadow:{value:0},imperiumLiveShadow:{value:new T.Vector3(0,0,0)}};

// Ground surfaces read only the sky term; everything standing on the ground
// also darkens toward its foot. Indirect light carries the occlusion, with a
// little of the direct light so it still reads in full sun.
const vertexDeclarations='varying vec3 vImperiumAoWorld;\n';
const vertexBody=`
  vec4 imperiumAoPosition=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
    imperiumAoPosition=instanceMatrix*imperiumAoPosition;
  #endif
  vImperiumAoWorld=(modelMatrix*imperiumAoPosition).xyz;
`;
const fragmentDeclarations='varying vec3 vImperiumAoWorld;\nuniform sampler2D imperiumAoMap;\nuniform vec4 imperiumAoBounds;\nuniform vec2 imperiumAoHeight;\nuniform float imperiumAoStrength;\nuniform float imperiumSunShadow;\nuniform vec3 imperiumLiveShadow;\n';
const fragmentBody=ground=>`
  {
    vec2 aoUv=(vImperiumAoWorld.xz-imperiumAoBounds.xy)*imperiumAoBounds.zw;
    vec2 aoEdge=min(aoUv,1.0-aoUv);
    float aoInside=smoothstep(0.0,0.08,min(aoEdge.x,aoEdge.y));
    vec4 aoTexel=texture2D(imperiumAoMap,clamp(aoUv,0.0,1.0));
    float aoAbove=vImperiumAoWorld.y-(imperiumAoHeight.x+aoTexel.g*imperiumAoHeight.y);
    float aoSky=${ground?'aoTexel.r':'mix(aoTexel.r,1.0,smoothstep(0.2,2.6,aoAbove))'};
    float aoBaked=mix(1.0,aoSky${ground?'':'*mix(0.58,1.0,smoothstep(0.02,0.8,aoAbove))'},aoInside*imperiumAoStrength);
    reflectedLight.indirectDiffuse*=aoBaked;
    reflectedLight.indirectSpecular*=mix(1.0,aoBaked,0.7);
    reflectedLight.directDiffuse*=mix(1.0,aoBaked,0.2);${ground?`
    // The scenery's static shadow on the ground, beyond the live shadow map's box.
    // The box turns with the sun and reaches at least its half-width from the
    // centre in every direction on the ground, so a disc of that radius is covered.
    float aoLive=distance(vImperiumAoWorld.xz,imperiumLiveShadow.xy);
    float aoOutside=1.0-step(0.5,imperiumLiveShadow.z)*(1.0-smoothstep(imperiumLiveShadow.z-4.0,imperiumLiveShadow.z-1.0,aoLive));
    float aoSun=1.0-smoothstep(0.12,0.45,aoTexel.b*${SUN_SHADOW_RANGE.toFixed(1)}-aoAbove)*aoInside*aoOutside*imperiumSunShadow;
    reflectedLight.directDiffuse*=aoSun;
    reflectedLight.directSpecular*=aoSun;`:''}
  }
`;
export function installBakedOcclusion(material,uniforms,{ground=false}={}){
  if(!material||material.userData.bakedOcclusion)return false;
  if(!(material.isMeshStandardMaterial||material.isMeshLambertMaterial||material.isMeshPhongMaterial))return false;
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,...args)=>{
    previous.call(material,shader,...args);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=vertexDeclarations+shader.vertexShader.replace('#include <project_vertex>',vertexBody+'\n#include <project_vertex>');
    shader.fragmentShader=fragmentDeclarations+shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\n'+fragmentBody(ground));
  };
  material.customProgramCacheKey=()=>`${oldKey}:baked-occlusion-v2:${ground?'ground':'standing'}`;
  material.userData.bakedOcclusion=ground?'ground':'standing';
  return true;
}
