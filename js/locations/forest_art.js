// ЛЕС (П.9): рисунки клеток, предметов и зданий, которые есть только в лесу. Где что стоит — locations/forest.js.
// Всё неподвижное — в кэше спрайтов (art + put), сезон и «горит ли» — параметрами put; шевелится (огонь костра,
// пчёлы, хвост белки) — поверх, линиями или сдвигом готового спрайта. Стиль — как у города (common/paint.js):
// контур OUT, объём в 2–3 тона, свет слева сверху, мягкая тень на земле, зимой снежные шапки.
//
// Клетки:  forestFloor — лесная подстилка (хвоя, мох; осенью листья, зимой снег), brook — ручей (не зайти),
//          logBridge — мостик через ручей.
// Предметы: spruce (высокая ель), birch (берёза), stump (пень), log (бревно), mossRock (камень с мхом),
//          fern (папоротник), campfire (костёр), hive (улей), squirrelOak (дуб с дуплом и белкой),
//          treehouse (домик на дереве).
// Здание:  cableway — станция канатной дороги на гору (пока закрыта: замочек на табличке).
import { cal } from '../core/state.js';
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade } from '../core/draw.js';
import { T, OUT, SP, ART, put, hash, defineTiles, defineObjects, defineBuildings } from '../engine/topdown/index.js';
import { shadow, leafTones, flower, signBoard, WOOD, WOOD_D, WOOD_L, STONE, STONE_D, LIT } from './common/paint.js';
import { crown, trunk, treeDot } from './common/objects.js';
import { geom, baseShadow, gable, steps, glow } from './common/buildings.js';
import { seat } from './common/seats.js';

const winter = (env) => env.season === 'winter';

// ---------- клетки ----------
const FLOOR = {
  winter: ['#edf5fb', '#dbe9f4'],
  spring: ['#7fc65a', '#6cb44c'],
  summer: ['#6cbc4a', '#5aa73e'],
  autumn: ['#b6b056', '#a49c48'],
};
/** Лесная подстилка: хвоинки, мох, шишки; осенью — опавшие листья; зимой — снег со следами зверей. */
function floorDeco(ctx, x, y, tx, ty, env, r) {
  const sea = env.season;
  if (sea === 'winter') {
    if (r(1) < 0.35) {
      ell(ctx, x + 8 + r(2) * 30, y + 12 + r(3) * 26, 9 + r(4) * 8, 4, '#cfe0ee');
      ell(ctx, x + 8 + r(2) * 30, y + 10 + r(3) * 26, 9 + r(4) * 8, 4, '#ffffff');
    }
    if (r(5) < 0.08) {
      // следы зайчика
      ctx.fillStyle = 'rgba(140,175,210,.55)';
      for (let i = 0; i < 3; i++) {
        ell(ctx, x + 8 + i * 13, y + 30 - i * 7, 2.4, 3.2, 'rgba(140,175,210,.55)');
        ell(ctx, x + 12 + i * 13, y + 26 - i * 7, 2, 2.6, 'rgba(140,175,210,.55)');
      }
    }
    return;
  }
  // пятна мха потемнее и посветлее
  if (r(6) < 0.6) ell(ctx, x + r(7) * T, y + r(8) * T, 12 + r(9) * 12, 7 + r(10) * 6, 'rgba(40,90,30,.13)');
  if (r(11) < 0.4) ell(ctx, x + r(12) * T, y + r(13) * T, 8 + r(14) * 8, 5, 'rgba(220,240,160,.14)');
  // хвоинки
  ctx.strokeStyle = sea === 'autumn' ? 'rgba(120,80,30,.4)' : 'rgba(90,60,30,.32)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const cx = x + r(20 + i) * T,
      cy = y + r(30 + i) * T,
      a = r(40 + i) * TAU;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
  }
  ctx.stroke();
  if (r(50) < 0.12) {
    // шишка
    ell(ctx, x + 10 + r(51) * 28, y + 10 + r(52) * 28, 3.4, 2.4, '#8d5524', 'rgba(74,55,40,.6)', 0.8, r(53) * 3);
  }
  if (sea === 'autumn') {
    const n = 1 + Math.floor(r(60) * 3);
    for (let i = 0; i < n; i++)
      ell(
        ctx,
        x + r(61 + i) * T,
        y + r(64 + i) * T,
        3.8,
        2.1,
        ['#e8590c', '#f59f00', '#fcc419', '#c2410c'][Math.floor(r(67 + i) * 4)],
        null,
        1,
        r(70 + i) * 3,
      );
  } else if (sea === 'spring' && r(80) < 0.18)
    flower(ctx, x + 8 + r(81) * 32, y + 8 + r(82) * 32, 2.4, '#ffffff', '#ffd43b');
}
/** Ручей: блики бегут по течению (сверху вниз), зимой — лёд с трещинками. */
function brookLive(ctx, cells, n, env) {
  if (winter(env)) return;
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T;
    for (let k = 0; k < 2; k++) {
      const ph = (t * 0.6 + hash(cells[i] + k, cells[i + 1]) * 3) % 1,
        cx = x + 10 + hash(cells[i + 1], cells[i] + k * 7) * 28,
        cy = y + ph * T;
      ctx.moveTo(cx - 4, cy);
      ctx.quadraticCurveTo(cx, cy + 3, cx + 4, cy);
    }
  }
  ctx.stroke();
}
defineTiles({
  forestFloor: {
    map: (env) => FLOOR[env.season][1],
    step: () => (cal().season === 'winter' ? 'stepSnow' : 'step'),
    z: 4.3, // поверх травы, под тропинкой
    fill: (env) => FLOOR[env.season][0],
    edge: { wob: 9, in: [[(env) => FLOOR[env.season][1], 9]] },
    deco: floorDeco,
  },
  // ручей — как пруд города (летом вода, зимой лёд), но зайти в него нельзя никогда: только по мостику
  brook: {
    like: 'd',
    walk: false,
    slide: false,
    onEnter: null,
    step: 'step',
    map: (env) => (winter(env) ? '#d9f1ff' : '#4fb0dc'),
    live: brookLive,
  },
  // мостик через ручей: доски, как у пирса, но это не пляж (без шлёпанцев)
  logBridge: { like: 'i', beach: false, map: '#b7804f' },
});

