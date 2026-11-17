// СЕКРЕТНЫЙ ПЛЯЖ (П.9): рисунки клеток, предметов и мелочей, которые есть только в бухте. Где что стоит —
// locations/cove.js. Всё неподвижное — в кэше спрайтов (art + put); шевелится только вода (live у клеток — одним путём
// на экран), черепашата, ракушки и светящаяся ночью вода (крюки локации). Стиль — как у города, леса и джунглей
// (common/paint.js): контур OUT, объём в 2–3 тона, свет слева сверху, мягкая тень на земле.
//
// Клетки:  csand — белый песок бухты (пляж: шлёпанцы), clag — бирюзовое мелководье (плыть; событие swim с where:
//          'cove' — тёплая вода, простыть нельзя), cdeep — глубже (плыть), copen — открытое море за бухтой (нельзя),
//          crock — скалы вокруг бухты (нельзя), cgrotto — вода в подводном гроте (нельзя; нырнуть — особое место).
// Предметы: cliffFace (стена скалы «лицом» к нам — ставится на клетку скалы над песком; v — вариант, ends — края),
//          grottoArch (вход в грот: тёмная арка в скале), mermaidRock (камень Жемчужинки в воде; плоский — русалочка
//          рисуется сверху), seaRock (камни у воды).
// Рисунки для крюков: cnest (гнездо черепашат: с яйцами / пустое), cturtle (черепашонок, шаг), cshell (ракушка
//          на песке — вид), mapBottle (бутылка с кусочком карты — на Звёздном острове в городе), seaMarker (буёк-ракушка
//          над входом в грот — в море города, locations/sea.js).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { T, OUT, SP, put, hash, defineTiles, defineObjects, defineArt } from '../engine/topdown/index.js';
import { shadow } from './common/paint.js';
import { paintOwnCastle } from '../minigames/sandcastle.js';

export const SAND = '#fbf3df',
  SAND_D = '#ecdcb8',
  LAG = '#74e4da',
  DEEP = '#2bb8c6',
  ROCK = '#b39c86',
  ROCK_D = '#8c7562',
  ROCK_L = '#d2bea6';
/** Цвета ракушек по виду (порядок — SHELL_IDS в data/finds.js). */
export const SHELL_COLORS = [
  ['#ff8fab', '#e64980'],
  ['#f4c27a', '#b07a2a'],
  ['#ffd43b', '#e8a400'],
];

