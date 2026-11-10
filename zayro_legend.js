'use strict';
/* ZAYRO LEGEND v13.0 — loads after zayro_photo.js. Base game code is untouched.
   ROAD 08 : Misty Pines  — dawn mountain road through a dense conifer + autumn forest:
             layered pines, maples, ferns, mossy boulders, fallen logs, timber guard-rails, wildlife signs,
             fallen leaves on the asphalt, distant forested ridges, cold dawn fog,
             plus a screen layer with sun shafts, drifting mist banks and falling leaves.
   CAR 08  : Stratos Zero — mid-engine hypercar (20,000 CR in the garage): lofted body, glass canopy,
             racing stripes, bonnet louvres, side blades, canards, LED signature lights, full-width tail bar,
             centre-exit twin exhaust, active rear wing that tilts with speed / brakes, lathe-profiled tyres,
             10-spoke centre-lock wheels, soft shadow, tyre smoke, crash damage.
   Every block is wrapped in try/catch so a failure can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sgn=v=>v<0?-1:1;
const ROAD_ID=7,CAR_ID=7,PRICE=20000;
const dim=(c,k)=>c.map(v=>Math.min(1,v*k));
const near3=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6&&Math.abs(a[2]-b[2])<1e-6;
const zs=()=>window.zrState||{brake:false,backfire:0,brakeHeat:0};
const glowOn=()=>gl.uniform1f(attr.emit,1),glowOff=()=>gl.uniform1f(attr.emit,0);

/* ================================================================== ROAD 08 : MISTY PINES */
try{
  if(roadChoices.length<=ROAD_ID)roadChoices[ROAD_ID]={name:'Misty Pines',fog:[.66,.73,.72],clear:[.60,.71,.74]};
}catch(e){console.error('ZAYRO LEGEND roadChoices',e);}

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
function setC(key,c){const a=K[key];if(a){a[0]=c[0];a[1]=c[1];a[2]=c[2];}}
function flush(map){
  for(const b of map.values()){
    const pb=gl.createBuffer(),nb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.p),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.n),gl.STATIC_DRAW);
    batches.push({pb,nb,count:b.p.length/3,color:b.color});
  }
}
// Earlier packs derived slab / tar / terrain shades from the base road+ground colours. Re-tint them to the new palette.
function retint(oldRoad,oldGround){
  const sc=(c,k)=>c.map(v=>Math.min(1,v*k));
  const roadF=[1.07,.93,1.0,.55,.5].map(k=>c=>sc(c,k));
  const grdF=[c=>sc(c,1.14),c=>sc(c,.86),c=>[c[0]*1.18,c[1]*1.06,c[2]*.8],c=>[c[0]*.84,c[1]*.97,c[2]*.88],c=>sc(c,1.28)];
  for(const b of batches){
    if(!b.color||b.color===K.road||b.color===K.ground)continue;
    let done=false;
    for(const f of roadF)if(near3(b.color,f(oldRoad))){b.color=f(K.road);done=true;break;}
    if(done)continue;
    for(const f of grdF)if(near3(b.color,f(oldGround))){b.color=f(K.ground);break;}
  }
}

