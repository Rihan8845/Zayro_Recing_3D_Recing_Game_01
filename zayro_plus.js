'use strict';
/* ZAYRO PRO PACK v5.0 — loads after game.js and layers new systems on top of the existing game.
   Adds: Driver XP/levels, achievements, daily challenges, speed/nitro FX, live callouts,
   run report with skill bonus credits, and keyboard shortcuts. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(_){return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
};

// Let the driver-save export/import include the Pro Pack data.
if(typeof PROFILE_SAVE_KEYS!=='undefined'&&Array.isArray(PROFILE_SAVE_KEYS)){
  ['zayroXP','zayroAch','zayroDaily','zayroStats'].forEach(k=>{if(!PROFILE_SAVE_KEYS.includes(k))PROFILE_SAVE_KEYS.push(k);});
}

/* ---------- Persistent state ---------- */
let xp=Number(store.get('zayroXP',0))||0;
const ach=store.get('zayroAch',{})||{};
const stats=Object.assign({nitroSec:0,draftSec:0,cleanFinishes:0},store.get('zayroStats',{}));
let daily=store.get('zayroDaily',null);

/* ---------- Levels ---------- */
const need=l=>300+l*120;
function levelInfo(total){let l=1,r=total;while(r>=need(l)){r-=need(l);l++;}return{level:l,into:r,need:need(l)};}
const RANKS=[[1,'ROOKIE'],[3,'STREET'],[6,'PRO'],[10,'ELITE'],[15,'LEGEND'],[22,'ICON']];
const rankOf=l=>RANKS.reduce((a,r)=>l>=r[0]?r[1]:a,'ROOKIE');
let lvl=levelInfo(xp).level;

/* ---------- Helpers into the base game ---------- */
function giveCredits(n){
  n=Math.round(n);if(n<=0)return;
  credits+=n;careerStats.creditsEarned+=n;
  localStorage.setItem('apexCredits',String(credits));
  saveCareerStats();refreshGarage();
}
let dirty=false;
function saveAll(){
  store.set('zayroXP',Math.round(xp*10)/10);store.set('zayroAch',ach);
  store.set('zayroStats',stats);if(daily)store.set('zayroDaily',daily);dirty=false;
}

/* ---------- Banner + feed ---------- */
const bq=[];let bBusy=false;
function banner(kind,title,sub){bq.push({kind,title,sub});if(!bBusy)nextBanner();}
function nextBanner(){
  const b=bq.shift(),el=$('zpBanner');
  if(!b||!el){bBusy=false;return;}
  bBusy=true;
  const label=b.kind==='lvl'?'LEVEL UP':b.kind==='daily'?'DAILY CHALLENGE COMPLETE':'ACHIEVEMENT UNLOCKED';
  el.className='zp-banner show '+b.kind;
  el.innerHTML=`<small>${label}</small><b>${esc(b.title)}</b><span>${esc(b.sub)}</span>`;
  setTimeout(()=>{el.classList.remove('show');setTimeout(nextBanner,350);},2800);
}
function feed(text,cls=''){
  const box=$('zpFeed');if(!box)return;
  const el=document.createElement('div');el.className='zp-feed-item '+cls;el.textContent=text;
  box.appendChild(el);while(box.children.length>3)box.firstChild.remove();
  setTimeout(()=>el.remove(),1950);
}

/* ---------- XP ---------- */
function addXP(n){
  if(!(n>0))return;
  xp+=n;dirty=true;
  const now=levelInfo(xp).level;
  while(lvl<now){
    lvl++;const reward=150+lvl*25;giveCredits(reward);
    banner('lvl','LEVEL '+lvl+' · '+rankOf(lvl),'+'+reward+' CR REWARD');
    renderLevel();
  }
}

