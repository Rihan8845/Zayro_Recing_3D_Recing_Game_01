/* ZAYRO RACING — PRO PACK (v7)
   Created for Rihan's ZAYRO RACING. Purely additive: game.js is NOT modified.
   1) PRO REALISM driving layer  - wraps update(dt): tyre temperature + compounds, turbo spool/lag, gear-shift torque cut,
      engine braking, lift-off / trail-brake oversteer, aero downforce. Toggle: "DRIVING MODEL" in the garage.
   2) PRO TUNING SHOP            - Engine, Turbo, Gearbox, Weight reduction, Aero kit (5 levels each) + 4 tyre compounds.
      Bought with the normal credits, saved in localStorage 'zayroPro1', included in driver-save export.
   3) REALISM FX                 - screen-space camera effects (speed vignette, speed streaks, rain on lens, nitro glow, film grain).
      These are 2D overlays on top of the existing WebGL scene (not new 3D models). Toggle: "REALISM FX".
   4) DAILY CHALLENGES           - 3 new challenges every day, tracked from real race results, coins paid once.
   6) MANUAL GEARBOX             - optional (garage toggle): Q / E (or PageDown / PageUp, or the on-screen triangle buttons on phones) change gear. Real power band: bogging in
                                    the wrong gear, rev limiter at redline, over-rev protection on downshifts, PERFECT SHIFT bonus.
   5) PRO HUD                    - tyre temperature, turbo boost, live G-force while racing (PC only; hidden on phones). */
