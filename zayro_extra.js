'use strict';
/* ZAYRO EXTRA v11.0 — loads after zayro_real.js. Base game code is untouched.
   ROADS : 06 Sunset Coast (golden-hour coastal highway, palms, glowing lamps, sun-glitter on the sea)
           07 Volcano Pass (basalt road, lava rivers, glowing ground cracks, erupting volcanoes, floating embers)
   CARS  : 06 Phantom GT  (long black-and-gold grand tourer)   — buy in garage
           07 Solar Titan (wide low solar-orange hypercar)      — buy in garage
   Every block is wrapped in try/catch so a failure can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sgn=v=>v<0?-1:1;
const BASE_THEME={5:1,6:2};            // which built-in road each new road is built on

/* ================================================================== ROADS */
try{
  roadChoices.push(
    {name:'Sunset Coast',fog:[.96,.60,.40],clear:[.98,.56,.32]},
    {name:'Volcano Pass',fog:[.30,.13,.09],clear:[.20,.07,.05]}
  );
}catch(e){console.error('ZAYRO EXTRA roadChoices',e);}

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

function buildSunset(){
  setC('ground',[.50,.38,.30]);setC('road',[.17,.16,.17]);setC('shoulder',[.78,.60,.45]);
  setC('barrier',[.86,.68,.55]);setC('barrierDark',[.45,.30,.28]);setC('water',[.72,.34,.44]);
  setC('lamp',[1,.74,.42]);setC('signLight',[1,.62,.22]);setC('sign',[.50,.20,.15]);
  const map=new Map(),add=makeAdder(map);
  let seed=5531;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const end=roadEnd-100,glow=K.signLight;
  // sun-glitter on the sea (emissive specks)
  for(const s of [-1,1])for(let i=0;i<230;i++){
    add(glow,[s*(42+R()*95),-.18,-40+R()*(end+40)],[.1+R()*.35,.01,.1+R()*.5],R()*3);
  }
  if(!freeRoam){
    // glowing amber barrier lights
    for(let z=-84;z<end;z+=28)for(const s of [-1,1])add(glow,[s*18.25,1.3,z],[.09,.07,.09]);
    // palm trees
    const trunk=[.34,.24,.15],frond=[[.10,.34,.14],[.14,.40,.16]];
    for(let i=0;i<120;i++){
      const s=i%2?1:-1,x=s*(21.5+R()*9),z=-40+R()*(end+30),h=4.2+R()*2.8;
      add(trunk,[x,h*.5,z],[.13,h*.5,.13]);
      for(let a=0;a<7;a++){
        const yaw=a*Math.PI*2/7+R()*.3,dx=Math.sin(yaw)*.95,dz=Math.cos(yaw)*.95;
        add(frond[a%2],[x+dx,h+.05-(a%2)*.18,z+dz],[.11,.04,1.0],yaw);
      }
      add(frond[0],[x,h+.2,z],[.22,.14,.22]);
    }
    // sea railings and beach rocks
    const rock=[.42,.33,.30];
    for(let i=0;i<110;i++){const s=i%2?1:-1;const h=.3+R()*.6;add(rock,[s*(30+R()*8),h*.4-.1,-30+R()*end],[.5+R()*.9,h*.5,.5+R()*.9],R()*3);}
  }
  flush(map);
}

