'use strict';
/* ZAYRO REWARDS v1.0 — Winner rewards, unlocks and the Victory Rewards screen.
   Loads after zayro_certificate.js (base game code untouched; small opt-in hooks were added to zayro_extra/legend/plus).
   - Listens for zayro:result (zayro_results.js). Only FINISHERS are rewarded; DNF gets nothing.
   - Reward size depends on finishing position, stage difficulty, race event, career difficulty, online vs offline and race performance.
   - Each race has a unique result id and is claimed once (duplicate claims are impossible, also across tabs).
   - Everything is saved permanently in localStorage (zayroRewards + the existing credits / upgrades / car-ownership keys),
     and is included in the driver-save export / import.
   Wrapped in try/catch: a failure here can never stop the game. */
(function(){
const KEY='zayroRewards';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R=window.ZAYRO_REWARDS={};
const BASE_COINS=[0,1000,600,350,150];     // index = finishing place (4 = 4th and below)
const BASE_XP=[0,220,140,90,60];
const SKINS={
  victory_gold:{name:'Victory Gold',hex:'#f2c14e',swatch:'#f2c14e',how:'Win your first race'},
  silver_arrow:{name:'Silver Arrow',hex:'#aab4c0',swatch:'#aab4c0',how:'Finish 2nd for the first time'},
  bronze_blaze:{name:'Bronze Blaze',hex:'#b8733a',swatch:'#b8733a',how:'Finish 3rd for the first time'},
  carbon_racing:{name:'Carbon Racing',hex:'#14161b',swatch:'#2a2d35',how:'Win Stage 4'},
  champion_chrome:{name:'Champion Chrome',hex:'#d5dde8',swatch:'#d5dde8',how:'Win Stage 5'},
  neon_pulse:{name:'Neon Pulse',hex:'#12f0cf',swatch:'#12f0cf',how:'Win 10 races'}
};
const CARS={5:{name:'Phantom GT',dupe:900},6:{name:'Solar Titan',dupe:1800},7:{name:'Stratos Zero',dupe:3000}};
const ACH=[
  {id:'first_win',name:'First Victory',desc:'Win a race',cr:300,t:s=>s.wins>=1},
  {id:'podium5',name:'Podium Regular',desc:'5 podium finishes',cr:300,t:s=>s.podiums>=5},
  {id:'wins10',name:'Ten Wins',desc:'Win 10 races',cr:800,t:s=>s.wins>=10},
  {id:'clean_win',name:'Clean Sweep',desc:'Win with zero crashes',cr:400,t:(s,r)=>r.position===1&&r.crashes===0},
  {id:'underdog',name:'Survivor Winner',desc:'Win after 2 crashes',cr:350,t:(s,r)=>r.position===1&&r.crashes>=2},
  {id:'all_stages',name:'Grand Slam',desc:'Win every stage 1-5',cr:1500,t:s=>[1,2,3,4,5].every(n=>s.firstWins[n])},
  {id:'online_win',name:'Online Champion',desc:'Win an online race',cr:600,t:(s,r)=>r.mode==='multi'&&r.position===1},
  {id:'online5',name:'Road Warrior',desc:'Finish 5 online races',cr:500,t:s=>s.onlineRaces>=5},
  {id:'legend_win',name:'Legend Slayer',desc:'Win a race on LEGEND',cr:700,t:(s,r)=>r.position===1&&r.difficulty==='legend'},
  {id:'collector',name:'Garage Collector',desc:'Unlock a reward car',cr:500,t:s=>s.cars.length>=1}
];
R.SKINS=SKINS;R.ACH=ACH;R.CARS=CARS;

/* ------------------------------------------------------------------ state */
function blank(){return {v:1,claimed:[],wins:0,podiums:0,races:0,onlineRaces:0,trophies:{gold:0,silver:0,bronze:0},bestPlace:{},firstWins:{},cars:[],skins:[],ach:{},seconds:0,thirds:0,history:[]};}
function load(){
  try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&typeof x==='object'){const b=blank();for(const k of Object.keys(b))if(x[k]!==undefined&&typeof x[k]===typeof b[k])b[k]=x[k];
    if(!Array.isArray(b.claimed))b.claimed=[];return b;}}catch(_){}
  return blank();
}
function save(st){try{localStorage.setItem(KEY,JSON.stringify(st));return true;}catch(_){return false;}}
try{if(typeof PROFILE_SAVE_KEYS!=='undefined'&&!PROFILE_SAVE_KEYS.includes(KEY))PROFILE_SAVE_KEYS.push(KEY);}catch(_){}
R.load=load;

