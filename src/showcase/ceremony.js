// The oath and the accession staged in 3D. Each is a small, fixed tableau
// built from the campaign's own figures on a synthetic board that the rules
// never see: the recruit swearing before Varro and the standard on the Danube
// parade ground, and the new Augustus acclaimed from a raised tribunal by the
// massed legions. Presentation only; both ends quote the one shared OATH.
const row=(text)=>[...text].map(t=>({'.':'grass','=':'road','^':'high','s':'stone'}[t]));
const legion=(id,x,y,extra={})=>({id,name:`Legion ${id.slice(-1)}`,role:'infantry',side:'ally',x,y,facing:'north',hp:24,maxHp:24,...extra});
export const CEREMONY_KINDS=Object.freeze(['oath','accession']);
// Story beats, in place of a slow orbit: each frames one moment of the tableau (a board
// point, the height looked at, and the camera's yaw, pitch and distance) for `hold`
// seconds, then the camera moves to the next over `move` seconds (longer for a half turn
// round the tableau), and the last returns to the first. Presentation only: the beats read
// the stage's own clock, never the rules.
const beat=(id,[x,y],{yaw,pitch,distance,lift=1.1,hold=5,move=2.4})=>Object.freeze({id,focus:Object.freeze({x,y}),lift,yaw,pitch,distance,hold,move});
const OATH_BEATS=Object.freeze([
  beat('parade',[3.5,4],{yaw:-.62,pitch:.3,distance:17,hold:6}),       // the recruits drawn up before the standard
  beat('standard',[3.5,3],{yaw:.08,pitch:.16,distance:10,lift:1.6}),    // over the recruits' shoulders to Varro and the standard
  beat('words',[3,2],{yaw:-.3,pitch:.12,distance:5,lift:1.6,move:3.4}), // Varro holds out the words
  beat('voices',[3.5,5],{yaw:Math.PI-.5,pitch:.17,distance:10}),        // every voice recites together
  beat('recruit',[3,5],{yaw:Math.PI-.22,pitch:.1,distance:4.8,lift:1.45,move:3.4})]); // your soldier swears
const ACCESSION_BEATS=Object.freeze([
  beat('legions',[5.5,4.5],{yaw:.25,pitch:.32,distance:24,hold:6}),     // the legions drawn up before the tribunal
  beat('herald',[3,3],{yaw:-.35,pitch:.15,distance:7,lift:1.5}),        // the herald proclaims
  beat('witness',[7,3],{yaw:.35,pitch:.15,distance:7,lift:1.5,move:3.4}), // the Senate's witness assents
  beat('acclamation',[5.5,7.5],{yaw:Math.PI+.55,pitch:.28,distance:16}), // the legions acclaim him
  beat('augustus',[5,3],{yaw:-.15,pitch:.12,distance:5.5,lift:1.6})]);  // the new Augustus raises his hand
const ease=k=>k*k*(3-2*k),turn=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
function framing(a,b,k,index){
  const mix=(p,q)=>p+(q-p)*k;
  return {beat:k<.5?a.id:b.id,index,focus:{x:mix(a.focus.x,b.focus.x),y:mix(a.focus.y,b.focus.y)},lift:mix(a.lift,b.lift),
    yaw:turn(a.yaw,b.yaw,k),pitch:mix(a.pitch,b.pitch),distance:mix(a.distance,b.distance)};
}
/** The camera's framing `t` seconds into a ceremony's beats, looping; null without beats. */
export function ceremonyShot(beats,t=0){
  if(!beats?.length)return null;
  const cycle=beats.reduce((n,b)=>n+b.hold+b.move,0);let at=((Number.isFinite(t)?t:0)%cycle+cycle)%cycle;
  for(const [i,from] of beats.entries()){
    if(at<from.hold)return framing(from,from,0,i);at-=from.hold;
    if(at<from.move)return framing(from,beats[(i+1)%beats.length],ease(at/from.move),i);at-=from.move;
  }
  return framing(beats[0],beats[0],0,0);
}
// The scene opens on its first beat (stage-camera.js home()).
const opening=beats=>({beats,focus:beats[0].focus,yaw:beats[0].yaw,pitch:beats[0].pitch,distance:beats[0].distance});
export function ceremonyScene(kind,{name='Aurelius Marcellus',rank='Tiro',appearance=null}={}){
  if(kind==='oath'){
    const recruits=[1,2,4,5,6].map((x,i)=>({id:`recruit${i}`,name:'Recruit',role:'soldier',side:'ally',x,y:5,facing:'north',hp:10,maxHp:10}));
    const encounter={id:'ceremony-oath',ceremony:'oath',kind:'battle',title:'The oath · Novae parade ground',width:8,height:8,turn:1,
      terrain:['........','..ssss..','..ssss..','========','........','........','========','........'].map(row),
      units:[{id:'hero',name,role:'soldier',side:'player',x:3,y:5,facing:'north',hp:10,maxHp:10,...(appearance?{appearance:{...appearance}}:{})},{id:'varro',name:'Varro',role:'trainer',side:'ally',x:3,y:2,facing:'south',hp:20,maxHp:20},{id:'signifer',name:'Standard-bearer',role:'soldier',side:'ally',x:4,y:2,facing:'south',hp:12,maxHp:12},...recruits]};
    // Every voice recites together; the centurion holds out the words.
    const poses=Object.fromEntries([...recruits.map(r=>[r.id,'speak']),['hero','speak'],['varro','order']]);
    return {encounter,chapter:1,rank,poses,palettes:{},...opening(OATH_BEATS)};
  }
  if(kind==='accession'){
    const encounter={id:'ceremony-accession',ceremony:'accession',kind:'battle',title:'The accession · Rome',width:12,height:10,turn:1,
      terrain:['ssssssssssss','ssssssssssss','sss^^^^^^sss','sss^^^^^^sss','ssssssssssss','ssssssssssss','ss========ss','ssssssssssss','ss========ss','ssssssssssss'].map(row),
      units:[{id:'hero',name,role:'commander',side:'player',x:5,y:3,facing:'south',hp:26,maxHp:26,...(appearance?{appearance:{...appearance}}:{})},
        legion('legion1',2,7),legion('legion2',5,7),legion('legion3',8,7),legion('legion4',9,5,{facing:'west'}),legion('legion5',1,5,{facing:'east'}),legion('legion6',10,8),
        {id:'acclamation-herald',name:'Herald',role:'voter',bloc:'Civic',side:'ally',x:3,y:3,facing:'south',hp:10,maxHp:10},
        {id:'acclamation-senator',name:'Senatorial witness',role:'voter',bloc:'Landholders',side:'ally',x:7,y:3,facing:'south',hp:10,maxHp:10}]};
    // The legions acclaim; the emperor raises his hand to them.
    const poses=Object.fromEntries([...encounter.units.filter(u=>u.id!=='hero').map(u=>[u.id,'rally']),['hero','order']]);
    poses['acclamation-herald']='speak';poses['acclamation-senator']='assent';
    return {encounter,chapter:12,rank:'Augustus',poses,palettes:{hero:{cloth:0x5a2152}},...opening(ACCESSION_BEATS)};
  }
  return null;
}
