'use strict';
/* ZAYRO RESULTS v1.0 — loads after zayro_graphics.js, before zayro_certificate.js (base game code untouched).
   Single source of truth for "how did this race end?":
     - single-player: the player's REAL finishing position against the 3 AI rivals (virtual race progress, see below)
     - multiplayer:   the position decided by the trusted server (arrives a moment after the line is crossed)
     - DNF:           eliminated / not finished -> no placing, no certificate, no race rewards
   Publishes window.ZAYRO_RESULT and the events  zayro:finish  zayro:result  zayro:dnf  that the certificate and
   rewards modules listen to. Everything is wrapped in try/catch: a failure here can never stop the game. */
(function(){
const R={current:null,mp:null};
window.ZAYRO_RESULTS=R;

const ORD=n=>{const a=n%100,b=n%10;return n+((a>=11&&a<=13)?'TH':b===1?'ST':b===2?'ND':b===3?'RD':'TH');};
R.ordinal=ORD;
R.placeLabel=n=>ORD(n)+' PLACE';
R.tierOf=pos=>pos===1?'gold':pos===2?'silver':pos===3?'bronze':'steel';
const uid=()=>{const b=new Uint8Array(6);try{crypto.getRandomValues(b);}catch(_){for(let i=0;i<6;i++)b[i]=Math.random()*256;}return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');};
const emit=(name,detail)=>{try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch(e){console.error('ZAYRO RESULTS emit',e);}};
const fmt=t=>{try{return formatTime(t);}catch(_){const m=Math.floor(t/60),s=t%60;return String(m).padStart(2,'0')+':'+s.toFixed(2).padStart(5,'0');}};

/* ---------------------------------------------------------------- rival progress tracking
   Rivals in the base game are recycled: once the player is 24 m ahead, a rival is teleported 180+ m forward so the
   pack never disappears. Their on-screen z is therefore NOT a race position. We track each rival's real distance
   covered (ignoring the recycle jump). A rival has "finished before you" if its progress reached the finish line
   when the player crossed it. */
const prog=new WeakMap();
function trackRivals(){
  try{
    if(typeof rivals==='undefined'||!Array.isArray(rivals))return;
    for(const r of rivals){
      let s=prog.get(r);
      if(!s){prog.set(r,{last:r.z,p:r.z});continue;}
      const d=r.z-s.last;
      if(d>=0&&d<20)s.p+=d;          // normal motion; a jump of 20 m+ in one frame is the recycle teleport
      s.last=r.z;
    }
  }catch(_){}
}
function singlePosition(){
  trackRivals();
  const target=raceTargetDistance;
  const list=(typeof rivals!=='undefined'&&Array.isArray(rivals))?rivals.filter(r=>!r.net):[];
  if(raceEvent==='timeTrial'||!list.length)return {position:null,total:1,solo:true};
  let ahead=0;
  for(const r of list){const s=prog.get(r);if(s&&s.p>=target)ahead++;}
  return {position:1+ahead,total:list.length+1,solo:false};
}

function baseInfo(){
  const st=(typeof stage!=='undefined')?stage:1;
  let name='';try{name=localStorage.getItem('apexPlayerName')||playerName||'Driver';}catch(_){name=(typeof playerName!=='undefined'&&playerName)||'Driver';}
  return {
    player:name,stage:st,stageName:(typeof stageNames!=='undefined'&&stageNames[st-1])||('Stage '+st),
    event:raceEvent,difficulty:difficulty,crashes:crashCount,skill:Math.round(skillPoints||0),nearMisses:nearMisses||0,
    parTime:(typeof stageParTimes!=='undefined')?stageParTimes[st-1]:0,date:new Date().toISOString(),
    finishSpeed:Math.round(Math.abs(player.speed)*3.6)
  };
}

/* ---------------------------------------------------------------- finish / DNF hooks */
function install(){
  if(typeof finishStage!=='function'||install.done)return;
  install.done=true;
  const _fs=finishStage;
  finishStage=function(){
    if(freeRoam||finished)return _fs.apply(this,arguments);
    let res=null;
    try{
      const info=baseInfo(),t=time;
      const multi=!!(window.ZAYRO_MP&&window.ZAYRO_MP.active&&window.ZAYRO_MP.raceId);
      res=Object.assign(info,{id:'SP-'+uid(),mode:multi?'multi':'single',status:multi?'pending':'ready',timeSec:t,timeText:fmt(t),
        medal:t<=info.parTime?'gold':'silver',verified:false,raceId:null,sig:null});
      if(multi){res.id=window.ZAYRO_MP.raceId;res.raceId=window.ZAYRO_MP.raceId;res.position=null;res.total=window.ZAYRO_MP.playerCount||2;}
      else{const p=singlePosition();res.position=p.position;res.total=p.total;res.solo=p.solo;}
      R.current=res;window.ZAYRO_RESULT=res;
    }catch(e){console.error('ZAYRO RESULTS',e);}
    const out=_fs.apply(this,arguments);
    try{if(res){emit('zayro:finish',res);if(res.status==='ready')emit('zayro:result',res);}}catch(e){console.error('ZAYRO RESULTS',e);}
    return out;
  };
  if(typeof eliminatePlayer==='function'){
    const _el=eliminatePlayer;
    eliminatePlayer=function(){
      const was=finished;
      const out=_el.apply(this,arguments);
      try{if(!was&&finished){const res=Object.assign(baseInfo(),{id:'DNF-'+uid(),mode:(window.ZAYRO_MP&&window.ZAYRO_MP.active)?'multi':'single',status:'dnf',position:null,total:0,timeText:'',verified:false});
        R.current=res;window.ZAYRO_RESULT=res;emit('zayro:dnf',res);}}catch(e){console.error('ZAYRO RESULTS',e);}
      return out;
    };
  }
  if(typeof update==='function'){const _up=update;update=function(){const o=_up.apply(this,arguments);trackRivals();return o;};}
  if(typeof startRace==='function'){const _sr=startRace;startRace=function(){window.ZAYRO_RESULT=null;R.current=null;return _sr.apply(this,arguments);};}
}

/* Called by the multiplayer module when the trusted server has confirmed this player's finishing position. */
R.resolveMultiplayer=function(msg){
  const res=R.current;
  if(!res||res.mode!=='multi'||res.status!=='pending'||(msg.raceId&&res.raceId&&msg.raceId!==res.raceId))return false;
  res.position=msg.position;res.total=msg.total;res.serverTimeMs=msg.timeMs;res.timeSec=msg.timeMs/1000;res.timeText=fmt(msg.timeMs/1000);
  res.medal=res.timeSec<=res.parTime?'gold':'silver';
  res.verified=true;res.sig=msg.sig;res.raceId=msg.raceId;res.id=msg.raceId+':'+(msg.pid||'');res.status='ready';res.date=new Date().toISOString();
  emit('zayro:result',res);return true;
};
R.rejectMultiplayer=function(reason){
  const res=R.current;if(!res||res.mode!=='multi'||res.status!=='pending')return;
  res.status='dnf';res.position=null;res.reason=reason||'not verified';emit('zayro:dnf',res);
};

install();
})();