function buildPines(){
  const oldRoad=K.road.slice(),oldGround=K.ground.slice();
  setC('ground',[.095,.15,.082]);setC('road',[.155,.165,.165]);setC('shoulder',[.30,.265,.19]);
  setC('barrier',[.44,.35,.25]);setC('barrierDark',[.20,.15,.10]);setC('water',[.085,.13,.07]);
  setC('lamp',[1,.86,.58]);setC('signLight',[1,.80,.45]);setC('sign',[.14,.26,.18]);
  setC('tree',[.09,.24,.12]);setC('trunk',[.19,.12,.075]);
  retint(oldRoad,oldGround);
  if(freeRoam)return;
  const map=new Map(),add=makeAdder(map);
  let seed=88211;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const end=roadEnd-100;

  // distant forested ridges (tiered, fogged by distance)
  const ridge=[[.06,.12,.085],[.075,.14,.10],[.09,.16,.115]];
  for(const s of [-1,1])for(let z=60,k=0;z<end;z+=300+(k*47)%120,k++){
    const x=s*(150+R()*70),zz=z+R()*90;
    for(let t=0;t<6;t++)add(ridge[(t+k)%3],[x,2+t*8,zz],[56-t*8,4.4,64-t*9],R()*.3);
  }

  // conifers: trunk + five rotated, shrinking skirts
  const greens=[[.055,.17,.10],[.07,.21,.12],[.045,.14,.09],[.09,.24,.13]],bark=[.17,.11,.07];
  for(let i=0;i<340;i++){
    const s=i%2?1:-1,x=s*(21.5+Math.pow(R(),1.5)*58),z=-50+R()*(end+60),h=5+R()*6.5,u=h/8,g=greens[i%4];
    add(bark,[x,h*.16,z],[.14*u+.04,h*.16,.14*u+.04]);
    const y0=R()*3;
    for(let t=0;t<5;t++)add(g,[x,h*(.26+.15*t),z],[(1.95-.34*t)*u,.34*u+.06,(1.95-.34*t)*u],y0+t*.7);
    add(g,[x,h*.98,z],[.16*u,.5*u,.16*u]);
  }

  // autumn maples / birches for colour
  const leaf=[[.72,.35,.07],[.62,.2,.07],[.82,.62,.13],[.55,.14,.06]],leafD=leaf.map(c=>dim(c,.86)),leafL=leaf.map(c=>dim(c,1.1)),trunk=[.24,.17,.11];
  for(let i=0;i<64;i++){
    const s=i%2?1:-1,x=s*(22.5+R()*22),z=-40+R()*(end+30),h=3.2+R()*2.4,c=leaf[i%4];
    add(trunk,[x,h*.4,z],[.13,h*.4,.13]);
    add(c,[x,h+.5,z],[1.2+R()*.6,.7,1.2+R()*.6],R()*3);
    add(leafD[i%4],[x+(R()-.5)*.9,h+1.2,z+(R()-.5)*.9],[.8+R()*.4,.55,.8+R()*.4],R()*3);
    add(leafL[i%4],[x+(R()-.5)*.7,h+1.75,z+(R()-.5)*.7],[.5,.35,.5],R()*3);
  }

  // ferns / undergrowth near the road
  const fern=[[.11,.28,.09],[.15,.34,.11],[.09,.22,.08]];
  for(let i=0;i<300;i++){
    const s=i%2?1:-1,x=s*(19.7+R()*6),z=-60+R()*(end+50),h=.18+R()*.28,c=fern[i%3],yw=R()*3;
    for(let k=0;k<3;k++)add(c,[x,h*.5,z],[.04,h*.5,.46+R()*.2],yw+k*1.05);
  }

  // mossy boulders and fallen logs
  const rock=[.30,.31,.28],moss=[.13,.25,.11],log=[.22,.15,.09],ring=[.52,.40,.24];
  for(let i=0;i<95;i++){
    const s=i%2?1:-1,x=s*(21+R()*20),z=-40+R()*(end+30),h=.4+R()*1.2,w=.6+R()*1.1;
    add(rock,[x,h*.45,z],[w,h*.5,w*(.7+R()*.5)],R()*3);
    add(moss,[x,h*.95,z],[w*.8,.07,w*.6],R()*3);
  }
  for(let i=0;i<26;i++){
    const s=i%2?1:-1,x=s*(20.4+R()*9),z=-30+R()*(end),L=1.6+R()*2.4,yw=R()*3.14;
    add(log,[x,.2,z],[.2,.2,L],yw);
    add(ring,[x+Math.sin(yw)*L,.2,z+Math.cos(yw)*L],[.17,.17,.02],yw);
  }

  // wildlife warning signs (yellow board, black antlers) every ~600 m
  const pole=[.5,.52,.5],yel=[.95,.78,.1],blk=[.05,.05,.06];
  for(let z=455,k=0;z<end;z+=600,k++)for(const s of [-1,1]){
    const x=s*21.7;
    add(pole,[x,1.2,z],[.04,1.2,.04]);
    add(yel,[x,2.7,z-.05],[.55,.55,.02]);
    add(blk,[x-.12,2.62,z-.075],[.05,.22,.015]);add(blk,[x+.12,2.62,z-.075],[.05,.22,.015]);
    add(blk,[x,2.42,z-.075],[.22,.05,.015]);add(blk,[x-.16,2.88,z-.075],[.09,.04,.015]);add(blk,[x+.16,2.88,z-.075],[.09,.04,.015]);
  }

  // fallen leaves scattered on the shoulder and lanes
  const lc=[[.62,.28,.07],[.70,.45,.10],[.45,.20,.06],[.55,.12,.05],[.36,.26,.08]];
  for(let i=0;i<520;i++){
    const onShoulder=R()<.62,s=R()<.5?-1:1;
    const x=onShoulder?s*(15.7+R()*1.2):(R()-.5)*29,z=-50+R()*(end+40),w=.04+R()*.05;
    add(lc[i%5],[x,.0315,z],[w,.003,w*(.7+R()*.8)],R()*3);
  }
  flush(map);
}

const _bw=buildWorld;
buildWorld=function(theme){
  if(theme!==ROAD_ID)return _bw(theme);
  _bw(1);                                      // built on the Coastal base: trees, tufts, reflectors, signs
  try{buildPines();}catch(e){console.error('ZAYRO LEGEND road',e);}
};
const _upr=uploadRoadOptions;
uploadRoadOptions=function(){
  _upr();
  try{
    const wrap=byId('roadSelect');if(!wrap)return;
    wrap.querySelectorAll('.road-option').forEach(b=>{
      if(Number(b.dataset.road)===ROAD_ID){b.classList.remove('undefined');b.classList.add('road-pines');}
    });
  }catch(e){}
};
try{
  if(!freeRoam&&Number(localStorage.getItem('apexRoad'))===ROAD_ID&&roadChoices.length>ROAD_ID)selectedRoad=ROAD_ID;
  buildWorld(selectedRoad);uploadRoadOptions();
}catch(e){console.error('ZAYRO LEGEND road boot',e);}

/* ================================================================== CAR 08 : STRATOS ZERO */
const CAR={name:'Stratos Zero',type:'LEGEND · MID-ENGINE HYPERCAR',color:[.04,.16,.58],top:112,accel:12.4,style:CAR_ID,grip:1.31,nitro:9.0};
try{if(cars.length<=CAR_ID)cars[CAR_ID]=CAR;}catch(e){console.error('ZAYRO LEGEND car stats',e);}

