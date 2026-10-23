// A model root does not exclusively own its geometry, materials or textures:
// GLTF meshes, LOD levels and different masters may share them. Reference each
// resource once per master, independently of the clones a stage draws.
const resourceOwners=new Map();
function retainResources(scene){
  const resources=new Set();
  scene.traverse(o=>{
    if(o.geometry)resources.add(o.geometry);
    for(const material of [o.material].flat().filter(Boolean)){
      resources.add(material);
      for(const value of Object.values(material))if(value?.isTexture){
        resources.add(value);
        const image=value.source?.data;if(image?.close)resources.add(image);
      }
    }
  });
  for(const resource of resources)resourceOwners.set(resource,(resourceOwners.get(resource)??0)+1);
  let released=false;
  return ()=>{
    if(released)return;released=true;
    for(const resource of resources){const n=resourceOwners.get(resource)-1;if(n>0)resourceOwners.set(resource,n);else{resourceOwners.delete(resource);resource.dispose?.();resource.close?.();}}
  };
}

/** Leases protect active stages and preloads; idle LRU masters are bounded.
 * Selecting a new chapter's working set retires its predecessors when their
 * last stage closes. An obsolete in-flight response is disposed on arrival,
 * without replacing a newer request for the same URL. */
export function createSceneryModelCache({maxIdle=12,load}={}){
  const entries=new Map();let clock=0,workingSet=null;
  const retire=entry=>{
    if(entry.retired)return;entry.retired=true;
    if(entries.get(entry.url)===entry)entries.delete(entry.url);
    entry.free?.();entry.scene=null;
  };
  const trim=()=>{
    for(const entry of entries.values())if(!entry.refs&&(!entry.scene||(workingSet&&!workingSet.has(entry.url))))retire(entry);
    const idle=[...entries.values()].filter(entry=>!entry.refs).sort((a,b)=>a.used-b.used);
    while(idle.length>Math.max(0,maxIdle))retire(idle.shift());
  };
  const ensure=(url,loader=load)=>{
    let entry=entries.get(url);if(entry)return entry;
    entry={url,scene:null,refs:0,used:++clock,retired:false,free:null};entries.set(url,entry);
    entry.promise=Promise.resolve().then(()=>loader(url)).then(scene=>{
      const free=retainResources(scene);
      if(entry.retired){free();return null;}
      entry.scene=scene;entry.free=free;trim();return entry.retired?null:scene;
    },error=>{retire(entry);throw error;});
    return entry;
  };
  const acquire=(url,loader)=>{
    const entry=ensure(url,loader);entry.refs++;entry.used=++clock;let released=false;
    return {get scene(){return entry.scene;},ready:entry.promise,
      release({discard=false}={}){if(released)return;released=true;entry.refs--;entry.used=++clock;if(discard&&!entry.refs)retire(entry);trim();}};
  };
  return {acquire,
    warm(url,loader){const lease=acquire(url,loader);workingSet?.add(url);return lease.ready.finally(()=>lease.release());},
    master:url=>entries.get(url)?.scene??null,
    setWorkingSet(urls){workingSet=new Set(urls);trim();},
    clear(){workingSet=new Set();trim();},
    stats(){const values=[...entries.values()];return {entries:values.length,loaded:values.filter(e=>e.scene).length,loading:values.filter(e=>!e.scene).length,leases:values.reduce((n,e)=>n+e.refs,0),idle:values.filter(e=>!e.refs).length};}
  };
}
