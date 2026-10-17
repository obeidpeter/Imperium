// Authored objectives for new campaigns. Version-one operation definitions are
// immutable save contracts; future revisions must use a new operation version.
export const BATTLE_OPERATIONS={
  'ch1-road':{extraTurns:2,phases:[
    {id:'screen',label:'Form the road screen',objective:'Bring yourself and your companion within two tiles of 3D to screen the passing cart. Stay together before pursuing the raiders.',mode:'capture',goal:[2,3],points:[[2,3]],gather:2},
    {id:'clear',label:'Break the raiding party',objective:'The cart has passed your screen. Defeat the remaining raiders and the announced reinforcement.',mode:'clear',goal:[6,4]},
  ]},
  'ch2-rearguard':{extraTurns:2,phases:[
    {id:'screen',label:'Hold the withdrawal road',objective:'Keep the marker clear for two rounds, or clear the enemy and reach it, while the rear files pass.',mode:'hold',goal:[2,4],hold:2},
    {id:'withdraw',label:'Bring the commander out',objective:'Return to 1D with the commander. The rearguard must not become a pursuit.',mode:'capture',goal:[0,3],points:[[0,3]],commander:true},
  ]},
  'ch3-station':{extraTurns:4,phases:[
    {id:'recover',label:'Find the station records',objective:'Scout the ruined station, then reach the records at 7B.',mode:'recover',goal:[6,1]},
    {id:'return',label:'Return with the records',objective:'Carry the recovered records back to 4D with the commander; clear that approach.',mode:'capture',goal:[3,3],points:[[3,3]],commander:true},
  ]},
  'ch4-gate':{extraTurns:3,phases:[
    {id:'hold',label:'Cover the gate',objective:'Hold the gate approach for two rounds, or clear the enemy and reach it, while the rear files form.',mode:'hold',goal:[2,3],hold:2},
    {id:'withdraw',label:'Extract the rear files',objective:'Bring the rear files and commander to 1G. Keep within four tiles of the column.',mode:'extract',goal:[0,6],escort:{id:'rear-files',name:'Rear files of the garrison',at:[1,3],hp:22}},
  ]},
  'ch5-mine':{extraTurns:2,phases:[
    {id:'shafts',label:'Secure both shafts',objective:'Clear and occupy both marked mine approaches.',mode:'capture',goal:[6,3],points:[[4,1],[5,5]]},
    {id:'counterattack',label:'Cover the engineers',objective:'Protect the central approach for two rounds, or clear the enemy and reach the marker.',mode:'hold',goal:[6,3],hold:2},
  ]},
  'ch6-wells':{extraTurns:3,phases:[
    {id:'rescue',label:'Secure the stranded party',objective:'Reach the protected party and clear its approach. Assist anyone who cannot yet move.',mode:'capture',goal:'escort',points:'escort',rescue:true,pauseEscorts:true},
    {id:'extract',label:'Withdraw to the wells',objective:'Bring the protected party and commander to 8C, keeping within four tiles.',mode:'extract',goal:[7,2]},
  ]},
  'ch7-legion':{extraTurns:2,phases:[
    {id:'approaches',label:'Take both approaches',objective:'Use separate formations to secure the two marked approaches.',mode:'capture',goal:[6,4],points:[[5,1],[5,6]]},
    {id:'field',label:'Conclude the field action',objective:'Re-form the company and defeat the remaining opposition.',mode:'clear',goal:[6,4]},
  ]},
  'ch8-ferry':{extraTurns:4,phases:[
    {id:'ford',label:'Open the ferry approach',objective:'Secure 4D before the civilian columns enter the crossing. Keep a reserve for their protection.',mode:'capture',goal:[3,3],points:[[3,3]],pauseEscorts:true},
    {id:'cross',label:'Bring the households across',objective:'Escort every column and the commander to 8D. No column may be lost.',mode:'extract',goal:[7,3]},
  ]},
  'ch8-crossing':{extraTurns:5,phases:[
    {id:'bridgehead',label:'Hold the bridgehead',objective:'Hold the eastern marker for two rounds, or clear the enemy and reach it, so the final ferry party can land.',mode:'hold',goal:[4,4],hold:2},
    {id:'last-ferry',label:'Protect the last ferry party',objective:'The last ferry lands at 4D as fresh raiders approach from 8F. Escort the party and commander to 8D.',mode:'extract',goal:[7,3],escort:{id:'last-ferry',name:'Last ferry party',at:[3,3],hp:24},wave:{delay:1,x:7,y:5,role:'raider'}},
  ]},
  'ch9-city':{extraTurns:2,phases:[
    {id:'gate',label:'Open the city approach',objective:'Secure the gate at 7D.',mode:'capture',goal:[6,3],points:[[6,3]]},
    {id:'streets',label:'End the resistance',objective:'Defeat the remaining field troops so the civilians can approach safely.',mode:'clear',goal:[6,3]},
  ]},
  'ch10-road':{extraTurns:4,phases:[
    {id:'routes',label:'Reopen both grain routes',objective:'Secure both marked routes without losing the guarded stores.',mode:'supply',goal:[2,3],points:[[5,1],[5,6]]},
    {id:'stores',label:'Defend the returning grain',objective:'Return a reserve to the stores. Hold two rounds against the announced last raid, or clear the enemy and reach the marker.',mode:'hold',goal:[2,3],hold:2,wave:{delay:1,x:7,y:4,role:'raider'}},
  ]},
};
