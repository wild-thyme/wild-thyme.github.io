/* Service worker: opens instantly and offline.
   Bump CACHE on every deploy or installed copies keep serving the old files. */
const CACHE = 'wild-thyme-202609262314';

const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/quill.js',
  'vendor/quill.core.css',
  'vendor/Sortable.min.js',
  'js/app.js',
  'js/util.js',
  'js/store.js',
  'js/firebase-config.js',
  'js/state.js',
  'js/quotes.js',
  'js/frame.js',
  'js/covers.js',
  'js/stars.js',
  'js/library.js',
  'js/addbook.js',
  'js/book.js',
  'js/notes.js',
  'js/board.js',
  'js/commonplace.js',
  'js/importer.js',
  'js/settings.js',
  'js/letters.sealed.js',
  'js/correspondence.js',
];

// Other people's files that never change at a given URL: fonts, the Firebase
// library (versioned), and book covers.
const FOREVER = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com', 'covers.openlibrary.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'wild-thyme-ext').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Page and code: network first so an update lands at once, cache when offline.
    e.respondWith(
      fetch(req)
        .then(r => {
          if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return r;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
    );
    return;
  }

  if (FOREVER.includes(url.hostname) && !(url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/'))) {
    e.respondWith(
      caches.open('wild-thyme-ext').then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok || r.type === 'opaque') c.put(req, r.clone());
        return r;
      })))
    );
  }
});
