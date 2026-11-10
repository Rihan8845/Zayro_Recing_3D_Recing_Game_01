'use strict';
/* ZAYRO FINISH v1.0 — loads after zayro_legend.js (base game code untouched).
   A professional FINISH GATE on every road and every stage (also Sprint = 800 m, Time Trial, Circuit):
   - LED truss gantry with big "FINISH" display + "ZAYRO RACING" sub-line, chequered end panels, floodlights
   - chequered finish line painted on the asphalt, white pre-line, glowing approach markers
   - 300 / 200 / 100 m countdown boards, flags, sponsor boards along the barriers
   - roofed grandstands on both sides with a crowd
   - HUD countdown "FINISH 300 M" and a chequered-flag celebration (flash, confetti, fanfare) when the stage is cleared
   The gate is placed at raceTargetDistance, exactly where the game ends the stage, so it always matches.
   Everything is wrapped in try/catch: a failure here can never stop the game. */
(function(){
const G={};                       // gate state
let built=null,builtZ=-1,builtKey='';

/* ---------------------------------------------------------------- pixel font (5x7) */
const FONT={
F:['#####','#....','#....','####.','#....','#....','#....'],
I:['###','.#.','.#.','.#.','.#.','.#.','###'],
N:['#...#','##..#','##..#','#.#.#','#..##','#..##','#...#'],
S:['.####','#....','#....','.###.','....#','....#','####.'],
H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
Z:['#####','....#','...#.','..#..','.#...','#....','#####'],
A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],
Y:['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],
R:['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
O:['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],
C:['.###.','#...#','#....','#....','#....','#...#','.###.'],
G:['.###.','#...#','#....','#.###','#...#','#...#','.###.'],
' ':['...','...','...','...','...','...','...']};
const textWidth=(t,gap)=>[...t].reduce((a,ch,i)=>a+FONT[ch][0].length+(i?gap:0),0);

/* ---------------------------------------------------------------- geometry builder */
const COL={
 graphite:[.075,.085,.095],steel:[.55,.58,.62],dark:[.2,.22,.25],white:[.94,.94,.91],black:[.018,.018,.022],
 red:[.80,.07,.09],gold:[.88,.66,.20],concrete:[.46,.46,.48],roofW:[.86,.87,.89],
 ledW:[1,1,.95],ledA:[1,.72,.16],ledC:[.30,.92,1],ledR:[1,.14,.10],
 seat:[.16,.18,.21]};
const CROWD=[[.85,.12,.14],[.93,.93,.9],[.12,.3,.75],[.08,.08,.1],[.95,.78,.15],[.12,.55,.3],[.9,.45,.12],[.55,.2,.6]];

function makeBuilder(){
  const map=new Map();
  function box(color,emit,gloss,p,size,yaw,roll){
    yaw=yaw||0;roll=roll||0;
    const key=color.join(',')+'|'+(emit?1:0)+'|'+gloss;
    let b=map.get(key);if(!b){b={p:[],n:[],color,emit,gloss};map.set(key,b);}
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
    for(const fc of faceData)for(const j of triangles){
      const v=fc[j],n=fc[4];
      let x=v[0]*size[0],y=v[1]*size[1],z=v[2]*size[2];
      const x1=x*cr-y*sr,y1=x*sr+y*cr;
      b.p.push(p[0]+x1*cy+z*sy,p[1]+y1,p[2]-x1*sy+z*cy);
      const nx=n[0]*cr-n[1]*sr,ny=n[0]*sr+n[1]*cr;
      b.n.push(nx*cy+n[2]*sy,ny,-nx*sy+n[2]*cy);
    }
  }
  return {box,map};
}

function buildGate(Z,seed){
  const B=makeBuilder(),box=B.box;
  let s=seed>>>0;const R=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
  const SOLID=(c,p,sz,yaw,roll)=>box(c,false,.15,p,sz,yaw,roll);
  const GLOW=(c,p,sz,yaw,roll)=>box(c,true,0,p,sz,yaw,roll);
  const SHINY=(c,p,sz,yaw,roll)=>box(c,false,.5,p,sz,yaw,roll);
  const HX=19.7;                                   // pylon centre line

  /* --- pylons */
  for(const sd of [-1,1]){
    const x=sd*HX;
    SOLID(COL.dark,[x,.3,Z],[1.25,.3,1.4]);
    SOLID(COL.graphite,[x,5.7,Z],[.62,5.4,.72]);
    SHINY(COL.steel,[x,.62,Z],[.7,.04,.8]);
    GLOW(COL.ledC,[x,5.4,Z-.75],[.14,4.5,.03]);
    GLOW(COL.ledC,[x-sd*.62-0,5.4,Z-.02],[.03,4.5,.14]);
    for(let k=0;k<6;k++)GLOW(k%2?COL.white:COL.red,[x,1.1+k*.42,Z-.76],[.5,.14,.025]);   // base stripes
    SOLID(COL.graphite,[x,11.25,Z],[.8,.28,.86]);
    GLOW(COL.ledR,[x,11.7,Z],[.14,.14,.14]);                                             // beacon
  }

  /* --- truss gantry */
  const top=10.95,bot=9.85;
  for(const zz of [-.45,.45]){
    SHINY(COL.steel,[0,top,Z+zz],[HX,.09,.09]);
    SHINY(COL.steel,[0,bot,Z+zz],[HX,.09,.09]);
    const step=1.6,ang=Math.atan2(top-bot,step);
    let i=0;
    for(let x=-HX+step/2;x<HX;x+=step,i++){
      SOLID(COL.dark,[x,(top+bot)/2,Z+zz],[Math.hypot(step,top-bot)/2,.04,.04],0,(i%2?1:-1)*ang);
    }
    for(let x=-HX;x<=HX+.01;x+=step)SOLID(COL.dark,[x,(top+bot)/2,Z+zz],[.04,(top-bot)/2,.04]);
  }
  for(let x=-HX;x<=HX+.01;x+=3.2){SOLID(COL.dark,[x,top,Z],[.04,.04,.45]);SOLID(COL.dark,[x,bot,Z],[.04,.04,.45]);}
  SOLID(COL.graphite,[0,top+.2,Z],[HX,.1,.55]);     // roof plate
  // floodlights
  for(let x=-16;x<=16;x+=4){SOLID(COL.black,[x,top+.5,Z-.2],[.45,.22,.3]);GLOW(COL.ledW,[x,top+.38,Z-.52],[.38,.12,.04]);}

  /* --- sign board */
  const cy=7.65,hh=1.95,hw=11,zf=Z-.62;
  for(const x of [-9,-3,3,9]){SOLID(COL.dark,[x,(cy+hh+bot)/2,Z-.45],[.05,(bot-cy-hh)/2,.05]);}
  SOLID(COL.black,[0,cy,Z-.55],[hw,hh,.12]);
  SHINY(COL.gold,[0,cy+hh,Z-.57],[hw+.15,.09,.16]);SHINY(COL.gold,[0,cy-hh,Z-.57],[hw+.15,.09,.16]);
  for(const sd of [-1,1])SHINY(COL.gold,[sd*(hw+.07),cy,Z-.57],[.09,hh+.09,.16]);
  GLOW(COL.ledA,[0,cy+hh-.2,zf-.05],[hw-.3,.03,.02]);GLOW(COL.ledA,[0,cy-hh+.2,zf-.05],[hw-.3,.03,.02]);
  const drawText=(t,cell,gap,yc,color)=>{
    const wCells=textWidth(t,gap),x0=-wCells*cell/2;let col=0;
    for(const ch of t){
      const g=FONT[ch];
      for(let r=0;r<7;r++)for(let q=0;q<g[r].length;q++)if(g[r][q]==='#')
        GLOW(color,[x0+(col+q+.5)*cell,yc+(3-r)*cell,zf-.03],[cell*.46,cell*.46,.03]);
      col+=g[0].length+gap;
    }
  };
  drawText('FINISH',.36,2,cy+.55,COL.ledW);
  drawText('ZAYRO RACING',.085,1.2,cy-1.37,COL.ledA);
  // chequered end panels
  for(const sd of [-1,1])for(let cxl=0;cxl<7;cxl++)for(let rw=0;rw<9;rw++){
    const x=sd*(6.95+cxl*.5),y=cy-1.75+rw*.4;
    box((cxl+rw)%2?COL.white:COL.black,false,.1,[x,y,zf-.02],[.25,.2,.03]);
  }

  /* --- finish line + approach markings (road level) */
  for(let i=0;i<34;i++)for(let rw=0;rw<2;rw++)
    box((i+rw)%2?COL.white:COL.black,false,.25,[-16.5+i,.052,Z-.5+rw],[.5,.012,.5]);
  SOLID(COL.white,[0,.05,Z-4],[17,.012,.22]);
  SOLID(COL.white,[0,.05,Z+3],[17,.012,.12]);
  for(let d=0;d<=84;d+=4)for(const sd of [-1,1])GLOW(d<24?COL.ledW:COL.ledA,[sd*17.1,.16,Z-d],[.1,.04,.34]);

  /* --- countdown boards 300/200/100 m */
  for(const [m,n] of [[300,3],[200,2],[100,1]])for(const sd of [-1,1]){
    const x=sd*19.1,z=Z-m;
    SOLID(COL.dark,[x,1.5,z],[.05,1.5,.05]);
    SOLID(COL.white,[x,3.0,z-.04],[.5,.95,.04]);
    for(let k=0;k<n;k++)SOLID(COL.red,[x+(k-(n-1)/2)*.2,3.0,z-.09],[.045,.78,.02],0,-.65);
  }

  /* --- flags + sponsor boards */
  for(let z=Z-84;z<=Z-10;z+=12)for(const sd of [-1,1]){
    const x=sd*20.3;
    SOLID(COL.steel,[x,3.4,z],[.04,3.4,.04]);
    for(let k=0;k<3;k++)box((k+Math.round(z/12))%2?COL.red:COL.white,false,.1,[x,6.25-k*.28,z+.55],[.015,.14,.55]);
  }
  const boardCols=[COL.red,COL.black,COL.white];
  let bi=0;
  for(let z=Z-96;z<=Z+8;z+=5.6){
    if(Math.abs(z-Z)<3.2)continue;
    for(const sd of [-1,1]){
      const c=boardCols[bi%3];
      SOLID(c,[sd*19.05,1.05,z],[.05,.6,2.6]);
      GLOW(c===COL.white?COL.red:COL.white,[sd*19.0,1.05,z],[.02,.06,2.3]);
    }
    bi++;
  }

  /* --- grandstands */
  const zc=Z-14,half=22;
  for(const sd of [-1,1]){
    for(let t=0;t<6;t++){
      const h=(t+1)*.5,x=sd*(25+t*1.5);
      SOLID(COL.concrete,[x,h-.1,zc],[.75,h,half]);
      for(let z=zc-half+.8;z<zc+half-.5;z+=1.05){
        if(R()<.12)continue;
        const c=CROWD[Math.floor(R()*CROWD.length)];
        SOLID(c,[x,2*h-.1+.38,z],[.26,.3,.24]);
        SOLID([.85,.66,.52],[x,2*h-.1+.82,z],[.13,.13,.13]);
      }
    }
    SOLID(COL.roofW,[sd*29.4,8.3,zc],[5.8,.12,half+1]);
    GLOW(COL.ledW,[sd*29.4,8.16,zc],[4.8,.03,half-1]);
    for(const z of [zc-half,zc-half/2,zc,zc+half/2,zc+half])for(const px of [sd*24.6,sd*33.2])SOLID(COL.dark,[px,4.15,z],[.12,4.15,.12]);
    SOLID(COL.red,[sd*23.9,.6,zc],[.05,.6,half]);                      // front fascia
  }
  return B.map;
}

/* ---------------------------------------------------------------- GL upload + draw */
function upload(map){
  const out=[];
  for(const b of map.values()){
    const pb=gl.createBuffer(),nb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.p),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.n),gl.STATIC_DRAW);
    out.push({pb,nb,count:b.p.length/3,color:b.color,emit:b.emit,gloss:b.gloss});
  }
  return out;
}
function release(){if(!built)return;for(const b of built){try{gl.deleteBuffer(b.pb);gl.deleteBuffer(b.nb);}catch(_){}}built=null;}
const IDENT=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function drawGate(vp){
  if(freeRoam)return;
  const Z=raceTargetDistance;
  if(!(Z>0)||typeof player==='undefined')return;
  if(player.z<Z-560||player.z>Z+120)return;
  const key=Z+'|'+selectedRoad;
  if(!built||key!==builtKey){release();built=upload(buildGate(Z,Z*31+7));builtKey=key;builtZ=Z;}
  for(const b of built){
    bind(b.pb,b.nb);
    gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,IDENT);
    gl.uniform3fv(attr.color,b.color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.glass,0);
    gl.uniform1f(attr.emit,b.emit?1:0);gl.uniform1f(attr.gloss,b.gloss);
    gl.drawArrays(gl.TRIANGLES,0,b.count);
  }
  gl.uniform1f(attr.emit,0);gl.uniform1f(attr.gloss,0);
}
const _dw=drawWorld;
drawWorld=function(vp){
  _dw(vp);
  try{drawGate(vp);}catch(e){if(!drawWorld.err){drawWorld.err=1;console.error('ZAYRO FINISH gate',e);}}
};
// a rebuilt world (road change) must not keep stale buffers
const _bw=buildWorld;
buildWorld=function(theme){_bw(theme);builtKey='';};

