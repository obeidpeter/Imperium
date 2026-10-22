// The in-game Controls & rules (build brief Phase 4), generated from the player
// guide: docs/player-guide-0.40.md becomes src/data/guide-help.js, one page per
// chapter of the guide with its sections. The guide's Markdown is the subset its
// conversion writes: headings, paragraphs, bullet and numbered lists, pipe
// tables, quotes, bold and italic. The key tables of "Keyboard" and "Panels"
// name the actions their keys perform, so the help can show the player's own
// keys. `node scripts/guide-help.mjs` regenerates the module; a test keeps it in
// step with the guide.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const GUIDE=new URL('../docs/player-guide-0.40.md',import.meta.url),OUT=new URL('../src/data/guide-help.js',import.meta.url);
const html=text=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const slug=title=>title.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9\s.-]/g,'').trim().replace(/\s+/g,'-');
const digits=n=>Array.from({length:n},(_,i)=>`ability_${i+1}`);
// The keys of the guide's "Keyboard" and "Panels" tables, by the actions they perform (ui/action-map.js).
export const KEY_CELLS=Object.freeze({
  '**Space**':['combat_toggle'],'**T** / **Shift+T**':['target_next_enemy','target_next_friend'],'**E**':['interact_nearest'],'**1–0**':digits(10),
  '**S**':['ability_bar'],'**P** or Pause':['pause'],'**V**':['slow_time'],'**N**':['step_round'],'**W**':['walk_toggle'],'**U** (hold)':['show_usable'],
  '**\\[** / **\\]**':['party_prev','party_next'],'**Home**':['control_hero'],'**Shift+1–6**':[1,2,3,4,5,6].map(n=>`select_squad_${n}`),'**Y**':['yield_floor'],
  '**B**':['war_cry'],'**F2**':['quick_save'],'**F**':['camera_follow'],'**Z**':['camera_overview'],'**H** (3D)':['camera_horizon'],
  '**,** / **.** (3D)':['camera_rotate_left','camera_rotate_right'],'**+ / −**':['zoom_in','zoom_out'],'**X**':['see_through'],'**G**':['show_ranges'],
  '**I C J Q L M R A O ?**':['panel_kit','panel_character','panel_journal','panel_orders','panel_chronicle','panel_map','panel_company','panel_decorations','panel_options','help'],
  '**I**':['panel_kit'],'**C**':['panel_character'],'**J**':['panel_journal'],'**Q**':['panel_orders'],'**L**':['panel_chronicle'],'**M**':['panel_map'],
  '**R**':['panel_company'],'**A**':['panel_decorations'],'**O**':['panel_options'],'**?**':['help']});
const KEY_TABLES=new Set(['keyboard','panels']);

// Inline Markdown: escapes kept aside, HTML escaped, then bold, italic and links.
export function inline(text){
  const kept=[];let s=text.replace(/<\/?u>/g,'').replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g,(m,c)=>{kept.push(c);return `\u0000${kept.length-1}\u0000`;});
  s=html(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g,'$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,label,href)=>href.startsWith('#')?`<button type="button" class="text-link" data-cmd="help-section" data-id="${html(href.slice(1))}">${label}</button>`
      :/^https:\/\//.test(href)?`<a href="${html(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`:label);
  return s.replace(/\u0000(\d+)\u0000/g,(m,i)=>html(kept[Number(i)]));
}
const cells=line=>{const parts=[];let cell='';for(let i=0;i<line.length;i++){const c=line[i];if(c==='\\'&&line[i+1]==='|'){cell+='\\|';i++;}else if(c==='|'){parts.push(cell);cell='';}else cell+=c;}
  parts.push(cell);return parts.slice(1,-1).map(c=>c.trim());};
