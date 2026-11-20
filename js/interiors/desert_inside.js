// Пустыня изнутри (Д4): зал пирамиды и шатёр кочевника Бархана. Дома «тайного места»: вход — двери зданий в пустыне
// ('inside:pyramid_hall', 'inside:tent_barkhan' — locations/desert.js), дверь изнутри — назад к двери снаружи.
//  - Пирамида: зал с росписями, факелы, сокровищница за решёткой; каменная дверь с узором — вход в загадку «Пары»
//    (действие 'desert:pairs', как раньше у двери снаружи). Хозяина нет, днём тут полутемно (dim).
//  - Шатёр: ковры на стенах и на полу, подушки, низкий столик с чаем и финиками, медная лампа; Бархан внутри —
//    'nomad' (задание, окаменелости, обмен).
import { npcAtHome } from '../core/state.js'; // дома ли хозяин сейчас (одно правило «где житель» — core/queries.js)
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { wob, torch, cushion, carpet } from './inside_art.js';

const OUT = '#4a3728';

// ---------- пирамида ----------
/** Роспись на стене: хомяк-фараон, верблюд, солнце и ладья (v — какая из двух). */
function fresco(ctx, x, y, t, k, sc, b) {
  ctx.save();
  wob(ctx, x, y - 160, t, k);
  fillRR(ctx, x - 110, y - 236, 220, 132, 4, '#f3d9a4', OUT, 2);
  line(ctx, x - 104, y - 226, x + 104, y - 226, '#1c7ed6', 4);
  line(ctx, x - 104, y - 114, x + 104, y - 114, '#1c7ed6', 4);
  const ink = '#7a4a1e';
  if (b.v === 0) {
    // хомяк-фараон в полосатом платке и солнце
    ell(ctx, x - 40, y - 150, 22, 26, '#e8a33d', ink, 2);
    // платок: шапочка сверху и полосатые концы по бокам — мордочку видно
    poly(ctx, [x - 64, y - 166, x - 40, y - 186, x - 16, y - 166], '#1c7ed6', ink, 2);
    for (const dx of [-66, -22]) {
      fillRR(ctx, x + dx, y - 166, 8, 36, 3, '#1c7ed6', ink, 1.5);
      for (let i = 0; i < 3; i++) line(ctx, x + dx, y - 158 + i * 9, x + dx + 8, y - 158 + i * 9, '#ffd43b', 2);
    }
    ell(ctx, x - 47, y - 152, 2.5, 3, ink);
    ell(ctx, x - 33, y - 152, 2.5, 3, ink);
    ell(ctx, x - 40, y - 142, 3, 2, '#e64980');
    ell(ctx, x + 50, y - 176, 20, 20, '#ffd43b', '#e8590c', 2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.2;
      line(
        ctx,
        x + 50 + Math.cos(a) * 24,
        y - 176 + Math.sin(a) * 24,
        x + 50 + Math.cos(a) * 32,
        y - 176 + Math.sin(a) * 32,
        '#e8590c',
        2,
      );
    }
    line(ctx, x + 10, y - 130, x + 90, y - 130, ink, 2);
  } else {
    // караван: верблюд, ладья на реке, пирамидки
    ell(ctx, x - 50, y - 150, 26, 14, '#d9a066', ink, 2);
    ell(ctx, x - 50, y - 164, 10, 8, '#d9a066', ink, 2);
    line(ctx, x - 26, y - 154, x - 18, y - 178, ink, 4);
    ell(ctx, x - 14, y - 180, 7, 5, '#d9a066', ink, 1.5);
    for (const dx of [-66, -56, -44, -34]) line(ctx, x + dx, y - 140, x + dx, y - 120, ink, 3);
    poly(ctx, [x + 10, y - 124, x + 40, y - 170, x + 70, y - 124], '#e0b56e', ink, 2);
    poly(ctx, [x + 54, y - 124, x + 74, y - 154, x + 94, y - 124], '#e0b56e', ink, 2);
    line(ctx, x + 6, y - 120, x + 98, y - 120, '#4dabf7', 3);
  }
  for (let i = 0; i < 5; i++) {
    const gx = x - 92 + i * 46;
    ell(ctx, gx, y - 211, 4, 4, null, '#7a4a1e', 1.5);
    line(ctx, gx + 9, y - 216, gx + 9, y - 206, '#7a4a1e', 1.5);
  }
  ctx.restore();
}
/** Каменная дверь загадки: два ряда знаков-пар, золотая ручка-скарабей; потрогать — открыть «Пары». */
function pairsDoor(ctx, x, y, t, k) {
  fillRR(ctx, x - 78, y - 220, 156, 220, 8, '#b08d57', OUT, 2.5);
  fillRR(ctx, x - 64, y - 206, 128, 206, 4, '#8a6a3c', OUT, 2);
  const signs = ['☀', '🌙', '🐫', '☀', '🐫', '🌙'];
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 6; i++) {
    const gx = x - 38 + (i % 3) * 38,
      gy = y - 176 + Math.floor(i / 3) * 44;
    fillRR(ctx, gx - 16, gy - 18, 32, 36, 5, '#f3d9a4', OUT, 1.5);
    ctx.fillStyle = '#7a4a1e';
    ctx.fillText(signs[i], gx, gy + 1);
  }
  const glow = 0.5 + Math.sin(t * 3) * 0.3 + k * 0.5;
  ell(ctx, x, y - 64, 20, 15, '#ffd43b', OUT, 2);
  ell(ctx, x, y - 64, 30, 24, `rgba(255,212,59,${(0.25 * glow).toFixed(2)})`);
  line(ctx, x, y - 78, x, y - 50, '#e8590c', 2);
}
/** Сокровищница за решёткой: сундук, монеты, кувшины. */
function treasure(ctx, x, y, t, k) {
  for (let i = 0; i < 9; i++) ell(ctx, x - 50 + i * 12, y - 10 - (i % 3) * 5, 8, 4, '#ffd43b', '#e0a800', 1.2);
  fillRR(ctx, x - 40, y - 64, 80, 50, 6, '#a8703f', OUT, 2);
  fillRR(ctx, x - 44, y - 78, 88, 20, 8, '#c98b5a', OUT, 2);
  fillRR(ctx, x - 8, y - 66, 16, 16, 3, '#ffd43b', OUT, 1.5);
  for (const dx of [-70, 66]) {
    ell(ctx, x + dx, y - 34, 16, 28, '#e8590c', OUT, 2);
    fillRR(ctx, x + dx - 7, y - 70, 14, 12, 3, '#e8590c', OUT, 1.5);
  }
  if (Math.sin(t * 2.2) > 0.2 || k > 0) star(ctx, x + 24, y - 82, 7, '#fff9db');
  // решётка
  for (let xx = x - 96; xx <= x + 96; xx += 24) line(ctx, xx, y - 150, xx, y, '#5c3a21', 4);
  line(ctx, x - 100, y - 150, x + 100, y - 150, '#5c3a21', 6);
}
/** Статуя кошки-стража у стены. */
function catStatue(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 34, y - 30, 68, 30, 4, '#8a6a3c', OUT, 2);
  ell(ctx, x, y - 80, 26, 50, '#343a40', OUT, 2);
  ell(ctx, x, y - 140, 20, 20, '#343a40', OUT, 2);
  poly(ctx, [x - 18, y - 150, x - 14, y - 172, x - 4, y - 156], '#343a40', OUT, 2);
  poly(ctx, [x + 18, y - 150, x + 14, y - 172, x + 4, y - 156], '#343a40', OUT, 2);
  ell(ctx, x - 7, y - 142, 3, 4, '#ffd43b');
  ell(ctx, x + 7, y - 142, 3, 4, '#ffd43b');
  fillRR(ctx, x - 22, y - 116, 44, 8, 3, '#ffd43b', OUT, 1.2);
  ctx.restore();
}

