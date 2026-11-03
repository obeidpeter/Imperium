'use strict';
// Steam for the desktop app's main process (the Steam plan, docs/steam-plan.md, S3; docs/desktop.md). It uses
// steamworks.js, and only when the app knows its Steam App ID (package.json's "steamAppId", or IMPERIUM_STEAM_APP_ID
// for development, such as Valve's test app 480) and the Steam client accepts it. Without either, the app runs as
// before and nothing here does anything. The page reaches it only through the bridge (preload.cjs): it reports the
// achievements its chronicle has earned (src/core/achievements.js), and Steam unlocks the ones it does not have yet.
const ACHIEVEMENT_ID=/^ACH_[A-Z0-9_]{1,60}$/;
let client=null,state={available:false,reason:'No Steam App ID is set.'};

function appId(){
  const raw=process.env.IMPERIUM_STEAM_APP_ID??require('./package.json').steamAppId,id=Number(raw);
  return Number.isInteger(id)&&id>0?id:null;
}

// Before the app is ready: the overlay sets Chromium switches (steamworks.js's electronEnableSteamOverlay).
function start(){
  const id=appId();
  if(!id)return state;
  let steamworks;
  try{steamworks=require('steamworks.js');}catch{state={available:false,appId:id,reason:'steamworks.js is not installed.'};return state;}
  try{client=steamworks.init(id);steamworks.electronEnableSteamOverlay();state={available:true,appId:id};}
  catch(error){client=null;state={available:false,appId:id,reason:`Steam did not start: ${error.message}`};}
  return state;
}

// Unlocks the reported achievements Steam does not have yet; returns the ones it newly unlocked.
function unlock(ids){
  if(!client)return {available:false,unlocked:[]};
  const unlocked=[];
  for(const id of (Array.isArray(ids)?ids:[]).slice(0,64)){
    if(typeof id!=='string'||!ACHIEVEMENT_ID.test(id))continue;
    try{if(!client.achievement.isActivated(id)&&client.achievement.activate(id))unlocked.push(id);}catch{}
  }
  return {available:true,unlocked};
}

module.exports={start,unlock,status:()=>({...state})};
