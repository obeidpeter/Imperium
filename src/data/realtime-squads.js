// Squads, Command, orders and morale in real time (build brief §3.4, §3.7–§3.9;
// guide "Squads", "Command", "Orders", "Formations", "Squad standing orders",
// "Morale, cohesion and suppression"). The numbers are 0.38's
// (data/battle-balance.js, core/battle.js, core/expanded-campaign.js) restated
// in metres and seconds; the phase report records where the brief chose
// differently. Rules as data: the simulation reads them, and tuning changes
// only this file.

const freeze=Object.freeze;

// How many men stand in a squad at full strength, by role. Each is one actor,
// driven by his squad (§3.4); a 0.38 unit's Health becomes the squad's
// strength, and every man stands for an equal share of it.
export const SQUAD_MEN=freeze({infantry:8,guard:8,archer:6,raider:6,cavalry:4,heavy:4,soldier:8});
// Strength a full squad of each side has in 0.38 (allies 16, enemies 10): a
// smaller unit (a reinforcement of 7) brings proportionally fewer men.
export const REFERENCE_STRENGTH=freeze({ally:16,enemy:10});
export const MIN_MEN=2;

// The squad exchange (§3.4): melee and missiles between squads resolve once a
// second as a tenth of a 0.38 turn's exchange, so a round of ten seconds deals
// what one 0.38 turn dealt. Fronts within `contact` metres are in melee.
export const EXCHANGE=freeze({everyTicks:20,scale:.1,contact:2.6,
  // 0.38 base damage of a turn's exchange when the unit names none: allies 3, enemies 4; missiles 3.
  melee:freeze({ally:3,enemy:4,player:3}),ranged:3,
  // Bows and slings reach as far as a man's own (WEAPONS); beyond `poorSight`
  // metres rain, mist and dust take 1 off (0.38: beyond two tiles).
  missileRange:freeze({archer:40,raider:22}),poorSight:20,
  // The rules' modifiers (0.38 combatBreakdown, version 2).
  frontalShield:1,brace:2,wall:2,high:1,cover:1,heightRanged:1,cohesiveWall:1,lineScreen:1,neighbour:8,
  wedgeAttack:1,wedgeExposure:1,charge:1,chargeRun:20,lowCohesion:1,suppressed:1,poorVisibility:1,barricade:1,barricadeRange:2,shaken:1,
  // A braced front that survives a frontal mounted charge strikes back, at most once a round (0.38 edition 34).
  counter:1,
  // Each second's exchange is scaled by one draw of the combat stream: [factor, weight], 1:2:4:2:1 round 1, so
  // a fight's average is the 0.38 exchange and no two seeds fight it alike (worlds and gameplay plan, release 3).
  spread:freeze([freeze([.75,1]),freeze([.9,2]),freeze([1,4]),freeze([1.1,2]),freeze([1.25,1])]),
  // A first exchange in melee against a squad that has not seen its attacker (squad-sight.js) is an ambush: a whole
  // 0.38 hit at once, its morale loss doubled, with no Brace or cohesive shield wall. A squad lying in wait springs on
  // the first enemy squad to come within `spring` metres.
  ambush:freeze({scale:1,morale:2,ignores:freeze(['Brace','Cohesive shield wall']),spring:6})});

// Morale (§3.9, guide): shaken at 40 or less, broken at 20 or less, when the
// group falls back to regroup. The soldier and his companions never break.
export const MORALE=freeze({start:80,shaken:40,broken:20,
  // Each man lost costs his squad the 0.38 hit (8, 4 more from the flank, 5 less in line).
  hit:8,flank:4,line:5,
  // A squad destroyed shakes its neighbours within `shockRange` metres (0.38 withdrawal shock).
  shock:6,shockRange:8,
  // While broken and out of contact, a squad regroups at each round boundary.
  regroup:15,restore:10,rally:20,inspire:15});
