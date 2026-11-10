// The world's generated and photographed assets (docs/asset-pipeline.md), and
// the chapters that use each. Pure data in the startup shell, like the body
// catalog (actor-body-catalog.js): the download groups (art.js), the build and
// npm run verify read a chapter's world files from it without loading the 3D
// modules. A file belongs to the offline packs of its chapters alone. Where an
// asset stands stays with the code that places it (scenery-models.js).
//
// Kinds: a prop or landmark is a placed model; a kit piece dresses a board
// structure; a texture set is the maps of one surface; a panorama is a skyline.
// Files live under assets/models/ or assets/textures/ (assets/world/ holds the
// 2D board's atlases).
import {GROUND_FILES} from './ground-layers.js';
import {PANORAMA_REGIONS,panoramaChapters,panoramaFile} from './panoramas.js';
import {CAMP_TENT_PITCHES} from '../data/camp-regions.js';
import {HORSE_BODIES,horseBodyUrl} from './actor-body-catalog.js';
import {CONFIG} from '../config.js';

export const WORLD_KINDS=Object.freeze(['prop','landmark','kit','texture','panorama']);
// `web` names the chapters whose web download carries the asset, where its download limit leaves room
// (presentation-budget.js): the desktop app installs every file (the owner's decision of 8 November), so there an
// asset is in every chapter it names. Where the web leaves it out, its scenery keeps the code-built stand-in.
const asset=(kind,files,chapters,web=chapters)=>Object.freeze({kind,files:Object.freeze(files),chapters:Object.freeze(chapters),web:Object.freeze(web)});
/** Whether this page is the desktop app's (scripts/build.mjs --target desktop writes it into the configuration). */
export const desktopApp=()=>CONFIG.platform==='desktop';
const prop=(id,chapter)=>asset('prop',[`assets/models/chapters/${String(chapter).padStart(2,'0')}/${id}.glb`],[chapter]);
export const REGIONAL_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'legionary-cookstation':[1,3,7],'equipment-rack':[1,4,7],'courier-table':[3,7,11],
  'casualty-litter':[2,6,8],'broken-baggage-cart':[2,6],'river-ferry':[8],
  'mooring-ropes':[2,8],'eagle-rally-stand':[6,12],'caravan-trough':[9],
  'caravan-baggage':[9],'signal-brazier':[4,6],'command-table':[7,12],
  'grain-bins':[10],'relief-cart':[10],'archive-cabinet':[11],'civic-fountain':[11,12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
export const REGIONAL_REUSED_PROP_CHAPTERS=Object.freeze({
  'ch5-leather-tent':Object.freeze([5,6]),'ch5-storage-jars':Object.freeze([5,6,9,10]),
  'ch5-household-bundles':Object.freeze([2,5,8]),'ch5-cistern':Object.freeze([5,6]),
  'ch5-spoil-baskets':Object.freeze([4,5,9]),'ch5-mudbrick-stack':Object.freeze([5,9])
});
// The camps whose tent lines pitch Chapter V's leather tent (graphics plan, G3; camp-regions.js).
export const TENT_LINE_CHAPTERS=Object.freeze(Object.entries(CAMP_TENT_PITCHES).filter(([,list])=>list.length).map(([chapter])=>Number(chapter)));
const reused=id=>asset('prop',[`assets/models/chapters/05/${id}.glb`],
  id==='ch5-leather-tent'?[...new Set([...REGIONAL_REUSED_PROP_CHAPTERS[id],...TENT_LINE_CHAPTERS])].sort((a,b)=>a-b):REGIONAL_REUSED_PROP_CHAPTERS[id]);
// Life about the camps and towns (release 9): Tripo props set out beyond the board like the
// regional ones (environment-regional-world.js), but never on a camp's service pad.
export const LIFE_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'life-laundry-line':[1,3,8,10],'life-camel-gear':[6,9],'life-amphora-rack':[7,11,12],
  'life-beehives':[3,7],'life-bread-oven':[1,3,6,9],'life-handcart':[3,4],'life-grindstone':[1,4],
  'life-hay-rick':[2,8,10],'life-ox-cart':[8,10],'life-woodpile':[1,2,4],'life-loom':[8,10],
  'life-travel-carriage':[7,11,12],'life-market-stall':[9,10,11,12],
  'life-pottery-stall':[6,9,11,12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
// The camps' own furniture (graphics plan, G3): Tripo props set out in a camp's courts beyond the board,
// each beside the service it belongs to (camp-composition.js). Only in a camp, and like life with no
// code-built stand-in: without its model the place stays empty. The pilot's six, then the rest's ten.
export const CAMP_PROP_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'g3-officers-tent':[1,3,4,6,7,8,9,12],'g3-tent-struck':[2,6,8],'g3-horse-lines':[7,9,12],
  'g3-training-post':[1,3,4,7],'g3-supply-stack':[1,2,3,4,6,7,8,9,10,12],'g3-granary':[4,10],
  'g3-praetorium':[2,6,7,9],'g3-hospital-tent':[2,3,6,8,9],'g3-tribunal':[1,9,12],'g3-altar':[1,4,12],
  'g3-parley-awning':[8,9],'g3-pavilion-east':[6,9],'g3-pavilion-shade':[6,9],
  'g3-pilum-rack':[2,3,6,8,10,12],'g3-archery-butt':[3,6,10,12],'g3-field-oven':[2,4,8,10]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
// The camps' walls (G3), on their wall cells (camp-walls.js): each wall style's wall, its towers on the corners
// and either side of a gateway, and its gate over a gateway. A wall stands for the code-built breastwork or
// parapet, which stays as its fallback; towers and gates have no stand-in.
export const CAMP_WALL_MODELS=Object.freeze({
  timber:Object.freeze({wall:'g3-palisade-timber',tower:'g3-watchtower-timber',gate:'g3-gate-timber'}),
  stone:Object.freeze({wall:'g3-wall-stone',tower:'g3-tower-stone',gate:'g3-gate-stone'}),
  mudbrick:Object.freeze({wall:'g3-wall-mudbrick',tower:'g3-tower-mudbrick'})
});
export const CAMP_WALL_CHAPTERS=Object.freeze({
  'g3-palisade-timber':Object.freeze([1,2,3,7,8,10]),'g3-watchtower-timber':Object.freeze([1,2,3,7,8,10]),
  'g3-gate-timber':Object.freeze([1,2,3,7,10]),
  'g3-wall-stone':Object.freeze([4,9,12]),'g3-tower-stone':Object.freeze([4,9,12]),'g3-gate-stone':Object.freeze([4,9,12]),
  'g3-wall-mudbrick':Object.freeze([5,6]),'g3-tower-mudbrick':Object.freeze([5,6])
});
// The tent lines' other tents (G3's rest): a contubernium's tent with its flaps open and a patched one, mixed
// by cell with Chapter V's leather tent (environment-regional-world.js), each with the chapters whose tent lines
// pitch it: Chapters IV's and VI's single tents both fall to the leather one.
export const TENT_VARIANT_CHAPTERS=Object.freeze({
  'g3-tent-open':Object.freeze([1,2,3,7,8,9]),'g3-tent-patched':Object.freeze([1,2,3,9,12])
});
// What a chapter's web download has room for of G3's models (presentation-budget.js). After the pilot,
// Chapter I's 3D download stood at 17.87 of its 18 MB, and Chapters VII's, VIII's and XII's (with the 2D
// view) within 0.3 MB of their 28 MB: Chapter I takes the palisade alone, VII and VIII the pilot's models
// and XII none. The rest's eleven models for Chapter IX came to 2.45 MB against its 2.33 MB of room: IX
// leaves out the open and the patched tents, one pitch each, which take the leather tent on the web, and
// the tribunal and the parley awning, whose courts there lie beyond the camera's reach, so no web chapter
// carries those two. Every other chapter takes all of its models. The desktop app has them all.
const G3_WEB_ROOM=Object.freeze({
  1:Object.freeze(['g3-palisade-timber']),
  7:Object.freeze(['g3-palisade-timber','g3-watchtower-timber','g3-officers-tent','g3-horse-lines','g3-training-post','g3-supply-stack']),
  8:Object.freeze(['g3-palisade-timber','g3-watchtower-timber','g3-officers-tent','g3-tent-struck','g3-supply-stack']),
  9:Object.freeze(['g3-officers-tent','g3-horse-lines','g3-supply-stack','g3-wall-stone','g3-tower-stone','g3-gate-stone','g3-praetorium',
    'g3-hospital-tent','g3-pavilion-east','g3-pavilion-shade']),
  12:Object.freeze([])
});
const g3=(id,chapters)=>asset('prop',[`assets/models/world/${id}.glb`],chapters,chapters.filter(c=>!G3_WEB_ROOM[c]||G3_WEB_ROOM[c].includes(id)));
// Battle and siege (graphics plan, G5). The field objects' models (field-models.js): each draws its kind in the states it
// names, on the object's cell, in place of the code-built piece (environment-fieldwork.js), which stays for every other
// state, on Performance and while the model is not loaded. A carrier names the loads it bears (`loads`), each `lift`
// above the carrier's ground at `x` and `z` in its own frame and turned by `yaw` from it; a load (`load: true`) stands
// only on a carrier. `yaw` turns a model to the code-built piece's bearing: the Roman cart's pole, along the model's -z,
// and the eastern cart's, along its +x, point west like the code-built cart's shafts; the barricade's panel, along
// its z, runs east and west like the code-built barricade; the ram's iron head, at the model's +x, points west at
// the gate like the code-built ram's; the siege ramp, rising toward the model's +z, rises east like the code-built ramp;
// the Roman signal post's banner, hanging from a crossbar along the model's z, turns square to the camera, which looks
// north-west, with its beacon stack in front of the mast, and the eastern post's pole and pennant, at its -x and +z
// corner, turn to the camera's side of the pillar.
// `copies` sets a model out more than once on its cell, each at `x` and `z` in the model's own frame and turned by its
// own `yaw`: two panels side by side span the cell as the code-built barricade's two metres do. A burning brazier keeps
// the stage's particle plume, `flame` metres above its ground, in the top of its heap of pitch. With the chapters whose
// battles hold the kind: the supply cart and the signal station in every battle (Chapter XI has none), the barricade and
// the brazier from Chapter III, the Persian ram, siege ramp and the countermine dug against them at Chapter V's city. The
// eastern battles (Chapters V, VI and IX) take an eastern cart and an eastern signal post, the others the Roman ones; the
// timber barricade stands in all of them. The cart and the signal station are the battle's two opportunities, and each
// model stands in all four of their states: the objective's marker shows whether it was secured, forgone or missed.
const BATTLE_CHAPTERS=Object.freeze([1,2,3,4,5,6,7,8,9,10,12]);
const EAST_CHAPTERS=Object.freeze([5,6,9]);
const westOf=chapters=>Object.freeze(chapters.filter(c=>!EAST_CHAPTERS.includes(c)));
const OPPORTUNITY_STATES=Object.freeze(['available','secured','forgone','missed']);
export const FIELD_OBJECT_MODELS=Object.freeze({
  'g5-cart':Object.freeze({kind:'stores',states:OPPORTUNITY_STATES,chapters:westOf(BATTLE_CHAPTERS),yaw:Math.PI/2,
    loads:Object.freeze({'g5-cart-load':Object.freeze({lift:.62,x:.06,z:.43,yaw:0})})}),
  'g5-cart-east':Object.freeze({kind:'stores',states:OPPORTUNITY_STATES,chapters:EAST_CHAPTERS,yaw:Math.PI,
    loads:Object.freeze({'g5-cart-load':Object.freeze({lift:.66,x:-.68,z:0,yaw:0})})}),
  'g5-cart-load':Object.freeze({kind:'stores',states:Object.freeze(['available']),chapters:BATTLE_CHAPTERS,load:true}),
  'g5-barricade':Object.freeze({kind:'barricade',states:Object.freeze(['intact']),chapters:Object.freeze([3,4,5,6,7,8,9,10,12]),yaw:Math.PI/2,
    copies:Object.freeze([Object.freeze({x:0,z:-.56,yaw:.05}),Object.freeze({x:0,z:.56,yaw:-.04})])}),
  'g5-ram':Object.freeze({kind:'ram',states:Object.freeze(['active']),chapters:Object.freeze([5]),yaw:Math.PI}),
  'g5-brazier':Object.freeze({kind:'brazier',states:Object.freeze(['unlit','burning']),chapters:Object.freeze([3,4,5,6,7,8,9,10,12]),flame:.9}),
  'g5-countermine':Object.freeze({kind:'countermine',states:Object.freeze(['active']),chapters:Object.freeze([5])}),
  'g5-siege-ramp':Object.freeze({kind:'siege-engine',states:Object.freeze(['active']),chapters:Object.freeze([5]),yaw:Math.PI/2}),
  'g5-signal':Object.freeze({kind:'signal',states:OPPORTUNITY_STATES,chapters:westOf(BATTLE_CHAPTERS),yaw:3*Math.PI/4}),
  'g5-signal-east':Object.freeze({kind:'signal',states:OPPORTUNITY_STATES,chapters:EAST_CHAPTERS,yaw:Math.PI/2})
});
// Set pieces beyond the board (G5): behind the Roman line, just beyond the board's west edge, where the camera's view of
// the line takes them in, or beyond its north edge, which the camera sees behind both armies (field-models.js), with
// the battles that set each out. `yaw` turns each to its bearing: the engines face east, toward the enemy (the
// carroballista's springs and the onager's arm stand at the model's -x, the ballista's springs at its +x); the fascines stand
// lengthwise along the edge, the mantlet too, its screen (at the model's -z) facing east and its props behind it, and
// the Persian screens, propped from behind at the model's +x, face the board. `along` is where along its edge it would stand, a share of the board's half-depth (west, north of the road the
// army came by) or half-width (north); `beside` stands a piece by another the battle sets out (an engine's
// ammunition), at `x` and `z` in that piece's own frame, or that offset mirrored; `fit` is the room it is fitted within
// and keeps clear. A boat (`edge: 'river'`) floats on the distant river beyond the north edge, in the battles whose
// scene has it (Chapters I, II, IV, VIII and X, the training ground's drill by the Danube with them): the patrol boat,
// long along its model's x, and the barge, long along its z, lie along the stream, `draft` metres of their hulls below
// its surface, the patrol boat's oar blades at the waterline. Like the camps' furniture, they have no code-built stand-in.
const SIEGE_BATTLES=Object.freeze(['ch4-gate','ch4-wall','ch5-mine','ch5-wall','ch9-city','ch12-confrontation']);
const ENGINE_FIELDS=Object.freeze(['ch7-legion','ch8-ferry','ch8-crossing','ch9-wing','ch10-road']);
// Where the Romans attack a wall: Palmyra's (Chapter IX) and the City's (Chapter XII).
const ASSAULTS=Object.freeze(['ch9-city','ch12-confrontation']);
const GOTHIC_BATTLES=Object.freeze(['ch1-road','ch2-marsh','ch2-rearguard','ch3-station','ch3-rolls','ch4-gate','ch4-wall','ch7-legion','ch8-ferry','ch8-crossing','ch10-road']);
const PERSIAN_SIEGE=Object.freeze(['ch5-mine','ch5-wall']);
const RIVER_BATTLES=Object.freeze(['ch1-training','ch1-road','ch2-marsh','ch2-rearguard','ch4-gate','ch4-wall','ch8-ferry','ch8-crossing','ch10-road']);
const battleProp=(encounters,m)=>Object.freeze({encounters,...m,fit:Object.freeze(m.fit),...(m.beside?{beside:Object.freeze(m.beside)}:{})});
export const BATTLE_PROP_MODELS=Object.freeze({
  'g5-carroballista':battleProp(ENGINE_FIELDS,{yaw:Math.PI,along:-.25,fit:{width:3.6,depth:1.6}}),
  'g5-onager':battleProp(SIEGE_BATTLES,{yaw:Math.PI,along:-.3,fit:{width:3.6,depth:1.8}}),
  'g5-ballista':battleProp(SIEGE_BATTLES,{yaw:0,along:-.05,fit:{width:2.2,depth:1.6}}),
  'g5-shot-stack':battleProp(SIEGE_BATTLES,{beside:{model:'g5-onager',x:0,z:2.2},fit:{width:1.2,depth:1.2}}),
  'g5-bolt-crate':battleProp(ENGINE_FIELDS,{beside:{model:'g5-carroballista',x:0,z:2},fit:{width:1.3,depth:1.4}}),
  'g5-siege-tower':battleProp(ASSAULTS,{yaw:0,along:.2,fit:{width:3.6,depth:3.8}}),
  'g5-mantlets':battleProp(ASSAULTS,{yaw:-Math.PI/2,along:.45,fit:{width:1.2,depth:3.4}}),
  'g5-fascines':battleProp(ASSAULTS,{yaw:Math.PI/2,along:-.55,fit:{width:3,depth:2.4}}),
  'g5-wagon-gothic':battleProp(GOTHIC_BATTLES,{edge:'north',yaw:0,along:-.3,fit:{width:3.3,depth:1.5}}),
  'g5-wagon-gothic-covered':battleProp(GOTHIC_BATTLES,{edge:'north',yaw:0,along:-.05,fit:{width:4.9,depth:2}}),
  'g5-persian-tower':battleProp(PERSIAN_SIEGE,{edge:'north',yaw:0,along:.15,fit:{width:3.6,depth:3.6}}),
  'g5-persian-screens':battleProp(PERSIAN_SIEGE,{edge:'north',yaw:Math.PI/2,along:.4,fit:{width:3.6,depth:1.6}}),
  'g5-lusoria':battleProp(RIVER_BATTLES,{edge:'river',yaw:0,along:-.3,draft:.4,fit:{width:9.2,depth:5.5}}),
  'g5-river-barge':battleProp(RIVER_BATTLES,{edge:'river',yaw:Math.PI/2,along:.25,draft:.25,fit:{width:7.9,depth:4.3}})
});
const encounterChapters=ids=>[...new Set(ids.map(id=>Number(/^ch(\d+)-/.exec(id)[1])))].sort((a,b)=>a-b);
// What a battle leaves on its walked field (G5, field-models.js): beside the fallen, the gear of the side the chapter's
// battles beat (Goths, the eastern armies, or Chapter XII's rival Romans), and in every battle a fallen war banner.
export const AFTERMATH_DEBRIS_MODELS=Object.freeze({
  'g5-debris-gothic':Object.freeze({chapters:westOf([1,2,3,4,7,8,10])}),
  'g5-debris-east':Object.freeze({chapters:EAST_CHAPTERS}),
  'g5-debris-roman':Object.freeze({chapters:Object.freeze([12])}),
  'g5-debris-standard':Object.freeze({chapters:BATTLE_CHAPTERS,standard:true})
});
// What a chapter's web download has room for of G5's models (presentation-budget.js), each about 0.2-0.36 MB
// compressed. After G3, Chapter I's 3D download stood at 17.87 of its 18 MB and Chapters VII's and VIII's within
// 0.1 MB of their 28, so those take none; the pilot gave IV's 0.79 MB to the cart, its load and the barricade, IX's
// 0.66 to the two engines, X's 0.60 to the carroballista and the barricade and XII's 0.28 to the barricade, which
// left those four too little room for the rest. VI had 0.60 MB: the eastern cart in place of the Roman one, the brazier
// and the eastern debris. A cart and its load go together. Every other chapter (II, III and V) takes
// all of its G5 models, the final batch's signal posts with them, and Chapter II its boats; the chapters named here keep
// the code-built signal, and the desktop app alone floats boats on their river.
const G5_WEB_ROOM=Object.freeze({1:Object.freeze([]),4:Object.freeze(['g5-cart','g5-cart-load','g5-barricade']),
  6:Object.freeze(['g5-cart-east','g5-cart-load','g5-barricade','g5-brazier','g5-debris-east']),7:Object.freeze([]),8:Object.freeze([]),
  9:Object.freeze(['g5-carroballista','g5-onager']),10:Object.freeze(['g5-carroballista','g5-barricade']),12:Object.freeze(['g5-barricade'])});
const g5=(id,chapters)=>asset('prop',[`assets/models/world/${id}.glb`],chapters,chapters.filter(c=>!G5_WEB_ROOM[c]||G5_WEB_ROOM[c].includes(id)));
// Animals (graphics plan, G4). Each stands with a piece of a camp's furniture or of life about it, beside that piece in
// its court beyond the board, or by its spot in the baggage line beyond a field's southern edge, and only where the piece
// itself stands (environment-regional-world.js): horses tethered at the horse lines, a pair of oxen by the ox cart, a pair
// of mules by the covered carriage (the carpentum's usual team), a camel by the camel gear, a pack mule by the broken cart
// and the handcart, and a dog by the ovens. In the piece's own frame, `shift` moves the piece aside to make room, and each
// animal is [its model, x, z, yaw]: the middle of its footprint, and its bearing, turned from facing along the piece's +x.
// With `across`, they stand on the side of the piece away from the board, where the camera looks in: where the piece's
// own -z points toward the board, they are mirrored across it. The generated animals face their own +x; a horse is the
// Roman horse's coat (actor-body-catalog.js), which those chapters already download for their cavalry, baked standing in
// its rest pose (scenery-models.js), and faces its +z.
export const CAMP_ANIMALS=Object.freeze(Object.fromEntries(Object.entries({
  'g3-horse-lines':{shift:[-1,0],animals:[['horse-roman',1,-.92,Math.PI+.03],['horse-roman',.97,.02,Math.PI-.02],['horse-roman',1.02,.94,Math.PI+.01]]},
  'life-ox-cart':{across:true,shift:[0,.65],animals:[['g4-ox',.05,-.68,.02],['g4-ox',-.05,-1.7,-.02]]},
  'life-travel-carriage':{across:true,shift:[0,.45],animals:[['g4-mule',.15,-.85,.02],['g4-mule',-.05,-1.65,-.03]]},
  'life-camel-gear':{across:true,shift:[0,.75],animals:[['g4-camel',0,-.9,Math.PI]]},
  'broken-baggage-cart':{across:true,shift:[0,.45],animals:[['g4-pack-mule',.1,-1.15,.04]]},
  'life-handcart':{across:true,shift:[0,.45],animals:[['g4-pack-mule',-.1,-1.2,Math.PI-.05]]},
  'life-bread-oven':{across:true,animals:[['g4-dog',.9,-1.6,.35]]},
  'g3-field-oven':{across:true,animals:[['g4-dog',.7,-1.45,.5]]}
}).map(([id,{shift=[0,0],across=false,animals}])=>[id,Object.freeze({shift:Object.freeze(shift),across,animals:Object.freeze(animals.map(a=>Object.freeze(a)))})])));
// The coats among them, and the turn that sets a coat (facing its +z) to face +x like the generated animals.
export const ANIMAL_COATS=Object.freeze({'horse-roman':HORSE_BODIES['horse-roman']});
export const ANIMAL_COAT_TURN=Math.PI/2;
const hostChapters=id=>CAMP_PROP_CHAPTERS[id]??LIFE_PROP_CHAPTERS[id]??REGIONAL_PROP_CHAPTERS[id]??[];
// The chapters whose scenes set out each generated animal: those of the pieces it stands with.
export const ANIMAL_CHAPTERS=Object.freeze(Object.fromEntries([...new Set(Object.values(CAMP_ANIMALS).flatMap(h=>h.animals.map(([model])=>model)))]
  .filter(model=>!ANIMAL_COATS[model]).map(model=>[model,Object.freeze([...new Set(Object.entries(CAMP_ANIMALS)
    .filter(([,h])=>h.animals.some(([m])=>m===model)).flatMap(([host])=>hostChapters(host)))].sort((a,b)=>a-b))])));
// What a chapter's web download has room for of G4's animals (presentation-budget.js): Chapters II and III take theirs,
// and XI its mules; the others had too little room left after G3 and G5, so their pieces stand alone on the web. The
// horses need no room: their coat is already in the download.
const G4_WEB_ROOM=Object.freeze({2:Object.freeze(['g4-pack-mule','g4-dog']),3:Object.freeze(['g4-pack-mule','g4-dog']),11:Object.freeze(['g4-mule'])});
const g4=(id,chapters)=>asset('prop',[`assets/models/world/${id}.glb`],chapters,chapters.filter(c=>G4_WEB_ROOM[c]?.includes(id)));
/** The model an animal of a chapter's scene stands as: a generated animal's, or the coat its chapter's cavalry downloads. */
export const animalModelUrl=(model,chapter)=>ANIMAL_COATS[model]?(ANIMAL_COATS[model].chapters.includes(chapter)?horseBodyUrl(model):null)
  :(ANIMAL_CHAPTERS[model]?.includes(chapter)?`assets/models/world/${model}.glb`:null);
// The generated landmarks on the chapters' horizons (release 9), with the chapters whose
// LANDMARK_LAYOUT (world-layouts.js) names each. The Colosseum keeps its code-built outline.
export const LANDMARK_CHAPTERS=Object.freeze(Object.fromEntries(Object.entries({
  'landmark-novae-gate':[1],'landmark-signal-tower':[1,4],'landmark-burial-mound':[1,4],
  'landmark-pile-hut':[2],'landmark-bridge-piers':[2],'landmark-river-quay':[2],
  'landmark-road-station':[3,4],'landmark-small-temple':[3],'landmark-burned-farmstead':[3],
  'landmark-river-citadel':[5],'landmark-ruined-watchtower':[5],
  'landmark-necropolis-tower-tomb':[5],'landmark-caravan-station':[6],
  'landmark-syrian-temple-court':[6],'landmark-rock-cut-tombs':[6],'landmark-adda-bridge':[7],
  'landmark-mediolanum-walls':[7],'landmark-roadside-tomb':[7],'landmark-fort-gate':[8],
  'landmark-river-warehouses':[8],'landmark-dacian-sanctuary':[8],'landmark-tetrapylon':[9],
  'landmark-walled-sanctuary':[9],'landmark-city-gate':[9],'landmark-villa':[10],
  'landmark-provincial-basilica':[10],'landmark-aqueduct':[10],'landmark-pantheon':[11],
  'landmark-arch-of-severus':[11],'landmark-mausoleum-of-hadrian':[12],
  'landmark-temple-of-sol':[12],'landmark-milvian-bridge':[12]
}).map(([id,chapters])=>[id,Object.freeze(chapters)])));
export const WORLD_CATALOG=Object.freeze({
  // Chapter V's supply camp: Tripo models processed in Blender.
  'ch5-leather-tent':reused('ch5-leather-tent'),
  'ch5-spoil-baskets':reused('ch5-spoil-baskets'),
  'ch5-storage-jars':reused('ch5-storage-jars'),
  'ch5-gallery-timbers':prop('ch5-gallery-timbers',5),
  'ch5-mudbrick-stack':reused('ch5-mudbrick-stack'),
  'ch5-cistern':reused('ch5-cistern'),
  'ch5-siege-hoist':prop('ch5-siege-hoist',5),
  'ch5-damaged-masonry':prop('ch5-damaged-masonry',5),
  'ch5-household-bundles':reused('ch5-household-bundles'),
  'ch5-fortress-kit':asset('kit',['assets/models/scenery/ch5-fortress-kit.glb'],[5,9]),
  'danube-military-kit':asset('kit',['assets/models/scenery/danube-military-kit.glb'],[1,3,4]),
  'river-wetlands-kit':asset('kit',['assets/models/scenery/river-wetlands-kit.glb'],[2,8]),
  'italian-marching-kit':asset('kit',['assets/models/scenery/italian-marching-kit.glb'],[6,7]),
  'provincial-civic-kit':asset('kit',['assets/models/scenery/provincial-civic-kit.glb'],[10]),
  'roman-monumental-kit':asset('kit',['assets/models/scenery/roman-monumental-kit.glb'],[9,11,12]),
  // The Senate's Curia in marble, around the chamber board of Chapters XI and XII (release 9).
  'roman-curia-kit':asset('kit',['assets/models/scenery/roman-curia-kit.glb'],[11,12]),
  // Aurelian's walls and gate before the finale's field (release 9).
  'aurelian-walls-kit':asset('kit',['assets/models/scenery/aurelian-walls-kit.glb'],[12]),
  // The field's own structures, fitted to its cells (worlds and gameplay plan, release 4):
  // one kit for each curtain material of the chapters whose battles are fortified.
  'board-kit-timber':asset('kit',['assets/models/scenery/board-kit-timber.glb'],[4]),
  'board-kit-mudbrick':asset('kit',['assets/models/scenery/board-kit-mudbrick.glb'],[5,6,9]),
  'board-kit-stone':asset('kit',['assets/models/scenery/board-kit-stone.glb'],[8,12]),
  // The regions' trees, with near, mid and impostor levels (release 5): one kit for each
  // group of chapters that plants the same species (tree-kit.js).
  'trees-temperate':asset('kit',['assets/models/scenery/trees-temperate.glb'],[1,2,3,4,8,10]),
  'trees-italy':asset('kit',['assets/models/scenery/trees-italy.glb'],[7,11,12]),
  'trees-arid':asset('kit',['assets/models/scenery/trees-arid.glb'],[5,6,9]),
  // Their stones: four Tripo rocks for each of the same groups (rock-kit.js).
  'rocks-temperate':asset('kit',['assets/models/scenery/rocks-temperate.glb'],[1,2,3,4,8,10]),
  'rocks-italy':asset('kit',['assets/models/scenery/rocks-italy.glb'],[7,11,12]),
  'rocks-arid':asset('kit',['assets/models/scenery/rocks-arid.glb'],[5,6,9]),
  ...Object.fromEntries(Object.entries(REGIONAL_PROP_CHAPTERS).map(([id,chapters])=>[id,asset('prop',[`assets/models/world/${id}.glb`],chapters)])),
  ...Object.fromEntries(Object.entries(LIFE_PROP_CHAPTERS).map(([id,chapters])=>[id,asset('prop',[`assets/models/world/${id}.glb`],chapters)])),
  ...Object.fromEntries(Object.entries({...CAMP_PROP_CHAPTERS,...CAMP_WALL_CHAPTERS,...TENT_VARIANT_CHAPTERS}).map(([id,chapters])=>[id,g3(id,chapters)])),
  ...Object.fromEntries(Object.entries(FIELD_OBJECT_MODELS).map(([id,m])=>[id,g5(id,m.chapters)])),
  ...Object.fromEntries(Object.entries(BATTLE_PROP_MODELS).map(([id,m])=>[id,g5(id,encounterChapters(m.encounters))])),
  ...Object.fromEntries(Object.entries(AFTERMATH_DEBRIS_MODELS).map(([id,m])=>[id,g5(id,m.chapters)])),
  ...Object.fromEntries(Object.entries(ANIMAL_CHAPTERS).map(([id,chapters])=>[id,g4(id,chapters)])),
  ...Object.fromEntries(Object.entries(LANDMARK_CHAPTERS).map(([id,chapters])=>[id,asset('landmark',[`assets/models/landmarks/${id}.glb`],chapters)])),
  // The ground's photographed layers (ground-layers.js), shared by every chapter.
  'ground-layers':asset('texture',Object.values(GROUND_FILES),[1,2,3,4,5,6,7,8,9,10,11,12]),
  // Each region's far skyline (panoramas.js), in the packs of its chapters.
  ...Object.fromEntries(PANORAMA_REGIONS.map(key=>[`panorama-${key}`,asset('panorama',[panoramaFile(key)],panoramaChapters(key))]))
});
/** The model of a placed world asset, or null. */
export const worldModelUrl=id=>WORLD_CATALOG[id]?.files.find(file=>file.endsWith('.glb'))??null;
/** The chapters an asset is in, on the web or in the desktop app. */
export const worldAssetChapters=(entry,{desktop=desktopApp()}={})=>desktop?entry.chapters:entry.web;
/** Whether a chapter shows an asset it names: on the web, only where its download carries it. An id the catalog
 * does not know is the caller's own business, and shows. */
export const worldAssetShown=(id,chapter,{desktop=desktopApp()}={})=>{const entry=WORLD_CATALOG[id];return !entry||!entry.chapters.includes(chapter)||worldAssetChapters(entry,{desktop}).includes(chapter);};
/** A chapter's world files, for its offline pack. */
export const chapterWorldFiles=(chapter,{desktop=desktopApp()}={})=>Object.values(WORLD_CATALOG).filter(entry=>worldAssetChapters(entry,{desktop}).includes(chapter)).flatMap(entry=>entry.files);
/** Every world file, whichever chapters use it. */
export const worldFiles=()=>Object.values(WORLD_CATALOG).flatMap(entry=>entry.files);
/** The files the web build leaves out, as no chapter's web download carries them (scripts/build.mjs). */
export const desktopOnlyWorldFiles=()=>Object.values(WORLD_CATALOG).filter(entry=>!entry.web.length).flatMap(entry=>entry.files);