export const pyramid = {
  id: 'pyramid_hall',
  name: 'Зал пирамиды',
  hello:
    '🔺 Внутри пирамиды прохладно и тихо. Факелы, древние росписи… А вон та каменная дверь с узором — загадка «Пары»!',
  floors: 1,
  width: 1400,
  maxZoom: 1.1,
  music: 'desert',
  dim: 0.38,
  door: { f: 0, x: 110 },
  shell: { shape: 'pyramid', wall: '#e0b56e', ground: 'desert', bushes: true, trees: 'palm' },
  rooms: [
    {
      id: 'hall',
      f: 0,
      x0: 0,
      x1: 900,
      name: 'Зал с росписями',
      wall: '#d6b47a',
      paper: 'stone',
      floor: 'stone',
      win: null,
      lamp: false,
    },
    {
      id: 'vault',
      f: 0,
      x0: 900,
      x1: 1400,
      name: 'Сокровищница',
      wall: '#c9a36a',
      paper: 'stone',
      floor: 'stone',
      win: null,
      lamp: false,
    },
  ],
  lamps: [
    { f: 0, x: 250, h: 190, r: 280, c: '255,170,80' },
    { f: 0, x: 760, h: 190, r: 300, c: '255,170,80' },
    { f: 0, x: 1150, h: 190, r: 300, c: '255,170,80' },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110, look: 'arch', c: '#c9a36a', sky: '#ffe8a1', ground: '#f2d49b' },
    {
      id: 'torches',
      type: 'prop',
      f: 0,
      x: 250,
      w: 0,
      h: 0,
      draw: (ctx, x, y, t) => [250, 760, 1150].forEach((tx) => torch(ctx, tx, y - 190, t)),
    },
    {
      id: 'fresco1',
      type: 'prop',
      f: 0,
      x: 380,
      v: 0,
      w: 230,
      h: 240,
      up: 100,
      draw: fresco,
      say: [
        'Роспись: хомяк-фараон в полосатом платке и солнце. Говорят, он очень любил семечки ☀️',
        'Под росписью — значки. Бархан говорит, тут написано: «Кто соберёт пары — найдёт сокровище».',
      ],
    },
    {
      id: 'fresco2',
      type: 'prop',
      f: 0,
      x: 615,
      v: 1,
      w: 230,
      h: 240,
      up: 100,
      draw: fresco,
      say: [
        'Роспись: караван верблюдов идёт к пирамидам, а по реке плывёт ладья 🐫',
        'Краски древние, а какие яркие! Синюю делали из толчёного камня.',
      ],
    },
    {
      id: 'pairs',
      type: 'prop',
      f: 0,
      x: 830,
      w: 160,
      h: 230,
      draw: pairsDoor,
      sfx: 'magic',
      run: 'desert:pairs',
    },
    {
      id: 'cat',
      type: 'prop',
      f: 0,
      x: 1000,
      w: 80,
      h: 180,
      draw: catStatue,
      say: [
        'Статуя кошки-стража. Глаза — из жёлтого камня. Кажется, она подмигнула!',
        'Кошка сторожит сокровищницу тысячу лет. Не боится, что заскучает?',
      ],
    },
    {
      id: 'treasure',
      type: 'prop',
      f: 0,
      x: 1200,
      w: 210,
      h: 160,
      draw: treasure,
      fx: 'spark',
      fxN: 8,
      sfx: 'coin',
      say: [
        'Сокровищница фараона! За решёткой — сундук и золотые монетки ✨',
        'Решётку не открыть… Зато загадка «Пары» за каменной дверью дарит приз!',
      ],
    },
  ],
  furniture: { fixed: [] },
};