/* ------------------------------------------------------------------ pure reward planning (unit-testable) */
const round10=n=>Math.max(10,Math.round(n/10)*10);
function plan(res,st,ctx){
  ctx=ctx||{};
  const out={coins:0,xp:0,items:[],place:res.position,tier:null,performance:[]};
  const stageN=Math.max(1,Math.min(5,res.stage|0||1));
  const stageMult=1+.4*(stageN-1),eventMult=res.event==='sprint'?.7:1,modeMult=res.mode==='multi'?1.25:1;
  const diffMult=(ctx.diffMult!=null?ctx.diffMult:1);
  const perfPct=[];
  if(res.crashes===0){perfPct.push(.15);out.performance.push('CLEAN RACE +15%');}
  if(res.parTime&&res.timeSec<=res.parTime){perfPct.push(.10);out.performance.push('BEAT PAR TIME +10%');}
  const nm=Math.min(.10,(res.nearMisses||0)*.01);if(nm>0){perfPct.push(nm);out.performance.push('NEAR MISSES +'+Math.round(nm*100)+'%');}
  const perf=perfPct.reduce((a,b)=>a+b,0);

  if(!Number.isInteger(res.position)){
    // Time trial (no rivals): coins by par-time medal, no trophies / unlocks
    const gold=res.timeSec<=res.parTime;
    out.coins=round10((gold?300:150)*stageMult*diffMult*(1+perf));out.xp=Math.round((gold?80:40)*stageMult);out.tier=gold?'gold':'silver';
    out.items.push({type:'coins',amount:out.coins});
    return out;
  }
  const place=Math.min(4,res.position);
  out.tier=place===1?'gold':place===2?'silver':place===3?'bronze':'steel';
  out.coins=round10(BASE_COINS[place]*stageMult*eventMult*modeMult*diffMult*(1+perf));
  out.xp=Math.round(BASE_XP[place]*stageMult*(res.mode==='multi'?1.2:1));
  out.items.push({type:'coins',amount:out.coins});
  const next={wins:st.wins+(place===1?1:0),podiums:st.podiums+(place<=3?1:0),seconds:st.seconds+(place===2?1:0),thirds:st.thirds+(place===3?1:0)};
  const hasSkin=id=>st.skins.includes(id)||out.items.some(i=>i.type==='skin'&&i.id===id);
  const addSkin=id=>{if(!hasSkin(id))out.items.push({type:'skin',id,name:SKINS[id].name,hex:SKINS[id].hex});};
  const upgradeLevels=Object.assign({speed:0,grip:0,nitro:0,brakes:0,suspension:0},ctx.upgrades||{});
  const maxLvl=ctx.upgradeMax||5;
  const addUpgrade=(kind,label)=>{
    if((upgradeLevels[kind]||0)<maxLvl){upgradeLevels[kind]=(upgradeLevels[kind]||0)+1;out.items.push({type:'upgrade',kind,level:upgradeLevels[kind],label});}
    else out.items.push({type:'convert',amount:300,label:label+' (already max)'});
  };
  const premiumKind=()=>['speed','grip','brakes','suspension'].filter(k=>(upgradeLevels[k]||0)<maxLvl).sort((a,b)=>(upgradeLevels[a]||0)-(upgradeLevels[b]||0))[0]||null;
  const addCar=id=>{
    const owned=ctx.ownsCar?ctx.ownsCar(id):st.cars.includes(id);
    if(owned||st.cars.includes(id))out.items.push({type:'convert',amount:CARS[id].dupe,label:CARS[id].name+' (already owned)'});
    else out.items.push({type:'car',id,name:CARS[id].name});
  };
  out.trophy=place<=3?place:0;
  if(place<=3)out.items.push({type:'trophy',tier:out.tier,stage:stageN,label:(place===1?'STAGE '+stageN+' WINNER':'STAGE '+stageN+' PODIUM')});
  if(place===1){
    if(next.wins===1)addSkin('victory_gold');
    if(!st.firstWins[stageN]){
      if(stageN===2)addUpgrade('nitro',"WINNER'S NITRO KIT");
      if(stageN===3)addCar(5);
      if(stageN===4){addCar(6);addSkin('carbon_racing');}
      if(stageN===5){addSkin('champion_chrome');if(res.difficulty!=='rookie')addCar(7);else out.note='Win Stage 5 on PRO or LEGEND to unlock the Stratos Zero.';}
    }
    if(next.wins%2===0)addUpgrade('nitro','NITRO UPGRADE');
    if(next.wins%3===0){const k=premiumKind();if(k)addUpgrade(k,'PREMIUM '+k.toUpperCase()+' UPGRADE');else out.items.push({type:'convert',amount:300,label:'PREMIUM UPGRADE (all maxed)'});}
    if(next.wins===10)addSkin('neon_pulse');
  }else if(place===2){
    if(next.seconds===1)addSkin('silver_arrow');
    if(next.podiums%4===0){const k=premiumKind();if(k)addUpgrade(k,'PODIUM '+k.toUpperCase()+' UPGRADE');}
  }else if(place===3){
    if(next.thirds===1)addSkin('bronze_blaze');
  }
  return out;
}
R.plan=plan;

