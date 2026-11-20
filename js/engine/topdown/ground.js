// «Движок локаций»: ЗЕМЛЯ — кэш кусками и плавные границы между видами клеток.
//
// Землю не рисуют клетка за клеткой каждый кадр: карта разбита на куски CH×CH клеток, каждый кусок один раз
// рисуется в свою картинку (в масштабе экрана, 1:1) и дальше просто копируется. Поэтому рисунок земли может
// быть сколько угодно богатым — на скорость кадра он не влияет.
//
// КАК РИСУЕТСЯ КУСОК. У «слоёных» видов клеток есть высота слоя z (кто кого перекрывает: вода < песок < трава <
// тропинка < мостовая…). Слои кладутся снизу вверх; слой вида K — это область «все клетки не ниже K», её край
// скруглён и слегка неровен, поэтому между травой и песком, песком и водой нет квадратных ступенек.
// Поля вида клетки (kinds.js):
//   z                 высота слоя (число; у разных видов разная — кроме видов-близнецов с одним рисунком)
//   fill(env, ctx)    чем залить слой: цвет или градиент (ctx в координатах мира)
//   edge: { r, wob, out: [[цвет, ширина], …], in: [[цвет, ширина], …] }
//                     край слоя: r — радиус скругления углов (до T/2), wob — неровность; out — обводки ПОД слоем
//                     (видна внешняя половина: тень на нижнем слое, бордюр, пена), in — обводки ПОВЕРХ слоя
//                     (видна внутренняя половина: кайма травы, мокрый песок)
//   deco(ctx, x, y, tx, ty, env, rnd)   мелочи клетки: пучки травы, камешки… rnd(i) — постоянное «случайное»
//                     число 0..1 для этой клетки; рисунок может вылезать за клетку на пол-клетки
//   live(ctx, cells, n, env)   то, что шевелится: зовётся каждый кадр один раз на вид, cells — [tx, ty, tx, ty, …]
//                     видимых клеток этого вида (n чисел) — рисуй всё одним путём
// Вид без z (по-старому, с одним draw) рисуется в кусок квадратом поверх слоёв; anim: true — каждый кадр.
// Крюк локации paintGround(ctx, env, x0, y0, x1, y1) дорисовывает в кусок неподвижное (разметку, бортики).
// Слой K лежит не под всеми клетками выше себя, а только под теми, что «стоят на нём»: до них от клеток K можно дойти
// по соседним клеткам, не спускаясь ниже (layerMask). Иначе пруд, до которого рядом (в запасе куска) есть плитка
// у бассейна, ложился бы на плитку — и её светлые углы выглядывали из-под волнистого берега, а грядка рядом с прудом
// лежала бы в луже.
//
// Память (Т1): держим куски на экране и те куски за его краем, что вот-вот покажутся: до края экрана меньше
// KEEP_NEAR куска. Их готовим заранее, когда до края меньше PRE_NEAR куска, — по одному за кадр, ближние и по ходу
// камеры раньше, чтобы при ходьбе не было рывков. Остальные выбрасываются сразу (раньше держалось всё кольцо
// в кусок вокруг экрана — на iPad это больше половины памяти земли). Рисунок от этого не меняется: кусок один и тот
// же, когда бы его ни нарисовали.
import { PixelCache } from '../../core/pixcache.js';
import { T, hash } from './kinds.js';

/** Сторона куска в клетках. */
export const CH = 4;
const MARGIN = 2; // запас вокруг куска при расчёте краёв слоёв, клеток
// Куски за краем экрана: строить заранее, если до края меньше PRE_NEAR куска; держать, пока меньше KEEP_NEAR (запас
// между ними — чтобы, топчась у границы, не строить один и тот же кусок снова и снова). При ходьбе за кадр камера
// сдвигается на 1–2 % куска, на машинке — до 4 %: ряд кусков успевает построиться, пока до него ещё треть куска.
const PRE_NEAR = 1 / 3,
  KEEP_NEAR = 1 / 2;

