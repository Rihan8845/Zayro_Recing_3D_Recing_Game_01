/* ZAYRO MOBILE v1.0 — smartphone pack (loaded first in <head>; base game code untouched)
   - Phone render cap (devicePixelRatio) so GPUs don't choke on 3x/4x screens
   - Auto quality: picks Performance/Balanced on first run, drops to Performance if FPS stays low, battery-saver below 20 %
   - TILT STEERING: hold the phone like a steering wheel (accelerometer), with FLIP + CENTER
   - Haptics: vibration on crash, nitro, finish
   - Camera FX: speed shake, nitro zoom, crash impact (fake-FOV, cheap CSS transform)
   - Screen stays awake while racing, fullscreen + landscape lock, "rotate phone" hint
   - Installable offline app (PWA: manifest + service worker; needs https or localhost)
   Every block is wrapped in try/catch: a failure here can never stop the game. */
(function(){
'use strict';
const LS='zayroMobile';
const coarse=(()=>{try{return matchMedia('(pointer: coarse)').matches;}catch(_){return false;}})();
const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4,lowEnd=mem<=3||cores<=4;

/* ---- 1. render cap: must run before game.js reads devicePixelRatio */
try{
  const d=Object.getOwnPropertyDescriptor(window,'devicePixelRatio');
  if(coarse&&d&&d.get){
    const cap=lowEnd?1.25:(mem<=4?1.5:1.75);
    Object.defineProperty(window,'devicePixelRatio',{configurable:true,get:()=>Math.min(d.get.call(window),cap)});
  }
}catch(e){console.error('ZAYRO MOBILE dpr',e);}

/* ---- settings */
let S={auto:true,haptics:true,camfx:true,autofs:true,compact:true,speedtxt:true};
try{Object.assign(S,JSON.parse(localStorage.getItem(LS)||'{}'));}catch(_){}
const saveS=()=>{try{localStorage.setItem(LS,JSON.stringify(S));}catch(_){}};
const $=id=>document.getElementById(id);
const _gc={};
const g=name=>{let f=_gc[name];if(!f)f=_gc[name]=new Function('try{return '+name+'}catch(e){return undefined}');return f();};   // read game.js globals (let/const) safely, cached
const vib=p=>{if(S.haptics&&navigator.vibrate)try{navigator.vibrate(p);}catch(_){}};
let toastT=0;
function toast(msg){
  const t=$('zmToast');if(!t)return;t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);
}

/* ---- PWA */
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;const b=$('zmInstall');if(b)b.hidden=false;});
try{
  if('serviceWorker' in navigator&&(location.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)))
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}catch(_){}

/* ---- tilt steering */
const T={on:false,flip:/iP(hone|ad|od)/.test(navigator.userAgent),off:0,raw:0,v:0};
function onMotion(e){
  const a=e.accelerationIncludingGravity;if(!a||a.x==null||a.y==null)return;
  const ang=(((screen.orientation&&screen.orientation.angle)||window.orientation||0)%360+360)%360;
  const ar=ang===0?a.x:ang===90?-a.y:ang===180?-a.x:a.y;      // gravity component along the screen's right edge
  let s=-ar/9.81;if(T.flip)s=-s;
  T.raw=s;
  let v=(s-T.off)/.5;v=Math.max(-1,Math.min(1,v));
  if(Math.abs(v)<.08)v=0;
  T.v=T.v*.55+v*.45;
}
async function enableTilt(){
  try{
    if(typeof DeviceMotionEvent==='undefined')throw new Error('nosensor');
    if(typeof DeviceMotionEvent.requestPermission==='function'){const r=await DeviceMotionEvent.requestPermission();if(r!=='granted')throw new Error('denied');}
    window.addEventListener('devicemotion',onMotion);
    T.on=true;T.off=T.raw;
    try{setMode('wheel');}catch(_){}
    toast('TILT ON · hold like a steering wheel');
  }catch(e){T.on=false;toast(e&&e.message==='denied'?'Tilt permission denied':'Tilt sensor unavailable (needs a phone + https)');}
  refresh();
}
function disableTilt(){window.removeEventListener('devicemotion',onMotion);T.on=false;T.v=0;refresh();}

