// ПЕЩЕРЫ (П.9): рисунки клеток и предметов, которые есть только в пещерах. Где что стоит — locations/caves.js.
// Всё неподвижное — в кэше спрайтов (art + put); вариант — параметрами put. Шевелится (блики на озере, летучие мыши)
// — линиями поверх, каждый кадр одним путём. Стиль — как у города, леса и горы (common/paint.js): контур OUT, объём
// в 2–3 тона, свет слева сверху. Темноту и пятна света рисует не этот файл, а крюк gloom локации (слой неба).
//
// Клетки:  caveFloor — каменный пол (камешки, трещинки, лужицы), caveWall — толща скалы (сверху — тёмный камень),
//          caveLake — подземное озеро (не зайти; у северного берега отражаются сталактиты), caveMouth — светлый
//          пол у выхода наружу (туда падает дневной свет).
// Предметы: caveFace (стена скалы «лицом» к нам, со сталактитами — ставится на клетку скалы над полом), paintWall
//          (та же стена с древними рисунками хомяков), stalagmite (сталагмит), column (колонна — сталактит
//          и сталагмит срослись), crystals (друза кристаллов, светится), glowShroom (светящиеся грибы — украшение,
//          светятся сами), caveLantern (фонарь Камушкина на столбе), minecart (вагонетка с самоцветами), rails.
// Рисунки для крюка things: bat (летучая мышь: висит / машет крыльями), pick (кирка Камушкина), shroomBig
//          (светящийся гриб, который можно сорвать).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { T, OUT, put, hash, defineTiles, defineObjects, defineArt } from '../engine/topdown/index.js';
import { shadow, WOOD, WOOD_D } from './common/paint.js';

const ROCK = '#4a4152',
  ROCK_D = '#383040',
  ROCK_L = '#62586a',
  FLOOR = '#7b6e66',
  FLOOR_D = '#6b5f58';

