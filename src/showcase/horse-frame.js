// A horse's legs at rest, which its pose turns (actor-pose.js groundHorsePose): for each leg,
// in the game's order (fore-right, fore-left, hind-right, hind-left), the top of the leg, its
// knee and its fetlock joint, and where its hoof stands, in the horse's own metres (+Y up,
// +Z forward, the body joint 1.04 m up). The code-built horse hangs each leg straight below
// its top and bends it to stand; a generated horse brings the rest pose it was bound in
// (scripts/assets/bind-horse.py), so it stands as it was made and its legs turn from there.
// Presentation only: nothing here reaches the rules.
export const HORSE_LEGS=Object.freeze(['fore-right','fore-left','hind-right','hind-left']);
export const HORSE_BODY_Y=1.04;
// The gait's planted hoof (actor-gait.js) is the code-built horse's fetlock joint, this high.
export const HORSE_ANKLE=.075;
const freeze=v=>Object.freeze([...v]);
const distance=(p,q)=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2]);
// A segment's angle from straight down, positive toward the tail: a turn about +X.
const fromDown=(p,q)=>Math.atan2(-(q[2]-p[2]),-(q[1]-p[1]));

// The code-built horse (actor-horse.js), exactly as its pose has always solved it: each leg
// 0.53 + 0.53 m from 1.04 m, reaching at most 1.059 m and standing the body within 1.052 m.
export const CODE_HORSE_FRAME=Object.freeze({
  generated:false,motion:null,tail:freeze([0,.04,-.78]),spacing:1.08,clearance:HORSE_ANKLE,
  legs:Object.freeze(HORSE_LEGS.map((name,i)=>{
    const x=(i%2?-1:1)*.235,z=i<2?.54:-.54;
    return Object.freeze({name,fore:i<2,bend:i<2?1:-1,pivot:freeze([x,HORSE_BODY_Y,z]),knee:freeze([0,-.53,0]),fetlock:freeze([0,-.53,0]),
      a:.53,b:.53,upper0:0,knee0:0,splay0:0,pastern:null,reach:1.059,support:1.052,sling:0,rest:freeze([x,z]),centre:0});
  }))
});

/** A generated horse's frame from its rest joints (glTF metres, horse frame): legs[i] =
 * {pivot, knee, fetlock, sole} as points; tail: the tail joint from the body joint. The knee and fetlock are kept as offsets from
 * their parents, as the skeleton holds them. motion: its gaits (actor-gait.js
 * GENERATED_HORSE_MOTION), sling: how far each leg's top may sink below the body to reach,
 * centre: where each leg's stance centres along the body from its own hoof in its stride (at
 * a stand it stands on the hoof's own place). */
export function createHorseFrame({legs,tail,motion,sling=[.07,.07,.04,.04],centre=[-.05,-.05,-.18,-.18]}){
  if(!Array.isArray(legs)||legs.length!==4)throw Error('A horse frame needs four legs');
  const frameLegs=legs.map(({pivot:P,knee:K,fetlock:F,sole:S},i)=>{
    for(const point of [P,K,F,S])if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite))throw Error(`The ${HORSE_LEGS[i]} leg has no rest pose`);
    const a=distance(P,K),b=distance(K,F),upper0=fromDown(P,K);
    if(a<.1||b<.1)throw Error(`The ${HORSE_LEGS[i]} leg is too short to bend`);
    return Object.freeze({name:HORSE_LEGS[i],fore:i<2,bend:i<2?1:-1,pivot:freeze(P),knee:freeze([K[0]-P[0],K[1]-P[1],K[2]-P[2]]),fetlock:freeze([F[0]-K[0],F[1]-K[1],F[2]-K[2]]),
      a,b,upper0,knee0:fromDown(K,F)-upper0,splay0:Math.atan2(F[0]-P[0],P[1]-F[1]),
      // The leg reaches for its fetlock joint, which stands this far from where its hoof does.
      pastern:freeze([F[0]-S[0],F[1]-S[1],F[2]-S[2]]),
      reach:(a+b)*.999,support:(a+b)*.9925,sling:sling[i],rest:freeze([S[0],S[2]]),centre:centre[i]});
  });
  const fore=(frameLegs[0].pivot[2]+frameLegs[1].pivot[2])/2,hind=(frameLegs[2].pivot[2]+frameLegs[3].pivot[2])/2;
  return Object.freeze({generated:true,motion,tail:freeze(tail),spacing:fore-hind,
    // Planted, a hoof's fetlock joint stands this high: the feet's contact height (actors.js).
    clearance:frameLegs.reduce((sum,leg)=>sum+leg.pastern[1],0)/4,legs:Object.freeze(frameLegs)});
}

/** A generated horse model's frame: its rest joints, named as bind-horse.py names them,
 * and the points where its hooves stand (fore-right-sole and so on). */
export function horseFrameFromModel(scene,motion){
  scene.updateMatrixWorld(true);
  const at=name=>{let found=null;scene.traverse(o=>{if(!found&&o.name===name)found=o;});if(!found)throw Error(`The horse model has no ${name}`);
    const e=found.matrixWorld.elements;return [e[12],e[13],e[14]].map(v=>Math.round(v*1e5)/1e5);};
  const tail=at('horse-tail');tail[1]=Math.round((tail[1]-HORSE_BODY_Y)*1e5)/1e5;
  return createHorseFrame({motion,tail,legs:HORSE_LEGS.map(leg=>({pivot:at(`${leg}-leg`),knee:at(`${leg}-knee`),fetlock:at(`${leg}-fetlock`),sole:at(`${leg}-sole`)}))});
}
