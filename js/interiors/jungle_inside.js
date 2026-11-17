// Джунгли изнутри (Дж4): зал древнего храма и палатка исследовательницы Лианы. Дома «тайного места»: вход — двери
// зданий в джунглях ('inside:temple_hall', 'inside:tent_liana' — locations/jungle.js), дверь изнутри — назад.
//  - Храм: зал во мху и лианах, факелы, идол-обезьянка, алтарь с сокровищем; стена со знаками — вход в загадку
//    «Узор храма» (действие 'jungle:temple', как раньше у входа снаружи). Хозяина нет, днём полутемно (dim).
//  - Палатка: стол с картами, гербарий бабочек, походная раскладушка, фонарь, бинокль; Лиана внутри — 'explorer'.
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { wob, torch } from './inside_art.js';

const OUT = '#4a3728';

// ---------- храм ----------
/** Лианы свисают с потолка (качаются). */
function vines(ctx, x, y, t, k) {
  for (let i = 0; i < 5; i++) {
    const vx = x - 80 + i * 40,
      len = 70 + ((i * 37) % 60),
      sw = Math.sin(t * 1.2 + i) * 4 + Math.sin(t * 18) * 8 * k;
    ctx.strokeStyle = '#2b8a3e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vx, y - 250);
    ctx.quadraticCurveTo(vx + sw, y - 250 + len / 2, vx + sw * 1.4, y - 250 + len);
    ctx.stroke();
    for (let j = 1; j < 4; j++) ell(ctx, vx + sw * (j / 3) * 1.2 + 6, y - 250 + (len * j) / 4, 7, 4, '#40c057', null, 2, 0.6);
  }
}
/** Стена со знаками — вход в загадку «Узор храма»: каменная плита, узор из цветных знаков, светится. */
function glyphWall(ctx, x, y, t, k) {
  fillRR(ctx, x - 90, y - 228, 180, 228, 6, '#7d8b6a', OUT, 2.5);
  fillRR(ctx, x - 76, y - 214, 152, 200, 4, '#69775a', OUT, 2);
  const cols = ['#ffd43b', '#4dabf7', '#ff6b6b', '#8ce99a'];
  for (let i = 0; i < 9; i++) {
    const gx = x - 46 + (i % 3) * 46,
      gy = y - 180 + Math.floor(i / 3) * 52,
      c = cols[(i * 5) % 4],
      on = (Math.floor(t * 1.5) + i) % 9 === 0 || k > 0;
    if (on) ell(ctx, gx, gy, 20, 20, 'rgba(255,240,170,.35)');
    if (i % 3 === 0) star(ctx, gx, gy, 12, c, OUT, 1.2);
    else if (i % 3 === 1) ell(ctx, gx, gy, 11, 11, c, OUT, 1.2);
    else poly(ctx, [gx, gy - 12, gx + 12, gy + 10, gx - 12, gy + 10], c, OUT, 1.2);
  }
}
/** Идол-обезьянка из камня, с зелёными глазками. */
function idol(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 40, y - 36, 80, 36, 4, '#868e96', OUT, 2);
  ell(ctx, x, y - 84, 34, 48, '#a0a58e', OUT, 2);
  ell(ctx, x, y - 150, 30, 28, '#a0a58e', OUT, 2);
  ell(ctx, x - 30, y - 152, 10, 12, '#a0a58e', OUT, 2);
  ell(ctx, x + 30, y - 152, 10, 12, '#a0a58e', OUT, 2);
  ell(ctx, x, y - 142, 18, 13, '#c9cbb4', OUT, 1.5);
  ell(ctx, x - 10, y - 158, 4, 5, k > 0 || Math.sin(t * 2) > 0.6 ? '#69db7c' : '#2b8a3e');
  ell(ctx, x + 10, y - 158, 4, 5, k > 0 || Math.sin(t * 2) > 0.6 ? '#69db7c' : '#2b8a3e');
  line(ctx, x - 6, y - 136, x + 6, y - 136, OUT, 2);
  ctx.restore();
}
/** Алтарь с сокровищем: золотой кубок с изумрудом. */
function altar(ctx, x, y, t, k) {
  fillRR(ctx, x - 70, y - 74, 140, 74, 6, '#7d8b6a', OUT, 2.5);
  fillRR(ctx, x - 80, y - 86, 160, 16, 5, '#8f9b7a', OUT, 2);
  for (const dx of [-40, 0, 40]) ell(ctx, x + dx, y - 40, 10, 10, null, '#5c6b4a', 2);
  fillRR(ctx, x - 14, y - 102, 28, 14, 4, '#ffd43b', OUT, 1.5);
  line(ctx, x, y - 102, x, y - 118, '#e0a800', 6);
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 150);
  ctx.quadraticCurveTo(x, y - 106, x + 26, y - 150);
  ctx.closePath();
  ctx.fillStyle = '#ffd43b';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  ell(ctx, x, y - 134, 7, 7, '#37b24d', OUT, 1.2);
  if (Math.sin(t * 2.6) > 0.3 || k > 0) star(ctx, x + 18, y - 150, 6, '#fff9db');
}

