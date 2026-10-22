import * as T from '../../vendor/three/three.module.js';
import {skyPalette} from './sky.js';

// Keep faces, shield rims and weapon hands readable on the unlit side of a
// figure. This is a broad, unshadowed bounce, not another shadow-map pass.
// Chapter hues and the key light still establish time of day.
export function readableLighting(profile){
  const night=profile.timeOfDay==='night',balance=profile.grade??{};
  return {ambient:Math.max(night?.95:1.4,(profile.ambientIntensity??2.1)*.86*(balance.ambient??1)),
    fill:night?.38:profile.civic?.62:.52,fillColor:night?'#adc4e5':'#f1e6d0',environment:night?.48:.56};
}

// Original, small HDR radiance field. The visible sky and the reflections use
// the same palette and sun bearing. PMREM convolution happens once per scene,
// never in the animation loop; no remote panorama or licensed bitmap is used.
function radianceSampler(profile){
  const palette=skyPalette(profile),d=new T.Vector3(),ground=new T.Color(profile.ambientGround??'#60694f').multiplyScalar(.58),sun=new T.Vector3(...(profile.sunPosition??[-16,24,-12])).normalize();
  return (direction,target)=>{
  d.copy(direction).normalize();
  const altitude=Math.max(0,d.y),blend=Math.min(1,altitude/.7);
  target.copy(palette.horizon).lerp(palette.zenith,blend).multiplyScalar(1.45);
  if(d.y<0)target.lerp(ground,Math.min(1,-d.y*3));
  const facing=Math.max(0,d.dot(sun));
  // A broad photographic highlight survives rough metal convolution, while
  // the directional light retains the sharp sun and its actual cast shadows.
  const strength=Math.pow(facing,32)*1.6+Math.pow(facing,256)*4;
  target.r+=palette.sun.r*strength;target.g+=palette.sun.g*strength;target.b+=palette.sun.b*strength;
  return target;
  };
}
export function lightingRadiance(profile,direction,target=new T.Color()){return radianceSampler(profile)(direction,target);}

export function createSceneLighting(renderer,scene,profile,{quality='balanced'}={}){
  const width=quality==='performance'?128:256,height=width/2,data=new Float32Array(width*height*4),color=new T.Color(),direction=new T.Vector3(),sample=radianceSampler(profile);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const theta=(y+.5)/height*Math.PI,phi=((x+.5)/width-.5)*Math.PI*2;
    direction.set(Math.cos(phi)*Math.sin(theta),-Math.cos(theta),Math.sin(phi)*Math.sin(theta));
    sample(direction,color);const i=(y*width+x)*4;data.set([color.r,color.g,color.b,1],i);
  }
  const source=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);source.mapping=T.EquirectangularReflectionMapping;source.needsUpdate=true;
  const generator=new T.PMREMGenerator(renderer);let output;
  try{output=generator.fromEquirectangular(source);}finally{source.dispose();generator.dispose();}
  scene.environment=output.texture;scene.environmentIntensity=readableLighting(profile).environment;
  let disposed=false;
  return {stats:()=>({type:'locally generated HDR sky reflection',width,height,intensity:scene.environmentIntensity,perFrameCaptures:0}),dispose(){if(disposed)return;disposed=true;if(scene.environment===output.texture)scene.environment=null;output.dispose();}};
}
