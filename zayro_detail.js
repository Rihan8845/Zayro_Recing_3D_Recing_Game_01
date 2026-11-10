'use strict';
/* ZAYRO DETAIL v1.0 — loads last (game.js shader only got a finer, subtler asphalt sparkle).
   ROADS (race mode): concrete expansion joints every 30 m, cat's-eye road studs on the lane lines (white / yellow centre),
        reflective delineator posts on both barriers, green km-marker signs every 500 m. The studs and post reflectors
        glow in the dark and only faintly by day.
   CARS : soft brake-light bloom (stronger at night / rain) on the player and the rivals / traffic that are braking,
        headlight glare halos after dark.
   Every block is wrapped in try/catch so a failure here can never stop the game. */
(function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const LANES=[-11.33,-5.67,5.67,11.33];

/* ============================================================ ROAD DETAIL */
let built=null,builtKey='';
function makeBuilder(){
  const map=new Map();
  function box(color,emit,road,p,size,yaw){
    yaw=yaw||0;
    const key=color.join(',')+'|'+(emit?1:0)+'|'+(road?1:0);
    let b=map.get(key);if(!b){b={p:[],n:[],color,emit,road};map.set(key,b);}
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(const f of faceData)for(const j of triangles){
      const v=f[j],n=f[4],x=v[0]*size[0],z=v[2]*size[2];
      b.p.push(p[0]+x*c+z*s,p[1]+v[1]*size[1],p[2]-x*s+z*c);
      b.n.push(n[0]*c+n[2]*s,n[1],-n[0]*s+n[2]*c);
    }
  }
  return {box,map};
}
function buildDetail(){
  const B=makeBuilder(),box=B.box;
  const end=roadEnd-100,road=K.road,sc=(c,k)=>c.map(v=>Math.min(1,v*k));
  const joint=sc(road,.46);
  // expansion joints
  for(let z=30;z<end;z+=30)box(joint,false,true,[0,.0272,z],[14.9,.0022,.03]);
  // cat's-eye studs on lane lines (white) and centre (amber)
  for(let z=6;z<end;z+=12){
    for(const x of LANES)box([.95,.95,.9],true,false,[x,.03,z],[.045,.012,.045]);
    box([1,.68,.1],true,false,[0,.03,z],[.05,.012,.05]);
  }
  // delineator posts + reflectors
  for(let z=0;z<end;z+=25)for(const sd of [-1,1]){
    const x=sd*18.55;
    box([.9,.9,.88],false,false,[x,.34,z],[.04,.34,.04]);
    box([.8,.08,.07],false,false,[x,.58,z],[.045,.04,.045]);
    box(sd<0?[1,.55,.1]:[.95,.95,.9],true,false,[x,.66,z-.045],[.035,.05,.01]);
  }
  // km marker signs (green panel + white bars)
  for(let z=500;z<end;z+=500){
    const x=19.9,col=[.04,.32,.16],wh=[.92,.94,.9];
    box([.55,.57,.6],false,false,[x,1.5,z],[.05,1.5,.05]);
    box(col,false,false,[x-.04,3.1,z],[.04,.5,1.0]);
    box(wh,false,false,[x-.085,3.1,z],[.012,.06,.82]);
    box(wh,false,false,[x-.085,2.9,z],[.012,.05,.5]);
    box(wh,false,false,[x-.085,3.3,z],[.012,.05,.65]);
  }
  return B.map;
}
function upload(map){
  const out=[];
  for(const b of map.values()){
    const pb=gl.createBuffer(),nb=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.p),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.n),gl.STATIC_DRAW);
    out.push({pb,nb,count:b.p.length/3,color:b.color,emit:b.emit,road:b.road});
  }
  return out;
}
function release(){if(!built)return;for(const b of built){try{gl.deleteBuffer(b.pb);gl.deleteBuffer(b.nb);}catch(_){}}built=null;}
const IDENT=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function drawDetail(vp){
  if(freeRoam||typeof player==='undefined')return;
  const key=roadEnd+'|'+selectedRoad;
  if(!built||key!==builtKey){release();built=upload(buildDetail());builtKey=key;}
  const night=condition==='night'||selectedRoad===4,rain=condition==='rain';
  const k=night?1:rain?.55:.3;
  const zmin=player.z-60,zmax=player.z+520;
  for(const b of built){
    bind(b.pb,b.nb);
    gl.uniformMatrix4fv(attr.vp,false,vp);gl.uniformMatrix4fv(attr.model,false,IDENT);
    gl.uniform3f(attr.color,b.color[0]*(b.emit?k:1),b.color[1]*(b.emit?k:1),b.color[2]*(b.emit?k:1));
    gl.uniform1f(attr.road,b.road?1:0);gl.uniform1f(attr.glass,0);gl.uniform1f(attr.emit,b.emit?1:0);gl.uniform1f(attr.gloss,0);
    gl.drawArrays(gl.TRIANGLES,0,b.count);
  }
  gl.uniform1f(attr.emit,0);gl.uniform1f(attr.road,0);
}
const _dw=drawWorld;
drawWorld=function(vp){
  _dw(vp);
  try{drawDetail(vp);}catch(e){if(!drawWorld.zdErr){drawWorld.zdErr=1;console.error('ZAYRO DETAIL roads',e);}}
};
const _bw=buildWorld;
buildWorld=function(theme){_bw(theme);builtKey='';};

