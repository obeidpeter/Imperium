// The oath and the accession staged in 3D. Each is a small, fixed tableau
// built from the campaign's own figures on a synthetic board that the rules
// never see: the recruit swearing before Varro and the standard on the Danube
// parade ground, and the new Augustus acclaimed from a raised tribunal by the
// massed legions. Presentation only; both ends quote the one shared OATH.
const row=(text)=>[...text].map(t=>({'.':'grass','=':'road','^':'high','s':'stone'}[t]));
const legion=(id,x,y,extra={})=>({id,name:`Legion ${id.slice(-1)}`,role:'infantry',side:'ally',x,y,facing:'north',hp:24,maxHp:24,...extra});
export const CEREMONY_KINDS=Object.freeze(['oath','accession']);
export function ceremonyScene(kind,{name='Aurelius Marcellus',rank='Tiro',appearance=null}={}){
  if(kind==='oath'){
    const recruits=[1,2,4,5,6].map((x,i)=>({id:`recruit${i}`,name:'Recruit',role:'soldier',side:'ally',x,y:5,facing:'north',hp:10,maxHp:10}));
    const encounter={id:'ceremony-oath',ceremony:'oath',kind:'battle',title:'The oath · Novae parade ground',width:8,height:8,turn:1,
      terrain:['........','..ssss..','..ssss..','========','........','........','========','........'].map(row),
      units:[{id:'hero',name,role:'soldier',side:'player',x:3,y:5,facing:'north',hp:10,maxHp:10,...(appearance?{appearance:{...appearance}}:{})},{id:'varro',name:'Varro',role:'trainer',side:'ally',x:3,y:2,facing:'south',hp:20,maxHp:20},{id:'signifer',name:'Standard-bearer',role:'soldier',side:'ally',x:4,y:2,facing:'south',hp:12,maxHp:12},...recruits]};
    // Every voice recites together; the centurion holds out the words.
    const poses=Object.fromEntries([...recruits.map(r=>[r.id,'speak']),['hero','speak'],['varro','order']]);
    return {encounter,chapter:1,rank,poses,palettes:{},focus:{x:3,y:4}};
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
    return {encounter,chapter:12,rank:'Augustus',poses,palettes:{hero:{cloth:0x5a2152}},focus:{x:5,y:4.5}};
  }
  return null;
}
