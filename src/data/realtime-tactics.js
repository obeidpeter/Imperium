// Campaign tactical identity. Existing mission modes and deadlines remain the
// contract; these priorities change what the opposing army contests, not rules.
const freeze=Object.freeze;
export const TACTICAL_IDENTITIES=freeze([
  freeze({chapter:1,id:'road-patrol',label:'Keep the road watch together',pressure:'line',bias:'fix'}),
  freeze({chapter:2,id:'casualty-causeway',label:'Screen the wounded on the causeway',pressure:'escort',bias:'flank-left'}),
  freeze({chapter:3,id:'courier-screen',label:'Break the courier cordon',pressure:'objective',bias:'feint'}),
  freeze({chapter:4,id:'gate-reserve',label:'Hold the gate and its relief route',pressure:'objective',bias:'early-reserve',support:'engineer'}),
  freeze({chapter:5,id:'siege-sortie',label:'Cover the engineers through the siege works',pressure:'works',bias:'late-reserve',support:'engineer'}),
  freeze({chapter:6,id:'eagle-rearguard',label:'Withdraw together under pursuit',pressure:'escort',bias:'fix'}),
  freeze({chapter:7,id:'milan-wings',label:'Refuse one wing and turn the other',pressure:'flanks',bias:'pincer',support:'cavalry'}),
  freeze({chapter:8,id:'river-screen',label:'Keep the landing clear for civilians',pressure:'escort',bias:'flank-right',support:'engineer'}),
  freeze({chapter:9,id:'mounted-counterstroke',label:'Brace against horse, then countercharge',pressure:'flanks',bias:'feint',support:'cavalry'}),
  freeze({chapter:10,id:'grain-interdiction',label:'Guard grain roads and exposed stores',pressure:'objective',bias:'flank-left',support:'engineer'}),
  freeze({chapter:11,id:'civic-testimony',label:'Account for service before the Senate',pressure:'civic',bias:'fix'}),
  freeze({chapter:12,id:'accession-reserve',label:'Keep a reserve for the claimant’s final commitment',pressure:'reserve',bias:'late-reserve',support:'cavalry'})
]);
export const tacticalIdentity=chapter=>TACTICAL_IDENTITIES[Math.max(1,Math.min(12,Math.floor(chapter)||1))-1];
// nearBest/bestLean (squad-ai.js planDoctrine): strong evidence (3 points or more) decides the
// plan; plans within nearBest points of the best also enter the ai-stream draw, the best at
// bestLean times its weight, so a mild preference leans the draw instead of fixing it.
export const ADAPTIVE_TACTICS=freeze({senseRange:55,maxWatchers:8,maxTargets:16,flankProbe:9,flankSteps:5,
  weakStrength:.68,shakenMorale:40,supportedRange:10,objectiveRange:14,nearBest:1,bestLean:2});
export const MOUNTED_PACE=freeze({walk:1.35,run:1.55,rough:1.05});

// Substitute a detail for one existing non-archer ally, preserving the original
// unit ID, strength and campaign record. Older restored worlds keep their roles.
export function realtimeAlliedRole(chapter,encounter,unit){
  if(unit.side!=='ally'||!['infantry','soldier','guard'].includes(unit.role)||encounter.type==='training')return unit.role;
  const role=tacticalIdentity(chapter).support;if(!role)return unit.role;
  const eligible=encounter.units.filter(u=>u.side==='ally'&&u.hp>0&&['infantry','soldier','guard'].includes(u.role));
  const chosen=role==='engineer'?eligible.at(-1):eligible[0];return chosen?.id===unit.id?role:unit.role;
}
