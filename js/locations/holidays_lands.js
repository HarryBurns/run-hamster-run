// ПРАЗДНИКИ (этап 15, Пр2): ПРАЗДНИК ВИДЕН И ЗА ГОРОДОМ, И В ДОМАХ. Город украшает своя часть (locations/holidays.js);
// здесь — то же для остальных мест и для домов:
//   • общая часть всех локаций (addWorldPart, кроме города): у входа в лес, на гору, в пустыню, в джунгли, на остров
//     и на секретный пляж ставят маленькие украшения праздника — ёлочку, рождественский столбик со звездой, столбик
//     с красными фонариками, чучело Масленицы, шарики и кадку с цветами, корзинку с венками, тыквы-фонарики.
//     Места — LANDS (клетки рядом с тем, куда приходит хомячок), набор по празднику — KIT. Рисунки — из кэша спрайтов
//     (locations/holidays_art.js), ночью светятся (крюк lights).
//   • дома (общий рисунок домов sideArt движка домов): в каждой комнате вилла, купленного жилья, домиков жителей
//     и отеля — гирлянда праздника под потолком и украшение у стены. Рисуется один раз на комнату в свою картинку
//     (кэш на дом, комнату и праздник), в кадре — копия.
// Когда — как в городе: накануне, в праздник (и утром 1 января), decorNow.
import { G } from '../core/state.js';
import { FURN_BY_ID } from '../data/index.js';
import { makeCanvas } from '../core/draw.js';
import { T, put, ART, addWorldPart } from '../engine/topdown/index.js';
import { sideArt, sideArtFront } from '../engine/side/scene.js';
import { decorNow } from './holidays.js';
import { paintString } from './holidays_art.js';

const blink = (n, speed = 2) => Math.floor(G.time * speed) % n;
/** Места украшений в других локациях: имя сцены → [[x, y] в клетках] (у входа и у главной тропы). */
export const LANDS = {
  forest: [
    [6.5, 36.3],
    [18.5, 36.4],
  ],
  mountain: [
    [16.4, 40.6],
    [26.5, 40.4],
  ],
  island: [
    [13.5, 27.4],
    [19.5, 27.4],
  ],
  desert: [
    [16.5, 33.4],
    [24.5, 33.6],
  ],
  jungle: [
    [17.5, 33.4],
    [23.5, 33.5],
  ],
  cove: [
    [5.5, 8.4],
    [11.5, 7.5],
  ],
};
/**
 * Что ставят к празднику: [рисунок, сдвиг x, сдвиг y (клетки), параметр] — параметр-функция считается каждый кадр
 * (кадр мигания). glow — свет ночью: [dy, rx, ry, сила].
 */
export const KIT = {
  newyear: [['hFirMini', 0, 0, () => blink(3), [-50, 70, 80, 0.85]]],
  xmas: [['hXmasPost', 0, 0, () => blink(2, 3), [-92, 50, 50, 0.9]]],
  cny: [['hLanternPost', 0, 0, 0, [-66, 70, 50, 0.8]]],
  maslenitsa: [['hEffigy', 0, 0]],
  mayday: [
    ['hBalloons', -0.4, 0, 1],
    ['hFlowerPot', 0.7, 0.15, 0],
  ],
  kupala: [['hFlowerBasket', 0, 0]],
  halloween: [
    ['hJack', -0.45, 0, () => blink(2, 3), 1, [-22, 46, 40, 0.75]],
    ['hJack', 0.55, 0.15, () => blink(2, 2.6), 0, [-22, 46, 40, 0.75]],
  ],
};
const HOLS = Object.keys(KIT);
/** Какие праздники украшают места сегодня. */
const activeNow = () => (G.state ? HOLS.filter(decorNow) : []);
const val = (a) => (typeof a === 'function' ? a() : a);

// ---------- другие места ----------
addWorldPart({
  things(sc, add, v) {
    const spots = LANDS[sc.name];
    if (!spots) return;
    for (const id of activeNow())
      for (const [x, y] of spots)
        for (const [art, dx, dy, a, b] of KIT[id]) {
          const px = (x + dx) * T,
            py = (y + dy) * T;
          if (px < v.x0 - 160 || px > v.x1 + 160 || py < v.y0 - 40 || py > v.y1 + 240) continue;
          const bb = Array.isArray(b) ? undefined : b;
          add(py, () => put(art, px, py, val(a), val(bb)));
        }
  },
  lights(sc, light) {
    const spots = LANDS[sc.name];
    if (!spots) return;
    for (const id of activeNow())
      for (const [x, y] of spots)
        for (const q of KIT[id]) {
          const g = q.find((e) => Array.isArray(e));
          if (g) light((x + q[1]) * T, (y + q[2]) * T + g[0], g[1], g[2], g[3]);
        }
  },
});
/** Для тестов: что стоит в этой локации (рисунки). */
export const debugLandDecor = (sc) => (LANDS[sc.name] ? activeNow().flatMap((id) => KIT[id].map((q) => q[0])) : []);

// ---------- дома ----------
/** Гирлянда праздника под потолком и украшение у стены в комнатах. */
const ROOM = {
  newyear: { str: 'ny', art: 'hFirMini', a: 2 },
  xmas: { str: 'ny', art: 'hXmasPost', a: 1 },
  cny: { str: 'cny', art: 'hLanternPost' },
  maslenitsa: { str: 'mas', art: 'hFlowerPot', a: 1 },
  mayday: { str: 'may', art: 'hBalloons', a: 1 },
  kupala: { str: 'kup', art: 'hFlowerBasket' },
  halloween: { str: 'hal', art: 'hJack', a: 1, b: 1 },
};
/** Дома, где праздник не украшают: подводный грот, древние пирамида и храм. */
const NO_DECOR = new Set(['grotto_cave', 'pyramid_hall', 'temple_hall']);
// Картинки гирлянд — только для дома, где хомячок сейчас (на iPad картинка комнаты — до 2,5 МБ: «День гостей» в праздник
// обходит 8 домов), и только пока праздник: кончился или вышли в другой дом — кэш чистится.
const pics = new Map();
let picsFor = '', // праздник, для которого нарисованы картинки
  picsHouse = ''; // дом, для которого нарисованы картинки
