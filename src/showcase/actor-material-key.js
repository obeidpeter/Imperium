// Batching may combine color tints, but must preserve the physical response.
// In particular, an untextured eye and a leather strap cannot share roughness.
export function actorMaterialKey(m){
  return [m.type,m.map?.uuid,m.bumpMap?.uuid,m.normalMap?.uuid,m.roughnessMap?.uuid,m.roughness,m.metalness,m.bumpScale,m.normalScale?.x,m.normalScale?.y,m.clearcoat,m.clearcoatRoughness,m.sheen,m.sheenRoughness,m.sheenColor?.getHex(),m.ior,m.specularIntensity,m.side,m.transparent].join('|');
}
