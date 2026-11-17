// Рисованные значки вещей (этап 12): шишка, белый гриб, эдельвейс, самоцветы, окаменелости, перья, ракушки, находки
// острова, маракуйя. Какая вещь каким значком показывается — data/icons.js (буква в поле `e` вещи).
// Каждый рисунок — в квадрате 64×64 с центром в (0, 0): толстый тёмный контур, крупные формы, свой силуэт и цвет —
// чтобы значки различались с первого взгляда и в 14 пикселей (подсказка), и в 64 (окно награды).
// Картинка рисуется один раз на размер (в пикселях экрана) и дальше копируется — чётко и на HiDPI.
//   drawItemIcon(ctx, имя, x, y, size)   нарисовать на канве (центр x, y; size — как размер эмодзи)
//   itemIconURL(имя)                     картинка для страницы (data:URL) — ею ui/itemicons.js заменяет буквы в тексте
// Этот модуль сам подключает себя к emoji() из core/draw.js (setIconArt): везде, где на канве рисуется значок вещи.
import { TAU } from '../core/util.js';
import { setIconArt } from '../core/draw.js';
import { iconName } from '../data/icons.js';

const OUT = '#4a3728';
const fs = (c, fill, lw = 2.6, stroke = OUT) => {
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.lineJoin = c.lineCap = 'round';
    c.stroke();
  }
};
const E = (c, x, y, rx, ry, fill, lw, stroke, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  fs(c, fill, lw, stroke);
};
const P = (c, pts, fill, lw, stroke) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  fs(c, fill, lw, stroke);
};
const L = (c, x1, y1, x2, y2, col, lw = 2) => {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  fs(c, null, lw, col);
};
const shine = 'rgba(255,255,255,.75)';

// ---------- лес ----------
function cone(c) {
  // веточка с хвоей
  L(c, 0, -19, 2, -27, '#7a5234', 4);
  for (const [a, col] of [
    [-2.5, '#2f9e44'],
    [-0.7, '#2f9e44'],
    [-2.0, '#51cf66'],
    [-1.15, '#51cf66'],
  ])
    L(c, 1, -24, 1 + Math.cos(a) * 12, -24 + Math.sin(a) * 9, col, 3);
  // шишка: яйцо, сужается книзу
  const body = () => {
    c.beginPath();
    c.moveTo(0, -22);
    c.bezierCurveTo(19, -22, 21, 2, 9, 20);
    c.quadraticCurveTo(0, 30, -9, 20);
    c.bezierCurveTo(-21, 2, -19, -22, 0, -22);
    c.closePath();
  };
  body();
  fs(c, '#9c6236', 3);
  c.save();
  body();
  c.clip();
  // чешуйки рядами
  for (let row = 0; row < 6; row++) {
    const y = -16 + row * 8;
    for (let k = -2; k <= 2; k++) {
      const x = k * 11 + (row % 2 ? 5.5 : 0);
      c.beginPath();
      c.moveTo(x - 6, y - 3);
      c.quadraticCurveTo(x, y + 9, x + 6, y - 3);
      fs(c, row % 2 ? '#c08552' : '#b3743f', 1.6, '#6b3f1f');
    }
  }
  c.restore();
  body();
  fs(c, null, 3);
}
function porcini(c) {
  // толстая ножка-бочонок
  c.beginPath();
  c.moveTo(-7, -4);
  c.bezierCurveTo(-17, 10, -16, 26, 0, 26);
  c.bezierCurveTo(16, 26, 17, 10, 7, -4);
  c.closePath();
  fs(c, '#fff1d6', 3);
  L(c, -6, 10, -3, 18, '#e0c9a0', 2);
  L(c, 5, 8, 7, 15, '#e0c9a0', 2);
  // коричневая шляпка-булочка
  c.beginPath();
  c.moveTo(-26, 0);
  c.bezierCurveTo(-27, -30, 27, -30, 26, 0);
  c.quadraticCurveTo(0, 7, -26, 0);
  c.closePath();
  fs(c, '#8b5a2b', 3);
  E(c, -9, -13, 8, 4, 'rgba(255,255,255,.35)', 0, null, -0.4);
}

