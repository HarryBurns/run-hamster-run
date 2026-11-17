// «Движок домов»: кэш неподвижного рисунка (От12). Коробка дома с комнатами (обои, полы) и неподвижные части
// рисунка дома (стойки, двери, горка… — крюки art) рисуются линиями один раз в отдельные канвы, а в каждом кадре
// копируются на экран.
//
// Как в кэше спрайтов локаций (core/sprites.js): копия ложится 1:1 на целые пиксели устройства. Для этого сцена
// рисует мир с целочисленным сдвигом камеры (begin(ctx, k, tx, ty) — тот же масштаб k = zoom × dpr), и канва кэша
// рисуется с тем же масштабом: картинка из кэша совпадает с рисунком линиями пиксель в пиксель.
//
//   cache.begin(ctx, k, tx, ty, sig)        в начале кадра (sig — от чего зависит рисунок: сезон…; сменился —
//                                           кэш сброшен, как и при смене k)
//   cache.layer(key, [x0, y0, x1, y1], paint)   нарисовать кусок мира (единицы дома) из кэша; paint(ctx) рисует
//                                           в координатах дома то, что попадает в рамку (лишнее обрежется)
//   cache.tiles(key, [x0, y0, x1, y1], view, paint)   то же для большого куска — квадратами по TILE единиц,
//                                           только те, что видны (view — sc.view)
//   cache.sprite(key, [x0, y0, x1, y1], paint, x, y)   подвижная картинка (кадр жителя) вокруг точки (0, 0) —
//                                           в точку дома (x, y)
// Сколько пикселей можно держать — maxPixels; лишнее (давно не нужное) выбрасывается.
const TILE = 400; // сторона квадрата кэша (единицы дома)

export class LayerCache {
  constructor({ maxPixels = 14e6 } = {}) {
    this.map = new Map();
    this.k = 0;
    this.sig = '';
    this.pixels = 0;
    this.frame = 0;
    this.built = 0;
    this.ctx = null;
    this.tx = 0;
    this.ty = 0;
    this.off = false; // для проверки: рисовать всё линиями, мимо кэша
    this.maxPixels = maxPixels;
  }
  clear() {
    this.map.clear();
    this.pixels = 0;
  }
  begin(ctx, k, tx, ty, sig) {
    if (k !== this.k || sig !== this.sig) {
      this.clear();
      this.k = k;
      this.sig = sig;
    }
    this.ctx = ctx;
    this.tx = tx;
    this.ty = ty;
    this.frame++;
    if (this.pixels > this.maxPixels && this.frame % 20 === 0) this.trim();
  }
  /** Кусок мира из кэша. ceil — правый и нижний край округлить вверх (отдельный кусок) или вниз (квадрат сетки). */
  layer(key, box, paint, ceil = true) {
    const ctx = this.ctx;
    if (this.off) {
      paint(ctx);
      return;
    }
    let s = this.map.get(key);
    if (!s) {
      s = this.build(box, paint, ceil);
      this.map.set(key, s);
      this.pixels += s.w * s.h;
    }
    s.used = this.frame;
    if (!s.c) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(s.c, s.px + this.tx, s.py + this.ty);
    ctx.restore();
  }
  /**
   * Подвижная картинка из кэша (кадр жителя): paint(ctx) рисует вокруг точки (0, 0), box — рамка вокруг неё
   * (единицы дома); точка (0, 0) встаёт в точку дома (x, y), округлённую до пикселя устройства.
   */
  sprite(key, box, paint, x, y) {
    const ctx = this.ctx;
    if (this.off) {
      ctx.save();
      ctx.translate(x, y);
      paint(ctx);
      ctx.restore();
      return;
    }
    let s = this.map.get(key);
    if (!s) {
      s = this.build(box, paint, true);
      this.map.set(key, s);
      this.pixels += s.w * s.h;
    }
    s.used = this.frame;
    if (!s.c) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(s.c, Math.round(x * this.k) + s.px + this.tx, Math.round(y * this.k) + s.py + this.ty);
    ctx.restore();
  }
  /** Большой кусок мира — квадратами сетки, только видимые (view — { x0, y0, x1, y1 } в единицах дома). */
  tiles(key, box, view, paint) {
    if (this.off) {
      paint(this.ctx);
      return;
    }
    const [x0, y0, x1, y1] = box;
    for (let gy = Math.floor(y0 / TILE); gy * TILE < y1; gy++)
      for (let gx = Math.floor(x0 / TILE); gx * TILE < x1; gx++) {
        const bx0 = Math.max(x0, gx * TILE),
          by0 = Math.max(y0, gy * TILE),
          bx1 = Math.min(x1, (gx + 1) * TILE),
          by1 = Math.min(y1, (gy + 1) * TILE);
        if (view && (bx1 < view.x0 || bx0 > view.x1 || by1 < view.y0 || by0 > view.y1)) continue;
        // края квадратов — по общей сетке пикселей (вниз), чтобы соседние сходились без щелей
        this.layer(`${key}:${gx}:${gy}`, [bx0, by0, bx1, by1], paint, false);
      }
  }
  build(box, paint, ceil) {
    const k = this.k,
      up = ceil ? Math.ceil : Math.floor;
    const px = Math.floor(box[0] * k),
      py = Math.floor(box[1] * k),
      w = up(box[2] * k) - px,
      h = up(box[3] * k) - py;
    this.built++;
    if (w <= 0 || h <= 0) return { c: null, px, py, w: 0, h: 0, used: 0 };
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.setTransform(k, 0, 0, k, -px, -py);
    x.lineJoin = 'round';
    paint(x); // лишнее обрежет сама канва — по целым пикселям, поэтому соседние квадраты сходятся без шва
    return { c, px, py, w, h, used: 0 };
  }
  trim() {
    const list = [...this.map.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [key, s] of list) {
      if (this.pixels <= this.maxPixels * 0.7 || s.used >= this.frame - 1) break;
      this.map.delete(key);
      this.pixels -= s.w * s.h;
    }
  }
  stats() {
    return { count: this.map.size, pixels: this.pixels, built: this.built, k: this.k };
  }
}
