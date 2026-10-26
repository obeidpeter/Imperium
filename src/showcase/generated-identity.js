import * as T from '../../vendor/three/three.module.js';

// Reuse the shipped bare-headed recruit's actual generated head, textures and
// two levels of detail across rank changes. Nothing is fetched or generated
// here. The cut is at the neck, above the shoulder silhouette.
export const IDENTITY_NECK_HEIGHT=1.50;
export const IDENTITY_HEAD_BODY='roman-recruit';
export const usesPersistentHead=identity=>!!identity&&!identity.female&&!identity.key.startsWith('figure-');
const clamp=n=>Math.max(0,Math.min(1,n));
const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));

/** Clip indexed skinned geometry without losing UVs, normals or skin weights.
 * New seam vertices blend influences by joint id, never by index number.
 * The source is immutable; the returned geometry belongs to the caller. */
export function clipBodyAtNeck(source,{above=false,height=IDENTITY_NECK_HEIGHT,axis=1}={}){
  const attributes=Object.entries(source.attributes),output=Object.fromEntries(attributes.map(([name])=>[name,[]])),indices=[],vertices=new Map();
  const p=source.attributes.position,lookup=source.index,read=i=>Object.fromEntries(attributes.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,k)=>a.getComponent(i,k))]));
  const vertex=i=>({key:`v${i}`,data:read(i)});
  function intersection(a,b){
    const t=(height-a.data.position[axis])/(b.data.position[axis]-a.data.position[axis]);
    const data=Object.fromEntries(attributes.map(([name])=>[name,a.data[name].map((v,k)=>v+(b.data[name][k]-v)*t)]));
    if(data.skinIndex&&data.skinWeight){
      const weights=new Map();for(const [v,amount]of [[a,1-t],[b,t]])for(let k=0;k<4;k++){const id=v.data.skinIndex[k];weights.set(id,(weights.get(id)??0)+v.data.skinWeight[k]*amount);}
      const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=top.reduce((n,[,w])=>n+w,0)||1;
      data.skinIndex=Array.from({length:4},(_,k)=>top[k]?.[0]??0);data.skinWeight=Array.from({length:4},(_,k)=>(top[k]?.[1]??0)/sum);
    }
    data.position[axis]=height;
    return {key:[a.key,b.key].sort().join(':'),data};
  }
  function emit(v){if(vertices.has(v.key))return vertices.get(v.key);const i=vertices.size;vertices.set(v.key,i);for(const [name]of attributes)output[name].push(...v.data[name]);return i;}
  const count=lookup?.count??p.count;
  for(let i=0;i<count;i+=3){const triangle=[0,1,2].map(k=>vertex(lookup?lookup.getX(i+k):i+k)),polygon=[];
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],insideA=above?a.data.position[axis]>=height:a.data.position[axis]<=height,insideB=above?b.data.position[axis]>=height:b.data.position[axis]<=height;
      if(insideA)polygon.push(a);if(insideA!==insideB)polygon.push(intersection(a,b));}
    for(let j=1;j<polygon.length-1;j++)indices.push(...[polygon[0],polygon[j],polygon[j+1]].map(emit));
  }
  const geometry=new T.BufferGeometry();for(const [name,a]of attributes)geometry.setAttribute(name,name==='skinIndex'?new T.Uint16BufferAttribute(output[name],a.itemSize):new T.Float32BufferAttribute(output[name],a.itemSize));
  geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={...source.userData,identityPart:above?'head':'body'};return geometry;
}

// Independently generated collars have different neck widths. Seat only their
// upper neck underneath the shared head, leaving shoulders/armour unchanged.
export function fitGeneratedNeck(geometry){
  const p=geometry.attributes.position;for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y<1.43||Math.abs(x)>.18||Math.abs(z)>.18)continue;
    const q=Math.hypot((x+.018)/.087,(z-.008)/.075);if(q<=1)continue;
    // The cloth starts at 1.46 m. Finish fitting below that edge; leaving the
    // blend inside the cloth let the trainer's dark neckline pierce its front.
    const t=clamp((y-1.43)/.03),scale=1+(1/q-1)*t*t*(3-2*t);p.setXYZ(i,-.018+(x+.018)*scale,y,.008+(z-.008)*scale);
  }geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}

