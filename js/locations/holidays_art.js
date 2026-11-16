// ПРАЗДНИКИ (П.13): рисунки украшений города для кэша спрайтов — ёлка, снеговики, гирлянды, свечи в окнах, венки,
// домик-вертеп, дракон, фонарики, карусель, чучело, ярмарочные домики, канат. Где что стоит и когда — locations/holidays.js.
//
// Всё неподвижное — в спрайтах (defineArt / SP.put), параметры рисунка (наряжена ли ёлка, кадр мигания гирлянды,
// поворот карусели) входят в ключ: кадров у каждого рисунка 2–8, так что в кадре — только копии готовых картинок.
// Рисунки — вокруг точки (0, 0): у того, что стоит, это середина нижнего края (как у предметов карты).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade, heart } from '../core/draw.js';
import { OUT, defineArt } from '../engine/topdown/kinds.js';
import { shadow, snowCap, signBoard, WOOD, WOOD_D, GOLD } from './common/paint.js';
import { trunk } from './common/objects.js';

const BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b'];
const OFF = '#ced4da';

// ---------- ёлка ----------
/** Ярус ёлки: скруглённый треугольник с зубчиками и снегом сверху. */
function firTier(ctx, yy, w2, hgt, snow) {
  const base = '#2b8a3e',
    dark = shade(base, -0.22),
    lite = shade(base, 0.22);
  const tier = new Path2D();
  tier.moveTo(0, yy - hgt);
  tier.quadraticCurveTo(w2 * 0.5, yy - hgt * 0.35, w2, yy);
  tier.quadraticCurveTo(w2 * 0.72, yy + 6, w2 * 0.5, yy - 1);
  tier.quadraticCurveTo(w2 * 0.25, yy + 7, 0, yy);
  tier.quadraticCurveTo(-w2 * 0.25, yy + 7, -w2 * 0.5, yy - 1);
  tier.quadraticCurveTo(-w2 * 0.72, yy + 6, -w2, yy);
  tier.quadraticCurveTo(-w2 * 0.5, yy - hgt * 0.35, 0, yy - hgt);
  tier.closePath();
  ctx.fillStyle = base;
  ctx.fill(tier);
  ctx.save();
  ctx.clip(tier);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0, yy - hgt);
  ctx.lineTo(w2 + 4, yy + 8);
  ctx.lineTo(w2 * 0.25, yy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lite;
  ctx.beginPath();
  ctx.ellipse(-w2 * 0.4, yy - hgt * 0.3, w2 * 0.15, hgt * 0.24, 0.5, 0, TAU);
  ctx.fill();
  if (snow) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, yy - hgt - 2);
    ctx.lineTo(w2 * 0.6, yy - hgt * 0.38);
    ctx.quadraticCurveTo(w2 * 0.3, yy - hgt * 0.3, w2 * 0.18, yy - hgt * 0.45);
    ctx.quadraticCurveTo(0, yy - hgt * 0.28, -w2 * 0.2, yy - hgt * 0.45);
    ctx.quadraticCurveTo(-w2 * 0.34, yy - hgt * 0.3, -w2 * 0.6, yy - hgt * 0.38);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke(tier);
}
/** Ярусы большой ёлки: [y низа, полуширина, высота] — общие для рисунка и для огоньков. */
export const FIR = [
  [-26, 62, 58],
  [-62, 50, 54],
  [-96, 38, 50],
  [-128, 26, 44],
];
export const FIR_TOP = -176;
/** Ёлка на площади крупнее рисунка (в сценке «Нарядим ёлку» рисунок свой масштаб берёт сам). */
export const FIR_SCALE = 1.35;
/** Где на ёлке висят игрушки (наряжена) — точки относительно её основания. */
export const FIR_TOYS = [
  [-34, -40],
  [30, -36],
  [-6, -50],
  [-24, -78],
  [22, -74],
  [0, -100],
  [-14, -112],
  [16, -116],
  [-44, -30],
  [46, -30],
  [-2, -140],
  [10, -82],
];
/** Огоньки гирлянды на ёлке — по спирали (точки относительно основания). */
export const FIR_BULBS = (() => {
  const out = [];
  for (let i = 0; i < 22; i++) {
    const q = i / 22,
      y = -30 - q * 120,
      w = 56 - q * 44;
    out.push([Math.sin(q * 15) * w * 0.9, y + Math.cos(q * 15) * 3]);
  }
  return out;
})();
export function paintFir(ctx, dressed, frame) {
  shadow(ctx, 0, 6, 64, 14);
  // подставка: крестовина в красной коробке с золотым бантом
  trunk(ctx, 0, -30, 14, -8, '#8d5524');
  fillRR(ctx, -22, -14, 44, 18, 4, '#e03131', OUT, 2);
  fillRR(ctx, -22, -14, 44, 5, 3, '#fa5252');
  line(ctx, 0, -14, 0, 4, GOLD, 4);
  for (const [i, [yy, w2, hgt]] of FIR.entries()) firTier(ctx, yy, w2, hgt, true, i);
  // мишура
  ctx.strokeStyle = 'rgba(255,212,59,.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const q = i / 40,
      y = -34 - q * 112,
      w = 54 - q * 40,
      x = Math.sin(q * 15 + 1.4) * w * 0.85;
    if (i) ctx.lineTo(x, y + 6);
    else ctx.moveTo(x, y + 6);
  }
  ctx.stroke();
  // огоньки
  FIR_BULBS.forEach(([x, y], i) => {
    const on = (i + frame) % 2 === 0 || frame === 2;
    ell(ctx, x, y, 3.4, 4, on ? BULBS[i % BULBS.length] : OFF, OUT, 1);
    if (on) ell(ctx, x - 1, y - 1.5, 1.2, 1.2, 'rgba(255,255,255,.8)');
  });
  if (dressed) {
    FIR_TOYS.forEach(([x, y], i) => toy(ctx, x, y, i));
    star(ctx, 0, FIR_TOP + 8, 15, GOLD, OUT, 2.2);
    star(ctx, -3, FIR_TOP + 5, 5, '#fff3bf');
    // подарки под ёлкой
    for (const [x, c, c2, w] of [
      [-44, '#4dabf7', '#ffd43b', 20],
      [40, '#da77f2', '#fff', 18],
      [-26, '#69db7c', '#e03131', 14],
    ]) {
      fillRR(ctx, x - w / 2, -w + 4, w, w, 3, c, OUT, 1.6);
      line(ctx, x, -w + 4, x, 4, c2, 3);
      line(ctx, x - w / 2, -w / 2 + 4, x + w / 2, -w / 2 + 4, c2, 3);
      ell(ctx, x - 4, -w + 2, 4, 3, c2, OUT, 1, -0.4);
      ell(ctx, x + 4, -w + 2, 4, 3, c2, OUT, 1, 0.4);
    }
  } else {
    // ненаряженная: пустая макушка
    line(ctx, 0, FIR_TOP + 4, 0, FIR_TOP + 16, '#2b8a3e', 3);
  }
}
/** Ёлочная игрушка: шар, сосулька или звёздочка. */
export function toy(ctx, x, y, i, s = 1) {
  const c = BULBS[(i * 2 + 1) % BULBS.length];
  line(ctx, x, y - 8 * s, x, y - 4 * s, OUT, 1);
  if (i % 3 === 2) {
    poly(ctx, [x - 4 * s, y - 4 * s, x + 4 * s, y - 4 * s, x, y + 12 * s], '#d0ebff', OUT, 1.2);
    return;
  }
  if (i % 5 === 4) {
    star(ctx, x, y + 2 * s, 6 * s, GOLD, OUT, 1.2);
    return;
  }
  ell(ctx, x, y + 2 * s, 6 * s, 6 * s, c, OUT, 1.4);
  ell(ctx, x - 2 * s, y, 2 * s, 1.6 * s, 'rgba(255,255,255,.7)');
  fillRR(ctx, x - 2 * s, y - 5 * s, 4 * s, 3 * s, 1, GOLD, OUT, 0.8);
}

