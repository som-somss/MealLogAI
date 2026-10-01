const CACHE='meallog-v4'; const ASSETS=['/','/index.html','/app.js','/cloud.js','/supabase-config.js','/style.css','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))) });
