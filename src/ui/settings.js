import {GRAPHICS_MODES,FIGURE_STYLES,defaultGraphicsMode} from './graphics-quality.js';
import {audioLevel} from './audio.js';
import {controlBindings,holdDelay} from './control-preferences.js';
import {ALL_CHAPTERS,normalizeControls} from '../core/controls-model.js';

// The legacy key keeps existing players' preferences.
export const SETTINGS_KEY='sacramentum.settings';

// First launch: the 3D view, no sound, coaching and the field guide on, and one
// click walks. `device` is what the first quality and motion respect: reduced
// motion, Save-Data, the memory the browser reports and a phone-sized touch screen.
export function defaultSettings({reducedMotion=false,saveData,deviceMemory,phone}={}){
  return {
    battleView:'3d',textScale:1,
    audio:false,audioVolume:.5,music:false,ambience:false,voices:false,soundtrackVolume:.45,
    coach:true,guide:true,
    adaptiveResolution:true,figureStyle:'sculpted',actionCamera:true,battleRemains:true,
    confirmMoves:false,fastMotion:false,reducedMotion,
    // The 0.40 conversion's development switch (core/controls-model.js): 0.38 turns until it is changed.
    controlsModel:'turns',realtimeChapters:[...ALL_CHAPTERS],
    // Real time (the guide's Time and pace, and Controls): game speed, the auto-pause events and the pointer's habits.
    // The pace follows the chronicle's difficulty until the player changes it (paceChosen; followDifficulty below).
    ...paceDefaults('standard'),roundPause:false,panelPause:true,paceChosen:false,
    drawToAttack:true,keepFighting:false,quickCast:false,holdToMove:true,swapButtons:false,
    quality:defaultGraphicsMode({saveData,deviceMemory,phone})
  };
}

// The stored preferences (a JSON string, or nothing) over the defaults, each
// unknown or out-of-range value repaired.
export function loadSettings(stored,device){
  const defaults=defaultSettings(device);let saved={};
  try{saved=JSON.parse(stored||'{}');}catch{}
  const settings={...defaults,...(saved&&typeof saved==='object'?saved:{})};
  if(!FIGURE_STYLES.includes(settings.figureStyle))settings.figureStyle='sculpted';
  if(!Object.hasOwn(GRAPHICS_MODES,settings.quality))settings.quality=defaults.quality;
  settings.audioVolume=audioLevel(settings.audioVolume);
  settings.soundtrackVolume=audioLevel(settings.soundtrackVolume);
  settings.keyBindings=controlBindings(settings.keyBindings);
  settings.holdDelay=holdDelay(settings.holdDelay);
  Object.assign(settings,normalizeControls(settings));
  if(![.5,.75,1].includes(settings.gameSpeed))settings.gameSpeed=defaults.gameSpeed;
  for(const key of REALTIME_FLAGS)if(typeof settings[key]!=='boolean')settings[key]=defaults[key];
  if(typeof settings.paceChosen!=='boolean')settings.paceChosen=false;
  return settings;
}

// Time and pace by difficulty (build brief §4, guide "Difficulty"): Story starts at 75% and pauses
// when an enemy comes into view; Standard and Veteran at 100% with every auto-pause off. The pace
// follows the chronicle's difficulty until the player changes one of these, and then stays theirs.
export const PACE_KEYS=Object.freeze(['gameSpeed','pauseSighted','pauseHurt','pauseObjective','pauseSquad','pauseOrder']);
export function paceDefaults(difficulty){
  const story=difficulty==='story';
  return {gameSpeed:story?.75:1,pauseSighted:story,pauseHurt:false,pauseObjective:false,pauseSquad:false,pauseOrder:false};
}
export function followDifficulty(settings,difficulty){if(!settings.paceChosen)Object.assign(settings,paceDefaults(difficulty));return settings;}
// The player sets one: from now on the pace is theirs, whatever the difficulty.
export function choosePace(settings,key,value){
  if(key==='gameSpeed'){if(![.5,.75,1].includes(Number(value)))return settings;settings.gameSpeed=Number(value);}
  else if([...PACE_KEYS,'roundPause','panelPause'].includes(key))settings[key]=!!value;else return settings;
  if(PACE_KEYS.includes(key))settings.paceChosen=true;return settings;
}

const REALTIME_FLAGS=['pauseSighted','pauseHurt','pauseObjective','pauseSquad','pauseOrder','roundPause','panelPause','drawToAttack','keepFighting','quickCast',
  'holdToMove','swapButtons'];

// Settings checkboxes that only store their setting, then redraw the page or
// tell the 3D stage (a method of the battle-stage controller).
export const SETTING_TOGGLES=Object.freeze({
  'high-contrast':{key:'highContrast',render:true},
  'compact-hud':{key:'compactHud',render:true},
  'guide-setting':{key:'guide',render:true},
  'coach-setting':{key:'coach',render:true},
  'confirm-moves':{key:'confirmMoves',render:true},
  'adaptive-resolution':{key:'adaptiveResolution',stage:'adaptive'},
  'action-camera':{key:'actionCamera',stage:'actionCamera'},
  'battle-remains':{key:'battleRemains',stage:'remains'}
});