// ---------- деревья ----------
/** Высокая ель — та же, что в городе (pine), только крупнее. */
function paintSpruce(ctx, sea, v) {
  ctx.save();
  ctx.scale(1.3, 1.42);
  ART.pine[1](ctx, sea, v);
  ctx.restore();
}
const BIRCH_CROWN = [
  [-15, -62, 15, 15],
  [13, -66, 14, 15],
  [-4, -82, 16, 16],
  [6, -96, 12, 12],
  [0, -60, 14, 11],
];
/** Берёза: белый ствол с чёрными чёрточками, лёгкая крона (осенью — жёлтая, зимой — голые ветки в снегу). */
function paintBirch(ctx, sea, v) {
  shadow(ctx, 0, 14, 20, 7);
  const lean = v % 2 ? 3 : -2;
  // ствол
  ctx.beginPath();
  ctx.moveTo(-6, 15);
  ctx.quadraticCurveTo(-4, -30, -3 + lean, -78);
  ctx.lineTo(3 + lean, -78);
  ctx.quadraticCurveTo(4, -30, 6, 15);
  ctx.closePath();
  ctx.fillStyle = '#f8f9fa';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(120,130,150,.25)';
  ctx.fillRect(1, -80, 8, 100);
  ctx.fillStyle = '#343a40';
  for (let i = 0; i < 7; i++) {
    const yy = 8 - i * 12 + (i % 2) * 3;
    ctx.fillRect(i % 2 ? -1 : -6, yy, 5, 2);
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  // ветки
  for (const [ax, ay, bx, by] of [
    [lean * 0.5, -48, -16, -66],
    [lean * 0.6, -54, 15, -70],
    [lean, -70, -6, -88],
  ]) {
    line(ctx, ax, ay, bx, by, OUT, 4.2);
    line(ctx, ax, ay, bx, by, '#e9ecef', 2);
  }
  if (sea === 'winter') {
    crown(
      ctx,
      [
        [-16, -67, 8, 4],
        [15, -71, 8, 4],
        [-6, -89, 7, 4],
      ],
      ['#cfe3f0', '#ffffff', '#ffffff'],
      1.6,
    );
    return;
  }
  const tones = sea === 'autumn' ? ['#e0a800', '#fcc419', '#ffe066'] : leafTones(sea, 2);
  ctx.globalAlpha = 0.97;
  crown(ctx, BIRCH_CROWN, tones, 2);
  ctx.globalAlpha = 1;
  // серёжки и листочки-«монетки»
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39;
    ell(ctx, Math.cos(a) * 16, -72 + Math.sin(a) * 18, 2.4, 2, shade(tones[1], 0.25));
  }
}

