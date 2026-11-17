// Хижины удалённого острова изнутри (О2). Дома «тайного места»: вход — двери хижин на острове ('inside:hut_kokos',
// 'inside:hut_guest', 'inside:hut_bum', 'inside:hut_laguna' — locations/island.js), дверь изнутри — назад к двери.
//  - Хижина вождя: маски на стене, барабаны, тотем, циновка; Вождь Кокос внутри — 'chief' (задание, лея, тотем, боулинг).
//  - Хижина для гостей (на сваях над лагуной): циновка-постель — лечь спать ('island:sleep', утро — здесь же), гамак,
//    фонарик из кокоса.
//  - Домики Бума и Лагуны (на сваях): хозяева гуляют (Бум стучит в барабан у костра, Лагуна плетёт гирлянды у пляжа) —
//    на столе записка, где их найти; барабаны Бума и ракушки, корзинки и цветы Лагуны можно потрогать.
import { ell, fillRR, line, poly } from '../core/draw.js';
import { wob, flame } from './inside_art.js';

const OUT = '#4a3728';
const SHELL = { shape: 'thatch', wall: '#c08a4a', roof: '#d9a441', bushes: true, trees: 'palm' };
const STILTS = { ...SHELL, stilts: true, ground: 'lagoon', bushes: false };

/** Маска на стене (c — цвет, v — вид). */
function mask(ctx, x, y, c, v) {
  ell(ctx, x, y, 26, 36, c, OUT, 2);
  ell(ctx, x - 10, y - 8, 7, 5, '#fff', OUT, 1.5);
  ell(ctx, x + 10, y - 8, 7, 5, '#fff', OUT, 1.5);
  ell(ctx, x - 10, y - 8, 3, 3, OUT);
  ell(ctx, x + 10, y - 8, 3, 3, OUT);
  if (v) fillRR(ctx, x - 12, y + 12, 24, 8, 4, '#fff', OUT, 1.5);
  else ell(ctx, x, y + 16, 10, 6, '#c92a2a', OUT, 1.5);
  for (let i = -2; i <= 2; i++) line(ctx, x + i * 9, y - 34, x + i * 13, y - 52, ['#ffd43b', '#ff6b6b', '#51cf66'][(i + 3) % 3], 4);
}
function masks(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 160, t, k);
  mask(ctx, x - 60, y - 166, '#e8590c', 0);
  mask(ctx, x, y - 176, '#2f9e44', 1);
  mask(ctx, x + 60, y - 166, '#1c7ed6', 0);
  ctx.restore();
}
/** Барабаны: большой и два поменьше; потрогали — подпрыгивают. */
function drums(ctx, x, y, t, k) {
  const j = (ph) => (k > 0 ? Math.abs(Math.sin(t * 16 + ph)) * 8 * k : 0);
  const drum = (dx, w, h, c, ph) => {
    const yy = y - j(ph);
    fillRR(ctx, x + dx - w / 2, yy - h, w, h, 8, c, OUT, 2);
    for (let i = 0; i < 4; i++) line(ctx, x + dx - w / 2 + 6 + i * ((w - 12) / 3), yy - h + 6, x + dx - w / 2 + 6 + ((i + 0.5) * (w - 12)) / 3, yy - 6, '#f3e0b5', 2);
    ell(ctx, x + dx, yy - h, w / 2, 8, '#f3e0b5', OUT, 2);
  };
  drum(-46, 50, 70, '#a8703f', 0);
  drum(14, 64, 104, '#8d5524', 1);
  drum(68, 42, 56, '#c98b5a', 2);
}
/** Очаг-фонарик из кокоса (свет — lamps). */
function cocoLamp(ctx, x, y, t, k) {
  line(ctx, x, y - 250, x, y - 206, '#8d5524', 2);
  ell(ctx, x, y - 190, 18, 16, '#8d5524', OUT, 2);
  for (let i = 0; i < 4; i++) ell(ctx, x - 9 + i * 6, y - 190 + (i % 2) * 4, 2.5, 2.5, '#ffe066');
  if (k > 0) flame(ctx, x, y - 200, 0.3, t);
}
/** Циновка-постель с подушкой из листьев и лёгким покрывалом (здесь спят). */
function bedMat(ctx, x, y, t, k) {
  fillRR(ctx, x - 110, y - 22, 220, 22, 8, '#d9b26f', OUT, 2);
  for (let xx = x - 100; xx < x + 104; xx += 14) line(ctx, xx, y - 20, xx, y - 2, '#b8893f', 2);
  ell(ctx, x - 78, y - 30, 30, 13, '#8ce99a', OUT, 2);
  fillRR(ctx, x - 40, y - 38, 140, 22, 10, '#ff8fab', OUT, 2);
  for (let i = 0; i < 4; i++) ell(ctx, x - 20 + i * 34, y - 27, 5, 5, '#fff3bf');
  if (k > 0) for (let i = 0; i < 3; i++) ell(ctx, x + 10 + i * 18, y - 60 - i * 14 - k * 10, 5, 5, 'rgba(255,255,255,.7)');
}
/** Записка на столике: где хозяин. */
const note = (ctx, x, y, t, k) => {
  fillRR(ctx, x - 50, y - 60, 100, 12, 4, '#a8703f', OUT, 2);
  for (const dx of [-40, 34]) fillRR(ctx, x + dx, y - 48, 6, 48, 2, '#8d5524', OUT, 1.2);
  ctx.save();
  wob(ctx, x, y - 64, t, k);
  poly(ctx, [x - 26, y - 62, x + 22, y - 66, x + 26, y - 60, x - 22, y - 58], '#fff8e1', OUT, 1.5);
  ctx.restore();
  ell(ctx, x + 32, y - 68, 8, 6, '#8d5524', OUT, 1.5);
};
/** Ракушки на верёвочке и корзинка с цветами (домик Лагуны). */
function shells(ctx, x, y, t, k) {
  line(ctx, x - 80, y - 220, x + 80, y - 220, '#a8703f', 2);
  for (let i = 0; i < 7; i++) {
    const sx = x - 72 + i * 24,
      sw = Math.sin(t * 1.5 + i) * 2 + Math.sin(t * 20 + i) * 5 * k;
    line(ctx, sx, y - 220, sx + sw, y - 196, '#a8703f', 1.5);
    ell(ctx, sx + sw, y - 190, 8, 7, ['#ffc9c9', '#fff3bf', '#d0ebff', '#ffd8a8'][i % 4], OUT, 1.2);
  }
}
function basket(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 40, y - 40, 80, 40, 10, '#d9a441', OUT, 2);
  for (let i = 0; i < 5; i++) line(ctx, x - 34 + i * 17, y - 38, x - 34 + i * 17, y - 4, '#b8893f', 2);
  for (const [dx, c] of [
    [-22, '#ff6b6b'],
    [0, '#ffd43b'],
    [22, '#e64980'],
    [-10, '#fff'],
    [12, '#ff922b'],
  ]) {
    for (let p = 0; p < 5; p++) ell(ctx, x + dx + Math.cos(p * 1.26) * 6, y - 48 + Math.sin(p * 1.26) * 6 - (dx % 2 ? 8 : 0), 4, 4, c, OUT, 0.8);
    ell(ctx, x + dx, y - 48 - (dx % 2 ? 8 : 0), 3, 3, '#ffd43b');
  }
  ctx.restore();
}

