/* ZAYRO RACING service worker — offline play after the first visit (stale-while-revalidate). */
const CACHE='zayro-racing-v16-9';
const FILES=['./','index.html','style.css','game.js','zayro_mobile.js','zayro_mobile.css','zayro_plus.js','zayro_plus.css','zayro_realism.js','zayro_realism.css','zayro_cars.js','zayro_extra.js','zayro_extra.css','zayro_photo.js','zayro_legend.js','zayro_legend.css','zayro_finish.js','zayro_finish.css','zayro_graphics.js','zayro_graphics.css','zayro_certificate.js','zayro_certificate.css','zayro_results.js','zayro_rewards.js','zayro_rewards.css','zayro_mp.js','zayro_mp.css','zayro_pro.js','zayro_pro.css','zayro_dynamics.js','zayro_detail.js','zayro_hud.js','zayro_hud.css','zayro_premium.css','zayro_theme.css','zayro_mp_config.js','zayro_cockpit.js','zayro_apex.js','zayro_apex.css','zayro_cockpit.css','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const hit=await c.match(r,{ignoreSearch:true});
    const net=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res;}).catch(()=>null);
    return hit||(await net)||(r.mode==='navigate'?c.match('index.html'):Response.error());
  }));
});