/* ------------------------------------------------------------------ applying (side effects) */
function ctxNow(){
  let diffMult=1;try{diffMult=difficultyInfo[difficulty].reward;}catch(_){}
  let up={},max=5;try{up=garageUpgrades;max=upgradeInfo.speed.max;}catch(_){}
  return {diffMult,upgrades:up,upgradeMax:max,ownsCar:id=>{try{if(id===7)return !!(window.__zrLegendCar&&window.__zrLegendCar.owns());return !!(window.__zrBonusCars&&window.__zrBonusCars.owns(id));}catch(_){return false;}}};
}
function addCoins(n){
  n=Math.round(n);if(!(n>0))return;
  credits+=n;try{careerStats.creditsEarned+=n;saveCareerStats();}catch(_){}
  try{localStorage.setItem('apexCredits',String(credits));}catch(_){}
  try{refreshGarage();}catch(_){}
}
function registerSkin(id){
  const s=SKINS[id];if(!s)return;
  try{if(!paintChoices.some(x=>x.id===id))paintChoices.push({id,name:s.name,hex:s.hex,swatch:s.swatch});}catch(_){}
}
function applyItem(it,st){
  try{
    switch(it.type){
      case 'coins':case 'convert':addCoins(it.amount);break;
      case 'trophy':st.trophies[it.tier]=(st.trophies[it.tier]||0)+1;break;
      case 'skin':if(!st.skins.includes(it.id))st.skins.push(it.id);registerSkin(it.id);break;
      case 'upgrade':{
        if(garageUpgrades[it.kind]<upgradeInfo[it.kind].max){garageUpgrades[it.kind]++;localStorage.setItem('apexUpgrades',JSON.stringify(garageUpgrades));try{refreshGarage();}catch(_){}}
        break;}
      case 'car':{
        let r='invalid';
        if(it.id===7&&window.__zrLegendCar)r=window.__zrLegendCar.grant();
        else if(window.__zrBonusCars)r=window.__zrBonusCars.grant(it.id);
        if(r==='new'||r==='owned'){if(!st.cars.includes(it.id))st.cars.push(it.id);}
        else{addCoins(CARS[it.id].dupe);it.type='convert';it.amount=CARS[it.id].dupe;it.label=CARS[it.id].name+' (could not unlock - converted to coins)';}
        break;}
    }
  }catch(e){console.error('ZAYRO REWARDS item',it,e);}
}
/* Claim a result exactly once. Returns the summary to display, or null if already claimed / not eligible. */
R.claim=function(res){
  if(!res||res.status!=='ready'||!res.id)return null;
  const st=load();
  if(st.claimed.includes(res.id))return null;                  // duplicate claim
  st.claimed.push(res.id);if(st.claimed.length>400)st.claimed.splice(0,st.claimed.length-400);
  save(st);                                                    // mark claimed FIRST so a crash can never double-pay
  const p=plan(res,st,ctxNow());
  for(const it of p.items)applyItem(it,st);
  st.races++;if(res.mode==='multi')st.onlineRaces++;
  if(Number.isInteger(res.position)){
    const place=Math.min(4,res.position);
    if(place===1){st.wins++;st.firstWins[res.stage]=st.firstWins[res.stage]||Date.now();}
    if(place===2)st.seconds++;if(place===3)st.thirds++;
    if(place<=3)st.podiums++;
    const best=st.bestPlace[res.stage];if(!best||res.position<best)st.bestPlace[res.stage]=res.position;
  }
  // achievements (after the counters are updated)
  const ach=[];
  for(const a of ACH){
    if(st.ach[a.id])continue;let ok=false;try{ok=a.t(st,res);}catch(_){}
    if(ok){st.ach[a.id]=Date.now();ach.push(a);addCoins(a.cr);}
  }
  st.history.push({id:res.id,stage:res.stage,pos:res.position,mode:res.mode,coins:p.coins,t:Date.now()});if(st.history.length>40)st.history.splice(0,st.history.length-40);
  save(st);
  if(p.xp>0){try{window.__zrPlus&&window.__zrPlus.addXP(p.xp);}catch(_){}}
  try{renderCabinet();}catch(_){}
  return {plan:p,ach,state:st,result:res};
};

