// The ground's photographed layers (docs/asset-pipeline.md#the-ground), as data
// shared by the build (scripts/assets/build-ground-set.mjs) and the terrain
// material. Each layer is a CC0 texture set; the two arrays hold every layer at
// GROUND_TEXTURE_SIZE square: its colour with its height in alpha, and its
// normal (X in colour, Y in alpha). A layer's `repeat` is the metres one tile
// covers, the source's own size; `roughness` its base roughness; `fallback` its
// mean colour, which the code-built stand-in draws when the arrays cannot load.
// Presentation only: no layer is a rule, and the board's cells decide them.
export const GROUND_TEXTURE_SIZE=512;
export const GROUND_FILES=Object.freeze({
  albedo:'assets/textures/ground/ground-albedo-v1.ktx2',
  normal:'assets/textures/ground/ground-normal-v1.ktx2'
});
const layer=(key,source,repeat,roughness,fallback)=>Object.freeze({key,source,repeat,roughness,fallback});
export const GROUND_LAYERS=Object.freeze([
  layer('grass','polyhaven:forrest_ground_01',2,.96,'#91875d'),
  layer('dryGrass','polyhaven:grass_path_2',1,.98,'#8d8163'),
  layer('soil','polyhaven:brown_mud_dry',1.3,.98,'#735b3e'),
  layer('mud','polyhaven:brown_mud_02',1.3,.62,'#4d4437'),
  layer('sand','polyhaven:sand_01',1.5,1,'#a5956f'),
  layer('gravel','polyhaven:rocks_ground_01',2,.94,'#877d6e'),
  layer('rock','polyhaven:rock_ground',1.5,.9,'#726a5f'),
  layer('paving','polyhaven:grassy_cobblestone',2,.86,'#766753'),
  layer('slabs','polyhaven:stone_floor',1.85,.82,'#74664c'),
  layer('aridSoil','polyhaven:dry_ground_rocks',4,1,'#95734e'),
  layer('cracked','polyhaven:mud_cracked_dry_03',1.5,.96,'#d0a981')
]);
export const GROUND_LAYER_INDEX=Object.freeze(Object.fromEntries(GROUND_LAYERS.map((entry,i)=>[entry.key,i])));

// Each region's ground, by what it is: [layer, share] pairs.
// - turf: open ground, in patches that vary over tens of metres;
// - worn: trodden paths, yards and wear; road: a road's tread;
// - bank: steep relief; wet: a riverbank or marsh; bed: a river or ford;
// - sand, rock, rubble (a wall's foot), camp, joints (under flagstones), slabs (floors).
// `tint` multiplies a layer's colour (linear) for the region's season and soil, and
// `brightness` sets the photographs' level under the scenes' strong outdoor light:
// lower for the rain of the marshes and for the pale sand of the east, where the
// figures' tunics must still stand out.
const mix=pairs=>Object.freeze(pairs.map(pair=>Object.freeze(pair)));
const biome=({tint={},brightness=GROUND_BRIGHTNESS,...roles})=>Object.freeze({...Object.fromEntries(Object.entries(roles).map(([role,pairs])=>[role,mix(pairs)])),
  tint:Object.freeze(Object.fromEntries(Object.entries(tint).map(([key,rgb])=>[key,Object.freeze(rgb)]))),brightness});
export const GROUND_BRIGHTNESS=.62;
const common={sand:[['sand',.85],['gravel',.15]],rock:[['rock',.7],['gravel',.3]],rubble:[['gravel',.55],['rock',.45]],
  joints:[['gravel',.6],['soil',.4]],slabs:[['slabs',1]],bed:[['gravel',.55],['sand',.45]]};
export const GROUND_BIOMES=Object.freeze({
  // The Danube and the Balkans: meadow, worn to soil and gravel.
  danube:biome({...common,tint:{grass:[.62,.86,.46],dryGrass:[.8,.9,.62]},turf:[['grass',.72],['dryGrass',.28]],worn:[['soil',.7],['gravel',.3]],road:[['gravel',.65],['soil',.35]],
    bank:[['soil',.6],['rock',.4]],wet:[['mud',.8],['grass',.2]],camp:[['soil',.75],['gravel',.25]]}),
  // Flooded marsh after Abritus: wet meadow and mud.
  wetland:biome({...common,brightness:.52,tint:{grass:[.6,.8,.5],dryGrass:[.78,.86,.62]},turf:[['grass',.62],['mud',.2],['dryGrass',.18]],worn:[['mud',.6],['soil',.4]],road:[['soil',.55],['gravel',.45]],
    bank:[['mud',.55],['soil',.45]],wet:[['mud',1]],camp:[['mud',.45],['soil',.55]]}),
  // Italy and Rome: drier Mediterranean grass; paved roads.
  italy:biome({...common,tint:{grass:[.72,.88,.5],dryGrass:[1,.94,.7]},turf:[['dryGrass',.55],['grass',.45]],worn:[['soil',.75],['gravel',.25]],road:[['paving',1]],
    bank:[['soil',.55],['rock',.45]],wet:[['mud',.7],['sand',.3]],camp:[['soil',.7],['gravel',.3]]}),
  // The Euphrates and the east: arid soil, sand and sparse dry grass.
  arid:biome({...common,brightness:.56,tint:{dryGrass:[1,.92,.7]},turf:[['aridSoil',.6],['sand',.25],['dryGrass',.15]],worn:[['cracked',.55],['aridSoil',.45]],road:[['gravel',.55],['aridSoil',.45]],
    bank:[['rock',.55],['aridSoil',.45]],wet:[['mud',.6],['sand',.4]],camp:[['cracked',.5],['aridSoil',.5]]}),
  // Palmyra: the arid east, with paved city streets.
  palmyra:biome({...common,brightness:.56,tint:{dryGrass:[1,.92,.7]},turf:[['aridSoil',.55],['sand',.3],['dryGrass',.15]],worn:[['cracked',.5],['aridSoil',.5]],road:[['paving',1]],
    bank:[['rock',.55],['aridSoil',.45]],wet:[['mud',.6],['sand',.4]],camp:[['cracked',.5],['aridSoil',.5]]})
});
const CHAPTER_BIOMES=Object.freeze({1:'danube',2:'wetland',3:'danube',4:'danube',5:'arid',6:'arid',7:'italy',8:'danube',9:'palmyra',10:'danube',11:'italy',12:'italy'});
export const groundBiomeKey=chapter=>CHAPTER_BIOMES[chapter]??'danube';
export const groundBiome=chapter=>GROUND_BIOMES[groundBiomeKey(chapter)];