// ---------- снеговик ----------
const SCARF = ['#e03131', '#1c7ed6', '#f76707'];
function paintSnowman(ctx, v) {
  shadow(ctx, 0, 6, 28, 8);
  const ball = (y, r) => {
    ell(ctx, 0, y, r, r * 0.92, '#fff', OUT, 2);
    ell(ctx, r * 0.3, y + r * 0.3, r * 0.7, r * 0.5, 'rgba(160,190,225,.35)');
  };
  ball(-16, 22);
  ball(-48, 16);
  ball(-72, 12);
  // руки-веточки
  for (const sg of [-1, 1]) {
    line(ctx, sg * 14, -52, sg * 32, -66, '#8d5524', 2.6);
    line(ctx, sg * 27, -62, sg * 32, -58, '#8d5524', 1.8);
  }
  // пуговки, глаза, нос-морковка, улыбка
  for (const y of [-54, -44, -24]) ell(ctx, 0, y, 2.2, 2.2, '#343a40');
  ell(ctx, -4, -75, 1.8, 1.8, '#212529');
  ell(ctx, 4, -75, 1.8, 1.8, '#212529');
  poly(ctx, [0, -71, 12, -69, 0, -67], '#ff922b', OUT, 1);
  ctx.strokeStyle = '#212529';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -68, 4, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  // шарф
  const sc = SCARF[v % SCARF.length];
  fillRR(ctx, -12, -63, 24, 6, 3, sc, OUT, 1.4);
  fillRR(ctx, 4, -60, 6, 14, 2, sc, OUT, 1.2);
  // ведро на голове
  poly(ctx, [-9, -82, 9, -82, 7, -96, -7, -96], v === 1 ? '#868e96' : '#e8590c', OUT, 1.6);
  line(ctx, -11, -82, 11, -82, OUT, 2);
}