/* ------------------------------------------------------------------ Victory Rewards screen */
let confettiRaf=0,revealTimers=[];
const reduceMotion=()=>{try{return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}};
function blip(freq,dur,type,vol){
  try{if(typeof audio==='undefined'||!audio||audio.state==='closed')return;const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type=type||'triangle';o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol||.05,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+dur+.02);}catch(_){}
}
const fanfare=tier=>{const seq=tier==='gold'?[523,659,784,1047]:tier==='silver'?[494,622,740]:[440,554,659];seq.forEach((f,i)=>setTimeout(()=>blip(f,.28,'triangle',.05),i*130));};
function buildOverlay(){
  if($('zrVictory'))return $('zrVictory');
  const el=document.createElement('div');el.id='zrVictory';el.className='zrv zrv-hidden';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Victory rewards');
  el.innerHTML='<canvas id="zrvConfetti" aria-hidden="true"></canvas><div class="zrv-rays" aria-hidden="true"></div><div class="zrv-card" id="zrvCard"></div>';
  document.body.appendChild(el);
  document.addEventListener('keydown',e=>{if(!el.classList.contains('zrv-hidden')&&(e.key==='Escape'||e.key==='Enter')){e.preventDefault();e.stopPropagation();closeOverlay();}},true);
  return el;
}
function closeOverlay(){
  const el=$('zrVictory');if(!el||el.classList.contains('zrv-hidden'))return;
  revealTimers.forEach(clearTimeout);revealTimers=[];cancelAnimationFrame(confettiRaf);
  el.classList.add('zrv-hidden');
}
function confetti(tier){
  const c=$('zrvConfetti');if(!c||reduceMotion())return;
  const ctx=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;
  const pal=tier==='gold'?['#ffe08a','#f2c14e','#fff3c4','#ff7a3d','#35e0ff']:tier==='silver'?['#ffffff','#c8d0da','#8fa0b4','#35e0ff']:tier==='bronze'?['#f0b27c','#b8733a','#ffd9b0']:['#9fd0ff','#5d7a96','#ffffff'];
  const n=tier==='steel'?50:tier==='gold'?170:110,P=[];
  for(let i=0;i<n;i++)P.push({x:Math.random()*c.width,y:-20-Math.random()*c.height*.6,vx:(Math.random()-.5)*2.2,vy:2+Math.random()*3.4,s:5+Math.random()*7,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,c:pal[i%pal.length]});
  const t0=performance.now();
  (function loop(now){
    const age=now-t0;ctx.clearRect(0,0,c.width,c.height);
    for(const p of P){p.x+=p.vx+Math.sin(now/400+p.s);p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.globalAlpha=Math.max(0,1-age/5200);ctx.fillRect(-p.s/2,-p.s/3,p.s,p.s*.6);ctx.restore();}
    if(age<5200&&!$('zrVictory').classList.contains('zrv-hidden'))confettiRaf=requestAnimationFrame(loop);else ctx.clearRect(0,0,c.width,c.height);
  })(t0);
}
const ICON={coins:'🪙',trophy:'🏆',car:'🏎️',upgrade:'⚙️',skin:'🎨',achievement:'⭐',convert:'🪙',xp:'✦'};
function cardFor(it){
  switch(it.type){
    case 'trophy':return {cls:'trophy t-'+it.tier,k:'TROPHY',n:it.label,s:it.tier.toUpperCase()+' CUP · STAGE '+String(it.stage).padStart(2,'0'),i:ICON.trophy};
    case 'car':return {cls:'car',k:'NEW CAR UNLOCKED',n:it.name,s:'Added to your garage',i:ICON.car,unlock:true};
    case 'upgrade':return {cls:'upgrade',k:'FREE UPGRADE',n:it.label,s:it.kind.toUpperCase()+' · NOW LEVEL '+it.level,i:it.kind==='nitro'?'🚀':ICON.upgrade};
    case 'skin':return {cls:'skin',k:'NEW SKIN UNLOCKED',n:it.name,s:'Pick it in CUSTOM PAINT',i:ICON.skin,swatch:it.hex,unlock:true};
    case 'convert':return {cls:'coins',k:'BONUS COINS',n:'+'+it.amount.toLocaleString()+' CR',s:it.label||'',i:ICON.convert};
    case 'achievement':return {cls:'ach',k:'ACHIEVEMENT',n:it.name,s:it.desc+' · +'+it.cr+' CR',i:ICON.achievement,unlock:true};
    default:return null;
  }
}
function showVictory(sum){
  const res=sum.result,p=sum.plan,el=buildOverlay(),card=$('zrvCard');
  const pos=res.position,tier=p.tier||'steel';
  const solo=!Number.isInteger(pos);
  const headline=solo?(tier==='gold'?'GOLD RUN':'RUN COMPLETE'):pos===1?'VICTORY!':pos===2?'SO CLOSE!':pos===3?'ON THE PODIUM!':'RACE COMPLETE';
  const items=p.items.filter(i=>i.type!=='coins').map(cardFor).filter(Boolean);
  sum.ach.forEach(a=>{const c=cardFor({type:'achievement',name:a.name,desc:a.desc,cr:a.cr});if(c)items.push(c);});
  const unlocks=items.filter(c=>c.unlock);
  const ord=solo?'—':(window.ZAYRO_RESULTS?window.ZAYRO_RESULTS.ordinal(pos):pos+'');
  const meta=[res.stageName?('STAGE '+String(res.stage).padStart(2,'0')+' · '+res.stageName.toUpperCase()):'',res.timeText?('TIME '+res.timeText):'',(res.mode==='multi'?'ONLINE · '+res.total+' DRIVERS':(solo?'TIME TRIAL':'VS '+(res.total-1)+' AI RIVALS')),res.verified?'✔ SERVER VERIFIED':''].filter(Boolean);
  card.className='zrv-card tier-'+tier;
  card.innerHTML=
    '<div class="zrv-kicker">'+esc(meta.join('  ·  '))+'</div>'+
    '<div class="zrv-place" aria-label="'+(solo?'Time trial':'Finished '+ord)+'"><b>'+(solo?'★':esc(ord.replace(/[A-Z]+$/,'')))+'</b><sup>'+(solo?'':esc(ord.replace(/^\d+/,'')))+'</sup><em>'+(solo?'TIME TRIAL':'PLACE')+'</em></div>'+
    '<div class="zrv-cup" aria-hidden="true"><i></i></div>'+
    '<h2 class="zrv-title">'+headline+'</h2>'+
    '<div class="zrv-coins"><small>BONUS COINS</small><b id="zrvCoins">+0</b><span>CR</span></div>'+
    (p.performance.length?'<div class="zrv-perf">'+p.performance.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':'')+
    '<div class="zrv-grid" id="zrvGrid" aria-live="polite"></div>'+
    (p.note?'<div class="zrv-note">'+esc(p.note)+'</div>':'')+
    '<div class="zrv-xp">+'+p.xp+' DRIVER XP</div>'+
    '<div class="zrv-actions"><button type="button" class="zrv-skip" id="zrvSkip">SKIP ANIMATION</button><button type="button" class="zrv-go" id="zrvContinue" hidden>CONTINUE ↗</button></div>';
  el.classList.remove('zrv-hidden');
  const total=p.coins,coinEl=$('zrvCoins'),grid=$('zrvGrid'),cont=$('zrvContinue'),skip=$('zrvSkip');
  let done=false;
  const finish=()=>{if(done)return;done=true;revealTimers.forEach(clearTimeout);revealTimers=[];coinEl.textContent='+'+total.toLocaleString();grid.innerHTML=items.map((c,i)=>cardHtml(c,i,true)).join('');skip.hidden=true;cont.hidden=false;cont.focus();};
  cont.onclick=closeOverlay;skip.onclick=finish;
  fanfare(tier);confetti(tier);
  if(reduceMotion()){finish();return;}
  // coin counter
  const t0=performance.now(),dur=1300;
  (function tick(now){if(done)return;const k=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-k,3);coinEl.textContent='+'+Math.round(total*e).toLocaleString();if(k<1)requestAnimationFrame(tick);})(t0);
  // reveal rewards one by one
  items.forEach((c,i)=>{revealTimers.push(setTimeout(()=>{if(done)return;grid.insertAdjacentHTML('beforeend',cardHtml(c,i,false));blip(c.unlock?880:660,.18,'sine',.045);if(c.unlock)blip(1175,.3,'triangle',.04);},1500+i*650));});
  revealTimers.push(setTimeout(finish,1500+items.length*650+700));
}
function cardHtml(c,i,instant){
  return '<div class="zrv-item '+c.cls+(c.unlock?' is-unlock':'')+(instant?' instant':'')+'" style="animation-delay:'+(instant?0:0)+'ms">'+
    (c.unlock?'<span class="zrv-new">NEW</span>':'')+
    '<div class="zrv-ico">'+(c.swatch?'<i class="zrv-sw" style="background:'+esc(c.swatch)+'"></i>':c.i)+'</div>'+
    '<small>'+esc(c.k)+'</small><b>'+esc(c.n)+'</b><span>'+esc(c.s||'')+'</span></div>';
}
R.showVictory=showVictory;R.closeVictory=closeOverlay;

