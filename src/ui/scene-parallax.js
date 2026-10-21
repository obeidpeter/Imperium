import {chapterWeather,chapterTimeOfDay} from './chapter-weather.js';
import {decodeImage} from './asset-loader.js';
import {sceneDepth} from './art.js';

// Story paintings in 2.5D. Every scene painting has a small greyscale depth map
// (near = light; provenance in docs/art-generation.md). A decorative canvas
// over the painting moves the eye a little, so the near ground slides against
// the far hills, and draws the chapter's weather between the depth planes:
// rain falling in front of the far bank but behind the near tents, embers
// rising from the fires, dust and mist lying in the distance, motes turning in
// the Curia's light.
// The <img> stays underneath with its text alternative and is the fallback:
// Performance quality, reduced motion, no WebGL, a failed load and a lost
// context all leave the still painting. Presentation only: it never reads or
// changes campaign state, and the motion is a fixed function of time.
export const PAINTING_BUDGET=Object.freeze({balancedFps:30,highFps:60,balancedPixelRatio:1.5,highPixelRatio:2,maxPixels:2_400_000});
// Per painting: the depth that holds still while the eye drifts, and weather
// that belongs to the place rather than the chapter (the Curia is indoors;
// the accession is a clear evening).
export const SCENE_PAINTINGS=Object.freeze({
  'frontier-oath':{focus:.45},danube:{focus:.4},marsh:{focus:.4},'eastern-fort':{focus:.42},'river-crossing':{focus:.42},
  province:{focus:.45},rome:{focus:.45,weather:'motes'},accession:{focus:.5,weather:'motes'}
});
export const PAINTING_WEATHER=Object.freeze({clear:0,rain:1,embers:2,dust:3,mist:4,motes:5});
const WEATHER_STYLE={clear:{color:[0,0,0],strength:0},rain:{color:[.8,.84,.88],strength:.8},embers:{color:[1,.5,.18],strength:1},dust:{color:[.84,.7,.5],strength:.75},mist:{color:[.84,.86,.87],strength:.8},motes:{color:[1,.86,.6],strength:.85}};
const MIST_LIGHT={dawn:[.93,.85,.8],dusk:[.86,.75,.64]};

