// Original, optional world context. These views read the campaign's existing
// decisions; they never create another task, reward, currency or saved flag.
const context=(purpose,inspection,placeNames,choices)=>Object.freeze({purpose,inspection,placeNames:Object.freeze(placeNames),choices:Object.freeze(choices)});
const places=(gate,principia,quartermaster,drill,valetudinarium,barracks,canabae)=>({gate,principia,quartermaster,drill,valetudinarium,barracks,canabae});
const choice=(text,kind,place,state)=>Object.freeze({text,kind,place,state});
// Authored 2×2 fine-cell pockets (5×5 m). Reachability tests protect all
// conversations, service arrivals and the gate from these solid footprints.
const PAD_CORNERS={1:[[20,7],[21,12],[20,20]],2:[[20,5],[20,13],[17,20]],3:[[22,5],[21,12],[18,20]],
  4:[[15,1],[12,9],[16,13]],6:[[13,1],[1,6],[13,12]],7:[[1,1],[15,6],[9,12]],8:[[6,3],[13,7],[9,7]],
  9:[[15,1],[12,9],[16,13]],10:[[13,1],[1,6],[13,12]],11:[[1,1],[15,6],[9,12]],12:[[6,3],[13,7],[9,7]]};
export const CAMP_SCENERY_PADS=Object.freeze(Object.fromEntries(Object.entries(PAD_CORNERS).map(([chapter,corners])=>[chapter,Object.freeze(corners.map(([x,y],i)=>
  Object.freeze({id:['world-supply','world-water','world-local'][i],kind:['supplies','water','local'][i],cells:Object.freeze([[x,y],[x+1,y],[x,y+1],[x+1,y+1]].map(Object.freeze))})))])));