// ---------- мелочи леса ----------
function paintStump(ctx, snow) {
  shadow(ctx, 0, 12, 19, 6);
  poly(ctx, [-17, 12, -13, 2, 13, 2, 17, 12], WOOD_D, OUT, 2);
  fillRR(ctx, -13, -12, 26, 20, 5, '#a8703f', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.fillRect(4, -10, 7, 16);
  ell(ctx, 0, -12, 13, 5.5, snow ? '#ffffff' : WOOD_L, OUT, 2);
  if (!snow) {
    ctx.strokeStyle = 'rgba(120,80,40,.6)';
    ctx.lineWidth = 1;
    for (const r of [8, 4]) {
      ctx.beginPath();
      ctx.ellipse(0, -12, r, r * 0.42, 0, 0, TAU);
      ctx.stroke();
    }
    // мох сбоку
    ell(ctx, -10, 2, 6, 4, '#69b34c', 'rgba(74,55,40,.5)', 1);
  } else ell(ctx, -2, -14, 10, 3.6, '#ffffff');
}
function paintLog(ctx, snow) {
  shadow(ctx, 0, 12, 32, 6);
  fillRR(ctx, -30, -10, 56, 20, 9, '#a8703f', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(-27, 2, 50, 6);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(-26, -7, 48, 3);
  ell(ctx, 26, 0, 7, 10, WOOD_L, OUT, 2);
  ell(ctx, 26, 0, 3.5, 5, 'rgba(120,80,40,.4)');
  // сучок и мох
  ell(ctx, -12, -9, 3, 2, WOOD_D, OUT, 1.2);
  if (snow) ell(ctx, -3, -11, 24, 4.5, '#ffffff', '#cfe3f0', 1.2);
  else ell(ctx, -8, -9, 13, 3.6, '#69b34c', 'rgba(74,55,40,.45)', 1);
}
function paintMossRock(ctx, v, snow) {
  shadow(ctx, 0, 12, 20, 6);
  const big = v % 2;
  const pts = big
    ? [-20, 12, -17, -8, -6, -20, 10, -16, 20, -2, 18, 12]
    : [-16, 12, -14, -4, -4, -13, 9, -10, 16, 2, 14, 12];
  poly(ctx, pts, STONE, OUT, 2.2);
  poly(ctx, big ? [10, -16, 20, -2, 18, 12, 6, 12, 4, -4] : [9, -10, 16, 2, 14, 12, 4, 12, 3, -2], STONE_D);
  poly(ctx, pts, null, OUT, 2.2);
  if (snow) ell(ctx, -2, big ? -14 : -8, big ? 15 : 11, 5, '#ffffff', '#cfe3f0', 1.2);
  else {
    // мох шапкой
    ell(ctx, -4, big ? -14 : -8, big ? 13 : 10, 5, '#5fa83f', 'rgba(74,55,40,.5)', 1);
    ell(ctx, -7, big ? -16 : -10, 5, 2, '#8fd36a');
  }
}
function paintFern(ctx, sea, v) {
  if (sea === 'winter') return;
  const col = sea === 'autumn' ? (v % 2 ? '#c2410c' : '#d9480f') : sea === 'spring' ? '#69c24c' : '#3f9e3a';
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    const ex = Math.cos(a) * 20,
      ey = Math.sin(a) * 14;
    line(ctx, 0, 8, ex, ey + 4, shade(col, -0.25), 2.2);
    for (let k = 1; k < 5; k++) {
      const px = (ex * k) / 5,
        py = 8 + ((ey - 4) * k) / 5;
      ell(ctx, px - 2.5, py, 3.4 - k * 0.4, 1.6, col, null, 1, a + 1);
      ell(ctx, px + 2.5, py, 3.4 - k * 0.4, 1.6, col, null, 1, a - 1);
    }
  }
}

// ---------- костёр ----------
function paintCampfire(ctx, snow) {
  shadow(ctx, 0, 10, 26, 7);
  // камни кругом
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    ell(ctx, Math.cos(a) * 20, 4 + Math.sin(a) * 9, 6, 4.5, i % 2 ? STONE : STONE_D, OUT, 1.6);
  }
  ell(ctx, 0, 4, 15, 6.5, snow ? '#e9ecef' : '#5c4a3a');
  ell(ctx, 0, 5, 10, 4, snow ? '#ffffff' : '#3b2f27');
  // поленья шалашиком
  for (const [ax, ay, bx, by] of [
    [-14, 8, 4, -12],
    [14, 8, -4, -12],
    [-4, 10, 2, -14],
  ]) {
    line(ctx, ax, ay, bx, by, OUT, 6.5);
    line(ctx, ax, ay, bx, by, WOOD_D, 4);
  }
}
/** Огонь костра — шевелится, рисуется каждый кадр (в координатах мира). */
export function drawFlame(ctx, x, y, t) {
  for (const [k, col, w, h] of [
    [0, '#ff6b2c', 13, 30],
    [1, '#ffa94d', 9, 22],
    [2, '#ffe066', 5, 13],
  ]) {
    const f = Math.sin(t * 9 + k * 1.7) * 2,
      g = Math.sin(t * 13 + k) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - w, y + 2);
    ctx.quadraticCurveTo(x - w - 1, y - h * 0.45, x + f, y - h + g);
    ctx.quadraticCurveTo(x + w + 1, y - h * 0.45, x + w, y + 2);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (!k) {
      ctx.strokeStyle = 'rgba(74,55,40,.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  // искорки
  ctx.fillStyle = '#ffd43b';
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.8 + i / 3) % 1;
    ctx.fillRect(x + Math.sin(ph * 9 + i * 2) * 8, y - 26 - ph * 34, 2, 2);
  }
}