// ---------- хижина вождя ----------
export const chief = {
  id: 'hut_kokos',
  name: 'Хижина вождя',
  owner: 'kokos',
  hello: '🌴 Хижина Вождя Кокоса! Маски предков, большие барабаны и тотем. Алоха!',
  greet: ['Кокос: «Алоха! Входи, гостья. Барабаны любят, когда их гладят.»', 'Кокос: «Садись на циновку — сейчас расскажу про вулкан!»'],
  floors: 1,
  width: 1250,
  maxZoom: 1.1,
  music: 'island',
  ambience: { sea: 0.25 },
  door: { f: 0, x: 100 },
  shell: { ...SHELL, ground: 'sand', wall: '#b07a3e' },
  rooms: [{ id: 'hall', f: 0, x0: 0, x1: 1250, name: 'Хижина вождя', wall: '#d6a96a', paper: 'reed', floor: 'mat', win: 900, view: 'sea' }],
  lamps: [{ f: 0, x: 620, h: 190, r: 300, c: '255,190,110' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'curtain', c: '#8fae4a', sky: '#d0ebff', ground: '#ffe8a1' },
    {
      id: 'masks',
      type: 'prop',
      f: 0,
      x: 360,
      w: 200,
      h: 240,
      up: 110,
      draw: masks,
      say: ['Маски предков: весёлая, мудрая и смелая. Вождь надевает их на праздник огней 🎭', 'Зелёная маска — мудрая. Говорят, она знает, когда проснётся вулкан!'],
    },
    { id: 'lamp', type: 'prop', f: 0, x: 620, w: 60, h: 250, up: 170, draw: cocoLamp, say: 'Фонарик из кокосовой скорлупы. Ночью сквозь дырочки светят звёздочки ✨' },
    {
      id: 'drums',
      type: 'prop',
      f: 0,
      x: 1080,
      w: 180,
      h: 120,
      draw: drums,
      fx: 'note',
      sfx: 'thud',
      say: ['Бум-бум-тук! Большой барабан вождя — самый громкий на острове 🥁', 'Тук-тук-БУМ! Вождь кивает в такт: «Ты прирождённая барабанщица!»'],
    },
  ],
  furniture: { fixed: [['rug_craft', 0, 640], ['mini_totem', 0, 780], ['plant_palm', 0, 220]] },
  actors: [{ npc: 'kokos', f: 0, x: 560, roam: [240, 960], act: 'chief' }],
};

