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
  arrive:.05,repathTicks:10,terrain:Object.freeze({marsh:.6,ford:.5}),
  // Close enough to talk to a man or search a body.
  talkRange:1.8});

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
  // A man of a squad in shield wall takes this much less from a frontal blow; the Engineering approach adds this Defence to our squads' men.
  shieldWall:2,engineersDefence:10,
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
  unarmed:Object.freeze({name:'Unarmed',swing:.9,reach:1,damage:Object.freeze({crush:[1,2]})}),
  knife:Object.freeze({name:'Knife',swing:.9,reach:1.1,damage:Object.freeze({pierce:[1,4]})}),
  // Missile weapons: a "swing" draws and looses; `ranged` names the missile and its range.
  bow:Object.freeze({name:'Bow',swing:1.8,reach:1,damage:Object.freeze({crush:[1,2]}),ranged:Object.freeze({missile:'arrow',ammo:'arrow',range:40})}),
  sling:Object.freeze({name:'Sling',swing:1.6,reach:1,damage:Object.freeze({crush:[1,2]}),ranged:Object.freeze({missile:'bullet',ammo:null,range:32})})});
export const MISSILES=Object.freeze({
  pilum:Object.freeze({name:'Pilum',range:25,speed:22,damage:Object.freeze({pierce:[5,10]}),sticks:true}),
  javelin:Object.freeze({name:'Javelin',range:22,speed:20,damage:Object.freeze({pierce:[3,7]}),sticks:true}),
  dart:Object.freeze({name:'Plumbata',range:35,speed:24,damage:Object.freeze({pierce:[3,6]}),sticks:false}),
  arrow:Object.freeze({name:'Arrow',range:40,speed:45,damage:Object.freeze({pierce:[2,6]}),sticks:false,shot:true}),
  bullet:Object.freeze({name:'Sling bullet',range:32,speed:35,damage:Object.freeze({crush:[2,5],stun:[0,1]}),sticks:false,shot:true})});
export const SHIELDS=Object.freeze({scutum:Object.freeze({name:'Scutum',block:.3}),parma:Object.freeze({name:'Parma',block:.2}),
  round:Object.freeze({name:'Round shield',block:.2})});

