'use strict';
/* ZAYRO REALISM PACK v6.0 — loads after game.js and zayro_plus.js.
   Adds: GTA-style wanted level + police fleet (chase, ram, busted), circular GTA radar, cash HUD,
   mission subtitles, WASTED / BUSTED / MISSION PASSED screens, handbrake drifting, horn, siren,
   in-game radio stations, realistic car detail (plates, calipers, brake glow, exhaust flames, lamp bloom),
   damage smoke, rain-on-screen droplets and lightning, cinematic vignette. */
(function(){
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rnd=(a,b)=>a+Math.random()*(b-a);
const zr={heat:0,stars:0,peak:0,units:[],bustT:0,lastPZ:0,lastCrash:0,ram:0,immune:0,brake:false,hand:false,
  horn:false,radio:0,brakeHeat:0,wasOut:false,wasFin:false,bigT:0,bigTimer:0,subT:0,drops:[],flash:0,nextFlash:rnd(6,14),
  backfire:0,cashShown:-1,evade:false,prevRunning:false,prevTime:0,hudClock:0,smokeClock:0};
window.zrState=zr;

/* ============ helpers into the base game ============ */
function giveCredits(n){n=Math.round(n);if(n<=0)return;credits+=n;careerStats.creditsEarned+=n;localStorage.setItem('apexCredits',String(credits));saveCareerStats();refreshGarage();}
function takeCredits(n){n=Math.round(Math.min(credits,Math.max(0,n)));credits-=n;localStorage.setItem('apexCredits',String(credits));refreshGarage();return n;}

/* ============ UI ============ */
function buildUI(){
  const body=document.body;
  const add=(tag,id,cls,html)=>{if($(id))return $(id);const e=document.createElement(tag);e.id=id;if(cls)e.className=cls;if(html)e.innerHTML=html;body.appendChild(e);return e;};
  const g=$('game'),zp=$('zpFx');
  if(!$('zrFx')){const c=document.createElement('canvas');c.id='zrFx';c.setAttribute('aria-hidden','true');(zp||g).insertAdjacentElement('afterend',c);}
  add('div','zrVignette','','');
  add('div','zrStatus','','<div id="zrCash">CR 0</div><div id="zrStars" aria-label="Wanted level"></div><div id="zrBust"><i></i></div>');
  add('div','zrRadarWrap','','<canvas id="zrRadar" width="160" height="160"></canvas><div id="zrRadarRing"></div>');
  add('div','zrSubtitle','','');
  add('div','zrBig','','');
  const stars=$('zrStars');if(stars&&!stars.children.length)stars.innerHTML=Array.from({length:5},()=>'<b>★</b>').join('');
}
buildUI();
const radar=$('zrRadar'),rctx=radar&&radar.getContext('2d');
const fxc=$('zrFx'),fctx=fxc&&fxc.getContext('2d');

function showBig(text,kind,ms=2600){
  const el=$('zrBig');if(!el)return;el.className='show '+kind;el.textContent=text;
  clearTimeout(zr.bigTimer);zr.bigTimer=setTimeout(()=>{el.className='';},ms);
}
let subTimer=0;
function subtitle(text,kind='',ms=0){
  const el=$('zrSubtitle');if(!el)return;
  if(!text){el.className='';return;}
  el.textContent=text;el.className='show '+kind;
  clearTimeout(subTimer);if(ms)subTimer=setTimeout(()=>{if(el.textContent===text)el.className='';},ms);
}

/* ============ Wanted level & police fleet ============ */
const cityMode=()=>running&&freeRoam;
const policeMode=()=>cityMode()&&missionMode==='police';
function starsNow(){
  if(!cityMode())return 0;
  if(policeMode())return clamp(Math.ceil(policeHeat/20),1,5);
  return clamp(Math.ceil(zr.heat/20),0,5);
}
function spawnUnit(){
  const lanes=[-14,-8.4,-2.8,2.8,8.4,14];
  const dir=Math.sin(player.yaw)*0+1;
  zr.units.push({x:lanes[Math.floor(Math.random()*6)],z:player.z-rnd(95,150)*dir,yaw:0,speed:Math.max(10,Math.abs(player.speed)),off:rnd(-5,5),cd:0,ph:Math.random()*10,braking:false,leaving:false,vx:0});
}
function resetCity(){zr.heat=0;zr.stars=0;zr.peak=0;zr.units.length=0;zr.bustT=0;zr.ram=0;zr.immune=0;zr.lastCrash=crashCount;zr.lastPZ=player.z;zr.evade=false;}
function doBusted(){
  const fine=takeCredits(120+credits*.06);
  zr.heat=0;zr.peak=0;zr.units.length=0;zr.bustT=0;zr.immune=4;
  if(policeMode()){policeHeat=0;policeUnit.x=player.x-Math.sin(player.yaw)*60;policeUnit.z=player.z-Math.cos(player.yaw)*60;}
  player.speed=0;
  showBig('BUSTED','busted',3000);document.body.classList.add('zr-busted');setTimeout(()=>document.body.classList.remove('zr-busted'),2600);
  pop(`🚔 BUSTED · FINE −${fine} CR`);
}
function updatePolice(dt){
  const stars=starsNow();
  // The base game teleports the player when the city block loops; carry the fleet with it.
  const dz=player.z-zr.lastPZ;if(Math.abs(dz)>500)for(const u of zr.units)u.z+=dz;zr.lastPZ=player.z;
  // Crimes: hitting traffic raises the wanted level.
  if(crashCount>zr.lastCrash){if(!policeMode()&&zr.immune<=0)zr.heat=Math.min(100,zr.heat+36);zr.lastCrash=crashCount;}
  else if(crashCount<zr.lastCrash)zr.lastCrash=crashCount;
  zr.immune=Math.max(0,zr.immune-dt);
  const want=policeMode()?Math.max(0,stars-1):(stars>0?Math.min(5,stars+1):0);
  zr.stars=stars;zr.peak=Math.max(zr.peak,stars);
  let nearest=Infinity;
  while(zr.units.filter(u=>!u.leaving).length<want)spawnUnit();
  let active=zr.units.filter(u=>!u.leaving);
  if(active.length>want)for(const u of active.slice(want))u.leaving=true;
  for(let i=zr.units.length-1;i>=0;i--){
    const u=zr.units[i],px=player.x,pz=player.z,ddz=pz-u.z,ddx=px-u.x,dist=Math.hypot(ddx,ddz);
    let target=Math.abs(player.speed)+clamp(ddz*.42,-20,28)+stars*.9;
    if(u.leaving)target=Math.max(0,Math.abs(player.speed)*.6-12);
    target=clamp(target,0,57+stars*3.2);
    const prevSpeed=u.speed;u.speed+=(target-u.speed)*Math.min(1,dt*1.1);u.braking=u.speed<prevSpeed-.05;
    u.z+=u.speed*dt;
    let tx=Math.abs(ddz)<26&&!u.leaving?px:px+u.off;
    tx=clamp(tx,-110,110);
    const ox=u.x;u.x+=(tx-u.x)*Math.min(1,dt*(.8+stars*.14));
    const vx=(u.x-ox)/Math.max(dt,.001);u.vx+=(vx-u.vx)*Math.min(1,dt*6);
    u.yaw=clamp(Math.atan2(u.vx,Math.max(10,u.speed)),-.5,.5);
    u.cd=Math.max(0,u.cd-dt);
    if(!u.leaving)nearest=Math.min(nearest,dist);
    // Ramming
    if(!u.leaving&&u.cd<=0&&Math.abs(ddx)<2.5&&Math.abs(ddz)<4.9&&zr.immune<=0){
      u.cd=1.7;const side=ddx>=0?1:-1;
      player.speed*=.8;player.lateralVelocity+=side*3.4;player.slip+=side*.14;u.speed*=.8;u.vx-=side*4;
      impactShake=Math.max(impactShake,.3);spawnCrash(player.x,player.z+(ddz>0?-1.6:1.6),.6);
      if(!policeMode())zr.heat=Math.min(100,zr.heat+8);
      zr.ram++;pop('🚨 RAMMED BY POLICE');
      if(zr.ram%3===0&&recordCrash(player.x,player.z,.8))return;
    }
    // Lose units that have fallen far behind a fleeing player; respawn close behind so the chase stays alive.
    if(!u.leaving&&dist>260){u.z=player.z-rnd(110,160);u.x=clamp(player.x+rnd(-8,8),-14,14);u.speed=Math.abs(player.speed)*.9;}
    if(u.leaving&&dist>230)zr.units.splice(i,1);
  }
  if(policeMode()&&policeUnit.active)nearest=Math.min(nearest,Math.hypot(policeUnit.x-player.x,policeUnit.z-player.z));
  zr.nearest=nearest;
  // Cool-down: outrun the fleet and the heat falls quickly.
  if(!policeMode()&&zr.heat>0){
    const far=nearest>125;zr.evade=far;
    zr.heat=Math.max(0,zr.heat-dt*(far?10:.5));
    if(zr.heat<=0&&zr.peak>0){const bonus=120*zr.peak;giveCredits(bonus);pop(`WANTED LEVEL CLEARED · +${bonus} CR`);subtitle('Wanted level cleared. Cops lost you.','good',3500);zr.peak=0;}
  }else zr.evade=policeMode()&&nearest>85;
  // Busted: stopped next to the cops.
  const close=zr.units.some(u=>!u.leaving&&Math.hypot(u.x-player.x,u.z-player.z)<9)||(policeMode()&&policeUnit.active&&Math.hypot(policeUnit.x-player.x,policeUnit.z-player.z)<9);
  if(stars>0&&Math.abs(player.speed)<5&&close&&zr.immune<=0)zr.bustT+=dt;else zr.bustT=Math.max(0,zr.bustT-dt*1.5);
  if(zr.bustT>=2.8)doBusted();
}
function drawCop(vp,u){
  const car={x:u.x,z:u.z,yaw:u.yaw,braking:u.braking};
  drawCar(vp,car,[.035,.05,.11],1,false);
  for(const side of [-1,1]){drawPart(vp,car,[side*.64,.72,-.02],[.012,.2,.78],[.93,.94,.96]);drawPart(vp,car,[side*.64,.7,.62],[.012,.14,.28],[.93,.94,.96]);}
  const f=Math.floor(performance.now()/110+u.ph)%2===0,roof=localPoint(car,0,1.1,-.12);
  drawCube(vp,[roof[0],roof[1]-.02,roof[2]],[.6,.04,.17],car.yaw,[.03,.03,.04]);
  const l=localPoint(car,-.3,1.14,-.12),r=localPoint(car,.3,1.14,-.12);
  drawCube(vp,l,[.26,.08,.14],car.yaw,f?[.1,.38,1]:[.03,.05,.14]);
  drawCube(vp,r,[.26,.08,.14],car.yaw,f?[.14,.03,.03]:[1,.05,.06]);
}
function drawFleet(vp){
  if(!cityMode())return;
  for(const u of zr.units)if(Math.abs(u.z-player.z)<230)drawCop(vp,u);
}

/* ============ Car realism wrappers ============ */
const SH=[[1.00,2.02],[1.15,2.18],[.96,2.24],[1.13,2.28],[1.20,2.34]];
const _drawCar=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  _drawCar(vp,car,color,style,boost);
  const sh=SH[(style%5+5)%5],w=sh[0],L=sh[1],isP=car===player,brk=isP?zr.brake:!!car.braking;
  // Number plates
  drawPart(vp,car,[0,.40,L*.592],[.27,.075,.012],[.93,.93,.86]);drawPart(vp,car,[0,.40,L*.598],[.2,.026,.006],[.12,.14,.2]);
  drawPart(vp,car,[0,.52,-L*.598],[.27,.075,.012],[.96,.82,.15]);drawPart(vp,car,[0,.52,-L*.604],[.2,.026,.006],[.1,.1,.1]);
  for(const side of [-1,1]){
    // Door shut-lines and chrome beltline
    drawPart(vp,car,[side*w*.607,.74,.24],[.004,.2,.012],[.02,.022,.026]);
    drawPart(vp,car,[side*w*.607,.74,-.42],[.004,.2,.012],[.02,.022,.026]);
    drawPart(vp,car,[side*w*.603,.835,-.09],[.004,.012,L*.30],[.72,.77,.8]);
    // Door handle shadows / side marker
    drawPart(vp,car,[side*w*.608,.79,.1],[.004,.02,.07],[.85,.88,.9]);
  }
  drawPart(vp,car,[w*.22,1.36,-L*.3],[.007,.2,.007],[.05,.05,.06]);
  const dark=condition==='night'||condition==='rain'||selectedRoad===4;
  if(brk||dark){gl.uniform1f(attr.emit,1);const k=brk?1:.42;const red=[1*k,.1*k,.07*k];for(const side of [-1,1])drawPart(vp,car,[side*w*.39,.78,-L*.586],[.28,.17,.012],red);drawPart(vp,car,[0,.715,-L*.586],[w*.62,.05,.012],[1*k,.16*k,.1*k]);if(brk)drawPart(vp,car,[0,1.13,-L*.46],[.2,.03,.02],[1,.1,.07]);gl.uniform1f(attr.emit,0);}
  if(dark||(isP&&condition!=='clear')){gl.uniform1f(attr.emit,1);for(const side of [-1,1]){drawSphere(vp,car,[side*w*.39,.78,L*.55],[.21,.16,.05],[1,.96,.8]);}gl.uniform1f(attr.emit,0);}
  if(isP&&boost){const fl=Math.random();for(const side of [-1,1]){drawPart(vp,car,[side*.28,.405,-L*.72-fl*.3],[.06,.06,.34+fl*.32],[1,.55,.12]);drawPart(vp,car,[side*.28,.405,-L*.82-fl*.35],[.035,.035,.3+fl*.2],[1,.9,.5]);}}
  if(isP&&zr.backfire>0){const fl=Math.random();for(const side of [-1,1])drawPart(vp,car,[side*.28,.405,-L*.74-fl*.2],[.07,.07,.3],[1,.45,.08]);}
};
const _drawWheel=drawWheel;
drawWheel=function(vp,car,x,z){
  _drawWheel(vp,car,x,z);
  const sg=Math.sign(x)||1,isP=car===player;
  drawPart(vp,car,[x+sg*.262,.5,z],[.012,.06,.06],[.86,.07,.04]);          // red brake caliper
  drawPart(vp,car,[x+sg*.262,.39,z],[.01,.135,.135],[.1,.105,.11],0);        // brake disc face
  if(isP&&zr.brakeHeat>.3)drawPart(vp,car,[x+sg*.266,.39,z],[.008,.12,.12],[1,.4+.2*zr.brakeHeat,.08]);
};
const _dcp=drawCrashParticles;
drawCrashParticles=function(vp,dt){_dcp(vp,dt);try{drawFleet(vp);}catch(e){if(!drawCrashParticles.err){drawCrashParticles.err=1;console.error('ZAYRO REALISM fleet',e);}}};

/* ============ Audio: horn, siren, radio ============ */
let hornNodes=null,sirenNodes=null,noiseBuf=null;
function ensureAudioNodes(){
  if(!audio)return false;
  if(!hornNodes){
    const g=audio.createGain();g.gain.value=.0001;g.connect(audio.destination);
    const a=audio.createOscillator(),b=audio.createOscillator();a.type='sawtooth';b.type='sawtooth';a.frequency.value=392;b.frequency.value=494;
    const f=audio.createBiquadFilter();f.type='lowpass';f.frequency.value=1500;a.connect(f);b.connect(f);f.connect(g);a.start();b.start();hornNodes={g};
  }
  if(!sirenNodes){
    const g=audio.createGain();g.gain.value=.0001;g.connect(audio.destination);
    const o=audio.createOscillator();o.type='triangle';o.frequency.value=700;const f=audio.createBiquadFilter();f.type='bandpass';f.frequency.value=1100;f.Q.value=.7;
    o.connect(f);f.connect(g);o.start();sirenNodes={g,o};
  }
  if(!noiseBuf){noiseBuf=audio.createBuffer(1,audio.sampleRate*.4,audio.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  return true;
}
function thunder(){
  if(!ensureAudioNodes()||!musicOn)return;
  const now=audio.currentTime,src=audio.createBufferSource();src.buffer=noiseBuf;src.loop=true;
  const f=audio.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(420,now);f.frequency.exponentialRampToValueAtTime(70,now+2.2);
  const g=audio.createGain();g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.16,now+.06);g.gain.exponentialRampToValueAtTime(.0001,now+2.3);
  src.connect(f);f.connect(g);g.connect(audio.destination);src.start(now);src.stop(now+2.4);
}
const STATIONS=[{n:'ZAYRO FM',k:'orig'},{n:'SYNTHWAVE 84',k:'synth'},{n:'STREET BEATS',k:'beats'},{n:'RADIO OFF',k:'off'}];
const _playMusic=playMusic;
function tone(f,type,dur,vol,lp){
  const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.015);g.gain.exponentialRampToValueAtTime(.0001,now+dur);
  let out=g;if(lp){const fl=audio.createBiquadFilter();fl.type='lowpass';fl.frequency.value=lp;o.connect(fl);fl.connect(g);}else o.connect(g);
  g.connect(musicGain);o.start(now);o.stop(now+dur+.02);
}
function kick(){const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(150,now);o.frequency.exponentialRampToValueAtTime(42,now+.14);g.gain.setValueAtTime(.7,now);g.gain.exponentialRampToValueAtTime(.0001,now+.2);o.connect(g);g.connect(musicGain);o.start(now);o.stop(now+.22);}
function hat(vol,open){if(!noiseBuf)return;const now=audio.currentTime,s=audio.createBufferSource();s.buffer=noiseBuf;const f=audio.createBiquadFilter();f.type='highpass';f.frequency.value=7000;const g=audio.createGain();g.gain.setValueAtTime(vol,now);g.gain.exponentialRampToValueAtTime(.0001,now+(open?.12:.04));s.connect(f);f.connect(g);g.connect(musicGain);s.start(now);s.stop(now+.14);}
function snare(){if(!noiseBuf)return;const now=audio.currentTime,s=audio.createBufferSource();s.buffer=noiseBuf;const f=audio.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;const g=audio.createGain();g.gain.setValueAtTime(.5,now);g.gain.exponentialRampToValueAtTime(.0001,now+.16);s.connect(f);f.connect(g);g.connect(musicGain);s.start(now);s.stop(now+.18);}
playMusic=function(){
  if(!audio||!musicOn)return;
  const k=STATIONS[zr.radio].k;
  if(k==='orig')return _playMusic();
  if(k==='off')return;
  ensureAudioNodes();
  const s=musicStep++;
  if(k==='synth'){
    const bass=[55,55,65.41,49],arp=[220,277.18,329.63,415.3,329.63,277.18,246.94,277.18];
    if(s%2===0)tone(bass[Math.floor(s/8)%4],'sawtooth',.5,.22,420);
    tone(arp[s%8],'square',.24,.07,2600);
    if(s%8===0)tone(110,'triangle',1.2,.12,900);
  }else{
    const bass=[49,49,58.27,43.65];
    if(s%4===0||s%8===5)kick();
    if(s%4===2)snare();
    hat(.12,s%4===3);if(s%2===1)hat(.06,false);
    if(s%2===0)tone(bass[Math.floor(s/4)%4],'sawtooth',.28,.2,300);
    if(s%8===6)tone(op(s),'triangle',.18,.07,1800);
  }
};
function op(s){return [392,440,523.25,587.33][s%4];}
function nextStation(){zr.radio=(zr.radio+1)%STATIONS.length;pop('📻 '+STATIONS[zr.radio].n);}

/* ============ Input ============ */
window.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toLowerCase();
  if(k==='b'&&!e.repeat)nextStation();
});