/* ------------------------------------------------------------------ Garage: Winner's Cabinet */
function renderCabinet(){
  const host=$('zrCabinet');if(!host)return;
  const st=load();
  const cups=[1,2,3,4,5].map(n=>{const bp=st.bestPlace[n];const t=bp===1?'gold':bp===2?'silver':bp===3?'bronze':bp?'steel':'none';return '<span class="zrc-cup t-'+t+'" title="Stage '+n+': '+(bp?'best finish '+bp:'not raced yet')+'"><i>'+(t==='none'?'·':'🏆')+'</i><small>S'+n+'</small></span>';}).join('');
  const carNames=st.cars.map(id=>CARS[id]?CARS[id].name:'').filter(Boolean);
  const skins=Object.keys(SKINS).map(id=>{const own=st.skins.includes(id);return '<span class="zrc-skin '+(own?'own':'')+'" title="'+esc(SKINS[id].name+(own?'':' — '+SKINS[id].how))+'"><i style="background:'+(own?SKINS[id].swatch:'#222')+'"></i><small>'+(own?esc(SKINS[id].name):'LOCKED')+'</small></span>';}).join('');
  const gotAch=ACH.filter(a=>st.ach[a.id]).length;
  host.innerHTML=
    '<div class="zrc-stats"><div><small>WINS</small><b>'+st.wins+'</b></div><div><small>PODIUMS</small><b>'+st.podiums+'</b></div><div><small>RACES</small><b>'+st.races+'</b></div><div><small>ONLINE</small><b>'+st.onlineRaces+'</b></div></div>'+
    '<div class="zrc-trophies"><span class="t-gold">🥇 '+st.trophies.gold+'</span><span class="t-silver">🥈 '+st.trophies.silver+'</span><span class="t-bronze">🥉 '+st.trophies.bronze+'</span></div>'+
    '<div class="zrc-cups">'+cups+'</div>'+
    '<div class="zrc-row"><small>REWARD CARS</small><b>'+(carNames.length?esc(carNames.join(' · ')):'Win Stage 3, 4 and 5 to unlock Phantom GT, Solar Titan and Stratos Zero')+'</b></div>'+
    '<div class="zrc-row"><small>EXCLUSIVE SKINS</small><div class="zrc-skins">'+skins+'</div></div>'+
    '<div class="zrc-row"><small>RACING ACHIEVEMENTS · '+gotAch+' / '+ACH.length+'</small><div class="zrc-ach">'+ACH.map(a=>'<span class="'+(st.ach[a.id]?'got':'')+'" title="'+esc(a.desc)+'">'+(st.ach[a.id]?'★ ':'🔒 ')+esc(a.name)+'</span>').join('')+'</div></div>';
}
function buildCabinet(){
  if($('zrCabinetWrap'))return;
  const cs=$('careerStats'),label=cs&&cs.previousElementSibling;if(!cs)return;
  const wrap=document.createElement('div');wrap.id='zrCabinetWrap';
  wrap.innerHTML='<div class="section-label stage-label">WINNER’S CABINET · TROPHIES &amp; UNLOCKS</div><div id="zrCabinet" class="zrc"></div><p class="garage-note">Win races to earn coins, trophies, free upgrades, exclusive skins and reward cars. Saved on this device.</p>';
  (label||cs).insertAdjacentElement('beforebegin',wrap);
  renderCabinet();
}