// ---------- гирлянды между фонарями ----------
/**
 * Верёвка с украшениями между точками (0, 0) и (dx, dy): style — 'ny' (огоньки), 'cny' (красные фонарики),
 * 'mas' (флажки). frame — кадр мигания. Возвращает точки украшений (для света ночью).
 */
export function stringPoints(dx, dy, n) {
  const pts = [];
  for (let i = 1; i < n; i++) {
    const q = i / n;
    pts.push([dx * q, dy * q + Math.sin(q * Math.PI) * 34]);
  }
  return pts;
}
export function paintString(ctx, style, dx, dy, frame) {
  const len = Math.hypot(dx, dy),
    n = Math.max(3, Math.round(len / (style === 'cny' ? 44 : 22)));
  ctx.strokeStyle = 'rgba(74,55,40,.8)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(dx / 2, dy / 2 + 68, dx, dy);
  ctx.stroke();
  stringPoints(dx, dy, n).forEach(([x, y], i) => {
    if (style === 'cny') return lantern(ctx, x, y + 2, 0.75, i);
    if (style === 'mas') {
      const c = BULBS[i % BULBS.length];
      poly(ctx, [x - 7, y - 1, x + 7, y - 1, x, y + 15], c, OUT, 1.1);
      return;
    }
    const on = (i + frame) % 2 === 0;
    ell(ctx, x, y + 4, 3.4, 4.2, on ? BULBS[i % BULBS.length] : OFF, 'rgba(74,55,40,.7)', 1);
  });
}
/** Красный китайский фонарик (висит на шнурке, точка (x, y) — верх). */
export function lantern(ctx, x, y, s = 1, i = 0) {
  line(ctx, x, y - 4 * s, x, y + 2 * s, OUT, 1);
  fillRR(ctx, x - 6 * s, y + 1 * s, 12 * s, 3 * s, 1, GOLD, OUT, 0.9);
  ell(ctx, x, y + 12 * s, 11 * s, 9 * s, i % 4 === 3 ? '#ff922b' : '#e03131', OUT, 1.4);
  for (const k of [-0.5, 0, 0.5]) line(ctx, x + k * 10 * s, y + 4 * s, x + k * 10 * s, y + 20 * s, 'rgba(120,20,20,.45)', 1);
  ell(ctx, x - 4 * s, y + 9 * s, 2.5 * s, 3.5 * s, 'rgba(255,255,255,.35)');
  fillRR(ctx, x - 6 * s, y + 19 * s, 12 * s, 3 * s, 1, GOLD, OUT, 0.9);
  line(ctx, x, y + 22 * s, x, y + 30 * s, GOLD, 1.6);
}

