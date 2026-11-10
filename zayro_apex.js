'use strict';
/* ZAYRO APEX v1.1 (cluster redesign) — loads last (base game code untouched).
   REALISTIC : analogue speedometer + tachometer cluster (gear, shift light, redline), friction-circle G meter,
               wind rush, tyre squeal, turbo whistle and blow-off valve sound (WebAudio, no files).
   POWERFUL  : turbo spool (up to ~+15% mid-range pull, never above the car's normal top speed) and a launch kick.
   ADVANCED  : live telemetry (top/avg speed, peak G, drift time) shown on the finish screen, V = photo mode (hide HUD).
   Every block is wrapped in try/catch so a failure here can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const S={spool:0,latG:0,lonG:0,pLV:0,pSp:0,gasPrev:false,lastTime:0,
  top:0,sum:0,n:0,maxLat:0,maxLon:0,drift:0,turbo:0,dSpeed:0,dRpm:900,trail:[]};
function resetStats(){S.top=S.sum=S.n=S.maxLat=S.maxLon=S.drift=S.turbo=0;S.spool=0;S.trail.length=0;}

/* ================================================================ POWER + G FORCE (after each update) */
function post(dt){
  if(!running||paused||finished)return;
  if(time<S.lastTime-.5)resetStats();
  S.lastTime=time;
  const inpt=fieldInputs(),spec=cars[selectedCar];
  const topRef=(spec.top+garageUpgrades.speed*2.5)*(1+(stage-1)*.025);
  const fwd=player.speed>=0;
  const target=inpt.gas&&fwd?clamp((engineRPM-2400)/3600,0,1):0;
  S.spool+=(target-S.spool)*Math.min(1,dt*(target>S.spool?1.3:3.2));
  if(S.gasPrev&&!inpt.gas&&S.spool>.5)bov();
  S.gasPrev=!!inpt.gas;
  if(inpt.gas&&fwd&&!tractionActive&&player.speed<topRef*.985){
    const launch=player.speed<14?1.8*(1-player.speed/14):0;
    const extra=S.spool*1.2*(1-player.speed/topRef)+launch;
    player.speed+=Math.max(0,extra)*dt;
    S.turbo+=dt*S.spool;
  }
  // G forces (smoothed)
  const d=Math.max(.001,dt);
  const lat=clamp((player.lateralVelocity-S.pLV)/d/9.81,-2.4,2.4),lon=clamp((player.speed-S.pSp)/d/9.81,-2.4,2.4);
  S.pLV=player.lateralVelocity;S.pSp=player.speed;
  const k=Math.min(1,dt*6);S.latG+=(lat-S.latG)*k;S.lonG+=(lon-S.lonG)*k;
  S.maxLat=Math.max(S.maxLat,Math.abs(S.latG));S.maxLon=Math.max(S.maxLon,Math.abs(S.lonG));
  const kmh=Math.abs(player.speed)*3.6;
  S.top=Math.max(S.top,kmh);S.sum+=kmh;S.n++;
  if(Math.abs(player.slip)>.28&&Math.abs(player.speed)>22)S.drift+=dt;
}
const _u=update;
update=function(dt){
  _u(dt);
  try{post(dt);}catch(e){if(!update.err){update.err=1;console.error('ZAYRO APEX update',e);}}
};