// Cohesion starts at 80; blows wear it (melee 10, missiles 6 per 0.38 hit) and
// below 40 it takes 1 off the squad's blows. At a round boundary a squad that
// held still all round (braced) restores 12, one with a friendly squad within
// 10 m restores 6, and either lifts a point of suppression. Rally restores 20
// (0.38's Rally with the expanded field rules).
export const COHESION=freeze({start:80,melee:10,ranged:6,low:40,braced:12,supported:6,supportRange:10,rally:20});
export const SUPPRESSION=freeze({max:3,ranged:1,penalty:2});

// Command (§3.8): capacity by chapter, plus one for a trained Formation leader
// in the party; refilled at each round boundary, never accumulated.
export const COMMAND=freeze({capacity:freeze({4:1,5:3,6:4,7:5,8:5,9:6,10:6,11:6,12:6}),leader:1,max:8,
  // The order delay: 1 s, less 0.05 s per point of Authority above 10, at least 0.25 s; none with Clear orders.
  delay:freeze({base:1,perAuthority:.05,min:.25})});

// Orders: what each costs and what it does. The command card's keys 1–6.
export const ORDERS=freeze({
  advance:freeze({id:'advance',name:'Advance',cost:1,summary:'March to the place, keeping the formation.'}),
  attack:freeze({id:'attack',name:'Attack',cost:1,summary:'Engage that enemy group.'}),
  hold:freeze({id:'hold',name:'Hold',cost:1,card:1,summary:'Stand fast; a whole round held braces the squad.'}),
  restore:freeze({id:'restore',name:'Restore morale',cost:1,card:2,summary:'The leader steadies his men: 10 morale, one point of suppression lifted.'}),
  withdraw:freeze({id:'withdraw',name:'Withdraw and brace',cost:1,card:3,summary:'Fall back toward you and brace.'}),
  line:freeze({id:'line',name:'Line',formation:'line',card:4,summary:'Crosses marsh at full speed, softens morale loss and screens missiles while it holds together.'}),
  'shield-wall':freeze({id:'shield-wall',name:'Shield wall',formation:'shield-wall',card:5,summary:'Two less from every frontal blow; half speed; neighbouring walls add protection.'}),
  wedge:freeze({id:'wedge',name:'Wedge',formation:'wedge',card:6,summary:'One more damage per blow on firm open ground, one more taken; no bonus in marsh, at fords or against walls.'}),
  lie_in_wait:freeze({id:'lie_in_wait',name:'Lie in wait',cost:1,card:7,summary:'Halt and keep low until an enemy comes near; one that has not seen the squad takes a whole exchange at once.'})});
export const CARD=freeze(['hold','restore','withdraw','line','shield-wall','wedge','lie_in_wait']);
// A formation order: one Command for up to three squads standing in a
// connected group, each within `join` metres of another (§3.8 join rule).
export const FORMATION_ORDER=freeze({cost:1,maxSquads:3,join:15});
export const FORMATIONS=freeze({
  line:freeze({name:'Line',march:1,marsh:1}),
  'shield-wall':freeze({name:'Shield wall',march:.5}),
  wedge:freeze({name:'Wedge',march:1}),
  column:freeze({name:'Column',march:1})});
// Metres between neighbours in each formation; a column marches two abreast.
export const SPACING=freeze({line:1.1,'shield-wall':.8,wedge:1.1,column:1.2,loose:1.6});
// A held order braces its squad after a whole round.
export const HOLD_BRACE_TICKS=200;
// Deployment (guide "Deployment"): from Chapter VII a battle opens paused and the
// company is placed in the zone the 0.38 Deploy allowed (its first four tiles).
export const DEPLOYMENT=freeze({fromChapter:7,tiles:4});