export const CAMP_CONTEXT=Object.freeze({
  1:context('Learn the camp, settle the lost javelin, and prepare for the boundary road.',
    'Boot marks cross the drill sand. Beyond the standards, the Danube carries timber downstream; the recruit’s world is still small enough to walk across.',
    places('Boundary-road gate','Standards court','Recruit stores','Varro’s drill yard','Orderly’s shelter','Recruit tent lines','Riverside sutlers'),{
      report:choice('The corrected javelin tally lies open at the standards; your name is written beside the report.','ceremony','principia','honest-tally'),
      cover:choice('A replacement javelin is laid beside the stores; you and Lucan have accepted its cost.','stores','quartermaster','shared-cost')}),
  2:context('Gather the survivors and prepare the retreat through the marsh.',
    'Wet cloaks hang beside the causeway. Broken shields and a casualty roll keep the retreat’s cost visible; a local escape cannot reverse the defeat at Abritus.',
    places('Causeway exit','Survivors’ command table','Salvaged stores','Dry-ground assembly','Casualty shelter','Survivors’ tent lines','Causeway traders'),{
      carry:choice('A carrying litter is readied at the casualty shelter. Lucan will need protection on the way out.','refugees','valetudinarium','rescue-litter'),
      leave:choice('The casualty roll retains Lucan’s name. Sabinus gathers the survivors who can still march.','ceremony','barracks','names-retained')}),
  3:context('Check the road station, recover the dispatches, and decide who signs the report.',
    'A spare copy of the station roll dries beside the clerk. The well and wagon road share the same small court; illness has made ordinary work uncertain.',
    places('Courier-road gate','Station records','Road stores','Scout’s yard','Station infirmary','Courier quarters','Well court'),{
      claim:choice('Your own name heads the recovery report on the clerk’s table.','ceremony','principia','own-signature'),
      share:choice('Crispus’s presentation copy rests beside his written acknowledgement of your work.','ceremony','principia','paired-records')}),
  4:context('Set the outwork order, prepare the reserve, and hold the frontier crossing.',
    'The postern opens toward the ford. Stacked bracing timber and the reserve’s waiting shields show how little separates a held gate from a broken line.',
    places('Ford gate','Outwork command shelter','Fort granary','Reserve assembly','Wall aid station','Garrison quarters','Postern waiting court'),{
      withdraw:choice('The postern route is marked for the outwork’s defenders; reserve space is kept clear for their return.','refugees','canabae','open-postern'),
      hold:choice('The outwork order remains at the command shelter; the granary is secured for the stand.','stores','quartermaster','held-stores')}),
  5:context('Prepare the fortress defence and the households’ river route.',
    'The courtyard joins the mine works, water detail and river route. This is a fictional Euphrates fortress, inspired by Dura-Europos.',
    places('Field gate','Command shelter','Supply court','Formation yard','Aid shelter','Company muster','Evacuation shelter'),{}),
  6:context('Choose the retreat order and bring the eagle’s column through the broken army.',
    'The eagle’s covered stand faces west. Spare sandals, water vessels and an orderly’s litter sit ready for a retreat, not a triumph over the army that captured Valerian.',
    places('Western road','Retreat command awning','Column stores','Eagle assembly','Survivors’ aid awning','Rear-guard muster','Refuge beside the road'),{
      save:choice('The western route is laid out beside the eagle’s stand; the column prepares to reach Varro’s guard.','ceremony','drill','westward-standard'),
      obey:choice('The sealed rear-guard order lies at the command awning. Varro’s place in the assembly is empty.','ceremony','principia','sealed-order')}),
  7:context('Set the legion’s preparation and decide how to answer the plot before Milan.',
    'Courier tables and folded standards fill a restrained command camp. The council and the field are close together here; neither can prevent Gallienus’s historical death.',
    places('Milan road','Legion council awning','Legion supply court','Reserve officers’ yard','Legion infirmary','Cohort muster','Couriers’ court'),{
      warn:choice('A warning dispatch has left the courier table; the legion waits for news it cannot control.','ceremony','canabae','warning-dispatch'),
      refuse:choice('The legion’s sealed orders keep it outside the plot; the courier table carries no pledge to the conspirators.','ceremony','principia','independent-orders'),
      join:choice('The pledged silence is entered beside the officers’ sealed letters; its obligation remains on your ledger.','ceremony','principia','pledged-silence')}),
  8:context('Agree the crossing terms, assign the ferry priority, and protect the columns.',
    'Landing ropes, waiting bundles and the ferrymen’s tallies divide the bank into small queues. The game’s households are fictional; withdrawal did not mean every inhabitant left Dacia.',
    places('Ferry approach','Crossing terms shelter','Ferry stores','River-guard muster','Landing aid station','Crossing veterans','Households’ waiting bank'),{
      families:choice('Household bundles stand nearest the landing. The protected-farms pledge is entered with their names.','refugees','canabae','families-first'),
      soldiers:choice('The veterans’ equipment is placed nearest the landing; households wait behind the ferry tally.','stores','quartermaster','soldiers-first')}),
  9:context('Choose the surrender terms and an operational stratagem for the next field.',
    'An envoy’s shaded court faces the cavalry assembly. Stores are counted before the approach; the terms concern this fictional city, not a reversal of Palmyra’s recorded fate.',
    places('City approach','Campaign command shade','Requisition court','Cavalry assembly','Field surgeons’ shade','Veteran muster','Envoys’ court'),{
      mercy:choice('The surrender terms protect households and grain markets; an open route is marked for the city’s envoys.','refugees','canabae','protected-market'),
      severity:choice('Seizure tallies are prepared at the requisition court; the envoys wait under the imposed terms.','stores','quartermaster','seizure-tallies')}),
  10:context('Allocate the six relief convoys, enter the land judgment, and hear the province.',
    'Grain receipts share a courtyard with survey markers and petitions. The governor’s work is visible in the same stores and farms that must live with the written judgment.',
    places('Provincial road','Governor’s hearing court','Relief granary','Escort assembly','Public aid shelter','Governor’s guard','Petitioners’ arcade'),{
      shared:choice('Two sets of household names are laid beside the survey markers for shared tenure. The formal judgment still needs entering.','justice','canabae','shared-tenure'),
      settlers:choice('The displaced households’ title rolls lead the petition table. The formal judgment still needs entering.','justice','canabae','settler-title')}),
  11:context('Prepare the service record and gather backing for the emperor’s grant of admission.',
    'Service tablets, witness seats and a quiet portico replace the field’s baggage. Work on Aurelian’s walls remains visible beyond the court; this chapter precedes his assassination.',
    places('Hearing entrance','Service records table','Household stores','Speakers’ practice court','Household aid room','Escort court','Witness portico'),{
      independent:choice('Your own service tablets occupy the records table; the witness seats carry no new patronage pledge.','ceremony','principia','independent-record'),
      patron:choice('The patron’s sealed recommendation lies beside the service record; the promised supply office remains a debt.','ceremony','principia','patron-record')}),
  12:context('Resolve the remaining obligations, win recognition, and choose the final march.',
    'Folded standards wait beside the decree table. The old military oath remains unchanged; the coming succession deliberately departs from history after Aurelian’s death.',
    places('Final-march gate','Decree and obligations table','Accession stores','Loyal standards court','Veterans’ aid shelter','Loyal legion muster','Envoys’ waiting court'),{
      honour:choice('Settlement copies and honoured obligations are laid out for the envoys. Victory is still to be earned.','justice','canabae','lawful-settlement'),
      release:choice('Submission terms and confiscation rolls are laid before the envoys. Victory is still to be earned.','justice','principia','unconditional-terms')})
});

