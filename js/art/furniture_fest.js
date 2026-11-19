// Праздничные украшения для дома (этап 15, Пр13): продаются на праздничной полке ТЦ «Уютный дом» около праздника
// (features/shops.js; таблица — data/furniture.js, shop: 'fest', поле fest — праздник). Рисунки — как у всей мебели
// (art/furniture.js): (c, d, w, h, st), предмет на полу — от середины нижнего края, на стене — от середины.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, star, shade } from '../core/draw.js';

const OUT = '#4a3728',
  GOLD = '#fcc419',
  BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ff922b'];

/** Цветок из пяти лепестков. */
function flower(c, x, y, r, col) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ell(c, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.55, col, OUT, 0.8);
  }
  ell(c, x, y, r * 0.35, r * 0.35, '#ffd43b', OUT, 0.6);
}
/** Верёвочка с украшениями дугой поперёк предмета (флажки, фонарики): fn(x, y, i) рисует украшение. */
function swag(c, w, h, n, fn) {
  const at = (q) => [-w / 2 + q * w, -h / 2 + 4 + 4 * q * (1 - q) * (h * 0.45)];
  c.strokeStyle = OUT;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(...at(0));
  for (let i = 1; i <= 16; i++) c.lineTo(...at(i / 16));
  c.stroke();
  for (let i = 0; i < n; i++) fn(...at((i + 0.5) / n), i);
}