// Squad standing orders (§3.7 "Squad vocabulary"): four slots like a
// companion's, with the squad's own actions and targets.
export const SQUAD_STANDING=freeze({
  actions:freeze({advance_with_hero:'Advance with you',hold_line:'Hold the line',attack_hero_target:'Attack your target',screen_flank:'Screen a flank',
    guard_standard:'Guard the standard',withdraw_when_broken:'Withdraw when broken'}),
  targets:freeze({hero:'you',nearest_enemy_group:'the nearest enemy group',enemy_cavalry:'enemy cavalry',enemy_archers:'enemy archers'}),
  // Which actions take a target, and which targets they take.
  targetsFor:freeze({advance_with_hero:freeze(['hero']),hold_line:freeze([]),attack_hero_target:freeze(['hero']),
    screen_flank:freeze(['hero','enemy_cavalry','enemy_archers','nearest_enemy_group']),guard_standard:freeze(['hero','squad']),withdraw_when_broken:freeze(['hero'])}),
  // How far a squad keeps from the soldier it marches with, and engages from its station.
  station:freeze({front:6,flank:9,keep:4,engage:12,screen:14,guard:8,leash:40}),
  presets:freeze({
    line_of_battle:freeze([freeze(['withdraw_when_broken','hero']),freeze(['attack_hero_target','hero']),freeze(['advance_with_hero','hero']),freeze(['hold_line',null])]),
    reserve:freeze([freeze(['withdraw_when_broken','hero']),freeze(['guard_standard','hero']),freeze(['hold_line',null]),freeze(['advance_with_hero','hero'])]),
    flank_guard:freeze([freeze(['withdraw_when_broken','hero']),freeze(['screen_flank','enemy_cavalry']),freeze(['screen_flank','nearest_enemy_group']),
      freeze(['advance_with_hero','hero'])])}),
  presetNames:freeze({line_of_battle:'Line of battle',reserve:'Reserve',flank_guard:'Flank guard'})});

// The enemy's plan (squad-ai.js planDoctrine; worlds and gameplay plan, release 3):
// at the start and at round boundaries the enemy draws one from the ai stream,
// weighted by the chapter's doctrine, and keeps it at least `hold` rounds (its
// own, if it names one). A reserve plan only opens a battle. The sides are your
// squads' own: a flank attack turns the focus's left or right.
export const ENEMY_PLANS=freeze({hold:2,
  kinds:freeze({
    fix:freeze({label:'Hold you in front',summary:'The bands fix your line in place; horse and raiders seek whichever flank is nearer.'}),
    'flank-left':freeze({label:'Turn your left',summary:'Horse, raiders and a band of foot go round your left; the rest hold you in front.',side:-1}),
    'flank-right':freeze({label:'Turn your right',summary:'Horse, raiders and a band of foot go round your right; the rest hold you in front.',side:1}),
    pincer:freeze({label:'Close on both flanks',summary:'Every second band goes round a flank, the next the other.'}),
    feint:freeze({label:'Feint and draw you out',summary:'The leading band closes, then falls back to draw a squad out; the rest strike when it follows.'}),
    'early-reserve':freeze({label:'Commit the reserve early',summary:'The reserve joins the attack after the first round.',opening:true}),
    'late-reserve':freeze({label:'Hold the reserve back',summary:'The reserve waits until round 5 unless it is threatened.',opening:true,hold:4})}),
  // By the chapter's doctrine (data/command-campaign.js): [plan, weight].
  weights:freeze({
    approach:freeze([['fix',3],['flank-left',1],['flank-right',1],['pincer',1],['feint',1]]),
    pursuit:freeze([['fix',2],['flank-left',2],['flank-right',2],['pincer',1],['feint',1]]),
    screen:freeze([['fix',2],['flank-left',1],['flank-right',1],['early-reserve',2],['late-reserve',2]]),
    siege:freeze([['fix',2],['flank-left',1],['flank-right',1],['feint',1],['early-reserve',2],['late-reserve',2]]),
    pincer:freeze([['pincer',3],['flank-left',1],['flank-right',1],['fix',1],['feint',1]]),
    interdiction:freeze([['fix',2],['flank-left',2],['flank-right',2],['pincer',1],['feint',1]]),
    countercharge:freeze([['flank-left',2],['flank-right',2],['pincer',2],['feint',2],['fix',1]]),
    reserve:freeze([['late-reserve',3],['early-reserve',2],['fix',1],['pincer',1],['feint',1]])}),
  // The last round a reserve is held (unless threatened), by plan.
  reserveThrough:freeze({standard:2,'early-reserve':1,'late-reserve':4}),
  // A feint closes to `close` metres of its mark in the plan's first round, then falls back `back` metres.
  feint:freeze({close:8,back:12}),
  // How far round a flank a flanking band swings (metres beside the focus, and behind its front).
  flank:freeze({wide:9,behind:2}),
  // What each enemy band prefers to strike when the plan leaves it free, drawn once from the ai stream.
  preferences:freeze([['focus',5],['nearest',2],['archers',1],['soldier',1]]),
  preferenceRange:40});