// ---------- Рождество: свеча в окне, венок на двери, домик-вертеп ----------
function paintCandle(ctx, frame) {
  ell(ctx, 0, -6, 14, 14, 'rgba(255,212,59,.35)');
  fillRR(ctx, -4, -8, 8, 13, 2, '#fff', OUT, 1.1);
  fillRR(ctx, -7, 4, 14, 3, 1.5, GOLD, OUT, 0.9);
  ell(ctx, frame ? 0.6 : -0.6, -12, 2.4, 4.2, '#ffd43b', OUT, 0.8);
  ell(ctx, 0, -11, 1, 2, '#fff');
}
function paintWreath(ctx) {
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUT;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#2b8a3e';
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ell(ctx, Math.cos(a) * 11, Math.sin(a) * 11, 3.4, 2, i % 2 ? '#37b24d' : '#2f9e44', null, 0, a + 1.2);
  }
  for (const a of [0.6, 1.9, 3.3, 4.6]) ell(ctx, Math.cos(a) * 11, Math.sin(a) * 11, 2, 2, '#e03131', OUT, 0.8);
  // бант
  ell(ctx, -5, 11, 4.5, 3, '#e03131', OUT, 1, 0.4);
  ell(ctx, 5, 11, 4.5, 3, '#e03131', OUT, 1, -0.4);
  ell(ctx, 0, 11, 2.2, 2.2, '#c92a2a', OUT, 0.8);
}
function paintCrib(ctx) {
  shadow(ctx, 0, 6, 62, 12);
  // настил с соломой
  fillRR(ctx, -56, -14, 112, 16, 3, WOOD, OUT, 2);
  ctx.fillStyle = '#ffe066';
  for (let i = 0; i < 18; i++) ctx.fillRect(-50 + i * 6, -18 - (i % 3), 4, 6);
  // стенки и задник
  fillRR(ctx, -50, -96, 100, 84, 4, '#e9c48e', OUT, 2);
  ctx.fillStyle = 'rgba(120,70,30,.18)';
  for (let x = -44; x < 48; x += 12) ctx.fillRect(x, -94, 2, 80);
  // окошко-звезда в задней стенке
  ell(ctx, 0, -76, 12, 12, '#1c2a5a', OUT, 1.5);
  star(ctx, 0, -76, 6, '#fff3bf');
  // ясли с сеном и мягким светом
  ell(ctx, 0, -32, 30, 14, 'rgba(255,230,140,.45)');
  poly(ctx, [-20, -34, 20, -34, 14, -18, -14, -18], WOOD_D, OUT, 1.6);
  ctx.fillStyle = '#ffd43b';
  for (let i = 0; i < 7; i++) ctx.fillRect(-16 + i * 5, -40 + (i % 2) * 2, 3, 8);
  // ягнёнок
  for (const [x, y] of [
    [-36, -26],
    [-30, -30],
    [-24, -26],
  ])
    ell(ctx, x, y, 7, 6, '#fff', OUT, 1.2);
  ell(ctx, -40, -32, 4.5, 4, '#495057', OUT, 1);
  ell(ctx, -41, -33, 1, 1, '#fff');
  // ослик
  fillRR(ctx, 22, -38, 24, 14, 6, '#adb5bd', OUT, 1.4);
  fillRR(ctx, 38, -50, 10, 18, 4, '#adb5bd', OUT, 1.4);
  ell(ctx, 40, -54, 2.5, 6, '#adb5bd', OUT, 1, -0.3);
  ell(ctx, 46, -54, 2.5, 6, '#adb5bd', OUT, 1, 0.3);
  ell(ctx, 44, -44, 1.2, 1.2, '#212529');
  for (const x of [26, 40]) line(ctx, x, -24, x, -14, OUT, 2.4);
  // столбы и крыша со снегом, звезда
  for (const x of [-54, 50]) fillRR(ctx, x, -100, 6, 92, 2, WOOD_D, OUT, 1.6);
  poly(ctx, [-66, -96, 0, -134, 66, -96, 58, -90, 0, -122, -58, -90], WOOD, OUT, 2);
  snowCap(ctx, -32, -114, 50, 6);
  snowCap(ctx, 32, -114, 50, 6);
  star(ctx, 0, -146, 13, GOLD, OUT, 2);
  for (let i = 0; i < 3; i++) line(ctx, -6 + i * 6, -132, -10 + i * 10, -122, 'rgba(255,212,59,.7)', 1.6);
}