function buildVolcano(){
  setC('ground',[.07,.055,.05]);setC('road',[.08,.072,.072]);setC('shoulder',[.17,.12,.10]);
  setC('barrier',[.30,.21,.18]);setC('barrierDark',[.12,.08,.07]);setC('cliff',[.13,.095,.085]);
  setC('lamp',[1,.50,.15]);setC('signLight',[1,.42,.08]);setC('sign',[.25,.08,.04]);
  setC('tree',[.10,.08,.07]);setC('trunk',[.13,.09,.07]);
  // remove the desert cacti (green) that other packs added
  for(let i=batches.length-1;i>=0;i--){
    const c=batches[i].color;
    if(Math.abs(c[0]-.2)<1e-6&&Math.abs(c[1]-.42)<1e-6&&Math.abs(c[2]-.2)<1e-6){gl.deleteBuffer(batches[i].pb);gl.deleteBuffer(batches[i].nb);batches.splice(i,1);}
  }
  const map=new Map(),add=makeAdder(map);
  let seed=9173;const R=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const end=roadEnd-100,lava=K.signLight,basalt=[.07,.06,.065],rock=[.14,.10,.09],char=[.05,.04,.04];
  // lava rivers beside the road + cracks in the ground
  for(const s of [-1,1])for(let i=0;i<95;i++){
    add(lava,[s*(22.5+R()*5),-.06,-40+R()*(end+30)],[.5+R()*.9,.03,3+R()*10],(R()-.5)*.25);
  }
  for(let i=0;i<190;i++){
    const s=i%2?1:-1;
    add(lava,[s*(19.5+R()*55),-.075,-50+R()*(end+40)],[.04+R()*.05,.012,1+R()*3],R()*3);
  }
  // volcanoes with glowing craters
  for(const s of [-1,1])for(let z=150,k=0;z<end;z+=480+(k*53)%160,k++){
    const x=s*(95+R()*45),zz=z+R()*120;
    for(let t=0;t<7;t++)add(t%2?basalt:rock,[x,5+t*10,zz],[44-t*5.6,5.2,44-t*5.6],R()*.2);
    add(lava,[x,72,zz],[8,.6,8]);
    add(lava,[x+s*5,40,zz-14],[.9,18,.5]);
  }
  if(!freeRoam){
    // glowing marker lights on the barrier + black boulders + charred trees
    for(let z=-84;z<end;z+=28)for(const s of [-1,1])add(lava,[s*18.25,1.3,z],[.09,.07,.09]);
    for(let i=0;i<150;i++){const s=i%2?1:-1,h=.5+R()*1.4;add(R()>.5?rock:basalt,[s*(26+R()*22),h*.5-.05,-40+R()*(end+30)],[.6+R()*1.3,h*.5,.6+R()*1.3],R()*3);}
    for(let i=0;i<80;i++){const s=i%2?1:-1,x=s*(24+R()*24),z=-40+R()*(end+30),h=2.5+R()*3;add(char,[x,h*.5,z],[.14,h*.5,.14]);add(char,[x+.5,h*.8,z],[.4,.06,.07],R()*3);add(char,[x-.4,h*.62,z],[.35,.05,.06],R()*3);}
  }
  flush(map);
}

const _bw=buildWorld;
buildWorld=function(theme){
  const custom=theme>=5&&BASE_THEME[theme]!==undefined;
  _bw(custom?BASE_THEME[theme]:theme);
  if(!custom)return;
  try{if(theme===5)buildSunset();else buildVolcano();}catch(e){console.error('ZAYRO EXTRA road',theme,e);}
};
const ROAD_STYLES=['road-city','road-coast','road-desert','road-snow','road-neon','road-sunset','road-volcano'];
uploadRoadOptions=function(){
  const wrap=byId('roadSelect');if(!wrap)return;
  wrap.innerHTML=roadChoices.map((r,i)=>'<button class="road-option '+ROAD_STYLES[i]+' '+(i===selectedRoad?'selected':'')+'" data-road="'+i+'"><b>'+r.name+'</b><small>0'+(i+1)+'</small></button>').join('');
  wrap.querySelectorAll('.road-option').forEach(b=>b.onclick=()=>{selectedRoad=Number(b.dataset.road);localStorage.setItem('apexRoad',String(selectedRoad));buildWorld(selectedRoad);uploadRoadOptions();});
};
try{
  if(['apexRoad'].length&&!freeRoam){const saved=Number(localStorage.getItem('apexRoad'));if(saved>=5&&saved<roadChoices.length)selectedRoad=saved;}
  buildWorld(selectedRoad);uploadRoadOptions();
}catch(e){console.error('ZAYRO EXTRA road boot',e);}