// ---------- гора и пещеры ----------
function edelweiss(c) {
  // листики
  for (const a of [0.5, 2.64]) {
    c.save();
    c.rotate(a);
    E(c, 22, 0, 9, 4, '#8fb996', 2);
    c.restore();
  }
  // пушистые белые лучи-лепестки: длинные и короткие
  const ray = (a, len, w) => {
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(4, -w);
    c.quadraticCurveTo(len * 0.7, -w * 1.25, len, 0);
    c.quadraticCurveTo(len * 0.7, w * 1.25, 4, w);
    c.closePath();
    fs(c, '#ffffff', 2.4, '#7d8a80');
    L(c, 8, 0, len - 6, 0, '#d5ddd6', 1.4);
    c.restore();
  };
  for (let i = 0; i < 8; i++) ray((i / 8) * TAU + 0.2, i % 2 ? 21 : 27, 5.5);
  // серединка: жёлтые шарики
  E(c, 0, 0, 9, 9, '#f0c94a', 2.2, '#8a6d1a');
  for (let i = 0; i < 6; i++) E(c, Math.cos(i * 1.05) * 4.5, Math.sin(i * 1.05) * 4.5, 2.2, 2.2, '#ffe680', 0, null);
  E(c, 0, 0, 2.2, 2.2, '#ffe680', 0, null);
}
function glowShroom(c) {
  // свечение
  const g = c.createRadialGradient(0, -6, 4, 0, -6, 31);
  g.addColorStop(0, 'rgba(120,255,225,.85)');
  g.addColorStop(1, 'rgba(120,255,225,0)');
  c.fillStyle = g;
  c.fillRect(-32, -32, 64, 64);
  // тонкая изогнутая ножка
  c.beginPath();
  c.moveTo(-4, -6);
  c.quadraticCurveTo(-7, 12, -5, 26);
  c.lineTo(6, 26);
  c.quadraticCurveTo(3, 12, 4, -6);
  c.closePath();
  fs(c, '#e6fffa', 2.6, '#1f6f78');
  // шляпка-колокольчик
  c.beginPath();
  c.moveTo(-21, -1);
  c.bezierCurveTo(-20, -30, 20, -30, 21, -1);
  c.quadraticCurveTo(0, -8, -21, -1);
  c.closePath();
  fs(c, '#38d9c0', 2.8, '#1f6f78');
  for (const [x, y, r] of [
    [-9, -13, 3.2],
    [3, -18, 2.6],
    [10, -9, 3],
    [-1, -8, 2],
  ])
    E(c, x, y, r, r, '#e6fffa', 0, null);
  // искорки
  for (const [x, y] of [
    [-23, -22],
    [24, -18],
    [20, 14],
  ]) {
    L(c, x - 3.5, y, x + 3.5, y, '#b8fff0', 2);
    L(c, x, y - 3.5, x, y + 3.5, '#b8fff0', 2);
  }
}
// горный хрусталь: друза из трёх прозрачных острых кристаллов
function gemCrystal(c) {
  const shard = (x, w, top, bot, tilt, a, b) => {
    c.save();
    c.translate(x, bot);
    c.rotate(tilt);
    const h = bot - top;
    P(
      c,
      [
        [-w, 0],
        [-w, -h + w],
        [0, -h - w * 0.4],
        [w, -h + w],
        [w, 0],
      ],
      a,
      2.6,
      '#3b5b78',
    );
    P(
      c,
      [
        [0, 0],
        [0, -h - w * 0.4],
        [w, -h + w],
        [w, 0],
      ],
      b,
      0,
      null,
    );
    L(c, 0, -2, 0, -h - w * 0.4, '#3b5b78', 1.4);
    L(c, -w * 0.5, -h * 0.25, -w * 0.5, -h * 0.7, shine, 2);
    c.restore();
  };
  shard(-14, 6.5, -6, 24, -0.38, '#e7f5ff', '#b7dcf7');
  shard(14, 6.5, -10, 24, 0.36, '#e7f5ff', '#b7dcf7');
  shard(0, 9, -24, 25, 0, '#f4fbff', '#c9e6fb');
  E(c, 0, 25, 24, 4, '#9aa7b3', 2.2, '#3b5b78');
}
// топаз: оранжевый, прямоугольная огранка «ступеньками»
function gemTopaz(c) {
  const oct = (w, h, k) => [
    [-w + k, -h],
    [w - k, -h],
    [w, -h + k],
    [w, h - k],
    [w - k, h],
    [-w + k, h],
    [-w, h - k],
    [-w, -h + k],
  ];
  P(c, oct(25, 19, 9), '#f08c00', 3, '#8a4b00');
  P(c, oct(16, 10.5, 5), '#ffc34d', 1.6, '#b86a00');
  for (const [x1, y1, x2, y2] of [
    [-16, -10.5, -25, -19],
    [16, -10.5, 25, -19],
    [-16, 10.5, -25, 19],
    [16, 10.5, 25, 19],
  ])
    L(c, x1 * 0.98, y1 * 0.98, x2 * 0.86, y2 * 0.86, '#b86a00', 1.6);
  P(
    c,
    [
      [-12, -7],
      [-2, -7],
      [-9, 4],
      [-12, 4],
    ],
    'rgba(255,255,255,.55)',
    0,
    null,
  );
}
// сапфир: синий, круглая огранка со звёздочкой граней
function gemSapphire(c) {
  E(c, 0, 0, 24, 24, '#1c7ed6', 3, '#123a73');
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push([Math.cos((i / 8) * TAU + 0.39) * 13, Math.sin((i / 8) * TAU + 0.39) * 13]);
  P(c, pts, '#4dabf7', 1.6, '#1864ab');
  for (const [x, y] of pts) L(c, x, y, x * 1.78, y * 1.78, '#1864ab', 1.6);
  P(
    c,
    [
      [-8, -9],
      [1, -10],
      [-3, -1],
      [-9, -2],
    ],
    'rgba(255,255,255,.6)',
    0,
    null,
  );
}
// рубин: красный, «бриллиантом» в профиль — плоский верх и острый низ
function gemRuby(c) {
  P(
    c,
    [
      [-15, -20],
      [15, -20],
      [27, -6],
      [0, 26],
      [-27, -6],
    ],
    '#e03131',
    3,
    '#7a1212',
  );
  P(
    c,
    [
      [-27, -6],
      [27, -6],
      [0, 26],
    ],
    '#c92a2a',
    0,
    null,
  );
  L(c, -27, -6, 27, -6, '#7a1212', 1.8);
  for (const [x1, y1, x2, y2] of [
    [-15, -20, -9, -6],
    [15, -20, 9, -6],
    [-9, -6, 0, 26],
    [9, -6, 0, 26],
    [-9, -6, 0, -20],
    [9, -6, 0, -20],
  ])
    L(c, x1, y1, x2, y2, '#7a1212', 1.5);
  P(
    c,
    [
      [-13, -17],
      [-3, -17],
      [-8, -9],
    ],
    'rgba(255,255,255,.6)',
    0,
    null,
  );
}