/* ---- loft engine (smooth lofted bodies) ---- */
function curve(k,t){
  if(t<=k[0][0])return k[0][1];
  for(let i=0;i<k.length-1;i++){
    if(t<=k[i+1][0]){
      const a=k[i],b=k[i+1],p0=k[Math.max(0,i-1)],p3=k[Math.min(k.length-1,i+2)];
      const u=(t-a[0])/(b[0]-a[0]);
      const m1=(b[1]-p0[1])/(b[0]-p0[0])*(b[0]-a[0]),m2=(p3[1]-a[1])/(p3[0]-a[0])*(b[0]-a[0]);
      const u2=u*u,u3=u2*u;
      return (2*u3-3*u2+1)*a[1]+(u3-2*u2+u)*m1+(-2*u3+3*u2)*b[1]+(u3-u2)*m2;
    }
  }
  return k[k.length-1][1];
}
function buildLoft(stations,N){
  const P=[];
  for(const s of stations){
    const ring=[];
    for(let j=0;j<N;j++){
      const a=j/N*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),e=s.e;
      ring.push([s.hw*sgn(c)*Math.pow(Math.abs(c),e)*(sn<0?s.low:1),s.cy+s.hh*sgn(sn)*Math.pow(Math.abs(sn),e),s.z]);
    }
    P.push(ring);
  }
  const R=P.length,pos=[],nor=[];
  const normal=(i,j)=>{
    const i0=Math.max(0,i-1),i1=Math.min(R-1,i+1),jp=(j+1)%N,jm=(j+N-1)%N;
    const du=[P[i1][j][0]-P[i0][j][0],P[i1][j][1]-P[i0][j][1],P[i1][j][2]-P[i0][j][2]];
    const dv=[P[i][jp][0]-P[i][jm][0],P[i][jp][1]-P[i][jm][1],P[i][jp][2]-P[i][jm][2]];
    let n=[dv[1]*du[2]-dv[2]*du[1],dv[2]*du[0]-dv[0]*du[2],dv[0]*du[1]-dv[1]*du[0]];
    let l=Math.hypot(n[0],n[1],n[2]);
    const out=[P[i][j][0],P[i][j][1]-stations[i].cy,0];
    if(l<1e-7){n=[0,0,i<R/2?-1:1];l=1;}
    n=[n[0]/l,n[1]/l,n[2]/l];
    if(n[0]*out[0]+n[1]*out[1]<0&&Math.abs(n[2])<.999)n=[-n[0],-n[1],-n[2]];
    return n;
  };
  for(let i=0;i<R-1;i++)for(let j=0;j<N;j++){
    const jn=(j+1)%N;
    for(const [a,b] of [[i,j],[i+1,j],[i+1,jn],[i,j],[i+1,jn],[i,jn]]){pos.push(...P[a][b]);nor.push(...normal(a,b));}
  }
  const pb=gl.createBuffer(),nb=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);
  return {pb,nb,count:pos.length/3};
}
// t = 0 at the tail, 1 at the nose. Mid-engine wedge: high rear deck, cabin pushed forward, low shark nose.
const S={W:1.10,Hl:2.50,roof:.99,tail:.72,nose:.34,cabS:.36,cabE:.70,wxF:.80,wzF:.60,
  wk:[[0,.66],[.06,.88],[.16,1.0],[.34,1.0],[.5,.95],[.7,.89],[.88,.80],[1,.62]],
  yt:[[0,.60],[.08,.72],[.2,.78],[.34,.77],[.5,.72],[.66,.68],[.8,.57],[.93,.42],[1,.31]]};
const yTop=t=>curve(S.yt,clamp(t,0,1));
const ybAt=t=>t<.07?.31-t/.07*.12:t>.93?.19+(t-.93)/.07*.07:.19;
const cyAt=t=>(yTop(t)+ybAt(t))/2;
const sideX=t=>S.W*curve(S.wk,clamp(t,0,1));
let meshes=null;
function getMeshes(){
  if(meshes)return meshes;
  const K2=48,N=34,body=[],cab=[],roof=[],base=.64;
  const ends=t=>{const m=Math.min(t,1-t)/.075;return m>=1?1:Math.sqrt(Math.max(0,1-(1-m)*(1-m)));};
  for(let k=0;k<=K2;k++){
    const t=.5-.5*Math.cos(Math.PI*k/K2),f=ends(t),yb=ybAt(t),yt=curve(S.yt,t);
    body.push({z:-S.Hl+2*S.Hl*t,cy:(yt+yb)/2,hh:Math.max(.0001,(yt-yb)/2*f),hw:Math.max(.0001,S.W*curve(S.wk,t)*f),e:.5,low:.84});
  }
  for(let k=0;k<=36;k++){
    const s=.5-.5*Math.cos(Math.PI*k/36),t=S.cabS+(S.cabE-S.cabS)*s;
    const f=Math.sqrt(Math.max(0,1-Math.pow(1-clamp(Math.min(s,1-s)/.1,0,1),2)));
    const top=base+(S.roof-base)*Math.pow(Math.sin(Math.PI*Math.pow(s,.9)),.6);
    const cw=S.W*curve(S.wk,t)*(.70-.14*Math.abs(s-.5)*1.6)*f;
    cab.push({z:-S.Hl+2*S.Hl*t,cy:(top+base-.07)/2,hh:Math.max(.0001,(top-(base-.07))/2),hw:Math.max(.0001,cw),e:.62,low:.92});
    const rf=clamp((s-.12)/.2,0,1)*clamp((.9-s)/.25,0,1);
    roof.push({z:-S.Hl+2*S.Hl*t,cy:top-.005,hh:Math.max(.0001,.028*rf),hw:Math.max(.0001,cw*.52*rf),e:.8,low:1});
  }
  return (meshes={body:buildLoft(body,N),cab:buildLoft(cab,N),roof:buildLoft(roof,18)});
}
function drawMesh(vp,car,mesh,color,gloss){
  const p=localPoint(car,0,0,0);if(car===player)p[1]+=suspensionBob;
  bind(mesh.pb,mesh.nb);
  gl.uniformMatrix4fv(attr.vp,false,vp);
  gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[1,1,1],car.yaw,car===player?car.roll*.12+car.pitch:0));
  gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,gloss);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}