(function(){
'use strict';
if(window.__zayroPro)return;window.__zayroPro=true;
const KEY='zayroPro1';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{if(typeof PROFILE_SAVE_KEYS!=='undefined'&&!PROFILE_SAVE_KEYS.includes(KEY))PROFILE_SAVE_KEYS.push(KEY);}catch(_){}

/* ------------------------------------------------------------------ data */
const PARTS={
  engine :{name:'ENGINE TUNE',  icon:'⚙', base:600, step:400, max:5, desc:'More power: higher top speed and stronger acceleration.'},
  turbo  :{name:'TURBOCHARGER', icon:'🌀',base:800, step:500, max:5, desc:'Big extra boost once the turbo has spooled up (hold throttle ~1 s). Lag after gear shifts.'},
  gearbox:{name:'GEARBOX',      icon:'⛓', base:500, step:300, max:5, desc:'Faster shifts: less power lost between gears.'},
  weight :{name:'LIGHTWEIGHT',  icon:'🪶',base:700, step:400, max:5, desc:'Lighter car: quicker acceleration, better brakes and grip.'},
  aero   :{name:'AERO KIT',     icon:'✈', base:600, step:350, max:5, desc:'Downforce: more grip at high speed (tiny drag cost).'}
};
const PART_KEYS=Object.keys(PARTS);
// optimum tyre-temperature window (deg C); dry/wet = grip levels added in dry / rain
const TYRES=[
  {id:0,name:'STREET',    price:0,    lo:68,hi:105,dry:0,   wet:0,   note:'Balanced everyday tyre'},
  {id:1,name:'SPORT',     price:1500, lo:78,hi:110,dry:.7,  wet:-.4, note:'More dry grip, worse in rain'},
  {id:2,name:'SEMI-SLICK',price:3500, lo:90,hi:118,dry:1.4, wet:-1.7,note:'Race grip when warm, dangerous when cold or wet'},
  {id:3,name:'RAIN',      price:2500, lo:52,hi:90, dry:-.3, wet:1.4, note:'Only choice for heavy rain'}
];
const POOL=[
  {id:'podium', text:'Finish on the podium (top 3)',            reward:450, ok:(r,s)=>Number.isInteger(r.position)&&r.position<=3},
  {id:'win',    text:'Win a race',                              reward:800, ok:(r,s)=>r.position===1},
  {id:'speed250',text:'Reach 250 km/h in a race',               reward:350, ok:(r,s)=>s.maxKmh>=250},
  {id:'speed320',text:'Reach 320 km/h in a race',               reward:600, ok:(r,s)=>s.maxKmh>=320},
  {id:'clean',  text:'Finish a race without crashing',          reward:450, ok:(r,s)=>r.crashes===0},
  {id:'misses', text:'Get 6 near misses in one race',           reward:400, ok:(r,s)=>(r.nearMisses||0)>=6},
  {id:'drift',  text:'Score 2,000 skill points in one race',    reward:350, ok:(r,s)=>(r.skill||0)>=2000},
  {id:'races3', text:'Finish 3 races',                          reward:500, goal:3, ok:()=>true},
  {id:'online', text:'Finish an online multiplayer race',       reward:700, ok:(r)=>r.mode==='multi'},
  {id:'manual', text:'Finish a race with the MANUAL gearbox',   reward:650, ok:(r,s)=>!!s.manual}
];

/* ------------------------------------------------------------------ save */
function defaults(){return {v:1,realism:true,fx:true,manual:false,tune:{engine:0,turbo:0,gearbox:0,weight:0,aero:0},tyreSel:0,tyreOwned:[0],daily:{day:'',ch:[],seen:[]}};}
function load(){
  let s=defaults();
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');
    if(raw&&typeof raw==='object'){
      s.realism=raw.realism!==false;s.fx=raw.fx!==false;s.manual=raw.manual===true;
      for(const k of PART_KEYS){const n=Number(raw.tune&&raw.tune[k]);s.tune[k]=Number.isFinite(n)?clamp(Math.floor(n),0,PARTS[k].max):0;}
      if(Array.isArray(raw.tyreOwned))s.tyreOwned=[...new Set([0,...raw.tyreOwned.map(Number).filter(n=>n>=0&&n<TYRES.length)])];
      s.tyreSel=s.tyreOwned.includes(Number(raw.tyreSel))?Number(raw.tyreSel):0;
      if(raw.daily&&typeof raw.daily==='object'){s.daily.day=String(raw.daily.day||'');
        s.daily.ch=Array.isArray(raw.daily.ch)?raw.daily.ch.filter(c=>c&&POOL.some(p=>p.id===c.id)).slice(0,3).map(c=>({id:c.id,prog:Math.max(0,Number(c.prog)||0),done:!!c.done})):[];
        s.daily.seen=Array.isArray(raw.daily.seen)?raw.daily.seen.map(String).slice(-30):[];}
    }}catch(_){}
  return s;
}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(_){}}
const G=()=>{try{return garageUpgrades;}catch(_){return null;}};
const toast=t=>{try{pop(t);}catch(_){}};
function spend(price){
  try{if(credits<price){toast('NEED '+(price-credits)+' MORE CREDITS');return false;}
    credits-=price;localStorage.setItem('apexCredits',String(credits));try{refreshGarage();}catch(_){}return true;}catch(_){return false;}
}
function earn(amount){
  try{credits+=amount;careerStats.creditsEarned+=amount;localStorage.setItem('apexCredits',String(credits));try{saveCareerStats();}catch(_){}try{refreshGarage();}catch(_){}}catch(_){}
}
const partPrice=k=>PARTS[k].base+S.tune[k]*PARTS[k].step;