// Kit lives in items.js (§3.13); the rules read it from there.
export {ITEMS} from './items.js';

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
  bind_wounds:Object.freeze({id:'bind_wounds',name:'Bind wounds',kind:'technique',unlock:{chapter:2},target:'ally',selfIfNoTarget:true,range_m:1.6,approach:true,
    cost:Object.freeze({bandage:1}),castTime_s:3,recovery_s:.5,interruptible:true,effects:Object.freeze([{type:'heal',fraction:.25}]),
    summary:'Three seconds’ work restores a quarter of Health; a hit stops it and the bandage is kept.'}),
  carry:Object.freeze({id:'carry',name:'Carry',kind:'technique',unlock:{chapter:2},target:'ally',range_m:1.6,approach:true,cost:Object.freeze({}),needsSheathed:true,
    effects:Object.freeze([{type:'carry'}]),summary:'Lift a fallen comrade (weapon sheathed). Walk only; your shield does not block.'}),
  scout:Object.freeze({id:'scout',name:'Scout',kind:'technique',unlock:{chapter:3},target:'self',cost:Object.freeze({stamina:20}),recovery_s:30,
    effects:Object.freeze([{type:'reveal',radius:30,duration_s:20}]),summary:'Reveal hidden enemies and concealed ground within 30 metres for 20 seconds.'}),
  shield_bash:Object.freeze({id:'shield_bash',name:'Shield bash',kind:'technique',unlock:{course:'shield_bash'},target:'enemy',range_m:1.2,approach:true,
    cost:Object.freeze({stamina:10}),castTime_s:.6,release:.5,recovery_s:8,needsShield:true,
    effects:Object.freeze([{type:'bash',damage:Object.freeze({stun:[6,10],crush:[1,3]})}]),summary:'A stunning blow with the shield boss that staggers him.'}),
  throw_dart:Object.freeze({id:'throw_dart',name:'Throw plumbata',kind:'technique',unlock:{chapter:5},target:'enemy',groundTarget:true,range_m:35,
    cost:Object.freeze({ammo:'dart'}),castTime_s:.7,release:.5,recovery_s:.4,interruptible:true,effects:Object.freeze([{type:'missile',missile:'dart'}]),
    summary:'Throw a lead-weighted dart up to 35 metres.'}),
  // Chapter VI: the soldier's voice steadies every friendly squad near him (realtime-squads.js RALLY).
  rally:Object.freeze({id:'rally',name:'Rally',kind:'technique',unlock:{chapter:6},target:'self',cost:Object.freeze({stamina:30}),recovery_s:45,
    effects:Object.freeze([{type:'rally'}]),summary:'Friendly squads within 20 metres regain 20 morale and lose all suppression.'}),
  // Specialists (a veteran companion's action for one Command; guide "Specialists").
  guard:Object.freeze({id:'guard',name:'Guard',kind:'specialist',specialist:'protector',target:'ally',range_m:2,approach:true,cost:Object.freeze({command:1}),
    effects:Object.freeze([{type:'guard'}]),summary:'A friend within 2 m takes 2 less from every blow for a round; he braces and stands.'}),
  inspire:Object.freeze({id:'inspire',name:'Inspire',kind:'specialist',specialist:'leader',target:'self',cost:Object.freeze({command:1}),
    effects:Object.freeze([{type:'inspire'}]),summary:'Friends within 15 m regain 15 morale and brace.'}),
  volley:Object.freeze({id:'volley',name:'Volley',kind:'specialist',specialist:'ranged',target:'enemy',range_m:60,cost:Object.freeze({command:1}),perBattle:2,
    effects:Object.freeze([{type:'volley'}]),summary:'An aimed volley at a visible enemy within 60 m with a clear line; two a battle.'}),
  // The raiders' own technique; never on the player's bar.
  throw_javelin:Object.freeze({id:'throw_javelin',name:'Throw javelin',kind:'technique',enemyOnly:true,unlock:{},target:'enemy',range_m:22,
    cost:Object.freeze({ammo:'javelin'}),castTime_s:.8,release:.5,recovery_s:2.4,interruptible:true,effects:Object.freeze([{type:'missile',missile:'javelin'}]),
    summary:'A raider’s javelin.'})});
// The field bar's default places: 1 Strike, 2 Brace, 3 Throw pilum; new
// techniques take the next free place as they are learnt.
export const FIELD_BAR=Object.freeze(['strike','brace','throw_pilum']);
export const FIELD_ORDER=Object.freeze(['strike','brace','throw_pilum','bind_wounds','carry','scout','shield_bash','rally','guard','inspire','volley']);
// Bandages a soldier carries into each encounter.
export const BANDAGES_PER_ENCOUNTER=3;

