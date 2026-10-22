# Three.js addons

Vendored from the official Three.js r186 release (the GitHub tag and the `three@0.186.1` npm package carry the same files):

- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/loaders/GLTFLoader.js
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/utils/BufferGeometryUtils.js
- https://github.com/mrdoob/three.js/blob/r186/examples/jsm/utils/SkeletonUtils.js
- and, since the asset foundation, from the `three@0.186.1` npm package: the KTX2 loader with its worker pool, colour spaces, KTX container parser and Zstandard decoder; the Basis Universal transcoder; and the meshopt decoder.

Only changes: bare `three` imports become local `../../three.module.js` imports. No CDN requests or external decoder services. The glTF addons were fetched 2026-10-17, the others 2026-10-22. `tests/model-compression.test.mjs` checks every file below against its published SHA-256, after undoing the import change.

| File | Published SHA-256 | Licence |
| --- | --- | --- |
| `loaders/GLTFLoader.js` | `131c0f78c01d19368ae495caa65b3adaa10487810a36a05bb5901b769a35ac16` | MIT, three.js authors |
| `loaders/KTX2Loader.js` | `3a3233ce3409443076d3414b78832e1405fcfac5ecb34d367365fd0781127d6c` | MIT, three.js authors |
| `utils/BufferGeometryUtils.js` | `9fb63427ce6641fa14fd0baff9cc4d1b5f9c3d85fd084bf2e90e803c44ec1797` | MIT, three.js authors |
| `utils/SkeletonUtils.js` | `b1632a703206c3d830de9fcbe515696770d04b71a15ee6b50afa6d2c3298c86f` | MIT, three.js authors |
| `utils/WorkerPool.js` | `5ac7095fd566bc9ae48376055fd66edf27cb9ebbf9e1269dc206bfd4933ae9eb` | MIT, three.js authors |
| `math/ColorSpaces.js` | `cc35c01c793cd17ccded7bc8142abffd3ce0d60dd6de8d5d216983bd05aee262` | MIT, three.js authors |
| `libs/ktx-parse.module.js` | `f40c491f6c44dde511268121f778a0050e73b1a15fd844c1ae2c78c73213eafc` | MIT, Don McCurdy (ktx-parse) |
| `libs/zstddec.module.js` | `5cbf818e842628a4464e748594a6deae18ceddda3c2f541e7b3a0ff5fc7611e2` | MIT, Don McCurdy (zstddec), with Zstandard compiled to WebAssembly (BSD, Meta Platforms) |
| `libs/meshopt_decoder.module.js` | `d428e73a000057c6c94bfcedc3412d0c2dc14ca8800e88553aab05113ad2bf19` | MIT, Arseny Kapoulkine (meshoptimizer 1.1); the notice is in the file |
| `libs/basis/basis_transcoder.js` | `8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1` | Apache 2.0, Binomial LLC (Basis Universal): [`libs/basis/LICENSE`](libs/basis/LICENSE) |
| `libs/basis/basis_transcoder.wasm` | `6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a` | Apache 2.0, Binomial LLC (Basis Universal) |
| `libs/basis/README.md` | `a578df416c1e0852e9c36a1cf91b4d28d91a251294f87ce610a3bc7ca4df15e0` | MIT, three.js authors |

`libs/basis/LICENSE` is the Apache License 2.0 text, copied from the Basis Universal source (v1.16.4).

## Generated from the vendored files

`libs/basis/basis_worker.js` is the transcoder worker that `KTX2Loader` assembles at run time from `KTX2Loader.BasisWorker` and `basis_transcoder.js` and starts from a `blob:` URL. The page's Content Security Policy (`worker-src 'self'`) refuses `blob:` workers, so [`scripts/assets/ktx2-worker.mjs`](../../../scripts/assets/ktx2-worker.mjs) writes the same script as a file, and the game's loader ([`model-loader.js`](../../../src/showcase/model-loader.js)) starts it from the page's own origin. The test above fails while the file differs from what the script produces.
