import * as T from '../../vendor/three/three.module.js';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));

/** Small corrective blendshapes over each owned imported anatomy mesh.
 * Positions are authored landmark fields, not facial capture or a new scan.
 * Zero deltas outside the face preserve neck, hands, eyes and body anchors. */
export function addActorExpressionMorphs(geometry){
  const p=geometry.attributes.position,skin=geometry.attributes.skinIndex;
  if(!p||!skin||geometry.morphAttributes.position?.length)return geometry;
  const jaw=new Float32Array(p.count*3),focus=new Float32Array(p.count*3),concern=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    if(skin.getX(i)!==1)continue;
    const x=p.getX(i),y=p.getY(i)-1.485,z=p.getZ(i),front=clamp((z-.005)/.055);
    const lower=bell(y,-.012,.027)*bell(x,0,.047)*front;
    // A restrained jaw settling and lip compression, with no artificial dark
    // mouth pasted over the skin. This is expression, not phoneme lip sync.
    jaw[i*3+1]=-.0046*lower;jaw[i*3+2]=-.0017*lower;
    const brow=bell(y,.116,.018)*bell(Math.abs(x),.029,.028)*front;
    focus[i*3]=Math.sign(x)*-.0018*brow;focus[i*3+1]=-.0022*brow;focus[i*3+2]=.0007*brow;
    const cheek=bell(y,.033,.028)*bell(Math.abs(x),.041,.025)*front;
    concern[i*3+1]=.0018*brow-.0012*cheek;concern[i*3+2]=-.0013*cheek;
  }
  geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[['jaw',jaw],['focus',focus],['concern',concern]].map(([name,data])=>{const attribute=new T.Float32BufferAttribute(data,3);attribute.name=name;return attribute;});
  geometry.userData.expressionMorphs='original-landmark-correctives-v034';return geometry;
}
export function updateActorExpressionMorphs(meshes,expression,input={}){
  const strained=['hit','hurt','yield','withdrawn'].includes(input.motion),active=['attack','strike','brace','formation','block'].includes(input.motion);
  for(const mesh of meshes){
    if(!mesh.geometry.userData.expressionMorphs||!mesh.morphTargetInfluences)continue;
    mesh.morphTargetInfluences[0]=clamp(expression.jawOpen);
    mesh.morphTargetInfluences[1]=input.reducedMotion?0:clamp(active?.6+expression.lidFocus:expression.lidFocus*2);
    mesh.morphTargetInfluences[2]=input.reducedMotion?0:strained?.65:0;
    if(mesh.geometry.userData.expressionMorphs==='generated-head-correctives-v041')mesh.morphTargetInfluences[3]=input.reducedMotion?0:clamp(input.blink??0);
  }
}
