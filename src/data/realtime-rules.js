// Real-time rules as data (build brief §2.5, §3.2, §3.5–§3.6, §3.13). The
// simulation reads these tables and hard-codes none of their numbers. Times
// are seconds and distances metres unless a name says ticks.

export const TIME=Object.freeze({tickMs:50,ticksPerSecond:20,roundTicks:200,
  // AI decides at 4 Hz, staggered by actor (§3.1, system 2).
  aiInterval:5,slowFactor:.5,speeds:Object.freeze([.5,.75,1]),
  // A frame longer than this (a backgrounded tab) runs no more simulation than this much.
  maxFrameMs:250});

export const MOVEMENT=Object.freeze({walk:1.6,run:4,runMin:2.4,runRestriction:200,
  // A path longer than this runs, unless walk mode (W) is on.
  runThreshold:8,
  // An enemy this close who has you inside his front arc stops you running.
  engagedRange:2,
  // Facing turns at 720°/s: each tick by at most 36° (its cosine and sine), an about-turn in a quarter second.
  turnStep:Object.freeze([.8090169943749475,.5877852522924731]),
  radius:.35,cell:.5,
  // Blocked ground is widened by this many cells so a body never clips a rock.
  clearance:1,
  arrive:.05,repathTicks:10,terrain:Object.freeze({marsh:.6,ford:.5})});

// Arcs as cosines of the angle from the defender's facing: inside the 120°
// front arc, and within 60° of directly behind.
export const ARCS=Object.freeze({front:.5,rear:-.8660254037844386});

export const COMBAT=Object.freeze({
  // r = int(0, 39): 0 misses, 36 and above is a critical that always hits.
  roll:40,critical:36,
  blockCap:.75,braceBlock:.3,stuckPilum:.5,braceProtection:1,minimumDamage:1,
  rearAttack:10,heightDefence:5,heightStep:1.5,coverMissile:10,weatherMissile:10,weatherDamage:1,weatherRange:20,
  // A critical by the actor the player controls does this much more.
  criticalFactor:2,
  // A blow lands at this fraction of the swing, and still lands on a target this much beyond reach.
  contact:.5,reachSlack:.5,
  // A blow staggers when it takes more than maxHealth / staggerFraction, or stuns at all.
  staggerFraction:5,stagger:Object.freeze({base:.8,con:40,min:.2,max:.8,stun:.1,stunMax:1}),
  // Melee damage × (1 + (Str − 10) / meleeStrength); thrown × (1 + (Str − 10) / thrownStrength).
  meleeStrength:25,thrownStrength:50,resistCap:.8,
  // A thrown missile still strikes a man this far from its aim point.
  missileSlack:.9,
  regen:Object.freeze({healthBase:.004,healthCon:5000,calmSeconds:10,calmRange:30,stamina:4,staminaCon:20,staminaFloor:.25})});

export const ATTRIBUTES=Object.freeze(['str','agi','con','per','elo','auth','combat','field']);
export const ATTRIBUTE_NAMES=Object.freeze({str:'Strength',agi:'Agility',con:'Constitution',per:'Perception',elo:'Eloquence',auth:'Authority',
  combat:'Combat',field:'Fieldcraft'});
export const BASE_ATTRIBUTES=Object.freeze({str:10,agi:10,con:10,per:10,elo:10,auth:10,combat:5,field:5});
export const TRAINING_PATHS=Object.freeze({
  legionary:Object.freeze({name:'Legionary',mods:Object.freeze({combat:10,str:5,con:3,agi:2,per:-3,elo:-3,auth:-3})}),
  explorator:Object.freeze({name:'Explorator',mods:Object.freeze({field:10,agi:5,str:2,elo:-3,auth:-3})}),
  librarius:Object.freeze({name:'Librarius',mods:Object.freeze({elo:5,auth:5,agi:2,per:2,field:-3})})});

export const DAMAGE_TYPES=Object.freeze(['cut','pierce','crush','fire','stun']);
// Swing and reach from §3.5; damage ranges [min, max] per type.
export const WEAPONS=Object.freeze({
  gladius:Object.freeze({name:'Gladius',swing:1.1,reach:1.5,damage:Object.freeze({pierce:[4,8],cut:[1,3]})}),
  spatha:Object.freeze({name:'Spatha',swing:1.3,reach:1.8,damage:Object.freeze({cut:[3,7],pierce:[1,2]})}),
  spear:Object.freeze({name:'Spear',swing:1.4,reach:2.5,damage:Object.freeze({pierce:[2,6]})}),
  axe:Object.freeze({name:'Axe',swing:1.6,reach:1.6,damage:Object.freeze({cut:[4,8],crush:[0,2]})}),
  unarmed:Object.freeze({name:'Unarmed',swing:.9,reach:1,damage:Object.freeze({crush:[1,2]})})});