// Only these named details can be shown by the renderer after a won encounter
// appears both in history and in the command record. A selected plan is not a
// completed opportunity. `stores` and `signal` are the existing opportunity IDs.
export const CAMP_FIELD_DETAILS=Object.freeze({
  1:{stores:choice('The recovered cart’s stores are counted at the recruit stores.','stores','quartermaster','recovered-cart'),signal:choice('The road watch’s shields are stacked beside the boundary gate.','ceremony','gate','road-watch')},
  2:{stores:choice('Recovered casualty satchels are laid beside the aid shelter.','water','valetudinarium','casualty-satchels'),signal:choice('The safe causeway markers have been brought back to the route table.','engineering','principia','causeway-markers')},
  3:{stores:choice('Recovered dispatch cases rest beside the station records.','ceremony','principia','courier-cases'),signal:choice('A spent beacon basket stands beside the scout’s report.','engineering','drill','spent-beacon')},
  4:{stores:choice('Used gate braces lie beside the engineer’s tally.','engineering','quartermaster','gate-bracing'),signal:choice('The assembled rear files have returned their marked shields to the muster.','ceremony','barracks','rear-files')},
  6:{stores:choice('The gathered medics have added their satchels to the aid awning.','water','valetudinarium','medics-gathered'),signal:choice('The recovered standard stands beside the eagle’s assembly.','ceremony','drill','standard-recovered')},
  7:{stores:choice('Intercepted deployment orders are copied at the council table.','ceremony','principia','orders-recovered'),signal:choice('The reserve officers’ marked shields rest at the assembly.','ceremony','drill','reserve-officers')},
  8:{stores:choice('Repaired landing gear is stacked above the waterline.','engineering','quartermaster','landing-repaired'),signal:choice('The river guides’ poles stand at the waiting bank.','refugees','canabae','river-guides')},
  9:{stores:choice('Recovered approach stakes are tied beside the cavalry assembly.','engineering','drill','approach-stakes'),signal:choice('The returning harriers have left their field tally at the command shade.','ceremony','principia','harriers-returned')},
  10:{stores:choice('The secured granary receipts are displayed beside the relief stores.','stores','quartermaster','granary-receipts'),signal:choice('The village watch’s marked shields stand in the hearing court.','ceremony','principia','village-watch')},
  12:{stores:choice('The secured relief provisions are laid beside the veterans’ aid shelter.','water','valetudinarium','relief-provisions'),signal:choice('The loyal files set their standards beside the shared oath.','ceremony','drill','common-oath')}
});
