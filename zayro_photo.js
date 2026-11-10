'use strict';
/* ZAYRO PHOTO v12.0 — loads after zayro_extra.js.
   Works together with the upgraded fragment shader in game.js (clear-coat paint, car ambient occlusion,
   glass reflections, asphalt aggregate sparkle, dusty road edge, grass/dirt/wall detail, worn lane paint,
   retro-reflective lines in headlights, highlight roll-off).
   CARS  : soft blended sun shadows (replaces the old hard black ovals), tyre smoke when drifting or braking
           hard, door handles.
   ROADS : slabs/tar/tyre tracks now really use the asphalt shader (they used to cover it), repair patches,
           skid marks, manhole covers, roadside grass tufts.
   Every block is wrapped in try/catch so a failure can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const zs=()=>window.zrState||{brake:false};

/* ============================================================ uniforms for the new shader modes */
try{
  attr.shadowA=gl.getUniformLocation(program,'uShadowA');
  attr.shadowB=gl.getUniformLocation(program,'uShadowB');
  attr.alpha=gl.getUniformLocation(program,'uAlpha');
  gl.useProgram(program);
  gl.uniform1f(attr.alpha,1);gl.uniform3f(attr.shadowB,1,1,0);gl.uniform4f(attr.shadowA,0,0,1,0);
}catch(e){console.error('ZAYRO PHOTO uniforms',e);}

/* ============================================================ SOFT SHADOWS */
const DIMS=[[.97,1.95],[1.08,2.4],[1.02,2.3],[1.08,2.22],[1.12,2.5],[1.06,2.46],[1.16,2.42]];
const dimOf=style=>DIMS[clamp(Math.floor(style)||0,0,DIMS.length-1)];
function blendOn(){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
function blendOff(){gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(attr.alpha,1);gl.uniform3f(attr.shadowB,1,1,0);}
function drawShadow(vp,car,style){
  const d=dimOf(style),W=d[0],H=d[1];
  const night=condition==='night'||selectedRoad===4,rain=condition==='rain';
  const k=(night?.55:1)*(rain?.75:1)*(selectedRoad===6?.8:1);
  const off=night?0:.62,sx=.512*off,sz=-.439*off;       // sun comes from (-.42,.82,.36)
  const c=Math.cos(car.yaw),s=Math.sin(car.yaw);
  bind(cubePB,cubeNB);
  gl.uniformMatrix4fv(attr.vp,false,vp);
  blendOn();
  const one=(cx,cz,hx,hz,a)=>{
    gl.uniform4f(attr.shadowA,cx,cz,c,s);gl.uniform3f(attr.shadowB,hx,hz,a);
    const e=Math.max(hx,hz)*1.04;
    gl.uniformMatrix4fv(attr.model,false,modelMatrix([cx,.06,cz],[e,.002,e],0));
    gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);
    gl.drawArrays(gl.TRIANGLES,0,36);
  };
  one(car.x+sx,car.z+sz,W*1.22,H*1.10,.30*k);           // soft cast shadow
  one(car.x+sx*.4,car.z+sz*.4,W*1.02,H*.96,.34*k);       // mid
  one(car.x,car.z,W*.86,H*.84,.40*k);                    // dark contact core under the floor
  blendOff();
}