// ---------- улей ----------
function paintHive(ctx, snow) {
  shadow(ctx, 0, 13, 22, 6);
  // подставка
  for (const dx of [-12, 12]) fillRR(ctx, dx - 2.5, -4, 5, 18, 2, WOOD_D, OUT, 1.6);
  fillRR(ctx, -18, -6, 36, 6, 2, WOOD, OUT, 1.8);
  // соломенный улей-«колокол»
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.bezierCurveTo(-20, -44, 20, -44, 18, -6);
  ctx.closePath();
  ctx.fillStyle = '#f2c14e';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(160,110,30,.65)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -6 - i * 7, 20 - i * 2.4, 3.2, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(6, -40, 14, 36);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(-14, -36, 5, 26);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.bezierCurveTo(-20, -44, 20, -44, 18, -6);
  ctx.closePath();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // леток
  ell(ctx, 0, -12, 4.5, 3.2, '#4a3728');
  if (snow) ell(ctx, 0, -33, 13, 5, '#ffffff', '#cfe3f0', 1.2);
  // табличка с мёдом
  else ell(ctx, 11, -22, 3.5, 3.5, '#ff922b', OUT, 1.1);
}
/** Пчёлки вокруг улья (летом и осенью днём) — точками, каждый кадр. */
export function drawBees(ctx, x, y, t) {
  for (let i = 0; i < 5; i++) {
    const a = t * (1.6 + i * 0.25) + i * 1.3,
      bx = x + Math.cos(a) * (18 + i * 4),
      by = y - 26 + Math.sin(a * 1.3) * 10 - i * 2;
    ell(ctx, bx, by, 3, 2.3, '#ffd43b', OUT, 0.9);
    line(ctx, bx, by - 2, bx, by + 2, OUT, 1);
    ell(ctx, bx - 1, by - 3, 2, 1.3, 'rgba(255,255,255,.85)');
  }
}