// ---------- клетки ----------
/** Белый песок: крошечные ракушки, камешки и следы волн. */
function sandDeco(ctx, x, y, tx, ty, env, r) {
  for (let i = 0; i < 3; i++) if (r(i) < 0.5) ell(ctx, x + r(4 + i) * T, y + r(8 + i) * T, 1.6, 1.2, 'rgba(180,150,110,.35)');
  if (r(12) < 0.18) {
    const sx = x + 8 + r(13) * 32,
      sy = y + 8 + r(14) * 32,
      c = SHELL_COLORS[Math.floor(r(15) * 3)];
    ell(ctx, sx, sy, 2.6, 2, c[0], 'rgba(120,80,60,.45)', 0.7);
  }
  if (r(16) < 0.25) ell(ctx, x + r(17) * T, y + r(18) * T, 9, 2.4, 'rgba(255,255,255,.55)');
}
/** Мелководье: блики-сеточка на дне (неподвижная часть). */
function lagoonDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const cx = x + 8 + r(i) * 30,
      cy = y + 8 + r(i + 4) * 30;
    ctx.moveTo(cx - 8, cy);
    ctx.quadraticCurveTo(cx, cy - 5, cx + 8, cy);
  }
  ctx.stroke();
  if (r(9) < 0.14) ell(ctx, x + r(10) * T, y + r(11) * T, 4, 3, 'rgba(255,180,200,.45)'); // ракушка на дне
}
/** Бегущие блики на воде бухты: один путь на все видимые клетки. */
function lagoonLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const tx = cells[i],
      ty = cells[i + 1],
      hs = hash(tx, ty);
    if (hs > 0.55) continue;
    const ph = t * 1.2 + tx * 0.8 + ty * 1.5,
      wx = tx * T + 8 + Math.sin(ph) * 6 + hs * 12,
      wy = ty * T + 12 + hash(ty, tx) * 24;
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 6, wy - 3, wx + 12, wy);
  }
  ctx.stroke();
}
function rockDeco(ctx, x, y, tx, ty, env, r) {
  if (r(1) < 0.6) ell(ctx, x + r(2) * T, y + r(3) * T, 9 + r(4) * 8, 5 + r(5) * 3, 'rgba(90,70,55,.18)');
  if (r(6) < 0.45) {
    ctx.strokeStyle = 'rgba(80,60,45,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const cx = x + 6 + r(7) * 30,
      cy = y + 8 + r(8) * 28;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 7, cy + 4);
    ctx.lineTo(cx + 12, cy + 2);
    ctx.stroke();
  }
  if (r(9) < 0.3) ell(ctx, x + 8 + r(10) * 32, y + 8 + r(11) * 30, 5, 3, 'rgba(110,170,80,.45)'); // травка в расщелине
}
function grottoLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.fillStyle = 'rgba(160,255,240,.55)';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const ph = (t * 0.7 + hash(cells[i], cells[i + 1]) * 3) % 1,
      x = cells[i] * T + 10 + hash(cells[i + 1], cells[i]) * 28,
      y = cells[i + 1] * T + 40 - ph * 30;
    ctx.moveTo(x + 2.4, y);
    ctx.arc(x, y, 2.4 * (1 - ph * 0.5), 0, TAU); // пузырьки поднимаются из глубины
  }
  ctx.fill();
}
const deepFill = (env, ctx) => {
  const g = ctx.createLinearGradient(0, 18 * T, 0, 28 * T);
  g.addColorStop(0, '#3cc7cf');
  g.addColorStop(1, '#1688a8');
  return g;
};
defineTiles({
  csand: {
    map: SAND,
    beach: true,
    step: 'stepSand',
    z: 2.02,
    fill: SAND,
    edge: {
      wob: 7,
      out: [
        ['rgba(255,255,255,.4)', 16],
        ['rgba(255,255,255,.85)', 7],
      ],
      in: [
        [SAND_D, 24],
        ['rgba(255,255,255,.6)', 4],
      ],
    },
    deco: sandDeco,
  },
  clag: {
    like: 'h',
    map: LAG,
    z: 1.03,
    fill: LAG,
    edge: { wob: 7, out: [['rgba(116,228,218,.4)', 30]] },
    swim: { clip: -30, where: 'cove' }, // тёплая бухта: не «ледяное море» (features/health.js)
    deco: lagoonDeco,
    live: lagoonLive,
  },
  cdeep: {
    like: 'w',
    map: DEEP,
    z: 0.03,
    fill: deepFill,
    swim: { clip: -38, where: 'cove' },
    deco: null,
    live: lagoonLive,
  },
  copen: { like: 'O', map: '#167fa6', z: 0.02, fill: '#1a86aa', deco: null },
  crock: {
    map: ROCK_D,
    walk: false,
    z: 7.7,
    fill: ROCK,
    edge: { wob: 9, out: [['rgba(40,30,20,.32)', 14]], in: [[ROCK_L, 7]] },
    deco: rockDeco,
  },
  cgrotto: {
    map: '#1d5f6e',
    walk: false,
    wet: true,
    z: 1.08,
    fill: '#1f6a78',
    edge: { wob: 5, in: [['rgba(150,240,240,.35)', 5]] },
    live: grottoLive,
  },
});