/* ================================================================ AUDIO */
let ac=null,wind,screech,whine,master,noiseBuf;
function initAudio(){
  if(ac)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ac=new AC();
  const len=ac.sampleRate*2;noiseBuf=ac.createBuffer(1,len,ac.sampleRate);
  const ch=noiseBuf.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.06*w)/1.06;ch[i]=(w*.5+last*9)*.6;}
  master=ac.createGain();master.gain.value=.55;master.connect(ac.destination);
  const noise=(type,f,q)=>{const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;
    const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;
    const g=ac.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(master);s.start();return {fl,g};};
  wind=noise('bandpass',500,.7);screech=noise('bandpass',2600,9);
  const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.value=1800;og.gain.value=0;
  o.connect(og);og.connect(master);o.start();whine={o,g:og};
}
['pointerdown','keydown','touchstart'].forEach(ev=>addEventListener(ev,()=>{try{initAudio();if(ac&&ac.state==='suspended')ac.resume();}catch(_){}},{passive:true}));
function bov(){
  try{
    if(!ac)return;const s=ac.createBufferSource();s.buffer=noiseBuf;
    const f=ac.createBiquadFilter();f.type='highpass';f.frequency.value=1900;
    const g=ac.createGain(),t=ac.currentTime;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.4);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+.45);
  }catch(_){}
}
setInterval(()=>{
  try{
    if(!ac)return;
    const act=running&&!paused&&!finished,v=act?Math.abs(player.speed):0,t=ac.currentTime;
    wind.g.gain.setTargetAtTime(act?Math.pow(clamp(v/90,0,1),2)*.2:0,t,.1);
    wind.fl.frequency.setTargetAtTime(350+v*22,t,.1);
    const slide=clamp((Math.abs(player.slip)-.2)*2.4,0,1),brk=(act&&fieldInputs().brake&&v>34)?.35:0;
    screech.g.gain.setTargetAtTime(act&&v>14?clamp(slide+brk,0,1)*.1:0,t,.05);
    screech.fl.frequency.setTargetAtTime(2300+Math.min(1200,v*14),t,.08);
    whine.o.frequency.setTargetAtTime(1800+S.spool*4200,t,.08);
    whine.g.gain.setTargetAtTime(act?S.spool*.012:0,t,.08);
  }catch(_){}
},50);

/* ================================================================ INSTRUMENT CLUSTER (v2 — carbon / chrome / backlit) */
const cl=document.createElement('div');cl.id='zaCluster';cl.setAttribute('aria-hidden','true');
const PX=1.5;                                   // render scale: 720x300 logical -> 1080x450 pixels (sharp)
cl.innerHTML='<canvas width="1080" height="450"></canvas>';document.body.appendChild(cl);
const c=cl.firstChild.getContext('2d');
const TAU=Math.PI*2,A0=Math.PI*.75,SW=Math.PI*1.5,ang=(v,m)=>A0+clamp(v/m,0,1)*SW;
const FONT_N="'Barlow Condensed',Impact,sans-serif",FONT_M="'Space Mono',monospace";
const SPD={x:150,y:160,r:122,max:360},TAC={x:395,y:172,r:96,max:8},GM={x:615,y:84,r:50};
const BX=538,BW=164,BN=24;

function rr(g,x,y,w,h,r){g.beginPath();if(g.roundRect)g.roundRect(x,y,w,h,r);else g.rect(x,y,w,h);}

function chromeRing(g,x,y,r,w){
  let grad=null;
  try{
    if(g.createConicGradient){
      grad=g.createConicGradient(-Math.PI/4,x,y);
      [[0,'#f6f9fb'],[.12,'#69737a'],[.25,'#e3eaee'],[.38,'#353d43'],[.5,'#f2f6f8'],[.62,'#58626a'],[.75,'#d8dfe3'],[.88,'#2d343a'],[1,'#f6f9fb']].forEach(s=>grad.addColorStop(s[0],s[1]));
    }
  }catch(_){grad=null;}
  if(!grad){grad=g.createLinearGradient(x-r,y-r,x+r,y+r);grad.addColorStop(0,'#eef2f4');grad.addColorStop(.45,'#4a535a');grad.addColorStop(.7,'#c9d1d6');grad.addColorStop(1,'#20262b');}
  g.beginPath();g.arc(x,y,r,0,TAU);g.arc(x,y,r-w,0,TAU,true);g.fillStyle=grad;g.fill('evenodd');
  g.lineWidth=1;g.strokeStyle='rgba(0,0,0,.65)';g.beginPath();g.arc(x,y,r-.5,0,TAU);g.stroke();
  g.strokeStyle='rgba(255,255,255,.25)';g.beginPath();g.arc(x,y,r-w+.5,0,TAU);g.stroke();
}