/* ------------------------------------------------------------------ realism state */
const R={spool:0,tyreT:30,lastGear:1,gLat:0,gLong:0,lastLV:0,lastV:0,maxKmh:0,hudClock:0,shiftFlash:0,virt:{speed:0,grip:0,brakes:0}};
const M={gear:1,shiftT:0,msgT:0,limT:0,perfects:0};
const rainy=()=>{try{return condition==='rain';}catch(_){return false;}};
const ambient=()=>rainy()?16:28;
function resetRace(){M.gear=1;M.shiftT=0;M.msgT=0;M.limT=0;M.perfects=0;R.usedManual=false;R.spool=0;R.tyreT=ambient()+10;R.lastGear=1;R.gLat=R.gLong=0;R.lastLV=0;R.lastV=0;R.maxKmh=0;R.shiftFlash=0;}
function tyreGripLevels(){
  const t=TYRES[S.tyreSel]||TYRES[0],T=R.tyreT,w=rainy();
  let lv=w?t.wet:t.dry;
  if(S.realism){
    if(T<t.lo)lv-=clamp((t.lo-T)/t.lo,0,1)*1.15;       // cold tyres: low grip
    else if(T>t.hi)lv-=clamp((T-t.hi)/28,0,1)*.9;        // overheated tyres: sliding
  }
  return lv;
}
function virtualBonus(inpt,dt){
  const T=S.tune,v=Math.abs(player.speed);
  const spoolTarget=(inpt.gas&&player.speed>6)?1:0;
  if(S.realism)R.spool+=(spoolTarget-R.spool)*Math.min(1,dt*(spoolTarget?.85:2.6));else R.spool=spoolTarget;
  const aeroF=clamp(v/55,0,1);
  return {
    speed:T.engine*.35+T.turbo*.25*R.spool+T.gearbox*.05+T.weight*.10-T.aero*.06,
    grip :tyreGripLevels()*2.5+T.aero*.8*aeroF+T.weight*.2,   // 1 level = 4.5% grip in the base game; tyres/aero are scaled so they are actually felt
    brakes:T.weight*.30+(S.tyreSel===2?.5:0)
  };
}

/* ------------------------------------------------------------------ update wrapper */
let wrapped=false;
function wrapUpdate(){
  if(wrapped||typeof update!=='function')return;wrapped=true;
  const _update=update;
  update=function(dt){
    let live=false,inpt=null,gu=null,snap=null,v0=0,slip0=0;
    try{
      live=!!(running&&!paused&&!finished)&&dt>0&&dt<.25;
      if(live){
        gu=G();inpt=fieldInputs();v0=player.speed;
        if(S.manual&&player.speed>=0){currentGear=M.gear;shiftCooldown=1;}   // block the game's automatic shifting
        if(gu){const b=virtualBonus(inpt,dt);R.virt=b;snap={speed:gu.speed,grip:gu.grip,brakes:gu.brakes};
          gu.speed+=b.speed;gu.grip+=b.grip;gu.brakes+=b.brakes;}
      }
    }catch(e){live=false;if(snap&&gu){gu.speed=snap.speed;gu.grip=snap.grip;gu.brakes=snap.brakes;snap=null;}console.error('ZAYRO PRO pre',e);}
    try{return _update.apply(this,arguments);}
    finally{
      if(snap&&gu){gu.speed=snap.speed;gu.grip=snap.grip;gu.brakes=snap.brakes;}
      if(live){try{post(dt,inpt,v0);}catch(e){console.error('ZAYRO PRO post',e);}}
    }
  };
}
function post(dt,inpt,v0){
  if(!(running&&!finished))return;
  const fwd=Math.max(0,player.speed),T=S.tune;
  if(S.manual)manualStep(dt,inpt,v0);else{try{ui.rpm.style.background='';}catch(_){}}
  if(S.realism){
    // gear shift: torque is interrupted while the gearbox is shifting (less with a better gearbox)
    if(!S.manual){
      if(currentGear!==R.lastGear){if(currentGear>R.lastGear)R.spool*=.55;R.shiftFlash=.35;R.lastGear=currentGear;}
      const dv=player.speed-v0;
      if(inpt.gas&&shiftCooldown>0&&dv>0)player.speed=v0+dv*clamp(.42+T.gearbox*.12,.42,1);
    }
    // engine braking when lifting off
    if(!inpt.gas&&!inpt.brake&&player.speed>0)player.speed=Math.max(0,player.speed-(.35+.65*currentGear/7)*Math.min(1,fwd/22)*1.05*dt);
    // weight transfer: lifting or braking while turning makes the rear step out
    if(fwd>24&&Math.abs(steer)>.28){
      const load=Math.min(1,fwd/55),sgn=Math.sign(steer);
      if(inpt.brake)player.slip+=sgn*1.05*load*dt*(1-T.weight*.04);
      else if(!inpt.gas)player.slip+=sgn*.85*load*dt;
      player.slip=clamp(player.slip,-1.2,1.2);
    }
    // tyre temperature: heats with speed, sliding and braking; cools in rain
    const target=ambient()+24+fwd*.34+Math.abs(player.slip)*95+(inpt.brake&&fwd>20?24:0)+(boosting?6:0);
    R.tyreT=Math.min(140,R.tyreT+(target-R.tyreT)*Math.min(1,dt*.13));
  }else{R.tyreT=clamp(ambient()+30+fwd*.3,0,140);}
  // hard safety cap: the multiplayer server rejects anything faster than 150 m/s
  if(player.speed>145)player.speed=145;
  // live telemetry
  R.gLong+=(((player.speed-v0)/dt/9.81)-R.gLong)*Math.min(1,dt*6);
  R.gLat+=((Math.abs(player.lateralVelocity-R.lastLV)/dt/9.81)-R.gLat)*Math.min(1,dt*6);R.lastLV=player.lateralVelocity;
  R.gLat=Math.min(R.gLat,3.2);
  R.maxKmh=Math.max(R.maxKmh,Math.abs(player.speed)*3.6);
  if(R.shiftFlash>0)R.shiftFlash-=dt;
  hud(dt);
}

