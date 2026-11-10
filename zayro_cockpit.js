'use strict';
/* ZAYRO COCKPIT v1.0 — loads after zayro_certificate.js (base game code untouched).
   CIRCUIT MAP: a real top-down road view instead of plain boxes —
   textured asphalt, grass, red/white kerbs, steel barriers, dashed lane lines, tyre tracks, 100 m ticks,
   chequered FINISH line with distance read-out, top-down car sprites (you / rivals / traffic) with lights,
   headlight cone, night/rain tint and a fade-out into the distance.
   PEDAL BUTTONS: styled in zayro_cockpit.css. Everything is wrapped in try/catch. */
(function(){
const cv=document.getElementById('map');
if(!cv||typeof drawMap!=='function')return;
const _old=drawMap;

/* ---------- display canvas (2x of its 180x120 CSS size) + glass bezel */
const W=360,H=240;
cv.width=W;cv.height=H;
try{
  const wrap=document.createElement('div');wrap.className='zc-screen';
  cv.parentNode.insertBefore(wrap,cv);wrap.appendChild(cv);
  const glass=document.createElement('div');glass.className='zc-glass';wrap.appendChild(glass);
}catch(e){console.error('ZAYRO COCKPIT wrap',e);}

/* ---------- view geometry */
const SX=5.4;                 // px per world unit sideways
const AHEAD=640,BEHIND=95;    // metres visible ahead / behind the player
const SY=H/(AHEAD+BEHIND);    // px per metre along the road
const PY=H-BEHIND*SY;         // screen y of the player
const CX=W/2;
const ROAD=17.0,KERB=1.5,BARRIER=19.4;

/* ---------- helpers */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rgb=(c,k=1,add=0)=>{
  if(!c)return 'rgb(120,120,120)';
  const m=Math.max(c[0],c[1],c[2])<=1.5?255:1;
  return `rgb(${clamp(Math.round(c[0]*m*k+add),0,255)},${clamp(Math.round(c[1]*m*k+add),0,255)},${clamp(Math.round(c[2]*m*k+add),0,255)})`;
};
const TRAFFIC=['#cfd3d6','#3a4a63','#8a2b2b','#2d5d44','#c9a233','#555b60','#6b3f78','#e4e6e8'];

/* noise tile for asphalt grain (made once) */
const grain=document.createElement('canvas');grain.width=grain.height=128;
(function(){
  const g=grain.getContext('2d');let s=1234567;
  const R=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  for(let i=0;i<900;i++){
    const v=R()<.5?0:255;g.fillStyle=`rgba(${v},${v},${v},${.05+R()*.09})`;
    g.fillRect(R()*128,R()*128,1+R()*1.5,1+R()*1.5);
  }
})();
let grainPat=null;

/* top-down car sprite, nose pointing up; (x,y) = centre */
function car(c,x,y,yaw,color,s,opt){
  opt=opt||{};
  c.save();c.translate(x,y);c.rotate(yaw||0);c.scale(s,s);
  // soft shadow
  c.fillStyle='rgba(0,0,0,.38)';c.beginPath();c.ellipse(1.2,1.8,5.6,9.6,0,0,6.283);c.fill();
  // body
  const bg=c.createLinearGradient(-5,0,5,0);
  bg.addColorStop(0,color.dk);bg.addColorStop(.5,color.lt);bg.addColorStop(1,color.dk);
  c.fillStyle=bg;
  c.beginPath();
  c.moveTo(-3.3,-9);c.quadraticCurveTo(0,-10.6,3.3,-9);c.lineTo(4.7,-5.5);c.lineTo(4.9,5);c.quadraticCurveTo(4.8,8.8,2.8,9);
  c.lineTo(-2.8,9);c.quadraticCurveTo(-4.8,8.8,-4.9,5);c.lineTo(-4.7,-5.5);c.closePath();c.fill();
  c.lineWidth=.7;c.strokeStyle=opt.outline||'rgba(0,0,0,.65)';c.stroke();
  // windscreen / roof / rear glass
  c.fillStyle='rgba(12,20,28,.92)';
  c.beginPath();c.moveTo(-3.4,-4.6);c.lineTo(3.4,-4.6);c.lineTo(3.9,-1.2);c.lineTo(-3.9,-1.2);c.closePath();c.fill();
  c.fillStyle=color.lt;c.fillRect(-3.4,-1.2,6.8,4.2);
  c.fillStyle='rgba(12,20,28,.92)';
  c.beginPath();c.moveTo(-3.6,3);c.lineTo(3.6,3);c.lineTo(3.1,5.6);c.lineTo(-3.1,5.6);c.closePath();c.fill();
  // roof shine
  c.fillStyle='rgba(255,255,255,.22)';c.fillRect(-1.2,-1.2,1.6,4.2);
  // lights
  c.fillStyle=opt.night?'#fff6c0':'#f4f1d4';c.fillRect(-3.8,-9.4,2,1.1);c.fillRect(1.8,-9.4,2,1.1);
  c.fillStyle=opt.brake?'#ff2a2a':'#b3171d';c.fillRect(-4.3,8.1,2.4,1.1);c.fillRect(1.9,8.1,2.4,1.1);
  c.restore();
}
const pal=col=>{
  if(!col)return {lt:'#9aa0a6',dk:'#4b5056'};
  const m=Math.max(col[0],col[1],col[2])<=1.5?255:1;
  const r=col[0]*m,g=col[1]*m,b=col[2]*m,f=k=>`rgb(${clamp(Math.round(r*k+10),0,255)},${clamp(Math.round(g*k+10),0,255)},${clamp(Math.round(b*k+10),0,255)})`;
  return {lt:f(1.12),dk:f(.55)};
};
const trafficPal=TRAFFIC.map(h=>{const n=parseInt(h.slice(1),16);return pal([(n>>16)&255,(n>>8)&255,n&255]);});

function drawMapReal(){
  if(typeof freeRoam!=='undefined'&&freeRoam)return;       // city mode uses the round radar instead
  const c=cv.getContext('2d');
  const pz=player.z,px=player.x;
  const night=(typeof condition!=='undefined'&&condition==='night')||(typeof selectedRoad!=='undefined'&&selectedRoad===4);
  const rain=typeof condition!=='undefined'&&condition==='rain';
  const base=(typeof K!=='undefined'&&K.road)?K.road:[.12,.14,.15];
  const gnd=(typeof K!=='undefined'&&K.ground)?K.ground:[.28,.34,.30];
  const X=x=>CX+x*SX;                       // world x -> screen x (road fixed, cars move across it)
  const Y=z=>PY-(z-pz)*SY;                  // world z -> screen y
  const zTop=pz+AHEAD,zBot=pz-BEHIND;

  /* ground */
  c.fillStyle=rgb(gnd,.62,6);c.fillRect(0,0,W,H);
  c.fillStyle='rgba(0,0,0,.18)';
  for(let z=Math.floor(zBot/40)*40;z<zTop;z+=40){const y=Y(z);c.fillRect(0,y,X(-BARRIER-1),1.2);c.fillRect(X(BARRIER+1),y,W,1.2);}

  /* run-off gravel + kerbs + barriers */
  c.fillStyle='#8c8577';c.fillRect(X(-ROAD-KERB-1.6),0,X(-ROAD-KERB)-X(-ROAD-KERB-1.6),H);c.fillRect(X(ROAD+KERB),0,X(1.6)-X(0),H);
  const k0=Math.floor(zBot/16)*16;
  for(let z=k0,i=Math.round(k0/16);z<zTop;z+=16,i++){
    const y1=Y(z+16),hh=16*SY+.6;
    c.fillStyle=(i&1)?'#d8281f':'#f2f2ee';
    c.fillRect(X(-ROAD-KERB),y1,KERB*SX,hh);c.fillRect(X(ROAD),y1,KERB*SX,hh);
  }
  c.fillStyle='#aab3b8';c.fillRect(X(-BARRIER)-1,0,2.6,H);c.fillRect(X(BARRIER)-1.6,0,2.6,H);
  c.fillStyle='#e9eef0';c.fillRect(X(-BARRIER)-1,0,1,H);c.fillRect(X(BARRIER)-1.6,0,1,H);

  /* asphalt */
  c.fillStyle=rgb(base,1.55,26);c.fillRect(X(-ROAD),0,2*ROAD*SX,H);
  if(!grainPat)grainPat=c.createPattern(grain,'repeat');
  if(grainPat){c.save();c.translate(0,(pz*SY)%128);c.fillStyle=grainPat;c.fillRect(X(-ROAD),-128,2*ROAD*SX,H+256);c.restore();}
  // slab joints
  c.fillStyle='rgba(0,0,0,.22)';
  for(let z=Math.floor(zBot/30)*30;z<zTop;z+=30)c.fillRect(X(-ROAD),Y(z),2*ROAD*SX,1);
  // polished tyre tracks
  c.fillStyle='rgba(0,0,0,.20)';
  for(const lx of [-14.17,-8.5,-2.83,2.83,8.5,14.17])for(const o of [-.95,.95])c.fillRect(X(lx+o)-1.4,0,2.8,H);

  /* lane markings */
  c.fillStyle='rgba(240,240,232,.9)';
  c.fillRect(X(-ROAD+.25)-1,0,1.6,H);c.fillRect(X(ROAD-.25)-.6,0,1.6,H);
  const d0=Math.floor(zBot/12)*12;
  for(const lx of [-11.33,-5.67,5.67,11.33])for(let z=d0;z<zTop;z+=12)c.fillRect(X(lx)-.8,Y(z+4.5),1.6,4.5*SY);
  c.fillStyle='#f0b928';c.fillRect(X(0)-2.4,0,1.5,H);c.fillRect(X(0)+.9,0,1.5,H);

  /* 100 m ticks on the left grass + km figure every 500 m */
  c.font="700 9px 'Space Mono',monospace";c.textAlign='left';
  for(let z=Math.floor(zBot/100)*100;z<zTop;z+=100){
    if(z<0)continue;const y=Y(z);
    c.fillStyle='rgba(255,255,255,.55)';c.fillRect(2,y,9,1.4);
    if(z%500===0){c.fillStyle='rgba(255,255,255,.8)';c.fillText((z/1000).toFixed(1)+'K',2,y-3);}
  }

  /* FINISH line */
  const Z=(typeof raceTargetDistance!=='undefined')?raceTargetDistance:0;
  if(Z>0){
    const y=Y(Z);
    if(y>-12&&y<H+12){
      const cell=5,x0=X(-ROAD),n=Math.ceil(2*ROAD*SX/cell);
      for(let r=0;r<2;r++)for(let i=0;i<n;i++){c.fillStyle=((i+r)&1)?'#101214':'#f6f6f1';c.fillRect(x0+i*cell,y-cell+r*cell,cell,cell);}
      c.fillStyle='#e9c25a';c.fillRect(X(-ROAD-KERB)-3,y-9,4,16);c.fillRect(X(ROAD+KERB)-1,y-9,4,16);
      c.fillStyle='#f5d47d';c.font="900 italic 10px 'Barlow Condensed',Impact,sans-serif";c.textAlign='center';c.fillText('FINISH',CX,y-8);
    }
    if(Z<zTop){ // past the line: darken
      const y2=clamp(Y(Z)-5,0,H);c.fillStyle='rgba(0,0,0,.45)';c.fillRect(0,0,W,y2);
    }
  }

  /* distance fade (road vanishes into haze) */
  const fade=c.createLinearGradient(0,0,0,H*.5);
  fade.addColorStop(0,'rgba(8,12,15,.78)');fade.addColorStop(1,'rgba(8,12,15,0)');
  c.fillStyle=fade;c.fillRect(0,0,W,H*.5);

  /* cars: traffic first (back), rivals, then you */
  const inView=z=>z>zBot-20&&z<zTop+20;
  for(let i=0;i<traffic.length;i++){
    const t=traffic[i];if(!inView(t.z))continue;
    car(c,X(t.x),Y(t.z),t.yaw||0,trafficPal[i%trafficPal.length],.78,{night});
  }
  if(typeof rivals!=='undefined'&&typeof raceEvent!=='undefined'&&raceEvent!=='timeTrial'){
    for(const r of rivals){if(!inView(r.z))continue;const p=pal(r.color);car(c,X(r.x),Y(r.z),r.yaw||0,p,.95,{night});
      c.fillStyle='rgba(255,196,91,.9)';c.beginPath();c.arc(X(r.x),Y(r.z)-14,1.6,0,6.283);c.fill();}
  }
  // headlight cone
  const py=PY,pxs=X(px);
  const cone=c.createLinearGradient(0,py-6,0,py-120);
  cone.addColorStop(0,night?'rgba(255,248,200,.45)':'rgba(255,248,210,.18)');cone.addColorStop(1,'rgba(255,248,200,0)');
  c.save();c.translate(pxs,py);c.rotate(player.yaw||0);c.translate(-pxs,-py);
  c.fillStyle=cone;c.beginPath();c.moveTo(pxs-5,py-9);c.lineTo(pxs-17,py-120);c.lineTo(pxs+17,py-120);c.lineTo(pxs+5,py-9);c.closePath();c.fill();
  c.restore();
  // you
  const pulse=.5+.5*Math.sin(performance.now()/260);
  c.strokeStyle=`rgba(216,255,56,${.35+.4*pulse})`;c.lineWidth=1.6;c.beginPath();c.arc(pxs,py,15+pulse*2,0,6.283);c.stroke();
  car(c,pxs,py,player.yaw||0,{lt:'#e4ff5c',dk:'#8ab11a'},1.25,{night,brake:!!(window.zrState&&window.zrState.brake),outline:'#0b1000'});

  /* night / rain tint */
  if(night){c.fillStyle='rgba(6,10,40,.34)';c.fillRect(0,0,W,H);}
  else if(rain){c.fillStyle='rgba(40,70,110,.16)';c.fillRect(0,0,W,H);}

  /* HUD strip: remaining distance + position */
  const rem=Math.max(0,Math.round(Z-pz));
  c.fillStyle='rgba(5,8,10,.72)';c.fillRect(0,H-20,W,20);
  c.fillStyle='#f5d47d';c.font="900 italic 14px 'Barlow Condensed',Impact,sans-serif";c.textAlign='left';
  c.fillText(Z>0?'FINISH '+rem.toLocaleString('en-US')+' M':'',8,H-6);
  c.fillStyle='#9fb0b4';c.font="9px 'Space Mono',monospace";c.textAlign='right';
  c.fillText('N ▲',W-8,H-7);
}

drawMap=function(){
  try{drawMapReal();}
  catch(e){if(!drawMap.err){drawMap.err=1;console.error('ZAYRO COCKPIT map',e);}try{_old();}catch(_){}}
};
})();
