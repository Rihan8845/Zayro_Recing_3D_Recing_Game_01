'use strict';
/* ZAYRO CARS v8.1 — five genuinely different, smooth lofted car designs (one per stage car).
   0 Street Racer : compact hot hatch (tall roof, hatch spoiler, white side stripe, round fog lamps)
   1 Muscle Storm : long-hood muscle coupe (twin racing stripes, hood scoop, chrome bumper, quad lamps)
   2 Volt Supercar: low electric wedge (cyan light bar + flank line, aero wheel covers, canards)
   3 Hyper RS     : GT3-style track car (swan-neck wing, roof scoop, round fender lamps, door roundel)
   4 Champion X   : Le Mans hypercar (shark fin, twin-element wing, wide splitter, dive planes, wheel fairings)
   Loads after zayro_realism.js. Player, traffic, rivals, police and ghost all use it.
   Cockpit camera keeps the original model because it contains the interior. */
(function(){
const zr=window.zrState||{brake:false,backfire:0};
const sgn=v=>v<0?-1:1;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- curve helper: smooth interpolation through knots [[t,v],...] ---------- */
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

/* ---------- loft: stations -> smooth mesh ---------- */
function buildLoft(stations,N){
  const P=[];
  for(const s of stations){
    const ring=[];
    for(let j=0;j<N;j++){
      const a=j/N*Math.PI*2,c=Math.cos(a),sn=Math.sin(a),e=s.e;
      const x=s.hw*sgn(c)*Math.pow(Math.abs(c),e)*(sn<0?s.low:1);
      const y=s.cy+s.hh*sgn(sn)*Math.pow(Math.abs(sn),e);
      ring.push([x+(s.dx||0),y,s.z]);
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
    const st=stations[i],out=[P[i][j][0]-(st.dx||0),P[i][j][1]-st.cy,0];
    if(l<1e-7){n=[0,0,i<R/2?-1:1];l=1;}
    n=[n[0]/l,n[1]/l,n[2]/l];
    if(n[0]*out[0]+n[1]*out[1]<0&&Math.abs(n[2])<.999)n=[-n[0],-n[1],-n[2]];
    return n;
  };
  for(let i=0;i<R-1;i++)for(let j=0;j<N;j++){
    const jn=(j+1)%N;
    const q=[[i,j],[i+1,j],[i+1,jn],[i,j],[i+1,jn],[i,jn]];
    for(const [a,b] of q){pos.push(...P[a][b]);nor.push(...normal(a,b));}
  }
  const pb=gl.createBuffer(),nb=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pos),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nor),gl.STATIC_DRAW);
  return {pb,nb,count:pos.length/3};
}

/* ---------- five car designs. wk = width over length (tail->nose), yt = roofline/bodyline height over length ---------- */
const STY=[
 // 0 Street Racer — compact hot hatch: short, tall greenhouse, high hatch tail
 {W:.97,Hl:1.95,roof:1.28,tail:.86,nose:.54,cabS:.20,cabE:.74,wing:2,wxF:.80,wzF:.62,
  wk:[[0,.82],[.07,.93],[.2,1.0],[.36,.99],[.5,.94],[.68,.92],[.86,.84],[1,.66]],
  yt:[[0,.72],[.08,.84],[.2,.88],[.34,.84],[.46,.74],[.62,.78],[.82,.70],[.93,.61],[1,.46]]},
 // 1 Muscle Storm — long hood, short deck, chopped roof, wide shoulders
 {W:1.08,Hl:2.40,roof:1.20,tail:.84,nose:.70,cabS:.42,cabE:.78,wing:0,wxF:.80,wzF:.56,
  wk:[[0,.84],[.07,.96],[.2,1.0],[.4,1.0],[.6,.98],[.8,.92],[.93,.84],[1,.70]],
  yt:[[0,.72],[.1,.84],[.2,.88],[.3,.84],[.44,.80],[.58,.84],[.76,.92],[.9,.86],[.97,.74],[1,.58]]},
 // 2 Volt Supercar — very low cab-forward electric wedge
 {W:1.02,Hl:2.30,roof:1.00,tail:.70,nose:.40,cabS:.26,cabE:.62,wing:1,wxF:.79,wzF:.62,
  wk:[[0,.88],[.08,.98],[.2,1.0],[.36,.97],[.5,.88],[.66,.82],[.86,.74],[1,.56]],
  yt:[[0,.60],[.1,.70],[.24,.72],[.36,.68],[.5,.64],[.64,.62],[.8,.52],[.93,.44],[1,.32]]},
 // 3 Hyper RS — GT3-style: wide rear haunches, round fenders, big wing
 {W:1.08,Hl:2.22,roof:1.14,tail:.78,nose:.52,cabS:.28,cabE:.72,wing:3,wxF:.79,wzF:.55,
  wk:[[0,.86],[.08,1.0],[.2,1.04],[.34,1.0],[.5,.90],[.68,.90],[.86,.82],[1,.64]],
  yt:[[0,.64],[.1,.74],[.2,.84],[.34,.84],[.48,.78],[.62,.80],[.8,.74],[.93,.62],[1,.46]]},
 // 4 Champion X — long wide prototype with bubble canopy and shark fin
 {W:1.12,Hl:2.50,roof:.98,tail:.72,nose:.36,cabS:.36,cabE:.64,wing:9,wxF:.80,wzF:.60,
  wk:[[0,.62],[.06,.84],[.18,.98],[.34,1.0],[.5,.96],[.66,.92],[.86,.86],[1,.70]],
  yt:[[0,.60],[.15,.72],[.3,.74],[.42,.72],[.55,.66],[.7,.58],[.86,.48],[.95,.40],[1,.28]]}
];
// helpers describing the body at length-fraction t (0 = tail, 1 = nose)
const yTop=(S,t)=>curve(S.yt,clamp(t,0,1));
const ybAt=t=>t<.07?.31-t/.07*.12:t>.93?.19+(t-.93)/.07*.07:.19;
const cyAt=(S,t)=>(yTop(S,t)+ybAt(t))/2;
const sideX=(S,t)=>S.W*curve(S.wk,clamp(t,0,1));

