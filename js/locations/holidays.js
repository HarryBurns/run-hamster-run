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
// Часть 2 П.13: 1 Мая (тележка с шариками, шарики, кадки с цветами, клумбы субботника — flat с отметкой «посажено»,
// флажки 'may'), Иван Купала (костёр на пляже — светит ночью, корзинка с венками, вёдра для водяной битвы, цветочные
// венки на дверях — houses: 'kup', гирлянда 'kup'), Хеллоуин (столик с тыквами, тыквы-фонарики — светят ночью,
// привидения в парке — ghosts, тыквы у дверей — houses: 'hal', гирлянда с летучими мышками и паутинкой 'hal'),
// день рождения (шарики у двери основного дома — bday; в самом доме — features/holidays_bday.js).
import { G, darkness } from '../core/state.js';
import { ell, emoji } from '../core/draw.js';
import { sfx } from '../core/audio.js';
import { seeded } from '../core/util.js';
import { HOLIDAY_BY_ID, HOLIDAY, HOME_BY_ID, decorOn, holidayOffset } from '../data/index.js';
import { T, SP, put, defineTiles, TILES } from '../engine/topdown/kinds.js';
import { houseGeom } from './common/buildings.js';
import { FIR_BULBS, FIR_SCALE, MAY_BEDS, STREAK_DIRS, paintString } from './holidays_art.js';

