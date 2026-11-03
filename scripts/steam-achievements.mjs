// node scripts/steam-achievements.mjs: writes docs/steam-achievements.md, the achievements as the owner enters them in
// Steamworks (the Steam plan, S3), from src/data/achievements.js. A test fails while the two differ.
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {ACHIEVEMENTS} from '../src/data/achievements.js';

const GROUPS={chapter:'Chapters',decoration:'Decorations',title:'Errand titles',route:'The finale’s routes',finish:'Finishing the campaign'};
const how=({earned:e})=>e.chapter?`Chapter ${e.chapter} completed`:e.decoration?`the \`${e.decoration}\` decoration`:e.title?`the \`${e.title}\` title`
  :e.route?`the final confrontation won by the \`${e.route}\` route`:e.finish==='veteran'?'the accession, on Veteran':'the accession, with Iron discipline on';
const cell=text=>String(text).replace(/\|/g,'\\|');

export function steamAchievementsSheet(list=ACHIEVEMENTS){
  const hidden=list.filter(a=>a.hidden).length;
  const lines=['# Steam achievements','',
    `The ${list.length} achievements the owner approved on 3 November 2026, to enter in Steamworks under the app's achievements (the Steam plan, S3). ${hidden} are hidden until earned: those tied to Chapters IV–XII, the chapters the free demo does not show. Generated from \`src/data/achievements.js\` by \`node scripts/steam-achievements.mjs\`; do not edit it by hand.`,'',
    'For each one, enter in Steamworks:',
    '- its **API name** exactly as below, which the game unlocks;',
    '- its display **name** and **description**;',
    '- **Hidden** where it says yes;',
    '- an icon and its locked version, in the sizes Steamworks asks for.','',
    'The game unlocks an achievement from what the chronicle records (`src/core/achievements.js`): never by itself, and never from a Practice replay. The desktop app reports them after each save and when a chronicle loads, so a chronicle brought from the browser or the demo unlocks what it has already earned.',''];
  for(const [group,title] of Object.entries(GROUPS)){
    const rows=list.filter(a=>a.group===group);if(!rows.length)continue;
    lines.push(`## ${title}`,'','| API name | Name | Description | Hidden | Earned by |','| --- | --- | --- | --- | --- |',
      ...rows.map(a=>`| \`${a.id}\` | ${cell(a.name)} | ${cell(a.description)} | ${a.hidden?'yes':'no'} | ${how(a)} |`),'');
  }
  return lines.join('\n');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await writeFile(new URL('../docs/steam-achievements.md',import.meta.url),steamAchievementsSheet());
  console.log(`Wrote docs/steam-achievements.md (${ACHIEVEMENTS.length} achievements).`);
}