function dialStatic(g,d,minor,major,lblStep,redFrom,fontPx,lblR){
  const {x,y,r,max}=d;
  g.save();g.shadowColor='#000';g.shadowBlur=16;g.shadowOffsetY=5;g.beginPath();g.arc(x,y,r,0,TAU);g.fillStyle='#000';g.fill();g.restore();
  chromeRing(g,x,y,r,10);
  g.beginPath();g.arc(x,y,r-10,0,TAU);g.fillStyle='#040506';g.fill();
  // face
  const f=g.createRadialGradient(x-r*.25,y-r*.4,4,x,y,r-12);
  f.addColorStop(0,'#27313a');f.addColorStop(.55,'#0d1215');f.addColorStop(1,'#030405');
  g.beginPath();g.arc(x,y,r-12,0,TAU);g.fillStyle=f;g.fill();
  // fine machined rings
  g.lineWidth=.6;
  for(let q=14;q<r-14;q+=3){g.strokeStyle=(q/3|0)%2?'rgba(255,255,255,.022)':'rgba(0,0,0,.25)';g.beginPath();g.arc(x,y,q,0,TAU);g.stroke();}
  // redline band
  const ra=ang(redFrom,max),rb=ang(max,max);
  g.lineCap='butt';
  g.lineWidth=7;g.strokeStyle='rgba(120,10,16,.55)';g.beginPath();g.arc(x,y,r-25,ra,rb);g.stroke();
  g.lineWidth=3;g.strokeStyle='#ff2d37';g.beginPath();g.arc(x,y,r-27.5,ra,rb);g.stroke();
  // ticks
  for(let v=0;v<=max+.001;v+=minor){
    const a=ang(v,max),mj=Math.abs(v/major-Math.round(v/major))<1e-6,l=mj?14:7,red=v>=redFrom-1e-6;
    g.beginPath();g.moveTo(x+Math.cos(a)*(r-15),y+Math.sin(a)*(r-15));g.lineTo(x+Math.cos(a)*(r-15-l),y+Math.sin(a)*(r-15-l));
    g.lineWidth=mj?2.6:1.1;g.strokeStyle=red?'#ff5a62':(mj?'#f3f6f7':'#aab4b9');g.stroke();
  }
  // numerals
  g.textAlign='center';g.textBaseline='middle';g.font=`900 italic ${fontPx}px ${FONT_N}`;
  for(let v=0;v<=max+.001;v+=lblStep){
    const a=ang(v,max);
    g.fillStyle=v>=redFrom-1e-6?'#ff6a70':'#f1f5f6';
    g.fillText(String(Math.round(v)),x+Math.cos(a)*(r-lblR),y+Math.sin(a)*(r-lblR));
  }
}

function needle(x,y,r,a,tail){
  c.save();c.translate(x,y);c.rotate(a);
  c.shadowColor='rgba(0,0,0,.75)';c.shadowBlur=7;c.shadowOffsetX=2;c.shadowOffsetY=3;
  const ng=c.createLinearGradient(0,-3.4,0,3.4);ng.addColorStop(0,'#ff8f58');ng.addColorStop(.5,'#ff4a1c');ng.addColorStop(1,'#a8180a');
  c.beginPath();c.moveTo(-tail,-3.4);c.lineTo(0,-3.6);c.lineTo(r,-.9);c.lineTo(r+7,0);c.lineTo(r,.9);c.lineTo(0,3.6);c.lineTo(-tail,3.4);c.closePath();
  c.fillStyle=ng;c.fill();
  c.shadowColor='transparent';c.beginPath();c.moveTo(-tail+4,-1);c.lineTo(r,-.35);c.lineWidth=1;c.strokeStyle='rgba(255,255,255,.45)';c.stroke();
  c.restore();
  const hg=c.createRadialGradient(x-3,y-3,1,x,y,12);hg.addColorStop(0,'#f4f7f9');hg.addColorStop(.5,'#7d878e');hg.addColorStop(1,'#1a2024');
  c.beginPath();c.arc(x,y,11,0,TAU);c.fillStyle=hg;c.fill();c.lineWidth=1;c.strokeStyle='#000';c.stroke();
  c.beginPath();c.arc(x,y,4.2,0,TAU);c.fillStyle='#0b0e10';c.fill();
}
function glowArc(d,val,col,w){
  const a=ang(val,d.max);if(a<=A0+.01)return;
  c.save();c.lineCap='round';c.shadowColor=col;c.shadowBlur=12;c.lineWidth=w;c.strokeStyle=col;
  c.beginPath();c.arc(d.x,d.y,d.r-19.5,A0,a);c.stroke();c.restore();
}
function glare(d){
  const {x,y,r}=d,g=c.createLinearGradient(x-r*.8,y-r,x+r*.2,y);
  g.addColorStop(0,'rgba(255,255,255,.16)');g.addColorStop(.7,'rgba(255,255,255,.02)');g.addColorStop(1,'rgba(255,255,255,0)');
  c.beginPath();c.arc(x,y,r-12,Math.PI*1.02,Math.PI*1.72);c.quadraticCurveTo(x-r*.12,y-r*.18,x+Math.cos(Math.PI*1.02)*(r-12),y+Math.sin(Math.PI*1.02)*(r-12));c.closePath();
  c.fillStyle=g;c.fill();
}

