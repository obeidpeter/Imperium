// The landmarks' code-built silhouettes at the middle distance (worlds and gameplay plan,
// release 9): closed volumes in the horizon's distant, fogged vertex-colour batch, one builder
// for each kind in LANDMARK_LAYOUT (world-layouts.js). They stand in for the generated models
// until those exist, on Performance and if a download fails. Each is laid out in a frame turned
// by quarter turns to face the board, so the horizon's axis-aligned boxes stay exact. Sizes are
// in metres, kept modest: at 115 to 250 metres they read as outlines. Presentation only.

export const LANDMARK_KINDS=Object.freeze(['gate','tower','ruined tower','mound','stilts','piers','quay','station','temple','court temple','ruin',
  'citadel','tombs','tomb tower','bridge','walls','ring','tetrapylon','villa','hall','aqueduct','arena','rotunda','arch','mausoleum']);
/** The footprint (width along the frame's right, depth toward the board) each kind's
 * foundation takes: its stand-in's whole extent, which a test holds it to. */
const FOOTPRINTS={gate:[36,7],tower:[26,7],'ruined tower':[11,8],mound:[19,19],stilts:[7,6],piers:[31,8],quay:[26,11],station:[23,17],temple:[19,12],
  'court temple':[30,25],ruin:[13,11],citadel:[34,27],tombs:[28,8],'tomb tower':[6,6],bridge:[36,6],walls:[47,5],ring:[18,18],tetrapylon:[37,10],
  villa:[23,19],hall:[29,13],aqueduct:[28,2],arena:[42,35],rotunda:[22,35],arch:[19,9],mausoleum:[36,36]};

/** Each kind's stand-in height in metres: a generated model at its slot is scaled to it. */
export const LANDMARK_HEIGHTS=Object.freeze({gate:12.8,tower:10.3,'ruined tower':6.2,mound:4.3,stilts:7.15,piers:6.2,quay:8.4,station:8.3,temple:13,
  'court temple':11.6,ruin:3.2,citadel:15.3,tombs:10,'tomb tower':15.4,bridge:6.5,walls:10.8,ring:3.2,tetrapylon:10.2,villa:6.4,hall:12.7,aqueduct:8.3,
  arena:23.5,rotunda:19.5,arch:19,mausoleum:24});
/** The footprint a kind's foundation takes, for a generated model in its place. */
export const landmarkFootprint=kind=>FOOTPRINTS[kind];
/** The kinds that belong at a river: across it (a bridge and its piers) or on its near bank,
 * their front to the water (a quay). Where a horizon has no river, a bridge has a stream. */
export const LANDMARK_WATER=Object.freeze({piers:'across',bridge:'across',quay:'bank'});
// The quarter turn nearest a facing (a rotation about y, as a model's: local +z looks along it):
// right (local +u) and forward (local +v) in the horizon's x and z.
const frame=yaw=>{const q=((Math.round(yaw/(Math.PI/2))%4)+4)%4;return {q,r:[[1,0],[0,-1],[-1,0],[0,1]][q],f:[[0,1],[1,0],[0,-1],[-1,0]][q]};};
/** Builds one kind at (cx, cz), turned by quarter turns to face `yaw` (by default the board's
 * centre); returns its foundation height. */
