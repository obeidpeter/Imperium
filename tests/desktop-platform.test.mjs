import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as G from '../src/core/game.js';
import {defaultSettings} from '../src/ui/settings.js';
import {desktopBridge,desktopSaveMirror,inDesktopApp,networkConnection,platformKind,usesOfflineCache} from '../src/ui/platform.js';
import {createPanels} from '../src/ui/panels.js';
import {settingsView} from '../src/ui/settings-view.js';
import {heroFacts} from '../src/ui/landing-view.js';

// The platform boundary of the Steam plan (docs/steam-plan.md, S1): the web keeps every behaviour it had, and the
// desktop app's differences (fullscreen, Quit, saves on this computer, no offline cache) appear only there.

test('outside the desktop build the platform is the web, whatever the page holds',()=>{
  assert.equal(platformKind(),'web');assert.equal(usesOfflineCache(),true);
  assert.equal(desktopBridge(),null);assert.equal(inDesktopApp(),false);assert.equal(desktopSaveMirror(),null);
  globalThis.imperiumDesktop={saves:{read:async()=>null,write:async()=>{}},quit(){}};
  try{
    assert.ok(desktopBridge(),'The bridge is visible');
    assert.equal(inDesktopApp(),false,'but only the desktop build acts on it');assert.equal(desktopSaveMirror(),null,'and only it mirrors saves to files');
  }finally{delete globalThis.imperiumDesktop;}
  assert.equal(networkConnection(),globalThis.navigator?.connection??null,'The web respects the connection it has');
});

const settingsFor=(desktopApp,page)=>settingsView({settings:defaultSettings(),state:null,offline:false,currentChapterOffline:false,offlineProgress:'',preservedUnreadable:0,keymap:null,devMenu:false,desktopApp},{page});

test('the desktop app’s Settings offer fullscreen and its own saves wording, without the web’s offline section',()=>{
  const web=settingsFor(null,'saves'),desktop=settingsFor({fullscreen:true},'saves');
  assert.match(web,/<h3>Offline play<\/h3>/);assert.match(web,/Saves &amp; offline|Saves & offline/);assert.match(web,/Keep a backup before changing browsers/);
  assert.doesNotMatch(desktop,/Offline play|settings-offline-status/,'Every chapter is installed: nothing to download');
  assert.match(desktop,/Progress saves on this computer/);assert.match(desktop,/aria-controls="settings-saves">Saves</);
  const graphics=settingsFor({fullscreen:true},'graphics');
  assert.match(graphics,/id="desktop-fullscreen" type="checkbox" checked/);assert.match(graphics,/F11 or Alt\+Enter/);
  assert.doesNotMatch(settingsFor(null,'graphics'),/desktop-fullscreen/,'The web has no window of its own');
});

function panels(desktopApp,state=null){
  const shown=[];
  const api=createPanels(()=>({state,screen:'title',settings:defaultSettings(),showModal:(title,body)=>shown.push({title,body}),meters:()=>'',requirements:()=>'',worldCamp:false,desktopApp}));
  return {api,last:()=>shown.at(-1)};
}

test('the Menu offers Quit to desktop only in the desktop app, saying the chronicle is saved first',()=>{
  const state=G.newGame('Quit test');
  const web=panels(null,state);web.api.showNavigation();assert.doesNotMatch(web.last().body,/data-cmd="quit"/);
  const desk=panels({fullscreen:false},state);desk.api.showNavigation();
  assert.match(desk.last().body,/data-cmd="quit"><strong>Quit to desktop<\/strong><span>Your chronicle is saved first<\/span>/);
});

test('the landing facts and privacy notes describe the installed game on the desktop, the free web game on the web',()=>{
  assert.match(heroFacts(),/Free to play/);assert.match(heroFacts({platform:'web'}),/Once its chapters download/);
  const desk=heroFacts({platform:'desktop'});assert.doesNotMatch(desk,/Free to play|No account or installation/);assert.match(desk,/Every chapter is installed/);
  const web=panels(null);web.api.showPrivacy();assert.match(web.last().body,/What this browser keeps/);
  const app=panels({fullscreen:false});app.api.showPrivacy();
  assert.match(app.last().body,/What this computer keeps/);assert.doesNotMatch(app.last().body,/hosting provider|this browser|Clearing site data/);
});

test('the credits name every source the game ships, and every licence they link ships with it',()=>{
  const web=panels(null);web.api.showCredits();const credits=web.last().body;
  for(const name of ['OpenAI','Tripo','MakeHuman','Poly Haven','Three.js','Basis Universal','meshoptimizer','ktx-parse','zstddec','Lyria','ElevenLabs','Runway'])
    assert.ok(credits.includes(name),`The credits name ${name}`);
  assert.doesNotMatch(credits,/horses use original geometry|original code-authored sculpted meshes/,'No claim the Tripo figures contradict');
  const links=[...credits.matchAll(/href="\.\/([^"]+)"/g)].map(m=>m[1]);
  assert.ok(links.length>=6);for(const path of links)assert.ok(existsSync(new URL(`../${path}`,import.meta.url)),`${path} ships with the game`);
  assert.doesNotMatch(credits,/LICENSES\.chromium/,'The web credits do not name the desktop runtime');
  const desk=panels({fullscreen:false});desk.api.showCredits();assert.match(desk.last().body,/Electron and Chromium.*LICENSES\.chromium\.html/);
  // The texts the links open are the libraries' own.
  assert.match(readFileSync(new URL('../vendor/three/addons/libs/LICENSE-zstddec.txt',import.meta.url),'utf8'),/Copyright \(c\) 2020 Don McCurdy[\s\S]*BSD License[\s\S]*Zstandard/);
});

test('the desktop app carries the game’s version and packages the desktop build beside itself',()=>{
  const root=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')),desktop=JSON.parse(readFileSync(new URL('../desktop/package.json',import.meta.url),'utf8'));
  assert.equal(desktop.version,root.version,'Bump desktop/package.json with the game');
  assert.equal(desktop.productName,'Imperium');assert.equal(desktop.private,true);
  assert.deepEqual(desktop.build.extraResources.map(r=>[r.from,r.to]),[['../dist-desktop','game']],'The game is served from resources/game');
  assert.equal(desktop.build.publish,null,'Steam updates the app: no updater feed');
  for(const file of desktop.build.files.filter(f=>f!=='package.json'&&!f.startsWith('!')))assert.ok(existsSync(new URL(`../desktop/${file}`,import.meta.url)),`${file} exists`);
  assert.deepEqual(Object.keys(desktop.dependencies??{}),['steamworks.js'],'Steam’s binding is the app’s one runtime dependency');assert.equal(desktop.steamAppId,null,'No App ID until the owner has one');
  assert.equal(root.scripts['build:desktop'],'node scripts/build.mjs --target desktop');assert.equal(root.scripts['smoke:desktop'],'node scripts/desktop-smoke.mjs');
  assert.equal(root.dependencies,undefined,'The web project stays dependency-free');assert.equal(root.devDependencies,undefined);
});