/* ------------------------------------------------------------------ manual gearbox */
// Gear speeds are the game's own table (so the engine sound / RPM bar stay in sync): top speed (m/s) of gears 1..6, gear 7 is open-ended.
const GEAR_TOP=[0,10,18,28,40,54,70];
function topRef(){try{return cars[selectedCar].top+((G()||{speed:0}).speed+R.virt.speed)*2.5;}catch(_){return 100;}}
const gearCap=g=>g<7?GEAR_TOP[g]:Math.max(94,topRef()*1.3);
function rpmFor(v,g){const ceil=gearCap(g),floor=g>1?gearCap(g-1):0;return 900+clamp((v-floor*.55)/Math.max(1,ceil-floor*.55),0,1.15)*6100;}
const torque=t=>.35+2.6*t*(1-t);               // power band: weak near idle and at redline, strongest mid-range
let msgEl=null;
function say(txt,cls){if(!msgEl)return;msgEl.textContent=txt;msgEl.className='show '+(cls||'');M.msgT=.9;}
function manualStep(dt,inpt,v0){
  R.usedManual=true;
  if(player.speed<0){M.gear=1;return;}
  if(M.shiftT>0)M.shiftT-=dt;
  if(M.msgT>0){M.msgT-=dt;if(M.msgT<=0&&msgEl)msgEl.className='';}
  if(M.limT>0)M.limT-=dt;
  let v=player.speed,dv=v-v0;
  const cap=gearCap(M.gear),t=clamp((rpmFor(v0,M.gear)-900)/6300,0,1.1);
  if(dv>0){
    if(M.shiftT>0)dv=0;                                              // clutch in: no drive during the shift
    else if(v0>=cap*.995){dv=0;if(inpt.gas&&M.limT<=0){M.limT=1.2;say('REV LIMITER · SHIFT UP','warn');}}
    else dv*=clamp(torque(Math.min(t,1))/.85,.3,1.2);                // wrong gear = weak, right gear = stronger than the old auto-box
    v=v0+dv;if(v>cap)v=Math.max(v0,cap);
    player.speed=v;
  }
  if(inpt.brake&&v<3&&M.gear>1){M.gear=1;}                           // auto-clutch when you stop
  currentGear=M.gear;
  const tt=clamp((rpmFor(player.speed,M.gear)-900)/6300,0,1);
  try{ui.rpm.style.background=tt>.88?'#ff4d3d':tt>.72?'#ffd65a':'';if(player.speed>=0)ui.gear.textContent='GEAR '+M.gear+' · MANUAL'+(boosting?'  // BOOST':'');}catch(_){}
}
function shift(dir){
  if(!S.manual||!(running&&!finished&&!paused)||M.shiftT>0||player.speed<0)return;
  const g=clamp(M.gear+dir,1,7);if(g===M.gear)return;
  if(dir<0){if(rpmFor(Math.max(0,player.speed),g)>900+6100*1.02){say('OVER-REV PROTECTED','warn');return;}}
  else{
    const t=(rpmFor(player.speed,M.gear)-900)/6300;
    if(t>.78&&t<=1.03&&player.speed>8){player.speed+=.6;M.perfects++;say('PERFECT SHIFT','good');}
    else if(t<.45&&player.speed>8)say('EARLY SHIFT','');
    R.spool*=.6;
  }
  M.gear=g;currentGear=g;M.shiftT=Math.max(.1,.22-S.tune.gearbox*.025);R.shiftFlash=.3;
}
window.addEventListener('keydown',e=>{
  if(e.repeat||!S.manual)return;
  if(e.code==='KeyE'||e.code==='PageUp')shift(1);else if(e.code==='KeyQ'||e.code==='PageDown')shift(-1);
});
function buildManualUi(){
  if($('zmanMsg'))return;
  msgEl=document.createElement('div');msgEl.id='zmanMsg';msgEl.className='';document.body.appendChild(msgEl);
  const b=document.createElement('div');b.id='zmanShift';b.className='zman-shift';
  b.innerHTML='<button type="button" data-zman="1" aria-label="Shift up">▲</button><button type="button" data-zman="-1" aria-label="Shift down">▼</button>';
  document.body.appendChild(b);
  b.addEventListener('pointerdown',e=>{const t=e.target.closest('button');if(!t)return;e.preventDefault();e.stopPropagation();shift(Number(t.dataset.zman));},{passive:false});
  setInterval(()=>{try{b.classList.toggle('on',!!(S.manual&&running&&!finished&&!paused&&matchMedia('(pointer:coarse)').matches));}catch(_){}},300);
}