/* ---------- Daily challenges ---------- */
const POOL={
  spd:{name:'Speed Run',desc:'Reach 220 KM/H',target:220,kind:'max',cr:150},
  nm:{name:'Close Calls',desc:'Pull off 15 near misses',target:15,kind:'sum',cr:200},
  dist:{name:'Road Warrior',desc:'Drive 4,000 m',target:4000,kind:'sum',cr:180},
  nitro:{name:'Nitro Rush',desc:'Burn nitro for 25 s',target:25,kind:'sum',cr:150},
  draft:{name:'Slipstreamer',desc:'Draft behind traffic for 20 s',target:20,kind:'sum',cr:150},
  skill:{name:'Style Points',desc:'Score 3,000 skill points',target:3000,kind:'sum',cr:220},
  clean:{name:'Clean Sweep',desc:'Clear a stage with 0 crashes',target:1,kind:'sum',cr:300},
  finish:{name:'Double Header',desc:'Finish 2 stages',target:2,kind:'sum',cr:250}
};
function seeded(str){
  let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return()=>{h+=0x6D2B79F5;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function newDaily(){
  const day=localDayKey(),rnd=seeded('zayro'+day),ids=Object.keys(POOL);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  daily={day,list:ids.slice(0,3).map(id=>({id,p:0,done:false}))};
  store.set('zayroDaily',daily);
}
if(!daily||!Array.isArray(daily.list)||daily.day!==localDayKey())newDaily();
function dailyAdd(id,v){
  const c=daily.list.find(x=>x.id===id);if(!c||c.done)return;
  const def=POOL[id];c.p=def.kind==='max'?Math.max(c.p,v):c.p+v;dirty=true;
  if(c.p>=def.target){
    c.p=def.target;c.done=true;giveCredits(def.cr);addXP(100);
    banner('daily',def.name,'+'+def.cr+' CR');renderDaily();saveAll();
  }
}

/* ---------- Achievements ---------- */
let run={nm:0,dist:0,top:0};
const ACH=[
  {id:'flag',name:'First Checkered Flag',desc:'Finish any stage',cr:150,t:()=>careerStats.finishes>=1},
  {id:'s220',name:'Speed Demon',desc:'Reach 220 KM/H',cr:150,t:()=>careerStats.bestSpeed>=220},
  {id:'s300',name:'Sound Chaser',desc:'Reach 300 KM/H',cr:400,t:()=>careerStats.bestSpeed>=300},
  {id:'nm10',name:'Needle Threader',desc:'10 near misses in one run',cr:150,t:()=>run.nm>=10},
  {id:'nm30',name:'Ghost Driver',desc:'30 near misses in one run',cr:350,t:()=>run.nm>=30},
  {id:'clean',name:'Spotless',desc:'Finish a stage with 0 crashes',cr:300,t:()=>stats.cleanFinishes>=1},
  {id:'marathon',name:'Marathon',desc:'Drive 25,000 m in total',cr:250,t:()=>careerStats.distance>=25000},
  {id:'combo',name:'Combo King',desc:'Reach a 2,000 skill combo',cr:250,t:()=>bestSkillCombo>=2000},
  {id:'nitro',name:'Nitro Junkie',desc:'Burn 90 s of nitro in total',cr:200,t:()=>stats.nitroSec>=90},
  {id:'slip',name:'Slipstream Master',desc:'Draft for 45 s in total',cr:200,t:()=>stats.draftSec>=45},
  {id:'rich',name:'High Roller',desc:'Hold 5,000 credits',cr:300,t:()=>credits>=5000},
  {id:'survivor',name:'Survivor',desc:'1,500 m with 2 crashes',cr:200,t:()=>running&&!finished&&run.dist>=1500&&crashCount===2},
  {id:'city',name:'City Explorer',desc:'Hit 5 checkpoints in Open City',cr:300,t:()=>freeRoam&&missionCheckpoints>=5},
  {id:'lv10',name:'Elite Driver',desc:'Reach driver level 10',cr:500,t:()=>lvl>=10},
  {id:'champ',name:'World Champion',desc:'Win the Stage 5 cup',cr:600,t:()=>{try{return !!JSON.parse(localStorage.getItem('apexAwards')||'{}')[5];}catch(_){return false;}}}
];
function checkAch(){
  for(const a of ACH){
    if(ach[a.id])continue;
    let ok=false;try{ok=a.t();}catch(_){}
    if(ok){ach[a.id]=1;giveCredits(a.cr);addXP(80);banner('ach',a.name,'+'+a.cr+' CR');renderAch();dirty=true;saveAll();}
  }
}

/* ---------- UI: HUD pill, feed, banner, garage hub ---------- */
function buildUI(){
  const hud=document.querySelector('.hud')||document.body;
  if(!$('zpXp')){
    const pill=document.createElement('div');pill.id='zpXp';pill.className='zp-xp';
    pill.innerHTML='<b id="zpLv">LV 1</b><span id="zpRank">ROOKIE</span><div class="zp-xpbar"><i id="zpXpFill"></i></div><small id="zpXpTxt">0 XP</small>';
    hud.appendChild(pill);
  }
  if(!$('zpFeed')){const f=document.createElement('div');f.id='zpFeed';f.className='zp-feed';document.body.appendChild(f);}
  if(!$('zpBanner')){const b=document.createElement('div');b.id='zpBanner';b.className='zp-banner';document.body.appendChild(b);}
  const gift=$('dailyGiftPanel');
  if(gift&&!$('zpHub')){
    const hub=document.createElement('div');hub.id='zpHub';
    hub.innerHTML='<div class="section-label stage-label">ZAYRO PRO · DRIVER LEVEL</div><div id="zpLevelCard" class="zp-level-card"></div><div class="section-label stage-label">DAILY CHALLENGES</div><div id="zpDaily" class="zp-daily"></div>';
    gift.insertAdjacentElement('afterend',hub);
  }
  const cs=$('careerStats'),label=cs&&cs.previousElementSibling;
  if(label&&!$('zpAchWrap')){
    const w=document.createElement('div');w.id='zpAchWrap';
    w.innerHTML='<div class="section-label stage-label">ACHIEVEMENTS <span id="zpAchCount"></span></div><div id="zpAchGrid" class="zp-ach-grid"></div>';
    label.parentNode.insertBefore(w,label);
  }
  if(!document.getElementById('zpFx')){
    const c=document.createElement('canvas');c.id='zpFx';c.setAttribute('aria-hidden','true');
    const g=$('game');if(g)g.insertAdjacentElement('afterend',c);else document.body.prepend(c);
  }
}
buildUI();
function renderLevel(){
  const li=levelInfo(xp),pct=Math.round(li.into/li.need*100);
  const lv=$('zpLv'),rk=$('zpRank'),fill=$('zpXpFill'),txt=$('zpXpTxt');
  if(lv)lv.textContent='LV '+li.level;if(rk)rk.textContent=rankOf(li.level);
  if(fill)fill.style.width=pct+'%';if(txt)txt.textContent=Math.floor(li.into)+' / '+li.need+' XP';
  const card=$('zpLevelCard');
  if(card)card.innerHTML=`<div class="zp-lv-badge">${li.level}</div><div class="zp-lv-copy"><b>${rankOf(li.level)} DRIVER</b><small>${Math.floor(li.into)} / ${li.need} XP to level ${li.level+1} · reward ${150+(li.level+1)*25} CR</small><div class="zp-xpbar"><i style="width:${pct}%"></i></div></div>`;
}
function renderDaily(){
  const el=$('zpDaily');if(!el||!daily)return;
  el.innerHTML=daily.list.map(c=>{
    const d=POOL[c.id],pct=Math.round(clamp(c.p/d.target,0,1)*100);
    const val=d.target>=100?Math.floor(c.p).toLocaleString():(Math.round(c.p*10)/10);
    return `<div class="zp-daily-item ${c.done?'done':''}"><div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></div><div class="zp-daily-right"><span>${c.done?'COMPLETE ✓':val+' / '+d.target.toLocaleString()}</span><em>+${d.cr} CR</em></div><div class="zp-xpbar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}
function renderAch(){
  const g=$('zpAchGrid'),n=$('zpAchCount');if(!g)return;
  const got=ACH.filter(a=>ach[a.id]).length;
  if(n)n.textContent='· '+got+' / '+ACH.length;
  g.innerHTML=ACH.map(a=>`<div class="zp-ach ${ach[a.id]?'got':''}" title="${esc(a.desc)}"><i>${ach[a.id]?'★':'🔒'}</i><b>${esc(a.name)}</b><small>${esc(a.desc)}</small><em>+${a.cr} CR</em></div>`).join('');
}
function renderAll(){renderLevel();renderDaily();renderAch();}

/* ---------- Run report ---------- */
function showReport(ok,gained,bonus){
  const host=ok?$('finish'):$('outScreen');if(!host)return;
  const box=host.querySelector('.pause-box');if(!box)return;
  let rep=box.querySelector('.zp-report');
  if(!rep){rep=document.createElement('div');rep.className='zp-report';const anchor=ok?$('nextStage'):$('retryRace');box.insertBefore(rep,anchor);}
  const avg=time>0?Math.round(run.dist/time*3.6):0,li=levelInfo(xp);
  rep.innerHTML=`<div class="zp-report-title">RUN REPORT · ZAYRO PRO</div><div class="zp-report-grid"><div><small>TOP SPEED</small><b>${Math.round(run.top)}<i> KM/H</i></b></div><div><small>AVG SPEED</small><b>${avg}<i> KM/H</i></b></div><div><small>NEAR MISSES</small><b>${run.nm}</b></div><div><small>SKILL POINTS</small><b>${Math.round(skillPoints).toLocaleString()}</b></div><div><small>XP EARNED</small><b>+${Math.round(gained)}</b></div><div><small>SKILL BONUS</small><b>${bonus>0?'+'+bonus+' CR':'—'}</b></div></div><div class="zp-report-lv">LV ${li.level} · ${rankOf(li.level)}</div>`;
}
let runXpStart=0;
function onRunEnd(){
  const ok=!$('finish').classList.contains('hidden');
  let bonus=0;
  if(ok&&!freeRoam){
    bonus=Math.min(400,Math.floor(skillPoints/60))+(crashCount===0?150:0);
    if(bonus>0)giveCredits(bonus);
    addXP(300+(crashCount===0?150:0));
    dailyAdd('finish',1);
    if(crashCount===0){stats.cleanFinishes++;dailyAdd('clean',1);}
    if(bonus>0)pop('SKILL BONUS +'+bonus+' CR');
  }
  showReport(ok,xp-runXpStart,bonus);
  checkAch();saveAll();renderAll();
}

/* ---------- FX overlay ---------- */
const fx=$('zpFx'),fctx=fx&&fx.getContext('2d');
const lines=Array.from({length:44},()=>({a:Math.random()*Math.PI*2,p:Math.random(),s:.6+Math.random()*.8}));
let fxBoost=0,fxClock=0;
function drawFx(dt,active){
  if(!fctx)return;
  const w=innerWidth,h=innerHeight;
  if(fx.width!==w||fx.height!==h){fx.width=w;fx.height=h;}
  fctx.clearRect(0,0,w,h);
  if(!active)return;
  fxClock+=dt;
  const maxR=Math.hypot(w,h)/2,cx=w/2,cy=h*.46;
  const top=cars[selectedCar].top*3.6,kmh=Math.abs(player.speed)*3.6;
  const intensity=clamp((kmh/(top*1.08)-.5)/.5,0,1);
  fxBoost=clamp(fxBoost+(boosting?1:-1)*dt*4,0,1);
  const lowFps=typeof displayedFPS!=='undefined'&&displayedFPS<30;
  const count=graphicsQuality==='performance'?18:lines.length;
  if(intensity>.02&&!lowFps){
    fctx.lineCap='round';
    for(let i=0;i<count;i++){
      const L=lines[i];
      L.p+=dt*(.7+2.4*intensity)*L.s;
      if(L.p>1){L.p=0;L.a=Math.random()*Math.PI*2;}
      const inner=maxR*(.22+.62*L.p),outer=inner+maxR*(.03+.2*intensity)*(.3+L.p);
      const al=(.04+.30*intensity)*L.p;
      fctx.strokeStyle=fxBoost>.3?`rgba(255,190,120,${al})`:`rgba(210,235,255,${al})`;
      fctx.lineWidth=1+L.p*1.6;
      fctx.beginPath();
      fctx.moveTo(cx+Math.cos(L.a)*inner,cy+Math.sin(L.a)*inner*.8);
      fctx.lineTo(cx+Math.cos(L.a)*outer,cy+Math.sin(L.a)*outer*.8);
      fctx.stroke();
    }
  }
  if(fxBoost>.01){
    const g=fctx.createRadialGradient(cx,cy,maxR*.35,cx,cy,maxR);
    g.addColorStop(0,'rgba(255,120,30,0)');g.addColorStop(1,`rgba(255,110,30,${.34*fxBoost})`);
    fctx.fillStyle=g;fctx.fillRect(0,0,w,h);
  }
  if(crashCount>=2){
    const a=.10+.07*Math.sin(fxClock*5),g=fctx.createRadialGradient(cx,cy,maxR*.4,cx,cy,maxR);
    g.addColorStop(0,'rgba(255,40,60,0)');g.addColorStop(1,`rgba(255,40,60,${a})`);
    fctx.fillStyle=g;fctx.fillRect(0,0,w,h);
  }
}

/* ---------- Main loop ---------- */
let last=performance.now(),prevTime=0,prevRunning=false,prevFinished=false,lastNM=0,lastSkill=0,tier=1,wasDraft=false;
let draftCool=0,hudClock=0,saveClock=0,achClock=0,dayClock=0,garageWasVisible=true;
const speedMarks=new Set();
function resetRun(){
  run={nm:0,dist:0,top:0};lastNM=nearMisses;lastSkill=skillPoints;tier=1;wasDraft=false;draftCool=0;
  speedMarks.clear();runXpStart=xp;
}
function step(rdt){
  const active=running&&!paused&&!finished;
  if((running&&!prevRunning)||(prevFinished&&!finished)||(running&&time+.4<prevTime))resetRun();
  const dt=active?Math.min(.1,Math.max(0,time-prevTime)):0;
  prevTime=time;prevRunning=running;
  if(finished&&!prevFinished)onRunEnd();
  prevFinished=finished;

  if(active&&dt>0){
    const sp=Math.abs(player.speed),kmh=sp*3.6;
    run.top=Math.max(run.top,kmh);run.dist+=sp*dt;
    dailyAdd('spd',kmh);dailyAdd('dist',sp*dt);
    for(const m of [150,200,250,300])if(kmh>=m&&!speedMarks.has(m)){speedMarks.add(m);if(m>=200)feed(m+' KM/H','speed');}
    const dn=nearMisses-lastNM;
    if(dn>0){addXP(15*dn);dailyAdd('nm',dn);feed('NEAR MISS'+(nearMisses>1?' ×'+nearMisses:''),'near');}
    lastNM=nearMisses;run.nm=Math.max(run.nm,nearMisses);
    const ds=skillPoints-lastSkill;
    if(ds>0){addXP(ds*.05);dailyAdd('skill',ds);}
    lastSkill=skillPoints;
    addXP(sp*dt*.1);
    const t=currentSkillCombo>=1800?3:currentSkillCombo>=800?2:currentSkillCombo>=250?1.5:1;
    if(t>tier)feed('COMBO ×'+t,'combo');
    tier=t;
    if(boosting){stats.nitroSec+=dt;dailyAdd('nitro',dt);}
    draftCool=Math.max(0,draftCool-dt);
    if(drafting&&kmh>60){
      stats.draftSec+=dt;dailyAdd('draft',dt);
      if(!wasDraft&&draftCool<=0){feed('SLIPSTREAM','draft');draftCool=5;}
    }
    wasDraft=!!drafting;
  }

  drawFx(rdt,active);

  hudClock+=rdt;if(hudClock>.2){hudClock=0;renderLevel();}
  achClock+=rdt;if(achClock>.7){achClock=0;checkAch();if(running&&!paused&&!finished)renderDaily();}
  saveClock+=rdt;if(saveClock>2.5){saveClock=0;if(dirty)saveAll();}
  dayClock+=rdt;
  if(dayClock>5){dayClock=0;if(daily.day!==localDayKey()){newDaily();renderDaily();}}
  const ss=$('startscreen'),vis=ss&&!ss.classList.contains('hidden');
  if(vis&&!garageWasVisible)renderAll();
  garageWasVisible=!!vis;
}
function loop(now){
  requestAnimationFrame(loop);
  const rdt=Math.min(.1,(now-last)/1000);last=now;
  try{step(rdt);}catch(e){if(!loop.err){loop.err=1;console.error('ZAYRO PRO PACK',e);}}
}

/* ---------- Shortcuts / quality of life ---------- */
function setPaused(v){
  if(!running||finished)return;
  paused=v;keys.clear();ui.pause.classList.toggle('hidden',!paused);
}
window.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA'||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
  const k=e.key.toLowerCase();
  if(k==='p')setPaused(!paused);
  else if(k==='m'){const b=$('soundToggle');if(b)b.click();}
  else if(k==='f'){const b=$('fullscreenButton');if(b)b.click();}
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&running&&!finished&&!paused)setPaused(true);});
window.addEventListener('beforeunload',saveAll);
window.__zrPlus={addXP};   // hook for zayro_rewards.js (race-win XP)

/* ---------- Boot ---------- */
renderAll();checkAch();
last=performance.now();requestAnimationFrame(loop);
})();
