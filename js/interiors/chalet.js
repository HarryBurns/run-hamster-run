// Шале инструктора Вершинкина на горе (Г2): прихожая с лыжами и санками, гостиная у камина — кресло-качалка, кубки,
// эдельвейсы, кружки какао; за окнами — горы в снегу. Дом «тайного места»: вход — дверь шале ('inside:chalet_vershinkin',
// locations/mountain.js), дверь изнутри — назад к двери снаружи. Хозяин внутри — 'instructor' (задание, «Спуск с горы»).
import { npcAtHome } from '../core/state.js'; // дома ли хозяин сейчас (одно правило «где житель» — core/queries.js)
import { ell, fillRR, line, poly } from '../core/draw.js';
import { wob } from './inside_art.js';

const OUT = '#4a3728';

/** Лыжи и палки у стены. */
function skis(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  for (const [dx, c] of [
    [-22, '#e03131'],
    [0, '#1c7ed6'],
  ]) {
    fillRR(ctx, x + dx - 6, y - 214, 12, 210, 6, c, OUT, 1.8);
    ctx.beginPath();
    ctx.arc(x + dx, y - 214, 6, Math.PI, 0);
    ctx.fillStyle = c;
    ctx.fill();
    fillRR(ctx, x + dx - 8, y - 110, 16, 18, 3, '#343a40', OUT, 1.2);
  }
  for (const dx of [26, 40]) {
    line(ctx, x + dx, y - 190, x + dx + 4, y - 6, '#868e96', 3);
    ell(ctx, x + dx + 4, y - 22, 8, 3, '#495057');
    fillRR(ctx, x + dx - 3, y - 196, 6, 22, 3, '#343a40');
  }
  ctx.restore();
}
/** Деревянные санки с красной верёвочкой. */
function sled(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y, t, k);
  ctx.strokeStyle = '#8d5524';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 70, y - 6);
  ctx.lineTo(x + 54, y - 6);
  ctx.quadraticCurveTo(x + 78, y - 6, x + 74, y - 30);
  ctx.stroke();
  for (const dx of [-50, 30]) line(ctx, x + dx, y - 6, x + dx, y - 30, '#8d5524', 4);
  for (let i = 0; i < 4; i++) fillRR(ctx, x - 64 + i * 32, y - 40, 28, 12, 3, i % 2 ? '#d9a066' : '#c98b5a', OUT, 1.5);
  ctx.strokeStyle = '#e03131';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 74, y - 30);
  ctx.quadraticCurveTo(x + 96, y - 60, x + 80, y - 82);
  ctx.stroke();
  ctx.restore();
}
/** Столик с двумя кружками какао и зефирками; от кружек идёт пар. */
function cocoa(ctx, x, y, t, k) {
  fillRR(ctx, x - 60, y - 74, 120, 12, 4, '#a8703f', OUT, 2);
  for (const dx of [-46, 40]) fillRR(ctx, x + dx, y - 62, 8, 62, 3, '#8d5524', OUT, 1.5);
  for (const [dx, c] of [
    [-24, '#ff6b6b'],
    [22, '#4dabf7'],
  ]) {
    fillRR(ctx, x + dx - 13, y - 104, 26, 30, 6, c, OUT, 1.8);
    ell(ctx, x + dx + 15, y - 90, 6, 8, null, OUT, 2.5);
    ell(ctx, x + dx, y - 104, 11, 4, '#8d5524');
    ell(ctx, x + dx - 3, y - 107, 4, 3, '#fff');
    ctx.globalAlpha = 0.45 + k * 0.4;
    ell(ctx, x + dx + Math.sin(t * 2 + dx) * 3, y - 122 - ((t * 14 + dx) % 14), 5, 7, '#fff');
    ctx.globalAlpha = 1;
  }
}
/** Карта трасс на стене: гора, флажки, зигзаг трассы. */
function pisteMap(ctx, x, y, t, k) {
  ctx.save();
  wob(ctx, x, y - 170, t, k);
  fillRR(ctx, x - 64, y - 228, 128, 100, 6, '#e7f5ff', OUT, 2);
  poly(ctx, [x - 54, y - 136, x - 4, y - 214, x + 54, y - 136], '#ced4da', OUT, 1.5);
  poly(ctx, [x - 18, y - 192, x - 4, y - 214, x + 12, y - 194], '#fff');
  ctx.strokeStyle = '#e03131';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 204);
  ctx.lineTo(x + 18, y - 182);
  ctx.lineTo(x - 14, y - 164);
  ctx.lineTo(x + 26, y - 142);
  ctx.stroke();
  for (const [dx, dy] of [
    [18, -182],
    [-14, -164],
  ]) {
    line(ctx, x + dx, y + dy, x + dx, y + dy - 14, OUT, 1.5);
    poly(ctx, [x + dx, y + dy - 14, x + dx + 10, y + dy - 10, x + dx, y + dy - 6], '#ffd43b');
  }
  ctx.restore();
}

