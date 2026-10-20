// Edition 34 is an immutable campaign contract layered over edition 31.
// Opportunities change the current field; no optional opportunity awards victory.
export const OPERATIONAL_PLANS = [
  {id:'balanced',label:'Keep the company together',cost:0,description:'Normal deployment, cohesion and marching pace. No supplies spent.'},
  {id:'recon',label:'Send a reconnaissance detail',cost:1,description:'Reveal concealed enemies and delay announced reinforcements by one round. The dispersed friendly formations begin with 10 less cohesion.'},
  {id:'engineers',label:'Bring the engineer train',cost:2,description:'Open the side gate, repair the damaged bridge and add 15 defended integrity. The train costs the commander one movement point for this battle.'},
  {id:'reserve',label:'Keep a command reserve',cost:2,description:'From Chapter IV, gain one command per round (maximum eight) and 10 friendly cohesion. The commander carries one fewer javelin.'},
];

const opportunity=(label,effect,description)=>({label,effect,description});
export const COMMAND_CHAPTERS = [
  {id:1,doctrine:'approach',label:'Boundary patrol',purpose:'Stay together and learn the line before pursuit.',opportunities:[
    opportunity('Recover the miller’s cart','stores','Recover two supplies on victory.'),
    opportunity('Call the road watch','cohesion','Restore 15 friendly cohesion and earn two Army Loyalty on victory.')]},
  {id:2,doctrine:'pursuit',label:'Pursuit through the marsh',purpose:'Raiders seek exposed survivors; screen the causeway.',opportunities:[
    opportunity('Recover the casualty satchels','medicine','Restore three health to every living friendly formation and protected column.'),
    opportunity('Mark the safe causeway','escort','Protected columns can move up to three tiles per round, within three tiles of the commander and clear of visible enemies.')]},
  {id:3,doctrine:'screen',label:'The courier cordon',purpose:'The enemy screens the station while its archers cover the approaches.',opportunities:[
    opportunity('Recover the courier dispatches','intelligence','Reveal concealed enemies and delay remaining announced reinforcements by one round.'),
    opportunity('Light the false beacon','disrupt','Reduce every visible enemy’s cohesion by 15.')]},
  {id:4,doctrine:'siege',label:'Pressure at the gate',purpose:'The assault seeks the guarded approach; retain a reserve beside the road.',opportunities:[
    opportunity('Restore the gate bracing','integrity','Restore 20 defended integrity, up to 100.'),
    opportunity('Assemble the rear files','escort','Protected columns move up to three tiles per round while staying near their commander and out of enemy adjacency.')]},
  {id:5,doctrine:'siege',label:'Counterattack at the mine',purpose:'The garrison defends the shafts; a reserve guards the second approach before joining the assault.',opportunities:[
    opportunity('Recover the engineers’ plans','engineering','Open the side gate and repair the footbridge, creating two alternatives to the central approach.'),
    opportunity('Organize the water detail','water','Extinguish every burning pitch brazier and restore two health to living friendly formations and protected columns.')]},
  {id:6,doctrine:'pursuit',label:'The broken army',purpose:'Pursuers threaten the column; the eagle’s guard must protect its withdrawal.',opportunities:[
    opportunity('Gather the surviving medics','medicine','Restore three health to every living friendly formation and protected column.'),
    opportunity('Raise the recovered standard','standard','Restore 20 cohesion and 10 morale to every living friendly formation.')]},
  {id:7,doctrine:'pincer',label:'Two approaches to Milan',purpose:'Missile troops pin the center while mobile troops seek a lateral approach.',opportunities:[
    opportunity('Intercept the deployment orders','intelligence','Reveal concealed enemies and delay remaining announced reinforcements by one round.'),
    opportunity('Commit the reserve officers','command','Gain one command now and one per later round, up to eight.')]},
  {id:8,doctrine:'interdiction',label:'The contested crossing',purpose:'Raiders target exposed civilian columns; screens must survive the crossing.',opportunities:[
    opportunity('Repair the landing boats','engineering','Open the side gate and repair the footbridge to relieve pressure at the ford.'),
    opportunity('Post the river guides','escort','Protected columns move up to three tiles per round, near their commander and clear of enemy adjacency.')]},
  {id:9,doctrine:'countercharge',label:'The cavalry reserve',purpose:'Mounted troops look for flanks; a braced front can stop and answer their charge.',opportunities:[
    opportunity('Stake the cavalry approaches','anti-charge','Enemy mounted charges lose their extra damage for the rest of the encounter.'),
    opportunity('Harass the exhausted squadrons','disrupt','Reduce every visible enemy’s cohesion by 15.')]},
  {id:10,doctrine:'interdiction',label:'The grain roads',purpose:'Raiders prize exposed columns and unguarded stores over a costly frontal fight.',opportunities:[
    opportunity('Secure the granary receipts','stores','Recover two supplies on victory; the receipts become evidence of accountable provisioning.'),
    opportunity('Organize the village watch','integrity','Restore 20 defended integrity, up to 100.')]},
  {id:11,doctrine:'screen',label:'Service before the Senate',purpose:'Present evidence earned in the field; each case strengthens one coalition and tests another.',opportunities:[
    opportunity('Record the service rolls','intelligence','Reveal concealed enemies and delay remaining reinforcements.'),
    opportunity('Assemble the civic witnesses','standard','Restore friendly morale and cohesion.')]},
  {id:12,doctrine:'reserve',label:'The last field command',purpose:'The rival holds a reserve before committing; the chosen accession route remains the objective.',opportunities:[
    opportunity('Secure the relief provisions','medicine','Restore three health to every living friendly formation and protected column.'),
    opportunity('Raise the common oath','standard','Restore 20 cohesion and 10 morale to every living friendly formation.')]},
];

