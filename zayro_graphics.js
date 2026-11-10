'use strict';
/* ZAYRO GRAPHICS v14.0 — loads after zayro_finish.js (base game code untouched except a 3-line fog-density hook in the shader).
   WEATHER+  : STORM (heavy rain, darker sky, lightning + thunder), FOG (real distance fog), SNOW (falling snow, cold light)
   LENS      : rain drops sliding on the camera lens (stronger in a storm, flung upward by speed)
   REFLECTIONS: wet-road mirror reflection of your car (and nearby cars), tail/brake lights streak on the wet asphalt
   SPRAY     : water spray off the rear tyres in rain
   DAMAGE    : visible crash damage on your car (dents, scrapes, hanging bumper), hood smoke, sparks on impact and
               sparks from a dragging bumper
   Quality-aware: PERFORMANCE mode drops reflections and halves particles. Every block is wrapped in try/catch. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduceMotion=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}})();
const LSK='zayroWeatherPlus';
let weather='none';                 // none | storm | fog | snow
try{const w=localStorage.getItem(LSK);if(['storm','fog','snow'].includes(w))weather=w;}catch(_){}
let flash=0,nextBolt=0,boltT=0,boltPts=null;

/* ------------------------------------------------------------------ uniforms */
try{attr.fogX=gl.getUniformLocation(program,'uFogX');gl.useProgram(program);gl.uniform1f(attr.fogX,0);}catch(e){console.error('ZAYRO GRAPHICS uniform',e);}
const isNight=()=>condition==='night'||selectedRoad===4;
const lowQ=()=>graphicsQuality==='performance';

/* ------------------------------------------------------------------ environment colours */
const FOGX={none:0,storm:.6,fog:2.2,snow:1.0};
const _env=envLook;
envLook=function(){
  const o=_env();
  if(weather==='none'&&flash<=0)return o;
  const night=isNight(),dim=night?.2:1;
  const tint={storm:[.30,.33,.38],fog:[.72,.75,.78],snow:[.80,.84,.92]}[weather];
  const mixK={storm:.55,fog:.8,snow:.6}[weather]||0;
  const grade=c=>{
    if(tint){for(let i=0;i<3;i++)c[i]=c[i]*(1-mixK)+tint[i]*dim*mixK;if(weather==='storm'){for(let i=0;i<3;i++)c[i]*=.8;}}
    if(flash>0){const f=flash*.55;for(let i=0;i<3;i++)c[i]=Math.min(1,c[i]+f);}
    return c;
  };
  grade(o.fog);grade(o.clear);grade(o.sky);
  return o;
};
const _dw=drawWorld;
drawWorld=function(vp){
  try{
    gl.uniform1f(attr.fogX,FOGX[weather]||0);
    if(weather!=='none')gl.uniform1f(attr.headlights,1);
  }catch(_){}
  _dw(vp);
};

/* ------------------------------------------------------------------ weather picker (next to the game's own buttons) */
let programmatic=false;
function pick(w){
  weather=w;try{localStorage.setItem(LSK,w);}catch(_){}
  programmatic=true;
  try{
    const want=w==='storm'?'rain':(condition==='rain'?'clear':null);
    if(want&&condition!==want){const b=document.querySelector(`[data-condition="${want}"]`);if(b)b.click();}
  }catch(_){}
  programmatic=false;
  paintButtons();
  if(w==='storm')nextBolt=performance.now()+2500;
}
function paintButtons(){document.querySelectorAll('[data-zgweather]').forEach(b=>b.classList.toggle('selected',b.dataset.zgweather===weather));}
function buildPicker(){
  const first=document.querySelector('[data-condition]');if(!first)return;
  const host=first.parentElement;
  for(const [k,label] of [['storm','⛈ STORM'],['fog','🌫 FOG'],['snow','❄ SNOW']]){
    const b=document.createElement('button');b.type='button';b.className=first.className.replace(/\bselected\b/g,'').trim();
    b.dataset.zgweather=k;b.textContent=label;
    b.addEventListener('click',()=>pick(weather===k?'none':k));
    host.appendChild(b);
  }
  // choosing one of the game's own conditions switches the extras off
  document.querySelectorAll('[data-condition]').forEach(b=>b.addEventListener('click',()=>{if(!programmatic&&weather!=='none'){weather='none';try{localStorage.setItem(LSK,'none');}catch(_){}paintButtons();}}));
  paintButtons();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildPicker,{once:true});else buildPicker();
