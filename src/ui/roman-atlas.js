// Measured source row boundaries and sole lines from the generated export.
// Runtime normalization is a draw operation; it does not alter source artwork.
export const ROMAN_DETAIL_ATLAS='./assets/tactical/units-roman-v031.webp';
export const ROMAN_DETAIL_ROWS=Object.freeze([
  {top:0,bottom:364,sole:350,head:33},
  {top:364,bottom:714,sole:704,head:378},
  {top:714,bottom:1052,sole:1040,head:724},
  {top:1052,bottom:1448,sole:1395,head:1060}
]);
const cache=new WeakMap();
export function normalizedRomanAtlas(image){
  if(cache.has(image))return cache.get(image);
  const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(768,1024):globalThis.document?.createElement('canvas');
  if(!canvas)return image;canvas.width=768;canvas.height=1024;const c=canvas.getContext('2d');
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const r=ROMAN_DETAIL_ROWS[row],x=Math.round(col*image.width/4),right=Math.round((col+1)*image.width/4),scale=221/(r.sole-r.head),w=(right-x)*scale,h=(r.bottom-r.top)*scale;
    c.save();c.beginPath();c.rect(col*192,row*256,192,256);c.clip();c.drawImage(image,x,r.top,right-x,r.bottom-r.top,col*192+(192-w)/2,row*256+240-(r.sole-r.top)*scale,w,h);c.restore();
  }
  cache.set(image,canvas);return canvas;
}
