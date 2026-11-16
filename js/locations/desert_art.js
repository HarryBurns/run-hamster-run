// ПУСТЫНЯ (П.9): рисунки клеток, предметов и зданий, которые есть только в пустыне. Где что стоит — locations/desert.js.
// Всё неподвижное — в кэше спрайтов (art + put), вариант и «горит свет» — параметрами put; шевелится (вода оазиса,
// верблюд, перекати-поле, мираж) — сдвигом готового спрайта или линиями поверх. Стиль — как у города и леса
// (common/paint.js): контур OUT, объём в 2–3 тона, свет слева сверху, мягкая тень на земле.
//
// Клетки:  dune — песок с рябью (основа карты), duneHi — гребень бархана (светлее, с тенью с подветренной стороны),
//          trail — караванная тропа (утоптанный песок со следами), digPit — раскоп (песок потемнее, колышки),
//          oasisWater — вода оазиса (не зайти: попить — особое место).
// Предметы: saguaro (кактус-столбик — просто кактус, без плодов; плоды — у опунции pricklyPear в common/plants.js),
//          sandRock (песчаник; v: 2 — большая скала по краю карты), dryBush (сухой кустик), well (старый колодец),
//          obelisk (обелиск у пирамиды), digTools (ведёрко, кисточка и сито на раскопе), starPost (фонарь-звезда на
//          Звёздном бархане; ночью светит), safariBus (караван-автобус у остановки, 3 клетки), camel (верблюд Финик;
//          пока на нём катаются — у привязи пусто).
// Рисунки: camel (верблюд: dir, шаг), bell (бубенчик), mirage (озеро-мираж), tumbleweed (перекати-поле, 4 поворота).
// Здания:  tent (шатёр Бархана), pyramid (пирамида с входом — загадка «Пары»), caravanStop (остановка каравана).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly } from '../core/draw.js';
import { T, OUT, put, hash, defineTiles, defineObjects, defineArt, defineBuildings } from '../engine/topdown/index.js';
import { shadow, signBoard, WOOD, WOOD_D, WOOD_L, LIT } from './common/paint.js';
import { geom, baseShadow, glow } from './common/buildings.js';

export const SAND = '#f2d39a',
  SAND_D = '#d9b06c',
  SAND_L = '#fbe8c2',
  STONE_S = '#e0a96d', // песчаник
  STONE_SD = '#c2814a';

