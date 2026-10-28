import * as T from '../../vendor/three/three.module.js';

// Imported art shares its shader programs (worlds and gameplay plan, release 4).
// three.js compiles a program for each combination of maps and flags, so every
// opaque material of a generated model (Tripo props, the regional kits, Chapter
// V's fortress, the board kit) is given the same set: colour, normal and
// roughness-metalness maps, a neutral 1×1 texture where a model has none, both
// sides drawn, no extra maps. Alpha-tested materials are the one cut-out variant;
// blended ones keep their own. Each master is normalised once as it loads and its
// clones share the result. The look is unchanged: a white map, a flat normal and
// a white roughness-metalness texture multiply the material's own factors by one,
// and a surface drawn from one side still casts its shadow from that side.
const pixel=(r,g,b,colorSpace)=>{const t=new T.DataTexture(new Uint8Array([r,g,b,255]),1,1);t.colorSpace=colorSpace;t.needsUpdate=true;t.userData.neutral=true;return t;};
const NEUTRAL=Object.freeze({colour:pixel(255,255,255,T.SRGBColorSpace),normal:pixel(128,128,255,T.NoColorSpace),surface:pixel(255,255,255,T.NoColorSpace)});
const NEUTRAL_MAPS=Object.freeze({map:NEUTRAL.colour,normalMap:NEUTRAL.normal,roughnessMap:NEUTRAL.surface,metalnessMap:NEUTRAL.surface,bumpMap:NEUTRAL.surface});
const UNUSED=['aoMap','emissiveMap','lightMap','bumpMap','displacementMap','alphaMap'];
const SHADOW_SIDE=Object.freeze({[T.FrontSide]:T.BackSide,[T.BackSide]:T.FrontSide});

// The maps a shared program samples, neutral where a material has none of its own
// (a constant bump map has no relief). Code-built surfaces use it to join the
// program of their textured neighbours.
export function addNeutralMaps(material,keys){
  for(const key of keys)material[key]??=NEUTRAL_MAPS[key];
  material.needsUpdate=true;return material;
}
export function normaliseModelMaterial(material){
  if(!material?.isMeshStandardMaterial||material.isMeshPhysicalMaterial||material.transparent||material.userData.sharedProgram)return material;
  material.map??=NEUTRAL.colour;material.normalMap??=NEUTRAL.normal;
  const surface=material.roughnessMap??material.metalnessMap??NEUTRAL.surface;
  material.roughnessMap??=surface;material.metalnessMap??=surface;
  for(const key of UNUSED)material[key]=null;
  if(material.side!==T.DoubleSide)material.shadowSide??=SHADOW_SIDE[material.side];
  material.side=T.DoubleSide;material.flatShading=false;material.vertexColors=false;
  if(material.alphaTest>0)material.alphaTest=.5;
  material.userData.sharedProgram=material.alphaTest>0?'cut-out':'opaque';material.needsUpdate=true;
  return material;
}
export function normaliseModelMaterials(root){
  root?.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)o.material=Array.isArray(o.material)?o.material.map(normaliseModelMaterial):normaliseModelMaterial(o.material);});
  return root;
}