/** Высота картинки гирлянды: нижний край подвесок — не ниже 76 (фонарики «cny», флажки и шарики «may»), и запас. */
const STRING_H = 96;
/** Картинка комнаты: гирлянда от x0 до x1 на высоте top + 16, высотой h. */
function roomPic(id, x0, x1, h) {
  const r = ROOM[id],
    { canvas, ctx } = makeCanvas(x1 - x0, h);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(14, 16);
  paintString(ctx, r.str, x1 - x0 - 28, 0, 0);
  return canvas;
}
/** Украшение у двери (праздник id) отдельной картинкой: { canvas, box } — box в единицах дома от точки на полу. */
let floorPic = null;
function floorArt(id) {
  if (floorPic && floorPic.id === id) return floorPic;
  const r = ROOM[id],
    art = ART[r.art];
  if (!art) return (floorPic = { id, canvas: null });
  const [l, t, rr, b] = art[0].map((v) => v * 0.9),
    { canvas, ctx } = makeCanvas(rr - l, b - t);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.translate(-l, -t);
  ctx.scale(0.9, 0.9);
  art[1](ctx, r.a, r.b);
  return (floorPic = { id, canvas, box: [l, t, rr - l, b - t], hw: Math.max(-l, rr) * 0.8 });
}
/**
 * Где на полу комнаты с дверью поставить украшение: ближе к двери (сначала справа, потом слева), где не стоят ни мебель,
 * ни встроенные предметы (дверь, плита, ванна…). Ковры и настенное не мешают. Места нет (гостиная виллы заставлена) —
 * справа от двери: украшение всё равно видно, оно рисуется перед мебелью (В3).
 */
function freeSpot(sc, rm, door, hw, x0, x1) {
  const busy = [];
  for (const it of sc.items() || []) {
    const d = FURN_BY_ID[it.id];
    if (d && it.floor === rm.f && !d.wall && d.layer !== 0) busy.push([it.x - d.w / 2, it.x + d.w / 2]);
  }
  for (const b of sc.fixtures || []) if (b.f === rm.f && b.w) busy.push([b.x - b.w / 2, b.x + b.w / 2]);
  const free = (x) => x - hw >= x0 && x + hw <= x1 && busy.every(([a, b]) => x + hw + 6 <= a || x - hw - 6 >= b);
  for (let dx = 70; dx < rm.x1 - rm.x0; dx += 10) {
    if (free(door.x + dx)) return door.x + dx;
    if (free(door.x - dx)) return door.x - dx;
  }
  return Math.min(x1 - hw, door.x + 90);
}
/** Праздник, который сейчас украшает этот дом, или ''. */
const roomHoliday = (sc) => (!G.state || NO_DECOR.has(sc.name) ? '' : Object.keys(ROOM).find(decorNow) || '');
// гирлянда — позади всего
sideArt.push((ctx, sc) => {
  const id = roomHoliday(sc);
  if (picsFor !== id || picsHouse !== sc.name) {
    pics.clear(); // праздник сменился (или кончился), или это другой дом — старые картинки не нужны
    picsFor = id;
    picsHouse = sc.name;
  }
  if (!id) return;
  const rooms = sc.desc.rooms || [],
    view = sc.view;
  rooms.forEach((rm, i) => {
    const y = sc.geo.fy(rm.f),
      top = y - sc.geo.RH;
    if (view && (y < view.y0 - 20 || top > view.y1 + 20)) return; // этаж не на экране
    const x0 = rm.x0 + 12,
      x1 = rm.x1 - 12;
    if (x1 - x0 < 160) return;
    const key = `${sc.name}:${i}`;
    let pic = pics.get(key);
    const h = Math.min(STRING_H, y - top + 12);
    if (!pic) pics.set(key, (pic = roomPic(id, x0, x1, h)));
    ctx.drawImage(pic, x0, top, x1 - x0, h);
  });
});
// украшение на полу у двери — перед мебелью, но за жильцами и хомячком (В3: раньше пряталось за торшером и диваном)
sideArtFront.push((ctx, sc) => {
  const id = roomHoliday(sc);
  if (!id) return;
  const door = sc.desc.door || { f: 0, x: 100 },
    rm = (sc.desc.rooms || []).find((q) => q.f === door.f && door.x >= q.x0 && door.x <= q.x1);
  if (!rm || rm.x1 - rm.x0 < 184) return;
  const pic = floorArt(id);
  if (!pic.canvas) return;
  const y = sc.geo.fy(rm.f),
    view = sc.view;
  if (view && (y < view.y0 - 20 || y - sc.geo.RH > view.y1 + 20)) return;
  const at = freeSpot(sc, rm, door, pic.hw, rm.x0 + 12, rm.x1 - 12),
    [l, t, w, h] = pic.box;
  sc.holidayDecorAt = at; // для тестов
  ctx.drawImage(pic.canvas, at + l, y - 2 + t, w, h);
});
/** Для тестов: какой праздник украшает дома и сколько комнат уже нарисовано. */
export const debugRoomDecor = () => ({ holiday: picsFor, rooms: pics.size });
