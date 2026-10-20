import {GLTFLoader} from '../../vendor/three/addons/loaders/GLTFLoader.js';

export const AQUILA_MODEL_URL = 'assets/models/roman-aquila-v029.glb';
const url = new URL(`../../${AQUILA_MODEL_URL}`, import.meta.url).href;

export function createAquilaAssetLibrary(load = async () => new GLTFLoader().loadAsync(url)) {
  let pending = null, master = null, failure = null;
  return {
    warm() {
      return pending ??= (async () => {
        try {
          const gltf = await load();
          let found = null;
          gltf.scene.traverse(obj => {
            if (!found && obj.isMesh && obj.geometry?.attributes?.position) found = obj;
          });
          if (!found) throw new Error('Invalid Aquila GLB asset');
          const bones = found.skeleton ? found.skeleton.bones.map(b => b.name) : [];
          master = {geometry: found.geometry, bones};
          return true;
        } catch (error) {
          failure = String(error?.message ?? error);
          return false;
        }
      })();
    },
    status() {
      return {ready: !!master, pending: !!pending && !master && !failure, error: failure};
    },
    geometry() {
      return master ? master.geometry.clone() : null;
    },
    bones() {
      return master ? [...master.bones] : [];
    },
  };
}

const defaultLibrary = createAquilaAssetLibrary();
export const warmAquilaAsset = () => defaultLibrary.warm();
export const aquilaAssetStatus = () => defaultLibrary.status();
export const aquilaGeometry = () => defaultLibrary.geometry();
export const aquilaBones = () => defaultLibrary.bones();