// ---------- шатёр Бархана ----------
/** Ковёр на стене. */
const wallCarpet = (c, c2, c3) => (ctx, x, y) => carpet(ctx, x - 100, y - 232, 200, 120, c, c2, c3);
/** Низкий столик: чайник, пиалы, финики на блюде (k — только что потрогали: чайник наклоняется). */
function teaTable(ctx, x, y, t, k) {
  fillRR(ctx, x - 80, y - 40, 160, 12, 5, '#8d5524', OUT, 2);
  for (const dx of [-66, 58]) fillRR(ctx, x + dx, y - 28, 8, 28, 3, '#5c3a21', OUT, 1.5);
  ctx.save();
  ctx.translate(x - 30, y - 40);
  ctx.rotate(-k * 0.5);
  ell(ctx, 0, -20, 22, 18, '#e8a33d', OUT, 2);
  fillRR(ctx, -6, -46, 12, 10, 3, '#e8a33d', OUT, 1.5);
  line(ctx, 18, -24, 36, -38, '#e8a33d', 5);
  ctx.restore();
  for (const dx of [14, 40]) {
    fillRR(ctx, x + dx - 10, y - 56, 20, 16, 5, '#fff', '#1c7ed6', 2);
    ctx.globalAlpha = 0.5;
    ell(ctx, x + dx + Math.sin(t * 2 + dx) * 2, y - 66 - ((t * 12 + dx) % 10), 4, 6, '#fff');
    ctx.globalAlpha = 1;
  }
  ell(ctx, x + 64, y - 44, 18, 5, '#ced4da', OUT, 1.5);
  for (let i = 0; i < 4; i++) ell(ctx, x + 54 + i * 7, y - 50 - (i % 2) * 3, 4, 6, '#7a3e1d', OUT, 1);
}
/** Медная лампа на цепочке (свет ночью — lamps). */
function brassLamp(ctx, x, y, t, k) {
  const sw = Math.sin(t * 1.3) * 3 + Math.sin(t * 20) * 6 * k;
  line(ctx, x, y - 250, x + sw, y - 200, '#868e96', 2);
  ell(ctx, x + sw, y - 186, 18, 14, '#e8a33d', OUT, 2);
  poly(ctx, [x + sw - 10, y - 198, x + sw, y - 212, x + sw + 10, y - 198], '#e8a33d', OUT, 1.5);
  for (let i = 0; i < 3; i++) ell(ctx, x + sw - 8 + i * 8, y - 186, 2.5, 3.5, '#fff3bf');
}
/** Седло верблюда и сундучок с окаменелостями. */
function saddle(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 50, y - 50, 100, 50, 10, '#a8703f', OUT, 2);
  carpet(ctx, x - 56, y - 74, 112, 36, '#c92a2a', '#ffd43b', '#1c7ed6');
  for (const dx of [-40, 40]) {
    line(ctx, x + dx, y - 74, x + dx, y - 104, '#8d5524', 5);
    ell(ctx, x + dx, y - 106, 6, 6, '#ffd43b', OUT, 1.2);
  }
  for (let i = 0; i < 5; i++) line(ctx, x - 46 + i * 23, y - 2, x - 46 + i * 23, y + 0, '#ffd43b', 3);
  ctx.restore();
}

