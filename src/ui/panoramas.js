// The far skylines beyond the 3D scenes (docs/asset-pipeline.md#the-horizon), as
// data shared by the build (scripts/assets/build-panoramas.mjs), the world
// catalog and the panorama material. Each region's panorama is an original
// landscape rendered in Blender (scripts/assets/render-panorama.py): a band all
// round, from 4 degrees below the horizon to 10.0625 above, as seen from 12 m
// above the board's centre, 8192 by 320 pixels with north in its middle. The
// game's file folds it into two rows of 4096 (the half from due south through
// west to north above the half from north through east to south), so that no
// side exceeds 4096. Presentation only: nothing in it is terrain or a rule.
export const PANORAMA_BAND=Object.freeze({minLatitude:-4,maxLatitude:10.0625,eye:12,width:8192,height:320,rows:2});
export const PANORAMA_REGIONS=Object.freeze(['forest','reeds','hills','mesa','alps','palmyra','farmland','rome','campagna']);
export const panoramaFile=key=>`assets/textures/panoramas/${key}-v1.ktx2`;
// Each chapter's skyline: the Danube's woods (I, IV, VIII), the marshes after
// Abritus (II), the road station's hills (III), the Euphrates (V, VI), the Po
// plain under the Alps (VII), Palmyra (IX), the harvest of Dacia Aureliana (X),
// Rome within its walls (XI) and the Campagna outside them (XII).
const CHAPTER_PANORAMAS=Object.freeze({1:'forest',2:'reeds',3:'hills',4:'forest',5:'mesa',6:'mesa',7:'alps',8:'forest',9:'palmyra',10:'farmland',11:'rome',12:'campagna'});
export const panoramaKey=chapter=>CHAPTER_PANORAMAS[chapter]??null;
export const panoramaChapters=key=>Object.entries(CHAPTER_PANORAMAS).filter(([,k])=>k===key).map(([chapter])=>Number(chapter));
