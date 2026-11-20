// Вид с Хомяк-Тауэра: панорама города слоями по удалённости.
//
// Башня стоит на Северной улице и смотрит на юг, на море. Поэтому всё, что на карте города восточнее, на панораме
// слева, а западное (вилла) — справа; чем южнее место, тем оно дальше и выше на картинке. Слоёв шесть:
//   небо · море с островами · пляж и набережная · дальние кварталы · площадь и Главная улица · крыши у башни.
// Каждый слой — отдельная картинка: площадка (interiors/tower.js) при ходьбе сдвигает их с разной скоростью
// (par — доля от сдвига самой площадки), а подзорная труба (features/panorama.js) складывает в одну. Слои рисуются
// от дальнего к ближнему, так что пальмы набережной никогда не окажутся поверх домов, которые ближе к зрителю.
// Дальние слои подёрнуты дымкой (haze): они светлее и голубее — так видна высота.
//
// Единицы панорамы: высота всегда VIEW_H (0 — верх неба, VIEW_H — пол площадки), ширина слоя L — сколько попросят.
// Город берётся из таблицы VIEW_TOWN и списков ниже — это клетки карты из locations/town.js (слой «интерьеры»
// не может импортировать «локации», поэтому таблица своя; автотест сверяет её со зданиями города).
// Перепланировали город — поправь таблицу, и панорама перерисуется сама.
import { clamp, TAU } from '../core/util.js';
import { ell, fillRR, line, poly, mix, shade } from '../core/draw.js';
import { G, darkness } from '../core/state.js';
import { holidayOn } from '../data/index.js';
import { sfx } from '../core/audio.js';

export const VIEW_H = 600;
const HZ = 152, // линия горизонта
  SHORE = 236, // кромка воды
  MW = 96, // ширина карты города в клетках
  OUT = '#4a3728',
  NIGHT = '#232a5c';

// my — какие ряды карты попадают в слой, Y — куда они ложатся на панораме (ближний ряд ниже), clip — докуда
// слой дорисовывает то, что тянется дальше (пирс), cs — наибольшая ширина клетки, hu — высота «этажа».
export const VIEW_LAYERS = [
  { id: 'sky', par: 0.03, y0: 0, y1: 160, live: true },
  { id: 'sea', par: 0.08, y0: 146, y1: 244, live: true },
  { id: 'beach', par: 0.15, y0: 188, y1: 276, haze: 0.3, my: [48, 57], Y: [272, 236], clip: [48, 63], cs: 11, hu: 5 },
  { id: 'far', par: 0.25, y0: 232, y1: 364, haze: 0.22, my: [28, 48], Y: [360, 268], clip: [28, 48], cs: 12, hu: 6 },
  { id: 'mid', par: 0.37, y0: 306, y1: 448, haze: 0.11, my: [16, 28], Y: [444, 352], clip: [16, 28], cs: 14, hu: 8.5 },
  { id: 'near', par: 0.52, y0: 368, y1: 600, haze: 0, my: [0, 16], Y: [566, 438], clip: [-2, 16], cs: 16, hu: 10 },
];

// ---------- город в клетках карты ----------
// Здания: id, x, y, ширина, глубина, стена, крыша, высота в «этажах», вид крыши.
// Сама башня в списке есть (для сверки с картой), но не рисуется: мы на ней стоим.
export const VIEW_TOWN = [
  ['villa', 11, 4, 10, 5, '#fff3d6', '#f76e5c', 2.6, 'hip'],
  ['salon', 32, 9, 4, 4, '#ffc9de', '#e64980', 2, 'hip'],
  ['boutique', 38, 9, 4, 4, '#e5dbff', '#845ef7', 2, 'hip'],
  ['mall_fashion', 44, 7, 7, 6, '#ffe066', '#f59f00', 2.6, 'flat'],
  ['mall_home', 53, 7, 7, 6, '#a5d8ff', '#1c7ed6', 2.6, 'flat'],
  ['fashion', 67, 9, 4, 4, '#f783ac', '#e64980', 6.2, 'flat'],
  ['tower', 73, 9, 4, 4, '#74c0fc', '#1c7ed6', 0, 'flat'],
  ['bank', 79, 9, 4, 4, '#ffd43b', '#f08c00', 5.4, 'flat'],
  ['realtor', 86, 9, 5, 4, '#d8f5a2', '#5c940d', 2, 'hip'],
  ['mall_food', 33, 18, 7, 6, '#b2f2bb', '#2f9e44', 2.8, 'flat'],
  ['market', 44, 17, 7, 3, '#ffe8cc', '#e8590c', 1.3, 'awning'],
  ['cafe', 56, 17, 4, 4, '#ffdeeb', '#d6336c', 2, 'hip'],
  ['hospital', 67, 18, 7, 6, '#ffffff', '#fa5252', 3.6, 'flat'],
  ['school', 77, 18, 7, 6, '#ffd8a8', '#e8590c', 3.2, 'hip'],
  ['shelter', 88, 17, 4, 4, '#fff3d6', '#ff922b', 2, 'hip'], // приют «Тёплые лапки» (этап 17б)
  ['home_apartment', 53, 31, 6, 5, '#ffe3e3', '#c92a2a', 6, 'flat'],
  ['rest', 51, 41, 7, 5, '#ffec99', '#c92a2a', 2.4, 'hip'],
  ['pool', 67, 30, 5, 5, '#99e9f2', '#0c8599', 2.4, 'flat'],
  ['hotel', 83, 42, 11, 5, '#fff4e6', '#1098ad', 5, 'hip'], // курортный отель (П.17): пять этажей, горка с крыши
  ['beachcafe', 67, 50, 5, 3, '#c3fae8', '#12b886', 1.6, 'hip'],
  ['home_bungalow', 6, 50, 5, 3, '#ffe8cc', '#e0a458', 1.5, 'hip'],
  ['house5', 4, 30, 4, 4, '#d3f9d8', '#2f9e44', 1.7, 'hip'],
  ['house0', 12, 31, 4, 4, '#ffe8cc', '#e8590c', 1.7, 'hip'],
  ['house4', 21, 30, 4, 4, '#f1e0c5', '#8d5524', 1.7, 'hip'],
  ['house7', 5, 40, 4, 4, '#fff0f6', '#f06595', 1.7, 'hip'],
  ['house3', 18, 41, 4, 4, '#ffdeeb', '#c2255c', 1.7, 'hip'],
  ['house2', 87, 30, 4, 4, '#e9ecef', '#495057', 1.7, 'hip'],
  ['house6', 67, 40, 4, 4, '#c5f6fa', '#0b7285', 1.7, 'hip'],
  ['house1', 75, 41, 4, 4, '#d0ebff', '#1971c2', 1.7, 'hip'],
];
// Прямоугольники — по краям клеток: [x0, y0, x1, y1]. Дороги за край карты уходят в пустыню (восток) и вдоль берега.
const ROADS = [
  [28, 14, 94, 16], // Северная улица
  [1, 26, 150, 28], // Главная улица и дорога каравана
  [29, 14, 31, 50], // Западный проспект
  [63, 14, 65, 50], // Морской проспект — к пирсу
  [-60, 48, 150, 50], // набережная
];
const PAVED = [
  [42, 16, 62, 26], // рыночная площадь
  [31, 13, 92, 14], // тротуар перед магазинами
  [33, 24, 40, 26],
  [67, 24, 74, 26],
  [77, 24, 84, 26],
  [83, 47, 94, 48],
  [51, 46, 60, 48], // терраса ресторана
  [73, 29, 84, 37], // плитка у городского бассейна
  [5, 15, 15, 24], // и у бассейна виллы
];
const PATHS = [
  [15, 9, 17, 26], // двор виллы
  [15, 14, 29, 16],
  [1, -2, 3, 26], // тропа в лес
  [3, 36, 10, 37], // Садовая улочка
  [9, 37, 18, 38],
  [17, 36, 29, 37],
  [12, 38, 13, 48],
  [40, 28, 41, 33], // парк
  [40, 44, 41, 48],
  [31, 38, 34, 39],
  [47, 38, 63, 39],
  [65, 37, 89, 38], // улочка за бассейном
];
const POOLS = [
  [6, 16, 14, 23],
  [74, 30, 83, 36],
];
const PONDS = [
  [22.5, 19.5, 3.2, 2.6], // во дворе виллы
  [40.5, 38.5, 4.1, 2.9], // в парке
];
const YARD = [4, 3, 27, 24],
  PARK = [32, 29, 50, 47],
  PARK_RING = [40.5, 38.5, 6.6, 5.6];
