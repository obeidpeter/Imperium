// Assembles three.js's Basis transcoder worker as a file of its own
// (vendor/three/addons/libs/basis/basis_worker.js). KTX2Loader builds the same
// script at run time, from KTX2Loader.BasisWorker and basis_transcoder.js, and
// starts it from a blob: URL, which the page's Content Security Policy refuses
// (worker-src 'self'). The game's loader (src/showcase/model-loader.js) starts
// this file instead. Run it after updating the vendored KTX2Loader or
// transcoder; tests/model-compression.test.mjs fails while the file differs.
//
//   node scripts/assets/ktx2-worker.mjs
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {KTX2Loader} from '../../vendor/three/addons/loaders/KTX2Loader.js';

const root=new URL('../../',import.meta.url);
export const KTX2_WORKER='vendor/three/addons/libs/basis/basis_worker.js';

/** The worker's source, in the order KTX2Loader.init assembles it. */
export async function ktx2WorkerSource(){
  const transcoder=(await readFile(new URL('vendor/three/addons/libs/basis/basis_transcoder.js',root),'utf8')).replaceAll('\r\n','\n');
  const fn=KTX2Loader.BasisWorker.toString();
  return ['/* three.js r186 KTX2Loader.BasisWorker with basis_transcoder.js, assembled by scripts/assets/ktx2-worker.mjs. */',
    '/* constants */',
    'let _EngineFormat = '+JSON.stringify(KTX2Loader.EngineFormat),
    'let _EngineType = '+JSON.stringify(KTX2Loader.EngineType),
    'let _TranscoderFormat = '+JSON.stringify(KTX2Loader.TranscoderFormat),
    'let _BasisFormat = '+JSON.stringify(KTX2Loader.BasisFormat),
    '/* basis_transcoder.js */',
    transcoder,
    '/* worker */',
    fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}'))
  ].join('\n')+'\n';
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  await writeFile(new URL(KTX2_WORKER,root),await ktx2WorkerSource());
  console.log(`Wrote ${KTX2_WORKER}`);
}