// ---------- дуб с белкой ----------
const OAK_CROWN = [
  [-30, -70, 24, 20],
  [28, -72, 24, 20],
  [-8, -96, 28, 23],
  [16, -100, 22, 19],
  [0, -70, 26, 18],
];
function paintOak(ctx, sea) {
  shadow(ctx, 0, 16, 34, 10);
  poly(ctx, [-16, 17, -10, 4, 10, 4, 16, 17], '#8d5524', OUT, 2);
  trunk(ctx, 0, -50, 24, 14, '#9a6233');
  // дупло
  ell(ctx, 4, -34, 7, 9, '#4a3728', OUT, 1.8);
  ell(ctx, 4, -32, 5, 6, '#2b1f17');
  if (sea === 'winter') {
    for (const [ax, ay, bx, by] of [
      [-4, -46, -34, -76],
      [4, -48, 34, -80],
      [0, -50, -6, -104],
      [2, -60, 22, -98],
    ]) {
      line(ctx, ax, ay, bx, by, OUT, 9);
      line(ctx, ax, ay, bx, by, '#9a6233', 5.5);
    }
    crown(
      ctx,
      [
        [-33, -79, 12, 6],
        [33, -83, 12, 6],
        [-6, -106, 12, 6],
        [22, -100, 9, 5],
      ],
      ['#cfe3f0', '#ffffff', '#ffffff'],
      1.8,
    );
    ell(ctx, 4, -45, 8, 3.5, '#ffffff', '#cfe3f0', 1.1);
    return;
  }
  const tones = sea === 'autumn' ? ['#c2410c', '#e8590c', '#ffa94d'] : leafTones(sea, 0);
  crown(ctx, OAK_CROWN, tones, 2.4);
  if (sea === 'autumn' || sea === 'summer')
    // жёлуди
    for (const [dx, dy] of [
      [-22, -66],
      [20, -64],
      [-4, -86],
      [26, -90],
    ]) {
      ell(ctx, dx, dy + 2, 3, 4, '#a0662d', OUT, 1);
      ell(ctx, dx, dy - 1.5, 3.6, 2, '#6b4423', OUT, 1);
    }
}
/** Белка: сидит, пушистый хвост вверх; tail — наклон хвоста (шаг), dir — куда смотрит. */
function paintSquirrel(ctx, tail, dir) {
  ctx.save();
  ctx.scale(dir, 1);
  const fur = '#d9682b',
    belly = '#ffe8cc';
  // хвост
  ctx.save();
  ctx.translate(-7, 2);
  ctx.rotate(tail * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-16, -6, -18, -30, -4, -34);
  ctx.bezierCurveTo(8, -36, 8, -22, -2, -20);
  ctx.bezierCurveTo(-8, -18, -6, -8, 2, -2);
  ctx.closePath();
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ell(ctx, -9, -24, 3.5, 5, 'rgba(255,255,255,.25)');
  ctx.restore();
  // тело и голова
  ell(ctx, 0, 0, 8, 10, fur, OUT, 1.8);
  ell(ctx, 2, 2, 4.5, 6.5, belly);
  ell(ctx, 3, -12, 7, 6.5, fur, OUT, 1.8);
  poly(ctx, [-1, -17, 0, -24, 3, -17], fur, OUT, 1.4);
  poly(ctx, [4, -17, 6, -24, 8, -17], fur, OUT, 1.4);
  ell(ctx, 6, -13, 1.6, 1.9, OUT);
  ell(ctx, 6.4, -13.6, 0.6, 0.6, '#fff');
  ell(ctx, 9.5, -10.5, 1.4, 1.1, '#4a3728');
  // лапки с орешком
  ell(ctx, 6, -4, 3, 2.6, '#a0662d', OUT, 1);
  ctx.restore();
}

// ---------- домик на дереве ----------
function paintTreehouse(ctx, sea, lit) {
  const snow = sea === 'winter';
  shadow(ctx, 24, 18, 50, 12);
  // два ствола
  poly(ctx, [-6, 18, -2, 6, 12, 6, 16, 18], '#8d5524', OUT, 2);
  trunk(ctx, 4, -60, 18, 14, '#9a6233');
  trunk(ctx, 44, -60, 14, 14, '#9a6233');
  // крона за домиком
  if (!snow) {
    const tones = sea === 'autumn' ? ['#e0a800', '#f59f00', '#ffd43b'] : leafTones(sea, 1);
    crown(
      ctx,
      [
        [-10, -122, 30, 24],
        [54, -124, 30, 24],
        [22, -146, 32, 26],
        [24, -118, 34, 20],
      ],
      tones,
      2.4,
    );
  } else
    for (const [ax, ay, bx, by] of [
      [4, -60, -18, -126],
      [44, -60, 66, -130],
      [24, -100, 24, -150],
    ]) {
      line(ctx, ax, ay, bx, by, OUT, 8);
      line(ctx, ax, ay, bx, by, '#9a6233', 4.6);
    }
  // помост
  fillRR(ctx, -16, -64, 80, 10, 3, WOOD_D, OUT, 2);
  for (let x = -12; x < 62; x += 10) line(ctx, x, -64, x, -55, 'rgba(74,55,40,.35)', 1);
  // перила
  for (const x of [-12, 60]) line(ctx, x, -64, x, -80, OUT, 3);
  line(ctx, -12, -78, 60, -78, OUT, 3);
  line(ctx, -12, -78, 60, -78, WOOD_L, 1.4);
  // домик
  fillRR(ctx, 4, -112, 42, 48, 4, '#e0ac78', OUT, 2);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(32, -110, 12, 44);
  for (let y = -104; y < -66; y += 8) line(ctx, 6, y, 44, y, 'rgba(120,80,40,.35)', 1);
  // окошко
  fillRR(ctx, 12, -102, 15, 14, 3, lit ? LIT : '#cfeaff', OUT, 1.6);
  line(ctx, 19.5, -102, 19.5, -88, OUT, 1.2);
  if (lit) glow(ctx, 19, -95, 24, 0.5);
  // дверка
  fillRR(ctx, 31, -96, 11, 32, 4, '#a8703f', OUT, 1.6);
  ell(ctx, 39, -80, 1.4, 1.4, '#ffd43b');
  // крыша
  poly(ctx, [-2, -110, 25, -132, 52, -110], snow ? '#ffffff' : '#e8590c', OUT, 2.2);
  if (!snow) poly(ctx, [25, -132, 52, -110, 38, -110], 'rgba(0,0,0,.15)');
  // флажок
  line(ctx, 25, -132, 25, -150, OUT, 2);
  poly(ctx, [25, -150, 38, -146, 25, -141], '#ff6b9d', OUT, 1.4);
  // верёвочная лестница
  for (const x of [8, 20]) line(ctx, x, -56, x, 14, '#c9a36b', 2);
  for (let y = -48; y < 14; y += 9) line(ctx, 8, y, 20, y, '#a8703f', 2.4);
}

