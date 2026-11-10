/* (v3.1: NO finishing position is printed on the certificate or in its file name, offline or online.)
   ZAYRO RACING — CHAMPION REWARDS v3.0 (Collector Edition + finishing-position certificates)
   v3: the certificate now carries the REAL finishing position (1ST/2ND/3RD/4TH...), race mode and, for online races, the
   server-verified result (window.ZAYRO_RESULT, see zayro_results.js / zayro_mp.js). One certificate is stored per race.
   Players who did not finish never reach this code path (no finish screen), and online results that the server has not
   confirmed yet show a waiting state instead of a certificate.
   --- original v2.0 notes ---
   ZAYRO RACING — CHAMPION REWARDS v2.0 (Collector Edition)
   Shows a PDF certificate download only after the existing race-finish screen opens.
   Offline-capable: builds a self-contained A4 landscape vector PDF (no external libraries, no images).
   v2: gold-foil gradients, laurel wreath + trophy, wax-style seal, chequered-flag borders,
       exact Helvetica/Times font metrics for perfectly centred text, medal-aware (Gold / Silver),
       dark collector edition + print-friendly light edition. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const STAGES=['City Sprint','Rush Hour','Skyline Pro','Grand Prix','World Champion'];
  const STORAGE_KEY='zayroCertificates';
  let activeKey='', activeRecord=null, lastFinishSignature='', activeBlob=null;
  const safeName=s=>String(s||'Driver').replace(/[<>"'&]/g,'').replace(/\s+/g,' ').trim().slice(0,30)||'Driver';
  const pdfText=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const dateLabel=iso=>{try{return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'});}catch(_){return String(iso||'');}};
  function readStore(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return x&&typeof x==='object'?x:{};}catch(_){return {};}}
  function saveStore(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(_){}}
  function makeId(){const bytes=new Uint8Array(6);try{crypto.getRandomValues(bytes);}catch(_){for(let i=0;i<bytes.length;i++)bytes[i]=Math.random()*256;}return 'ZR-'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();}
  function getCurrentStage(){const raw=Number.parseInt(($('stageNumber')?.textContent||'1').replace(/\D/g,''),10);return Math.max(1,Math.min(5,Number.isFinite(raw)?raw:1));}
  function getCurrentPlayer(){let n='';try{n=localStorage.getItem('apexPlayerName')||'';}catch(_){}return safeName(n||'Driver');}
  function getCurrentTime(){return ($('timer')?.textContent||'00:00.00').trim();}
  function getCurrentMedal(){return /silver/i.test(($('trophyAward')?.className||''))?'silver':'gold';}
  function getCurrentSpeed(){return (($('finishSpeed')?.textContent)||'').trim()||'--- KM/H';}

  function ensurePanel(){
    const finish=$('finish'); if(!finish)return null;
    let panel=$('zayroCertificatePanel'); if(panel)return panel;
    const box=finish.querySelector('.pause-box'); if(!box)return null;
    panel=document.createElement('section');panel.id='zayroCertificatePanel';panel.setAttribute('aria-live','polite');
    panel.innerHTML=
      '<div class="zr-cert-card" aria-hidden="true">'+
        '<span class="zr-cert-flag"></span>'+
        '<span class="zr-cert-card-k">CERTIFICATE OF ACHIEVEMENT</span>'+
        '<span class="zr-cert-cup">🏆</span>'+
        '<b class="zr-cert-card-name" id="zayroCertName">DRIVER</b>'+
        '<span class="zr-cert-card-stage" id="zayroCertStage">STAGE 01</span>'+
        '<strong class="zr-cert-card-place" id="zayroCertPlace">1ST PLACE</strong>'+
        '<em class="zr-cert-card-medal" id="zayroCertMedal">GOLD WORLD CUP</em>'+
        '<span class="zr-cert-flag"></span>'+
      '</div>'+
      '<p class="zr-cert-copy">Aapka certificate tayyar hai. Gold foil design, trophy aur founder ke signature ke saath A4 PDF.</p>'+
      '<button type="button" class="zr-cert-download" id="zayroCertificateDownload">⬇ DOWNLOAD MY CERTIFICATE · PDF</button>'+
      '<button type="button" class="zr-cert-alt" id="zayroCertificateLight">PRINT-FRIENDLY VERSION (LIGHT PAPER)</button>'+
      '<small class="zr-cert-id" id="zayroCertificateId"></small><small class="zr-cert-error" id="zayroCertificateError"></small>';
    const speed=box.querySelector('.finish-speed-panel');
    if(speed)speed.insertAdjacentElement('beforebegin',panel);else box.appendChild(panel);
    $('zayroCertificateDownload').addEventListener('click',()=>downloadActiveCertificate('dark'));
    $('zayroCertificateLight').addEventListener('click',()=>downloadActiveCertificate('light'));
    return panel;
  }
  const ordinalOf=n=>{n=Math.max(1,Math.floor(Number(n)||1));const a=n%100,b=n%10;return n+((a>=11&&a<=13)?'TH':b===1?'ST':b===2?'ND':b===3?'RD':'TH');};
  const ORD=n=>{n=Math.max(1,Math.floor(Number(n)||1));const a=n%100,b=n%10;return n+((a>=11&&a<=13)?'TH':b===1?'ST':b===2?'ND':b===3?'RD':'TH');};
  /* Adapter: zayro_results.js publishes window.ZAYRO_RESULT (single-player = computed vs the AI rivals, multiplayer = signed by the server). */
  const raceResult=()=>{try{
    const r=window.ZAYRO_RESULT;if(!r)return null;
    return {mode:r.mode==='multi'?'online':'solo',status:r.status==='ready'?'final':r.status,id:r.id,stage:r.stage,event:r.event,
      ranked:false,position:null,total:null,   /* offline races: no position on the certificate (online only) */
      verified:!!r.verified,serverSig:r.sig||'',
      finishedAt:r.date,timeText:r.timeText,finishSpeedKmh:r.finishSpeed};
  }catch(_){return null;}};
  const medalForPosition=p=>p===1?'gold':p===2?'silver':p===3?'bronze':'finisher';
  const MEDAL_LABEL={gold:'GOLD MEDAL',silver:'SILVER MEDAL',bronze:'BRONZE MEDAL',finisher:'FINISHER'};
  const MAX_RECORDS=80;
  function pruneStore(records){
    const keys=Object.keys(records);if(keys.length<=MAX_RECORDS)return;
    keys.sort((a,b)=>String(records[a].completedAt||'').localeCompare(String(records[b].completedAt||'')));
    for(const k of keys.slice(0,keys.length-MAX_RECORDS))delete records[k];
  }
  function setPanelText(rec,waiting){
    const set=(id,t)=>{const e=$(id);if(e)e.textContent=t;};
    set('zayroCertName',rec.player.toUpperCase());
    set('zayroCertStage',`STAGE ${String(rec.stage).padStart(2,'0')} · ${rec.stageName.toUpperCase()}`);
    if(waiting){
      set('zayroCertPlace','CONFIRMING POSITION…');
      set('zayroCertMedal','WAITING FOR SERVER RESULT');
      set('zayroCertificateId','Online races are ranked by the server. Your certificate unlocks the moment your finishing position is confirmed.');
      return;
    }
    if(false){
      set('zayroCertPlace',`${ORD(rec.position)} PLACE`+(rec.total>1?` · OF ${rec.total}`:''));
      set('zayroCertMedal',MEDAL_LABEL[rec.medal]||'FINISHER');
    }else{
      set('zayroCertPlace',rec.event==='timeTrial'?'TIME TRIAL · SOLO RUN':'STAGE COMPLETED');
      set('zayroCertMedal',(rec.medal==='silver'?'SILVER':'GOLD')+' WORLD CUP');
    }
    set('zayroCertificateId',`CERTIFICATE ID · ${rec.certificateId}  |  RACED ${dateLabel(rec.completedAt)}`+(rec.verified?`  |  SERVER VERIFIED ${String(rec.serverSig||'').slice(0,8).toUpperCase()}`:''));
  }
  function prepareCertificate(){
    const finish=$('finish'),title=$('finishTitle');
    if(!finish||finish.classList.contains('hidden')||!title)return;
    const titleText=(title.textContent||'').trim().toUpperCase();
    if(!/(STAGE CLEARED|SPRINT COMPLETE|TIME TRIAL COMPLETE|WORLD CHAMPION)/.test(titleText))return;
    if($('outScreen')&&!$('outScreen').classList.contains('hidden'))return;
    const stage=getCurrentStage(),player=getCurrentPlayer(),stageName=STAGES[stage-1]||`Stage ${stage}`,R=raceResult();
    const panel=ensurePanel();
    // Online race whose position the server has not confirmed yet: show the waiting state, issue nothing.
    if(false){
      activeRecord=null;activeKey='';lastFinishSignature='';
      if(panel){
        panel.classList.remove('hidden');panel.dataset.medal='silver';
        setPanelText({player,stage,stageName},true);
        const btn=$('zayroCertificateDownload'),lb=$('zayroCertificateLight');
        if(btn){btn.disabled=true;btn.textContent='⏳ WAITING FOR SERVER-VERIFIED POSITION';}
        if(lb)lb.disabled=true;
      }
      return;
    }
    // An online race that ended without a finish gets no certificate.
    if(R&&R.status==='dnf'){if(panel)panel.classList.add('hidden');return;}
    const useRace=!!(R&&(R.status==='final'||R.status==='pending')&&R.id&&R.stage===stage);
    const medal=useRace&&R.ranked&&R.position?medalForPosition(R.position):getCurrentMedal();
    const signature=`${player.toLowerCase()}|${stage}|${titleText}|${useRace?R.id:getCurrentTime()}|${medal}`;
    if(signature===lastFinishSignature&&activeRecord)return;
    lastFinishSignature=signature;
    const records=readStore();
    let key,rec;
    if(useRace){
      key=`${player.toLowerCase()}::${stage}::${R.id}`;
      if(!records[key]){
        records[key]={player,stage,stageName,certificateId:makeId(),completedAt:R.finishedAt||new Date().toISOString(),
          completionTime:R.timeText||getCurrentTime(),finishSpeed:R.finishSpeedKmh!=null?`${R.finishSpeedKmh} KM/H`:getCurrentSpeed(),
          medal,founder:'Rihan',raceId:R.id,mode:R.mode||'solo',event:R.event||'circuit',
          position:R.ranked&&R.position?R.position:null,total:R.total||null,
          verified:!!R.verified,serverSig:R.serverSig||''};
      }
      rec=records[key];rec.player=player;rec.stageName=stageName;rec.founder='Rihan';
      pruneStore(records);
    }else{
      // Legacy path (no race result available): behave exactly like certificate v2.
      key=`${player.toLowerCase()}::${stage}`;
      if(!records[key])records[key]={player,stage,stageName,certificateId:makeId(),completedAt:new Date().toISOString(),completionTime:getCurrentTime(),finishSpeed:getCurrentSpeed(),medal,founder:'Rihan'};
      else{
        const r=records[key];r.player=player;r.stageName=stageName;r.founder='Rihan';
        if(medal==='gold'||!r.medal)r.medal=medal;
        if(!r.finishSpeed)r.finishSpeed=getCurrentSpeed();
      }
      rec=records[key];
    }
    saveStore(records);activeKey=key;activeRecord=rec;
    if(!panel)return;
    panel.classList.remove('hidden');
    panel.dataset.medal=activeRecord.medal||'gold';
    setPanelText(activeRecord,false);
    const btn=$('zayroCertificateDownload');if(btn){btn.disabled=false;btn.textContent='⬇ DOWNLOAD MY CERTIFICATE · PDF';}
    const lb=$('zayroCertificateLight');if(lb)lb.disabled=false;
    const err=$('zayroCertificateError');if(err){err.style.display='none';err.textContent='';}
    // v3: the PDF is generated automatically as soon as the race is confirmed, so the download is instant.
    try{activeBlob={dark:buildCertificatePDF(activeRecord,'dark'),light:null};}catch(e){activeBlob=null;console.error('ZAYRO certificate auto-build',e);}
  }

  /* ------------------------------------------------------------------ PDF engine ------------------------------------------------------------------ */
  // Exact Adobe font metrics (1000 units/em) for ASCII 32-126, so every line is centred precisely in any viewer.
  // F1 Helvetica · F2 Helvetica-Bold · F3 Times-Roman · F4 Times-Bold · F5 Times-BoldItalic · F6 Times-Italic
  const WID={F1:[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584],F2:[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584],F3:[250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541],F4:[250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520],F5:[250,389,555,500,500,833,778,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,832,667,667,667,722,667,667,722,778,389,500,667,611,889,722,722,611,722,667,556,611,722,667,889,667,611,611,333,278,333,570,500,333,500,500,444,500,444,333,500,556,278,278,500,278,778,556,500,500,500,389,389,278,556,444,667,500,444,389,348,220,348,570],F6:[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541]};
  const f=n=>{const v=Math.round(Number(n)*100)/100;return String(v===0?0:v);};
  function tw(text,font,size,track){let w=0;for(const ch of String(text)){const c=ch.charCodeAt(0);w+=((WID[font]&&WID[font][c-32])||556)*size/1000;}return w+(track||0)*Math.max(0,String(text).length-1);}
  function fit(text,font,size,track,maxW,min){let s=size;while(s>(min||10)&&tw(text,font,s,track)>maxW)s-=.5;return s;}
  const rg=c=>`${f(c[0])} ${f(c[1])} ${f(c[2])}`;
  const K=.5523;
  const ell=(cx,cy,rx,ry)=>`${f(cx+rx)} ${f(cy)} m ${f(cx+rx)} ${f(cy+K*ry)} ${f(cx+K*rx)} ${f(cy+ry)} ${f(cx)} ${f(cy+ry)} c ${f(cx-K*rx)} ${f(cy+ry)} ${f(cx-rx)} ${f(cy+K*ry)} ${f(cx-rx)} ${f(cy)} c ${f(cx-rx)} ${f(cy-K*ry)} ${f(cx-K*rx)} ${f(cy-ry)} ${f(cx)} ${f(cy-ry)} c ${f(cx+K*rx)} ${f(cy-ry)} ${f(cx+rx)} ${f(cy-K*ry)} ${f(cx+rx)} ${f(cy)} c h `;
  const poly=pts=>pts.map((p,i)=>`${f(p[0])} ${f(p[1])} ${i?'l':'m'}`).join(' ')+' h ';
  function stops(list){ // list of [t,[r,g,b]] → PDF stitching function
    const fns=[],bounds=[],enc=[];
    for(let i=0;i<list.length-1;i++){fns.push(`<< /FunctionType 2 /Domain [0 1] /C0 [${rg(list[i][1])}] /C1 [${rg(list[i+1][1])}] /N 1 >>`);enc.push('0 1');if(i<list.length-2)bounds.push(f(list[i+1][0]));}
    return `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${enc.join(' ')}] >>`;
  }
  const FOIL={
    gold:{dark:[[0,[.55,.37,.09]],[.22,[.96,.80,.40]],[.5,[.76,.54,.14]],[.78,[1,.91,.60]],[1,[.56,.38,.10]]],
          light:[[0,[.38,.25,.05]],[.25,[.80,.60,.22]],[.5,[.52,.35,.08]],[.78,[.86,.67,.28]],[1,[.40,.27,.06]]]},
    bronze:{dark:[[0,[.40,.22,.09]],[.22,[.90,.60,.34]],[.5,[.62,.36,.16]],[.78,[.97,.74,.50]],[1,[.42,.24,.10]]],
            light:[[0,[.30,.16,.06]],[.25,[.72,.45,.22]],[.5,[.44,.25,.10]],[.78,[.80,.54,.30]],[1,[.32,.18,.07]]]},
    silver:{dark:[[0,[.42,.45,.49]],[.22,[.94,.96,.98]],[.5,[.60,.63,.68]],[.78,[.98,.99,1]],[1,[.45,.48,.53]]],
            light:[[0,[.28,.30,.34]],[.25,[.62,.65,.70]],[.5,[.36,.38,.43]],[.78,[.70,.73,.78]],[1,[.30,.32,.36]]]}
  };
  const PAL={
    dark:{bg:[.043,.055,.063],ink:[.96,.93,.85],muted:[.68,.68,.63],gold:[.80,.60,.20],goldHi:[.96,.82,.48],sealDisc:[.06,.08,.09],rosetteA:.075},
    light:{bg:[.985,.972,.93],ink:[.09,.11,.11],muted:[.36,.37,.34],gold:[.62,.44,.12],goldHi:[.80,.62,.26],sealDisc:[.07,.09,.10],rosetteA:.11}
  };

  function buildCertificatePDF(r,theme){
    theme=theme==='light'?'light':'dark';
    const P=PAL[theme],rank=0;
    const medal=r.medal==='bronze'?'bronze':(r.medal==='silver'||r.medal==='finisher')?'silver':'gold';
    const medalName=r.medal==='finisher'?'FINISHER':medal==='bronze'?'BRONZE':medal==='silver'?'SILVER':'GOLD';
    const W=842,H=595;
    let c='';
    const fillSh=(path,x,y,w,h,sh)=>`q ${path}W n q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(y)} cm /${sh} sh Q Q\n`;
    const textAt=(x,y,font,size,text,col,track)=>`q ${rg(col)} rg BT /${font} ${size} Tf ${f(track||0)} Tc ${f(x)} ${f(y)} Td (${pdfText(text)}) Tj ET Q\n`;
    const center=(cx,y,font,size,text,col,track)=>textAt(cx-tw(text,font,size,track)/2,y,font,size,text,col,track);
    const foilText=(cx,y,font,size,text,track,sh)=>{const w=tw(text,font,size,track),x=cx-w/2;return `q BT /${font} ${size} Tf ${f(track||0)} Tc 7 Tr ${f(x)} ${f(y)} Td (${pdfText(text)}) Tj ET q ${f(w+12)} 0 0 ${f(size*1.05)} ${f(x-6)} ${f(y-size*.22)} cm /${sh} sh Q Q\n`;};
    const stroke=(path,col,w,extra)=>`q ${rg(col)} RG ${f(w)} w ${extra||''} ${path}S Q\n`;
    const fill=(path,col)=>`q ${rg(col)} rg ${path}f Q\n`;
    const alpha=(a,body)=>`q /${a} gs\n${body}Q\n`;
    const MG=medal==='gold'?'G':medal==='bronze'?'B':'S';

    // 1 — paper + guilloche rosette
    c+=fill(`0 0 ${W} ${H} re `,P.bg);
    let ros='';
    for(let i=0;i<18;i++){const a=i*Math.PI/18,co=Math.cos(a),si=Math.sin(a);ros+=`q ${f(co)} ${f(si)} ${f(-si)} ${f(co)} 421 292 cm ${ell(0,0,270,92)}S Q\n`;}
    for(let i=1;i<=9;i++)ros+=`${ell(421,292,i*34,i*34)}S\n`;
    c+=`q /Ar gs ${rg(P.gold)} RG 0.5 w\n${ros}Q\n`;

    // 2 — double frame, corner arcs, diamonds
    c+=stroke(`14 14 ${W-28} ${H-28} re `,P.gold,3);
    c+=stroke(`22 22 ${W-44} ${H-44} re `,P.goldHi,.8);
    for(const [x,y,sx,sy] of [[28,28,1,1],[W-28,28,-1,1],[28,H-28,1,-1],[W-28,H-28,-1,-1]]){
      c+=stroke(`${f(x)} ${f(y+sy*24)} m ${f(x)} ${f(y+sy*9)} ${f(x+sx*9)} ${f(y)} ${f(x+sx*24)} ${f(y)} c `,P.gold,1.6);
      c+=stroke(`${f(x+sx*6)} ${f(y+sy*24)} m ${f(x+sx*6)} ${f(y+sy*14)} ${f(x+sx*14)} ${f(y+sy*6)} ${f(x+sx*24)} ${f(y+sy*6)} c `,P.goldHi,.7);
      c+=fill(poly([[x+sx*3,y+sy*3-4],[x+sx*3+4,y+sy*3],[x+sx*3,y+sy*3+4],[x+sx*3-4,y+sy*3]]),P.gold);
    }

    // 3 — chequered-flag bands (top + bottom)
    const checker=(y0)=>{let p='';for(let row=0;row<2;row++)for(let col=0;col<104;col++)if((row+col)%2===0)p+=`${f(57+col*7)} ${f(y0+row*7)} 7 7 re `;return p;};
    for(const y0 of [549,32]){
      c+=fillSh(checker(y0),57,y0,728,14,'GH');
      c+=stroke(`57 ${y0} 728 14 re `,P.gold,.6);
    }

    // 4 — heading block
    c+=center(421,523,'F2',12,'Z A Y R O   R A C I N G',P.gold,0);
    for(const s of [-1,1]){const x0=421+s*(tw('Z A Y R O   R A C I N G','F2',12,0)/2+16);c+=stroke(`${f(x0)} 527 m ${f(x0+s*86)} 527 l `,P.gold,.9);c+=fill(poly([[x0+s*92,527],[x0+s*96,531],[x0+s*100,527],[x0+s*96,523]]),P.gold);}
    c+=foilText(421,468,'F4',56,'CERTIFICATE',8,'GV');
    c+=center(421,438,'F1',12,'OF ACHIEVEMENT',P.ink,9);

    // 5 — left emblem: laurel wreath + trophy
    const ex=150,ey=290;
    const R=86;
    for(const s of [-1,1]){
      let arc='';
      for(let i=0;i<=24;i++){const ph=(i/24)*Math.PI*.93,x=ex+s*R*Math.sin(ph),y=ey-R*Math.cos(ph);arc+=`${f(x)} ${f(y)} ${i?'l':'m'} `;}
      c+=stroke(arc,P.gold,1.6);
      for(let k=1;k<=13;k++){
        const ph=(k/13.4)*Math.PI*.93,x=ex+s*R*Math.sin(ph),y=ey-R*Math.cos(ph);
        const tx=s*Math.cos(ph),ty=Math.sin(ph),al=Math.atan2(ty,tx),len=21-k*.55;
        for(const side of [-1,1]){
          const be=al+side*s*.62,L=len,w=L*.3,ca=Math.cos(be),sa=Math.sin(be);
          const tip=[x+L*ca,y+L*sa],c1=[x+L*.3*ca-w*sa,y+L*.3*sa+w*ca],c2=[x+L*.8*ca-w*.7*sa,y+L*.8*sa+w*.7*ca],d1=[x+L*.3*ca+w*sa,y+L*.3*sa-w*ca],d2=[x+L*.8*ca+w*.7*sa,y+L*.8*sa-w*.7*ca];
          c+=fill(`${f(x)} ${f(y)} m ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(tip[0])} ${f(tip[1])} c ${f(d2[0])} ${f(d2[1])} ${f(d1[0])} ${f(d1[1])} ${f(x)} ${f(y)} c h `,(k+(side>0?1:0))%2?P.gold:P.goldHi);
        }
      }
    }
    // laurel ribbon knot
    c+=fill(poly([[ex-5,ey-R-4],[ex+5,ey-R-4],[ex+14,ey-R-20],[ex+3,ey-R-14],[ex,ey-R-24],[ex-3,ey-R-14],[ex-14,ey-R-20]]),[.62,.07,.10]);
    // trophy (local coords: origin = base centre, y up)
    const s=1.18,tx0=ex,ty0=ey-62,T=(x,y)=>[tx0+x*s,ty0+y*s];
    const tp=(pts)=>poly(pts.map(p=>T(p[0],p[1])));
    const tb=(x0,y0,x1,y1)=>{const a=T(x0,y0),b=T(x1,y1);return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])];};
    const part=(path,x0,y0,x1,y1,sh)=>{const b=tb(x0,y0,x1,y1);c+=fillSh(path,b[0],b[1],b[2],b[3],sh);};
    // soft glow behind the cup
    c+=alpha('Ag',fill(ell(ex,ey+4,64,64),[.98,.82,.40]));
    // handles
    const hand=sd=>{const a=T(sd*28,94),b1=T(sd*58,96),b2=T(sd*58,58),e=T(sd*22,58);return `${f(a[0])} ${f(a[1])} m ${f(b1[0])} ${f(b1[1])} ${f(b2[0])} ${f(b2[1])} ${f(e[0])} ${f(e[1])} c `;};
    for(const sd of [-1,1]){c+=stroke(hand(sd),[.50,.33,.07],6.2,'1 J');c+=stroke(hand(sd),[.88,.68,.25],4,'1 J');c+=stroke(hand(sd),[1,.93,.65],1.1,'1 J');}
    // base + stem
    part(tp([[-36,0],[36,0],[32,10],[-32,10]]),-36,0,36,10,MG+'H');
    part(tp([[-26,10],[26,10],[21,20],[-21,20]]),-26,10,26,20,MG+'H');
    part(tp([[-7,20],[7,20],[9,38],[-9,38]]),-9,20,9,38,MG+'H');
    part(ell(...T(0,38),12*s,5.5*s),-12,32,12,44,MG+'V');
    part(tp([[-9,43],[9,43],[7,50],[-7,50]]),-9,43,9,50,MG+'H');
    // bowl
    const bw=`${f(T(-31,102)[0])} ${f(T(-31,102)[1])} m ${f(T(31,102)[0])} ${f(T(31,102)[1])} l ${f(T(31,70)[0])} ${f(T(31,70)[1])} ${f(T(21,54)[0])} ${f(T(21,54)[1])} ${f(T(8,50)[0])} ${f(T(8,50)[1])} c ${f(T(-8,50)[0])} ${f(T(-8,50)[1])} l ${f(T(-21,54)[0])} ${f(T(-21,54)[1])} ${f(T(-31,70)[0])} ${f(T(-31,70)[1])} ${f(T(-31,102)[0])} ${f(T(-31,102)[1])} c h `;
    part(bw,-31,50,31,102,MG+'H');
    c+=fill(ell(...T(0,102),31*s,6.5*s),[.22,.15,.04]);
    c+=stroke(ell(...T(0,102),31*s,6.5*s),[1,.92,.62],1.3);
    c+=alpha('Ah',fill(poly([[T(-25,98)[0],T(-25,98)[1]],[T(-21,98)[0],T(-21,98)[1]],[T(-14,60)[0],T(-14,60)[1]],[T(-18,62)[0],T(-18,62)[1]]]),[1,1,1]));
    // star emblem on the bowl
    let st=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?3.8:9.5,p=T(Math.cos(a)*rr,80+Math.sin(a)*rr);st.push(p);}
    c+=fill(poly(st),[1,.94,.66]);
    // sparkles
    for(const [sx,sy,sz] of [[-52,118,7],[54,124,9],[-40,134,5]]){const p=T(sx,sy),z=sz*s;c+=alpha('Ai',fill(poly([[p[0],p[1]+z],[p[0]+z*.22,p[1]+z*.22],[p[0]+z,p[1]],[p[0]+z*.22,p[1]-z*.22],[p[0],p[1]-z],[p[0]-z*.22,p[1]-z*.22],[p[0]-z,p[1]],[p[0]-z*.22,p[1]+z*.22]]),[1,.96,.78]));}

    // 6 — centre column
    const cx=455,maxW=372;
    c+=center(cx,408,'F1',8.5,'THIS CERTIFIES THAT',P.muted,3.4);
    const nm=r.player,ns=fit(nm,'F5',40,0,maxW,18);
    c+=center(cx,362,'F5',ns,nm,P.ink,0);
    const lw=Math.min(maxW,Math.max(250,tw(nm,'F5',ns,0)+40));
    c+=stroke(`${f(cx-lw/2)} 348 m ${f(cx+lw/2)} 348 l `,P.gold,1.1);
    c+=fill(poly([[cx-5,348],[cx,352],[cx+5,348],[cx,344]]),P.gold);
    c+=center(cx,322,'F6',14,'has crossed the finish line of',P.muted,0);
    const stg=`STAGE ${String(r.stage).padStart(2,'0')}  |  ${r.stageName.toUpperCase()}`,ss=fit(stg,'F2',19,2,maxW,11);
    c+=center(cx,291,'F2',ss,stg,P.ink,2);
    if(rank){
      const place=`${ordinalOf(rank)} PLACE`;
      c+=center(cx,262,'F6',13,'and is hereby awarded',P.muted,0);
      c+=foilText(cx,219,'F4',fit(place,'F4',46,5,maxW,22),place,5,MG+'V');
      const sub=r.medal==='finisher'?`FINISHER  |  ${rank} OF ${r.total||'-'} RACERS`:`${medalName} MEDAL  |  ${rank} OF ${r.total||'-'} RACERS`;
      c+=center(cx,195,'F2',11,sub,P.ink,2);
      c+=center(cx,177,'F6',10.5,'for racing skill, focus and determination in ZAYRO RACING.',P.muted,0);
      const fmt=r.mode==='online'?'ONLINE MULTIPLAYER RACE'+(r.verified?'  |  POSITION VERIFIED BY SERVER':''):'SINGLE-PLAYER RACE VS AI RIVALS';
      c+=center(cx,160,'F1',7,fmt,P.muted,2.2);
    }else{
      c+=center(cx,262,'F6',13,'and is hereby awarded the',P.muted,0);
      c+=foilText(cx,229,'F4',fit(`${medalName} WORLD CUP`,'F4',30,4,maxW,16),`${medalName} WORLD CUP`,4,MG+'V');
      c+=center(cx,205,'F6',10.5,'for racing skill, focus and determination in ZAYRO RACING.',P.muted,0);
      if(r.event==='timeTrial')c+=center(cx,187,'F1',7,'SOLO TIME TRIAL  |  NO RIVALS  |  NOT A RANKED RACE',P.muted,2.2);
    }

    // 7 — right emblem: ribbon tails + scalloped seal
    const sx=712,sy=292;
    for(const sd of [-1,1]){
      c+=fill(poly([[sx+sd*10,sy-34],[sx+sd*34,sy-26],[sx+sd*28,sy-96],[sx+sd*20,sy-82],[sx+sd*8,sy-92]]),sd<0?[.58,.06,.09]:[.70,.09,.12]);
      c+=stroke(poly([[sx+sd*10,sy-34],[sx+sd*34,sy-26],[sx+sd*28,sy-96],[sx+sd*20,sy-82],[sx+sd*8,sy-92]]),P.gold,.8);
    }
    const burst=[];for(let i=0;i<48;i++){const a=i*Math.PI/24,rr=i%2?47:52;burst.push([sx+Math.cos(a)*rr,sy+Math.sin(a)*rr]);}
    c+=alpha('Ag',fill(ell(sx,sy,64,64),[.98,.82,.40]));
    c+=fillSh(poly(burst),sx-52,sy-52,104,104,MG+'V');
    c+=stroke(ell(sx,sy,43,43),[.30,.20,.05],1.4);
    c+=fill(ell(sx,sy,41,41),P.sealDisc);
    c+=stroke(ell(sx,sy,37,37),P.goldHi,.8,'[1.6 2.2] 0 d');
    let st2=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,rr=i%2?3.4:8.2;st2.push([sx+Math.cos(a)*rr,sy+24+Math.sin(a)*rr]);}
    c+=fill(poly(st2),P.goldHi);
    c+=foilText(sx,sy+2,'F2',13,'ZAYRO',2.4,MG+'V');
    c+=center(sx,sy-8,'F1',6.2,'R A C I N G',[.86,.84,.78],0);
    c+=center(sx,sy-19,'F2',5.6,rank?(r.medal==='finisher'?'FINISHER':`${medalName} MEDAL`):`${medalName} CUP`,P.goldHi,1.6);
    c+=center(sx,sy-29,'F1',rank?5.6:5,rank?`${ordinalOf(rank)} PLACE`:`STAGE ${String(r.stage).padStart(2,'0')}`,rank?P.ink:[.7,.7,.66],1.6);

    // 8 — signature row
    const cols=[157.5,332.5,507.5,682.5],labelY=84,valY=108;
    for(const x of cols)c+=stroke(`${f(x-66)} 101 m ${f(x+66)} 101 l `,P.gold,.8);
    c+=center(cols[0],valY,'F5',27,'Rihan',P.ink,0);
    c+=center(cols[0],labelY,'F1',6.6,'GAME FOUNDER',P.muted,2.2);
    c+=center(cols[1],valY,'F2',12.5,dateLabel(r.completedAt).toUpperCase(),P.ink,.6);
    c+=center(cols[1],labelY,'F1',6.6,'DATE OF COMPLETION',P.muted,2.2);
    c+=center(cols[2],valY,'F2',14,r.completionTime||'--:--.--',P.ink,1);
    c+=center(cols[2],labelY,'F1',6.6,'RACE TIME',P.muted,2.2);
    c+=center(cols[3],valY,'F2',14,String(r.finishSpeed||'--- KM/H').toUpperCase(),P.ink,.6);
    c+=center(cols[3],labelY,'F1',6.6,'FINISH SPEED',P.muted,2.2);
    c+=center(421,66,'F1',7,`CERTIFICATE ID   ${r.certificateId}`+(r.verified&&r.serverSig?`   |   SERVER VERIFIED ${String(r.serverSig).slice(0,8).toUpperCase()}`:''),P.muted,1.6);
    c+=center(421,55.5,'F1',5.6,'IN-GAME ACHIEVEMENT AWARD  |  NOT AN ACCREDITED QUALIFICATION',P.muted,1.3);

    // ---- assemble PDF (ASCII only, so xref byte offsets are exact) ----
    const shade=(id,x0,y0,x1,y1,list)=>`/${id} << /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${x0} ${y0} ${x1} ${y1}] /Extend [true true] /Function ${stops(list)} >>`;
    const gold=FOIL.gold[theme],silver=FOIL.silver[theme],bronze=FOIL.bronze[theme],use=medal==='gold'?gold:silver;
    const res=`<< /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R /F5 8 0 R /F6 9 0 R >> /Shading << ${shade('GH',0,0,1,0,gold)} ${shade('GV',0,0,0,1,gold)} ${shade('SH',0,0,1,0,silver)} ${shade('SV',0,0,0,1,silver)} ${shade('BH',0,0,1,0,bronze)} ${shade('BV',0,0,0,1,bronze)} >> /ExtGState << /Ar << /ca ${P.rosetteA} /CA ${P.rosetteA} >> /Ag << /ca .08 /CA .08 >> /Ah << /ca .34 /CA .34 >> /Ai << /ca .75 /CA .75 >> >> >>`;
    void use;
    const objects=[];
    objects[1]='<< /Type /Catalog /Pages 2 0 R >>';
    objects[2]='<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources ${res} /Contents 10 0 R >>`;
    const fonts=['Helvetica','Helvetica-Bold','Times-Roman','Times-Bold','Times-BoldItalic','Times-Italic'];
    fonts.forEach((n,i)=>{objects[4+i]=`<< /Type /Font /Subtype /Type1 /BaseFont /${n} /Encoding /WinAnsiEncoding >>`;});
    objects[10]=`<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
    let pdf='%PDF-1.4\n%ZAYRO-CERTIFICATE-V2\n',offsets=[0];
    for(let i=1;i<=10;i++){offsets[i]=pdf.length;pdf+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
    const xref=pdf.length;pdf+='xref\n0 11\n0000000000 65535 f \n';
    for(let i=1;i<=10;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    pdf+=`trailer\n<< /Size 11 /Root 1 0 R /Info << /Title (ZAYRO RACING Certificate) /Author (Rihan) >> >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([pdf],{type:'application/pdf'});
  }

  function downloadActiveCertificate(theme){
    const err=$('zayroCertificateError');
    try{
      if(!activeRecord){prepareCertificate();}
      if(!activeRecord)throw new Error('Finish a race stage first to unlock your certificate.');
      const light=theme==='light';
      const blob=(!light&&activeBlob&&activeBlob.dark)||buildCertificatePDF(activeRecord,light?'light':'dark'),url=URL.createObjectURL(blob),a=document.createElement('a');
      const slug=activeRecord.player.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,24)||'Driver';
      a.href=url;a.download=`ZAYRO-RACING-Stage-${String(activeRecord.stage).padStart(2,'0')}-${slug}-Certificate${light?'-Print':''}.pdf`;
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
      const btn=$(light?'zayroCertificateLight':'zayroCertificateDownload'),orig=light?'PRINT-FRIENDLY VERSION (LIGHT PAPER)':'⬇ DOWNLOAD MY CERTIFICATE · PDF';
      if(btn)btn.textContent='✓ CERTIFICATE PDF DOWNLOADED';
      setTimeout(()=>{if(btn&&btn.isConnected)btn.textContent=orig;},2600);
    }catch(e){if(err){err.textContent=e&&e.message?e.message:'Certificate could not be created. Please try again.';err.style.display='block';}else console.error('ZAYRO certificate',e);}
  }
  try{if(window.__ZR_CERT_TEST)window.__ZR_CERT_TEST.build=buildCertificatePDF;}catch(_){}
  window.ZAYRO_CERT={refresh(){lastFinishSignature='';prepareCertificate();},build:buildCertificatePDF,active:()=>activeRecord};
  function init(){
    const finish=$('finish');if(!finish)return;
    const observer=new MutationObserver(()=>{if(!finish.classList.contains('hidden')){prepareCertificate();}else{activeRecord=null;activeKey='';lastFinishSignature='';}});
    observer.observe(finish,{attributes:true,attributeFilter:['class']});
    if(!finish.classList.contains('hidden'))prepareCertificate();
    finish.addEventListener('transitionend',()=>{if(!finish.classList.contains('hidden'))prepareCertificate();});
  }
  window.addEventListener('zayro:result',()=>{try{lastFinishSignature='';prepareCertificate();}catch(e){console.error('ZAYRO certificate',e);}});
  window.addEventListener('zayro:dnf',()=>{try{activeRecord=null;activeKey='';lastFinishSignature='';const p=$('zayroCertificatePanel');if(p)p.classList.add('hidden');}catch(_){}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