/* ---- fullscreen / landscape / wake lock */
async function goFullscreen(){
  try{
    const el=document.documentElement;
    if(!document.fullscreenElement&&el.requestFullscreen)await el.requestFullscreen({navigationUI:'hide'});
    if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape').catch(()=>{});
  }catch(_){}
  refresh();
}
let wake=null;
async function wakeSync(run){
  try{
    if(run&&!wake&&navigator.wakeLock){wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>{wake=null;});}
    else if(!run&&wake){await wake.release();wake=null;}
  }catch(_){wake=null;}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wakeSync(!!g('running'));});

/* ---- UI */
const ICON={on:'ON',off:'OFF'};
function build(){
  const css=document.createElement('div');
  document.body.insertAdjacentHTML('beforeend',
   '<button id="zmBtn" type="button" aria-label="Mobile and advanced settings" aria-expanded="false">📱</button>'+
   '<aside id="zmPanel" hidden aria-label="ZAYRO mobile pack">'+
     '<div class="zm-head"><b>MOBILE+ PACK</b><button type="button" id="zmClose" aria-label="Close">✕</button></div>'+
     '<div class="zm-row"><span>Auto quality<small>drops graphics if FPS stays low</small></span><button type="button" class="zm-sw" data-k="auto"></button></div>'+
     '<div class="zm-row"><span>Camera FX<small>speed shake · nitro zoom · crash hit</small></span><button type="button" class="zm-sw" data-k="camfx"></button></div>'+
     '<div class="zm-row"><span>Compact HUD<small>phone layout: no overlap with controls</small></span><button type="button" class="zm-sw" data-k="compact"></button></div>'+
     '<div class="zm-row"><span>Speed readout<small>small number, no box (touch mode)</small></span><button type="button" class="zm-sw" data-k="speedtxt"></button></div>'+
     '<div class="zm-row"><span>Haptics<small>vibration on crash / nitro / finish</small></span><button type="button" class="zm-sw" data-k="haptics"></button></div>'+
     '<div class="zm-row"><span>Tilt steering<small>hold phone like a steering wheel</small></span><button type="button" class="zm-sw" id="zmTilt"></button></div>'+
     '<div class="zm-row zm-tiltrow" id="zmTiltRow" hidden><button type="button" id="zmCenter">CENTER</button><button type="button" id="zmFlip">FLIP DIRECTION</button></div>'+
     '<div class="zm-row"><span>Fullscreen · landscape<small>best view on phone</small></span><button type="button" class="zm-act" id="zmFs">GO</button></div>'+
     '<div class="zm-row" id="zmInstallRow"><span>Install as app<small id="zmInstallHint">works offline after first load</small></span><button type="button" class="zm-act" id="zmInstall" hidden>INSTALL</button></div>'+
   '</aside><div id="zmToast" role="status" aria-live="polite"></div><div id="zmSpeed" aria-hidden="true">000<small>KM/H</small></div><div id="zmRotate" aria-hidden="true">↻ ROTATE PHONE · LANDSCAPE IS BEST</div>');
  const btn=$('zmBtn'),panel=$('zmPanel');
  const open=v=>{panel.hidden=!v;btn.setAttribute('aria-expanded',String(v));};
  btn.addEventListener('click',()=>open(panel.hidden));
  $('zmClose').addEventListener('click',()=>open(false));
  panel.querySelectorAll('.zm-sw[data-k]').forEach(b=>b.addEventListener('click',()=>{S[b.dataset.k]=!S[b.dataset.k];saveS();refresh();if(b.dataset.k==='haptics'&&S.haptics)vib(40);}));
  $('zmTilt').addEventListener('click',()=>{T.on?disableTilt():enableTilt();});
  $('zmCenter').addEventListener('click',()=>{T.off=T.raw;toast('Tilt centred');});
  $('zmFlip').addEventListener('click',()=>{T.flip=!T.flip;T.off=0;setTimeout(()=>{T.off=T.raw;},120);toast('Direction flipped · centre again if needed');});
  $('zmFs').addEventListener('click',goFullscreen);
  $('zmInstall').addEventListener('click',async()=>{if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice;}catch(_){}installEvt=null;$('zmInstall').hidden=true;});
  if(/iP(hone|ad|od)/.test(navigator.userAgent)&&!window.navigator.standalone)$('zmInstallHint').textContent='iPhone: Share → Add to Home Screen';
  if(navigator.standalone||matchMedia('(display-mode: standalone)').matches)$('zmInstallRow').hidden=true;
  refresh();
}
function refresh(){
  document.querySelectorAll('.zm-sw[data-k]').forEach(b=>{const on=!!S[b.dataset.k];b.textContent=on?ICON.on:ICON.off;b.classList.toggle('on',on);});
  const t=$('zmTilt');if(t){t.textContent=T.on?ICON.on:ICON.off;t.classList.toggle('on',T.on);}
  const r=$('zmTiltRow');if(r)r.hidden=!T.on;
}

