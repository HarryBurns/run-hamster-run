// Номера отеля «Морская звезда» за дверями коридора (этап 13) — маленькие дома на движке домов, дверь выводит обратно
// в коридор отеля (к своей двери; вход — features/hotel.js, действие hotel:knock:<номер>):
//   hotel_201 — «Эконом» (От2): уютная комнатка, окно во двор; снят на ночь — кровать (зона hotel:bed:eco);
//   hotel_202 — «С балконом» (От2): комната и свой балкон над морем с шезлонгом; кровать — hotel:bed:balcony;
//   hotel_203 — номер, где гостит кто-то из жителей (От1, data/hotel.js: roomGuestOn): к нему можно зайти в гости —
//               житель внутри (обычный разговор 'npc:<id>'), его чемодан и сувениры.
// Стандарт 207 — сама комната отеля справа от коридора (interiors/hotel.js).
import { G, hotelRoomGuest } from '../core/state.js';
import { ell, fillRR, line, poly, star } from '../core/draw.js';
import { ROOM_GUESTS } from '../data/index.js';
import { wob } from './inside_art.js';

const OUT = '#4a3728';
const SHELL = {
  wall: '#fff4e6',
  roof: '#1098ad',
  flat: true,
  chimneyX: null,
  bushes: true,
  trees: 'palm',
  ground: 'sand',
};

