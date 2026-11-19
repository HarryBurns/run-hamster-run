// ДЖУНГЛИ (П.9): рисунки клеток, предметов и зданий, которые есть только в джунглях. Где что стоит — locations/jungle.js.
// Всё неподвижное — в кэше спрайтов (art + put): листва густая, но каждое дерево — одна картинка, нарисованная один
// раз; вариант и «горит свет» — параметрами put. Шевелится (вода реки, струи водопада, попугаи, лианы) — сдвигом
// готового спрайта или несколькими линиями поверх. Стиль — как у города, леса и пустыни (common/paint.js): контур OUT,
// объём в 2–3 тона, свет слева сверху, мягкая тень на земле.
//
// Клетки:  jfloor — подстилка джунглей (основа карты: тёмная зелень, опавшие листья), jtrail — тропа (влажная земля
//          со следами), jstone — плиты у храма (мох в щелях), jriver — река (не зайти; блики бегут вдоль), jpool — заводь
//          под водопадом (та же вода; искупаться — особое место), jbridge — доски подвесного моста.
// Предметы: jtree (большое тропическое дерево с корнями-досками и лианами; 3 варианта), bamboo (заросль бамбука),
//          monstera (куст с резными листьями — сквозь него медленно), jflowers (геликонии и орхидеи), ruinPillar
//          (колонна храма; v: 1 — обломок), ruinHead (каменная голова), perch (жёрдочка с попугаем; v — какой
//          попугай), vineTree (великан с лианами — мини-игра «Лианы»), jfall (скала с водопадом), mooredBoat
//          (кораблик у причала), tikiTorch (факел у лагеря; ночью светит).
// Рисунки: parrot (попугай: цвет, взмах), notebook (дневник Лианы), liana (лиана — для мини-игры и картинки).
// Здания:  camp (палатка исследовательницы Лианы), temple (руины храма — загадка «Узор храма»), dock (хижина
//          у причала — кораблик в город).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade } from '../core/draw.js';
import {
  T,
  OUT,
  SP,
  put,
  hash,
  defineTiles,
  defineObjects,
  defineArt,
  defineBuildings,
} from '../engine/topdown/index.js';
import { shadow, signBoard, WOOD, WOOD_D } from './common/paint.js';
import { crown, treeDot } from './common/objects.js';
import { geom, baseShadow, glow } from './common/buildings.js';
import { drawBoat } from './sea.js';
import './forest_art.js'; // папоротник и замшелые камни — общие с лесом

export const FLOOR = '#4b9440',
  FLOOR_D = '#3c7d35',
  FLOOR_L = '#62ab52',
  STONE_J = '#b9b39a',
  STONE_JD = '#8f8a72',
  MOSS = '#6aa84f';
/** Тона листвы джунглей: [тёмный, основной, светлый] — три варианта (глубокая, сочная, светлая). */
export const JLEAF = [
  ['#1f6b34', '#2b8a3e', '#51b860'],
  ['#2a7a2a', '#3a9a35', '#74c95c'],
  ['#1c6150', '#268062', '#4fb38c'],
];

