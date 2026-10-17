// Separate immutable contract: the v1 operations remain untouched for old saves.
import {BATTLE_OPERATIONS} from './battle-operations.js';
const route=(id,label,description,last,reward,benefit)=>({id,label,description,last,reward,benefit});
export const PROGRESSION_OPERATIONS={
  'ch1-road':[
    route('pursue','Recover the stolen stores','Finish the raiders; recover two supplies. Their pursuit leaves no rested reserve.',null,{supplies:2},'stores'),
    route('screen','Cover the cart’s withdrawal','After forming the screen, bring the commander back to the western road. Gain public trust and a rested reserve; the raiders escape.',{id:'withdraw',label:'Cover the cart',objective:'Bring the commander back beside 1D; clear that approach so the cart can leave.',mode:'capture',goal:[0,3],points:[[0,3]],commander:true},{public:2},'reserve'),
  ],
  'ch2-rearguard':[
    route('withdraw','Save the rear files','Hold, then withdraw as ordered; rested survivors reinforce your next field action.',null,{public:2},'reserve'),
    route('counterattack','Break the pursuit','After screening the withdrawal, defeat the pursuing force. Gain army confidence and captured stores, but commit the reserve.',{id:'counterattack',label:'Break the pursuit',objective:'Defeat the remaining pursuers before leaving the field.',mode:'clear',goal:[2,4]},{army:3},'stores'),
  ],
  'ch3-station':[
    route('records','Bring the dispatches out','Recover the records and return; their intelligence delays the next announced reinforcement.',null,{political:2},'intelligence'),
    route('secure','Hold the station for couriers','After recovering the records, hold their approach for two rounds. Preserve the courier station and gain supplies.',{id:'couriers',label:'Secure the courier station',objective:'Hold the recovered-records approach for two rounds, or clear the enemy and reach it.',mode:'hold',goal:[6,1],hold:2},{supplies:2},'stores'),
  ],
  'ch4-gate':[
    route('evacuate','Evacuate the rear files','Extract the garrison; rested veterans strengthen the next battle.',null,{public:2},'reserve'),
    route('hold','Hold for the baggage train','Keep the gate approach for three more rounds instead of ordering the rear files out. Recover supplies at greater exposure.',{id:'baggage',label:'Wait for the baggage',objective:'Hold the gate for three rounds while the baggage escapes, or clear the enemy and reach it.',mode:'hold',goal:[2,3],hold:3},{supplies:3},'stores'),
  ],
  'ch5-mine':[
    route('engineers','Protect the engineers','Secure the shafts and protect the engineers. Their maps delay the next reinforcement.',null,{army:2},'intelligence'),
    route('assault','Exploit the breach','After securing the shafts, defeat the field force. Capture stores, committing the protective reserve.',{id:'assault',label:'Exploit the breach',objective:'Defeat the remaining troops around the mine.',mode:'clear',goal:[6,3]},{supplies:2},'stores'),
  ],
  'ch6-wells':[
    route('wells','Use the eastern wells','Rescue the protected party and reach the eastern wells. Preserve a rested reserve.',null,{public:2},'reserve'),
    route('rear-road','Withdraw along the rear road','Take the rescued party west to 1D rather than the eastern wells. Preserve reconnaissance reports, but accept the longer exposed route.',{id:'rear-road',label:'Return by the rear road',objective:'Escort the protected party and commander back to 1D; keep within four tiles.',mode:'extract',goal:[0,3]},{political:2},'intelligence'),
  ],
  'ch7-legion':[
    route('field','Conclude the field action','Take both approaches, then defeat the remaining force. Army confidence and captured stores follow.',null,{army:2},'stores'),
    route('consolidate','Consolidate the two approaches','After taking both approaches, hold the central ground for two rounds. Preserve the company for the next battle.',{id:'consolidate',label:'Hold the central ground',objective:'Hold 7E for two rounds, or clear the enemy and reach it; do not pursue dispersed troops.',mode:'hold',goal:[6,4],hold:2},{public:2},'reserve'),
  ],
  'ch8-ferry':[
    route('direct','Protect the direct crossing','Open the approach, then escort every household to the eastern road.',null,{public:2},'reserve'),
    route('southern','Use the southern landing','After opening the ferry, escort the households to the southern eastern landing. Protect the river scouts’ intelligence.',{id:'southern',label:'Reach the southern landing',objective:'Escort every column and commander to 8G; no column may be lost.',mode:'extract',goal:[7,6]},{political:2},'intelligence'),
  ],
  'ch8-crossing':[
    route('last-ferry','Guard the last ferry','Hold the bridgehead, then bring the last households across under raider pressure.',null,{public:2},'reserve'),
    route('stores','Guard the supply ferry','Hold the bridgehead, then escort the supply party from the southern landing under the same announced raid.',{id:'supply-ferry',label:'Protect the supply ferry',objective:'Escort the supply party and commander from 5G to 8D; fresh raiders approach from 8F.',mode:'extract',goal:[7,3],escort:{id:'supply-ferry',name:'Ferry supply party',at:[4,6],hp:24},wave:{delay:1,x:7,y:5,role:'raider'}},{supplies:3},'stores'),
  ],
  'ch9-city':[
    route('streets','Clear the streets','Take the gate, then defeat the remaining resistance. Capture stores for the province.',null,{army:2},'stores'),
    route('corridor','Keep a civilian corridor','After opening the gate, hold its approach for three rounds while civilians leave. Gain public confidence and preserve a reserve.',{id:'corridor',label:'Keep the civilian corridor',objective:'Hold 7D for three rounds, or clear the enemy and reach it; avoid pursuing through the city.',mode:'hold',goal:[6,3],hold:3},{public:3},'reserve'),
  ],
  'ch10-road':[
    route('grain','Defend the returning grain','Reopen both routes, then hold the stores against the last raid.',null,{public:2},'stores'),
    route('intercept','Intercept the last raiders','After reopening both routes, defeat the raiders before they can regroup. Their dispatches aid the final field action.',{id:'intercept',label:'Intercept the raiding force',objective:'Defeat the remaining force and the announced reinforcement.',mode:'clear',goal:[2,3],wave:{delay:1,x:7,y:4,role:'raider'}},{army:2},'intelligence'),
  ],
};
export function progressionOperationDefinition(id,choice){
  const base=BATTLE_OPERATIONS[id],branch=PROGRESSION_OPERATIONS[id]?.find(x=>x.id===choice);
  if(!base||!branch)return null;
  return {...base,extraTurns:base.extraTurns+(branch.last?3:0),branch,phases:base.phases.map((p,i)=>i===base.phases.length-1&&branch.last?branch.last:p)};
}