// ---------- предметы ----------
/** Стена скалы «лицом» к нам: слоистый песчаник, трещины, неровный низ, сверху травка (ends: 1 — левый край, 2 — правый). */
function paintCliffFace(ctx, v, ends) {
  const l = ends & 1 ? -21 : -25,
    r = ends & 2 ? 21 : 25,
    b0 = 46 + (v % 3) * 3;
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(l, 0);
    ctx.lineTo(r, 0);
    ctx.lineTo(r - (ends & 2 ? 5 : 0), b0 - 6);
    ctx.quadraticCurveTo(r * 0.4, b0 + 4, 4 - v * 3, b0 - 1);
    ctx.quadraticCurveTo(l * 0.5, b0 - 6, l + (ends & 1 ? 5 : 0), b0 - 2);
    ctx.closePath();
  };
  ell(ctx, 2, b0, 26, 5, 'rgba(90,70,40,.2)'); // мокрая тень у подножия
  face();
  const g = ctx.createLinearGradient(0, 0, 0, b0);
  g.addColorStop(0, ROCK);
  g.addColorStop(1, ROCK_D);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const y = 8 + i * 10 + ((v + i) % 2) * 2;
    ctx.fillStyle = i % 2 ? 'rgba(255,240,220,.16)' : 'rgba(60,40,25,.13)';
    ctx.fillRect(-28, y, 56, 4);
  }
  ctx.strokeStyle = 'rgba(70,50,35,.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const cx = -8 + v * 9;
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx + 3, 16);
  ctx.lineTo(cx - 1, 28);
  ctx.moveTo(cx + 3, 16);
  ctx.lineTo(cx + 9, 22);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,245,230,.22)';
  ctx.fillRect(l, 2, 8, b0);
  ctx.restore();
  face();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  // кромка сверху и травка
  line(ctx, l + 2, 1, r - 2, 1, ROCK_L, 3);
  if (v !== 1) for (const dx of [-14, 4]) ell(ctx, dx + v * 3, 2, 6, 3, '#69b852', 'rgba(40,80,30,.5)', 0.8);
}
/** Вход в грот: тёмная арка в скале, в ней поблёскивает вода. */
function paintGrottoArch(ctx) {
  ell(ctx, 0, 52, 64, 10, 'rgba(60,45,30,.2)');
  ctx.beginPath();
  ctx.moveTo(-72, 0);
  ctx.lineTo(72, 0);
  ctx.lineTo(70, 40);
  ctx.quadraticCurveTo(0, 54, -70, 40);
  ctx.closePath();
  ctx.fillStyle = ROCK_D;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // арка
  ctx.beginPath();
  ctx.moveTo(-40, 46);
  ctx.quadraticCurveTo(-42, 2, 0, 0);
  ctx.quadraticCurveTo(42, 2, 40, 46);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 46);
  g.addColorStop(0, '#120f1a');
  g.addColorStop(1, '#1f5f6e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // сосульки-сталактиты по краю арки и блики воды внутри
  for (const [x, h] of [
    [-24, 8],
    [-10, 11],
    [6, 7],
    [20, 10],
  ])
    poly(ctx, [x - 4, 4, x, 4 + h, x + 4, 4], ROCK, OUT, 1.2);
  line(ctx, -22, 38, -6, 38, 'rgba(160,255,240,.7)', 2);
  line(ctx, 6, 42, 22, 42, 'rgba(160,255,240,.55)', 2);
  // ракушки и травка у входа
  ell(ctx, -54, 34, 6, 4, '#ff8fab', OUT, 1);
  ell(ctx, 56, 36, 5, 3.4, '#fff3bf', OUT, 1);
  for (const dx of [-60, -46, 48, 62]) ell(ctx, dx, 2, 6, 3, '#69b852', 'rgba(40,80,30,.5)', 0.8);
}
/** Камень Жемчужинки в воде: плоский верх (русалочка сидит сверху), пена вокруг, водоросли. */
function paintMermaidRock(ctx) {
  ell(ctx, 0, 34, 38, 9, 'rgba(255,255,255,.55)');
  ctx.beginPath();
  ctx.moveTo(-30, 34);
  ctx.quadraticCurveTo(-34, 14, -18, 12);
  ctx.quadraticCurveTo(0, 6, 20, 11);
  ctx.quadraticCurveTo(34, 16, 30, 34);
  ctx.closePath();
  ctx.fillStyle = '#9aa3ad';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ell(ctx, -2, 15, 18, 4.5, '#c3cad2');
  ell(ctx, 16, 26, 7, 4, 'rgba(60,70,80,.25)');
  // водоросли и ракушка
  for (const [x, a] of [
    [-24, -0.4],
    [26, 0.3],
  ]) {
    ctx.save();
    ctx.translate(x, 32);
    ctx.rotate(a);
    ell(ctx, 0, -8, 3, 9, '#40c057', 'rgba(20,80,30,.6)', 1);
    ctx.restore();
  }
  ell(ctx, -12, 26, 4, 3, '#ffc9de', OUT, 0.8);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 34, 34, 6, 0, 0.1, Math.PI - 0.1);
  ctx.stroke();
}
function paintSeaRock(ctx, v) {
  shadow(ctx, 2, 10, 22, 5);
  const s = v ? 0.8 : 1;
  ctx.beginPath();
  ctx.moveTo(-20 * s, 10);
  ctx.quadraticCurveTo(-24 * s, -8 * s, -6 * s, -16 * s);
  ctx.quadraticCurveTo(14 * s, -20 * s, 20 * s, -2 * s);
  ctx.quadraticCurveTo(24 * s, 8, 18 * s, 10);
  ctx.closePath();
  ctx.fillStyle = '#a7aeb6';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ell(ctx, -6 * s, -8 * s, 8 * s, 4 * s, '#cfd5db');
  if (!v) ell(ctx, 10, 4, 5, 3, 'rgba(110,170,80,.6)');
}
defineObjects({
  cliffFace: {
    art: { cliffFace: [[-28, -4, 30, 58], paintCliffFace] },
    draw: (ctx, o) => put('cliffFace', o.x, o.y, o.v || 0, o.ends || 0),
  },
  grottoArch: {
    art: { grottoArch: [[-76, -4, 76, 64], paintGrottoArch] },
    draw: (ctx, o) => put('grottoArch', o.x, o.y),
  },
  mermaidRock: {
    solid: true,
    flat: true, // плоский: русалочка (житель) всегда рисуется сверху
    map: () => '#9aa3ad',
    art: { mermaidRock: [[-40, 2, 40, 44], paintMermaidRock] },
    draw: (ctx, o) => put('mermaidRock', o.x, o.y),
  },
  seaRock: {
    solid: true,
    map: () => '#a7aeb6',
    art: { seaRock: [[-28, -24, 28, 18], paintSeaRock] },
    draw: (ctx, o) => put('seaRock', o.x, o.y, (o.v || 0) % 2),
  },
});

