// Original authored joint keyframes. Values are offsets from the neutral rig,
// in radians/metres. No captured motion, world translation or gameplay state.
const zero=Object.freeze({});
const key=(t,value)=>Object.freeze({t,value:Object.freeze(value)});
const contact=230/620,release=310/620;
export const ACTOR_CLIPS=Object.freeze({
  idle:[key(0,zero),key(.24,{headY:.035,bodyZ:.008}),key(.53,{headX:-.018,headY:.012,bodyY:-.012}),key(.76,{headY:-.025,bodyZ:-.006}),key(1,zero)],
  walk:[key(0,{bodyY:0,bodyZ:.025,rightArmX:0,leftArmX:0}),key(.14,{bodyY:.05,bodyZ:.012,rightArmX:.19,leftArmX:-.10,headY:-.018}),key(.27,{bodyY:.055,bodyZ:-.003,rightArmX:.24,leftArmX:-.12,headY:-.025}),key(.5,{bodyY:0,bodyZ:-.025}),key(.73,{bodyY:-.055,bodyZ:0,rightArmX:-.24,leftArmX:.12,headY:.025}),key(1,{bodyY:0,bodyZ:.025})],
  attack:[key(0,zero),key(.13,{bodyY:-.20,bodyX:.035,hipZ:-.015,headY:.13,rightArmX:-.9,rightArmY:-.15,rightArmZ:.10,rightElbow:-.45,leftArmX:-.12,leftElbow:-.08}),key(.25,{bodyY:-.42,bodyX:.075,hipY:-.02,hipZ:-.025,hipX:-.018,headY:.2,headX:-.025,rightArmX:-2.05,rightArmY:-.22,rightArmZ:.18,rightElbow:-.85,leftArmX:-.25,leftElbow:-.15,backZ:-.095,skirt:-.035}),key(contact,{bodyY:.2,bodyX:-.12,hipY:-.042,hipZ:.12,hipX:.012,headY:-.08,rightArmX:-1.24,rightElbow:.28,rightWrist:.03,leftArmX:-.25,leftElbow:-.15,shieldTilt:-.12,frontZ:.19,backZ:-.095,skirt:.045}),key(.48,{bodyY:.26,bodyX:-.10,hipY:-.04,hipZ:.13,headY:-.055,rightArmX:-1.08,rightArmY:.16,rightElbow:.18,rightWrist:.08,leftArmX:-.22,leftElbow:-.14,shieldTilt:-.10,frontZ:.19,backZ:-.08,skirt:.04}),key(.73,{bodyY:.06,bodyX:-.02,hipZ:.04,hipY:-.015,rightArmX:-.45,rightElbow:-.18,leftArmX:-.10,frontZ:.07,frontY:.025}),key(1,zero)],
  throw:[key(0,zero),key(.18,{bodyY:-.22,bodyX:.04,hipZ:-.02,headY:.14,rightArmX:-1.1,rightArmY:-.20,rightArmZ:.14,rightElbow:-.5,leftArmX:-.15,backZ:-.05}),key(.32,{bodyY:-.42,bodyX:.075,hipY:-.02,hipZ:-.025,hipX:-.018,headY:.2,headX:-.025,rightArmX:-2.23,rightArmY:-.4,rightArmZ:.18,rightElbow:-.85,leftArmX:-.25,leftElbow:-.15,backZ:-.095}),key(release,{bodyY:.2,bodyX:-.12,hipY:-.042,hipZ:.12,hipX:.012,headY:-.08,rightArmX:-1.6,rightArmY:.13,rightElbow:.28,rightWrist:-.12,leftArmX:-.25,leftElbow:-.15,shieldTilt:-.12,frontZ:.19,backZ:-.095,skirt:.045}),key(.64,{bodyY:.29,bodyX:-.16,hipZ:.14,hipY:-.045,rightArmX:-1.02,rightArmY:.19,rightElbow:.26,rightWrist:.1,leftArmX:-.2,frontZ:.19,backZ:-.07,skirt:.04}),key(.83,{bodyY:.09,bodyX:-.04,hipZ:.05,rightArmX:-.38,rightElbow:-.12,frontZ:.08,frontY:.025}),key(1,zero)],
  speech:[key(0,zero),key(.16,{headX:-.035,bodyY:.025,rightArmX:-.42,rightArmZ:.1,rightElbow:-.32,rightWrist:-.09}),key(.32,{headX:-.07,headY:-.04,bodyY:.08,rightArmX:-.92,rightArmZ:.18,rightElbow:-.48,rightWrist:-.18}),key(.48,{headX:-.045,headY:.025,bodyY:.055,rightArmX:-.73,rightArmZ:.22,rightElbow:-.32,rightWrist:-.08}),key(.63,{headX:-.06,bodyY:.09,rightArmX:-.94,rightArmZ:.13,rightElbow:-.40,rightWrist:-.16}),key(.81,{bodyY:.03,rightArmX:-.35,rightElbow:-.22}),key(1,zero)],
  conversation:[key(0,zero),key(.22,{headY:.06,headX:.025,bodyY:.025,rightArmX:-.20,rightElbow:-.18}),key(.43,{headX:-.035,headY:.035,rightArmX:-.38,rightArmZ:.10,rightElbow:-.28}),key(.65,{headX:.015,headY:-.025,rightArmX:-.16,rightElbow:-.11}),key(1,zero)],
  horseIdle:[key(0,zero),key(.20,{neckPitch:.016,tail:.025}),key(.43,{neckPitch:-.009,tail:-.05}),key(.68,{neckPitch:.010,tail:.035}),key(.85,{neckPitch:-.007,tail:.01}),key(1,zero)],
  horseStrike:[key(0,zero),key(.20,{bodyPitch:.012,neckPitch:-.015}),key(contact,{bodyPitch:-.027,neckPitch:.065,tail:.035}),key(.55,{bodyPitch:-.026,neckPitch:.070,tail:.025}),key(.77,{bodyPitch:-.008,neckPitch:.020}),key(1,zero)],
  brace:[key(0,zero),key(.13,{hipY:-.025,bodyX:-.025,leftArmX:-.2,leftElbow:-.18,frontZ:.045,backZ:-.035}),key(.28,{hipY:-.075,bodyX:-.075,leftArmX:-.5,leftElbow:-.45,shieldTilt:-.08,frontZ:.14,backZ:-.11,rightElbow:-.4}),key(1,{hipY:-.075,bodyX:-.075,leftArmX:-.5,leftElbow:-.45,shieldTilt:-.08,frontZ:.14,backZ:-.11,rightElbow:-.4})],
  hurt:[key(0,{weight:0}),key(.12,{weight:1}),key(.31,{weight:.72}),key(.61,{weight:.25}),key(1,{weight:0})],
  block:[key(0,{weight:0}),key(.09,{weight:1}),key(.23,{weight:.77}),key(.47,{weight:.23}),key(1,{weight:0})]
});
for(const frames of Object.values(ACTOR_CLIPS))Object.freeze(frames);
const clamp=x=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
export function sampleActorClip(name,phase){
  const frames=ACTOR_CLIPS[name];if(!frames)return {};
  const p=clamp(phase);let i=1;while(i<frames.length-1&&frames[i].t<p)i++;
  const a=frames[i-1],b=frames[i],v=clamp((p-a.t)/(b.t-a.t)),t=v*v*(3-2*v),result={};
  for(const field of new Set([...Object.keys(a.value),...Object.keys(b.value)]))result[field]=(a.value[field]??0)+((b.value[field]??0)-(a.value[field]??0))*t;
  return result;
}
export function applyActorClip(pose,name,phase,weight=1){
  const values=sampleActorClip(name,phase),w=clamp(weight);
  for(const [field,value]of Object.entries(values)){
    const arm=/^(left|right)Arm([XYZ])$/.exec(field);
    if(arm)pose[arm[1]+'Arm']['XYZ'.indexOf(arm[2])]+=value*w;
    else if(field==='frontZ'||field==='backZ')pose.feet[field==='frontZ'?0:1].z+=value*w;
    else if(field==='frontY')pose.feet[0].y+=value*w;
    else if(typeof pose[field]==='number')pose[field]+=value*w;
  }
  return pose;
}
