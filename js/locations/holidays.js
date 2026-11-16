// ПРАЗДНИКИ (П.13): УКРАШЕНИЯ ГОРОДА — «часть» локации города (parts в locations/town.js) и особые места праздников.
//
// Когда украшен город — data/holidays.js (decorOn: накануне, в праздник, у Нового года — и утром 1 января). Здесь —
// где что стоит и как рисуется. Рисунки — locations/holidays_art.js (кэш спрайтов: в кадре только копии картинок).
//   DECOR        что ставят к празднику: предметы (art, клетка, параметры рисунка), гирлянды между фонарями (strings:
//                стиль 'ny' — огоньки, 'cny' — красные фонарики, 'mas' — флажки), свечи в окнах и венки на дверях
//                домиков (houses), дракон (dragon), фейерверк ночью (fireworks), небесные фонарики ночью (skyLanterns)
//   BLOCK        клетки под крупными украшениями (ёлка, вертеп, карусель…): пока украшение стоит, туда не пройти —
//                у клетки свой вид «как площадь, но walk() → нет, пока праздник» (карта после постройки не меняется)
//   HOLIDAY_PLACES  особые места праздников (ёлка, вертеп, столик с фонариками, дракон, карусель, чучело, блины, канат):
//                город добавляет их к своим PLACES; они работают, только пока город украшен (when), действие —
//                holiday:<что> (features/holidays.js и features/holidays_winter.js)
// Крюки части: things (украшения в общем порядке «дальше → ближе»), over (фейерверк, небесные фонарики), lights (свет
// ночью), miniMap (значки праздника на карте), update (конверты Китайского Нового года — находки дня).
// Вторая часть П.13 (1 Мая, Иван Купала, Хеллоуин, день рождения хомячка) — строки в DECOR и BLOCK, места — в HOLIDAY_PLACES.
import { G, darkness } from '../core/state.js';
import { ell, emoji, line } from '../core/draw.js';
import { sfx } from '../core/audio.js';
import { seeded } from '../core/util.js';
import { HOLIDAY_BY_ID, HOLIDAY, decorOn, holidayOffset } from '../data/index.js';
import { T, SP, put, defineTiles, TILES } from '../engine/topdown/kinds.js';
import { houseGeom } from './common/buildings.js';
import { FIR_BULBS, FIR_SCALE, paintString } from './holidays_art.js';

const S = () => G.state;
/** Украшен ли город к празднику id сегодня. */
export const decorNow = (id) => !!S() && decorOn(HOLIDAY_BY_ID[id], S().day);
/** Сегодня сам праздник id (а не канун). */
export const holidayNowIs = (id) => !!S() && holidayOffset(HOLIDAY_BY_ID[id], S().day) === 0;
/** Сделан ли сегодня шаг праздника (отметки дня dayFlags.holiday — features/holidays.js). */
const stepDone = (id) => !!S() && !!(S().dayFlags.holiday || {})[id];

