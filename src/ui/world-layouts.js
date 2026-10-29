// Where the generated world stands around each board, as data. Presentation
// only: no entry adds a destination, blocker or reward, and every solid stays
// outside the rules board. environment-regional-world.js and
// environment-ch5-pilot.js resolve the entries; their tests hold them to that.
//
// Regional entries place a kit piece against a board edge:
// - `edge`: 'front' (a camp's north edge, or the encounter's landmark edge),
//   'opposite' (the next edge round from it), 'back' (the edge behind it), or
//   north, south, east or west;
// - `along`: metres along that edge; `gap`: metres from the board edge to the
//   piece's near face;
// - `slot`: a chapter's plan, by index; or `component` names the piece itself;
// - `beside`: next to an earlier slot, with `spacing` between their faces;
// - `kit` overrides the chapter's kit; `camp: true` only in the chapter's camp.
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;};

// The Blender kit that dresses each chapter. Chapter V has its own fortress.
export const REGIONAL_WORLD_KITS=freeze({
  1:'danube-military-kit',2:'river-wetlands-kit',3:'danube-military-kit',4:'danube-military-kit',
  6:'italian-marching-kit',7:'italian-marching-kit',8:'river-wetlands-kit',9:'ch5-fortress-kit',
  10:'provincial-civic-kit',11:'roman-monumental-kit',12:'roman-monumental-kit'
});

// Each chapter's eight buildings and working spaces, not one facade recoloured.
// Different mission approaches rotate the frontage toward their landmark road.
export const REGIONAL_PLANS=freeze({
  1:['timber_gate','palisade_bay','watch_platform','barrack_gable','forge_shelter','storehouse_raised','stone_well','signal_beacon'],
  2:['ferry_shelter','reed_screen','stilt_store','fish_drying_rack','flood_revetment','duckboard_corner','rope_bollards','bridge_trestle'],
  3:['tiled_portico','barrack_gable','storehouse_raised','granary_vent','forge_shelter','ditch_bridge','milestone_base','stone_well'],
  4:['timber_gate','watch_platform','palisade_bay','storehouse_raised','tiled_portico','granary_vent','signal_beacon','ditch_bridge'],
  6:['canvas_windbreak','ridge_tent','officers_awning','wagon_shed','baggage_rack','field_kitchen','drainage_crossing','road_marker'],
  7:['command_pavilion','ridge_tent','officers_awning','wagon_shed','vine_pergola','field_kitchen','marching_gate','roadside_shrine'],
  8:['ferry_shelter','stilt_store','reed_screen','mooring_jetty','landing_steps','flood_revetment','levee_stair','duckboard_straight'],
  9:['gate_arch','wall_bay','tower_intact','roof_gallery','wall_return','plaster_repair','paved_threshold','drain_channel'],
  10:['tribunal_portico','raised_granary','tile_roof_store','market_stall','pergola_arcade','produce_store','irrigation_sluice','boundary_cairn'],
  11:['administrative_portico','archive_stalls','colonnade_bay','garden_exedra','screen_wall','civic_fountain','statue_plinth','vaulted_entry'],
  12:['checkpoint_arch','screen_wall','colonnade_bay','apsidal_hall','administrative_portico','tribunal_dais','monumental_stair','statue_plinth']
});

// The frontage every regional field and camp shares, in placing order: a
// gateway between two neighbours, two pieces on the next edge round, two
// behind, a far landmark down the approach, and in camp two more beside it.
export const REGIONAL_FRONTAGE=freeze([
  {slot:0,edge:'front',along:0,gap:2.4},
  {slot:1,edge:'front',beside:{slot:0,side:-1,spacing:1.1},gap:2.8},
  {slot:2,edge:'front',beside:{slot:0,side:1,spacing:1.1},gap:2.8},
  {slot:3,edge:'opposite',along:-8,gap:3.3},
  {slot:4,edge:'opposite',along:8,gap:4.3},
  {slot:5,edge:'back',along:-7,gap:4.5},
  {slot:6,edge:'back',along:7,gap:4.0},
  {slot:7,edge:'front',along:0,gap:16.5},
  {slot:3,edge:'opposite',along:-21,gap:4.5,camp:true},
  {slot:4,edge:'opposite',along:21,gap:4.5,camp:true}
]);