export const MISSILES=Object.freeze({
  pilum:Object.freeze({name:'Pilum',range:25,speed:22,damage:Object.freeze({pierce:[5,10]}),sticks:true}),
  javelin:Object.freeze({name:'Javelin',range:22,speed:20,damage:Object.freeze({pierce:[3,7]}),sticks:true})});
export const SHIELDS=Object.freeze({scutum:Object.freeze({name:'Scutum',block:.3}),parma:Object.freeze({name:'Parma',block:.2}),
  round:Object.freeze({name:'Round shield',block:.2})});

// Items follow the §3.13 schema (protection per type as {absorb, resist}).
// Phase 0 carries only what the arena wears; the full kit arrives in Phase 1.
const p=(absorb,resist)=>Object.freeze({absorb,resist});
const item=data=>Object.freeze({layer:0,protection:Object.freeze({}),restriction:0,value:0,shape:Object.freeze({w:1,h:1}),...data});
export const ITEMS=Object.freeze({
  tunic:item({name:'Wool tunic',slot:'body',protection:Object.freeze({cut:p(0,.05),pierce:p(0,.05),crush:p(0,.05)}),value:4,shape:{w:2,h:2}}),
  subarmalis:item({name:'Subarmalis',slot:'body',layer:1,restriction:2,protection:Object.freeze({cut:p(1,.1),pierce:p(1,.1),crush:p(2,.2),stun:p(1,.1)}),
    value:12,shape:{w:2,h:2}}),
  hamata:item({name:'Lorica hamata',slot:'body',layer:2,restriction:8,protection:Object.freeze({cut:p(3,.3),pierce:p(1,.2),crush:p(1,.1)}),value:60,
    shape:{w:2,h:3}}),
  galea:item({name:'Galea',slot:'head',layer:1,restriction:2,protection:Object.freeze({cut:p(1,.1),pierce:p(1,.1),crush:p(1,.1),stun:p(2,.2)}),value:25,
    shape:{w:2,h:2}}),
  caligae:item({name:'Caligae',slot:'feet',value:6,shape:{w:2,h:1}}),
  cingulum:item({name:'Cingulum',slot:'belt',belt:Object.freeze({pila:2}),value:10,shape:{w:2,h:1}}),
  scutum:item({name:'Scutum',slot:'shield',restriction:6,shield:'scutum',value:20,shape:{w:2,h:4}}),
  gladius:item({name:'Gladius',slot:'weapon',restriction:1,weapon:'gladius',value:18,shape:{w:1,h:3}}),
  jerkin:item({name:'Leather jerkin',slot:'body',layer:1,restriction:3,protection:Object.freeze({cut:p(1,.15),pierce:p(1,.1),crush:p(1,.1)}),value:9,
    shape:{w:2,h:2}}),
  round_shield:item({name:'Round shield',slot:'shield',restriction:3,shield:'round',value:8,shape:{w:3,h:3}}),
  axe:item({name:'Axe',slot:'weapon',restriction:2,weapon:'axe',value:7,shape:{w:1,h:3}}),
  spear:item({name:'Spear',slot:'weapon',restriction:2,weapon:'spear',value:6,shape:{w:1,h:4}}),
  spatha:item({name:'Spatha',slot:'weapon',restriction:1,weapon:'spatha',value:15,shape:{w:1,h:3}})});

// Abilities (§3.6). Phase 0 implements Strike, Brace and Throw pilum; the
// rest of the initial set arrives with its phase.
export const ABILITIES=Object.freeze({
  strike:Object.freeze({id:'strike',name:'Strike',kind:'technique',unlock:{chapter:1},target:'enemy',cost:Object.freeze({}),
    summary:'Auto-fight the enemy until he falls.'}),
  brace:Object.freeze({id:'brace',name:'Brace',kind:'technique',unlock:{chapter:1},target:'self',cost:Object.freeze({stamina:15}),duration_s:6,
    effects:Object.freeze([{type:'brace',block:.3,protection:1,noStagger:true}]),summary:'Plant your shield: block more, no stagger, 1 less from every blow.'}),
  throw_pilum:Object.freeze({id:'throw_pilum',name:'Throw pilum',kind:'technique',unlock:{chapter:1},target:'enemy',groundTarget:true,range_m:25,
    cost:Object.freeze({ammo:'pilum'}),castTime_s:.8,release:.5,recovery_s:.4,interruptible:true,effects:Object.freeze([{type:'missile',missile:'pilum'}]),
    summary:'Throw a pilum up to 25 metres; a blocked one sticks in the shield.'}),
  // The raiders' own technique; never on the player's bar.
  throw_javelin:Object.freeze({id:'throw_javelin',name:'Throw javelin',kind:'technique',enemyOnly:true,unlock:{},target:'enemy',range_m:22,
    cost:Object.freeze({ammo:'javelin'}),castTime_s:.8,release:.5,recovery_s:2.4,interruptible:true,effects:Object.freeze([{type:'missile',missile:'javelin'}]),
    summary:'A raider’s javelin.'})});