const BEDS = [20, 10, 24, 13];
const LAMPS = [
  ...[36, 42, 51, 60, 66, 72, 78, 84, 91].map((x) => [x, 12.5]),
  ...[8, 20, 34, 41, 48, 55, 66, 76, 85].map((x) => [x, 25.6]),
  ...[6, 14, 22, 36, 44, 52, 60, 70, 78, 86, 94].map((x) => [x, 48.2]),
  ...[
    [39, 30],
    [33, 37],
    [47, 39],
    [41, 45],
    [10, 38],
    [18, 38],
    [27, 37],
    [52, 37],
    [61, 39],
    [70, 37],
    [80, 37],
  ],
  ...[
    [14, 10],
    [17, 23],
    [48, 21],
    [55, 21],
  ],
];
// Острова: x, y, размеры, что на них (p — пальмы, v — вулкан, i — льды, l — маяк, V — удалённый остров с вулканом
// у самого горизонта, далеко за краем карты моря — П.9); ещё айсберги и линия буйков.
const ISLES = [
  [29, 68, 3.6, 2.3, 'p'],
  [62, 73, 4.6, 2.8, 'ppp'],
  [85, 67, 2.4, 1.7, 'p'],
  [12, 78, 3.4, 2.5, 'pp'],
  [44, 83, 5.2, 2.9, 'pp'],
  [80, 82, 1.9, 1.5, 'p'],
  [48, 105, 7.2, 4.2, 'v'],
  [16, 108, 4.4, 2.8, 'i'],
  [81, 103, 3.2, 2.3, 'l'],
  [34, 190, 9, 3, 'V'],
];
const ICEBERGS = [
  [8, 102],
  [27, 113],
  [4, 114],
  [32, 99],
];
const BUOY_Y = 89;

// ---------- цвета по сезону и времени суток ----------
export function viewSky(season, d) {
  return {
    top: mix(
      { winter: '#8cc6ee', spring: '#6ec3ff', summer: '#4db5ff', autumn: '#9fbfd6' }[season],
      '#12123a',
      d * 0.94,
    ),
    bot: mix(
      { winter: '#e9f4fb', spring: '#dff3ff', summer: '#d2f0ff', autumn: '#ffe6c2' }[season],
      '#3b2f6b',
      d * 0.9,
    ),
  };
}
/**
 * Всё, от чего зависит вид слоёв: сезон и темнота (0 — день, 1 — ночь; округляется до восьмых, чтобы слои
 * перерисовывались не каждый кадр, а несколько раз за вечер). key — ключ для кэша.
 */
export function viewEnv(season, darkness) {
  const d = Math.round(clamp(darkness, 0, 1) * 8) / 8;
  const c = (col, k = 0.55) => (d ? mix(col, NIGHT, d * k) : col);
  const leaf = {
    winter: ['#f4f9fc', '#dfeaf2'],
    spring: ['#8ce99a', '#69db7c', '#ffc9de'],
    summer: ['#40c057', '#37b24d', '#51cf66'],
    autumn: ['#f08c00', '#e8590c', '#fcc419'],
  }[season];
  return {
    key: season + ':' + d,
    season,
    d,
    c,
    snow: season === 'winter',
    lit: d > 0.35,
    sky: viewSky(season, d),
    haze: mix('#d6ecff', '#1a2152', d * 0.92),
    out: c(OUT, 0.3),
    shadow: `rgba(30,40,90,${0.16 + d * 0.1})`,
    glass: d > 0.35 ? '#3b4a6b' : 'rgba(255,255,255,.8)',
    grass: c({ winter: '#f1f7fb', spring: '#a8e67a', summer: '#86db5c', autumn: '#cdd36a' }[season], 0.62),
    lawn: c({ winter: '#f8fbfd', spring: '#bdee8f', summer: '#9ee272', autumn: '#dcdc7e' }[season], 0.62),
    sand: c(season === 'winter' ? '#f3ead2' : '#ffe9a8', 0.6),
    road: c('#e6d6b8', 0.6),
    pave: c('#f5ecdc', 0.6),
    path: c(season === 'winter' ? '#ece2c8' : '#f3dc9c', 0.6),
    water: c('#58c6f2', 0.5),
    pond: c(season === 'winter' ? '#d9f1ff' : '#5db6dc', 0.5),
    leaf: leaf.map((q) => c(q, 0.5)),
    fir: c(season === 'winter' ? '#8fbfa5' : '#2b8a3e', 0.5),
    palm: c(season === 'winter' ? '#a9d8b8' : '#2f9e44', 0.5),
    trunk: c('#a8703f', 0.5),
  };
}

/** Облачко. s — размер, a — прозрачность. */
export function cloud(ctx, x, y, s, a = 1) {
  ctx.globalAlpha = a;
  ell(ctx, x, y, 46 * s, 17 * s, '#fff');
  ell(ctx, x - 26 * s, y + 4 * s, 26 * s, 13 * s, '#fff');
  ell(ctx, x + 24 * s, y - 9 * s, 28 * s, 16 * s, '#fff');
  ell(ctx, x + 40 * s, y + 5 * s, 22 * s, 11 * s, '#fff');
  ctx.globalAlpha = 1;
}

