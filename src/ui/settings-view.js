import {esc} from './view-helpers.js';
import {controlPreferences,confirmMovesSetting} from './control-preferences.js';
import {soundscapeSettings} from './campaign-upgrade-views.js';
import {roman} from './view-helpers.js';

export const SETTINGS_PAGES=[['general','Readability'],['controls','Controls'],['graphics','Graphics'],['audio','Sound'],['saves','Saves & offline']];
const options=(rows,value)=>rows.map(([id,label])=>`<option value="${id}"${value===id?' selected':''}>${label}</option>`).join('');
const toggle=(id,label,hint,checked,extra='')=>`<label class="setting" for="${id}"><span>${label}${hint?`<small class="muted">${hint}</small>`:''}</span><input id="${id}" type="checkbox"${checked?' checked':''} ${extra}></label>`;
const select=(id,label,hint,rows,value)=>`<label class="setting" for="${id}"><span>${label}${hint?`<small class="muted">${hint}</small>`:''}</span><select id="${id}">${options(rows,value)}</select></label>`;
const group=(title,body)=>`<fieldset class="settings-group"><legend>${title}</legend>${body}</fieldset>`;

// One task at a time. Hidden pages retain the field IDs used by the settings
// controller; they are excluded from both keyboard navigation and speech.
export function settingsView(context,{page='general',pace='',development=''}={}){
  const {settings:s,state,offline,currentChapterOffline,offlineProgress,preservedUnreadable,keymap,devMenu}=context;
  const current=SETTINGS_PAGES.some(([id])=>id===page)?page:'general',live=s.controlsModel==='realtime';
  const offlineText=offline?'All twelve chapters are available offline.':offlineProgress?esc(offlineProgress):currentChapterOffline?`Chapter ${roman(state?.chapter||1)} is available offline.`:'This chapter is still downloading.';
  const pages={
    general:group('Make the game easier to read',
      select('text-size','Text size','',[[1,'100%'],[1.25,'125%'],[1.5,'150%'],[2,'200%']],s.textScale||1)+
      toggle('high-contrast','High contrast','Clearer borders and labels.',s.highContrast)+
      toggle('motion-setting','Reduce motion','Limit camera movement and animation.',s.reducedMotion)+
      toggle('compact-hud','Compact interface','Give more room to the scene.',s.compactHud!==false))+
      group('Guidance',toggle('guide-setting','Learning tips','Short help for your current task.',s.guide!==false)+
      toggle('coach-setting','Tactical advice','Suggestions for the current position.',s.coach!==false))+
      '<button class="text-link" data-cmd="help">Learn the basics →</button>',
    controls:controlPreferences(s,{keymap:live?keymap:null,readability:false})+
      (live?pace:confirmMovesSetting(s))+
      (devMenu?`<details id="settings-development" class="settings-details"><summary>Developer tools</summary>${development}</details>`:''),
    graphics:group('Scene',
      select('battle-view','Game view','', [['3d','3D scene'],['2d','2D tactical view']],s.battleView==='2d'?'2d':'3d')+
      select('graphics-quality','Graphics quality','Choose Performance if the game feels slow.',[['performance','Performance'],['balanced','Balanced'],['high','High quality']],s.quality)+
      toggle('adaptive-resolution','Automatic resolution','Keep the scene smooth; text stays sharp.',s.adaptiveResolution!==false)+
      (live?toggle('objective-markers','Objective markers','Show where to go next.',s.objectiveMarkers!==false,'data-rt-setting="objectiveMarkers"')+toggle('floating-numbers','Damage and healing numbers','',s.floatingNumbers!==false,'data-rt-setting="floatingNumbers"'):''))+
      `<details id="settings-scene-details" class="settings-details"><summary>Scene appearance</summary>${group('Details',
        select('figure-style','Character style','Ink and wash needs Balanced or High quality.',[['sculpted','Sculpted'],['painted','Painted'],['inked','Ink and wash']],s.figureStyle??'sculpted')+
        toggle('action-camera','Combat close-ups','Briefly focus on a blow, then return.',s.actionCamera!==false)+
        toggle('battle-remains','Battle remains','Keep fallen soldiers and spent arrows visible.',s.battleRemains!==false))}</details>`+
      '<details id="settings-performance" class="settings-details"><summary>Performance diagnostics</summary><p id="render-measurements">Measurements for this browser session.</p><div class="panel-actions"><button data-cmd="render-report">Frame report</button><button data-cmd="performance-check">Run performance check</button></div><p class="settings-description">Open a 3D battle first. The check takes about a minute, pauses play and saves a local report.</p></details>',
    audio:group('Sound',toggle('audio-setting','Sound effects','',s.audio)+
      `<label class="setting" for="audio-volume"><span>Effects volume<small id="audio-volume-value">${Math.round((s.audioVolume??.5)*100)}%</small></span><input id="audio-volume" type="range" min="0" max="100" step="10" value="${Math.round((s.audioVolume??.5)*100)}"></label>`+
      soundscapeSettings(s)),
    saves:`<section class="settings-group"><h3>Your progress</h3><p>Progress saves on this device. Keep a backup before changing browsers.</p><div class="panel-actions">${state?'<button class="primary" data-cmd="saves">Save & load</button><button data-cmd="export">Export save code</button>':''}<button data-cmd="restore">Import save code</button></div>`+
      '<details id="settings-recovery" class="settings-details"><summary>Recover older progress</summary><p>The last three checkpoints are kept on this device.</p><button data-cmd="recovery">Find earlier saves</button>'+
      (preservedUnreadable?`<p>${preservedUnreadable} older save${preservedUnreadable===1?'':'s'} cannot be read. The original data is preserved.</p><button data-cmd="export-unreadable">Download preserved save data</button>`:'')+'</details></section>'+
      `<section class="settings-group"><h3>Offline play</h3><p id="settings-offline-status" role="status">${offlineText}</p><p class="settings-description">Chapters download as you reach them. Download everything before playing without internet.</p><div class="panel-actions">${state&&!currentChapterOffline?'<button data-cmd="retry-chapter">Retry chapter download</button>':''}${!offline&&globalThis.navigator&&'serviceWorker' in globalThis.navigator?'<button data-cmd="retry-offline">Download all chapters</button>':''}</div></section>`+
      '<details id="settings-save-tools" class="settings-details"><summary>New game & local data</summary><div class="panel-actions"><button data-cmd="new">Start a new game</button><button data-cmd="privacy">Privacy & local data</button></div></details>'
  };
  return `<p class="settings-status" role="status">Changes save automatically.${state?' Play is paused.':''}</p><div class="settings-layout"><nav class="settings-nav" aria-label="Settings categories">${SETTINGS_PAGES.map(([id,label])=>`<button type="button" data-cmd="settings-section" data-id="${id}"${id===current?' aria-current="page"':''} aria-controls="settings-${id}">${label}</button>`).join('')}</nav><div class="settings-pages">${SETTINGS_PAGES.map(([id,label])=>`<section id="settings-${id}" data-settings-page="${id}" aria-labelledby="settings-${id}-title"${id===current?'':' hidden'}><h3 id="settings-${id}-title" class="settings-page-title" tabindex="-1">${label}</h3>${pages[id]}</section>`).join('')}</div></div>`;
}
