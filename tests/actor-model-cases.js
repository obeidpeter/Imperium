// Development presentation specimens, not manufactured campaign checkpoints.
// Unit inputs are immutable and passed only to the production actor renderer.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ACTOR_CASES=freeze([
  {id:'recruit',label:'Recruit · Marcellus, 20',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},options:{chapter:1,rank:'Tiro'}},
  {id:'veteran',label:'Veteran · Roman infantry',unit:{id:'veteran-naso',veteranId:'naso',name:'Naso',side:'ally',role:'infantry'},options:{chapter:3,rank:'Miles'}},
  {id:'officer',label:'Officer · Marcellus, Centurio',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},options:{chapter:5,rank:'Centurio'}},
  {id:'cavalry',label:'Cavalry · Roman rider',unit:{id:'roman-cavalry',name:'Roman cavalry',side:'ally',role:'cavalry'},options:{chapter:9,rank:'Praepositus'}},
  {id:'goth',label:'Gothic spearman',unit:{id:'gothic-spearman',name:'Gothic spearman',side:'enemy',role:'infantry'},options:{chapter:2}},
  {id:'persian',label:'Persian guard',unit:{id:'persian-guard',name:'Persian guard',side:'enemy',role:'guard'},options:{chapter:5}},
  {id:'archer',label:'Persian archer',unit:{id:'persian-archer',name:'Persian archer',side:'enemy',role:'archer'},options:{chapter:6}},
  {id:'senator',label:'Senator · Marcellus, 45',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'speaker',bloc:'Civic'},options:{chapter:11,rank:'Senator'}},
  {id:'aelia',label:'Aelia · named civic character',unit:{id:'aelia',name:'Aelia',side:'ally',role:'voter',bloc:'Civic'},options:{chapter:10}},
  {id:'varro',label:'Varro · named mentor',unit:{id:'varro',name:'Varro',side:'ally',role:'trainer'},options:{chapter:1}},
  {id:'lucan',label:'Lucan · named comrade',unit:{id:'lucan',name:'Lucan',side:'ally',role:'infantry'},options:{chapter:3}},
  {id:'crispus',label:'Crispus · named rival',unit:{id:'crispus',name:'Crispus',side:'enemy',role:'speaker'},options:{chapter:11}},
  {id:'severianus',label:'Severianus · named patron',unit:{id:'severianus',name:'Severianus',side:'ally',role:'speaker'},options:{chapter:10}},
  {id:'paullus',label:'Paullus · named elder',unit:{id:'paullus',name:'Lucius Cassius Paullus',side:'ally',role:'voter',bloc:'Landholders'},options:{chapter:11}},
  {id:'sabinus',label:'Sabinus · named soldier',unit:{id:'sabinus',name:'Sabinus',side:'ally',role:'infantry'},options:{chapter:4}}
]);
export const ACTOR_MOTIONS=Object.freeze(['idle','walk','run','retreat','attack','throw','brace','block','hit','rally','speak','yield','withdrawn']);
export const actorCase=id=>ACTOR_CASES.find(item=>item.id===id)??ACTOR_CASES[0];
export function sampleSummary(samples){
  const ordered=samples.filter(Number.isFinite).slice(-120).sort((a,b)=>a-b),at=q=>ordered.length?ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*q)-1)]:null;
  return {count:ordered.length,median:at(.5),p95:at(.95),max:ordered.at(-1)??null};
}
export function actorResources(group){
  const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set(),skeletons=new Set();let meshes=0,skinnedMeshes=0,bones=0,visibleMeshes=0,visibleTriangles=0,geometryBytes=0,textureBytes=0;
  group.traverse(object=>{if(object.isBone)bones++;if(object.isMesh){meshes++;if(object.isSkinnedMesh)skinnedMeshes++;if(object.skeleton)skeletons.add(object.skeleton);if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);}});
  group.traverseVisible(object=>{if(object.isMesh){visibleMeshes++;visibleTriangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
  for(const geometry of geometries)for(const attribute of [geometry.index,...Object.values(geometry.attributes)]){const array=attribute?.array??attribute?.data?.array;if(array&&!buffers.has(array.buffer)){buffers.add(array.buffer);geometryBytes+=array.buffer.byteLength;}}
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const texture of textures){const image=texture.image;if(image)textureBytes+=(image.data?.byteLength??(image.width??0)*(image.height??0)*4)*(texture.generateMipmaps?4/3:1);}
  return {meshes,skinnedMeshes,bones,visibleMeshes,visibleTriangles,geometries:geometries.size,materials:materials.size,textures:textures.size,skeletons:skeletons.size,geometryArrayBytes:geometryBytes,estimatedTextureBytes:Math.ceil(textureBytes),textureEstimateScope:'Decoded image bytes plus approximate mipmaps; not measured GPU allocation.'};
}