/* ---- tyre mesh + wheel design (10-spoke centre-lock) ---- */
let tyre=null;
try{
  const prof=[[-1,.60],[-1,.80],[-.93,.93],[-.78,.985],[-.42,1],[.42,1],[.78,.985],[.93,.93],[1,.80],[1,.60]];
  const N=36,pos=[],nor=[];
  for(let i=0;i<prof.length-1;i++){
    const a=prof[i],b=prof[i+1],dx=b[0]-a[0],dr=b[1]-a[1],l=Math.hypot(dx,dr)||1,nx=-dr/l,nr=dx/l;
    for(let j=0;j<N;j++){
      const t0=j/N*Math.PI*2,t1=(j+1)/N*Math.PI*2,c0=Math.cos(t0),s0=Math.sin(t0),c1=Math.cos(t1),s1=Math.sin(t1);
      const v=(p,c,s)=>{pos.push(p[0],p[1]*c,p[1]*s);nor.push(nx,nr*c,nr*s);};
      v(a,c0,s0);v(b,c0,s0);v(b,c1,s1);v(a,c0,s0);v(b,c1,s1);v(a,c1,s1);
    }
  }
  const pb=gl.createBuffer(),nb=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);
  tyre={pb,nb,count:pos.length/3};
}catch(e){console.error('ZAYRO LEGEND tyre',e);}
function part(vp,p,size,yaw,pitch,color,gloss){
  bind(cubePB,cubeNB);
  gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,size,yaw,pitch));
  gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,gloss);
  gl.drawArrays(gl.TRIANGLES,0,36);
}
function cyl(vp,p,size,yaw,color,gloss){
  bind(wheelPB,wheelNB);
  gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,size,yaw));
  gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,gloss);
  gl.drawArrays(gl.TRIANGLES,0,wheelPos.length/3);
}
const RIM={rim:[.10,.105,.12],lip:[.80,.82,.86],gold:[.95,.72,.18],cal:[.95,.08,.05]};
function wheel(vp,car,x,z){
  if(!tyre)return drawWheel(vp,car,x,z);
  const isP=car===player,sg=x<0?-1:1,Z=zs();
  const wy0=.40+(isP?suspensionBob+Math.sin(time*18+x*2+z)*Math.min(.025,Math.abs(car.speed)*.00022):0);
  const spin=isP?wheelSpin:car.z*2.7;
  const wy=car.yaw+(isP&&z>0?steer*.42:0);
  const cp=localPoint(car,x,wy0,z),cw=Math.cos(wy),sw=Math.sin(wy);
  const at=(ox,oy,oz)=>[cp[0]+ox*cw+oz*sw,wy0+oy,cp[2]-ox*sw+oz*cw];
  bind(tyre.pb,tyre.nb);
  gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(cp,[.285,.385,.385],wy));
  gl.uniform3fv(attr.color,[.022,.024,.027]);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.1);
  gl.drawArrays(gl.TRIANGLES,0,tyre.count);
  cyl(vp,cp,[.27,.235,.235],wy,[.05,.052,.056],.5);                        // barrel
  cyl(vp,at(sg*.27,0,0),[.012,.248,.248],wy,RIM.lip,.88);                  // polished lip
  cyl(vp,at(sg*.285,0,0),[.004,.215,.215],wy,[.012,.013,.015],.3);         // dark dish
  const hot=isP?clamp(Z.brakeHeat||0,0,1):0;                              // drilled carbon-ceramic disc
  if(hot>.3){glowOn();cyl(vp,at(sg*.19,0,0),[.012,.205,.205],wy,[1,.35+.25*hot,.06],.4);glowOff();}
  else cyl(vp,at(sg*.19,0,0),[.012,.205,.205],wy,[.30,.31,.33],.7);
  part(vp,at(sg*.225,.135,-.075),[.05,.075,.065],wy,0,RIM.cal,.55);        // red caliper
  if(isP&&Math.abs(car.speed)>30)cyl(vp,at(sg*.29,0,0),[.004,.21,.21],wy,[.04,.042,.05],.4);
  for(let i=0;i<10;i++){
    const a=i*Math.PI*2/10+spin,ca=Math.cos(a),sa=Math.sin(a);
    part(vp,at(sg*.295,ca*.125,sa*.125),[.012,.092,.017],wy,a,RIM.rim,.8);
  }
  cyl(vp,at(sg*.30,0,0),[.016,.058,.058],wy,RIM.gold,.8);                  // centre-lock nut
  cyl(vp,at(sg*.312,0,0),[.006,.026,.026],wy,[.1,.1,.11],.5);
}