// «Случайное» число 0..1 по клетке: одна и та же клетка всегда даёт одно и то же (деревья не прыгают).
function hash(x, y, n = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(n, 362437)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- карта → панорама ----------
function proj(l, L, zoomX) {
  const cs = Math.min((L / MW) * zoomX, l.cs),
    ky = (l.Y[1] - l.Y[0]) / (l.my[1] - l.my[0]);
  return {
    L,
    cs, // ширина клетки
    vy: -ky, // её «глубина» на картинке
    hu: l.hu,
    lw: clamp(l.hu / 9, 0.5, 1.15),
    X: (x) => L / 2 + (MW / 2 - x) * cs,
    Y: (y) => l.Y[0] + (y - l.my[0]) * ky,
  };
}
/** Залить прямоугольник карты (с обрезкой по рядам слоя). */
function zone(ctx, P, l, col, [x0, y0, x1, y1], r = 0) {
  y0 = Math.max(y0, l.clip[0]);
  y1 = Math.min(y1, l.clip[1]);
  if (y0 >= y1) return;
  const x = P.X(x1),
    y = P.Y(y1),
    w = P.X(x0) - x,
    h = P.Y(y0) - y;
  if (r) fillRR(ctx, x, y, w, h, Math.min(r, h / 2), col);
  else {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  }
}

// ---------- кирпичики ----------
function windows(ctx, env, x0, yb, w, H, P, seed) {
  const ws = P.hu * 0.36,
    gx = ws * 2.2,
    gy = P.hu * 0.95;
  const cols = Math.max(1, Math.floor((w - ws) / gx)),
    rows = Math.max(1, Math.floor((H - ws * 0.5) / gy));
  const xs = x0 + (w - (cols - 1) * gx - ws) / 2,
    ys = yb - H + (H - (rows - 1) * gy - ws * 1.15) / 2;
  ctx.fillStyle = env.glass;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const wx = xs + c * gx,
        wy = ys + r * gy;
      if (env.lit && hash(seed + c, r, 7) < 0.64) env.lights.push(['w', wx, wy, ws, ws * 1.15]);
      else ctx.fillRect(wx, wy, ws, ws * 1.15);
    }
}
/** Дом с высоты: «пятно» крыши, поднятое на высоту стен, и под ним — стена, что смотрит на башню. */
function building(ctx, env, P, b) {
  const [id, bx, by, bw, bh, wallC, roofC, fl, style] = b;
  const x0 = P.X(bx + bw) + P.cs * 0.12,
    w = bw * P.cs - P.cs * 0.24,
    x1 = x0 + w,
    yb = P.Y(by),
    H = fl * P.hu,
    rh = bh * P.vy, // глубина крыши
    ry = yb - H - rh,
    e = P.cs * 0.1,
    lw = P.lw,
    out = env.out;
  const wall = env.c(wallC),
    roof = env.snow ? env.c('#ffffff', 0.4) : env.c(roofC),
    trim = env.c(roofC);
  ctx.fillStyle = env.shadow;
  ctx.fillRect(x0 + 1.5, yb - 1, w + H * 0.14, 3.2);
  fillRR(ctx, x0, yb - H, w, H, 1, wall, out, lw);
  windows(ctx, env, x0, yb, w, H, P, bx * 31 + by);
  fillRR(ctx, x0 - e, ry, w + 2 * e, rh, 1.6, roof, out, lw);
  if (style === 'hip') {
    // скатная крыша: ближний скат темнее, по коньку — светлая линия
    const q = Math.min(rh * 0.5, w * 0.3);
    poly(
      ctx,
      [x0 - e, ry + rh, x1 + e, ry + rh, x1 + e - q, ry + rh / 2, x0 - e + q, ry + rh / 2],
      env.snow ? env.c('#dfeaf2', 0.4) : env.c(shade(roofC, -0.13)),
    );
    line(ctx, x0 - e + q, ry + rh / 2, x1 + e - q, ry + rh / 2, 'rgba(255,255,255,.55)', lw);
  } else if (style === 'awning') {
    // рынок: полосатые навесы прилавков
    const n = Math.max(4, Math.round(w / (P.cs * 0.7)));
    for (let i = 0; i < n; i += 2) {
      ctx.fillStyle = env.c('#fff9f0');
      ctx.fillRect(x0 - e + ((w + 2 * e) * i) / n, ry + 0.6, (w + 2 * e) / n, rh - 1.2);
    }
  } else {
    // плоская крыша с бортиком
    fillRR(
      ctx,
      x0 + e,
      ry + e * 1.6,
      w - 2 * e,
      rh - e * 3.2,
      1,
      env.snow ? env.c('#eaf2f8', 0.4) : env.c(shade(roofC, 0.28)),
    );
  }
  if (env.snow) fillRR(ctx, x0 - e, ry, w + 2 * e, rh, 1.6, null, trim, lw * 1.5); // под снегом виден цвет крыши
  // приметы
  const cx = (x0 + x1) / 2,
    cy = ry + rh / 2,
    u = P.hu;
  if (id === 'hospital') {
    fillRR(ctx, cx - u * 0.9, cy - u * 0.9, u * 1.8, u * 1.8, u * 0.3, env.c('#ffffff'));
    ctx.fillStyle = env.c('#fa5252');
    ctx.fillRect(cx - u * 0.2, cy - u * 0.65, u * 0.4, u * 1.3);
    ctx.fillRect(cx - u * 0.65, cy - u * 0.2, u * 1.3, u * 0.4);
  } else if (id === 'bank') {
    ell(ctx, cx, cy, u * 0.95, u * 0.75, env.c('#fff3bf'), env.c('#e67700'), lw * 1.4);
    ell(ctx, cx, cy, u * 0.45, u * 0.35, env.c('#f59f00'));
  } else if (id === 'fashion') {
    for (const s of [-1, 1]) ell(ctx, cx + s * u * 0.36, cy - u * 0.12, u * 0.46, u * 0.4, env.c('#ffffff'));
    poly(ctx, [cx - u * 0.8, cy, cx + u * 0.8, cy, cx, cy + u * 0.85], env.c('#ffffff'));
  } else if (id === 'villa') {
    fillRR(ctx, x0 + w * 0.16, ry - u * 0.5, u * 0.7, u * 1.1, 1, env.c('#c98b5a'), out, lw); // труба
    fillRR(ctx, cx - u * 0.5, yb - u * 1.4, u, u * 1.4, 1, env.c('#8d5524'), out, lw);
  } else if (id === 'school') {
    line(ctx, x0 + u * 0.8, ry + rh * 0.4, x0 + u * 0.8, ry - u * 1.4, env.c('#868e96'), lw * 1.3);
    poly(ctx, [x0 + u * 0.8, ry - u * 1.4, x0 + u * 2.2, ry - u, x0 + u * 0.8, ry - u * 0.6], env.c('#ff6b9d'));
  } else if (id === 'hotel') {
    for (const s of [-0.3, 0, 0.3]) ell(ctx, cx + s * w, cy, u * 0.5, u * 0.42, env.c('#ffe066'));
    // водная горка-спираль у восточного крыла (башня смотрит на юг — восток слева)
    ctx.strokeStyle = env.c('#ffd43b');
    ctx.lineWidth = lw * 2.4;
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const q = k / 16,
        yy = ry + rh * 0.6 + q * (yb - ry - rh * 0.6),
        xx = x0 - u * 0.5 + Math.sin(q * Math.PI * 4) * u * 0.4;
      if (k) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  } else if (id.startsWith('mall') || id === 'pool' || id === 'home_apartment') {
    // коробочки вентиляции и окно в крыше
    fillRR(ctx, x0 + w * 0.14, cy - u * 0.5, u * 1.1, u * 0.8, 1, env.c('#f1f3f5'), out, lw * 0.8);
    fillRR(ctx, x1 - w * 0.14 - u * 1.6, cy - u * 0.35, u * 1.6, u, 1, env.c('#d0ebff'), out, lw * 0.8);
  }
  if (env.lit) env.lights.push(['g', cx, yb - 1, P.cs * 1.2]);
}
function plant(ctx, env, P, kind, x, y, v) {
  const X = P.X(x),
    Y = P.Y(y),
    s = P.hu / 10;
  if (kind === 'fir') {
    line(ctx, X, Y, X, Y - 6 * s, env.trunk, 2.4 * s);
    for (let i = 0; i < 3; i++)
      poly(
        ctx,
        [X - (11 - i * 3) * s, Y - (4 + i * 8) * s, X + (11 - i * 3) * s, Y - (4 + i * 8) * s, X, Y - (18 + i * 8) * s],
        env.fir,
      );
    if (env.snow) poly(ctx, [X - 4 * s, Y - 22 * s, X + 4 * s, Y - 22 * s, X, Y - 34 * s], env.c('#ffffff', 0.4));
  } else if (kind === 'palm') {
    line(ctx, X, Y, X + 2 * s, Y - 20 * s, env.trunk, 2.8 * s);
    for (let a = 0; a < 5; a++) {
      const an = -0.3 - a * 0.65;
      ell(
        ctx,
        X + 2 * s + Math.cos(an) * 9 * s,
        Y - 20 * s + Math.sin(an) * 6 * s,
        10 * s,
        3.2 * s,
        env.palm,
        null,
        1,
        an,
      );
    }
  } else if (kind === 'cactus') {
    fillRR(ctx, X - 2 * s, Y - 14 * s, 4 * s, 14 * s, 2 * s, env.c('#74b816', 0.5));
    fillRR(ctx, X - 7 * s, Y - 10 * s, 6 * s, 3 * s, 1.5 * s, env.c('#74b816', 0.5));
    fillRR(ctx, X + 2 * s, Y - 8 * s, 6 * s, 3 * s, 1.5 * s, env.c('#74b816', 0.5));
  } else {
    const col = env.leaf[v % env.leaf.length];
    ctx.fillStyle = env.shadow;
    ctx.fillRect(X - 5 * s, Y - 1, 12 * s, 2.4 * s);
    line(ctx, X, Y, X, Y - 10 * s, env.trunk, 2.6 * s);
    ell(ctx, X, Y - 16 * s, 10 * s, 9.5 * s, col);
    ell(ctx, X - 3 * s, Y - 19 * s, 4.5 * s, 3.6 * s, 'rgba(255,255,255,.22)');
  }
}
function umbrella(ctx, env, P, x, y, col) {
  const X = P.X(x),
    Y = P.Y(y),
    s = P.hu / 10;
  ell(ctx, X, Y - 5 * s, 8 * s, 4.6 * s, env.c(col), env.out, P.lw * 0.7);
  ell(ctx, X, Y - 5 * s, 2 * s, 1.2 * s, env.c('#ffffff'));
}

