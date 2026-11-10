'use strict';
/* ZAYRO DYNAMICS v1.0 — loads after zayro_pro.js (game.js and all other files untouched).
   A "real car feel" layer wrapped around update(dt). Works on PC keyboard, gamepad, phone buttons, wheel and tilt.
   1) SPEED-SENSITIVE STEERING   Steering lock shrinks as speed rises (like a real car / steering ratio), so 250 km/h is
                                 stable and precise while parking-lot speeds stay sharp. Full lock at 0, ~70% at 144 km/h, ~45% at top speed.
   2) ANALOG STEERING            The phone steering wheel / tilt / gamepad stick now steer in proportion (the base game
                                 only knew left / centre / right). A half-turned wheel = half steering.
   3) PROGRESSIVE THROTTLE       Throttle builds over ~0.25 s instead of snapping to 100 % -> no instant wheel-spin launch.
   4) PROGRESSIVE BRAKES         Brake pressure builds (tap = light braking, hold = full braking).
   5) BRAKE HEAT + FADE          Hard repeated braking from speed heats the discs; above ~380 C braking power fades up to 30 %.
                                 Airflow cools them. A warning toast appears when they start fading.
   6) COUNTER-STEER              Steering against a slide recovers it faster; steering into it with throttle pushes it further.
   8) POWER+                     Stronger launch and mid-range pull, NITRO KICK surge, top end +7% (capped at 145 m/s).
   7) SQUAT / DIVE               Body pitches back under acceleration and forward under braking.
   Garage switch "DYNAMICS+" turns it all off (original feel). Setting saved in localStorage 'zayroDyn1'.
   Everything is wrapped in try/catch; a failure here can never stop the game. */