export const temple = {
  id: 'temple_hall',
  name: 'Зал храма',
  hello: '🗿 Зал древнего храма! Мох, лианы и факелы. Стена с цветными знаками — вход в загадку «Узор храма».',
  floors: 1,
  width: 1350,
  maxZoom: 1.1,
  music: 'jungle',
  ambience: { drips: 0.3 },
  dim: 0.32,
  door: { f: 0, x: 110 },
  shell: { shape: 'temple', wall: '#8f9b7a', roof: '#7d8b6a', moss: '#2f9e44', ground: 'jungle', bushes: true, trees: 'palm' },
  rooms: [{ id: 'hall', f: 0, x0: 0, x1: 1350, name: 'Зал храма', wall: '#9aa284', paper: 'stone', floor: 'stone', win: null, lamp: false }],
  lamps: [
    { f: 0, x: 300, h: 190, r: 300, c: '255,170,80' },
    { f: 0, x: 760, h: 190, r: 320, c: '255,170,80' },
    { f: 0, x: 1200, h: 190, r: 300, c: '255,170,80' },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 110, look: 'arch', c: '#8f9b7a', sky: '#d3f9d8', ground: '#37b24d' },
    { id: 'torches', type: 'prop', f: 0, x: 300, draw: (ctx, x, y, t) => [300, 760, 1200].forEach((tx) => torch(ctx, tx, y - 190, t)) },
    {
      id: 'vines',
      type: 'prop',
      f: 0,
      x: 420,
      w: 200,
      h: 250,
      up: 150,
      draw: vines,
      sfx: 'flap',
      say: ['Лианы пробрались в храм через щели в потолке. Качаются, как качели! 🌿', 'Шур-шур… С лианы спрыгнула маленькая древесная лягушка!'],
    },
    {
      id: 'idol',
      type: 'prop',
      f: 0,
      x: 560,
      w: 90,
      h: 190,
      draw: idol,
      say: ['Каменная обезьянка — страж храма. У неё глазки из зелёного камня 🐒', 'Говорят, обезьянка подмигивает тем, кто разгадал узор.'],
    },
    { id: 'glyphs', type: 'prop', f: 0, x: 930, w: 190, h: 236, draw: glyphWall, sfx: 'magic', run: 'jungle:temple' },
    {
      id: 'altar',
      type: 'prop',
      f: 0,
      x: 1180,
      w: 170,
      h: 160,
      draw: altar,
      fx: 'spark',
      fxN: 8,
      sfx: 'coin',
      say: ['Сокровище храма — золотой кубок с изумрудом! Брать нельзя: он тут уже тысячу лет ✨', 'Лиана записала в блокнот: «Кубок на месте. Изумруд — с орех!»'],
    },
  ],
  furniture: { fixed: [] },
};

// ---------- палатка Лианы ----------
/** Походный стол с картами, компасом и лупой. */
function mapTable(ctx, x, y, t, k) {
  fillRR(ctx, x - 90, y - 82, 180, 12, 4, '#a8703f', OUT, 2);
  line(ctx, x - 76, y - 70, x + 70, y, '#8d5524', 4);
  line(ctx, x + 76, y - 70, x - 70, y, '#8d5524', 4);
  ctx.save();
  wob(ctx, x, y - 82, t, k);
  poly(ctx, [x - 80, y - 84, x + 40, y - 92, x + 60, y - 84, x - 60, y - 80], '#f3e0b5', OUT, 1.5);
  ctx.restore();
  line(ctx, x - 50, y - 86, x + 20, y - 89, '#e03131', 2);
  ell(ctx, x + 60, y - 92, 10, 5, '#ced4da', OUT, 1.5);
  line(ctx, x + 60, y - 92, x + 64, y - 95, '#e03131', 2);
  // свёрнутые карты
  for (let i = 0; i < 3; i++) fillRR(ctx, x - 70 + i * 18, y - 40 - i * 4, 14, 40, 5, '#f3e0b5', OUT, 1.2);
}
/** Гербарий бабочек в рамке (на стене). */
function butterflies(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 170, t, k);
  fillRR(ctx, x - 70, y - 228, 140, 104, 6, '#5c3a21', OUT, 2);
  fillRR(ctx, x - 62, y - 220, 124, 88, 4, '#fff8e1');
  const b = (bx, by, c, s) => {
    const f = 1 + (k > 0 ? Math.sin(t * 30) * 0.2 : 0);
    ell(ctx, bx - 7 * s * f, by - 3 * s, 7 * s, 9 * s, c, OUT, 1, -0.5);
    ell(ctx, bx + 7 * s * f, by - 3 * s, 7 * s, 9 * s, c, OUT, 1, 0.5);
    ell(ctx, bx - 5 * s, by + 7 * s, 4 * s, 5 * s, c, OUT, 1);
    ell(ctx, bx + 5 * s, by + 7 * s, 4 * s, 5 * s, c, OUT, 1);
    line(ctx, bx, by - 8 * s, bx, by + 10 * s, OUT, 2);
  };
  b(x - 36, y - 196, '#4dabf7', 1);
  b(x + 2, y - 196, '#ff922b', 1.1);
  b(x + 38, y - 192, '#da77f2', 0.9);
  b(x - 16, y - 154, '#ffd43b', 0.9);
  b(x + 24, y - 154, '#51cf66', 1);
  ctx.restore();
}
/** Раскладушка со спальником и рюкзак с биноклем. */
function cot(ctx, x, y, t, k) {
  line(ctx, x - 90, y - 50, x - 60, y, '#495057', 4);
  line(ctx, x - 60, y - 50, x - 90, y, '#495057', 4);
  line(ctx, x + 60, y - 50, x + 90, y, '#495057', 4);
  line(ctx, x + 90, y - 50, x + 60, y, '#495057', 4);
  fillRR(ctx, x - 100, y - 62, 200, 16, 6, '#6f7d3c', OUT, 2);
  fillRR(ctx, x - 92, y - 84, 150, 26, 12, '#e8590c', OUT, 2);
  ell(ctx, x + 70, y - 74, 22, 12, '#fff3d6', OUT, 1.5);
  ctx.save();
  wob(ctx, x + 130, y, t, k);
  fillRR(ctx, x + 108, y - 80, 50, 80, 12, '#8d5524', OUT, 2);
  fillRR(ctx, x + 114, y - 50, 38, 26, 6, '#a8703f', OUT, 1.5);
  for (const dx of [-8, 8]) fillRR(ctx, x + 133 + dx - 6, y - 104, 12, 24, 5, '#343a40', OUT, 1.5);
  ctx.restore();
}
/** Походный фонарь на крючке. */
function lantern(ctx, x, y, t, k) {
  const sw = Math.sin(t * 22) * 6 * k;
  line(ctx, x, y - 250, x + sw, y - 214, '#868e96', 2);
  fillRR(ctx, x + sw - 14, y - 214, 28, 36, 6, '#fff3bf', OUT, 2);
  fillRR(ctx, x + sw - 16, y - 218, 32, 8, 3, '#2f9e44', OUT, 1.5);
  fillRR(ctx, x + sw - 16, y - 180, 32, 6, 3, '#2f9e44', OUT, 1.5);
  ell(ctx, x + sw, y - 196, 5, 8, '#ffa94d');
}

