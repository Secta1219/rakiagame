const CACHE_NAME = 'rakia-games-v5';

// キャッシュするファイル
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/ranking/',
    '/ranking/index.html',
    '/about/',
    '/about/index.html',
    '/profile/',
    '/profile/index.html',
    '/click-challenge/',
    '/click-challenge/index.html',
    '/images/click-challenge.png',
    '/images/avatars/cat-orange.svg',
    '/images/avatars/cat-blue.svg',
    '/images/avatars/cat-purple.svg',
    '/images/avatars/cat-green.svg',
    '/images/avatars/dog-orange.svg',
    '/images/avatars/dog-blue.svg',
    '/images/avatars/dog-purple.svg',
    '/images/avatars/dog-green.svg',
    '/images/avatars/robot-orange.svg',
    '/images/avatars/robot-blue.svg',
    '/images/avatars/robot-purple.svg',
    '/images/avatars/robot-green.svg',
    '/images/avatars/geo-triangle.svg',
    '/images/avatars/geo-hexagon.svg',
    '/images/avatars/geo-diamond.svg',
    '/images/avatars/geo-star.svg',
    '/images/avatars/geo-circles.svg',
    '/images/avatars/geo-squares.svg',
    '/images/avatars/geo-spiral.svg',
    '/images/avatars/geo-burst.svg'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// フェッチ時の戦略: Stale While Revalidate
// キャッシュがあればすぐ返し、バックグラウンドで更新
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 同一オリジンのリクエストのみキャッシュ対象
    if (url.origin !== location.origin) {
        return;
    }

    // APIリクエストやFirestoreはキャッシュしない
    if (url.pathname.includes('firestore') || url.pathname.includes('firebase')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    // 成功したレスポンスをキャッシュに保存
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // ネットワークエラー時はキャッシュを返す
                    return cachedResponse;
                });

                // キャッシュがあればすぐ返す、なければネットワークを待つ
                return cachedResponse || fetchPromise;
            });
        })
    );
});