(function(){
if(window.__zayroDyn)return;window.__zayroDyn=true;
const KEY='zayroDyn1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const S={on:true,pwr:true,bk:0,ms:0,thr:0,bp:0,bt:60,toastT:0,inUpd:false};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s.on==='boolean')S.on=s.on;if(s&&typeof s.pwr==='boolean')S.pwr=s.pwr;}catch(_){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({on:S.on,pwr:S.pwr}));}catch(_){}};
try{if(typeof PROFILE_SAVE_KEYS!=='undefined'&&!PROFILE_SAVE_KEYS.includes(KEY))PROFILE_SAVE_KEYS.push(KEY);}catch(_){}
window.__zrDyn=S;

/* ---- keep the base game's own steering integration out of the way while update() runs (we drive `steer` ourselves) */
const _fi=fieldInputs;
fieldInputs=function(){
  const r=_fi.apply(this,arguments);
  if(S.inUpd){r.left=false;r.right=false;}
  return r;
};

function padAxis(){
  try{
    const pads=navigator.getGamepads?navigator.getGamepads():[];
    const p=pads&&Array.from(pads).find(Boolean);
    if(p&&p.axes&&p.axes.length){const a=p.axes[0];if(Math.abs(a)>.14)return Math.sign(a)*Math.pow((Math.abs(a)-.14)/.86,1.35);}
  }catch(_){}
  return null;
}
function prepSteer(dt,o){
  let T=Number(o.right)-Number(o.left);
  if(typeof mode!=='undefined'&&mode==='wheel'&&touch.left===touch.right&&Math.abs(touch.wheel)>.03)T=clamp(touch.wheel,-1,1);
  const pa=padAxis();if(pa!==null)T=pa;
  const v=Math.abs(player.speed),q=v/45;
  T*=.32+.68/(1+q*q);                                              // steering lock vs speed
  const sf=Math.min(1,v/28),k=Math.min(.9,dt*(5.2+sf*2.4));        // same response rate the base game uses
  S.ms+=(T-S.ms)*k;
  steer=clamp(S.ms/(1-k),-1.25,1.25);                              // base then integrates (input 0) and lands exactly on S.ms
}

function post(dt,o,v0){
  steer=clamp(S.ms,-1,1);
  const v1=player.speed;let dv=v1-v0;
  // progressive throttle
  const tt=o.gas?1:0;S.thr+=(tt-S.thr)*Math.min(1,dt*(tt>S.thr?4.5:9));
  if(o.gas&&!o.boost&&dv>0&&v0>=0){player.speed=v0+dv*(.3+.7*S.thr);dv=player.speed-v0;}
  // POWER+: stronger launch, fatter mid-range pull, nitro kick, slightly higher top end (never above the 145 m/s server cap)
  if(S.pwr){
    if(o.gas&&v0>=0&&dv>0){
      const P=.10+.30*clamp(1-v0/25,0,1)+.28*Math.exp(-Math.pow((v0-35)/25,2));
      player.speed+=dv*P;
    }
    if(typeof boosting!=='undefined'&&boosting){
      S.bk+=dt;
      const kick=S.bk<.6?9*(1-S.bk/.6):0;
      player.speed+=(kick+2.2)*dt;
      if(S.bk-dt<=0)try{pop('NITRO KICK');}catch(_){}
    }else S.bk=0;
    try{
      const sp=cars[selectedCar],nv=(typeof boosting!=='undefined'&&boosting)?sp.nitro+garageUpgrades.nitro*1.2:0;
      const cap=(sp.top+garageUpgrades.speed*2.5+nv)*(1+(stage-1)*.025)*1.07;
      if(player.speed>cap&&v0<=cap)player.speed=cap;else if(player.speed>cap&&player.speed>v0)player.speed=v0;
    }catch(_){}
    dv=player.speed-v0;
  }
  // progressive brakes + heat / fade
  const braking=o.brake&&!o.gas&&v0>1&&dv<0,bt=braking?1:0;
  S.bp+=(bt-S.bp)*Math.min(1,dt*(bt?7:14));
  const fade=clamp((S.bt-380)/320,0,1);
  if(braking){
    player.speed=v0+dv*(.4+.6*S.bp)*(1-.3*fade);dv=player.speed-v0;
    S.bt+=(-dv/dt)*v0*dt*.09;
  }
  S.bt=Math.max(60,S.bt-(S.bt-60)*dt*(.02+Math.abs(player.speed)*.0012));
  if(S.toastT>0)S.toastT-=dt;
  if(fade>.35&&S.toastT<=0){S.toastT=7;try{pop('BRAKES FADING · EASE OFF');}catch(_){}}
  // counter-steer / power oversteer
  const sl=player.slip,st=steer;
  if(Math.abs(sl)>.2&&Math.abs(st)>.12&&Math.abs(v1)>14){
    if(Math.sign(st)!==Math.sign(sl))player.slip*=1-Math.min(.5,dt*2.4);
    else if(o.gas&&v1>25&&Math.abs(sl)>.25)player.slip=clamp(sl+Math.sign(sl)*dt*.18,-1.2,1.2);
  }
  // squat / dive
  const lon=dv/dt;
  player.pitch+=clamp(-lon*.0006,-.02,.02)*Math.min(1,dt*8);
  if(player.speed>145)player.speed=145;                            // multiplayer safety cap (same as the Pro pack)
}

const _update=update;
update=function(dt){
  let live=false,o=null,v0=0;
  try{
    live=S.on&&running&&!paused&&!finished&&dt>0&&dt<.25;
    if(live){o=_fi();v0=player.speed;prepSteer(dt,o);}else{S.ms=steer;}
  }catch(e){live=false;console.error('ZAYRO DYNAMICS pre',e);}
  S.inUpd=live;
  try{return _update.apply(this,arguments);}
  finally{
    S.inUpd=false;
    if(live){try{post(dt,o,v0);}catch(e){if(!update.err){update.err=1;console.error('ZAYRO DYNAMICS post',e);}}}
  }
};
if(typeof startRace==='function'){
  const _sr=startRace;
  startRace=function(){S.ms=0;S.thr=0;S.bp=0;S.bt=60;S.toastT=0;return _sr.apply(this,arguments);};
}

/* ---- garage switch (re-added if the Pro panel re-renders) */
function addSwitch(){
  try{
    const row=document.querySelector('.zpro-tune .zt-tog');
    if(!row||row.querySelector('#zdynSw')&&row.querySelector('#zpwrSw'))return;
    const b=document.createElement('button');b.type='button';b.id='zdynSw';b.className='zt-switch'+(S.on?' on':'');
    const label=()=>'DYNAMICS+ (REAL CAR FEEL): '+(S.on?'ON':'OFF');
    b.textContent=label();
    b.onclick=e=>{e.stopPropagation();S.on=!S.on;save();b.classList.toggle('on',S.on);b.textContent=label();};
    row.appendChild(b);
    if(!row.querySelector('#zpwrSw')){
      const p=document.createElement('button');p.type='button';p.id='zpwrSw';p.className='zt-switch'+(S.pwr?' on':'');
      const pl=()=>'POWER+ (MORE ENGINE + NITRO KICK): '+(S.pwr?'ON':'OFF');
      p.textContent=pl();
      p.onclick=e=>{e.stopPropagation();S.pwr=!S.pwr;save();p.classList.toggle('on',S.pwr);p.textContent=pl();};
      row.appendChild(p);
    }
  }catch(_){}
}
setInterval(addSwitch,1200);
})();
