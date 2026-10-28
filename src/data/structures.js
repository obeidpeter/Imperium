// The field's structures in real time as data (worlds and gameplay plan,
// release 4): towers, fortified gates, ramparts with their ditches, and bridges.
// fortifications.js builds them from battle-structures.js; sight, combat,
// movement and the squads' exchanges read these numbers and hard-code none.
// Heights are metres above the field; work is counted in work actions.
const freeze=Object.freeze;

export const STRUCTURES=freeze({
  // A tower's deck stands at the curtain's height, reached by a stair at half of it.
  // From the deck a man sees 15 m further (perception) and throws or shoots 30% further
  // (any other rise gives the 20% of combat.js's downhill rule).
  tower:freeze({deck:3.2,stair:1.6,sight:15,range:1.3}),
  // A fortified gate: 100 integrity, and closing it bars it for 20 more. A gate held
  // by the other side is battered instead of opened: 15 a work action by hand, twice
  // that with a ram (an engineer detail within 8 m, or the company's engineering).
  // At 0 the gate is a breach, slow rubble like a breached wall.
  gate:freeze({integrity:100,bar:20,batter:15,ram:2}),
  // A rampart is an earth bank 1.2 m high with a breastwork along its face; the ditch
  // before it is 0.4 m deep and slow. From the ditch the rampart's top is 1.6 m up:
  // a man can climb it, but its defenders hold higher ground. Behind the breastwork a
  // squad takes 2 less in an exchange, as on 0.38's wall tile, and a missile from beyond
  // the face loses 10 Attack.
  rampart:freeze({height:1.2,squad:2,missile:10}),
  ditch:freeze({depth:-.4}),
  // Demolishing a repaired bridge: two work actions, one with engineers. Its crossing is
  // deep water again, for both armies.
  bridge:freeze({demolish:2})
});
// The heights a saved map may carry (validate.js): ditch, rampart, stair, deck.
export const STRUCTURE_HEIGHTS=freeze([STRUCTURES.ditch.depth,STRUCTURES.rampart.height,STRUCTURES.tower.stair,STRUCTURES.tower.deck]);
