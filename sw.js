const CACHE='htl-praxis-v7.5.17-rating-photos-input-fix-3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./extra.js','./room.js','./media755.js','./pages756.js','./lesson757.js','./config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.pathname.endsWith('/version.json')){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }
  if(url.origin!==self.location.origin){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
    return;
  }
  // Prefer fresh files while online; keep offline support as fallback.
  event.respondWith(fetch(event.request).then(resp=>{
    if(resp && resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}
    return resp;
  }).catch(()=>caches.match(event.request)));
});