// ---------- клетки ----------
/** Рябь на песке: несколько тонких дуг (тень и блик), изредка — камешек или сухая травинка. */
function rippleDeco(ctx, x, y, tx, ty, env, r, strong = 1) {
  const n = 2 + Math.floor(r(1) * 2);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(185,130,60,${0.26 * strong})`;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cy = y + 8 + ((i + r(2)) / n) * (T - 12),
      cx = x + r(3 + i) * 10;
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + 18, cy - 5 - r(6 + i) * 3, cx + 36, cy + 1);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,248,225,${0.5 * strong})`;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const cy = y + 6 + ((i + r(2)) / n) * (T - 12),
      cx = x + r(3 + i) * 10;
    ctx.moveTo(cx + 2, cy);
    ctx.quadraticCurveTo(cx + 18, cy - 5 - r(6 + i) * 3, cx + 32, cy);
  }
  ctx.stroke();
  if (r(10) < 0.08) ell(ctx, x + 8 + r(11) * 30, y + 10 + r(12) * 28, 2.6, 1.8, '#c9a174', 'rgba(74,55,40,.45)', 0.8);
  if (r(13) < 0.04) {
    ctx.strokeStyle = 'rgba(150,120,60,.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const bx = x + 10 + r(14) * 28,
      by = y + 14 + r(15) * 24;
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + i * 4, by - 6);
    }
    ctx.stroke();
  }
}
/** Караванная тропа: цепочка следов верблюда и хомячков. */
function trailDeco(ctx, x, y, tx, ty, env, r) {
  ctx.fillStyle = 'rgba(150,100,45,.22)';
  for (let i = 0; i < 2; i++) {
    const fx = x + 12 + r(i) * 24,
      fy = y + 10 + i * 22;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 4.4, 3.2, 0.3, 0, TAU);
    ctx.ellipse(fx + 7, fy + 2, 4.4, 3.2, -0.3, 0, TAU);
    ctx.fill();
  }
  if (r(5) < 0.3) ell(ctx, x + r(6) * T, y + r(7) * T, 2, 1.4, 'rgba(120,80,40,.3)');
}
/** Раскоп: песок потемнее, сетка из бечёвки и камешки. */
function pitDeco(ctx, x, y, tx, ty, env, r) {
  ctx.strokeStyle = 'rgba(255,240,210,.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 1);
  ctx.lineTo(x + T, y + 1);
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + 1, y + T);
  ctx.stroke();
  for (let i = 0; i < 3; i++) ell(ctx, x + 8 + r(i) * 32, y + 8 + r(i + 3) * 32, 2.2, 1.6, '#b98a55', 'rgba(74,55,40,.35)', 0.7);
  // следы кисточки
  ctx.strokeStyle = 'rgba(255,230,190,.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const bx = x + 10 + r(7) * 20,
    by = y + 14 + r(8) * 20;
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(bx + i * 4, by);
    ctx.lineTo(bx + i * 4 + 6, by + 8);
  }
  ctx.stroke();
}
/** Вода оазиса: светлые блики дрожат (одним путём на все видимые клетки). */
function oasisLive(ctx, cells, n, env) {
  const t = env.t;
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i += 2) {
    const x = cells[i] * T,
      y = cells[i + 1] * T,
      h = hash(cells[i], cells[i + 1]);
    for (let k = 0; k < 2; k++) {
      const ph = t * 1.3 + h * 6 + k * 2,
        bx = x + 8 + ((h * 37 + k * 19) % 28),
        by = y + 14 + k * 18 + Math.sin(ph) * 2,
        w = 6 + Math.sin(ph * 1.3) * 4;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + w, by);
    }
  }
  ctx.stroke();
}
defineTiles({
  oasisWater: {
    map: '#3bc9db',
    walk: false,
    wet: true,
    z: 0.7,
    fill: '#35c0d8',
    deco(ctx, x, y, tx, ty, env, r) {
      if (r(1) < 0.5) ell(ctx, x + r(2) * T, y + r(3) * T, 12 + r(4) * 8, 5, 'rgba(255,255,255,.13)');
      if (r(5) < 0.25) ell(ctx, x + r(6) * T, y + r(7) * T, 9, 5, 'rgba(20,110,120,.18)');
    },
    live: oasisLive,
  },
  dune: {
    map: SAND,
    step: 'stepSand',
    z: 2.1,
    fill: SAND,
    // берег оазиса: на воде — светлая кайма, на песке — полоса мокрого песка
    edge: {
      wob: 8,
      out: [
        ['rgba(255,255,255,.3)', 14],
        ['rgba(255,255,255,.6)', 6],
      ],
      in: [
        ['#d6b47c', 16],
        ['#e5c48c', 8],
      ],
    },
    deco: (ctx, x, y, tx, ty, env, r) => rippleDeco(ctx, x, y, tx, ty, env, r, 1),
  },
  duneHi: {
    map: '#f7deac',
    step: 'stepSand',
    speed: 190, // по бархану идти чуть медленнее — песок сыплется
    z: 2.3,
    fill: '#f8e0b0',
    // гребень бархана: снизу справа — тень с подветренной стороны, по краю — светлая кромка
    edge: {
      wob: 12,
      out: [
        ['rgba(205,150,80,.16)', 18],
        ['rgba(190,132,62,.2)', 7],
      ],
      in: [
        [SAND_L, 9],
        ['#fff3d6', 3],
      ],
    },
    deco: (ctx, x, y, tx, ty, env, r) => rippleDeco(ctx, x, y, tx, ty, env, r, 1.3),
  },
  digPit: {
    map: '#d9a96a',
    step: 'stepSand',
    z: 2.45,
    fill: '#ddb078',
    edge: {
      wob: 3,
      out: [['rgba(120,80,30,.3)', 7]],
      in: [['rgba(150,100,45,.3)', 8]],
    },
    deco: pitDeco,
  },
  trail: {
    map: '#e2bd80',
    step: 'stepSand',
    z: 2.6,
    fill: '#e6c288',
    edge: { wob: 6, out: [['rgba(160,110,50,.15)', 6]], in: [['rgba(255,240,210,.35)', 4]] },
    deco: trailDeco,
  },
});