/* ---------- static layer (plate, dials, tracks) drawn once into an offscreen canvas */
let st=null;
function buildStatic(){
  st=document.createElement('canvas');st.width=720*PX;st.height=300*PX;
  const g=st.getContext('2d');g.scale(PX,PX);
  // carbon-fibre plate
  const wv=document.createElement('canvas');wv.width=wv.height=8;const w=wv.getContext('2d');
  w.fillStyle='#0b0e10';w.fillRect(0,0,8,8);w.fillStyle='#161b1f';w.fillRect(0,0,4,4);w.fillRect(4,4,4,4);
  w.fillStyle='rgba(255,255,255,.05)';w.fillRect(0,0,4,1);w.fillRect(4,4,4,1);w.fillStyle='rgba(0,0,0,.35)';w.fillRect(4,0,4,4);w.fillRect(0,4,4,4);
  rr(g,2,2,716,296,24);g.fillStyle=g.createPattern(wv,'repeat');g.fill();
  const sh=g.createLinearGradient(0,0,0,300);sh.addColorStop(0,'rgba(255,255,255,.10)');sh.addColorStop(.35,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,.45)');
  rr(g,2,2,716,296,24);g.fillStyle=sh;g.fill();
  const fr=g.createLinearGradient(0,0,720,300);fr.addColorStop(0,'#dfe5e9');fr.addColorStop(.3,'#5a646b');fr.addColorStop(.6,'#aeb8be');fr.addColorStop(1,'#232a2f');
  rr(g,2,2,716,296,24);g.lineWidth=3;g.strokeStyle=fr;g.stroke();
  rr(g,6,6,708,288,20);g.lineWidth=1;g.strokeStyle='rgba(0,0,0,.8)';g.stroke();
  // screws
  for(const [sx,sy] of [[17,17],[703,17],[17,283],[703,283]]){
    const sg=g.createRadialGradient(sx-1.5,sy-1.5,.5,sx,sy,6);sg.addColorStop(0,'#eef2f4');sg.addColorStop(.6,'#7b858c');sg.addColorStop(1,'#2a3136');
    g.beginPath();g.arc(sx,sy,5,0,TAU);g.fillStyle=sg;g.fill();g.lineWidth=.8;g.strokeStyle='#000';g.stroke();
    g.beginPath();g.moveTo(sx-3,sy+1);g.lineTo(sx+3,sy-1);g.lineWidth=1.2;g.strokeStyle='#14181b';g.stroke();
  }
  // dials
  dialStatic(g,SPD,20,40,40,300,17,45);
  dialStatic(g,TAC,.5,1,1,6.6,16,38);
  // LCD windows
  const lcd=(x,y,w,h)=>{rr(g,x,y,w,h,5);const lg=g.createLinearGradient(0,y,0,y+h);lg.addColorStop(0,'#05090b');lg.addColorStop(1,'#0c1418');g.fillStyle=lg;g.fill();g.lineWidth=1.4;g.strokeStyle='#3b454b';g.stroke();rr(g,x+1.5,y+1.5,w-3,h-3,4);g.lineWidth=1;g.strokeStyle='rgba(0,0,0,.9)';g.stroke();};
  lcd(SPD.x-39,SPD.y+30,78,56);
  lcd(TAC.x-21,TAC.y+34,42,44);
  // brand plate
  g.textAlign='center';g.textBaseline='middle';
  const bg=g.createLinearGradient(0,40,0,58);bg.addColorStop(0,'#fff1c2');bg.addColorStop(.5,'#e6c36a');bg.addColorStop(1,'#a8761f');
  g.font=`900 italic 16px ${FONT_N}`;g.fillStyle=bg;
  'ZAYRO'.split('').forEach((ch,i)=>g.fillText(ch,395+(i-2)*13,50));
  g.fillStyle='#8f9a96';g.font=`700 7px ${FONT_M}`;g.fillText('RACING',395,62);
  // shift-light housing
  rr(g,284,11,222,22,11);g.fillStyle='#05080a';g.fill();g.lineWidth=1.2;g.strokeStyle='#3b454b';g.stroke();
  for(let i=0;i<12;i++){const lx=300+i*(190/11);g.beginPath();g.arc(lx,22,4.6,0,TAU);g.fillStyle='#10171a';g.fill();g.lineWidth=.8;g.strokeStyle='#000';g.stroke();}
  // G-meter
  chromeRing(g,GM.x,GM.y,GM.r+6,6);
  const gf=g.createRadialGradient(GM.x,GM.y-10,3,GM.x,GM.y,GM.r);gf.addColorStop(0,'#18222a');gf.addColorStop(1,'#04070a');
  g.beginPath();g.arc(GM.x,GM.y,GM.r,0,TAU);g.fillStyle=gf;g.fill();
  g.strokeStyle='rgba(255,255,255,.2)';g.lineWidth=1;
  for(const k of [.33,.66,1]){g.beginPath();g.arc(GM.x,GM.y,GM.r*k*.92,0,TAU);g.stroke();}
  g.beginPath();g.moveTo(GM.x-GM.r,GM.y);g.lineTo(GM.x+GM.r,GM.y);g.moveTo(GM.x,GM.y-GM.r);g.lineTo(GM.x,GM.y+GM.r);g.stroke();
  g.fillStyle='#8f9a96';g.font=`700 7px ${FONT_M}`;g.fillText('1G',GM.x+GM.r*.62,GM.y-5);g.fillText('2G',GM.x+GM.r*.9,GM.y-5);
  // bar tracks + labels
  const rows=[['TURBO',168],['NITRO',196],['ENGINE',224],['TYRES',252]];
  g.textAlign='left';g.textBaseline='alphabetic';g.font=`700 8.5px ${FONT_M}`;
  for(const [lb,by] of rows){
    g.fillStyle='#b4bfbb';g.fillText(lb,BX,by);
    for(let i=0;i<BN;i++){rr(g,BX+i*(BW/BN),by+4,BW/BN-1.2,8,1.5);g.fillStyle='#0b1013';g.fill();g.lineWidth=.6;g.strokeStyle='#1d262b';g.stroke();}
  }
  // lamp labels
  g.font=`700 7px ${FONT_M}`;g.fillStyle='#7c8984';
  [['NOS',300],['BOOST',352],['TEMP',404],['TYRE',456]].forEach(l=>g.fillText(l[0],l[1]+8,288));
}

