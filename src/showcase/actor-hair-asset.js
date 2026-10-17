import * as T from '../../vendor/three/three.module.js';
export const ACTOR_HAIR_MODEL='assets/models/short-hair-v018.bin',ACTOR_HAIR_TEXTURE='assets/textures/short-hair-v018.webp';
const eligible=id=>!id?.female&&!['bound','long'].includes(id?.hair);

/** Strict local IHR1 parser. Dequantization happens once, outside animation. */
export function parseActorHair(input){
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):input;
  if(!ArrayBuffer.isView(bytes)||bytes.byteLength<40)throw Error('Invalid hair header');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=v.getUint32(4,true),length=v.getUint32(8,true);
  if(v.getUint32(0,true)!==0x31524849||v.getUint32(36,true)!==0||count<3||count>8192||length<3||length%3||length>49152||bytes.byteLength!==40+count*13+length*2)throw Error('Invalid hair layout');
  const min=[0,1,2].map(k=>v.getFloat32(12+k*4,true)),max=[0,1,2].map(k=>v.getFloat32(24+k*4,true));
  if(min.some((a,k)=>!Number.isFinite(a)||!Number.isFinite(max[k])||a>=max[k]||Math.abs(a)>3||Math.abs(max[k])>3))throw Error('Invalid hair bounds');
  const p=new Float32Array(count*3),n=new Float32Array(count*3),uv=new Float32Array(count*2),indices=new Uint16Array(length);let offset=40;
  for(let i=0;i<p.length;i++){const k=i%3;p[i]=min[k]+v.getUint16(offset,true)/65535*(max[k]-min[k]);offset+=2;}
  for(let i=0;i<n.length;i++)n[i]=v.getInt8(offset++)/127;
  for(let i=0;i<n.length;i+=3){const d=Math.hypot(n[i],n[i+1],n[i+2]);if(d<.1){n[i]=0;n[i+1]=1;n[i+2]=0;}else for(let k=0;k<3;k++)n[i+k]/=d;}
  for(let i=0;i<uv.length;i++){uv[i]=v.getUint16(offset,true)/65535;offset+=2;}
  for(let i=0;i<length;i++){indices[i]=v.getUint16(offset,true);offset+=2;if(indices[i]>=count)throw Error('Invalid hair index');}
  return {position:p,normal:n,uv,index:indices};
}
function decodeHair(url){
  return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{const width=image.naturalWidth,height=image.naturalHeight;if(width!==256||height!==256)throw Error('Invalid hair texture dimensions');const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('No hair decoder');context.drawImage(image,0,0);resolve({width,height,data:context.getImageData(0,0,width,height).data});}catch(e){reject(e);}};image.onerror=()=>reject(Error('Hair texture unavailable'));image.src=url;});
}
export function normalizeActorHair(source){
  const data=new Uint8Array(source.length);for(let i=0;i<source.length;i+=4){for(let k=0;k<3;k++)data[i+k]=Math.min(245,Math.round(source[i+k]*6));data[i+3]=source[i+3];}return data;
}
export function createActorHairLibrary({loadBinary,loadTexture}={}){
  const browserDefault=!loadBinary&&!loadTexture;
  loadBinary??=async url=>{const response=await fetch(url);if(!response.ok)throw Error('Hair model unavailable');return response.arrayBuffer();};loadTexture??=decodeHair;
  let pending=null,master=null,pixels=null,map=null,refs=0,error=null,disposed=false;
  function warm(){
    if(disposed)return Promise.resolve(false);if(pending)return pending;
    if(browserDefault&&(typeof document==='undefined'||typeof Image==='undefined'))return Promise.resolve(false);
    return pending=Promise.all([Promise.resolve().then(()=>loadBinary(new URL('../../'+ACTOR_HAIR_MODEL,import.meta.url).href)),Promise.resolve().then(()=>loadTexture(new URL('../../'+ACTOR_HAIR_TEXTURE,import.meta.url).href))]).then(([binary,image])=>{
      if(disposed)return false;const parsed=parseActorHair(binary);if(image.width!==256||image.height!==256||image.data?.length!==256*256*4)throw Error('Invalid hair texture pixels');
      master=parsed;pixels={width:256,height:256,data:normalizeActorHair(image.data)};if(map){map.image=pixels;map.needsUpdate=true;}return true;
    }).catch(e=>{if(!disposed)error=String(e?.message??e);return false;});
  }
  return {
    warm,
    status:()=>({ready:!!master&&!!pixels,pending:!!pending&&!master&&!error&&!disposed,error}),
    geometry(identity={}){
      if(disposed||!master||!pixels||!eligible(identity))return null;
      const p=master.position.slice(),n=master.normal.slice(),width=1+((identity.cheek??1)-1)*.2;
      for(let i=0;i<p.length;i+=3){p[i]*=width;n[i]/=width;const d=Math.hypot(n[i],n[i+1],n[i+2]);for(let k=0;k<3;k++)n[i+k]/=d;}
      const count=p.length/3,weights=new Float32Array(count*4),joints=new Uint16Array(count*4);for(let i=0;i<count;i++){weights[i*4]=1;joints[i*4]=1;}
      const g=new T.BufferGeometry();for(const [key,data,size]of [['position',p,3],['normal',n,3],['uv',master.uv.slice(),2],['skinWeight',weights,4]])g.setAttribute(key,new T.Float32BufferAttribute(data,size));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setIndex(new T.BufferAttribute(master.index.slice(),1));g.computeBoundingBox();g.computeBoundingSphere();g.userData={importedHair:true,source:'MakeHuman CC0 short04',identity:identity.key??'male'};return g;
    },
    acquire(){
      if(disposed)throw Error('Hair library disposed');refs++;
      if(!map){map=new T.DataTexture(pixels?.data??new Uint8Array([220,220,220,255]),pixels?.width??1,pixels?.height??1,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;map.flipY=true;map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.userData.source=ACTOR_HAIR_TEXTURE;map.needsUpdate=true;}
      void warm();return {map,normalMap:null,bumpMap:null,roughnessMap:null,bumpScale:0,roughness:.82,metalness:0,side:T.DoubleSide,alphaTest:.4,transparent:false,alphaToCoverage:true};
    },
    release(){if(refs>0)refs--;if(!refs&&map){map.dispose();map=null;}},
    dispose(){if(disposed)return;disposed=true;map?.dispose();map=null;master=pixels=null;refs=0;}
  };
}
const library=createActorHairLibrary();
export const warmActorHair=()=>library.warm();
export const actorHairStatus=()=>library.status();
export const actorHairGeometry=identity=>library.geometry(identity);
export const acquireActorHairSurface=identity=>library.acquire(identity);
export const releaseActorHairSurface=()=>library.release();