// Reason codes as message-line data (§3.6). The last group is added in Phase 0
// for cases the brief's list does not name; the phase report records them.
export const REASONS=Object.freeze({
  OUT_OF_RANGE:'Out of range.',NO_LINE_OF_SIGHT:'No clear line to the target.',NOT_ENOUGH_STAMINA:'Not enough Stamina.',NO_AMMO:'No pila left.',
  NO_BANDAGES:'No bandages left.',RECOVERING:'Still recovering.',NEEDS_SHEATHED:'Sheathe your weapon first (Space).',
  NEEDS_DRAWN:'Draw your weapon first (Space).',PATH_BLOCKED:'No way through: he stops at the nearest point he can reach.',
  ENGAGED_CANNOT_RUN:'Engaged: an enemy facing you within two metres. You can only walk.',
  MARCH_PENALTY:'He keeps to a walk: the engineers (or a defensive advance) hold him to the column’s pace.',NO_COMMAND:'No Command left this round.',
  NO_SQUAD_SELECTED:'Select a squad first.',SQUADS_TOO_FAR_APART:'Those squads stand too far apart.',ALREADY_SPOKEN_THIS_HOUR:'Already spoken this hour.',
  OUTSIDE_REACH:'Outside his reach this hour.',ONCE_PER_MEMBER:'Once per member.',NOT_IN_DEPLOYMENT_ZONE:'Outside the deployment zone.',
  DEPLOYING:'Deployment: place your company, then Sound the advance.',NOT_DEPLOYING:'The battle has begun.',
  CANNOT_SAVE_HERE:'You cannot save here.',
  PEACEFUL_CAMP:'Weapons stay sheathed in camp. Speak to a person or use a service.',
  NO_SHIELD:'Brace needs a shield.',STAGGERED:'Staggered: wait a moment.',NO_TARGET:'Choose a target.',TARGET_DOWN:'He has already fallen.',
  NOT_HOSTILE:'Not an enemy. Shift+click forces an attack.',FRIENDLY:'He is on your side.',ACTOR_DOWN:'He has fallen.',BATTLE_OVER:'The fight is over.',
  NOT_LEARNT:'Not learnt yet.',CARRYING:'You are carrying a comrade: set him down first.',NOT_FRIENDLY:'Choose a comrade.',
  NOT_WOUNDED:'He is not wounded.',NOT_FALLEN:'Only a fallen comrade can be carried.',NOT_IN_CAMP:'Not here in camp.',
  ALREADY_DONE:'That is already done.',OPPORTUNITY_CLOSED:'That opportunity has closed: only one could be taken, before the end of round 7.',ALREADY_CONTROLLED:'You already control him.',NO_VOLLEYS:'No volleys left this battle.',
  NO_FRIEND_NEAR:'No friend within reach.',NOT_A_SQUAD:'Choose a squad.'});

// Phase 0 enemy behaviour (§3.10 arrives in Phase 1): notice within a
// radius, then engage, spreading round the target; skirmishers throw first.
export const ENEMY_AI=Object.freeze({noticeRadius:13,
  // Each engager approaches its own side of the target: 0°, ±70°, ±140° from
  // the direct line, as [cos, sin] so the rules need no trigonometry.
  spread:Object.freeze([[1,0],[.3420201433256688,.9396926207859083],[.3420201433256688,-.9396926207859083],
    [-.7660444431189779,.6427876096865395],[-.7660444431189779,-.6427876096865395]]),
  // A skirmisher throws from between these distances, then closes to fight.
  skirmish:Object.freeze({close:7,far:18}),
  // A drill partner spars within this of his post; a guard defends this far from his; raiders go for columns this near.
  practiceRange:6,guardRadius:14,raidRadius:24,
  // Archers step back this far when a foe comes within archerClose: for at most
  // archerRetreat seconds, and no sooner than archerRetreatInterval seconds
  // after the last time, so a swordsman can close the gap (ai.js).
  archerClose:5,archerStep:6,archerRetreat:1,archerRetreatInterval:4,
  // An engaged enemy keeps his man unless another foe stands this much closer.
  stickiness:3});

// War bands (Chapters I–III; worlds and gameplay plan, release 3): the single
// raiders of an early battle share one morale, as every group does (bands.js).
export const BAND_MORALE=Object.freeze({start:80,shaken:40,broken:20,
  // Each man who falls costs `loss` ÷ the band's size; struck down from ambush, `ambush` more; the leader, `leader` more.
  loss:48,ambush:8,leader:15,
  // At a round's end: outnumbered `ratio` to one by fighters of ours, `outnumbered` less; after a whole round with no man of
  // the band within `contact` metres of a foe, `rest` more (never above the start).
  outnumbered:5,ratio:2,rest:10,contact:8,
  // Reinforcements lift it; a broken band stands again only if they lift it above the broken line.
  reinforced:15,
  // A fleeing man leaves the field this near its edge.
  edge:1.5});

