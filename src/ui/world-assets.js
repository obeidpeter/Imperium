// Local world artwork. Keep this declaration independent of the shared loader.
export const WORLD_ASSETS=Object.freeze(['./assets/world/ground-materials.webp','./assets/world/natural-props.webp','./assets/world/camp-props.webp']);
const identities=new WeakMap();let nextIdentity=0;
export function worldAssetKey(lookup){return WORLD_ASSETS.map(path=>{const image=lookup(path);if(!image)return 0;if(!identities.has(image))identities.set(image,++nextIdentity);return identities.get(image);}).join(':');}