defineObjects({
  spruce: {
    solid: true,
    map: treeDot,
    art: { spruce: [[-48, -144, 52, 38], paintSpruce] },
    draw(ctx, o, env) {
      put('spruce', o.x, o.y, env.season, (o.v || 0) % 3);
    },
  },
  birch: {
    solid: true,
    map: treeDot,
    art: { birch: [[-34, -116, 36, 24], paintBirch] },
    draw(ctx, o, env) {
      // крона берёзы чуть покачивается целым спрайтом, шагами в пиксель
      put('birch', o.x + Math.round(Math.sin(env.t * 1.1 + o.x) * 1.2), o.y, env.season, (o.v || 0) % 2);
    },
  },
  stump: {
    solid: true,
    ...seat('sit', [[0, -2, 0, 31]], { dx: 22, up: 24, down: 18 }),
    art: { stump: [[-22, -22, 24, 20], paintStump] },
    draw: (ctx, o, env) => put('stump', o.x, o.y, winter(env) ? 1 : 0),
  },
  log: {
    solid: true,
    ...seat(
      'sit',
      [
        [-12, 2, -12, 31],
        [12, 2, 12, 31],
      ],
      { dx: 36, up: 24, down: 20 },
    ),
    art: { forestLog: [[-36, -18, 38, 20], paintLog] },
    draw: (ctx, o, env) => put('forestLog', o.x, o.y, winter(env) ? 1 : 0),
  },
  mossRock: {
    solid: true,
    art: { mossRock: [[-24, -26, 25, 20], paintMossRock] },
    draw: (ctx, o, env) => put('mossRock', o.x, o.y, (o.v || 0) % 2, winter(env) ? 1 : 0),
  },
  fern: {
    flat: true,
    art: { fern: [[-26, -20, 26, 14], paintFern] },
    draw(ctx, o, env) {
      if (!winter(env)) put('fern', o.x, o.y, env.season, (o.v || 0) % 2);
    },
  },
  campfire: {
    solid: true,
    light: [0, -10, 170],
    art: { campfire: [[-30, -18, 32, 20], paintCampfire] },
    draw(ctx, o, env) {
      put('campfire', o.x, o.y, winter(env) ? 1 : 0);
      if (o.burning && o.burning()) {
        SP.world();
        drawFlame(ctx, o.x, o.y + 2, env.t);
      }
    },
  },
  hive: {
    solid: true,
    art: { hive: [[-26, -44, 28, 20], paintHive] },
    draw(ctx, o, env) {
      put('hive', o.x, o.y, winter(env) ? 1 : 0);
      if (o.busy && o.busy() && env.dark < 0.4) {
        SP.world();
        drawBees(ctx, o.x, o.y, env.t);
      }
    },
  },
  squirrelOak: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    map: treeDot,
    art: {
      squirrelOak: [[-62, -128, 64, 28], paintOak],
      squirrel: [[-28, -40, 16, 14], paintSquirrel],
      // бельчонок (задание Шишкина) — та же белка, только маленькая
      squirrelKit: [
        [-22, -32, 22, 12],
        (ctx, tail, dir) => {
          ctx.scale(0.72, 0.72);
          paintSquirrel(ctx, tail, dir);
        },
      ],
    },
    draw(ctx, o, env) {
      put('squirrelOak', o.x + 24, o.y, env.season);
      // белка: днём сидит у дупла и машет хвостом (кадры хвоста — в кэше), ночью спит в дупле
      if (env.dark < 0.6) {
        const tail = Math.round(Math.sin(env.t * 3) * 2);
        put('squirrel', o.x + 32, o.y - 46 + (Math.sin(env.t * 1.7) > 0.92 ? -3 : 0), tail, 1);
      }
    },
  },
  treehouse: {
    solid: [
      [0, 0],
      [1, 0],
    ],
    map: treeDot,
    art: { treehouse: [[-50, -180, 100, 32], paintTreehouse] },
    draw(ctx, o, env) {
      put('treehouse', o.x, o.y, env.season, env.dark > 0.45 ? 1 : 0);
    },
  },
});