// ---------- предметы ----------
/** Кактус-столбик (сагуаро) с одной-двумя «руками»; без плодов — это просто кактус. */
function paintSaguaro(ctx, v) {
  shadow(ctx, 2, 12, 18, 5);
  const h = [70, 88, 58][v % 3],
    G1 = '#4f9a3a',
    G2 = '#3d7f2c';
  const arm = (sx, y0, len) => {
    fillRR(ctx, sx > 0 ? 8 : -8 - 16, y0 - 7, 16, 14, 7, G1, OUT, 2);
    fillRR(ctx, sx > 0 ? 16 : -24, y0 - len, 12, len + 4, 6, G1, OUT, 2);
    line(ctx, sx > 0 ? 22 : -18, y0 - len + 6, sx > 0 ? 22 : -18, y0 - 4, G2, 2);
  };
  if (v % 3 !== 2) arm(1, -h * 0.45, 26);
  if (v % 3 !== 1) arm(-1, -h * 0.6, 22);
  fillRR(ctx, -11, -h, 22, h + 12, 11, G1, OUT, 2.2);
  for (const dx of [-4, 4]) line(ctx, dx, -h + 8, dx, 6, G2, 2);
  line(ctx, -6.5, -h + 10, -6.5, -h * 0.35, 'rgba(255,255,255,.3)', 2);
  // колючки
  ctx.fillStyle = '#f8f9e6';
  for (let i = 0; i < 8; i++) ctx.fillRect((i % 2 ? 7 : -8) - 0.7, -h + 8 + i * (h / 9), 1.6, 1.6);
  if (v % 3 === 1) {
    // цветок на макушке
    for (let i = 0; i < 5; i++) ell(ctx, Math.cos(i * 1.26) * 4, -h - 2 + Math.sin(i * 1.26) * 3, 3, 2.4, '#ffffff', OUT, 0.8);
    ell(ctx, 0, -h - 2, 2, 2, '#ffd43b');
  }
}
/** Песчаник: слоистые глыбы. v: 0, 1 — камни; 2 — большая скала (по краю карты). */
function paintSandRock(ctx, v) {
  const big = v === 2;
  shadow(ctx, 2, 14, big ? 42 : 24, big ? 10 : 7);
  const pts =
    v === 2
      ? [-40, 14, -42, -30, -30, -62, 6, -74, 32, -58, 42, -24, 40, 14]
      : v === 1
        ? [-18, 12, -18, -8, -6, -20, 12, -16, 20, -2, 18, 12]
        : [-24, 12, -22, -12, -8, -24, 10, -22, 24, -6, 22, 12];
  poly(ctx, pts, STONE_S, OUT, 2.4);
  const n = pts.length;
  poly(ctx, [pts[6], pts[7], ...pts.slice(8, n), 6, 14], STONE_SD);
  // слои песчаника — светлые и тёмные полосы
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < n; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.clip();
  for (let y = -70; y < 14; y += big ? 13 : 8) {
    line(ctx, -50, y, 50, y + 4, 'rgba(255,230,190,.35)', 1.6);
    line(ctx, -50, y + 3, 50, y + 7, 'rgba(140,80,40,.22)', 1.2);
  }
  ctx.restore();
  poly(ctx, pts, null, OUT, 2.4);
  ell(ctx, pts[4] + 5, pts[5] + 6, big ? 8 : 5, 2.6, 'rgba(255,255,255,.4)');
}
/** Сухой кустик колючки. */
function paintDryBush(ctx, v) {
  ell(ctx, 1, 6, 14, 4, 'rgba(52,38,70,.13)');
  ctx.strokeStyle = v ? '#a5803f' : '#8f7a3a';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38;
    ctx.moveTo(0, 6);
    ctx.lineTo(Math.cos(a) * 14, 6 + Math.sin(a) * 14);
    ctx.moveTo(Math.cos(a) * 8, 6 + Math.sin(a) * 8);
    ctx.lineTo(Math.cos(a + 0.4) * 12, 6 + Math.sin(a + 0.4) * 12);
  }
  ctx.stroke();
  if (v) for (let i = 0; i < 3; i++) ell(ctx, -6 + i * 6, -4 - (i % 2) * 3, 1.8, 1.8, '#ffe066');
}
/** Старый колодец: каменное кольцо, деревянный ворот с ведёрком. */
function paintWell(ctx) {
  shadow(ctx, 2, 14, 30, 8);
  for (const x of [-22, 22]) fillRR(ctx, x - 4, -62, 8, 66, 2, WOOD_D, OUT, 1.8);
  line(ctx, -24, -56, 24, -56, OUT, 6);
  line(ctx, -24, -56, 24, -56, WOOD, 3.6);
  poly(ctx, [-30, -60, 0, -78, 30, -60], '#c2814a', OUT, 2);
  line(ctx, 6, -56, 6, -34, OUT, 1.2);
  fillRR(ctx, 0, -36, 12, 10, 2, WOOD_L, OUT, 1.4);
  ell(ctx, 0, -6, 28, 12, STONE_S, OUT, 2.2);
  fillRR(ctx, -28, -10, 56, 18, 6, STONE_S, OUT, 2.2);
  ell(ctx, 0, -10, 22, 7, '#5c4a3a', OUT, 1.6);
  for (let i = 0; i < 5; i++) line(ctx, -26 + i * 13, -8, -26 + i * 13, 8, 'rgba(120,70,30,.35)', 1.2);
}
/** Обелиск из песчаника с иероглифами и золотой верхушкой. */
function paintObelisk(ctx) {
  shadow(ctx, 3, 12, 16, 5);
  poly(ctx, [-12, 12, -8, -86, 8, -86, 12, 12], STONE_S, OUT, 2.2);
  poly(ctx, [2, -86, 8, -86, 12, 12, 4, 12], STONE_SD);
  poly(ctx, [-8, -86, 0, -102, 8, -86], '#ffd43b', OUT, 1.8);
  poly(ctx, [-12, 12, -8, -86, 8, -86, 12, 12], null, OUT, 2.2);
  ctx.strokeStyle = 'rgba(110,60,25,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  // глаз, волна, птичка
  ctx.ellipse(-1, -70, 4, 2.2, 0, 0, TAU);
  ctx.moveTo(-5, -52);
  ctx.quadraticCurveTo(-2, -56, 1, -52);
  ctx.quadraticCurveTo(4, -48, 6, -52);
  ctx.moveTo(-4, -32);
  ctx.lineTo(0, -36);
  ctx.lineTo(4, -32);
  ctx.moveTo(-3, -16);
  ctx.lineTo(3, -16);
  ctx.moveTo(0, -20);
  ctx.lineTo(0, -10);
  ctx.stroke();
}
/** Инструменты археолога: ведёрко, сито и кисточка. */
function paintDigTools(ctx) {
  shadow(ctx, 0, 10, 24, 5);
  poly(ctx, [-20, -14, -6, -14, -8, 8, -18, 8], '#4dabf7', OUT, 1.8);
  ctx.beginPath();
  ctx.arc(-13, -14, 8, Math.PI, 0);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ell(ctx, 10, 2, 14, 6, '#c98b5a', OUT, 1.8);
  ell(ctx, 10, 1, 10, 4, '#e8c48a', 'rgba(74,55,40,.5)', 0.8);
  line(ctx, 2, -16, 14, -4, OUT, 4);
  line(ctx, 2, -16, 14, -4, '#ff922b', 2.4);
  ell(ctx, 16, -2, 3.6, 2.4, '#fff3bf', OUT, 1, 0.8);
}
/** Фонарь-звезда на Звёздном бархане: столбик с латунной звездой (ночью светит — поле light). */
function paintStarPost(ctx, lit) {
  shadow(ctx, 2, 12, 12, 4);
  fillRR(ctx, -3, -70, 6, 82, 2, WOOD_D, OUT, 1.8);
  if (lit) glow(ctx, 0, -80, 34, 0.5);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 7 : 16;
    pts.push(Math.cos(a) * r, -80 + Math.sin(a) * r);
  }
  poly(ctx, pts, lit ? '#fff3bf' : '#ffd43b', OUT, 2);
  ell(ctx, 0, -80, 4, 4, lit ? '#ffffff' : '#fab005');
}
/** Караван-автобус у остановки: жёлтый, с верблюдом на боку и багажом на крыше (3 клетки вширь). */
export function paintBus(ctx, dir = 1) {
  ctx.save();
  if (dir < 0) {
    ctx.translate(96, 0);
    ctx.scale(-1, 1);
  }
  shadow(ctx, 48, 14, 74, 9);
  // кузов
  fillRR(ctx, -28, -62, 152, 66, 16, '#ffd43b', OUT, 2.6);
  fillRR(ctx, -28, -18, 152, 22, 10, '#f59f00', OUT, 2);
  // окна
  for (let i = 0; i < 4; i++) fillRR(ctx, -16 + i * 30, -52, 24, 22, 6, '#cfeaff', OUT, 1.8);
  fillRR(ctx, 104, -52, 16, 28, 6, '#a5d8ff', OUT, 1.8); // лобовое
  // верблюд на боку
  ctx.fillStyle = '#c2814a';
  ctx.beginPath();
  ctx.ellipse(46, -10, 10, 4.5, 0, 0, TAU);
  ctx.ellipse(44, -15, 5, 4, 0, 0, TAU);
  ctx.fill();
  line(ctx, 54, -12, 60, -18, '#c2814a', 3);
  // багаж на крыше
  fillRR(ctx, 8, -74, 30, 14, 3, '#e8590c', OUT, 1.6);
  fillRR(ctx, 44, -72, 24, 12, 3, '#4dabf7', OUT, 1.6);
  ell(ctx, 82, -68, 12, 7, '#b197fc', OUT, 1.6);
  // колёса
  for (const x of [8, 92]) {
    ell(ctx, x, 6, 12, 12, '#343a40', OUT, 2);
    ell(ctx, x, 6, 5, 5, '#adb5bd', OUT, 1.2);
  }
  ell(ctx, 122, -8, 4, 4, '#fff3bf', OUT, 1.2);
  ctx.restore();
}
/** Верблюд (одногорбый): dir — куда смотрит (1 — вправо), leg — шаг (0 — стоит, 1, 2 — идёт). */
export function paintCamel(ctx, dir, leg) {
  ctx.save();
  ctx.scale(dir < 0 ? -1 : 1, 1);
  shadow(ctx, 0, 12, 40, 7);
  const C = '#d9a066',
    CD = '#b9804a',
    CL = '#f0c48c';
  // ноги: дальние темнее
  const legs = [
    [-22, leg === 1 ? -4 : leg === 2 ? 4 : 0, CD],
    [20, leg === 1 ? 4 : leg === 2 ? -4 : 0, CD],
    [-14, leg === 1 ? 4 : leg === 2 ? -4 : 0, C],
    [28, leg === 1 ? -4 : leg === 2 ? 4 : 0, C],
  ];
  for (const [x, sw, col] of legs) {
    line(ctx, x, -30, x + sw, 10, OUT, 7);
    line(ctx, x, -30, x + sw, 10, col, 4.4);
    ell(ctx, x + sw * 0.5, -10, 3.6, 3, col, OUT, 1.2);
    ell(ctx, x + sw, 10, 4.6, 2.6, '#8d5a35', OUT, 1.2);
  }
  // хвост
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-34, -42);
  ctx.quadraticCurveTo(-42, -30, -38, -18);
  ctx.stroke();
  ell(ctx, -38, -17, 3, 4, '#8d5a35');
  // тело и горб
  ell(ctx, 0, -40, 36, 17, C, OUT, 2.4);
  ctx.beginPath();
  ctx.ellipse(-4, -52, 18, 16, 0, Math.PI, 0);
  ctx.fillStyle = C;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ell(ctx, -10, -60, 7, 4, CL);
  ell(ctx, 6, -30, 22, 6, 'rgba(140,90,40,.25)');
  // попона с кисточками
  poly(ctx, [-16, -54, 10, -54, 14, -32, -20, -32], '#c2255c', OUT, 1.8);
  ctx.fillStyle = '#ffd43b';
  for (let i = 0; i < 4; i++) ctx.fillRect(-17 + i * 9, -34, 3, 5);
  line(ctx, -15, -46, 10, -46, '#ffd43b', 2);
  // шея и голова
  ctx.beginPath();
  ctx.moveTo(26, -48);
  ctx.quadraticCurveTo(42, -54, 42, -76);
  ctx.lineTo(52, -76);
  ctx.quadraticCurveTo(54, -50, 32, -32);
  ctx.closePath();
  ctx.fillStyle = C;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ell(ctx, 52, -80, 13, 8.5, C, OUT, 2.2, 0.15);
  ell(ctx, 61, -77, 6, 5, CL, OUT, 1.4);
  ell(ctx, 63, -78, 1.2, 1.6, OUT);
  ell(ctx, 50, -83, 2.2, 2.6, '#2b1d14');
  ell(ctx, 49.4, -84, 0.8, 0.8, '#ffffff');
  line(ctx, 47, -86, 52, -87, OUT, 1.4); // ресницы
  ell(ctx, 44, -88, 3, 4, CD, OUT, 1.2, -0.4); // ушко
  line(ctx, 56, -73, 62, -73, OUT, 1.2); // улыбка
  ctx.restore();
}
/** Бубенчик Финика: золотой, на красной ленточке. */
function paintBell(ctx) {
  ell(ctx, 1, 8, 10, 3, 'rgba(52,38,70,.18)');
  poly(ctx, [-6, -16, 6, -16, 4, -20, -4, -20], '#e03131', OUT, 1.2);
  ctx.beginPath();
  ctx.moveTo(-10, 4);
  ctx.quadraticCurveTo(-10, -16, 0, -16);
  ctx.quadraticCurveTo(10, -16, 10, 4);
  ctx.closePath();
  ctx.fillStyle = '#fcc419';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  fillRR(ctx, -12, 2, 24, 4, 2, '#f59f00', OUT, 1.4);
  ell(ctx, 0, 7, 3, 3, '#e8a400', OUT, 1.2);
  ell(ctx, -4, -9, 2, 3.6, 'rgba(255,255,255,.7)');
}
/** Мираж: голубое озеро с отражёнными пальмами (полупрозрачное — рисуется с globalAlpha). */
function paintMirage(ctx) {
  const g = ctx.createLinearGradient(0, -36, 0, 30);
  g.addColorStop(0, 'rgba(160,220,255,.0)');
  g.addColorStop(0.35, 'rgba(140,210,250,.85)');
  g.addColorStop(1, 'rgba(110,190,240,.9)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 140, 34, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const y = -12 + i * 6,
      w = 110 - Math.abs(i - 2) * 22;
    ctx.moveTo(-w / 2 + (i % 2) * 12, y);
    ctx.lineTo(w / 2 + (i % 2) * 12, y);
  }
  ctx.stroke();
  // пальмы на «берегу» и их перевёрнутые отражения
  for (const [x, s] of [
    [-70, 1],
    [-48, 0.8],
    [64, 0.9],
  ]) {
    ctx.fillStyle = 'rgba(70,140,110,.55)';
    ctx.fillRect(x - 2 * s, -38 * s - 6, 4 * s, 34 * s);
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(k * 1.25 + 3.6) * 12 * s, -44 * s - 6 + Math.sin(k * 1.25 + 3.6) * 5 * s, 13 * s, 4 * s, k * 1.25 + 3.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(70,140,110,.25)';
    ctx.fillRect(x - 2 * s, 0, 4 * s, 22 * s);
  }
}
/** Перекати-поле: клубок сухих веточек; a — поворот (0–3). */
function paintTumbleweed(ctx, a) {
  ell(ctx, 2, 4, 14, 3.5, 'rgba(52,38,70,.15)');
  ctx.save();
  ctx.translate(0, -12);
  ctx.rotate((a * Math.PI) / 8);
  ell(ctx, 0, 0, 14, 13, 'rgba(190,150,80,.35)', OUT, 1.6);
  ctx.strokeStyle = '#a5803f';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const b = i * 0.9;
    ctx.moveTo(Math.cos(b) * 12, Math.sin(b) * 11);
    ctx.quadraticCurveTo(Math.cos(b + 2) * 4, Math.sin(b + 2) * 4, Math.cos(b + 3.4) * 12, Math.sin(b + 3.4) * 11);
  }
  ctx.stroke();
  ctx.restore();
}
defineArt({
  camel: [[-76, -102, 76, 20], paintCamel],
  bell: [[-14, -24, 14, 12], paintBell],
  mirage: [[-150, -78, 150, 40], paintMirage],
  tumbleweed: [[-18, -30, 18, 8], paintTumbleweed],
});

