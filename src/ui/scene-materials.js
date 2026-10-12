// Authored presentation profiles: no biome changes or new rules terrain.
const fields=['title','ground','earth','grass','stone','road','water','light'];
const regions=[
  ['THE OATH · DANUBE GARRISON','#a6ac83','#7d8862','#9ea775','#c0b99b','#c5b18a','#648784','#eee2b9'],
  ['AFTER ABRITTUS · FLOODED REEDS','#859a8d','#617b6a','#899b78','#abb5a3','#adaf8d','#557e79','#d7ded0'],
  ['THE WITHDRAWAL · BROKEN ROAD','#a6a080','#817857','#a6a176','#bcb39b','#c0a479','#748b82','#e7d8b5'],
  ['THE FRONTIER · FORTIFIED PASS','#929d84','#6e7e69','#8e9a71','#b6b6a0','#bbaa89','#617e7d','#dddcc4'],
  ['THE EAST · SIEGE WORKS','#c8b184','#a68b63','#aaa076','#d3bd97','#d9c399','#6b8987','#f4dfb3'],
  ['EUPHRATES · THE CROSSING','#b3a98a','#938266','#a7a580','#c6b89e','#cbb595','#668e8c','#ecdfc2'],
  ['ITALIA · THE LEGION IN THE FIELD','#9ca37d','#788263','#949e70','#bbbba1','#c1b38b','#6c8d87','#e2debc'],
  ['DANUBE · THE PEOPLE’S ROAD','#a6ad8f','#7b8c74','#a4ae7e','#c4c7ab','#cbbc97','#60918d','#e8e7ca'],
  ['PALMYRA · THE EASTERN COLUMN','#cbb18c','#a38360','#b6a27a','#d5bd9c','#d9c49c','#6b9492','#f4e1c3'],
  ['DACIA AURELIANA · PROVINCIAL WORKS','#aeb89a','#85947d','#a5b182','#d5ceaf','#ccbd94','#6e9994','#efead0'],
  ['ROME · THE CURIA','#b4b09e','#908a79','#a3aa88','#d6d1bb','#cdc1a3','#78968e','#f3e9d0'],
  ['ROME · THE IMPERIAL APPROACH','#b5ae93','#8f866d','#a6aa7f','#d6c5a5','#cbb48c','#78948c','#f2ddb7']
];
export function scenePalette(chapter=1,encounter={}){
  const n=Math.max(1,Math.min(12,Math.trunc(chapter)||1));
  const p=Object.fromEntries(fields.map((key,i)=>[key,regions[n-1][i]]));
  Object.assign(p,{chapter:n,edge:'#515f52',high:p.stone,sand:n===9?'#d7bd95':'#d8c296',darkWater:'#365e65',chamber:encounter.kind==='contest'});
  if(p.chamber){
    const grand=n>=11,imperial=n===12;
    Object.assign(p,{title:imperial?'ACCLAMATION · THE IMPERIAL COALITION':grand?'ROME · THE SENATE':n===10?'THE GOVERNOR’S AUDIENCE':n===8?'DANUBE · THE ASSEMBLY':'THE PROVINCIAL COUNCIL',
      ground:grand?'#b8ae9b':'#bbb59b',earth:grand?'#908074':'#8f8e78',stone:imperial?'#d5c2a1':grand?'#dad4bf':'#c7c5aa',
      inlay:imperial?'#78495b':grand?'#86554f':'#5a7770',light:imperial?'#f3dfb5':grand?'#f0e8d4':'#e7e6cd'});
  }
  return p;
}

export function formationGlyph(formation){
  return formation==='shield-wall'?[[-10,3],[-10,-1],[-4,-1],[-4,3],[3,3],[3,-1],[10,-1],[10,3]]:
    formation==='wedge'?[[-10,5],[0,-1],[10,5]]:formation==='line'?[[-10,2],[10,2]]:[];
}

// Presentation classes use existing documented morale thresholds only.
export function moraleState(unit){return Number.isFinite(unit.morale)?unit.morale<=15?'broken':unit.morale<35?'shaken':null:null;}
