// ПРАЗДНИКИ (П.13): рисунки украшений города для кэша спрайтов — ёлка, снеговики, гирлянды, свечи в окнах, венки,
// домик-вертеп, дракон, фонарики, карусель, чучело, ярмарочные домики, канат; часть 2 — шарики, тележка с шариками,
// клумбы субботника, кадки с цветами (1 Мая), купальский костёр, цветочные венки, корзинка, вёдра для водяной битвы
// (Иван Купала), тыквы-фонарики, столик с тыквами, привидения из простыней, паутинка (Хеллоуин), шарики и гирлянда
// «Год в городе!» в доме (paintBdayRoom). Где что стоит и когда — locations/holidays.js.
//
// Всё неподвижное — в спрайтах (defineArt / SP.put), параметры рисунка (наряжена ли ёлка, кадр мигания гирлянды,
// поворот карусели) входят в ключ: кадров у каждого рисунка 2–8, так что в кадре — только копии готовых картинок.
// Рисунки — вокруг точки (0, 0): у того, что стоит, это середина нижнего края (как у предметов карты).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade, heart } from '../core/draw.js';
import { OUT, defineArt } from '../engine/topdown/kinds.js';
import { shadow, snowCap, signBoard, flower, WOOD, WOOD_D, GOLD } from './common/paint.js';
import { trunk } from './common/objects.js';
import { readLayout, toyArt, SPOTS, halfW } from '../minigames/tree.js';

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
    // наряжала сама (мини-игра «Нарядим ёлку!») — её игрушки на её местах; иначе — игрушки «как у всех»
    if (typeof dressed === 'string') firToys(ctx, dressed);
    else FIR_TOYS.forEach(([x, y], i) => toy(ctx, x, y, i));
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
/**
 * Игрушки из мини-игры «Нарядим ёлку!» на большой ёлке (этап 15): layout — строка treeLayout (minigames/tree.js),
 * места — те же, что в игре (v — высота кроны, u — от левого края ветки до правого), только на крону этого рисунка.
 */