// ключ → { c, w, h, seen }; память — общая со всеми кэшами картинок (core/pixcache.js): куски локации, из которой
// хомячок ушёл, вытесняются, когда памяти мало
const cache = new PixelCache();
const pool = []; // свободные канвы нужного размера
cache.onDrop = (e) => {
  if (pool.length < 8) pool.push(e.c);
};
let cacheK = 0,
  frame = 0,
  built = 0,
  buildMs = 0,
  late = 0, // кусков, построенных, когда они уже на экране (не успели заранее), — для автотеста
  edge = 0, // сколько кусков за краем экрана держится сейчас
  view = 0, // сколько кусков на экране
  lastCam = null;

/** Выбросить все куски (сменился масштаб, сезон дорисуется сам — он входит в ключ). */
export function clearGround() {
  for (const e of cache.map.values()) pool.push(e.c);
  cache.clear();
}
/**
 * Земля карты m изменилась (m.retile — двор виллы достроили: пруд, бассейн, грядки): забыть границы слоёв этой карты
 * и выбросить нарисованные куски — они нарисуются заново.
 */
export function resetGround(m) {
  masks.delete(m.kinds);
  clearGround();
}
/** Для тестов и отладки: сколько кусков и пикселей в кэше земли. */
export const groundStats = () => ({
  count: cache.map.size,
  pixels: cache.pixels,
  built,
  buildMs,
  chunk: CH,
  late,
  edge,
  view,
});

// ---------- край слоя ----------
/**
 * Путь (Path2D) области «клетки, где inside(x, y)» в окне клеток [x0, x1) × [y0, y1) — в единицах мира.
 * Углы скруглены радиусом r, вершины сдвинуты на «шум» амплитудой wob (seed — чтобы у разных слоёв он был разным).
 * Контур зависит только от соседних клеток, поэтому на стыках кусков совпадает.
 */