// ---------- пустыня ----------
// аммонит: каменная спираль с рёбрышками
function fossilShell(c) {
  E(c, 0, 1, 25, 24, '#c9b48f', 3, '#5c4a36');
  c.beginPath();
  for (let a = 0; a < 2.6 * TAU; a += 0.1) {
    const r = 24 - (a / (2.6 * TAU)) * 21,
      x = Math.cos(a - 0.6) * r,
      y = 1 + Math.sin(a - 0.6) * r * 0.96;
    a ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  fs(c, null, 2.6, '#5c4a36');
  // рёбрышки на внешнем витке
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    L(c, Math.cos(a) * 17.5, 1 + Math.sin(a) * 16.5, Math.cos(a) * 23, 1 + Math.sin(a) * 22, '#8c7556', 1.8);
  }
  E(c, 1, 1, 3, 3, '#8c7556', 0, null);
}
// отпечаток листа на плоском камне
function fossilLeaf(c) {
  P(
    c,
    [
      [-25, -10],
      [-12, -23],
      [14, -22],
      [27, -6],
      [22, 17],
      [2, 25],
      [-20, 19],
    ],
    '#b9a88f',
    3,
    '#5c4a36',
  );
  c.save();
  c.rotate(-0.6);
  c.beginPath();
  c.moveTo(-20, 0);
  c.quadraticCurveTo(0, -17, 20, 0);
  c.quadraticCurveTo(0, 17, -20, 0);
  c.closePath();
  fs(c, '#7d6a50', 1.8, '#5c4a36');
  L(c, -22, 0, 18, 0, '#4d3d2b', 1.8);
  for (const x of [-10, -2, 6]) {
    L(c, x, 0, x + 6, -6.5, '#4d3d2b', 1.4);
    L(c, x, 0, x + 6, 6.5, '#4d3d2b', 1.4);
  }
  c.restore();
}
// зуб древнего ящера: большой изогнутый клык с зазубринами
function fossilTooth(c) {
  c.beginPath();
  c.moveTo(-17, -22);
  c.lineTo(13, -24);
  c.bezierCurveTo(17, -2, 12, 16, -8, 27);
  c.bezierCurveTo(-4, 8, -12, -4, -17, -22);
  c.closePath();
  fs(c, '#fff4d8', 3, '#5c4a36');
  // корень
  c.beginPath();
  c.moveTo(-19, -24);
  c.quadraticCurveTo(-2, -31, 15, -26);
  c.lineTo(13, -15);
  c.quadraticCurveTo(-2, -11, -16, -14);
  c.closePath();
  fs(c, '#b58b5a', 2.6, '#5c4a36');
  for (const [x, y] of [
    [10, -6],
    [8, 3],
    [4, 11],
    [-1, 18],
  ])
    L(c, x, y, x + 4.5, y + 1.5, '#5c4a36', 1.6);
  L(c, -8, -8, -5, 6, '#e3cfa3', 2.2);
}
// косточка динозавра
function fossilBone(c) {
  c.save();
  c.rotate(-0.72);
  // стержень и четыре «шишечки»: сначала всё контуром (чуть крупнее), потом цветом — получается одна фигура
  const shape = (grow, col) => {
    c.fillStyle = col;
    c.fillRect(-19, -5 - grow, 38, 10 + grow * 2);
    for (const [x, y] of [
      [-20, -7],
      [-20, 7],
      [20, -7],
      [20, 7],
    ]) {
      c.beginPath();
      c.arc(x, y, 7.5 + grow, 0, TAU);
      c.fill();
    }
  };
  shape(2.8, '#5c4a36');
  shape(0, '#f1e3c4');
  L(c, -12, -1.5, 10, -1.5, '#fffaf0', 2.2);
  L(c, 2, 2.5, 8, 2.5, '#cbb48a', 1.6);
  E(c, -21, -8, 2.2, 2.2, '#fffaf0', 0, null);
  c.restore();
}
// плод кактуса: малиновая «груша» с пучками колючек и венчиком
function cactusFruit(c) {
  // кусочек зелёной лепёшки снизу
  c.beginPath();
  c.ellipse(0, 28, 19, 9, 0, Math.PI, TAU);
  c.closePath();
  fs(c, '#69b34c', 2.6);
  c.beginPath();
  c.moveTo(0, 21);
  c.bezierCurveTo(-21, 19, -20, -15, -8, -21);
  c.lineTo(8, -21);
  c.bezierCurveTo(20, -15, 21, 19, 0, 21);
  c.closePath();
  fs(c, '#e64980', 3, '#7a1f44');
  // венчик
  P(
    c,
    [
      [-9, -21],
      [-6, -27],
      [-3, -22],
      [0, -28],
      [3, -22],
      [6, -27],
      [9, -21],
    ],
    '#c2255c',
    2.2,
    '#7a1f44',
  );
  for (const [x, y] of [
    [-8, -9],
    [5, -11],
    [-2, 0],
    [9, 3],
    [-10, 8],
    [2, 12],
  ]) {
    E(c, x, y, 2, 2, '#ffd8e4', 0, null);
    L(c, x - 3, y - 3, x + 3, y + 3, '#fff5f8', 1);
    L(c, x - 3, y + 3, x + 3, y - 3, '#fff5f8', 1);
  }
  E(c, -9, -13, 3.5, 6, 'rgba(255,255,255,.3)', 0, null, 0.4);
}