// The entrance remains aligned with the real boundary road. Beyond it, each
// region has a working arrangement rather than the same ring of eight props.
// Entries reuse the chapter's exact eight-piece kit and two camp duplicates;
// no new model, download, service location or collision cell is introduced.
const composed=(title,rows)=>({title,entries:[...REGIONAL_FRONTAGE.slice(0,3),...rows.map(([slot,edge,along,gap,yaw=0,camp=false])=>({slot,edge,along,gap,yaw,...(camp?{camp:true}:{})}))]});
export const REGIONAL_COMPOSITIONS=freeze({
  1:composed('Barrack street and separate stores court',[[3,'opposite',-2,3.5],[4,'opposite',9,3.5],[5,'opposite',-13,3.5],[6,'back',2,4],[7,'front',0,17],[3,'opposite',-24,3.5,0,true],[4,'opposite',20,3.5,0,true]]),
  2:composed('Raised riverbank work line',[[3,'back',-11,4],[4,'back',1,4],[5,'back',12,4],[6,'front',-17,4],[7,'front',16,7],[3,'back',-23,4,0,true],[4,'back',24,4,0,true]]),
  3:composed('Road station loading court',[[3,'opposite',-3,3.3],[4,'opposite',9,7],[5,'back',2,5],[6,'front',-18,4],[7,'front',18,6],[3,'opposite',-15,3.3,0,true],[4,'opposite',21,7,0,true]]),
  4:composed('Fort gate with a recessed supply court',[[3,'front',-17,8],[4,'front',17,8],[5,'opposite',-1,3.5],[6,'back',7,6],[7,'back',-9,5],[3,'front',-28,8,0,true],[4,'front',28,8,0,true]]),
  6:composed('Retreat caravan and shaded water verge',[[3,'opposite',-10,5],[4,'opposite',1,5],[5,'opposite',12,5],[6,'back',-5,4],[7,'front',17,6],[3,'opposite',-22,5,0,true],[4,'opposite',23,5,0,true]]),
  7:composed('Command tents around an open assembly approach',[[3,'back',-12,5],[4,'front',17,7],[5,'back',1,5],[6,'opposite',8,4],[7,'front',-17,7],[3,'back',16,5,0,true],[4,'front',28,7,0,true]]),
  8:composed('Landing terraces and household staging bank',[[3,'back',-10,5],[4,'back',2,5],[5,'back',14,5],[6,'front',-24,5],[7,'opposite',0,4],[3,'back',-23,5,0,true],[4,'back',25,5,0,true]]),
  9:composed('Receding eastern gate wings',[[3,'front',-17,8],[4,'front',17,8],[5,'front',-25,10],[6,'opposite',2,4],[7,'opposite',12,4],[3,'front',-35,9,0,true],[4,'front',28,10,0,true]]),
  10:composed('Market wing beside the grain loading street',[[3,'opposite',-12,4],[4,'opposite',0,4],[5,'opposite',12,4],[6,'back',-7,5],[7,'front',18,7],[3,'opposite',-24,4,0,true],[4,'opposite',24,4,0,true]]),
  11:composed('Archive wing enclosing a petitioners garden',[[3,'back',-10,5],[4,'back',3,5],[5,'front',17,8],[6,'opposite',0,4],[7,'front',-18,9],[3,'back',-35,5,0,true],[4,'back',16,5,0,true]]),
  12:composed('Monumental north court and open standards approach',[[3,'front',-19,12],[4,'front',19,12],[5,'opposite',0,5],[6,'back',-4,5],[7,'front',0,20],[3,'front',-33,12,0,true],[4,'front',33,12,0,true]])
});