/* ============================================================ TYRE SMOKE */
const puffs=[];let smokeAcc=0,lastT=performance.now();
function updateSmoke(car,style){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastT)/1000));lastT=now;
  if(typeof running==='undefined'||!running||paused){if(!running)puffs.length=0;return;}
  const d=dimOf(style),W=d[0],H=d[1],sp=Math.abs(car.speed);
  const slide=Math.abs(car.slip||0)>.32&&sp>22,hard=zs().brake&&sp>48;
  if(slide||hard){
    smokeAcc+=dt*(slide?46:24);
    while(smokeAcc>=1){
      smokeAcc--;
      for(const sd of [-1,1]){
        const p=localPoint(car,sd*W*.8,.1,-H*.62),fx=Math.sin(car.yaw),fz=Math.cos(car.yaw);
        puffs.push({x:p[0]+(Math.random()-.5)*.25,y:.12,z:p[2]+(Math.random()-.5)*.25,
          vx:-fx*sp*.10+(Math.random()-.5)*1.1,vy:.45+Math.random()*.5,vz:-fz*sp*.10+(Math.random()-.5)*1.1,
          t:0,max:.8+Math.random()*.8,r:.16+Math.random()*.08});
      }
    }
  }
  for(let i=puffs.length-1;i>=0;i--){
    const q=puffs[i];q.t+=dt;
    if(q.t>=q.max){puffs.splice(i,1);continue;}
    q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.vx*=1-dt*1.6;q.vz*=1-dt*1.6;q.vy*=1-dt*.9;
  }
  if(puffs.length>260)puffs.splice(0,puffs.length-260);
}
function drawSmoke(vp){
  if(!puffs.length)return;
  bind(spherePB,sphereNB);
  gl.uniformMatrix4fv(attr.vp,false,vp);
  gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);
  const night=condition==='night'||selectedRoad===4,col=night?[.34,.35,.4]:[.86,.86,.88];
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.uniform3fv(attr.color,col);
  for(const q of puffs){
    const u=q.t/q.max,r=q.r+u*.85,a=Math.pow(1-u,1.4)*.34;
    gl.uniform1f(attr.alpha,a);
    gl.uniformMatrix4fv(attr.model,false,modelMatrix([q.x,q.y,q.z],[r,r*.75,r],0));
    gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);
  }
  gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(attr.alpha,1);
}

/* ============================================================ CAR HOOK */
const SIDEK=[.95,.99,.90,.92,.97,.93,.96];
const _prev=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  const cockpit=car===player&&typeof cameraMode!=='undefined'&&cameraMode===1;
  if(!cockpit&&!window.__zgMirror){try{drawShadow(vp,car,style);}catch(e){blendOff();if(!drawShadow.err){drawShadow.err=1;console.error('ZAYRO PHOTO shadow',e);}}}
  _prev(vp,car,color,style,boost);
  if(cockpit){try{if(car===player)updateSmoke(car,style);}catch(e){}return;}
  try{
    const d=dimOf(style),W=d[0],H=d[1],wk=SIDEK[clamp(Math.floor(style)||0,0,6)];
    for(const s of [-1,1]){      // door handles
      drawPart(vp,car,[s*(W*wk*.99+.012),.63,-H*.10],[.012,.014,.075],[.62,.64,.66]);
      drawPart(vp,car,[s*(W*wk*.99+.008),.63,-H*.10+.09],[.008,.02,.012],[.03,.03,.035]);
    }
    if(car===player&&!window.__zgMirror){updateSmoke(car,style);drawSmoke(vp);}
  }catch(e){if(!drawCar.err){drawCar.err=1;console.error('ZAYRO PHOTO cars',e);}}
};

/* ============================================================ ROADS */
function makeAdder(map){
  return function(color,p,size,yaw=0){
    let b=map.get(color);if(!b){b={p:[],n:[],color};map.set(color,b);}
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(const f of faceData)for(const j of triangles){
      const v=f[j],n=f[4],x=v[0]*size[0],z=v[2]*size[2];
      b.p.push(p[0]+x*c+z*s,p[1]+v[1]*size[1],p[2]-x*s+z*c);
      b.n.push(n[0]*c+n[2]*s,n[1],-n[0]*s+n[2]*c);
    }
  };
}
const near=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6&&Math.abs(a[2]-b[2])<1e-6;

// Make the slabs / joints / tar / worn tracks use the asphalt shader (wet puddles, sparkle, reflections).
function flagRoadBatches(){
  const sc=(c,k)=>c.map(v=>Math.min(1,v*k)),r=K.road;
  const list=[sc(r,1.07),sc(r,.93),sc(r,1.0),sc(r,.55),sc(r,.5),[.092,.1,.105]];
  for(const b of batches){if(b.isRoad)continue;for(const c of list)if(near(b.color,c)){b.isRoad=true;break;}}
}

