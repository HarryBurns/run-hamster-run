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
import { makeCanvas } from '../core/draw.js';
import { T, put, ART, addWorldPart } from '../engine/topdown/index.js';
import { sideArt } from '../engine/side/scene.js';
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
const pics = new Map();
let picsFor = '';
/** Картинка комнаты: гирлянда от x0 до x1 на высоте top + 18; at — где на полу украшение (в комнате с дверью). */
function roomPic(id, x0, x1, y, top, at) {
  const r = ROOM[id],
    { canvas, ctx } = makeCanvas(x1 - x0, y - top + 12);
  ctx.translate(-x0, -top);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(x0 + 14, top + 16);
  paintString(ctx, r.str, x1 - x0 - 28, 0, 0);
  ctx.restore();
  const art = ART[r.art];
  if (art && at) {
    ctx.save();
    ctx.translate(at, y - 2);
    ctx.scale(0.9, 0.9);
    art[1](ctx, r.a, r.b);
    ctx.restore();
  }
  return canvas;
}
sideArt.push((ctx, sc) => {
  if (!G.state || NO_DECOR.has(sc.name)) return;
  const id = Object.keys(ROOM).find(decorNow);
  if (!id) return;
  if (picsFor !== id) {
    pics.clear(); // праздник сменился — старые картинки не нужны
    picsFor = id;
  }
  const rooms = sc.desc.rooms || [],
    view = sc.view,
    door = sc.desc.door || { f: 0, x: 100 };
  rooms.forEach((rm, i) => {
    const y = sc.geo.fy(rm.f),
      top = y - sc.geo.RH;
    if (view && (y < view.y0 - 20 || top > view.y1 + 20)) return; // этаж не на экране
    const x0 = rm.x0 + 12,
      x1 = rm.x1 - 12;
    if (x1 - x0 < 160) return;
    // украшение на полу — только в комнате с дверью, справа от двери (у неё всегда есть свободный пол)
    const at = rm.f === door.f && door.x >= rm.x0 && door.x <= rm.x1 ? Math.min(x1 - 50, door.x + 120) : 0;
    const key = `${sc.name}:${i}`;
    let pic = pics.get(key);
    if (!pic) pics.set(key, (pic = roomPic(id, x0, x1, y, top, at)));
    ctx.drawImage(pic, x0, top, x1 - x0, y - top + 12);
  });
});
/** Для тестов: какой праздник украшает дома и сколько комнат уже нарисовано. */
export const debugRoomDecor = () => ({ holiday: picsFor, rooms: pics.size });
