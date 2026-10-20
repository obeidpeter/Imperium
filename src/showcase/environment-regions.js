// Art direction only: reconstructed places, not archaeological or rule data.
const regions=[
  ['danube-oak','Oak, lime and damp earth','#776044','#403b30','#b7b5a3','#b8a783','#842f2a','timber',.3],
  ['abritus-reed','Water-dark timber and reed silt','#665e47','#373c32','#939a85','#b4ad8b','#753f32','timber',.8],
  ['station-lime','Limewashed courier court','#827053','#4f4538','#c8c1a7','#c8bba0','#85513b','lime',.25],
  ['danube-limestone','Weathered limestone and oak','#75634a','#443d33','#b8bdaf','#c2b393','#923d30','stone',.3],
  ['euphrates-ochre','Ochre mudbrick, gypsum and cedar','#92704d','#524333','#cbb48f','#cbbb99','#9a4432','mudbrick',.6],
  ['edessa-dust','Sun-bleached canvas and ochre dust','#9b8160','#63513b','#d0b997','#d1c1a0','#875039','mudbrick',.75],
  ['italian-lime','Italian lime, warm oak and oxblood','#806047','#45372d','#c8c5ad','#d0bf9d','#8d302a','lime',.2],
  ['danube-pine','Pine landing and cool river stone','#827557','#4a4b3a','#a9b9b1','#c4b89a','#85533e','timber',.65],
  ['palmyra-sandstone','Pale sandstone and vermilion plaster','#9a7751','#5d4935','#dfccb0','#d8c8aa','#a34532','stone',.3],
  ['province-harvest','Granary lime, terracotta and wheat','#8e6e4c','#534535','#c9c9b0','#cbbb90','#82694a','lime',.2],
  ['rome-marble','Travertine, marble and deep red','#79634d','#433c34','#d7d1bf','#ccbea2','#7e3433','marble',.1],
  ['aurelian-brick','New Roman brick and imperial purple','#816449','#49392f','#c2ad96','#c8b498','#64455f','brick',.35]
].map(([key,title,wood,darkWood,stone,cloth,accent,masonry,wear])=>Object.freeze({key,title,wood,darkWood,stone,cloth,accent,masonry,wear}));
export function regionalEnvironment(chapter=1){
  return regions[Number.isInteger(chapter)&&chapter>=1&&chapter<=12?chapter-1:0];
}