export function buildLandmarkStandIn(kind,{cx,cz,yaw=Math.atan2(-cx,-cz),box,triangle,foundation,tint}){
  if(!FOOTPRINTS[kind])throw new Error(`Unknown landmark kind ${kind}`);
  const {q,r,f}=frame(yaw);
  const at=(u,v)=>[cx+u*r[0]+v*f[0],cz+u*r[1]+v*f[1]];
  const [fw,fd]=FOOTPRINTS[kind],base=q%2?foundation(cx,cz,fd,fw):foundation(cx,cz,fw,fd),c=tint(cx,cz,base,.03);
  const shade=k=>c.clone().multiplyScalar(k),dark=shade(.55),roofTone=shade(.86);
  // A box in the frame: u across, v toward the board, y up from the foundation.
  const B=(u,y,v,w,h,d,color=c)=>{const [x,z]=at(u,v);q%2?box(x,base+y,z,d,h,w,color):box(x,base+y,z,w,h,d,color);};
  const P=(u,y,v)=>{const [x,z]=at(u,v);return [x,base+y,z];};
  // The horizon's triangle() takes its corners clockwise seen from outside (it reverses them
  // for the front face). Every frame is a rotation, so a winding right in one is right in all.
  // A gabled roof over a w x d block whose eaves are at y, ridge along u.
  const roof=(u,y,v,w,d,rise,color=roofTone)=>{
    const a=P(u-w/2,y,v-d/2),b=P(u+w/2,y,v-d/2),c1=P(u+w/2,y,v+d/2),d1=P(u-w/2,y,v+d/2),t1=P(u-w/2,y+rise,v),t2=P(u+w/2,y+rise,v);
    for(const [p1,p2,p3] of [[a,b,t2],[a,t2,t1],[d1,t1,t2],[d1,t2,c1],[a,t1,d1],[b,c1,t2]])triangle(p1,p2,p3,color);
  };
  // A round drum or dome of n sides at (u, v), from y up h.
  const drum=(u,y,v,radius,h,color=c,n=16,top=true)=>{
    const [x,z]=at(u,v);
    for(let i=0;i<n;i++){
      const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,p0=[x+Math.cos(a0)*radius,base+y,z+Math.sin(a0)*radius],p1=[x+Math.cos(a1)*radius,base+y,z+Math.sin(a1)*radius];
      const lit=color.clone().multiplyScalar(.9+.12*Math.cos(a0-.8));
      const t0=[p0[0],p0[1]+h,p0[2]],t1=[p1[0],p1[1]+h,p1[2]];
      triangle(p0,p1,t1,lit);triangle(p0,t1,t0,lit);
      if(top)triangle([x,base+y+h,z],t0,t1,color.clone().multiplyScalar(1.04));
    }
  };
  const dome=(u,y,v,radius,h,color=c,n=16,rings=4)=>{
    const [x,z]=at(u,v);
    for(let k=0;k<rings;k++){
      const e0=k/rings*Math.PI/2,e1=(k+1)/rings*Math.PI/2,r0=Math.cos(e0)*radius,r1=Math.cos(e1)*radius,y0=base+y+Math.sin(e0)*h,y1=base+y+Math.sin(e1)*h;
      for(let i=0;i<n;i++){
        const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,lit=color.clone().multiplyScalar(.88+.1*k/rings+.08*Math.cos(a0-.8));
        const p=(rr,yy,aa)=>[x+Math.cos(aa)*rr,yy,z+Math.sin(aa)*rr];
        triangle(p(r0,y0,a0),p(r0,y0,a1),p(r1,y1,a1),lit);if(k<rings-1)triangle(p(r0,y0,a0),p(r1,y1,a1),p(r1,y1,a0),lit);
      }
    }
  };
  // An upright prism on a convex outline of [u, v] points, listed clockwise seen from above.
  const prism=(points,y,h,color=c)=>{
    const low=points.map(([u,v])=>P(u,y,v)),high=points.map(([u,v])=>P(u,y+h,v));
    for(let i=0;i<points.length;i++){const j=(i+1)%points.length;triangle(low[i],low[j],high[j],color);triangle(low[i],high[j],high[i],color);}
    for(let i=1;i<points.length-1;i++)triangle(high[0],high[i],high[i+1],color);
  };
  const tower=(u,v,w,h,y=0)=>{B(u,y,v,w,h,w);B(u,y+h,v,w+.6,.7,w+.6);for(const s of [-1,1])for(const t of [-1,0,1])B(u+t*w*.34,y+h+.7,v+s*w*.42,.8,1.1,.8);};
  const colonnade=(u,v,count,spacing,h,depth=0)=>{for(let i=0;i<count;i++)B(u+(i-(count-1)/2)*spacing,0,v,.7,h,.7);B(u,h,v,count*spacing,.9,1.2+depth);};
  switch(kind){
    case 'gate':
      // Two towers either side of an arched passage, and a stretch of curtain each way.
      for(const s of [-1,1]){tower(s*5,0,5.6,11);B(s*13,0,0,10,6.5,2.2);}
      B(0,0,0,4.4,8,5);B(0,0,1.6,2.6,4.8,2,dark);break;
    case 'tower':tower(0,0,5.8,8.5);B(8,0,0,10,2.3,1.3);break;
    case 'ruined tower':
      // Broken at different heights, a spill of stone below the gap.
      B(-1.7,0,0,2.4,6.2,5.6);B(1.4,0,0,3,3.6,5.6);B(0,0,-1.8,5.6,4.8,2);B(3.6,0,2.8,3,.9,2.4,shade(.9));break;
    case 'mound':dome(0,-.3,0,9.5,4.6,shade(1.02),14,4);break;
    case 'stilts':
      for(const u of [-2.6,0,2.6])for(const v of [-2,2])B(u,0,v,.3,2.2,.3,dark);
      B(0,2.2,0,7,.35,5.2);B(0,2.55,0,5.4,2.4,4);roof(0,4.95,0,6.2,4.8,2.2);break;
    case 'piers':
      // Stone piers in a line across the stream, pointed against the current both ways, with
      // the springing of their arches on top. One span still stands; the rest of the deck is gone.
      for(let i=0;i<5;i++){
        const u=(i-2)*6.6;B(u,0,0,2.8,5,4.4);
        prism([[u-1.4,2.2],[u+1.4,2.2],[u,3.6]],0,5);prism([[u-1.4,-2.2],[u,-3.6],[u+1.4,-2.2]],0,5);
        B(u,5,0,4.4,.7,4.4,shade(.9));
      }
      B(-9.9,5,0,2.4,.7,4.4,shade(.9));B(-9.9,5.7,0,11,.5,4.6,shade(.94));break;
    case 'quay':B(0,0,2.5,26,1.2,4.5,shade(.92));B(0,1.2,-1.5,20,4.6,6.5);roof(0,5.8,-1.5,21,7.2,2.6);for(const u of [-6,0,6])B(u,1.2,1.9,2.2,3,.3,dark);break;
    case 'station':
      // A courtyard with its ranges and a small watchtower at one corner.
      B(0,0,-6,22,3.6,4);roof(0,3.6,-6,22.4,4.6,1.8);for(const s of [-1,1]){B(s*9,0,1,4,3.2,10);roof(s*9,3.2,1,4.4,10.4,1.4);}
      B(-4,0,6.5,10,2.2,1);B(6,0,6.5,6,2.2,1);tower(9,6.5,3.2,6.5);break;
    case 'temple':
      B(0,0,0,18,1.4,11);colonnade(0,4.6,6,2.8,7);colonnade(0,-4.6,6,2.8,7);B(0,8.4,0,19,1.1,12);roof(0,9.5,0,19,12,3.5);break;
    case 'court temple':
      // A temple in a walled, porticoed court, its gate toward the board.
      B(0,0,-3,14,1.4,9);colonnade(0,.6,5,2.8,6.2);B(0,1.4,-4,11,6.2,6);B(0,7.6,-3,15,1,10);roof(0,8.6,-3,15,10,3);
      for(const s of [-1,1]){B(s*14.5,0,0,1,4.2,24);B(s*8.5,0,11.5,11,4.2,1);}B(0,0,-11.5,30,4.2,1);B(0,0,11.5,5,6,2);break;
    case 'ruin':{
      // Roofless, scorched walls with gaps, a fallen beam across.
      const scorched=shade(.62);
      B(-6,0,0,1,3.2,10,scorched);B(6,0,1,1,2.1,8,scorched);B(-1,0,-5,9,2.8,1,scorched);B(3,0,5,5,1.4,1,scorched);B(0,1,0,9,.4,.4,shade(.45));break;}
    case 'citadel':
      // Walls and towers on a raised outcrop above the river.
      B(0,0,0,34,3.5,27,shade(.95));for(const s of [-1,1]){B(s*14,3.5,0,1.5,6,22);tower(s*14,10.5,4.5,10,3.5);tower(s*14,-10.5,4.5,10,3.5);}
      B(0,3.5,10.5,26,6,1.5);B(0,3.5,-10.5,26,6,1.5);B(0,3.5,0,10,9,8);break;
    case 'tombs':
      // A cliff face with dark doorways cut into it, one carved front larger than the rest.
      B(0,0,-1.5,28,10,5,shade(.96));for(const u of [-10,-5,4,9])B(u,2.4,1.05,1.6,2.6,.2,dark);B(-.5,1.2,1.1,4,5.6,.3,shade(1.06));B(-.5,1.5,1.3,1.8,3.2,.2,dark);break;
    case 'tomb tower':B(0,0,0,5.4,1.6,5.4);B(0,1.6,0,4.4,13,4.4);B(0,14.6,0,4.9,.8,4.9);B(0,3.6,2.22,1.1,1.8,.1,dark);break;
    case 'bridge':
      // A deck on six stone arches: the piers, the spandrels and the parapet.
      for(let i=0;i<7;i++)B((i-3)*5.6,0,0,1.8,4.8,5.4);
      for(let i=0;i<6;i++){B((i-2.5)*5.6,3.4,0,3.8,1.4,5.4);}B(0,4.8,0,36,.9,5.6);for(const s of [-1,1])B(0,5.7,s*2.55,36,.8,.4,shade(.9));break;
    case 'walls':
      for(let i=0;i<5;i++)tower((i-2)*10.5,0,3.6,9);for(let i=0;i<4;i++)B((i-1.5)*10.5,0,0,7,7,2.4);break;
    case 'ring':
      // Circles of low stones and stumps of columns, the sanctuary's roofs long gone.
      for(let i=0;i<18;i++){const a=i/18*Math.PI*2;B(Math.cos(a)*8.5,0,Math.sin(a)*8.5,.9,.9+(i%3)*.25,.9);}
      for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3;B(Math.cos(a)*4,0,Math.sin(a)*4,.8,2.2+(i%2),.8,shade(.9));}break;
    case 'tetrapylon':
      // Four pylons at a crossing, colonnades running from it along the street.
      for(const su of [-1,1])for(const sv of [-1,1])B(su*3.4,0,sv*3.4,2.6,9,2.6);B(0,9,0,9.4,1.2,9.4);
      for(const s of [-1,1]){colonnade(s*13,-3.4,4,2.6,6);colonnade(s*13,3.4,4,2.6,6);}break;
    case 'villa':
      // The house's ranges round a court, a portico along its front.
      B(0,0,-6,22,4.4,6);roof(0,4.4,-6,22.4,6.4,2);for(const s of [-1,1]){B(s*9,0,2,4,3.6,10);roof(s*9,3.6,2,4.4,10.4,1.6);}colonnade(0,6.5,8,1.9,3.2);break;
    case 'hall':
      // A basilica: aisles either side of a taller nave with its clerestory.
      B(0,0,0,28,6.5,12);B(0,6.5,0,28,4,6);roof(0,10.5,0,28.4,6.4,2.2);for(const s of [-1,1])roof(0,6.5,s*4.6,28.2,3,.9);B(0,0,6.3,4,5,.4,dark);break;
    case 'aqueduct':
      for(let i=0;i<8;i++){B((i-3.5)*3.5,0,0,1.25,8,1.25);B((i-3.5)*3.5,7.4,0,3.5,.9,1.55);B((i-3.5)*3.5,6.5,0,2.25,.9,1.3);B((i-3.5)*3.5,5.9,0,1.7,.6,1.3);}break;
    case 'arena':{
      // Four storeys of arcades round an oval, in bands darker where the arches open, and the
      // seating falling inward from the top of the wall to the arena's own wall.
      const oval=a=>at(Math.cos(a)*21,Math.sin(a)*17.5),inner=a=>at(Math.cos(a)*13,Math.sin(a)*9.5);
      for(let i=0;i<24;i++){
        const a0=i/24*Math.PI*2,a1=(i+1)/24*Math.PI*2,[x0,z0]=oval(a0),[x1,z1]=oval(a1),[i0,j0]=inner(a0),[i1,j1]=inner(a1);
        for(const [y,h,k] of [[0,6.5,.82],[6.5,6,.9],[12.5,6,.84],[18.5,5,1]]){
          const lit=c.clone().multiplyScalar(k*(.9+.1*Math.cos(a0-.8)));
          triangle([x0,base+y,z0],[x1,base+y,z1],[x1,base+y+h,z1],lit);triangle([x0,base+y,z0],[x1,base+y+h,z1],[x0,base+y+h,z0],lit);
        }
        const seats=shade(.74);triangle([i0,base+4,j0],[x0,base+23.5,z0],[x1,base+23.5,z1],seats);triangle([i0,base+4,j0],[x1,base+23.5,z1],[i1,base+4,j1],seats);
      }
      break;}
    case 'rotunda':
      // The drum and its shallow dome, the pedimented porch toward the board.
      drum(0,0,-3,11,13);dome(0,13,-3,11,6.5,shade(1.03));B(0,0,10.5,15,1,8);colonnade(0,13.6,8,1.9,8.4,6);roof(0,9.3,10.5,15,8,3.2);B(0,0,8.2,7,12,4.6,shade(.96));break;
    case 'arch':
      // A triple arch: the great central bay, two smaller ones, and the attic above.
      B(0,0,0,18,14.5,8);B(0,14.5,0,18.4,4.5,8.4,shade(.96));B(0,0,4.05,5,9.5,.2,dark);for(const s of [-1,1])B(s*5.9,0,4.05,2.4,5.4,.2,dark);break;
    case 'mausoleum':
      // A square base, the great drum on it, and the smaller drum and gilded group on top.
      B(0,0,0,36,6,36);drum(0,6,0,16,11);drum(0,17,0,6,4,shade(.95),12);B(0,21,0,1.4,3,1.4,shade(1.15));break;
  }
  return base;
}
/** The stream under a bridge that has no river: a flat strip of water across its middle
 * spans, running toward and away from the board, just above its foundation. */
export function buildLandmarkStream({cx,cz,yaw=Math.atan2(-cx,-cz),base,triangle,color}){
  const {r,f}=frame(yaw),P=(u,v)=>[cx+u*r[0]+v*f[0],base+.35,cz+u*r[1]+v*f[1]];
  // Corners clockwise seen from above, as the horizon's triangle() takes them.
  const a=P(-11,-15),b=P(11,-15),c=P(11,15),d=P(-11,15);triangle(a,b,c,color);triangle(a,c,d,color);
}
