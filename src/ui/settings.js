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
  return settings;
}

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