// ---------- джунгли ----------
// перо попугая: цвет пера и цвет кончика — у каждого попугая свой
function feather(c, col, dark, tip) {
  c.save();
  c.rotate(0.72);
  c.scale(1.3, 1.08);
  // стержень
  L(c, 0, 30, 0, -24, '#f8f0e0', 3.4);
  const vane = () => {
    c.beginPath();
    c.moveTo(0, 20);
    c.bezierCurveTo(-17, 12, -15, -18, 0, -29);
    c.bezierCurveTo(15, -18, 17, 12, 0, 20);
    c.closePath();
  };
  vane();
  fs(c, col, 3, dark);
  c.save();
  vane();
  c.clip();
  c.fillStyle = tip;
  c.fillRect(-20, -32, 40, 14);
  // бородки
  for (let y = -22; y < 20; y += 6) {
    L(c, 0, y + 5, -15, y - 3, dark, 1.2);
    L(c, 0, y + 5, 15, y - 3, dark, 1.2);
  }
  c.restore();
  // «расщеп» на опахале
  P(
    c,
    [
      [10.5, -3],
      [16, 0],
      [11, 3],
    ],
    '#fff',
    0,
    null,
  );
  vane();
  fs(c, null, 3, dark);
  L(c, 0, 30, 0, -22, '#fff8e8', 2);
  c.restore();
}
// маракуйя: целый тёмно-лиловый плод и половинка с жёлтой мякотью и семечками
function passionfruit(c) {
  // листик и хвостик
  L(c, -12, -17, -9, -25, '#5c7a2c', 3);
  c.save();
  c.translate(-7, -24);
  c.rotate(-0.4);
  E(c, 8, 0, 9, 4.5, '#69b34c', 2.2);
  c.restore();
  E(c, -9, 0, 18, 18, '#6b2d73', 3, '#3d1642');
  E(c, -15, -7, 5, 3.2, 'rgba(255,255,255,.35)', 0, null, -0.6);
  for (const [x, y] of [
    [-18, 6],
    [-8, 11],
    [-3, -9],
  ])
    E(c, x, y, 1.3, 1.3, '#9b59a8', 0, null);
  // половинка
  E(c, 12, 9, 17, 17, '#7b3585', 3, '#3d1642');
  E(c, 12, 9, 13, 13, '#fff3bf', 0, null);
  E(c, 12, 9, 10.5, 10.5, '#ffb629', 0, null);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3,
      x = 12 + Math.cos(a) * 6,
      y = 9 + Math.sin(a) * 6;
    E(c, x, y, 2.1, 1.4, '#2b1a12', 0, null, a);
  }
  E(c, 12, 9, 1.8, 1.4, '#2b1a12', 0, null);
}