/* ============================================================ CAR LIGHT BLOOM */
const ST=[ // per base style: half-width, half-length, tail height, nose height
  [.97,1.95,.86,.54],[1.08,2.40,.84,.70],[1.02,2.30,.70,.40],[1.08,2.22,.78,.52],[1.12,2.50,.72,.36]];
function bloom(vp,car,style,braking,dark){
  const si=((Math.floor(style)||0)%5+5)%5,W=ST[si][0],H=ST[si][1],td=ST[si][2]-.76,nose=ST[si][3];
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
  gl.uniform1f(attr.emit,1);gl.uniform1f(attr.road,0);gl.uniform1f(attr.gloss,0);
  if(braking){
    const a=dark?.34:.2;gl.uniform3f(attr.color,1,.08,.05);
    for(const s of [-1,1]){
      gl.uniform1f(attr.alpha,a);
      const p=localPoint(car,s*W*.62,.68+td,-H-.12);
      bind(spherePB,sphereNB);gl.uniformMatrix4fv(attr.vp,false,vp);
      gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[.34,.2,.22],car.yaw));
      gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);
    }
  }
  if(dark){
    gl.uniform3f(attr.color,1,.95,.78);
    for(const s of [-1,1]){
      gl.uniform1f(attr.alpha,.2);
      const p=localPoint(car,s*W*.56,nose+.08,H+.1);
      bind(spherePB,sphereNB);gl.uniformMatrix4fv(attr.vp,false,vp);
      gl.uniformMatrix4fv(attr.model,false,modelMatrix(p,[.3,.2,.2],car.yaw));
      gl.drawArrays(gl.TRIANGLES,0,spherePos.length/3);
    }
  }
  gl.disable(gl.BLEND);gl.depthMask(true);gl.uniform1f(attr.alpha,1);gl.uniform1f(attr.emit,0);
}
const _prev=drawCar;
drawCar=function(vp,car,color,style=0,boost=false){
  _prev(vp,car,color,style,boost);
  try{
    if(window.__zgMirror)return;
    if(car===player&&typeof cameraMode!=='undefined'&&cameraMode===1)return;
    if(!(style>=0&&style<5))return;
    const isP=car===player,dark=condition==='night'||condition==='rain'||selectedRoad===4;
    const braking=isP?!!(window.zrState&&window.zrState.brake):!!car.braking;
    if(braking||dark)bloom(vp,car,style,braking,dark);
  }catch(e){gl.disable(gl.BLEND);gl.depthMask(true);if(!drawCar.zdErr){drawCar.zdErr=1;console.error('ZAYRO DETAIL cars',e);}}
};
})();
