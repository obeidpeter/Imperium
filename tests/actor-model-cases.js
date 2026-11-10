// Development presentation specimens, not manufactured campaign checkpoints.
// Unit inputs are immutable and passed only to the production actor renderer.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ACTOR_CASES=freeze([
  {id:'recruit',label:'Recruit · Marcellus, 20',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},options:{chapter:1,rank:'Tiro'}},
  {id:'veteran',label:'Veteran · Roman infantry',unit:{id:'veteran-naso',veteranId:'naso',name:'Naso',side:'ally',role:'infantry'},options:{chapter:3,rank:'Miles'}},
  {id:'officer',label:'Officer · Marcellus, Centurio',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'infantry'},options:{chapter:5,rank:'Centurio'}},
  {id:'cavalry',label:'Cavalry · Roman rider',unit:{id:'roman-cavalry',name:'Roman cavalry',side:'ally',role:'cavalry'},options:{chapter:7,rank:'Praepositus'}},
  {id:'moorish',label:'Cavalry · Moorish rider',unit:{id:'roman-cavalry',name:'Roman cavalry',side:'ally',role:'cavalry'},options:{chapter:9,rank:'Praepositus'}},
  {id:'goth',label:'Gothic spearman',unit:{id:'gothic-spearman',name:'Gothic spearman',side:'enemy',role:'infantry'},options:{chapter:2}},
  {id:'goth-skirmisher',label:'Gothic skirmisher',unit:{id:'raider-skirmisher',name:'Gothic skirmisher',side:'enemy',role:'raider'},options:{chapter:1}},
  {id:'champion',label:'Champion · the war band’s chieftain',unit:{id:'champion-gate',name:'The war band’s chieftain',side:'enemy',role:'champion'},options:{chapter:4}},
  {id:'persian',label:'Persian guard',unit:{id:'persian-guard',name:'Persian guard',side:'enemy',role:'guard'},options:{chapter:5}},
  {id:'persian-skirmisher',label:'Persian skirmisher',unit:{id:'persian-raiders',name:'Persian raiders',side:'enemy',role:'raider'},options:{chapter:6}},
  {id:'archer',label:'Persian archer',unit:{id:'persian-archer',name:'Persian archer',side:'enemy',role:'archer'},options:{chapter:6}},
  {id:'palmyrene',label:'Palmyrene spearman',unit:{id:'palmyrene-warriors',name:'Palmyrene warriors',side:'enemy',role:'infantry'},options:{chapter:9}},
  {id:'cataphract',label:'Palmyrene cataphract',unit:{id:'palmyrene-horse',name:'Palmyrene horse',side:'enemy',role:'cavalry'},options:{chapter:9}},
  {id:'rival',label:'Rival Roman · a civil-war cohort',unit:{id:'enemy1',name:'Civil-war cohort 2',side:'enemy',role:'infantry'},options:{chapter:12}},
  {id:'rival-archer',label:'Rival Roman · the claimant’s archer',unit:{id:'enemy2',name:'Rival Roman archer',side:'enemy',role:'archer'},options:{chapter:12}},
  {id:'dalmatian',label:'Cavalry · Dalmatian rider',unit:{id:'roman-cavalry',name:'Roman cavalry',side:'ally',role:'cavalry'},options:{chapter:12,rank:'Praepositus'}},
  {id:'war-leader',label:'Gothic war leader',unit:{id:'raider-axe',name:'Gothic war leader',side:'enemy',role:'raider'},options:{chapter:1}},
  {id:'goth-guard',label:'Gothic shield guard',unit:{id:'gothic-guard',name:'Gothic shield guard',side:'enemy',role:'guard'},options:{chapter:4}},
  {id:'persian-spearman',label:'Persian spearman',unit:{id:'persian-spearmen',name:'Persian spearman',side:'enemy',role:'infantry'},options:{chapter:5}},
  {id:'champion-wall',label:'Champion · the war band’s war leader',unit:{id:'champion-wall',name:'The war band’s war leader',side:'enemy',role:'champion'},options:{chapter:4}},
  {id:'champion-mine',label:'Champion · a Persian sapper captain',unit:{id:'champion-mine',name:'A Persian sapper captain',side:'enemy',role:'champion'},options:{chapter:5}},
  {id:'champion-wells',label:'Champion · a Persian captain of the pursuit',unit:{id:'champion-wells',name:'A Persian captain of the pursuit',side:'enemy',role:'champion'},options:{chapter:6}},
  {id:'champion-eagle',label:'Champion · the raiders’ standard-breaker',unit:{id:'champion-eagle',name:'The raiders’ standard-breaker',side:'enemy',role:'champion'},options:{chapter:6}},
  {id:'champion-legion',label:'Champion · a mercenary captain',unit:{id:'champion-legion',name:'A mercenary captain in the usurper’s pay',side:'enemy',role:'champion'},options:{chapter:7}},
  {id:'champion-crossing',label:'Champion · the war band’s champion',unit:{id:'champion-crossing',name:'The war band’s champion',side:'enemy',role:'champion'},options:{chapter:8}},
  {id:'champion-wing',label:'Champion · a Palmyrene armoured officer',unit:{id:'champion-wing',name:'A Palmyrene armoured officer',side:'enemy',role:'champion',mounted:true},options:{chapter:9}},
  {id:'champion-city',label:'Champion · the city’s defending captain',unit:{id:'champion-city',name:'The city’s defending captain',side:'enemy',role:'champion'},options:{chapter:9}},
  {id:'champion-road',label:'Champion · the raiders’ chief',unit:{id:'champion-road',name:'The raiders’ chief',side:'enemy',role:'champion'},options:{chapter:10}},
  {id:'champion-guard',label:'Champion · the claimant’s guard captain',unit:{id:'champion-guard',name:'The claimant’s guard captain',side:'enemy',role:'champion'},options:{chapter:12}},
  {id:'persian-horse',label:'Cavalry · Persian clibanarius',unit:{id:'persian-cavalry',name:'Persian clibanarius',side:'enemy',role:'cavalry'},options:{chapter:5}},
  {id:'senator',label:'Senator · Marcellus, 45',unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:'speaker',bloc:'Civic'},options:{chapter:11,rank:'Senator'}},
  {id:'aelia',label:'Aelia · named civic character',unit:{id:'aelia',name:'Aelia',side:'ally',role:'voter',bloc:'Civic'},options:{chapter:10}},
  {id:'varro',label:'Varro · named mentor',unit:{id:'varro',name:'Varro',side:'ally',role:'trainer'},options:{chapter:1}},
  {id:'lucan',label:'Lucan · named comrade',unit:{id:'lucan',name:'Lucan',side:'ally',role:'infantry'},options:{chapter:3}},
  {id:'crispus',label:'Crispus · named rival',unit:{id:'crispus',name:'Crispus',side:'enemy',role:'speaker'},options:{chapter:11}},
  {id:'severianus',label:'Severianus · named patron',unit:{id:'severianus',name:'Severianus',side:'ally',role:'speaker'},options:{chapter:10}},
  {id:'paullus',label:'Paullus · named elder',unit:{id:'paullus',name:'Lucius Cassius Paullus',side:'ally',role:'voter',bloc:'Landholders'},options:{chapter:11}},
  {id:'sabinus',label:'Sabinus · named soldier',unit:{id:'sabinus',name:'Sabinus',side:'ally',role:'infantry'},options:{chapter:4}},
  // A member of the chamber nobody names, who wears the elder senator's toga (actor-body-catalog.js chooses by who he is),
  // and the camps' armourer at the quartermaster's, in the bodies graphics release G6 made for them.
  {id:'chamber-member',label:'Senator · a member of the chamber',unit:{id:'member0',name:'Veterans delegate 1',side:'neutral',role:'voter'},options:{chapter:11}},
  {id:'smith',label:'Bassus · the camps’ armourer',unit:{id:'smith',name:'Bassus the armourer',side:'neutral',role:'smith'},options:{chapter:11}},
  ...Array.from({length:12},(_,i)=>({id:`hero-ch${i+1}`,label:`Chapter ${i+1} · Marcellus`,unit:{id:'hero',name:'Aurelius Marcellus',side:'player',role:i>=9?'speaker':'infantry',...(i>=9?{bloc:'Civic'}:{})},options:{chapter:i+1}}))
]);
export const ACTOR_MOTIONS=Object.freeze(['idle','start','walk','run','stop','turn','retreat','attack','throw','brace','block','hit','rally','order','speak','conversation','assent','dissent','yield','withdrawn']);
export const CHARACTER_REVIEW_SEQUENCE=Object.freeze([
  {motion:'idle',seconds:.65},{motion:'start',seconds:.35},{motion:'walk',seconds:1.6},
  {motion:'stop',seconds:.4},{motion:'turn',seconds:.65},{motion:'brace',seconds:.65},
  {motion:'attack',seconds:1.023},{motion:'block',seconds:.55},{motion:'order',seconds:1.2},
  {motion:'idle',seconds:1}
].map(Object.freeze));
export function characterReviewStep(seconds=0){
  const duration=CHARACTER_REVIEW_SEQUENCE.reduce((sum,step)=>sum+step.seconds,0);
  let t=((Number.isFinite(seconds)?seconds:0)%duration+duration)%duration;
  for(const step of CHARACTER_REVIEW_SEQUENCE){if(t<step.seconds)return {motion:step.motion,phase:t/step.seconds};t-=step.seconds;}
  return {motion:'idle',phase:0};
}
export const actorCase=id=>ACTOR_CASES.find(item=>item.id===id)??ACTOR_CASES[0];
export function sampleSummary(samples){
  const ordered=samples.filter(Number.isFinite).slice(-120).sort((a,b)=>a-b),at=q=>ordered.length?ordered[Math.min(ordered.length-1,Math.ceil(ordered.length*q)-1)]:null;
  return {count:ordered.length,median:at(.5),p95:at(.95),max:ordered.at(-1)??null};
}
export function actorResources(group){
  const geometries=new Set(),materials=new Set(),textures=new Set(),buffers=new Set(),skeletons=new Set();let meshes=0,skinnedMeshes=0,bones=0,visibleMeshes=0,visibleTriangles=0,geometryBytes=0,textureBytes=0;
  group.traverse(object=>{if(object.isBone)bones++;if(object.isMesh){meshes++;if(object.isSkinnedMesh)skinnedMeshes++;if(object.skeleton)skeletons.add(object.skeleton);if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);}});
  group.traverseVisible(object=>{if(object.isMesh){visibleMeshes++;visibleTriangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
  for(const geometry of geometries)for(const attribute of [geometry.index,...Object.values(geometry.attributes),...Object.values(geometry.morphAttributes).flat()]){const array=attribute?.array??attribute?.data?.array;if(array&&!buffers.has(array.buffer)){buffers.add(array.buffer);geometryBytes+=array.buffer.byteLength;}}
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const texture of textures){const image=texture.image;if(image)textureBytes+=(image.data?.byteLength??(image.width??0)*(image.height??0)*4)*(texture.generateMipmaps?4/3:1);}
  return {meshes,skinnedMeshes,bones,visibleMeshes,visibleTriangles,geometries:geometries.size,materials:materials.size,textures:textures.size,skeletons:skeletons.size,geometryArrayBytes:geometryBytes,estimatedTextureBytes:Math.ceil(textureBytes),textureEstimateScope:'Decoded image bytes plus approximate mipmaps; not measured GPU allocation.'};
}