export const camp = {
  id: 'tent_liana',
  name: 'Палатка Лианы',
  owner: 'liana',
  hello: '⛺ Палатка исследовательницы! Карты, бабочки в рамке и походная раскладушка. Всё можно потрогать — аккуратно!',
  greet: ['Лиана: «Заходи! Только не наступи на карту — она ещё сохнет.»', 'Лиана: «О, помощница! Смотри, какую бабочку я сегодня зарисовала.»'],
  floors: 1,
  width: 1150,
  maxZoom: 1.1,
  music: 'jungle',
  ambience: { birds: true },
  door: { f: 0, x: 100 },
  shell: { shape: 'tent', wall: '#a9a26a', roof: '#6f7d3c', flag: '#ffd43b', ground: 'jungle', bushes: true, trees: 'palm' },
  rooms: [{ id: 'tent', f: 0, x0: 0, x1: 1150, name: 'Палатка', wall: '#c2b98a', trim: '#6f7d3c', paper: 'fabric', floor: 'mat', win: 620, view: 'jungle' }],
  lamps: [{ f: 0, x: 360, h: 196, r: 260, c: '255,200,120' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, look: 'flap', c: '#6f7d3c', sky: '#d3f9d8', ground: '#37b24d' },
    {
      id: 'lantern',
      type: 'prop',
      f: 0,
      x: 360,
      w: 60,
      h: 250,
      up: 170,
      draw: lantern,
      say: 'Походный фонарь. Ночью Лиана пишет при нём дневник экспедиции 🏮',
    },
    {
      id: 'maps',
      type: 'prop',
      f: 0,
      x: 400,
      w: 190,
      h: 100,
      draw: mapTable,
      sfx: 'paper',
      say: ['Карта джунглей! Красная линия — тропа к водопаду, крестик — храм 🗺️', 'Лупа и компас. Лиана говорит: «Исследователь без компаса — просто гуляющий!»'],
    },
    {
      id: 'butterflies',
      type: 'prop',
      f: 0,
      x: 820,
      w: 150,
      h: 236,
      up: 120,
      draw: butterflies,
      say: [
        'Гербарий бабочек — только рисунки и крылышки, которые бабочки сами потеряли 🦋',
        'Синяя бабочка — морфо. Когда летит, переливается, как море!',
      ],
    },
    {
      id: 'cot',
      type: 'prop',
      f: 0,
      x: 940,
      w: 260,
      h: 110,
      draw: cot,
      fx: 'heart',
      say: ['Раскладушка и спальник. Ночью над палаткой кричат лягушки — Лиане нравится 🐸', 'В рюкзаке — бинокль. Лиана в него смотрит на попугаев!'],
    },
  ],
  furniture: { fixed: [['globe', 0, 660], ['feather_frame', 0, 230, 190]] },
  actors: [{ npc: 'liana', f: 0, x: 560, roam: [240, 760], act: 'explorer' }],
};
