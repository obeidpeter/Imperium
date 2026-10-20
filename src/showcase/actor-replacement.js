// Keep the visible actor alive until its replacement has been constructed and
// prepared. A failed quality/style rebuild must not leave a hole in the map.
export function replaceStageActor({actors,id,create,prepare,scene}){
  const previous=actors.get(id),candidate=create();
  try{prepare(candidate);scene.add(candidate.group);}
  catch(error){candidate.dispose();throw error;}
  actors.set(id,candidate);
  if(previous){scene.remove(previous.group);previous.dispose();}
  return candidate;
}