/* ------------------------------------------------------------------ HUD */
let hudEl=null;
function buildHud(){
  return;   // Pro HUD strip (tyres / turbo / G-force) removed at the owner's request; physics, tuning and manual gearbox are unchanged
  if(hudEl)return;
  hudEl=document.createElement('div');hudEl.id='zproHud';hudEl.className='zpro-hud hidden';
  hudEl.innerHTML='<div class="zh-i"><small>TYRES</small><b id="zhTyre">--</b><i><u id="zhTyreBar"></u></i></div>'+
    '<div class="zh-i"><small>TURBO</small><b id="zhTurbo">--</b><i><u id="zhTurboBar"></u></i></div>'+
    '<div class="zh-i"><small>G-FORCE</small><b id="zhG">0.0</b><i><u id="zhGBar"></u></i></div>';
  document.body.appendChild(hudEl);
}
function hud(dt){
  R.hudClock+=dt;if(R.hudClock<.12)return;R.hudClock=0;
  if(!hudEl)return;
  hudEl.classList.toggle('hidden',!(running&&!finished));
  const t=TYRES[S.tyreSel]||TYRES[0],T=R.tyreT,state=T<t.lo?'cold':T>t.hi?'hot':'ok';
  $('zhTyre').textContent=Math.round(T)+'°C '+(state==='ok'?'OPTIMAL':state==='cold'?'COLD':'HOT');
  const tb=$('zhTyreBar');tb.style.width=clamp(T/130*100,0,100)+'%';tb.className='s-'+state;
  $('zhTurbo').textContent=S.tune.turbo?Math.round(R.spool*100)+'%':'NO TURBO';
  $('zhTurboBar').style.width=(S.tune.turbo?R.spool*100:0)+'%';
  const g=Math.hypot(R.gLat,R.gLong);$('zhG').textContent=g.toFixed(1)+' G';$('zhGBar').style.width=clamp(g/2.5*100,0,100)+'%';
}