// ---------- Китайский Новый год: дракон, столик с небесными фонариками ----------
function paintDragonHead(ctx, f) {
  const jaw = f ? 4 : 0;
  shadow(ctx, 0, 6, 26, 7);
  for (const x of [-8, 8]) line(ctx, x, -8, x, 4, OUT, 3.5); // лапки танцора
  // грива
  for (let i = 0; i < 7; i++) ell(ctx, -18 + Math.cos(i) * 4, -40 + i * 5, 9, 6, i % 2 ? '#ffd43b' : '#ff922b', OUT, 1.1);
  // голова
  fillRR(ctx, -20, -48, 44, 30, 12, '#e03131', OUT, 2);
  fillRR(ctx, 12, -40 + jaw, 20, 14, 6, '#fa5252', OUT, 1.6); // нижняя челюсть
  fillRR(ctx, 8, -48, 26, 14, 7, '#e03131', OUT, 1.6); // морда
  ell(ctx, 30, -44, 2, 2, OUT);
  // зубки и язычок
  for (const x of [16, 22, 28]) poly(ctx, [x, -34, x + 3, -34, x + 1.5, -30], '#fff', OUT, 0.8);
  ell(ctx, 22, -28 + jaw, 4, 2, '#ff8fab');
  // глаза — большие и добрые
  ell(ctx, 2, -48, 8, 8, '#fff', OUT, 1.4);
  ell(ctx, 4, -48, 4, 4.5, '#212529');
  ell(ctx, 5, -50, 1.5, 1.5, '#fff');
  fillRR(ctx, -6, -58, 16, 5, 2.5, GOLD, OUT, 1.2); // бровь
  // рожки и усы
  for (const [x, a] of [
    [-6, -0.5],
    [4, -0.2],
  ]) {
    ctx.save();
    ctx.translate(x, -56);
    ctx.rotate(a);
    fillRR(ctx, -2.5, -16, 5, 16, 2.5, GOLD, OUT, 1.2);
    ctx.restore();
  }
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, -42);
  ctx.quadraticCurveTo(44, -50, 48, -40 + (f ? 3 : -3));
  ctx.moveTo(30, -38);
  ctx.quadraticCurveTo(42, -34, 44, -24 + (f ? -3 : 3));
  ctx.stroke();
}
function paintDragonBody(ctx, tail) {
  shadow(ctx, 0, 6, 20, 6);
  for (const x of [-5, 5]) line(ctx, x, -10, x, 4, OUT, 3.2); // лапки танцора под драконом
  if (tail) {
    // хвост: сужается назад, на кончике — золотая кисточка
    ell(ctx, -4, -30, 16, 11, '#e03131', OUT, 2);
    for (let i = 0; i < 3; i++) ell(ctx, -20 - i * 6, -34 + i * 5, 7 - i, 6 - i, i % 2 ? '#ffd43b' : '#ff922b', OUT, 1.1);
    ell(ctx, -4, -25, 10, 4, '#ffd43b', OUT, 1);
    return;
  }
  ell(ctx, 0, -30, 23, 16, '#e03131', OUT, 2);
  ell(ctx, 0, -23, 17, 6, '#ffd43b', OUT, 1.2); // золотое брюшко
  for (const x of [-10, 0, 10]) poly(ctx, [x - 4, -44, x, -53, x + 4, -44], GOLD, OUT, 1); // гребень
  for (const x of [-8, 6]) ctx.fillStyle = 'rgba(160,20,20,.35)', ctx.beginPath(), ctx.arc(x, -32, 5, 0, Math.PI), ctx.fill(); // чешуйки
  ell(ctx, -8, -38, 6, 3, 'rgba(255,255,255,.35)');
  // бахрома снизу
  for (let i = -3; i <= 3; i++) line(ctx, i * 6, -16, i * 6, -10, '#ffd43b', 2);
}
function paintLanternTable(ctx) {
  shadow(ctx, 0, 6, 34, 9);
  fillRR(ctx, -30, -26, 60, 8, 3, '#c92a2a', OUT, 1.8);
  for (const x of [-24, 20]) fillRR(ctx, x, -20, 5, 22, 2, '#8d5524', OUT, 1.4);
  for (const [x, y] of [
    [-16, -26],
    [2, -26],
    [18, -26],
  ])
    skyLantern(ctx, x, y - 22, 0.62, false);
  signBoard(ctx, '🏮 Фонарики', 0, -66, 74, 18, 'plate', '#e03131');
  line(ctx, 0, -57, 0, -50, OUT, 2);
}
/** Небесный фонарик: бумажный купол, внутри огонёк; (x, y) — центр. */
export function skyLantern(ctx, x, y, s = 1, glow = true) {
  if (glow) {
    const g = ctx.createRadialGradient(x, y, 2 * s, x, y, 30 * s);
    g.addColorStop(0, 'rgba(255,214,120,.75)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 30 * s, y - 30 * s, 60 * s, 60 * s);
  }
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y + 14 * s);
  ctx.quadraticCurveTo(x - 14 * s, y - 14 * s, x, y - 16 * s);
  ctx.quadraticCurveTo(x + 14 * s, y - 14 * s, x + 9 * s, y + 14 * s);
  ctx.closePath();
  ctx.fillStyle = glow ? '#ffd8a8' : '#fff4e6';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  line(ctx, x - 9 * s, y + 14 * s, x + 9 * s, y + 14 * s, '#e03131', 2.4);
  if (glow) ell(ctx, x, y + 9 * s, 3 * s, 4.5 * s, '#ffd43b');
}

