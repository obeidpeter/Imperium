import * as T from '../../vendor/three/three.module.js';

// The shadow pass draws each caster with three's shared depth material, and
// hands it the caster's colour map even when no alpha test cuts the caster's
// outline. There the map changes nothing in the shadow, but every textured
// caster makes the pass another program variant, and a battle compiles each
// variant ahead of play (warmShadows). Without it, only the casters that are
// cut out by alpha (leaves, hair) keep their maps in the shadow pass.
// Presentation only: no game state, rules or gameplay randomness.
export function plainShadowDepth(depthMaterial){
  if(!depthMaterial||depthMaterial.alphaTest>0)return;
  depthMaterial.map=null;depthMaterial.alphaMap=null;
}
// Every caster's default; a caster with a hook of its own calls plainShadowDepth itself.
T.Object3D.prototype.onBeforeShadow=function(renderer,object,camera,shadowCamera,geometry,depthMaterial){plainShadowDepth(depthMaterial);};