// ---------- станция канатной дороги ----------
/**
 * Станция: деревянный навес с колесом, трос, кабинка ждёт у платформы. В лесу трос уходит на север, к горе
 * (b.cable — 'up'), на горе — вниз, к лесу ('down'). Табличка — b.signText() («🔒 На гору», пока гора закрыта; текст
 * входит в ключ спрайта здания, так что открылась гора — станция перерисуется сама).
 */
function paintCableway(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 40;
  baseShadow(ctx, g);
  // опоры
  for (const x of [X + 18, X + W - 18]) fillRR(ctx, x - 6, top + 30, 12, bot - top - 30, 3, WOOD_D, OUT, 2);
  // платформа
  fillRR(ctx, X + 4, bot - 34, W - 8, 16, 4, WOOD, OUT, 2);
  for (let x = X + 14; x < X + W - 10; x += 14) line(ctx, x, bot - 34, x, bot - 19, 'rgba(74,55,40,.3)', 1);
  steps(ctx, cx, bot, 46);
  // крыша-навес
  gable(ctx, X - 4, X + W + 4, top + 34, top - 6, '#2f9e44', snow);
  // колесо и трос (в лесу уходит вверх, к горе; на горе — вниз, к лесу)
  ell(ctx, cx, top + 46, 16, 16, '#868e96', OUT, 2.5);
  ell(ctx, cx, top + 46, 6, 6, '#495057', OUT, 1.5);
  for (const k of [-1, 1]) {
    const [ex, ey] = cableEnd(b, k);
    line(ctx, cx + k * 14, top + 40, ex, ey, OUT, 2.2);
  }
  // кабинка у платформы
  line(ctx, cx + 30, top + 60, cx + 30, top + 74, OUT, 2);
  fillRR(ctx, cx + 14, top + 74, 34, 30, 8, '#fa5252', OUT, 2);
  fillRR(ctx, cx + 19, top + 79, 24, 12, 3, lit ? LIT : '#cfeaff', OUT, 1.4);
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.fillRect(cx + 38, top + 76, 8, 26);
  // табличка: куда едем (пока гора закрыта — с замочком)
  signBoard(ctx, b.signText ? b.signText() : '🔒 На гору', cx - 30, bot - 50, 74, 18, 'wood');
  if (snow) {
    for (const x of [X + 18, X + W - 18]) ell(ctx, x, top + 31, 8, 3, '#ffffff', '#cfe3f0', 1);
    ell(ctx, cx + 31, top + 74, 15, 3.5, '#ffffff', '#cfe3f0', 1);
  }
}
/** Куда уходит трос от колеса (k = -1 — левая нитка, 1 — правая). */
function cableEnd(b, k) {
  const g = geom(b);
  return b.cable === 'down' ? [g.cx + k * 34 + 60, g.bot + 70] : [g.cx + k * 30, g.Y - 160];
}
/** Вагончик едет по тросу (станция работает — b.running()): выезжает от колеса и уходит вдаль, по кругу. */
function cablewayLive(ctx, b, t) {
  if (!b.running || !b.running()) return;
  const g = geom(b),
    top = g.Y - 40,
    [ex, ey] = cableEnd(b, 1),
    k = (t * 0.12 + b.x * 0.1) % 1,
    up = b.cable !== 'down';
  // от колеса к концу троса (в лесу — вверх и меньше: уезжает вдаль)
  const x0 = g.cx + 14,
    y0 = top + 40,
    x = x0 + (ex - x0) * k,
    y = y0 + (ey - y0) * k,
    s = up ? 1 - k * 0.55 : 1;
  ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
  line(ctx, x, y, x, y + 12 * s, OUT, 1.8);
  fillRR(ctx, x - 12 * s, y + 12 * s, 24 * s, 20 * s, 6 * s, '#ffd43b', OUT, 1.8);
  fillRR(ctx, x - 8 * s, y + 15 * s, 16 * s, 8 * s, 2, '#cfeaff', OUT, 1.2);
  ctx.globalAlpha = 1;
}
defineBuildings({
  cableway: {
    paint: paintCableway,
    live: cablewayLive,
    icon: '🚡',
    box: (b) =>
      b.cable === 'down' ? [-24, -60, b.w * T + 120, b.h * T + 130] : [-24, -190, b.w * T + 24, b.h * T + 14],
    hitUp: () => 120,
    lights: (b) => [[(b.x + b.w / 2) * T + 31, b.y * T + 46, 40, 40, 0.8]],
  },
});