/* ---- realistic steering wheel: D-shaped racing wheel, grab-and-turn, spring return with a little overshoot */
const WH={ang:0,vel:0,touching:false,pid:null,lastA:0,LOCK:200,FULL:110};
function polar(r,deg){const a=(deg-90)*Math.PI/180;return [100+r*Math.cos(a),100+r*Math.sin(a)];}
function arcPath(r,d0,d1){const a=polar(r,d0),b=polar(r,d1);return `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} A ${r} ${r} 0 ${Math.abs(d1-d0)>180?1:0} 1 ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;}
function wheelSVG(){
  const rim='M 57.3 170 A 82 82 0 1 1 142.7 170 Z';
  return '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">'+
  '<defs>'+
   '<linearGradient id="zwRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#343b40"/><stop offset=".45" stop-color="#171b1e"/><stop offset="1" stop-color="#090b0c"/></linearGradient>'+
   '<linearGradient id="zwMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6ebee"/><stop offset=".5" stop-color="#7d868c"/><stop offset="1" stop-color="#cfd5d9"/></linearGradient>'+
   '<pattern id="zwCarbon" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#121517"/><rect width="3" height="3" fill="#252a2e"/><rect x="3" y="3" width="3" height="3" fill="#252a2e"/></pattern>'+
   '<radialGradient id="zwHub" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#4d555b"/><stop offset=".55" stop-color="#171b1d"/><stop offset="1" stop-color="#08090a"/></radialGradient>'+
  '</defs>'+
  // paddle shifters behind the rim
  '<path d="M 12 62 Q 2 100 12 138 L 21 133 Q 14 100 21 67 Z" fill="url(#zwMetal)" stroke="#0a0c0d" stroke-width="1"/>'+
  '<path d="M 188 62 Q 198 100 188 138 L 179 133 Q 186 100 179 67 Z" fill="url(#zwMetal)" stroke="#0a0c0d" stroke-width="1"/>'+
  // rim: dark edge, leather body, inner highlight, stitching
  `<path d="${rim}" fill="none" stroke="#000" stroke-width="27" stroke-linejoin="round" opacity=".55"/>`+
  `<path d="${rim}" fill="none" stroke="url(#zwRim)" stroke-width="22" stroke-linejoin="round"/>`+
  `<path d="${rim}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="2" transform="translate(100 100) scale(.9) translate(-100 -100)"/>`+
  `<path d="${rim}" fill="none" stroke="#8c969c" stroke-opacity=".75" stroke-width="1.1" stroke-dasharray="3 3.4" stroke-linejoin="round"/>`+
  // perforated grips at 9 and 3 o'clock
  `<path d="${arcPath(82,236,300)}" fill="none" stroke="#2a3034" stroke-width="22" stroke-linecap="round"/>`+
  `<path d="${arcPath(82,236,300)}" fill="none" stroke="#69737a" stroke-width="14" stroke-dasharray="1.4 3.6"/>`+
  `<path d="${arcPath(82,60,124)}" fill="none" stroke="#2a3034" stroke-width="22" stroke-linecap="round"/>`+
  `<path d="${arcPath(82,60,124)}" fill="none" stroke="#69737a" stroke-width="14" stroke-dasharray="1.4 3.6"/>`+
  // 12 o'clock centre marker
  '<rect x="96.5" y="6" width="7" height="24" rx="1.5" fill="#ffd23a" stroke="#0a0c0d" stroke-width="1.5"/>'+
  // three carbon spokes
  '<path d="M 70 90 L 24 96 L 24 116 L 70 118 Z" fill="url(#zwCarbon)" stroke="url(#zwMetal)" stroke-width="1.6" stroke-linejoin="round"/>'+
  '<path d="M 130 90 L 176 96 L 176 116 L 130 118 Z" fill="url(#zwCarbon)" stroke="url(#zwMetal)" stroke-width="1.6" stroke-linejoin="round"/>'+
  '<path d="M 88 128 L 112 128 L 116 164 L 84 164 Z" fill="url(#zwCarbon)" stroke="url(#zwMetal)" stroke-width="1.6" stroke-linejoin="round"/>'+
  // hub
  '<circle cx="100" cy="102" r="34" fill="url(#zwHub)" stroke="url(#zwMetal)" stroke-width="2"/>'+
  '<circle cx="100" cy="102" r="27" fill="none" stroke="#d8ff38" stroke-opacity=".75" stroke-width="1.3"/>'+
  '<path d="M 87 92 H 113 L 97 112 H 113 V 118 H 87 L 103 98 H 87 Z" fill="#f5d47d"/>'+
  '<circle cx="78" cy="122" r="4.4" fill="#d8231f" stroke="#000" stroke-width="1"/>'+
  '<circle cx="122" cy="122" r="4.4" fill="#1f7ee0" stroke="#000" stroke-width="1"/>'+
  '<ellipse cx="88" cy="84" rx="16" ry="6" fill="#fff" opacity=".10"/>'+
  '</svg>';
}
function setupWheel(){
  const w=$('steeringWheel');if(!w||w.dataset.zmWheel)return;w.dataset.zmWheel='1';
  w.innerHTML=wheelSVG();w.setAttribute('role','slider');w.setAttribute('aria-label','Steering wheel');
  const ang=e=>{const r=w.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);return {a:Math.atan2(dy,dx),d:Math.hypot(dx,dy),r:r.width/2};};
  const eat=e=>{e.stopImmediatePropagation();};
  w.addEventListener('pointerdown',e=>{eat(e);e.preventDefault();WH.touching=true;WH.pid=e.pointerId;try{w.setPointerCapture(e.pointerId);}catch(_){}WH.lastA=ang(e).a;WH.vel=0;w.classList.add('grab');},true);
  w.addEventListener('pointermove',e=>{
    eat(e);if(!WH.touching||e.pointerId!==WH.pid)return;
    const m=ang(e);if(m.d<m.r*.22)return;                       // too close to the hub: angle is unstable
    let d=m.a-WH.lastA;if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;
    WH.ang=Math.max(-WH.LOCK,Math.min(WH.LOCK,WH.ang+d*180/Math.PI));WH.lastA=m.a;
  },true);
  for(const ev of ['pointerup','pointercancel','lostpointercapture','pointerleave']){
    w.addEventListener(ev,e=>{eat(e);if(ev==='pointerleave'&&WH.touching)return;WH.touching=false;WH.pid=null;w.classList.remove('grab');},true);
  }
}
let wLast=performance.now();
function wheelStep(now){
  const dt=Math.min(.05,Math.max(0,(now-wLast)/1000));wLast=now;
  const w=$('steeringWheel');if(!w)return;
  if(T.on){WH.ang+=(Math.max(-WH.LOCK,Math.min(WH.LOCK,T.v*WH.FULL))-WH.ang)*Math.min(1,dt*16);WH.vel=0;}
  else if(!WH.touching){
    const k=150,c=15;WH.vel+=(-k*WH.ang-c*WH.vel)*dt;WH.ang+=WH.vel*dt;
    if(Math.abs(WH.ang)<.05&&Math.abs(WH.vel)<.4){WH.ang=0;WH.vel=0;}
  }
  const tc=g('touch');if(tc)tc.wheel=Math.max(-1,Math.min(1,WH.ang/WH.FULL));
  if(w.offsetParent!==null)w.style.transform=`rotate(${WH.ang.toFixed(1)}deg)`;
  w.setAttribute('aria-valuenow',String(Math.round(WH.ang)));
}