// ---------- клетки ----------
/** Камешки, трещинки, редкие лужицы и искорки минералов на полу пещеры. */
function floorDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.55) ell(ctx, x + r(2) * T, y + r(3) * T, 10 + r(4) * 10, 6 + r(5) * 4, 'rgba(60,50,45,.18)');
  if (r(6) < 0.5) {
    const cx = x + 6 + r(7) * 34,
      cy = y + 8 + r(8) * 30;
    ell(ctx, cx, cy, 3 + r(9) * 2.5, 2.2 + r(9) * 1.5, '#8f8279', 'rgba(60,45,40,.5)', 1);
    ell(ctx, cx + 7, cy + 5, 2, 1.5, '#8f8279', 'rgba(60,45,40,.45)', 0.8);
  }
  if (r(10) < 0.3) {
    ctx.strokeStyle = 'rgba(50,40,38,.35)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const sx = x + r(11) * T,
      sy = y + r(12) * T;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 8, sy + 3 + r(13) * 4);
    ctx.lineTo(sx + 15, sy + 1);
    ctx.stroke();
  }
  if (r(14) < 0.07)
    ell(ctx, x + 10 + r(15) * 28, y + 12 + r(16) * 24, 9, 4, 'rgba(110,170,200,.35)', 'rgba(60,90,110,.3)', 1);
  if (r(17) < 0.25) {
    ctx.fillStyle = 'rgba(200,180,255,.55)';
    ctx.fillRect(x + r(18) * T, y + r(19) * T, 1.6, 1.6);
  }
}
/** Сверху скала: тёмный камень с трещинами и прожилками. */
function wallDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.5) ell(ctx, x + r(2) * T, y + r(3) * T, 14 + r(4) * 10, 8 + r(5) * 5, 'rgba(255,255,255,.04)');
  if (r(6) < 0.35) {
    ctx.strokeStyle = 'rgba(20,14,26,.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const sx = x + r(7) * T,
      sy = y + r(8) * T;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 10, sy + 6);
    ctx.lineTo(sx + 14, sy + 16);
    ctx.stroke();
  }
  if (r(9) < 0.12) {
    ctx.fillStyle = 'rgba(180,160,255,.35)';
    ctx.fillRect(x + r(10) * T, y + r(11) * T, 2, 2);
  }
}
/** Озеро: тёмная гладкая вода; у северного берега — перевёрнутые отражения сталактитов. */
function lakeDeco(ctx, x, y, tx, ty, env, r) {
  const m = env.map;
  if (r(1) < 0.4) ell(ctx, x + r(2) * T, y + r(3) * T, 14 + r(4) * 10, 3, 'rgba(255,255,255,.06)');
  if (m && m.at(tx, ty - 1) !== 'caveLake') {
    // отражения сталактитов и бережка: тёмные «зубчики» вниз от берега
    ctx.fillStyle = 'rgba(10,20,35,.45)';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const cx = x + 6 + i * 15 + r(5 + i) * 6,
        l = 10 + r(8 + i) * 18;
      ctx.moveTo(cx - 5, y + 2);
      ctx.lineTo(cx, y + 2 + l);
      ctx.lineTo(cx + 5, y + 2);
    }
    ctx.fill();
  }
}
/** Блики на озере: дрожащие светлые чёрточки (один путь на весь экран). */
function lakeLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(160,220,255,.4)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T,
      h = hash(cells[i], cells[i + 1]);
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.25 + h * 3 + k * 0.5) % 1,
        bx = x + 6 + hash(cells[i + 1] + k, cells[i] * 3) * 30,
        by = y + 10 + k * 18 + Math.sin(t * 1.3 + h * 6) * 2,
        w = 5 + Math.sin(ph * Math.PI) * 9;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + w, by);
    }
  }
  ctx.stroke();
}
/** Светлый пол у выхода: снег, занесённый ветром, и камешки. */
function mouthDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.5) ell(ctx, x + r(2) * T, y + r(3) * T, 10 + r(4) * 8, 4, '#ffffff');
  if (r(5) < 0.4) ell(ctx, x + r(6) * T, y + r(7) * T, 3, 2, '#9aa3ad', 'rgba(60,60,70,.4)', 0.8);
}
defineTiles({
  caveFloor: {
    map: '#7b6e66',
    z: 4.2,
    fill: FLOOR,
    edge: {
      wob: 7,
      out: [
        ['rgba(150,215,240,.3)', 9],
        ['#5b4f49', 4],
      ],
      in: [[FLOOR_D, 8]],
    },
    deco: floorDeco,
  },
  caveMouth: {
    map: '#d7dee4',
    step: 'stepSnow',
    z: 4.4,
    fill: '#cfd8df',
    edge: { wob: 8, in: [['#e6edf2', 8]] },
    deco: mouthDeco,
  },
  caveWall: {
    map: '#2e2734',
    walk: false,
    z: 7.6,
    fill: ROCK_D,
    edge: {
      wob: 8,
      out: [['rgba(15,10,25,.4)', 14]],
      in: [[ROCK, 7]],
    },
    deco: wallDeco,
  },
  caveLake: {
    map: '#2b6a8a',
    walk: false,
    wet: true,
    z: 0.6,
    fill: '#1d425a',
    edge: { wob: 8, in: [['rgba(120,200,235,.3)', 5]] },
    deco: lakeDeco,
    live: lakeLive,
  },
});

// ---------- стена скалы и сталактиты ----------
/** Сталактит: сосулька из камня, висит вниз от (x, y) длиной l. */
function stalactite(ctx, x, y, w, l) {
  poly(ctx, [x - w, y, x + w, y, x + w * 0.2, y + l * 0.85, x, y + l, x - w * 0.15, y + l * 0.8], ROCK_L, OUT, 1.6);
  line(ctx, x - w * 0.45, y + 3, x - w * 0.1, y + l * 0.6, 'rgba(255,255,255,.25)', 1.4);
}
/**
 * Стена скалы «лицом» к нам: от низа клетки скалы на полклетки вниз. v — 0 гладкая, 1 два сталактита, 2 длинный
 * сталактит и кристаллик, 3 трещина и прожилка; ends — 1: левый край закруглить, 2: правый, 3: оба.
 */
