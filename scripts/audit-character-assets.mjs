import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {sampleSpritePose,spriteMesh} from '../src/ui/sprite-poses.js';
import {authoredFrame} from '../src/ui/sprite-frames.js';
import {FACING_COLUMN} from '../src/ui/unit-sprites.js';

// Reproducible shipping audit: local models, bounded topology, skin presence,
// material assets and full directional response coverage. No rendering claim.
const manifest=JSON.parse(await readFile('docs/asset-manifest.json','utf8')),models=[];
for(const asset of manifest.assets.filter(a=>a.path.endsWith('.glb'))){
  const bytes=await readFile(asset.path);assert.ok(bytes.length<2_000_000,`${asset.path}: model budget`);assert.equal(bytes.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),primitives=json.meshes.flatMap(m=>m.primitives),triangles=primitives.reduce((n,p)=>n+(json.accessors[p.indices??p.attributes.POSITION].count)/(p.indices===undefined?3:3),0);
  assert.ok(triangles<50_000,`${asset.path}: topology budget`);assert.ok(primitives.every(p=>p.attributes.POSITION!==undefined&&p.attributes.NORMAL!==undefined));
  models.push({path:asset.path,bytes:bytes.length,triangles,skins:json.skins?.length??0,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const actions=['walk','attack','throw','brace','hit','block','speak','rally','order','assent','dissent','yield'],coverage=[];
for(const atlas of ['roman','frontier','civic','specialists'])for(let row=0;row<4;row++)for(const facing of Object.keys(FACING_COLUMN))for(const pose of actions){
  const profile={mounted:atlas==='frontier'&&[1,3].includes(row),civic:atlas==='civic',spear:atlas==='roman'&&row===3,hand:['east','south'].includes(facing)?-1:1,direction:['east','north'].includes(facing)?1:-1};
  const override={pose,progress:.37,stridePhase:1.2},frame=authoredFrame({atlas,row},facing,override),sample=sampleSpritePose(override,profile),mesh=spriteMesh(sample,profile);
  assert.ok(sample.active,`${atlas}/${row}/${facing}/${pose}: missing response`);assert.ok(mesh.vertices.every(v=>Number.isFinite(v.dx)&&Number.isFinite(v.dy)));
  coverage.push({atlas,row,facing,pose,source:frame?'authored bitmap sequence':'procedural painted rig'});
}
const report={kind:'asset and pose coverage audit; not browser or device performance',models,coverageCount:coverage.length,authored:coverage.filter(c=>c.source==='authored bitmap sequence').length,procedural:coverage.filter(c=>c.source==='procedural painted rig').length,coverage};
if(process.argv.includes('--write'))await writeFile('docs/character-assets-v031.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,coverage:undefined},null,2));
