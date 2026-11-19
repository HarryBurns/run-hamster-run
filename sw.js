// Service worker игры (docs/ARCHITECTURE.md, «Игра как приложение»). Одно правило: СЕТЬ СНАЧАЛА, кэш — запасной
// путь. Каждый запрос идёт на сервер как обычно (обновления игры приходят сразу, метки версий ?v=BUILD работают как
// без service worker); только если сети нет — ответ из кэша. Так игра с экрана «Домой» открывается и без интернета.
//
// Ставит его features/install.js: sw.js?v=BUILD. Кэш — «rhr-BUILD»: при установке в него кладутся все файлы этой
// сборки (страница, стили, все модули из js/modules.json, значки), при включении старые кэши «rhr-…» удаляются.
// По ходу игры в кэш докладываются только файлы этой сборки (?v=BUILD) и файлы без метки (звуки, значки) — но не
// «указатели» сборки (страница, build.js, modules.json): они в кэше всегда той же сборки, что и модули.
//
// Как убрать service worker совсем (если с ним что-то не так): заменить этот файл на
//   self.addEventListener('install', () => self.skipWaiting());
//   self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n)))).then(() => self.registration.unregister())));
// и выложить — браузеры сами заберут новый файл при следующем открытии игры.
const V = new URL(self.location.href).searchParams.get('v') || '0';
const CACHE = 'rhr-' + V;
const BASE = new URL('./', self.location.href).href;
const POINTERS = ['', 'index.html', 'js/data/build.js', 'js/modules.json', 'manifest.webmanifest'].map((f) => BASE + f);
const STATIC = [
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // ждать нечего: сеть всё равно первая, старые и новые файлы не смешиваются
  e.waitUntil(precache());
});
/** Все файлы этой сборки — в кэш. Не вышло (нет сети, на сервере уже другая сборка) — остаётся прежний кэш. */
async function precache() {
  const get = async (url, opts) => {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r;
  };
  const fresh = { cache: 'no-cache' }; // «указатели» — мимо кэша браузера
  const build = await get(BASE + 'js/data/build.js', fresh);
  const text = await build.clone().text();
  const m = /BUILD\s*=\s*(\d+)/.exec(text);
  if (!m || m[1] !== V) throw new Error('на сервере другая сборка'); // её service worker придёт со своей страницей
  const mods = await get(BASE + 'js/modules.json', fresh);
  const files = await mods.clone().json();
  const c = await caches.open(CACHE);
  await c.put(BASE + 'js/data/build.js', build);
  await c.put(BASE + 'js/modules.json', mods);
  const page = await get(BASE, fresh);
  await c.put(BASE, page.clone());
  await c.put(BASE + 'index.html', page);
  await c.put(BASE + 'manifest.webmanifest', await get(BASE + 'manifest.webmanifest', fresh));
  // файлы с меткой версии не меняются внутри сборки — их можно взять из кэша браузера (страница только что их грузила)
  const urls = files
    .concat('css/style.css')
    .map((f) => BASE + f + '?v=' + V)
    .concat(STATIC.map((f) => BASE + f));
  for (let i = 0; i < urls.length; i += 16)
    await Promise.all(urls.slice(i, i + 16).map(async (u) => c.put(u, await get(u))));
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rhr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  // чужие сайты, запись, куски файлов (музыка) — мимо, как без service worker
  if (r.method !== 'GET' || !r.url.startsWith(BASE) || r.headers.has('range')) return;
  e.respondWith(network(e));
});

async function network(e) {
  const r = e.request;
  try {
    const res = await fetch(r);
    if (res.status === 200 && res.type === 'basic' && keep(r.url)) {
      const copy = res.clone();
      e.waitUntil(
        caches
          .open(CACHE)
          .then((c) => c.put(r.url, copy))
          .catch(() => {}),
      );
    }
    return res;
  } catch (err) {
    // сети нет — из кэша: сначала точный адрес, потом без ?… (build.js?t=…, страница с ?dev), страница — главная
    const c = await caches.open(CACHE);
    const hit =
      (await c.match(r.url)) ||
      (await c.match(r.url, { ignoreSearch: true })) ||
      (r.mode === 'navigate' ? await c.match(BASE) : undefined);
    if (hit) return hit;
    throw err;
  }
}
/** Докладывать в кэш по ходу: файлы этой сборки (?v=V) и файлы без метки, кроме «указателей» сборки. */
function keep(url) {
  const u = new URL(url);
  const v = u.searchParams.get('v');
  if (v !== null) return v === V && u.search === '?v=' + V;
  return !u.search && !POINTERS.includes(u.href) && !u.pathname.endsWith('/sw.js');
}
