export function drawFieldFeature(c,g,p,o){
  const s=g.tw/64;c.save();c.translate(p.x,p.y);c.scale(s,s);c.lineWidth=2;c.strokeStyle='#c5ac79';c.fillStyle='#69543c';
  if(o.kind==='gate'){c.fillRect(-20,-38,5,38);c.fillRect(15,-38,5,38);c.fillRect(-22,-40,44,5);if(o.state==='closed')for(let x=-13;x<15;x+=6)c.fillRect(x,-34,3,34);}
  else if(o.kind==='bridge'){c.strokeStyle='#927450';for(let y=-10;y<=10;y+=4){if(o.state==='damaged'&&Math.abs(y)<5)continue;c.beginPath();c.moveTo(-21,y);c.lineTo(21,y);c.stroke();}}
  else if(o.kind==='barricade'){for(let x=-16;x<=16;x+=8){c.beginPath();c.moveTo(x-5,o.state==='intact'?-23:-5);c.lineTo(x+5,2);c.stroke();}}
  else if(o.kind==='signal'){c.fillRect(-2,-48,4,48);c.fillStyle=o.state==='secured'?'#d4b36b':'#9d4b43';c.fillRect(2,-46,22,14);}
  else if(o.kind==='stores'){c.fillRect(-17,-16,34,16);c.fillStyle='#bcaa80';if(o.state==='available')c.fillRect(-12,-28,24,13);for(const x of [-18,18]){c.beginPath();c.ellipse(x,-2,5,8,0,0,7);c.fill();}}
  else{c.fillRect(-10,-16,20,10);if(o.state==='burning'){c.fillStyle='#f0b856';c.beginPath();c.moveTo(-9,-16);c.lineTo(3,-42);c.lineTo(9,-16);c.fill();c.fillStyle='#6b6b6480';for(let i=0;i<3;i++){c.beginPath();c.ellipse(i*3,-45-i*15,10+i*3,12,0,0,7);c.fill();}}}
  c.restore();
}