// The field bar's default places: 1 Strike, 2 Brace, 3 Throw pilum.
export const FIELD_BAR=Object.freeze(['strike','brace','throw_pilum']);

// Reason codes as message-line data (§3.6). The last group is added in Phase 0
// for cases the brief's list does not name; the phase report records them.
export const REASONS=Object.freeze({
  OUT_OF_RANGE:'Out of range.',NO_LINE_OF_SIGHT:'No clear line to the target.',NOT_ENOUGH_STAMINA:'Not enough Stamina.',NO_AMMO:'No pila left.',
  NO_BANDAGES:'No bandages left.',RECOVERING:'Still recovering.',NEEDS_SHEATHED:'Sheathe your weapon first (Space).',
  NEEDS_DRAWN:'Draw your weapon first (Space).',PATH_BLOCKED:'No way through: he stops at the nearest point he can reach.',
  ENGAGED_CANNOT_RUN:'Engaged: an enemy facing you within two metres. You can only walk.',NO_COMMAND:'No Command left this round.',
  NO_SQUAD_SELECTED:'Select a squad first.',SQUADS_TOO_FAR_APART:'Those squads stand too far apart.',ALREADY_SPOKEN_THIS_HOUR:'Already spoken this hour.',
  OUTSIDE_REACH:'Outside his reach this hour.',ONCE_PER_MEMBER:'Once per member.',NOT_IN_DEPLOYMENT_ZONE:'Outside the deployment zone.',
  CANNOT_SAVE_HERE:'You cannot save here.',
  NO_SHIELD:'Brace needs a shield.',STAGGERED:'Staggered: wait a moment.',NO_TARGET:'Choose a target.',TARGET_DOWN:'He has already fallen.',
  NOT_HOSTILE:'Not an enemy. Shift+click forces an attack.',ACTOR_DOWN:'He has fallen.',BATTLE_OVER:'The fight is over.'});

// Phase 0 enemy behaviour (§3.10 arrives in Phase 1): notice within a
// radius, then engage, spreading round the target; skirmishers throw first.
export const ENEMY_AI=Object.freeze({noticeRadius:13,
  // Each engager approaches its own side of the target: 0°, ±70°, ±140° from
  // the direct line, as [cos, sin] so the rules need no trigonometry.
  spread:Object.freeze([[1,0],[.3420201433256688,.9396926207859083],[.3420201433256688,-.9396926207859083],
    [-.7660444431189779,.6427876096865395],[-.7660444431189779,-.6427876096865395]]),
  // A skirmisher throws from between these distances, then closes to fight.
  skirmish:Object.freeze({close:7,far:18})});

// The Phase 0 arena on the frontier road's map: a Legionary against three
// raiders. Positions are metres from the map's north-west corner.
export const ARENA=Object.freeze({
  map:'ch1-road',objective:'Defeat the three raiders on the road.',
  hero:Object.freeze({id:'hero',name:'Aurelius Marcellus',side:'player',role:'soldier',path:'legionary',
    kit:Object.freeze(['tunic','subarmalis','hamata','galea','caligae','cingulum','scutum','gladius']),ammo:Object.freeze({pilum:2}),at:[1.6,8.75],face:[1,0]}),
  enemies:Object.freeze([
    Object.freeze({id:'raider-axe',name:'Gothic raider',role:'raider',attributes:Object.freeze({str:13,agi:12,con:10,combat:8,field:8}),
      kit:Object.freeze(['tunic','jerkin','axe']),at:[16.25,6.6],face:[-1,0]}),
    Object.freeze({id:'raider-spear',name:'Gothic spearman',role:'raider',attributes:Object.freeze({str:12,agi:12,con:12,combat:7,field:8}),
      kit:Object.freeze(['tunic','jerkin','round_shield','spear']),at:[17.5,13.75],face:[-1,0]}),
    Object.freeze({id:'raider-skirmisher',name:'Gothic skirmisher',role:'raider',skirmisher:true,
      attributes:Object.freeze({str:11,agi:14,con:10,per:12,combat:7,field:9}),kit:Object.freeze(['tunic','spatha']),ammo:Object.freeze({javelin:2}),
      at:[18.75,9.4],face:[-1,0]})])});
