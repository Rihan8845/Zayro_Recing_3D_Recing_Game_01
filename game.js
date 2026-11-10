'use strict';
const canvas=document.querySelector('#game');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
if(!gl){alert('WebGL is not available in this browser. Try Chrome or Edge.');throw new Error('WebGL unavailable');}
const vertexSource=`attribute vec3 aPos;attribute vec3 aNormal;
uniform mat4 uVP;uniform mat4 uModel;uniform vec3 uColor;uniform float uNight;uniform float uWet;uniform float uFogX;
varying vec3 vColor;varying float vFog;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vViewPos;
void main(){
  vec4 w=uModel*vec4(aPos,1.0);vec4 p=uVP*w;gl_Position=p;
  vec3 n=normalize(mat3(uModel)*aNormal);
  vec3 sunDir=normalize(vec3(-.42,.82,.36));
  float sun=max(dot(n,sunDir),0.0);
  float sky=.5+.5*n.y;
  vec3 sunCol=mix(vec3(1.0,.94,.82),vec3(.34,.42,.70),uNight);
  vec3 skyCol=mix(vec3(.60,.72,.92),vec3(.13,.17,.32),uNight);
  vec3 gndCol=mix(vec3(.46,.40,.32),vec3(.06,.06,.10),uNight);
  vec3 light=sunCol*sun*.60*(1.0-.5*uWet)+skyCol*(.20+.32*sky)+gndCol*.15*max(-n.y,0.0)+vec3(.05);
  float rim=pow(1.0-max(dot(n,normalize(vec3(.0,.35,1.0))),0.0),2.0)*.07;
  vColor=uColor*light+uColor*rim;
  vWorld=w.xyz;vNormal=n;vViewPos=p.xyz;
  float fk=1.0/(1.0+uFogX);vFog=clamp((p.w-95.0*fk)/(mix(360.0,230.0,uWet)*fk),0.0,.97);
}
`;
const fragmentSource=`#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uRoad;uniform float uWet;uniform float uFogX;uniform float uGloss;uniform float uHeadlights;uniform float uNight;uniform float uTime;uniform float uGlass;uniform float uEmit;uniform float uCity;uniform float uSky;
uniform vec4 uShadowA;uniform vec3 uShadowB;uniform float uAlpha;
uniform vec3 uFogColor;uniform vec3 uSkyTop;uniform vec3 uEye;uniform vec3 uHeadlightPos;uniform vec3 uHeadlightDir;
varying vec3 vColor;varying float vFog;varying vec3 vWorld;varying vec3 vNormal;varying vec3 vViewPos;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.0;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.7);a*=.5;}return s;}
vec3 sunDirV(){return normalize(vec3(-.42,.82,.36));}
vec3 envColor(vec3 R){
  float t=R.y;vec3 L=sunDirV();
  vec3 c=mix(uFogColor,uSkyTop,pow(clamp(t,0.0,1.0),.5));
  c=mix(c,mix(uFogColor*.45,vec3(.15,.155,.165)*(1.0-.6*uNight),.55),smoothstep(.0,-.3,t));
  float sd=max(dot(R,L),0.0);
  c+=vec3(1.0,.88,.68)*(pow(sd,24.0)*.45+pow(sd,300.0)*2.6)*(1.0-uNight)*(1.0-uWet*.85);
  return c;
}
float lampPool(){
  float dz=abs(mod(vWorld.z+90.0,110.0)-55.0);
  float dx=min(abs(vWorld.x-18.5),abs(vWorld.x+18.5));
  float s=exp(-(dz*dz)/288.0-(dx*dx)/288.0);
  if(uCity>.5){
    float dz2=abs(mod(vWorld.z-39.0,180.0)-90.0);
    float dx2=min(abs(vWorld.x-22.0),abs(vWorld.x+22.0));
    s+=exp(-(dz2*dz2)/392.0-(dx2*dx2)/450.0)*1.1;
  }
  return s;
}
void main(){
  vec3 L=sunDirV();
  if(uShadowB.z>0.0){
    vec2 d=vWorld.xz-uShadowA.xy;
    vec2 q=vec2(d.x*uShadowA.z-d.y*uShadowA.w,d.x*uShadowA.w+d.y*uShadowA.z)/uShadowB.xy;
    float r=pow(pow(abs(q.x),2.6)+pow(abs(q.y),2.6)+1e-5,.3846);
    float a=(1.0-smoothstep(.30,1.0,r))*uShadowB.z*(1.0-vFog);
    gl_FragColor=vec4(.012,.014,.022,a);return;
  }
  float night=uNight,day=1.0-uNight;
  if(uSky>.5){
    vec3 d=normalize(vWorld-uEye);float t=d.y;
    vec3 col=mix(uFogColor,uSkyTop,pow(clamp(t,0.0,1.0),.55));
    col=mix(col,uFogColor*.55,smoothstep(.0,-.18,t));
    float sd=max(dot(d,L),0.0);
    col+=vec3(1.0,.78,.5)*pow(sd,6.0)*.30*day*(1.0-uWet);
    col+=vec3(1.0,.95,.85)*pow(sd,64.0)*.55*day*(1.0-uWet);
    col+=vec3(1.0,.98,.92)*smoothstep(.9985,.9995,sd)*3.0*day*(1.0-uWet*.9);
    if(t>.01){
      vec2 uv=d.xz/(t+.22)*.9+vec2(uTime*.006,0.0);
      float c=fbm(uv*1.4);
      float cover=mix(.52,.28,uWet);
      float cl=smoothstep(cover,cover+.28,c)*smoothstep(.01,.2,t);
      vec3 cc=mix(vec3(.97,.98,1.0),vec3(.46,.50,.57),clamp(uWet+(1.0-c)*.28,0.0,1.0))*mix(1.0,.16,night);
      cc+=vec3(1.0,.80,.55)*pow(sd,5.0)*.25*day*(1.0-uWet);
      col=mix(col,cc,cl*.92);
    }
    if(night>.01&&t>.0){
      vec2 su=d.xz/(t+.3)*70.0;float h=h21(floor(su));
      col+=vec3(.9,.95,1.0)*step(.991,h)*(.5+.5*h21(floor(su)+3.1))*smoothstep(.08,.4,t)*night*(1.0-uWet);
      vec3 M=normalize(vec3(.35,.55,.75));float md=dot(d,M);
      col+=vec3(.85,.9,1.0)*(smoothstep(.9990,.9996,md)*1.3+pow(max(md,0.0),50.0)*.14)*night*(1.0-uWet*.8);
    }
    gl_FragColor=vec4(col,1.0);return;
  }
  vec3 fog=uFogColor;vec3 n=normalize(vNormal);vec3 V=normalize(uEye-vWorld);vec3 H=normalize(L+V);
  float dd=length(uEye-vWorld);float detail=1.0-smoothstep(22.0,150.0,dd);
  float nv=max(dot(n,V),0.0);
  float F0=.035+uGloss*.07;float F=F0+(1.0-F0)*pow(1.0-nv,5.0);
  vec3 R=reflect(-V,n);vec3 env=envColor(R);
  vec3 base=vColor;
  bool world=uGloss<.005;float paintM=0.0;
  if(uRoad>.5){
    vec2 p=vWorld.xz;
    float dl=(fract((vWorld.x-2.83)/5.66)-.5)*5.66;
    float track=1.0-smoothstep(.0,.42,abs(abs(dl)-.88));
    float n1=vn(p*.7),n2=vn(p*3.1),n3=vn(p*17.0),n4=h21(floor(p*48.0));
    base*=1.0+((n1-.5)*.16+(n2-.5)*.10)*(.5+.5*detail)+((n3-.5)*.09+(n4-.5)*.07)*detail;
    base*=1.0-track*.17;
    base*=1.0+(vn(p*.06)-.5)*.10+(vn(p*.23+31.0)-.5)*.06;
    float near=1.0-smoothstep(5.0,26.0,dd);
    vec2 ag=floor(p*46.0);
    vec3 an=normalize(n+vec3(h21(ag+3.1)-.5,0.0,h21(ag+7.7)-.5)*.95);
    float asp=pow(max(dot(an,H),0.0),70.0)*(1.0-uWet*.7)*day*near;
    base+=vec3(1.0,.93,.8)*asp*.11*step(.55,h21(ag));
    if(uCity<.5){float edge=smoothstep(12.8,15.4,abs(p.x));base=mix(base,base*.78+vec3(.045,.040,.032)*day,edge*.65);}
    float oil=smoothstep(.66,.82,vn(p*vec2(.45,.14)+4.0));base*=1.0-oil*track*.30;
    float crack=1.0-smoothstep(.0,.03,abs(vn(p*vec2(1.6,.55)+11.0)-.52));base*=1.0-crack*.22*detail;
    float pud=0.0,rip=0.0;
    if(uWet>.5){
      pud=smoothstep(.46,.60,fbm(p*.16+2.0))+track*.18;pud=clamp(pud,0.0,1.0);
      base*=1.0-.28-pud*.22;
      vec2 q=fract(p*1.7)-.5;float rr=length(q);
      rip=(.5+.5*sin(rr*38.0-uTime*9.0+h21(floor(p*1.7))*6.28))*smoothstep(.5,.0,rr)*.5*pud;
    }
    float Fr=.02+.98*pow(1.0-nv,5.0);
    float rf=Fr*.45*(1.0-uWet)+uWet*(.10+.42*pud+.5*Fr)*(1.0+rip*.5);
    base=mix(base,env*.85,clamp(rf,0.0,.82));
    float sp=pow(max(dot(n,H),0.0),30.0)*uWet*(.5+pud)*day;
    base+=vec3(.55,.62,.72)*sp*.25;
  }else if(uGlass>.5){
    vec2 cell=floor(vec2(vWorld.z*.8+vWorld.x*.8,vWorld.y*.9));
    float hh=h21(cell);float lit=step(.56,hh);
    base+=vec3(1.0,.78,.45)*lit*night*(.55+.45*h21(cell+7.0))*1.15;
    base=mix(base,env*.9,clamp(F*.55+.10*day,0.0,.7));
    base+=vec3(1.0,.95,.85)*pow(max(dot(n,H),0.0),70.0)*day*.5;
  }else{
    float cc=smoothstep(.3,.9,uGloss);
    float ndh=max(dot(n,H),0.0);
    float spec=pow(ndh,mix(10.0,120.0,uGloss))*uGloss;
    float spec2=pow(ndh,mix(40.0,420.0,uGloss))*cc;
    vec3 metalTint=mix(vec3(.9,.95,1.0),vColor*1.4+.1,.35);
    base+=vec3(1.0,.96,.88)*(spec*.45+spec2*1.1)*day+metalTint*spec*.22*night;
    float refl=clamp(F*uGloss*1.35+uGloss*.035,0.0,.8);
    float glassy=step(.94,uGloss)*step(dot(vColor,vec3(.3333)),.12);
    refl=mix(refl,clamp(refl*1.7+.10,0.0,.88),glassy);
    base=mix(base,env*mix(vec3(1.0),vColor*1.6+.2,.35*(1.0-glassy)),refl);
    float car=step(.005,uGloss);
    float ao=mix(.40,1.0,smoothstep(.04,.62,vWorld.y));
    base*=mix(1.0,ao,car);
    base*=1.0-.45*clamp(-n.y,0.0,1.0)*car;
    if(world){
      float lum0=dot(base,vec3(.299,.587,.114));
      if(uRoad<.5&&uEmit<.5){
        vec2 gp=vWorld.xz;
        if(vWorld.y<.06&&n.y>.9&&lum0>.5){
          float chip=smoothstep(.55,.82,fbm(gp*vec2(3.0,1.1)+5.0));
          float dirt=vn(gp*vec2(2.0,.7));
          base*=1.0-chip*.42*(.4+.6*detail)-dirt*.12;
          paintM=1.0;
        }else if(n.y>.75){
          float m1=fbm(gp*.35),m2=vn(gp*5.0),m3=h21(floor(gp*26.0));
          base*=1.0+(m1-.5)*.34+((m2-.5)*.14+(m3-.5)*.10)*detail;
        }else if(abs(n.y)<.5){
          float st=vn(vec2((vWorld.x+vWorld.z)*.9,vWorld.y*.22));
          base*=1.0-.16*smoothstep(.45,.9,st);
          base*=.94+.06*vn(vec2((vWorld.x+vWorld.z)*6.0,vWorld.y*6.0))*detail+.06*(1.0-detail);
        }
      }
    }
  }
  if(world&&n.y<.5&&uRoad<.5){base*=mix(.76,1.0,smoothstep(.0,7.0,vWorld.y));}
  if(uEmit>.5)base+=vColor*(.25+1.9*night);
  float pool=lampPool()*night;
  float lm=1.0-smoothstep(1.5,8.0,vWorld.y);
  base+=vec3(1.0,.74,.42)*pool*lm*(.42+.58*max(n.y,0.0))*(uRoad>.5?.40*(1.0+uWet*1.4):.22);
  vec3 toSurface=vWorld-uHeadlightPos;float lightDistance=length(toSurface);vec3 lightRay=normalize(toSurface);
  float spot=smoothstep(.76,.975,dot(lightRay,normalize(uHeadlightDir)));
  float falloff=1.0-smoothstep(7.0,100.0,lightDistance);
  float groundBias=1.0-smoothstep(1.8,5.5,vWorld.y);
  float hl=uHeadlights*spot*falloff*(.72+.28*groundBias)*(1.0-.25*smoothstep(0.0,18.0,lightDistance));
  base+=vec3(1.0,.84,.65)*hl*.5*(1.0-uWet*.15);
  base+=vec3(1.0,.95,.85)*paintM*hl*.9;
  vec3 fogCol=fog+vec3(1.0,.72,.45)*pow(max(dot(-V,L),0.0),5.0)*.22*day*(1.0-uWet);
  base=mix(base,fogCol,clamp(vFog,0.0,.86+.1*clamp(uFogX,0.0,1.0)));
  {vec3 hi=max(base-.80,vec3(0.0));base=base-hi+hi/(vec3(1.0)+hi*2.4);}
  float lum=dot(base,vec3(.299,.587,.114));
  base=mix(vec3(lum),base,1.08+.04*day);
  base=mix(base,smoothstep(.0,1.0,base),.28);
  base+=vec3(-.012,.004,.02)*(1.0-clamp(lum,0.0,1.0))*day+vec3(.025,.010,-.010)*lum*lum*day;
  gl_FragColor=vec4(base,uAlpha);
}
`;
function makeShader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,makeShader(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,makeShader(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const attr={pos:gl.getAttribLocation(program,'aPos'),normal:gl.getAttribLocation(program,'aNormal'),vp:gl.getUniformLocation(program,'uVP'),model:gl.getUniformLocation(program,'uModel'),color:gl.getUniformLocation(program,'uColor'),road:gl.getUniformLocation(program,'uRoad'),wet:gl.getUniformLocation(program,'uWet'),fog:gl.getUniformLocation(program,'uFogColor'),gloss:gl.getUniformLocation(program,'uGloss'),eye:gl.getUniformLocation(program,'uEye'),headlightPos:gl.getUniformLocation(program,'uHeadlightPos'),headlightDir:gl.getUniformLocation(program,'uHeadlightDir'),headlights:gl.getUniformLocation(program,'uHeadlights'),night:gl.getUniformLocation(program,'uNight'),time:gl.getUniformLocation(program,'uTime'),glass:gl.getUniformLocation(program,'uGlass'),emit:gl.getUniformLocation(program,'uEmit'),city:gl.getUniformLocation(program,'uCity'),sky:gl.getUniformLocation(program,'uSky'),skyTop:gl.getUniformLocation(program,'uSkyTop')};
// Weather-aware colour look shared by the sky, fog and clear colour.
function envLook(){const r=roadChoices[selectedRoad];let fog=r.fog.slice(),clear=r.clear.slice();if(condition==='rain'){const g=c=>{const l=(c[0]+c[1]+c[2])/3;return c.map(v=>(v*.35+l*.65)*.8);};fog=g(fog);clear=g(clear);}else if(condition==='night'){fog=[fog[0]*.14+.012,fog[1]*.17+.018,fog[2]*.30+.05];clear=[clear[0]*.12+.012,clear[1]*.15+.018,clear[2]*.26+.04];}const sky=[Math.min(1,clear[0]*.62),Math.min(1,clear[1]*.80),Math.min(1,clear[2]*1.25+.02)];return {fog,clear,sky};}
let freeRoam=false;let missionMode=['free','checkpoints','police'].includes(localStorage.getItem('apexMission'))?localStorage.getItem('apexMission'):'free';let showroomCar=Math.max(0,Math.min(4,Number(localStorage.getItem('apexShowroomCar'))||0));let missionCheckpoints=0,nextCheckpoint=260,policeHeat=0;const policeUnit={x:0,z:-28,yaw:0,active:false,nearMissCooldown:0};const roadWidth=34,roadEnd=3600,staticBatches=new Map(),batches=[];const roadChoices=[{name:'City Express',fog:[.48,.67,.77],clear:[.48,.67,.78]},{name:'Coastal Drive',fog:[.32,.67,.78],clear:[.25,.65,.82]},{name:'Desert Canyon',fog:[.81,.58,.36],clear:[.78,.58,.4]},{name:'Alpine Snow',fog:[.72,.83,.89],clear:[.66,.81,.91]},{name:'Neon Night',fog:[.15,.12,.28],clear:[.035,.045,.12]}];let selectedRoad=Math.max(0,Math.min(4,Number(localStorage.getItem('apexRoad'))||0));
const paintChoices=[{id:'factory',name:'Factory',hex:null,swatch:'#d8ff38'},{id:'red',name:'Racing Red',hex:'#f43d32',swatch:'#f43d32'},{id:'blue',name:'Electric Blue',hex:'#168cff',swatch:'#168cff'},{id:'black',name:'Midnight',hex:'#222831',swatch:'#222831'},{id:'white',name:'Pearl White',hex:'#e9eef1',swatch:'#e9eef1'},{id:'gold',name:'Champagne Gold',hex:'#e6ad36',swatch:'#e6ad36'},{id:'purple',name:'Volt Purple',hex:'#8d55ff',swatch:'#8d55ff'}];let selectedPaint=paintChoices.some(x=>x.id===localStorage.getItem('apexPaint'))?localStorage.getItem('apexPaint'):'factory';let raceEvent=['circuit','sprint','timeTrial'].includes(localStorage.getItem('apexRaceEvent'))?localStorage.getItem('apexRaceEvent'):'circuit';let raceTargetDistance=1200;
let graphicsQuality=['performance','balanced','ultra'].includes(localStorage.getItem('apexGraphics'))?localStorage.getItem('apexGraphics'):'balanced';
let difficulty=['rookie','pro','legend'].includes(localStorage.getItem('apexDifficulty'))?localStorage.getItem('apexDifficulty'):'pro';
// Adaptive renderer: gently lowers pixel density when frame rate falls, then recovers when stable.
let adaptiveRenderScale=1, fpsSampleFrames=0, fpsSampleSeconds=0, displayedFPS=60;
let careerStats=(()=>{try{return {...{starts:0,finishes:0,crashes:0,distance:0,bestSpeed:0,creditsEarned:0},...JSON.parse(localStorage.getItem('apexCareerStats')||'{}')}}catch(_){return {starts:0,finishes:0,crashes:0,distance:0,bestSpeed:0,creditsEarned:0}}})();
const difficultyInfo={rookie:{traffic:.82,rivals:.86,reward:0.85,label:'ROOKIE'},pro:{traffic:1,rivals:1,reward:1,label:'PRO'},legend:{traffic:1.2,rivals:1.22,reward:1.6,label:'LEGEND'}};
function saveCareerStats(){localStorage.setItem('apexCareerStats',JSON.stringify(careerStats));refreshCareerStats();}
function refreshCareerStats(){const el=byId('careerStats');if(el)el.innerHTML=`<div><small>RACES STARTED</small><b>${careerStats.starts}</b></div><div><small>STAGES CLEARED</small><b>${careerStats.finishes}</b></div><div><small>CRASHES</small><b>${careerStats.crashes}</b></div><div><small>TOP SPEED</small><b>${Math.round(careerStats.bestSpeed)} KM/H</b></div><div><small>TOTAL DISTANCE</small><b>${Math.round(careerStats.distance).toLocaleString()} M</b></div><div><small>CREDITS EARNED</small><b>${Math.round(careerStats.creditsEarned).toLocaleString()} CR</b></div>`;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('selected',b.dataset.difficulty===difficulty));}
const faceData=[[[ -1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]]],triangles=[0,1,2,0,2,3];
function modelMatrix(pos,scale,yaw=0,pitch=0){const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);return new Float32Array([c*scale[0],0,-s*scale[0],0,s*sp*scale[1],cp*scale[1],c*sp*scale[1],0,s*cp*scale[2],-sp*scale[2],c*cp*scale[2],0,pos[0],pos[1],pos[2],1]);}
function addCube(colorKey,p,size,yaw=0){let b=staticBatches.get(colorKey);if(!b){b={p:[],n:[],color:colorKey};staticBatches.set(colorKey,b);}const c=Math.cos(yaw),s=Math.sin(yaw);for(const f of faceData)for(const j of triangles){const v=f[j],n=f[4],x=v[0]*size[0],z=v[2]*size[2];b.p.push(p[0]+x*c+z*s,p[1]+v[1]*size[1],p[2]-x*s+z*c);b.n.push(n[0]*c+n[2]*s,n[1],-n[0]*s+n[2]*c);}}
let K={ground:[.28,.34,.30],road:[.12,.14,.15],shoulder:[.38,.4,.39],white:[.88,.89,.85],yellow:[.95,.72,.15],barrier:[.52,.57,.57],barrierDark:[.27,.31,.32],building1:[.23,.3,.34],building2:[.31,.35,.37],building3:[.18,.24,.29],glass:[.19,.48,.56],glass2:[.36,.63,.68],sign:[.04,.32,.19],signLight:[.74,.84,.65],lamp:[.75,.78,.73],trunk:[.25,.16,.09],tree:[.16,.33,.18]};
function cityRandom(){citySeed=(citySeed*1664525+1013904223)>>>0;return citySeed/4294967296;}let citySeed=48291;
function buildWorld(theme){for(const b of batches){gl.deleteBuffer(b.pb);gl.deleteBuffer(b.nb);}batches.length=0;staticBatches.clear();citySeed=48291+theme*7831;
const palettes=[
{ground:[.28,.34,.3],road:[.12,.14,.15],shoulder:[.38,.4,.39],barrier:[.52,.57,.57],barrierDark:[.27,.31,.32],building1:[.23,.3,.34],building2:[.31,.35,.37],building3:[.18,.24,.29],glass:[.19,.48,.56],glass2:[.36,.63,.68],sign:[.04,.32,.19],signLight:[.74,.84,.65],lamp:[.75,.78,.73],tree:[.16,.33,.18]},
{ground:[.28,.42,.39],road:[.19,.2,.19],shoulder:[.64,.59,.42],barrier:[.68,.69,.63],barrierDark:[.35,.39,.37],building1:[.46,.48,.39],building2:[.54,.52,.39],building3:[.33,.42,.4],glass:[.1,.52,.63],glass2:[.3,.72,.78],sign:[.02,.35,.27],signLight:[.85,.87,.63],lamp:[.84,.82,.62],tree:[.1,.38,.25]},
{ground:[.66,.48,.27],road:[.2,.17,.14],shoulder:[.67,.52,.32],barrier:[.68,.57,.42],barrierDark:[.4,.29,.2],building1:[.56,.34,.19],building2:[.66,.42,.22],building3:[.42,.27,.18],glass:[.35,.48,.5],glass2:[.48,.55,.52],sign:[.42,.22,.08],signLight:[.94,.72,.27],lamp:[.75,.58,.35],tree:[.23,.39,.2]},
{ground:[.76,.84,.88],road:[.28,.32,.35],shoulder:[.83,.88,.9],barrier:[.77,.86,.9],barrierDark:[.37,.46,.52],building1:[.5,.61,.68],building2:[.6,.7,.75],building3:[.39,.53,.62],glass:[.36,.67,.78],glass2:[.62,.8,.87],sign:[.07,.25,.34],signLight:[.83,.96,1],lamp:[.8,.9,.96],tree:[.1,.31,.27]},
{ground:[.045,.065,.11],road:[.055,.065,.09],shoulder:[.09,.1,.17],barrier:[.21,.18,.35],barrierDark:[.08,.08,.15],building1:[.08,.09,.19],building2:[.12,.1,.24],building3:[.07,.08,.16],glass:[.08,.74,.91],glass2:[.84,.08,.74],sign:[.1,.06,.24],signLight:[.1,.95,.93],lamp:[.45,.16,.78],tree:[.07,.27,.21]}
];const base={white:[.88,.89,.85],yellow:[.95,.72,.15],trunk:[.25,.16,.09],water:[.08,.5,.68],cliff:[.52,.33,.19],snow:[.88,.94,.98]};K={...base,...palettes[theme]};gl.clearColor(...roadChoices[theme].clear,1);
addCube(K.ground,[0,-1,1740],[freeRoam?360:260,.9,1880]);addCube(K.road,[0,-.105,(roadEnd-120)/2],[roadWidth/2,.12,(roadEnd+120)/2]);
for(const side of [-1,1]){addCube(K.shoulder,[side*17.15,-.01,1740],[.9,.14,1860]);addCube(K.white,[side*16.25,.025,1740],[.1,.025,1860]);if(!freeRoam){for(let z=-100;z<roadEnd;z+=14)addCube(K.barrier,[side*18.25,.82,z],[.14,.72,6.8]);for(let z=-100;z<roadEnd;z+=28)addCube(K.barrierDark,[side*18.25,.36,z],[.19,.12,1.7]);for(let z=-100;z<roadEnd;z+=56){addCube(K.barrier,[side*18.25,.73,z+28],[.13,.1,28]);addCube(K.white,[side*18.25,1.08,z+28],[.17,.1,28]);}}else{addCube(K.shoulder,[side*19.5,-.02,1740],[2.3,.12,1860]);addCube(K.white,[side*21.7,.025,1740],[.12,.025,1860]);}}
// More believable highway markings: solid edge lines, dashed lane separators, raised reflectors and rumble strips.
const rumbleRed=[.82,.12,.09],rumbleWhite=[.92,.9,.78],reflectorColor=[.72,.75,.68],patchMid=[.105,.115,.12],patchLight=[.135,.145,.15],patchDark=[.075,.082,.085],seamColor=[.085,.095,.10],brakeWear=[.095,.105,.11];
for(const side of [-1,1]){
  addCube(K.white,[side*15.55,.028,1740],[.105,.025,1860]);
  if(!freeRoam)for(let z=-100;z<roadEnd;z+=8){
    const rumble=(Math.floor((z+100)/8)%2===0)?rumbleRed:rumbleWhite;
    addCube(rumble,[side*15.05,.028,z],[.24,.028,3.8]);
  }
  if(!freeRoam)for(let z=-90;z<roadEnd;z+=24)addCube(reflectorColor,[side*14.45,.035,z],[.10,.035,.18]);
}
for(const x of (freeRoam?[-8.5,8.5]:[-11.33,-5.66,0,5.66,11.33]))for(let z=-105;z<roadEnd;z+=29)addCube(K.white,[x,.025,z+7],[.075,.025,freeRoam?8:13]);
// Faded repair patches and thin tar seams break up the perfectly uniform asphalt.
for(let i=0;i<175;i++){
  const x=(cityRandom()*27)-13.5,z=-80+cityRandom()*(roadEnd-100),len=1.2+cityRandom()*5.5,w=.18+cityRandom()*.72;
  addCube(i%3===0?patchMid:patchLight,[x,.018,z],[w,.012,len],(cityRandom()-.5)*.22);
  if(i%3===0)addCube(patchDark,[x+(cityRandom()-.5)*.7,.02,z+len*.22],[.035,.014,len*.32],(cityRandom()-.5)*.1);
}
// Occasional transverse expansion joints and worn braking zones.
for(let z=170;z<roadEnd;z+=215){
  addCube(seamColor,[0,.02,z],[roadWidth*.47,.012,.055]);
  for(const x of [-8,-4,0,4,8])addCube(brakeWear,[x,.022,z+1.8],[.34,.014,2.2]);
}
for(let z=-35;z<roadEnd;z+=110)for(const side of [-1,1]){const x=side*21;addCube(K.barrierDark,[x,5.2,z],[.16,5.1,.16]);addCube(K.barrierDark,[side*19.4,10.15,z],[1.8,.14,.16]);addCube(K.lamp,[side*18.3,10.02,z],[.72,.13,.38]);}
if(freeRoam){
  // City grid: broad cross streets, pedestrian crossings, sidewalks, storefronts and apartment blocks.
  const asphalt=[.105,.115,.12],sidewalk=[.48,.49,.46],crosswalk=[.82,.83,.78],pole=[.12,.14,.15];
  for(let z=110;z<roadEnd-70;z+=180){
    addCube(asphalt,[0,-.1,z],[125,.11,10]);
    for(const side of [-1,1]){
      addCube(sidewalk,[side*23,.02,z],[2.1,.18,17]);
      for(let stripe=-7;stripe<=7;stripe+=2)addCube(crosswalk,[stripe,.045,z-5.7],[.62,.025,2.1]);
      // Signal mast and three visible signal lenses at each corner.
      for(const sx of [side*18.8,side*24.5]){
        addCube(pole,[sx,3.1,z-8],[.13,3.1,.13]);
        addCube([.075,.08,.09],[sx,5.8,z-8],[.38,.72,.28]);
        addCube([.22,.045,.035],[sx,6.02,z-8.16],[.12,.12,.035]);
        addCube([.22,.16,.025],[sx,5.8,z-8.16],[.12,.12,.035]);
        addCube([.025,.22,.045],[sx,5.58,z-8.16],[.12,.12,.035]);
      }
    }
    // Shopfronts and mixed-height city buildings on both sides.
    for(const side of [-1,1]){
      for(let bx=0;bx<3;bx++){
        const x=side*(34+bx*24),h=10+cityRandom()*23,w=8+cityRandom()*4,d=20+cityRandom()*10;
        const tone=[K.building1,K.building2,K.building3][Math.floor(cityRandom()*3)];
        addCube(tone,[x,h/2,z+cityRandom()*17],[w/2,h/2,d/2]);
        addCube(K.glass,[x-side*(w/2+.025),2.5,z+cityRandom()*17],[.06,1.4,d*.30]);
        addCube(K.glass2,[x-side*(w/2+.03),5.5,z+cityRandom()*17],[.07,.75,d*.26]);
        addCube([.72,.38,.12],[x-side*(w/2+.09),.8,z+cityRandom()*8],[.08,.42,d*.20]);
        for(let floor=8;floor<h-2;floor+=5){for(let win=-1;win<=1;win++)addCube(cityRandom()>.55?K.glass:K.glass2,[x-side*(w/2+.04),floor,z+win*d*.23],[.06,.65,.8]);if(floor<h-4){addCube(K.barrierDark,[x-side*(w/2+.18),floor-1.1,z],[.16,.045,d*.34]);addCube(K.barrier,[x-side*(w/2+.20),floor-.78,z],[.035,.25,d*.34]);}}
        // Rooftop HVAC boxes, parapet trim and shop awnings add recognizable urban silhouettes.
        addCube(K.barrierDark,[x,h+.28,z],[w*.32,.28,d*.22]);
        addCube(K.barrier,[x-side*(w/2+.12),1.7,z+d*.18],[.24,.12,d*.26]);
        addCube(K.sign,[x-side*(w/2+.17),2.55,z-d*.18],[.12,.34,d*.34]);
      }
      // Road lamps and benches.
      addCube(pole,[side*23,3.2,z+19],[.11,3.2,.11]);
      addCube(K.lamp,[side*23,6.2,z+19],[.7,.12,.3]);
      addCube([.25,.2,.15],[side*25,.48,z+8],[1.2,.12,.35]);
      // Simple low-poly pedestrians waiting near each crosswalk.
      for(let person=0;person<3;person++){
        const px=side*(20.5+person*1.1),pz=z+9+person*1.7;
        const skin=[[.68,.46,.31],[.86,.68,.52],[.48,.31,.2]][person];
        const shirt=[[.12,.28,.72],[.72,.12,.1],[.12,.48,.3]][person];
        addCube(skin,[px,1.48,pz],[.19,.19,.19]);
        addCube(shirt,[px,1.02,pz],[.24,.39,.16]);
        addCube([.12,.13,.15],[px-.11,.43,pz],[.09,.29,.1]);
        addCube([.12,.13,.15],[px+.11,.43,pz],[.09,.29,.1]);
        addCube(shirt,[px-.3,1.02,pz],[.09,.3,.1]);
        addCube(shirt,[px+.3,1.02,pz],[.09,.3,.1]);
      }
    }
  }
  // Paint dashed lane dividers and occasional turning arrows at city intersections.
  for(let z=0;z<roadEnd;z+=24){addCube([.88,.86,.72],[-5.6,.026,z],[.07,.02,10]);addCube([.88,.86,.72],[5.6,.026,z],[.07,.02,10]);}
}
if(theme===0||theme===4){for(let z=-40;z<roadEnd-80;z+=48)for(const side of [-1,1]){const w=8+cityRandom()*9,d=13+cityRandom()*15,h=17+cityRandom()*42,x=side*(25+cityRandom()*48),tone=[K.building1,K.building2,K.building3][Math.floor(cityRandom()*3)];addCube(tone,[x,h/2,z+cityRandom()*24],[w/2,h/2,d/2],(cityRandom()-.5)*.06);for(let floor=0;floor<h-4;floor+=5)addCube(cityRandom()>.5?K.glass:K.glass2,[x-side*w*.49,floor+3,z+cityRandom()*2],[.05,.19,d*.38]);addCube(K.barrierDark,[x,h+.12,z],[w*.53,.16,d*.52]);}}
if(theme===1)for(const side of [-1,1]){addCube(K.water,[side*118,-.34,1740],[82,.18,1880]);addCube(K.shoulder,[side*29,-.07,1740],[10,.14,1860]);for(let z=0;z<roadEnd;z+=170)addCube(K.barrier,[side*33,1.1,z],[.35,1.1,7]);}
if(theme===2)for(const side of [-1,1])for(let z=-50;z<roadEnd;z+=70){const h=45+cityRandom()*65,x=side*(30+cityRandom()*4);addCube(K.cliff,[x,h/2,z],[5+cityRandom()*4,h/2,22+cityRandom()*9],(cityRandom()-.5)*.12);addCube(K.shoulder,[side*25,.3,z+20],[3,.4,10]);}
if(theme===3)for(const side of [-1,1])for(let z=-30;z<roadEnd;z+=95){const h=32+cityRandom()*58,x=side*(43+cityRandom()*18);addCube(K.snow,[x,h/2,z],[18+cityRandom()*9,h/2,34+cityRandom()*15],(cityRandom()-.5)*.2);addCube(K.white,[side*22,.5,z],[3,.5,24]);}
for(const z of [260,870,1480,2180,2870]){addCube(K.barrierDark,[-18,10.8,z],[.28,5.4,.3]);addCube(K.barrierDark,[18,10.8,z],[.28,5.4,.3]);addCube(K.barrier,[0,16,z],[18,.25,.3]);for(const x of [-10,-3.4,3.4,10]){addCube(K.sign,[x,14.6,z],[2.5,1.05,.16]);addCube(K.signLight,[x,15,z-.19],[.72,.06,.035]);}}
if(theme===0||theme===1){for(let i=0;i<42;i++){const side=i%2?1:-1,z=-30+cityRandom()*(roadEnd-20),x=side*(theme===1?26:23+cityRandom()*6),h=theme===1?5+cityRandom()*3:2.8+cityRandom()*2;addCube(K.trunk,[x,h*.35,z],[.2,h*.36,.2]);addCube(K.tree,[x,h+.4,z],[.95,.5,.95],cityRandom());if(theme===1)for(let branch=0;branch<4;branch++)addCube(K.tree,[x+Math.cos(branch*Math.PI/2)*1.15,h+1.6,z+Math.sin(branch*Math.PI/2)*1.15],[.14,.13,1.25],branch*Math.PI/2);}}
if(theme===2)for(let i=0;i<26;i++){const side=i%2?1:-1,z=cityRandom()*roadEnd,x=side*(22+cityRandom()*3),h=2+cityRandom()*3;addCube(K.trunk,[x,h,z],[.35,h,.35]);addCube(K.tree,[x-side*.5,h*.72,z],[.7,.16,.22]);}
if(theme===3)for(let i=0;i<30;i++){const side=i%2?1:-1,z=cityRandom()*roadEnd,x=side*(23+cityRandom()*12),h=4+cityRandom()*4;for(let tier=0;tier<3;tier++)addCube(K.tree,[x,h*.35+tier*.72,z],[1.3-tier*.28,.95-tier*.13,1.3-tier*.28]);}
for(const [z,c] of [[18,K.white],[19,K.barrierDark],[20,K.white]])addCube(c,[0,.035,z],[roadWidth/2,.035,.55]);
for(const b of staticBatches.values()){const pb=gl.createBuffer(),nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.p),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.n),gl.STATIC_DRAW);batches.push({pb,nb,count:b.p.length/3,color:b.color});}}
buildWorld(selectedRoad);
const cubePos=[],cubeNorm=[];for(const f of faceData)for(const j of triangles){cubePos.push(...f[j].slice(0,3));cubeNorm.push(...f[4]);}const cubePB=gl.createBuffer(),cubeNB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cubePB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cubePos),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,cubeNB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(cubeNorm),gl.STATIC_DRAW);
const wheelPos=[],wheelNorm=[];for(let i=0;i<16;i++){const a=i*Math.PI*2/16,b=(i+1)*Math.PI*2/16,y1=Math.cos(a),z1=Math.sin(a),y2=Math.cos(b),z2=Math.sin(b);wheelPos.push(-1,y1,z1,1,y1,z1,1,y2,z2,-1,y1,z1,1,y2,z2,-1,y2,z2);for(const [yy,zz] of [[y1,z1],[y1,z1],[y2,z2],[y1,z1],[y2,z2],[y2,z2]])wheelNorm.push(0,yy,zz);wheelPos.push(-1,0,0,-1,y2,z2,-1,y1,z1,1,0,0,1,y1,z1,1,y2,z2);wheelNorm.push(-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0);}const wheelPB=gl.createBuffer(),wheelNB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,wheelPB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(wheelPos),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,wheelNB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(wheelNorm),gl.STATIC_DRAW);
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([-f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);/* FIX: x mirrored so right steering moves the car to the screen's right */}
function lookAt(e,c,u=[0,1,0]){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function bind(pb,nb){gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.enableVertexAttribArray(attr.pos);gl.vertexAttribPointer(attr.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.enableVertexAttribArray(attr.normal);gl.vertexAttribPointer(attr.normal,3,gl.FLOAT,false,0,0);}
function drawCube(vp,p,size,yaw,color){bind(cubePB,cubeNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,size,yaw));gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.02);gl.drawArrays(gl.TRIANGLES,0,36);}
function localPoint(car,x,y,z){const c=Math.cos(car.yaw),s=Math.sin(car.yaw);return [car.x+x*c+z*s,y,car.z-x*s+z*c];}
function drawPart(vp,car,off,size,color,pitch=0){const p=localPoint(car,off[0],off[1],off[2]);if(car===player)p[1]+=suspensionBob;bind(cubePB,cubeNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,size,car.yaw,pitch+(car===player?car.roll*.12+car.pitch:0)));gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.46);gl.drawArrays(gl.TRIANGLES,0,36);}
const spherePos=[],sphereNorm=[];for(let lat=0;lat<8;lat++)for(let lon=0;lon<12;lon++){const point=(a,b)=>[Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)],a0=lat*Math.PI/8,a1=(lat+1)*Math.PI/8,b0=lon*Math.PI/6,b1=(lon+1)*Math.PI/6,p00=point(a0,b0),p01=point(a0,b1),p10=point(a1,b0),p11=point(a1,b1);for(const v of [p00,p10,p11,p00,p11,p01]){spherePos.push(...v);sphereNorm.push(...v);}}const spherePB=gl.createBuffer(),sphereNB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,spherePB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(spherePos),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,sphereNB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(sphereNorm),gl.STATIC_DRAW);
const bodyPos=[],bodyNorm=[];for(let iz=0;iz<12;iz++)for(let ia=0;ia<16;ia++){const z0=-1+2*iz/12,z1=-1+2*(iz+1)/12,a0=ia*Math.PI*2/16,a1=(ia+1)*Math.PI*2/16,profile=z=>.52+.48*Math.pow(Math.max(0,1-z*z),.34),v=(z,a)=>[Math.cos(a)*profile(z),Math.sin(a)*.78,-z],v00=v(z0,a0),v01=v(z0,a1),v10=v(z1,a0),v11=v(z1,a1);for(const q of [v00,v10,v11,v00,v11,v01]){bodyPos.push(...q);const n=[q[0],q[1]*1.2,q[2]*.2],nl=Math.hypot(...n)||1;bodyNorm.push(n[0]/nl,n[1]/nl,n[2]/nl);}}const bodyPB=gl.createBuffer(),bodyNB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,bodyPB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(bodyPos),gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,bodyNB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(bodyNorm),gl.STATIC_DRAW);
function drawBody(vp,car,w,L,color){const p=localPoint(car,0,.61,0);if(car===player)p[1]+=suspensionBob;bind(bodyPB,bodyNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[w,.29,L*.5],car.yaw,car===player?car.roll*.12+car.pitch:0));gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.82);gl.drawArrays(gl.TRIANGLES,0,bodyPos.length/3);}
function drawSphere(vp,car,off,size,color){const p=localPoint(car,...off);if(car===player)p[1]+=suspensionBob;bind(spherePB,sphereNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,size,car.yaw));gl.uniform3fv(attr.color,color);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.22);gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);}
let wheelSpin=0, suspensionBob=0;
function drawWheel(vp,car,x,z){const wheelY=.39+(car===player?suspensionBob+Math.sin(time*18+x*2+z)*Math.min(.025,Math.abs(car.speed)*.00022):0),spin=car===player?wheelSpin:((car.speed||0)*performance.now()*.0027);const p=localPoint(car,x,wheelY,z),wheelYaw=car.yaw+(car===player&&z>0?steer*.42:0);bind(wheelPB,wheelNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[.25,.37,.37],wheelYaw));gl.uniform3fv(attr.color,[.02,.025,.03]);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,.12);gl.drawArrays(gl.TRIANGLES,0,wheelPos.length/3);const hub=localPoint(car,x+Math.sign(x)*.22,wheelY,z);gl.uniformMatrix4fv(attr.model,false,modelMatrix(hub,[.035,.2,.2],car.yaw));gl.uniform3fv(attr.color,[.56,.6,.62]);gl.uniform1f(attr.gloss,.68);gl.drawArrays(gl.TRIANGLES,0,wheelPos.length/3);for(let spoke=0;spoke<5;spoke++){const a=spoke*Math.PI*2/5+spin,sp=localPoint(car,x+Math.sign(x)*.225,wheelY+Math.cos(a)*.105,z+Math.sin(a)*.105);gl.uniformMatrix4fv(attr.model,false,modelMatrix(sp,[.025,.035,.13],car.yaw,a));gl.uniform3fv(attr.color,[.72,.76,.77]);gl.uniform1f(attr.gloss,.72);gl.drawArrays(gl.TRIANGLES,0,36);}}
const cars=[{name:'Street Racer',type:'STAGE 01 · STARTER',color:[.36,.96,.035],top:52,accel:6.8,style:0,grip:1.00,nitro:4.5},{name:'Muscle Storm',type:'STAGE 02 · V8 POWER',color:[.96,.18,.055],top:62,accel:7.4,style:4,grip:1.03,nitro:5.0},{name:'Volt Supercar',type:'STAGE 03 · ELECTRIC BOOST',color:[.04,.82,.88],top:75,accel:8.2,style:2,grip:1.08,nitro:5.8},{name:'Hyper RS',type:'STAGE 04 · TRACK SPEC',color:[.78,.82,.91],top:86,accel:9.2,style:1,grip:1.12,nitro:6.4},{name:'Champion X',type:'STAGE 05 · WORLD CLASS',color:[1,.62,.035],top:94,accel:10.0,style:0,grip:1.17,nitro:7.0}];
let selectedCar=Math.max(0,Math.min(4,Number(localStorage.getItem('apexSelectedCar'))||0));
function playerPaintColor(){const paint=paintChoices.find(x=>x.id===selectedPaint);if(!paint||!paint.hex)return cars[selectedCar].color;const hex=paint.hex.replace('#','');return [parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255];}
function uploadPaintOptions(){const wrap=byId('paintSelect');if(!wrap)return;wrap.innerHTML=paintChoices.map(x=>`<button type="button" class="paint-swatch ${x.id===selectedPaint?'selected':''}" data-paint="${x.id}" style="--paint:${x.swatch}" aria-label="${x.name}" title="${x.name}"><i></i><small>${x.name}</small></button>`).join('');wrap.querySelectorAll('[data-paint]').forEach(b=>b.onclick=()=>{selectedPaint=b.dataset.paint;localStorage.setItem('apexPaint',selectedPaint);uploadPaintOptions();pop(`${paintChoices.find(x=>x.id===selectedPaint).name.toUpperCase()} PAINT SELECTED`);});}
function setRaceEvent(next){raceEvent=next;localStorage.setItem('apexRaceEvent',raceEvent);document.querySelectorAll('[data-event]').forEach(b=>b.classList.toggle('selected',b.dataset.event===raceEvent));const hints={circuit:'Circuit: race rivals to the full stage finish.',sprint:'Sprint: shorter 800 m run with rivals and quick rewards.',timeTrial:'Time Trial: solo run with no rivals; beat the stage target time.'};const hint=byId('raceEventHint');if(hint)hint.textContent=hints[raceEvent];const start=byId('startButton');if(start&&!freeRoam)start.innerHTML=(raceEvent==='sprint'?'START SPRINT':raceEvent==='timeTrial'?'START TIME TRIAL':'START ULTIMATE RACE')+' <span>↗</span>';if(byId('targetDistance'))byId('targetDistance').textContent=freeRoam?'FREE':String(raceEvent==='sprint'?800:stageTargets[stage-1]);document.querySelectorAll('[data-event]').forEach(b=>b.classList.toggle('selected',b.dataset.event===raceEvent));}
function drawCar(vp,car,color,style=0,boost=false){const shape=[{w:1.00,l:2.02,roof:.43,hood:.39,cab:.57,track:.53,front:.32,rear:.30,spoiler:.68},{w:1.15,l:2.18,roof:.52,hood:.46,cab:.63,track:.60,front:.35,rear:.33,spoiler:.88},{w:.96,l:2.24,roof:.34,hood:.34,cab:.50,track:.54,front:.25,rear:.28,spoiler:.54},{w:1.13,l:2.28,roof:.66,hood:.43,cab:.70,track:.59,front:.30,rear:.34,spoiler:.98},{w:1.20,l:2.34,roof:.47,hood:.48,cab:.59,track:.64,front:.39,rear:.36,spoiler:.92}][style%5],w=shape.w,L=shape.l,glass=[.035,.075,.09];
  // Soft, flattened contact shadow helps every car sit on the road instead of floating.
  drawSphere(vp,car,[.05,.022,-.04],[w*.80,.012,L*.70],[.012,.014,.017]);
  const brakingNow=car===player&&typeof fieldInputs==='function'?fieldInputs().brake:!!car.braking;
  drawBody(vp,car,w,L,color);
  // Different body proportions per stage: short-nose street car, long-hood muscle,
  // low wedge supercar, tall track hypercar, and wide endurance champion prototype.
  drawPart(vp,car,[0,.78,L*.34],[w*shape.hood,.075,L*shape.front],color);
  drawPart(vp,car,[0,.76,-L*.36],[w*shape.rear,.085,L*shape.rear],color);
  drawPart(vp,car,[0,.88,-.09],[w*shape.cab,shape.roof*.43,L*.43],color.map(v=>Math.min(1,v*1.12)));
  drawPart(vp,car,[0,1.025,-.09],[w*shape.cab*.86,.065,L*.25],color.map(v=>Math.min(1,v*1.14)));
  drawPart(vp,car,[0,.99,L*.09],[w*shape.cab*.78,.025,L*.18],glass,.57);
  drawPart(vp,car,[0,.99,-L*.29],[w*shape.cab*.76,.024,L*.12],glass,-.48);
  for(const side of [-1,1])drawPart(vp,car,[side*w*.31,.98,-.12],[.024,.14,L*.17],glass);
  drawPart(vp,car,[0,.44,L*.51],[w*.97,.12,.13],[.18,.19,.2]);drawPart(vp,car,[0,.51,L*.555],[w*.42,.16,.045],[.035,.045,.05]);drawPart(vp,car,[0,.37,L*.56],[w*1.08,.045,.12],[.08,.09,.1]);drawPart(vp,car,[0,.43,-L*.52],[w*.98,.13,.13],[.12,.13,.14]);drawPart(vp,car,[0,.7,-L*.565],[w*.58,.08,.045],[.82,.012,.015]);for(let fin=-2;fin<=2;fin++)drawPart(vp,car,[fin*.19,.35,-L*.54],[.045,.18,.14],[.08,.09,.1]);for(const side of [-1,1])drawPart(vp,car,[side*.3,.43,-L*.59],[.105,.09,.08],[.48,.52,.55]);
  for(const side of [-1,1]){drawPart(vp,car,[side*w*.57,.93,.17],[.3,.12,.22],color.map(v=>Math.min(1,v*1.1)),side*.16);drawPart(vp,car,[side*w*.65,.91,.19],[.14,.16,.14],[.045,.055,.06]);drawPart(vp,car,[side*w*.39,.77,L*.51],[.22,.095,.08],condition==='night'?[1,.99,.86]:[1,.88,.57]);drawPart(vp,car,[side*w*.4,.48,-L*.57],[.25,.12,.12],[.22,.24,.25]);drawSphere(vp,car,[side*w*.39,.78,-L*.535],[.13,.15,.075],brakingNow?[1,.015,.012]:[.72,.012,.016]);drawSphere(vp,car,[side*w*.39,.78,-L*.49],[.075,.085,.045],brakingNow?[1,.12,.035]:[.72,.12,.035]);drawPart(vp,car,[side*w*.54,.56,0],[.08,.08,L*.7],color.map(v=>v*.72));for(const z of [-L*.32,L*.32])drawWheel(vp,car,side*w*shape.track,z);}
  for(const side of [-1,1]){drawPart(vp,car,[side*w*.58,.58,0],[.055,.07,L*.42],[.12,.15,.16]);drawPart(vp,car,[side*w*.48,.65,-L*.12],[.055,.035,.22],[.7,.76,.78]);}
  // Sculpted bodywork, reflective trim and model-specific aero details
  // Hood center ridge and twin sculpting lines catch the scene lighting.
  drawPart(vp,car,[0,.915,L*.30],[w*.23,.018,L*.25],color.map(v=>Math.min(1,v*1.28)));
  for(const side of [-1,1]){
    drawPart(vp,car,[side*w*.39,.66,L*.05],[.035,.12,L*.43],color.map(v=>Math.min(1,v*1.18)),side*.025);
    drawPart(vp,car,[side*w*.48,.61,L*.08],[.045,.035,L*.50],[.58,.64,.68]);
    // Wheel-arch lips and rear quarter vents
    for(const z of [-L*.32,L*.32]) drawPart(vp,car,[side*w*.56,.67,z],[.075,.17,.46],[.075,.085,.095]);
    drawPart(vp,car,[side*w*.43,.83,-L*.31],[.045,.045,.23],[.025,.03,.035]);
    // Mirror cap and tiny mirror-glass highlight
    drawPart(vp,car,[side*w*.73,1.02,L*.12],[.16,.075,.13],color.map(v=>Math.min(1,v*1.12)),side*.12);
    drawPart(vp,car,[side*w*.79,1.025,L*.12],[.035,.038,.075],[.55,.72,.78]);
    // Door handle and metallic sill create a more convincing scale model
    drawPart(vp,car,[side*w*.59,.79,-.02],[.035,.035,.13],[.72,.76,.78]);
    drawPart(vp,car,[side*w*.59,.49,0],[.035,.045,L*.62],[.42,.48,.52]);
  }
  // Glass lens covers, amber side repeaters and windshield pillars give the bodywork a more production-car finish.
  for(const side of [-1,1]){
    drawPart(vp,car,[side*w*.39,.765,L*.535],[.25,.105,.035],condition==='night'?[1,.98,.82]:[.88,.92,.9]);
    drawPart(vp,car,[side*w*.66,.75,L*.12],[.045,.055,.11],[1,.52,.08]);
    drawPart(vp,car,[side*w*.31,1.015,.005],[.045,.19,.06],[.08,.105,.12],-.12);
    drawPart(vp,car,[side*w*.31,1.015,-.20],[.04,.17,.055],[.08,.105,.12],.10);
  }
  drawPart(vp,car,[0,1.055,L*.13],[w*.39,.018,L*.018],[.58,.72,.78],-.12);
  // Windscreen glint and rear glass reflection strip (stylized reflection, no external assets)
  drawPart(vp,car,[0,1.075,L*.075],[w*.39,.012,L*.075],[.36,.57,.64],-.12);
  drawPart(vp,car,[0,1.065,-L*.285],[w*.38,.012,L*.045],[.32,.5,.57],.12);
  // Front intake mesh slats and bright DRL signature
  for(let vent=-3;vent<=3;vent++) drawPart(vp,car,[vent*.13,.49,L*.572],[.035,.035,.018],[.48,.53,.56]);
  drawPart(vp,car,[0,.56,L*.573],[w*.42,.025,.025],[.78,.9,1]);
  // Rear diffuser, metallic exhaust tips and broad brake-light signature
  drawPart(vp,car,[0,.34,-L*.55],[w*.76,.065,.18],[.055,.065,.075]);
  for(const side of [-1,1]){
    drawPart(vp,car,[side*w*.28,.405,-L*.625],[.12,.095,.09],[.42,.46,.49]);
    drawPart(vp,car,[side*w*.28,.405,-L*.676],[.07,.055,.025],[.12,.14,.16]);
  }
  drawPart(vp,car,[0,.715,-L*.56],[w*.58,.035,.022],[1,.045,.025]);
  // Low side skirt with subtle color-matched aero blades
  for(const side of [-1,1]){
    drawPart(vp,car,[side*w*.58,.42,0],[.08,.09,L*.72],color.map(v=>v*.78));
    for(const z of [-.18,.02,.22]) drawPart(vp,car,[side*w*.62,.39,z],[.08,.055,.09],[.18,.2,.22]);
  }
  if(style===2){drawPart(vp,car,[0,.46,L*.61],[w*.72,.035,.05],[.1,.95,1]);drawPart(vp,car,[0,.38,-L*.65],[w*.58,.04,.06],[.1,.9,1]);}
  if(style===4){for(const side of [-1,1])drawPart(vp,car,[side*.22,.925,L*.27],[.075,.02,L*.29],[.08,.085,.09]);}
  if(style===0||style===1||style===4){drawPart(vp,car,[0,1.16,-L*.48],[w*shape.spoiler,.055,.11],[.12,.14,.15]);drawPart(vp,car,[0,1.24,-L*.5],[w*(shape.spoiler+.08),.065,.16],color);for(let vent=-3;vent<=3;vent++)drawPart(vp,car,[vent*.12,.89,-L*.39],[.07,.025,.22],[.12,.14,.15]);}
  if(style===3)drawPart(vp,car,[0,1.32,-.1],[w*.88,.06,L*.38],[.15,.18,.19]);
  // Extra body sculpting: flared wheel arches, hood creases, mirrors and glassy lamp lenses.
  for(const side of [-1,1]){
    for(const z of [-L*.32,L*.32]){
      drawPart(vp,car,[side*w*.57,.69,z],[.14,.34,.43],[.12,.13,.14]);
      drawPart(vp,car,[side*w*.635,.68,z],[.045,.22,.34],color.map(v=>Math.min(1,v*1.06)));
    }
    drawPart(vp,car,[side*w*.38,.805,L*.24],[.11,.025,L*.24],color.map(v=>Math.min(1,v*1.18)));
    drawPart(vp,car,[side*w*.68,1.02,.12],[.18,.07,.16],[.09,.11,.12]);
    drawPart(vp,car,[side*w*.39,.51,L*.575],[.23,.07,.025],[.94,.97,.86]);
    drawPart(vp,car,[side*w*.39,.51,-L*.575],[.24,.075,.025],[.95,.025,.018]);
  }
  drawPart(vp,car,[0,.81,L*.23],[w*.48,.025,L*.22],color.map(v=>Math.min(1,v*1.12)));
  drawPart(vp,car,[0,.82,-L*.22],[w*.48,.025,L*.2],color.map(v=>Math.min(1,v*1.12)));
  drawPart(vp,car,[0,.58,L*.49],[w*.42,.08,.045],[.045,.055,.06]);
  // Model-specific visual packages: body stripes, trim, roof rails and aero parts.
  if(style===0){ // Neon GT: low splitter and luminous side skirts
    drawPart(vp,car,[0,.34,L*.56],[w*1.13,.045,.22],[.08,.09,.11]);
    for(const side of [-1,1])drawPart(vp,car,[side*w*.57,.43,0],[.09,.07,L*.63],[.16,.95,.08]);
  } else if(style===1){ // Rally RS: twin hood stripes and rally wing
    for(const side of [-1,1]){
      drawPart(vp,car,[side*.24,.914,L*.28],[.105,.018,L*.24],[.94,.94,.88]);
      drawPart(vp,car,[side*w*.57,.43,0],[.075,.08,L*.62],[.12,.12,.13]);
    }
    drawPart(vp,car,[0,1.29,-L*.51],[w*1.02,.055,.22],[.16,.17,.18]);
  } else if(style===2){ // Volt S: clean electric accents and front light bar
    drawPart(vp,car,[0,.49,L*.574],[w*.68,.035,.025],[.12,.96,.9]);
    for(const side of [-1,1]){
      drawPart(vp,car,[side*w*.55,.47,0],[.055,.045,L*.54],[.12,.96,.9]);
      drawPart(vp,car,[side*.2,.918,L*.27],[.07,.016,L*.22],[.2,.9,.84]);
    }
  } else if(style===3){ // Titan X: SUV roof rails, chunky arches and side steps
    for(const side of [-1,1]){
      drawPart(vp,car,[side*w*.31,1.38,-.1],[.07,.035,L*.43],[.24,.27,.29]);
      drawPart(vp,car,[side*w*.59,.57,0],[.1,.11,L*.78],[.12,.13,.14]);
      for(const z of [-L*.32,L*.32])drawPart(vp,car,[side*w*.57,.73,z],[.18,.08,.31],[.18,.2,.21]);
    }
  } else { // Muscle R: dual dark racing stripes and rear diffuser
    for(const side of [-1,1]){
      drawPart(vp,car,[side*.2,.916,L*.25],[.095,.02,L*.3],[.09,.095,.1]);
      drawPart(vp,car,[side*.2,.916,-L*.24],[.095,.02,L*.25],[.09,.095,.1]);
    }
    for(let fin=-2;fin<=2;fin++)drawPart(vp,car,[fin*.16,.34,-L*.54],[.055,.13,.19],[.035,.04,.045]);
  }
  // Signature front splitter, side intakes and model-specific aero silhouette.
  if(style===0){
    drawPart(vp,car,[0,.345,L*.57],[w*1.10,.045,.23],[.045,.05,.055]);
    for(const side of [-1,1])drawPart(vp,car,[side*w*.40,.57,L*.27],[.12,.10,.28],[.12,.13,.14]);
  } else if(style===1){
    drawPart(vp,car,[0,.36,L*.57],[w*1.16,.06,.24],[.07,.075,.08]);
    for(const side of [-1,1])drawPart(vp,car,[side*w*.43,.58,L*.18],[.16,.12,.34],[.09,.095,.10]);
  } else if(style===2){
    drawPart(vp,car,[0,.35,L*.59],[w*1.08,.035,.18],[.08,.09,.10]);
    for(const side of [-1,1])drawPart(vp,car,[side*w*.38,.51,L*.43],[.22,.09,.035],[.1,.92,.94]);
  } else if(style===3){
    drawPart(vp,car,[0,.37,L*.58],[w*1.13,.06,.23],[.07,.08,.09]);
    for(const side of [-1,1])drawPart(vp,car,[side*w*.44,.56,L*.22],[.18,.15,.32],[.11,.12,.13]);
  } else {
    drawPart(vp,car,[0,.34,L*.59],[w*1.18,.055,.24],[.045,.05,.055]);
    for(const side of [-1,1]){
      drawPart(vp,car,[side*w*.38,.55,L*.30],[.24,.11,.045],[.96,.62,.035]);
      drawPart(vp,car,[side*w*.47,.44,-L*.34],[.16,.12,.24],[.07,.08,.09]);
    }
  }
  // Progressive collision wear on the player's car: scuffs, scraped trim and cracked glass.
  // These are lightweight procedural details, so no external textures/assets are required.
  if(car===player && crashCount>0){
    const wear=crashCount/ MAX_CRASHES;
    const scrape=[.075,.082,.088],metalScratch=[.56,.58,.58];
    for(const side of [-1,1]){
      drawPart(vp,car,[side*w*.585,.705,L*.06],[.022,.025,L*(.16+.025*crashCount)],scrape,side*.025);
      drawPart(vp,car,[side*w*.60,.755,-L*.18],[.018,.018,L*.10],metalScratch,-side*.035);
      if(crashCount>=2){
        drawPart(vp,car,[side*w*.43,.56,L*.48],[.07,.035,.028],[.18,.19,.19]);
        drawPart(vp,car,[side*w*.51,.64,-L*.36],[.025,.025,.13],[.22,.23,.23],side*.08);
      }
    }
    drawPart(vp,car,[0,.475,L*.578],[w*(.20+.07*wear),.026,.022],scrape);
    if(crashCount>=2){
      // Fine windshield fracture lines become visible after repeated hard impacts.
      drawPart(vp,car,[-.075,1.035,L*.105],[.014,.012,.22],[.62,.72,.74],-.26);
      drawPart(vp,car,[.045,1.032,L*.12],[.012,.012,.18],[.62,.72,.74],.31);
    }
    if(crashCount>=3){
      drawPart(vp,car,[0,.93,L*.30],[w*.20,.018,L*.12],[.12,.13,.13]);
    }
  }
  // Clear-coat style paint highlights: slim bright bands mimic reflections on curved panels.
  const paintHi=color.map(v=>Math.min(1,v*1.42+.08));
  drawPart(vp,car,[0,.934,L*.31],[w*.42,.012,L*.19],paintHi,-.035);
  for(const side of [-1,1]){
    drawPart(vp,car,[side*w*.34,.735,L*.12],[.018,.018,L*.38],paintHi,side*.02);
    drawPart(vp,car,[side*w*.32,.932,-L*.25],[.025,.012,L*.17],paintHi);
  }
  // Cockpit furniture is rendered in hood/first-person camera mode.
  if(car===player && typeof cameraMode!=='undefined' && cameraMode===1){
    const dash=[.035,.045,.055],leather=[.075,.085,.095],metal=[.36,.43,.48],screen=[.04,.72,.84];
    drawPart(vp,car,[0,1.19,.73],[w*.91,.16,.35],dash,-.05);
    drawPart(vp,car,[0,1.275,.67],[w*.42,.018,.18],leather,-.05);
    drawPart(vp,car,[-.34,1.29,.65],[.2,.018,.11],screen,-.05);
    drawPart(vp,car,[.34,1.29,.65],[.2,.018,.11],[.12,.18,.22],-.05);
    // Steering column and wheel with metallic spokes.
    drawPart(vp,car,[-.02,1.08,.48],[.075,.16,.09],metal,-.28);
    drawPart(vp,car,[-.02,1.13,.38],[.29,.045,.055],leather,-.18);
    drawPart(vp,car,[-.16,1.13,.38],[.045,.15,.055],leather,-.18);
    drawPart(vp,car,[.12,1.13,.38],[.045,.15,.055],leather,-.18);
    drawPart(vp,car,[-.02,1.13,.38],[.025,.12,.035],metal,-.18);
    // Console, gear selector and pedal hints.
    drawPart(vp,car,[.32,.91,.22],[.19,.12,.4],leather,-.12);
    drawPart(vp,car,[.31,1.01,.15],[.055,.12,.055],metal,-.22);
    drawPart(vp,car,[-.35,.88,.22],[.13,.07,.3],[.09,.1,.11]);
    // Driver-focused digital instrument cluster with speed, RPM and shift indicator.
    drawPart(vp,car,[0,1.255,.49],[.39,.095,.045],[.018,.03,.038],-.08);
    drawPart(vp,car,[-.105,1.263,.462],[.13,.032,.018],[.04,.78,.88],-.08);
    drawPart(vp,car,[.105,1.263,.462],[.13,.032,.018],[Math.min(1,engineRPM/5200),Math.max(.12,1-engineRPM/6500),.12],-.08);
    drawPart(vp,car,[0,1.292,.462],[.07,.018,.018],[.95,.76,.24],-.08);
    // Steering-wheel hub and paddle shifters.
    drawPart(vp,car,[-.02,1.13,.345],[.085,.085,.035],metal,-.18);
    drawPart(vp,car,[-.225,1.13,.39],[.025,.12,.035],[.58,.62,.66],-.18);
    drawPart(vp,car,[.185,1.13,.39],[.025,.12,.035],[.58,.62,.66],-.18);
    // HVAC vents, stitching and a subtle center infotainment screen.
    for(const vent of [-1,0,1])drawPart(vp,car,[vent*.095,1.215,.52],[.07,.012,.018],metal,-.05);
    drawPart(vp,car,[.31,1.12,.32],[.16,.09,.025],[.025,.18,.22],-.12);
    drawPart(vp,car,[.31,1.12,.30],[.11,.012,.012],[.08,.82,.92],-.12);
    // Rain-only animated windshield wipers, visible from the cockpit camera.
    if(condition==='rain'){const wipe=Math.sin(time*5.4)*.36;drawPart(vp,car,[-.12,1.365,.96],[.58,.018,.035],[.12,.15,.17],wipe);drawPart(vp,car,[.28,1.355,.94],[.43,.014,.03],[.16,.18,.20],-wipe*.72);}
  }
  if(boost){for(const side of [-1,1]){drawPart(vp,car,[side*.32,.47,-L*.58],[.12,.13,.55],[.1,.58,1]);drawPart(vp,car,[side*.32,.47,-L*.7],[.17,.19,.12],[.36,.82,1]);}}
}
function drawHeavyVehicle(vp,v){
  // Larger procedural traffic vehicles: city bus and articulated-style freight truck.
  const car={x:v.x,z:v.z,yaw:0},truck=v.kind==='truck',paint=v.color;
  const length=truck?4.4:3.8,width=truck?1.28:1.18;
  drawSphere(vp,car,[0,.055,0],[width*.82,.035,length*.68],[.025,.03,.035]);
  // Chassis and front cab
  drawPart(vp,car,[0,.53,length*.03],[width,.30,length*.43],truck?[.12,.14,.16]:paint);
  drawPart(vp,car,[0,.95,length*.27],[width*.78,.49,.47],paint);
  drawPart(vp,car,[0,1.12,length*.27],[width*.68,.25,.045],[.08,.22,.28]);
  drawPart(vp,car,[0,.76,length*.515],[width*.72,.08,.035],[.92,.94,.84]);
  for(const side of [-1,1]){
    drawPart(vp,car,[side*width*.53,.8,length*.28],[.045,.28,.34],[.055,.065,.07]);
    drawPart(vp,car,[side*width*.53,.73,-length*.04],[.045,.12,length*.54],truck?[.72,.75,.74]:paint);
    drawPart(vp,car,[side*width*.53,.56,length*.5],[.045,.08,.08],[1,.82,.38]);
    drawPart(vp,car,[side*width*.53,.53,-length*.49],[.045,.1,.08],[.92,.025,.02]);
    for(const z of [-length*.34,length*.32])drawWheel(vp,car,side*width*.56,z);
  }
  if(truck){
    drawPart(vp,car,[0,.88,-length*.24],[width*1.02,.62,.49],[.76,.78,.76]);
    drawPart(vp,car,[0,1.51,-length*.24],[width*.96,.035,.035],[.42,.45,.46]);
    for(let z=-1.35;z<-.55;z+=.25)drawPart(vp,car,[0,.9,z],[width*.98,.018,.025],[.58,.61,.61]);
    for(const side of [-1,1])drawWheel(vp,car,side*width*.56,-length*.38);
  }else{
    drawPart(vp,car,[0,1.02,-length*.18],[width*.92,.47,.55],paint);
    for(let z=-1.05;z<.1;z+=.34)drawPart(vp,car,[0,1.03,z],[width*.93,.025,.035],[.07,.24,.29]);
    drawPart(vp,car,[0,.56,-length*.49],[width*.78,.12,.035],[.85,.04,.035]);
  }
}
function uploadRoadOptions(){const wrap=byId('roadSelect'),styles=['road-city','road-coast','road-desert','road-snow','road-neon'];wrap.innerHTML=roadChoices.map((r,i)=>'<button class="road-option '+styles[i]+' '+(i===selectedRoad?'selected':'')+'" data-road="'+i+'"><b>'+r.name+'</b><small>0'+(i+1)+'</small></button>').join('');wrap.querySelectorAll('.road-option').forEach(b=>b.onclick=()=>{selectedRoad=Number(b.dataset.road);localStorage.setItem('apexRoad',String(selectedRoad));buildWorld(selectedRoad);uploadRoadOptions();});}
function uploadCarOptions(){const wrap=document.querySelector('#carSelect');wrap.innerHTML=cars.map((c,i)=>{const color='#'+c.color.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');return `<button class="car-option ${i===(freeRoam?showroomCar:stage-1)?'selected':''}" data-car="${i}" style="--car-color:${color}" title="Automatically assigned in Stage ${i+1}"><i class="car-silhouette"></i><b>${c.name}</b><small>${c.type}</small><span class="garage-spec"><em>V-MAX</em><i><b style="width:${Math.min(100,c.top)}%"></b></i><strong>${Math.round(c.top*3.6)}</strong></span><span class="garage-spec"><em>LAUNCH</em><i><b style="width:${c.accel*1.25}%"></b></i><strong>${c.accel}</strong></span></button>`;}).join('');wrap.querySelectorAll('.car-option').forEach(b=>b.onclick=()=>{const requestedCar=Number(b.dataset.car);if(freeRoam){if(requestedCar+1>unlocked){pop('WIN MORE STAGES TO UNLOCK THIS CAR');return;}showroomCar=requestedCar;selectedCar=requestedCar;localStorage.setItem('apexShowroomCar',String(showroomCar));uploadCarOptions();pop(`${cars[requestedCar].name.toUpperCase()} SELECTED IN SHOWROOM`);return;}const requestedStage=requestedCar+1;if(requestedStage>unlocked){pop('COMPLETE THE PREVIOUS STAGE FIRST!');return;}stage=requestedStage;selectedCar=stage-1;updateStageCards();uploadCarOptions();});}
const stageNames=['City Sprint','Rush Hour','Skyline Pro','Grand Prix','World Champion'],stageTargets=[1200,1750,2300,2800,3300],stageParTimes=[58,78,98,118,138];let stage=1,unlocked=Math.max(1,Math.min(5,Number(localStorage.getItem('apexUnlockedStage'))||1)),playerName='';
let mode=(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches)?'touch':'keyboard',physicsMode=localStorage.getItem('apexPhysics')||'arcade',condition=localStorage.getItem('apexCondition')||'clear',musicOn=localStorage.getItem('apexMusic')!=='off',audio=null,musicGain=null,engineGain=null,engineOsc=null,engineOsc2=null,boostGain=null,boostOsc=null,reverseGain=null,reverseOsc=null,engineNoiseGain=null,engineNoiseFilter=null,enginePulseGain=null,enginePulseOsc=null,accelTone=null,accelGain=null,brakeTone=null,brakeGain=null,brakeNoiseGain=null,brakeNoiseFilter=null,musicStep=0,musicTimer=null;
let player={x:0,z:0,yaw:0,speed:0,lateralVelocity:0,slip:0,roll:0,pitch:0},currentGear=1,engineRPM=900,shiftCooldown=0,brakeDive=0,crashParticles=[],tireSmoke=[],crashFlash=0,traffic=[],rivals=[],racePoints=0,overtakeCount=0,lastPosition=4,keys=new Set(),touch={left:false,right:false,accelerate:false,brake:false,reverse:false,boost:false,wheel:0};
let running=false,paused=false,finished=false,boosting=false,time=0,nitro=100,best=Number(localStorage.getItem('apexBest')||Infinity),steer=0,lastFrame=performance.now(),toastLeft=0,collisionCooldown=0,crashCount=0,skidTimer=0,skidMarks=[],impactShake=0,absActive=false,tractionActive=false;
let bestGhosts=(()=>{try{const x=JSON.parse(localStorage.getItem('apexGhosts')||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch(_){return {}}})();let ghostPlayback=null,ghostRecording=[],ghostSampleClock=0,ghostHudClock=0,ghostRecordingMaxZ=-Infinity;
function currentGhostKey(){return raceEvent+':'+stage;}
function ghostPoseAt(distance){const samples=ghostPlayback&&ghostPlayback.samples;if(!samples||!samples.length)return null;if(distance<=samples[0][1])return {x:samples[0][0],z:samples[0][1],yaw:samples[0][2],time:samples[0][3]};const last=samples[samples.length-1];if(distance>=last[1])return {x:last[0],z:last[1],yaw:last[2],time:last[3]};let lo=0,hi=samples.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid][1]<=distance)lo=mid;else hi=mid;}const a=samples[lo],b=samples[hi],f=Math.max(0,Math.min(1,(distance-a[1])/Math.max(.001,b[1]-a[1]))),yawDelta=Math.atan2(Math.sin(b[2]-a[2]),Math.cos(b[2]-a[2]));return {x:a[0]+(b[0]-a[0])*f,z:a[1]+(b[1]-a[1])*f,yaw:a[2]+yawDelta*f,time:a[3]+(b[3]-a[3])*f};}
function refreshGhostHUD(){const el=byId('ghostDelta');if(!el)return;if(!ghostPlayback){el.textContent='PERSONAL BEST GHOST · NONE';el.className='ghost-delta';return;}const pose=ghostPoseAt(player.z);if(!pose){el.textContent='BEST GHOST READY';el.className='ghost-delta';return;}const delta=time-pose.time,ahead=delta<-.025;el.textContent=ahead?'AHEAD · '+Math.abs(delta).toFixed(2)+'s':'BEHIND · +'+Math.max(0,delta).toFixed(2)+'s';el.className='ghost-delta '+(ahead?'ahead':'behind');}
function captureGhostSample(dt){ghostSampleClock+=dt;if(ghostSampleClock<.25)return;ghostSampleClock%=.25;if(player.z>ghostRecordingMaxZ+.25){ghostRecording.push([Math.round(player.x*100)/100,Math.round(player.z*100)/100,Math.round(player.yaw*1000)/1000,Math.round(time*100)/100]);ghostRecordingMaxZ=player.z;}}
let skillPoints=0,currentSkillCombo=0,bestSkillCombo=Math.max(0,Number(localStorage.getItem('apexBestSkillCombo')||0)),nearMisses=0,skillComboTimer=0,nextSpeedTrap=500,drafting=false;
function addSkillPoints(points){const n=Math.max(0,Math.round(points));if(!n)return;skillPoints+=n;currentSkillCombo+=n;skillComboTimer=3.25;if(currentSkillCombo>bestSkillCombo){bestSkillCombo=currentSkillCombo;}}
function refreshSkillUI(){const score=byId('skillScore'),combo=byId('skillCombo'),miss=byId('nearMissCount'),status=byId('draftStatus');if(score)score.textContent=skillPoints.toLocaleString()+' PTS';if(combo)combo.textContent='x'+(currentSkillCombo>=1800?3:currentSkillCombo>=800?2:currentSkillCombo>=250?1.5:1).toFixed(currentSkillCombo>=250?1:0)+' · '+currentSkillCombo.toLocaleString();if(miss)miss.textContent=String(nearMisses);if(status){status.textContent=drafting?'SLIPSTREAM ACTIVE':'CLEAN AIR';status.classList.toggle('active',drafting);}}
let credits=Math.max(0,Number(localStorage.getItem('apexCredits')||1200)),garageUpgrades=(()=>{try{return {...{speed:0,grip:0,nitro:0,brakes:0,suspension:0},...JSON.parse(localStorage.getItem('apexUpgrades')||'{}')}}catch(_){return {speed:0,grip:0,nitro:0,brakes:0,suspension:0}}})();
let tyreWear=(()=>{const n=Number(localStorage.getItem('apexTyreWear')||0);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;})();let engineTemp=72,conditionSaveTimer=0;
const upgradeInfo={speed:{base:300,step:180,max:5},grip:{base:250,step:150,max:5},nitro:{base:350,step:200,max:5},brakes:{base:280,step:160,max:5},suspension:{base:320,step:175,max:5}};
function upgradePrice(type){return upgradeInfo[type].base+garageUpgrades[type]*upgradeInfo[type].step;}
function refreshGarage(){const balance=byId('creditBalance');if(balance)balance.textContent=credits.toLocaleString()+' CR';for(const type of ['speed','grip','nitro','brakes','suspension']){const level=garageUpgrades[type],info=upgradeInfo[type],levelEl=byId(type+'UpgradeLevel'),priceEl=byId(type+'UpgradePrice'),button=document.querySelector(`[data-upgrade="${type}"]`);if(levelEl)levelEl.textContent=`LEVEL ${level}/${info.max}`;if(priceEl)priceEl.textContent=level>=info.max?'MAX LEVEL ✓':`BUY · ${upgradePrice(type)} CR`;if(button){button.disabled=level>=info.max;button.classList.toggle('maxed',level>=info.max);}}refreshVehicleConditionUI();}
const PROFILE_SAVE_KEYS=['apexPlayerName','apexUnlockedStage','apexSelectedCar','apexShowroomCar','apexRoad','apexPaint','apexRaceEvent','apexGraphics','apexDifficulty','apexCareerStats','apexPhysics','apexCondition','apexMusic','apexBest','apexBestSkillCombo','apexCredits','apexUpgrades','apexTyreWear','apexAwards','apexMission','dilseDailyGiftDate','dilseDailyGiftStreak','apexGhosts'];
function exportDriverSave(){const save={};for(const key of PROFILE_SAVE_KEYS){const value=localStorage.getItem(key);if(value!==null)save[key]=value;}const payload={game:'ZAYRO-RACING',version:1,exportedAt:new Date().toISOString(),save};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`ZAYRO-RACING-${(playerName||'DRIVER').replace(/[^a-z0-9_-]+/gi,'-').slice(0,20)}-save.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);pop('DRIVER SAVE EXPORTED');}
function isValidDriverSave(data){if(!data||data.game!=='ZAYRO-RACING'||data.version!==1||!data.save||typeof data.save!=='object'||Array.isArray(data.save))return false;const entries=Object.entries(data.save);if(entries.length>PROFILE_SAVE_KEYS.length)return false;for(const [key,value] of entries){if(!PROFILE_SAVE_KEYS.includes(key)||typeof value!=='string'||value.length>900000)return false;const number=Number(value);if(['apexCredits','apexBestSkillCombo','dilseDailyGiftStreak'].includes(key)&&(!Number.isFinite(number)||number<0||number>100000000))return false;if(key==='apexUnlockedStage'&&(!Number.isInteger(number)||number<1||number>5))return false;if(['apexSelectedCar','apexShowroomCar'].includes(key)&&(!Number.isInteger(number)||number<0||number>4))return false;if(key==='apexTyreWear'&&(!Number.isFinite(number)||number<0||number>100))return false;if(key==='apexPlayerName'&&(value.length<2||value.length>20))return false;if(key==='apexMission'&&!['free','checkpoints','police'].includes(value))return false;if(key==='apexPaint'&&!['factory','red','blue','black','white','gold','purple'].includes(value))return false;if(key==='apexRaceEvent'&&!['circuit','sprint','timeTrial'].includes(value))return false;if(key==='apexGraphics'&&!['performance','balanced','ultra'].includes(value))return false;if(key==='apexDifficulty'&&!['rookie','pro','legend'].includes(value))return false;if(key==='apexPhysics'&&!['arcade','sim'].includes(value))return false;if(key==='apexCondition'&&!['clear','rain','night'].includes(value))return false;if(key==='apexMusic'&&!['on','off'].includes(value))return false;if(key==='apexBest'&&value!=='Infinity'&&(!Number.isFinite(number)||number<0))return false;if(key==='dilseDailyGiftDate'&&value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;if(key==='apexUpgrades'){let x;try{x=JSON.parse(value)}catch(_){return false}if(!x||['speed','grip','nitro','brakes','suspension'].some(k=>!Number.isInteger(x[k])||x[k]<0||x[k]>5))return false;}if(key==='apexAwards'){let x;try{x=JSON.parse(value)}catch(_){return false}if(!x||Object.entries(x).some(([k,v])=>!['1','2','3','4','5'].includes(k)||!['gold','silver'].includes(v)))return false;}if(key==='apexCareerStats'){let x;try{x=JSON.parse(value)}catch(_){return false}if(!x||['starts','finishes','crashes','distance','bestSpeed','creditsEarned'].some(k=>!Number.isFinite(x[k])||x[k]<0))return false;}}if(data.save.apexGhosts!==undefined){const value=data.save.apexGhosts;let x;try{x=JSON.parse(value)}catch(_){return false}if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length>15)return false;for(const [k,g] of Object.entries(x)){if(!/^(circuit|sprint|timeTrial):[1-5]$/.test(k)||!g||!Number.isFinite(g.time)||g.time<0||g.time>1800||!Array.isArray(g.samples)||g.samples.length<2||g.samples.length>1400)return false;let prevZ=-Infinity;for(const q of g.samples){if(!Array.isArray(q)||q.length!==4||q.some(n=>!Number.isFinite(n))||q[0]<-20||q[0]>20||q[1]<-100||q[1]>4000||q[2]<-7||q[2]>7||q[3]<0||q[3]>1800||q[1]<=prevZ)return false;prevZ=q[1];}}}return entries.length>0;}
async function importDriverSave(file){if(!file||file.size>1500000){pop('SAVE FILE INVALID OR TOO LARGE');return;}try{const data=JSON.parse(await file.text());if(!isValidDriverSave(data))throw new Error('invalid save');if(!confirm('Replace this browser’s ZAYRO RACING progress with the selected driver save?'))return;for(const key of PROFILE_SAVE_KEYS)localStorage.removeItem(key);for(const [key,value] of Object.entries(data.save))localStorage.setItem(key,value);location.reload();}catch(_){pop('SAVE FILE INVALID · YOUR CURRENT PROFILE IS SAFE');}}
function localDayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function shiftDayKey(key,delta){const d=new Date(`${key}T12:00:00`);d.setDate(d.getDate()+delta);return localDayKey(d);}
function refreshDailyGift(){const button=byId('dailyGiftButton'),message=byId('dailyGiftMessage'),streakEl=byId('dailyGiftStreak');if(!button)return;const today=localDayKey(),claimed=localStorage.getItem('dilseDailyGiftDate')===today,streak=Math.max(0,Number(localStorage.getItem('dilseDailyGiftStreak')||0));button.disabled=claimed;button.textContent=claimed?'GIFT CLAIMED ✓':'CLAIM FREE GIFT ✨';if(message)message.textContent=claimed?'You got today’s gift! Come back tomorrow for another.':'Claim 300–700 free Race Credits today. No race required!';if(streakEl)streakEl.textContent=`LOGIN STREAK · ${streak} DAY${streak===1?'':'S'}`;}
function claimDailyGift(){const today=localDayKey();if(localStorage.getItem('dilseDailyGiftDate')===today){pop('TODAY’S GIFT ALREADY CLAIMED · COME BACK TOMORROW');refreshDailyGift();return;}const previous=localStorage.getItem('dilseDailyGiftDate'),oldStreak=Math.max(0,Number(localStorage.getItem('dilseDailyGiftStreak')||0));const streak=previous===shiftDayKey(today,-1)?oldStreak+1:1;const base=300+Math.floor(Math.random()*401),streakBonus=Math.min(500,Math.max(0,streak-1)*100),reward=base+streakBonus;credits+=reward;careerStats.creditsEarned+=reward;localStorage.setItem('apexCredits',String(credits));localStorage.setItem('dilseDailyGiftDate',today);localStorage.setItem('dilseDailyGiftStreak',String(streak));saveCareerStats();refreshGarage();refreshDailyGift();pop(`🎁 DAILY GIFT +${reward} CR · ${streak}-DAY STREAK!`);}

function purchaseUpgrade(type){const info=upgradeInfo[type];if(!info)return;if(garageUpgrades[type]>=info.max){pop('UPGRADE ALREADY MAXED');return;}const price=upgradePrice(type);if(credits<price){pop(`NEED ${price-credits} MORE CREDITS`);return;}credits-=price;garageUpgrades[type]++;localStorage.setItem('apexCredits',String(credits));localStorage.setItem('apexUpgrades',JSON.stringify(garageUpgrades));refreshGarage();pop(`${type.toUpperCase()} UPGRADED · LEVEL ${garageUpgrades[type]}`);}
const MAX_CRASHES=3;
const byId=id=>document.getElementById(id);
function saveVehicleCondition(){localStorage.setItem('apexTyreWear',String(Math.round(tyreWear*10)/10));}
function refreshVehicleConditionUI(){const wearLabel=byId('tyreWearLabel'),wearBar=byId('tyreWearBar'),tempLabel=byId('engineTempLabel'),tempBar=byId('engineTempBar'),service=byId('serviceCarButton'),hint=byId('serviceHint');if(wearLabel)wearLabel.textContent=`${Math.round(tyreWear)}%`;if(wearBar){wearBar.style.width=tyreWear+'%';wearBar.style.background=tyreWear>70?'#ff465d':tyreWear>40?'#ffb13b':'var(--acid)';}if(tempLabel)tempLabel.textContent=`${Math.round(engineTemp)}°C`;if(tempBar){const pct=Math.max(0,Math.min(100,(engineTemp-60)/65*100));tempBar.style.width=pct+'%';tempBar.style.background=engineTemp>108?'#ff465d':engineTemp>96?'#ffb13b':'#5de4ff';}const cost=Math.round(120+tyreWear*4);if(service){service.textContent=tyreWear<1?'TYRES SERVICED ✓':`SERVICE CAR · ${cost} CR`;service.disabled=tyreWear<1||credits<cost;service.classList.toggle('service-needed',tyreWear>=35);}if(hint)hint.textContent=tyreWear<1?'Vehicle condition good. Tyre wear will build up during hard driving.':`Tyre wear ${Math.round(tyreWear)}% · service cost ${cost} CR · grip penalty up to 12%.`; }
const ui={speed:byId('speed'),gear:byId('gear'),timer:byId('timer'),distance:byId('distance'),target:byId('targetDistance'),bar:byId('lapbar'),nitro:byId('nitrolabel'),nitrobar:byId('nitrobar'),rpm:byId('rpmbar'),map:byId('map'),toast:byId('toast'),pause:byId('pause'),pauseTitle:byId('pauseTitle'),finish:byId('finish'),finishTitle:byId('finishTitle'),finishMessage:byId('finishMessage'),stageNumber:byId('stageNumber'),best:byId('best'),touchControls:byId('touchControls'),racePosition:byId('racePosition'),racePoints:byId('racePoints')};
function formatTime(t){const m=Math.floor(t/60),s=t%60;return `${String(m).padStart(2,'0')}:${s.toFixed(2).padStart(5,'0')}`;}
function pop(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastLeft=1.8;}
function updateStageCards(){byId('stageSelect').innerHTML=stageNames.map((name,i)=>{const open=i+1<=unlocked;const award=JSON.parse(localStorage.getItem('apexAwards')||'{}')[i+1];return `<button class="stage-option ${stage===i+1?'selected':''}" data-stage="${i+1}" ${open?'':'disabled'}><b>0${i+1} ${open?'':'🔒'}</b><span>${name}</span><small>${stageTargets[i]} M · ${cars[i].name} · ${award?award.toUpperCase()+' CUP':open?'READY':'LOCKED'}</small></button>`}).join('');byId('stageSelect').querySelectorAll('.stage-option:not(:disabled)').forEach(b=>b.onclick=()=>{stage=Number(b.dataset.stage);updateStageCards();});ui.stageNumber.textContent=String(stage).padStart(2,'0');ui.target.textContent=String(stageTargets[stage-1]);const stageEyebrow=document.querySelector('.race-card .eyebrow');if(stageEyebrow)stageEyebrow.innerHTML=`STAGE <span id="stageNumber">${String(stage).padStart(2,'0')}</span> · ${cars[stage-1].name.toUpperCase()}`;}
function setMode(next){mode=next;localStorage.setItem('apexDriveMode',mode);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));ui.touchControls.classList.toggle('hidden',mode==='keyboard');ui.touchControls.classList.toggle('touch-button-mode',mode==='touch');ui.touchControls.classList.toggle('touch-wheel-mode',mode==='wheel');}
function applyConditions(){document.body.classList.toggle('weather-rain',condition==='rain');document.body.classList.toggle('weather-night',condition==='night');const fx=byId('weatherFX');if(fx)fx.dataset.condition=condition;document.querySelectorAll('[data-condition]').forEach(b=>b.classList.toggle('selected',b.dataset.condition===condition));document.querySelectorAll('[data-physics]').forEach(b=>b.classList.toggle('selected',b.dataset.physics===physicsMode));const readout=byId('setupReadout');if(readout)readout.textContent=`GRIP: ${condition==='rain'?'LOW / WET':selectedRoad===3?'SNOW / LOW':physicsMode==='sim'?'REALISTIC':'BALANCED'} · VISIBILITY: ${condition==='night'?'NIGHT':'CLEAR'} · ASSIST: ${physicsMode==='arcade'?'FULL':'ABS + TRACTION CONTROL'}`;}
function startAudio(){if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();const master=audio.createGain();master.gain.value=.82;master.connect(audio.destination);musicGain=audio.createGain();musicGain.gain.value=.08;musicGain.connect(master);
// Layered procedural engine: low combustion rumble, harmonics, filtered intake noise and firing pulses.
const engineBus=audio.createGain();engineBus.gain.value=.8;engineBus.connect(master);const lowFilter=audio.createBiquadFilter();lowFilter.type='lowpass';lowFilter.frequency.value=780;lowFilter.Q.value=.9;engineOsc=audio.createOscillator();engineOsc.type='sawtooth';engineOsc.frequency.value=48;engineGain=audio.createGain();engineGain.gain.value=.0001;engineOsc.connect(lowFilter);lowFilter.connect(engineGain);engineGain.connect(engineBus);engineOsc.start();
const harmonicFilter=audio.createBiquadFilter();harmonicFilter.type='bandpass';harmonicFilter.frequency.value=420;harmonicFilter.Q.value=.8;engineOsc2=audio.createOscillator();engineOsc2.type='square';engineOsc2.frequency.value=98;const harmonicGain=audio.createGain();harmonicGain.gain.value=.0001;engineOsc2.connect(harmonicFilter);harmonicFilter.connect(harmonicGain);harmonicGain.connect(engineBus);engineOsc2.start();engineOsc2._gain=harmonicGain;
const noiseBuffer=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate),noiseData=noiseBuffer.getChannelData(0);for(let i=0;i<noiseData.length;i++)noiseData[i]=(Math.random()*2-1)*.7;const noise=audio.createBufferSource();noise.buffer=noiseBuffer;noise.loop=true;engineNoiseFilter=audio.createBiquadFilter();engineNoiseFilter.type='bandpass';engineNoiseFilter.frequency.value=650;engineNoiseFilter.Q.value=.65;engineNoiseGain=audio.createGain();engineNoiseGain.gain.value=.0001;noise.connect(engineNoiseFilter);engineNoiseFilter.connect(engineNoiseGain);engineNoiseGain.connect(engineBus);noise.start();
enginePulseOsc=audio.createOscillator();enginePulseOsc.type='triangle';enginePulseOsc.frequency.value=22;enginePulseGain=audio.createGain();enginePulseGain.gain.value=.0001;enginePulseOsc.connect(enginePulseGain);enginePulseGain.connect(engineBus);enginePulseOsc.start();
boostOsc=audio.createOscillator();boostOsc.type='sawtooth';boostOsc.frequency.value=420;const boostFilter=audio.createBiquadFilter();boostFilter.type='highpass';boostFilter.frequency.value=320;boostGain=audio.createGain();boostGain.gain.value=.0001;boostOsc.connect(boostFilter);boostFilter.connect(boostGain);boostGain.connect(master);boostOsc.start();reverseOsc=audio.createOscillator();reverseOsc.type='square';reverseOsc.frequency.value=700;reverseGain=audio.createGain();reverseGain.gain.value=.0001;reverseOsc.connect(reverseGain);reverseGain.connect(master);reverseOsc.start();
// Separate acceleration/rev tone: rises when the accelerator is pressed.
accelTone=audio.createOscillator();accelTone.type='sawtooth';accelTone.frequency.value=110;const accelFilter=audio.createBiquadFilter();accelFilter.type='bandpass';accelFilter.frequency.value=900;accelFilter.Q.value=1.1;accelGain=audio.createGain();accelGain.gain.value=.0001;accelTone.connect(accelFilter);accelFilter.connect(accelGain);accelGain.connect(master);accelTone.start();
// Distinct brake sound: high tire/brake squeal plus filtered friction noise.
brakeTone=audio.createOscillator();brakeTone.type='sine';brakeTone.frequency.value=1450;const brakeToneFilter=audio.createBiquadFilter();brakeToneFilter.type='bandpass';brakeToneFilter.frequency.value=1750;brakeToneFilter.Q.value=2.4;brakeGain=audio.createGain();brakeGain.gain.value=.0001;brakeTone.connect(brakeToneFilter);brakeToneFilter.connect(brakeGain);brakeGain.connect(master);brakeTone.start();const brakeBuffer=audio.createBuffer(1,audio.sampleRate,audio.sampleRate),brakeData=brakeBuffer.getChannelData(0);for(let i=0;i<brakeData.length;i++)brakeData[i]=Math.random()*2-1;const brakeNoise=audio.createBufferSource();brakeNoise.buffer=brakeBuffer;brakeNoise.loop=true;brakeNoiseFilter=audio.createBiquadFilter();brakeNoiseFilter.type='bandpass';brakeNoiseFilter.frequency.value=2100;brakeNoiseFilter.Q.value=.8;brakeNoiseGain=audio.createGain();brakeNoiseGain.gain.value=.0001;brakeNoise.connect(brakeNoiseFilter);brakeNoiseFilter.connect(brakeNoiseGain);brakeNoiseGain.connect(master);brakeNoise.start();musicTimer=setInterval(playMusic,300);}if(audio.state==='suspended')audio.resume();}
function playMusic(){if(!audio||!musicOn)return;const notes=[196,220,261.63,329.63,392,329.63,293.66,220],now=audio.currentTime,n=notes[musicStep++%notes.length],o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=n;g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.13,now+.02);g.gain.exponentialRampToValueAtTime(.0001,now+.24);o.connect(g);g.connect(musicGain);o.start(now);o.stop(now+.25);}
function spawnCrash(x,z,impact=1){crashFlash=.24;if(audio){const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(180,now);o.frequency.exponentialRampToValueAtTime(42,now+.16);g.gain.setValueAtTime(.22,now);g.gain.exponentialRampToValueAtTime(.0001,now+.19);o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+.2);}for(let i=0;i<Math.round(18+Math.min(impact,2)*8);i++){const a=Math.random()*Math.PI*2,sp=3+Math.random()*(10+Math.min(impact,2)*4);crashParticles.push({x:x+(Math.random()-.5)*1.8,y:.45+Math.random()*.9,z:z+(Math.random()-.5)*2,vx:Math.cos(a)*sp,vy:2+Math.random()*8,vz:Math.sin(a)*sp,life:.25+Math.random()*.65,max:.9,color:i%3===0?[1,.72,.2]:i%3===1?[.9,.95,1]:[.3,.65,1]});}const el=document.body;el.classList.add('crash-hit');setTimeout(()=>el.classList.remove('crash-hit'),170);}
function drawCrashParticles(vp,dt){for(let i=crashParticles.length-1;i>=0;i--){const p=crashParticles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=13*dt;if(p.life<=0||p.y<0){crashParticles.splice(i,1);continue;}drawPart(vp,{x:p.x,z:p.z,yaw:0},[0,p.y,0],[.045,.045,.045],p.color);}}
function spawnTireSmoke(){if(tireSmoke.length>90)return;for(const side of [-1,1]){if(Math.random()>.72)continue;const p=localPoint(player,side*.63,.22,-.78);tireSmoke.push({x:p[0],y:.22,z:p[2],life:.55+Math.random()*.55,max:1.1,size:.10+Math.random()*.11,vx:(Math.random()-.5)*.9-player.lateralVelocity*.05,vy:.35+Math.random()*.65,vz:-Math.max(2,Math.abs(player.speed)*.12)});}}
function drawTireSmoke(vp,dt){for(let i=tireSmoke.length-1;i>=0;i--){const p=tireSmoke[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.size+=dt*.22;if(p.life<=0){tireSmoke.splice(i,1);continue;}const fade=Math.max(0,p.life/p.max),gray=.20+fade*.22;drawSphere(vp,{x:p.x,z:p.z,yaw:0},[0,p.y,0],[p.size*(1.2-fade*.3),p.size*(1.4-fade*.2),p.size*(1.2-fade*.3)],[gray,gray*1.02,gray*1.06]);}}
function resetTraffic(){traffic=[];crashParticles=[];tireSmoke=[];crashFlash=0;const lanes=[-14,-8.4,-2.8,2.8,8.4,14],paints=[[.95,.82,.05],[.93,.21,.08],[.12,.48,.88],[.8,.84,.83],[.15,.65,.42],[.18,.2,.23],[.55,.18,.68],[.86,.86,.78]];for(let i=0;i<(freeRoam?22:14+stage*3);i++){const lane=lanes[Math.floor(cityRandom()*lanes.length)],style=i%5,kind=(i%7===2?'truck':i%5===3?'bus':'car');const cruiseSpeed=((kind==='truck'?12:kind==='bus'?14:17)+cityRandom()*(kind==='car'?13:kind==='bus'?8:7)+(stage-1)*.45)*difficultyInfo[difficulty].traffic;traffic.push({x:lane,baseLane:lane,targetLane:lane,laneChangeCooldown:cityRandom()*1.2,z:70+i*(stage>=4?72:94)+cityRandom()*42,speed:cruiseSpeed,cruiseSpeed,braking:false,style,kind,color:paints[Math.floor(cityRandom()*paints.length)],drift:(cityRandom()-.5)*(kind==='car'?.18:.06),phase:cityRandom()*Math.PI*2});}rivals=[];racePoints=0;overtakeCount=0;lastPosition=4;if(!freeRoam){const rivalPaints=[[.94,.15,.12],[.1,.55,.95],[.95,.65,.08]];for(let i=0;i<3;i++){const lane=[-8.4,2.8,8.4][i],pace=(31+i*4)*difficultyInfo[difficulty].rivals;rivals.push({id:i+1,x:lane,baseLane:lane,targetLane:lane,laneChangeCooldown:.5+i*.35,z:95+i*47,speed:pace,baseSpeed:pace,style:(i+1)%5,color:rivalPaints[i],phase:i*2.1,passed:false});}}if(ui.racePosition){ui.racePosition.innerHTML='P1 <small>/ 4</small>';ui.racePoints.textContent='0 PTS';}}
function updateDamageUI(){const count=byId('crashCount'),bar=byId('damageBar');if(count)count.textContent=`${crashCount} / ${MAX_CRASHES}`;if(bar)bar.style.width=(crashCount/MAX_CRASHES*100)+'%';const readout=byId('damageReadout');if(readout)readout.classList.toggle('critical',crashCount>=2);}
function eliminatePlayer(){if(finished)return;const finalSpeed=Math.round(Math.abs(player.speed)*3.6);finished=true;paused=false;player.speed=0;boosting=false;ui.pause.classList.add('hidden');ui.finish.classList.add('hidden');byId('outSpeed').textContent=String(finalSpeed).padStart(3,'0')+' KM/H';byId('outDistance').textContent=Math.max(0,Math.floor(player.z))+' M';byId('outMessage').textContent=`${playerName||'Driver'}, you crashed ${MAX_CRASHES} times. Avoid traffic and try again.`;byId('outScreen').classList.remove('hidden');pop('ELIMINATED · RACE OVER');}
function recordCrash(x,z,impact=1){currentSkillCombo=0;skillComboTimer=0;refreshSkillUI();careerStats.crashes++;saveCareerStats();crashCount=Math.min(MAX_CRASHES,crashCount+1);tyreWear=Math.min(100,tyreWear+4+impact*2);saveVehicleCondition();refreshVehicleConditionUI();impactShake=Math.min(.58,.22+impact*.12);updateDamageUI();spawnCrash(x,z,impact);if(crashCount>=MAX_CRASHES){eliminatePlayer();return true;}pop(`CRASH! ${MAX_CRASHES-crashCount} HIT${MAX_CRASHES-crashCount===1?'':'S'} LEFT`);return false;}
function setMission(next){missionMode=next;localStorage.setItem('apexMission',missionMode);document.querySelectorAll('[data-mission]').forEach(b=>b.classList.toggle('selected',b.dataset.mission===missionMode));const hints={free:'Explore the city freely. No mission timer or police pursuit.',checkpoints:'Drive through 5 city checkpoints. Each checkpoint pays 250 Race Credits.',police:'Police chase active in Open City. Keep driving and survive the pursuit to earn credits.'};byId('missionHint').textContent=hints[missionMode]||hints.free;if(missionMode!=='free'&&!freeRoam){freeRoam=true;document.querySelectorAll('[data-world]').forEach(x=>x.classList.toggle('selected',x.dataset.world==='city'));selectedRoad=0;buildWorld(selectedRoad);byId('worldModeHint').textContent='Open city mission: complete objectives, earn credits, and use your showroom car.';byId('mapTitle').textContent='CITY NAVIGATION';byId('targetDistance').textContent='FREE';byId('startButton').innerHTML='START CITY MISSION <span>↗</span>';document.querySelector('.race-card .eyebrow').innerHTML='OPEN CITY · '+(missionMode==='police'?'POLICE CHASE':missionMode==='checkpoints'?'CHECKPOINT RUN':'FREE ROAM');}if(running){missionCheckpoints=0;nextCheckpoint=Math.floor(player.z/260)*260+260;policeHeat=0;policeUnit.x=player.x;policeUnit.z=player.z-28;policeUnit.yaw=player.yaw;policeUnit.active=missionMode==='police';policeUnit.nearMissCooldown=0;pop(missionMode==='police'?'🚨 POLICE DISPATCHED!':missionMode==='checkpoints'?'CHECKPOINT RUN STARTED':'FREE DRIVE');}}
function addCredits(amount,reason){amount=Math.max(1,Math.round(amount*difficultyInfo[difficulty].reward));credits+=amount;careerStats.creditsEarned+=amount;localStorage.setItem('apexCredits',String(credits));saveCareerStats();refreshGarage();pop(`${reason} · +${amount} CR`);}
function startRace(){careerStats.starts++;saveCareerStats();keys.clear();touch.left=touch.right=touch.accelerate=touch.brake=touch.reverse=touch.boost=false;selectedCar=freeRoam?showroomCar:stage-1;localStorage.setItem('apexSelectedCar',String(selectedCar));uploadCarOptions();missionCheckpoints=0;nextCheckpoint=260;policeHeat=0;policeUnit.x=0;policeUnit.z=-28;policeUnit.yaw=0;policeUnit.active=freeRoam&&missionMode==='police';policeUnit.nearMissCooldown=0;player={x:0,z:0,yaw:0,speed:0,lateralVelocity:0,slip:0,roll:0,pitch:0};absActive=false;tractionActive=false;currentGear=1;engineRPM=900;shiftCooldown=0;brakeDive=0;tireSmoke=[];skidMarks=[];skidTimer=0;impactShake=0;wheelSpin=0;suspensionBob=0;steer=0;time=0;ghostRecording=[];ghostSampleClock=0;ghostHudClock=0;ghostRecordingMaxZ=-Infinity;ghostPlayback=freeRoam?null:(bestGhosts[currentGhostKey()]||null);refreshGhostHUD();ui.best.textContent=ghostPlayback?'PB '+formatTime(ghostPlayback.time):'BEST --:--.--';nitro=100;engineTemp=72;collisionCooldown=0;crashCount=0;skillPoints=0;currentSkillCombo=0;nearMisses=0;skillComboTimer=0;nextSpeedTrap=500;drafting=false;refreshSkillUI();updateDamageUI();refreshVehicleConditionUI();finished=false;paused=false;boosting=false;resetTraffic();running=true;byId('startscreen').classList.add('hidden');ui.pause.classList.add('hidden');ui.finish.classList.add('hidden');byId('outScreen').classList.add('hidden');updateStageCards();raceTargetDistance=raceEvent==='sprint'?800:stageTargets[stage-1];ui.target.textContent=freeRoam?'FREE':String(raceTargetDistance);if(!freeRoam)byId('startButton').innerHTML=(raceEvent==='sprint'?'START SPRINT':raceEvent==='timeTrial'?'START TIME TRIAL':'START ULTIMATE RACE')+' <span>↗</span>';pop(freeRoam?'OPEN CITY READY · FREE ROAM':`${cars[selectedCar].name.toUpperCase()} READY · ${raceEvent==='sprint'?'SPRINT':raceEvent==='timeTrial'?'TIME TRIAL':'STAGE '+stage}`);}
function keyDown(e){const k=e.key.toLowerCase();keys.add(k);if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='escape'&&running&&!finished&&!e.repeat){paused=!paused;keys.clear();ui.pause.classList.toggle('hidden',!paused);}if(k==='c'){cameraMode=(cameraMode+1)%3;byId('cameraLabel').innerHTML=['CHASE CAM','HOOD CAM','WIDE CAM'][cameraMode]+` <span>0${cameraMode+1} / 03</span>`;}if(k==='r'&&running)startRace();}
let cameraMode=0;window.addEventListener('keydown',keyDown);window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();if(running&&!finished&&!paused){paused=true;ui.pause.classList.remove('hidden');}});document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden&&running&&!finished&&!paused){paused=true;ui.pause.classList.remove('hidden');}});
const driverInput=byId('playerName');
function updateDriverPreview(){const value=driverInput.value.trim();const valid=value.length>=2;byId('driverInitial').textContent=(value[0]||'A').toLocaleUpperCase();byId('driverPreviewName').textContent=value?value.toLocaleUpperCase():'YOUR NAME HERE';byId('nameCount').textContent=String(driverInput.value.length).padStart(2,'0')+' / 20';byId('nameHint').textContent=value.length===0?'Use 2–20 characters':value.length<2?'Add one more character':value.length>=18?'MAXIMUM APPROACHING':'Driver ID ready';byId('nameForm').classList.toggle('name-valid',valid);const readiness=valid?Math.min(100,Math.round(60+Math.min(value.length,20)*2)):Math.round(value.length/2*45);const readinessLabel=String(readiness).padStart(2,'0')+'%';const readinessBar=byId('profileReadinessBar');if(readinessBar)readinessBar.style.width=readiness+'%';const readinessText=byId('profileReadiness');if(readinessText)readinessText.textContent=readinessLabel;const profileStatus=byId('profileStatus');if(profileStatus)profileStatus.textContent=valid?'DRIVER ID VERIFIED · LOCAL PROFILE READY':value.length?'IDENTIFIER INCOMPLETE':'AWAITING DRIVER ID';}
driverInput.addEventListener('input',updateDriverPreview);updateDriverPreview();
byId('nameForm').addEventListener('submit',e=>{e.preventDefault();playerName=driverInput.value.trim().replace(/\s+/g,' ');if(playerName.length<2){driverInput.setCustomValidity('Please enter at least 2 characters for your driver ID.');driverInput.reportValidity();driverInput.focus();return;}driverInput.setCustomValidity('');localStorage.setItem('apexPlayerName',playerName);const submitButton=byId('nameForm').querySelector('button[type=submit]');submitButton.classList.add('launching');submitButton.disabled=true;submitButton.querySelector('span').textContent='PROFILE VERIFIED · ENTERING GARAGE';const profileStatus=byId('profileStatus');if(profileStatus)profileStatus.textContent='IDENTITY CONFIRMED · INITIALIZING GARAGE';setTimeout(()=>{byId('nameScreen').classList.add('hidden');byId('startscreen').classList.remove('hidden');byId('welcomeMessage').textContent=`Dear ${playerName}, welcome to ZAYRO RACING! Your car upgrades automatically at every stage. Choose your stage, road and driving profile.`;submitButton.disabled=false;submitButton.classList.remove('launching');submitButton.querySelector('span').textContent='ENTER THE GARAGE';startAudio();},420);});
document.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>purchaseUpgrade(b.dataset.upgrade));
byId('dailyGiftButton').onclick=claimDailyGift;
byId('exportSaveButton').onclick=exportDriverSave;byId('importSaveButton').onclick=()=>byId('importSaveFile').click();byId('importSaveFile').addEventListener('change',e=>{importDriverSave(e.target.files[0]);e.target.value='';});
byId('serviceCarButton').onclick=()=>{const cost=Math.round(120+tyreWear*4);if(tyreWear<1){pop('TYRES ALREADY IN GOOD CONDITION');return;}if(credits<cost){pop(`NEED ${cost-credits} MORE CREDITS FOR SERVICE`);return;}credits-=cost;tyreWear=0;engineTemp=72;localStorage.setItem('apexCredits',String(credits));saveVehicleCondition();refreshGarage();pop('PIT SERVICE COMPLETE · GRIP RESTORED');};
document.querySelectorAll('[data-world]').forEach(b=>b.onclick=()=>{
  freeRoam=b.dataset.world==='city';
  if(freeRoam){selectedRoad=0;localStorage.setItem('apexRoad','0');uploadRoadOptions();}
  document.querySelectorAll('[data-world]').forEach(x=>x.classList.toggle('selected',x===b));
  byId('worldModeHint').textContent=freeRoam?'Open city: drive freely, explore side streets and pass traffic lights. No stage timer or finish line.':'Race mode: complete stages, earn cups and unlock cars.';
  byId('mapTitle').textContent=freeRoam?'CITY NAVIGATION':'CIRCUIT MAP';
  byId('targetDistance').textContent=freeRoam?'FREE':String(stageTargets[stage-1]);
  byId('startButton').innerHTML=freeRoam?'ENTER OPEN CITY <span>↗</span>':(raceEvent==='sprint'?'START SPRINT':raceEvent==='timeTrial'?'START TIME TRIAL':'START ULTIMATE RACE')+' <span>↗</span>';
  document.querySelector('.race-card .eyebrow').innerHTML=freeRoam?'OPEN CITY · FREE ROAM':`STAGE <span id="stageNumber">${String(stage).padStart(2,'0')}</span> · ${cars[stage-1].name.toUpperCase()}`;
  buildWorld(selectedRoad);
});
document.querySelectorAll('[data-graphics]').forEach(b=>b.onclick=()=>{graphicsQuality=b.dataset.graphics;localStorage.setItem('apexGraphics',graphicsQuality);document.querySelectorAll('[data-graphics]').forEach(x=>x.classList.toggle('selected',x===b));const hints={performance:'Performance mode: lower render resolution for smoother frame rates.',balanced:'Balanced rendering with enhanced lighting and surface detail.',ultra:'Ultra mode: sharper render scale, metallic clear-coat highlights and richer wet-road reflections; may reduce FPS on older devices.'};byId('graphicsHint').textContent=hints[graphicsQuality];});
document.querySelectorAll('[data-mission]').forEach(b=>b.onclick=()=>setMission(b.dataset.mission));
document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>setRaceEvent(b.dataset.event));
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));setMode(['keyboard','touch','wheel'].includes(localStorage.getItem('apexDriveMode'))?localStorage.getItem('apexDriveMode'):mode);document.querySelectorAll('[data-physics]').forEach(b=>b.onclick=()=>{physicsMode=b.dataset.physics;localStorage.setItem('apexPhysics',physicsMode);applyConditions();});document.querySelectorAll('[data-condition]').forEach(b=>b.onclick=()=>{condition=b.dataset.condition;localStorage.setItem('apexCondition',condition);applyConditions();});byId('startButton').onclick=()=>{applyConditions();startAudio();startRace();};
byId('fullscreenButton').onclick=async()=>{try{if(!document.fullscreenElement){await document.documentElement.requestFullscreen();byId('fullscreenButton').textContent='⛶ EXIT FULLSCREEN';}else{await document.exitFullscreen();byId('fullscreenButton').textContent='⛶ FULLSCREEN';}}catch(e){pop('FULLSCREEN NOT AVAILABLE IN THIS WINDOW');}};document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)byId('fullscreenButton').textContent='⛶ FULLSCREEN';});byId('resume').onclick=()=>{paused=false;ui.pause.classList.add('hidden');};byId('retryRace').onclick=()=>startRace();byId('outMenu').onclick=()=>{byId('outScreen').classList.add('hidden');running=false;finished=false;byId('startscreen').classList.remove('hidden');updateStageCards();uploadCarOptions();uploadRoadOptions();};
byId('soundToggle').onclick=()=>{musicOn=!musicOn;localStorage.setItem('apexMusic',musicOn?'on':'off');if(musicGain)musicGain.gain.setTargetAtTime(musicOn ? .19 : .0001,audio.currentTime,.08);byId('soundToggle').textContent=musicOn?'♫ MUSIC ON':'♫ MUSIC OFF';if(musicOn)startAudio();};
byId('nextStage').onclick=()=>{if(stage<5){stage++;selectedCar=stage-1;updateStageCards();uploadCarOptions();startRace();}else{ui.finish.classList.add('hidden');byId('startscreen').classList.remove('hidden');updateStageCards();}};byId('stageMenu').onclick=()=>{ui.finish.classList.add('hidden');byId('startscreen').classList.remove('hidden');updateStageCards();uploadCarOptions();uploadRoadOptions();};
const steeringWheel=byId('steeringWheel');function steerWheel(e){const r=steeringWheel.getBoundingClientRect(),v=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/(r.width*.42)));touch.wheel=v;steeringWheel.style.transform=`rotate(${v*105}deg)`;}steeringWheel.addEventListener('pointerdown',e=>{e.preventDefault();steeringWheel.setPointerCapture(e.pointerId);steerWheel(e);});steeringWheel.addEventListener('pointermove',e=>{if(e.buttons)steerWheel(e);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])steeringWheel.addEventListener(ev,()=>{touch.wheel=0;steeringWheel.style.transform='rotate(0deg)';});
for(const b of document.querySelectorAll('[data-control]')){const key=b.dataset.control;const down=e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId);}catch(_){}touch[key]=true;b.classList.add('pressed');};const up=e=>{e.preventDefault();touch[key]=false;b.classList.remove('pressed');};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);b.addEventListener('pointerleave',e=>{if(e.buttons)up(e);});}
function fieldInputs(){let pad={left:false,right:false,gas:false,brake:false,reverse:false,boost:false};try{const pads=navigator.getGamepads?navigator.getGamepads():[];const p=pads&&Array.from(pads).find(Boolean);if(p){const axis=p.axes&&p.axes.length?p.axes[0]:0;pad.left=axis<-.18||!!(p.buttons[14]&&p.buttons[14].pressed);pad.right=axis>.18||!!(p.buttons[15]&&p.buttons[15].pressed);pad.gas=!!(p.buttons[7]&&p.buttons[7].value>.15)||!!(p.buttons[0]&&p.buttons[0].pressed);pad.brake=!!(p.buttons[6]&&p.buttons[6].value>.15)||!!(p.buttons[1]&&p.buttons[1].pressed);pad.reverse=!!(p.buttons[2]&&p.buttons[2].pressed);pad.boost=!!(p.buttons[5]&&p.buttons[5].pressed)||!!(p.buttons[3]&&p.buttons[3].pressed);}}catch(_){}if(mode==='wheel'||mode==='touch'){const touchSteer=mode==='wheel'?(touch.left===touch.right?touch.wheel:touch.right?1:-1):(touch.left===touch.right?0:touch.right?1:-1);return {left:touchSteer<-.12||pad.left,right:touchSteer>.12||pad.right,gas:touch.accelerate||pad.gas,brake:touch.brake||pad.brake,reverse:touch.reverse||pad.reverse,boost:touch.boost||pad.boost};}return {left:keys.has('a')||keys.has('arrowleft')||pad.left,right:keys.has('d')||keys.has('arrowright')||pad.right,gas:keys.has('w')||keys.has('arrowup')||pad.gas,brake:keys.has('s')||keys.has('arrowdown')||pad.brake,reverse:keys.has('x')||pad.reverse,boost:keys.has('shift')||pad.boost};}
function drawMap(){const c=ui.map.getContext('2d'),w=ui.map.width,h=ui.map.height;c.clearRect(0,0,w,h);c.fillStyle='#151d1e';c.fillRect(w*.22,0,w*.56,h);c.strokeStyle='#e8e9dc';c.setLineDash([9,7]);c.lineWidth=2;c.beginPath();c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();c.setLineDash([]);for(const t of traffic){if(t.z>player.z&&t.z<player.z+1000){c.fillStyle='#ff795f';c.fillRect(w/2+(t.x-player.x)*3-3,h-(t.z-player.z)/1000*h-6,6,6);}}if(!freeRoam&&raceEvent!=='timeTrial')for(const r of rivals){if(Math.abs(r.z-player.z)<1000){c.fillStyle='#ffc45b';c.fillRect(w/2+(r.x-player.x)*3-3,h-(r.z-player.z)/1000*h-6,6,6);}}c.fillStyle='#d8ff38';c.fillRect(w/2+player.x*3-4,h-20,8,12);}
function drawWorld(vp){const look=envLook();gl.uniform3fv(attr.fog,look.fog);gl.uniform3fv(attr.skyTop,look.sky);gl.uniform1f(attr.wet,condition==='rain'?1:0);for(const b of batches){bind(b.pb,b.nb);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));gl.uniform3fv(attr.color,b.color);gl.uniform1f(attr.road,(b.color===K.road||b.isRoad)?1:0);gl.uniform1f(attr.glass,(b.color===K.glass||b.color===K.glass2)?1:0);gl.uniform1f(attr.emit,(b.color===K.lamp||b.color===K.signLight)?1:0);gl.uniform1f(attr.gloss,0.0);gl.drawArrays(gl.TRIANGLES,0,b.count);}gl.uniform1f(attr.glass,0);gl.uniform1f(attr.emit,0);}
let camYawS=0;
function render(){const frameDt=1/60,deviceScale=devicePixelRatio||1,qualityScale=graphicsQuality==='performance'?.78:graphicsQuality==='ultra'?1.65:1.12,dpr=Math.min(deviceScale,qualityScale*adaptiveRenderScale),w=Math.max(1,Math.floor(innerWidth*dpr)),h=Math.max(1,Math.floor(innerHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}gl.enable(gl.DEPTH_TEST);gl.clearColor(...envLook().clear,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);camYawS+=(player.yaw-camYawS)*Math.min(1,frameDt*6);if(Math.abs(player.yaw-camYawS)>1.2)camYawS=player.yaw;const camYaw=cameraMode===1?player.yaw:camYawS;const f=[Math.sin(camYaw),0,Math.cos(camYaw)];let eye,center;if(cameraMode===1){eye=[player.x+f[0]*.3,1.7,player.z+f[2]*.3];center=[player.x+f[0]*20,1.5,player.z+f[2]*20];}else{const back=(cameraMode===2?17:11.5)+Math.min(2.4,Math.abs(player.speed)*.028),up=cameraMode===2?8:4.5;eye=[player.x-f[0]*back,up,player.z-f[2]*back];center=[player.x+f[0]*3,1.05,player.z+f[2]*23];}if(cameraMode!==1){eye[0]+=player.roll*2.2;eye[1]+=Math.abs(player.roll)*.12;}impactShake=Math.max(0,impactShake-frameDt*.9);const shake=impactShake>0?Math.sin(performance.now()*.09)*impactShake*.22:0;const speedFov=Math.min(.12,Math.abs(player.speed)/950);eye[0]+=shake;eye[1]+=Math.abs(shake)*.5;const vp=multiply(perspective(.9+speedFov,w/h,.1,700),lookAt(eye,center));gl.useProgram(program);gl.uniform3fv(attr.eye,eye);const lampPos=localPoint(player,0,.62,.86);gl.uniform3fv(attr.headlightPos,lampPos);gl.uniform3fv(attr.headlightDir,[Math.sin(player.yaw),0,Math.cos(player.yaw)]);gl.uniform1f(attr.headlights,(condition==='night'||condition==='rain')?1:0);gl.uniform1f(attr.night,condition==='night'||selectedRoad===4?1:0);gl.uniform1f(attr.time,performance.now()*.001);gl.uniform1f(attr.city,freeRoam?1:0);gl.uniform1f(attr.wet,condition==='rain'?1:0);gl.uniform1f(attr.glass,0);gl.uniform1f(attr.emit,0);{const look=envLook();gl.uniform3fv(attr.fog,look.fog);gl.uniform3fv(attr.skyTop,look.sky);gl.depthMask(false);bind(spherePB,sphereNB);gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,modelMatrix(eye,[560,560,560]));gl.uniform3fv(attr.color,[1,1,1]);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);gl.uniform1f(attr.sky,1);gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);gl.uniform1f(attr.sky,0);gl.depthMask(true);}drawWorld(vp);
if(freeRoam){const phase=(time%9),signalColor=phase<4?[1,.025,.018]:phase<5?[1,.62,.025]:[.025,.95,.12],first=Math.floor((player.z-110)/180);for(let n=first-1;n<=first+2;n++){const sz=110+n*180-8;if(Math.abs(sz-player.z)>180)continue;for(const sx of [-18.8,-24.5,18.8,24.5])drawCube(vp,[sx,5.8,sz-.16],[.13,.13,.04],0,signalColor);}}
for(let i=skidMarks.length-1;i>=0;i--){const mark=skidMarks[i];mark.life-=frameDt;if(mark.life<=0){skidMarks.splice(i,1);continue;}if(Math.abs(mark.z-player.z)<125)drawCube(vp,[mark.x,.012,mark.z],[.105,.008,.58],mark.yaw,[.045,.047,.048]);}for(const t of traffic){if(t.z>player.z-30&&t.z<player.z+180){if(t.kind==='truck'||t.kind==='bus')drawHeavyVehicle(vp,t);else drawCar(vp,{x:t.x,z:t.z,yaw:0,braking:!!t.braking},t.color,t.style,false);}}if(freeRoam&&missionMode==='checkpoints'){const cpz=nextCheckpoint; if(Math.abs(cpz-player.z)<210){for(const side of [-1,1]){drawCube(vp,[player.x+side*7,.95,cpz],[.32,1.9,.32],0,[.1,1,.48]);drawCube(vp,[player.x,2.05,cpz],[7.2,.22,.28],0,[.1,1,.48]);}}}if(freeRoam&&missionMode==='police'&&policeUnit.active){const pcar={x:policeUnit.x,z:policeUnit.z,yaw:policeUnit.yaw};drawCar(vp,pcar,[.035,.055,.12],1,false);const flash=Math.floor(time*8)%2===0;const roof=localPoint(pcar,0,1.02,0);drawCube(vp,[roof[0]-.28,roof[1],roof[2]],[.24,.105,.18],pcar.yaw,flash?[.12,.38,1]:[.045,.08,.18]);drawCube(vp,[roof[0]+.28,roof[1],roof[2]],[.24,.105,.18],pcar.yaw,flash?[1,.035,.045]:[.18,.035,.035]);}if(!freeRoam&&raceEvent!=='timeTrial')for(const r of rivals){if(Math.abs(r.z-player.z)<220)drawCar(vp,{x:r.x,z:r.z,yaw:0},r.color,r.style,false);}/* personal-best ghost car is no longer drawn (it overlapped the player car); the PB time delta in the HUD still works */drawCar(vp,player,playerPaintColor(),cars[selectedCar].style,boosting);drawTireSmoke(vp,frameDt);drawCrashParticles(vp,frameDt);}
function finishStage(){if(freeRoam||finished)return;finished=true;if(ghostRecording.length){const last=ghostRecording[ghostRecording.length-1];if(player.z>last[1])ghostRecording.push([Math.round(player.x*100)/100,Math.round(player.z*100)/100,Math.round(player.yaw*1000)/1000,Math.round(time*100)/100]);const key=currentGhostKey(),old=bestGhosts[key];if(!old||time<old.time){bestGhosts[key]={time:Math.round(time*100)/100,samples:ghostRecording};try{localStorage.setItem('apexGhosts',JSON.stringify(bestGhosts));}catch(_){pop('GHOST SAVE FULL · OLDER RECORD KEPT');}ghostPlayback=bestGhosts[key];refreshGhostHUD();pop('🏁 NEW PERSONAL BEST · GHOST SAVED');}}careerStats.finishes++;saveCareerStats();const next=Math.min(5,stage+1);unlocked=Math.max(unlocked,next);localStorage.setItem('apexUnlockedStage',String(unlocked));const medal=time<=stageParTimes[stage-1]?'gold':'silver';const awards=JSON.parse(localStorage.getItem('apexAwards')||'{}');if(!awards[stage]){const stageReward=Math.round(500*difficultyInfo[difficulty].reward);credits+=stageReward;careerStats.creditsEarned+=stageReward;localStorage.setItem('apexCredits',String(credits));saveCareerStats();pop(`+${stageReward} RACE CREDITS`);}if(awards[stage]!=='gold')awards[stage]=medal;refreshGarage();localStorage.setItem('apexAwards',JSON.stringify(awards));best=Math.min(best,time);localStorage.setItem('apexBest',String(best));const racePB=bestGhosts[currentGhostKey()];ui.best.textContent=racePB?'PB '+formatTime(racePB.time):'BEST --:--.--';ui.finishTitle.textContent=raceEvent==='sprint'?'SPRINT COMPLETE':raceEvent==='timeTrial'?'TIME TRIAL COMPLETE':stage===5?'WORLD CHAMPION!':'STAGE CLEARED';const ceremony=byId('championCeremony');ceremony.classList.toggle('hidden',stage!==5||raceEvent!=='circuit');if(stage===5&&raceEvent==='circuit'){ceremony.innerHTML=`<div class="fireworks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="champion-cup">🏆</div><div class="champion-kicker">APEX WORLD CUP WINNER</div><div class="champion-name">CHAMPION — ${(playerName||'RIHAN').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div><div class="champion-subtitle">FIVE STAGES. ONE LEGEND.</div><div class="champion-confetti">✦　✧　★　✦　✧</div>`; }else{ceremony.innerHTML='';}const trophy=byId('trophyAward');trophy.className='trophy-award '+medal;trophy.innerHTML=`<span class="trophy-icon">🏆</span><span><b>${medal.toUpperCase()} WORLD CUP</b><small>${medal==='gold'?'Excellent pace! You beat the stage target.':'Finish secured! Improve your time for Gold.'}</small></span>`;ui.finishMessage.textContent=`Well done, ${playerName||'Driver'}! ${raceEvent==='sprint'?'Sprint':raceEvent==='timeTrial'?'Time Trial':stageNames[stage-1]} completed in ${formatTime(time)}.`;byId('finishSpeed').textContent=`${Math.round(Math.abs(player.speed)*3.6)} KM/H`;byId('nextStage').classList.toggle('hidden',stage>=5);byId('nextStage').innerHTML=stage>=5?'CHAMPIONSHIP COMPLETE ✓':'NEXT STAGE <span>↗</span>';updateStageCards();ui.finish.classList.remove('hidden');}
function update(dt){const inpt=fieldInputs();if(running&&!paused&&!finished){time+=dt;if(ghostPlayback){ghostHudClock+=dt;if(ghostHudClock>=.25){ghostHudClock=0;refreshGhostHUD();}}if(!freeRoam)captureGhostSample(dt);careerStats.distance+=Math.max(0,Math.abs(player.speed)*dt);careerStats.bestSpeed=Math.max(careerStats.bestSpeed,Math.abs(player.speed)*3.6);drafting=[...traffic,...rivals].some(v=>v.z>player.z+4&&v.z-player.z<26&&Math.abs(v.x-player.x)<4.1);const spec=cars[selectedCar],damageFactor=1-Math.min(.18,crashCount*.045),thermalPower=engineTemp>105?1-Math.min(.12,(engineTemp-105)*.006):1,tunedTop=(spec.top+garageUpgrades.speed*2.5)*damageFactor*thermalPower,tunedAccel=(spec.accel+garageUpgrades.speed*.55)*thermalPower,tunedNitro=spec.nitro+garageUpgrades.nitro*1.2,max=(tunedTop+(inpt.boost&&player.speed>2?tunedNitro:0))*(1+(stage-1)*.025)*(drafting?1.045:1);boosting=inpt.boost&&nitro>0&&player.speed>2&&player.speed<max;// Engine temperature and tyre wear feed back into power and grip.
    const forwardSpeed=Math.max(0,player.speed);
    if(inpt.gas)engineTemp=Math.min(125,engineTemp+dt*(.42+(boosting?.58:0)+forwardSpeed*.002));else engineTemp=Math.max(72,engineTemp-dt*(.52+(condition==='rain'?.12:0)));
    const wearRate=dt*(forwardSpeed*.00065+Math.abs(player.slip)*.028+(inpt.brake&&forwardSpeed>22?.018:0)+(boosting?.008:0));tyreWear=Math.min(100,tyreWear+wearRate);conditionSaveTimer+=dt;if(conditionSaveTimer>=4){saveVehicleCondition();conditionSaveTimer=0;}
    if(Math.abs(player.slip)>.28&&forwardSpeed>22&&Math.abs(steer)>.25){addSkillPoints(dt*75*Math.min(2.2,forwardSpeed/34));}if(skillComboTimer>0){skillComboTimer=Math.max(0,skillComboTimer-dt);if(skillComboTimer===0){localStorage.setItem('apexBestSkillCombo',String(bestSkillCombo));currentSkillCombo=0;}}
    const damagedPower=1-Math.min(.22,crashCount*.065);
    const surfaceGrip=selectedRoad===3?.78:selectedRoad===2?.94:selectedRoad===1?.97:selectedRoad===4?.93:1;
    tractionActive=physicsMode==='sim'&&inpt.gas&&Math.abs(player.slip)>.34&&forwardSpeed>12;
    absActive=physicsMode==='sim'&&inpt.brake&&forwardSpeed>18;
    const tractionFactor=tractionActive?.68:1;
    if(inpt.gas)player.speed=Math.min(max,player.speed+tunedAccel*damagedPower*tractionFactor*(physicsMode==='sim'?.88:1)*dt*(1-forwardSpeed/Math.max(max,1)*.48));
    else if(inpt.reverse)player.speed=Math.max(-7,player.speed-4.5*dt);
    else if(inpt.brake){const absPulse=absActive?.82+.18*(.5+.5*Math.sin(time*38)):1;const wetBrake=condition==='rain'?.78:1;if(player.speed>0)player.speed=Math.max(0,player.speed-(player.speed>28?10.5:8.2)*(1+garageUpgrades.brakes*.085)*dt*absPulse*wetBrake);else if(mode==='keyboard')player.speed=Math.max(-17,player.speed-20*dt);}
    else if(!inpt.gas){if(player.speed>0){const coastDrag=.08+forwardSpeed*forwardSpeed*.00072;player.speed=Math.max(0,player.speed-coastDrag*dt);}else player.speed*=Math.max(0,1-.32*dt);}
    if(boosting){player.speed=Math.min(max,player.speed+(tunedNitro+2.2)*dt);nitro=Math.max(0,nitro-(29-stage*1.5)*dt);}else nitro=Math.min(100,nitro+(drafting?13:7)*dt);
    const speedFactor=Math.min(1,Math.abs(player.speed)/28),steerInput=Number(inpt.right)-Number(inpt.left);
    steer+=(steerInput-steer)*Math.min(1,dt*(5.2+speedFactor*2.4));
    const wetGrip=condition==='rain'?.66:1;const simGrip=physicsMode==='sim'?.86:1;const damageGrip=1-Math.min(.24,crashCount*.07);const tyreConditionGrip=1-tyreWear*.0012;const suspensionStability=1+garageUpgrades.suspension*.035;const aeroLoad=1+Math.min(.10,forwardSpeed*.0008);const grip=Math.max(.24,(1-speedFactor*(physicsMode==='sim'?.43:.34))*wetGrip*surfaceGrip*simGrip*damageGrip*tyreConditionGrip*Math.min(1.35,spec.grip+garageUpgrades.grip*.045)*suspensionStability*aeroLoad),cornerLoad=Math.abs(steer)*speedFactor;
    player.slip+=(steer*(inpt.brake?1.35:1)*cornerLoad-player.slip)*Math.min(1,dt*(inpt.brake?1.8:4.8));
    const lateralForce=steer*(.55+forwardSpeed*.105)*grip+player.slip*(forwardSpeed*.15);
    player.lateralVelocity+=(lateralForce-player.lateralVelocity)*Math.min(1,dt*(inpt.brake&&cornerLoad>.18?1.2:(physicsMode==='sim'?3.0:4.2))*(condition==='rain'?.78:1)*surfaceGrip*damageGrip);
    if(freeRoam){player.yaw+=steer*(.32+speedFactor*.58)*dt*(player.speed<0?-1:1);player.x+=Math.sin(player.yaw)*player.speed*dt;player.lateralVelocity=0;}else{player.x+=player.lateralVelocity*dt;player.yaw=steer*(.12+speedFactor*.28)+player.slip*.24;}
    player.roll+=(-steer*speedFactor*.085/(1+garageUpgrades.suspension*.12)-player.roll)*Math.min(1,dt*(3.2+garageUpgrades.suspension*.35));
    const pitchTarget=inpt.brake?Math.min(.075,forwardSpeed*.00125):inpt.gas?-.018:0;player.pitch+=(pitchTarget-player.pitch)*Math.min(1,dt*(inpt.brake?5.5:3.2));
    brakeDive+=((inpt.brake?1:0)-brakeDive)*Math.min(1,dt*7);
    if(shiftCooldown>0)shiftCooldown-=dt;const absSpeed=Math.abs(player.speed),shiftUp=[0,10,18,28,40,54,70];if(player.speed>=0&&shiftCooldown<=0){if(currentGear<7&&absSpeed>shiftUp[currentGear]){currentGear++;shiftCooldown=.24;}else if(currentGear>1&&absSpeed<shiftUp[currentGear-1]*.72){currentGear--;shiftCooldown=.2;}}const gearCeiling=shiftUp[currentGear]||94,gearFloor=currentGear>1?(shiftUp[currentGear-1]||0):0,rpmLoad=Math.max(0,Math.min(1,(absSpeed-gearFloor*.55)/Math.max(1,gearCeiling-gearFloor*.55)));engineRPM=900+rpmLoad*6100+(inpt.gas?Math.min(450,absSpeed*4):0);engineRPM=Math.max(850,Math.min(7200,engineRPM));
    suspensionBob+=(Math.sin(time*23)*Math.min(.035,forwardSpeed*.00035)/(1+garageUpgrades.suspension*.16)-suspensionBob)*Math.min(1,dt*(8+garageUpgrades.suspension*.4));wheelSpin+=player.speed*dt*2.7;
    if((Math.abs(player.slip)>(condition==='rain'?.15:.22)&&forwardSpeed>17)||inpt.brake&&forwardSpeed>34&&Math.abs(steer)>.25){if(Math.random()<Math.min(.95,dt*22))spawnTireSmoke();skidTimer-=dt;if(skidTimer<=0){skidTimer=.085;const rearL=localPoint(player,-.48,.025,-.72),rearR=localPoint(player,.48,.025,-.72);skidMarks.push({x:rearL[0],z:rearL[2],yaw:player.yaw,life:8},{x:rearR[0],z:rearR[2],yaw:player.yaw,life:8});if(skidMarks.length>150)skidMarks.splice(0,skidMarks.length-150);}}else{skidTimer=0;}
    if(freeRoam){
      player.z+=Math.cos(player.yaw)*player.speed*dt;
      // Loop the procedural city block in either direction to keep free-roam continuous.
      if(player.z>roadEnd-240){const loop=roadEnd-420;player.z-=loop;for(const t of traffic)t.z-=loop;if(policeUnit.active)policeUnit.z-=loop;}
      if(player.z < -50){const loop=roadEnd-420;player.z+=loop;for(const t of traffic)t.z+=loop;if(policeUnit.active)policeUnit.z+=loop;}
      player.x=Math.max(-115,Math.min(115,player.x));
      if(Math.abs(player.x)>112){player.speed*=Math.max(0,1-1.5*dt);player.lateralVelocity*=.7;}
      if(missionMode==='checkpoints'&&player.z>=nextCheckpoint&&Math.abs(player.x)<12){missionCheckpoints++;nextCheckpoint+=260;if(missionCheckpoints<=5)addCredits(250,`CHECKPOINT ${missionCheckpoints}/5`);if(missionCheckpoints>=5){missionCheckpoints=0;addCredits(750,'MISSION COMPLETE');nextCheckpoint=player.z+260;pop('🏁 CHECKPOINT RUN COMPLETE!');}}
      if(missionMode==='police'){
        policeUnit.active=true;policeHeat=Math.min(100,policeHeat+dt*(Math.abs(player.speed)>35?4.1:2.4));
        // Pursuit AI steers toward the player's trail, closes in at low speed, and falls back at high speed.
        const back=18-Math.min(7,policeHeat*.07),targetX=player.x-Math.sin(player.yaw)*back,targetZ=player.z-Math.cos(player.yaw)*back;
        const catchRate=2.0+policeHeat*.018+(Math.abs(player.speed)<18?1.2:0);
        policeUnit.x+=(targetX-policeUnit.x)*Math.min(1,dt*catchRate);policeUnit.z+=(targetZ-policeUnit.z)*Math.min(1,dt*catchRate);
        policeUnit.yaw+=(player.yaw-policeUnit.yaw)*Math.min(1,dt*3.2);
        const policeGap=Math.hypot(policeUnit.x-player.x,policeUnit.z-player.z);
        if(policeUnit.nearMissCooldown>0)policeUnit.nearMissCooldown-=dt;
        if(policeGap<5.4&&policeUnit.nearMissCooldown<=0){policeUnit.nearMissCooldown=2.4;player.speed*=.72;player.slip+=(player.x<policeUnit.x?-.22:.22);policeHeat=Math.min(100,policeHeat+12);pop('🚨 POLICE BUMP · KEEP MOVING');}
        if(Math.abs(player.speed)>48&&policeGap>33&&policeHeat>=70){addCredits(500,'POLICE ESCAPE BONUS');policeHeat=18;policeUnit.x=player.x-Math.sin(player.yaw)*22;policeUnit.z=player.z-Math.cos(player.yaw)*22;}
        if(Math.abs(player.speed)<8)policeHeat=Math.max(0,policeHeat-dt*7);
      }else{policeUnit.active=false;}
    }else{
      player.z=Math.max(-85,player.z+player.speed*dt);
      player.x=Math.max(-15.2,Math.min(15.2,player.x));
      if(Math.abs(player.x)>14.4){player.speed*=Math.max(0,1-1.25*dt);player.lateralVelocity*=.7;if(Math.abs(player.x)>15.05&&collisionCooldown<=0){collisionCooldown=1.15;if(recordCrash(player.x,player.z,1))return;}}
    }
    if(!freeRoam&&player.z>=nextSpeedTrap){if(Math.abs(player.speed)*3.6>=160){addSkillPoints(300);addCredits(100,'SPEED TRAP · 160+ KM/H');}nextSpeedTrap+=500;}
    for(const t of traffic){
      // Traffic senses slower vehicles, brakes, and attempts a safe gradual lane change when space permits.
      let targetSpeed=t.cruiseSpeed,obstacleGap=Infinity;
      for(const other of traffic){if(other===t)continue;const dz=other.z-t.z;if(dz>0&&dz<obstacleGap&&Math.abs(other.x-t.x)<2.35){obstacleGap=dz;targetSpeed=Math.min(targetSpeed,Math.max(5,other.speed-(dz<8?2.5:dz<14?1.2:0)));}}
      t.laneChangeCooldown=Math.max(0,(t.laneChangeCooldown||0)-dt);
      if(obstacleGap<15&&t.laneChangeCooldown<=0){
        const lanes=[-14,-8.4,-2.8,2.8,8.4,14].filter(lane=>Math.abs(lane-t.x)>4.4&&Math.abs(lane)<=14.1).sort((a,b)=>Math.abs(a-t.x)-Math.abs(b-t.x));
        const safeLane=lanes.find(lane=>traffic.every(other=>other===t||Math.abs(other.z-t.z)>22||Math.abs(other.x-lane)>2.8));
        if(safeLane!==undefined){t.targetLane=safeLane;t.laneChangeCooldown=2.4;targetSpeed=t.cruiseSpeed;}
      }else if(obstacleGap>28&&t.laneChangeCooldown<=0){t.targetLane=t.baseLane;}
      t.braking=targetSpeed<t.speed-.65;const response=t.braking?3.2:1.15;t.speed+=(targetSpeed-t.speed)*Math.min(1,response*dt);
      t.z+=t.speed*dt;t.x+=((t.targetLane??t.baseLane??t.x)-t.x)*Math.min(1,dt*.8)+Math.sin(time*.55+t.phase)*t.drift*dt;t.x=Math.max(-14.2,Math.min(14.2,t.x));const nearGap=Math.abs(t.z-player.z),sideGap=Math.abs(t.x-player.x);if(nearGap<5.7&&sideGap>2.65&&sideGap<4.9&&!t.nearMissAwarded){t.nearMissAwarded=true;nearMisses++;addSkillPoints(150);refreshSkillUI();pop('NEAR MISS +150 SKILL');}if(t.z<player.z-12)t.nearMissAwarded=false;if(t.z<player.z-30){t.z+=1800;t.speed=t.cruiseSpeed;t.braking=false;t.targetLane=t.baseLane;t.x=t.baseLane;}if(t.z>player.z+1800)t.z-=1800;
      if(collisionCooldown<=0&&Math.abs(t.x-player.x)<(t.kind==='truck'?3.0:t.kind==='bus'?2.85:2.6)&&Math.abs(t.z-player.z)<(t.kind==='truck'?6.5:t.kind==='bus'?5.8:5)){const impact=Math.min(2.2,.75+Math.abs(player.speed)*.018+(t.kind==='truck'?.55:t.kind==='bus'?.4:0));player.speed*=t.kind==='truck'?.36:t.kind==='bus'?.42:.52;player.lateralVelocity+=(player.x<t.x?-1:1)*(4.2+impact*1.5);player.slip*=.35;collisionCooldown=1.15;if(recordCrash(player.x,player.z+2,impact))break;}}
    if(!freeRoam&&raceEvent!=='timeTrial'){
      for(const r of rivals){
        r.laneChangeCooldown=Math.max(0,(r.laneChangeCooldown||0)-dt);
        let targetPace=r.baseSpeed;
        const gap=r.z-player.z;
        // Rivals vary their pace slightly to challenge a driver who is pulling away, without teleporting or unfair speed spikes.
        if(gap < -12) targetPace*=1.055;
        else if(gap > 38) targetPace*=.985;
        let obstacleGap=Infinity,obstacleSpeed=targetPace;
        for(const t of traffic){const dz=t.z-r.z;if(dz>0&&dz<obstacleGap&&Math.abs(t.x-r.x)<2.5){obstacleGap=dz;obstacleSpeed=Math.min(obstacleSpeed,Math.max(7,t.speed-1.8));}}
        if(obstacleGap<18)targetPace=Math.min(targetPace,obstacleSpeed);
        const playerThreat=Math.abs(r.z-player.z)<22&&Math.abs(r.x-player.x)<4.5;
        if((obstacleGap<17||playerThreat)&&r.laneChangeCooldown<=0){
          const lanes=[-8.4,-2.8,2.8,8.4].filter(lane=>Math.abs(lane-r.x)>3.5);
          const safeLane=lanes.sort((a,b)=>Math.abs(a-r.x)-Math.abs(b-r.x)).find(lane=>
            rivals.every(other=>other===r||Math.abs(other.z-r.z)>18||Math.abs(other.x-lane)>3.0)&&
            traffic.every(t=>Math.abs(t.z-r.z)>18||Math.abs(t.x-lane)>3.0)&&
            (Math.abs(player.z-r.z)>12||Math.abs(player.x-lane)>3.0));
          if(safeLane!==undefined){r.targetLane=safeLane;r.laneChangeCooldown=1.8+cityRandom()*.9;}
        }else if(obstacleGap>32&&Math.abs(gap)>30&&r.laneChangeCooldown<=0){r.targetLane=r.baseLane;}
        r.speed+=(targetPace-r.speed)*Math.min(1,dt*(obstacleGap<18?2.8:.55));
        r.z+=r.speed*dt;
        // Smooth steering to the selected lane, with only a small natural line variation.
        r.x+=((r.targetLane??r.baseLane)-r.x)*Math.min(1,dt*.92)+Math.sin(time*.42+r.phase)*.035*dt;
        r.x=Math.max(-11.2,Math.min(11.2,r.x));
        if(!r.passed&&player.z>r.z+7){r.passed=true;overtakeCount++;racePoints+=250;addSkillPoints(100);pop('OVERTAKE +250');}
        if(collisionCooldown<=0&&Math.abs(r.x-player.x)<2.65&&Math.abs(r.z-player.z)<5){player.speed*=.48;player.lateralVelocity+=(player.x<r.x?-1:1)*6;player.slip*=.3;collisionCooldown=1.2;if(recordCrash(player.x,player.z+2))break;}
        if(r.z<player.z-24){const lane=[-8.4,-2.8,2.8,8.4][Math.floor(cityRandom()*4)];r.z=player.z+180+cityRandom()*150;r.x=lane;r.baseLane=lane;r.targetLane=lane;r.baseSpeed=(24+cityRandom()*11)*difficultyInfo[difficulty].rivals;r.speed=r.baseSpeed;r.laneChangeCooldown=.8;r.passed=false;}
      }
      const position=1+rivals.filter(r=>r.z>player.z).length;
      if(ui.racePosition){ui.racePosition.innerHTML=raceEvent==='timeTrial'?'SOLO <small>/ TT</small>':`P${Math.min(4,position)} <small>/ 4</small>`;ui.racePoints.textContent=raceEvent==='timeTrial'?`${Math.round(Math.max(0,player.z))} M · NO RIVALS`:`${racePoints.toLocaleString()} PTS · ${overtakeCount} PASSED`;}
      if(position<lastPosition){const card=document.querySelector('.rank-card');if(card){card.classList.add('rank-up');setTimeout(()=>card.classList.remove('rank-up'),500);}}lastPosition=position;
    }else if(freeRoam&&ui.racePosition){ui.racePosition.innerHTML=missionMode==='police'?'🚨 <small>/ PURSUIT</small>':missionMode==='checkpoints'?`CP ${missionCheckpoints}<small> / 5</small>`:'FREE <small>/ ROAM</small>';ui.racePoints.textContent=missionMode==='police'?`HEAT ${Math.round(policeHeat)}% · KEEP MOVING`:missionMode==='checkpoints'?`${Math.max(0,5-missionCheckpoints)} CHECKPOINTS LEFT`:`${racePoints.toLocaleString()} PTS`;}
    if(!freeRoam&&raceEvent==='timeTrial'&&ui.racePosition){ui.racePosition.innerHTML='SOLO <small>/ TT</small>';ui.racePoints.textContent=`${Math.round(Math.max(0,player.z))} M · NO RIVALS`;}
    document.body.classList.toggle('high-speed',Math.abs(player.speed)>58);document.body.classList.toggle('hard-corner',Math.abs(steer)>.42&&Math.abs(player.speed)>24);document.body.classList.toggle('drifting',Math.abs(player.slip)>.28&&Math.abs(player.speed)>22);const dist=Math.max(0,player.z),target=raceTargetDistance;ui.distance.textContent=String(Math.floor(dist)).padStart(3,'0');ui.bar.style.width=freeRoam?'100%':Math.min(100,dist/target*100)+'%';ui.timer.textContent=formatTime(time);ui.speed.textContent=String(Math.round(Math.abs(player.speed)*3.6)).padStart(3,'0');ui.gear.textContent=player.speed < -1?'REVERSE':`GEAR ${currentGear}`+(boosting?'  // BOOST':'');ui.nitro.textContent=boosting?'BOOST':`${Math.round(nitro)}%`;ui.nitrobar.style.width=nitro+'%';ui.rpm.style.width=Math.max(0,Math.min(100,(engineRPM-900)/6200*100))+'%';refreshVehicleConditionUI();refreshSkillUI();const assistReadout=byId('setupReadout');if(running&&assistReadout){const base=`GRIP: ${condition==='rain'?'LOW / WET':selectedRoad===3?'SNOW / LOW':physicsMode==='sim'?'REALISTIC':'BALANCED'} · VISIBILITY: ${condition==='night'?'NIGHT':'CLEAR'}`;assistReadout.textContent=base+(physicsMode==='sim'?(absActive?' · ABS ACTIVE':'')+(tractionActive?' · TCS ACTIVE':''):' · ARCADE ASSISTS')+` · DAMAGE ${crashCount}/${MAX_CRASHES}`;}drawMap();if(!freeRoam&&dist>=target)finishStage();if(Math.floor(time*2)%4===0&&Math.random()<dt*.2)saveCareerStats();if(collisionCooldown>0)collisionCooldown-=dt;if(toastLeft>0){toastLeft-=dt;if(toastLeft<=0)ui.toast.classList.remove('show');}}
  if(audio){const now=audio.currentTime,active=running&&!paused&&!finished,velocity=Math.abs(player.speed),throttle=active&&inpt.gas,braking=active&&inpt.brake&&velocity>3,load=active?(throttle?1:.42):0,rpm=38+engineRPM/34+(throttle?10:0)+(braking?-8:0)+Math.sin(now*13)*Math.min(velocity*.22,10);engineOsc.frequency.setTargetAtTime(Math.max(32,rpm),now,.045);engineOsc2.frequency.setTargetAtTime(Math.max(65,rpm*2.08),now,.05);engineGain.gain.setTargetAtTime(active?(.018+Math.min(velocity/155,.052))*load:.0001,now,.07);engineOsc2._gain.gain.setTargetAtTime(active?(.006+Math.min(velocity/210,.018))*load:.0001,now,.07);engineNoiseFilter.frequency.setTargetAtTime(380+velocity*15+(throttle?620:0),now,.09);engineNoiseGain.gain.setTargetAtTime(active?(.004+Math.min(velocity/240,.012))*(throttle?1:.32):.0001,now,.09);enginePulseOsc.frequency.setTargetAtTime(Math.max(12,rpm*.42),now,.06);enginePulseGain.gain.setTargetAtTime(active?(.005+Math.min(velocity/300,.01))*load:.0001,now,.07);accelTone.frequency.setTargetAtTime(105+velocity*5.2+(throttle?210:0),now,.055);accelGain.gain.setTargetAtTime(active&&throttle?Math.min(.035,.012+velocity/2500):.0001,now,.045);brakeTone.frequency.setTargetAtTime(1250+Math.min(velocity*19,900)+Math.sin(now*37)*95,now,.025);brakeGain.gain.setTargetAtTime(braking?Math.min(.055,.012+velocity/650):.0001,now,.035);brakeNoiseFilter.frequency.setTargetAtTime(1500+Math.min(velocity*14,1200),now,.04);brakeNoiseGain.gain.setTargetAtTime(braking?Math.min(.025,.004+velocity/1800):.0001,now,.035);boostOsc.frequency.setTargetAtTime(360+velocity*6,now,.04);boostGain.gain.setTargetAtTime(active&&boosting?.065:.0001,now,.035);const rev=active&&player.speed < -2;reverseGain.gain.setTargetAtTime((rev&&Math.sin(now*8)>-.2) ? .025 : .0001,now,.03);const cornerSqueal=active&&Math.abs(steer)>0.42&&velocity>22; if(cornerSqueal){brakeTone.frequency.setTargetAtTime(1850+Math.abs(steer)*500,now,.03);brakeGain.gain.setTargetAtTime(Math.min(.035,Math.abs(steer)*.045),now,.05);}}render();}

canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;running=false;pop('GRAPHICS RESET · RELOAD THE GAME');const box=byId('pause');if(box){box.classList.remove('hidden');byId('pauseTitle').textContent='GRAPHICS RESET';}},false);
window.addEventListener('resize',()=>{lastFrame=performance.now();});
document.addEventListener('visibilitychange',()=>{lastFrame=performance.now();if(document.visibilityState==='hidden'&&running&&!finished){paused=true;ui.pause.classList.remove('hidden');ui.pauseTitle.textContent='RACE PAUSED';}});
function tick(now){
  const rawDt=Math.max(.001,Math.min((now-lastFrame)/1000,.2)),dt=Math.min(rawDt,.045);lastFrame=now;
  fpsSampleFrames++;fpsSampleSeconds+=rawDt;
  if(fpsSampleSeconds>=1){
    displayedFPS=Math.round(fpsSampleFrames/fpsSampleSeconds);
    const fpsEl=byId('fpsReadout');if(fpsEl)fpsEl.textContent=`FPS ${displayedFPS}`;
    if(graphicsQuality!=='performance'){
      if(displayedFPS<42)adaptiveRenderScale=Math.max(.72,adaptiveRenderScale-.08);
      else if(displayedFPS>56)adaptiveRenderScale=Math.min(1,adaptiveRenderScale+.025);
    }else adaptiveRenderScale=1;
    fpsSampleFrames=0;fpsSampleSeconds=0;
  }
  if(document.visibilityState==='visible')update(dt);requestAnimationFrame(tick);
}
document.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>{difficulty=b.dataset.difficulty;localStorage.setItem('apexDifficulty',difficulty);refreshCareerStats();const hints={rookie:'Rookie: calmer traffic and rivals; 0.85× rewards.',pro:'Pro: balanced traffic, rivals and rewards.',legend:'Legend: faster traffic and rivals; 1.6× mission and stage rewards.'};byId('difficultyHint').textContent=hints[difficulty];pop(`${difficultyInfo[difficulty].label} DIFFICULTY SELECTED`);});
function init(){refreshCareerStats();uploadPaintOptions();setRaceEvent(raceEvent);byId('soundToggle').textContent=musicOn?'♫ MUSIC ON':'♫ MUSIC OFF';const hints={rookie:'Rookie: calmer traffic and rivals; 0.85× rewards.',pro:'Pro: balanced traffic, rivals and rewards.',legend:'Legend: faster traffic and rivals; 1.6× mission and stage rewards.'};if(byId('difficultyHint'))byId('difficultyHint').textContent=hints[difficulty];refreshGarage();refreshDailyGift();document.querySelectorAll('[data-mission]').forEach(b=>b.classList.toggle('selected',b.dataset.mission===missionMode));uploadCarOptions();uploadRoadOptions();updateStageCards();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));document.querySelectorAll('[data-graphics]').forEach(b=>b.classList.toggle('selected',b.dataset.graphics===graphicsQuality));const gh={performance:'Performance mode: lower render resolution for smoother frame rates.',balanced:'Balanced rendering with enhanced lighting and surface detail.',ultra:'Ultra mode: sharper render scale, metallic clear-coat highlights and richer wet-road reflections; may reduce FPS on older devices.'};if(byId('graphicsHint'))byId('graphicsHint').textContent=gh[graphicsQuality];applyConditions();render();requestAnimationFrame(tick);}
init();

window.addEventListener('beforeunload',()=>{saveVehicleCondition();localStorage.setItem('apexBestSkillCombo',String(bestSkillCombo));});