// ---------- рисунки для крюков (things, ground) ----------
/** Гнездо черепашат: ямка в песке с яйцами (hatched — 0) или со скорлупками (1). */
function paintNest(ctx, hatched) {
  ell(ctx, 0, 6, 26, 12, 'rgba(170,135,90,.35)');
  ell(ctx, 0, 4, 22, 10, '#e8d5ac', 'rgba(140,105,60,.6)', 1.4);
  ell(ctx, 0, 6, 15, 6, '#d9c08e');
  if (!hatched)
    for (const [x, y] of [
      [-8, 2],
      [0, 0],
      [8, 3],
      [-3, 6],
      [5, 7],
    ])
      ell(ctx, x, y, 5, 4.4, '#fffaf0', 'rgba(120,100,80,.7)', 1);
  else
    for (const [x, y, a] of [
      [-7, 3, 0.4],
      [6, 5, -0.6],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, 0, Math.PI);
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,80,.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  // палочки-ограждение
  for (const x of [-20, 20]) {
    line(ctx, x, 8, x, -10, OUT, 3);
    line(ctx, x, 8, x, -10, '#c98b5a', 1.6);
  }
}
/** Черепашонок: панцирь в клеточку, ласты (frame — взмах; dir — куда смотрит: 1 — вправо, -1 — влево). */
function paintTurtle(ctx, frame, dir) {
  ctx.scale(dir === -1 ? -1.3 : 1.3, 1.3);
  ell(ctx, 1, 6, 10, 3, 'rgba(60,40,20,.2)');
  const f = frame ? 2 : -2;
  for (const [x, y, a] of [
    [6, -4 + f, -0.6],
    [6, 5 - f, 0.6],
    [-6, -4 - f, 0.6],
    [-6, 5 + f, -0.6],
  ])
    ell(ctx, x, y, 4, 2, '#7ad37a', OUT, 0.9, a);
  ell(ctx, 10, 0, 3.6, 3, '#8fdc8a', OUT, 1);
  ell(ctx, 11.6, -1, 0.9, 0.9, OUT);
  ell(ctx, 0, 0, 7.5, 6, '#3f9a5a', OUT, 1.3);
  ctx.strokeStyle = 'rgba(200,255,200,.6)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.lineTo(4, 4);
  ctx.moveTo(4, -4);
  ctx.lineTo(-4, 4);
  ctx.stroke();
}
/** Ракушка на песке (вид — номер в SHELL_IDS): с бликом, чтобы было видно издали. */
function paintShell(ctx, kind) {
  const [c, d] = SHELL_COLORS[kind % 3];
  ell(ctx, 0, 6, 11, 3.5, 'rgba(120,90,50,.22)');
  if (kind % 3 === 1) {
    // витая
    ctx.beginPath();
    for (let a = 0; a < 12; a += 0.4) {
      const r = 1 + a * 0.75;
      ctx.lineTo(Math.cos(a) * r, -2 + Math.sin(a) * r * 0.75);
    }
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, 4);
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.lineTo(Math.cos(a) * 9, 1 + Math.sin(a) * 9);
    }
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      line(ctx, 0, 3, Math.cos(a) * 7, 1 + Math.sin(a) * 7, d, 1);
    }
  }
  star(ctx, 8, -9, 3, '#fff');
}
/** Бутылка с кусочком карты (лежит на боку в песке). */
function paintBottle(ctx) {
  ell(ctx, 0, 8, 16, 4, 'rgba(120,90,50,.25)');
  ctx.save();
  ctx.rotate(-0.25);
  fillRR(ctx, -14, -6, 22, 12, 6, 'rgba(140,220,190,.75)', OUT, 1.6);
  fillRR(ctx, 7, -3, 8, 6, 2, 'rgba(140,220,190,.8)', OUT, 1.4);
  fillRR(ctx, 14, -3, 4, 6, 1.5, '#c98b5a', OUT, 1.2);
  fillRR(ctx, -10, -3, 14, 6, 2, '#f3e2b5', 'rgba(120,80,40,.7)', 1);
  line(ctx, -8, 0, 2, 0, 'rgba(200,60,60,.8)', 1.2);
  line(ctx, -12, -4, -4, -4, 'rgba(255,255,255,.8)', 1.6);
  ctx.restore();
  star(ctx, 10, -12, 4, '#fff');
}
/** Буёк-ракушка над входом в подводный грот (в море города): бирюзовый, с ракушкой на макушке. */
function paintSeaMarker(ctx) {
  ell(ctx, 0, 10, 18, 5, 'rgba(255,255,255,.5)');
  ell(ctx, 0, 0, 14, 13, '#22b8cf', OUT, 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-13, -3, 26, 6);
  line(ctx, 0, -13, 0, -24, OUT, 2.5);
  ctx.beginPath();
  ctx.moveTo(0, -24);
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.lineTo(Math.cos(a) * 8, -22 + Math.sin(a) * 8);
  }
  ctx.closePath();
  ctx.fillStyle = '#ff8fab';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}