export function regionPath(inside, x0, y0, x1, y1, r, wob, seed) {
  const path = new Path2D();
  const W = x1 - x0 + 1; // вершин по ширине
  // рёбра по часовой стрелке (область справа по ходу): из вершины — куда
  const next = new Map();
  const key = (vx, vy) => (vy - y0) * W + (vx - x0);
  const addEdge = (ax, ay, bx, by) => {
    const k = key(ax, ay),
      e = next.get(k);
    if (e) e.push(bx, by);
    else next.set(k, [bx, by]);
  };
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (!inside(x, y)) continue;
      if (y === y0 || !inside(x, y - 1)) addEdge(x, y, x + 1, y);
      if (x === x1 - 1 || !inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (y === y1 - 1 || !inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (x === x0 || !inside(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  const rr = Math.min(r, T / 2);
  const px = (vx, vy) => vx * T + (wob ? (hash(vx * 3 + seed, vy * 7 + 1) - 0.5) * 2 * wob : 0),
    py = (vx, vy) => vy * T + (wob ? (hash(vx * 5 + 2, vy * 3 + seed) - 0.5) * 2 * wob : 0);
  for (const [k0, list0] of next) {
    while (list0.length) {
      // обходим петлю
      const sx = (k0 % W) + x0,
        sy = Math.floor(k0 / W) + y0;
      const pts = [sx, sy];
      let cx = sx,
        cy = sy,
        nx = list0.shift(),
        ny = list0.shift(),
        dx = nx - cx,
        dy = ny - cy;
      for (;;) {
        cx = nx;
        cy = ny;
        if (cx === sx && cy === sy) break;
        pts.push(cx, cy);
        const out = next.get(key(cx, cy));
        if (!out || !out.length) break;
        let pick = 0;
        if (out.length > 2) {
          // две клетки сходятся углами: поворачиваем налево — соединяем их в одну область
          const lx = dy,
            ly = -dx;
          for (let i = 0; i < out.length; i += 2) if (out[i] - cx === lx && out[i + 1] - cy === ly) pick = i;
        }
        nx = out[pick];
        ny = out[pick + 1];
        out.splice(pick, 2);
        dx = nx - cx;
        dy = ny - cy;
      }
      // гладкая замкнутая кривая: вершины сетки — «рычаги», точки на рёбрах — на расстоянии rr от вершин
      const n = pts.length / 2;
      if (n < 3) continue;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2],
          ay = pts[i * 2 + 1],
          bx = pts[((i + 1) % n) * 2],
          by = pts[((i + 1) % n) * 2 + 1],
          qx = pts[((i + 2) % n) * 2],
          qy = pts[((i + 2) % n) * 2 + 1];
        // ребро a→b: точки на нём возле a и возле b; затем скругление вокруг b к ребру b→q
        const ux = bx - ax,
          uy = by - ay,
          wx = qx - bx,
          wy = qy - by;
        const Bx = px(bx, by),
          By = py(bx, by);
        const p1x = px(ax, ay) + ux * rr,
          p1y = py(ax, ay) + uy * rr;
        const p2x = Bx - ux * rr,
          p2y = By - uy * rr;
        const p3x = Bx + wx * rr,
          p3y = By + wy * rr;
        if (i === 0) path.moveTo(p1x, p1y);
        if (rr < T / 2) path.lineTo(p2x, p2y);
        path.quadraticCurveTo(Bx, By, p3x, p3y);
      }
      path.closePath();
    }
  }
  return path;
}

// ---------- под какими клетками лежит слой ----------
const masks = new WeakMap(); // m.kinds → Map(z → Uint8Array)
/**
 * Под какими клетками карты лежит слой высоты z: клетки этого слоя и все, до которых от них можно дойти по соседним
 * (и наискосок) клеткам, не спускаясь ниже (высота по пути не убывает). Тропинка, ведущая к пирсу, лежит и под пирсом;
 * пруд посреди травы — не на плитке, которая есть в паре клеток от него. Карта клеток не меняется — считается один
 * раз на слой.
 */
function layerMask(m, z) {
  let byZ = masks.get(m.kinds);
  if (!byZ) masks.set(m.kinds, (byZ = new Map()));
  let mask = byZ.get(z);
  if (mask) return mask;
  const { w, h, kinds } = m;
  const zOf = (i) => {
    const q = kinds[(i / w) | 0][i % w].z;
    return q === undefined ? Infinity : q;
  };
  mask = new Uint8Array(w * h);
  const queue = [];
  for (let i = 0; i < w * h; i++)
    if (zOf(i) === z) {
      mask[i] = 1;
      queue.push(i);
    }
  while (queue.length) {
    const i = queue.pop(),
      x = i % w,
      y = (i / w) | 0,
      zi = zOf(i);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx,
          ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (mask[j]) continue;
        const zj = zOf(j);
        if (zj >= zi && zj !== Infinity) {
          mask[j] = 1;
          queue.push(j);
        }
      }
  }
  byZ.set(z, mask);
  return mask;
}
/** Условие для regionPath: клетка (x, y) внутри слоя z (за краем карты — как ближайшая клетка карты). */
function layerInside(m, z) {
  const mask = layerMask(m, z),
    { w, h, kinds } = m;
  return (x, y) => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x,
      cy = y < 0 ? 0 : y >= h ? h - 1 : y,
      q = kinds[cy][cx].z;
    if (q === undefined) return true; // клетка «по-старому» закрывает собой всё: под ней — любой слой
    return q >= z && mask[cy * w + cx] === 1;
  };
}

/** Для автотеста: высоты слоёв, которые лежат под клеткой (tx, ty), снизу вверх. */
export function layersUnder(m, tx, ty) {
  const zs = new Set();
  for (const row of m.kinds) for (const k of row) if (k.z !== undefined) zs.add(k.z);
  return [...zs].sort((a, b) => a - b).filter((z) => layerInside(m, z)(tx, ty));
}