function paintFace(ctx, v, ends) {
  const l = ends & 1,
    r = ends & 2,
    y0 = 4,
    y1 = 38;
  ctx.fillStyle = 'rgba(15,10,20,.28)';
  ctx.fillRect(-24 + (l ? 6 : 0), y1, 48 - (l ? 6 : 0) - (r ? 6 : 0), 7);
  ctx.beginPath();
  ctx.moveTo(-25, y0);
  ctx.lineTo(25, y0);
  if (r) ctx.quadraticCurveTo(26, y1 - 4, 16, y1);
  else ctx.lineTo(25, y1);
  ctx.lineTo(l ? -16 : -25, y1);
  if (l) ctx.quadraticCurveTo(-26, y1 - 4, -25, y0);
  ctx.closePath();
  ctx.fillStyle = ROCK;
  ctx.fill();
  // слои породы
  ctx.strokeStyle = 'rgba(20,14,26,.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const yy of [14, 25]) {
    ctx.moveTo(-24, yy + (v % 2) * 2);
    ctx.quadraticCurveTo(0, yy + 4 - v, 24, yy + ((v + 1) % 2) * 2);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fillRect(-24, y0, 48, 4);
  line(ctx, -25, y1, 25, y1, OUT, 1.6);
  if (v === 1) {
    stalactite(ctx, -10, y1 - 2, 5, 16);
    stalactite(ctx, 10, y1 - 2, 4, 11);
  } else if (v === 2) {
    stalactite(ctx, 2, y1 - 2, 6, 22);
    poly(ctx, [-16, y1 - 12, -12, y1 - 22, -8, y1 - 12], '#b197fc', OUT, 1.2);
  } else if (v === 3) {
    line(ctx, -6, y0 + 4, 2, y1 - 6, 'rgba(20,14,26,.5)', 1.5);
    line(ctx, 8, y0 + 8, 18, y0 + 20, 'rgba(255,212,59,.35)', 2);
  }
}
/** Древние рисунки хомяков (охра и уголь на светлом камне): p — какой кусок стены (0–4). */
function paintCaveArt(ctx, p) {
  paintFace(ctx, 0, p === 0 ? 1 : p === 4 ? 2 : 0);
  ell(ctx, 0, 21, 22, 14, 'rgba(230,205,170,.28)');
  const ink = '#c4572e',
    soot = '#2b2026';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hamster = (x, y, s, col) => {
    ell(ctx, x, y, 7 * s, 5 * s, col);
    ell(ctx, x + 6 * s, y - 4 * s, 4 * s, 3.5 * s, col);
    ell(ctx, x + 5 * s, y - 8 * s, 1.5 * s, 1.5 * s, col);
    line(ctx, x - 4 * s, y + 4 * s, x - 6 * s, y + 8 * s, col, 1.6 * s);
    line(ctx, x + 3 * s, y + 4 * s, x + 4 * s, y + 8 * s, col, 1.6 * s);
  };
  if (p === 0) {
    // солнце
    ell(ctx, 0, 18, 7, 7, null, ink, 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      line(ctx, Math.cos(a) * 10, 18 + Math.sin(a) * 10, Math.cos(a) * 14, 18 + Math.sin(a) * 14, ink, 1.8);
    }
  } else if (p === 1) {
    // хомячок бежит за огромной семечкой
    hamster(-8, 26, 1.1, soot);
    poly(ctx, [8, 30, 14, 12, 20, 30], ink);
    line(ctx, 14, 14, 14, 28, '#f1d3a0', 1.2);
  } else if (p === 2) {
    // три хомячка танцуют у костра
    poly(ctx, [-3, 30, 0, 18, 3, 30], ink);
    poly(ctx, [-1.5, 30, 0, 23, 1.5, 30], '#ffd43b');
    for (const [x, y] of [
      [-15, 26],
      [13, 26],
      [0, 10],
    ]) {
      ell(ctx, x, y - 6, 3, 3, soot);
      line(ctx, x, y - 3, x, y + 3, soot, 1.6);
      line(ctx, x - 4, y - 4, x + 4, y - 1, soot, 1.4);
      line(ctx, x, y + 3, x - 3, y + 7, soot, 1.4);
      line(ctx, x, y + 3, x + 3, y + 7, soot, 1.4);
    }
  } else if (p === 3) {
    // хомячок в колесе — всё как сейчас!
    ell(ctx, 0, 20, 13, 13, null, ink, 2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      line(ctx, 0, 20, Math.cos(a) * 13, 20 + Math.sin(a) * 13, ink, 1);
    }
    hamster(-1, 27, 0.7, soot);
  } else {
    // отпечатки лапок
    for (const [x, y] of [
      [-10, 14],
      [4, 24],
      [-4, 32],
      [12, 12],
    ]) {
      ell(ctx, x, y, 3.2, 3.6, ink);
      for (let k = -1; k <= 1; k++) ell(ctx, x + k * 2.6, y - 5, 1.2, 1.4, ink);
    }
  }
}

