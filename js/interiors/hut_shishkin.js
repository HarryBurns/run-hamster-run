// Избушка лесника Шишкина (Л1): сени с картой леса и горница — печка, лавка под окном, гербарий, самовар.
// Дом «тайного места»: вход — дверь избушки в лесу ('inside:hut_shishkin', locations/forest.js), дверь изнутри — назад
// к двери снаружи. Хозяин внутри — его разговор (задание, венок, «Грибная охота») — действие 'forester'.
import { ell, fillRR, line, poly } from '../core/draw.js';
import { wob, flame } from './inside_art.js';

const OUT = '#4a3728';

/** Русская печка: белёная, с устьем, где пляшет огонь, и лежанкой наверху. */
function stove(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 85, y - 190, 170, 190, 10, '#f8f1e3', OUT, 2.5);
  fillRR(ctx, x - 95, y - 200, 190, 18, 6, '#efe4cf', OUT, 2);
  fillRR(ctx, x - 26, y - 250, 52, 52, 4, '#efe4cf', OUT, 2); // труба
  fillRR(ctx, x - 52, y - 112, 104, 72, 36, '#5c3a21', OUT, 2);
  flame(ctx, x, y - 44, 1 + k * 0.5, t);
  fillRR(ctx, x - 60, y - 40, 120, 10, 3, '#adb5bd', OUT, 1.5);
  for (let i = 0; i < 3; i++) fillRR(ctx, x + 40 - i * 4, y - 160 + i * 3, 30, 10, 4, ['#a8703f', '#8d5524', '#c98b5a'][i], OUT, 1.2); // поленья
  ell(ctx, x - 40, y - 150, 14, 9, '#e8590c', OUT, 1.2); // горшочек
  ctx.restore();
}
/** Лавка: длинная доска на ножках, на ней — корзинка с грибами. */
function bench(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 95, y - 56, 190, 16, 5, '#a8703f', OUT, 2);
  for (const dx of [-80, 72]) fillRR(ctx, x + dx, y - 42, 10, 42, 3, '#8d5524', OUT, 1.5);
  fillRR(ctx, x + 20, y - 86, 56, 30, 10, '#d9a066', OUT, 1.5);
  line(ctx, x + 22, y - 84, x + 48, y - 106, '#8d5524', 3);
  line(ctx, x + 74, y - 84, x + 48, y - 106, '#8d5524', 3);
  for (let i = 0; i < 3; i++) {
    ell(ctx, x + 32 + i * 14, y - 88, 8, 5, '#c0392b', OUT, 1);
    fillRR(ctx, x + 30 + i * 14, y - 86, 5, 8, 2, '#fff3d6');
  }
  ctx.restore();
}
/** Гербарий: рамка с засушенными листьями (дуб, клён, берёза) и подписями. */
function herbarium(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 170, t, k);
  fillRR(ctx, x - 62, y - 226, 124, 108, 6, '#8d5524', OUT, 2);
  fillRR(ctx, x - 54, y - 218, 108, 92, 4, '#fff8e1', null);
  const leaf = (lx, ly, c, s) => {
    ell(ctx, lx, ly, 11 * s, 6 * s, c, OUT, 1, -0.6);
    line(ctx, lx - 8 * s, ly + 6 * s, lx + 6 * s, ly - 4 * s, OUT, 1);
  };
  leaf(x - 30, y - 196, '#e8590c', 1.2);
  leaf(x + 4, y - 200, '#f59f00', 1);
  leaf(x + 32, y - 192, '#2f9e44', 1.1);
  leaf(x - 18, y - 156, '#a9e34b', 1);
  leaf(x + 22, y - 152, '#c92a2a', 1.15);
  for (let i = 0; i < 4; i++) line(ctx, x - 40 + i * 24, y - 136, x - 24 + i * 24, y - 136, '#adb5bd', 2);
  ctx.restore();
}
/** Карта леса на стене: тропинки, ручей, ёлочки, улей и крестик. */
function forestMap(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 170, t, k);
  poly(ctx, [x - 70, y - 228, x + 70, y - 232, x + 66, y - 116, x - 66, y - 112], '#f3e0b5', OUT, 2);
  ctx.strokeStyle = '#74c0fc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 60, y - 140);
  ctx.quadraticCurveTo(x - 10, y - 170, x + 10, y - 225);
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  line(ctx, x - 58, y - 200, x + 58, y - 150, '#a8703f', 3);
  ctx.setLineDash([]);
  for (const [dx, dy] of [
    [-40, -215],
    [30, -210],
    [45, -130],
    [-30, -128],
    [55, -195],
  ])
    poly(ctx, [x + dx - 8, y + dy + 10, x + dx, y + dy - 6, x + dx + 8, y + dy + 10], '#2f9e44');
  ell(ctx, x + 22, y - 168, 6, 5, '#ffd43b', OUT, 1);
  line(ctx, x - 14, y - 190, x - 2, y - 178, '#e03131', 3);
  line(ctx, x - 2, y - 190, x - 14, y - 178, '#e03131', 3);
  ell(ctx, x - 66, y - 225, 4, 4, '#868e96');
  ell(ctx, x + 66, y - 229, 4, 4, '#868e96');
  ctx.restore();
}
/** Вешалка в сенях: плащ, корзинка и сапоги. */
function hooks(ctx, x, y) {
  fillRR(ctx, x - 50, y - 196, 100, 10, 3, '#8d5524', OUT, 1.5);
  poly(ctx, [x - 30, y - 188, x - 4, y - 188, x + 2, y - 96, x - 40, y - 96], '#6f7d3c', OUT, 2);
  ell(ctx, x + 26, y - 168, 16, 14, '#d9a066', OUT, 1.5);
  fillRR(ctx, x - 34, y - 34, 22, 34, 6, '#495057', OUT, 1.5);
  fillRR(ctx, x - 8, y - 34, 22, 34, 6, '#495057', OUT, 1.5);
}

