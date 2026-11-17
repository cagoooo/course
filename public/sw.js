// [DEPRECATED] 此 SW 已被 vite-plugin-pwa 取代。
// 此檔案的唯一目的是清除舊快取並自行登出。
// 同一網域（cagoooo.github.io）的所有工具共用快取空間，只能清除本站（/course/）自己的快取：
//   - smes-cache-v1：本站最早的自製 SW（2026-02）用過的快取
//   - smes-runtime-cache：本站 vite-plugin-pwa 的執行期快取（vite.config.js）
//   - 名稱含本站範圍網址的 workbox 快取（例如 workbox-precache-v2-https://cagoooo.github.io/course/）
const OWN_CACHE_NAMES = ['smes-cache-v1', 'smes-runtime-cache'];
const SCOPE = (self.registration && self.registration.scope) || new URL('./', self.location.href).href;
const isOwnCache = (name) => OWN_CACHE_NAMES.includes(name) || name.includes(SCOPE);
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(isOwnCache).map((cache) => caches.delete(cache))
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
