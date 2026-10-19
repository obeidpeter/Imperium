import * as THREE from '../../vendor/three/three.module.js';
import {hash} from './environment-layout.js';

// A painted panorama beyond the far ridges: layered ranges in fresco pigment
// with regional landmarks, drawn once per scene from a seeded hash. It is
// presentation only, never pickable terrain, and adds no download: the canvas
// is painted in code. Without a canvas (tests, workers) no backdrop is built.
export const BACKDROP_RADIUS=610;
const SIZES={performance:[1024,192],balanced:[2048,384],high:[3072,512]};
const LANDMARKS={rome:'city',accession:'city',palmyra:'palmyra',siege:'mesa',desert:'mesa',italy:'alps',wetland:'reeds',frontier:'forest',fortress:'forest',crossing:'forest',province:'farmland',station:'hills'};
export function backdropLandmark(profile){return LANDMARKS[profile?.setting]??'hills';}

// Periodic ridge height: integer harmonics wrap seamlessly around the cylinder.
export function ridgeProfile(u,{seed=1,base=.5,amplitude=.18,harmonics=7,sharp=false}={}){
  let y=0,weight=0;for(let k=1;k<=harmonics;k++){const a=1/Math.pow(k,1.15),phase=hash(seed,k,3)*Math.PI*2;y+=a*Math.sin(2*Math.PI*k*u+phase);weight+=a;}
  y/=weight;if(sharp)y=1-Math.abs(y)*2;return base+amplitude*y;
}
function makeCanvas(width,height){
  if(typeof OffscreenCanvas==='function')return new OffscreenCanvas(width,height);
  const canvas=globalThis.document?.createElement?.('canvas');if(!canvas)return null;canvas.width=width;canvas.height=height;return canvas;
}
const mix=(a,b,t)=>a.clone().lerp(b,t);
const css=color=>`#${color.getHexString()}`;
export function paintBackdrop(profile,{quality='balanced'}={}){
  const [width,height]=SIZES[quality]??SIZES.balanced,canvas=makeCanvas(width,height),c=canvas?.getContext?.('2d');if(!c)return null;
  const seed=(profile?.chapter??1)*31+7,haze=new THREE.Color(profile?.grade?.haze??profile?.fog??'#b8c6c2'),land=new THREE.Color(profile?.groundTint??'#859271'),stone=new THREE.Color(profile?.stoneColor??'#bab9ad');
  const arid=['siege','desert','palmyra'].includes(profile?.setting),landmark=backdropLandmark(profile);
  // Four ranges, far to near: lighter and hazier with distance (aerial perspective).
  // The farthest crest peaks about five degrees above the horizon; nearer ranges
  // sit lower and mostly behind the modelled ridges, showing between them.
  const ranges=[{base:.52,amplitude:.14,tint:.70},{base:.68,amplitude:.09,tint:.52},{base:.76,amplitude:.06,tint:.34},{base:.83,amplitude:.04,tint:.18}];
  if(landmark==='alps')ranges[0]={base:.46,amplitude:.24,tint:.64,sharp:true};
  if(landmark==='mesa'){ranges[1].amplitude=.06;ranges[2].amplitude=.05;}
  if(landmark==='reeds')for(const r of ranges){r.amplitude*=.35;r.base+=.12;}
  ranges.forEach((range,layer)=>{
    const color=mix(arid?land.clone().lerp(stone,.4):land,haze,range.tint),shade=mix(color,new THREE.Color('#2f3a33'),.12+layer*.04);
    // The farthest crest melts into the sky; nearer ones keep a painted edge.
    const top=mix(color,new THREE.Color('#fff4dc'),.12),gradient=c.createLinearGradient(0,height*(range.base-range.amplitude),0,height);
    if(layer===0){gradient.addColorStop(0,`rgba(${top.toArray().map(v=>Math.round(v*255)).join(',')},0)`);gradient.addColorStop(.3,`rgba(${top.toArray().map(v=>Math.round(v*255)).join(',')},.82)`);}else gradient.addColorStop(0,css(top));
    gradient.addColorStop(1,css(shade));
    c.fillStyle=gradient;c.beginPath();c.moveTo(0,height);
    for(let x=0;x<=width;x+=4){let y=ridgeProfile(x/width,{seed:seed+layer*13,base:range.base,amplitude:range.amplitude,sharp:range.sharp});
      if(landmark==='mesa'&&layer===1){const step=Math.floor(x/width*9),flat=hash(step,seed)>.45;if(flat)y=Math.min(y,range.base-range.amplitude*.6);}
      c.lineTo(x,y*height);}
    c.lineTo(width,height);c.closePath();c.fill();
    // Brushwork: short strokes painted only onto this range (source-atop).
    c.save();c.globalCompositeOperation='source-atop';
    const strokes=Math.round(width*height/2600);
    for(let i=0;i<strokes;i++){const x=hash(i,layer,seed)*width,y=height*(range.base-range.amplitude)+hash(layer,i,seed+1)*height*(1-range.base+range.amplitude),length=6+hash(i,seed,layer+2)*18,tone=hash(i,layer,9);
      c.strokeStyle=css(mix(color,tone>.5?new THREE.Color('#fff1d6'):new THREE.Color('#33403a'),.08+hash(i,4,layer)*.12));c.globalAlpha=.10+hash(layer,i,6)*.14;c.lineWidth=1+hash(i,7)*2.4;
      c.beginPath();c.moveTo(x,y);c.lineTo(x+length,y-length*.35);c.stroke();}
    c.restore();
    if(layer===1||layer===2)drawLandmarks(c,{landmark,layer,width,height,seed,base:range.base,amplitude:range.amplitude,sharp:range.sharp,color:mix(color,new THREE.Color('#283029'),.18+layer*.08),stone:mix(stone,haze,range.tint*.8)});
  });
  // Snow on the far Alpine peaks.
  if(landmark==='alps'){const far=ranges[0],line=far.base-far.amplitude*.45;c.save();c.globalCompositeOperation='source-atop';c.fillStyle='rgba(246,247,244,.82)';for(let x=0;x<=width;x+=3){const y=ridgeProfile(x/width,{seed,base:far.base,amplitude:far.amplitude,sharp:true});if(y<line)c.fillRect(x,y*height,3,(line-y)*height*.9+2);}c.restore();}
  // Lower edge fades to the land colour the ridge geometry meets.
  const foot=c.createLinearGradient(0,height*.84,0,height);foot.addColorStop(0,'rgba(0,0,0,0)');foot.addColorStop(1,css(mix(land,haze,.45)));c.save();c.globalCompositeOperation='source-atop';c.fillStyle=foot;c.fillRect(0,height*.84,width,height*.16);c.restore();
  return canvas;
}
// Landmarks stand on the same ridge line as the range they are painted on.
function drawLandmarks(c,{landmark,layer,width,height,seed,base,amplitude,sharp,color,stone}){
  c.save();c.fillStyle=css(color);
  const sites=Math.round(width/420),ridge=u=>ridgeProfile(u,{seed:seed+layer*13,base,amplitude,sharp})*height;
  for(let i=0;i<sites;i++){
    const u=(i+hash(i,seed,layer))/sites,x=u*width,ground=ridge(u),s=height*(layer===1?.05:.08);
    if(landmark==='city'&&hash(i,seed)>.35){
      // Temple pediments, a run of aqueduct arches and the new wall's towers.
      c.fillStyle=css(stone);c.fillRect(x-s*1.4,ground-s*1.1,s*2.8,s*1.1);c.beginPath();c.moveTo(x-s*1.6,ground-s*1.1);c.lineTo(x,ground-s*1.75);c.lineTo(x+s*1.6,ground-s*1.1);c.fill();
      c.fillStyle=css(color);for(let k=0;k<7;k++)c.fillRect(x-s*1.25+k*s*.4,ground-s*1.05,s*.12,s);
      if(layer===2)for(let k=0;k<9;k++){const ax=x+s*3+k*s*.7;c.fillRect(ax,ground-s*1.4,s*.16,s*1.4);c.beginPath();c.arc(ax+s*.35,ground-s*1.4,s*.35,Math.PI,0);c.fill();}
    }else if(landmark==='palmyra'){
      c.fillStyle=css(stone);for(let k=0;k<10;k++)c.fillRect(x+k*s*.42,ground-s*1.3,s*.14,s*1.3);c.fillRect(x-s*.1,ground-s*1.42,s*4.4,s*.14);
      if(hash(i,seed,2)>.5)c.fillRect(x+s*5,ground-s*2.6,s*.7,s*2.6);
      c.fillStyle=css(color);for(let k=0;k<3;k++){const px=x-s*(1.5+k),top=ground-s*(1.6+hash(k,i)*.6);c.fillRect(px,top,s*.08,ground-top);for(let f=0;f<5;f++){c.beginPath();c.ellipse(px,top,s*.5,s*.12,(f-2)*.5,0,Math.PI*2);c.fill();}}
    }else if(landmark==='mesa'&&layer===2&&hash(i,seed)>.6){
      c.fillStyle=css(stone);c.fillRect(x,ground-s*1.2,s*2.4,s*1.2);for(let k=0;k<6;k++)c.fillRect(x+k*s*.42,ground-s*1.45,s*.24,s*.25);c.fillRect(x+s*.9,ground-s*2,s*.6,s*.8);
    }else if(['forest','farmland','hills','reeds'].includes(landmark)){
      // Tree crowns along the ridge; a watchtower on the nearer range.
      const crowns=landmark==='farmland'?4:landmark==='reeds'?2:9;
      for(let k=0;k<crowns;k++){const tx=x+(hash(k,i,seed)-.5)*s*12,tr=s*(.32+hash(i,k)*.35),ty=ridge(((tx/width)%1+1)%1);c.beginPath();c.arc(tx,ty-tr*.6,tr,0,Math.PI*2);c.fill();}
      if(layer===2&&hash(i,seed,5)>.7&&landmark!=='reeds'){c.fillRect(x,ground-s*1.9,s*.55,s*1.9);c.beginPath();c.moveTo(x-s*.12,ground-s*1.9);c.lineTo(x+s*.27,ground-s*2.35);c.lineTo(x+s*.67,ground-s*1.9);c.fill();}
    }
  }
  c.restore();
}
export function createPaintedBackdrop(profile,{quality='balanced'}={}){
  const group=new THREE.Group();group.name='painted regional backdrop';group.userData.environmentBackdrop=true;
  const canvas=profile?.civic?null:paintBackdrop(profile,{quality});
  if(!canvas)return {group,stats:{painted:false},dispose(){}};
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;
  // The painting spans roughly -2 to +9 degrees of elevation from the board.
  const heightMetres=120,geometry=new THREE.CylinderGeometry(BACKDROP_RADIUS,BACKDROP_RADIUS,heightMetres,quality==='performance'?48:96,1,true);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,fog:false,side:THREE.BackSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='painted panorama';mesh.position.y=heightMetres/2-21;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;group.add(mesh);
  return {group,stats:{painted:true,width:canvas.width,height:canvas.height,landmark:backdropLandmark(profile)},dispose(){geometry.dispose();material.dispose();texture.dispose();}};
}
