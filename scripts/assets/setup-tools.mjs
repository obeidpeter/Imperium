// Installs the asset pipeline's optional development tools under .tools/ or --dir.
// No tool is a game dependency; the Tripo key is never needed here.
//   node scripts/assets/setup-tools.mjs [--dir .tools] [--only bpy,basisu,gltf,playwright] [--check]
// Then source env.sh (Unix) or dot-source env.ps1 (PowerShell).
// --check installs nothing and writes nothing.
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,realpathSync,writeFileSync} from 'node:fs';
import {resolve,join,win32,posix} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PACKAGES} from './compress.mjs';

const repo=fileURLToPath(new URL('../../',import.meta.url));
export const TOOL_VERSIONS=Object.freeze({bpy:'5.2.2',python:'3.13',basisu:'1.16.4',basisCrate:'basis-universal-sys-0.3.1',playwright:'1.56.1'});
const quoteSh=value=>`'${value.replaceAll("'",`'"'"'`)}'`;
const quotePowerShell=value=>`'${value.replaceAll("'","''")}'`;

export function environmentScripts(env){
  return {
    sh:'# Written by scripts/assets/setup-tools.mjs. Source this file in a POSIX shell.\n'+Object.entries(env).map(([key,value])=>`export ${key}=${quoteSh(value)}`).join('\n')+'\n',
    // Windows PowerShell 5 needs a UTF-8 BOM to preserve non-ASCII user paths.
    ps1:'\uFEFF# Written by scripts/assets/setup-tools.mjs. Dot-source this file in PowerShell.\n'+Object.entries(env).map(([key,value])=>`$env:${key} = ${quotePowerShell(value)}`).join('\n')+'\n'
  };
}