defineObjects({
  saguaro: {
    solid: true,
    map: () => '#4f9a3a',
    art: { saguaro: [[-30, -98, 30, 18], paintSaguaro] },
    draw: (ctx, o) => put('saguaro', o.x, o.y, (o.v || 0) % 3),
  },
  sandRock: {
    solid: true,
    map: () => '#c2814a',
    art: { sandRock: [[-48, -80, 50, 24], paintSandRock] },
    draw: (ctx, o) => put('sandRock', o.x, o.y, (o.v || 0) % 3),
  },
  dryBush: {
    flat: true,
    art: { dryBush: [[-18, -14, 18, 12], paintDryBush] },
    draw: (ctx, o) => put('dryBush', o.x, o.y, (o.v || 0) % 2),
  },
  well: {
    solid: true,
    map: () => '#c2814a',
    art: { well: [[-36, -82, 36, 22], paintWell] },
    draw: (ctx, o) => put('well', o.x, o.y),
  },
  obelisk: {
    solid: true,
    art: { obelisk: [[-22, -108, 26, 20], paintObelisk] },
    draw: (ctx, o) => put('obelisk', o.x, o.y),
  },
  digTools: {
    solid: true,
    art: { digTools: [[-30, -30, 34, 18], paintDigTools] },
    draw: (ctx, o) => put('digTools', o.x, o.y),
  },
  starPost: {
    solid: true,
    light: [0, -80, 110],
    art: { starPost: [[-36, -116, 36, 16], paintStarPost] },
    draw: (ctx, o, env) => put('starPost', o.x, o.y, env.dark > 0.35 ? 1 : 0),
  },
  safariBus: {
    solid: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    map: () => '#fcc419',
    art: { safariBus: [[-34, -82, 132, 22], (ctx) => paintBus(ctx, 1)] },
    draw: (ctx, o) => put('safariBus', o.x, o.y),
  },
  // верблюд Финик у привязи; o.away() — на нём сейчас катаются (рисует способ передвижения героя)
  camel: {
    solid: true,
    map: () => '#d9a066',
    draw(ctx, o, env) {
      if (o.away && o.away()) return;
      // жуёт: голова чуть качается — шаг спрайта в пиксель
      put('camel', o.x, o.y + (Math.sin(env.t * 2.2) > 0.6 ? -1 : 0), -1, 0);
    },
  },
});