/* ================================================================== CARS: loft engine */
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
const STY={
 5:{W:1.06,Hl:2.46,roof:1.05,tail:.72,nose:.42,cabS:.30,cabE:.66,wxF:.80,wzF:.60,
    wk:[[0,.82],[.07,.94],[.2,1.0],[.4,.99],[.6,.96],[.8,.90],[.93,.80],[1,.62]],
    yt:[[0,.62],[.1,.74],[.22,.80],[.34,.78],[.5,.74],[.64,.74],[.8,.64],[.93,.50],[1,.34]]},
 6:{W:1.16,Hl:2.42,roof:.96,tail:.66,nose:.34,cabS:.34,cabE:.62,wxF:.81,wzF:.60,
    wk:[[0,.70],[.06,.90],[.18,1.0],[.34,1.0],[.5,.94],[.7,.86],[.88,.78],[1,.60]],
    yt:[[0,.56],[.12,.66],[.28,.70],[.4,.66],[.55,.60],[.7,.54],[.86,.44],[.95,.36],[1,.26]]}
};
const yTop=(S,t)=>curve(S.yt,clamp(t,0,1));
const ybAt=t=>t<.07?.31-t/.07*.12:t>.93?.19+(t-.93)/.07*.07:.19;
const cyAt=(S,t)=>(yTop(S,t)+ybAt(t))/2;
const sideX=(S,t)=>S.W*curve(S.wk,clamp(t,0,1));
const cache={};
function getMeshes(id){
  if(cache[id])return cache[id];
  const S=STY[id],K2=46,N=34;
  const ends=t=>{const m=Math.min(t,1-t)/.075;return m>=1?1:Math.sqrt(Math.max(0,1-(1-m)*(1-m)));};
  const body=[],cab=[],roof=[],base=.64;
  for(let k=0;k<=K2;k++){
    const t=.5-.5*Math.cos(Math.PI*k/K2),f=ends(t),yb=ybAt(t),yt=curve(S.yt,t);
    body.push({z:-S.Hl+2*S.Hl*t,cy:(yt+yb)/2,hh:Math.max(.0001,(yt-yb)/2*f),hw:Math.max(.0001,S.W*curve(S.wk,t)*f),e:.5,low:.84});
  }
  for(let k=0;k<=34;k++){
    const s=.5-.5*Math.cos(Math.PI*k/34),t=S.cabS+(S.cabE-S.cabS)*s;
    const f=Math.sqrt(Math.max(0,1-Math.pow(1-clamp(Math.min(s,1-s)/.1,0,1),2)));
    const top=base+(S.roof-base)*Math.pow(Math.sin(Math.PI*Math.pow(s,.86)),.62);
    const cw=S.W*curve(S.wk,t)*(.70-.14*Math.abs(s-.5)*1.6)*f;
    cab.push({z:-S.Hl+2*S.Hl*t,cy:(top+base-.07)/2,hh:Math.max(.0001,(top-(base-.07))/2),hw:Math.max(.0001,cw),e:.62,low:.92});
    const rf=clamp((s-.12)/.2,0,1)*clamp((.9-s)/.25,0,1);
    roof.push({z:-S.Hl+2*S.Hl*t,cy:top-.005,hh:Math.max(.0001,.028*rf),hw:Math.max(.0001,cw*.52*rf),e:.8,low:1});
  }
  return (cache[id]={body:buildLoft(body,N),cab:buildLoft(cab,N),roof:buildLoft(roof,18),S});
}
function drawMesh(vp,car,mesh,color,gloss){
  const p=localPoint(car,0,0,0);if(car===player)p[1]+=suspensionBob;
  bind(mesh.pb,mesh.nb);
  gl.uniformMatrix4fv(attr.vp,false,vp);
  gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[1,1,1],car.yaw,car===player?car.roll*.12+car.pitch:0));
  gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,gloss);
  gl.drawArrays(gl.TRIANGLES,0,mesh.count);
}
const glowOn=()=>gl.uniform1f(attr.emit,1),glowOff=()=>gl.uniform1f(attr.emit,0);
const dim=(c,k)=>c.map(v=>Math.min(1,v*k));

/* ================================================================== CARS: stats + drawing */
const BONUS=[
  {id:5,price:6000,car:{name:'Phantom GT',type:'BONUS · BLACK & GOLD GT',color:[.035,.035,.045],top:99,accel:10.9,style:5,grip:1.22,nitro:7.6}},
  {id:6,price:12000,car:{name:'Solar Titan',type:'BONUS · SOLAR HYPERCAR',color:[1,.48,.03],top:106,accel:11.8,style:6,grip:1.27,nitro:8.4}}
];
try{BONUS.forEach(b=>{if(cars.length<=b.id)cars[b.id]=b.car;});}catch(e){console.error('ZAYRO EXTRA cars',e);}

