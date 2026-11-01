// The real-time field's one camera (release 12). It looks from the south-east toward the north-west, as the
// 2D view does, so up on the screen is north-west on the board in both views: the arrow keys, a drag and the
// map read the same in each. The turns' board keeps its own cameras. No three.js here: the 2D view
// (flat-stage.js) imports it too.
export const FIELD_YAW=Math.PI/4;
// The elevation of a true isometric view, about 35°. The 2D drawing is 30°; a perspective camera that low
// would look a long way past the soldier and too little round him.
export const FIELD_PITCH=Math.atan(Math.SQRT1_2);
// The orbits' axes at a bearing (the 3D stage's convention: the camera stands at the target plus
// distance × (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch); +x is east and +z south).
export const screenRight=yaw=>({x:Math.cos(yaw),z:-Math.sin(yaw)});
export const screenUp=yaw=>({x:-Math.sin(yaw),z:-Math.cos(yaw)});
// The bearing that turns a camera standing at `from` toward a point on the horizon.
export const bearingToward=(from,point)=>Math.atan2(from.x-point.x,from.z-point.z);
// A look away from the anchor kept inside the board's rectangle ({minX, maxX, minZ, maxZ}): the offset
// that puts the anchor plus it on the board.
export function boundedOffset(anchor,offset,bounds){
  if(!bounds)return {x:offset.x,z:offset.z};
  const x=Math.min(Math.max(anchor.x+offset.x,bounds.minX),bounds.maxX),z=Math.min(Math.max(anchor.z+offset.z,bounds.minZ),bounds.maxZ);
  return {x:x-anchor.x,z:z-anchor.z};
}
