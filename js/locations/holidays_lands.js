// ПРАЗДНИКИ (этап 15, Пр2): ПРАЗДНИК ВИДЕН И ЗА ГОРОДОМ, И В ДОМАХ. Город украшает своя часть (locations/holidays.js);
// здесь — то же для остальных мест:
//   • общая часть всех локаций (addWorldPart, кроме города): у входа в лес, на гору, в пустыню, в джунгли, на остров
//     и на секретный пляж ставят маленькие украшения праздника — ёлочку, рождественский столбик со звездой, столбик
//     с красными фонариками, чучело Масленицы, шарики и кадку с цветами, корзинку с венками, тыквы-фонарики.
//     Места — LANDS (клетки рядом с тем, куда приходит хомячок), набор по празднику — KIT. Рисунки — из кэша спрайтов
//     (locations/holidays_art.js), ночью светятся (крюк lights).
//   • дома — interiors/holidays_rooms.js (гирлянда под потолком и украшение у двери в каждой комнате).
// Когда — как в городе: накануне, в праздник (и утром 1 января), decorNow.
import { G } from '../core/state.js';
import { T, put, addWorldPart } from '../engine/topdown/index.js';
import { decorNow } from './holidays.js';

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