/* ============ Radar ============ */
function drawRadar(){
  if(!rctx)return;
  const W=160,cx=80,cy=80,R=78,S=.82;
  rctx.clearRect(0,0,W,W);
  rctx.save();rctx.beginPath();rctx.arc(cx,cy,R,0,Math.PI*2);rctx.clip();
  rctx.fillStyle='#34454b';rctx.fillRect(0,0,W,W);
  rctx.translate(cx,cy);rctx.rotate(-player.yaw);
  const px=player.x,pz=player.z,X=v=>(v-px)*S,Y=v=>-(v-pz)*S;
  // Cross streets and main road
  rctx.fillStyle='#1b2226';rctx.fillRect(X(-17),-130,34*S,260);
  for(let zc=110+Math.floor((pz-200-110)/180)*180;zc<pz+200;zc+=180){if(zc<pz-200)continue;rctx.fillRect(-130,Y(zc)-10*S,260,20*S);}
  rctx.strokeStyle='#5f7078';rctx.lineWidth=1;rctx.strokeRect(X(-17),-130,34*S,260);
  rctx.strokeStyle='#8b9aa1';rctx.setLineDash([5,5]);rctx.beginPath();for(const lx of [-8.5,8.5]){rctx.moveTo(X(lx),-130);rctx.lineTo(X(lx),130);}rctx.stroke();rctx.setLineDash([]);
  // Traffic
  rctx.fillStyle='#a9b4b8';for(const t of traffic){const dx=X(t.x),dy=Y(t.z);if(dx*dx+dy*dy<R*R*1.2)rctx.fillRect(dx-1.6,dy-2.2,3.2,4.4);}
  // Mission marker
  if(missionMode==='checkpoints'){let mx=X(px),my=Y(nextCheckpoint);const d=Math.hypot(mx,my);if(d>R-8){mx*=(R-8)/d;my*=(R-8)/d;}rctx.fillStyle='#ffd447';rctx.beginPath();rctx.arc(mx,my,5,0,Math.PI*2);rctx.fill();rctx.strokeStyle='#000';rctx.lineWidth=1.5;rctx.stroke();}
  // Police
  const flash=Math.floor(performance.now()/160)%2===0;
  const cops=zr.units.map(u=>[u.x,u.z]);if(policeMode()&&policeUnit.active)cops.push([policeUnit.x,policeUnit.z]);
  for(const c of cops){let mx=X(c[0]),my=Y(c[1]);const d=Math.hypot(mx,my);if(d>R-6){mx*=(R-6)/d;my*=(R-6)/d;}rctx.fillStyle=flash?'#4f8dff':'#ff3b4d';rctx.beginPath();rctx.arc(mx,my,3.6,0,Math.PI*2);rctx.fill();rctx.strokeStyle='#fff';rctx.lineWidth=1;rctx.stroke();}
  // North marker
  rctx.restore();
  rctx.save();rctx.translate(cx,cy);rctx.fillStyle='#ff5d5d';rctx.font='bold 11px sans-serif';rctx.textAlign='center';rctx.textBaseline='middle';rctx.fillText('N',-(R-9)*Math.sin(player.yaw),-(R-9)*Math.cos(player.yaw));rctx.restore();
  // Player arrow
  rctx.save();rctx.translate(cx,cy);rctx.fillStyle='#fff';rctx.strokeStyle='#0a0f12';rctx.lineWidth=1.4;rctx.beginPath();rctx.moveTo(0,-8);rctx.lineTo(6,7);rctx.lineTo(0,3.5);rctx.lineTo(-6,7);rctx.closePath();rctx.fill();rctx.stroke();rctx.restore();
}