/* ---- shadow + tyre smoke ---- */
function blendOn(){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
function blendOff(){gl.disable(gl.BLEND);gl.depthMask(true);try{gl.uniform1f(attr.alpha,1);gl.uniform3f(attr.shadowB,1,1,0);}catch(_){}}
function drawShadow(vp,car){
  if(!attr.shadowA)return;
  const W=S.W,H=S.Hl,night=condition==='night'||selectedRoad===4,rain=condition==='rain';
  const k=(night?.55:1)*(rain?.75:1),off=night?0:.62,sx=.512*off,sz=-.439*off;
  const c=Math.cos(car.yaw),s=Math.sin(car.yaw);
  bind(cubePB,cubeNB);gl.uniformMatrix4fv(attr.vp,false,vp);blendOn();
  const one=(cx,cz,hx,hz,a)=>{
    gl.uniform4f(attr.shadowA,cx,cz,c,s);gl.uniform3f(attr.shadowB,hx,hz,a);
    const e=Math.max(hx,hz)*1.04;
    gl.uniformMatrix4fv(attr.model,false,modelMatrix([cx,.06,cz],[e,.002,e],0));
    gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);gl.drawArrays(gl.TRIANGLES,0,36);
  };
  one(car.x+sx,car.z+sz,W*1.22,H*1.10,.30*k);
  one(car.x+sx*.4,car.z+sz*.4,W*1.02,H*.96,.34*k);
  one(car.x,car.z,W*.86,H*.84,.40*k);
  blendOff();
}
const puffs=[];let smokeAcc=0,lastT=performance.now();
function updateSmoke(car){
  const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-lastT)/1000));lastT=now;
  if(typeof running==='undefined'||!running||paused){if(!running)puffs.length=0;return;}
  const sp=Math.abs(car.speed),slide=Math.abs(car.slip||0)>.32&&sp>22,hard=zs().brake&&sp>48;
  if(slide||hard){
    smokeAcc+=dt*(slide?46:24);
    while(smokeAcc>=1){
      smokeAcc--;
      for(const sd of [-1,1]){
        const p=localPoint(car,sd*S.W*.8,.1,-S.Hl*.62),fx=Math.sin(car.yaw),fz=Math.cos(car.yaw);
        puffs.push({x:p[0]+(Math.random()-.5)*.25,y:.12,z:p[2]+(Math.random()-.5)*.25,vx:-fx*sp*.10+(Math.random()-.5)*1.1,vy:.45+Math.random()*.5,vz:-fz*sp*.10+(Math.random()-.5)*1.1,t:0,max:.8+Math.random()*.8,r:.16+Math.random()*.08});
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
  if(!puffs.length||!attr.alpha)return;
  bind(spherePB,sphereNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);
  const night=condition==='night'||selectedRoad===4;
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  gl.uniform3fv(attr.color,night?[.34,.35,.4]:[.86,.86,.88]);
  for(const q of puffs){
    const u=q.t/q.max,r=q.r+u*.85;
    gl.uniform1f(attr.alpha,Math.pow(1-u,1.4)*.34);
    gl.uniformMatrix4fv(attr.model,false,modelMatrix([q.x,q.y,q.z],[r,r*.75,r],0));
    gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);
  }
  gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(attr.alpha,1);
}

/* ---- the car ---- */
function drawStratos(vp,car,color,boost){
  const M=getMeshes(),W=S.W,H=S.Hl,isP=car===player,zr=zs();
  const dark=condition==='night'||condition==='rain'||selectedRoad===4||selectedRoad===6;
  const brk=isP?zr.brake:!!car.braking;
  const carbon=[.04,.045,.05],chrome=[.8,.82,.85],gold=RIM.gold,white=[.92,.94,.95],cyan=[.35,.85,1];
  const rz=-H+.03,nz=H-.04,wx=W*S.wxF,wz=H*S.wzF;
  const tOfZ=z=>(z/H+1)/2;
  const strip=(t0,t1,x,w,col)=>{const n=8;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,za=-H+2*H*ta,zb=-H+2*H*tb,ya=yTop(ta),yb=yTop(tb);drawPart(vp,car,[x,(ya+yb)/2+.006,(za+zb)/2],[w,.006,Math.abs(zb-za)/2*1.05],col,-Math.atan2(yb-ya,zb-za));}};
  const side=(t0,t1,yf,h,col)=>{const n=10;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,tm=(ta+tb)/2,zm=-H+2*H*tm,len=H*(tb-ta);for(const s of [-1,1])drawPart(vp,car,[s*(sideX(tm)+.005),yf(tm),zm],[.005,h,len*1.03],col);}};

  for(const s of [-1,1])for(const z of [-wz-.05,wz])wheel(vp,car,s*wx,z);
  drawMesh(vp,car,M.body,color,.97);
  drawMesh(vp,car,M.cab,[.012,.025,.04],.98);
  drawMesh(vp,car,M.roof,dim(color,.92),.97);

  // racing stripes (bonnet + engine deck) and a gold pin-stripe along the flank
  for(const x of [-W*.09,W*.09]){strip(.74,.97,x,W*.05,white);strip(.03,.33,x,W*.05,white);}
  side(.12,.88,t=>cyAt(t)+.03,.008,gold);
  // mirrors on stalks, door handles, door shut lines
  const my=clamp(yTop(tOfZ(H*.30))+.14,.74,1.0);
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.70,my-.07,H*.30],[.045,.01,.02],carbon,0,s*.2);
    drawSphere(vp,car,[s*W*.78,my,H*.30],[.13,.06,.09],dim(color,.9));
    drawPart(vp,car,[s*(W*.98),.60,-H*.04],[.008,.014,.075],[.7,.72,.75]);
    drawPart(vp,car,[s*W*.965,.58,H*.14],[.006,.22,.01],[.01,.01,.012]);
    drawPart(vp,car,[s*W*.965,.58,-H*.22],[.006,.22,.01],[.01,.01,.012]);
    // side blade intake ahead of the rear wheel
    drawPart(vp,car,[s*W*.975,.50,-H*.50],[.012,.12,.30],[.01,.012,.014]);
    for(let v=0;v<4;v++)drawPart(vp,car,[s*W*.972,.50,-H*.50-.2+v*.13],[.014,.11,.012],carbon);
    // front canards + arch vents
    drawPart(vp,car,[s*W*.84,.27,nz-.10],[.12,.012,.10],carbon,0,s*.0);
    drawPart(vp,car,[s*W*.94,.31,nz-.26],[.03,.05,.08],gold);
    drawPart(vp,car,[s*W*.95,.58,H*.66],[.01,.05,.20],[.01,.012,.014]);
  }
  // bonnet louvres
  for(let v=0;v<5;v++){const t=.78+v*.028;drawPart(vp,car,[0,yTop(t)+.012,-H+2*H*t],[W*.36,.007,.022],[.012,.014,.016],-.35);}
  // engine-cover slats behind the cabin
  for(let v=0;v<6;v++){const t=.08+v*.05;drawPart(vp,car,[0,yTop(t)+.012,-H+2*H*t],[W*.5,.006,.018],[.012,.014,.016],-.15);}
  // roof snorkel
  drawPart(vp,car,[0,S.roof+.02,-H*.12],[W*.12,.03,.28],dim(color,.8));

  // front fascia: splitter, mesh intake, LED signature
  drawPart(vp,car,[0,.23,nz-.05],[W*.96,.016,.15],carbon);
  drawPart(vp,car,[0,S.nose-.01,nz],[W*.50,.07,.03],[.012,.014,.016]);
  for(let v=-4;v<=4;v++)drawPart(vp,car,[v*W*.1,S.nose-.01,nz+.005],[.01,.065,.012],[.3,.32,.34]);
  const lampCol=dark?[1,.97,.88]:[.88,.94,1];
  glowOn();
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.60,S.nose+.07,nz-.15],[.26,.011,.026],lampCol);                 // upper DRL blade
    drawPart(vp,car,[s*W*.50,S.nose+.045,nz-.13],[.17,.01,.02],cyan);                      // cyan accent
    drawPart(vp,car,[s*W*.70,S.nose+.075,nz-.20],[.05,.01,.09],lampCol);                   // outer hook
  }
  glowOff();

  // rear fascia: diffuser, number plate, full-width tail bar
  const kb=brk?1:(dark?.55:.28);
  drawPart(vp,car,[0,.50,rz-.02],[W*.54,.12,.03],[.01,.011,.013]);
  drawPart(vp,car,[0,.275,rz-.04],[W*.78,.045,.16],carbon);
  for(let v=-3;v<=3;v++)drawPart(vp,car,[v*W*.17,.30,rz-.12],[.01,.055,.09],[.08,.09,.1]);
  glowOn();
  drawPart(vp,car,[0,.64,rz+.02],[W*.86,.016,.026],[kb,.05*kb,.03*kb]);
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.62,.60,rz+.03],[.17,.045,.026],[kb,.04*kb,.03*kb]);
    drawPart(vp,car,[s*W*.28,.55,rz+.02],[.07,.022,.02],[kb*.9,.03*kb,.02*kb]);
  }
  glowOff();
  drawPart(vp,car,[0,.42,rz-.07],[.25,.07,.01],[.93,.93,.86]);
  const seed=Math.floor(Math.abs(car.z*.013));
  for(let i=0;i<5;i++)drawPart(vp,car,[-.15+i*.075,.42,rz-.08],[.015,.02+((seed*7+i*5)%4)*.006,.003],[.05,.05,.06]);
  if(isP&&car.speed<-.4){glowOn();for(const s of [-1,1])drawPart(vp,car,[s*W*.34,.48,rz-.05],[.07,.025,.012],[1,1,1]);glowOff();}

  // centre-exit twin exhaust + flames
  for(const e of [-.17,.17]){
    drawPart(vp,car,[e*W,.43,rz-.10],[.07,.07,.07],[.52,.56,.62]);
    drawPart(vp,car,[e*W,.43,rz-.18],[.05,.05,.03],[.01,.01,.012]);
    if(isP&&(boost||zr.backfire>0)){
      const fl=Math.random();glowOn();
      const c1=boost?[.35,.6,1]:[1,.45,.08],c2=boost?[.85,.95,1]:[1,.85,.4];
      drawPart(vp,car,[e*W,.43,rz-.3-fl*.25],[.06,.06,.3+fl*.3],c1);
      drawPart(vp,car,[e*W,.43,rz-.6-fl*.4],[.035,.035,.4+fl*.3],c2);
      glowOff();
    }
  }

  // active rear wing: tilts up with speed, flips to air-brake under braking
  const sp=Math.abs(car.speed),tilt=-(clamp(sp/95,0,1)*.16+(brk?.55:0));
  const wy=S.tail+.55,wzp=rz+.52;
  for(const s of [-1,1])drawPart(vp,car,[s*W*.34,S.tail+.16,wzp],[.03,.22,.05],carbon);
  drawPart(vp,car,[0,wy,wzp],[W*1.02,.028,.27],carbon,tilt);
  drawPart(vp,car,[0,wy+.016,wzp],[W*.98,.008,.25],dim(color,.7),tilt);
  drawPart(vp,car,[0,wy-.02,wzp+.02],[W*.9,.01,.12],[.1,.11,.12],tilt*1.2);
  for(const s of [-1,1])drawPart(vp,car,[s*W*1.02,wy+.05,wzp],[.018,.14,.30],carbon);

  // night under-glow
  if(selectedRoad===4||condition==='night'){glowOn();drawPart(vp,car,[0,.03,0],[W*1.1,.004,H*.9],isP?[.0,.22,.5]:[.15,.1,.3]);glowOff();}

  // crash damage on the player's car
  if(isP&&crashCount>0){
    const dk=[.05,.055,.06],sc=[.6,.62,.62],glass=[.7,.78,.8];
    for(const s of [-1,1]){drawPart(vp,car,[s*W*.985,.5,H*.08],[.006,.03,H*(.14+.04*crashCount)],dk,s*.02);drawPart(vp,car,[s*W*.99,.56,-H*.2],[.005,.012,H*.1],sc,-s*.03);}
    if(crashCount>=2){drawPart(vp,car,[W*.18,.27,H-.1],[W*.42,.05,.06],dk,.22);drawPart(vp,car,[-.08,.98,H*.04],[.012,.01,.2],glass,-.3);drawPart(vp,car,[.06,.98,H*.06],[.01,.01,.16],glass,.34);drawPart(vp,car,[0,.62,H*.55],[W*.34,.012,.22],dk,.1);}
    if(crashCount>=3){drawPart(vp,car,[0,.74,H*.55],[W*.44,.02,.34],color.map(v=>v*.7),-.38);for(const s of [-1,1])drawPart(vp,car,[s*W*.78,.9,H*.30],[.14,.05,.1],dk);}
  }
  // running lights on traffic/rival copies at night or in rain
  if(!isP&&dark){glowOn();for(const s of [-1,1])drawSphere(vp,car,[s*W*.56,S.nose+.08,nz-.14],[.14,.03,.03],[.95,.93,.8]);glowOff();}
}