/* ------------------------------------------------------------------ REALISM FX overlay */
const FX={cv:null,cx:null,vig:null,drops:[],streaks:[],on:false,last:0,w:0,h:0};
function buildFx(){
  if(FX.cv)return;
  const game=$('game');if(!game)return;
  const wrap=document.createElement('div');wrap.id='zproFxWrap';wrap.className='zpro-fx';
  wrap.innerHTML='<div class="zpro-vig" id="zproVig"></div><canvas id="zproFx"></canvas><div class="zpro-grain"></div>';
  game.insertAdjacentElement('afterend',wrap);
  FX.cv=$('zproFx');FX.cx=FX.cv.getContext('2d');FX.vig=$('zproVig');
  requestAnimationFrame(fxLoop);
}
function fxEnabled(){let perf=false;try{perf=graphicsQuality==='performance';}catch(_){}return S.fx&&!perf;}
function fxLoop(now){
  requestAnimationFrame(fxLoop);
  try{
    const wrap=$('zproFxWrap');if(!wrap)return;
    const racing=!!(running&&!finished)&&fxEnabled();
    if(wrap.classList.contains('on')!==racing)wrap.classList.toggle('on',racing);
    if(!racing){if(FX.on){FX.on=false;FX.cx.clearRect(0,0,FX.w,FX.h);}return;}
    FX.on=true;
    if(now-FX.last<33)return;const dt=Math.min(.1,(now-FX.last)/1000||.033);FX.last=now;
    const w=Math.max(160,Math.round(innerWidth/3)),h=Math.max(90,Math.round(innerHeight/3));
    if(FX.cv.width!==w||FX.cv.height!==h){FX.cv.width=w;FX.cv.height=h;FX.w=w;FX.h=h;}
    const c=FX.cx;c.clearRect(0,0,w,h);
    const v=Math.abs(player.speed),sp=clamp((v-35)/75,0,1),boost=!!boosting;
    FX.vig.style.setProperty('--zv',(.16+sp*.34+(boost?.12:0)).toFixed(3));
    FX.vig.classList.toggle('boost',boost);
    // speed streaks radiating from the vanishing point
    if(sp>.05){
      const n=Math.round(sp*(boost?30:18));
      while(FX.streaks.length<n)FX.streaks.push({a:Math.random()*6.283,r:.3+Math.random()*.4,s:.7+Math.random()*1.2});
      FX.streaks.length=Math.min(FX.streaks.length,n);
      const cx=w/2,cy=h*.46,maxR=Math.hypot(w,h)*.6;
      c.lineWidth=1;
      for(const s of FX.streaks){
        s.r+=dt*s.s*(.5+sp*1.4);if(s.r>1.05){s.r=.28+Math.random()*.1;s.a=Math.random()*6.283;}
        const r0=s.r*maxR,r1=(s.r+.05+sp*.08)*maxR,ca=Math.cos(s.a),sa=Math.sin(s.a);
        c.strokeStyle='rgba('+(boost?'150,210,255':'255,255,255')+','+(.05+sp*.16*s.r).toFixed(3)+')';
        c.beginPath();c.moveTo(cx+ca*r0,cy+sa*r0*.62);c.lineTo(cx+ca*r1,cy+sa*r1*.62);c.stroke();
      }
    }else FX.streaks.length=0;
    // rain on the lens
    if(rainy()){
      if(FX.drops.length<46&&Math.random()<.8)FX.drops.push({x:Math.random()*w,y:Math.random()*h*.8,r:.7+Math.random()*1.8,life:2.5+Math.random()*3,vy:0});
      for(let i=FX.drops.length-1;i>=0;i--){
        const d=FX.drops[i];d.life-=dt;if(d.life<=0){FX.drops.splice(i,1);continue;}
        if(d.r>1.7&&d.life<2)d.vy+=dt*22;d.y+=d.vy*dt+sp*dt*8;d.x+=sp*(d.x-w/2)*dt*.15;
        const a=clamp(d.life,0,1);
        c.fillStyle='rgba(190,215,235,'+(.16*a).toFixed(3)+')';c.beginPath();c.ellipse(d.x,d.y,d.r,d.r*1.25,0,0,6.283);c.fill();
        c.fillStyle='rgba(255,255,255,'+(.3*a).toFixed(3)+')';c.beginPath();c.arc(d.x-d.r*.3,d.y-d.r*.4,d.r*.28,0,6.283);c.fill();
      }
    }else if(FX.drops.length)FX.drops.length=0;
  }catch(e){FX.cv=null;console.error('ZAYRO PRO fx',e);}
}