const S = () => G.state;
/** Украшен ли город к празднику id сегодня. */
export const decorNow = (id) => !!S() && decorOn(HOLIDAY_BY_ID[id], S().day);
/** Сегодня сам праздник id (а не канун). */
export const holidayNowIs = (id) => !!S() && holidayOffset(HOLIDAY_BY_ID[id], S().day) === 0;
/** Сделан ли сегодня шаг праздника (отметки дня dayFlags.holiday — features/holidays.js); who — у шагов «разные». */
const stepDone = (id, who) => {
  const v = !!S() && (S().dayFlags.holiday || {})[id];
  return who === undefined ? !!v : Array.isArray(v) && v.includes(who);
};

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
  mayday: {
    things: [
      ['hBalloonCart', 54.5, 23],
      ['hFlowerPot', 47.5, 25, 0],
      ['hFlowerPot', 49.5, 26, 1],
      ['hBalloons', 43.5, 25, 0],
      ['hBalloons', 53.3, 25, 1],
      ['hBalloons', 61.4, 24, 2],
      ['hBalloons', 13.6, 9.9, 1], // у двери виллы
      // таблички у клумб субботника: «Субботник» → «Готово!»
      ...MAY_BEDS.map(([x, y], i) => ['hMaySign', x + (i === 1 ? 1.25 : -1.15), y - 0.25, () => (stepDone('plant', i) ? 1 : 0)]), // в парке слева — урна
    ],
    // клумбы субботника: посадили цветы (шаг plant, «кто» — номер клумбы) — на клумбе цветы
    flat: MAY_BEDS.map(([x, y], i) => ['hMayBed', x, y, () => (stepDone('plant', i) ? 1 : 0)]),
    strings: 'may',
  },
  kupala: {
    things: [
      ['hBonfire', 49.5, 53, () => blink(4, 7)],
      ['hSplashStand', 53.5, 55],
      ['hFlowerBasket', 46.5, 56],
    ],
    strings: 'kup',
    houses: 'kup',
  },
  halloween: {
    things: [
      ['hPumpkinTable', 45.5, 23],
      ['hJack', 47.5, 25, () => blink(2, 3), 1],
      ['hJack', 53.6, 24.9, () => blink(2, 2.6), 0],
      ['hJack', 60.6, 23.9, () => blink(2, 3.4), 0],
      ['hJack', 14.4, 9.95, () => blink(2, 2.8), 0], // у двери виллы
      ['hJack', 17.6, 9.95, () => blink(2, 3.1), 0],
    ],
    // привидения из простыней: парят в парке (покачиваются — сдвигом спрайта, рисунок один на кадр мигания)
    ghosts: [
      [43.5, 32.4],
      [35.5, 36.6],
      [46.5, 40.5],
    ],
    strings: 'hal',
    houses: 'hal',
  },
  birthday: { bday: true },
};
/** Свет ночью у предметов праздника: вид рисунка → [dy, rx, ry, сила]. */
const GLOW = {
  hCrib: [-70, 80, 90, 0.85],
  hCarousel: [-60, 90, 80, 0.8],
  hBooth: [-60, 90, 80, 0.8],
  hLanternTable: [-40, 60, 50, 0.7],
  hBonfire: [-40, 190, 140, 1],
  hJack: [-22, 46, 40, 0.75],
  hPumpkinTable: [-40, 60, 50, 0.6],
  hBalloonCart: [-60, 60, 60, 0.35],
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
  [54, 22, 'mayday'], // тележка с шариками
  [47, 24, 'mayday'], // кадки с цветами
  [49, 25, 'mayday'],
  ...MAY_BEDS.flatMap(([x, y]) => [
    [Math.floor(x) - 1, Math.floor(y) - (y % 1 < 0.5 ? 1 : 0), 'mayday'],
    [Math.floor(x), Math.floor(y) - (y % 1 < 0.5 ? 1 : 0), 'mayday'],
  ]), // клумбы субботника
  [49, 52, 'kupala'], // костёр
  [53, 54, 'kupala'], // вёдра
  [46, 55, 'kupala'], // корзинка с венками
  [45, 22, 'halloween'], // столик с тыквами
  [47, 24, 'halloween'], // горка тыкв
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
  { id: 'balloons', at: [54, 22], hit: { dx: 66, up: 180, down: 24 }, stand: [54.5, 24.2], mark: [54.5, 21.2], reach: 1.6, when: () => decorNow('mayday'), act: 'holiday:parade' },
  ...MAY_BEDS.map(([x, y], i) => ({
    id: 'maybed' + i,
    at: [x - 0.5, y - 1],
    hit: { dx: 56, up: 40, down: 34 },
    stand: [x, i === 1 ? y - 1.4 : y + 1.1], // в парке — с дорожки над клумбой
    mark: [x, y - 1.2],
    reach: 1.4,
    when: () => decorNow('mayday'),
    act: { do: 'holiday', arg: 'plant', bed: i },
  })),
  { id: 'bonfire', at: [49, 52], hit: { dx: 50, up: 110, down: 20 }, stand: [49.5, 54.2], mark: [49.5, 51.2], reach: 1.5, when: () => decorNow('kupala'), act: 'holiday:bonfire' },
  { id: 'splash', at: [53, 54], hit: { dx: 56, up: 80, down: 20 }, stand: [53.5, 55.8], mark: [53.5, 53.6], reach: 1.6, when: () => decorNow('kupala'), act: 'holiday:splash' },
  { id: 'wreathfloat', at: [46, 55], hit: { dx: 44, up: 70, down: 20 }, stand: [47.6, 56.5], mark: [46.5, 54.8], reach: 1.6, when: () => decorNow('kupala'), act: 'holiday:wreath' },
  { id: 'pumpkins', at: [45, 22], hit: { dx: 50, up: 100, down: 24 }, stand: [45.5, 24.2], mark: [45.5, 21.6], reach: 1.6, when: () => decorNow('halloween'), act: 'holiday:pumpkins' },
  { id: 'ghost', at: [43, 31.5], hit: { r: 44 }, stand: [43.5, 33.4], reach: 1.4, key: false, when: () => decorNow('halloween'), act: 'holiday:ghost' },
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
// Салют: ракета взлетает снизу экрана, в верхней части экрана раскрывается «шар» из искр — искры разлетаются из точки
// во все стороны (разной скоростью — шар выглядит объёмным), тянут за собой хвостики, замедляются, падают и гаснут.
// Залпы разнесены по ширине экрана и по верхним двум пятым его высоты (номер залпа задаёт место — без состояния).
const BURST = 0.8; // новый залп — раз в столько секунд
const LIFE = 2.3; // сколько живёт один залп
const RISE = 0.22; // доля жизни — ракета взлетает
const COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#fff'];
/** Залпы, видные сейчас: [{ x, y, k (0..1 — сколько прожил), c, n, s, sp }] в единицах мира, в верхней части экрана. */
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
    // по ширине — полосами, чтобы соседние залпы не садились друг на друга
    const lane = (i * 3) % 5,
      x = cam.x + ((lane + 0.2 + r() * 0.6) / 5 - 0.5) * vw * 0.92,
      y = cam.y - vh / 2 + vh * (0.13 + r() * 0.2),
      ci = Math.floor(r() * 6),
      ci2 = (ci + 1 + Math.floor(r() * 5)) % 6;
    out.push({ i, x, y, k, ci, ci2, c: COLORS[ci], c2: COLORS[ci2], n: 22 + Math.floor(r() * 6), s: (0.12 + r() * 0.06) * Math.min(vw * 1.3, vh), y0: cam.y + vh / 2 });
  }
  return out;
}
/** Где искра j залпа b (q — 0..1 после раскрытия): скорость искры своя (объём шара), торможение, падение. */
function sparkAt(b, j, q) {
  const ang = (j / b.n) * Math.PI * 2 + b.i * 0.7,
    sp = 0.55 + (((j * 37 + b.i * 11) % 10) / 10) * 0.45, // 0,55..1
    rad = b.s * sp * (1 - (1 - q) * (1 - q) * (1 - q)),
    fall = q * q * b.s * 0.4;
  return [b.x + Math.cos(ang) * rad, b.y + Math.sin(ang) * rad + fall];
}
/** Направление полёта (номер повёрнутой картинки-чёрточки) из сдвига (dx, dy). */
const dirOf = (dx, dy) => (Math.round((Math.atan2(dy, dx) / (Math.PI * 2)) * STREAK_DIRS) + STREAK_DIRS) % STREAK_DIRS;
/** Залп: ракета-чёрточка взлетает снизу, потом шар искр-чёрточек разлетается из точки и падает, гаснет. */
function drawBurst(ctx, b) {
  if (b.k < RISE) {
    const q = b.k / RISE,
      y = b.y0 + (b.y - b.y0) * (1 - (1 - q) * (1 - q));
    put('hStreak', b.x, y, STREAK_DIRS * 0.75, 6); // летит вверх
    put('hSparkT', b.x, y + 26, 6);
    return;
  }
  // искры — готовые картинки из кэша спрайтов (повёрнутые чёрточки: копии, а не линии — растр почти не дорожает);
  // вспышка и свечение — в слое неба (крюк sky)
  const q = (b.k - RISE) / (1 - RISE);
  ctx.globalAlpha = Math.max(0, 1 - q * q * q);
  const qt = Math.max(0, q - 0.04);
  for (let j = 0; j < b.n; j++) {
    const ci = j % 3 ? b.ci : b.ci2;
    const [x, y] = sparkAt(b, j, q),
      [tx, ty] = sparkAt(b, j, qt);
    put('hStreak', x, y, dirOf(x - tx, y - ty), ci);
  }
  // в самом начале — белое ядро вспышки
  if (q < 0.12) put('hSpark', b.x, b.y, 6);
  ctx.globalAlpha = 1;
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

// ---------- день рождения: дверь основного дома ----------
/** Дверь основного дома в этой локации ({ x, y } — середина двери у фасада, мир) или null (дом — в другой локации). */
function bdayDoor(sc) {
  const home = HOME_BY_ID[S().homeMain] || HOME_BY_ID.villa,
    b = sc.map.bById[home.building];
  if (!b || (home.loc && home.loc !== sc.name) || (!home.loc && !sc.desc.home)) return null;
  return { x: sc.map.doorPx(b).x, y: (b.y + b.h) * T };
}

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
            if (d.houses === 'hal') {
              // тыква-фонарик у крыльца
              add(g.bot + 8, () => put('hJack', g.cx - 40, g.bot + 8, blink(2, 3), 0));
              continue;
            }
            add(g.bot + 1, () => {
              if (d.houses === 'kup') return void put('hDoorWreath', g.cx, g.bot - 50);
              const f = blink(2, 3);
              put('hCandle', g.winL + 18, g.winY + 34, f);
              put('hCandle', g.winR + 18, g.winY + 34, 1 - f);
              put('hWreath', g.cx, g.bot - 46);
            });
          }
        if (d.ghosts)
          d.ghosts.forEach(([x, y], i) => {
            const px = x * T,
              py = y * T;
            if (!inView(px, py, v)) return;
            const t = G.time,
              bob = Math.round(Math.sin(t * 1.6 + i * 2) * 6);
            add(py, () => put('hGhost', px + Math.round(Math.sin(t * 0.7 + i) * 8), py - 10 + bob, blink(2, 1.4 + i * 0.3)));
          });
        if (d.bday) {
          // шарики у двери основного дома (туда ведёт «Домой»), если его дверь — в этой локации
          const b = bdayDoor(sc);
          if (b && inView(b.x, b.y, v, 200))
            for (const [dx, k] of [
              [-58, 0],
              [58, 2],
            ])
              add(b.y + 4, () => put('hBalloons', b.x + dx, b.y + 4, k));
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
    /** Лежит на земле (канат, клумбы субботника) — под всем, что стоит. */
    ground(ctx, sc) {
      for (const id of active())
        for (const [art, x, y, a] of DECOR[id].flat || []) {
          put(art, x * T, y * T, typeof a === 'function' ? a() : a);
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
          } else if (GLOW[art]) {
            const [dy, rx, ry, a] = GLOW[art];
            // костёр дышит: пламя то выше, то ниже
            const k = art === 'hBonfire' ? 1 + Math.sin(t * 9) * 0.06 + Math.sin(t * 3.1) * 0.05 : 1;
            light(px, py + dy, rx * k, ry * k, a);
          }
        }
        if (d.houses === 'hal')
          for (const { g } of houses) if (!far(g.cx, g.bot)) light(g.cx - 40, g.bot - 6, 40, 34, 0.7);
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
          if (b.k < RISE) continue;
          const q = (b.k - RISE) / (1 - RISE);
          light(b.x, b.y + q * q * b.s * 0.4, b.s * 1.2, b.s * 1.1, 0.55 * (1 - q));
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
          if (b.k < RISE) continue;
          const q = (b.k - RISE) / (1 - RISE);
          if (q < 0.25) dots([[b.x, b.y]], b.s * 0.6, '#fff3bf', 0.7 * (1 - q * 4)); // вспышка в точке раскрытия
          dots([[b.x, b.y + q * q * b.s * 0.3]], b.s * 1.05, b.c, 0.22 * (1 - q)); // цветное зарево шара

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
      if (decorNow('mayday')) icons.push(['🎈', 54.5, 22], ...MAY_BEDS.map(([x, y], i) => [stepDone('plant', i) ? '🌷' : '🪏', x, y - 0.6]));
      if (decorNow('kupala')) icons.push(['🔥', 49.5, 52.4], ['💦', 53.5, 54.4], ['🌼', 46.5, 55.4]);
      if (decorNow('halloween')) icons.push(['🎃', 45.5, 22], ['👻', 43.5, 31.8]);
      if (decorNow('birthday')) {
        const b = bdayDoor(sc);
        if (b) icons.push(['🎂', b.x / T, b.y / T - 1]);
      }
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
  // день рождения: шарики у двери основного дома в этой локации
  bday: !!sc && decorNow('birthday') && !!bdayDoor(sc),
  // что из украшений светит ночью (виды рисунков) — когда темно
  glow: darkness() > 0.2 ? [...new Set(Object.keys(DECOR).filter(decorNow).flatMap((id) => (DECOR[id].things || []).map((q) => q[0]).filter((a) => GLOW[a] || a === 'hFir')))] : [],
});
/** Для тестов: залпы салюта сейчас — где раскрываются (доли экрана: left 0..1, top 0..1). */
export const debugFireworks = (sc) =>
  fireworksNow()
    ? bursts(sc, G.time).map((b) => {
        const p = sc.cam.toScreen(b.x, b.y);
        return { left: +(p.x / G.view.w).toFixed(2), top: +(p.y / G.view.h).toFixed(2), k: +b.k.toFixed(2) };
      })
    : [];