// ---------- где что стоит ----------
// Опоры гирлянд — фонари (клетки): вдоль Северной улицы и на рыночной площади. Верёвка крепится под колпаком фонаря.
const LAMP_TOP = -64;
const STRINGS = (() => {
  const north = [36, 42, 51, 60, 66, 72, 78, 84, 91],
    out = [];
  for (let i = 0; i + 1 < north.length; i++) out.push([north[i], 12, north[i + 1], 12]);
  out.push([42, 16, 52, 16], [52, 16, 61, 16], [48, 21, 55, 21]);
  return out.map(([ax, ay, bx, by], i) => {
    const x0 = (ax + 0.5) * T,
      y0 = (ay + 0.5) * T + LAMP_TOP,
      x1 = (bx + 0.5) * T,
      y1 = (by + 0.5) * T + LAMP_TOP;
    return { i, x0, y0, dx: x1 - x0, dy: y1 - y0, depth: Math.max(ay, by) * T + T * 0.5 + 1 };
  });
})();
// Домики жителей (свечи в окнах и венки на дверях на Рождество) — здания с полем npc; берутся из карты.
// Предметы праздника: [вид рисунка, x, y (точка основания в клетках), параметр рисунка]. Параметр-функция — считается
// каждый кадр (наряжена ли ёлка, кадр мигания).
const blink = (n, speed = 2) => Math.floor(G.time * speed) % n;
export const DECOR = {
  newyear: {
    things: [
      ['hFir', 44.5, 23, () => (stepDone('tree') || holidayOffset(HOLIDAY_BY_ID.newyear, S().day) > 0 ? 1 : 0), () => blink(3)],
      ['hSnowman', 47.5, 25, 0],
      ['hSnowman', 34.5, 33, 1],
      ['hSnowman', 11.5, 13, 2],
    ],
    strings: 'ny',
    fireworks: true,
  },
  xmas: {
    things: [['hCrib', 54, 23]],
    houses: true,
  },
  cny: {
    things: [['hLanternTable', 54.5, 23]],
    strings: 'cny',
    dragon: true,
    skyLanterns: true,
  },
  maslenitsa: {
    things: [
      ['hCarousel', 45, 23, () => Math.floor(G.time * 6) % 32],
      ['hEffigy', 53.5, 23],
      ['hBooth', 60, 25, 0],
    ],
    flat: [['hRope', 51.5, 24.6]],
    strings: 'mas',
  },
};
/** Клетки под крупными украшениями: [x, y, праздник]. */
const BLOCK = [
  [44, 22, 'newyear'],
  [47, 24, 'newyear'],
  [34, 32, 'newyear'],
  [11, 12, 'newyear'],
  [53, 22, 'xmas'],
  [54, 22, 'xmas'],
  [54, 22, 'cny'],
  [44, 21, 'maslenitsa'],
  [45, 21, 'maslenitsa'],
  [44, 22, 'maslenitsa'],
  [45, 22, 'maslenitsa'],
  [53, 22, 'maslenitsa'],
  [59, 24, 'maslenitsa'],
  [60, 24, 'maslenitsa'],
];
/** Особые места праздников (город добавляет их к своим PLACES). */
export const HOLIDAY_PLACES = [
  { id: 'nytree', at: [44, 22], hit: { dx: 80, up: 250, down: 24 }, stand: [44.5, 24.4], mark: [44.5, 20.6], reach: 1.8, when: () => decorNow('newyear'), act: 'holiday:tree' },
  { id: 'crib', at: [53.5, 22], hit: { dx: 66, up: 150, down: 24 }, stand: [54, 24.4], mark: [54, 21.6], reach: 1.8, when: () => decorNow('xmas'), act: 'holiday:crib' },
  { id: 'skylanterns', at: [54, 22], hit: { dx: 44, up: 90, down: 24 }, stand: [54.5, 24.2], mark: [54.5, 22.2], reach: 1.6, when: () => decorNow('cny'), act: 'holiday:lanterns' },
  { id: 'dragon', at: [45.5, 22.5], hit: { dx: 140, up: 70, down: 30 }, stand: [46, 24.6], mark: [46, 22.6], reach: 1.6, key: false, when: () => decorNow('cny'), act: 'holiday:dragon' },
  { id: 'carousel', at: [44.5, 22], hit: { dx: 74, up: 150, down: 24 }, stand: [45, 24.4], mark: [45, 21.4], reach: 1.8, when: () => decorNow('maslenitsa'), act: 'holiday:carousel' },
  { id: 'effigy', at: [53, 22], hit: { dx: 40, up: 120, down: 20 }, stand: [53.5, 24.2], reach: 1.4, key: false, when: () => decorNow('maslenitsa'), act: 'holiday:effigy' },
  { id: 'blini', at: [59.5, 24], hit: { dx: 60, up: 140, down: 20 }, stand: [59.5, 25.5], mark: [60, 23.4], reach: 1.6, when: () => decorNow('maslenitsa'), act: 'holiday:blini' },
  { id: 'tug', at: [51, 24], hit: { dx: 150, up: 34, down: 24 }, stand: [51.5, 25.4], mark: [51.5, 24.6], reach: 1.8, when: () => decorNow('maslenitsa'), act: 'holiday:tug' },
];

