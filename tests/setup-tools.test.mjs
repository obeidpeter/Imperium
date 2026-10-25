import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,win32,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createToolSetup,environmentScripts,TOOL_VERSIONS} from '../scripts/assets/setup-tools.mjs';

const script=fileURLToPath(new URL('../scripts/assets/setup-tools.mjs',import.meta.url));

test('the tool setup check reports missing tools and installs nothing',()=>{
  const dir=mkdtempSync(join(tmpdir(),'imperium-tools-'));
  try{
    const run=spawnSync(process.execPath,[script,'--dir',dir,'--check','--only','gltf,playwright,basisu'],{encoding:'utf8'});
    assert.equal(run.status,1);
    assert.match(run.stdout,/gltf\s+missing/);assert.match(run.stdout,/playwright\s+missing/);assert.match(run.stdout,/basisu\s+missing/);
    assert.deepEqual(readdirSync(dir),[],'--check writes nothing, not even environment scripts');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('the tool versions match the pipeline\'s documented versions',()=>{
  assert.equal(TOOL_VERSIONS.bpy,'5.2.2');assert.equal(TOOL_VERSIONS.basisu,'1.16.4');assert.equal(TOOL_VERSIONS.playwright,'1.56.1');
});

const success=(stdout='')=>({status:0,stdout,stderr:''});
const missing=()=>({status:1,stdout:'',stderr:'not installed'});
function fakeSetup(platform,{exists=()=>false,spawn=()=>success(),...options}={}){
  return createToolSetup(platform==='win32'?"C:\\Asset work ' & $()":"/asset work ' & $()",{
    platform,env:{},execPath:platform==='win32'?'C:\\Node\\node.exe':'/usr/bin/node',
    exists,spawn,realpath:path=>path,mkdir:()=>{},log:()=>{},...options
  });
}

for(const platform of ['win32','linux'])test(`${platform}: Python 3.13 discovery creates and installs into the native venv`,()=>{
  const calls=[],windows=platform==='win32',launcher=windows?'py':'python3.13';
  const {paths,tools}=fakeSetup(platform,{spawn:(command,args,options)=>{
    calls.push({command,args,options});
    if(args.includes('--version'))return command===launcher?{...success(),stderr:'Python 3.13.9\n'}:missing();
    return success();
  }});
  tools.bpy.install();
  const venv=calls.find(call=>call.args.includes('venv'));
  assert.equal(venv.command,launcher);
  assert.deepEqual(venv.args.slice(0,windows?4:3),windows?['-3.13','-m','venv',win32.dirname(paths.python).replace(/\\Scripts$/,'')]:['-m','venv',posix.dirname(paths.python).replace(/\/bin$/,'')]);
  assert.match(paths.python,windows?/\\blender-venv\\Scripts\\python\.exe$/:/\/blender-venv\/bin\/python$/);
  assert.equal(calls.at(-1).command,paths.python);
  assert.deepEqual(calls.at(-1).args,['-m','pip','install','--quiet','bpy==5.2.2']);
  assert.ok(calls.every(call=>call.options.shell===false));
});

test('Windows falls back from an unavailable py launcher to Python 3.13 on PATH',()=>{
  const calls=[];
  const {tools}=fakeSetup('win32',{spawn:(command,args)=>{
    calls.push({command,args});
    return args.includes('--version')?(command==='python'?success('Python 3.13.9'):success('Python 3.12.4')):success();
  }});
  tools.bpy.install();
  assert.equal(calls.find(call=>call.args.includes('venv')).command,'python');
});

test('missing Python and npm explain how to install prerequisites without launching an installer',()=>{
  const calls=[];
  const {tools}=fakeSetup('win32',{spawn:(command,args)=>{calls.push({command,args});return missing();}});
  assert.throws(()=>tools.bpy.install(),/Python 3\.13.*py -3\.13/);
  assert.throws(()=>tools.gltf.install(),/Install Node\.js with npm/);
  assert.ok(calls.every(call=>call.args.includes('--version')));
});

for(const platform of ['win32','linux'])test(`${platform}: npm runs through Node and preserves literal paths`,()=>{
  const path=platform==='win32'?win32:posix,root=platform==='win32'?'C:\\Program Files\\nodejs':'/opt/node/bin';
  const cli=path.join(root,'node_modules','npm','bin','npm-cli.js'),calls=[];
  const {paths,tools}=fakeSetup(platform,{env:{Path:root},exists:candidate=>candidate===cli,spawn:(command,args,options)=>{calls.push({command,args,options});return success();}});
  tools.gltf.install();
  assert.equal(calls.length,1);
  assert.equal(calls[0].args[0],cli);
  assert.equal(calls[0].args[3],paths.assets);
  assert.match(calls[0].command,/node(?:\.exe)?$/);
  assert.equal(calls[0].options.shell,false);
  assert.ok(!calls[0].command.endsWith('.cmd'));
});

test('Unix npm discovery follows the installed npm symlink',()=>{
  const calls=[],cli='/usr/share/nodejs/npm/bin/npm-cli.js';
  const {tools}=fakeSetup('linux',{env:{PATH:'/usr/bin'},exists:candidate=>candidate==='/usr/bin/npm',realpath:()=>cli,spawn:(command,args)=>{calls.push({command,args});return success();}});
  tools.gltf.install();
  assert.equal(calls[0].args[0],cli);
});

for(const platform of ['win32','linux'])test(`${platform}: basisu builds Release and discovers its actual output`,()=>{
  const windows=platform==='win32',path=windows?win32:posix,calls=[];let built=false,output;
  const {paths,tools}=fakeSetup(platform,{exists:candidate=>built&&candidate===output,spawn:(command,args,options)=>{
    calls.push({command,args,options});
    if(args.includes('--build'))built=true;
    return success(args.includes('-version')?'Basis Universal v1.16.4':'tool available');
  }});
  output=path.join(paths.basisSource,TOOL_VERSIONS.basisCrate,'vendor','basis_universal',...(windows?['bin','Release','basisu.exe']:['bin','basisu']));
  tools.basisu.install();
  assert.ok(tools.basisu.ok());
  assert.equal(tools.basisu.env.BASISU,output,'environment is generated after discovering the build output');
  const build=calls.find(call=>call.args.includes('--build'));
  assert.deepEqual(build.args.slice(-3),['--config','Release','--parallel']);
  assert.ok(calls.every(call=>call.options.shell===false));
});

test('missing Windows CMake reports C++ prerequisites before a download',()=>{
  const calls=[];
  const {tools}=fakeSetup('win32',{spawn:(command,args)=>{calls.push({command,args});return command==='cmake.exe'?missing():success('tool available');}});
  assert.throws(()=>tools.basisu.install(),/CMake and Visual Studio Build Tools.*Windows SDK/);
  assert.ok(calls.every(call=>call.args[0]==='--version'));
});

test('native setup executes fixture npm and Playwright CLIs, imports special paths, and writes literal environment scripts',()=>{
  const dir=mkdtempSync(join(tmpdir(),"imperium café tools ' $() & # %-"));
  try{
    const npmCli=join(dir,'npm-cli.js'),log=join(dir,'calls.jsonl');
    // These tiny packages only exercise discovery and process launching. No network,
    // package manager, Python installation or browser download is involved.
    writeFileSync(npmCli,`const fs=require('node:fs'),path=require('node:path');
      const args=process.argv.slice(2),prefix=args[args.indexOf('--prefix')+1];
      fs.appendFileSync(process.env.FIXTURE_LOG,JSON.stringify({cli:'npm',args})+'\\n');
      const put=(name,source)=>{const file=path.join(prefix,'node_modules',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,source);};
      if(args.some(arg=>arg.startsWith('playwright@'))){
        put('playwright/index.mjs','export const chromium={launch(){}};');
        put('playwright/cli.js',"require('node:fs').appendFileSync(process.env.FIXTURE_LOG,JSON.stringify({cli:'playwright',args:process.argv.slice(2)})+'\\\\n');");
      }else for(const name of ['@gltf-transform/core','@gltf-transform/extensions','@gltf-transform/functions','meshoptimizer','sharp'])put(name+'/index.js','module.exports={};');
    `);
    const setup=createToolSetup(dir,{env:{...process.env,npm_execpath:npmCli,FIXTURE_LOG:log},log:()=>{}});
    setup.tools.gltf.install();
    assert.equal(setup.tools.gltf.ok(),true);
    setup.tools.playwright.install();
    assert.equal(setup.tools.playwright.ok(),true,'file URL must encode spaces, #, %, and Windows drive paths');
    const calls=readFileSync(log,'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.filter(call=>call.cli==='npm').length,2);
    if(process.platform==='win32'||!existsSync('/opt/pw-browsers'))assert.deepEqual(calls.at(-1),{cli:'playwright',args:['install','chromium']});
    const run=spawnSync(process.execPath,[script,'--dir',dir,'--only','gltf,playwright'],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.match(run.stdout,/gltf\s+ready/);assert.match(run.stdout,/playwright\s+ready/);
    const env={...setup.tools.gltf.env,...setup.tools.playwright.env},scripts=environmentScripts(env);
    assert.equal(readFileSync(join(dir,'env.sh'),'utf8'),scripts.sh);
    assert.equal(readFileSync(join(dir,'env.ps1'),'utf8'),scripts.ps1);
    let loaded;
    if(process.platform==='win32'){
      const probe=join(dir,'probe.ps1');
      writeFileSync(probe,'. $args[0]\n[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)\n[Console]::Write($env:PLAYWRIGHT_MODULE)\n');
      loaded=spawnSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',probe,join(dir,'env.ps1')],{encoding:'utf8'});
    }else loaded=spawnSync('sh',['-c','. "$1"; printf "%s" "$PLAYWRIGHT_MODULE"','sh',join(dir,'env.sh')],{encoding:'utf8'});
    assert.equal(loaded.status,0,loaded.stderr);
    assert.equal(loaded.stdout,setup.paths.playwright,'shell expansion must not alter environment paths');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
