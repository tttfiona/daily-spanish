/* 每日西语 PWA — 离线缓存 */
const CACHE = 'daily-esp-v1';
const SHELL = [
  './', './index.html', './styles.css', './app.js',
  './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 数据文件:网络优先(保证刷新能看到新课程),失败才用缓存
  if(url.pathname.includes('lessons.json')){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const cl = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, cl));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // 其余:缓存优先,兜底首页
  e.respondWith(
    caches.match(e.request)
      .then(hit => hit || fetch(e.request).then(res => {
        const cl = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, cl));
        return res;
      }).catch(() => caches.match('./index.html')))
  );
});
