// Procedural keyposes for the existing painted facings, not authored bitmap
// animation frames. Coordinates use the atlas's 192×256 cell and foot line 240.
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,finite(n)));
const ease=t=>t*t*(3-2*t);
const blend=(a,b,t)=>a+(b-a)*t;
const rest=()=>({hip:0,lean:0,arm:0,reach:0,lift:0,guard:0,nod:0,left:0,right:0,leftLift:0,rightLift:0});
// time, weight drop, torso pitch, weapon/gesture rotation, reach, hand lift,
// guard compression, head acknowledgement. Every action returns to rest.
const keys={
  attack:[[0,0,0,0,0,0,0,0],[.22,2,-.055,-.32,-3,-3,.1,-.02],[.46,1,.095,.56,8,-3,.25,.015],[.64,2,.045,.18,3,0,.15,0],[1,0,0,0,0,0,0,0]],
  throw:[[0,0,0,0,0,0,0,0],[.3,1,-.065,-.5,-6,-8,.1,-.025],[.54,0,.075,.48,9,-8,0,.02],[.72,2,.04,.17,4,-2,0,0],[1,0,0,0,0,0,0,0]],
  brace:[[0,0,0,0,0,0,0,0],[.24,4,-.025,-.08,-1,-2,.65,-.04],[.55,5,-.055,-.12,-2,-1,1,-.03],[.76,3,-.03,-.04,0,0,.55,-.01],[1,0,0,0,0,0,0,0]],
  hit:[[0,0,0,0,0,0,0,0],[.2,3,-.095,-.13,-3,1,.55,-.07],[.48,5,-.06,-.07,-1,0,.4,-.025],[.76,1,.012,0,0,0,.15,.01],[1,0,0,0,0,0,0,0]],
  speak:[[0,0,0,0,0,0,0,0],[.23,0,-.015,-.18,-1,-4,0,-.03],[.49,0,.035,.28,5,-7,0,.035],[.7,0,.012,.15,3,-3,0,-.01],[1,0,0,0,0,0,0,0]]
};
function sampleKeys(table,p){
  const i=Math.max(0,table.findIndex(row=>row[0]>=p)-1),a=table[i],b=table[Math.min(i+1,table.length-1)],t=ease(clamp((p-a[0])/(b[0]-a[0]||1)));
  return Object.fromEntries(['hip','lean','arm','reach','lift','guard','nod'].map((key,j)=>[key,blend(a[j+1],b[j+1],t)]));
}
export function sampleSpritePose(override={},profile={}){
  const name=override.pose??'idle',p=clamp(override.progress),mounted=!!profile.mounted,civic=!!profile.civic;
  const pose={...rest(),rootY:0,active:false};
  if(['walk','run','cavalry-move','retreat'].includes(name)){
    // Distance-phase supplied by the timeline synchronizes footfalls with the
    // visual path. Isolated previews use complete cycles and ease to rest.
    const phase=finite(override.stridePhase,p*Math.PI*(name==='run'?6:4)),weight=ease(clamp(Math.min(p,1-p)*10));
    const stride=Math.sin(phase),pace=mounted?8:name==='run'?9:6,robe=civic?.45:1;
    pose.left=stride*pace*weight*robe;pose.right=-pose.left;
    pose.leftLift=Math.max(0,stride)*weight*(mounted?7:name==='run'?7:5)*robe;
    pose.rightLift=Math.max(0,-stride)*weight*(mounted?7:name==='run'?7:5)*robe;
    pose.hip=(1-Math.cos(phase*2))*weight*(mounted?-1.8:1.1);
    pose.lean=weight*(name==='run'?.034:mounted?.016:.008);
    pose.arm=-stride*weight*(civic?.025:.07);pose.guard=stride*weight*.06;
    pose.nod=-Math.sin(phase*2)*weight*.012;pose.active=weight>0;
  }else{
    const key=name==='cavalry-attack'?'attack':['rally','order','formation'].includes(name)?'speak':name==='hurt'?'hit':name;
    if(keys[key]){Object.assign(pose,sampleKeys(keys[key],p));pose.active=p>0&&p<1;
      if(profile.archer&&name==='throw'){pose.arm*=.45;pose.reach*=.8;pose.lift*=.7;}
      if(mounted){pose.hip*=.35;pose.lean*=.6;}
    }else{pose.rootY=clamp(override.bob,-2,2)*256/72;pose.lean=clamp(override.lean,-.06,.06);}
  }
  if(profile.braced&&name!=='hit'&&name!=='hurt'){pose.guard=Math.max(pose.guard,.3);pose.hip+=1;}
  return pose;
}

// One continuous mesh: each original texel belongs to one triangle. Adjacent
// pieces share vertices, so gestures never leave an unmoved painted limb behind.
// The sparse grid concentrates rows at shoulders, hips, knees and ankles.
const columns=[0,48,96,144,192],rows=[0,55,112,168,208,256];
export function spriteMesh(pose,profile={}){
  const direction=profile.direction===-1?-1:1,hand=profile.hand===1?1:-1,mounted=!!profile.mounted;
  const vertices=[];
  for(const y of rows)for(const x of columns){
    const side=x<96?-1:x>96?1:0,leg=side<0?pose.left:pose.right,lift=side<0?pose.leftLift:pose.rightLift;
    const legStart=mounted?196:168,legWeight=clamp((y-legStart)/(240-legStart)),lateral=clamp(Math.abs(x-96)/38);
    const upper=1-clamp((y-150)/90),armWeight=clamp((Math.abs(x-96)-16)/32)*(1-clamp((y-160)/45));
    let dx=direction*pose.lean*(240-y)*upper,dy=pose.hip*upper;
    // A foot in stance stays on the ground; only the swing foot lifts. Hip and
    // knee travel absorb the body weight rather than bouncing the entire stamp.
    dx+=direction*leg*legWeight*lateral;dy-=lift*legWeight*lateral;
    if(side){
      const weapon=side===hand,turn=weapon?pose.arm*(profile.spear?direction:-direction):pose.guard*direction*.1;
      const ax=96+side*28,ay=mounted?66:72,rx=x-ax,ry=y-ay,angle=turn*armWeight;
      dx+=(Math.cos(angle)*rx-Math.sin(angle)*ry-rx)*armWeight;
      dy+=(Math.sin(angle)*rx+Math.cos(angle)*ry-ry)*armWeight;
      if(weapon){dx+=direction*pose.reach*armWeight;dy+=pose.lift*armWeight;}
      else {dx-=direction*pose.guard*3*armWeight;dy-=pose.guard*3*armWeight;}
    }
    // Counter-rotation at the neck keeps a nod distinct from the arm gesture.
    const head=(1-clamp((y-35)/32))*(1-clamp(Math.abs(x-96)/55));
    dx+=pose.nod*(55-y)*head;dy+=Math.abs(pose.nod)*7*head;
    // Soft displacement limits keep sparse shoulder triangles from folding and
    // preserve the marker/occlusion footprint even at the strongest keypose.
    vertices.push({x,y,dx:28*Math.tanh(finite(dx)/28),dy:18*Math.tanh(finite(dy)/18)});
  }
  const triangles=[];
  for(let row=0;row<rows.length-1;row++)for(let col=0;col<columns.length-1;col++){
    const a=row*columns.length+col,b=a+1,c=a+columns.length,d=c+1;
    triangles.push([a,b,c],[b,d,c]);
  }
  return {vertices,triangles};
}
