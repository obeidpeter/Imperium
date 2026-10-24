// One command for the asset pipeline's development tools in a fresh session.
// None is a project dependency, and nothing here is part of the game:
// - Blender's Python module (bpy 5.2.2, which installs on Python 3.13), for
//   asset:process, asset:bind and the kit builders;
// - the Basis Universal encoder 1.16.4 (basisu), built with cmake from the
//   source the crates.io package basis-universal-sys 0.3.1 vendors, for asset:compress;
// - the glTF-Transform modules, meshoptimizer and sharp, pinned as
//   scripts/assets/compress.mjs lists them;
// - Playwright 1.56.1, for previews, smoke tests and benchmarks.
// They go under .tools/ (ignored by git) or --dir. The script then writes
// <dir>/env.sh, which sets BLENDER_PYTHON, BASISU, ASSET_MODULES and
// PLAYWRIGHT_MODULE for the asset scripts. Network access goes through the
// package managers and crates.io; the Tripo key is never needed here.
//   node scripts/assets/setup-tools.mjs [--dir .tools] [--only bpy,basisu,gltf,playwright] [--check]
//   . .tools/env.sh
// --check installs nothing: it reports whether each tool in <dir> works.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PACKAGES} from './compress.mjs';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const dir=resolve(repo,arg('--dir','.tools')),check=process.argv.includes('--check');
const only=new Set(arg('--only','bpy,basisu,gltf,playwright').split(','));
export const TOOL_VERSIONS=Object.freeze({bpy:'5.2.2',python:'3.13',basisu:'1.16.4',basisCrate:'basis-universal-sys-0.3.1',playwright:'1.56.1'});
const paths={
  python:join(dir,'blender-venv','bin','python'),
  basisSource:join(dir,'basisu-src'),
  basisu:join(dir,'basisu-src',TOOL_VERSIONS.basisCrate,'vendor','basis_universal','bin','basisu'),
  assets:join(dir,'assets'),
  playwright:join(dir,'pw','node_modules','playwright','index.mjs')
};

function run(command,args,{cwd=repo,quiet=false}={}){
  if(!quiet)console.log(`$ ${[command,...args].join(' ')}`);
  const result=spawnSync(command,args,{cwd,encoding:'utf8',stdio:quiet?'pipe':'inherit'});
  if(result.error||result.status!==0)throw new Error(`${command} failed${result.stderr?`: ${result.stderr.trim().slice(-400)}`:''}`);
  return result.stdout??'';
}
const works=(command,args,pattern)=>{try{return pattern.test(run(command,args,{quiet:true}));}catch{return false;}};
// A Python 3.13 interpreter for the bpy wheel.
function python313(){
  for(const candidate of ['python3.13','python3']){
    if(works(candidate,['--version'],/Python 3\.13\./))return candidate;
  }
  throw new Error('Blender\'s bpy 5.2.2 wheel needs Python 3.13 (python3.13 or python3), which was not found.');
}

const tools={
  bpy:{
    ok:()=>existsSync(paths.python)&&works(paths.python,['-c','import bpy;print(bpy.app.version_string)'],new RegExp(`^${TOOL_VERSIONS.bpy.replace(/\./g,'\\.')}`)),
    install(){
      if(!existsSync(paths.python))run(python313(),['-m','venv',join(dir,'blender-venv')]);
      // About 1 GB installed.
      run(paths.python,['-m','pip','install','--quiet',`bpy==${TOOL_VERSIONS.bpy}`]);
    },
    env:{BLENDER_PYTHON:paths.python}
  },
  basisu:{
    ok:()=>existsSync(paths.basisu)&&works(paths.basisu,['-version'],new RegExp(`v${TOOL_VERSIONS.basisu.replace(/\./g,'\\.')}`)),
    install(){
      for(const tool of ['curl','tar','cmake'])if(!works(tool,['--version'],/./))throw new Error(`Building basisu needs ${tool}.`);
      mkdirSync(paths.basisSource,{recursive:true});
      const archive=join(paths.basisSource,'crate.tar.gz'),[name,version]=[TOOL_VERSIONS.basisCrate.replace(/-[\d.]+$/,''),TOOL_VERSIONS.basisCrate.replace(/^.*-/,'')];
      run('curl',['-fsSL','-o',archive,`https://crates.io/api/v1/crates/${name}/${version}/download`]);
      run('tar',['-xzf',archive,'-C',paths.basisSource]);
      const source=join(paths.basisSource,TOOL_VERSIONS.basisCrate,'vendor','basis_universal'),build=join(source,'build');
      run('cmake',['-S',source,'-B',build,'-DCMAKE_BUILD_TYPE=Release','-Wno-dev']);
      run('cmake',['--build',build,'-j']);
    },
    env:{BASISU:paths.basisu}
  },
  gltf:{
    ok:()=>works(process.execPath,['--input-type=module','-e',
      `import {createRequire} from 'node:module';const r=createRequire(${JSON.stringify(join(paths.assets,'_'))});for(const n of ['@gltf-transform/core','@gltf-transform/extensions','@gltf-transform/functions','meshoptimizer','sharp'])r.resolve(n);console.log('ok');`],/ok/),
    install(){mkdirSync(paths.assets,{recursive:true});run('npm',['install','--prefix',paths.assets,'--no-package-lock','--no-audit','--no-fund',...PACKAGES]);},
    env:{ASSET_MODULES:paths.assets}
  },
  playwright:{
    ok:()=>existsSync(paths.playwright)&&works(process.execPath,['--input-type=module','-e',
      `const m=await import(${JSON.stringify('file://'+paths.playwright)});console.log(typeof (m.chromium??m.default?.chromium)?.launch);`],/function/),
    install(){
      mkdirSync(join(dir,'pw'),{recursive:true});
      run('npm',['install','--prefix',join(dir,'pw'),'--no-package-lock','--no-audit','--no-fund',`playwright@${TOOL_VERSIONS.playwright}`]);
      // A cloud session ships Chromium for this Playwright; elsewhere, fetch it once.
      if(!existsSync('/opt/pw-browsers'))run('npx',['--prefix',join(dir,'pw'),'playwright','install','chromium']);
    },
    env:{PLAYWRIGHT_MODULE:paths.playwright}
  }
};

// Run only as a command: importing this module (as its test does) installs nothing.
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report={},env={};let failed=false;
  for(const [name,tool]of Object.entries(tools)){
    if(!only.has(name))continue;
    let ok=tool.ok();
    if(!ok&&!check){
      try{console.log(`\n${name}: installing into ${dir}`);tool.install();ok=tool.ok();}
      catch(error){console.error(`${name}: ${error.message}`);}
    }
    report[name]=ok?'ready':'missing';if(ok)Object.assign(env,tool.env);else failed=true;
  }
  // env.sh also keeps the tools installed here earlier, outside --only.
  for(const [name,tool]of Object.entries(tools))if(!only.has(name)&&tool.ok())Object.assign(env,tool.env);
  if(!check&&Object.keys(env).length){
    mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'env.sh'),`# Written by scripts/assets/setup-tools.mjs. Source it: . ${join(dir,'env.sh')}\n`+
      Object.entries(env).map(([key,value])=>`export ${key}=${JSON.stringify(value)}`).join('\n')+'\n');
  }
  console.log('\n'+Object.entries(report).map(([name,state])=>`${name.padEnd(11)}${state}`).join('\n'));
  if(!check&&Object.keys(env).length)console.log(`\nThen: . ${join(dir,'env.sh')}`);
  if(failed)process.exitCode=1;
}