// A chapter's own additions after its frontage.
export const REGIONAL_CHAPTER_EXTRAS=freeze({
  // The connected Palmyrene urban edge.
  9:[{component:'colonnade_bay',kit:'roman-monumental-kit',edge:'west',along:-6,gap:10.4,yaw:Math.PI/2},
    {component:'colonnade_bay',kit:'roman-monumental-kit',edge:'west',along:6,gap:10.4,yaw:Math.PI/2}],
  // Cultivated land around the provincial court.
  10:[{component:'olive_press_frame',edge:'west',along:15,gap:5},{component:'farm_courtyard_wall',edge:'south',along:0,gap:9}]
});

// Chapter X's hearing keeps the code-built audience hall: shallow pieces line its
// open entrance and the outer service courts, clear of its walls. In Chapters XI
// and XII the Curia (below) stands in the hall's place, and only the city's
// buildings beyond its walls remain.
const romanHearing=[{slot:0,edge:'north',along:0,gap:13},{slot:1,edge:'west',along:0,gap:12},{slot:2,edge:'east',along:0,gap:12}];
export const REGIONAL_HEARINGS=freeze({
  10:[{component:'tally_counter',edge:'north',along:0,gap:1.1},{component:'market_stall',edge:'south',along:-8,gap:3.2},
    {component:'public_fountain',edge:'south',along:8,gap:3.2},{slot:0,edge:'north',along:0,gap:13},
    {slot:1,edge:'west',along:0,gap:12},{slot:2,edge:'east',along:0,gap:12}],
  11:romanHearing,12:romanHearing
});

// The Curia of Chapters XI and XII (worlds and gameplay plan, release 9): the Senate
// house in marble, built in Blender around the 8 x 8 chamber board
// (scripts/assets/build-curia.py). Its pieces are authored in place, so each stands
// at the board's centre. Presentation only: every solid stays outside the board.
// - `floor`: the paving round the board's own floor, flat and just above the ground.
// - `replaces`: the code-built stand-ins it hides once it has loaded (the audience
//   hall, environment-depth.js; the chamber's colonnades, arches and dais,
//   environment-campaign-scenery.js). Performance and a failed download keep them.
// - `cutaway`: a wall stands down while the camera is beyond its inner face (the
//   plane normal·(x, z) = face), so no wall stands between the camera and the board.
//   Walls cast no shadow, so none darkens the board.
// - `props`: where the chapter's generated props stand in the Curia's scenes: the
//   clerks' tables beside the tribunal, the fountain and the army's eagle outside the
//   doors.
export const CURIA_LAYOUT=freeze({
  chapters:[11,12],kit:'roman-curia-kit',board:8,
  replaces:['enclosed Roman audience hall','senate','imperial court'],
  pieces:[
    {component:'curia_floor',floor:true},{component:'curia_steps_west'},{component:'curia_steps_east'},
    {component:'curia_tribunal'},{component:'curia_victory'},
    {component:'curia_wall_west',shadow:false,cutaway:{normal:[-1,0],face:14}},
    {component:'curia_wall_east',shadow:false,cutaway:{normal:[1,0],face:14}},
    {component:'curia_wall_north',shadow:false,cutaway:{normal:[0,-1],face:17}},
    {component:'curia_facade',shadow:false,cutaway:{normal:[0,1],face:14}}
  ],
  props:{
    'courier-table':{x:-8,z:-13.6,yaw:Math.PI/2},'command-table':{x:-8,z:-13.6,yaw:Math.PI/2},
    'archive-cabinet':{x:8.2,z:-14.6,yaw:-Math.PI/2},
    'civic-fountain':{x:-9.5,z:19.4,yaw:0},'eagle-rally-stand':{x:7,z:19,yaw:0}
  }
});