/* ------------------------------------------------------------------ daily challenges */
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function dayKey(){try{return localDayKey();}catch(_){return new Date().toISOString().slice(0,10);}}
function ensureDaily(){
  const day=dayKey();
  if(S.daily.day===day&&S.daily.ch.length===3)return;
  let h=hash('zayro-'+day);const ids=POOL.map(p=>p.id),pick=[];
  while(pick.length<3){h=(Math.imul(h,1664525)+1013904223)>>>0;const id=ids[h%ids.length];if(!pick.includes(id))pick.push(id);}
  S.daily={day,ch:pick.map(id=>({id,prog:0,done:false})),seen:[]};save();
}
function onResult(r){
  try{
    if(!r||r.status!=='ready'||!r.id)return;
    ensureDaily();
    if(S.daily.seen.includes(r.id))return;
    S.daily.seen.push(r.id);
    const stats={maxKmh:Math.max(R.maxKmh,r.finishSpeed||0),manual:R.usedManual};
    for(const c of S.daily.ch){
      if(c.done)continue;const p=POOL.find(x=>x.id===c.id);if(!p)continue;
      const goal=p.goal||1;
      if(p.ok(r,stats))c.prog=Math.min(goal,c.prog+1);
      if(c.prog>=goal){c.done=true;earn(p.reward);toast('✔ DAILY CHALLENGE · +'+p.reward+' CR');}
    }
    save();renderDaily();
  }catch(e){console.error('ZAYRO PRO daily',e);}
}
window.addEventListener('zayro:result',e=>onResult(e.detail||window.ZAYRO_RESULT));