function label(ctx, str, x, y, size = 13, col = OUT) {
  ctx.font = `800 ${size}px ui-rounded, "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = col;
  ctx.fillText(str, x, y);
}
/** Табличка номера над дверью. */
const plateArt = (no, name) => (ctx, x, y) => {
  fillRR(ctx, x - 60, y - 236, 120, 26, 8, '#fff', OUT, 1.8);
  label(ctx, `№ ${no} · ${name}`, x, y - 222, 12, '#1971c2');
};
/** Чайник, чашка и печенье на тумбочке. */
function teaTray(ctx, x, y, t, k) {
  fillRR(ctx, x - 44, y - 64, 88, 64, 6, '#e9ecef', OUT, 2);
  fillRR(ctx, x - 50, y - 70, 100, 10, 4, '#f8f9fa', OUT, 1.5);
  ctx.save();
  ctx.translate(x - 16, y - 70);
  ctx.rotate(-k * 0.4);
  ell(ctx, 0, -14, 16, 13, '#74c0fc', OUT, 1.8);
  line(ctx, 14, -16, 26, -26, '#74c0fc', 4);
  ctx.restore();
  fillRR(ctx, x + 10, y - 84, 18, 14, 4, '#fff', OUT, 1.5);
  for (let i = 0; i < 3; i++) ell(ctx, x + 36, y - 74 - i * 3, 7, 3, '#d9a066', OUT, 1);
  ctx.globalAlpha = 0.45;
  ell(ctx, x + 19 + Math.sin(t * 2) * 2, y - 94 - ((t * 10) % 10), 4, 6, '#fff');
  ctx.globalAlpha = 1;
}
/** Шезлонг и столик с соком на балконе. */
function balconyLounger(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  poly(ctx, [x - 70, y - 30, x + 50, y - 30, x + 56, y - 22, x - 66, y - 22], '#fff', OUT, 2);
  poly(ctx, [x - 70, y - 30, x - 92, y - 72, x - 80, y - 76, x - 58, y - 30], '#4dabf7', OUT, 2);
  for (const dx of [-60, 46]) line(ctx, x + dx, y - 22, x + dx, y - 2, OUT, 3);
  fillRR(ctx, x + 70, y - 52, 40, 8, 3, '#fff', OUT, 1.5);
  line(ctx, x + 90, y - 44, x + 90, y - 2, OUT, 3);
  fillRR(ctx, x + 80, y - 76, 16, 24, 4, '#ffa94d', OUT, 1.5);
  line(ctx, x + 92, y - 76, x + 98, y - 90, '#e64980', 2);
  ctx.restore();
}
/** Чемодан гостя с наклейками и шляпа на нём. */
function suitcase(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  fillRR(ctx, x - 40, y - 76, 80, 76, 8, '#e64980', OUT, 2);
  fillRR(ctx, x - 12, y - 86, 24, 12, 4, null, OUT, 2);
  ell(ctx, x - 18, y - 50, 10, 10, '#ffd43b', OUT, 1.2);
  star(ctx, x + 16, y - 30, 9, '#74c0fc', OUT, 1.2);
  fillRR(ctx, x - 22, y - 22, 20, 12, 3, '#8ce99a', OUT, 1.2);
  ell(ctx, x, y - 92, 30, 7, '#fff3bf', OUT, 1.5);
  ell(ctx, x, y - 100, 16, 10, '#fff3bf', OUT, 1.5);
  line(ctx, x - 16, y - 96, x + 16, y - 96, '#e64980', 3);
  ctx.restore();
}

export const roomEco = {
  id: 'hotel_201',
  name: 'Номер 201 «Эконом»',
  floors: 1,
  width: 820,
  maxZoom: 1.1,
  music: 'town',
  door: { f: 0, x: 100 },
  shell: SHELL,
  rooms: [
    {
      id: 'room',
      f: 0,
      x0: 0,
      x1: 820,
      name: 'Номер 201',
      wall: '#fff9db',
      paper: 'dots',
      floor: 'wood',
      win: 440,
      view: 'city',
      main: true,
    },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, c: '#ffd8a8' },
    { id: 'plate', type: 'prop', f: 0, x: 100, draw: plateArt(201, 'Эконом') },
    { id: 'bed', type: 'zone', f: 0, x: 640, w: 220, h: 120, act: 'hotel:bed:eco' },
    {
      id: 'tea',
      type: 'prop',
      f: 0,
      x: 300,
      w: 110,
      h: 110,
      draw: teaTray,
      sfx: 'clink',
      fx: 'steam',
      say: [
        'Чайник и печенье — для гостей номера. Скромно, зато уютно! ☕',
        'В окно видно двор отеля: там сушатся полотенца и мурлычет кот.',
      ],
    },
  ],
  furniture: {
    fixed: [
      ['rug_pink', 0, 640],
      ['bed_green', 0, 640],
      ['chair', 0, 440],
      ['pic_flowers', 0, 640, 190],
    ],
  },
};

export const roomBalcony = {
  id: 'hotel_202',
  name: 'Номер 202 «С балконом»',
  floors: 1,
  width: 1000,
  maxZoom: 1.1,
  music: 'town',
  ambience: { sea: 0.4 },
  door: { f: 0, x: 100 },
  shell: SHELL,
  rooms: [
    {
      id: 'room',
      f: 0,
      x0: 0,
      x1: 640,
      name: 'Номер 202',
      wall: '#e7f5ff',
      paper: 'waves',
      floor: 'wood',
      win: null,
      main: true,
    },
    {
      id: 'balcony',
      f: 0,
      x0: 640,
      x1: 1000,
      name: 'Балкон',
      wall: '#c9ecff',
      paper: 'open',
      floor: 'deck',
      win: null,
      view: 'sea',
    },
  ],
  lamps: [{ f: 0, x: 820, h: 230, r: 200, c: '255,214,140' }],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, c: '#c5f6fa' },
    { id: 'plate', type: 'prop', f: 0, x: 100, draw: plateArt(202, 'С балконом') },
    { id: 'bed', type: 'zone', f: 0, x: 400, w: 230, h: 130, act: 'hotel:bed:balcony' },
    {
      id: 'lounger',
      type: 'prop',
      f: 0,
      x: 830,
      w: 200,
      h: 90,
      draw: balconyLounger,
      fx: 'heart',
      say: [
        'Свой балкон над морем! Шезлонг, апельсиновый сок и шум волн 🌅',
        'Отсюда видно, как вдали плывут кораблики. А вечером — закат!',
      ],
    },
  ],
  furniture: {
    fixed: [
      ['rug_rainbow', 0, 400],
      ['bed_royal', 0, 400],
      ['nightstand', 0, 560],
      ['armchair_blue', 0, 240],
      ['pic_sea', 0, 400, 195],
    ],
  },
};

export const roomGuest = {
  id: 'hotel_203',
  name: 'Номер 203',
  floors: 1,
  width: 900,
  maxZoom: 1.1,
  music: 'town',
  door: { f: 0, x: 100 },
  shell: SHELL,
  rooms: [
    {
      id: 'room',
      f: 0,
      x0: 0,
      x1: 900,
      name: 'Номер 203',
      wall: '#f3f0ff',
      paper: 'flowers',
      floor: 'wood',
      win: 470,
      view: 'sea',
    },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, c: '#d0bfff' },
    { id: 'plate', type: 'prop', f: 0, x: 100, draw: plateArt(203, 'гости') },
    {
      id: 'suitcase',
      type: 'prop',
      f: 0,
      x: 300,
      w: 100,
      h: 120,
      draw: suitcase,
      say: [
        'Чемодан с наклейками из путешествий: остров, горы, пустыня! 🧳',
        'На чемодане — шляпа от солнца. Кто-то собрался на пляж!',
      ],
    },
  ],
  furniture: {
    fixed: [
      ['rug_blue', 0, 700],
      ['bed_blue', 0, 700],
      ['plant_flowers', 0, 560],
      ['pic_hamster', 0, 700, 195],
    ],
  },
  actors: ROOM_GUESTS.map((id) => ({
    npc: id,
    f: 0,
    x: 470,
    roam: [220, 560],
    act: 'npc:' + id,
    when: () => !!G.state && hotelRoomGuest() === id,
  })),
};
