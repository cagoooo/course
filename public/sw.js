// [DEPRECATED] 此 SW 已被 vite-plugin-pwa 取代。
// 此檔案的唯一目的是清除舊快取並自行登出。
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => caches.delete(cache))
            );
        }).then(() => {
            // 登出自己，讓 vite-plugin-pwa 的 SW 接管
            return self.registration.unregister();
        }).then(() => {
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach(client => client.navigate(client.url));
        })
    );
});