// ---------- избушка лесника: дорисовка поверх домика (поле art у здания house) ----------
/** Бревенчатые торцы по углам, поленница у стены и подкова над дверью. */
export function hutArt(ctx, g, snow) {
  for (const x of [g.wx - 2, g.wx + g.ww + 2])
    for (let y = g.wallTop + 8; y < g.bot - 8; y += 11) ell(ctx, x, y, 5, 4.6, WOOD_L, OUT, 1.3);
  // поленница
  const px = g.X + g.W - 8,
    py = g.bot - 4;
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 3 - r; i++) ell(ctx, px + i * 11 + r * 5.5, py - r * 9, 5.5, 4.6, WOOD_L, OUT, 1.4);
  if (snow) ell(ctx, px + 11, py - 24, 16, 4, '#ffffff', '#cfe3f0', 1.1);
  // подкова на счастье
  ctx.beginPath();
  ctx.arc(g.cx, g.bot - 70, 6, 0.2, Math.PI - 0.2, true);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Дорисовка лесного домика (жильё, data/estate.js): торцы брёвен по углам, поленница слева, ящик с цветами под
 * окном, у крыльца — фонарик на столбике (ночью горит).
 */
export function cabinArt(ctx, g, snow, lit) {
  for (const x of [g.wx - 2, g.wx + g.ww + 2])
    for (let y = g.wallTop + 8; y < g.bot - 8; y += 11) ell(ctx, x, y, 5, 4.6, WOOD_L, OUT, 1.3);
  // поленница у левой стены
  const px = g.X - 2,
    py = g.bot - 4;
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 3 - r; i++) ell(ctx, px + i * 10 + r * 5, py - r * 8.5, 5, 4.3, WOOD_L, OUT, 1.3);
  if (snow) ell(ctx, px + 10, py - 14, 14, 3.6, '#ffffff', '#cfe3f0', 1.1);
  // фонарик у крыльца
  const lx = g.cx + 38;
  line(ctx, lx, g.bot + 4, lx, g.bot - 40, OUT, 4);
  line(ctx, lx, g.bot + 4, lx, g.bot - 40, WOOD_D, 2);
  if (lit) {
    ctx.fillStyle = 'rgba(255,224,130,.35)';
    ctx.beginPath();
    ctx.arc(lx, g.bot - 46, 16, 0, TAU);
    ctx.fill();
  }
  fillRR(ctx, lx - 6, g.bot - 54, 12, 14, 3, lit ? LIT : '#fff3bf', OUT, 1.6);
  poly(ctx, [lx - 8, g.bot - 54, lx, g.bot - 61, lx + 8, g.bot - 54], '#2b8a3e', OUT, 1.4);
}

/** Табличка у лесного домика: «🔑 мой дом» (куплен) или «ПРОДАЁТСЯ» на колышке у крыльца — каждый кадр поверх спрайта. */
export function drawCabinPlate(ctx, b, owned) {
  const x = (b.x + b.w) * T - 6,
    bot = (b.y + b.h) * T;
  line(ctx, x, bot + 6, x, bot - 24, OUT, 4);
  line(ctx, x, bot + 6, x, bot - 24, WOOD_D, 2);
  if (owned) signBoard(ctx, '🔑 мой дом', x, bot - 34, 84, 22, 'plate', '#2f9e44');
  else signBoard(ctx, 'ПРОДАЁТСЯ', x, bot - 34, 76, 20, 'wood');
}

// ---------- лучики сквозь кроны (днём) ----------
const BEAMS = [
  [0.06, 0.05, 0.5],
  [0.3, 0.03, 0.35],
  [0.5, 0.07, 0.45],
  [0.78, 0.04, 0.3],
];
/**
 * Мягкие косые лучи: четыре полупрозрачные полосы на весь экран. Рисуются в маленький слой неба (крюк sky): его
 * растягивает страница, поэтому лучи почти ничего не стоят. w × h — размер слоя, a — яркость 0..1.
 */
export function drawSunbeams(ctx, w, h, t, a) {
  const sway = Math.sin(t * 0.07) * 0.03;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgb(255,246,200)';
  for (const [x, bw, al] of BEAMS) {
    ctx.globalAlpha = a * al * 0.42 * (0.8 + Math.sin(t * 0.4 + x * 9) * 0.2);
    const x0 = (x + sway) * w;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0 + bw * w, 0);
    ctx.lineTo(x0 + bw * w + h * 0.45, h);
    ctx.lineTo(x0 + h * 0.3, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