/* ============ HUD refresh ============ */
function refreshHud(){
  const on=cityMode();
  document.body.classList.toggle('zr-city',on);
  document.body.classList.toggle('zr-run',running&&!finished);
  if(!on){subtitle('');return;}
  const cash=$('zrCash');if(cash&&zr.cashShown!==credits){zr.cashShown=credits;cash.textContent='CR '+Math.round(credits).toLocaleString();}
  const stars=zr.stars,st=$('zrStars');
  if(st){[...st.children].forEach((b,i)=>b.classList.toggle('on',i<stars));st.classList.toggle('evading',stars>0&&zr.evade);st.classList.toggle('chased',stars>0&&!zr.evade);}
  const bust=$('zrBust');if(bust){bust.classList.toggle('show',zr.bustT>.1);const b=bust.firstChild;if(b)b.style.width=Math.min(100,zr.bustT/2.8*100)+'%';}
  // Mission subtitle
  let text='',kind='';
  if(zr.bustT>.1){text='Get moving or you will be BUSTED!';kind='bad';}
  else if(stars>0){text=zr.evade?'Stay out of sight to lose your wanted level.':'Wanted! Lose the cops — outrun them or find a gap.';kind='warn';}
  else if(missionMode==='checkpoints')text=`Drive through the yellow gates. Checkpoint ${missionCheckpoints}/5`;
  else if(missionMode==='police')text='Survive the police pursuit. Keep moving.';
  else text='Free roam. Crash into traffic and the police will come for you.';
  if(zr.subT<=0)subtitle(text,kind);
}