// Dependencies are injectable so platform/tool-discovery tests never download tools.
export function createToolSetup(dir,{platform=process.platform,env=process.env,execPath=process.execPath,spawn=spawnSync,exists=existsSync,realpath=realpathSync,mkdir=mkdirSync,log=console.log}={}){
  const windows=platform==='win32',path=windows?win32:posix;
  const source=path.join(dir,'basisu-src',TOOL_VERSIONS.basisCrate,'vendor','basis_universal');
  const executable=windows?'basisu.exe':'basisu';
  const basisCandidates=[
    path.join(source,'bin',executable),path.join(source,'bin','Release',executable),
    path.join(source,'build','Release',executable),path.join(source,'build',executable),
    path.join(source,'build','bin','Release',executable),path.join(source,'build','bin',executable)
  ];
  const paths={
    python:path.join(dir,'blender-venv',windows?'Scripts':'bin',windows?'python.exe':'python'),
    basisSource:path.join(dir,'basisu-src'),
    get basisu(){return basisCandidates.find(exists)??basisCandidates[0];},
    assets:path.join(dir,'assets'),
    playwright:path.join(dir,'pw','node_modules','playwright','index.mjs'),
    playwrightCli:path.join(dir,'pw','node_modules','playwright','cli.js')
  };
  function run(command,args,{cwd=repo,quiet=false}={}){
    if(!quiet)log(`$ ${[command,...args].join(' ')}`);
    const result=spawn(command,args,{cwd,env,encoding:'utf8',stdio:quiet?'pipe':'inherit',shell:false});
    if(result.error||result.status!==0)throw new Error(`${command} failed${result.error?`: ${result.error.message}`:result.stderr?`: ${result.stderr.trim().slice(-400)}`:''}`);
    return (result.stdout??'')+(quiet?result.stderr??'':'');
  }
  const works=(command,args,pattern)=>{try{return pattern.test(run(command,args,{quiet:true}));}catch{return false;}};
  function python313(){
    const candidates=windows?[['py',['-3.13']],['python3.13',[]],['python',[]],['python3',[]]]:[['python3.13',[]],['python3',[]],['python',[]]];
    for(const [command,args] of candidates)if(works(command,[...args,'--version'],/Python 3\.13\./))return {command,args};
    throw new Error(`Blender's bpy ${TOOL_VERSIONS.bpy} wheel needs Python 3.13. ${windows?'Install Python 3.13 with its py launcher (py -3.13), or add its python.exe to PATH.':'Install Python 3.13 and put python3.13 or python3 on PATH.'}`);
  }
  function npm(args){
    // Windows npm.cmd/npx.cmd cannot be spawned directly without a shell. Run
    // npm's JavaScript entry point with Node instead, keeping every argument literal.
    const pathValue=Object.entries(env).find(([key])=>key.toLowerCase()==='path')?.[1]??'';
    const roots=[path.dirname(execPath),...pathValue.split(windows?';':':').filter(Boolean)];
    const candidates=[env.npm_execpath,...roots.flatMap(root=>[
      path.join(root,'node_modules','npm','bin','npm-cli.js'),
      path.join(root,'..','node_modules','npm','bin','npm-cli.js'),
      path.join(root,'..','lib','node_modules','npm','bin','npm-cli.js'),
      ...(!windows?[path.join(root,'npm')]:[])
    ])];
    let cli;
    for(const candidate of candidates){
      if(!candidate||!exists(candidate))continue;
      const target=realpath(candidate);
      if(path.basename(target)==='npm-cli.js'){cli=target;break;}
    }
    if(!cli)throw new Error('npm was not found. Install Node.js with npm, or run this setup through npm run asset:setup so npm can supply its CLI path.');
    run(execPath,[cli,...args]);
  }
  const tools={
    bpy:{
      ok:()=>exists(paths.python)&&works(paths.python,['-c','import bpy;print(bpy.app.version_string)'],new RegExp(`^${TOOL_VERSIONS.bpy.replace(/\./g,'\\.')}`)),
      install(){
        if(!exists(paths.python)){const python=python313();run(python.command,[...python.args,'-m','venv',path.join(dir,'blender-venv')]);}
        // About 1 GB installed.
        run(paths.python,['-m','pip','install','--quiet',`bpy==${TOOL_VERSIONS.bpy}`]);
      },
      get env(){return {BLENDER_PYTHON:paths.python};}
    },
    basisu:{
      ok:()=>exists(paths.basisu)&&works(paths.basisu,['-version'],new RegExp(`v${TOOL_VERSIONS.basisu.replace(/\./g,'\\.')}`)),
      install(){
        const curl=windows?'curl.exe':'curl',tar=windows?'tar.exe':'tar',cmake=windows?'cmake.exe':'cmake';
        for(const tool of [curl,tar,cmake])if(!works(tool,['--version'],/./))throw new Error(`Building basisu needs ${tool} on PATH. ${windows?'Install CMake and Visual Studio Build Tools with Desktop development with C++ and the Windows SDK; Windows provides curl.exe and tar.exe.':'Install curl, tar, CMake and a C++ compiler.'}`);
        mkdir(paths.basisSource,{recursive:true});
        const archive=path.join(paths.basisSource,'crate.tar.gz'),[name,version]=[TOOL_VERSIONS.basisCrate.replace(/-[\d.]+$/,''),TOOL_VERSIONS.basisCrate.replace(/^.*-/, '')];
        run(curl,['-fsSL','-o',archive,`https://crates.io/api/v1/crates/${name}/${version}/download`]);
        run(tar,['-xzf',archive,'-C',paths.basisSource]);
        const build=path.join(source,'build');
        try{
          run(cmake,['-S',source,'-B',build,'-DCMAKE_BUILD_TYPE=Release','-Wno-dev']);
          run(cmake,['--build',build,'--config','Release','--parallel']);
        }catch(error){throw new Error(`${error.message}\n${windows?'Install Visual Studio Build Tools with Desktop development with C++ and the Windows SDK, then run setup from a new Developer PowerShell.':'Install a C++ compiler and CMake, then retry setup.'}`);}
      },
      get env(){return {BASISU:paths.basisu};}
    },
    gltf:{
      ok:()=>works(execPath,['--input-type=module','-e',
        `import {createRequire} from 'node:module';const r=createRequire(${JSON.stringify(path.join(paths.assets,'_'))});for(const n of ['@gltf-transform/core','@gltf-transform/extensions','@gltf-transform/functions','meshoptimizer','sharp'])r.resolve(n);console.log('ok');`],/ok/),
      install(){mkdir(paths.assets,{recursive:true});npm(['install','--prefix',paths.assets,'--no-package-lock','--no-audit','--no-fund',...PACKAGES]);},
      env:{ASSET_MODULES:paths.assets}
    },
    playwright:{
      ok:()=>exists(paths.playwright)&&works(execPath,['--input-type=module','-e',
        `const m=await import(${JSON.stringify(pathToFileURL(paths.playwright).href)});console.log(typeof (m.chromium??m.default?.chromium)?.launch);`],/function/),
      install(){
        mkdir(path.join(dir,'pw'),{recursive:true});
        npm(['install','--prefix',path.join(dir,'pw'),'--no-package-lock','--no-audit','--no-fund',`playwright@${TOOL_VERSIONS.playwright}`]);
        // Invoke the installed CLI directly, without npx or a command shell.
        if(windows||!exists('/opt/pw-browsers'))run(execPath,[paths.playwrightCli,'install','chromium']);
      },
      env:{PLAYWRIGHT_MODULE:paths.playwright}
    }
  };
  return {paths,tools};
}

// Importing this module installs nothing.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
  const dir=resolve(repo,arg('--dir','.tools')),check=process.argv.includes('--check');
  const only=new Set(arg('--only','bpy,basisu,gltf,playwright').split(','));
  const {tools}=createToolSetup(dir),report={},env={};let failed=false;
  for(const [name,tool]of Object.entries(tools)){
    if(!only.has(name))continue;
    let ok=tool.ok();
    if(!ok&&!check){
      try{console.log(`\n${name}: installing into ${dir}`);tool.install();ok=tool.ok();}
      catch(error){console.error(`${name}: ${error.message}`);}
    }
    report[name]=ok?'ready':'missing';if(ok)Object.assign(env,tool.env);else failed=true;
  }
  // Keep tools installed earlier, outside --only, in both environment scripts.
  for(const [name,tool]of Object.entries(tools))if(!only.has(name)&&tool.ok())Object.assign(env,tool.env);
  if(!check&&Object.keys(env).length){
    mkdirSync(dir,{recursive:true});
    const scripts=environmentScripts(env);
    writeFileSync(join(dir,'env.sh'),scripts.sh);writeFileSync(join(dir,'env.ps1'),scripts.ps1);
  }
  console.log('\n'+Object.entries(report).map(([name,state])=>`${name.padEnd(11)}${state}`).join('\n'));
  if(!check&&Object.keys(env).length)console.log(`\nThen: . ${process.platform==='win32'?quotePowerShell(join(dir,'env.ps1')):quoteSh(join(dir,'env.sh'))}`);
  if(failed)process.exitCode=1;
}