// ---------- рисование куска ----------
function paintChunk(c, sc, env, cx, cy) {
  const m = sc.map,
    kinds = m.kinds,
    w = m.w,
    h = m.h;
  const x0 = cx * CH,
    y0 = cy * CH,
    wx0 = x0 - MARGIN,
    wy0 = y0 - MARGIN,
    wx1 = x0 + CH + MARGIN,
    wy1 = y0 + CH + MARGIN;
  // вид клетки; за краем карты — как ближайшая клетка карты (чтобы у края не было каймы)
  const kindAt = (x, y) => kinds[y < 0 ? 0 : y >= h ? h - 1 : y][x < 0 ? 0 : x >= w ? w - 1 : x];
  // слои, которые есть в окне, снизу вверх
  const levels = [];
  for (let y = wy0; y < wy1; y++)
    for (let x = wx0; x < wx1; x++) {
      const k = kindAt(x, y);
      if (k.z === undefined) continue;
      if (!levels.some((l) => l.z === k.z)) levels.push({ z: k.z, kind: k });
    }
  levels.sort((a, b) => a.z - b.z);
  const X = x0 * T,
    Y = y0 * T,
    S = CH * T;
  const rnd = (tx, ty) => (i) => hash(tx * 31 + i * 17 + 5, ty * 57 + i * 3 + 11);
  levels.forEach((lv, li) => {
    const k = lv.kind,
      e = k.edge || {};
    const fill = typeof k.fill === 'function' ? k.fill(env, c) : k.fill;
    let path = null;
    if (li > 0) {
      path = regionPath(
        layerInside(m, lv.z),
        wx0,
        wy0,
        wx1,
        wy1,
        e.r === undefined ? T / 2 : e.r,
        e.wob || 0,
        Math.round(lv.z * 10), // «неровность» края — от слоя, а не от его номера в куске: иначе на стыке кусков шов
      );
      for (const [col, lw] of e.out || []) {
        c.strokeStyle = typeof col === 'function' ? col(env) : col;
        c.lineWidth = lw;
        c.stroke(path);
      }
      c.save();
      c.clip(path);
    }
    c.fillStyle = fill;
    c.fillRect(X - 1, Y - 1, S + 2, S + 2);
    if (k.deco)
      for (let y = y0 - 1; y <= y0 + CH; y++)
        for (let x = x0 - 1; x <= x0 + CH; x++) {
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const kk = kinds[y][x];
          if (kk === k || (kk.z === k.z && kk.deco === k.deco)) k.deco(c, x * T, y * T, x, y, env, rnd(x, y));
        }
    if (path) {
      for (const [col, lw] of e.in || []) {
        c.strokeStyle = typeof col === 'function' ? col(env) : col;
        c.lineWidth = lw;
        c.stroke(path);
      }
      c.restore();
    }
  });
  // виды «по-старому»: квадратом поверх
  for (let y = y0; y < y0 + CH && y < h; y++)
    for (let x = x0; x < x0 + CH && x < w; x++) {
      const k = kinds[y][x];
      if (k.z === undefined && k.draw && !k.anim) k.draw(c, x * T, y * T, x, y, env);
    }
  sc.call('paintGround', c, env, x0, y0, x0 + CH - 1, y0 + CH - 1);
}

/**
 * Земля всей карты одним рисунком — для мини-карты: те же слои с плавными краями, но без мелочей.
 * ctx — в координатах мира (масштаб задаёт вызывающий: ctx.scale(k / T, k / T)).
 */
export function paintGroundMap(ctx, sc, env) {
  const m = sc.map,
    kinds = m.kinds,
    w = m.w,
    h = m.h;
  const levels = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kinds[y][x];
      if (k.z !== undefined && !levels.some((l) => l.z === k.z)) levels.push({ z: k.z, kind: k });
    }
  levels.sort((a, b) => a.z - b.z);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w * T, h * T);
  ctx.clip();
  ctx.lineJoin = 'round';
  levels.forEach((lv, li) => {
    const k = lv.kind,
      e = k.edge || {};
    ctx.fillStyle = typeof k.fill === 'function' ? k.fill(env, ctx) : k.fill;
    if (li === 0) {
      ctx.fillRect(0, 0, w * T, h * T);
      return;
    }
    const path = regionPath(
      layerInside(m, lv.z),
      -1,
      -1,
      w + 1,
      h + 1,
      e.r === undefined ? T / 2 : e.r,
      e.wob || 0,
      Math.round(lv.z * 10),
    );
    // на карте линии края делаем заметнее: обводки в 1,6 раза толще
    for (const [col, lw] of e.out || []) {
      ctx.strokeStyle = typeof col === 'function' ? col(env) : col;
      ctx.lineWidth = lw * 1.6;
      ctx.stroke(path);
    }
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    for (const [col, lw] of e.in || []) {
      ctx.strokeStyle = typeof col === 'function' ? col(env) : col;
      ctx.lineWidth = lw * 1.6;
      ctx.stroke(path);
    }
    ctx.restore();
  });
  // виды «по-старому» — цветом для карты
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = kinds[y][x];
      if (k.z !== undefined) continue;
      const c = k.map;
      ctx.fillStyle = (typeof c === 'function' ? c(env) : c) || '#000';
      ctx.fillRect(x * T, y * T, T + 1, T + 1);
    }
  ctx.restore();
}