/* ---------------------------------------------------------------- HUD countdown */
const hud=document.createElement('div');
hud.id='zfCountdown';hud.setAttribute('aria-hidden','true');hud.innerHTML='<i></i><span>FINISH</span><b>300 M</b><i></i>';
document.body.appendChild(hud);
let lastShown=-1;
setInterval(()=>{
  try{
    if(!running||freeRoam||finished||paused){hud.classList.remove('show');lastShown=-1;return;}
    const rem=Math.max(0,Math.round(raceTargetDistance-player.z));
    if(rem<=300&&rem>0){
      hud.classList.add('show');
      hud.classList.toggle('close',rem<=100);
      if(rem!==lastShown){hud.querySelector('b').textContent=rem+' M';lastShown=rem;}
    }else hud.classList.remove('show');
  }catch(_){}
},120);

/* ---------------------------------------------------------------- chequered-flag celebration */
function fanfare(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    const ac=new AC(),t0=ac.currentTime;
    [[523.25,0],[659.25,.16],[783.99,.32],[1046.5,.5]].forEach(([fq,dl])=>{
      const o=ac.createOscillator(),g=ac.createGain();o.type='sawtooth';o.frequency.value=fq;
      g.gain.setValueAtTime(0,t0+dl);g.gain.linearRampToValueAtTime(.07,t0+dl+.03);g.gain.exponentialRampToValueAtTime(.0001,t0+dl+(dl>.4?.9:.28));
      o.connect(g);g.connect(ac.destination);o.start(t0+dl);o.stop(t0+dl+1);
    });
    setTimeout(()=>{try{ac.close();}catch(_){}} ,2200);
  }catch(_){}
}
function celebrate(){
  const old=document.getElementById('zfCelebrate');if(old)old.remove();
  const el=document.createElement('div');el.id='zfCelebrate';el.setAttribute('aria-hidden','true');
  let conf='';
  const cols=['#f5d47d','#ffffff','#e04a4a','#5de4ff','#a8ffb5','#d6a83f'];
  for(let i=0;i<64;i++){
    const l=Math.random()*100,d=Math.random()*.7,du=1.9+Math.random()*1.4,r=Math.round(Math.random()*720-360),w=5+Math.random()*7;
    conf+=`<s style="left:${l.toFixed(1)}%;width:${w.toFixed(1)}px;height:${(w*1.7).toFixed(1)}px;background:${cols[i%cols.length]};animation-delay:${d.toFixed(2)}s;animation-duration:${du.toFixed(2)}s;--r:${r}deg"></s>`;
  }
  el.innerHTML='<div class="zf-flash"></div><div class="zf-band top"></div><div class="zf-band bot"></div><div class="zf-title"><small>CHEQUERED FLAG</small><b>FINISH!</b></div>'+conf;
  document.body.appendChild(el);
  fanfare();
  setTimeout(()=>el.remove(),3600);
}
const _fs=finishStage;
finishStage=function(){
  const was=finished;
  _fs();
  if(!was&&finished){try{celebrate();}catch(e){console.error('ZAYRO FINISH celebrate',e);}}
};
})();