/* ------------------------------------------------------------------ wiring */
function onResult(ev){
  try{
    const res=ev.detail;
    const sum=R.claim(res);
    if(!sum)return;
    R.last=sum;
    // let the chequered-flag celebration play first, then show the victory screen above the finish dialog
    setTimeout(()=>{try{showVictory(sum);}catch(e){console.error('ZAYRO REWARDS screen',e);}},1100);
  }catch(e){console.error('ZAYRO REWARDS',e);}
}
function init(){
  // re-register unlocked skins and restore the previously chosen reward skin (the base game only knows its own 7 paints at load)
  try{
    const st=load();st.skins.forEach(registerSkin);
    const saved=localStorage.getItem('apexPaint');
    if(saved&&st.skins.includes(saved)&&typeof selectedPaint!=='undefined')selectedPaint=saved;
    if(typeof uploadPaintOptions==='function')uploadPaintOptions();
  }catch(e){console.error('ZAYRO REWARDS init',e);}
  // the base save validator only knows the 7 stock paints; allow a reward skin as the saved paint
  try{
    if(typeof isValidDriverSave==='function'){
      const _v=isValidDriverSave;
      isValidDriverSave=function(data){
        try{if(data&&data.save&&typeof data.save==='object'&&SKINS[data.save.apexPaint]){const copy={...data,save:{...data.save,apexPaint:'factory'}};return _v(copy);}}catch(_){}
        return _v(data);
      };
    }
  }catch(_){}
  try{buildCabinet();}catch(e){console.error('ZAYRO REWARDS cabinet',e);}
  window.addEventListener('zayro:result',onResult);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