// ---------- слои города ----------
function blockedCells(l) {
  const set = new Set(),
    add = (x0, y0, x1, y1) => {
      for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) set.add(x + ',' + y);
    };
  for (const b of VIEW_TOWN) add(b[1] - 1, b[2] - 2, b[1] + b[3] + 1, b[2] + b[4] + 1);
  for (const a of [...ROADS, ...PAVED, ...PATHS, ...POOLS, BEDS]) add(a[0], a[1], a[2], a[3]);
  for (const [x, y, rx, ry] of PONDS) add(x - rx - 1, y - ry - 1, x + rx + 1, y + ry + 1);
  if (l.id === 'beach') add(-60, 51, 160, 63); // на песке у воды деревья не растут
  return set;
}
/** Деревья, пальмы, ели леса и кактусы пустыни — по клеткам, от которых они не зависят от ширины слоя. */
function greens(ctx, env, P, l, items) {
  const blocked = blockedCells(l),
    half = P.L / 2 / P.cs,
    xa = Math.floor(MW / 2 - half) - 1,
    xb = Math.ceil(MW / 2 + half) + 1;
  const inR = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
  for (let y = l.clip[0]; y < l.my[1]; y++)
    for (let x = xa; x <= xb; x++) {
      const q = hash(x, y, 1),
        beach = y >= 50;
      const wood = x < 0 || (x < 4 && y < 26 && x !== 1 && x !== 2), // лес за западным краем города
        desert = x >= MW;
      let kind = 'tree',
        dens = 0.08;
      if (desert) {
        kind = 'cactus';
        dens = beach || y >= 48 || y === 26 || y === 27 ? 0 : 0.06;
      } else if (wood) {
        kind = beach ? 'palm' : y >= 28 ? 'tree' : 'fir';
        dens = beach ? (y < 55 ? 0.12 : 0) : y >= 48 ? 0 : y >= 28 ? 0.4 : 0.7;
      } else if (blocked.has(x + ',' + y)) continue;
      else if (beach) {
        kind = 'palm';
        dens = y === 50 && x % 4 === 2 && (x < 62 || x > 65) ? 1 : 0; // пальмы вдоль набережной
      } else if (y < 3) dens = 0;
      else if (inR(x, y, PARK)) dens = 0.16;
      else if (inR(x, y, YARD)) dens = 0.06;
      else if (y < 7) dens = 0.2;
      else if (y >= 44) kind = q < 0.07 ? 'palm' : 'tree';
      if (q >= dens) continue;
      const px = x + 0.2 + hash(x, y, 2) * 0.6,
        py = y + 0.2 + hash(x, y, 3) * 0.6,
        v = Math.floor(hash(x, y, 4) * 3);
      items.push({ k: py, f: () => plant(ctx, env, P, kind, px, py, v) });
    }
}
/** Общее для слоёв с землёй: проекция и список «что нарисовать» (здания, огни фонарей, зелень) — от дальних к ближним. */
function parts(ctx, L, env, l, zoomX) {
  const P = proj(l, L, zoomX),
    items = [],
    inL = (y) => y >= l.clip[0] && y < l.clip[1];
  for (const b of VIEW_TOWN)
    if (b[2] >= l.my[0] && b[2] < l.my[1] && b[0] !== 'tower')
      items.push({ k: b[2], f: () => building(ctx, env, P, b) });
  if (env.lit) for (const [x, y] of LAMPS) if (inL(y)) env.lights.push(['g', P.X(x), P.Y(y) - P.hu * 0.6, P.cs * 1.5]);
  greens(ctx, env, P, l, items);
  return {
    P,
    inL,
    Z: (col, a, r) => zone(ctx, P, l, col, a, r),
    /** Примета в клетке (x, y): f(X, Y, s) нарисует её в свой черёд. */
    at: (x, y, f) => inL(y) && items.push({ k: y, f: () => f(P.X(x), P.Y(y), P.hu / 10) }),
    flush: () => items.sort((a, b) => b.k - a.k).forEach((i) => i.f()),
  };
}
function city(ctx, L, env, l, zoomX) {
  const { P, inL, Z, at, flush } = parts(ctx, L, env, l, zoomX),
    top = l.Y[1] - 4;
  ctx.fillStyle = env.grass;
  ctx.fillRect(-8, top, L + 16, l.y1 - top + 2);
  // восточная окраина (слева) — пески пустыни
  const xe = P.X(MW + 0.5);
  if (xe > 2) {
    ctx.fillStyle = env.sand;
    ctx.fillRect(-8, top, xe + 8, l.y1 - top + 2);
    for (let y = l.clip[0]; y < l.my[1]; y += 2)
      ell(ctx, xe, P.Y(y + 1), P.cs * (0.8 + hash(y, 5) * 0.9), P.vy * 1.3, env.sand);
    for (let i = 0; i < 6; i++) {
      const dx = xe * hash(i, 9, l.my[0]),
        dy = P.Y(l.my[0] + hash(i, 8, l.my[0]) * (l.my[1] - l.my[0]));
      ell(ctx, dx, dy, P.cs * 2.4, P.vy * 0.8, env.c('#ffd98a', 0.6));
      ell(ctx, dx - P.cs * 0.3, dy - P.vy * 0.25, P.cs * 1.9, P.vy * 0.5, env.sand);
    }
  }
  Z(env.lawn, YARD);
  Z(env.lawn, PARK, 4);
  for (const a of PAVED) Z(env.pave, a);
  for (const a of PATHS) Z(env.path, a);
  for (const a of ROADS) Z(env.road, a);
  if (l.id === 'mid') {
    // разметка Главной улицы
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let x = 2; x < 94; x += 3) ctx.fillRect(P.X(x + 1), P.Y(27) - 0.5, P.cs, 1);
  }
  // бассейны, пруды, грядки, кольцо дорожки в парке, заборчик двора
  for (const a of POOLS) {
    Z(env.c('#ffffff'), [a[0] - 0.3, a[1] - 0.3, a[2] + 0.3, a[3] + 0.3], 3);
    Z(env.water, a, 3);
    if (inL(a[1]))
      for (let i = 1; i < 4; i++)
        Z('rgba(255,255,255,.5)', [a[0] + 0.5, a[1] + i * 1.6, a[2] - 0.5, a[1] + i * 1.6 + 0.16]);
  }
  if (inL(PARK_RING[1])) {
    const [x, y, rx, ry] = PARK_RING;
    ell(ctx, P.X(x), P.Y(y), rx * P.cs, ry * P.vy, null, env.path, P.cs * 0.8);
  }
  for (const [x, y, rx, ry] of PONDS)
    if (inL(y)) {
      ell(ctx, P.X(x), P.Y(y), rx * P.cs, ry * P.vy, env.pond, env.c('#ffffff', 0.5), P.lw * 1.6);
      if (!env.snow)
        ell(ctx, P.X(x + rx * 0.3), P.Y(y + ry * 0.2), rx * P.cs * 0.3, ry * P.vy * 0.2, 'rgba(255,255,255,.45)');
    }
  if (inL(BEDS[1]))
    for (let i = 0; i < 4; i++)
      for (const y of [10, 12]) {
        Z(env.c('#8d5a3a'), [BEDS[0] + i + 0.1, y + 0.1, BEDS[0] + i + 0.9, y + 0.9], 1);
        if (!env.snow) ell(ctx, P.X(BEDS[0] + i + 0.5), P.Y(y + 0.5), P.cs * 0.22, P.vy * 0.22, env.leaf[0]);
      }
  const fence = env.c('#fff8e7');
  for (const a of [
    [YARD[0], YARD[1], YARD[2], YARD[1] + 0.22],
    [YARD[0], YARD[3] - 0.22, YARD[2], YARD[3]],
    [YARD[0], YARD[1], YARD[0] + 0.16, YARD[3]],
    [YARD[2] - 0.16, YARD[1], YARD[2], YARD[3]],
  ])
    Z(fence, a);
  if (l.id === 'near') Z(env.pave, [72, 8.5, 78, 14], 2); // площадка у подножия самой башни
  // приметы
  at(51.5, 22.5, (X, Y, s) => {
    // фонтан на площади
    ell(ctx, X, Y, P.cs * 1.5, P.vy * 1.05, env.c('#dee2e6'), env.out, P.lw);
    ell(ctx, X, Y, P.cs * 1.15, P.vy * 0.75, env.water);
    if (!env.snow) {
      line(ctx, X, Y, X, Y - 11 * s, 'rgba(255,255,255,.9)', 2.2 * s);
      for (const q of [-1, 1]) line(ctx, X, Y - 11 * s, X + q * 5 * s, Y - 4 * s, 'rgba(255,255,255,.8)', 1.4 * s);
    }
  });
  if (!env.snow)
    for (const [x, y, c] of [
      [57, 21.6, '#ff8787'],
      [58.6, 22.4, '#ffd43b'],
      [60, 21.4, '#74c0fc'],
      [59, 43.5, '#ff8787'],
      [60, 45.5, '#ffffff'],
      [52.5, 47.3, '#ff8787'],
      [57.5, 47.3, '#ffffff'],
      [13.5, 14.5, '#ff6b9d'],
    ])
      at(x, y, () => umbrella(ctx, env, P, x, y, c)); // столики кафе, ресторана и зонтик у бассейна виллы
  at(74.5, 24.8, (X, Y, s) => {
    // скорая у больницы
    fillRR(ctx, X - 7 * s, Y - 7 * s, 14 * s, 7 * s, 1.5 * s, env.c('#ffffff'), env.out, P.lw * 0.8);
    ctx.fillStyle = env.c('#fa5252');
    ctx.fillRect(X - 7 * s, Y - 4 * s, 14 * s, 1.6 * s);
  });
  at(89.5, 25.5, (X, Y, s) => {
    // остановка каравана
    fillRR(ctx, X - 9 * s, Y - 10 * s, 18 * s, 4 * s, 1.5 * s, env.c('#e8590c'), env.out, P.lw * 0.8);
    for (const q of [-7, 7]) line(ctx, X + q * s, Y - 6 * s, X + q * s, Y, env.c('#868e96'), 1.4 * s);
  });
  at(46.5, 31.5, (X, Y, s) => {
    // детская площадка: горка и песочница
    fillRR(ctx, X - 16 * s, Y - 4 * s, 9 * s, 5 * s, 1, env.c('#ffe066'), env.out, P.lw * 0.7);
    line(ctx, X + 2 * s, Y - 10 * s, X + 12 * s, Y, env.c('#fa5252'), 2.6 * s);
    line(ctx, X + 2 * s, Y - 10 * s, X + 2 * s, Y, env.c('#4dabf7'), 1.6 * s);
  });
  flush();
}
const PAINT = {
  sky(ctx, L, env) {
    const { top, bot } = env.sky,
      g = ctx.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(-8, 0, L + 16, HZ + 10);
    const sx = L * 0.68;
    if (env.d > 0.5) {
      ctx.fillStyle = '#fff';
      for (let i = 0, n = Math.round(L / 9); i < n; i++) {
        ctx.globalAlpha = (env.d - 0.5) * 2 * (0.35 + hash(i, 1, 11) * 0.65);
        ctx.fillRect(hash(i, 2, 11) * L, hash(i, 3, 11) * (HZ - 12), 1.8, 1.8);
      }
      ctx.globalAlpha = 1;
      ell(ctx, sx, 66, 24, 24, '#fff3bf');
      ell(ctx, sx + 10, 60, 20, 20, mix(top, bot, 60 / HZ));
    } else {
      ell(ctx, sx, 68, 42, 42, 'rgba(255,244,190,.3)');
      ell(ctx, sx, 68, 28, 28, mix(env.season === 'autumn' ? '#ffc078' : '#ffe066', '#ff922b', env.d * 1.2));
    }
    // дымка над горизонтом
    const hz = ctx.createLinearGradient(0, HZ - 46, 0, HZ + 4);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(1, `rgba(255,255,255,${0.5 * (1 - env.d)})`);
    ctx.fillStyle = hz;
    ctx.fillRect(-8, HZ - 46, L + 16, 56);
  },
  sea(ctx, L, env, l, zoomX) {
    const S = seaProj(L, zoomX),
      d = env.d;
    const g = ctx.createLinearGradient(0, HZ, 0, SHORE + 4);
    g.addColorStop(0, mix('#9fcdf0', '#1a2a66', d * 0.85)); // у горизонта море бледнее — воздух
    g.addColorStop(0.22, mix('#3f90d8', '#0f1f52', d * 0.8));
    g.addColorStop(0.6, mix('#2f86d6', '#122660', d * 0.8));
    g.addColorStop(1, mix('#63c8f2', '#1f3a78', d * 0.8));
    ctx.fillStyle = g;
    ctx.fillRect(-8, HZ - 2, L + 16, SHORE - HZ + 12);
    for (let i = 0, n = Math.round(L / 8); i < n; i++) {
      const k = hash(i, 1, 21) ** 1.5,
        x = hash(i, 2, 21) * L,
        y = HZ + 5 + k * (SHORE - HZ - 10);
      line(ctx, x, y, x + 4 + k * 15, y, `rgba(255,255,255,${0.25 + k * 0.3})`, 0.7 + k * 0.9);
    }
    // буйки: за ними открытое море
    for (let x = -30; x < MW + 30; x += 5) {
      const [X, Y, s] = S(x, BUOY_Y);
      ell(ctx, X, Y, s * 0.3, s * 0.24, mix(env.c('#fa5252'), env.haze, 0.3));
    }
    const far = (col, y) => mix(env.c(col), env.haze, clamp((y - 60) / 90, 0, 0.5)); // чем дальше, тем бледнее
    for (const [x, y] of ICEBERGS) {
      const [X, Y, s] = S(x, y);
      poly(
        ctx,
        [X - s * 2, Y, X - s * 0.6, Y - s * 3, X + s * 0.4, Y - s * 1.6, X + s * 1.2, Y - s * 2.6, X + s * 2.2, Y],
        far('#ffffff', y),
      );
      poly(ctx, [X - s * 0.6, Y - s * 3, X + s * 0.4, Y - s * 1.6, X, Y], far('#c5e4f7', y));
    }
    for (const [x, y, rx, ry, what] of ISLES.slice().sort((a, b) => b[1] - a[1])) {
      const [X, Y, s] = S(x, y),
        w = rx * s,
        h = Math.max(1.6, ry * s * 0.42);
      if (what === 'V') {
        // удалённый остров: дымчатый силуэт вулкана у горизонта и дымок (ночью — красная искорка)
        const hz = (col) => mix(env.c(col), env.haze, 0.55);
        poly(ctx, [X - w, Y + 1, X - w * 0.2, Y - s * 9, X + w * 0.12, Y - s * 9, X + w, Y + 1], hz('#7d6a5a'));
        for (let i = 0; i < 3; i++)
          ell(
            ctx,
            X + s * (1 + i * 1.6),
            Y - s * (11 + i * 2.6),
            s * (1.4 + i * 0.7),
            s * (1 + i * 0.4),
            `rgba(240,240,245,${0.5 - i * 0.12})`,
          );
        if (env.d > 0.4) ell(ctx, X - w * 0.04, Y - s * 9, s * 1.3, s * 0.8, 'rgba(255,110,60,.8)');
        continue;
      }
      ell(ctx, X, Y + h * 0.2, w * 1.25, h * 1.35, `rgba(255,255,255,${0.5 - d * 0.25})`);
      ell(ctx, X, Y, w, h, far(what === 'i' ? '#eef8ff' : env.season === 'winter' ? '#f3ead2' : '#ffe9a8', y));
      if (what === 'v') {
        poly(
          ctx,
          [X - w * 0.55, Y - h * 0.2, X - w * 0.12, Y - s * 6, X + w * 0.12, Y - s * 6, X + w * 0.6, Y - h * 0.2],
          far('#8d6e63', y),
        );
        poly(
          ctx,
          [X - w * 0.14, Y - s * 5.4, X - w * 0.12, Y - s * 6, X + w * 0.12, Y - s * 6, X + w * 0.16, Y - s * 5.2],
          far('#ff6b35', y),
        );
        for (const q of [-1, 1]) ell(ctx, X + q * w * 0.72, Y - h * 0.6, s * 0.9, s * 0.8, far('#2f9e44', y));
      } else if (what === 'i') {
        poly(
          ctx,
          [
            X - w * 0.7,
            Y,
            X - w * 0.3,
            Y - s * 3.4,
            X + w * 0.05,
            Y - s * 1.5,
            X + w * 0.4,
            Y - s * 2.8,
            X + w * 0.75,
            Y,
          ],
          far('#ffffff', y),
        );
        ell(ctx, X - w * 0.1, Y - h * 0.2, s * 0.9, s * 0.7, far('#d0ebff', y)); // иглу
      } else if (what === 'l') {
        poly(
          ctx,
          [X - s * 0.6, Y - h * 0.3, X - s * 0.4, Y - s * 5, X + s * 0.4, Y - s * 5, X + s * 0.6, Y - h * 0.3],
          far('#ffffff', y),
        );
        ctx.fillStyle = far('#fa5252', y);
        ctx.fillRect(X - s * 0.52, Y - s * 3.2, s * 1.04, s * 0.9);
        ctx.fillRect(X - s * 0.5, Y - s * 5.6, s, s * 0.7);
        if (env.lit) env.lights.push(['g', X, Y - s * 5.3, s * 4]);
      } else
        for (let i = 0; i < what.length; i++) {
          const px = X + (i - (what.length - 1) / 2) * w * 0.55,
            py = Y - h * 0.25,
            q = s * 0.4;
          line(ctx, px, py, px + q, py - q * 5, far('#a8703f', y), q * 0.75);
          for (let a = 0; a < 5; a++) {
            const an = -0.3 - a * 0.65;
            ell(
              ctx,
              px + q + Math.cos(an) * q * 2.6,
              py - q * 5 + Math.sin(an) * q * 1.8,
              q * 2.9,
              q,
              far(env.season === 'winter' ? '#a9d8b8' : '#2f9e44', y),
              null,
              1,
              an,
            );
          }
        }
    }
  },
  beach(ctx, L, env, l, zoomX) {
    // мелководье с пеной, песок, набережная
    const ys = SHORE;
    ctx.fillStyle = mix('#9be4f5', '#27478a', env.d * 0.8);
    ctx.fillRect(-8, ys - 7, L + 16, 9);
    ctx.fillStyle = env.sand;
    ctx.fillRect(-8, ys, L + 16, l.y1 - ys + 2);
    for (let x = -8; x < L + 16; x += 13) ell(ctx, x, ys - 0.5, 8.5, 1.9, `rgba(255,255,255,${0.9 - env.d * 0.4})`);
    const { P, Z, at, flush } = parts(ctx, L, env, l, zoomX);
    for (const a of ROADS) Z(env.road, a);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillRect(-8, P.Y(50) - 0.6, L + 16, 1.2); // бортик набережной
    // пирс с корабликом
    Z(env.c('#c98b5a'), [63, 50, 65, 62]);
    for (let y = 51; y < 62; y += 1.5) Z('rgba(74,55,40,.28)', [63, y, 65, y + 0.14]);
    at(66.4, 61, (X, Y, s) => {
      s *= 1.9;
      poly(
        ctx,
        [X - 9 * s, Y - 4 * s, X + 9 * s, Y - 4 * s, X + 6 * s, Y + 1 * s, X - 6 * s, Y + 1 * s],
        env.c('#a8703f'),
        env.out,
        P.lw * 0.8,
      );
      poly(ctx, [X, Y - 20 * s, X + 8 * s, Y - 6 * s, X, Y - 5 * s], env.c('#ffffff'), env.out, P.lw * 0.8);
      if (env.lit) env.lights.push(['g', X, Y - 6 * s, P.cs]);
    });
    at(56.5, 51.6, (X, Y, s) => {
      // вышка спасателя
      for (const q of [-4, 4]) line(ctx, X + q * s, Y, X + q * 0.6 * s, Y - 12 * s, env.c('#c98b5a'), 1.4 * s);
      fillRR(ctx, X - 6 * s, Y - 19 * s, 12 * s, 8 * s, 1, env.c('#ffffff'), env.out, P.lw * 0.7);
      ctx.fillStyle = env.c('#fa5252');
      ctx.fillRect(X - 7 * s, Y - 21 * s, 14 * s, 2.6 * s);
    });
    at(29.5, 54.5, (X, Y, s) => {
      // волейбольная сетка
      for (const q of [-9, 9]) line(ctx, X + q * s, Y, X + q * s, Y - 11 * s, env.c('#868e96'), 1.3 * s);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.fillRect(X - 9 * s, Y - 11 * s, 18 * s, 4 * s);
    });
    at(13.5, 51.4, (X, Y, s) => line(ctx, X - P.cs, Y - 8 * s, X + P.cs, Y - 8 * s, env.c('#ff8787'), 2 * s)); // гамак у бунгало
    if (!env.snow) {
      for (const x of [85, 88, 91, 94]) at(x, 52.5, () => umbrella(ctx, env, P, x, 52.5, '#3bc9db')); // пляж отеля
      for (let x = 2; x < MW - 14; x += 3) {
        if (hash(x, 4, 31) < 0.45 || (x > 60 && x < 73) || x < 16) continue;
        const y = 52 + hash(x, 5, 31) * 3;
        at(x, y, () => umbrella(ctx, env, P, x, y, ['#fa5252', '#4dabf7', '#ffd43b', '#f783ac'][x % 4]));
      }
      for (const [x, y] of [
        [73, 51.5],
        [66, 53.4],
      ])
        at(x, y, () => umbrella(ctx, env, P, x, y, '#ffffff'));
    }
    flush();
  },
  far: city,
  mid: city,
  near: city,
};
// Море: чем дальше от берега (ряд 57), тем ближе к горизонту и мельче. Возвращает [X, Y, размер клетки].
function seaProj(L, zoomX) {
  const cs0 = (L / MW) * zoomX,
    c = 26,
    size = clamp(cs0, 7, 12);
  return (x, y) => {
    const f = c / (y - 57 + c);
    return [L / 2 + (MW / 2 - x) * cs0 * f, HZ + (SHORE - HZ) * f, size * f];
  };
}