export default {
  id: 'hut_shishkin',
  name: 'Избушка лесника',
  owner: 'shishkin',
  hello: '🛖 Избушка лесника! Пахнет печкой и травами. Нажимай на печку, лавку, гербарий и карту леса.',
  greet: ['Шишкин: «Заходи, грейся! Чайник уже на печке.»', 'Шишкин: «А, гостья! Вытирай лапки — и к самовару.»'],
  floors: 1,
  width: 1200,
  maxZoom: 1.1,
  music: 'forest',
  door: { f: 0, x: 100 },
  shell: { wall: '#d9a066', roof: '#5c7c34', chimneyX: 1050, bushes: true, trees: 'fir' },
  rooms: [
    { id: 'hall', f: 0, x0: 0, x1: 440, name: 'Сени', wall: '#d9a066', paper: 'logs', floor: 'wood', win: null },
    { id: 'room', f: 0, x0: 440, x1: 1200, name: 'Горница', wall: '#e0b07a', paper: 'logs', floor: 'wood', win: 580, view: 'forest' },
  ],
  lamps: [{ f: 0, x: 1080, h: 70, r: 260, c: '255,150,70' }, { f: 0, x: 760, h: 170, r: 300 }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, c: '#5c7c34' },
    { type: 'prop', f: 0, x: 220, w: 100, h: 200, draw: hooks, say: 'Плащ лесника от дождя и сапоги для болота. Всё на своём месте!' },
    {
      id: 'map',
      type: 'prop',
      f: 0,
      x: 340,
      w: 150,
      h: 236,
      up: 108,
      draw: forestMap,
      say: [
        'Карта леса! Вот ручей, вот улей, а крестик — там Шишкин видел лосиху с лосёнком 🗺️',
        'Пунктир — тропинка к канатной дороге. Шишкин сам её рисовал!',
      ],
    },
    {
      id: 'bench',
      type: 'prop',
      f: 0,
      x: 580,
      w: 190,
      h: 110,
      draw: bench,
      fx: 'heart',
      say: ['Лавка под окошком. Посидишь — и усталость как рукой сняло 🍂', 'В корзинке — подосиновики. Шишкин собрал утром!'],
    },
    {
      id: 'herbarium',
      type: 'prop',
      f: 0,
      x: 770,
      w: 130,
      h: 232,
      up: 116,
      draw: herbarium,
      say: [
        'Гербарий лесника: дубовый, кленовый и берёзовый листики. Подписано: «Осень, у ручья» 🍁',
        'Красный листик — рябина. Шишкин говорит, рябины много — к холодной зиме!',
      ],
    },
    {
      id: 'stove',
      type: 'prop',
      f: 0,
      x: 1080,
      w: 190,
      h: 250,
      draw: stove,
      fx: 'steam',
      fxN: 7,
      sfx: 'hiss',
      say: ['Печка тёплая-тёплая! В горшочке томится каша 🔥', 'Потрескивают дрова… На лежанке наверху спит кот лесника. Тс-с!'],
    },
  ],
  furniture: {
    fixed: [
      ['rug_craft', 0, 880],
      ['tea_table', 0, 900],
      ['hanging_plant', 0, 470, 205],
      ['fir_wreath', 0, 940, 200],
    ],
  },
  actors: [{ npc: 'shishkin', f: 0, x: 680, roam: [260, 960], act: 'forester' }],
};