const _dc=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  if(style<5)return _dc(vp,car,color,style,boost);
  if(car===player&&typeof cameraMode!=='undefined'&&cameraMode===1)return _dc(vp,car,color,style===5?3:4,boost);
  try{drawBonus(vp,car,color,style,boost);}
  catch(e){if(!drawBonus.err){drawBonus.err=1;console.error('ZAYRO EXTRA car',e);}_dc(vp,car,color,style===5?3:4,boost);}
};
function drawBonus(vp,car,color,id,boost){
  const M=getMeshes(id),S=M.S,W=S.W,H=S.Hl,isP=car===player;
  const zr=window.zrState||{brake:false,backfire:0};
  const dark=condition==='night'||condition==='rain'||selectedRoad===4||selectedRoad===6;
  const brk=isP?zr.brake:!!car.braking;
  const carbon=[.04,.045,.05],chrome=[.8,.82,.85],gold=[.92,.68,.16],cyan=[.2,.9,1],orange=[1,.5,.05];
  const rz=-H+.03,nz=H-.04,wx=W*S.wxF,wz=H*S.wzF;
  const tOfZ=z=>(z/H+1)/2;
  const strip=(t0,t1,x,w,col)=>{const n=8;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,za=-H+2*H*ta,zb=-H+2*H*tb,ya=yTop(S,ta),yb=yTop(S,tb);drawPart(vp,car,[x,(ya+yb)/2+.006,(za+zb)/2],[w,.006,Math.abs(zb-za)/2*1.05],col,-Math.atan2(yb-ya,zb-za));}};
  const side=(t0,t1,yf,h,col)=>{const n=10;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,tm=(ta+tb)/2,zm=-H+2*H*tm,len=H*(tb-ta),y=typeof yf==='function'?yf(tm):yf;for(const s of [-1,1])drawPart(vp,car,[s*(sideX(S,tm)+.005),y,zm],[.005,h,len*1.03],col);}};
  // shadow + wheels
  for(const s of [-1,1])for(const z of [-wz-.05,wz])drawWheel(vp,car,s*wx,z);
  // body
  drawMesh(vp,car,M.body,color,.95);
  drawMesh(vp,car,M.cab,[.015,.03,.045],.97);
  drawMesh(vp,car,M.roof,id===5?[.03,.03,.04]:dim(color,.9),.95);
  // mirrors, arch cavities, door lines
  const my=clamp(yTop(S,tOfZ(H*.18))+.13,.74,1.0);
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.80,.25,-.05],[.025,.03,H*.26],carbon);
    drawPart(vp,car,[s*W*.92,.62,H*.03],[.006,.2,.012],[.01,.01,.012]);
    drawSphere(vp,car,[s*W*.66,my,H*.18],[.14,.065,.10],id===5?carbon:dim(color,.9));
    drawPart(vp,car,[s*W*.90,.6,-H*.3],[.04,.11,.26],[.01,.012,.014]);
  }
  // front fascia
  drawPart(vp,car,[0,.27,nz-.1],[W*.62,.018,.09],carbon);
  drawPart(vp,car,[0,S.nose-.01,nz],[W*.50,.075,.03],[.012,.014,.016]);
  for(let v=-4;v<=4;v++)drawPart(vp,car,[v*W*.1,S.nose-.01,nz+.005],[.01,.07,.012],id===5?chrome:[.3,.32,.34]);
  const lampCol=dark?[1,.97,.85]:[.85,.92,1];
  glowOn();
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.58,S.nose+.075,nz-.14],[.24,.012,.03],lampCol);
    drawPart(vp,car,[s*W*.50,S.nose+.05,nz-.12],[.16,.01,.02],id===6?cyan:lampCol);
  }
  glowOff();
  // rear fascia
  const kb=brk?1:(dark?.5:.25);
  drawPart(vp,car,[0,.50,rz-.02],[W*.52,.12,.03],[.01,.011,.013]);
  drawPart(vp,car,[0,.285,rz-.04],[W*.72,.045,.14],carbon);
  for(let v=-2;v<=2;v++)drawPart(vp,car,[v*W*.18,.3,rz-.1],[.01,.05,.08],[.08,.09,.1]);
  glowOn();
  drawPart(vp,car,[0,.62+(S.tail-.7),rz+.02],[W*.8,.022,.03],[kb,.05*kb,.03*kb]);
  for(const s of [-1,1])drawPart(vp,car,[s*W*.55,.6+(S.tail-.7),rz+.03],[.2,.05,.03],[kb,.04*kb,.03*kb]);
  glowOff();
  // number plate + reverse light
  drawPart(vp,car,[0,.42,rz-.06],[.25,.07,.01],[.93,.93,.86]);
  for(let i=0;i<5;i++)drawPart(vp,car,[-.15+i*.075,.42,rz-.07],[.015,.02+((i*7)%3)*.006,.003],[.05,.05,.06]);
  if(isP&&car.speed<-.4){glowOn();for(const s of [-1,1])drawPart(vp,car,[s*W*.3,.5,rz-.05],[.07,.025,.012],[1,1,1]);glowOff();}
  // exhausts and flames
  const ex=id===5?[-.45,-.25,.25,.45]:[-.3,.3];
  for(const e of ex){
    drawPart(vp,car,[e*W,.42,rz-.1],[.07,.07,.08],[.6,.62,.66]);
    drawPart(vp,car,[e*W,.42,rz-.18],[.05,.05,.03],[.01,.01,.012]);
    if(isP&&(boost||zr.backfire>0)){
      const fl=Math.random();glowOn();
      const c1=boost?[.35,.6,1]:[1,.45,.08],c2=boost?[.85,.95,1]:[1,.85,.4];
      drawPart(vp,car,[e*W,.42,rz-.3-fl*.25],[.06,.06,.3+fl*.3],c1);
      drawPart(vp,car,[e*W,.42,rz-.6-fl*.4],[.035,.035,.4+fl*.3],c2);
      glowOff();
    }
  }
  /* ---- model character ---- */
  if(id===5){ // Phantom GT
    strip(.58,.95,0,W*.03,gold);                       // gold bonnet line
    side(.18,.84,t=>cyAt(S,t)+.05,.012,gold);           // gold flank line
    for(const s of [-1,1]){
      drawPart(vp,car,[s*W*.3,yTop(S,.74)+.02,-H+2*H*.74],[.2,.012,.14],carbon,-.06);   // bonnet vents
      drawPart(vp,car,[s*W*.55,.34,nz+.01],[.2,.03,.04],gold);                           // gold splitter tips
    }
    drawPart(vp,car,[0,S.tail+.02,rz+.28],[W*.74,.02,.1],carbon,.1);                      // ducktail
    drawPart(vp,car,[0,.33,nz+.015],[W*.9,.035,.03],gold);
    glowOn();drawPart(vp,car,[0,.3,0],[W*1.05,.004,H*.9],[.25,.18,.02]);glowOff();       // gold under-glow
  }else{ // Solar Titan
    const flap=clamp(Math.abs(player.speed)/90,0,1)*.35+(brk&&isP?.5:0);                 // active aero
    const wy=S.tail+.5,yaw=0;
    for(const s of [-1,1])drawPart(vp,car,[s*W*.34,S.tail+.1,rz+.5],[.03,.28,.05],carbon);
    drawPart(vp,car,[0,wy,rz+.5],[W*1.0,.03,.26],carbon,-flap*.5+yaw);
    drawPart(vp,car,[0,wy+.14,rz+.4],[W*.92,.02,.12],orange,-flap*.8);
    for(const s of [-1,1])drawPart(vp,car,[s*W,wy+.07,rz+.5],[.02,.2,.3],carbon);
    drawPart(vp,car,[0,.26,nz-.02],[W*.98,.014,.2],carbon);                              // splitter
    for(const s of [-1,1]){
      drawPart(vp,car,[s*W*.94,.3,nz-.22],[.1,.018,.12],carbon);                         // dive planes
      drawPart(vp,car,[s*W*.93,.52,H*.02],[.02,.1,.3],carbon);                           // side intake
      drawPart(vp,car,[s*W*.5,.2,nz*.2],[.02,.03,H*.7],orange);
    }
    // central fin
    for(let k=0;k<8;k++){const ta=.14+.4*k/8,tb=.14+.4*(k+1)/8,tc=(ta+tb)/2,base=yTop(S,tc),top=base+.02+.3*((.54-tc)/.4);drawPart(vp,car,[0,(base+top)/2,-H+2*H*tc],[.012,(top-base)/2,H*.4/8*1.05],dim(color,.9));}
    glowOn();
    drawPart(vp,car,[0,S.nose+.03,nz-.03],[W*.74,.012,.012],cyan);                        // front light bar
    drawPart(vp,car,[0,S.tail-.04,rz+.01],[W*.7,.014,.014],[1,.25,.05]);                  // rear LED bar
    side(.14,.86,t=>cyAt(S,t)+.04,.012,orange);
    drawPart(vp,car,[0,.3,0],[W*1.05,.004,H*.9],[.55,.25,.02]);                          // solar under-glow
    glowOff();
  }
  // crash damage on the player's car
  if(isP&&crashCount>0){
    const dk=[.05,.055,.06],sc=[.6,.62,.62];
    for(const s of [-1,1]){drawPart(vp,car,[s*W*.965,.5,H*.08],[.006,.03,H*(.14+.04*crashCount)],dk,s*.02);drawPart(vp,car,[s*W*.97,.56,-H*.2],[.005,.012,H*.1],sc,-s*.03);}
    if(crashCount>=2){drawPart(vp,car,[W*.18,.29,H-.1],[W*.42,.05,.06],dk,.22);drawPart(vp,car,[0,.83,H*.52],[W*.34,.012,.22],dk,.1);}
    if(crashCount>=3)for(const s of [-1,1])drawPart(vp,car,[s*W*.66,.9,H*.18],[.14,.05,.1],dk);
  }
  // night/rain running lights on non-player copies
  if(!isP&&dark){glowOn();for(const s of [-1,1])drawSphere(vp,car,[s*W*.56,S.nose+.08,nz-.14],[.14,.03,.03],[.95,.93,.8]);glowOff();}
}

