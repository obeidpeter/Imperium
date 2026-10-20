// Pure geometry shared by movement, forecasts, AI and the extended rules.
export const fieldAt=(e,x,y)=>e.featureEdition===31?(e.field?.objects??[]).filter(o=>o.x===x&&o.y===y):[];
export const fieldBlocked=(e,x,y)=>fieldAt(e,x,y).some(o=>o.kind==='gate'&&o.state==='closed');
export const fieldSmoke=(e,x,y)=>e.featureEdition===31&&(e.field?.objects??[]).some(o=>o.state==='burning'&&Math.abs(o.x-x)+Math.abs(o.y-y)<=1);
export function fieldMoveCost(e,unit,x,y){
  const terrain=e.terrain?.[y]?.[x];
  return (terrain==='marsh'&&unit.formation!=='line'?2:1)+(e.featureEdition===31&&e.weather==='rain'&&terrain==='high'?1:0);
}