// restore a saved storm (needs the rain condition underneath)
window.addEventListener('load',()=>{try{if(weather==='storm'&&condition!=='rain'){programmatic=true;const b=document.querySelector('[data-condition="rain"]');if(b)b.click();programmatic=false;}paintButtons();}catch(_){}},{once:true});

/* ------------------------------------------------------------------ 2D overlay: lens drops, snow, lightning bolt */
const cvs=document.createElement('canvas');cvs.id='zgFx';cvs.setAttribute('aria-hidden','true');document.body.appendChild(cvs);
const fl=document.createElement('div');fl.id='zgFlash';fl.setAttribute('aria-hidden','true');document.body.appendChild(fl);
const cx=cvs.getContext('2d');
let CW=0,CH=0;
function fit(){const s=lowQ()?.35:.5;const w=Math.max(2,Math.round(innerWidth*s)),h=Math.max(2,Math.round(innerHeight*s));if(w!==CW||h!==CH){CW=cvs.width=w;CH=cvs.height=h;}}
const drops=[],flakes=[];
function spawnDrop(storm){
  drops.push({x:Math.random()*CW,y:Math.random()*CH*.9,r:(1.2+Math.random()*2.6)*(CW/480+.6),life:0,max:3+Math.random()*5,vy:0,hold:Math.random()*1.2});
  if(drops.length>(lowQ()?16:storm?70:42))drops.shift();
}
function spawnFlake(first){flakes.push({x:Math.random()*CW,y:first?Math.random()*CH:-4,z:.35+Math.random()*.9,ph:Math.random()*6.28});}
function thunder(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    thunder.ac=thunder.ac||new AC();const ac=thunder.ac;if(ac.state==='suspended')ac.resume();
    const len=ac.sampleRate*2.6,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
    for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.4*Math.pow(1-i/len,1.6);}
    const src=ac.createBufferSource(),lp=ac.createBiquadFilter(),g=ac.createGain();
    src.buffer=buf;lp.type='lowpass';lp.frequency.value=170;g.gain.value=.9;
    src.connect(lp);lp.connect(g);g.connect(ac.destination);src.start(ac.currentTime+.35+Math.random()*1.2);
  }catch(_){}
}
function bolt(){
  flash=1;boltT=performance.now();setTimeout(()=>{flash=Math.max(flash,.6);},110);
  const x0=CW*(.15+Math.random()*.7);boltPts=[[x0,0]];let x=x0,y=0;
  while(y<CH*.45){y+=CH*(.03+Math.random()*.05);x+=(Math.random()-.5)*CW*.08;boltPts.push([x,y]);}
  thunder();
}
let lastT=performance.now(),acc=0;
function fxLoop(now){
  requestAnimationFrame(fxLoop);
  const dt=Math.min(.1,(now-lastT)/1000);lastT=now;
  acc+=dt;if(acc<(lowQ()?1/20:1/30))return;const step=acc;acc=0;
  try{
    const run=typeof running!=='undefined'&&running&&!paused;
    const rain=condition==='rain',storm=weather==='storm',snow=weather==='snow';
    flash=Math.max(0,flash-step*4.5);
    if(!reduceMotion)fl.style.opacity=flash>0?String((flash*.32).toFixed(3)):'0';
    if(storm&&run&&!reduceMotion&&now>nextBolt){bolt();nextBolt=now+6000+Math.random()*9000;}
    if(!rain&&!snow&&!boltPts&&!drops.length&&!flakes.length){if(CW)cx.clearRect(0,0,CW,CH);return;}
    fit();cx.clearRect(0,0,CW,CH);
    const sp=run?Math.abs(player.speed||0):0,k=clamp(sp/70,0,1);

    if(boltPts&&!reduceMotion){
      const a=1-(now-boltT)/420;
      if(a<=0)boltPts=null;else{
        cx.save();cx.globalAlpha=clamp(a,0,1);cx.strokeStyle='#e8f1ff';cx.lineWidth=Math.max(1.5,CW/260);cx.shadowColor='#9cc4ff';cx.shadowBlur=14;
        cx.beginPath();boltPts.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1]));cx.stroke();cx.restore();
      }
    }
    if(rain){
      if(run&&Math.random()<(storm?.85:.4)*step*30*(lowQ()?.5:1))spawnDrop(storm);
      for(let i=drops.length-1;i>=0;i--){
        const d=drops[i];d.life+=step;
        if(d.life>d.max){drops.splice(i,1);continue;}
        if(d.life>d.hold)d.vy+=step*(6+d.r*2);
        d.y+=d.vy*step*8-(k*step*60*(d.r/6));              // gravity vs. speed wind pushing drops up
        d.x+=Math.sin(d.life*3+d.r)*.12+k*(d.x<CW/2?-1:1)*step*14;
        if(d.y>CH+10||d.y<-10){drops.splice(i,1);continue;}
        const a=clamp(1-d.life/d.max,0,1)*.85;
        // trail
        if(d.vy>0.5){cx.globalAlpha=a*.25;cx.fillStyle='rgba(210,225,240,1)';cx.fillRect(d.x-d.r*.28,d.y-d.vy*step*30-d.r,d.r*.56,d.vy*step*30+d.r);}
        const g=cx.createRadialGradient(d.x-d.r*.3,d.y-d.r*.35,d.r*.1,d.x,d.y,d.r);
        g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.35,'rgba(190,210,230,.28)');g.addColorStop(1,'rgba(20,30,40,.35)');
        cx.globalAlpha=a;cx.fillStyle=g;cx.beginPath();cx.ellipse(d.x,d.y,d.r*.82,d.r,0,0,6.283);cx.fill();
      }
      cx.globalAlpha=1;
    }else if(drops.length)drops.length=0;
    if(snow){
      const want=lowQ()?70:150;
      while(flakes.length<want)spawnFlake(flakes.length<want*.9);
      cx.fillStyle='#fff';
      for(let i=flakes.length-1;i>=0;i--){
        const f=flakes[i];f.ph+=step*2;
        f.y+=step*(14+f.z*30+k*40)*(CH/240);f.x+=Math.sin(f.ph)*step*8-k*step*18*f.z;
        if(f.y>CH+4||f.x<-6){flakes.splice(i,1);continue;}
        cx.globalAlpha=.35+f.z*.5;cx.beginPath();cx.arc(f.x,f.y,.4+f.z*1.0*(CW/520+.5),0,6.283);cx.fill();
      }
      cx.globalAlpha=1;
    }else if(flakes.length)flakes.length=0;
  }catch(e){if(!fxLoop.err){fxLoop.err=1;console.error('ZAYRO GRAPHICS fx',e);}}
}
requestAnimationFrame(fxLoop);
window.addEventListener('resize',()=>{CW=0;});