defineArt({
  cnest: [[-30, -16, 30, 20], paintNest],
  cturtle: [[-21, -16, 21, 16], paintTurtle],
  cshell: [[-14, -14, 14, 12], paintShell],
  mapBottle: [[-22, -18, 22, 14], paintBottle],
  seaMarker: [[-22, -34, 22, 16], paintSeaMarker],
});

/** Крестик клада на песке (единицы мира; рисуется каждый кадр — после раскопок его нет). */
export function drawXMark(ctx, x, y, t) {
  const w = 14 + Math.sin(t * 3) * 1.2;
  ctx.lineCap = 'round';
  for (const [c, lw] of [
    ['rgba(120,80,40,.35)', 9],
    ['#e03131', 5],
  ]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x - w, y - w * 0.6);
    ctx.lineTo(x + w, y + w * 0.6);
    ctx.moveTo(x + w, y - w * 0.6);
    ctx.lineTo(x - w, y + w * 0.6);
    ctx.stroke();
  }
}
/** Ямка на месте выкопанного клада. */
export function drawDugHole(ctx, x, y) {
  ell(ctx, x, y, 18, 9, '#d9c08e', 'rgba(140,105,60,.6)', 1.4);
  ell(ctx, x, y + 1, 11, 5, '#bfa070');
  ell(ctx, x + 22, y - 2, 8, 4, '#efdfbb', 'rgba(140,105,60,.5)', 1);
}