/* ================================================================== GARAGE: buy + select bonus cars */
const ownedKey='zayroBonusOwned',pickKey='zayroBonusPick';
try{['zayroBonusOwned','zayroBonusPick'].forEach(k=>{if(typeof PROFILE_SAVE_KEYS!=='undefined'&&!PROFILE_SAVE_KEYS.includes(k))PROFILE_SAVE_KEYS.push(k);});}catch(_){}
const loadJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v===null||v===undefined?d:v;}catch(_){return d;}};
let owned=(()=>{const a=loadJSON(ownedKey,[]);return Array.isArray(a)?a.filter(n=>n===5||n===6):[];})();
let bonusPick=(()=>{const p=Number(localStorage.getItem(pickKey));return owned.includes(p)?p:null;})();
const savePick=()=>{try{if(bonusPick===null)localStorage.removeItem(pickKey);else localStorage.setItem(pickKey,String(bonusPick));}catch(_){}};

const _upload=uploadCarOptions;
uploadCarOptions=function(){
  _upload();
  const wrap=document.querySelector('#carSelect');if(!wrap)return;
  wrap.querySelectorAll('.car-option').forEach(b=>{
    const idx=Number(b.dataset.car);
    if(idx<5){
      const orig=b.onclick;
      b.onclick=e=>{if(idx+1<=unlocked){bonusPick=null;savePick();}orig&&orig.call(b,e);};
      if(bonusPick!==null)b.classList.remove('selected');
      return;
    }
    const info=BONUS.find(x=>x.id===idx),has=owned.includes(idx),sm=b.querySelector('small');
    if(sm)sm.textContent=has?info.car.type:'LOCKED · '+info.price.toLocaleString()+' CR';
    b.classList.toggle('selected',bonusPick===idx);
    b.classList.toggle('bonus-locked',!has);
    b.title=has?'Your bonus car':'Buy for '+info.price+' credits';
    b.onclick=()=>{
      if(!owned.includes(idx)){
        if(credits<info.price){pop('NEED '+(info.price-credits).toLocaleString()+' MORE CREDITS');return;}
        if(!confirm('Buy '+info.car.name+' for '+info.price.toLocaleString()+' CR?'))return;
        credits-=info.price;localStorage.setItem('apexCredits',String(credits));
        owned.push(idx);localStorage.setItem(ownedKey,JSON.stringify(owned));refreshGarage();
        pop('🏁 '+info.car.name.toUpperCase()+' UNLOCKED!');
      }
      bonusPick=idx;savePick();selectedCar=idx;uploadCarOptions();
      pop(info.car.name.toUpperCase()+' SELECTED');
    };
  });
};
const _sr=startRace;
startRace=function(){
  _sr.apply(this,arguments);
  if(bonusPick!==null&&owned.includes(bonusPick)){
    selectedCar=bonusPick;uploadCarOptions();
    pop(cars[selectedCar].name.toUpperCase()+' READY');
  }
};
try{uploadCarOptions();}catch(e){console.error('ZAYRO EXTRA garage',e);}
// Public hook so the rewards system (zayro_rewards.js) can unlock these cars as race prizes (same save key as buying them).
window.__zrBonusCars={
  owns:id=>owned.includes(id),
  grant:id=>{if(id!==5&&id!==6)return 'invalid';if(owned.includes(id))return 'owned';owned.push(id);try{localStorage.setItem(ownedKey,JSON.stringify(owned));}catch(_){}try{uploadCarOptions();}catch(_){}try{refreshGarage();}catch(_){}return 'new';}
};