// ---------- здания ----------
/** Шатёр Бархана: полосатый навес на шестах, вход откинут — внутри ковёр и подушки; верёвки к колышкам. */
function paintTent(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 54;
  baseShadow(ctx, g, 10);
  // верёвки и колышки
  for (const [x0, x1] of [
    [X + 8, X - 18],
    [X + W - 8, X + W + 18],
  ]) {
    line(ctx, x0, top + 30, x1, bot - 2, 'rgba(74,55,40,.7)', 1.4);
    fillRR(ctx, x1 - 2, bot - 8, 4, 10, 1, WOOD_D, OUT, 1);
  }
  // задняя стенка
  poly(ctx, [X + 4, bot - 6, X + 12, top + 26, X + W - 12, top + 26, X + W - 4, bot - 6], '#e9d8b4', OUT, 2.2);
  // крыша: два ската полосами
  const roof = [X - 10, top + 40, cx, top, X + W + 10, top + 40, X + W, top + 52, X, top + 52];
  poly(ctx, roof, '#f1e3c4', OUT, 2.4);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(roof[0], roof[1]);
  for (let i = 2; i < roof.length; i += 2) ctx.lineTo(roof[i], roof[i + 1]);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#c2255c';
  for (let x = X - 10; x < X + W + 10; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, top + 60);
    ctx.lineTo(x + 12, top + 60);
    ctx.lineTo(cx + (x + 6 - cx) * 0.12 + 6, top - 4);
    ctx.lineTo(cx + (x - cx) * 0.12, top - 4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  ctx.fillRect(cx, top - 10, W, 80);
  ctx.restore();
  poly(ctx, roof, null, OUT, 2.4);
  // бахрома по краю крыши
  for (let x = X + 2; x < X + W - 2; x += 10) poly(ctx, [x, top + 52, x + 5, top + 60, x + 10, top + 52], '#ffd43b', OUT, 1);
  // вход: тёмный проём, ковёр, откинутые полы
  poly(ctx, [cx - 30, bot - 4, cx - 22, top + 56, cx + 22, top + 56, cx + 30, bot - 4], lit ? '#7a4a22' : '#4a2f22', OUT, 2);
  if (lit) glow(ctx, cx, bot - 30, 40, 0.35);
  fillRR(ctx, cx - 26, bot - 12, 52, 10, 3, '#e8590c', OUT, 1.4);
  for (let i = 0; i < 5; i++) ell(ctx, cx - 18 + i * 9, bot - 7, 2, 2, '#ffd43b');
  ell(ctx, cx - 12, bot - 18, 8, 5, '#4dabf7', OUT, 1.2);
  ell(ctx, cx + 12, bot - 18, 8, 5, '#ffd43b', OUT, 1.2);
  for (const s of [-1, 1])
    poly(ctx, [cx + s * 22, top + 56, cx + s * 40, top + 62, cx + s * 34, bot - 4, cx + s * 28, bot - 4], '#f1e3c4', OUT, 1.8);
  // шест с флажком
  line(ctx, cx, top, cx, top - 26, OUT, 3);
  poly(ctx, [cx, top - 26, cx + 18, top - 21, cx, top - 16], '#ffd43b', OUT, 1.4);
  // фонарик у входа
  const lx = cx + 50;
  line(ctx, lx, bot - 2, lx, bot - 44, OUT, 3);
  line(ctx, lx, bot - 2, lx, bot - 44, WOOD_D, 1.6);
  fillRR(ctx, lx - 6, bot - 56, 12, 14, 3, lit ? LIT : '#ffe8a1', OUT, 1.6);
  poly(ctx, [lx - 7, bot - 56, lx, bot - 63, lx + 7, bot - 56], '#c2255c', OUT, 1.4);
}
/** Пирамида: ступени из песчаника, светлая грань слева и тень справа, вход с иероглифами, золотая верхушка. */
function paintPyramid(ctx, b) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    apex = bot - W * 0.78;
  shadow(ctx, cx + 30, bot - 2, W * 0.62, 18);
  const L = X - 14,
    R = X + W + 14;
  poly(ctx, [L, bot, cx, apex, cx + 26, bot], '#f0c987', OUT, 2.6);
  poly(ctx, [cx + 26, bot, cx, apex, R, bot], '#d29a5c', OUT, 2.6);
  // ступени
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(L, bot);
  ctx.lineTo(cx, apex);
  ctx.lineTo(R, bot);
  ctx.closePath();
  ctx.clip();
  for (let y = bot - 14; y > apex; y -= 14) {
    line(ctx, L, y, R, y, 'rgba(120,70,30,.35)', 1.4);
    line(ctx, L, y + 2, R, y + 2, 'rgba(255,240,210,.35)', 1);
  }
  for (let y = bot; y > apex; y -= 28)
    for (let x = L + ((y / 14) % 2) * 20; x < R; x += 40) line(ctx, x, y, x, y - 14, 'rgba(120,70,30,.2)', 1);
  ctx.restore();
  poly(ctx, [L, bot, cx, apex, R, bot], null, OUT, 2.6);
  // золотая верхушка
  const k = 0.12,
    ty = apex + (bot - apex) * k;
  poly(ctx, [cx - (cx - L) * k, ty, cx, apex, cx + (R - cx) * k, ty], '#ffd43b', OUT, 2);
  poly(ctx, [cx, apex, cx + (R - cx) * k, ty, cx + 4, ty], '#f59f00');
  // вход
  fillRR(ctx, cx - 30, bot - 66, 60, 10, 2, STONE_SD, OUT, 2);
  ctx.beginPath();
  ctx.moveTo(cx - 22, bot);
  ctx.lineTo(cx - 22, bot - 56);
  ctx.lineTo(cx + 22, bot - 56);
  ctx.lineTo(cx + 22, bot);
  ctx.closePath();
  ctx.fillStyle = '#3b2a20';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // иероглифы у входа: глаз, скарабей, волна, солнце
  ctx.strokeStyle = 'rgba(100,55,20,.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const x = cx + s * 40;
    ctx.moveTo(x - 6, bot - 44);
    ctx.quadraticCurveTo(x, bot - 50, x + 6, bot - 44);
    ctx.quadraticCurveTo(x, bot - 40, x - 6, bot - 44);
    ctx.moveTo(x + 3, bot - 24);
    ctx.arc(x, bot - 24, 3, 0, TAU);
    ctx.moveTo(x - 6, bot - 12);
    ctx.quadraticCurveTo(x - 3, bot - 16, x, bot - 12);
    ctx.quadraticCurveTo(x + 3, bot - 8, x + 6, bot - 12);
  }
  ctx.stroke();
  ell(ctx, cx, bot - 61, 6, 3.4, '#ffd43b', OUT, 1.2);
}
/** Остановка каравана в пустыне: полосатый навес на столбиках, лавочка, табличка «В город» и расписание. */
function paintStop(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 30;
  baseShadow(ctx, g);
  for (const x of [X + 14, X + W - 14]) fillRR(ctx, x - 4, top + 10, 8, bot - top - 12, 2, WOOD_D, OUT, 1.8);
  // лавочка
  fillRR(ctx, X + 26, bot - 30, W - 52, 9, 3, WOOD, OUT, 1.8);
  for (const x of [X + 34, X + W - 34]) fillRR(ctx, x - 3, bot - 22, 6, 18, 1, WOOD_D, OUT, 1.2);
  // навес
  poly(ctx, [X - 6, top + 20, X + 8, top - 4, X + W - 8, top - 4, X + W + 6, top + 20], '#ffd43b', OUT, 2.2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X - 6, top - 6, W + 12, 28);
  ctx.clip();
  ctx.fillStyle = '#e8590c';
  for (let x = X - 6; x < X + W + 6; x += 24) ctx.fillRect(x, top - 6, 12, 28);
  ctx.restore();
  poly(ctx, [X - 6, top + 20, X + 8, top - 4, X + W - 8, top - 4, X + W + 6, top + 20], null, OUT, 2.2);
  for (let x = X - 2; x < X + W; x += 12) poly(ctx, [x, top + 20, x + 6, top + 27, x + 12, top + 20], '#e8590c', OUT, 1);
  // табличка и расписание
  signBoard(ctx, b.signText ? b.signText() : '🏙️ В город', cx, top + 44, 92, 20, 'wood');
  fillRR(ctx, X + W - 30, bot - 58, 20, 24, 2, '#fff', OUT, 1.3);
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚌', X + W - 20, bot - 46);
  if (lit) glow(ctx, cx, top + 30, 50, 0.3);
}
defineBuildings({
  tent: {
    paint: paintTent,
    icon: '⛺',
    box: (b) => [-40, -96, b.w * T + 40, b.h * T + 14],
    hitUp: () => 60,
    lights: (b) => [[(b.x + b.w / 2) * T, (b.y + b.h) * T - 24, 70, 50, 0.9]],
  },
  pyramid: {
    paint: paintPyramid,
    icon: '🔺',
    box: (b) => [-40, b.h * T - b.w * T * 0.78 - 20, b.w * T + 80, b.h * T + 30],
    hitUp: (b) => b.w * T * 0.78 - b.h * T,
  },
  caravanStop: {
    paint: paintStop,
    icon: '🚌',
    box: (b) => [-24, -50, b.w * T + 24, b.h * T + 14],
    hitUp: () => 30,
    lights: (b) => [[(b.x + b.w / 2) * T, b.y * T, 70, 50, 0.7]],
  },
});
