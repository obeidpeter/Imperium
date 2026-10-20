import * as T from '../../vendor/three/three.module.js';
const clamp=n=>Math.max(0,Math.min(1,n));
// Peak at the shared melee impact (230ms in a 620ms attack).
export function contactWeight(progress){const impact=230/620;return Math.sin(Math.PI*clamp((progress-(impact-.20))/.40))**2;}

/** Bounded two-joint CCD toward the committed recipient's actual shield/body.
 * Actor.update restores animation bones on the next frame. This solver only
 * touches presentation bones, never tile coordinates or combat outcomes. */
export function solveWeaponContact(actor,target,weight){
  const tip=actor?.contacts?.weapon,shoulder=actor?.group.getObjectByName('right-shoulder');
  if(!tip||!shoulder||weight<=0)return 0;
  const elbow=shoulder.getObjectByName('elbow'),position=new T.Vector3(),end=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),axis=new T.Vector3(),q=new T.Quaternion(),parent=new T.Quaternion();
  let corrected=0;
  for(let pass=0;pass<2;pass++)for(const joint of [elbow,shoulder].filter(Boolean)){
    actor.group.updateMatrixWorld(true);joint.getWorldPosition(position);tip.getWorldPosition(end);
    a.copy(end).sub(position).normalize();b.copy(target).sub(position).normalize();axis.crossVectors(a,b);if(axis.lengthSq()<1e-8)continue;axis.normalize();
    const angle=Math.min(.24*weight,Math.acos(Math.max(-1,Math.min(1,a.dot(b)))));joint.parent.getWorldQuaternion(parent).invert();axis.applyQuaternion(parent);q.setFromAxisAngle(axis,angle);joint.quaternion.premultiply(q);corrected++;
  }
  actor.group.updateMatrixWorld(true);return corrected;
}
export function applyPairedContacts(actors,frame,timeline){
  if(!frame||!timeline)return 0;let pairs=0;
  for(const track of timeline.tracks??[]){
    if(!['attack','cavalry-attack'].includes(track.pose)||!track.target||frame.time<track.start||frame.time>=track.start+track.duration)continue;
    const source=actors.get(track.unitId),recipientId=Object.entries(timeline.units??{}).find(([,p])=>p.after.x===track.target.x&&p.after.y===track.target.y)?.[0],recipient=actors.get(recipientId);
    if(!source||!recipient||source.painted||recipient.painted)continue;
    const progress=(frame.time-track.start)/track.duration,weight=contactWeight(progress),defended=(timeline.effects??[]).some(e=>e.type==='shield'&&e.defended!==false&&Math.abs(e.start-(track.start+track.duration*230/620))<1&&e.at?.x===track.target.x&&e.at?.y===track.target.y),anchor=defended?recipient.contacts.shield:recipient.contacts.body;
    if(!anchor)continue;recipient.group.updateMatrixWorld(true);const point=anchor.getWorldPosition(new T.Vector3());if(!defended)point.y+=.24;
    if(solveWeaponContact(source,point,weight))pairs++;
  }return pairs;
}
