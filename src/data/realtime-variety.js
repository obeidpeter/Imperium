// What the world stream varies when a real-time battle begins (worlds and gameplay
// plan, release 3; core/realtime/variety.js). One draw each, at the start only:
// the same campaign seed gives the same battle, a retry included, and another
// seed another battle. Rules as data.

const freeze=Object.freeze;

// The weather a chapter's battles may have: its own (data/expanded-campaign.js) most often, and others of its
// season and country. [weather, weight]. Chapter II keeps its mist: the marsh rescue is fought in fog, and in
// clear air the raiders reach the wounded man first. Chapter XI has no field battle.
export const FIELD_WEATHERS=freeze({
  1:freeze([['clear',3],['mist',1],['rain',1]]),
  2:freeze([['mist',1]]),
  3:freeze([['rain',3],['mist',1],['clear',1]]),
  4:freeze([['dust',3],['clear',1],['rain',1]]),
  5:freeze([['embers',3],['dust',2],['clear',1]]),
  6:freeze([['mist',2],['dust',2],['clear',1]]),
  7:freeze([['clear',3],['rain',1],['mist',1]]),
  8:freeze([['rain',3],['mist',2],['clear',1]]),
  9:freeze([['dust',3],['clear',2]]),
  10:freeze([['rain',2],['clear',2],['mist',1]]),
  12:freeze([['clear',3],['mist',1],['rain',1]])});

// How many of the nearest free tiles a field object, the hidden man of Chapter III and a reinforcement's
// entry may take instead of their own (the first of them is their own).
export const PLACES=freeze({objects:4,hidden:4,waves:4,hiddenReach:2});

// From Chapter IV a band of raiders may start lying in wait, hidden on one of the nearest free tiles to its
// place, and fall on the first of ours to come near (squad-sight.js): the chance by level, never on Story. One
// that none of ours has come near rises and joins its side's plan once one of ours nears the objective, or at
// the end of round `patience`.
export const HIDDEN_BANDS=freeze({roles:freeze(['raider']),chance:freeze({story:0,standard:.5,veteran:.75}),reach:2,patience:2});

// A band's temperament, drawn once: its morale at the start, and how keenly it watches (a factor on its notice).
export const TEMPERAMENTS=freeze({weights:freeze([['steady',2],['bold',1],['wary',1]]),
  kinds:freeze({steady:freeze({label:'steady',morale:0,notice:1}),bold:freeze({label:'bold',morale:10,notice:.9}),
    wary:freeze({label:'wary',morale:-10,notice:1.25})})});