/* ---------- dynamic layer */
function ledBar(row,pct,colFn,valTxt,warn){
  const by=[168,196,224,252][row],n=Math.round(clamp(pct,0,1)*BN);
  c.save();c.shadowBlur=5;
  for(let i=0;i<n;i++){
    const col=colFn(i/(BN-1));c.shadowColor=col;c.fillStyle=col;
    rr(c,BX+i*(BW/BN),by+4,BW/BN-1.2,8,1.5);c.fill();
  }
  c.restore();
  c.textAlign='right';c.textBaseline='alphabetic';c.font=`700 8.5px ${FONT_M}`;c.fillStyle=warn?'#ff5a62':'#f1f5f6';c.fillText(valTxt,BX+BW,by);
}
function lamp(x,on,col){
  c.save();
  if(on){c.shadowColor=col;c.shadowBlur=10;c.fillStyle=col;}else c.fillStyle='#161d21';
  c.beginPath();c.arc(x,285,3.6,0,TAU);c.fill();c.restore();
  c.lineWidth=.8;c.strokeStyle='#000';c.beginPath();c.arc(x,285,3.6,0,TAU);c.stroke();
}
let lastDraw=0;
function draw(now){
  requestAnimationFrame(draw);
  if(now-lastDraw<33)return;lastDraw=now;
  const b=document.body;if(!b.classList.contains('zm-drive')||b.classList.contains('zm-touchui'))return;
  try{
    if(!st)buildStatic();
    const kmh=Math.abs(player.speed)*3.6;
    S.dSpeed+=(kmh-S.dSpeed)*.35;S.dRpm+=(engineRPM-S.dRpm)*.4;
    c.setTransform(PX,0,0,PX,0,0);c.clearRect(0,0,720,300);
    c.drawImage(st,0,0,720,300);

    // glowing progress arcs (backlight)
    const sf=S.dSpeed/SPD.max;
    glowArc(SPD,S.dSpeed,sf>.83?'#ff4a52':sf>.55?'#ffb62e':'#4fd8ff',3);
    glowArc(TAC,S.dRpm/1000,S.dRpm>6600?'#ff4a52':S.dRpm>5200?'#ffb62e':'#4fd8ff',3);
    // needles + glass
    needle(SPD.x,SPD.y,SPD.r-24,ang(S.dSpeed,SPD.max),24);
    needle(TAC.x,TAC.y,TAC.r-22,ang(S.dRpm/1000,TAC.max),18);
    glare(SPD);glare(TAC);

    // speed LCD
    const str=String(Math.round(S.dSpeed)).padStart(3,'0'),lead=str.match(/^0*/)[0].length,over=Math.min(2,lead);
    c.textAlign='center';c.textBaseline='middle';c.font=`900 italic 38px ${FONT_N}`;
    for(let i=0;i<3;i++){
      const dim=i<over&&str!=='000'||(str==='000'&&i<2);
      c.save();if(!dim){c.shadowColor='#ffffff';c.shadowBlur=8;}
      c.fillStyle=dim?'rgba(255,255,255,.14)':'#ffffff';c.fillText(str[i],SPD.x+(i-1)*24,SPD.y+54);c.restore();
    }
    c.font=`700 8px ${FONT_M}`;c.fillStyle='#d8ff38';c.fillText('KM/H',SPD.x,SPD.y+77);
    // gear LCD
    const flash=S.dRpm>6500&&Math.floor(now/110)%2===0,reverse=player.speed<-1;
    c.save();c.shadowColor=flash?'#ff4a52':'#f5d47d';c.shadowBlur=10;
    c.fillStyle=flash?'#ff7a80':'#f5d47d';c.font=`900 italic 38px ${FONT_N}`;c.fillText(reverse?'R':String(currentGear),TAC.x,TAC.y+52);c.restore();
    c.font=`700 6.5px ${FONT_M}`;c.fillStyle='#8f9a96';c.fillText('x1000 RPM',TAC.x,TAC.y+91);

    // shift lights
    const lit=Math.floor(clamp((S.dRpm-4000)/2600,0,1)*12),blink=S.dRpm>6500&&Math.floor(now/90)%2===0;
    for(let i=0;i<12;i++){
      const on=blink||i<lit;if(!on)continue;
      const col=blink?'#8fe3ff':i<5?'#39ff6a':i<9?'#ffc02e':'#ff3b3b',lx=300+i*(190/11);
      c.save();c.shadowColor=col;c.shadowBlur=11;c.fillStyle=col;c.beginPath();c.arc(lx,22,4.2,0,TAU);c.fill();c.restore();
    }

    // G meter
    const px=GM.x-clamp(S.latG/2,-1,1)*GM.r*.9,py=GM.y+clamp(S.lonG/2,-1,1)*GM.r*.9;
    S.trail.push([px,py]);if(S.trail.length>20)S.trail.shift();
    S.trail.forEach((p,i)=>{c.fillStyle=`rgba(216,255,56,${i/S.trail.length*.4})`;c.beginPath();c.arc(p[0],p[1],2.6,0,TAU);c.fill();});
    c.save();c.shadowColor='#d8ff38';c.shadowBlur=12;c.fillStyle='#d8ff38';c.beginPath();c.arc(px,py,5.5,0,TAU);c.fill();c.restore();
    c.fillStyle='rgba(255,255,255,.65)';c.beginPath();c.arc(px-1.5,py-1.5,1.6,0,TAU);c.fill();
    c.textAlign='center';c.textBaseline='alphabetic';c.font=`900 italic 15px ${FONT_N}`;c.fillStyle='#f1f5f6';
    c.fillText(Math.hypot(S.latG,S.lonG).toFixed(1)+' G',GM.x,GM.y+GM.r+19);

    // LED bars
    ledBar(0,S.spool,t=>`hsl(${200-t*175},100%,62%)`,Math.round(S.spool*100)+'%',false);
    ledBar(1,nitro/100,t=>`hsl(${190-t*70},100%,60%)`,Math.round(nitro)+'%',false);
    const ep=(engineTemp-72)/53;
    ledBar(2,ep,t=>`hsl(${52-t*52},100%,56%)`,Math.round(engineTemp)+'°C',engineTemp>105);
    const tp=1-tyreWear/100;
    ledBar(3,tp,t=>tp<.3?'#ff4a52':`hsl(${70+t*60},90%,58%)`,Math.round(tp*100)+'%',tyreWear>70);

    // warning lamps
    const pulse=Math.floor(now/260)%2===0;
    lamp(300,nitro>20,'#4fd8ff');
    lamp(352,S.spool>.3,'#ff8a3d');
    lamp(404,engineTemp>105&&pulse,'#ff3b3b');
    lamp(456,tyreWear>70&&pulse,'#ffb62e');
  }catch(e){if(!draw.err){draw.err=1;console.error('ZAYRO APEX cluster',e);}}
}
requestAnimationFrame(draw);
try{if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{st=null;});}catch(_){}

