// УДАЛЁННЫЙ ОСТРОВ (П.9): рисунки клеток, предметов и зданий, которые есть только на острове. Где что стоит —
// locations/island.js. Всё неподвижное — в кэше спрайтов (art + put): вулкан — одна большая картинка (днём и ночью —
// два варианта параметром put), хижины — спрайты зданий. Шевелится только дымок над вулканом (четыре облачка поверх
// спрайта), огонёк на стекле у подножия и искры костра. Стиль — как у города, джунглей и пляжа (common/paint.js):
// контур OUT, объём в 2–3 тона, свет слева сверху, мягкая тень на земле.
//
// Клетки:  igrass — трава острова (светлая, с цветочками), iash — тёмная вулканическая земля у вулкана, itrail —
//          песчаная тропинка, iplaza — утоптанная площадь у костра (круг из камешков), ilane — дорожка для боулинга.
// Предметы: bigVolcano (вулкан: занимает девять клеток в ширину, три в глубину; ночью — лава светится; light — пятно
//          света ночью), obsidian (чёрное блестящее стекло у подножия: v — лежит ли сегодня кусочек), totem (резной
//          тотем, 3 варианта), pins (кегли-тотемчики в конце дорожки боулинга), iflowers (кусты плюмерии, гибискуса
//          и орхидей — 3 варианта), drum (большой барабан Бума).
// Рисунки: dancer — (кадры танцующих островитян рисует locations/island.js в кэш сам), coconut (кокос — для боулинга).
// Здания:  stiltHut (хижина на сваях под пальмовой крышей; b.v — цвет занавески, b.sign — табличка), chiefHut (большая
//          хижина вождя с резными столбами).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade, star } from '../core/draw.js';
import { T, OUT, SP, put, defineTiles, defineObjects, defineArt, defineBuildings } from '../engine/topdown/index.js';
import { shadow, signBoard, WOOD, WOOD_D, WOOD_L } from './common/paint.js';
import { geom, baseShadow, glow } from './common/buildings.js';
import './jungle_art.js'; // монстеры, геликонии, факелы, хижина причала, кораблик — общие с джунглями
import './forest_art.js'; // костёр, папоротник и замшелые камни — общие с лесом

export const GRASS = '#86c95a',
  GRASS_D = '#6fb24a',
  ASH = '#6e625b',
  ASH_D = '#574d47',
  TRAIL = '#e8d29e',
  PLAZA = '#d8b787',
  LANE = '#f1dfb0';
/** Цвета тотемов: [основной, лица, глаза]. */
const TOTEM_COLS = [
  ['#c98b5a', '#a0662d', '#ff922b'],
  ['#8d6e63', '#6d4c41', '#69db7c'],
  ['#d9a066', '#b07a3a', '#4dabf7'],
];