const meshCache=[];
function getMeshes(si){
  if(meshCache[si])return meshCache[si];
  const S=STY[si],K=46,N=34,WK=S.wk,YT=S.yt;
  const ends=t=>{const m=Math.min(t,1-t)/.075;return m>=1?1:Math.sqrt(Math.max(0,1-(1-m)*(1-m)));};
  const body=[];
  for(let k=0;k<=K;k++){
    const t=.5-.5*Math.cos(Math.PI*k/K),f=ends(t);
    const yb=ybAt(t),yt=curve(YT,t),hh=Math.max(.0001,(yt-yb)/2*f);
    body.push({z:-S.Hl+2*S.Hl*t,cy:(yt+yb)/2,hh,hw:Math.max(.0001,S.W*curve(WK,t)*f),e:.5,low:.84});
  }
  // glass canopy and body-colour roof panel
  const cab=[],roof=[];
  const base=.64;
  for(let k=0;k<=34;k++){
    const s=.5-.5*Math.cos(Math.PI*k/34),t=S.cabS+(S.cabE-S.cabS)*s,f=Math.sqrt(Math.max(0,1-Math.pow(1-clamp(Math.min(s,1-s)/.1,0,1),2)));
    const prof=Math.pow(Math.sin(Math.PI*Math.pow(s,.86)),.62);
    const top=base+(S.roof-base)*prof;
    const wBody=S.W*curve(WK,t),cw=wBody*(.70-.14*Math.abs(s-.5)*1.6)*f;
    const hh=Math.max(.0001,(top-(base-.07))/2);
    cab.push({z:-S.Hl+2*S.Hl*t,cy:(top+base-.07)/2,hh,hw:Math.max(.0001,cw),e:.62,low:.92});
    const rf=clamp((s-.12)/.2,0,1)*clamp((.9-s)/.25,0,1);
    roof.push({z:-S.Hl+2*S.Hl*t,cy:top-.005,hh:Math.max(.0001,.028*rf),hw:Math.max(.0001,cw*.52*rf),e:.8,low:1});
  }
  return (meshCache[si]={body:buildLoft(body,N),cab:buildLoft(cab,N),roof:buildLoft(roof,18),S});
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

/* Give every stage car its own design + a fitting colour. */
try{
  const ids=['Street Racer','Muscle Storm','Volt Supercar','Hyper RS','Champion X'];
  cars.forEach((c,i)=>{c.style=i;});
  cars[1].color=[.72,.05,.05];     // deep muscle red
  cars[3].color=[.90,.91,.93];     // GT white
  cars[4].color=[.05,.20,.56];     // prototype blue
  if(typeof uploadCarOptions==='function')uploadCarOptions();
}catch(e){console.error('ZAYRO CARS setup',e);}

const _prev=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  if(car===player&&typeof cameraMode!=='undefined'&&cameraMode===1)return _prev(vp,car,color,style,boost);
  const si=((style%5)+5)%5,M=getMeshes(si),S=M.S,W=S.W,H=S.Hl;
  const isP=car===player,dark=condition==='night'||condition==='rain'||selectedRoad===4;
  const brk=isP?zr.brake:!!car.braking;
  const carbon=[.045,.05,.055],chrome=[.78,.8,.82],white=[.93,.94,.95],cyan=[.1,.95,.95];
  const td=S.tail-.76;                      // shifts rear lamps with the deck height
  const tOfZ=z=>(z/H+1)/2;
  // flat strip lying on the body centre-line / bonnet, following its slope
  const strip=(t0,t1,x,w,col)=>{const n=8;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,za=-H+2*H*ta,zb=-H+2*H*tb,ya=yTop(S,ta),yb=yTop(S,tb);drawPart(vp,car,[x,(ya+yb)/2+.006,(za+zb)/2],[w,.006,Math.abs(zb-za)/2*1.05],col,-Math.atan2(yb-ya,zb-za));}};
  // decal line along both flanks
  const side=(t0,t1,yf,h,col)=>{const n=10;for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,tm=(ta+tb)/2,zm=-H+2*H*tm,len=H*(tb-ta),y=typeof yf==='function'?yf(tm):yf;for(const s of [-1,1])drawPart(vp,car,[s*(sideX(S,tm)+.005),y,zm],[.005,h,len*1.03],col);}};
  // soft ground shadow
  // wheels first so the fenders overlap them naturally
  const wx=W*S.wxF,wz=H*S.wzF;
  for(const side of [-1,1])for(const z of [-wz-.05,wz])drawWheel(vp,car,side*wx,z);
  // main body, glass canopy, roof panel
  drawMesh(vp,car,M.body,color,.9);
  drawMesh(vp,car,M.cab,[.02,.04,.055],.95);
  drawMesh(vp,car,M.roof,dim(color,.96),.9);
  // dark wheel-arch cavities, door lines, intakes, mirrors
  const my=clamp(yTop(S,tOfZ(H*.18))+.13,.76,1.02);
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.80,.25,-.05],[.025,.03,H*.26],carbon);
    drawPart(vp,car,[s*W*.92,.62,H*(.03)],[.006,.2,.012],[.01,.01,.012]);
    drawPart(vp,car,[s*W*.9,.60,-H*.30],[.04,.11,.26],[.01,.012,.014]);
    drawPart(vp,car,[s*W*.9,.5,H*.05],[.02,.02,.9],dim(color,.55));
    drawSphere(vp,car,[s*W*.66,my,H*.18],[.15,.07,.10],dim(color,.95));
    drawPart(vp,car,[s*W*.64,my-.06,H*.15],[.03,.05,.03],carbon);
  }
  // ---------- front ----------
  const nz=H-.04;
  drawPart(vp,car,[0,.27,nz-.1],[W*.62,.018,.09],carbon);
  drawPart(vp,car,[0,S.nose-.01,nz],[W*.50,.075,.03],[.012,.014,.016]);
  for(let v=-3;v<=3;v++)drawPart(vp,car,[v*W*.12,S.nose-.01,nz+.005],[.012,.07,.012],[.35,.38,.4]);
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.56,S.nose+.05,nz-.16],[.27,.03,.06],[.012,.014,.017]);
    const lamp=dark||isP&&condition!=='clear';
    glowOn();drawPart(vp,car,[s*W*.56,S.nose+.075,nz-.14],[.22,.014,.03],lamp?[1,.97,.82]:[.82,.9,1]);glowOff();
  }
  // ---------- rear ----------
  const rz=-H+.03;
  drawPart(vp,car,[0,.50,rz-.02],[W*.52,.12,.03],[.01,.011,.013]);
  for(let v=-4;v<=4;v++)drawPart(vp,car,[v*W*.11,.5,rz-.045],[.012,.11,.012],[.28,.3,.32]);
  drawPart(vp,car,[0,.285,rz-.04],[W*.72,.045,.14],carbon);
  for(let v=-2;v<=2;v++)drawPart(vp,car,[v*W*.18,.3,rz-.1],[.01,.05,.08],[.08,.09,.1]);
  const kb=brk?1:(dark?.45:.22);
  glowOn();
  for(const s of [-1,1]){
    drawSphere(vp,car,[s*W*.64,.66+td,rz+.02],[.2,.1,.05],[kb,.04*kb,.03*kb]);
    drawPart(vp,car,[s*W*.40,.70+td,rz+.04],[W*.3,.025,.03],[kb,.05*kb,.035*kb]);
  }
  drawPart(vp,car,[0,.745+td,rz+.02],[W*.28,.02,.03],[kb,.05*kb,.035*kb]);
  glowOff();
  drawPart(vp,car,[0,.40,rz-.06],[.25,.07,.01],[.93,.93,.86]);
  // exhausts and flames (blue boost flames)
  for(const s of [-1,1]){
    drawPart(vp,car,[s*W*.34,.43,rz-.1],[.08,.08,.08],[.55,.58,.62]);
    drawPart(vp,car,[s*W*.34,.43,rz-.18],[.055,.055,.03],[.01,.01,.012]);
    if(isP&&boost){
      const fl=Math.random();glowOn();
      drawPart(vp,car,[s*W*.34,.43,rz-.3-fl*.22],[.07,.07,.3+fl*.3],[.35,.6,1]);
      drawPart(vp,car,[s*W*.34,.43,rz-.55-fl*.4],[.045,.045,.4+fl*.3],[.55,.8,1]);
      drawPart(vp,car,[s*W*.34,.43,rz-.9-fl*.5],[.025,.025,.35+fl*.2],[.95,.98,1]);
      glowOff();
    }else if(isP&&zr.backfire>0){
      glowOn();drawPart(vp,car,[s*W*.34,.43,rz-.4],[.07,.07,.32],[1,.45,.08]);glowOff();
    }
  }
  // ---------- generic wings / spoilers ----------
  const wingBlade=(y,hw,chord,zc)=>{drawPart(vp,car,[0,y,zc],[hw,.028,chord],carbon);drawPart(vp,car,[0,y+.04,zc-chord*.5],[hw,.02,.03],dim(color,.9));for(const s of [-1,1])drawPart(vp,car,[s*hw,y+.04,zc],[.02,.12,chord*1.05],carbon);};
  if(S.wing===1||S.wing===2||S.wing===3){
    const y=S.tail+.28+(S.wing===3?.16:0),hw=W*(S.wing===3?.96:.78),ch=S.wing===3?.26:.17;
    for(const s of [-1,1])drawPart(vp,car,[s*W*.34,S.tail+.1,rz+.5],[.03,(y-S.tail)*.5,.05],carbon);
    wingBlade(y,hw,ch,rz+.45);
  }
  if(S.wing===0){drawPart(vp,car,[0,S.tail+.03,rz+.2],[W*.8,.018,.08],dim(color,.9));drawPart(vp,car,[0,S.tail+.05,rz+.14],[W*.8,.014,.06],dim(color,.9),-.25);}
  // bonnet centre vent for the cars that don't have their own bonnet treatment
  if(si===0||si===2||si===3)strip(.6,.9,0,W*.07,carbon);
  // side marker
  for(const s of [-1,1])drawPart(vp,car,[s*W*.93,.52,H*.52],[.012,.02,.06],[1,.55,.1]);
  // night/rain: dim running lights on traffic
  if(!isP&&dark){glowOn();for(const s of [-1,1])drawSphere(vp,car,[s*W*.56,S.nose+.08,nz-.14],[.14,.03,.03],[.95,.93,.8]);glowOff();}

  /* =================== model-specific character =================== */
  const tm=(S.cabS+S.cabE)/2;
  switch(si){
  case 0: // ---- Street Racer: hot hatch ----
    side(.2,.8,.40,.022,white);                                           // white sill stripe
    strip(.55,.93,0,W*.045,white);                                        // bonnet racing stripe
    glowOn();for(const s of [-1,1])drawSphere(vp,car,[s*W*.66,.40,nz-.08],[.07,.07,.035],[1,.95,.8]);glowOff(); // round fog lamps
    drawPart(vp,car,[0,.33,nz+.01],[W*.8,.04,.035],dim(color,.7));         // front lip
    break;
  case 1: { // ---- Muscle Storm: long-hood coupe ----
    strip(.60,.97,-W*.17,W*.07,white);strip(.60,.97,W*.17,W*.07,white);   // twin racing stripes (bonnet)
    strip(.10,.33,-W*.17,W*.07,white);strip(.10,.33,W*.17,W*.07,white);   // ... and deck
    const ts=.76,zs=-H+2*H*ts,ys=yTop(S,ts);
    drawPart(vp,car,[0,ys+.05,zs],[W*.2,.05,H*.1],carbon,-.04);            // bonnet scoop
    drawPart(vp,car,[0,ys+.035,zs+H*.095],[W*.17,.032,.02],[.01,.01,.012]);// scoop intake
    drawPart(vp,car,[0,.33,nz+.02],[W*.82,.04,.04],chrome);                // chrome bumper bar
    glowOn();for(const s of [-1,1])for(const o of [.52,.30])drawSphere(vp,car,[s*W*o,S.nose+.0,nz-.06],[.1,.1,.06],dark?[1,.96,.8]:[.9,.93,.95]);glowOff(); // quad round lamps
    side(.2,.8,.34,.018,[.12,.12,.13]);
    drawPart(vp,car,[0,.62,rz-.07],[W*.3,.05,.012],chrome);                // rear chrome trim
    break;}
  case 2: // ---- Volt Supercar: electric wedge ----
    glowOn();
    drawPart(vp,car,[0,S.nose+.03,nz-.03],[W*.74,.012,.012],cyan);         // front light bar
    side(.14,.86,t=>cyAt(S,t)+.04,.012,cyan);                              // cyan flank line
    drawPart(vp,car,[0,S.tail-.04,rz+.01],[W*.7,.012,.012],[1,.1,.08]);    // rear LED bar
    glowOff();
    for(const s of [-1,1])for(const z of [-wz-.05,wz]){
      drawSphere(vp,car,[s*(wx+.27),.39,z],[.008,.33,.33],[.02,.1,.12]);     // aero wheel covers
      glowOn();drawSphere(vp,car,[s*(wx+.278),.39,z],[.006,.08,.08],cyan);glowOff();
      }
    for(const s of [-1,1])drawPart(vp,car,[s*W*.7,.30,nz-.15],[.1,.01,.08],carbon); // canards
    drawPart(vp,car,[0,.295,nz-.02],[W*.6,.012,.1],carbon);
    break;
  case 3: { // ---- Hyper RS: GT3 track car ----
    const zr2=-H+2*H*tm;
    drawPart(vp,car,[0,S.roof+.045,zr2],[.07,.03,.16],carbon);             // roof scoop
    for(const s of [-1,1]){
      drawPart(vp,car,[s*W*.8,.30,nz-.12],[.14,.012,.1],carbon);           // front canards
      glowOn();drawSphere(vp,car,[s*W*.60,yTop(S,.86)+.0,H*.72],[.13,.1,.12],dark?[1,.97,.82]:[.88,.92,.95]);glowOff(); // round fender lamps
      drawPart(vp,car,[s*(sideX(S,.3)+.005),.5,-H*.4],[.01,.09,.18],[.01,.01,.012]); // rear-quarter vent
      drawSphere(vp,car,[s*(sideX(S,.5)+.005),.54,H*.02],[.008,.2,.2],white);        // door roundel
      drawSphere(vp,car,[s*(sideX(S,.5)+.011),.54,H*.02],[.006,.12,.12],[.05,.05,.06]);
    }
    side(.2,.8,.30,.018,[.85,.1,.08]);                                     // red sill stripe
    drawPart(vp,car,[0,.27,nz-.02],[W*.9,.014,.17],carbon);               // deep splitter
    break;}
  case 4: { // ---- Champion X: prototype hypercar ----
    const n=9,t0=.12,t1=.64;                                               // shark fin
    for(let k=0;k<n;k++){const ta=t0+(t1-t0)*k/n,tb=t0+(t1-t0)*(k+1)/n,tc=(ta+tb)/2,za=-H+2*H*ta,zb=-H+2*H*tb,base=yTop(S,tc),top=base+.02+.42*((t1-tc)/(t1-t0));drawPart(vp,car,[0,(base+top)/2,(za+zb)/2],[.014,(top-base)/2,Math.abs(zb-za)/2*1.04],dim(color,.9));}
    wingBlade(S.tail+.46,W*1.0,.28,rz+.5);                                 // twin-element rear wing
    wingBlade(S.tail+.58,W*.92,.13,rz+.42);
    for(const s of [-1,1])drawPart(vp,car,[s*W*.3,S.tail+.2,rz+.55],[.03,.26,.05],carbon);
    drawPart(vp,car,[0,S.tail+.25,rz+.6],[.03,.25,.05],carbon);
    drawPart(vp,car,[0,.26,nz-.02],[W*.98,.014,.2],carbon);                // wide splitter
    for(const s of [-1,1]){
      drawPart(vp,car,[s*W*.92,.30,nz-.22],[.1,.018,.12],carbon);          // dive planes
      drawPart(vp,car,[s*wx,.74,-wz-.05],[.29,.06,.46],color);             // wheel fairings
      drawPart(vp,car,[s*wx,.72,wz],[.29,.06,.42],color);
    }
    side(.2,.85,t=>cyAt(S,t)+.03,.016,[1,.55,.08]);                       // orange flank line
    strip(.55,.95,0,W*.08,[1,.55,.08]);                                    // orange nose stripe
    glowOn();for(const s of [-1,1])drawPart(vp,car,[s*W*.5,S.nose+.07,nz-.1],[.3,.012,.02],dark?[1,.97,.8]:[.9,.95,1]);glowOff();
    break;}
  }
};
})();