/* ---- main loop: haptics + camera FX + wake lock + body flags */
let lastCrash=0,wasBoost=false,impulse=0,runningPrev=false,t0=performance.now();
function loop(now){
  try{wheelStep(now);}catch(_){}
  try{const cp=!!(S.compact&&coarse);if(cp!==loop.cp){loop.cp=cp;document.body.classList.toggle('zm-compact',cp);}}catch(_){}
  try{const dr=!!g('running')&&!g('paused')&&!g('finished');if(dr!==loop.dr){loop.dr=dr;document.body.classList.toggle('zm-drive',dr);}}catch(_){}
  try{const m=g('mode'),tu=!!loop.dr&&(m==='wheel'||m==='touch');if(tu!==loop.tu){loop.tu=tu;document.body.classList.toggle('zm-touchui',tu);}}catch(_){}
  try{document.body.classList.toggle('zm-speed',!!S.speedtxt);if(loop.tu){const sp=Math.round(Math.abs((g('player')||{}).speed||0)*3.6);if(sp!==loop.sp){loop.sp=sp;const e=$('zmSpeed');if(e)e.firstChild.nodeValue=String(sp).padStart(3,'0');}}}catch(_){}
  try{const nb=loop.nb||(loop.nb=document.querySelector('.touch-controls [data-control="boost"] .zm-nbar b'));if(nb){const n=Math.max(0,Math.min(100,Math.round(g('nitro')||0)));if(n!==loop.n){loop.n=n;nb.style.width=n+'%';nb.parentElement.classList.toggle('low',n<25);}}}catch(_){}
  try{
    const run=!!g('running'),paused=!!g('paused'),p=g('player');
    if(run!==runningPrev){runningPrev=run;document.body.classList.toggle('zm-run',run);wakeSync(run);if(run){lastCrash=g('crashCount')||0;}}
    const cv=$('game');
    if(run&&!paused&&p&&cv){
      const cc=g('crashCount')||0;
      if(cc>lastCrash){impulse=1;vib([70,30,120]);}
      lastCrash=cc;
      const boost=!!g('boosting');
      if(boost&&!wasBoost)vib(28);
      wasBoost=boost;
      if(S.camfx){
        const sp=Math.abs(p.speed||0),k=Math.max(0,(sp-48)/42),tt=now/1000;
        impulse*=.9;
        const amp=k*1.1+impulse*9;
        const dx=(Math.sin(tt*37)+Math.sin(tt*23.3))*.5*amp,dy=(Math.sin(tt*41.7)+Math.cos(tt*29))*.5*amp*.7;
        const sc=1.012+(boost?.028:0)+k*.012+impulse*.02;
        cv.style.transform=`translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) scale(${sc.toFixed(4)})`;
      }else if(cv.style.transform)cv.style.transform='';
    }else if(cv&&cv.style.transform)cv.style.transform='';
  }catch(_){}
  requestAnimationFrame(loop);
}