/**
 * Нарисовать слой в свою картинку. L — ширина слоя в единицах панорамы, k — пикселей картинки на единицу,
 * zoomX — сжать город по ширине (подзорная труба так показывает перспективу).
 * Возвращает { c — canvas, top — на сколько пикселей картинка ниже верха панорамы, L }.
 */
export function renderViewLayer(l, L, env, k, zoomX = 1) {
  const top = Math.floor(l.y0 * k),
    c = document.createElement('canvas');
  c.width = Math.ceil(L * k) + 1;
  c.height = Math.ceil(l.y1 * k) - top;
  const ctx = c.getContext('2d'),
    e = { ...env, lights: [] };
  ctx.setTransform(k, 0, 0, k, 0, -top);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  PAINT[l.id](ctx, L, e, l, zoomX);
  if (l.haze) {
    // воздушная дымка: красим только то, что нарисовано; дальний край слоя — сильнее
    const g = ctx.createLinearGradient(0, l.y0, 0, l.y1);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = l.haze * 1.3;
    g.addColorStop(0, e.haze);
    g.addColorStop(1, e.haze + '99');
    ctx.fillStyle = g;
    ctx.fillRect(-8, l.y0, L + 16, l.y1 - l.y0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  // огни поверх дымки: окна и пятна света от фонарей и дверей
  ctx.globalAlpha = 1 - (l.haze || 0) * 0.8;
  for (const q of e.lights)
    if (q[0] === 'w') {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(q[1], q[2], q[3], q[4]);
    } else {
      const g = ctx.createRadialGradient(q[1], q[2], 0, q[1], q[2], q[3]);
      g.addColorStop(0, 'rgba(255,236,153,.75)');
      g.addColorStop(0.25, 'rgba(255,224,102,.3)');
      g.addColorStop(1, 'rgba(255,224,102,0)');
      ctx.fillStyle = g;
      ctx.fillRect(q[1] - q[3], q[2] - q[3], q[3] * 2, q[3] * 2);
    }
  ctx.globalAlpha = 1;
  return { c, top, L };
}

/** Новогодняя ночь — над городом салют (как в самом городе: locations/holidays.js, Пр7). */
export function viewFireworks() {
  const s = G.state,
    h = s && holidayOn(s.day, s.startDay || 0);
  return !!h && h.id === 'newyear' && darkness() > 0.3;
}
const FW = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b'];
const FW_N = 4, // залпов одновременно (paintFireworks)
  FW_RATE = 0.42; // залпов в секунду у каждого
const popped = Array(FW_N).fill(-9);
/**
 * Хлопки салюта (В4): каждый залп paintFireworks раскрывается с тихим «бум» издалека. Зовут шаг площадки башни
 * (interiors/tower.js) и окно подзорной трубы «город» (features/panorama.js), t — то же время, что у картинки.
 */
export function fireworksPops(t) {
  if (!viewFireworks()) return;
  for (let i = 0; i < FW_N; i++) {
    const u = t * FW_RATE + i / FW_N,
      n = Math.floor(u);
    if (u - n < 0.2 || popped[i] === n) continue;
    if (n - popped[i] === 1) sfx('boomFar'); // после перерыва (ушла с площадки) — без пачки хлопков сразу
    popped[i] = n;
  }
}
/**
 * Салют с площадки башни и в подзорную трубу (Пр7, Пр22): залпы над городом у горизонта — шары искр раскрываются,
 * падают и гаснут; ракета-точка взлетает снизу. Залпы считаются от времени (без состояния), режим lighter.
 */
function paintFireworks(ctx, L, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < FW_N; i++) {
    const u = t * FW_RATE + i / FW_N,
      n = Math.floor(u),
      q = u % 1,
      seed = (n * 7 + i * 13) % 17,
      x = ((seed / 17) * 0.8 + 0.1) * L,
      y = 40 + ((seed * 5) % 9) * 8,
      col = FW[(n + i * 2) % FW.length];
    if (q < 0.2) {
      // ракета взлетает от крыш
      ell(ctx, x, HZ + 40 - (HZ + 40 - y) * (q / 0.2), 1.6, 3, '#fff3bf');
      continue;
    }
    const k = (q - 0.2) / 0.8,
      rad = 8 + k * 54,
      fall = k * k * 16;
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    if (k < 0.18) ell(ctx, x, y, 22, 22, 'rgba(255,243,191,.8)');
    ell(ctx, x, y + fall * 0.5, rad * 1.15, rad * 1.15, col + '33');
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let j = 0; j < 24; j++) {
      const a = (j / 24) * TAU + n,
        r = rad * (0.7 + (j % 3) * 0.15),
        px = x + Math.cos(a) * r,
        py = y + Math.sin(a) * r + fall,
        d = 2.8 - (j % 3) * 0.5;
      ctx.moveTo(px + d, py);
      ctx.arc(px, py, d, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (let j = 0; j < 24; j += 3) {
      const a = (j / 24) * TAU + n,
        px = x + Math.cos(a) * rad * 0.7,
        py = y + Math.sin(a) * rad * 0.7 + fall;
      ctx.moveTo(px + 1.2, py);
      ctx.arc(px, py, 1.2, 0, TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}
/** Что в слое шевелится (рисуется каждый кадр поверх картинки слоя): облака в небе, кораблики и кит в море; салют. */
export function paintViewLive(ctx, l, L, env, t, zoomX = 1) {
  if (l.id === 'sky') {
    if (viewFireworks()) paintFireworks(ctx, L, t);
    for (let i = 0; i < 6; i++)
      cloud(
        ctx,
        ((i * 0.23 + t * 0.006 * (1 + (i % 3) * 0.4)) % 1.2) * (L + 220) - 150,
        28 + (i % 3) * 34 + (i % 2) * 9,
        0.6 + (i % 2) * 0.35 + (i % 3) * 0.08,
        env.d > 0.5 ? 0.22 : 0.92,
      );
    return;
  }
  if (l.id !== 'sea') return;
  const S = seaProj(L, zoomX);
  const boat = (x, y, dir, sail) => {
    const [X, Y, s] = S(x, y),
      bob = Math.sin(t * 1.7 + x) * s * 0.12;
    ell(ctx, X - dir * s * 1.6, Y + s * 0.3, s * 1.8, s * 0.22, 'rgba(255,255,255,.5)'); // след на воде
    poly(
      ctx,
      [
        X - s * 1.5,
        Y - s * 0.5 + bob,
        X + s * 1.5,
        Y - s * 0.5 + bob,
        X + s,
        Y + s * 0.3 + bob,
        X - s,
        Y + s * 0.3 + bob,
      ],
      env.c('#a8703f'),
    );
    poly(ctx, [X, Y - s * 3.2 + bob, X + dir * s * 1.4, Y - s * 0.8 + bob, X, Y - s * 0.7 + bob], env.c(sail, 0.35));
  };
  boat(108 - ((t * 0.5) % 124), 97, 1, '#ffd8a8');
  boat(-12 + ((t * 0.8 + 40) % 124), 71, -1, '#ffffff');
  const wk = (t * 0.07) % 1;
  if (wk < 0.3) {
    // кит вдалеке пускает фонтан
    const [X, Y, s] = S(38, 93);
    ell(ctx, X, Y, s * 2.2, s * 0.7, env.c('#3b5b92'));
    for (let i = 0; i < 4; i++)
      ell(ctx, X + (i - 1.5) * s * 0.5, Y - s - ((t * 3 + i) % 2.2) * s, s * 0.28, s * 0.28, '#fff');
  }
}