// ---------- Масленица: карусель, чучело, ярмарочные домики, канат ----------
const HORSES = ['#fff', '#ffc9de', '#a5d8ff', '#ffe066'];
function paintCarousel(ctx, frame) {
  shadow(ctx, 0, 4, 70, 18);
  ell(ctx, 0, -6, 66, 18, '#e9c48e', OUT, 2.2); // помост
  ell(ctx, 0, -10, 62, 15, '#f3d9a4');
  line(ctx, 0, -10, 0, -112, OUT, 6);
  line(ctx, 0, -10, 0, -112, GOLD, 3.5);
  // лошадки по кругу: сначала дальние
  const list = HORSES.map((c, i) => {
    const a = (i / HORSES.length) * TAU + frame * (TAU / 32);
    return { c, x: Math.cos(a) * 46, y: -10 + Math.sin(a) * 11, a };
  }).sort((p, q) => p.y - q.y);
  for (const h of list) {
    const up = Math.sin(h.a * 2 + frame) * 4;
    line(ctx, h.x, h.y - 88, h.x, h.y - 6, '#adb5bd', 2);
    const d = Math.sin(h.a) > 0 ? -1 : 1;
    ctx.save();
    ctx.translate(h.x, h.y - 30 + up);
    ctx.scale(d, 1);
    fillRR(ctx, -12, -6, 24, 11, 5, h.c, OUT, 1.5);
    fillRR(ctx, 8, -16, 8, 14, 3, h.c, OUT, 1.3);
    ell(ctx, 14, -16, 6, 4, h.c, OUT, 1.2);
    for (const x of [-8, 8]) line(ctx, x, 4, x - 3, 12, OUT, 2);
    fillRR(ctx, -6, -9, 10, 4, 2, '#e03131', OUT, 0.8);
    ctx.restore();
  }
  // крыша-шатёр в полоску
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI,
      a1 = Math.PI + ((i + 1) / n) * Math.PI;
    poly(ctx, [0, -138, Math.cos(a0) * 70, -100 + Math.sin(a0) * -2, Math.cos(a1) * 70, -100 + Math.sin(a1) * -2], i % 2 ? '#fff' : '#e03131', OUT, 1.6);
  }
  for (let i = 0; i < 9; i++) ell(ctx, -64 + i * 16, -98, 8, 6, i % 2 ? '#fff' : '#e03131', OUT, 1.2);
  ell(ctx, 0, -140, 5, 5, GOLD, OUT, 1.4);
  line(ctx, 0, -144, 0, -158, OUT, 1.6);
  poly(ctx, [0, -158, 12, -154, 0, -150], '#4dabf7', OUT, 1);
}
function paintEffigy(ctx) {
  shadow(ctx, 0, 6, 26, 8);
  // поленница у основания
  for (const [x, y] of [
    [-12, -4],
    [12, -4],
    [0, -10],
  ])
    fillRR(ctx, x - 12, y - 4, 24, 8, 4, '#a8703f', OUT, 1.4);
  line(ctx, 0, 0, 0, -120, OUT, 6);
  line(ctx, 0, 0, 0, -120, WOOD_D, 3.5);
  line(ctx, -34, -86, 34, -86, OUT, 5);
  line(ctx, -34, -86, 34, -86, WOOD_D, 3);
  // соломенное тело в пёстром сарафане
  poly(ctx, [-14, -88, 14, -88, 26, -30, -26, -30], '#e64980', OUT, 2);
  for (let i = 0; i < 4; i++) line(ctx, -22 + i * 3, -44 + i * 4, 22 - i * 3, -44 + i * 4, i % 2 ? '#ffd43b' : '#fff', 2);
  ctx.fillStyle = '#ffe066';
  for (let i = 0; i < 9; i++) ctx.fillRect(-22 + i * 5, -32, 3, 12);
  // руки-солома
  for (const sg of [-1, 1]) {
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < 3; i++) ctx.fillRect(sg * 34 - 2 + i * sg * 2, -86 + i * 3, 3, 12);
  }
  // голова в платочке
  ell(ctx, 0, -100, 12, 13, '#fff4e6', OUT, 1.6);
  ell(ctx, -4, -101, 1.6, 1.6, '#212529');
  ell(ctx, 4, -101, 1.6, 1.6, '#212529');
  ell(ctx, -7, -96, 2.5, 1.6, '#ffa8a8');
  ell(ctx, 7, -96, 2.5, 1.6, '#ffa8a8');
  ctx.strokeStyle = '#c92a2a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -96, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, -98);
  ctx.quadraticCurveTo(0, -122, 14, -98);
  ctx.quadraticCurveTo(0, -110, -14, -98);
  ctx.fillStyle = '#1c7ed6';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (const [x, y] of [
    [-6, -108],
    [4, -111],
    [8, -104],
  ])
    ell(ctx, x, y, 1.6, 1.6, '#fff');
  // ленточки
  for (const [x, c] of [
    [-30, '#ff6b6b'],
    [30, '#4dabf7'],
  ])
    line(ctx, x, -84, x + (x > 0 ? 6 : -6), -64, c, 2.4);
}
/** Ярмарочный домик: v 0 — «Блины» (стопка блинов и самовар), 1 — «Ярмарка» (игрушки, бублики). */
function paintBooth(ctx, v) {
  shadow(ctx, 0, 6, 54, 11);
  const c1 = v ? '#1c7ed6' : '#e03131';
  fillRR(ctx, -48, -40, 96, 42, 3, '#e9c48e', OUT, 2);
  fillRR(ctx, -52, -46, 104, 10, 3, WOOD, OUT, 2); // прилавок
  for (const x of [-48, 42]) fillRR(ctx, x, -104, 6, 62, 2, WOOD_D, OUT, 1.5);
  // навес в полоску
  for (let i = 0; i < 6; i++) {
    poly(ctx, [-56 + i * 19, -106, -56 + (i + 1) * 19, -106, -56 + (i + 1) * 19, -90, -56 + i * 19, -90], i % 2 ? '#fff' : c1, OUT, 1.4);
    ell(ctx, -46.5 + i * 19, -90, 9.5, 5, i % 2 ? '#fff' : c1, OUT, 1.2);
  }
  poly(ctx, [-58, -106, 0, -126, 58, -106], c1, OUT, 2);
  snowCap(ctx, 0, -114, 70, 5);
  if (v === 0) {
    // стопка блинов и баночки
    for (let i = 0; i < 6; i++) ell(ctx, -18, -50 - i * 4, 18 - i, 5, i % 2 ? '#fcc419' : '#f59f00', OUT, 1.1);
    ell(ctx, -18, -74, 6, 3, '#e03131', OUT, 1);
    for (const [x, c] of [
      [14, '#e03131'],
      [28, '#fab005'],
    ]) {
      fillRR(ctx, x - 6, -60, 12, 14, 3, c, OUT, 1.2);
      fillRR(ctx, x - 6, -63, 12, 4, 2, '#fff', OUT, 0.9);
    }
    signBoard(ctx, '🥞 Блины', 0, -138, 78, 20, 'plate', '#f59f00');
  } else {
    // бублики на верёвке и игрушки
    for (let i = 0; i < 5; i++) ell(ctx, -30 + i * 15, -76 + Math.sin(i) * 2, 6, 6, '#d9a066', OUT, 1.2);
    line(ctx, -40, -80, 40, -80, OUT, 1);
    for (let i = 0; i < 5; i++) ell(ctx, -30 + i * 15, -76 + Math.sin(i) * 2, 2.4, 2.4, '#e9c48e');
    fillRR(ctx, -32, -60, 16, 14, 4, '#e64980', OUT, 1.2); // матрёшка-коробочка
    ell(ctx, -24, -64, 6, 6, '#e64980', OUT, 1.2);
    ell(ctx, -24, -64, 3.4, 3.4, '#fff4e6');
    heart(ctx, 8, -54, 6, '#ff6b9d');
    star(ctx, 26, -54, 7, GOLD, OUT, 1.2);
    signBoard(ctx, '🎪 Ярмарка', 0, -138, 86, 20, 'plate', '#1c7ed6');
  }
}
/** Канат для «Перетягивания каната»: лежит на снегу (плоский), посередине — красная ленточка, по краям — флажки. */
function paintRope(ctx) {
  const L = 150;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-L, 0);
  ctx.bezierCurveTo(-L / 2, 8, L / 2, -8, L, 0);
  ctx.stroke();
  ctx.strokeStyle = '#d9a066';
  ctx.lineWidth = 4.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,90,40,.6)';
  ctx.lineWidth = 1;
  for (let x = -L + 6; x < L; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, -2);
    ctx.lineTo(x + 4, 2);
    ctx.stroke();
  }
  ell(ctx, -6, -2, 6, 4, '#e03131', OUT, 1.2, -0.5);
  ell(ctx, 6, -2, 6, 4, '#e03131', OUT, 1.2, 0.5);
  // черта посередине и флажки у концов
  line(ctx, 0, -18, 0, 16, 'rgba(224,49,49,.5)', 2.4);
  for (const [x, c] of [
    [-L - 8, '#4dabf7'],
    [L + 8, '#ff922b'],
  ]) {
    line(ctx, x, 6, x, -36, OUT, 2.4);
    poly(ctx, [x, -36, x + 16, -31, x, -26], c, OUT, 1.2);
  }
}