/**
 * Поставить на карту клетки под украшениями (зовёт build города в конце): клетка становится видом «как была, но
 * пройти нельзя, пока праздник украшает город». Вид клетки на земле тот же (like) — шва нет.
 */
export function blockHolidayCells(m) {
  const cells = new Map();
  for (const [x, y, id] of BLOCK) {
    const k = x + ',' + y;
    if (!cells.has(k)) cells.set(k, { x, y, ids: [] });
    cells.get(k).ids.push(id);
  }
  for (const { x, y, ids } of cells.values()) {
    const base = m.at(x, y),
      name = `${base}~hol:${ids.join('+')}`;
    if (!TILES[name]) defineTiles({ [name]: { like: base, holiday: ids, walk: () => !ids.some(decorNow) } });
    m.set(x, y, name);
  }
}

// ---------- конверты Китайского Нового года: находки дня ----------
/** Где сегодня лежат конверты (пять мест на улицах города, свои на каждый день). */
function envelopes(sc) {
  if (!holidayNowIs('cny')) return [];
  return sc.randomSpots('town', HOLIDAY.envelopes, S().day * 7 + 3).map((p, i) => ({
    id: 'env' + i,
    at: [p.x, p.y],
    icon: '🧧',
    text: `🧧 Красный конверт! Внутри — 🪙 ${HOLIDAY.envelope} на удачу`,
    act: 'holiday:envelope',
  }));
}

// ---------- фейерверк и небесные фонарики ----------
const BURST = 0.85; // новый залп — раз в столько секунд
const LIFE = 1.9; // сколько живёт один залп
const COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#fff'];
/** Залпы, видные сейчас: [{ x, y, k (0..1 — сколько прожил), c, n }] в единицах мира, вокруг камеры. */
function bursts(sc, t) {
  const out = [],
    cam = sc.cam,
    vw = G.view.w / cam.zoom,
    vh = G.view.h / cam.zoom,
    i0 = Math.floor((t - LIFE) / BURST) + 1,
    i1 = Math.floor(t / BURST);
  for (let i = i0; i <= i1; i++) {
    const r = seeded(i * 7919 + 13),
      k = (t - i * BURST) / LIFE;
    if (k < 0 || k > 1) continue;
    out.push({ i, x: cam.x + (r() - 0.5) * vw * 0.8, y: cam.y - vh * 0.22 + (r() - 0.5) * vh * 0.36, k, c: COLORS[Math.floor(r() * COLORS.length)], c2: COLORS[Math.floor(r() * COLORS.length)], n: 16 + Math.floor(r() * 8), s: (0.16 + r() * 0.1) * Math.min(vw, vh * 1.4) });
  }
  return out;
}
/** Залп: ракета взлетает (первые 25 %), потом звёздочки разлетаются и падают, гаснут. */
function drawBurst(ctx, b) {
  if (b.k < 0.25) {
    const q = b.k / 0.25,
      y = b.y + 140 * (1 - q);
    line(ctx, b.x, y, b.x, y + 26, 'rgba(255,230,160,.8)', 2.4);
    ell(ctx, b.x, y, 3, 3, '#fff');
    return;
  }
  const q = (b.k - 0.25) / 0.75,
    rad = b.s * (1 - (1 - q) * (1 - q)),
    fall = q * q * b.s * 0.3,
    a = 1 - q * q;
  ctx.save();
  if (q < 0.2) ell(ctx, b.x, b.y, b.s * 0.3 * (1 - q * 4), b.s * 0.3 * (1 - q * 4), 'rgba(255,250,220,.8)'); // вспышка
  ctx.globalAlpha = Math.max(0, a);
  // одним путём на кольцо: искры-чёрточки, потом головки искр (так залп — несколько команд рисования, а не сотня)
  for (const [ring, col, n] of [
    [1, b.c, b.n],
    [0.62, b.c2, Math.round(b.n * 0.7)],
  ]) {
    const r2 = rad * ring,
      heads = new Path2D(),
      trail = new Path2D();
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const ang = (j / n) * Math.PI * 2 + b.i + ring,
        cs = Math.cos(ang),
        sn = Math.sin(ang),
        x = b.x + cs * r2,
        y = b.y + sn * r2 * 0.85 + fall;
      ctx.moveTo(b.x + cs * r2 * 0.72, b.y + sn * r2 * 0.61 + fall * 0.8);
      ctx.lineTo(x, y);
      heads.moveTo(x + 4, y);
      heads.arc(x, y, 4, 0, 6.2832);
      const tx = b.x + cs * r2 * 0.55,
        ty = b.y + sn * r2 * 0.47 + fall * 0.6;
      trail.moveTo(tx + 2, ty);
      trail.arc(tx, ty, 2, 0, 6.2832);
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.fill(heads);
    ctx.fill(trail);
  }
  ctx.restore();
}
/** Фейерверк сейчас: в новогоднюю ночь, когда стемнело. */
const fireworksNow = () => holidayNowIs('newyear') && darkness() > 0.3;
/** Небесные фонарики над городом: вечером Китайского Нового года (больше, если хомячок свои запустила). */
const skyLanternsNow = () => holidayNowIs('cny') && darkness() > 0.25;
function floating(sc, t) {
  const cam = sc.cam,
    vw = G.view.w / cam.zoom,
    vh = G.view.h / cam.zoom,
    n = stepDone('lanterns') ? 9 : 5,
    out = [];
  for (let i = 0; i < n; i++) {
    const q = (t * 0.035 + i * 0.137) % 1;
    out.push({ x: cam.x + (((i * 0.383) % 1) - 0.5) * vw * 0.9 + Math.sin(t * 0.6 + i) * 18, y: cam.y + vh * 0.55 - q * vh * 1.2 });
  }
  return out;
}