// ---------- секретный пляж ----------
// розовая ракушка-гребешок: веер с рёбрышками
function shellPink(c) {
  c.beginPath();
  c.moveTo(-7, 22);
  c.lineTo(-25, 2);
  c.bezierCurveTo(-27, -28, 27, -28, 25, 2);
  c.lineTo(7, 22);
  c.closePath();
  fs(c, '#ff8fab', 3, '#8a2f4b');
  for (const a of [-1.05, -0.62, -0.2, 0.2, 0.62, 1.05])
    L(c, 0, 20, Math.sin(a) * 31, 20 - Math.cos(a) * 40, '#d9486e', 1.8);
  // ушки
  P(
    c,
    [
      [-12, 17],
      [-9, 27],
      [9, 27],
      [12, 17],
    ],
    '#ffb3c6',
    2.6,
    '#8a2f4b',
  );
  c.beginPath();
  c.moveTo(-18, -8);
  c.quadraticCurveTo(0, -19, 18, -8);
  fs(c, null, 2.4, 'rgba(255,255,255,.6)');
}
// витая ракушка: высокая башенка-конус
function shellSpiral(c) {
  c.save();
  c.rotate(0.5);
  c.beginPath();
  c.moveTo(0, -30);
  c.bezierCurveTo(8, -18, 17, 2, 15, 16);
  c.quadraticCurveTo(13, 28, 0, 27);
  c.quadraticCurveTo(-15, 28, -15, 14);
  c.bezierCurveTo(-15, 2, -7, -18, 0, -30);
  c.closePath();
  fs(c, '#f4c27a', 3, '#7a4e1c');
  // витки
  for (const [y, w, d] of [
    [-17, 5, 2],
    [-8, 9, 3],
    [2, 13, 4],
    [13, 15.5, 4],
  ]) {
    c.beginPath();
    c.moveTo(-w, y - d);
    c.quadraticCurveTo(0, y + d * 2.2, w, y - d + 2);
    fs(c, null, 2.2, '#a8672a');
  }
  // устье
  E(c, 4, 19, 7, 5, '#ffe3c2', 2, '#7a4e1c', -0.3);
  L(c, -7, -4, -9, 6, 'rgba(255,255,255,.7)', 2.4);
  c.restore();
}
// ракушка-солнышко: круглая, с лучами-шипами
function shellSun(c) {
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU - Math.PI / 2,
      r = i % 2 ? 19 : 29;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  P(c, pts, '#ffd43b', 3, '#8a5a00');
  E(c, 0, 0, 17, 17, '#ffe27a', 2, '#b8860b');
  // спиралька в серединке
  c.beginPath();
  for (let a = 0; a < 2.2 * TAU; a += 0.15) {
    const r = 13 - (a / (2.2 * TAU)) * 11.5;
    a ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  fs(c, null, 2.2, '#e08a00');
}

// ---------- удалённый остров ----------
// вулканическое стекло: чёрный блестящий осколок с острыми гранями
function obsidian(c) {
  P(
    c,
    [
      [-6, -27],
      [14, -19],
      [26, 4],
      [15, 24],
      [-12, 26],
      [-26, 8],
      [-20, -12],
    ],
    '#2b2d33',
    3,
    '#0f1013',
  );
  P(
    c,
    [
      [-6, -27],
      [14, -19],
      [2, -4],
      [-20, -12],
    ],
    '#4b4f5c',
    0,
    null,
  );
  P(
    c,
    [
      [2, -4],
      [14, -19],
      [26, 4],
      [15, 24],
    ],
    '#1b1c21',
    0,
    null,
  );
  for (const [x1, y1, x2, y2] of [
    [2, -4, -12, 26],
    [2, -4, -26, 8],
    [2, -4, 15, 24],
    [2, -4, 14, -19],
    [2, -4, -20, -12],
  ])
    L(c, x1, y1, x2, y2, '#0f1013', 1.4);
  P(
    c,
    [
      [-12, -19],
      [-2, -22],
      [-7, -12],
    ],
    '#dfe6ff',
    0,
    null,
  );
  L(c, -17, 6, -9, 17, '#9aa5d6', 2.4);
  E(c, 12, 2, 2, 2, '#c5b3ff', 0, null);
}
// плюмерия: пять округлых белых лепестков «вертушкой» с жёлтой серединкой
function plumeria(c) {
  for (let i = 0; i < 5; i++) {
    c.save();
    c.rotate((i / 5) * TAU - Math.PI / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(6, -14, 30, -12, 27, 3);
    c.bezierCurveTo(24, 13, 8, 9, 0, 0);
    c.closePath();
    const g = c.createLinearGradient(0, 0, 26, 0);
    g.addColorStop(0, '#ffd43b');
    g.addColorStop(0.45, '#fff8e1');
    g.addColorStop(1, '#ffffff');
    fs(c, g, 2.4, '#9a7b4a');
    c.restore();
  }
  E(c, 0, 0, 4, 4, '#f59f00', 0, null);
}
// гибискус: пять широких красных лепестков и длинный жёлтый пестик
function hibiscus(c) {
  for (let i = 0; i < 5; i++) {
    c.save();
    c.rotate((i / 5) * TAU - Math.PI / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(8, -19, 28, -17, 28, -5);
    c.quadraticCurveTo(24, 0, 28, 6);
    c.bezierCurveTo(27, 17, 8, 17, 0, 0);
    c.closePath();
    fs(c, '#f03e3e', 2.6, '#7a1212');
    L(c, 5, 0, 20, 0, '#c92a2a', 1.6);
    c.restore();
  }
  E(c, 0, 0, 6, 6, '#a61e4d', 0, null);
  // пестик торчит вперёд и вбок
  L(c, 0, 0, 13, -17, '#7a1212', 5.4);
  L(c, 0, 0, 13, -17, '#ffd43b', 3);
  for (const [x, y] of [
    [13, -18],
    [17, -14],
    [9, -21],
    [16, -21],
  ])
    E(c, x, y, 2.4, 2.4, '#ffe066', 1.2, '#b8860b');
}
// орхидея: «бабочка» — три узких чашелистика, два широких лепестка и пятнистая губа
function orchid(c) {
  const petal = (a, len, w, col) => {
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.3, -w, len * 0.9, -w * 0.8, len, 0);
    c.bezierCurveTo(len * 0.9, w * 0.8, len * 0.3, w, 0, 0);
    c.closePath();
    fs(c, col, 2.4, '#6b2a8a');
    c.restore();
  };
  // чашелистики: вверх и вниз в стороны
  petal(-Math.PI / 2, 28, 7.5, '#e599f7');
  petal(0.95, 26, 7.5, '#e599f7');
  petal(Math.PI - 0.95, 26, 7.5, '#e599f7');
  // широкие боковые лепестки
  petal(-0.25, 27, 15, '#da77f2');
  petal(Math.PI + 0.25, 27, 15, '#da77f2');
  // губа
  c.beginPath();
  c.moveTo(-7, 3);
  c.bezierCurveTo(-14, 16, -6, 25, 0, 20);
  c.bezierCurveTo(6, 25, 14, 16, 7, 3);
  c.closePath();
  fs(c, '#ae3ec9', 2.4, '#5a1a70');
  for (const [x, y] of [
    [-4, 12],
    [4, 12],
    [0, 17],
  ])
    E(c, x, y, 1.5, 1.5, '#ffd43b', 0, null);
  E(c, 0, 1, 5, 5, '#fff3bf', 2, '#6b2a8a');
  E(c, 0, 1, 1.8, 1.8, '#f59f00', 0, null);
}
// кусочек карты сокровищ: обрывок пергамента с пунктиром и крестиком
function mapPiece(c) {
  P(
    c,
    [
      [-25, -18],
      [-8, -23],
      [4, -17],
      [24, -22],
      [26, 4],
      [20, 9],
      [25, 20],
      [6, 17],
      [-6, 24],
      [-24, 18],
      [-20, 2],
      [-27, -6],
    ],
    '#f3dfb0',
    3,
    '#7a5a2a',
  );
  c.setLineDash([4, 4]);
  c.beginPath();
  c.moveTo(-17, 11);
  c.quadraticCurveTo(-12, -8, 0, -2);
  c.quadraticCurveTo(8, 2, 11, -6);
  fs(c, null, 2.4, '#8a5a2a');
  c.setLineDash([]);
  L(c, 9, -13, 18, -4, '#e03131', 3.4);
  L(c, 18, -13, 9, -4, '#e03131', 3.4);
  E(c, -17, 12, 2.6, 2.6, '#1c7ed6', 0, null);
  L(c, 2, 9, 14, 12, '#c9a86a', 2);
}

// ---------- блюда ----------
// стопка блинов на тарелке; сверху — top(c): варенье с ягодкой или мёд с кусочком масла
function blini(c, top) {
  E(c, 0, 20, 28, 7, '#fff', 2.6, '#6b7a8a');
  E(c, 0, 19, 19, 3.5, '#e9eef3', 0, null);
  for (let i = 0; i < 5; i++) {
    const y = 15 - i * 6;
    E(c, i % 2 ? 1.5 : -1.5, y, 22, 6.5, i % 2 ? '#f4b942' : '#f7c65a', 2.4, '#8a5a12');
  }
  // румяные пятнышки на верхнем блине
  for (const [x, y, r] of [
    [-12, -10, 3],
    [11, -8, 2.4],
    [-2, -6, 2],
  ])
    E(c, x, y, r, r * 0.45, '#d98e1f', 0, null);
  top(c);
}
function bliniJam(c) {
  blini(c, () => {
    // варенье растеклось и капает с краю
    c.beginPath();
    c.moveTo(-15, -11);
    c.bezierCurveTo(-14, -18, 13, -18, 15, -11);
    c.bezierCurveTo(15, -4, 12, 2, 10, -5);
    c.bezierCurveTo(6, -4, -2, -5, -6, -5);
    c.bezierCurveTo(-8, 4, -13, 2, -11, -6);
    c.quadraticCurveTo(-15, -8, -15, -11);
    c.closePath();
    fs(c, '#d6336c', 2.2, '#7a1235');
    E(c, -5, -12, 4, 1.6, 'rgba(255,255,255,.5)', 0, null);
    // ягодка клубники
    c.beginPath();
    c.moveTo(-6, -22);
    c.quadraticCurveTo(0, -27, 7, -22);
    c.quadraticCurveTo(6, -13, 0.5, -10);
    c.quadraticCurveTo(-5, -13, -6, -22);
    c.closePath();
    fs(c, '#fa5252', 2.2, '#7a1212');
    P(
      c,
      [
        [-5, -23],
        [0, -27],
        [6, -23],
        [0.5, -20],
      ],
      '#51cf66',
      1.6,
      '#2b6b2f',
    );
  });
}
function bliniHoney(c) {
  blini(c, () => {
    c.beginPath();
    c.moveTo(-16, -11);
    c.bezierCurveTo(-14, -18, 14, -18, 16, -11);
    c.bezierCurveTo(17, -2, 12, 6, 10, -4);
    c.bezierCurveTo(4, -3, -8, -4, -16, -11);
    c.closePath();
    fs(c, '#ffb300', 2.2, '#9a5b00');
    E(c, -6, -12, 4.5, 1.6, 'rgba(255,255,255,.6)', 0, null);
    // кубик масла
    P(
      c,
      [
        [-7, -20],
        [3, -23],
        [9, -19],
        [8, -13],
        [-2, -10],
        [-8, -14],
      ],
      '#fff3bf',
      2.2,
      '#9a7b1a',
    );
    L(c, -7, -20, -1, -16, '#c9a93a', 1.4);
    L(c, -1, -16, 9, -19, '#c9a93a', 1.4);
    L(c, -1, -16, -2, -10, '#c9a93a', 1.4);
  });
}
// баночка лесного варенья под тканевой крышечкой
function jam(c) {
  c.beginPath();
  c.moveTo(-17, -8);
  c.quadraticCurveTo(-21, -4, -21, 4);
  c.lineTo(-21, 19);
  c.quadraticCurveTo(-21, 26, -14, 26);
  c.lineTo(14, 26);
  c.quadraticCurveTo(21, 26, 21, 19);
  c.lineTo(21, 4);
  c.quadraticCurveTo(21, -4, 17, -8);
  c.closePath();
  fs(c, '#a61e4d', 3, '#4a1024');
  // этикетка с ягодкой
  c.beginPath();
  c.rect(-13, 2, 26, 16);
  fs(c, '#fff8e1', 1.8, '#4a1024');
  E(c, -3, 10, 4, 4, '#4263eb', 0, null);
  E(c, 4, 10, 4, 4.5, '#fa5252', 0, null);
  L(c, -17, -1, -17, 20, 'rgba(255,255,255,.45)', 2.6);
  // крышечка в клеточку, перевязанная верёвочкой
  c.beginPath();
  c.moveTo(-22, -6);
  c.quadraticCurveTo(-24, -22, 0, -24);
  c.quadraticCurveTo(24, -22, 22, -6);
  c.quadraticCurveTo(11, -11, 0, -7);
  c.quadraticCurveTo(-11, -11, -22, -6);
  c.closePath();
  fs(c, '#ff8787', 2.8, '#7a1212');
  for (const x of [-12, -4, 4, 12]) L(c, x, -22, x * 1.25, -9, 'rgba(255,255,255,.75)', 1.8);
  L(c, -20, -13, 20, -13, '#fff8e1', 2.4);
}
// миска орешков, политых мёдом
function honeyNuts(c) {
  // орешки горкой
  for (const [x, y, a] of [
    [-12, -6, 0.3],
    [10, -7, -0.4],
    [-1, -14, 0],
    [-19, 1, 0.6],
    [18, 0, -0.5],
    [3, -3, 0.2],
  ]) {
    E(c, x, y, 8, 6.5, '#c98a4b', 2.2, '#5c3a17', a);
    E(c, x - 2, y - 2, 2.6, 1.4, 'rgba(255,255,255,.4)', 0, null, a);
  }
  // мёд сверху и каплями
  c.beginPath();
  c.moveTo(-13, -15);
  c.bezierCurveTo(-8, -24, 10, -24, 14, -14);
  c.bezierCurveTo(14, -6, 10, -4, 8, -11);
  c.bezierCurveTo(4, -9, 0, -2, -3, -11);
  c.bezierCurveTo(-7, -9, -11, -6, -13, -15);
  c.closePath();
  fs(c, '#ffb300', 2, '#9a5b00');
  E(c, -3, -18, 4, 1.5, 'rgba(255,255,255,.6)', 0, null);
  // миска
  c.beginPath();
  c.moveTo(-27, 3);
  c.lineTo(27, 3);
  c.bezierCurveTo(26, 22, 14, 27, 0, 27);
  c.bezierCurveTo(-14, 27, -26, 22, -27, 3);
  c.closePath();
  fs(c, '#74c0fc', 3, '#1c4f7a');
  L(c, -19, 10, -14, 19, 'rgba(255,255,255,.6)', 2.6);
  L(c, -27, 3, 27, 3, '#1c4f7a', 3);
}
// земляника в миске с молоком
function berryBowl(c) {
  E(c, 0, 3, 26, 8, '#fffdf5', 0, null);
  // ягоды
  for (const [x, y, s] of [
    [-12, -3, 1],
    [9, -5, 1.05],
    [-1, -11, 1.1],
  ]) {
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    c.beginPath();
    c.moveTo(-8, -5);
    c.quadraticCurveTo(0, -11, 8, -5);
    c.quadraticCurveTo(7, 6, 0, 10);
    c.quadraticCurveTo(-7, 6, -8, -5);
    c.closePath();
    fs(c, '#fa5252', 2.2, '#7a1212');
    for (const [dx, dy] of [
      [-3, -1],
      [3, -2],
      [0, 4],
    ])
      E(c, dx, dy, 0.9, 1.3, '#ffe066', 0, null);
    P(
      c,
      [
        [-6, -7],
        [-2, -11],
        [0, -8],
        [3, -12],
        [6, -7],
        [0, -4],
      ],
      '#51cf66',
      1.6,
      '#2b6b2f',
    );
    c.restore();
  }
  // миска
  c.beginPath();
  c.moveTo(-27, 3);
  c.lineTo(27, 3);
  c.bezierCurveTo(26, 22, 14, 27, 0, 27);
  c.bezierCurveTo(-14, 27, -26, 22, -27, 3);
  c.closePath();
  fs(c, '#ffc9de', 3, '#8a2f4b');
  L(c, -19, 10, -14, 19, 'rgba(255,255,255,.7)', 2.6);
  // молоко у края и капля мёда
  c.beginPath();
  c.moveTo(-25, 3);
  c.quadraticCurveTo(-12, 9, 0, 4);
  c.quadraticCurveTo(12, 9, 25, 3);
  c.closePath();
  fs(c, '#ffffff', 0, null);
  L(c, -27, 3, 27, 3, '#8a2f4b', 3);
  E(c, 16, -15, 3.2, 4.2, '#ffb300', 1.6, '#9a5b00');
}
// морс из маракуйи: стакан с лиловым напитком, трубочкой и долькой
function passionDrink(c) {
  // трубочка
  L(c, 5, -4, 15, -29, '#4a3728', 6.4);
  L(c, 5, -4, 15, -29, '#ff8787', 3.6);
  // стакан
  const glass = () => {
    c.beginPath();
    c.moveTo(-17, -17);
    c.lineTo(17, -17);
    c.lineTo(12, 25);
    c.quadraticCurveTo(0, 28, -12, 25);
    c.closePath();
  };
  glass();
  fs(c, '#f3f0ff', 0, null);
  c.save();
  glass();
  c.clip();
  c.fillStyle = '#b05cc4';
  c.fillRect(-20, -9, 40, 40);
  c.fillStyle = '#ffb629';
  c.fillRect(-20, 15, 40, 14);
  for (const [x, y] of [
    [-6, 19],
    [4, 21],
    [0, 8],
    [-8, 2],
  ])
    E(c, x, y, 1.8, 1.3, '#2b1a12', 0, null, 0.5);
  L(c, -11, -6, -8, 20, 'rgba(255,255,255,.55)', 3);
  c.restore();
  glass();
  fs(c, null, 3, '#4a3070');
  // долька маракуйи на краю
  E(c, -15, -18, 10, 10, '#7b3585', 2.4, '#3d1642');
  E(c, -15, -18, 6.5, 6.5, '#ffb629', 0, null);
  for (let i = 0; i < 5; i++) E(c, -15 + Math.cos(i * 1.26) * 3.4, -18 + Math.sin(i * 1.26) * 3.4, 1.3, 0.9, '#2b1a12', 0, null, i * 1.26);
}

export const ITEM_ART = {
  cone,
  porcini,
  edelweiss,
  glow_shroom: glowShroom,
  gem_crystal: gemCrystal,
  gem_topaz: gemTopaz,
  gem_sapphire: gemSapphire,
  gem_ruby: gemRuby,
  fossil_shell: fossilShell,
  fossil_leaf: fossilLeaf,
  fossil_tooth: fossilTooth,
  fossil_bone: fossilBone,
  cactus_fruit: cactusFruit,
  feather_red: (c) => feather(c, '#e03131', '#7a1212', '#ffd43b'),
  feather_blue: (c) => feather(c, '#1c7ed6', '#123a73', '#66d9e8'),
  feather_yellow: (c) => feather(c, '#fcc419', '#8a5a00', '#69db7c'),
  shell_pink: shellPink,
  shell_spiral: shellSpiral,
  shell_sun: shellSun,
  obsidian,
  flower_plumeria: plumeria,
  flower_hibiscus: hibiscus,
  flower_orchid: orchid,
  passionfruit,
  map_piece: mapPiece,
  blini_jam: bliniJam,
  blini_honey: bliniHoney,
  jam,
  honey_nuts: honeyNuts,
  berry_bowl: berryBowl,
  passion_drink: passionDrink,
};

// ---------- кэш картинок ----------
const SIZES = [24, 48, 96, 192, 384]; // стороны картинок в пикселях экрана: берётся ближайшая не меньше нужной
const cache = new Map();
/** Canvas со значком: сторона px пикселей (одна из SIZES). */
function sprite(name, px) {
  const key = name + '@' + px;
  let cv = cache.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.translate(px / 2, px / 2);
    c.scale(px / 64, px / 64);
    ITEM_ART[name](c);
    cache.set(key, cv);
  }
  return cv;
}
/** Есть ли у значка рисунок. */
export const hasItemArt = (name) => !!ITEM_ART[name];
/**
 * Нарисовать значок вещи на канве: центр (x, y), size — как размер эмодзи (значок чуть крупнее буквы — 1,15 size).
 * Сколько пикселей экрана займёт значок, берётся из текущего масштаба канвы — картинка всегда чёткая.
 */
export function drawItemIcon(ctx, name, x, y, size) {
  const m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0 },
    k = Math.hypot(m.a, m.b) || 1,
    side = size * 1.15,
    need = side * k,
    px = SIZES.find((s) => s >= need) || SIZES[SIZES.length - 1];
  const smooth = ctx.imageSmoothingQuality;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sprite(name, px), x - side / 2, y - side / 2, side, side);
  ctx.imageSmoothingQuality = smooth;
}
const urls = new Map();
/** Картинка значка для страницы (data:URL, 192 пикселя — чётко до 64 px на экране с плотностью 3). */
export function itemIconURL(name) {
  if (!urls.has(name)) urls.set(name, sprite(name, 192).toDataURL('image/png'));
  return urls.get(name);
}

// emoji() из core/draw.js: буква-значок → рисунок
setIconArt((ctx, ch, x, y, size) => {
  const name = iconName(ch);
  if (!name || !ITEM_ART[name]) return false;
  drawItemIcon(ctx, name, x, y, size);
  return true;
});