// Life about the field (worlds and gameplay plan, release 9; environment-life.js). Presentation only.
// - `hearths`: the regional pieces whose smoke rises, and from where: a fraction of the piece's
//   height above its foot, and of its depth from its centre (its front is +).
// - `birds` and `puffs`: the birds wheeling over an outdoor scene by day, and the puffs in each
//   hearth's plume, at each tier above Performance; `hearths` caps the plumes in one scene.
export const LIFE_LAYOUT=freeze({
  hearths:{
    barrack_gable:{height:.95,depth:-.2},forge_shelter:{height:.8,depth:-.25},
    field_kitchen:{height:.55,depth:0},fish_drying_rack:{height:.3,depth:0}
  },
  birds:{balanced:9,high:14},puffs:{balanced:6,high:9},maxHearths:4
});

// Encounters composed on their own instead of the shared frontage.
export const ENCOUNTER_LAYOUTS=freeze({
  // The authored Aurelian curtain and distant cohorts stay. New civic
  // buildings belong to the city behind it, not the occupied army verge.
  // `gate`: Aurelian's gate (aurelian-walls.js) stands here instead once its kit has loaded.
  'ch12-confrontation':[
    {component:'checkpoint_arch',edge:'east',along:0,gap:6.4,gate:true},
    {component:'administrative_portico',edge:'east',along:-18,gap:19},{component:'apsidal_hall',edge:'east',along:18,gap:21},
    {component:'colonnade_bay',edge:'north',along:-5,gap:9},{component:'colonnade_bay',edge:'north',along:5,gap:9},
    {component:'statue_plinth',edge:'south',along:-7,gap:7},{component:'garden_exedra',edge:'south',along:7,gap:11}]
});

// Chapter V's fortress: a compact two-tower frontage near the far edge, with
// receding wings and work spaces, and a river landing beyond the board's
// north-east corner. Frontage offsets are metres from the anchor `inset` beyond
// the edge: x along it, z outward. A value may differ in the camp and the field.
export const CH5_FORTRESS_LAYOUT=freeze({
  encounters:['ch5-mine','ch5-wall','ch5-camp'],
  edges:{'ch5-mine':'east'},defaultEdge:'north',inset:5.1,
  frontage:[
    {component:'gate_arch',x:0,z:.4},
    {component:{camp:'tower_intact',field:'tower_broken'},x:-5.3,z:1.1},
    {component:'tower_intact',x:5.3,z:1.1},
    // Curtain bays on both sides, as many as the edge allows (2–6 each),
    // breached first on the left in the field, with a buttress every other bay.
    {wall:{bay:'wall_bay',breach:{field:'wall_breached'},first:9.4,step:4.15,z:1.5,rise:.15,min:2,max:6,clear:8,
      buttress:{component:'buttress',z:.05,every:2}}},
    {component:'mine_frame',x:-10,z:-1.5,scale:{camp:[1,1,1],field:[1.2,1.15,1.25]}},
    {component:'roof_gallery',x:10.5,z:6.6},
    {component:'roof_gallery',x:-12,z:6.6},
    {component:'plaster_repair',x:10.5,z:8.9},
    {component:'wall_return',x:-13,z:9.1},
    {component:'stair_flight',x:6.6,z:6.6},
    {component:'paved_threshold',x:0,z:-1.8},
    {component:'drain_channel',x:14,z:-.9}
  ],
  // Metres east of the board's east edge (x) and from its north edge (z, north
  // negative). Water structures sit on the authored water datum (groundY).
  quay:[
    {component:'landing_deck',x:6,z:-9,yaw:0,groundY:-1.4},
    {component:'quay_revetment',x:5,z:-5,yaw:0,groundY:-1.2},
    {component:'bluff_section',x:11,z:-5,yaw:0},
    {component:'bluff_section',x:18,z:-5,yaw:.08}
  ]
});

// A presentation-only seed from an encounter id (FNV-1a), for scenery that
// varies between encounters but never between visits. It is not the campaign's
// random generator and must never feed the rules.
export function presentationSeed(id){
  let h=0x811c9dc5;for(const ch of String(id??''))h=Math.imul(h^ch.codePointAt(0),0x01000193)>>>0;return h;
}
// A small deterministic sequence from that seed (mulberry32), values in [0, 1).
export function presentationRandom(seed){
  let a=seed>>>0;
  return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