const caseOf=(id,label,requirement,interest,opposition,description)=>({id,label,requirement,interest,opposition,description});
export const ISSUE_CASES = {
  'ch7-council':[
    caseOf('company-roll','The company’s service roll','service','service','office','Name the formations that returned from the frontier. Veterans gain support; office holders resist command based on service.'),
    caseOf('survivor-witness','A survivor speaks for the march','companion','security','office','Your surviving comrade testifies to the cost of keeping the company together.')],
  'ch8-parley':[
    caseOf('protected-families','Safe conduct for the households','rescue','grain','office','Use the rescue record to argue for civilian passage before private tolls.'),
    caseOf('border-record','A documented crossing','records','law','security','Recovered dispatches support supervised passage; security delegates object to the concession.')],
  'ch10-tribunal':[
    caseOf('shared-tenure','The recorded tenure judgment','judgment','law','office','Present the public land judgment rather than leaving relief to private patronage.'),
    caseOf('grain-receipts','The grain-road receipts','provision','grain','office','Account for the relief convoys and recovered stores; provision takes priority over appointments.')],
  'ch11-accounts':[
    caseOf('veteran-testimony','The veterans answer the audit','service','service','office','A record of completed deployments answers claims that your honors were purchased.'),
    caseOf('public-accounts','Open the provincial accounts','judgment','law','office','The provincial judgment and allocation make the administration answerable in public.')],
  'ch11-adlection':[
    caseOf('earned-office','Service as a claim to office','service','service','office','Argue that responsibility should follow proven command rather than inherited patronage.'),
    caseOf('provincial-guarantee','A guarantee to the province','judgment','law','security','Bring a recorded provincial settlement to Rome; security hardliners question the guarantees.')],
  'ch12-legitimacy':[
    caseOf('common-oath','The company renews its testimony','companion','security','office','The surviving company stands behind an accession accountable to those who served.'),
    caseOf('civilian-record','The people preserved on the road','rescue','grain','office','Make the protected households and public relief part of the claim to rule.')],
};