// ---------- клетки ----------
/** Подстилка: тёмные и светлые листики, крошечные цветочки, корешки. */
function floorDeco(ctx, x, y, tx, ty, env, r) {
  const n = 3 + Math.floor(r(1) * 3);
  for (let i = 0; i < n; i++) {
    const lx = x + r(2 + i) * T,
      ly = y + r(8 + i) * T,
      a = r(14 + i) * 3;
    ell(ctx, lx, ly, 4.2, 1.8, i % 2 ? 'rgba(25,70,25,.32)' : 'rgba(150,210,110,.28)', null, 1, a);
  }
  if (r(20) < 0.22) {
    // корешок
    ctx.strokeStyle = 'rgba(70,50,30,.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const bx = x + r(21) * 30 + 4,
      by = y + r(22) * 30 + 8;
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + 8, by - 6, bx + 16, by + 1);
    ctx.stroke();
  }
  if (r(30) < 0.1)
    ell(ctx, x + 6 + r(31) * 36, y + 6 + r(32) * 36, 2, 2, ['#ff8fab', '#ffd43b', '#fff'][Math.floor(r(33) * 3)]);
}
function trailDeco(ctx, x, y, tx, ty, env, r) {
  ctx.fillStyle = 'rgba(90,55,25,.22)';
  for (let i = 0; i < 2; i++) {
    const fx = x + 12 + r(i) * 22,
      fy = y + 10 + i * 22;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 3.6, 2.6, 0.3, 0, TAU);
    ctx.ellipse(fx + 6, fy + 2, 3.6, 2.6, -0.3, 0, TAU);
    ctx.fill();
  }
  if (r(5) < 0.35) ell(ctx, x + r(6) * T, y + r(7) * T, 4.4, 1.8, 'rgba(60,120,40,.4)', null, 1, r(8) * 3);
  if (r(9) < 0.2) ell(ctx, x + r(10) * T, y + r(11) * T, 6, 3, 'rgba(120,160,200,.22)'); // лужица
}
function stoneDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(80,75,60,.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const off = (ty % 2) * 24;
  ctx.moveTo(x, y + 24);
  ctx.lineTo(x + T, y + 24);
  ctx.moveTo(x + off + 12, y);
  ctx.lineTo(x + off + 12, y + 24);
  ctx.moveTo(x + ((off + 36) % T), y + 24);
  ctx.lineTo(x + ((off + 36) % T), y + T);
  ctx.stroke();
  if (r(1) < 0.5) ell(ctx, x + r(2) * T, y + 24, 7, 2.4, 'rgba(90,160,70,.55)');
  if (r(3) < 0.25) ell(ctx, x + r(4) * T, y + r(5) * T, 5, 3, 'rgba(90,160,70,.4)');
}
function riverDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.4) ell(ctx, x + r(2) * T, y + r(3) * T, 12 + r(4) * 8, 4, 'rgba(255,255,255,.12)');
  if (r(5) < 0.12) {
    // кувшинка
    const lx = x + 10 + r(6) * 28,
      ly = y + 10 + r(7) * 28;
    ell(ctx, lx, ly, 8, 5, '#4caf50', 'rgba(20,60,30,.5)', 1);
    poly(ctx, [lx, ly, lx + 8, ly - 2, lx + 7, ly + 2], '#3aa6a0');
    if (r(8) < 0.5) ell(ctx, lx - 2, ly - 2, 2.6, 2, '#ffc9de', 'rgba(120,50,80,.5)', 0.8);
  }
}
/** Река: блики бегут вдоль течения (на запад), одним путём на все видимые клетки. */
function riverLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T;
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.45 + hash(cells[i] + k, cells[i + 1]) * 3) % 1,
        cy = y + 10 + hash(cells[i + 1], cells[i] + k * 7) * 28,
        cx = x + T - ph * T;
      ctx.moveTo(cx, cy - 3);
      ctx.quadraticCurveTo(cx - 3, cy, cx, cy + 3);
    }
  }
  ctx.stroke();
}
const RIVER = {
  like: 'd',
  walk: false,
  slide: false,
  onEnter: null,
  step: 'step',
  speed: 225,
  z: 10.2,
  map: '#38a89d',
  fill: '#3aa6a0',
  edge: {
    wob: 8,
    out: [
      ['#3f7a32', 10],
      ['#7a6a45', 4],
    ],
    in: [
      ['rgba(10,70,70,.3)', 14],
      ['rgba(255,255,255,.4)', 3],
    ],
  },
  deco: riverDeco,
  live: riverLive,
};
defineTiles({
  jfloor: {
    map: FLOOR,
    step: 'step',
    z: 4.35,
    fill: FLOOR,
    edge: { wob: 9, in: [[FLOOR_D, 8]] },
    deco: floorDeco,
  },
  jtrail: {
    map: '#a37a4c',
    step: 'step',
    z: 5.07,
    fill: '#a67c50',
    edge: { wob: 7, out: [['rgba(50,40,20,.22)', 7]], in: [['rgba(255,230,190,.18)', 5]] },
    deco: trailDeco,
  },
  jstone: {
    map: STONE_J,
    step: 'stepWood',
    z: 6.4,
    fill: STONE_J,
    edge: { wob: 4, out: [['rgba(60,55,40,.3)', 6]], in: [['rgba(255,255,240,.25)', 4]] },
    deco: stoneDeco,
  },
  jriver: RIVER,
  jpool: { ...RIVER },
  // доски подвесного моста: как у пирса, но это не пляж (без шлёпанцев); верёвочные перила — paintGround локации
  jbridge: { like: 'i', beach: false, map: '#b7804f' },
});

