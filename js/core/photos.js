// Фотоальбом (этап 17в, хранение — этап 19): снимки фото-режима лежат НЕ в сохранении игры и НЕ в localStorage,
// а в IndexedDB — у неё места в сотни раз больше, и снимки не теснят сохранения игр (ревью 2, находка 1).
//
//   база «rhr», хранилище «kv»:  ключ rhr-photos-<gid>  →  [{ id, day, place, date, caption, src }]
//   (gid — id игры в списке игр, core/games.js; src — маленький JPEG data:image/jpeg;base64,…, сторона PHOTO.size)
//
// Раньше снимки лежали в localStorage под теми же ключами rhr-photos-<gid>. Перенос — один раз и сам: при запуске
// (migrateAllPhotos) и при первом обращении к альбому игры снимки из localStorage дописываются в базу, запись
// проверяется чтением, и только после этого ключ из localStorage удаляется. Не получилось — он остаётся на месте,
// альбом показывает и те, и другие.
//
// IndexedDB нет или она не открывается (старый браузер, строгий частный режим) — запасной путь: всё работает как
// раньше, в localStorage (photoStore() === 'local'). Все функции — async и никогда не бросают исключений.
// Снимков не больше PHOTO.max на игру. Игру удалили нарочно — её снимки уходят вместе с ней в «корзину»
// (ключ rhr-photos-trash, core/games.js) и возвращаются, если игру вернули.
import { G } from './state.js';

export const PHOTO = {
  max: 12, // снимков в альбоме одной игры
  size: 480, // длинная сторона снимка, пикселей
  quality: 0.72, // качество JPEG
};
const PREFIX = 'rhr-photos-';
const keyOf = (gid) => PREFIX + (gid || 'main');
const gidNow = () => (G.state && G.state.gid) || 'main';
const DB_NAME = 'rhr',
  STORE = 'kv',
  OPEN_MS = 4000; // не открылась за это время (Safari в частном режиме молчит) — работаем через localStorage

/** Годные снимки из чего угодно (строка из хранилища, массив из файла): только картинки data:, не больше max. */
export function cleanPhotos(list) {
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out = [],
    seen = new Set();
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  for (const p of list) {
    if (!p || typeof p.src !== 'string' || !p.src.startsWith('data:image/') || p.src.length > 600000) continue;
    const id = typeof p.id === 'string' && p.id && !seen.has(p.id) ? p.id.slice(0, 24) : newId();
    seen.add(id);
    out.push({
      id,
      day: Number.isFinite(p.day) ? p.day : 0,
      place: str(p.place, 60),
      date: str(p.date, 60),
      caption: str(p.caption, 80),
      src: p.src,
    });
  }
  return out.slice(-PHOTO.max);
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- localStorage (запасной путь и источник переноса) ----------
const ls = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set(key, list) {
    try {
      if (list.length) localStorage.setItem(key, JSON.stringify(list));
      else localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false; // переполнено или недоступно
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* хранилище недоступно */
    }
  },
  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) out.push(k);
      }
    } catch (e) {
      /* хранилище недоступно */
    }
    return out;
  },
};

// ---------- IndexedDB ----------
let dbp = null;
/** Открытая база или null (нет IndexedDB, не открылась). Спрашивается один раз за сеанс. */
function db() {
  if (!dbp)
    dbp = new Promise((done) => {
      let timer = 0;
      const end = (v) => {
        clearTimeout(timer);
        done(v);
      };
      try {
        const idb = globalThis.indexedDB;
        if (!idb) return end(null);
        timer = setTimeout(() => end(null), OPEN_MS);
        const rq = idb.open(DB_NAME, 1);
        rq.onupgradeneeded = () => {
          if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
        };
        rq.onsuccess = () => end(rq.result);
        rq.onerror = rq.onblocked = () => end(null);
      } catch (e) {
        end(null);
      }
    });
  return dbp;
}
/** Одна операция с базой: fn(store) возвращает запрос; ждём конца транзакции. Ошибка — исключение. */
function tx(d, mode, fn) {
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(rq.result);
    t.onerror = t.onabort = () => fail(t.error || rq.error || new Error('IndexedDB'));
  });
}
const idbGet = async (d, key) => cleanPhotos(await tx(d, 'readonly', (s) => s.get(key)));
const idbSet = (d, key, list) => tx(d, 'readwrite', (s) => (list.length ? s.put(list, key) : s.delete(key)));

// Все операции идут по очереди: две записи подряд (снимок и сразу удаление) не перемешаются.
let chain = Promise.resolve();
const queued = (fn) => {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
};