// ---------- клетки ----------
function grassDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(60,120,40,.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const gx = x + 6 + r(i) * 36,
      gy = y + 10 + r(i + 3) * 32;
    ctx.moveTo(gx - 3, gy);
    ctx.lineTo(gx - 1, gy - 6);
    ctx.moveTo(gx + 2, gy);
    ctx.lineTo(gx + 3, gy - 7);
  }
  ctx.stroke();
  if (r(8) < 0.2) {
    const fx = x + 8 + r(9) * 32,
      fy = y + 8 + r(10) * 32,
      col = ['#fff3bf', '#ff8fab', '#ffd43b'][Math.floor(r(11) * 3)];
    for (let k = 0; k < 5; k++) ell(ctx, fx + Math.cos(k * 1.257) * 2.6, fy + Math.sin(k * 1.257) * 2.6, 2, 2, col);
    ell(ctx, fx, fy, 1.3, 1.3, '#ffa94d');
  }
}
function ashDeco(ctx, x, y, tx, ty, env, r) {
  for (let i = 0; i < 4; i++) ell(ctx, x + r(i) * T, y + r(i + 5) * T, 2 + r(i + 9) * 2.4, 1.6 + r(i + 9) * 1.6, i % 2 ? 'rgba(40,34,30,.45)' : 'rgba(150,135,125,.35)');
  if (r(14) < 0.15) ell(ctx, x + 10 + r(15) * 28, y + 10 + r(16) * 28, 3, 2, 'rgba(120,180,90,.5)'); // травинка пробилась
}
function trailDeco(ctx, x, y, tx, ty, env, r) {
  for (let i = 0; i < 3; i++) ell(ctx, x + r(i) * T, y + r(i + 4) * T, 1.6, 1.2, 'rgba(160,120,70,.35)');
  if (r(9) < 0.3) ell(ctx, x + 8 + r(10) * 32, y + 8 + r(11) * 32, 5, 1.6, 'rgba(255,255,255,.35)');
}
function plazaDeco(ctx, x, y, tx, ty, env, r) {
  for (let i = 0; i < 2; i++) ell(ctx, x + r(i) * T, y + r(i + 4) * T, 2.2, 1.6, 'rgba(120,85,50,.3)');
  if (r(7) < 0.25) ell(ctx, x + 6 + r(8) * 36, y + 6 + r(9) * 36, 4, 3, 'rgba(200,190,175,.8)', 'rgba(90,70,50,.35)', 0.8); // камешек
}
function laneDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(160,120,60,.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const yy = y + 8 + k * 16 + r(k) * 4;
    ctx.moveTo(x, yy);
    ctx.lineTo(x + T, yy + r(k + 3) * 2);
  }
  ctx.stroke();
}
defineTiles({
  igrass: { map: GRASS, step: 'step', z: 4.33, fill: GRASS, edge: { wob: 8, in: [[GRASS_D, 7]] }, deco: grassDeco },
  iash: { map: ASH, step: 'stepStone', z: 4.47, fill: ASH, edge: { wob: 10, out: [['rgba(40,30,25,.25)', 8]], in: [[ASH_D, 10]] }, deco: ashDeco },
  itrail: { map: '#d9bf86', step: 'stepSand', z: 5.09, fill: TRAIL, edge: { wob: 7, out: [['rgba(120,90,40,.2)', 6]], in: [['rgba(255,250,230,.35)', 4]] }, deco: trailDeco },
  iplaza: { map: PLAZA, step: 'stepSand', z: 5.21, fill: PLAZA, edge: { wob: 5, out: [['rgba(110,80,45,.28)', 7]], in: [['rgba(255,240,210,.3)', 5]] }, deco: plazaDeco },
  ilane: { map: LANE, step: 'stepWood', z: 5.31, fill: LANE, edge: { wob: 1, out: [['rgba(110,70,30,.45)', 5]], in: [['rgba(255,255,255,.4)', 3]] }, deco: laneDeco },
});