// ---------- сталагмиты, колонны, кристаллы, грибы ----------
function paintStalagmite(ctx, v) {
  shadow(ctx, 2, 10, 18, 6);
  const h = [44, 58, 34][v % 3],
    w = [13, 15, 11][v % 3];
  poly(ctx, [-w, 10, -w * 0.5, -h * 0.5, -2, -h, 3, -h + 4, w * 0.55, -h * 0.4, w, 10], ROCK_L, OUT, 2);
  poly(ctx, [3, -h + 4, w * 0.55, -h * 0.4, w, 10, 2, 10], '#4f4557');
  for (let i = 1; i < 4; i++) {
    const yy = 10 - (h * i) / 4;
    line(ctx, -w * (1 - i / 4) * 0.9, yy, w * (1 - i / 4) * 0.5, yy + 2, 'rgba(20,14,26,.3)', 1);
  }
  ell(ctx, -w * 0.35, -h * 0.35, 2.5, 7, 'rgba(255,255,255,.25)', null, 1, 0.15);
  if (v === 1) ell(ctx, w + 8, 8, 6, 4, ROCK_L, OUT, 1.4);
}
function paintColumn(ctx, v) {
  shadow(ctx, 2, 12, 22, 7);
  // снизу — сталагмит, сверху — сталактит; срослись в талии
  ctx.beginPath();
  ctx.moveTo(-18, 12);
  ctx.quadraticCurveTo(-6, -30, -7, -48);
  ctx.quadraticCurveTo(-8, -70, -20, -104);
  ctx.lineTo(20, -104);
  ctx.quadraticCurveTo(8, -70, 7, -48);
  ctx.quadraticCurveTo(6, -30, 18, 12);
  ctx.closePath();
  ctx.fillStyle = ROCK_L;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#4f4557';
  ctx.fillRect(3, -110, 30, 130);
  for (let y = -96; y < 8; y += 13) line(ctx, -20, y + (v ? 3 : 0), 20, y + 4, 'rgba(20,14,26,.25)', 1);
  ctx.restore();
  ell(ctx, -6, -14, 2.5, 10, 'rgba(255,255,255,.22)');
  // верх уходит в темноту
  const g = ctx.createLinearGradient(0, -104, 0, -78);
  g.addColorStop(0, 'rgba(30,24,36,1)');
  g.addColorStop(1, 'rgba(30,24,36,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-22, -106, 44, 30);
}
export const CRYSTAL = [
  ['#d0bfff', '#9775fa', '#f3f0ff'],
  ['#a5d8ff', '#4dabf7', '#e7f5ff'],
  ['#fcc2d7', '#f06595', '#fff0f6'],
];
/** Друза кристаллов: несколько гранёных столбиков, светится (поле light). v — цвет. */
function paintCrystals(ctx, v) {
  const [c, d, l] = CRYSTAL[v % 3];
  shadow(ctx, 0, 10, 22, 6);
  ell(ctx, 0, 6, 22, 9, ROCK, OUT, 1.6);
  for (const [x, h, a, w] of [
    [-12, 30, -0.35, 6],
    [10, 34, 0.3, 6],
    [-2, 50, 0, 8],
    [16, 20, 0.6, 5],
    [-18, 18, -0.6, 5],
  ]) {
    ctx.save();
    ctx.translate(x, 6);
    ctx.rotate(a);
    poly(ctx, [-w, 0, -w, -h + w, 0, -h, w, -h + w, w, 0], c, OUT, 1.5);
    poly(ctx, [0, -h, w, -h + w, w, 0, 0, 0], d);
    line(ctx, -w * 0.5, -h + w + 2, -w * 0.5, -4, l, 1.6);
    poly(ctx, [-w, 0, -w, -h + w, 0, -h, w, -h + w, w, 0], null, OUT, 1.5);
    ctx.restore();
  }
}
/** Светящиеся грибы: тонкие ножки, шляпки бирюзовые и голубые, с «точками света». big — тот, что можно сорвать. */
function paintGlow(ctx, v, big) {
  const s = big ? 1.35 : 1;
  const list =
    v % 2
      ? [
          [-8, 0, 9],
          [7, -3, 7],
          [0, 6, 5],
        ]
      : [
          [-4, -2, 10],
          [9, 3, 6],
          [-13, 5, 5],
          [5, 8, 4],
        ];
  for (const [x, y, r] of list) {
    const X = x * s,
      Y = y * s,
      R = r * s;
    ell(ctx, X, Y + 2, R * 0.9, R * 0.35, 'rgba(99,230,190,.25)');
    line(ctx, X, Y, X + 1, Y - R * 1.4, '#e6fcf5', 2.6 * s);
    ctx.beginPath();
    ctx.ellipse(X + 1, Y - R * 1.4, R, R * 0.75, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = big ? '#63e6be' : x % 2 ? '#66d9e8' : '#63e6be';
    ctx.fill();
    ctx.strokeStyle = '#087f5b';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ell(ctx, X + 1 - R * 0.35, Y - R * 1.7, R * 0.25, R * 0.16, '#e6fcf5');
    ell(ctx, X + 1 + R * 0.35, Y - R * 1.55, R * 0.12, R * 0.12, '#e6fcf5');
  }
  if (big) {
    // искорка — «меня можно сорвать»
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(14, -32);
    ctx.lineTo(14, -22);
    ctx.moveTo(9, -27);
    ctx.lineTo(19, -27);
    ctx.stroke();
  }
}
function paintLantern(ctx) {
  shadow(ctx, 2, 10, 12, 4);
  fillRR(ctx, -3, -62, 6, 72, 2, WOOD_D, OUT, 1.6);
  line(ctx, 0, -62, 12, -62, OUT, 2.4);
  line(ctx, 12, -62, 12, -56, OUT, 1.4);
  fillRR(ctx, 4, -56, 16, 20, 4, 'rgba(255,224,102,.9)', OUT, 1.8);
  ell(ctx, 12, -46, 4, 6, '#fff3bf');
  fillRR(ctx, 3, -58, 18, 4, 2, '#495057', OUT, 1.2);
  fillRR(ctx, 3, -37, 18, 4, 2, '#495057', OUT, 1.2);
}
function paintMinecart(ctx) {
  shadow(ctx, 2, 10, 32, 7);
  for (const x of [-18, 18]) {
    ell(ctx, x, 6, 7, 7, '#495057', OUT, 1.8);
    ell(ctx, x, 6, 2.4, 2.4, '#adb5bd');
  }
  poly(ctx, [-30, -26, 30, -26, 24, 4, -24, 4], '#868e96', OUT, 2.2);
  poly(ctx, [10, -26, 30, -26, 24, 4, 8, 4], '#6c757d');
  line(ctx, -26, -14, 26, -14, 'rgba(20,14,26,.35)', 1.4);
  // самоцветы горкой
  for (const [x, y, col] of [
    [-14, -30, '#9775fa'],
    [-2, -34, '#4dabf7'],
    [10, -30, '#f06595'],
    [-6, -28, '#ffa94d'],
    [4, -28, '#e7f5ff'],
  ])
    poly(ctx, [x - 6, y + 4, x, y - 6, x + 6, y + 4], col, OUT, 1.3);
  fillRR(ctx, -32, -30, 64, 6, 3, '#adb5bd', OUT, 1.6);
}
function paintRails(ctx, v) {
  ctx.save();
  if (v) ctx.rotate(Math.PI / 2);
  for (let x = -22; x <= 22; x += 11) fillRR(ctx, x - 3, -14, 6, 28, 2, WOOD, 'rgba(60,40,30,.6)', 1);
  for (const y of [-9, 9]) {
    line(ctx, -26, y, 26, y, OUT, 4);
    line(ctx, -26, y, 26, y, '#adb5bd', 2);
  }
  ctx.restore();
}
defineObjects({
  caveFace: {
    art: { caveFace: [[-28, 0, 28, 64], paintFace] },
    draw: (ctx, o) => put('caveFace', o.x, o.y, o.v || 0, o.ends || 0),
  },
  paintWall: {
    art: { paintWall: [[-28, 0, 28, 64], paintCaveArt] },
    draw: (ctx, o) => put('paintWall', o.x, o.y, o.p || 0),
  },
  stalagmite: {
    solid: true,
    map: () => '#62586a',
    art: { stalagmite: [[-22, -64, 32, 16], paintStalagmite] },
    draw: (ctx, o) => put('stalagmite', o.x, o.y, o.v % 3),
  },
  column: {
    solid: true,
    map: () => '#62586a',
    art: { column: [[-26, -110, 28, 22], paintColumn] },
    draw: (ctx, o) => put('column', o.x, o.y, o.v % 2),
  },
  crystals: {
    solid: true,
    light: [0, -18, 70],
    art: { crystals: [[-34, -64, 34, 20], paintCrystals] },
    draw: (ctx, o) => put('crystals', o.x, o.y, o.v % 3),
  },
  glowShroom: {
    flat: true,
    light: [0, -8, 58],
    art: { glowShroom: [[-26, -34, 26, 16], (ctx, v) => paintGlow(ctx, v, false)] },
    draw: (ctx, o) => put('glowShroom', o.x, o.y, o.v % 2),
  },
  caveLantern: {
    solid: true,
    light: [12, -46, 150],
    art: { caveLantern: [[-16, -66, 26, 16], paintLantern] },
    draw: (ctx, o) => put('caveLantern', o.x, o.y),
  },
  minecart: {
    solid: true,
    art: { minecart: [[-42, -50, 42, 24], paintMinecart] },
    draw: (ctx, o) => put('minecart', o.x, o.y),
  },
  rails: {
    flat: true,
    art: { rails: [[-28, -28, 28, 28], paintRails] },
    draw: (ctx, o) => put('rails', o.x, o.y, o.v ? 1 : 0),
  },
});

// ---------- рисунки для крюка things ----------
/** Летучая мышь: wing 0 — висит вниз головой, сложив крылья; 1 — крылья вверх; 2 — вниз. */
function paintBat(ctx, wing) {
  const body = '#5f3dc4',
    dark = '#3b2a6b';
  if (!wing) {
    line(ctx, 0, -16, 0, -12, OUT, 1.4);
    ell(ctx, 0, -2, 6, 10, body, OUT, 1.4);
    poly(ctx, [-6, -6, -9, 4, -4, 8], dark, OUT, 1);
    poly(ctx, [6, -6, 9, 4, 4, 8], dark, OUT, 1);
    ell(ctx, 0, 8, 5, 4.5, body, OUT, 1.2);
    poly(ctx, [-4, 10, -6, 15, -1, 11], body, OUT, 1);
    poly(ctx, [4, 10, 6, 15, 1, 11], body, OUT, 1);
    line(ctx, -2.5, 7, -1, 7.5, '#fff', 1);
    line(ctx, 1, 7.5, 2.5, 7, '#fff', 1);
    return;
  }
  const up = wing === 1;
  for (const sx of [-1, 1]) {
    const tip = up ? -12 : 8;
    poly(ctx, [sx * 4, -2, sx * 12, tip, sx * 20, tip + 4, sx * 18, 2, sx * 13, 0, sx * 9, 4], dark, OUT, 1.3);
  }
  ell(ctx, 0, 0, 5, 7, body, OUT, 1.3);
  ell(ctx, 0, -7, 4.5, 4, body, OUT, 1.2);
  poly(ctx, [-4, -9, -5, -15, -1, -10], body, OUT, 1);
  poly(ctx, [4, -9, 5, -15, 1, -10], body, OUT, 1);
  ell(ctx, -1.6, -7.5, 1, 1, '#fff');
  ell(ctx, 1.6, -7.5, 1, 1, '#fff');
}
/** Кирка Камушкина лежит на камнях у озера (красная ручка — её видно в свете фонарика). */
function paintPick(ctx) {
  shadow(ctx, 0, 8, 22, 5);
  line(ctx, -20, 6, 16, -6, OUT, 6);
  line(ctx, -20, 6, 16, -6, '#e03131', 3.6);
  ctx.beginPath();
  ctx.moveTo(6, -22);
  ctx.quadraticCurveTo(18, -12, 22, 8);
  ctx.lineTo(18, 9);
  ctx.quadraticCurveTo(14, -6, 4, -16);
  ctx.closePath();
  ctx.fillStyle = '#adb5bd';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  line(ctx, 8, -18, 14, -10, '#ffffff', 1.2);
}
defineArt({
  bat: [[-24, -20, 24, 18], paintBat],
  pick: [[-26, -26, 26, 14], paintPick],
  shroomBig: [[-26, -40, 26, 18], (ctx) => paintGlow(ctx, 0, true)],
});
