'use strict';
/* ZAYRO HUD v1.0 — loads last. Drives the speed-edge glow and colours the position card by rank (gold / silver / bronze / steel).
   Visual only; wrapped in try/catch so it can never stop the game. */
(function(){
const edge=document.createElement('div');edge.id='zhEdge';edge.setAttribute('aria-hidden','true');document.body.appendChild(edge);
setInterval(()=>{
  try{
    const act=typeof running!=='undefined'&&running&&!paused&&!finished;
    const sp=act?Math.min(1,Math.abs(player.speed)/85):0;
    edge.style.opacity=act?String(Math.max(0,(sp-.25)/.75)*.95):'0';
    const boost=act&&typeof fieldInputs==='function'&&fieldInputs().boost&&nitro>1;
    document.body.classList.toggle('zh-nitro',!!boost);
    const rc=document.querySelector('.rank-card'),rp=document.getElementById('racePosition');
    if(rc&&rp){const m=/P(\d+)/.exec(rp.textContent||'');if(m&&rc.dataset.pos!==m[1])rc.dataset.pos=m[1];}
  }catch(_){}
},100);

/* ---- driver name plate in the XP card + designed creator signature */
function driverName(){
  let n='';
  try{n=(typeof playerName!=='undefined'&&playerName)||localStorage.getItem('apexPlayerName')||'';}catch(_){}
  return (n||'DRIVER').toString().trim().slice(0,14)||'DRIVER';
}
setInterval(()=>{
  try{
    const xp=document.getElementById('zpXp');
    if(xp){
      let nm=document.getElementById('zhName');
      if(!nm){nm=document.createElement('em');nm.id='zhName';const lv=document.getElementById('zpLv');lv?lv.after(nm):xp.prepend(nm);}
      const v=driverName();if(nm.textContent!==v)nm.textContent=v;
    }
    const ct=document.querySelector('.creator-tag');
    if(ct&&!ct.querySelector('b')){ct.innerHTML='CREATED BY <b>RIHAN</b>';}
  }catch(_){}
},400);
})();