export default {
  id: 'chalet_vershinkin',
  name: 'Шале Вершинкина',
  owner: 'vershinkin',
  hello: '🏔️ Шале инструктора! Тепло, трещит камин, пахнет какао. Нажимай на лыжи, санки, карту трасс и кружки.',
  greet: [
    'Вершинкин: «Заходи, отряхивай снег! Какао ещё горячее.»',
    'Вершинкин: «О, гостья! Садись к камину, грей лапки.»',
  ],
  floors: 1,
  width: 1300,
  maxZoom: 1.1,
  music: 'mountain',
  ambience: { wind: 0.15 },
  door: { f: 0, x: 100 },
  shell: {
    wall: '#c98b5a',
    roof: '#c92a2a',
    chimneyX: 1010,
    bushes: true,
    trees: 'fir',
    ground: 'snow',
    snowRoof: true,
  },
  rooms: [
    { id: 'hall', f: 0, x0: 0, x1: 470, name: 'Прихожая', wall: '#d9a066', paper: 'planks', floor: 'wood', win: null },
    {
      id: 'living',
      f: 0,
      x0: 470,
      x1: 1300,
      name: 'Гостиная у камина',
      wall: '#e3bb8c',
      paper: 'logs',
      floor: 'wood',
      win: 640,
      view: 'mountain',
    },
  ],
  built: [
    { id: 'door', type: 'door', f: 0, x: 100, c: '#1971c2' },
    {
      id: 'skis',
      type: 'prop',
      f: 0,
      x: 220,
      w: 90,
      h: 230,
      draw: skis,
      say: [
        'Лыжи Вершинкина! Красная — для трассы, синяя — для прогулок по лугу 🎿',
        'На палках — зарубки: по одной за каждый спуск с вершины. Их уже сто сорок!',
      ],
    },
    {
      id: 'sled',
      type: 'prop',
      f: 0,
      x: 370,
      w: 170,
      h: 90,
      draw: sled,
      fx: 'heart',
      say: [
        'Старые санки Вершинкина. На них он в детстве обогнал ветер! 🛷',
        'Верёвочка красная, чтобы санки было видно в снегу.',
      ],
    },
    {
      id: 'map',
      type: 'prop',
      f: 0,
      x: 830,
      w: 140,
      h: 236,
      up: 120,
      draw: pisteMap,
      say: ['Карта трасс: от вершины — зигзагом мимо флажков. Зелёная — для новичков, красная — для смелых!'],
    },
    {
      id: 'cocoa',
      type: 'prop',
      f: 0,
      x: 1170,
      w: 130,
      h: 130,
      draw: cocoa,
      fx: 'steam',
      sfx: 'clink',
      say: [
        'Какао с зефирками! Одна кружка — Вершинкину, другая — тебе ☕',
        'Ммм, горячо! Подуй сначала — и лапки сразу согреются.',
      ],
    },
  ],
  lamps: [{ f: 0, x: 1010, h: 60, r: 260, c: '255,150,70' }],
  furniture: {
    fixed: [
      ['rug_craft', 0, 900],
      ['rocking_chair', 0, 880],
      ['fireplace', 0, 1035],
      ['trophy_shelf', 0, 1035, 205],
      ['edelweiss_frame', 0, 380, 190],
      ['cup', 0, 1260],
    ],
  },
  actors: [
    { npc: 'vershinkin', f: 0, x: 700, roam: [260, 1120], act: 'instructor', when: () => npcAtHome('vershinkin') },
  ],
};
