// Кэш спрайтов: картинка один раз рисуется линиями в отдельную канву, а потом просто копируется на экран.
//
// Главное правило (docs/REVIEW.md, P1): копия должна попадать на экран 1:1 и на целые пиксели устройства.
// Если картинку при копировании растягивать или ставить на дробные координаты, выигрыша в скорости нет.
// Поэтому:
//  - спрайты готовятся сразу в масштабе экрана: k = масштаб камеры × devicePixelRatio (пикселей устройства
//    на единицу мира). Сменился k (повернули телефон, изменили окно) — набор сбрасывается сам;
//  - сдвиг камеры — целое число пикселей устройства, место спрайта тоже округляется до пикселя;
//  - всё, от чего зависит вид спрайта (сезон, вариант, «горит свет», кадр анимации), входит в ключ.
//    Сменился сезон — просто получаются другие ключи; старые картинки вытесняются, когда памяти мало
//    (предел общий на все кэши картинок игры — core/pixcache.js).
//
// Как пользоваться (пример — js/engine/topdown/render.js и kinds.js):
//   const SP = new SpriteSet();                      // один набор на сцену
//   SP.begin(ctx, k, ox, oy);                        // в начале кадра: масштаб и сдвиг камеры (целые пиксели)
//   SP.put('tree:summer:0', [-50, -90, 50, 30], (c) => { ...рисуем дерево вокруг точки (0, 0)... }, x, y);
//   SP.world();                                      // перед рисованием линиями в координатах мира
//   SP.end(dpr);                                     // в конце: вернуть экранные координаты (CSS-пиксели)
//
// Рамка [x0, y0, x1, y1] задаётся в единицах мира вокруг точки (0, 0) с запасом: пустые поля обрезаются сами.
// Если рисунок в рамку не поместился, в консоли будет предупреждение, а в stats().clipped — ключ спрайта.
// Анимацию делают так: неподвижную часть — в спрайт, подвижную — отдельным спрайтом со сдвигом (крона дерева),
// несколькими кадрами в ключе (листья пальмы, шаг жителя) или рисуют «вживую» поверх (струи фонтана).

import { PixelCache } from './pixcache.js';

const PAD = 2; // поля вокруг рамки, пиксели: сюда попадает сглаживание краёв
let scratch = null,
  scratchCtx = null; // общий черновик: рисуем в него, читаем пиксели и вырезаем непустую часть

/** Память — общая со всеми кэшами картинок (core/pixcache.js): давно не рисовавшееся выбрасывается само. */
export class SpriteSet extends PixelCache {
  constructor() {
    super();
    this.k = 0;
    this.ox = 0;
    this.oy = 0;
    this.ctx = null;
    this.px = false;
    this.clipped = [];
  }

  /** Масштаб: пикселей устройства на единицу мира. При смене набор сбрасывается. */
  setScale(k) {
    if (k !== this.k) {
      this.clear();
      this.k = k;
    }
  }

  /** Начать кадр: масштаб k и сдвиг камеры (ox, oy) в целых пикселях устройства. Включает координаты мира. */
  begin(ctx, k, ox, oy) {
    this.setScale(k);
    this.ctx = ctx;
    this.ox = ox;
    this.oy = oy;
    this.tick();
    ctx.setTransform(k, 0, 0, k, -ox, -oy);
    this.px = false;
  }
  /** Включить координаты мира — перед обычным рисованием линиями. */
  world() {
    if (this.px) {
      this.ctx.setTransform(this.k, 0, 0, this.k, -this.ox, -this.oy);
      this.px = false;
    }
  }
  /** Закончить кадр: вернуть экранные координаты (CSS-пиксели). */
  end(dpr) {
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.px = false;
    this.ctx = null;
  }

  /** Готовый спрайт по ключу или undefined (чтобы не готовить рамку и функцию рисования на каждый кадр). */
  find(key) {
    return this.peek(key);
  }
  /** Спрайт по ключу; если его ещё нет — нарисовать: paint(ctx) рисует вокруг точки (0, 0) в единицах мира. */
  get(key, box, paint) {
    return this.peek(key) || this.add(key, this.build(key, box, paint));
  }
  /** Скопировать спрайт на экран так, чтобы его точка (0, 0) попала в точку мира (x, y). */
  draw(s, x, y) {
    if (!s.c) return;
    if (!this.px) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.px = true;
    }
    this.ctx.drawImage(s.c, Math.round(x * this.k) - this.ox - s.ax, Math.round(y * this.k) - this.oy - s.ay);
  }
  /** get + draw одним вызовом. */
  put(key, box, paint, x, y) {
    this.draw(this.get(key, box, paint), x, y);
  }

  build(key, box, paint) {
    const k = this.k;
    // точка (0, 0) спрайта — на целом пикселе черновика
    const ax = PAD - Math.floor(box[0] * k),
      ay = PAD - Math.floor(box[1] * k);
    const w = ax + Math.ceil(box[2] * k) + PAD,
      h = ay + Math.ceil(box[3] * k) + PAD;
    if (!scratch) {
      scratch = document.createElement('canvas');
      scratchCtx = scratch.getContext('2d', { willReadFrequently: true });
    }
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, w);
      scratch.height = Math.max(scratch.height, h);
    }
    const c = scratchCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    c.save();
    c.setTransform(k, 0, 0, k, ax, ay);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    paint(c);
    c.restore();
    this.built++;
    // непустая часть
    const px = new Uint32Array(c.getImageData(0, 0, w, h).data.buffer);
    let y0 = 0,
      y1 = h - 1,
      x0 = 0,
      x1 = w - 1;
    const rowEmpty = (y) => {
      for (let i = y * w, e = i + w; i < e; i++) if (px[i]) return false;
      return true;
    };
    while (y0 <= y1 && rowEmpty(y0)) y0++;
    if (y0 > y1) return { c: null, ax: 0, ay: 0, w: 0, h: 0, used: 0 }; // ничего не нарисовано
    while (rowEmpty(y1)) y1--;
    const colEmpty = (x) => {
      for (let y = y0; y <= y1; y++) if (px[y * w + x]) return false;
      return true;
    };
    while (colEmpty(x0)) x0++;
    while (colEmpty(x1)) x1--;
    if ((x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) && !this.clipped.includes(key)) {
      this.clipped.push(key);
      console.warn(`Спрайт «${key}» не помещается в рамку [${box}] — увеличь её`);
    }
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d').drawImage(scratch, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return { c: out, ax: ax - x0, ay: ay - y0, w: out.width, h: out.height, used: 0 };
  }

  /** Для тестов и отладки. */
  stats() {
    return { count: this.map.size, pixels: this.pixels, built: this.built, k: this.k, clipped: this.clipped.slice() };
  }
}

// ---------- значки для окон ----------
// Значок вещи или мебели рисуется один раз, а в каждую карточку окна кладётся его копия
// (у каждой карточки свой элемент canvas, поэтому сам кэш в окно вставлять нельзя).
const icons = new Map();
/** Canvas w×h CSS-пикселей с картинкой по ключу; paint(ctx) рисует в CSS-пикселях и вызывается один раз на ключ. */
export function cachedIcon(key, w, h, paint) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    return c;
  };
  const id = `${key}@${w}x${h}@${dpr}`;
  let src = icons.get(id);
  if (!src) {
    src = mk();
    const c = src.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(c);
    icons.set(id, src);
  }
  const canvas = mk();
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.getContext('2d').drawImage(src, 0, 0);
  return canvas;
}