export const D_FEST = {
  // новогодняя ёлочка в горшке: огоньки мигают, когда включена (act: lamp)
  festfir(c, d, w, h, st) {
    fillRR(c, -20, -26, 40, 26, 5, '#e03131', OUT, 1.8);
    fillRR(c, -22, -30, 44, 8, 3, '#fa5252', OUT, 1.4);
    line(c, -6, -34, -6, -24, '#8d5524', 6);
    const tiers = [
      [-30, 48, 44],
      [-60, 38, 42],
      [-88, 28, 40],
      [-112, 18, 36],
    ];
    for (const [y, hw, ht] of tiers)
      (poly(c, [-hw, y, 0, y - ht, hw, y], '#2b8a3e', OUT, 1.8),
        poly(c, [-hw * 0.5, y - 2, 0, y - ht, hw * 0.1, y - 2], shade('#2b8a3e', 0.2)));
    const on = st.on !== false;
    for (let i = 0; i < 14; i++) {
      const q = i / 14,
        y = -36 - q * 96,
        x = Math.sin(q * 13) * (44 - q * 34) * 0.8,
        lit = on && (Math.floor((st.t || 0) * 2 + i) % 2 === 0 || st.icon);
      if (lit) ell(c, x, y, 7, 7, 'rgba(255,240,170,.35)');
      ell(c, x, y, 3.4, 4, lit ? BULBS[i % BULBS.length] : '#ced4da', OUT, 1);
    }
    star(c, 0, -h + 10, 11, GOLD, OUT, 1.8);
  },
  // рождественский венок со свечками и красным бантом (на стену)
  festwreath(c, d, w, h, st) {
    const r = w / 2 - 14;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      ell(c, Math.cos(a) * r, Math.sin(a) * r, 13, 9, i % 2 ? '#2f9e44' : '#37b24d', OUT, 1.3, a + 1.2);
    }
    for (const a of [0.5, 2.2, 3.9, 5.4]) ell(c, Math.cos(a) * r, Math.sin(a) * r, 4.5, 4.5, '#fa5252', OUT, 1.1);
    for (const x of [-14, 0, 14]) {
      fillRR(c, x - 4, -r - 22, 8, 20, 2, '#fff', OUT, 1.1);
      ell(c, x, -r - 27 + Math.sin((st.t || 0) * 8 + x) * 0.6, 2.6, 4.4, '#ffd43b', OUT, 0.8);
    }
    poly(c, [0, r, -16, r - 8, -16, r + 10], '#e03131', OUT, 1.5);
    poly(c, [0, r, 16, r - 8, 16, r + 10], '#e03131', OUT, 1.5);
    ell(c, 0, r, 5, 5, '#c92a2a', OUT, 1.3);
  },
  // красные фонарики на шнурке (на стену)
  festlanterns(c, d, w, h) {
    swag(c, w, h, 4, (x, y, i) => {
      line(c, x, y, x, y + 6, OUT, 1);
      fillRR(c, x - 7, y + 5, 14, 3, 1, GOLD, OUT, 0.8);
      ell(c, x, y + 18, 13, 11, i % 3 === 2 ? '#ff922b' : '#e03131', OUT, 1.4);
      for (const k of [-0.5, 0, 0.5]) line(c, x + k * 12, y + 9, x + k * 12, y + 27, 'rgba(120,20,20,.45)', 1);
      fillRR(c, x - 7, y + 28, 14, 3, 1, GOLD, OUT, 0.8);
      line(c, x, y + 31, x, y + 40, GOLD, 1.6);
    });
  },
  // масленичная куколка из соломы с платочком и ленточками
  festdoll(c, d, w, h) {
    fillRR(c, -16, -10, 32, 10, 3, '#a0662d', OUT, 1.4);
    line(c, 0, -10, 0, -h + 10, '#a0662d', 4);
    poly(c, [-24, -14, 0, -78, 24, -14], '#ffe066', OUT, 1.8); // соломенная юбка
    for (let i = 0; i < 6; i++) line(c, -18 + i * 7, -18, -6 + i * 3, -70, 'rgba(160,110,20,.55)', 1);
    poly(c, [-20, -60, 0, -86, 20, -60, 14, -46, -14, -46], '#e64980', OUT, 1.6); // сарафан
    ell(c, 0, -h + 26, 13, 15, '#fff3bf', OUT, 1.6);
    poly(c, [-16, -h + 22, 0, -h + 4, 16, -h + 22, 0, -h + 16], '#e03131', OUT, 1.4); // платочек
    for (const [x, col] of [
      [-18, '#4dabf7'],
      [18, '#69db7c'],
    ])
      line(c, x * 0.6, -72, x * 1.3, -50, col, 3);
  },
  // праздничные флажки (на стену) — 1 Мая
  festflags(c, d, w, h) {
    swag(c, w, h, 9, (x, y, i) =>
      poly(c, [x - 8, y, x + 8, y, x, y + 18], i % 2 ? '#e03131' : BULBS[(i + 1) % BULBS.length], OUT, 1.1),
    );
  },
  // купальский венок из цветов и папоротника с лентами (на стену)
  festkupala(c, d, w, h) {
    const r = w / 2 - 16;
    c.lineWidth = 9;
    c.strokeStyle = OUT;
    c.beginPath();
    c.arc(0, -6, r, 0, TAU);
    c.stroke();
    c.lineWidth = 6.5;
    c.strokeStyle = '#2f9e44';
    c.stroke();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU - Math.PI / 2;
      flower(c, Math.cos(a) * r, -6 + Math.sin(a) * r, 7, ['#ff8fab', '#ffd43b', '#fff', '#b197fc'][i % 4]);
    }
    for (const [x, col] of [
      [-8, '#e03131'],
      [0, '#4dabf7'],
      [8, '#ffd43b'],
    ])
      line(c, x, r - 6, x * 1.6, h / 2 - 2, col, 3);
  },
  // тыква-фонарик со свечкой (светит, когда включена)
  festjack(c, d, w, h, st) {
    const on = st.on !== false,
      f = Math.floor((st.t || 0) * 6) % 2;
    if (on) ell(c, 0, -h / 2, w * 0.7, h * 0.6, 'rgba(255,169,77,.25)');
    ell(c, -16, -h / 2 + 2, 18, h / 2 - 2, '#f76707', OUT, 1.6);
    ell(c, 16, -h / 2 + 2, 18, h / 2 - 2, '#f76707', OUT, 1.6);
    ell(c, 0, -h / 2, 22, h / 2, '#ff922b', OUT, 1.8);
    line(c, 2, -h + 2, 6, -h - 8, '#2b8a3e', 4);
    const eye = on ? (f ? '#ffe066' : '#ffd43b') : '#5c3d2e';
    poly(c, [-14, -h * 0.62, -6, -h * 0.62, -10, -h * 0.74], eye, OUT, 1);
    poly(c, [6, -h * 0.62, 14, -h * 0.62, 10, -h * 0.74], eye, OUT, 1);
    poly(
      c,
      [-14, -h * 0.4, -7, -h * 0.34, 0, -h * 0.4, 7, -h * 0.34, 14, -h * 0.4, 8, -h * 0.26, -8, -h * 0.26],
      eye,
      OUT,
      1,
    );
  },
};