// ---------- деревья и кусты ----------
const TREE_CROWNS = [
  [
    [-36, -96, 30, 22],
    [34, -98, 30, 22],
    [-14, -122, 32, 24],
    [18, -126, 30, 22],
    [0, -100, 36, 24],
  ],
  [
    [-30, -88, 28, 20],
    [30, -92, 28, 21],
    [0, -118, 34, 24],
    [-4, -94, 32, 22],
  ],
  [
    [-40, -100, 26, 20],
    [40, -100, 26, 20],
    [-18, -126, 28, 22],
    [22, -128, 28, 21],
    [0, -106, 34, 24],
  ],
];
/** Лиана: изогнутая зелёная верёвка с листиками сверху вниз. */
function vine(ctx, x, y0, len, sway = 0, col = '#3d8b2f') {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.quadraticCurveTo(x + 8 + sway, y0 + len * 0.5, x + sway * 1.6, y0 + len);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let k = 0.2; k < 0.95; k += 0.22) {
    const px = x + (8 + sway) * 2 * k * (1 - k) + sway * 1.6 * k * k,
      py = y0 + len * k;
    ell(ctx, px + 3, py, 3.6, 1.8, '#5fb84a', OUT, 0.8, 0.6);
  }
}
/** Большое тропическое дерево: светлый ствол с корнями-досками, раскидистая крона в три яруса, лианы. */
function paintJTree(ctx, v) {
  const tones = JLEAF[v % 3];
  shadow(ctx, 4, 14, 42, 11, 0.22);
  // корни-доски
  for (const [dx, w] of [
    [-18, 10],
    [16, 9],
    [-4, 7],
  ])
    poly(ctx, [dx - w, 14, dx, -6, dx + w * 0.4, 14], '#b8a585', OUT, 1.8);
  // ствол
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.quadraticCurveTo(-8, -40, -6, -86);
  ctx.lineTo(6, -86);
  ctx.quadraticCurveTo(8, -40, 11, 12);
  ctx.closePath();
  ctx.fillStyle = '#c4b393';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(80,60,30,.22)';
  ctx.fillRect(2, -90, 14, 110);
  ctx.fillStyle = 'rgba(110,170,80,.45)';
  ctx.fillRect(-12, -50, 8, 14);
  ctx.fillRect(-12, -14, 6, 10);
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // лианы за кроной
  vine(ctx, -44, -84, 62, -3);
  vine(ctx, 46, -86, 54, 2);
  crown(ctx, TREE_CROWNS[v % 3], tones);
  // крупные листья-«ладошки» по краю кроны
  TREE_CROWNS[v % 3].forEach(([x, y, rx, ry], i) => {
    for (let k = 0; k < 3; k++) {
      const a = i * 1.7 + k * 2.1 + 0.4;
      ell(
        ctx,
        x + Math.cos(a) * rx * 0.55,
        y + Math.sin(a) * ry * 0.5,
        7,
        2.6,
        k % 2 ? tones[0] : tones[2],
        null,
        1,
        a + 0.6,
      );
    }
  });
  // лианы поверх
  vine(ctx, -22, -82, 70, 4, '#4a9a35');
  vine(ctx, 20, -84, 48, -3, '#4a9a35');
  if (v % 3 === 1)
    // цветущие лианы: красные «клювики» геликонии
    for (const [x, y] of [
      [-18, -40],
      [-14, -24],
      [22, -54],
    ])
      poly(ctx, [x, y, x + 9, y - 3, x + 2, y + 5], '#fa5252', OUT, 1);
  if (v % 3 === 2)
    for (const [x, y] of [
      [-30, -98],
      [26, -112],
      [4, -128],
    ]) {
      ell(ctx, x, y, 4, 3, '#e599f7', OUT, 0.9);
      ell(ctx, x, y, 1.4, 1.4, '#fff3bf');
    }
}
function paintBamboo(ctx, v) {
  shadow(ctx, 2, 12, 24, 7);
  const stalks = v % 2 ? [-14, -4, 6, 16] : [-16, -6, 4, 12, 20];
  stalks.forEach((x, i) => {
    const h = 104 + ((i * 17) % 22),
      lean = (i - 2) * 1.6;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + lean, -h);
    ctx.stroke();
    ctx.strokeStyle = i % 2 ? '#94c45a' : '#7fb34a';
    ctx.lineWidth = 4.8;
    ctx.stroke();
    for (let y = 0; y > -h; y -= 22) line(ctx, x + (lean * -y) / h - 3, y, x + (lean * -y) / h + 3, y, OUT, 1.6);
    for (let k = 0; k < 3; k++) {
      const ly = -h + 14 + k * 26,
        lx = x + (lean * -ly) / h,
        s = (i + k) % 2 ? 1 : -1;
      ell(ctx, lx + s * 10, ly, 11, 3, '#5aa83f', OUT, 1, s * 0.4);
    }
  });
}
function paintMonstera(ctx, v) {
  shadow(ctx, 0, 12, 28, 7);
  const leafs = [
    [-20, -10, -0.7, 20],
    [20, -12, 0.7, 20],
    [-6, -26, -0.2, 22],
    [10, -24, 0.3, 21],
    [0, -6, 0, 18],
  ];
  leafs.forEach(([x, y, a, r], i) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ell(ctx, 0, 0, r * 0.72, r * 0.6, i % 2 ? '#2f9e44' : '#2b8a3e', OUT, 1.8);
    // прорези листа
    ctx.strokeStyle = v % 2 ? '#4b9440' : '#3c7d35';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const s of [-1, 1])
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(s * r * 0.15, -r * 0.3 + k * r * 0.25);
        ctx.lineTo(s * r * 0.66, -r * 0.4 + k * r * 0.32);
      }
    ctx.stroke();
    line(ctx, 0, -r * 0.5, 0, r * 0.5, 'rgba(255,255,255,.3)', 1.2);
    ctx.restore();
  });
}
function paintFlowers(ctx, v) {
  const k = v % 3;
  if (k === 0) {
    // геликония: красно-жёлтые «клювики» на стебле
    for (const [x, h] of [
      [-8, 26],
      [7, 20],
    ]) {
      line(ctx, x, 10, x, -h, '#2f9e44', 2.4);
      for (let i = 0; i < 4; i++) {
        const y = -h + 6 + i * 7,
          s = i % 2 ? 1 : -1;
        poly(ctx, [x, y, x + s * 10, y - 4, x + s * 3, y + 4], i % 2 ? '#ffd43b' : '#fa5252', OUT, 1);
      }
    }
    ell(ctx, -12, 8, 8, 3, '#40a03a', OUT, 1, -0.4);
  } else {
    // орхидеи на листьях
    ell(ctx, -6, 6, 10, 3.4, '#37a043', OUT, 1, -0.3);
    ell(ctx, 8, 6, 10, 3.4, '#2f9e44', OUT, 1, 0.3);
    const col = k === 1 ? '#e599f7' : '#ffffff';
    for (const [x, y] of [
      [-6, -8],
      [6, -12],
      [0, 0],
    ]) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU - 1.57;
        ell(ctx, x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.6, 2.4, col, OUT, 0.8, a);
      }
      ell(ctx, x, y, 2, 2, k === 1 ? '#ffd43b' : '#f783ac');
    }
  }
}
function paintPillar(ctx, v) {
  shadow(ctx, 3, 12, 20, 6);
  const h = v % 2 ? 34 : 70;
  fillRR(ctx, -16, 4, 32, 10, 2, STONE_JD, OUT, 1.8);
  fillRR(ctx, -12, -h, 24, h + 6, 3, STONE_J, OUT, 2);
  for (const dx of [-5, 3]) line(ctx, dx, -h + 4, dx, 2, 'rgba(80,75,60,.35)', 1.5);
  if (v % 2) poly(ctx, [-12, -h, -4, -h - 8, 3, -h - 2, 12, -h - 9, 12, -h], STONE_J, OUT, 1.8);
  else fillRR(ctx, -16, -h - 8, 32, 10, 2, STONE_J, OUT, 1.8);
  // мох и лиана
  ell(ctx, -6, -h * 0.4, 7, 4, MOSS, null);
  ell(ctx, 8, 2, 8, 3, MOSS, null);
  vine(ctx, 10, -h - 4, h * 0.8, -2);
}
function paintHead(ctx) {
  shadow(ctx, 4, 14, 34, 9);
  fillRR(ctx, -30, -6, 60, 20, 4, STONE_JD, OUT, 2);
  // каменная голова: большой нос, глаза-щёлочки, улыбка
  fillRR(ctx, -26, -78, 52, 76, 14, STONE_J, OUT, 2.2);
  fillRR(ctx, -26, -78, 52, 14, 8, STONE_JD, OUT, 1.6);
  line(ctx, -18, -50, -6, -50, OUT, 3);
  line(ctx, 6, -50, 18, -50, OUT, 3);
  poly(ctx, [-5, -46, 5, -46, 7, -28, -7, -28], shade(STONE_J, -0.08), OUT, 1.6);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, -24, 12, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ell(ctx, -16, -62, 8, 4, MOSS, null);
  ell(ctx, 18, -20, 6, 8, MOSS, null);
  vine(ctx, 20, -76, 58, -3);
}
function paintPerch(ctx) {
  shadow(ctx, 2, 12, 16, 5);
  line(ctx, 0, 12, 0, -46, OUT, 6);
  line(ctx, 0, 12, 0, -46, WOOD_D, 3.4);
  line(ctx, -22, -46, 22, -46, OUT, 6);
  line(ctx, -22, -46, 22, -46, WOOD, 3.4);
  // мисочка с семечками
  fillRR(ctx, 14, -54, 12, 7, 3, '#fff3bf', OUT, 1.2);
  ell(ctx, 4, 10, 10, 3, '#5fb84a', OUT, 1, 0.2);
}
/** Попугай на жёрдочке (точка — лапки): v — какой (0 — красный ара, 1 — синий, 2 — жёлтый), wing — взмах. */
const PARROTS = [
  ['#f03e3e', '#ffd43b', '#1c7ed6'],
  ['#1c7ed6', '#ffd43b', '#0b7285'],
  ['#fcc419', '#69db7c', '#f76707'],
];
export function paintParrot(ctx, v, wing) {
  const [body, belly, tail] = PARROTS[v % 3];
  // хвост
  poly(ctx, [-2, -6, 4, -6, 6, 18, 0, 22, -4, 18], tail, OUT, 1.4);
  poly(ctx, [0, -6, 4, -6, 2, 16], body);
  // тело
  ell(ctx, 0, -16, 9, 13, body, OUT, 1.8);
  ell(ctx, 1, -12, 5, 8, belly);
  // крыло
  if (wing) poly(ctx, [-6, -22, -24, -34, -20, -14, -6, -10], tail, OUT, 1.4);
  else ell(ctx, -5, -14, 5, 10, tail, OUT, 1.4, 0.2);
  // голова и клюв
  ell(ctx, 2, -30, 8, 8, body, OUT, 1.8);
  ell(ctx, 4, -32, 3.2, 3.2, '#fff', OUT, 1);
  ell(ctx, 4.6, -32, 1.4, 1.6, '#1d1b1b');
  ctx.beginPath();
  ctx.moveTo(8, -32);
  ctx.quadraticCurveTo(16, -30, 11, -22);
  ctx.quadraticCurveTo(10, -26, 8, -26);
  ctx.closePath();
  ctx.fillStyle = '#495057';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // лапки
  line(ctx, -2, -4, -3, 1, '#868e96', 2);
  line(ctx, 3, -4, 4, 1, '#868e96', 2);
}
/** Дневник Лианы: зелёная тетрадка с закладкой. */
function paintNotebook(ctx) {
  shadow(ctx, 0, 6, 14, 4);
  ctx.save();
  ctx.rotate(-0.2);
  fillRR(ctx, -12, -10, 24, 18, 3, '#2f9e44', OUT, 1.6);
  fillRR(ctx, -12, -10, 5, 18, 2, '#2b8a3e', OUT, 1.2);
  line(ctx, 4, 8, 6, 14, '#fa5252', 2.4);
  ell(ctx, 3, -1, 4, 4, '#fff3bf', OUT, 0.8);
  ctx.restore();
}
/** Великан с лианами (мини-игра «Лианы»): толстый ствол, крона на весь экран, три длинные лианы. */
function paintVineTree(ctx) {
  shadow(ctx, 6, 18, 90, 16, 0.22);
  for (const [dx, w] of [
    [-30, 16],
    [28, 14],
    [-8, 10],
    [12, 9],
  ])
    poly(ctx, [dx - w, 18, dx, -10, dx + w * 0.4, 18], '#b19c78', OUT, 2);
  ctx.beginPath();
  ctx.moveTo(-18, 16);
  ctx.quadraticCurveTo(-14, -60, -12, -120);
  ctx.lineTo(12, -120);
  ctx.quadraticCurveTo(14, -60, 19, 16);
  ctx.closePath();
  ctx.fillStyle = '#bba987';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // дупло
  ell(ctx, 2, -66, 7, 10, '#5c3d24', OUT, 1.6);
  // толстые ветви
  for (const s of [-1, 1]) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(s * 6, -110);
    ctx.quadraticCurveTo(s * 60, -140, s * 110, -128);
    ctx.stroke();
    ctx.strokeStyle = '#bba987';
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  crown(
    ctx,
    [
      [-96, -146, 34, 24],
      [96, -146, 34, 24],
      [-50, -162, 40, 26],
      [50, -164, 40, 26],
      [0, -170, 46, 26],
      [0, -140, 40, 22],
    ],
    JLEAF[0],
  );
  // три длинные лианы с ветвей
  for (const [x, len] of [
    [-104, 110],
    [-50, 126],
    [100, 118],
  ])
    vine(ctx, x, -136, len, 4);
  ell(ctx, -46, -164, 10, 3.5, JLEAF[0][2], null, 1, 0.5);
  ell(ctx, 30, -176, 10, 3.5, JLEAF[0][2], null, 1, -0.4);
}
/** Скала с водопадом: камни по бокам, тёмная мокрая стена за струёй; струя — линиями поверх (draw). */
function paintFallRock(ctx) {
  // каменная стена — дуга из валунов
  poly(ctx, [-150, 30, -140, -120, -90, -180, -40, -196, 40, -196, 90, -180, 140, -120, 150, 30], '#8a8f7a', OUT, 2.6);
  poly(ctx, [-40, -196, 40, -196, 44, 20, -44, 20], '#5b6a5a');
  for (const [x, y, rx, ry] of [
    [-110, -40, 34, 30],
    [-120, -110, 30, 34],
    [-74, -160, 30, 22],
    [110, -50, 34, 30],
    [118, -118, 28, 32],
    [74, -164, 30, 22],
    [-70, 6, 30, 18],
    [72, 8, 30, 18],
  ]) {
    ell(ctx, x, y, rx, ry, '#9aa08a', OUT, 2);
    ell(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, 'rgba(255,255,255,.22)');
    ell(ctx, x + rx * 0.2, y - ry * 0.6, rx * 0.55, ry * 0.22, MOSS);
  }
  // папоротники и лианы на скале
  for (const [x, y] of [
    [-90, -120],
    [96, -96],
    [-60, -30],
  ])
    for (let i = 0; i < 4; i++) ell(ctx, x + (i - 1.5) * 7, y, 9, 2.6, '#3f9e3a', OUT, 0.8, -1 + i * 0.6);
  vine(ctx, -56, -176, 80, 3);
  vine(ctx, 62, -170, 70, -2);
  // кромка, с которой падает вода
  fillRR(ctx, -44, -200, 88, 12, 5, '#7ec8e3', OUT, 2);
}
function paintTorch(ctx, lit) {
  shadow(ctx, 0, 10, 10, 3);
  line(ctx, 0, 10, 0, -46, OUT, 5.5);
  line(ctx, 0, 10, 0, -46, '#a0662d', 3.2);
  fillRR(ctx, -7, -58, 14, 14, 4, '#c9a24a', OUT, 1.6);
  if (lit) {
    glow(ctx, 0, -66, 26, 0.5);
    poly(ctx, [-6, -58, -2, -78, 2, -66, 6, -80, 7, -58], '#ff922b', OUT, 1.2);
    poly(ctx, [-3, -58, 0, -70, 3, -58], '#ffe066');
  }
}
/**
 * Лодочка-пирога для реки (Дж5): долблёный корпус, весло лежит поперёк; m — 1: носом влево. Хомячок садится в неё
 * (рисуется поверх, по пояс в лодке — clipBelow) — см. locations/jungle.js, drawCanoe.
 */