const _dc=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  if(style!==CAR_ID)return _dc(vp,car,color,style,boost);
  const cockpit=car===player&&typeof cameraMode!=='undefined'&&cameraMode===1;
  if(cockpit){try{if(car===player)updateSmoke(car);}catch(_){}return _dc(vp,car,color,1,boost);}   // old cockpit model holds the interior
  try{
    try{drawShadow(vp,car);}catch(e){blendOff();}
    drawStratos(vp,car,color,boost);
    if(car===player){updateSmoke(car);drawSmoke(vp);}
  }catch(e){
    if(!drawCar.err){drawCar.err=1;console.error('ZAYRO LEGEND car',e);}
    _dc(vp,car,color,3,boost);
  }
};

/* ================================================================== GARAGE: buy + select */
const ownedKey='zayroLegendOwned',pickKey='zayroLegendPick';
try{[ownedKey,pickKey].forEach(k=>{if(typeof PROFILE_SAVE_KEYS!=='undefined'&&!PROFILE_SAVE_KEYS.includes(k))PROFILE_SAVE_KEYS.push(k);});}catch(_){}
let owned=localStorage.getItem(ownedKey)==='1';
let myPick=owned&&localStorage.getItem(pickKey)==='1'?CAR_ID:null;
const savePick=()=>{try{if(myPick===null)localStorage.removeItem(pickKey);else localStorage.setItem(pickKey,'1');}catch(_){}};

