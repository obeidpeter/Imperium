// Authored campaign additions. Public historical outcomes remain in campaign.js.
export const FIELD_THEMES = [
  {landmark:'The Danube watchtower',weather:'clear'},
  {landmark:'The evacuation shrine',weather:'mist'},
  {landmark:'The broken milestone',weather:'rain'},
  {landmark:'The legionary signal mast',weather:'dust'},
  {landmark:'The siege gate',weather:'embers',wide:true},
  {landmark:'The eagle memorial',weather:'mist'},
  {landmark:'The imperial road station',weather:'clear'},
  {landmark:'The river customs house',weather:'rain',wide:true},
  {landmark:'The eastern caravan arch',weather:'dust',wide:true},
  {landmark:'The provincial granary',weather:'rain'},
  {landmark:'The civic rostrum',weather:'clear'},
  {landmark:'The city approach',weather:'clear',wide:true}
];

export const POLICY_MOTIONS = [
  {id:'provision',label:'Public provisioning',interest:'grain',opposition:'office',cost:2,
    description:'Reserve grain for civilian relief. Grain delegates gain 2 stance; office delegates lose 1.',
    effect:'Future battles: protected columns begin with 3 extra health. On enactment: Public Confidence +3.',
    amendment:'Independent stewards: the rival accepts a smaller relief fund. Cost 1 supply; grain +1, law +1; columns gain 1 health; Public +1.'},
  {id:'service',label:'Veterans’ service charter',interest:'service',opposition:'grain',cost:2,
    description:'Fund the veterans’ muster. Service delegates gain 2 stance; grain delegates lose 1.',
    effect:'Future battles: friendly cohesion starts 10 higher. On enactment: Army Loyalty +3.',
    amendment:'Phased muster: cost 1 supply; service +1, security +1; starting cohesion +5; Army +1.'},
  {id:'audit',label:'Provincial accounts audit',interest:'law',opposition:'office',cost:1,
    description:'Publish provincial accounts. Law delegates gain 2 stance; office delegates lose 1.',
    effect:'Each later victorious battle recovers 1 supply. On enactment: Political Backing +3.',
    amendment:'Council oversight: no supply cost; law +1, office +1; Political +1 on enactment, with no later supply recovery.'}
];