export const tent = {
  id: 'tent_barkhan',
  name: 'Шатёр Бархана',
  owner: 'barkhan',
  hello:
    '⛺ Шатёр кочевника! Ковры, мягкие подушки и сладкий чай с финиками. Нажимай на столик, лампу и седло верблюда.',
  greet: [
    'Бархан: «Входи, входи! Песок отряхни — и к чаю.»',
    'Бархан: «Гостю в шатре — лучшая подушка и самый сладкий финик!»',
  ],
  floors: 1,
  width: 1150,
  maxZoom: 1.1,
  music: 'desert',
  door: { f: 0, x: 100 },
  shell: {
    shape: 'tent',
    wall: '#e9cf9c',
    roof: '#e9cf9c',
    flag: '#c92a2a',
    ground: 'desert',
    bushes: true,
    trees: 'palm',
  },
  rooms: [
    {
      id: 'tent',
      f: 0,
      x0: 0,
      x1: 1150,
      name: 'Шатёр',
      wall: '#b5523b',
      trim: '#ffd43b',
      paper: 'fabric',
      floor: 'sand',
      win: null,
    },
  ],
  lamps: [{ f: 0, x: 600, h: 186, r: 320, c: '255,180,90' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'flap', c: '#c0583b', sky: '#ffe8a1', ground: '#f2d49b' },
    { id: 'carpet1', type: 'prop', f: 0, x: 300, w: 0, h: 0, draw: wallCarpet('#1864ab', '#ffd43b', '#e03131') },
    { id: 'carpet2', type: 'prop', f: 0, x: 860, w: 0, h: 0, draw: wallCarpet('#862e9c', '#ffd43b', '#2f9e44') },
    {
      id: 'floor',
      type: 'prop',
      f: 0,
      x: 600,
      w: 0,
      h: 0,
      draw: (ctx, x, y) => {
        ell(ctx, x, y + 2, 300, 14, '#c92a2a', OUT, 2);
        ell(ctx, x, y + 2, 270, 10, null, '#ffd43b', 3);
      },
    },
    {
      id: 'cushions',
      type: 'prop',
      f: 0,
      x: 420,
      w: 200,
      h: 60,
      fx: 'heart',
      draw: (ctx, x, y, t, k) => {
        cushion(ctx, x - 60, y - k * 6, '#e64980');
        cushion(ctx, x + 50, y, '#f59f00');
        cushion(ctx, x - 4, y - 26, '#1c7ed6');
      },
      say: [
        'Мягко! Подушки набиты верблюжьей шерстью — Бархан сам их шил 🛋️',
        'Плюх! Здесь Бархан рассказывает сказки про звёзды.',
      ],
    },
    {
      id: 'tea',
      type: 'prop',
      f: 0,
      x: 640,
      w: 180,
      h: 100,
      draw: teaTable,
      fx: 'steam',
      sfx: 'clink',
      say: [
        'Чай в пустыне пьют горячим — так прохладнее, говорит Бархан. А к чаю — финики 🍵',
        'Сладкий финик! Его сорвали в оазисе вчера утром.',
      ],
    },
    {
      id: 'lamp',
      type: 'prop',
      f: 0,
      x: 600,
      w: 60,
      h: 250,
      up: 170,
      draw: brassLamp,
      say: 'Медная лампа из большого города за пустыней. Ночью от неё по шатру бегут золотые узоры ✨',
    },
    {
      id: 'saddle',
      type: 'prop',
      f: 0,
      x: 960,
      w: 130,
      h: 110,
      draw: saddle,
      say: [
        'Седло верблюда Горбика — с кисточками и колокольчиками 🐫',
        'Седло старое-старое: на нём Бархан объехал всю пустыню!',
      ],
    },
  ],
  furniture: { fixed: [['fossil_box', 0, 1080]] },
  actors: [{ npc: 'barkhan', f: 0, x: 760, roam: [250, 900], act: 'nomad', when: () => npcAtHome('barkhan') }],
};