export function scenePaintingName(src=''){
  const match=/(?:^|\/)assets\/scenes\/([a-z-]+)\.webp$/.exec(String(src||''));
  return match&&Object.hasOwn(SCENE_PAINTINGS,match[1])?match[1]:null;
}
export function paintingWanted({quality='balanced',reducedMotion=false}={}){return quality!=='performance'&&!reducedMotion;}
// One painting drifts at a time: an oath or accession painting staged in 2D
// first (one staged in 3D is not a painting), else the camp mural, else a
// promotion scene. The title page has none.
export function paintingHost(page,{title=false,ceremony3D=false}={}){
  if(title)return null;
  const ceremony=page.querySelector('[data-ceremony]');
  return (!ceremony3D&&ceremony)||page.querySelector('.cinematic-mural')||page.querySelector('.ceremony-scene:not([data-ceremony])');
}
export function paintingWeather(src,chapter=1){
  const name=scenePaintingName(src);
  return name?SCENE_PAINTINGS[name].weather??chapterWeather(chapter):'clear';
}
export function paintingWeatherStyle(weather='clear',chapter=1){
  const style=WEATHER_STYLE[weather]??WEATHER_STYLE.clear;
  const color=weather==='mist'?MIST_LIGHT[chapterTimeOfDay(chapter)]??style.color:style.color;
  return {kind:PAINTING_WEATHER[weather]??0,color:[...color],strength:style.strength};
}
// The part of the image that object-fit: cover shows, as [x, y, width, height] in image UV.
export function coverWindow(width,height,imageWidth,imageHeight,position=[.5,.5]){
  const box=width/Math.max(1,height),image=imageWidth/Math.max(1,imageHeight);
  if(!(box>0&&image>0))return [0,0,1,1];
  if(box>image){const h=image/box;return [0,(1-h)*position[1],1,h];}
  const w=box/image;return [(1-w)*position[0],0,w,1];
}
export function objectPosition(value=''){
  const parts=String(value).trim().split(/\s+/),read=(part,fallback)=>part?.endsWith('%')&&Number.isFinite(Number.parseFloat(part))?Math.max(0,Math.min(1,Number.parseFloat(part)/100)):fallback;
  return [read(parts[0],.5),read(parts[1],.5)];
}
// CSS ease-out, cubic-bezier(0, 0, .58, 1), as the painting's arrival uses.
export function easeOut(x){
  if(!(x>0))return 0;if(x>=1)return 1;
  let low=0,high=1,t=x;
  for(let i=0;i<30;i++){t=(low+high)/2;const bx=3*(1-t)*t*t*.58+t*t*t;if(bx<x)low=t;else high=t;}
  return 3*(1-t)*t*t+t*t*t;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Where the eye is `time` seconds into the painting's stay. The arrival
// repeats the CSS scene-arrival (scale 1.035 to 1) so the canvas takes over
// from the <img> without a jump; the drift and dolly ease in after it and
// loop slowly on unrelated periods.
export function paintingMotion(time=0,{arrival=0}={}){
  const t=Math.max(0,time),settle=smooth(arrival*.35,arrival+3,t),tau=Math.PI*2;
  return {
    arrival:arrival>0&&t<arrival?1.035-.035*easeOut(t/arrival):1,
    drift:[.011*settle*Math.sin(tau*t/29),.0055*settle*Math.sin(tau*t/41+.9)],
    zoom:.035*settle*(.5-.5*Math.cos(tau*t/47)),
    weather:smooth(.5,3.5,t)
  };
}

const VERTEX=`attribute vec2 corner;varying vec2 vUv;
void main(){vUv=vec2(corner.x*.5+.5,.5-corner.y*.5);gl_Position=vec4(corner,0.,1.);}`;
// The painted point that lands on a pixel solves u = s + shift*(d-focus) +
// (s-centre)*zoom*d for the depth d at s: a lateral eye offset plus a dolly
// that enlarges the near ground more than the far. Weather layers sit at
// fixed depths and show only where the painting lies behind them.
const FRAGMENT=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D paint;uniform sampler2D depthMap;
uniform vec4 window;uniform vec2 drift;uniform float focus;uniform float zoom;uniform float arrival;
uniform float time;uniform float weatherKind;uniform vec3 weatherColor;uniform float weatherAmount;uniform vec2 resolution;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03+vec2(3.1,1.7))*.3+noise(p*4.1+vec2(7.3,2.9))*.15;}
float behind(float sceneDepth,float layer){return smoothstep(layer+.06,layer-.06,sceneDepth);}
vec2 centre(){return window.xy+.5*window.zw;}
vec2 layerPoint(vec2 u,vec2 shift,float layer){
  vec2 s=(u-shift*(layer-focus)+centre()*zoom*layer)/(1.+zoom*layer);
  vec2 p=(s-window.xy)/window.zw;return vec2(p.x*resolution.x/resolution.y,p.y);
}
float rain(vec2 p,float scale,float speed,float seed){
  p=vec2(p.x+p.y*.16,p.y)*scale;p.y-=time*speed;
  vec2 cell=floor(vec2(p.x,p.y/6.)),f=vec2(fract(p.x),fract(p.y/6.));
  float h=hash(cell+seed);if(h<.45)return 0.;
  float x=.2+.6*fract(h*13.7);
  return smoothstep(.09,.0,abs(f.x-x))*smoothstep(.0,.12,f.y)*smoothstep(.55,.32,f.y)*(.45+.55*fract(h*7.3));
}
float spark(vec2 p,float scale,vec2 flow,float wobble,float seed,float keep,float size){
  p=p*scale+flow*time;vec2 cell=floor(p),f=fract(p);
  float h=hash(cell+seed);if(h<keep)return 0.;
  vec2 c=vec2(.3+.4*fract(h*17.1),.3+.4*fract(h*31.7));c.x+=wobble*sin(time*(.7+h)+h*40.);c.y+=wobble*.6*cos(time*(.5+h)+h*23.);
  float r=length(f-c),glow=smoothstep(size,.0,r)+.3*smoothstep(size*2.6,.0,r);
  return glow*(.6+.4*sin(time*(2.+4.*h)+h*90.));
}
void main(){
  vec2 q=.5+(vUv-.5)/arrival;
  vec2 u=window.xy+q*window.zw;
  vec2 shift=drift*clamp(min(u,1.-u)/.08,0.,1.);
  vec2 s=u;float d=texture2D(depthMap,s).r;
  for(int i=0;i<4;i++){s=(u-shift*(d-focus)+centre()*zoom*d)/(1.+zoom*d);d=mix(d,texture2D(depthMap,s).r,.75);}
  vec3 color=texture2D(paint,s).rgb;
  if(weatherAmount>0.){
    if(weatherKind<1.5){
      float r=rain(layerPoint(u,shift,.25),58.,30.,1.)*.45*behind(d,.25)+rain(layerPoint(u,shift,.55),38.,32.,2.)*.6*behind(d,.55)+rain(layerPoint(u,shift,.97),24.,30.,3.)*.75;
      color=mix(color,color*.9+weatherColor*.1,.5*weatherAmount);color+=weatherColor*r*.3*weatherAmount;
    }else if(weatherKind<2.5){
      float e=spark(layerPoint(u,shift,.3),26.,vec2(0.,1.1),.12,4.,.78,.14)*.7*behind(d,.3)+spark(layerPoint(u,shift,.7),14.,vec2(0.,.75),.12,5.,.82,.17)*behind(d,.7);
      color+=weatherColor*e*1.1*weatherAmount;
    }else if(weatherKind<3.5){
      vec2 a=layerPoint(u,shift,.2),b=layerPoint(u,shift,.5);
      float haze=smoothstep(.35,.9,fbm(a*vec2(1.5,3.4)+vec2(time*.035,0.)))*behind(d,.2)*.55+smoothstep(.45,.95,fbm(b*vec2(2.1,4.2)+vec2(time*.05,1.3)))*behind(d,.5)*.3;
      float specks=spark(layerPoint(u,shift,.62),30.,vec2(-.6,.05),.15,6.,.86,.13)*behind(d,.62);
      color=mix(color,weatherColor,haze*.42*weatherAmount);color+=weatherColor*specks*.3*weatherAmount;
    }else if(weatherKind<4.5){
      vec2 a=layerPoint(u,shift,.25),b=layerPoint(u,shift,.6);
      float near=smoothstep(.42,.86,fbm(a*vec2(2.2,6.)+vec2(time*.012,0.)))*behind(d,.25)*(1.-.4*d);
      float low=smoothstep(.5,.92,fbm(b*vec2(2.8,7.5)+vec2(time*.02,2.1)))*behind(d,.6)*smoothstep(.25,.85,vUv.y);
      color=mix(color,weatherColor,(near*.5+low*.32)*weatherAmount);
    }else{
      float light=dot(color,vec3(.299,.587,.114));
      float m=spark(layerPoint(u,shift,.45),34.,vec2(.08,-.05),.25,7.,.82,.12)*behind(d,.45)+spark(layerPoint(u,shift,.8),20.,vec2(-.05,-.03),.25,8.,.87,.12)*.8;
      color+=weatherColor*m*smoothstep(.2,.7,light)*.8*weatherAmount;
    }
  }
  gl_FragColor=vec4(color,1.);
}`;

function defaultContext(canvas){
  const options={alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'low-power'};
  return canvas.getContext('webgl2',options)||canvas.getContext('webgl',options);
}
function compile(gl){
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(log||'Painting shader failed');}return s;};
  const vertex=shader(gl.VERTEX_SHADER,VERTEX),fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT),program=gl.createProgram();
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Painting program failed');
  return program;
}
function upload(gl,image,unit){
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  for(const [key,value]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,key,value);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);return texture;
}
const UNIFORMS=['paint','depthMap','window','drift','focus','zoom','arrival','time','weatherKind','weatherColor','weatherAmount','resolution'];

// One painting at a time. Mounting the same painting again (the camp view
// re-renders on every decision) moves the same canvas into the new host and
// keeps its clock, so the scene never restarts or jumps.
export function createScenePainting({load=decodeImage,createContext=defaultContext}={}){
  const failed=new Set();let current=null,frames=0;
  function stop(){if(current?.raf){current.win.cancelAnimationFrame(current.raf);current.raf=0;}}
  function release(){
    if(!current)return;const c=current;current=null;
    if(c.raf)c.win.cancelAnimationFrame(c.raf);c.raf=0;c.observer?.disconnect();c.doc?.removeEventListener('visibilitychange',c.visibility);
    c.canvas.removeEventListener?.('webglcontextlost',c.lost);
    if(c.gl){try{for(const t of c.textures)c.gl.deleteTexture(t);if(c.program)c.gl.deleteProgram(c.program);if(c.buffer)c.gl.deleteBuffer(c.buffer);c.gl.getExtension?.('WEBGL_lose_context')?.loseContext();}catch{}}
    c.canvas.remove?.();
  }
  function fail(c){if(current!==c)return;failed.add(c.src);release();}
  function observe(c,host){
    c.observer?.disconnect();c.observer=null;c.visible=true;
    const Observer=c.win.IntersectionObserver;if(typeof Observer!=='function')return;
    c.observer=new Observer(entries=>{const entry=entries.at(-1);if(!entry||current!==c)return;c.visible=entry.isIntersecting;if(c.visible)schedule(c);else stop();},{rootMargin:'40px'});c.observer.observe(host);
  }
  function schedule(c=current){if(c&&c===current&&c.ready&&!c.raf&&c.visible&&!c.doc.hidden&&c.canvas.isConnected)c.raf=c.win.requestAnimationFrame(t=>frame(c,t));}
  function frame(c,timestamp){
    c.raf=0;if(current!==c||!c.ready||c.doc.hidden||!c.visible||!c.canvas.isConnected)return;
    const gap=1000/(c.quality==='high'?PAINTING_BUDGET.highFps:PAINTING_BUDGET.balancedFps)-2;
    if(timestamp-c.last>=gap){c.last=timestamp;try{draw(c,timestamp);}catch{fail(c);return;}}
    schedule(c);
  }
  function draw(c,timestamp){
    const gl=c.gl,box=c.host.getBoundingClientRect?.()??{width:0,height:0};if(!(box.width>1&&box.height>1))return;
    let ratio=Math.min(c.win.devicePixelRatio||1,c.quality==='high'?PAINTING_BUDGET.highPixelRatio:PAINTING_BUDGET.balancedPixelRatio);
    ratio=Math.min(ratio,Math.sqrt(PAINTING_BUDGET.maxPixels/(box.width*box.height)));
    const width=Math.max(1,Math.round(box.width*ratio)),height=Math.max(1,Math.round(box.height*ratio));
    if(c.canvas.width!==width||c.canvas.height!==height){c.canvas.width=width;c.canvas.height=height;}
    if(c.clock===null)c.clock=timestamp-c.arrivalAt*1000;
    const time=Math.max(0,(timestamp-c.clock)/1000),motion=paintingMotion(time,{arrival:c.arrival}),style=c.style,u=c.uniforms;
    gl.viewport(0,0,width,height);gl.useProgram(c.program);
    gl.uniform1i(u.paint,0);gl.uniform1i(u.depthMap,1);gl.uniform4fv(u.window,coverWindow(box.width,box.height,c.image.naturalWidth||c.image.width,c.image.naturalHeight||c.image.height,c.position));
    gl.uniform2fv(u.drift,motion.drift);gl.uniform1f(u.focus,c.focus);gl.uniform1f(u.zoom,motion.zoom);gl.uniform1f(u.arrival,motion.arrival);
    gl.uniform1f(u.time,time%3600);gl.uniform1f(u.weatherKind,style.kind);gl.uniform3fv(u.weatherColor,style.color);gl.uniform1f(u.weatherAmount,style.kind?style.strength*motion.weather:0);gl.uniform2f(u.resolution,width,height);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,c.textures[0]);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,c.textures[1]);
    gl.bindBuffer(gl.ARRAY_BUFFER,c.buffer);gl.enableVertexAttribArray(c.corner);gl.vertexAttribPointer(c.corner,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3);
    c.frames++;frames++;if(c.canvas.dataset.ready!=='true')c.canvas.dataset.ready='true';
  }
  function arrivalOf(img){
    const animation=img?.getAnimations?.().find(a=>a.animationName==='scene-arrival');
    const duration=Number(animation?.effect?.getComputedTiming?.().duration)||0;
    return duration>0?{arrival:duration/1000,at:Math.min(duration,Math.max(0,Number(animation.currentTime)||0))/1000}:{arrival:0,at:0};
  }
  async function start(c){
    const [image,depth]=await Promise.all([load(c.src),load(c.depth)]);
    if(current!==c)return;if(!image||!depth){fail(c);return;}
    try{
      const gl=createContext(c.canvas);if(!gl){fail(c);return;}c.gl=gl;
      c.program=compile(gl);c.uniforms=Object.fromEntries(UNIFORMS.map(name=>[name,gl.getUniformLocation(c.program,name)]));c.corner=gl.getAttribLocation(c.program,'corner');
      c.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,c.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      c.textures=[upload(gl,image,0),upload(gl,depth,1)];c.image=image;
    }catch{fail(c);return;}
    const timing=arrivalOf(c.img);c.arrival=timing.arrival;c.arrivalAt=timing.at;c.ready=true;
    c.lost=()=>fail(c);c.canvas.addEventListener?.('webglcontextlost',c.lost);
    schedule(c);
  }
  return {
    mount(host,{src=host?.querySelector?.('img')?.getAttribute?.('src'),chapter=1,quality='balanced',reducedMotion=false}={}){
      const depth=scenePaintingName(src)?sceneDepth(src):null,doc=host?.ownerDocument,win=doc?.defaultView;
      if(!host||!depth||!doc||!win||failed.has(src)||!paintingWanted({quality,reducedMotion})||typeof win.requestAnimationFrame!=='function'){release();return null;}
      const img=host.querySelector?.('img')??null,weather=paintingWeather(src,chapter);
      const position=objectPosition(img&&win.getComputedStyle?win.getComputedStyle(img).objectPosition:'');
      if(current&&current.src===src&&current.doc===doc){
        const c=current;Object.assign(c,{quality,img,position,weather,style:paintingWeatherStyle(weather,chapter)});
        if(c.host!==host||c.canvas.parentNode!==host){c.host=host;host.append(c.canvas);observe(c,host);}
        stop();schedule(c);return c.canvas;
      }
      release();
      const canvas=doc.createElement('canvas');canvas.className='scene-depth-canvas';canvas.setAttribute('aria-hidden','true');host.append(canvas);
      const c={src,depth,host,img,canvas,doc,win,quality,position,weather,style:paintingWeatherStyle(weather,chapter),focus:SCENE_PAINTINGS[scenePaintingName(src)].focus,
        gl:null,program:null,buffer:null,textures:[],uniforms:{},corner:0,image:null,ready:false,raf:0,last:-Infinity,clock:null,arrival:0,arrivalAt:0,frames:0,visible:true,observer:null,lost:null};
      c.visibility=()=>{if(c.doc.hidden)stop();else schedule(c);};doc.addEventListener('visibilitychange',c.visibility);
      current=c;observe(c,host);start(c).catch(()=>fail(c));
      return canvas;
    },
    release,
    stats(){return {src:current?.src??null,weather:current?.weather??null,ready:Boolean(current?.ready),running:Boolean(current?.raf),frames,paintingFrames:current?.frames??0,failed:[...failed]};}
  };
}