/* ================================================================== FX: embers + sunset glow */
(function(){
  const c=document.createElement('canvas');c.id='zxFx';c.setAttribute('aria-hidden','true');
  const g=document.getElementById('game');if(g)g.insertAdjacentElement('afterend',c);else document.body.prepend(c);
  const ctx=c.getContext('2d');
  const em=Array.from({length:70},()=>({x:Math.random(),y:Math.random(),v:.04+Math.random()*.12,s:.8+Math.random()*2,d:Math.random()*6.28,a:Math.random()}));
  let last=performance.now(),clock=0;
  function loop(now){
    requestAnimationFrame(loop);
    try{
      const dt=Math.min(.1,(now-last)/1000);last=now;clock+=dt;
      const w=innerWidth,h=innerHeight;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      ctx.clearRect(0,0,w,h);
      if(!running||paused||finished||freeRoam)return;
      const lowFps=typeof displayedFPS!=='undefined'&&displayedFPS<30;
      if(selectedRoad===5){
        const gr=ctx.createRadialGradient(w*.26,h*-.06,10,w*.26,h*-.06,Math.max(w,h)*.8);
        gr.addColorStop(0,'rgba(255,200,120,.30)');gr.addColorStop(.5,'rgba(255,140,70,.10)');gr.addColorStop(1,'rgba(255,120,60,0)');
        ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);
      }else if(selectedRoad===6&&!lowFps){
        const gr=ctx.createLinearGradient(0,h,0,h*.55);
        gr.addColorStop(0,'rgba(255,90,20,.12)');gr.addColorStop(1,'rgba(255,90,20,0)');
        ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);
        const n=graphicsQuality==='performance'?30:em.length,sp=Math.abs(player.speed);
        for(let i=0;i<n;i++){
          const p=em[i];
          p.y-=p.v*dt*(1+sp*.01);p.x+=Math.sin(clock*1.3+p.d)*.02*dt-sp*.0004*dt*(p.x<.5?-1:1);
          if(p.y<-.05||p.x<-.05||p.x>1.05){p.y=1.05;p.x=Math.random();}
          const al=.35+.45*Math.sin(clock*4+p.d)*.5+.2;
          ctx.fillStyle='rgba(255,'+Math.round(110+80*p.a)+',40,'+al.toFixed(2)+')';
          ctx.beginPath();ctx.arc(p.x*w,p.y*h,p.s,0,6.283);ctx.fill();
        }
      }
    }catch(e){if(!loop.err){loop.err=1;console.error('ZAYRO EXTRA fx',e);}}
  }
  requestAnimationFrame(loop);
})();
})();