/** Искра фейерверка: цветная точка с ореолом и белой серединкой; i — цвет (6 — белая, у ракеты). */
const SPARKS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b', '#fff8dc'];
function paintSpark(ctx, i) {
  const c = SPARKS[i] || '#fff';
  ell(ctx, 0, 0, 7, 7, c + '55');
  ell(ctx, 0, 0, 4.2, 4.2, c);
  ell(ctx, 0, 0, 1.8, 1.8, '#fff');
}

defineArt({
  hSpark: [[-9, -9, 9, 9], (ctx, i) => paintSpark(ctx, i || 0)],
  hFir: [[-104, -272, 104, 36], (ctx, dressed, frame) => (ctx.scale(FIR_SCALE, FIR_SCALE), paintFir(ctx, !!dressed, frame || 0))],
  hSnowman: [[-40, -104, 40, 18], (ctx, v) => paintSnowman(ctx, v || 0)],
  hCandle: [[-16, -22, 16, 10], (ctx, f) => paintCandle(ctx, f || 0)],
  hWreath: [[-18, -16, 18, 18], (ctx) => paintWreath(ctx)],
  hCrib: [[-74, -164, 74, 22], (ctx) => paintCrib(ctx)],
  // дракон смотрит туда, куда идёт: dir = 1 — вправо, −1 — влево (зеркало — отдельная картинка в кэше)
  hDragonHead: [[-56, -78, 56, 14], (ctx, f, dir) => (dir < 0 && ctx.scale(-1, 1), paintDragonHead(ctx, f || 0))],
  hDragonBody: [[-44, -56, 44, 14], (ctx, tail, dir) => (dir < 0 && ctx.scale(-1, 1), paintDragonBody(ctx, !!tail))],
  hLanternTable: [[-44, -80, 44, 18], (ctx) => paintLanternTable(ctx)],
  hSkyLantern: [[-30, -30, 30, 30], (ctx) => skyLantern(ctx, 0, 0, 1, true)],
  hCarousel: [[-80, -164, 80, 26], (ctx, f) => paintCarousel(ctx, f || 0)],
  hEffigy: [[-44, -128, 44, 18], (ctx) => paintEffigy(ctx)],
  hBooth: [[-66, -152, 66, 20], (ctx, v) => paintBooth(ctx, v || 0)],
  hRope: [[-172, -42, 182, 22], (ctx) => paintRope(ctx)],
});
