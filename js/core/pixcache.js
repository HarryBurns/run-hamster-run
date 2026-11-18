// Базовый кэш картинок (этап 25): «ключ → канва» с учётом пикселей и ОДНИМ общим пределом памяти на все кэши игры.
//
// От него наследуют кэш спрайтов локаций (core/sprites.js — SpriteSet), кэш неподвижного рисунка дома
// (engine/side/cache.js — LayerCache), а куски земли (engine/topdown/ground.js) хранятся в его экземпляре.
// Раньше у каждого был свой предел (80 МБ спрайтов + 56 МБ на дом + земля без предела — на планшете в сумме
// выходило до 170 МБ канв); теперь предел один — BUDGET пикселей на всё, и когда он превышен, выбрасывается то,
// что дольше всего не рисовалось, из какого бы кэша оно ни было (спрайты города, пока хомячок в лесу; земля
// локации, пока он в доме). Выброшенное нарисуется заново, когда понадобится.
//
//   class MyCache extends PixelCache { … }
//   this.tick()             в начале кадра: общий счётчик кадров и, если памяти занято слишком много, вытеснение
//   this.peek(key)          запись по ключу (и отметка «нужна сейчас») или undefined
//   this.add(key, s)        положить запись { c: канва, w, h, … } — пиксели учитываются
//   this.drop(key)          убрать запись;  this.clear() — убрать все
//   this.onDrop(s)          крюк: запись вытеснена общим пределом (земля возвращает канву в запас)
//
// Память одного пикселя канвы — 4 байта: 24 млн пикселей ≈ 96 МБ.

/** Общий предел, пикселей во всех кэшах вместе (≈ 96 МБ). Экран iPad (2048×1536) — 3,1 млн. */
export const BUDGET = 24e6;
const KEEP = 0.75; // после вытеснения остаётся не больше этой доли предела
const FRESH = 120; // записи, которые рисовались в последние FRESH отсчётов (около секунды: кадры шага жителей вот-вот
// понадобятся снова), выбрасываются, только пока занято больше самого предела; отсчёт — tick() любого кэша
const NOW = 8; // а то, что рисовалось в последние NOW отсчётов, — на экране: не трогаем никогда
const RETRY = 10; // если вытеснять нечего (всё на экране) — следующая попытка через столько кадров

const caches = new Set();
let total = 0,
  clock = 0,
  wait = 0,
  dropped = 0;

export class PixelCache {
  constructor() {
    this.map = new Map();
    this.pixels = 0;
    this.built = 0;
    caches.add(this);
  }

  /** Выбросить все картинки (они нарисуются заново, когда понадобятся). */
  clear() {
    total -= this.pixels;
    this.map.clear();
    this.pixels = 0;
  }
  /** Начало кадра. */
  tick() {
    clock++;
    if (total > BUDGET && --wait <= 0) trimAll();
  }
  /** Запись по ключу с отметкой «нужна сейчас» или undefined. */
  peek(key) {
    const s = this.map.get(key);
    if (s) s.used = clock;
    return s;
  }
  /** Положить запись { c, w, h, … }. */
  add(key, s) {
    s.used = clock;
    this.map.set(key, s);
    const n = s.w * s.h;
    this.pixels += n;
    total += n;
    return s;
  }
  /** Убрать запись; возвращает её (или undefined). */
  drop(key) {
    const s = this.map.get(key);
    if (!s) return s;
    this.map.delete(key);
    const n = s.w * s.h;
    this.pixels -= n;
    total -= n;
    return s;
  }
  onDrop() {}
}

/** Памяти занято слишком много: выбросить то, что дольше всего не рисовалось, — из всех кэшей. */
function trimAll() {
  const list = [];
  for (const c of caches) for (const [key, s] of c.map) if (s.used < clock - NOW && s.w) list.push([s.used, key, c]);
  list.sort((a, b) => a[0] - b[0]);
  const goal = BUDGET * KEEP;
  for (const [used, key, c] of list) {
    if (total <= (used < clock - FRESH ? goal : BUDGET)) break;
    c.onDrop(c.drop(key));
    dropped++;
  }
  wait = total > BUDGET ? RETRY : 0;
}

/** Для тестов и замеров: сколько пикселей во всех кэшах, предел, сколько записей вытеснено. */
export const pixStats = () => ({ total, budget: BUDGET, caches: caches.size, dropped, clock });