function table(rows,keyTable){
  const [head,,...body]=rows.map(cells);
  const cell=(text,i,tag)=>{const actions=keyTable&&i===0&&tag==='td'?KEY_CELLS[text]:null;
    return `<${tag}${tag==='th'?' scope="col"':''}>${actions?`<span class="help-keys" data-actions="${actions.join(',')}">${inline(text)}</span>`:inline(text)}</${tag}>`;};
  return `<div class="help-table"><table><thead><tr>${head.map((c,i)=>cell(c,i,'th')).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map((c,i)=>cell(c,i,'td')).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// One run of blocks (a chapter's or a section's lines) as HTML.
function blocks(lines,{keyTable=false}={}){
  const out=[];let i=0;
  const para=[];const flush=()=>{if(para.length){out.push(`<p>${inline(para.join(' '))}</p>`);para.length=0;}};
  while(i<lines.length){
    const line=lines[i];
    if(!line.trim()){flush();i++;continue;}
    if(line.startsWith('|')){flush();const rows=[];while(i<lines.length&&lines[i].startsWith('|'))rows.push(lines[i++]);out.push(table(rows,keyTable));continue;}
    if(line.startsWith('>')){flush();const q=[];while(i<lines.length&&lines[i].startsWith('>'))q.push(lines[i++].replace(/^>\s?/,''));out.push(`<aside class="help-note"><p>${inline(q.join(' '))}</p></aside>`);continue;}
    const item=line.match(/^(-|\d+\\?\.)\s+(.*)$/);
    if(item){
      flush();const ordered=item[1]!=='-',items=[];
      while(i<lines.length){
        const m=lines[i].match(/^(-|\d+\\?\.)\s+(.*)$/);if(!m||(m[1]!=='-')!==ordered)break;const text=[m[2]];i++;
        // Its continuation lines are indented; a blank line between items keeps the list.
        while(i<lines.length&&(/^\s{2,}\S/.test(lines[i])||(!lines[i].trim()&&/^\s{2,}\S/.test(lines[i+1]??''))))text.push(lines[i++].trim());
        items.push(`<li>${inline(text.filter(Boolean).join(' '))}</li>`);while(i<lines.length&&!lines[i].trim()&&/^(-|\d+\\?\.)\s/.test(lines[i+1]??''))i++;
      }
      out.push(ordered?`<ol>${items.join('')}</ol>`:`<ul>${items.join('')}</ul>`);continue;
    }
    para.push(line.trim());i++;
  }
  flush();return out.join('');
}
// The guide as pages: each "# " chapter (the Contents excepted) with its "## " sections.
export function buildGuideHelp(markdown){
  const lines=markdown.replace(/\r\n/g,'\n').split('\n'),version=(markdown.match(/Version ([0-9.]+)/)??[])[1]??null;
  const pages=[];let page=null,section=null;
  for(const line of lines){
    const h=line.match(/^(#{1,2}) (.+)$/);
    if(h&&h[1]==='#'){page={id:slug(h[2]),title:h[2].trim(),intro:[],sections:[]};section=null;pages.push(page);continue;}
    if(h&&h[1]==='##'&&page){section={id:slug(h[2]),title:h[2].trim(),lines:[]};page.sections.push(section);continue;}
    if(section)section.lines.push(line);else if(page)page.intro.push(line);
  }
  return {version,pages:pages.filter(p=>p.id!=='contents').map(p=>({id:p.id,title:p.title,sections:p.sections.map(s=>({id:s.id,title:s.title})),
    html:`${blocks(p.intro)}${p.sections.map(s=>`<section class="help-section" aria-labelledby="help-${s.id}"><h4 id="help-${s.id}">${inline(s.title)}</h4>${blocks(s.lines,{keyTable:KEY_TABLES.has(s.id)})}</section>`).join('')}`}))};
}
export function guideHelpModule(markdown){
  const help=buildGuideHelp(markdown);
  return `// Generated by scripts/guide-help.mjs from docs/player-guide-0.40.md: edit the guide, then run\n`+
    `// \`node scripts/guide-help.mjs\`. The in-game Controls & rules (build brief Phase 4).\n`+
    `export const GUIDE_HELP=Object.freeze(${JSON.stringify(help,null,1)});\n`;
}
export const readGuide=()=>readFile(GUIDE,'utf8');

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const text=guideHelpModule(await readGuide());await writeFile(OUT,text);
  console.log(`Wrote src/data/guide-help.js (${Math.round(text.length/1024)} KB, ${buildGuideHelp(await readGuide()).pages.length} pages)`);
}