// ---------- дельфины (С5): прыжок пары дельфинов — в море города рядом с корабликом и вдали за бухтой ----------
/** Сколько длится прыжок одного дельфина (секунды). */
export const DOLPHIN_JUMP = 1.25;
/** Дельфин в профиль, носом вправо; a — наклон (0…6: нос вверх → нос вниз), m — 1: зеркально, носом влево. */
function paintDolphin(ctx, a, m) {
  ctx.scale(m ? -1 : 1, 1);
  ctx.rotate(((a - 3) / 3) * 0.9);
  poly(ctx, [-28, 0, -42, -10, -38, 0, -42, 10], '#5b7fb8', OUT, 1.6); // хвост
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.quadraticCurveTo(-6, -16, 18, -9);
  ctx.quadraticCurveTo(30, -6, 36, -1);
  ctx.quadraticCurveTo(30, 4, 18, 6);
  ctx.quadraticCurveTo(-6, 12, -30, 0);
  ctx.closePath();
  ctx.fillStyle = '#6f93cf';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath(); // светлое брюшко
  ctx.moveTo(-20, 3);
  ctx.quadraticCurveTo(4, 10, 30, 2);
  ctx.quadraticCurveTo(6, 5, -20, 3);
  ctx.fillStyle = '#e7f0ff';
  ctx.fill();
  poly(ctx, [-6, -11, 2, -24, 8, -11], '#5b7fb8', OUT, 1.6); // спинной плавник
  poly(ctx, [6, 4, 0, 13, 12, 6], '#5b7fb8', OUT, 1.3);
  ell(ctx, 20, -4, 2.2, 2.4, '#1d1b1b');
  ell(ctx, 19.4, -4.8, 0.8, 0.8, '#fff');
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.3;
  ctx.beginPath(); // улыбка
  ctx.moveTo(26, 0.5);
  ctx.quadraticCurveTo(31, 2, 35, -0.5);
  ctx.stroke();
}
defineArt({
  dolphin: [[-48, -48, 48, 48], paintDolphin],
  // свой замок из «Замка из песка» (С7): параметр — детали через запятую (как cells в игре), в масштабе пляжа
  ownCastle: [
    [-70, -92, 70, 12],
    (ctx, key) => {
      shadow(ctx, 6, 2, 56, 7);
      ctx.scale(0.36, 0.36);
      paintOwnCastle(ctx, String(key).split(','));
    },
  ],
});
/**
 * Прыжок пары дельфинов: j = { x, y, dir, v, t0, scale } — где и когда начался (единицы мира, время G.time), куда
 * и как быстро плывут (v — единиц в секунду, рядом с корабликом), t — сейчас.
 * Дельфин — готовый спрайт из кэша (7 наклонов × 2 стороны); брызги и круги на воде — несколько эллипсов.
 * Рисовать после SP.world() (координаты мира). scale < 1 — вдали (бухта): тогда рисуется линиями, без кэша.
 */
export function drawDolphinJump(ctx, j, t) {
  const s = j.scale || 1;
  for (let i = 0; i < 2; i++) {
    const k = (t - j.t0 - i * 0.32) / DOLPHIN_JUMP;
    if (k < -0.1 || k > 1.4) continue;
    const bx = j.x + j.dir * ((j.v || 0) * (t - j.t0) - i * 46 * s), // плывут вперёд со скоростью v
      by = j.y + i * 16 * s,
      sx = bx - j.dir * 60 * s, // где выпрыгнул
      ex = bx + j.dir * 60 * s; // где нырнул обратно
    for (const [cx, k0] of [
      [sx, 0],
      [ex, 0.95],
    ]) {
      const q = (k - k0) / 0.4;
      if (q >= 0 && q <= 1) ell(ctx, cx, by, (10 + q * 26) * s, (4 + q * 8) * s, null, `rgba(255,255,255,${(0.8 * (1 - q)).toFixed(2)})`, 2);
    }
    if (k < 0 || k > 1) continue;
    const x = sx + (ex - sx) * k,
      y = by - Math.sin(k * Math.PI) * 70 * s,
      a = Math.round(3 - Math.cos(k * Math.PI) * 3);
    if (k < 0.3 || k > 0.8) for (let d = 0; d < 3; d++) ell(ctx, x - j.dir * (18 + d * 8) * s, y + (8 + d * 5) * s, 2.4 * s, 2.6 * s, 'rgba(255,255,255,.9)');
    if (s === 1) {
      put('dolphin', x, y, a, j.dir < 0 ? 1 : 0);
      SP.world();
    } else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      paintDolphin(ctx, a, j.dir < 0 ? 1 : 0);
      ctx.restore();
    }
  }
}
