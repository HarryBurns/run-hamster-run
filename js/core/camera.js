// Камера — одна на все сцены: масштаб, границы, слежение за героем, перевод «экран ↔ мир» и округление
// до пикселя устройства (оно нужно кэшу спрайтов, см. core/sprites.js).
//
// Мир — в своих единицах, экран — в CSS-пикселях (G.view.w × G.view.h). Точка мира (cam.x, cam.y) попадает
// в «якорь» на экране — по умолчанию в его центр.
//
//   const cam = new Camera();
//   cam.setZoom(z);                       // или cam.setTileZoom(z, T) — если нужен кэш спрайтов
//   cam.setBounds(x0, y0, x1, y1);        // мир, за края которого камера не выезжает
//   cam.snap(p.x, p.y);                   // сразу навести (при входе в сцену)
//   cam.follow(p.x, p.y, dt, 5);          // плавно догонять героя (в update)
//   cam.apply(ctx);                       // в draw: дальше рисуем в координатах мира
//   cam.toWorld(sx, sy);                  // куда нажали
import { G } from './state.js';
import { clamp, lerp } from './util.js';

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1; // CSS-пикселей на единицу мира
    this.k = 1; // пикселей устройства на единицу мира (zoom × плотность экрана)
    this.bounds = null;
    this.anchorX = null; // где на экране находится точка (cam.x, cam.y); null — в центре
    this.anchorY = null;
  }

  /** Масштаб: CSS-пикселей на единицу мира. */
  setZoom(z) {
    this.zoom = z;
    this.k = z * (G.view.dpr || 1);
  }
  /**
   * Масштаб для мира из клеток размером tile, который рисуется из кэша спрайтов: подгоняется так, чтобы клетка
   * занимала целое чётное число пикселей устройства. Тогда центры клеток попадают на целые пиксели, и спрайты
   * ложатся 1:1 без швов. Масштаб от этого меняется на 1–2 %.
   */
  setTileZoom(z, tile) {
    const dpr = G.view.dpr || 1;
    const px = Math.max(2, Math.round((tile * z * dpr) / 2) * 2);
    this.zoom = px / (tile * dpr);
    this.k = px / tile;
  }

  /**
   * Границы мира. Любая пара (x0/x1 или y0/y1) может быть null — тогда по этой оси камера не ограничена.
   * Если мир по оси меньше экрана: smallX / smallY = 'center' (по умолчанию) — встать по центру мира
   * (со сдвигом centerDx / centerDy), 'start' — прижаться к началу.
   */
  setBounds(x0, y0, x1, y1, opts = {}) {
    this.bounds = { x0, y0, x1, y1, smallX: 'center', smallY: 'center', centerDx: 0, centerDy: 0, ...opts };
  }
  /** Точка экрана (CSS-пиксели), в которую смотрит камера. null — середина экрана по этой оси. */
  setAnchor(sx, sy) {
    this.anchorX = sx;
    this.anchorY = sy;
  }

  get viewW() {
    return G.view.w / this.zoom;
  }
  get viewH() {
    return G.view.h / this.zoom;
  }
  get ax() {
    return this.anchorX === null ? G.view.w / 2 : this.anchorX;
  }
  get ay() {
    return this.anchorY === null ? G.view.h / 2 : this.anchorY;
  }

  /** Не дать камере выехать за границы мира. */
  clamp() {
    const b = this.bounds;
    if (!b) return;
    const vw = this.viewW,
      vh = this.viewH;
    if (b.x0 !== null && b.x1 !== null) {
      if (b.x1 - b.x0 <= vw && b.smallX === 'center') this.x = (b.x0 + b.x1) / 2 + b.centerDx;
      else this.x = clamp(this.x, b.x0 + vw / 2, b.x1 - vw / 2);
    }
    if (b.y0 !== null && b.y1 !== null) {
      if (b.y1 - b.y0 <= vh && b.smallY === 'center') this.y = (b.y0 + b.y1) / 2 + b.centerDy;
      else this.y = clamp(this.y, b.y0 + vh / 2, b.y1 - vh / 2);
    }
  }
  /** Сразу навести камеру на точку. */
  snap(x, y) {
    this.x = x;
    if (y !== undefined) this.y = y;
    this.clamp();
  }
  /** Плавно догонять точку: rate — насколько быстро (5–6 — как в игре сейчас). y можно не давать. */
  follow(x, y, dt, rate = 5) {
    const t = Math.min(1, dt * rate);
    this.x = lerp(this.x, x, t);
    if (y !== undefined && y !== null) this.y = lerp(this.y, y, t);
    this.clamp();
  }

  /** Экран (CSS-пиксели) → мир. */
  toWorld(sx, sy) {
    return { x: this.x + (sx - this.ax) / this.zoom, y: this.y + (sy - this.ay) / this.zoom };
  }
  /** Мир → экран (CSS-пиксели). */
  toScreen(wx, wy) {
    return { x: (wx - this.x) * this.zoom + this.ax, y: (wy - this.y) * this.zoom + this.ay };
  }
  /** Видимая часть мира (с запасом pad единиц мира): { x0, y0, x1, y1 }. */
  visible(pad = 0) {
    const a = this.toWorld(0, 0),
      b = this.toWorld(G.view.w, G.view.h);
    return { x0: a.x - pad, y0: a.y - pad, x1: b.x + pad, y1: b.y + pad };
  }

  /** Включить на канве координаты мира (перед этим обычно ctx.save(), после — ctx.restore()). */
  apply(ctx) {
    ctx.translate(this.ax, this.ay);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
  /**
   * Сдвиг камеры в целых пикселях устройства — для SpriteSet.begin(ctx, cam.k, ox, oy).
   * cw × ch — размер канвы в пикселях устройства. Земля и спрайты из кэша двигаются вместе, без дрожания.
   */
  pixelOrigin(cw, ch) {
    return { ox: Math.round(this.x * this.k - cw / 2), oy: Math.round(this.y * this.k - ch / 2) };
  }
}