/* ------------------------------------------------------------------ garage UI */
function renderDaily(){
  const el=$('zproDaily');if(!el)return;ensureDaily();
  el.innerHTML=S.daily.ch.map(c=>{const p=POOL.find(x=>x.id===c.id),goal=p.goal||1;
    return '<div class="zd-c '+(c.done?'done':'')+'"><b>'+(c.done?'✔ ':'◎ ')+esc(p.text)+'</b><small>'+(goal>1?c.prog+' / '+goal+' · ':'')+'REWARD '+p.reward+' CR'+(c.done?' · CLAIMED':'')+'</small></div>';}).join('');
}
function renderTune(){
  const el=$('zproTune');if(!el)return;
  const stats=PART_KEYS.map(k=>{const P=PARTS[k],lv=S.tune[k],max=lv>=P.max;
    return '<div class="zt-p"><div class="zt-h"><span>'+P.icon+' '+P.name+'</span><em>LEVEL '+lv+'/'+P.max+'</em></div><div class="zt-bar"><u style="width:'+(lv/P.max*100)+'%"></u></div><small>'+esc(P.desc)+'</small>'+
      '<button type="button" class="zt-buy" data-zpro-part="'+k+'" '+(max?'disabled':'')+'>'+(max?'MAX LEVEL ✓':'BUY · '+partPrice(k)+' CR')+'</button></div>';}).join('');
  const tyres=TYRES.map(t=>{const own=S.tyreOwned.includes(t.id),sel=S.tyreSel===t.id;
    return '<button type="button" class="zt-t '+(sel?'sel':'')+'" data-zpro-tyre="'+t.id+'"><b>'+t.name+'</b><small>'+esc(t.note)+'</small><em>'+(sel?'FITTED ✓':own?'FIT':'BUY · '+t.price+' CR')+'</em></button>';}).join('');
  el.innerHTML='<div class="zt-grid">'+stats+'</div><div class="zt-label">TYRE COMPOUND</div><div class="zt-tyres">'+tyres+'</div>'+
    '<div class="zt-tog"><button type="button" id="zproRealismBtn" class="zt-switch '+(S.realism?'on':'')+'">DRIVING MODEL · '+(S.realism?'PRO REALISM':'CLASSIC ARCADE')+'</button>'+
    '<button type="button" id="zproFxBtn" class="zt-switch '+(S.fx?'on':'')+'">REALISM FX · '+(S.fx?'ON':'OFF')+'</button>'+
    '<button type="button" id="zproGearBtn" class="zt-switch '+(S.manual?'on':'')+'">TRANSMISSION · '+(S.manual?'MANUAL (Q / E)':'AUTOMATIC')+'</button></div>'+
    '<p class="garage-note">Pro Realism adds tyre temperature, turbo lag, gear-shift power loss, engine braking and weight transfer. Classic Arcade keeps the original feel (tuning parts still work). MANUAL: Q = shift down, E = shift up (phones get ▲▼ buttons); shift near the top of the rev bar for a PERFECT SHIFT. Fastest way to learn: warm the tyres up in the first corners.</p>';
}
function buildUI(){
  if($('zproWrap'))return;
  const cs=$('careerStats');if(!cs)return;
  const anchor=$('zrCabinetWrap')||cs.previousElementSibling||cs;
  const wrap=document.createElement('div');wrap.id='zproWrap';
  wrap.innerHTML='<div class="section-label stage-label">DAILY CHALLENGES · NEW EVERY DAY</div><div id="zproDaily" class="zpro-daily"></div>'+
    '<div class="section-label stage-label">PRO TUNING SHOP · ENGINE · TURBO · GEARBOX · TYRES</div><div id="zproTune" class="zpro-tune"></div>';
  anchor.insertAdjacentElement('beforebegin',wrap);
  wrap.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    if(t.dataset.zproPart){const k=t.dataset.zproPart,P=PARTS[k];if(!P||S.tune[k]>=P.max)return;
      if(spend(partPrice(k))){S.tune[k]++;save();toast(P.name+' UPGRADED · LEVEL '+S.tune[k]);renderTune();}}
    else if(t.dataset.zproTyre){const id=Number(t.dataset.zproTyre),ty=TYRES[id];if(!ty)return;
      if(!S.tyreOwned.includes(id)){if(!spend(ty.price))return;S.tyreOwned.push(id);}
      S.tyreSel=id;save();toast(ty.name+' TYRES FITTED');renderTune();}
    else if(t.id==='zproRealismBtn'){S.realism=!S.realism;save();renderTune();toast(S.realism?'PRO REALISM DRIVING ON':'CLASSIC ARCADE DRIVING');}
    else if(t.id==='zproFxBtn'){S.fx=!S.fx;save();renderTune();}
    else if(t.id==='zproGearBtn'){S.manual=!S.manual;save();renderTune();toast(S.manual?'MANUAL GEARBOX · Q = DOWN, E = UP':'AUTOMATIC GEARBOX');}
  });
  renderDaily();renderTune();
}

/* ------------------------------------------------------------------ boot */
function boot(){
  try{wrapUpdate();}catch(e){console.error('ZAYRO PRO wrap',e);}
  try{if(typeof startRace==='function'){const _sr=startRace;startRace=function(){try{resetRace();}catch(_){}return _sr.apply(this,arguments);};}}catch(e){console.error(e);}
  try{buildHud();buildFx();buildUI();buildManualUi();}catch(e){console.error('ZAYRO PRO ui',e);}
  window.ZAYRO_PRO={state:()=>JSON.parse(JSON.stringify(S)),telemetry:()=>({spool:R.spool,tyreT:R.tyreT,gLat:R.gLat,gLong:R.gLong,maxKmh:R.maxKmh,virt:R.virt}),
    parts:PARTS,tyres:TYRES,shift,manual:()=>({on:S.manual,gear:M.gear,shiftT:M.shiftT,perfects:M.perfects,rpm:rpmFor(Math.max(0,player.speed),M.gear)}),refresh(){S=load();renderDaily();renderTune();},reload(){S=load();}};
  resetRace();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