// ---------- вулкан ----------
/** Вулкан: конус в зелени у подножия, кратер; lit — ночью лава светится ярче и стекает ручейками. */
function paintVolcano(ctx, lit) {
  shadow(ctx, 0, 6, 220, 28);
  // склоны: левый светлее (свет слева сверху), правый темнее
  ctx.beginPath();
  ctx.moveTo(-214, 14);
  ctx.quadraticCurveTo(-110, -60, -52, -246);
  ctx.lineTo(52, -246);
  ctx.quadraticCurveTo(110, -60, 214, 14);
  ctx.closePath();
  ctx.fillStyle = lit ? '#5d4a4a' : '#8a7568';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = lit ? '#473838' : '#6f5c52';
  ctx.beginPath();
  ctx.moveTo(10, -246);
  ctx.quadraticCurveTo(70, -60, 214, 14);
  ctx.lineTo(10, 14);
  ctx.closePath();
  ctx.fill();
  // светлые гребни-складки
  ctx.strokeStyle = lit ? 'rgba(160,130,120,.25)' : 'rgba(200,180,165,.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x0, x1] of [
    [-34, -120],
    [-14, -40],
    [22, 60],
    [40, 150],
  ]) {
    ctx.moveTo(x0, -236);
    ctx.quadraticCurveTo((x0 + x1) / 2 - 6, -120, x1, 6);
  }
  ctx.stroke();
  // ручейки застывшей лавы (ночью — светятся)
  ctx.lineCap = 'round';
  for (const [x0, x1, len] of [
    [-20, -46, 120],
    [14, 30, 90],
    [32, 70, 150],
  ]) {
    ctx.strokeStyle = lit ? '#ff6b35' : 'rgba(120,60,45,.7)';
    ctx.lineWidth = lit ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(x0, -244);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.3, -244 + len * 0.5, x1, -244 + len);
    ctx.stroke();
    if (lit) {
      ctx.strokeStyle = '#ffd43b';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }
  // зелень у подножия
  for (let i = 0; i < 11; i++) {
    const x = -196 + i * 39,
      y = -4 - (i % 3) * 8 - Math.max(0, 4 - Math.abs(i - 5)) * 4;
    ell(ctx, x, y, 30, 18, lit ? '#1f4a33' : i % 2 ? '#3f9e3a' : '#2f8a34', null);
    ell(ctx, x - 8, y - 6, 12, 6, lit ? 'rgba(80,120,90,.4)' : 'rgba(150,220,110,.55)');
  }
  ctx.restore();
  // контур склонов
  ctx.beginPath();
  ctx.moveTo(-214, 14);
  ctx.quadraticCurveTo(-110, -60, -52, -246);
  ctx.moveTo(52, -246);
  ctx.quadraticCurveTo(110, -60, 214, 14);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  // кратер: зубчатый край, внутри — лава
  ell(ctx, 0, -246, 56, 15, lit ? '#3a2b2b' : '#5c4a42', OUT, 2.6);
  ell(ctx, 0, -244, 42, 9, lit ? '#ff6b35' : '#b4502e', null);
  ell(ctx, -8, -246, 20, 4, lit ? '#ffd43b' : '#e8794a', null);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI,
      x = Math.cos(a) * 54,
      y = -246 + Math.sin(a) * 13;
    poly(ctx, [x - 6, y + 2, x, y - 6 - (i % 2) * 3, x + 6, y + 2], lit ? '#4a3a3a' : '#7d6a5c', OUT, 1.4);
  }
  if (lit) glow(ctx, 0, -246, 40, 0.5);
  // камни у подножия
  for (const [x, y, r] of [
    [-150, 6, 14],
    [120, 10, 12],
    [176, 2, 9],
  ]) {
    ell(ctx, x, y, r * 1.2, r * 0.8, lit ? '#4a3d3a' : '#7a6a60', OUT, 2);
    ell(ctx, x - r * 0.3, y - r * 0.3, r * 0.5, r * 0.25, 'rgba(255,255,255,.25)');
  }
}
/** Дымок над кратером: четыре облачка поднимаются и тают (точка кратера — x, y; единицы мира). */
export function drawVolcanoSmoke(ctx, x, y, t, dark) {
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.12 + i / 4) % 1,
      r = 14 + ph * 30,
      a = 0.7 * (1 - ph) * (1 - dark * 0.5);
    ctx.fillStyle = `rgba(${dark > 0.4 ? '170,150,160' : '236,236,240'},${a.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x + ph * 46 + Math.sin(t * 0.8 + i) * 6, y - ph * 150, r, r * 0.72, 0, 0, TAU);
    ctx.fill();
  }
}

// ---------- предметы ----------
/** Чёрное вулканическое стекло: острые блестящие камни; v — лежит ли сегодня кусочек (с бликом). */
function paintObsidian(ctx, v) {
  shadow(ctx, 4, 10, 30, 7);
  for (const [x, y, w, h, c] of [
    [-16, 6, 14, 26, '#2b2d33'],
    [2, 8, 18, 34, '#212329'],
    [18, 8, 12, 20, '#34363e'],
  ]) {
    poly(ctx, [x - w / 2, y, x - w * 0.2, y - h, x + w * 0.35, y - h * 0.7, x + w / 2, y], c, OUT, 1.8);
    line(ctx, x - w * 0.15, y - h * 0.85, x - w * 0.05, y - h * 0.2, 'rgba(160,170,255,.55)', 2);
  }
  if (v) {
    poly(ctx, [-26, 12, -22, 2, -16, 10], '#1b1c22', OUT, 1.4);
    ell(ctx, -22, 6, 1.6, 1.6, '#e7f5ff');
  }
}
/** Тотем: три лица друг на друге, сверху — крылья; v — расцветка. */
function paintTotem(ctx, v) {
  const [c, cd, eye] = TOTEM_COLS[v % 3];
  shadow(ctx, 6, 8, 22, 6);
  for (let i = 0; i < 3; i++) {
    const y = 6 - (i + 1) * 36;
    fillRR(ctx, -17, y, 34, 36, 7, i % 2 ? cd : c, OUT, 2);
    ell(ctx, -7, y + 13, 5, 4.5, '#fff', OUT, 1.2);
    ell(ctx, 7, y + 13, 5, 4.5, '#fff', OUT, 1.2);
    ell(ctx, -7, y + 13, 2.2, 2.2, eye);
    ell(ctx, 7, y + 13, 2.2, 2.2, eye);
    if (i === 1) fillRR(ctx, -9, y + 22, 18, 7, 3, '#fff', OUT, 1.2);
    else {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, y + 22, 7, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    line(ctx, -13, y + 4, -8, y + 4, 'rgba(255,255,255,.35)', 2.4);
  }
  for (const s of [-1, 1]) poly(ctx, [s * 16, -96, s * 34, -110, s * 30, -88, s * 16, -80], eye, OUT, 1.8);
  poly(ctx, [-12, -102, 0, -118, 12, -102], '#ffd43b', OUT, 1.8);
}
/** Кегли-тотемчики в конце дорожки боулинга: шесть маленьких тотемов треугольником (верхушкой к игроку — на запад). */
function paintPins(ctx) {
  shadow(ctx, 8, 14, 44, 12);
  const pins = [
    [-22, 4],
    [-4, -12],
    [-4, 20],
    [14, -26],
    [14, 4],
    [14, 34],
  ];
  pins.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of pins) {
    fillRR(ctx, x - 6, y - 26, 12, 26, 5, '#c98b5a', OUT, 1.6);
    ell(ctx, x - 2.5, y - 19, 1.8, 1.8, '#fff');
    ell(ctx, x + 2.5, y - 19, 1.8, 1.8, '#fff');
    line(ctx, x - 3, y - 12, x + 3, y - 12, OUT, 1.4);
    ell(ctx, x, y - 28, 5, 3, '#ff922b', OUT, 1.2);
  }
}
/** Кусты с цветами: плюмерия (белая с жёлтым), гибискус (красный), орхидеи (сиреневые). */
function paintIFlowers(ctx, v) {
  shadow(ctx, 3, 8, 22, 6);
  for (const [x, y, rx] of [
    [-12, -6, 14],
    [10, -8, 15],
    [0, -18, 14],
  ]) {
    ell(ctx, x, y, rx, rx * 0.7, '#2f8a34', OUT, 1.6);
    ell(ctx, x - 4, y - 3, rx * 0.5, rx * 0.3, '#51b860');
  }
  const [c, mid] = [
    ['#fff9db', '#ffd43b'],
    ['#ff6b6b', '#ffe066'],
    ['#da77f2', '#fff3bf'],
  ][v % 3];
  for (const [x, y] of [
    [-14, -12],
    [8, -16],
    [-2, -26],
    [14, -4],
    [-6, -2],
  ]) {
    for (let k = 0; k < 5; k++) ell(ctx, x + Math.cos(k * 1.257) * 3.6, y + Math.sin(k * 1.257) * 3.6, 3, 3, c, OUT, 0.8);
    ell(ctx, x, y, 1.8, 1.8, mid);
  }
}
/** Большой барабан Бума: деревянный бочонок с натянутой кожей и верёвочками. */
function paintDrum(ctx) {
  shadow(ctx, 4, 10, 22, 6);
  fillRR(ctx, -18, -36, 36, 44, 8, '#a0662d', OUT, 2);
  for (let x = -12; x <= 12; x += 6) line(ctx, x, -32, x + 3, 4, 'rgba(255,220,170,.45)', 1.4);
  ell(ctx, 0, -36, 18, 6, '#f3d9a4', OUT, 2);
  ell(ctx, -5, -37, 7, 2, 'rgba(255,255,255,.6)');
  for (let x = -14; x <= 14; x += 7) poly(ctx, [x - 3, 6, x, -2, x + 3, 6], '#ffd43b', OUT, 1);
}
/** Кокос (для боулинга и рисунков). */
export function paintCoconut(ctx, r = 10) {
  ell(ctx, 0, 0, r, r, '#8d5524', OUT, 1.8);
  ell(ctx, -r * 0.35, -r * 0.35, r * 0.35, r * 0.25, 'rgba(255,220,170,.45)');
  for (const [x, y] of [
    [-r * 0.25, -r * 0.05],
    [r * 0.2, -r * 0.1],
    [0, r * 0.3],
  ])
    ell(ctx, x, y, r * 0.11, r * 0.11, '#3b2412');
}
defineArt({ coconut: [[-14, -14, 14, 14], (ctx) => paintCoconut(ctx)] });

defineObjects({
  // вулкан: занимает три ряда клеток (внизу — девять в ширину, выше — уже); дымок рисуется поверх каждый кадр
  bigVolcano: {
    solid: [
      ...[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((dx) => [dx, 0]),
      ...[-3, -2, -1, 0, 1, 2, 3].map((dx) => [dx, -1]),
      ...[-2, -1, 0, 1, 2].map((dx) => [dx, -2]),
    ],
    map: () => '#7d6a5c',
    light: [0, -246, 240],
    art: { bigVolcano: [[-250, -300, 264, 48], paintVolcano] },
    draw(ctx, o, env) {
      const lit = env.dark > 0.35 ? 1 : 0;
      put('bigVolcano', o.x, o.y, lit);
      SP.world();
      drawVolcanoSmoke(ctx, o.x - 4, o.y - 262, env.t, env.dark);
    },
  },
  obsidian: {
    solid: true,
    map: () => '#2b2d33',
    art: { obsidian: [[-40, -48, 44, 24], paintObsidian] },
    draw(ctx, o, env) {
      const v = o.waits && o.waits() ? 1 : 0;
      put('obsidian', o.x, o.y, v);
      if (v) {
        SP.world();
        const ph = (env.t * 0.9) % 1;
        star(ctx, o.x - 22, o.y + 2 - ph * 4, 3 + Math.sin(env.t * 6) * 1.4, '#e7f5ff');
      }
    },
  },
  totem: {
    solid: true,
    map: () => '#a0662d',
    art: { totem: [[-38, -124, 38, 16], paintTotem] },
    draw: (ctx, o) => put('totem', o.x, o.y, (o.v || 0) % 3),
  },
  pins: {
    solid: true,
    art: { pins: [[-44, -66, 66, 56], paintPins] },
    draw: (ctx, o) => put('pins', o.x, o.y),
  },
  iflowers: {
    slow: 0.6,
    rustle: 'paper',
    art: { iflowers: [[-30, -36, 30, 16], paintIFlowers] },
    draw: (ctx, o) => put('iflowers', o.x, o.y, (o.v || 0) % 3),
  },
  drum: {
    solid: true,
    art: { drum: [[-26, -46, 28, 16], paintDrum] },
    draw: (ctx, o) => put('drum', o.x, o.y),
  },
});

// ---------- здания ----------
/** Хижина на сваях: настил на столбах, бамбуковые стены, крыша из пальмовых листьев, лесенка к двери. */
function paintStiltHut(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    floor = bot - 26,
    top = floor - 52,
    cur = ['#ff8787', '#74c0fc', '#ffd43b'][(b.v || 0) % 3];
  baseShadow(ctx, g, 4);
  // сваи
  for (const x of [X + 10, X + W * 0.36, X + W * 0.64, X + W - 10]) {
    fillRR(ctx, x - 4, floor - 4, 8, bot - floor + 2, 3, WOOD_D, OUT, 1.6);
    line(ctx, x - 1, floor, x - 1, bot - 4, 'rgba(255,220,170,.35)', 1.4);
  }
  // настил
  fillRR(ctx, X + 2, floor - 8, W - 4, 10, 3, WOOD, OUT, 2);
  for (let x = X + 12; x < X + W - 6; x += 12) line(ctx, x, floor - 7, x, floor + 1, 'rgba(90,55,25,.4)', 1.2);
  // стены из бамбука
  fillRR(ctx, X + 10, top + 14, W - 20, floor - top - 20, 3, '#e3cd8a', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X + 10, top + 14, W - 20, floor - top - 20);
  ctx.clip();
  for (let x = X + 10; x < X + W - 10; x += 8) line(ctx, x, top + 14, x, floor, 'rgba(130,100,40,.4)', 1.3);
  ctx.restore();
  // дверь-проём с занавеской и окошко
  fillRR(ctx, cx - 13, floor - 36, 26, 30, 4, lit ? '#8a6424' : '#5c4422', OUT, 1.8);
  if (lit) glow(ctx, cx, floor - 22, 34, 0.42);
  poly(ctx, [cx - 13, floor - 36, cx + 13, floor - 36, cx + 7, floor - 16, cx - 13, floor - 22], cur, OUT, 1.2);
  const wx = X + W - 30;
  fillRR(ctx, wx - 9, floor - 38, 18, 14, 3, lit ? '#ffe066' : '#8ac4d0', OUT, 1.6);
  line(ctx, wx, floor - 38, wx, floor - 24, OUT, 1.2);
  // крыша из листьев: большой навес с бахромой
  poly(ctx, [X - 12, top + 22, cx, top - 34, X + W + 12, top + 22], '#b9a24a', OUT, 2.6);
  poly(ctx, [cx, top - 34, X + W + 12, top + 22, cx + 8, top + 22], 'rgba(90,70,20,.18)');
  for (let x = X - 8; x < X + W + 8; x += 12) poly(ctx, [x, top + 18, x + 6, top + 32, x + 12, top + 18], '#a08c3a', OUT, 1);
  for (let k = 0.3; k < 0.95; k += 0.32) line(ctx, cx - (cx - X + 12) * k, top - 34 + 56 * k, cx + (X + W + 12 - cx) * k, top - 34 + 56 * k, 'rgba(90,70,20,.3)', 1.5);
  // лесенка к двери
  for (const sx of [-10, 10]) line(ctx, cx + sx, floor + 2, cx + sx * 1.2, bot + 2, OUT, 3);
  for (let y = floor + 8; y < bot; y += 7) line(ctx, cx - 10, y, cx + 10, y, WOOD_D, 2.4);
  if (b.sign) signBoard(ctx, b.sign, cx, top + 6, Math.min(W - 8, 96), 18, 'wood');
}
/** Хижина вождя: шире и выше, крыша куполом из листьев, резные столбы с лицами, щит с солнцем. */
function paintChiefHut(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = bot - 74;
  baseShadow(ctx, g, 8);
  // стены
  fillRR(ctx, X + 12, top + 8, W - 24, bot - top - 10, 4, '#d9bf86', OUT, 2.2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X + 12, top + 8, W - 24, bot - top - 10);
  ctx.clip();
  for (let y = top + 16; y < bot; y += 10) line(ctx, X + 12, y, X + W - 12, y, 'rgba(130,95,40,.35)', 1.4);
  ctx.restore();
  // дверь
  fillRR(ctx, cx - 16, bot - 42, 32, 40, 8, lit ? '#8a6424' : '#4f3a1e', OUT, 2);
  if (lit) glow(ctx, cx, bot - 22, 40, 0.45);
  for (let i = 0; i < 5; i++) ell(ctx, cx - 14 + i * 7, bot - 42, 3, 3, ['#ff6b6b', '#ffd43b', '#fff', '#ffd43b', '#ff6b6b'][i], OUT, 0.8);
  // щит с солнцем
  ell(ctx, X + W - 34, bot - 40, 13, 13, '#e8590c', OUT, 2);
  ell(ctx, X + W - 34, bot - 40, 6, 6, '#ffd43b', OUT, 1.2);
  for (let k = 0; k < 8; k++) line(ctx, X + W - 34 + Math.cos(k * 0.785) * 8, bot - 40 + Math.sin(k * 0.785) * 8, X + W - 34 + Math.cos(k * 0.785) * 12, bot - 40 + Math.sin(k * 0.785) * 12, '#ffd43b', 1.6);
  // резные столбы по бокам
  for (const x of [X + 8, X + W - 8]) {
    fillRR(ctx, x - 7, top - 4, 14, bot - top + 4, 4, '#a0662d', OUT, 1.8);
    for (let y = top + 6; y < bot - 10; y += 24) {
      ell(ctx, x - 3, y, 1.8, 1.8, '#fff');
      ell(ctx, x + 3, y, 1.8, 1.8, '#fff');
      line(ctx, x - 3, y + 7, x + 3, y + 7, OUT, 1.4);
    }
  }
  // крыша куполом
  ctx.beginPath();
  ctx.moveTo(X - 14, top + 16);
  ctx.quadraticCurveTo(cx, top - 82, X + W + 14, top + 16);
  ctx.closePath();
  ctx.fillStyle = '#c2aa52';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = 'rgba(100,80,25,.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X - 6 + k * 8, top + 4 - k * 14);
    ctx.quadraticCurveTo(cx, top - 70 + k * 18, X + W + 6 - k * 8, top + 4 - k * 14);
    ctx.stroke();
  }
  for (let x = X - 10; x < X + W + 10; x += 12) poly(ctx, [x, top + 12, x + 6, top + 26, x + 12, top + 12], '#a8913e', OUT, 1);
  // перья на верхушке
  for (let i = -1; i <= 1; i++) {
    ctx.save();
    ctx.translate(cx + i * 6, top - 46);
    ctx.rotate(i * 0.35);
    ell(ctx, 0, -12, 4.5, 13, ['#e03131', '#ffd43b', '#1c7ed6'][i + 1], OUT, 1.4);
    ctx.restore();
  }
  signBoard(ctx, b.sign || '🌴 Хижина вождя', cx, top + 24, Math.min(W - 30, 120), 18, 'wood');
}
defineBuildings({
  stiltHut: {
    paint: paintStiltHut,
    icon: '🛖',
    box: (b) => [-26, -96, b.w * T + 26, b.h * T + 14],
    hitUp: () => 70,
    lights: (b) => [[(b.x + b.w / 2) * T, (b.y + b.h) * T - 50, 70, 50, 0.9]],
  },
  chiefHut: {
    paint: paintChiefHut,
    icon: '🌴',
    box: (b) => [-40, b.h * T - 74 - 120, b.w * T + 40, b.h * T + 22],
    hitUp: () => 110,
    lights: (b) => [[(b.x + b.w / 2) * T, (b.y + b.h) * T - 24, 80, 56, 1]],
  },
});