/* ============ FX: rain droplets, lightning ============ */
function drawFx(dt,active){
  if(!fctx)return;
  const w=innerWidth,h=innerHeight;if(fxc.width!==w||fxc.height!==h){fxc.width=w;fxc.height=h;}
  fctx.clearRect(0,0,w,h);
  if(!active)return;
  if(condition==='rain'){
    const cap=cameraMode===1?70:34;
    if(zr.drops.length<cap&&Math.random()<dt*(cameraMode===1?30:12))zr.drops.push({x:Math.random()*w,y:Math.random()*h*.8,r:rnd(1.5,4.5),v:0,life:rnd(2.5,6)});
    for(let i=zr.drops.length-1;i>=0;i--){
      const d=zr.drops[i];d.life-=dt;if(d.life<=0||d.y>h){zr.drops.splice(i,1);continue;}
      if(d.r>3.2&&Math.random()<dt*1.4)d.v=rnd(30,90);d.v*=Math.pow(.2,dt);d.y+=d.v*dt+Math.abs(player.speed)*dt*.5*(cameraMode===1?1:.2);d.x+=Math.abs(player.speed)*dt*.2*(d.x<w/2?-1:1);
      const a=clamp(d.life/1.2,0,1)*.5;
      fctx.fillStyle=`rgba(190,220,240,${a*.45})`;fctx.beginPath();fctx.ellipse(d.x,d.y,d.r*.8,d.r*(1+Math.min(1,d.v/60)),0,0,Math.PI*2);fctx.fill();
      fctx.fillStyle=`rgba(255,255,255,${a})`;fctx.beginPath();fctx.arc(d.x-d.r*.25,d.y-d.r*.3,d.r*.28,0,Math.PI*2);fctx.fill();
    }
    zr.nextFlash-=dt;if(zr.nextFlash<=0){zr.flash=1;zr.nextFlash=rnd(8,20);setTimeout(thunder,rnd(300,1400));}
  }else zr.drops.length=0;
  if(zr.flash>0){fctx.fillStyle=`rgba(220,230,255,${zr.flash*.38})`;fctx.fillRect(0,0,w,h);zr.flash=Math.max(0,zr.flash-dt*3.2);}
}