function paintCanoe(ctx, m) {
  ctx.scale(m ? -1 : 1, 1);
  ell(ctx, 0, 12, 58, 8, 'rgba(255,255,255,.45)');
  ctx.beginPath();
  ctx.moveTo(-56, -6);
  ctx.quadraticCurveTo(-40, 14, 0, 14);
  ctx.quadraticCurveTo(44, 14, 60, -8);
  ctx.quadraticCurveTo(10, 0, -56, -6);
  ctx.closePath();
  ctx.fillStyle = '#a8703f';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  line(ctx, -44, 3, 48, 2, 'rgba(255,255,255,.25)', 2.5);
  ell(ctx, 2, -2, 40, 5, '#6b4423', OUT, 1.6); // внутри долблёнки
  for (const x of [-30, 30]) line(ctx, x, -6, x + 2, 2, '#c98b5a', 3); // перекладины
  poly(ctx, [-60, -10, -52, -6, -58, -2], '#ffd43b', OUT, 1.2); // жёлтый флажок на носу
}
defineArt({
  parrot: [[-28, -42, 20, 26], paintParrot],
  notebook: [[-18, -18, 18, 12], paintNotebook],
  canoe: [[-66, -16, 66, 24], paintCanoe],
});

defineObjects({
  jtree: {
    solid: true,
    map: treeDot,
    art: { jtree: [[-76, -156, 78, 30], paintJTree] },
    draw: (ctx, o) => put('jtree', o.x, o.y, (o.v || 0) % 3),
  },
  bamboo: {
    solid: true,
    map: () => '#82c91e',
    art: { bamboo: [[-46, -140, 48, 22], paintBamboo] },
    draw: (ctx, o) => put('bamboo', o.x, o.y, (o.v || 0) % 2),
  },
  monstera: {
    slow: 0.5,
    rustle: 'paper',
    art: { monstera: [[-36, -46, 36, 20], paintMonstera] },
    draw(ctx, o, env) {
      const h = env.hero,
        inside = Math.abs(h.x - o.x) < 26 && Math.abs(h.y - o.y) < 26;
      put('monstera', o.x + (inside ? Math.sin(env.t * 22) * 1.8 : 0), o.y, (o.v || 0) % 2);
    },
  },
  jflowers: {
    flat: true,
    art: { jflowers: [[-24, -34, 24, 16], paintFlowers] },
    draw: (ctx, o) => put('jflowers', o.x, o.y, (o.v || 0) % 3),
  },
  ruinPillar: {
    solid: true,
    map: () => STONE_JD,
    art: { ruinPillar: [[-26, -98, 28, 20], paintPillar] },
    draw: (ctx, o) => put('ruinPillar', o.x, o.y, (o.v || 0) % 2),
  },
  ruinHead: {
    solid: true,
    map: () => STONE_JD,
    art: { ruinHead: [[-40, -90, 42, 26], paintHead] }, // тень у основания — до y = 23
    draw: (ctx, o) => put('ruinHead', o.x, o.y),
  },
  // жёрдочка с попугаем: попугай чуть покачивается (готовым спрайтом) и машет крылом, когда говорит (o.talk())
  perch: {
    solid: true,
    art: { perch: [[-28, -60, 30, 18], paintPerch] },
    draw(ctx, o, env) {
      put('perch', o.x, o.y);
      const talk = o.talk && o.talk(),
        bob = Math.round(Math.sin(env.t * 2 + o.tx) * 1.2),
        wing = talk ? Math.floor(env.t * 8) % 2 : Math.sin(env.t * 0.7 + o.tx * 3) > 0.96 ? 1 : 0;
      put('parrot', o.x + 2, o.y - 48 + bob - (talk ? 2 : 0), (o.v || 0) % 3, wing);
    },
  },
  vineTree: {
    solid: [
      [-1, 0],
      [0, 0],
      [1, 0],
    ],
    map: treeDot,
    art: { vineTree: [[-150, -206, 150, 40], paintVineTree] },
    draw: (ctx, o) => put('vineTree', o.x, o.y),
  },
  // скала с водопадом: занимает ряд из пяти клеток; струя и брызги — линиями поверх (несколько путей за кадр)
  jfall: {
    solid: [
      [-2, 0],
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    map: () => '#8a8f7a',
    art: { jfall: [[-156, -206, 156, 40], paintFallRock] },
    draw(ctx, o, env) {
      put('jfall', o.x, o.y);
      SP.world();
      drawFallWater(ctx, o.x, o.y - 194, o.y + 22, env.t);
    },
  },
  // кораблик у причала (тот же, что в море города; хомячка в нём нет — она на берегу)
  mooredBoat: {
    solid: true,
    draw(ctx, o, env) {
      SP.world();
      drawBoat(ctx, o.x, o.y, -1, env.t, null, false);
    },
  },
  tikiTorch: {
    solid: true,
    light: [0, -66, 120],
    art: { tikiTorch: [[-30, -92, 30, 16], paintTorch] },
    draw(ctx, o, env) {
      const lit = env.dark > 0.3;
      put('tikiTorch', o.x, o.y, lit ? 1 : 0);
      if (lit) {
        SP.world();
        const f = Math.sin(env.t * 9 + o.tx) * 2;
        poly(ctx, [o.x - 4, o.y - 58, o.x + f, o.y - 80, o.x + 4, o.y - 58], 'rgba(255,224,102,.8)');
      }
    },
  },
});

/** Струя водопада: голубая полоса с белыми прядями, бегущими вниз, и пена внизу (координаты мира). */
export function drawFallWater(ctx, x, top, bot, t) {
  ctx.fillStyle = 'rgba(126,200,227,.92)';
  ctx.beginPath();
  ctx.moveTo(x - 38, top);
  ctx.lineTo(x + 38, top);
  ctx.lineTo(x + 46, bot);
  ctx.lineTo(x - 46, bot);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const h = bot - top;
  for (let i = 0; i < 7; i++) {
    const sx = x - 32 + i * 10.5,
      ph = (t * 1.6 + i * 0.37) % 1,
      y0 = top + ph * h,
      len = 26 + (i % 3) * 8;
    ctx.moveTo(sx + (ph * 6 * (i - 3)) / 3, y0);
    ctx.lineTo(sx + ((ph * 6 + 1) * (i - 3)) / 3, Math.min(bot, y0 + len));
  }
  ctx.stroke();
  // пена внизу
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const px = x - 44 + i * 17.6,
      r = 9 + Math.sin(t * 5 + i * 1.7) * 3;
    ctx.moveTo(px + r, bot);
    ctx.arc(px, bot, r, 0, TAU);
  }
  ctx.fill();
}