function buildPhoto(theme){
  if(freeRoam)return;
  const map=new Map(),add=makeAdder(map);
  let seed=15485863+theme*9973;
  const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const end=roadEnd-100,sc=(c,k)=>c.map(v=>Math.min(1,v*k)),road=K.road;
  const lanes=[-14.17,-8.5,-2.83,2.83,8.5,14.17];

  // repair patches
  const pc=[sc(road,.80),sc(road,1.16),sc(road,.68)];
  for(let i=0;i<120;i++){
    const x=lanes[i%6]+(R()-.5)*2.2,z=-40+R()*(end+20);
    if(Math.abs(x)>14.7)continue;
    add(pc[i%3],[x,.0255,z],[.35+R()*.5,.0045,.8+R()*2.2],(R()-.5)*.08);
  }

  // skid marks: pairs of darker, slightly curved rubber streaks
  const skid=sc(road,.42);
  for(let i=0;i<46;i++){
    let x=lanes[Math.floor(R()*4)+1]+(R()-.5)*1.4,z=-20+R()*(end-20),yaw=(R()-.5)*.22;
    const curv=(R()-.5)*.05,segs=7+Math.floor(R()*7),len=2.2;
    for(let k=0;k<segs;k++){
      const fx=Math.sin(yaw),fz=Math.cos(yaw);
      for(const o of [-.75,.75])add(skid,[x+fz*o+fx*len*.5,.0262,z-fx*o+fz*len*.5],[.07+R()*.02,.0035,len*.5+.04],yaw);
      x+=fx*len;z+=fz*len;yaw+=curv;
    }
  }

  // manhole covers
  const mh=[.10,.10,.11],mh2=[.2,.2,.21],bar=[.3,.3,.32];
  for(let i=0;i<22;i++){
    const x=lanes[1+Math.floor(R()*4)]+(R()-.5)*1.2,z=60+R()*(end-100);
    add(mh2,[x,.0275,z],[.50,.0035,.50],.0);
    add(mh,[x,.0300,z],[.40,.0035,.40],.0);add(mh,[x,.0300,z],[.40,.0035,.40],.785);
    add(bar,[x,.0335,z],[.34,.0025,.022],.4);add(bar,[x,.0335,z],[.34,.0025,.022],-.4);add(bar,[x,.0335,z],[.022,.0025,.34],.0);
  }

  // roadside grass / dry scrub tufts
  if(theme<=2){
    const cols=theme===0?[[.16,.30,.12],[.21,.36,.14],[.12,.24,.10]]:theme===1?[[.15,.34,.17],[.2,.4,.2],[.12,.28,.14]]:[[.52,.44,.24],[.6,.5,.28],[.42,.34,.2]];
    for(let i=0;i<480;i++){
      const sd=i%2?1:-1,z=-60+R()*(end+60);
      const x=sd*(R()<.55?16.6+R()*1.2:18.7+R()*6);
      const h=.14+R()*.28,c=cols[i%3];
      for(let b=0;b<3;b++)add(c,[x+(R()-.5)*.28,h*.5,z+(R()-.5)*.28],[.022,h*.5,.022],R()*3);
    }
  }

  for(const b of map.values()){
    const pb=gl.createBuffer(),nb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.p),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.n),gl.STATIC_DRAW);
    batches.push({pb,nb,count:b.p.length/3,color:b.color,isRoad:b.color===pc[0]||b.color===pc[1]||b.color===pc[2]||b.color===skid||b.color===mh||b.color===mh2||b.color===bar});
  }
}
const _bw=buildWorld;
buildWorld=function(theme){
  _bw(theme);
  try{flagRoadBatches();}catch(e){console.error('ZAYRO PHOTO flag',e);}
  try{buildPhoto(theme);}catch(e){console.error('ZAYRO PHOTO roads',e);}
};
buildWorld(selectedRoad);
})();