// ---------- дракон ----------
/** Где сейчас кусочек дракона: s = 0 — голова, дальше — тело (по той же дорожке, с отставанием). */
function dragonAt(t, s) {
  const u = t * 0.55 - s * 0.24;
  return { x: 45.5 * T + Math.sin(u) * 95, y: 23.3 * T + Math.sin(u * 2) * 16, dir: Math.cos(u) >= 0 ? 1 : -1 };
}
const DRAGON_N = 6;

// ---------- часть локации ----------
export function createHolidayDecor() {
  let houses = [],
    envDay = -1;
  const inView = (x, y, v, pad = 160) => x > v.x0 - pad && x < v.x1 + pad && y > v.y0 - 40 && y < v.y1 + 240;
  const active = () => Object.keys(DECOR).filter(decorNow);
  /** Конверты — находки дня: раскладываем, когда сменился день (сон, загрузка, отладка). */
  const placeEnvelopes = (sc) => {
    if (!S() || S().day === envDay) return;
    envDay = S().day;
    sc.setPickups(envelopes(sc));
  };
  return {
    built(sc) {
      houses = sc.map.buildings.filter((b) => b.npc).map((b) => ({ b, g: houseGeom(b) }));
    },
    enter(sc) {
      envDay = -1;
      placeEnvelopes(sc);
    },
    update(sc) {
      placeEnvelopes(sc);
      fireworksSound();
    },
    things(sc, add, v) {
      for (const id of active()) {
        const d = DECOR[id];
        for (const [art, x, y, a, b] of d.things || []) {
          const px = x * T,
            py = y * T;
          if (!inView(px, py, v)) continue;
          add(py, () => put(art, px, py, typeof a === 'function' ? a() : a, typeof b === 'function' ? b() : b));
        }
        if (d.strings) {
          const frame = blink(2, 1.6);
          for (const s of STRINGS) {
            if (s.x0 + s.dx < v.x0 - 60 || s.x0 > v.x1 + 60 || s.y0 > v.y1 || s.y0 + 80 < v.y0) continue;
            const key = `hstr:${d.strings}:${s.i}:${d.strings === 'ny' ? frame : 0}`;
            add(s.depth, () => SP.put(key, [-12, -20, s.dx + 12, s.dy + 70], (c) => paintString(c, d.strings, s.dx, s.dy, frame), s.x0, s.y0), null, true);
          }
        }
        if (d.houses)
          for (const { b, g } of houses) {
            if (!inView(g.cx, g.bot, v, 220)) continue;
            add(g.bot + 1, () => {
              const f = blink(2, 3);
              put('hCandle', g.winL + 18, g.winY + 34, f);
              put('hCandle', g.winR + 18, g.winY + 34, 1 - f);
              put('hWreath', g.cx, g.bot - 46);
            });
          }
        if (d.dragon) {
          const t = G.time;
          for (let s = DRAGON_N; s >= 0; s--) {
            const p = dragonAt(t, s);
            if (!inView(p.x, p.y, v)) continue;
            const hop = Math.round(Math.abs(Math.sin(t * 5 + s)) * 5);
            if (s === 0) add(p.y, () => put('hDragonHead', p.x, p.y - hop, blink(2, 3), p.dir));
            else add(p.y, () => put('hDragonBody', p.x, p.y - hop, s === DRAGON_N ? 1 : 0, p.dir));
          }
        }
      }
    },
    /** Лежит на земле (канат) — под всем, что стоит. */
    ground(ctx, sc) {
      for (const id of active())
        for (const [art, x, y] of DECOR[id].flat || []) {
          put(art, x * T, y * T);
          SP.world();
        }
    },
    over(ctx, sc, t) {
      if (fireworksNow()) for (const b of bursts(sc, t)) drawBurst(ctx, b);
      if (skyLanternsNow()) {
        for (const p of floating(sc, t)) put('hSkyLantern', p.x, p.y);
        SP.world();
      }
    },
    /** Ночью украшения светятся: ёлка, гирлянды, свечи, вертеп, фонарики, фейерверк. */
    lights(sc, light) {
      const t = G.time,
        cx = sc.cam.x,
        cy = sc.cam.y,
        far = (x, y) => Math.abs(x - cx) > 1400 || Math.abs(y - cy) > 1000;
      for (const id of active()) {
        const d = DECOR[id];
        for (const [art, x, y] of d.things || []) {
          const px = x * T,
            py = y * T;
          if (far(px, py)) continue;
          if (art === 'hFir') {
            light(px, py - 120, 110, 160, 0.95);
            for (let i = 0; i < FIR_BULBS.length; i += 4) light(px + FIR_BULBS[i][0] * FIR_SCALE, py + FIR_BULBS[i][1] * FIR_SCALE, 22, 22, 0.5);
          } else if (art === 'hCrib') light(px, py - 70, 80, 90, 0.85);
          else if (art === 'hCarousel' || art === 'hBooth') light(px, py - 60, 90, 80, 0.8);
          else if (art === 'hLanternTable') light(px, py - 40, 60, 50, 0.7);
        }
        if (d.strings)
          for (const s of STRINGS) {
            const mx = s.x0 + s.dx / 2,
              my = s.y0 + s.dy / 2 + 26;
            if (far(mx, my)) continue;
            light(mx, my, Math.abs(s.dx) / 2 + 20, 46, 0.6);
          }
        if (d.houses)
          for (const { g } of houses) {
            if (far(g.cx, g.bot)) continue;
            light(g.winL + 18, g.winY + 26, 30, 30, 0.75);
            light(g.winR + 18, g.winY + 26, 30, 30, 0.75);
          }
        if (d.dragon) {
          const p = dragonAt(t, 2);
          if (!far(p.x, p.y)) light(p.x, p.y - 30, 150, 60, 0.6);
        }
      }
      if (fireworksNow())
        for (const b of bursts(sc, t)) {
          if (b.k < 0.25) light(b.x, b.y + 70, 30, 90, 0.5);
          else light(b.x, b.y + b.s * 0.15, b.s * 1.3, b.s * 1.2, 0.55 - (b.k - 0.25) * 0.4);
        }
      if (skyLanternsNow()) for (const p of floating(sc, t)) light(p.x, p.y, 34, 34, 0.9);
    },
    /** Цветное свечение фейерверка и небесных фонариков — поверх ночной темноты (маленький слой неба, режим lighter). */
    sky(c, sc, lw, lh) {
      const fw = fireworksNow(),
        sl = skyLanternsNow();
      if (!fw && !sl) return;
      const t = G.time,
        kx = (lw - 1) / G.view.w,
        ky = (lh - 1) / G.view.h,
        z = sc.cam.zoom;
      c.save();
      c.globalCompositeOperation = 'lighter';
      // точки одного залпа — одним путём (несколько команд на залп)
      const dots = (pts, r, col, a) => {
        c.globalAlpha = a;
        c.fillStyle = col;
        c.beginPath();
        const rr = Math.max(0.8, r * z * kx);
        for (const [x, y] of pts) {
          const p = sc.cam.toScreen(x, y);
          if (p.x < -20 || p.y < -20 || p.x > G.view.w + 20 || p.y > G.view.h + 20) continue;
          c.moveTo(p.x * kx + rr, p.y * ky);
          c.arc(p.x * kx, p.y * ky, rr, 0, 6.2832);
        }
        c.fill();
      };
      if (fw)
        for (const b of bursts(sc, t)) {
          if (b.k < 0.25) continue;
          const q = (b.k - 0.25) / 0.75,
            rad = b.s * (1 - (1 - q) * (1 - q)),
            fall = q * q * b.s * 0.3,
            a = Math.max(0, 1 - q * q) * 0.8;
          if (q < 0.2) dots([[b.x, b.y]], b.s * 0.4, '#fff3bf', 0.5 * (1 - q * 5));
          const pts = [];
          for (let j = 0; j < b.n; j++) {
            const ang = (j / b.n) * Math.PI * 2 + b.i + 1;
            pts.push([b.x + Math.cos(ang) * rad, b.y + Math.sin(ang) * rad * 0.85 + fall]);
          }
          dots(pts, 9, b.c, a);
        }
      if (sl) dots(floating(sc, t).map((p) => [p.x, p.y]), 16, '#ffa94d', 0.55);
      c.restore();
    },
    /** Значки праздника на карте. */
    miniMap(ctx, sc, k) {
      const icons = [];
      if (decorNow('newyear')) icons.push(['🎄', 44.5, 21.8]);
      if (decorNow('xmas')) icons.push(['🌟', 54, 21.8]);
      if (decorNow('cny')) icons.push(['🐉', 46, 22.8], ['🏮', 54.5, 22]);
      if (decorNow('maslenitsa')) icons.push(['🎠', 45, 22], ['🥞', 60, 24]);
      for (const [ic, x, y] of icons) {
        const size = Math.max(10, k * 2);
        ell(ctx, x * k, y * k, size * 0.72, size * 0.72, '#fff', '#4a3728', 1.1);
        emoji(ctx, ic, x * k, y * k, size);
      }
    },
  };
}