/* ------------------------------------------------------------------ 3D: reflections, damage, particles */
const DIMS=[[.97,1.95],[1.08,2.4],[1.02,2.3],[1.08,2.22],[1.12,2.5],[1.06,2.46],[1.16,2.42],[1.12,2.48]];
const dimOf=s=>DIMS[clamp(Math.floor(s)||0,0,DIMS.length-1)];
const MIR=new Float32Array([1,0,0,0,0,-1,0,0,0,0,1,0,0,.04,0,1]);
function mul4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
let busy=false;
function reflect(_dc,vp,car,color,style,boost){
  busy=true;window.__zgMirror=true;
  const a=weather==='storm'?.30:.24;
  try{
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.depthFunc(gl.ALWAYS);
    gl.uniform1f(attr.alpha,a);
    _dc(mul4(vp,MIR),car,color,style,boost);
  }finally{
    gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(attr.alpha,1);
    window.__zgMirror=false;busy=false;
  }
}

const sparks=[],smoke=[],spray=[];
let tPrev=performance.now(),prevCool=0,sparkAcc=0,smokeAcc=0,sprayAcc=0;
function update(car,style){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-tPrev)/1000));tPrev=now;
  if(typeof running==='undefined'||!running||paused){if(!running){sparks.length=smoke.length=spray.length=0;}prevCool=collisionCooldown;return;}
  const d=dimOf(style),W=d[0],H=d[1],sp=Math.abs(car.speed),fx=Math.sin(car.yaw),fz=Math.cos(car.yaw),dmg=clamp(crashCount,0,3),half=lowQ()?.5:1;
  // impact sparks
  if(collisionCooldown>1.05&&prevCool<=1.05){
    for(let i=0;i<34*half;i++){
      const p=localPoint(car,(Math.random()-.5)*W*1.6,.3+Math.random()*.4,H*(Math.random()<.6?.9:-.2)),a=Math.random()*6.283,v=3+Math.random()*7;
      sparks.push({x:p[0],y:p[1],z:p[2],vx:Math.cos(a)*v+fx*sp*.25,vy:1.5+Math.random()*4,vz:Math.sin(a)*v+fz*sp*.25,t:0,max:.35+Math.random()*.45});
    }
  }
  prevCool=collisionCooldown;
  // dragging bumper sparks
  if(dmg>=2&&sp>22){
    sparkAcc+=dt*(10+sp*.25);
    while(sparkAcc>=1){sparkAcc--;const p=localPoint(car,(Math.random()-.5)*W*.9,.1,H*.95);
      sparks.push({x:p[0],y:.1,z:p[2],vx:-fx*sp*.25+(Math.random()-.5)*2.5,vy:.8+Math.random()*2.6,vz:-fz*sp*.25+(Math.random()-.5)*2.5,t:0,max:.2+Math.random()*.25});}
  }
  // hood smoke
  if(dmg>=1){
    smokeAcc+=dt*(dmg>=2?22:7)*half;
    while(smokeAcc>=1){smokeAcc--;const p=localPoint(car,(Math.random()-.5)*.5,.95,H*.4);
      smoke.push({x:p[0],y:p[1],z:p[2],vx:-fx*sp*.30+(Math.random()-.5)*.6,vy:.9+Math.random()*.9,vz:-fz*sp*.30+(Math.random()-.5)*.6,t:0,max:1.0+Math.random()*1.0,r:.12+Math.random()*.08,dark:dmg>=2});}
  }
  // tyre spray (rain)
  if(condition==='rain'&&sp>24){
    sprayAcc+=dt*(sp*.55)*half;
    while(sprayAcc>=1){sprayAcc--;for(const sd of [-1,1]){const p=localPoint(car,sd*W*.78,.12,-H*.64);
      spray.push({x:p[0],y:.12,z:p[2],vx:-fx*sp*.12+(Math.random()-.5)*1.4+sd*.8,vy:.5+Math.random()*1.3,vz:-fz*sp*.12+(Math.random()-.5)*1.4,t:0,max:.5+Math.random()*.5,r:.09+Math.random()*.07});}}
  }
  for(let i=sparks.length-1;i>=0;i--){const q=sparks[i];q.t+=dt;if(q.t>=q.max){sparks.splice(i,1);continue;}q.vy-=9*dt;q.x+=q.vx*dt;q.y=Math.max(.02,q.y+q.vy*dt);q.z+=q.vz*dt;}
  for(let i=smoke.length-1;i>=0;i--){const q=smoke[i];q.t+=dt;if(q.t>=q.max){smoke.splice(i,1);continue;}q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vx*=1-dt*1.2;q.vz*=1-dt*1.2;}
  for(let i=spray.length-1;i>=0;i--){const q=spray[i];q.t+=dt;if(q.t>=q.max){spray.splice(i,1);continue;}q.vy-=2.2*dt;q.x+=q.vx*dt;q.y=Math.max(.05,q.y+q.vy*dt);q.z+=q.vz*dt;q.vx*=1-dt*1.5;q.vz*=1-dt*1.5;}
  if(smoke.length>200)smoke.splice(0,smoke.length-200);if(spray.length>240)spray.splice(0,spray.length-240);if(sparks.length>160)sparks.splice(0,sparks.length-160);
}
function drawParticles(vp){
  if(!sparks.length&&!smoke.length&&!spray.length)return;
  gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);
  if(sparks.length){
    bind(cubePB,cubeNB);gl.uniform1f(attr.emit,1);gl.uniform3fv(attr.color,[1,.66,.22]);
    for(const q of sparks){const s=.035*(1-q.t/q.max*.5);gl.uniformMatrix4fv(attr.model,false,modelMatrix([q.x,q.y,q.z],[s,s,s*2.4],Math.atan2(q.vx,q.vz)));gl.drawArrays(gl.TRIANGLES,0,36);}
    gl.uniform1f(attr.emit,0);
  }
  if(smoke.length||spray.length){
    bind(spherePB,sphereNB);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
    const n=spherePos.length/3,night=isNight();
    for(const q of smoke){
      const u=q.t/q.max,r=q.r+u*.8,al=Math.pow(1-u,1.3)*(q.dark?.5:.28);
      gl.uniform3fv(attr.color,q.dark?(night?[.05,.05,.06]:[.1,.1,.11]):(night?[.3,.3,.34]:[.78,.78,.8]));
      gl.uniform1f(attr.alpha,al);gl.uniformMatrix4fv(attr.model,false,modelMatrix([q.x,q.y,q.z],[r,r*.8,r],0));gl.drawArrays(gl.TRIANGLES,0,n);
    }
    gl.uniform3fv(attr.color,night?[.32,.34,.4]:[.86,.9,.95]);
    for(const q of spray){
      const u=q.t/q.max,r=q.r+u*.35,al=Math.pow(1-u,1.4)*.2;
      gl.uniform1f(attr.alpha,al);gl.uniformMatrix4fv(attr.model,false,modelMatrix([q.x,q.y,q.z],[r,r*.8,r],0));gl.drawArrays(gl.TRIANGLES,0,n);
    }
    gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(attr.alpha,1);
  }
}
// visible body damage (level = crashes so far, 1..2 before elimination)
function drawDamage(vp,car,style){
  const lv=clamp(crashCount,0,3);if(!lv)return;
  const d=dimOf(style),W=d[0],H=d[1],dark=[.045,.045,.05],metal=[.72,.73,.76],soot=[.02,.02,.022];
  const side=[-1,1,-1];
  for(let i=0;i<lv;i++){
    const sd=side[i],xs=sd*(W*.985);
    for(let k=0;k<3;k++){                                                  // long scrape marks along the flank
      const z=-H*.38+k*H*.3+i*.12,y=.46+k*.045;
      drawPart(vp,car,[xs,y,z],[.008,.026,.2+k*.05],dark);
      drawPart(vp,car,[xs+sd*.003,y+.002,z],[.007,.008,.16+k*.04],metal);
    }
    drawPart(vp,car,[sd*W*.5,.56,H*.985],[W*.28,.15,.02],soot);          // crumpled front corner
    drawPart(vp,car,[sd*W*.5,.56,H*.99],[W*.2,.03,.01],metal);
  }
  if(lv>=2){
    drawPart(vp,car,[0,.2,H*1.0],[W*.78,.028,.13],soot,.45);              // splitter hanging off
    drawPart(vp,car,[W*.38,.5,H*.5],[.2,.012,.32],soot,0);                // scorched hood patch
    drawPart(vp,car,[-W*.3,.52,H*.62],[.24,.012,.18],dark,0);
  }
}
const _dc=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  const isP=car===player,cockpit=isP&&typeof cameraMode!=='undefined'&&cameraMode===1;
  if(!busy&&!cockpit&&condition==='rain'&&!lowQ()&&(isP||Math.abs(car.z-player.z)<28)){
    try{reflect(_dc,vp,car,color,style,boost);}catch(e){window.__zgMirror=false;busy=false;try{gl.depthFunc(gl.LESS);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(attr.alpha,1);}catch(_){}if(!reflect.err){reflect.err=1;console.error('ZAYRO GRAPHICS reflect',e);}}
  }
  _dc(vp,car,color,style,boost);
  if(isP&&!cockpit&&!busy){
    try{update(car,style);drawDamage(vp,car,style);drawParticles(vp);}catch(e){if(!drawCar.err){drawCar.err=1;console.error('ZAYRO GRAPHICS fx3d',e);}}
  }
};
window.ZG={pick,bolt:()=>bolt(),get weather(){return weather;}};
})();