function buildChunk(sc, env, cx, cy, key, k) {
  const t0 = performance.now();
  const size = Math.round(CH * T * k);
  let c = pool.pop();
  if (!c || c.width !== size) {
    c = document.createElement('canvas');
    c.width = c.height = size;
  }
  const g = c.getContext('2d', { alpha: false });
  g.setTransform(k, 0, 0, k, -cx * CH * T * k, -cy * CH * T * k);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = sc.desc.bg || '#3fb0ea';
  g.fillRect(cx * CH * T, cy * CH * T, CH * T, CH * T);
  paintChunk(g, sc, env, cx, cy);
  const e = cache.add(key, { c, w: size, h: size, seen: frame });
  built++;
  buildMs += performance.now() - t0;
  return e;
}

const liveCells = new Map(); // вид → { cells: [], n }

/**
 * Нарисовать землю в кадр: куски из кэша (1:1, на целых пикселях), затем «живое» поверх.
 * (ox, oy) — сдвиг камеры в пикселях устройства, cw × chh — размер канвы, k — пикселей на единицу мира.
 * Вызывать, когда на ctx включены координаты мира (SP.begin); после вызова они включены снова.
 */
export function drawGround(ctx, sc, env, k, ox, oy, cw, chh) {
  const m = sc.map,
    tp = Math.round(T * k), // пикселей на клетку — целое
    cp = tp * CH;
  if (k !== cacheK) {
    clearGround();
    pool.length = 0;
    cacheK = k;
  }
  frame++;
  cache.tick();
  const ncx = Math.ceil(m.w / CH),
    ncy = Math.ceil(m.h / CH);
  const cx0 = Math.max(0, Math.floor(ox / cp)),
    cx1 = Math.min(ncx - 1, Math.floor((ox + cw - 1) / cp)),
    cy0 = Math.max(0, Math.floor(oy / cp)),
    cy1 = Math.min(ncy - 1, Math.floor((oy + chh - 1) / cp));
  const pre = `${m.id}:${env.season}:`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let fresh = 0;
  view = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
  for (let cy = cy0; cy <= cy1; cy++)
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = pre + cx + ':' + cy;
      let e = cache.peek(key);
      if (!e) {
        e = buildChunk(sc, env, cx, cy, key, k);
        fresh++;
        late++;
      }
      e.seen = frame;
      ctx.drawImage(e.c, cx * cp - ox, cy * cp - oy);
    }
  // заранее — один кусок из тех, что вот-вот покажутся (до края экрана меньше PRE_NEAR куска): сначала ближний,
  // по ходу движения камеры — раньше. Те, что за краем ближе KEEP_NEAR, держим; остальные выбрасываем ниже
  const mvx = lastCam ? ox - lastCam.ox : 0,
    mvy = lastCam ? oy - lastCam.oy : 0;
  let best = null,
    bs = 1e9;
  edge = 0;
  for (let cy = cy0 - 1; cy <= cy1 + 1; cy++)
    for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
      if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) continue;
      if (cx < 0 || cy < 0 || cx >= ncx || cy >= ncy) continue;
      // насколько кусок за краем экрана, px: столько камере ехать, пока он покажется
      const gap = Math.max(cx * cp - (ox + cw), ox - (cx + 1) * cp, cy * cp - (oy + chh), oy - (cy + 1) * cp, 0);
      if (gap >= cp * KEEP_NEAR) continue;
      const key = pre + cx + ':' + cy,
        e = cache.peek(key);
      if (e) {
        e.seen = frame;
        edge++;
        continue;
      }
      if (fresh || gap >= cp * PRE_NEAR) continue;
      // ближний — раньше; по ходу движения — ещё раньше
      const dx = cx < cx0 ? -1 : cx > cx1 ? 1 : 0,
        dy = cy < cy0 ? -1 : cy > cy1 ? 1 : 0;
      const s = gap / cp - (dx * Math.sign(mvx) + dy * Math.sign(mvy)) * 0.5;
      if (s < bs) {
        bs = s;
        best = [cx, cy, key];
      }
    }
  if (best) {
    buildChunk(sc, env, best[0], best[1], best[2], k);
    edge++;
  }
  lastCam = { ox, oy };
  // выбрасываем всё, что не на экране и не у самого его края (и куски других мест)
  let seen = 0;
  for (const e of cache.map.values()) if (e.seen === frame) seen++;
  if (cache.map.size > seen)
    for (const [key, e] of [...cache.map.entries()]) {
      if (e.seen === frame) continue;
      cache.drop(key);
      if (pool.length < 8) pool.push(e.c);
    }
  // «живое»: вода, грядки — по видам, одним вызовом на вид
  ctx.setTransform(k, 0, 0, k, -ox, -oy);
  const tx0 = Math.max(0, Math.floor(ox / tp)),
    tx1 = Math.min(m.w - 1, Math.floor((ox + cw) / tp)),
    ty0 = Math.max(0, Math.floor(oy / tp)),
    ty1 = Math.min(m.h - 1, Math.floor((oy + chh) / tp));
  for (const q of liveCells.values()) q.n = 0;
  for (let ty = ty0; ty <= ty1; ty++) {
    const row = m.kinds[ty];
    for (let tx = tx0; tx <= tx1; tx++) {
      const kind = row[tx];
      if (kind.live) {
        let q = liveCells.get(kind.live);
        if (!q) liveCells.set(kind.live, (q = { cells: [], n: 0, kind }));
        q.cells[q.n++] = tx;
        q.cells[q.n++] = ty;
      } else if (kind.anim && kind.draw) kind.draw(ctx, tx * T, ty * T, tx, ty, env);
    }
  }
  for (const q of liveCells.values()) if (q.n) q.kind.live(ctx, q.cells, q.n, env);
}