const _upload=uploadCarOptions;
uploadCarOptions=function(){
  const held=cars[CAR_ID];
  if(held)cars.length=CAR_ID;                 // keep earlier packs from seeing a car they do not know
  try{_upload();}finally{if(held)cars[CAR_ID]=held;}
  const wrap=document.querySelector('#carSelect');if(!wrap)return;
  wrap.querySelectorAll('.car-option').forEach(b=>{
    const idx=Number(b.dataset.car),orig=b.onclick;
    if(myPick!==null)b.classList.remove('selected');
    b.onclick=e=>{
      const was=myPick,sel=selectedCar;myPick=null;
      orig&&orig.call(b,e);
      if(selectedCar===sel&&was!==null){myPick=was;}else savePick();
    };
  });
  const c=CAR,col='#'+c.color.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
  const b=document.createElement('button');
  b.className='car-option'+(myPick!==null?' selected':'')+(owned?'':' bonus-locked');
  b.dataset.car=String(CAR_ID);b.style.setProperty('--car-color',col);
  b.title=owned?'Your Legend car':'Buy for '+PRICE+' credits';
  b.innerHTML='<i class="car-silhouette"></i><b>'+c.name+'</b><small>'+(owned?c.type:'LOCKED · '+PRICE.toLocaleString()+' CR')+'</small>'
    +'<span class="garage-spec"><em>V-MAX</em><i><b style="width:'+Math.min(100,c.top)+'%"></b></i><strong>'+Math.round(c.top*3.6)+'</strong></span>'
    +'<span class="garage-spec"><em>LAUNCH</em><i><b style="width:'+c.accel*1.25+'%"></b></i><strong>'+c.accel+'</strong></span>';
  b.onclick=()=>{
    if(!owned){
      if(credits<PRICE){pop('NEED '+(PRICE-credits).toLocaleString()+' MORE CREDITS');return;}
      if(!confirm('Buy '+c.name+' for '+PRICE.toLocaleString()+' CR?'))return;
      credits-=PRICE;localStorage.setItem('apexCredits',String(credits));
      owned=true;localStorage.setItem(ownedKey,'1');refreshGarage();
      pop('🏁 '+c.name.toUpperCase()+' UNLOCKED!');
    }
    myPick=CAR_ID;savePick();selectedCar=CAR_ID;uploadCarOptions();
    pop(c.name.toUpperCase()+' SELECTED');
  };
  wrap.appendChild(b);
};
const _sr=startRace;
startRace=function(){
  _sr.apply(this,arguments);
  if(myPick!==null&&owned){selectedCar=CAR_ID;uploadCarOptions();pop(cars[CAR_ID].name.toUpperCase()+' READY');}
};
try{uploadCarOptions();}catch(e){console.error('ZAYRO LEGEND garage',e);}
// Public hook so the rewards system (zayro_rewards.js) can unlock this car as a race prize (same save key as buying it).
window.__zrLegendCar={
  owns:()=>owned,
  grant:()=>{if(owned)return 'owned';owned=true;try{localStorage.setItem(ownedKey,'1');}catch(_){}try{uploadCarOptions();}catch(_){}try{refreshGarage();}catch(_){}return 'new';}
};