/* ---- auto quality governor + battery saver */
function setQuality(q,msg){
  const b=document.querySelector(`[data-graphics="${q}"]`);
  if(b){b.click();if(msg)toast(msg);}
}
let low=0;
function governor(){
  try{
    if(!S.auto||!g('running')||g('paused'))return;
    const fps=g('displayedFPS'),q=g('graphicsQuality');
    if(typeof fps!=='number')return;
    low=fps<30?low+1:Math.max(0,low-1);
    if(low>=5&&q!=='performance'){low=0;setQuality('performance','AUTO · PERFORMANCE MODE for smoother play');}
  }catch(_){}
}
function boot(){
  build();
  try{setupWheel();}catch(e){console.error('ZAYRO MOBILE wheel',e);}
  try{const bb=document.querySelector('.touch-controls [data-control="boost"]');if(bb&&!bb.querySelector('.zm-nbar'))bb.insertAdjacentHTML('beforeend','<i class="zm-nbar"><b></b></i>');}catch(_){}
  requestAnimationFrame(loop);
  setInterval(governor,1000);
  // first-run quality tier for phones
  try{if(coarse&&!localStorage.getItem('apexGraphics'))setQuality(lowEnd?'performance':'balanced');}catch(_){}
  try{if(navigator.getBattery)navigator.getBattery().then(b=>{if(S.auto&&b.level<.2&&!b.charging&&g('graphicsQuality')!=='performance')setQuality('performance','BATTERY SAVER · PERFORMANCE MODE');});}catch(_){}
  // finish haptics (chain after the other finish wrappers)
  try{
    const fs=window.finishStage;
    if(typeof fs==='function')window.finishStage=function(){const was=g('finished');fs.apply(this,arguments);if(!was&&g('finished'))vib([40,60,40,60,200]);};
  }catch(_){}
  // auto fullscreen when the player taps START on a phone
  const sb=$('startButton');
  if(sb&&coarse)sb.addEventListener('click',()=>{if(S.autofs)goFullscreen();},{passive:true});
}
window.addEventListener('load',boot,{once:true});
if(window.__ZR_MOBILE_TEST)window.__ZR_MOBILE_TEST.T=T;
})();
