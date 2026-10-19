// The Senate blocs as both views draw them: one colour, the letter the 2D board
// prints beside a delegate and the 3D stance marker leads with, and the shape of
// the toga trim. A delegate's bloc therefore never rests on colour alone. The
// palette keeps every pair of delegate blocs apart under simulated protanopia,
// deuteranopia and tritanopia (Landholders are wheat ochre, not green, so they
// no longer meet the Veterans' crimson on the red–green confusion line).
export const BLOC_STYLE=Object.freeze({
  Veterans:Object.freeze({color:'#a8382d',letter:'V',trim:'broad'}),
  Landholders:Object.freeze({color:'#c39a35',letter:'L',trim:'double'}),
  Civic:Object.freeze({color:'#3a64a8',letter:'C',trim:'broken'}),
  Chamber:Object.freeze({color:'#7d4a96',letter:'Ch',trim:'gilt'}),
  Army:Object.freeze({color:'#786844',letter:'A',trim:'plain'}),
  People:Object.freeze({color:'#6a7969',letter:'P',trim:'plain'})
});
export const DELEGATE_BLOCS=Object.freeze(['Veterans','Landholders','Civic']);
// Bands of toga trim along each edge of the drape, in the drape's own across
// coordinate: one broad band, a double band, a band broken into three lengths
// (rows give the drape rows each length spans), or a band with a gilt line.
export function trimBands(bloc){
  const trim=BLOC_STYLE[bloc]?.trim??'plain',bands=[];
  for(const edge of [.11,.83]){
    if(trim==='broad')bands.push({from:edge-.02,to:edge+.085});
    else if(trim==='double')bands.push({from:edge-.012,to:edge+.024},{from:edge+.044,to:edge+.08});
    else if(trim==='broken')for(const rows of [[0,1],[2,3],[4,5]])bands.push({from:edge,to:edge+.07,rows});
    else if(trim==='gilt')bands.push({from:edge,to:edge+.07},{from:edge+.026,to:edge+.044,gilt:true,offset:.012});
    else bands.push({from:edge,to:edge+.055});
  }
  return bands;
}