// Bounded facial sculpting affects the face, never the neck seam, UVs or the
// skeleton. The hero has exactly the same skull at every rank; maturity is in
// posture and the existing wardrobe, rather than swapping him for another man.
export function sculptGeneratedHead(geometry,identity){
  const p=geometry.attributes.position,jaw=[],focus=[],concern=[],blink=[];
  for(let i=0;i<p.count;i++){
    let x=p.getX(i),y=p.getY(i),z=p.getZ(i),front=clamp((z-.03)/.07),face=bell(y,1.62,.12)*front;
    const jawField=bell(y,1.565,.043),cheek=bell(y,1.63,.04),centre=-.018;
    if(identity.key!=='marcellus'){
      x=centre+(x-centre)*(1+((identity.jaw??1)-1)*jawField*.55+((identity.cheek??1)-1)*cheek*.55);
      z+=((identity.nose??1)-1)*.055*bell(x,centre,.028)*bell(y,1.625,.045)*face;
      y+=((identity.brow??1)-1)*.018*bell(y,1.68,.024)*front;
    }
    p.setXYZ(i,x,y,z);
    const lower=bell(y,1.56,.026)*bell(x,centre,.052)*front,brow=bell(y,1.68,.019)*bell(Math.abs(x-centre),.037,.031)*front;
    jaw.push(0,-.008*lower,.0015*lower);focus.push(Math.sign(centre-x)*.001*brow,-.0025*brow,.0005*brow);concern.push(0,.002*brow-.001*lower,0);
    const eye=bell(Math.abs(x-centre),.036,.018)*bell(y,1.662,.012)*front;
    blink.push(0,(1.662-y)*.88*eye,.0008*eye);
  }
  // Keep the authored smooth normals. Recomputing split UV vertices makes the
  // compressed generated head visibly faceted, even where its shape is unchanged.
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[['jaw',jaw],['focus',focus],['concern',concern],['blink',blink]].map(([name,data])=>{const a=new T.Float32BufferAttribute(data,3);a.name=name;return a;});
  geometry.userData={...geometry.userData,identity:identity.key,expressionMorphs:'generated-head-correctives-v041',headSource:IDENTITY_HEAD_BODY};return geometry;
}

/** Per-person hair ageing and stubble over the existing painted head. Uniforms
 * share one program across the cast; the original albedo/normal maps remain.
 * This does not claim to replace the generated haircut with a new groom. */
export function generatedIdentityMaterial(source,identity,{offsetY=0}={}){
  const material=source.clone(),previous=source.onBeforeCompile,key=source.customProgramCacheKey?.bind(source);
  material.name=`generated identity ${identity.key}`;
  material.userData.generatedIdentity=identity.key;
  material.onBeforeCompile=(shader,renderer)=>{
    previous?.call(material,shader,renderer);
    shader.uniforms.identityGrey={value:clamp(identity.grey??0)};shader.uniforms.identityBeard={value:clamp(identity.beard??0)};shader.uniforms.identityVerticalOffset={value:offsetY};
    shader.vertexShader='varying vec3 identityPosition;\nuniform float identityVerticalOffset;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n identityPosition=position-vec3(0.0,identityVerticalOffset,0.0);');
    shader.fragmentShader='varying vec3 identityPosition;\nuniform float identityGrey;\nuniform float identityBeard;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(identityGrey>0.0 || identityBeard>0.0){
      float hairDark=1.0-smoothstep(0.045,0.17,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      float scalp=smoothstep(1.69,1.73,identityPosition.y);
      scalp=max(scalp,smoothstep(.055,.09,abs(identityPosition.x+.018))*smoothstep(1.61,1.69,identityPosition.y));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.34,.31,.27),hairDark*scalp*identityGrey*.8);
      float beard=exp(-pow((identityPosition.y-1.565)/.035,2.0))*smoothstep(.045,.085,identityPosition.z);
      float lip=exp(-pow((identityPosition.x+.018)/.028,4.0)-pow((identityPosition.y-1.588)/.012,2.0));
      diffuseColor.rgb*=1.0-identityBeard*beard*(1.0-lip)*.30;
      }
    `);
  };
  material.customProgramCacheKey=()=>`${key?.()??''}:generated-identity-v041`;return material;
}