/* ============ Main loop ============ */
let last=performance.now();
function step(rdt){
  const active=running&&!paused&&!finished;
  const dt=Math.min(.05,rdt);
  // New run detection
  if((running&&!zr.prevRunning)||(running&&time+.4<zr.prevTime)){resetCity();zr.drops.length=0;}
  zr.prevRunning=running;zr.prevTime=time;
  // Inputs
  zr.brake=active&&(keys.has('s')||keys.has('arrowdown')||(typeof touch!=='undefined'&&touch.brake));
  zr.hand=active&&keys.has(' ');
  zr.horn=active&&keys.has('h');
  zr.subT=Math.max(0,zr.subT-dt);
  if(active){
    const spd=Math.abs(player.speed);
    zr.brakeHeat=clamp(zr.brakeHeat+((zr.brake&&spd>22)||zr.hand&&spd>14?dt*.9:-dt*.45),0,1);
    // Handbrake drift
    if(zr.hand&&spd>14){
      const sgn=Math.sign(player.speed)||1,st=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
      player.speed-=sgn*16*dt;
      player.slip=clamp(player.slip+st*1.5*dt+(player.slip>0?.18:-.18)*dt,-.78,.78);
      if(freeRoam)player.yaw+=st*1.15*dt*clamp(spd/40,0,1);else player.lateralVelocity+=st*spd*.9*dt;
      spawnTireSmoke();spawnTireSmoke();
      zr.smokeClock-=dt;if(zr.smokeClock<=0){zr.smokeClock=.06;const a=localPoint(player,-.48,.025,-.72),b=localPoint(player,.48,.025,-.72);skidMarks.push({x:a[0],z:a[2],yaw:player.yaw,life:9},{x:b[0],z:b[2],yaw:player.yaw,life:9});if(skidMarks.length>150)skidMarks.splice(0,skidMarks.length-150);}
      addSkillPoints(dt*70*clamp(spd/35,.4,2));
    }
    // Backfire when lifting off the throttle at high revs
    zr.backfire=Math.max(0,zr.backfire-dt);
    if(spd>35&&!keys.has('w')&&!keys.has('arrowup')&&Math.random()<dt*1.1)zr.backfire=.09;
    // Damage smoke
    if(crashCount>=2&&tireSmoke.length<95&&Math.random()<dt*(crashCount>=3?30:16)){
      const p=localPoint(player,rnd(-.3,.3),.95,1.15);tireSmoke.push({x:p[0],y:.95,z:p[2],life:.9,max:1.1,size:.13,vx:rnd(-.4,.4),vy:rnd(.8,1.5),vz:.3});
    }
    if(freeRoam)updatePolice(dt);
  }
  // Audio: horn and siren
  if(audio&&ensureAudioNodes()){
    const now=audio.currentTime;
    hornNodes.g.gain.setTargetAtTime(zr.horn?.07:.0001,now,.02);
    let sir=0;if(active&&freeRoam&&zr.stars>0&&isFinite(zr.nearest))sir=clamp(1-zr.nearest/190,0,1);
    sirenNodes.g.gain.setTargetAtTime(sir*.045*(musicOn?1:.6),now,.12);
    sirenNodes.o.frequency.setTargetAtTime(760+Math.sin(performance.now()/420*Math.PI)*200,now,.04);
  }
  // Screen state: WASTED / MISSION PASSED
  const out=!$('outScreen').classList.contains('hidden'),fin=!$('finish').classList.contains('hidden');
  if(out&&!zr.wasOut){showBig('WASTED','wasted',4200);document.body.classList.add('zr-wasted');zr.units.length=0;}
  if(!out&&zr.wasOut)document.body.classList.remove('zr-wasted');
  if(fin&&!zr.wasFin&&!freeRoam)showBig('MISSION PASSED','passed',3200);
  zr.wasOut=out;zr.wasFin=fin;
  drawFx(dt,active);
  zr.hudClock+=rdt;if(zr.hudClock>.1){zr.hudClock=0;refreshHud();}
  if(freeRoam&&running)drawRadar();
}
function loop(now){
  requestAnimationFrame(loop);
  const rdt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  try{step(rdt);}catch(e){if(!loop.err){loop.err=1;console.error('ZAYRO REALISM',e);}}
}
requestAnimationFrame(loop);
})();