// How the enemy's bands fight, by faction (squad-ai.js, squads.js): the plans they favour (a factor on the
// doctrine's weights), whether their archers loose an aimed volley once a round, and whether a band that holds
// its ground braces.
export const ENEMY_FACTIONS=freeze({
  gothic:freeze({plans:freeze({fix:1.5,feint:1.5}),volley:false,brace:false}),
  persian:freeze({plans:freeze({'flank-left':1.5,'flank-right':1.5,feint:1.5}),volley:true,brace:true}),
  palmyrene:freeze({plans:freeze({pincer:1.5,'flank-left':1.5,'flank-right':1.5}),volley:true,brace:false}),
  rival:freeze({plans:freeze({fix:1.5,'early-reserve':1.5,'late-reserve':1.5}),volley:true,brace:true})});
// The enemy's techniques. An aimed volley is three tenths of a 0.38 missile exchange and a point of suppression,
// once a round; a band holding its ground braces after `braceTicks` still. A shaken band with a steady one
// (morale above `steady`) within `range` falls back `behind` metres behind it and is steadied 10 at each round's
// end out of contact; a band of foot within `protect` metres of its archers meets the squad that presses them.
export const ENEMY_TECHNIQUES=freeze({volley:freeze({scale:.3,suppression:1}),braceTicks:100,
  pullBack:freeze({range:15,steady:60,behind:6}),protect:15});

// Specialists (guide "Specialists"): a companion's action for one Command.
export const SPECIALISTS=freeze({
  guard:freeze({id:'guard',path:'protector',name:'Guard',range:2,reduction:2,rounds:1,summary:'A friend within 2 m takes 2 less from every blow for a round; the protector braces.'}),
  inspire:freeze({id:'inspire',path:'leader',name:'Inspire',radius:15,morale:15,summary:'Friends within 15 m regain 15 morale and brace.'}),
  volley:freeze({id:'volley',path:'ranged',name:'Volley',range:60,perBattle:2,damage:freeze({pierce:freeze([4,9])}),
    summary:'An aimed volley at a visible enemy within 60 m with a clear line; two a battle.'})});
// Rally (the soldier's technique from Chapter VI): radius 20 m + (Authority − 10) / 2, and 5 more with Steady voice.
// In the finale's defection standoff the soldier's Rally is his oath to the rival bands: it can be
// sworn once a round, as 0.38 allowed one a turn (mission.js), instead of its usual recovery.
export const RALLY=freeze({radius:20,perAuthority:.5,steadyVoice:5,morale:20,oathRecovery_s:10});

// Our squads' men by role, before the chapter's tier (realtime-forces.js TIERS).
export const ROMAN_SQUADS=freeze({
  infantry:freeze({name:'legionary',attributes:freeze({str:13,agi:12,con:13,per:9,combat:10,field:6}),
    kit:freeze(['tunic','subarmalis','hamata','galea','bracae','caligae','cingulum','scutum','gladius']),ammo:freeze({pilum:1})}),
  archer:freeze({name:'auxiliary archer',attributes:freeze({str:11,agi:14,con:10,per:13,combat:8,field:8}),
    kit:freeze(['tunic','subarmalis','galea','caligae','bow','quiver']),ammo:freeze({arrow:16})})});