/** Перенести снимки одного ключа из localStorage в базу. true — в localStorage по этому ключу больше ничего нет. */
async function moveKey(d, key) {
  const raw = ls.get(key);
  if (!raw) return true;
  const old = cleanPhotos(raw);
  try {
    if (old.length) {
      const have = await idbGet(d, key);
      const add = old.filter((p) => !have.some((h) => h.id === p.id || h.src === p.src));
      const all = [...add, ...have].slice(-PHOTO.max); // прежние снимки старше тех, что уже в базе
      await idbSet(d, key, all);
      const back = await idbGet(d, key); // проверка чтением: всё ли на месте
      if (
        back.length !== all.length ||
        !old.every((p) => all.length === PHOTO.max || back.some((h) => h.src === p.src))
      )
        return false;
    }
    ls.del(key); // только теперь — из localStorage
    return true;
  } catch (e) {
    return false;
  }
}
/** Снимки ключа: из базы (после переноса), а без неё — из localStorage. */
async function read(key) {
  const d = await db();
  if (!d) return cleanPhotos(ls.get(key));
  const moved = await moveKey(d, key);
  let list = [];
  try {
    list = await idbGet(d, key);
  } catch (e) {
    /* база не читается — покажем хотя бы то, что осталось в localStorage */
  }
  if (!moved) {
    const old = cleanPhotos(ls.get(key)).filter((p) => !list.some((h) => h.src === p.src));
    list = [...old, ...list].slice(-PHOTO.max);
  }
  return list;
}
async function write(key, list) {
  const d = await db();
  if (!d) return ls.set(key, list);
  try {
    await idbSet(d, key, list);
    ls.del(key); // в базе теперь полный список (read() подмешал оставшееся в localStorage)
    return true;
  } catch (e) {
    return false;
  }
}

/** Где лежат снимки: 'idb' — в IndexedDB, 'local' — запасной путь, localStorage. */
export const photoStore = async () => ((await db()) ? 'idb' : 'local');

/**
 * Перенести в базу снимки всех игр, оставшиеся в localStorage (зовётся при запуске игры, core/games.js → заставка).
 * Возвращает, сколько ключей перенесено. Освобождает место в localStorage под сохранения.
 */
export function migrateAllPhotos() {
  return queued(async () => {
    const d = await db();
    if (!d) return 0;
    let n = 0;
    for (const key of ls.keys()) if (await moveKey(d, key)) n++;
    return n;
  }).catch(() => 0);
}

/** Снимки игры gid (по умолчанию — текущей), новые — в конце. */
export function loadPhotos(gid = gidNow()) {
  return queued(() => read(keyOf(gid))).catch(() => []);
}
/** Записать снимки игры gid целиком (загрузка игры из файла). true — записалось. */
export function savePhotos(gid, list) {
  return queued(() => write(keyOf(gid), cleanPhotos(list))).catch(() => false);
}
/**
 * Положить снимок в альбом. replaceOldest — альбом полон: убрать самый старый. Вернёт 'ok' | 'full' | 'fail'
 * (не хватило места в хранилище браузера).
 */
export function addPhoto(photo, { replaceOldest = false } = {}) {
  const key = keyOf(gidNow());
  return queued(async () => {
    const list = await read(key);
    if (list.length >= PHOTO.max) {
      if (!replaceOldest) return 'full';
      list.splice(0, list.length - PHOTO.max + 1);
    }
    list.push({ ...photo, id: photo.id || newId() });
    return (await write(key, list)) ? 'ok' : 'fail';
  }).catch(() => 'fail');
}
/** Удалить снимок по id. */
export function removePhoto(id) {
  const key = keyOf(gidNow());
  return queued(async () =>
    write(
      key,
      (await read(key)).filter((p) => p.id !== id),
    ),
  ).catch(() => false);
}
/** Убрать все снимки игры насовсем. */
export function dropPhotos(gid) {
  return queued(() => write(keyOf(gid), [])).catch(() => false);
}
/** Переложить снимки игры from под другой id (в «корзину» и обратно); прежние снимки to заменяются. */
export function movePhotos(from, to) {
  return queued(async () => {
    const list = await read(keyOf(from));
    if (!(await write(keyOf(to), list))) return false;
    return write(keyOf(from), []);
  }).catch(() => false);
}
/** Сколько места занимают снимки игры (символов) — для автотеста и замеров. */
export async function photosSize(gid = gidNow()) {
  return JSON.stringify(await loadPhotos(gid)).length;
}