function firToys(ctx, layout) {
  const top = FIR_TOP + 12,
    H = 148;
  for (const q of readLayout(layout)) {
    const [v, u] = SPOTS[q.i];
    toyArt(ctx, q.kind, u * halfW(v) * H * 0.92, top + v * H - 8, 0.5, q.col, 0);
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
    n = Math.max(3, Math.round(len / (style === 'cny' ? 44 : style === 'may' || style === 'hal' ? 24 : 22)));
  ctx.strokeStyle = 'rgba(74,55,40,.8)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(dx / 2, dy / 2 + 68, dx, dy);
  ctx.stroke();
  if (style === 'hal') cobweb(ctx, 0, 0, 1); // паутинка у фонаря, где крепится гирлянда
  stringPoints(dx, dy, n).forEach(([x, y], i) => {
    if (style === 'cny') return lantern(ctx, x, y + 2, 0.75, i);
    if (style === 'mas') {
      const c = BULBS[i % BULBS.length];
      poly(ctx, [x - 7, y - 1, x + 7, y - 1, x, y + 15], c, OUT, 1.1);
      return;
    }
    if (style === 'may') {
      // красные и пёстрые флажки, через два — маленький шарик
      if (i % 3 === 2) {
        line(ctx, x, y, x, y + 8, 'rgba(74,55,40,.7)', 1);
        balloon(ctx, x, y + 15, 6.5, BULBS[(i * 2) % BULBS.length]);
        return;
      }
      poly(ctx, [x - 7, y - 1, x + 7, y - 1, x, y + 15], i % 2 ? '#e03131' : '#fff', OUT, 1.1);
      return;
    }
    if (style === 'kup') {
      // зелёная гирлянда из листьев с цветами
      ell(ctx, x - 5, y + 3, 6, 3.2, '#2f9e44', OUT, 0.8, 0.5);
      ell(ctx, x + 5, y + 3, 6, 3.2, '#40c057', OUT, 0.8, -0.5);
      flower(ctx, x, y + 6, 3.6, ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4]);
      return;
    }
    if (style === 'hal') {
      // оранжевые и фиолетовые флажки, через два — летучая мышка (добрая)
      if (i % 3 === 1) return bat(ctx, x, y + 8, 0.8);
      poly(ctx, [x - 7, y - 1, x + 7, y - 1, x, y + 15], i % 2 ? '#7048e8' : '#ff922b', OUT, 1.1);
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
  for (const k of [-0.5, 0, 0.5])
    line(ctx, x + k * 10 * s, y + 4 * s, x + k * 10 * s, y + 20 * s, 'rgba(120,20,20,.45)', 1);
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
  for (let i = 0; i < 7; i++)
    ell(ctx, -18 + Math.cos(i) * 4, -40 + i * 5, 9, 6, i % 2 ? '#ffd43b' : '#ff922b', OUT, 1.1);
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
    for (let i = 0; i < 3; i++)
      ell(ctx, -20 - i * 6, -34 + i * 5, 7 - i, 6 - i, i % 2 ? '#ffd43b' : '#ff922b', OUT, 1.1);
    ell(ctx, -4, -25, 10, 4, '#ffd43b', OUT, 1);
    return;
  }
  ell(ctx, 0, -30, 23, 16, '#e03131', OUT, 2);
  ell(ctx, 0, -23, 17, 6, '#ffd43b', OUT, 1.2); // золотое брюшко
  for (const x of [-10, 0, 10]) poly(ctx, [x - 4, -44, x, -53, x + 4, -44], GOLD, OUT, 1); // гребень
  for (const x of [-8, 6])
    ((ctx.fillStyle = 'rgba(160,20,20,.35)'), ctx.beginPath(), ctx.arc(x, -32, 5, 0, Math.PI), ctx.fill()); // чешуйки
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
    poly(
      ctx,
      [0, -138, Math.cos(a0) * 70, -100 + Math.sin(a0) * -2, Math.cos(a1) * 70, -100 + Math.sin(a1) * -2],
      i % 2 ? '#fff' : '#e03131',
      OUT,
      1.6,
    );
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
  for (let i = 0; i < 4; i++)
    line(ctx, -22 + i * 3, -44 + i * 4, 22 - i * 3, -44 + i * 4, i % 2 ? '#ffd43b' : '#fff', 2);
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
    poly(
      ctx,
      [-56 + i * 19, -106, -56 + (i + 1) * 19, -106, -56 + (i + 1) * 19, -90, -56 + i * 19, -90],
      i % 2 ? '#fff' : c1,
      OUT,
      1.4,
    );
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

// ==================== часть 2: 1 Мая, Иван Купала, Хеллоуин, день рождения ====================
// ---------- шарики ----------
/** Воздушный шарик: (x, y) — середина, r — радиус; ниточка — от узелка вниз (рисует вызвавший). */
export function balloon(ctx, x, y, r, col) {
  ell(ctx, x, y, r * 0.86, r, col, OUT, 1.3);
  ell(ctx, x - r * 0.32, y - r * 0.38, r * 0.2, r * 0.32, 'rgba(255,255,255,.65)', null, 0, -0.4);
  poly(ctx, [x - r * 0.16, y + r * 1.1, x + r * 0.16, y + r * 1.1, x, y + r * 0.94], col, OUT, 0.9);
}
const BALLOONS = [
  ['#ff6b6b', '#ffd43b', '#4dabf7'],
  ['#da77f2', '#69db7c', '#ff922b'],
  ['#ff8fab', '#74c0fc', '#ffe066'],
];
/** Связка из трёх шариков на грузике (v — набор цветов). */
function paintBalloons(ctx, v) {
  shadow(ctx, 0, 4, 12, 4);
  const cols = BALLOONS[v % BALLOONS.length],
    tops = [
      [-14, -74],
      [12, -82],
      [0, -100],
    ];
  for (const [x, y] of tops) {
    ctx.strokeStyle = 'rgba(74,55,40,.7)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(x * 0.3, (y - 6) / 2, x, y + 15);
    ctx.stroke();
  }
  tops.forEach(([x, y], i) => balloon(ctx, x, y, 13, cols[i]));
  fillRR(ctx, -5, -8, 10, 8, 3, '#868e96', OUT, 1.2); // грузик
}
/** Тележка с шариками (1 Мая): колёса, ящик, большая связка и табличка. */
function paintBalloonCart(ctx) {
  shadow(ctx, 0, 6, 44, 10);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.28,
      L = 92 + (i % 3) * 14;
    const x = Math.cos(a) * L * 0.55,
      y = -40 + Math.sin(a) * L;
    line(ctx, 0, -40, x, y + 14, 'rgba(74,55,40,.6)', 1);
    balloon(ctx, x, y, 12 + (i % 2) * 2, BULBS[i % BULBS.length]);
  }
  fillRR(ctx, -34, -38, 68, 28, 5, '#4dabf7', OUT, 2);
  for (let i = 0; i < 4; i++) fillRR(ctx, -28 + i * 15, -34, 10, 20, 3, i % 2 ? '#fff' : '#d0ebff', OUT, 1);
  line(ctx, 34, -30, 50, -44, OUT, 3);
  for (const x of [-20, 20]) {
    ell(ctx, x, -6, 9, 9, '#495057', OUT, 1.6);
    ell(ctx, x, -6, 3, 3, '#adb5bd');
  }
  signBoard(ctx, '🎈 Шарики', 0, -50, 70, 18, 'plate', '#e03131');
}
/** Большая кадка с цветами (1 Мая). */
function paintFlowerPot(ctx, v) {
  shadow(ctx, 0, 5, 26, 7);
  poly(ctx, [-22, -30, 22, -30, 16, 0, -16, 0], v ? '#e8590c' : '#c2255c', OUT, 2);
  fillRR(ctx, -25, -34, 50, 8, 3, v ? '#fd7e14' : '#e64980', OUT, 1.6);
  for (let i = 0; i < 6; i++)
    ell(ctx, -16 + i * 6.4, -40 - (i % 2) * 6, 7, 5, i % 2 ? '#2f9e44' : '#40c057', OUT, 0.8, i);
  const cols = v ? ['#ffd43b', '#fff', '#ff6b6b'] : ['#ff8fab', '#b197fc', '#ffd43b'];
  for (let i = 0; i < 5; i++) flower(ctx, -16 + i * 8, -48 - (i % 2) * 9, 5, cols[i % 3]);
}
// ---------- клумба субботника ----------
/** Где стоят клумбы субботника (1 Мая): [x, y основания в клетках] — их же знает locations/holidays.js. */
export const MAY_BEDS = [
  [45, 22.75],
  [43, 34.75],
  [39, 24.75],
];
/**
 * Клумба субботника вокруг (0, 0) — середина нижнего края: stage 0 — утоптанная земля, 1 — вскопана, 2 — цветы;
 * bloom — насколько распустились (0..1); sign — табличка «Субботник» (в городе, пока не посадили).
 */
export function paintMayBed(ctx, stage, sign = false, bloom = 1) {
  shadow(ctx, 0, 2, 46, 10);
  ell(ctx, 0, -16, 44, 18, '#adb5bd', OUT, 2); // бордюр из камушков
  ell(ctx, 0, -17, 38, 14, stage ? '#6b4226' : '#9c7a5b');
  if (stage >= 1)
    for (let i = 0; i < 12; i++) ell(ctx, -30 + ((i * 17) % 60), -22 + ((i * 7) % 12), 3, 2, 'rgba(40,20,5,.45)');
  else for (let i = 0; i < 5; i++) line(ctx, -24 + i * 12, -20, -18 + i * 12, -12, 'rgba(255,255,255,.25)', 1.4);
  if (stage >= 2) {
    const r = 3 + bloom * 3;
    const pts = [
      [-24, -18],
      [-10, -26],
      [6, -22],
      [22, -18],
      [-16, -10],
      [0, -12],
      [16, -8],
    ];
    pts.forEach(([x, y], i) => {
      line(ctx, x, y + 6, x, y - bloom * 6, '#2f9e44', 2);
      ell(ctx, x - 4, y + 2, 4, 2, '#40c057', null, 0, -0.5);
      flower(ctx, x, y - bloom * 6, r, ['#ff6b6b', '#ffd43b', '#ff8fab', '#b197fc', '#fff', '#ff922b', '#74c0fc'][i]);
    });
  }
  if (sign) {
    // ящик с рассадой
    fillRR(ctx, 30, -14, 22, 12, 3, WOOD, OUT, 1.4);
    for (let i = 0; i < 3; i++) {
      line(ctx, 35 + i * 6, -14, 35 + i * 6, -22, '#2f9e44', 2);
      ell(ctx, 35 + i * 6, -23, 3, 2, '#69db7c');
    }
  }
}
/** Табличка у клумбы субботника (стоит — в общем порядке «дальше → ближе»): done — «Готово!». */
function paintMaySign(ctx, done) {
  line(ctx, 0, 0, 0, -30, OUT, 2.4);
  signBoard(ctx, done ? '🌷 Готово!' : 'Субботник', 0, -38, 66, 16, 'plate', done ? '#e64980' : '#2f9e44');
}
// ---------- Иван Купала ----------
/** Купальский костёр: камни кругом, шалашик из поленьев, пламя (frame 0..3), искорки. */
function paintBonfire(ctx, frame) {
  shadow(ctx, 0, 4, 46, 12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    ell(ctx, Math.cos(a) * 34, -10 + Math.sin(a) * 11, 7, 5, i % 2 ? '#adb5bd' : '#868e96', OUT, 1.2);
  }
  // поленья шалашиком за пламенем
  for (const [x0, x1] of [
    [-24, 8],
    [24, -8],
  ])
    (line(ctx, x0, -6, x1 * 0.4, -50, OUT, 7), line(ctx, x0, -6, x1 * 0.4, -50, '#a0662d', 4.4));
  const f = frame % 4,
    wob = [0, 3, -2, 2][f];
  const fl = (s, col, dy, lw) => {
    ctx.beginPath();
    ctx.moveTo(-20 * s, -10);
    ctx.quadraticCurveTo(-26 * s, -42 * s + dy, -8 * s + wob * s, -64 * s + dy);
    ctx.quadraticCurveTo(-6 * s, -50 * s + dy, wob * s, -84 * s + dy);
    ctx.quadraticCurveTo(10 * s, -56 * s + dy, 12 * s + wob * 0.5 * s, -70 * s + dy);
    ctx.quadraticCurveTo(26 * s, -40 * s + dy, 20 * s, -10);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    if (lw) {
      ctx.strokeStyle = '#e8590c';
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };
  fl(1, '#ff922b', 0, 1.8);
  fl(0.7, '#ffd43b', [0, -4, 2, -2][f]);
  fl(0.38, '#fff3bf', 2);
  // поленья спереди (крест-накрест) и искорки
  for (const [x0, x1] of [
    [-26, 14],
    [26, -14],
  ])
    (line(ctx, x0, -4, x1, -16, OUT, 7), line(ctx, x0, -4, x1, -16, '#c98b5a', 4.4));
  for (let i = 0; i < 4; i++) ell(ctx, -16 + i * 10 + wob, -80 - ((i * 7 + f * 9) % 24), 1.8, 1.8, '#ffd43b');
}
/** Цветочный венок: кольцо, n цветов (последний — с анимацией a), candle — свечка посередине (по воде). */
export function wreathRing(ctx, x, y, r, n = 8, a = 1, candle = false) {
  ctx.lineWidth = r * 0.22;
  ctx.strokeStyle = '#2f9e44';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.12, r * 0.6, 0, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const q = (i / 12) * TAU;
    ell(
      ctx,
      x + Math.cos(q) * r,
      y + Math.sin(q) * r * 0.5,
      r * 0.12,
      r * 0.06,
      i % 2 ? '#40c057' : '#2b8a3e',
      null,
      0,
      q + 1,
    );
  }
  const cols = ['#ff8fab', '#ffd43b', '#fff', '#b197fc', '#ff6b6b', '#74c0fc', '#ffa94d', '#fff'];
  for (let i = 0; i < n; i++) {
    const q = (i / Math.max(6, n)) * TAU + 0.4,
      k = i === n - 1 ? a : 1,
      fx = x + Math.cos(q) * r,
      fy = y + Math.sin(q) * r * 0.5 - (1 - k) * r * 1.4;
    flower(ctx, fx, fy, r * 0.17 * (0.6 + 0.4 * k), cols[i % cols.length]);
  }
  if (candle) {
    fillRR(ctx, x - r * 0.08, y - r * 0.42, r * 0.16, r * 0.4, 2, '#fff', OUT, 1);
    ell(ctx, x, y - r * 0.5, r * 0.07, r * 0.12, '#ffd43b', OUT, 0.8);
    ell(ctx, x, y - r * 0.45, r * 0.4, r * 0.25, 'rgba(255,212,59,.25)');
  }
}
/** Корзинка с цветами и готовым венком у воды. */
function paintFlowerBasket(ctx) {
  shadow(ctx, 0, 4, 34, 8);
  wreathRing(ctx, 22, -6, 14, 6);
  poly(ctx, [-26, -24, 6, -24, 2, 0, -22, 0], '#d9a066', OUT, 1.8);
  for (let i = 0; i < 4; i++) line(ctx, -24 + i * 2, -18 + i * 5, 4 - i * 1, -18 + i * 5, 'rgba(140,90,40,.6)', 1);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(-10, -24, 14, Math.PI, 0);
  ctx.stroke();
  for (let i = 0; i < 6; i++)
    flower(ctx, -22 + i * 5, -27 - (i % 2) * 5, 4.2, ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4]);
  signBoard(ctx, '🌼 Венки', -10, -56, 60, 16, 'plate', '#2f9e44');
  line(ctx, -10, -48, -10, -38, OUT, 1.6);
}
/** Вёдра и водяные пистолеты (водяная битва). */
function paintSplashStand(ctx) {
  shadow(ctx, 0, 4, 40, 9);
  fillRR(ctx, -34, -24, 68, 8, 3, '#22b8cf', OUT, 1.8);
  for (const x of [-28, 24]) fillRR(ctx, x, -18, 4, 18, 2, '#0c8599', OUT, 1.2);
  for (const [x, c] of [
    [-18, '#ff6b6b'],
    [16, '#ffd43b'],
  ]) {
    poly(ctx, [x - 11, -44, x + 11, -44, x + 8, -24, x - 8, -24], c, OUT, 1.6);
    ell(ctx, x, -44, 11, 3.5, '#74c0fc', OUT, 1.2);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, -44, 10, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // пистолеты на столике
  fillRR(ctx, -6, -32, 16, 6, 3, '#20c997', OUT, 1.2);
  fillRR(ctx, -2, -28, 4, 6, 2, '#12b886', OUT, 1);
  for (let i = 0; i < 3; i++) ell(ctx, -30 + i * 30, -50 - i * 4, 2.4, 3.4, '#74c0fc', 'rgba(28,126,214,.7)', 0.8);
  signBoard(ctx, '💦 Водяная битва', 0, -66, 100, 16, 'plate', '#1c7ed6');
  line(ctx, 0, -58, 0, -50, OUT, 1.6);
}
/** Цветочный венок на двери домика (Иван Купала): с лентами. */
function paintDoorWreath(ctx) {
  wreathRing(ctx, 0, 0, 12, 6);
  for (const [x, c] of [
    [-4, '#ff6b6b'],
    [4, '#4dabf7'],
  ])
    line(ctx, x, 6, x * 2, 22, c, 2.2);
}
// ---------- Хеллоуин ----------
/** Летучая мышка (добрая, с улыбкой). */
export function bat(ctx, x, y, s = 1) {
  ctx.fillStyle = '#5f3dc4';
  ctx.beginPath();
  ctx.moveTo(x, y - 2 * s);
  ctx.quadraticCurveTo(x - 8 * s, y - 9 * s, x - 15 * s, y - 4 * s);
  ctx.quadraticCurveTo(x - 11 * s, y - 1 * s, x - 10 * s, y + 3 * s);
  ctx.quadraticCurveTo(x - 6 * s, y, x, y + 3 * s);
  ctx.quadraticCurveTo(x + 6 * s, y, x + 10 * s, y + 3 * s);
  ctx.quadraticCurveTo(x + 11 * s, y - 1 * s, x + 15 * s, y - 4 * s);
  ctx.quadraticCurveTo(x + 8 * s, y - 9 * s, x, y - 2 * s);
  ctx.fill();
  ell(ctx, x, y, 5 * s, 5 * s, '#7048e8', OUT, 0.9);
  ell(ctx, x - 2 * s, y - 1 * s, 1.2 * s, 1.4 * s, '#fff');
  ell(ctx, x + 2 * s, y - 1 * s, 1.2 * s, 1.4 * s, '#fff');
}
/** Паутинка в уголке: (x, y) — угол, dir 1 — вправо-вниз. */
export function cobweb(ctx, x, y, dir = 1) {
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * Math.cos(a) * 22, y + Math.sin(a) * 22);
    ctx.stroke();
  }
  for (const r of [7, 13, 19]) {
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * Math.PI * 0.5,
        px = x + dir * Math.cos(a) * r,
        py = y + Math.sin(a) * r;
      if (i) ctx.quadraticCurveTo(x + dir * Math.cos(a - 0.2) * r * 0.85, y + Math.sin(a - 0.2) * r * 0.85, px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
}
/**
 * Тыква вокруг (0, 0) — середина низа: stage — сколько вырезано (1 — глазик, 2 — оба, 3 — носик, 4 — улыбка,
 * 5 — свечка), lit — горит ли свечка внутри, frame — мерцание. Лицо доброе: круглые глазки и широкая улыбка.
 */
export function jackFace(ctx, stage = 5, lit = 1, frame = 0) {
  const body = '#ff922b',
    dark = '#e8590c';
  if (lit) ell(ctx, 0, -26, 50, 40, frame ? 'rgba(255,212,59,.22)' : 'rgba(255,212,59,.16)');
  for (const [x, rx] of [
    [-20, 18],
    [20, 18],
    [-9, 18],
    [9, 18],
    [0, 17],
  ])
    ell(ctx, x, -26, rx, 26, x === 0 ? body : x < -10 || x > 10 ? dark : body, OUT, 1.8);
  ell(ctx, -8, -38, 5, 9, 'rgba(255,255,255,.35)', null, 0, 0.3);
  // хвостик и листик
  fillRR(ctx, -3, -60, 7, 10, 3, '#5c940d', OUT, 1.4);
  ell(ctx, 10, -56, 8, 4, '#69db7c', OUT, 1, -0.4);
  const hole = lit ? (frame ? '#ffe066' : '#ffd43b') : '#5c2d0b';
  if (stage >= 1) ell(ctx, -11, -33, 5.5, 6.5, hole, OUT, 1.2);
  if (stage >= 2) ell(ctx, 11, -33, 5.5, 6.5, hole, OUT, 1.2);
  if (stage >= 3) poly(ctx, [0, -27, -4, -21, 4, -21], hole, OUT, 1);
  if (stage >= 4) {
    ctx.beginPath();
    ctx.moveTo(-16, -17);
    ctx.quadraticCurveTo(0, -2, 16, -17);
    ctx.quadraticCurveTo(0, -9, -16, -17);
    ctx.closePath();
    ctx.fillStyle = hole;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  if (stage >= 1 && !lit) {
    ell(ctx, -11, -35, 1.6, 1.6, 'rgba(255,255,255,.5)');
    ell(ctx, 11, -35, 1.6, 1.6, 'rgba(255,255,255,.5)');
  }
}
/** Тыква-фонарик в городе: v 0 — одна, 1 — горка (две простые и фонарик сверху). */
function paintJack(ctx, frame, v) {
  shadow(ctx, 0, 3, 22, 6);
  if (v) {
    for (const x of [-14, 14]) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(0.42, 0.42);
      jackFace(ctx, 0, 0, 0);
      ctx.restore();
    }
    ctx.translate(0, -18);
  }
  ctx.scale(0.55, 0.55);
  jackFace(ctx, 5, 1, frame);
}
/** Столик с тыквами (Хеллоуин): тыквы разного размера, ложечка, табличка. */
function paintPumpkinTable(ctx) {
  shadow(ctx, 0, 6, 40, 9);
  fillRR(ctx, -36, -26, 72, 8, 3, '#7048e8', OUT, 1.8);
  for (let i = 0; i < 3; i++) fillRR(ctx, -32 + i * 22, -18, 18, 4, 1, i % 2 ? '#ff922b' : '#9775fa');
  for (const x of [-30, 26]) fillRR(ctx, x, -18, 5, 20, 2, '#5f3dc4', OUT, 1.2);
  for (const [x, sc] of [
    [-18, 0.36],
    [6, 0.46],
    [26, 0.3],
  ]) {
    ctx.save();
    ctx.translate(x, -26);
    ctx.scale(sc, sc);
    jackFace(ctx, x === 6 ? 5 : 0, 0, 0);
    ctx.restore();
  }
  signBoard(ctx, '🎃 Тыквы', 0, -76, 70, 18, 'plate', '#e8590c');
  line(ctx, 0, -67, 0, -56, OUT, 1.6);
}
/** Привидение из простыни: доброе, с румянцем; frame — машет краешком. Висит над землёй (тень — внизу). */
function paintGhost(ctx, frame) {
  ell(ctx, 0, 0, 16, 4, 'rgba(52,38,70,.14)');
  const w = frame ? 2 : -2;
  ctx.beginPath();
  ctx.moveTo(-20, -24);
  ctx.quadraticCurveTo(-24, -76, 0, -78);
  ctx.quadraticCurveTo(24, -76, 20, -24);
  for (let i = 0; i < 4; i++) {
    const x0 = 20 - i * 10;
    ctx.quadraticCurveTo(x0 - 5, -16 + (i % 2 ? w : -w), x0 - 10, -24);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ell(ctx, 8, -60, 5, 7, 'rgba(160,180,220,.3)');
  // ручки-краешки
  ell(ctx, -22, -42 + w, 6, 4, '#fff', OUT, 1.4, -0.6);
  ell(ctx, 22, -42 - w, 6, 4, '#fff', OUT, 1.4, 0.6);
  // глазки, румянец, улыбка
  ell(ctx, -7, -56, 3, 4, '#212529');
  ell(ctx, 7, -56, 3, 4, '#212529');
  ell(ctx, -6, -57.5, 1, 1.2, '#fff');
  ell(ctx, 8, -57.5, 1, 1.2, '#fff');
  ell(ctx, -12, -49, 3.4, 2, 'rgba(255,143,171,.7)');
  ell(ctx, 12, -49, 3.4, 2, 'rgba(255,143,171,.7)');
  ctx.strokeStyle = '#212529';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -50, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}
// ---------- день рождения: в доме ----------
/**
 * Праздник в комнате («Год в городе», раньше — день рождения): гирлянда-флажки «Год в городе!» под потолком от x0 до x1 и связки шариков
 * у стен. y — пол, top — потолок (единицы дома). Рисуется прямо в кадр дома (там нет кэша спрайтов) — это несколько
 * десятков команд, только в одном доме и один день.
 */
export function paintBdayRoom(ctx, x0, x1, y, top, t) {
  const word = 'ГОД В ГОРОДЕ!',
    n = word.length,
    yy = top + 26;
  ctx.strokeStyle = 'rgba(74,55,40,.7)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, yy);
  ctx.quadraticCurveTo((x0 + x1) / 2, yy + 40, x1, yy);
  ctx.stroke();
  ctx.font = '900 15px ui-rounded, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const q = (i + 1) / (n + 1),
      x = x0 + (x1 - x0) * q,
      fy = yy + Math.sin(q * Math.PI) * 20 * 1;
    if (word[i] === ' ') continue;
    poly(ctx, [x - 14, fy, x + 14, fy, x, fy + 30], BULBS[i % BULBS.length], OUT, 1.2);
    ctx.fillStyle = '#fff';
    ctx.fillText(word[i], x, fy + 10);
  }
  for (const [bx, v] of [
    [x0 + 90, 0],
    [(x0 + x1) / 2 + 40, 2],
    [x1 - 50, 1],
  ]) {
    const sway = Math.sin(t * 1.4 + bx) * 3;
    ctx.save();
    ctx.translate(bx + sway, y);
    ctx.scale(1.35, 1.35);
    paintBalloons(ctx, v);
    ctx.restore();
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

/** Хвостик искры: маленькая полупрозрачная точка того же цвета. */
function paintSparkTail(ctx, i) {
  const c = SPARKS[i] || '#fff';
  ell(ctx, 0, 0, 3.6, 3.6, c + '66');
  ell(ctx, 0, 0, 1.8, 1.8, c + 'cc');
}
/** Сколько направлений у искры-чёрточки салюта (повёрнутые копии — отдельные картинки в кэше). */
export const STREAK_DIRS = 16;
/**
 * Искра салюта — чёрточка с хвостиком: яркая головка в (0, 0), хвост тянется назад, сужаясь и бледнея. d — направление
 * полёта (0..STREAK_DIRS−1, 0 — вправо, по часовой), i — цвет.
 */
function paintStreak(ctx, d, i) {
  const c = SPARKS[i] || '#fff';
  ctx.rotate((d / STREAK_DIRS) * TAU);
  for (let k = 6; k >= 1; k--) {
    const q = k / 6;
    ell(ctx, -q * 22, 0, 3.8 * (1 - q * 0.7), 2.7 * (1 - q * 0.7), c + (k > 3 ? '66' : 'bb'));
  }
  ell(ctx, 0, 0, 5.4, 4.2, c + '77');
  ell(ctx, 0, 0, 3.6, 3, c);
  ell(ctx, 0.7, 0, 1.7, 1.4, '#fff');
}

// ---------- этап 15: каток, мокрые после «Водяной битвы», венки на воде ----------
/** Табличка на столбике (каток в парке, ярмарка): text — надпись. */
function paintPostSign(ctx, text) {
  shadow(ctx, 0, 3, 12, 4);
  line(ctx, 0, 0, 0, -48, OUT, 6);
  line(ctx, 0, 0, 0, -48, WOOD, 3.4);
  signBoard(ctx, text, 0, -58, Math.max(70, text.length * 9 + 18), 24, 'wood');
}
/** Капельки с мокрого (над головой и вокруг): f — кадр (капли падают). */
function paintDrops(ctx, f) {
  for (let i = 0; i < 5; i++) {
    const x = -22 + i * 11,
      y = -((i * 13 + f * 9) % 30) - 4;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.quadraticCurveTo(x + 4, y + 1, x, y + 2.5);
    ctx.quadraticCurveTo(x - 4, y + 1, x, y - 6);
    ctx.fillStyle = '#74c0fc';
    ctx.fill();
    ctx.strokeStyle = '#1c7ed6';
    ctx.lineWidth = 1;
    ctx.stroke();
    ell(ctx, x - 1, y - 1, 1, 1.4, 'rgba(255,255,255,.85)');
  }
}
/** Лужица на песке (v — форма). */
function paintPuddle(ctx, v) {
  const w = [30, 22, 26][v % 3],
    h = [10, 8, 9][v % 3];
  ell(ctx, 0, 0, w + 3, h + 2, 'rgba(110,80,40,.18)');
  ell(ctx, 0, 0, w, h, 'rgba(116,192,252,.75)', 'rgba(28,126,214,.6)', 1.4);
  ell(ctx, -w * 0.35, -h * 0.25, w * 0.3, h * 0.25, 'rgba(255,255,255,.6)');
}
/** Купальский венок со свечкой на воде (Пр19): f — кадр огонька. */
function paintFloatWreath(ctx, f) {
  ell(ctx, 0, 4, 30, 9, 'rgba(255,255,255,.35)'); // круги на воде
  wreathRing(ctx, 0, 0, 22, 8, 1, true);
  if (f) ell(ctx, 0, -11, 2.4, 4, '#fff3bf');
}

// ---------- этап 15 (Пр2): праздник в других местах и в домах — маленькие украшения ----------
/** Маленькая наряженная ёлочка (в лесу, на горе, в домах): кадр мигания огоньков. */
function paintFirMini(ctx, frame) {
  ctx.save();
  ctx.scale(0.55, 0.55);
  paintFir(ctx, 1, frame);
  ctx.restore();
}
/** Рождественский столбик: венок с бантом и фонарь-звезда со свечкой. */
function paintXmasPost(ctx, frame) {
  shadow(ctx, 0, 3, 16, 5);
  line(ctx, 0, 0, 0, -78, OUT, 7);
  line(ctx, 0, 0, 0, -78, WOOD, 4);
  ctx.save();
  ctx.translate(0, -44);
  paintWreath(ctx);
  ctx.restore();
  fillRR(ctx, -11, -104, 22, 26, 4, '#fff3bf', OUT, 1.8);
  ell(ctx, 0, -91, frame ? 3 : 2.4, 5, '#ffd43b', OUT, 0.8);
  poly(ctx, [-14, -104, 0, -114, 14, -104], '#c92a2a', OUT, 1.6);
  star(ctx, 0, -120, 7, GOLD, OUT, 1.4);
}
/** Столбик с двумя красными фонариками (Китайский Новый год). */
function paintLanternPost(ctx) {
  shadow(ctx, 0, 3, 18, 5);
  line(ctx, 0, 0, 0, -86, OUT, 7);
  line(ctx, 0, 0, 0, -86, '#c92a2a', 4);
  line(ctx, -26, -84, 26, -84, OUT, 5);
  line(ctx, -26, -84, 26, -84, '#c92a2a', 3);
  lantern(ctx, -20, -80, 1.1, 0);
  lantern(ctx, 20, -80, 1.1, 3);
}

defineArt({
  hFirMini: [[-60, -160, 60, 20], (ctx, f) => paintFirMini(ctx, f || 0)],
  hXmasPost: [[-30, -132, 30, 8], (ctx, f) => paintXmasPost(ctx, f || 0)],
  hLanternPost: [[-40, -100, 40, 8], (ctx) => paintLanternPost(ctx)],
  hPostSign: [[-70, -78, 70, 8], (ctx, text) => paintPostSign(ctx, text || '')],
  hDrops: [[-30, -42, 30, 8], (ctx, f) => paintDrops(ctx, f || 0)],
  hPuddle: [[-36, -14, 36, 14], (ctx, v) => paintPuddle(ctx, v || 0)],
  hFloatWreath: [[-34, -24, 34, 16], (ctx, f) => paintFloatWreath(ctx, f || 0)],
  hSpark: [[-9, -9, 9, 9], (ctx, i) => paintSpark(ctx, i || 0)],
  hSparkT: [[-5, -5, 5, 5], (ctx, i) => paintSparkTail(ctx, i || 0)],
  hStreak: [[-27, -27, 27, 27], (ctx, d, i) => paintStreak(ctx, d || 0, i || 0)],
  hBalloons: [[-32, -122, 32, 10], (ctx, v) => paintBalloons(ctx, v || 0)],
  hBalloonCart: [[-78, -182, 78, 18], (ctx) => paintBalloonCart(ctx)],
  hFlowerPot: [[-40, -74, 40, 14], (ctx, v) => paintFlowerPot(ctx, v || 0)],
  hMayBed: [[-50, -46, 58, 14], (ctx, planted) => paintMayBed(ctx, planted ? 2 : 0, !planted)],
  hMaySign: [[-40, -50, 40, 6], (ctx, done) => paintMaySign(ctx, done)],
  hBonfire: [[-58, -126, 58, 20], (ctx, f) => paintBonfire(ctx, f || 0)],
  hFlowerBasket: [[-52, -76, 52, 16], (ctx) => paintFlowerBasket(ctx)],
  hSplashStand: [[-54, -78, 54, 14], (ctx) => paintSplashStand(ctx)],
  hDoorWreath: [[-18, -12, 18, 26], (ctx) => paintDoorWreath(ctx)],
  hJack: [[-34, -66, 34, 10], (ctx, f, v) => paintJack(ctx, f || 0, v || 0)],
  hPumpkinTable: [[-58, -100, 58, 16], (ctx) => paintPumpkinTable(ctx)],
  hGhost: [[-32, -84, 32, 8], (ctx, f) => paintGhost(ctx, f || 0)],
  hFir: [
    [-104, -272, 104, 36],
    (ctx, dressed, frame) => (ctx.scale(FIR_SCALE, FIR_SCALE), paintFir(ctx, dressed || 0, frame || 0)),
  ],
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
