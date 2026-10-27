// Where each battle's structures stand (worlds and gameplay plan, release 4), on
// the tiles of its 0.38 board; fortifications.js resolves them onto the battle's
// 2.5 m map through its layout.
// - A tower takes the end of its tile's curtain toward `at`, and its stair the cell
//   beside the deck toward `stair`: the side that holds it.
// - A breach opens the middle of its tile's curtain, worked from the `approach` side.
// - A rampart runs along the `face` edge of its tiles, its ditch in the next cells
//   beyond, and leaves every road open as a causeway. A ditch alone runs the same way.
// - `gates` says who holds the field's fortified gates: null (whoever closes one),
//   or 'enemy' (closed, barred and battered from your side).
// A battle listed here gets exactly these works. A battle that is not, such as a
// labelled test field, keeps fortifications.js's generic engineering position.
const freeze=o=>Object.freeze(Array.isArray(o)?o.map(freeze):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,freeze(v)])):o);

export const BATTLE_STRUCTURES=freeze({
  // Chapter IV, the Danube fort: two towers flank the gate passage on the garrison's
  // side, and a ditch runs before the timber curtain, with a causeway at the gate.
  'ch4-gate':{towers:[{tile:[3,2],at:'south',stair:'west'},{tile:[3,4],at:'north',stair:'west'}],
    ditches:[{tiles:[[3,0],[3,1],[3,2],[3,4],[3,5],[3,6]],face:'east'}]},
  // The threatened wall sector: free-standing lengths of curtain, nothing more.
  'ch4-wall':{},
  // Chapter V, the fortress on the Euphrates: towers hold the outer wall at its gate.
  // The countermine and the siege ramp are the chapter's own works (fortifications.js).
  'ch5-mine':{towers:[{tile:[4,2],at:'south',stair:'west'},{tile:[4,4],at:'north',stair:'west'}]},
  'ch5-wall':{towers:[{tile:[4,2],at:'south',stair:'west'},{tile:[4,5],at:'north',stair:'west'}]},
  // Chapter VI, the wells: a walled caravan court, nothing to man.
  'ch6-wells':{},
  // Chapter VIII: the ferry's side gate; the bridgehead east of the river holds a rampart
  // and ditch facing the enemy, with the road through as its causeway.
  'ch8-ferry':{},
  'ch8-crossing':{ramparts:[{tiles:[[5,2],[5,3],[5,4],[5,5]],face:'east'}]},
  'ch9-wing':{},
  // Chapter IX, the city: towers flank its gate passage on the defenders' side, a weak
  // length of the north wall can be breached, and the side gate is barred against you.
  'ch9-city':{towers:[{tile:[4,2],at:'south',stair:'east'},{tile:[4,4],at:'north',stair:'east'}],
    breach:{tile:[4,1],approach:'west'},gates:{holder:'enemy'}},
  // Chapter XII, Rome: the circuit of walls begun under Aurelian in 271 and the towers
  // of its gate, a weak length of curtain to breach, and the side gate barred by the
  // claimant's men.
  'ch12-confrontation':{towers:[{tile:[5,2],at:'south',stair:'east'},{tile:[5,4],at:'north',stair:'east'}],
    breach:{tile:[5,1],approach:'west'},gates:{holder:'enemy'}}
});