// ---------- здания ----------
/** Палатка Лианы: зелёный тент на шестах, полог откинут — внутри спальник; столик с картой, флажок. */
function paintCamp(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 50;
  baseShadow(ctx, g, 10);
  // верёвки
  for (const [x0, x1] of [
    [X + 10, X - 14],
    [X + W - 10, X + W + 14],
  ]) {
    line(ctx, x0, top + 40, x1, bot - 2, 'rgba(74,55,40,.7)', 1.4);
    fillRR(ctx, x1 - 2, bot - 8, 4, 10, 1, WOOD_D, OUT, 1);
  }
  // тент «домиком»
  const tent = [X + 4, bot - 4, cx, top, X + W - 4, bot - 4];
  poly(ctx, tent, '#74a043', OUT, 2.6);
  poly(ctx, [cx, top, X + W - 4, bot - 4, cx + 6, bot - 4], '#5c8a36');
  for (let k = 0.3; k < 0.95; k += 0.3)
    line(
      ctx,
      cx - (cx - X - 4) * k,
      top + (bot - 4 - top) * k,
      cx + (X + W - 4 - cx) * k,
      top + (bot - 4 - top) * k,
      'rgba(40,60,20,.25)',
      1.4,
    );
  // вход
  poly(ctx, [cx - 26, bot - 4, cx, top + 26, cx + 26, bot - 4], lit ? '#7a5a22' : '#3d4a22', OUT, 2);
  if (lit) glow(ctx, cx, bot - 24, 36, 0.4);
  fillRR(ctx, cx - 16, bot - 14, 32, 10, 4, '#e8590c', OUT, 1.2); // спальник
  for (const s of [-1, 1])
    poly(ctx, [cx + s * 2, top + 28, cx + s * 30, bot - 10, cx + s * 22, bot - 4], '#8fb85a', OUT, 1.6);
  // флажок на шесте
  line(ctx, cx, top, cx, top - 22, OUT, 3);
  poly(ctx, [cx, top - 22, cx + 16, top - 18, cx, top - 13], '#ffd43b', OUT, 1.2);
  // столик с картой и лупой
  const tx = X + W + 6;
  fillRR(ctx, tx - 20, bot - 30, 40, 7, 2, WOOD, OUT, 1.6);
  line(ctx, tx - 14, bot - 23, tx - 16, bot - 2, OUT, 2);
  line(ctx, tx + 14, bot - 23, tx + 16, bot - 2, OUT, 2);
  fillRR(ctx, tx - 16, bot - 36, 26, 8, 1, '#fff3bf', OUT, 1);
  line(ctx, tx - 12, bot - 32, tx + 4, bot - 33, '#fa5252', 1.2);
  ell(ctx, tx + 12, bot - 36, 4, 4, 'rgba(200,230,255,.7)', OUT, 1.2);
  // рюкзак у входа
  fillRR(ctx, X - 18, bot - 26, 18, 22, 6, '#e8590c', OUT, 1.6);
  fillRR(ctx, X - 15, bot - 20, 12, 8, 3, '#ffa94d', OUT, 1);
}
/** Руины храма: ступенчатая пирамидка из замшелых плит, тёмный вход с каменной маской, лианы и корни. */
function paintTemple(ctx, b) {
  const g = geom(b),
    { W, bot, cx } = g;
  shadow(ctx, cx + 24, bot - 2, W * 0.6, 16);
  const steps = 4,
    sh = 26;
  for (let i = 0; i < steps; i++) {
    const w = W + 20 - i * 34,
      y = bot - (i + 1) * sh;
    fillRR(ctx, cx - w / 2, y, w, sh + 2, 3, i % 2 ? STONE_J : shade(STONE_J, -0.05), OUT, 2.2);
    for (let x = cx - w / 2 + 18; x < cx + w / 2 - 6; x += 30)
      line(ctx, x, y + 2, x, y + sh, 'rgba(80,75,60,.35)', 1.4);
    // мох по краю ступеней
    for (let x = cx - w / 2 + 8; x < cx + w / 2; x += 26) ell(ctx, x + (i % 2) * 9, y + 2, 8, 3, MOSS);
  }
  // верхний домик с крышей
  const tw = W - 4 * 34 + 12,
    ty = bot - steps * sh;
  fillRR(ctx, cx - tw / 2, ty - 34, tw, 36, 3, STONE_J, OUT, 2.2);
  poly(ctx, [cx - tw / 2 - 8, ty - 34, cx, ty - 58, cx + tw / 2 + 8, ty - 34], STONE_JD, OUT, 2.2);
  // вход с маской
  fillRR(ctx, cx - 24, bot - 62, 48, 62, 6, '#2e2a22', OUT, 2.2);
  fillRR(ctx, cx - 32, bot - 76, 64, 18, 4, STONE_JD, OUT, 2);
  for (const s of [-1, 1]) {
    ell(ctx, cx + s * 14, bot - 67, 5, 4, '#2e2a22', OUT, 1.2);
    ell(ctx, cx + s * 14, bot - 67, 2, 2, '#69db7c');
  }
  // узоры-знаки на плитах (те же, что в загадке)
  ctx.strokeStyle = 'rgba(90,80,60,.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const x = cx + s * 54,
      y = bot - 40;
    ctx.moveTo(x + 7, y);
    ctx.arc(x, y, 7, 0, TAU);
    ctx.moveTo(x - 6, y + 18);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x + 6, y + 18);
  }
  ctx.stroke();
  // лианы и корни
  vine(ctx, cx - tw / 2 + 4, ty - 34, 70, 3);
  vine(ctx, cx + W / 2 - 16, bot - 2 * sh, 40, -2);
  vine(ctx, cx + tw / 2 - 6, ty - 30, 54, -3);
  ell(ctx, cx - W / 2 + 6, bot - 10, 14, 6, '#3f9e3a', OUT, 1.2);
  ell(ctx, cx + W / 2 - 4, bot - 8, 12, 5, '#3f9e3a', OUT, 1.2);
}
/** Хижина у причала: бамбуковые стены, крыша из пальмовых листьев, табличка «В город». */
function paintDock(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 30;
  baseShadow(ctx, g);
  // стены из бамбука
  fillRR(ctx, X + 8, top + 20, W - 16, bot - top - 22, 3, '#d8c27a', OUT, 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X + 8, top + 20, W - 16, bot - top - 22);
  ctx.clip();
  for (let x = X + 8; x < X + W - 8; x += 9) line(ctx, x, top + 20, x, bot, 'rgba(120,100,40,.45)', 1.4);
  ctx.restore();
  // окошко-проём и дверь
  fillRR(ctx, cx - 14, bot - 40, 28, 38, 4, lit ? '#7a5a22' : '#5c4422', OUT, 1.8);
  if (lit) glow(ctx, cx, bot - 22, 34, 0.35);
  // крыша из листьев
  poly(ctx, [X - 8, top + 26, cx, top - 18, X + W + 8, top + 26], '#9ab54a', OUT, 2.4);
  for (let x = X - 4; x < X + W + 4; x += 14)
    poly(ctx, [x, top + 22, x + 7, top + 34, x + 14, top + 22], '#7fa03a', OUT, 1);
  signBoard(ctx, b.signText ? b.signText() : '⛵ В город', cx, top + 44, 84, 18, 'wood');
  // спасательный круг на стене
  ell(ctx, X + W - 18, bot - 30, 9, 9, '#fff', OUT, 1.6);
  ell(ctx, X + W - 18, bot - 30, 4, 4, '#d8c27a', OUT, 1.2);
  for (const a of [0.4, 2, 3.6, 5.2])
    ell(ctx, X + W - 18 + Math.cos(a) * 6.5, bot - 30 + Math.sin(a) * 6.5, 2.6, 2.6, '#fa5252');
}
defineBuildings({
  camp: {
    paint: paintCamp,
    icon: '⛺',
    box: (b) => [-40, -86, b.w * T + 50, b.h * T + 14],
    hitUp: () => 50,
    lights: (b) => [[(b.x + b.w / 2) * T, (b.y + b.h) * T - 24, 70, 50, 0.9]],
  },
  temple: {
    paint: paintTemple,
    icon: '🗿',
    box: (b) => [-30, b.h * T - 4 * 26 - 70, b.w * T + 100, b.h * T + 30],
    hitUp: (b) => 4 * 26 + 50 - b.h * T,
  },
  dock: {
    paint: paintDock,
    icon: '⛵',
    box: (b) => [-24, -60, b.w * T + 24, b.h * T + 14],
    hitUp: () => 40,
    lights: (b) => [[(b.x + b.w / 2) * T, (b.y + b.h) * T - 20, 60, 44, 0.7]],
  },
});

export { vine };