// ---------- берег: линия прибоя ----------
/**
 * Точки вдоль берега карты — для бегущей линии прибоя. Берег — граница между сушей (land(вид) → true) и водой
 * (water(вид) → true); остальное (мостки) — ни то ни другое, там линия прерывается.
 * Возвращает куски по клеткам CH×CH: Map «cx,cy» → [Float32Array [x, y, nx, ny, s, …], …], где (nx, ny) —
 * направление от берега в воду, s — расстояние вдоль берега.
 */
export function buildShore(m, land, water) {
  const w = m.w,
    h = m.h,
    kinds = m.kinds;
  const isLand = (x, y) => x >= 0 && y >= 0 && x < w && y < h && land(kinds[y][x]);
  // берег — только там, где за сушей вода (а не мостки): inside — суша, сосед должен быть водой
  const wet = (x, y) => x >= 0 && y >= 0 && x < w && y < h && water(kinds[y][x]);
  const inside = (x, y) => isLand(x, y);
  const out = new Map();
  // обходим так же, как край слоя, но собираем точки
  const W = w + 1;
  const next = new Map();
  const addEdge = (ax, ay, bx, by) => {
    const k = ay * W + ax,
      e = next.get(k);
    if (e) e.push(bx, by);
    else next.set(k, [bx, by]);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (wet(x, y - 1)) addEdge(x, y, x + 1, y);
      if (wet(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (wet(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (wet(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  const push = (piece, x, y, nx, ny, s) => piece.push(x, y, nx, ny, s);
  // сначала — незамкнутые линии берега от их начала (вершины, в которые ничего не приходит), потом петли
  const incoming = new Set();
  for (const list of next.values()) for (let i = 0; i < list.length; i += 2) incoming.add(list[i + 1] * W + list[i]);
  const order = [...next.keys()].filter((k) => !incoming.has(k)).concat([...next.keys()]);
  for (const k0 of order) {
    const list0 = next.get(k0);
    while (list0.length) {
      const sx = k0 % W,
        sy = Math.floor(k0 / W);
      const pts = [sx, sy];
      let cx = sx,
        cy = sy,
        nx = list0.shift(),
        ny = list0.shift(),
        dx = nx - cx,
        dy = ny - cy,
        closed = false;
      for (;;) {
        cx = nx;
        cy = ny;
        if (cx === sx && cy === sy) {
          closed = true;
          break;
        }
        pts.push(cx, cy);
        const o = next.get(cy * W + cx);
        if (!o || !o.length) break;
        let pick = 0;
        if (o.length > 2) {
          const lx = dy,
            ly = -dx;
          for (let i = 0; i < o.length; i += 2) if (o[i] - cx === lx && o[i + 1] - cy === ly) pick = i;
        }
        nx = o[pick];
        ny = o[pick + 1];
        o.splice(pick, 2);
        dx = nx - cx;
        dy = ny - cy;
      }
      const n = pts.length / 2;
      if (n < 2) continue;
      // точки: середины рёбер и скруглённые углы (как у края слоя с r = T/2)
      let piece = null,
        pkey = '',
        s = 0,
        lx = 0,
        ly = 0,
        first = true;
      const emit = (x, y, nx2, ny2) => {
        if (!first) s += Math.hypot(x - lx, y - ly);
        first = false;
        lx = x;
        ly = y;
        const key = Math.floor(x / (CH * T)) + ',' + Math.floor(y / (CH * T));
        if (key !== pkey) {
          if (piece) push(piece, x, y, nx2, ny2, s); // стык: точка есть в обоих кусках
          piece = [];
          pkey = key;
          let arr = out.get(key);
          if (!arr) out.set(key, (arr = []));
          arr.push(piece);
        }
        push(piece, x, y, nx2, ny2, s);
      };
      const cnt = closed ? n : n - 1;
      for (let i = 0; i < cnt; i++) {
        const ax = pts[i * 2],
          ay = pts[i * 2 + 1],
          bx = pts[((i + 1) % n) * 2],
          by = pts[((i + 1) % n) * 2 + 1],
          qx = pts[((i + 2) % n) * 2],
          qy = pts[((i + 2) % n) * 2 + 1];
        const ux = bx - ax,
          uy = by - ay,
          vx = qx - bx,
          vy = qy - by;
        // нормаль «в воду»: область справа по ходу, значит вода — слева: (uy, -ux)
        const mx = (ax + bx) * 0.5 * T,
          my = (ay + by) * 0.5 * T;
        emit(mx, my, uy, -ux);
        if ((ux !== vx || uy !== vy) && (closed || i < cnt - 1)) {
          // угол: точка на скруглении (середина кривой) с нормалью по биссектрисе
          const m2x = (bx + qx) * 0.5 * T,
            m2y = (by + qy) * 0.5 * T;
          const kx = 0.25 * mx + 0.5 * bx * T + 0.25 * m2x,
            ky = 0.25 * my + 0.5 * by * T + 0.25 * m2y;
          const bnx = uy + vy,
            bny = -ux - vx,
            bl = Math.hypot(bnx, bny) || 1;
          emit(kx, ky, bnx / bl, bny / bl);
        }
      }
      if (closed && piece) {
        // замкнуть петлю: первая точка ещё раз
        const ax = pts[0],
          ay = pts[1],
          bx = pts[2 % pts.length],
          by = pts[3 % pts.length];
        emit((ax + bx) * 0.5 * T, (ay + by) * 0.5 * T, by - ay, -(bx - ax));
      }
    }
  }
  const res = new Map();
  for (const [key, arr] of out)
    res.set(
      key,
      arr.filter((p) => p.length >= 10).map((p) => new Float32Array(p)),
    );
  return res;
}