/* ================================================================== FX: sun shafts, mist banks, falling leaves */
(function(){
  const c=document.createElement('canvas');c.id='zlFx';c.setAttribute('aria-hidden','true');
  const g=document.getElementById('game');if(g)g.insertAdjacentElement('afterend',c);else document.body.prepend(c);
  const ctx=c.getContext('2d');
  const leaves=Array.from({length:44},()=>({x:Math.random(),y:Math.random(),v:.05+Math.random()*.10,s:2+Math.random()*3.2,d:Math.random()*6.28,r:Math.random()*6.28,k:Math.floor(Math.random()*4)}));
  const bands=Array.from({length:6},(_,i)=>({x:Math.random(),y:.50+i*.045,w:.45+Math.random()*.4,v:.004+Math.random()*.01,a:.07+Math.random()*.06}));
  const LC=['190,90,25','215,140,40','150,60,20','120,90,30'];
  let last=performance.now(),clock=0;
  function loop(now){
    requestAnimationFrame(loop);
    try{
      const dt=Math.min(.1,(now-last)/1000);last=now;clock+=dt;
      const w=innerWidth,h=innerHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      ctx.clearRect(0,0,w,h);
      if(selectedRoad!==ROAD_ID||freeRoam||!running||paused||finished)return;
      const lowFps=typeof displayedFPS!=='undefined'&&displayedFPS<30,night=condition==='night';
      const sp=Math.abs(player.speed),perf=typeof graphicsQuality!=='undefined'&&graphicsQuality==='performance';
      // sun shafts through the canopy
      if(!lowFps&&!night){
        const sx=w*.22,sy=-h*.08;
        for(let k=0;k<5;k++){
          const a=.55+k*.11,wd=w*(.05+.03*((k*7)%3)),len=Math.max(w,h)*1.1;
          const al=(.05+.035*Math.sin(clock*.5+k*1.7))*(condition==='rain'?.5:1);
          const ex=sx+Math.cos(a)*len,ey=sy+Math.sin(a)*len;
          const gr=ctx.createLinearGradient(sx,sy,ex,ey);
          gr.addColorStop(0,'rgba(255,238,190,'+(al*1.8).toFixed(3)+')');gr.addColorStop(1,'rgba(255,238,190,0)');
          ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(sx-wd*.2,sy);ctx.lineTo(sx+wd*.2,sy);
          ctx.lineTo(ex+wd*Math.cos(a+1.57)+wd,ey+wd*Math.sin(a+1.57));ctx.lineTo(ex-wd+wd*Math.cos(a+1.57),ey);ctx.closePath();ctx.fill();
        }
      }
      // low mist banks drifting across the road
      if(!lowFps&&!perf){
        for(const b of bands){
          b.x+=b.v*dt*(1+sp*.004);if(b.x>1.5)b.x=-.5;
          const cx=b.x*w,cy=b.y*h,rw=b.w*w*.5,rh=h*.07;
          ctx.save();ctx.translate(cx,cy);ctx.scale(1,rh/rw);
          const gr=ctx.createRadialGradient(0,0,0,0,0,rw);
          const m=night?'110,125,150':'232,240,238';
          gr.addColorStop(0,'rgba('+m+','+(b.a*(.8+.2*Math.sin(clock*.4+b.y*9))).toFixed(3)+')');gr.addColorStop(1,'rgba('+m+',0)');
          ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,rw,0,6.283);ctx.fill();ctx.restore();
        }
      }
      // falling leaves
      const n=perf||lowFps?16:leaves.length;
      for(let i=0;i<n;i++){
        const p=leaves[i];
        p.y+=p.v*dt;p.x+=(Math.sin(clock*1.1+p.d)*.025-sp*.0006)*dt;p.r+=dt*(1.5+p.s*.3);
        if(p.y>1.05||p.x<-.05){p.y=-.05;p.x=Math.random();}
        ctx.save();ctx.translate(p.x*w,p.y*h);ctx.rotate(p.r);
        ctx.fillStyle='rgba('+LC[p.k]+',.8)';ctx.beginPath();ctx.ellipse(0,0,p.s,p.s*.55,0,0,6.283);ctx.fill();ctx.restore();
      }
    }catch(e){if(!loop.err){loop.err=1;console.error('ZAYRO LEGEND fx',e);}}
  }
  requestAnimationFrame(loop);
})();
})();