// ---------- хижина для гостей ----------
export const guest = {
  id: 'hut_guest',
  name: 'Хижина для гостей',
  hello: '🛏️ Хижина для гостей — на сваях над лагуной! Нажми на циновку, чтобы лечь спать: утро будет здесь же, на острове.',
  floors: 1,
  width: 1000,
  maxZoom: 1.1,
  music: 'island',
  ambience: { sea: 0.45 },
  door: { f: 0, x: 100 },
  shell: { ...STILTS, wall: '#c08a4a' },
  rooms: [{ id: 'room', f: 0, x0: 0, x1: 1000, name: 'Хижина для гостей', wall: '#e0b77c', paper: 'reed', floor: 'mat', win: 470, view: 'sea', main: true }],
  lamps: [{ f: 0, x: 300, h: 190, r: 260, c: '255,190,110' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'curtain', c: '#ff8fab', sky: '#d0ebff', ground: '#3bc9db' },
    { id: 'lamp', type: 'prop', f: 0, x: 300, w: 60, h: 250, up: 170, draw: cocoLamp, say: 'Фонарик из кокоса. Ночью он светит тёплыми точками — совсем не страшно 🌙' },
    { id: 'bed', type: 'prop', f: 0, x: 790, w: 230, h: 90, draw: bedMat, sfx: 'tap', run: 'island:sleep' },
  ],
  furniture: { fixed: [['hammock', 0, 470], ['plant_palm', 0, 960]] },
};

// ---------- домики Бума и Лагуны ----------
export const bum = {
  id: 'hut_bum',
  name: 'Домик Бума',
  hello: '🥁 Домик барабанщика Бума! Барабаны повсюду — даже кровать похожа на барабан. Сам Бум стучит у костра.',
  floors: 1,
  width: 1000,
  maxZoom: 1.1,
  music: 'island',
  ambience: { sea: 0.4 },
  door: { f: 0, x: 100 },
  shell: { ...STILTS, wall: '#a8703f' },
  rooms: [{ id: 'room', f: 0, x0: 0, x1: 1000, name: 'Домик Бума', wall: '#d6a96a', paper: 'reed', floor: 'mat', win: 560, view: 'sea' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'curtain', c: '#4dabf7', sky: '#d0ebff', ground: '#3bc9db' },
    { id: 'note', type: 'prop', f: 0, x: 330, w: 110, h: 80, draw: note, sfx: 'paper', say: '📝 Записка: «Ушёл к костру стучать в барабан! Приходи — постучим вместе. Бум»' },
    {
      id: 'drums',
      type: 'prop',
      f: 0,
      x: 800,
      w: 180,
      h: 120,
      draw: drums,
      fx: 'note',
      sfx: 'thud',
      say: ['Тук-тук! Барабаны Бума — маленький, средний и самый большой 🥁', 'Бум-бум! Кажется, где-то у костра Бум услышал и ответил: «Бум!»'],
    },
  ],
  furniture: { fixed: [['hammock', 0, 560]] },
};

export const laguna = {
  id: 'hut_laguna',
  name: 'Домик Лагуны',
  hello: '🌺 Домик Лагуны! Ракушки на верёвочке, корзинки с цветами. Сама Лагуна плетёт гирлянды у пляжа.',
  floors: 1,
  width: 1000,
  maxZoom: 1.1,
  music: 'island',
  ambience: { sea: 0.4 },
  door: { f: 0, x: 100 },
  shell: { ...STILTS, wall: '#c98b5a' },
  rooms: [{ id: 'room', f: 0, x0: 0, x1: 1000, name: 'Домик Лагуны', wall: '#f0c98f', paper: 'reed', floor: 'mat', win: 600, view: 'sea' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'curtain', c: '#e64980', sky: '#d0ebff', ground: '#3bc9db' },
    {
      id: 'shells',
      type: 'prop',
      f: 0,
      x: 330,
      w: 180,
      h: 240,
      up: 150,
      draw: shells,
      sfx: 'clink',
      say: ['Ракушки на верёвочке звенят от ветра: дзинь-дзинь 🐚', 'Розовую ракушку Лагуна нашла у камня русалочки… ой, нет, на этом острове!'],
    },
    { id: 'note', type: 'prop', f: 0, x: 600, w: 110, h: 80, draw: note, sfx: 'paper', say: '📝 Записка: «Я у пляжа — плету гирлянды из цветов. Заходи в гости! Лагуна 🌺»' },
    { id: 'basket', type: 'prop', f: 0, x: 840, w: 100, h: 80, draw: basket, fx: 'heart', say: ['Корзинка с цветами для гирлянд. Пахнет летом! 🌺', 'Из таких цветов Вождь плетёт лею — нужны три разных.'] },
  ],
  furniture: { fixed: [['plant_flowers', 0, 470], ['shell_frame', 0, 840, 190]] },
};