// Perception (§3.10): notice per second = base × visibility × proximity ×
// (Per / 10) × (1 − Fieldcraft / 100). Proximity is 1 within `near` and falls
// to 0 at a sight radius of sightBase + Per.
export const PERCEPTION=Object.freeze({sightBase:25,near:5,run:60,walk:25,quietWalk:10,stand:10,drawn:15,
  darkness:.5,mist:.6,cover:.4,darkCloak:.8,decay:20,
  // A squad lying in wait (its order) is half as easy to see (squad-sight.js).
  lying:.5,
  // Seconds between full notice and the first move; a shout rouses his group this far.
  reaction:.4,shout:30,
  // An ambushed man traces his attacker with probability min(1, 10 / Fieldcraft); otherwise a noise within ±10 m.
  traceFieldcraft:10,noiseSpread:10,
  difficulty:Object.freeze({story:Object.freeze({notice:.7,reaction:.5}),standard:Object.freeze({notice:1,reaction:0}),
    veteran:Object.freeze({notice:1.3,reaction:-.25})})});

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

// A protected column (escorts): it halts when an enemy comes within `halt`
// metres and no friend stands within `cover` of it, and draws back toward the
// nearest friend, so it never marches into the raiders on its own.
export const ESCORT_RULES=Object.freeze({halt:8,cover:4});
// What showing each chapter capability takes, in the field's words (the camp
// lists them by name): the last battle of a chapter is won only once they are shown.
export const CAPABILITY_TASKS=Object.freeze({move:'move',strike:'strike',brace:'brace',throw:'throw a pilum',assist:'bind a comrade’s wounds or carry him',
  scout:'scout',order:'give a squad an order',formation:'order squads into a formation',rally:'rally your squads',deploy:'place your company before the advance'});
export const capabilityTasks=ids=>ids.map(id=>CAPABILITY_TASKS[id]??id).join(' and ');

// Standing orders (§3.7): four slots of {action, target}, evaluated at 4 Hz;
// the first feasible slot wins. Target words are relative to the hero.
export const STANDING=Object.freeze({
  actions:Object.freeze({attack:'Attack',guard:'Guard',follow_close:'Follow close',follow_far:'Follow far',stay_hidden:'Stay hidden',withdraw:'Withdraw',
    bind_wounds:'Bind wounds',throw_pilum:'Throw pilum',
    // Specialists' actions (from Chapter IV): with Command left unspent at a round's end.
    protect:'Guard (Protector)',inspire:'Inspire (Formation leader)',volley:'Volley (Ranged specialist)'}),
  // Which targets each action takes.
  enemyActions:Object.freeze(['attack','throw_pilum','volley']),friendActions:Object.freeze(['guard','bind_wounds','protect']),
  noTarget:Object.freeze(['follow_close','follow_far','stay_hidden','withdraw','inspire']),
  // The specialist action each standing-order word uses, and which specialism knows it.
  specialistActions:Object.freeze({protect:'guard',inspire:'inspire',volley:'volley'}),
  enemyTargets:Object.freeze(['hero_target','hero_attacker','nearest_enemy_to_hero','strongest_enemy','weakest_enemy','enemy_archers','enemy_officer']),
  friendTargets:Object.freeze(['hero','any_companion','any_ally']),
  // Leash from the hero; an attack or throw on a named enemy may reach farther.
  leash:25,leashExplicit:40,
  follow:Object.freeze({close:Object.freeze([1.5,3]),far:Object.freeze([6,10])}),
  // Bind wounds only below half Health; Withdraw only below a third of one's own.
  bindBelow:.5,withdrawBelow:1/3,
  // A guard keeps within this of whom he guards, and meets threats this near him.
  guardKeep:4,guardThreat:6,
  presets:Object.freeze({
    shieldmate:Object.freeze([['guard','hero'],['attack','hero_attacker'],['attack','hero_target'],['follow_close','hero']]),
    skirmisher:Object.freeze([['throw_pilum','nearest_enemy_to_hero'],['attack','weakest_enemy'],['follow_far','hero'],['withdraw','hero']]),
    orderly:Object.freeze([['bind_wounds','any_companion'],['bind_wounds','hero'],['follow_close','hero'],['attack','hero_attacker']]),
    // The soldier's own orders while the player controls a companion.
    soldier:Object.freeze([['attack','hero_attacker'],['attack','hero_target'],['stay_hidden','hero'],['withdraw','hero']])}),
  presetNames:Object.freeze({shieldmate:'Shieldmate',skirmisher:'Skirmisher',orderly:'Orderly',soldier:'Hold and defend'})});
