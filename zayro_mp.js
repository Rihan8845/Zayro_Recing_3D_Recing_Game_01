'use strict';
/* ZAYRO MULTIPLAYER v1.0 — online racing client (separate module; base game code is untouched).
   Loads after zayro_results.js / zayro_certificate.js / zayro_rewards.js.
   - Talks to multiplayer-server/ over a secure WebSocket (wss://). No secret is stored in the browser: the only
     credentials are a per-session reconnect token issued by the server.
   - Players race the same seed/stage/road; opponents are drawn as real cars from the server's 15 Hz snapshots
     (no fake players: every opponent is another connected browser). No car-to-car collisions in v1.
   - Finishing positions come ONLY from the server ('finished' / 'results' messages). Certificates and rewards wait for them.
   Public API: window.ZAYRO_MP = { active, raceId, playerCount, phase, connected, room, open(), close(), leave() } */
(function(){
const MP=window.ZAYRO_MP={active:false,raceId:null,playerCount:0,phase:'none',connected:false,room:null,pid:null,rank:0};
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CFG=Object.assign({server:''},window.ZAYRO_MP_CONFIG||{});
const LS={get(k){try{return localStorage.getItem(k);}catch(_){return null;}},set(k,v){try{localStorage.setItem(k,v);}catch(_){}} ,del(k){try{localStorage.removeItem(k);}catch(_){}}};
const SS={get(k){try{return sessionStorage.getItem(k);}catch(_){return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch(_){}} ,del(k){try{sessionStorage.removeItem(k);}catch(_){}}};
const toast=m=>{try{pop(m);}catch(_){}};
const PAINTS=[[.94,.15,.12],[.1,.55,.95],[.95,.65,.08],[.2,.8,.4]];
const PAINT_CSS=['#f0261f','#1a8cf2','#f2a614','#33cc66'];

/* ------------------------------------------------------------------ state */
let ws=null,wantOpen=false,retry=0,retryTimer=null,pingTimer=null,lastPing=0;
let me={name:'',pid:null,token:null,code:null};
let room=null,hostId=null,lastResults=null,lastErr='',busy=false,statusMsg='';
let clock={offset:0,rtt:1e9};                    // serverTime ≈ Date.now()+offset
let race=null;                                    // {raceId,startAt,target,seed,settings,players:[pid...],finishedSent,resolved}
let snaps=new Map();                              // pid -> {x,z,yaw,sp,at}
let ranking=[];                                   // last snapshot players (ranked)
let sendClock=0,goTimer=null,confirmTimer=null;

/* ------------------------------------------------------------------ server address */
function isLocalHost(h){return h==='localhost'||h==='127.0.0.1'||h==='[::1]'||/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(h);}
function defaultServer(){
  const saved=LS.get('zayroMpServer');if(saved)return saved;
  if(CFG.server)return CFG.server;
  const h=location.hostname;
  if(location.protocol==='file:')return 'ws://localhost:8787';
  if(isLocalHost(h))return (location.protocol==='https:'?'wss://':'ws://')+h+':8787';
  return '';
}
function normalizeServer(s){
  s=String(s||'').trim();if(!s)return '';
  s=s.replace(/^http:\/\//i,'ws://').replace(/^https:\/\//i,'wss://');
  if(!/^wss?:\/\//i.test(s)){const host=s.split('/')[0].split(':')[0];s=(isLocalHost(host)&&location.protocol!=='https:'?'ws://':'wss://')+s;}
  return s.replace(/\/+$/,'');
}
let serverUrl=normalizeServer(defaultServer());

/* ------------------------------------------------------------------ connection */
function send(o){if(ws&&ws.readyState===1){try{ws.send(JSON.stringify(o));return true;}catch(_){}}return false;}
function setStatus(m){statusMsg=m||'';const e=$('zmpStatus');if(e)e.textContent=statusMsg;updateChip();}
function connect(){
  return new Promise((resolve,reject)=>{
    if(!serverUrl)return reject(new Error('Enter the multiplayer server address first.'));
    if(location.protocol==='https:'&&/^ws:\/\//i.test(serverUrl)&&!isLocalHost(serverUrl.replace(/^ws:\/\//i,'').split(/[:/]/)[0]))return reject(new Error('This page is HTTPS, so the server must use wss:// (secure).'));
    try{if(ws){ws.onclose=null;ws.close();}}catch(_){}
    let sock,done=false;
    try{sock=new WebSocket(serverUrl);}catch(e){return reject(new Error('Invalid server address.'));}
    ws=sock;
    const to=setTimeout(()=>{if(!done){done=true;try{sock.close();}catch(_){}reject(new Error('Server not reachable (timeout).'));}},9000);
    sock.onopen=()=>{};
    sock.onmessage=ev=>{
      let m;try{m=JSON.parse(ev.data);}catch(_){return;}
      if(m.t==='hello'&&!done){done=true;clearTimeout(to);MP.connected=true;retry=0;startPing();resolve(m);return;}
      onMsg(m);
    };
    sock.onerror=()=>{};
    sock.onclose=()=>{
      clearTimeout(to);
      if(!done){done=true;reject(new Error('Could not connect to '+serverUrl));return;}
      if(ws===sock){MP.connected=false;stopPing();onLost();}
    };
  });
}
function startPing(){stopPing();doPing();pingTimer=setInterval(doPing,4000);}
function stopPing(){clearInterval(pingTimer);pingTimer=null;}
function doPing(){lastPing=Date.now();send({t:'ping',c:lastPing});}
function onPong(m){
  const now=Date.now(),rtt=now-(Number(m.c)||now);
  if(rtt<0||rtt>5000)return;
  if(rtt<=clock.rtt*1.5+5){clock.rtt=Math.min(rtt,clock.rtt*1.2+1);clock.offset=m.s-(Number(m.c)+rtt/2);}
  MP.ping=Math.round(rtt);const e=$('zmpPing');if(e)e.textContent=MP.ping+' ms';
}
function onLost(){
  if(!wantOpen||!me.code||!me.token){render();return;}
  // unexpected drop while in a room: try to resume the same seat (server keeps it for a grace period)
  setStatus('Connection lost — reconnecting…');render();
  clearTimeout(retryTimer);
  const wait=Math.min(5000,800+retry*900);retry++;
  retryTimer=setTimeout(async()=>{
    if(retry>14){setStatus('Could not reconnect. Your seat was released.');SS.del('zayroMpSession');resetRoom();render();return;}
    try{await connect();send({t:'rejoin',code:me.code,token:me.token});}catch(_){onLost();}
  },wait);
}
function resetRoom(){room=null;hostId=null;me.code=null;me.token=null;me.pid=null;MP.room=null;MP.pid=null;endRaceState();updateChip();}

/* ------------------------------------------------------------------ messages */
function onMsg(m){
  try{
    switch(m.t){
      case 'pong':return onPong(m);
      case 'error':lastErr=m.msg||m.code||'Error';busy=false;setStatus(lastErr);toast('ONLINE · '+lastErr.toUpperCase());render();return;
      case 'welcome':
        me.pid=m.pid;me.token=m.token;MP.pid=m.pid;room=m.room;me.code=room.code;hostId=room.hostId;MP.room=room;busy=false;lastErr='';
        SS.set('zayroMpSession',JSON.stringify({server:serverUrl,code:room.code,token:me.token,name:me.name}));
        setStatus(m.resumed?'Reconnected to room '+room.code:'');
        if(m.resumed&&m.race&&!race){
          // The page was reloaded in the middle of a race: the local car is gone, so this race can't be resumed.
          send({t:'dnf',reason:'reload'});toast('ONLINE RACE LOST · PAGE WAS RELOADED');
        }
        render();updateChip();return;
      case 'room':
        room=m.room;hostId=room.hostId;MP.room=room;MP.playerCount=room.players.length;
        if(room.state==='lobby'&&MP.phase!=='none'&&MP.phase!=='results')endRaceState();
        render();updateChip();return;
      case 'left':resetRoom();SS.del('zayroMpSession');render();return;
      case 'playerConn':{const p=room&&room.players.find(x=>x.pid===m.pid);if(p&&m.pid!==me.pid)toast((p.name||'PLAYER').toUpperCase()+(m.connected?' RECONNECTED':' DISCONNECTED'));return;}
      case 'countdown':return onCountdown(m);
      case 'go':return onGo(m);
      case 'snap':return onSnap(m);
      case 'finished':return onFinished(m);
      case 'playerFinished':toast((m.name||'PLAYER').toUpperCase()+' FINISHED · P'+m.position);return;
      case 'playerDnf':toast((m.name||'PLAYER').toUpperCase()+' · DNF');return;
      case 'results':return onResults(m);
      case 'aborted':endRaceState();toast(m.msg||'RACE CANCELLED');render();return;
      default:return;
    }
  }catch(e){console.error('ZAYRO MP',e);}
}

/* ------------------------------------------------------------------ race lifecycle */
function serverNow(){return Date.now()+clock.offset;}
function onCountdown(m){
  if(typeof startRace!=='function')return;
  endRaceState(true);
  const s=m.settings||{};
  try{
    freeRoam=false;
    stage=Math.max(1,Math.min(5,s.stage|0||1));
    raceEvent=s.event==='sprint'?'sprint':'circuit';
    const nRoads=(typeof roadChoices!=='undefined'&&roadChoices.length)||5;
    selectedRoad=Math.max(0,Math.min(nRoads-1,s.road|0));
    try{buildWorld(selectedRoad);}catch(e){console.error('ZAYRO MP world',e);}
    citySeed=(m.seed>>>0)||48291;                 // identical traffic layout for everyone
    startRace();                                  // existing start routine (stage car, HUD, traffic, timers)
    paused=true;                                  // hold at the line until GO
  }catch(e){console.error('ZAYRO MP start',e);toast('ONLINE START FAILED');send({t:'dnf',reason:'start_failed'});return;}
  const ids=(m.room&&m.room.players||[]).map(p=>p.pid);
  race={raceId:m.raceId,startAt:m.startAt,target:m.target,seed:m.seed,settings:s,players:ids,finishedSent:false,resolved:false,names:{}};
  (m.room&&m.room.players||[]).forEach(p=>race.names[p.pid]=p.name);
  MP.active=true;MP.raceId=m.raceId;MP.playerCount=ids.length;MP.phase='countdown';MP.rank=1;
  snaps=new Map();ranking=[];
  // opponents: one real car per other connected player
  rivals=[];
  ids.forEach((pid,i)=>{
    if(pid===me.pid)return;
    rivals.push({net:true,pid,id:100+i,x:[-8.4,2.8,8.4,-2.8][i%4],z:0,yaw:0,speed:0,baseLane:0,targetLane:0,baseSpeed:0,style:i%5,color:PAINTS[i%4],phase:0,passed:true,tx:null,tz:0,tyaw:0,tsp:0,tat:0});
  });
  send({t:'car',car:(typeof selectedCar==='number')?selectedCar:0});
  closePanel();
  startCountdownUI(m);
  showHud(true);
}
function startCountdownUI(m){
  const el=$('zmpCount');if(!el)return;
  el.classList.remove('zmp-hidden');
  const tick=()=>{
    if(MP.phase!=='countdown'){return;}
    const left=m.startAt-serverNow();
    if(left<=0){el.textContent='GO!';return;}
    el.textContent=String(Math.ceil(left/1000));
    goTimer=setTimeout(tick,Math.max(30,Math.min(250,left%1000||250)));
  };
  clearTimeout(goTimer);tick();
}
function onGo(){
  if(MP.phase!=='countdown'||!race)return;
  MP.phase='racing';sendClock=0;
  try{time=0;paused=false;if(ui&&ui.pause)ui.pause.classList.add('hidden');}catch(_){}
  const el=$('zmpCount');if(el){el.textContent='GO!';el.classList.add('zmp-go');setTimeout(()=>{el.classList.add('zmp-hidden');el.classList.remove('zmp-go');},900);}
}
function onSnap(m){
  if(!race||(MP.phase!=='racing'&&MP.phase!=='countdown'))return;
  const at=performance.now();ranking=m.players||[];
  for(const p of ranking){
    if(p.pid===me.pid){MP.rank=p.rank;continue;}
    snaps.set(p.pid,{x:p.x,z:p.z,yaw:p.yaw,sp:p.sp,at,fin:p.fin,dnf:p.dnf,car:p.car,name:p.name,connected:p.connected});
  }
  renderRanking();
}
function onFinished(m){
  clearTimeout(confirmTimer);
  if(!race||m.raceId!==race.raceId)return;
  race.resolved=true;
  const R=window.ZAYRO_RESULTS;
  if(R&&R.resolveMultiplayer)R.resolveMultiplayer(m);
  toast('🏁 OFFICIAL RESULT · '+(R?R.ordinal(m.position):m.position)+' PLACE');
}
function onResults(m){
  lastResults=m;
  const mine=m.rows.find(r=>r.pid===me.pid);
  // if the game's own finish was never confirmed (e.g. result lost), the certificate/rewards stay blocked
  if(race&&!race.resolved&&MP.phase!=='none'){
    const R=window.ZAYRO_RESULTS;if(R&&R.rejectMultiplayer&&(!mine||mine.status!=='finished'))R.rejectMultiplayer('did not finish');
  }
  MP.phase='results';
  showHud(false);renderRanking();
  clearTimeout(goTimer);
  setTimeout(()=>{if(MP.phase==='results'){endRaceState();}},60);
  toast('ONLINE RACE COMPLETE · RESULTS READY');
  renderResultsBanner();render();
}
function endRaceState(keepRivals){
  clearTimeout(goTimer);clearTimeout(confirmTimer);
  const was=MP.phase!=='none';
  MP.active=false;MP.raceId=null;MP.phase='none';
  race=null;snaps=new Map();ranking=[];
  showHud(false);
  const el=$('zmpCount');if(el)el.classList.add('zmp-hidden');
  if(was&&!keepRivals){try{rivals=rivals.filter(r=>!r.net);}catch(_){}}
}

/* per-frame hook: freeze at the line, block pausing, stream my car, move opponents */
function install(){
  if(typeof update!=='function'||install.done)return;install.done=true;
  const _up=update;
  update=function(dt){
    if(MP.phase==='countdown'){try{paused=true;}catch(_){}}
    else if(MP.phase==='racing'){try{if(paused){paused=false;ui.pause.classList.add('hidden');}}catch(_){}}
    const out=_up.apply(this,arguments);
    try{if(race&&(MP.phase==='racing'||MP.phase==='countdown'))netStep(dt);}catch(e){console.error('ZAYRO MP step',e);}
    return out;
  };
  window.addEventListener('keydown',e=>{
    if(MP.active&&(e.key==='Escape'||e.key==='p'||e.key==='P')){e.stopImmediatePropagation();e.preventDefault();}
  },true);
  window.addEventListener('zayro:finish',e=>{
    const res=e.detail;if(!res||res.mode!=='multi'||!race||race.finishedSent)return;
    race.finishedSent=true;
    sendState(true);
    send({t:'finish',time:res.timeSec});
    clearTimeout(confirmTimer);
    confirmTimer=setTimeout(()=>{if(race&&!race.resolved){const R=window.ZAYRO_RESULTS;if(R&&R.rejectMultiplayer)R.rejectMultiplayer('Server did not confirm the finish.');toast('FINISH NOT CONFIRMED BY SERVER');}},9000);
  });
  window.addEventListener('zayro:dnf',e=>{
    const res=e.detail;if(!res||res.mode!=='multi'||!race)return;
    if(!race.finishedSent){race.finishedSent=true;send({t:'dnf',reason:'crashed'});}
  });
}
function sendState(force){
  if(typeof player==='undefined')return;
  send({t:'s',x:+player.x.toFixed(2),z:+player.z.toFixed(2),yaw:+player.yaw.toFixed(3),sp:+player.speed.toFixed(2),b:(typeof boosting!=='undefined'&&boosting)?1:0,cc:(typeof selectedCar==='number')?selectedCar:0});
}
function netStep(dt){
  const t=performance.now();
  if(MP.phase==='racing'&&!finished){sendClock+=dt;if(sendClock>=.05){sendClock=0;sendState();}}
  for(const r of rivals){
    if(!r.net)continue;
    const s=snaps.get(r.pid);if(!s)continue;
    const age=Math.min(.35,(t-s.at)/1000);
    const tz=s.z+(s.fin||s.dnf?0:Math.max(0,s.sp)*age),k=Math.min(1,dt*12);
    if(r.tx===null){r.x=s.x;r.z=tz;r.yaw=s.yaw;r.tx=s.x;}
    r.x+=(s.x-r.x)*k;r.z+=(tz-r.z)*k;r.yaw+=(s.yaw-r.yaw)*k;r.speed=s.sp;r.style=((s.car|0)%5+5)%5;
  }
  // my live place from the server ranking
  try{
    if(MP.phase==='racing'&&ui&&ui.racePosition&&!finished)ui.racePosition.innerHTML='P'+(MP.rank||1)+' <small>/ '+(MP.playerCount||2)+'</small>';
  }catch(_){}
}

/* ------------------------------------------------------------------ HUD: live ranking */
function showHud(on){const h=$('zmpHud');if(h)h.classList.toggle('zmp-hidden',!on);}
function renderRanking(){
  const box=$('zmpRank');if(!box||!race)return;
  const R=window.ZAYRO_RESULTS;
  box.innerHTML=ranking.map(p=>{
    const mine=p.pid===me.pid,idx=race.players.indexOf(p.pid);
    const tag=p.fin?'🏁 '+(R?R.ordinal(p.fin):p.fin):p.dnf?'DNF':!p.connected?'⚠ LOST':(mine?(typeof player!=='undefined'?Math.round(Math.max(0,player.z))+' M':''):Math.round(Math.max(0,p.z))+' M');
    return '<li class="'+(mine?'me':'')+(p.dnf?' dnf':'')+'"><i style="background:'+PAINT_CSS[Math.max(0,idx)%4]+'"></i><b>'+p.rank+'</b><span>'+esc(p.name)+(mine?' · YOU':'')+'</span><em>'+tag+'</em></li>';
  }).join('');
}

/* ------------------------------------------------------------------ lobby UI */
function build(){
  if($('zmpPanel'))return;
  const d=document.createElement('div');
  d.innerHTML=
    '<button id="zmpChip" class="zmp-chip zmp-hidden" type="button" aria-label="Online multiplayer">🌐 <span>ONLINE</span><small id="zmpChipSub"></small></button>'+
    '<div id="zmpHud" class="zmp-hud zmp-hidden"><div class="zmp-hud-title">LIVE RANKING<button id="zmpQuit" type="button" title="Leave race">✕</button></div><ol id="zmpRank"></ol></div>'+
    '<div id="zmpCount" class="zmp-count zmp-hidden" aria-live="assertive"></div>'+
    '<div id="zmpPanel" class="zmp zmp-hidden" role="dialog" aria-modal="true" aria-label="Online multiplayer"><div class="zmp-card"><button id="zmpClose" class="zmp-x" type="button" aria-label="Close">✕</button><div id="zmpBody"></div></div></div>';
  while(d.firstChild)document.body.appendChild(d.firstChild);
  $('zmpChip').onclick=()=>MP.open();
  $('zmpClose').onclick=()=>closePanel();
  $('zmpQuit').onclick=()=>{if(confirm('Leave the online race? You will not finish and will get no result.'))MP.leave(true);};
  $('zmpPanel').addEventListener('click',e=>{if(e.target.id==='zmpPanel')closePanel();});
  setInterval(updateChip,700);
}
function startScreenVisible(){const s=$('startscreen');return !!s&&!s.classList.contains('hidden');}
function updateChip(){
  const c=$('zmpChip');if(!c)return;
  const nameVisible=$('nameScreen')&&!$('nameScreen').classList.contains('hidden');
  const show=(startScreenVisible()&&!nameVisible)||(!!room&&MP.phase==='none');
  c.classList.toggle('zmp-hidden',!show||MP.phase==='racing'||MP.phase==='countdown');
  const sub=$('zmpChipSub');
  if(sub)sub.textContent=room?room.code+' · '+room.players.length+'/'+room.capacity:'';
  c.classList.toggle('zmp-in',!!room);
}
function closePanel(){const p=$('zmpPanel');if(p)p.classList.add('zmp-hidden');}
MP.close=closePanel;
MP.open=function(){
  build();
  const p=$('zmpPanel');p.classList.remove('zmp-hidden');
  try{me.name=(LS.get('apexPlayerName')||(typeof playerName!=='undefined'&&playerName)||me.name||'').trim();}catch(_){}
  render();
};
MP.leave=function(fromRace){
  const wasRacing=MP.phase==='racing'||MP.phase==='countdown';
  wantOpen=false;clearTimeout(retryTimer);
  send({t:'leave'});
  SS.del('zayroMpSession');
  setTimeout(()=>{try{if(ws)ws.close();}catch(_){}},150);
  resetRoom();
  if(wasRacing||fromRace){
    // return to the garage cleanly instead of leaving a half-finished race on screen
    try{finished=true;running=false;paused=false;ui.pause.classList.add('hidden');const o=$('outScreen');if(o)o.classList.add('hidden');const f=$('finish');if(f)f.classList.add('hidden');byId('startscreen').classList.remove('hidden');}catch(_){}
  }
  render();
};

async function doCreate(){
  const nm=readName();if(!nm)return;
  me.name=nm;serverUrl=normalizeServer($('zmpServer')?$('zmpServer').value:serverUrl);LS.set('zayroMpServer',serverUrl);
  busy=true;setStatus('Connecting…');render();
  try{await connect();wantOpen=true;send({t:'create',name:nm,car:curCar()});}catch(e){busy=false;setStatus(e.message);render();}
}
async function doJoin(){
  const nm=readName();if(!nm)return;
  const code=String($('zmpCode').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length<4){setStatus('Enter the 5-letter room code.');render();return;}
  me.name=nm;serverUrl=normalizeServer($('zmpServer')?$('zmpServer').value:serverUrl);LS.set('zayroMpServer',serverUrl);
  busy=true;setStatus('Connecting…');render();
  try{await connect();wantOpen=true;send({t:'join',code,name:nm,car:curCar()});}catch(e){busy=false;setStatus(e.message);render();}
}
function curCar(){try{return typeof selectedCar==='number'?selectedCar:0;}catch(_){return 0;}}
function readName(){
  const el=$('zmpName');const v=String((el&&el.value)||me.name||'').trim();
  if(v.length<2||v.length>20){setStatus('Racing name must be 2–20 characters.');render();return '';}
  return v;
}

function render(){
  const body=$('zmpBody');if(!body)return;
  const keep={name:$('zmpName')&&$('zmpName').value,code:$('zmpCode')&&$('zmpCode').value,server:$('zmpServer')&&$('zmpServer').value};
  body.innerHTML=room?roomView():connectView(keep);
  bind();
}
function connectView(keep){
  const name=keep.name!=null?keep.name:me.name,code=keep.code||'',srv=keep.server!=null?keep.server:serverUrl;
  const needServer=!serverUrl;
  return '<div class="zmp-eyebrow">ZAYRO RACING · ONLINE</div><h2>MULTIPLAYER</h2>'+
    '<p class="zmp-sub">Race a friend in a private room. Create a room and share the code, or enter a code to join.</p>'+
    '<label class="zmp-l">RACING NAME</label><input id="zmpName" maxlength="20" autocomplete="nickname" value="'+esc(name)+'" placeholder="Your name">'+
    '<div class="zmp-row"><button id="zmpCreate" class="zmp-btn gold" '+(busy?'disabled':'')+'>CREATE PRIVATE ROOM</button></div>'+
    '<div class="zmp-or">— OR JOIN —</div>'+
    '<div class="zmp-row"><input id="zmpCode" class="zmp-codein" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ROOM CODE" value="'+esc(code)+'"><button id="zmpJoin" class="zmp-btn" '+(busy?'disabled':'')+'>JOIN</button></div>'+
    '<details class="zmp-adv" '+(needServer?'open':'')+'><summary>SERVER</summary><input id="zmpServer" value="'+esc(srv)+'" placeholder="wss://your-server.example.com" spellcheck="false" autocapitalize="off"><small>Address of your ZAYRO multiplayer server (see README). Saved on this device.</small></details>'+
    '<div id="zmpStatus" class="zmp-status">'+esc(statusMsg)+'</div>';
}
function roomView(){
  const isHost=me.pid===hostId,st=room.settings||{},lobby=room.state==='lobby';
  const slots=[];
  for(let i=0;i<room.capacity;i++){
    const p=room.players[i];
    slots.push(p?'<li class="'+(p.pid===me.pid?'me':'')+'"><i style="background:'+PAINT_CSS[i%4]+'"></i><span class="zmp-pn">'+esc(p.name)+(p.pid===me.pid?' <small>(YOU)</small>':'')+(p.host?' <b class="zmp-host">HOST</b>':'')+'</span><em class="'+(!p.connected?'off':p.ready?'on':'')+'">'+(!p.connected?'DISCONNECTED':p.ready?'READY':'NOT READY')+'</em></li>':'<li class="empty"><i></i><span class="zmp-pn">Waiting for player…</span><em></em></li>');
  }
  const meP=room.players.find(p=>p.pid===me.pid)||{};
  const nRoads=(typeof roadChoices!=='undefined'&&roadChoices.length)||5;
  const sel=(id,opts,val)=>'<select id="'+id+'" '+(isHost&&lobby?'':'disabled')+'>'+opts.map(o=>'<option value="'+o[0]+'" '+(String(o[0])===String(val)?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';
  const stageOpts=[1,2,3,4,5].map(n=>[n,'Stage '+n+(typeof stageNames!=='undefined'?' · '+stageNames[n-1]:'')]);
  const roadOpts=[];for(let i=0;i<nRoads;i++)roadOpts.push([i,(typeof roadChoices!=='undefined'&&roadChoices[i]?roadChoices[i].name:'Road '+(i+1))]);
  const canStart=isHost&&lobby&&room.players.filter(p=>p.connected).length>=room.minPlayers&&room.players.every(p=>!p.connected||p.ready);
  return '<div class="zmp-eyebrow">PRIVATE ROOM · '+(lobby?'LOBBY':room.state.toUpperCase())+'</div>'+
    '<div class="zmp-code" title="Tap to copy" id="zmpCodeBig">'+esc(room.code)+'</div><div class="zmp-copyhint" id="zmpCopyHint">TAP CODE TO COPY · SHARE IT WITH YOUR FRIEND</div>'+
    '<ul class="zmp-players">'+slots.join('')+'</ul>'+
    '<div class="zmp-set"><label>STAGE'+sel('zmpStage',stageOpts,st.stage)+'</label><label>EVENT'+sel('zmpEvent',[['circuit','Circuit'],['sprint','Sprint (800 m)']],st.event)+'</label><label>ROAD'+sel('zmpRoad',roadOpts,st.road)+'</label></div>'+
    (isHost?'':'<div class="zmp-note">Only the host can change race settings.</div>')+
    '<div class="zmp-row">'+
      '<button id="zmpReady" class="zmp-btn '+(meP.ready?'':'gold')+'" '+(lobby?'':'disabled')+'>'+(meP.ready?'✓ READY — TAP TO CANCEL':'I AM READY')+'</button>'+
      (isHost?'<button id="zmpStart" class="zmp-btn gold" '+(canStart?'':'disabled')+'>START RACE</button>':'')+
    '</div>'+
    '<div class="zmp-row"><button id="zmpLeave" class="zmp-btn ghost">LEAVE ROOM</button><span class="zmp-ping">PING <b id="zmpPing">'+(MP.ping!=null?MP.ping+' ms':'—')+'</b></span></div>'+
    '<div id="zmpStatus" class="zmp-status">'+esc(statusMsg)+'</div>'+
    (lastResults?resultsTable():'');
}
function resultsTable(){
  const R=window.ZAYRO_RESULTS,m=lastResults;
  return '<div class="zmp-res"><div class="zmp-eyebrow">LAST RACE · SERVER RESULT</div><ol>'+m.rows.map(r=>'<li class="'+(r.pid===me.pid?'me':'')+'"><b>'+(r.position?(R?R.ordinal(r.position):r.position):'DNF')+'</b><span>'+esc(r.name)+'</span><em>'+(r.timeMs!=null?fmtMs(r.timeMs):(r.reason||'did not finish'))+'</em></li>').join('')+'</ol></div>';
}
function fmtMs(ms){const s=ms/1000,m=Math.floor(s/60);return String(m).padStart(2,'0')+':'+(s-m*60).toFixed(2).padStart(5,'0');}
function renderResultsBanner(){}
function bind(){
  const on=(id,fn)=>{const e=$(id);if(e)e.onclick=fn;};
  on('zmpCreate',doCreate);on('zmpJoin',doJoin);
  const code=$('zmpCode');if(code)code.addEventListener('input',()=>{code.value=code.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});
  [$('zmpName'),$('zmpCode')].forEach(e=>{if(e)e.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')(e.id==='zmpCode'?doJoin:doCreate)();});});
  const srv=$('zmpServer');if(srv)srv.addEventListener('keydown',ev=>ev.stopPropagation());
  on('zmpReady',()=>{const p=room.players.find(x=>x.pid===me.pid);send({t:'ready',ready:!(p&&p.ready)});});
  on('zmpStart',()=>send({t:'start'}));
  on('zmpLeave',()=>MP.leave());
  on('zmpCodeBig',()=>{try{navigator.clipboard.writeText(room.code);const h=$('zmpCopyHint');if(h)h.textContent='✓ CODE COPIED';}catch(_){}});
  const chg=()=>send({t:'settings',stage:+$('zmpStage').value,event:$('zmpEvent').value,road:+$('zmpRoad').value});
  ['zmpStage','zmpEvent','zmpRoad'].forEach(id=>{const e=$(id);if(e)e.onchange=chg;});
}

/* ------------------------------------------------------------------ boot */
function boot(){
  build();install();
  // same-tab reload while in a room: take the seat back
  try{
    const s=JSON.parse(SS.get('zayroMpSession')||'null');
    if(s&&s.code&&s.token&&s.server){
      serverUrl=s.server;me.name=s.name||'';me.code=s.code;me.token=s.token;wantOpen=true;
      connect().then(()=>send({t:'rejoin',code:s.code,token:s.token})).catch(()=>{SS.del('zayroMpSession');resetRoom();});
    }
  }catch(_){}
  updateChip();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
/* test hook (read-only helpers used by the automated browser tests) */
MP._debug={get race(){return race;},get snaps(){return snaps;},get room(){return room;},get me(){return me;},get ranking(){return ranking;}};
})();