/* ================================================================ PHOTO MODE (V) */
addEventListener('keydown',e=>{
  if(e.repeat||(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))return;
  if(e.key==='v'||e.key==='V'){
    const off=document.body.classList.toggle('za-hud-off');
    try{if(off)pop('HUD OFF · PRESS V');}catch(_){}
  }
});

/* ================================================================ TELEMETRY on the finish screen */
function showTele(){
  const box=document.querySelector('#finish .pause-box');if(!box)return;
  const old=document.getElementById('zaTele');if(old)old.remove();
  const avg=S.n?S.sum/S.n:0,el=document.createElement('div');el.id='zaTele';
  const cell=(k,v,u)=>`<div><small>${k}</small><b>${v}<i>${u||''}</i></b></div>`;
  el.innerHTML='<div class="za-tt">TELEMETRY</div><div class="za-tg">'+
    cell('TOP SPEED',Math.round(S.top),' KM/H')+cell('AVG SPEED',Math.round(avg),' KM/H')+
    cell('PEAK CORNER G',S.maxLat.toFixed(2),' G')+cell('PEAK BRAKE G',S.maxLon.toFixed(2),' G')+
    cell('DRIFT TIME',S.drift.toFixed(1),' S')+cell('TURBO PULL',S.turbo.toFixed(1),' S')+'</div>';
  const cert=document.getElementById('zayroCertificatePanel');
  if(cert&&cert.parentNode===box)box.insertBefore(el,cert);else box.appendChild(el);
}
const _fs=finishStage;
finishStage=function(){
  const was=finished;_fs();
  if(!was&&finished){try{showTele();}catch(e){console.error('ZAYRO APEX telemetry',e);}}
};
})();