/** Каждый залп фейерверка — с хлопком (шаг логики, пока хомячок в городе). */
let lastBurst = -1;
function fireworksSound() {
  if (!fireworksNow()) return;
  const i = Math.floor(G.time / BURST);
  if (i !== lastBurst) {
    lastBurst = i;
    sfx('boom');
  }
}
/** Для тестов: что сейчас стоит в городе. */
export const debugDecor = (sc) => ({
  active: Object.keys(DECOR).filter(decorNow),
  fireworks: fireworksNow(),
  skyLanterns: skyLanternsNow(),
  bursts: sc ? bursts(sc, G.time).length : 0,
  // закрыта клетка украшения, которое сейчас стоит; stuck — закрытые клетки без украшения (их быть не должно)
  blocked: BLOCK.filter(([x, y, id]) => sc && decorNow(id) && !sc.map.foot(x, y)).map(([x, y, id]) => `${x},${y}:${id}`),
  stuck: BLOCK.filter(([x, y]) => sc && !BLOCK.some((q) => q[0] === x && q[1] === y && decorNow(q[2])) && !sc.map.foot(x, y)).map(([x, y]) => `${x},${y}`),
  envelopes: sc ? sc.pickups.filter((p) => p.id.startsWith('env') && sc.pickupThere(p)).length : 0,
});
