// ЗДАНИЯ ГОРОДА — у каждого заведения своё лицо и настоящая вывеска. Собраны из «конструктора»
// locations/common/buildings.js (стена, крыша с черепицей, окна, двери, витрины) и вывесок paint.js.
//
// Виды: villa, salon, boutique, cafe, rest, poolhall, beachcafe, mallx (поле theme: fashion | home | food),
// hospital, school, towerFashion, towerHamster, bank, market, realtor, apartment, bungalow, hotel.
// Дома жителей — общий вид house с дорисовкой по характеру хозяина: HOUSE_ART[житель] (якорь Боба, теплица
// и вьюнок Мяты, телескоп Профессора…) и HOUSE_STYLE[житель] (цвет ставней, дымок из трубы).
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, rr, shade, emoji } from '../core/draw.js';
import { T, OUT, defineBuildings } from '../engine/topdown/kinds.js';
import {
  geom,
  baseShadow,
  wall,
  roof,
  gable,
  win,
  door,
  steps,
  chimney,
  glow,
  wallLamp,
  shopBody,
  showcase,
  towerBody,
  towerBox,
  beacon,
  houseGeom,
  facadeLights,
} from './common/buildings.js';
import { signBoard, awning, flower, fitText, leafTones, WOOD, WOOD_D, WOOD_L, LIT, GOLD } from './common/paint.js';

const title = (b) => `${b.icon || ''} ${b.name || ''}`.trim();
const doorLight = facadeLights;

// ---------- мелочи для витрин ----------
function dress(ctx, x, y, s, col) {
  // платье на плечиках: (x, y) — крючок
  line(ctx, x, y, x, y + 4 * s, OUT, 1.2);
  line(ctx, x - 7 * s, y + 7 * s, x + 7 * s, y + 7 * s, OUT, 1.4);
  poly(
    ctx,
    [
      x - 6 * s,
      y + 7 * s,
      x + 6 * s,
      y + 7 * s,
      x + 4 * s,
      y + 16 * s,
      x + 11 * s,
      y + 34 * s,
      x - 11 * s,
      y + 34 * s,
      x - 4 * s,
      y + 16 * s,
    ],
    col,
    OUT,
    1.4,
  );
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillRect(x - 5 * s, y + 15 * s, 10 * s, 2 * s);
}
function mannequinIn(ctx, x, bot, s, col) {
  line(ctx, x, bot, x, bot - 14 * s, '#8a8f98', 2);
  ell(ctx, x, bot, 7 * s, 2 * s, '#8a8f98');
  poly(
    ctx,
    [
      x - 6 * s,
      bot - 44 * s,
      x + 6 * s,
      bot - 44 * s,
      x + 8 * s,
      bot - 30 * s,
      x + 13 * s,
      bot - 8 * s,
      x - 13 * s,
      bot - 8 * s,
      x - 8 * s,
      bot - 30 * s,
    ],
    col,
    OUT,
    1.4,
  );
  fillRR(ctx, x - 8 * s, bot - 32 * s, 16 * s, 3.5 * s, 1.5, shade(col, -0.25));
  ell(ctx, x, bot - 50 * s, 4.5 * s, 5.5 * s, '#f1e0c5', OUT, 1.3);
}
function pile(ctx, x, bot, n, r, cols) {
  // горка круглых плодов
  let row = n,
    y = bot - r;
  while (row > 0) {
    for (let i = 0; i < row; i++) {
      const cx = x + (i - (row - 1) / 2) * r * 1.9;
      ell(ctx, cx, y, r, r, cols[(i + row) % cols.length], OUT, 1.1);
      ell(ctx, cx - r * 0.3, y - r * 0.3, r * 0.3, r * 0.22, 'rgba(255,255,255,.6)');
    }
    row--;
    y -= r * 1.6;
  }
}
function cake(ctx, x, bot, col) {
  fillRR(ctx, x - 9, bot - 12, 18, 12, 3, '#fff3d6', OUT, 1.2);
  fillRR(ctx, x - 10, bot - 15, 20, 6, 3, col, OUT, 1.2);
  ell(ctx, x, bot - 17, 2.6, 2.6, '#fa5252', OUT, 0.9);
}
function bunting(ctx, x0, x1, y, sag = 8) {
  // гирлянда флажков
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y);
  ctx.stroke();
  const n = Math.max(3, Math.round((x1 - x0) / 20));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n,
      x = x0 + (x1 - x0) * k,
      yy = y + sag * 2 * 2 * k * (1 - k);
    poly(
      ctx,
      [x - 6, yy, x + 6, yy, x, yy + 11],
      ['#fa5252', '#ffd43b', '#4dabf7', '#51cf66', '#f783ac'][i % 5],
      OUT,
      1,
    );
  }
}
function lanterns(ctx, x0, x1, y, lit) {
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 10, x1, y);
  ctx.stroke();
  const n = Math.max(3, Math.round((x1 - x0) / 26));
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n,
      x = x0 + (x1 - x0) * k,
      yy = y + 20 * k * (1 - k) + 2;
    if (lit) glow(ctx, x, yy + 5, 13, 0.55);
    ell(
      ctx,
      x,
      yy + 5,
      4.5,
      5.5,
      lit ? ['#ffe48a', '#ffb3c1', '#b2f2bb'][i % 3] : ['#ffd43b', '#ff8fab', '#8ce99a'][i % 3],
      OUT,
      1.1,
    );
  }
}
/** Вьюнок с цветами по стене: от (x, bot) вверх на h. */
function ivy(ctx, x, bot, h, sea, dir = 1) {
  const t = leafTones(sea, 1);
  ctx.strokeStyle = sea === 'winter' ? '#a08a6a' : '#3f9a4d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, bot);
  for (let i = 1; i <= 6; i++)
    ctx.quadraticCurveTo(
      x + dir * (i % 2 ? 10 : -4),
      bot - (h * (i - 0.5)) / 6,
      x + dir * (i % 2 ? 3 : 6),
      bot - (h * i) / 6,
    );
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const yy = bot - 6 - (h - 10) * (i / 9),
      xx = x + dir * (3 + ((i * 7) % 11));
    ell(ctx, xx, yy, 5.5, 3.6, i % 2 ? t[1] : t[0], null, 1, i);
    if (sea !== 'winter' && sea !== 'autumn' && i % 3 === 0)
      flower(ctx, xx + 2, yy - 3, 2.4, i % 2 ? '#ff8fab' : '#fff');
  }
}

// ================= ВИЛЛА =================
function paintVilla(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, H, bot, cx } = g;
  baseShadow(ctx, g, 10);
  chimney(ctx, X + 70, Y - 44, 22, 46, snow);
  chimney(ctx, X + W - 92, Y - 44, 22, 46, snow);
  // стены: два этажа
  wall(ctx, X + 6, Y + 34, W - 12, H - 34, b.wall, { eave: 16, r: 6, lw: 3 });
  // пояс между этажами
  ctx.fillStyle = '#fff8ec';
  ctx.fillRect(X + 8, Y + 126, W - 16, 7);
  line(ctx, X + 8, Y + 126, X + W - 8, Y + 126, 'rgba(74,55,40,.5)', 1.3);
  line(ctx, X + 8, Y + 133, X + W - 8, Y + 133, 'rgba(74,55,40,.5)', 1.3);
  // крыша: вальмовая, с черепицей
  roof(ctx, [X - 16, Y + 44, X + 52, Y - 40, X + W - 52, Y - 40, X + W + 16, Y + 44], b.roof, snow, { lw: 3 });
  // слуховые окна на крыше
  for (const dx of [-150, 150]) {
    gable(ctx, cx + dx - 26, cx + dx + 26, Y + 14, Y - 14, b.roof, snow, { rows: 8 });
    fillRR(ctx, cx + dx - 16, Y + 12, 32, 22, 3, '#fff8ec', OUT, 2);
    win(ctx, cx + dx - 11, Y + 15, 22, 16, lit, { sill: false });
  }
  // окна: по два с каждой стороны на каждом этаже
  const sh = '#3d9970';
  if (lit) for (const dx of [-176, -112, 112, 176]) glow(ctx, cx + dx, Y + 170, 46);
  for (const dx of [-176, -112, 112, 176]) {
    win(ctx, cx + dx - 17, Y + 62, 34, 50, lit, {
      arch: true,
      shutters: sh,
      curtain: lit ? null : 'rgba(255,255,255,.8)',
    });
    win(ctx, cx + dx - 17, Y + 148, 34, 54, lit, {
      arch: true,
      shutters: sh,
      box: true,
      snow,
      curtain: lit ? null : 'rgba(255,255,255,.8)',
    });
  }
  // портик: фронтон, колонны, балкон
  roof(ctx, [cx - 84, Y + 46, cx, Y - 16, cx + 84, Y + 46], '#fff8ec', false, { flat: true });
  ell(ctx, cx, Y + 20, 14, 14, lit ? LIT : '#cfeaff', OUT, 2);
  line(ctx, cx - 14, Y + 20, cx + 14, Y + 20, OUT, 1.3);
  line(ctx, cx, Y + 6, cx, Y + 34, OUT, 1.3);
  fillRR(ctx, cx - 88, Y + 44, 176, 10, 3, '#fff8ec', OUT, 2);
  // балконная дверь и балкон
  win(ctx, cx - 26, Y + 62, 52, 62, lit, { arch: true, curtain: lit ? null : 'rgba(255,255,255,.8)', sill: false });
  fillRR(ctx, cx - 62, Y + 120, 124, 9, 3, '#fff8ec', OUT, 2);
  for (let i = -5; i <= 5; i++) fillRR(ctx, cx + i * 11 - 2.2, Y + 100, 4.4, 21, 2, '#fff8ec', OUT, 1.2);
  fillRR(ctx, cx - 62, Y + 96, 124, 6, 3, '#fff8ec', OUT, 1.8);
  // колонны
  for (const dx of [-78, -52, 52, 78]) {
    fillRR(ctx, cx + dx - 7, Y + 54, 14, H - 62, 4, '#fff8ec', OUT, 2);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(cx + dx + 1, Y + 58, 4, H - 70);
    fillRR(ctx, cx + dx - 10, bot - 12, 20, 8, 2, '#fff8ec', OUT, 1.8);
    fillRR(ctx, cx + dx - 10, Y + 52, 20, 7, 2, '#fff8ec', OUT, 1.8);
  }
  // крыльцо и дверь
  fillRR(ctx, cx - 70, bot - 5, 140, 9, 3, '#e3e7ec', OUT, 2);
  fillRR(ctx, cx - 58, bot - 10, 116, 7, 3, '#f1f3f5', OUT, 2);
  door(ctx, cx, bot - 8, 56, 80, '#e8590c', { arch: true, double: true, frame: '#fff8ec' });
  wallLamp(ctx, cx - 40, bot - 66, lit);
  wallLamp(ctx, cx + 40, bot - 66, lit);
  // вьюнок по углам
  ivy(ctx, X + 16, bot - 10, 150, snow ? 'winter' : 'summer', 1);
  ivy(ctx, X + W - 16, bot - 10, 120, snow ? 'winter' : 'summer', -1);
}

// ================= ЛАВКИ =================
function barberPole(ctx, x, y, h) {
  fillRR(ctx, x - 5, y, 10, h, 4, '#fff', OUT, 1.6);
  ctx.save();
  rr(ctx, x - 5, y, 10, h, 4);
  ctx.clip();
  for (let i = -2; i < h / 7 + 2; i++) {
    ctx.fillStyle = i % 2 ? '#fa5252' : '#4dabf7';
    ctx.beginPath();
    ctx.moveTo(x - 6, y + i * 7 + 6);
    ctx.lineTo(x + 6, y + i * 7);
    ctx.lineTo(x + 6, y + i * 7 + 3.5);
    ctx.lineTo(x - 6, y + i * 7 + 9.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  fillRR(ctx, x - 5, y, 10, h, 4, null, OUT, 1.6);
  fillRR(ctx, x - 7, y - 5, 14, 6, 2, '#ced4da', OUT, 1.4);
  fillRR(ctx, x - 7, y + h - 1, 14, 6, 2, '#ced4da', OUT, 1.4);
  ell(ctx, x, y - 8, 4, 4, '#fff', OUT, 1.3);
}
function paintSalon(ctx, b, snow, lit) {
  const g = shopBody(ctx, b, snow, { roofH: 56 }),
    { X, W, bot, cx } = g,
    wh = bot - g.wy - 16;
  // витрина: зеркало в золотой раме и кресло
  showcase(ctx, X + 16, g.wy, 92, wh, lit, (c, x, y, w, h) => {
    ell(c, x + 26, y + h * 0.4, 17, 24, lit ? '#fffbe6' : '#eaf7ff', GOLD, 4);
    ell(c, x + 26, y + h * 0.4, 17, 24, null, OUT, 1.2);
    line(c, x + 18, y + h * 0.3, x + 26, y + h * 0.2, 'rgba(255,255,255,.9)', 3);
    // кресло
    fillRR(c, x + 54, y + h - 46, 26, 28, 6, '#f783ac', OUT, 1.5);
    fillRR(c, x + 50, y + h - 24, 34, 10, 4, '#e64980', OUT, 1.5);
    line(c, x + 67, y + h - 14, x + 67, y + h, OUT, 3);
    // лампочки вокруг зеркала
    for (let i = 0; i < 6; i++)
      ell(
        c,
        x + 26 + Math.cos((i * TAU) / 6) * 24,
        y + h * 0.4 + Math.sin((i * TAU) / 6) * 31,
        2.4,
        2.4,
        lit ? '#fff' : '#ffe9a0',
      );
  });
  door(ctx, cx + 42, bot, 34, 64, '#e64980', { glass: true, lit, frame: '#fff8ec' });
  barberPole(ctx, X + W - 18, bot - 76, 54);
  // сердечки-наклейки на стене
  for (const [dx, dy] of [
    [W - 24, g.wy - 8],
    [W - 40, g.wy + 6],
  ])
    emoji(ctx, '💗', X + dx, dy, 11);
  signBoard(ctx, title(b), cx, g.top + 28, W - 14, 26, 'plate', '#e64980');
  // ножницы над вывеской
  ctx.save();
  ctx.translate(cx, g.top - 4);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.rotate(s * 0.5);
    fillRR(ctx, -2.5, -22, 5, 24, 2, '#dee2e6', OUT, 1.4);
    ell(ctx, 0, 6, 5.5, 5.5, null, OUT, 4);
    ell(ctx, 0, 6, 5.5, 5.5, null, '#f783ac', 2);
    ctx.restore();
  }
  ell(ctx, 0, -4, 2, 2, OUT);
  ctx.restore();
}
function bow(ctx, x, y, s, col) {
  for (const d of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + d * 10 * s, y - 14 * s, x + d * 26 * s, y - 12 * s, x + d * 22 * s, y);
    ctx.bezierCurveTo(x + d * 26 * s, y + 12 * s, x + d * 10 * s, y + 14 * s, x, y);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.stroke();
    poly(ctx, [x, y + 2, x + d * 5 * s, y + 20 * s, x + d * 12 * s, y + 16 * s], shade(col, -0.12), OUT, 1.6);
  }
  ell(ctx, x, y, 6 * s, 7 * s, shade(col, 0.15), OUT, 2);
}
function paintBoutique(ctx, b, snow, lit) {
  const g = shopBody(ctx, b, snow, { roofH: 56 }),
    { X, W, bot, cx } = g,
    wh = bot - g.wy - 16;
  showcase(ctx, X + 14, g.wy, 100, wh, lit, (c, x, y, w, h) => {
    c.fillStyle = 'rgba(132,94,247,.16)';
    c.fillRect(x, y + h - 10, w, 10);
    mannequinIn(c, x + 28, y + h - 8, 1.25, '#ff8fab');
    mannequinIn(c, x + 70, y + h - 8, 1.1, '#ffd43b');
    // шляпка на подставке
    ell(c, x + 50, y + 22, 13, 4, '#845ef7', OUT, 1.2);
    fillRR(c, x + 43, y + 12, 14, 10, 4, '#845ef7', OUT, 1.2);
  });
  door(ctx, cx + 46, bot, 34, 64, '#fff8ec', { glass: true, lit, frame: '#845ef7', arch: true });
  wallLamp(ctx, X + W - 14, bot - 70, lit);
  signBoard(ctx, title(b), cx, g.top + 30, W - 14, 26, 'plate', '#845ef7');
  bow(ctx, cx, g.top - 2, 1.1, '#ff8fab');
}
function chalkboard(ctx, x, bot) {
  // меловая доска-раскладушка
  poly(ctx, [x - 13, bot, x - 10, bot - 36, x + 10, bot - 36, x + 13, bot], WOOD, OUT, 1.8);
  fillRR(ctx, x - 8.5, bot - 33, 17, 26, 2, '#2f4f3f', OUT, 1.2);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 5, bot - 28);
  ctx.lineTo(x + 5, bot - 28);
  ctx.moveTo(x - 5, bot - 13);
  ctx.lineTo(x + 3, bot - 13);
  ctx.moveTo(x - 5, bot - 10);
  ctx.lineTo(x + 5, bot - 10);
  ctx.stroke();
  // чашка мелом
  ctx.beginPath();
  ctx.moveTo(x - 4, bot - 24);
  ctx.lineTo(x - 3, bot - 17);
  ctx.lineTo(x + 3, bot - 17);
  ctx.lineTo(x + 4, bot - 24);
  ctx.closePath();
  ctx.stroke();
}
function bigCup(ctx, x, y, steam) {
  // чашка-вывеска на крыше
  ctx.beginPath();
  ctx.arc(x + 18, y - 12, 8, -1.2, 1.4);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  poly(ctx, [x - 18, y - 26, x + 18, y - 26, x + 13, y, x - 13, y], '#fff', OUT, 2.2);
  ell(ctx, x, y - 26, 18, 5, '#8d5524', OUT, 2);
  ell(ctx, x - 5, y - 27, 6, 1.6, 'rgba(255,255,255,.4)');
  emoji(ctx, '🌻', x, y - 12, 13);
  fillRR(ctx, x - 22, y - 1, 44, 5, 2.5, '#fff', OUT, 1.8);
  if (steam) {
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const dx of [-7, 2, 10]) {
      ctx.moveTo(x + dx, y - 34);
      ctx.bezierCurveTo(x + dx - 5, y - 40, x + dx + 5, y - 44, x + dx, y - 50);
    }
    ctx.stroke();
  }
}
function paintCafe(ctx, b, snow, lit) {
  const g = shopBody(ctx, b, snow, { roofH: 52 }),
    { X, W, bot, cx } = g,
    wh = bot - g.wy - 16;
  showcase(ctx, X + 14, g.wy, 96, wh, lit, (c, x, y, w, h) => {
    // полки с пирожными
    for (const [yy, items] of [
      [y + h * 0.48, ['#ff8fab', '#ffd43b', '#b197fc']],
      [y + h - 6, ['#8d5524', '#ff8fab', '#ffd43b']],
    ]) {
      c.fillStyle = WOOD_L;
      c.fillRect(x, yy, w, 4);
      c.fillStyle = 'rgba(74,55,40,.5)';
      c.fillRect(x, yy, w, 1.2);
      items.forEach((col, i) => cake(c, x + 18 + i * 30, yy, col));
    }
  });
  door(ctx, cx + 40, bot, 34, 64, '#d6336c', { glass: true, lit, frame: '#fff8ec' });
  chalkboard(ctx, X + W - 18, bot + 2);
  signBoard(ctx, title(b), cx - 14, g.top + 28, W - 62, 25, 'plate', '#d6336c');
  bigCup(ctx, X + W - 34, g.top + 14, !snow);
}
function nut(ctx, x, y, r) {
  // золотой орешек в медальоне
  ell(ctx, x, y, r, r, '#7a1f2b', OUT, 2);
  ell(ctx, x, y, r - 3.5, r - 3.5, null, GOLD, 1.5);
  ell(ctx, x, y + 2, r * 0.48, r * 0.56, GOLD, OUT, 1.4);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.1, r * 0.5, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#c98b5a';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  line(ctx, x, y - r * 0.6, x, y - r * 0.78, OUT, 2);
  ell(ctx, x - r * 0.16, y + r * 0.1, r * 0.1, r * 0.2, 'rgba(255,255,255,.7)');
}
function paintRest(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, H, bot, cx } = g;
  baseShadow(ctx, g);
  chimney(ctx, X + W - 70, Y - 34, 20, 44, snow);
  wall(ctx, X + 6, Y + 50, W - 12, H - 50, b.wall, { eave: 14, brick: true });
  roof(ctx, [X - 10, Y + 62, X + 30, Y - 22, X + W - 30, Y - 22, X + W + 10, Y + 62], b.roof, snow);
  // арочные окна: столики со свечами
  const inside = (x, y, w, h) => {
    fillRR(ctx, x + w / 2 - 16, y + h - 26, 32, 5, 2, '#fff', OUT, 1.2);
    line(ctx, x + w / 2, y + h - 21, x + w / 2, y + h, OUT, 2.5);
    fillRR(ctx, x + w / 2 - 2, y + h - 38, 4, 12, 1, '#fff8ec', OUT, 1);
    ell(ctx, x + w / 2, y + h - 42, 3, 5, '#ffa94d');
    if (lit) glow(ctx, x + w / 2, y + h - 42, 22, 0.7);
  };
  for (const dx of [-112, 112]) {
    if (lit) glow(ctx, cx + dx, Y + 150, 56);
    win(ctx, cx + dx - 34, Y + 96, 68, 104, lit, { arch: true, cross: false, curtain: '#a61e4d', lw: 2.2 });
    inside(cx + dx - 34, Y + 96, 68, 104);
    line(ctx, cx + dx, Y + 98, cx + dx, Y + 200, OUT, 1.4);
    fillRR(ctx, cx + dx - 38, Y + 199, 76, 9, 2, WOOD, OUT, 1.5);
    if (!snow) for (let i = 0; i < 5; i++) flower(ctx, cx + dx - 28 + i * 14, Y + 198, 3, i % 2 ? '#fa5252' : '#fff');
  }
  // вход: двустворчатая дверь, маркиза, меню на стойке
  steps(ctx, cx, bot, 64);
  door(ctx, cx, bot - 6, 58, 86, '#7a4a22', { arch: true, double: true, glass: true, lit, frame: GOLD });
  // маркиза над входом
  ctx.beginPath();
  ctx.moveTo(cx - 52, bot - 96);
  ctx.quadraticCurveTo(cx, bot - 132, cx + 52, bot - 96);
  ctx.lineTo(cx + 52, bot - 84);
  ctx.lineTo(cx - 52, bot - 84);
  ctx.closePath();
  ctx.fillStyle = '#a61e4d';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  awning(ctx, cx - 52, bot - 86, 104, 13, 8, GOLD, '#a61e4d');
  wallLamp(ctx, cx - 50, bot - 60, lit);
  wallLamp(ctx, cx + 50, bot - 60, lit);
  // меню на стойке
  line(ctx, cx + 62, bot + 2, cx + 62, bot - 26, OUT, 3);
  ell(ctx, cx + 62, bot + 2, 7, 2.5, '#495057', OUT, 1.2);
  fillRR(ctx, cx + 51, bot - 46, 22, 26, 2, '#fff8ec', OUT, 1.6);
  fitText(ctx, 'МЕНЮ', cx + 62, bot - 40, 18, 6, '#7a1f2b');
  for (let i = 0; i < 3; i++) line(ctx, cx + 55, bot - 33 + i * 4, cx + 69, bot - 33 + i * 4, '#c9b9a0', 1.2);
  // фонарики под карнизом и вывеска с орешком
  lanterns(ctx, X + 16, cx - 60, Y + 66, lit);
  lanterns(ctx, cx + 60, X + W - 16, Y + 66, lit);
  signBoard(ctx, b.name, cx, Y + 26, 216, 30, 'neon', GOLD, lit);
  nut(ctx, cx, Y - 12, 20);
}
function paintPool(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, bot, cx } = g;
  // вышка для прыжков — за зданием справа
  const tx = X + W - 30;
  for (const dx of [-12, 12]) {
    line(ctx, tx + dx, Y + 40, tx + dx, Y - 78, OUT, 5);
    line(ctx, tx + dx, Y + 40, tx + dx, Y - 78, '#e9ecef', 2.6);
  }
  for (let i = 0; i < 8; i++) line(ctx, tx - 12, Y + 30 - i * 14, tx + 12, Y + 30 - i * 14, OUT, 1.8);
  fillRR(ctx, tx - 18, Y - 84, 62, 8, 3, '#4dabf7', OUT, 2);
  fillRR(ctx, tx - 18, Y - 40, 50, 7, 3, '#ffd43b', OUT, 2);
  line(ctx, tx - 16, Y - 84, tx - 16, Y - 100, OUT, 2);
  line(ctx, tx + 14, Y - 84, tx + 14, Y - 100, OUT, 2);
  line(ctx, tx - 16, Y - 100, tx + 14, Y - 100, OUT, 2);
  const s = shopBody(ctx, b, snow, { roofH: 58, awning: false });
  // волна по стене
  ctx.save();
  ctx.beginPath();
  ctx.rect(X + 7, s.aw, W - 14, bot - s.aw - 2);
  ctx.clip();
  for (const [dy, col] of [
    [0, 'rgba(255,255,255,.85)'],
    [9, '#3bc9db'],
    [18, '#1098ad'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(X, bot);
    ctx.lineTo(X, bot - 52 + dy);
    for (let x = X; x < X + W; x += 30)
      (ctx.quadraticCurveTo(x + 7.5, bot - 64 + dy, x + 15, bot - 52 + dy),
        ctx.quadraticCurveTo(x + 22.5, bot - 40 + dy, x + 30, bot - 52 + dy));
    ctx.lineTo(X + W, bot);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // круглые окна-иллюминаторы
  for (const dx of [-84, 84]) {
    if (lit) glow(ctx, cx + dx, s.aw + 44, 34);
    ell(ctx, cx + dx, s.aw + 44, 20, 20, '#fff8ec', OUT, 2);
    ell(ctx, cx + dx, s.aw + 44, 14.5, 14.5, lit ? LIT : '#bfe8f7', OUT, 1.6);
    if (!lit) line(ctx, cx + dx - 8, s.aw + 46, cx + dx + 2, s.aw + 34, 'rgba(255,255,255,.9)', 3);
  }
  door(ctx, cx, bot, 62, 78, '#e3fafc', { double: true, glass: true, lit, frame: '#fff8ec' });
  bunting(ctx, X + 8, X + W - 8, s.aw + 6, 7);
  signBoard(ctx, title(b), cx - 16, s.top + 29, W - 60, 28, 'plate', '#0c8599');
  // спасательный круг
  ell(ctx, X + 30, bot - 34, 11, 11, '#fff', OUT, 1.8);
  ell(ctx, X + 30, bot - 34, 4.5, 4.5, b.wall, OUT, 1.4);
  ctx.fillStyle = '#fa5252';
  for (const a of [0, 1.57, 3.14, 4.71]) {
    ctx.save();
    ctx.translate(X + 30, bot - 34);
    ctx.rotate(a);
    ctx.fillRect(-2.6, -10.4, 5.2, 5.4);
    ctx.restore();
  }
}
function thatch(ctx, pts, snow) {
  // соломенная крыша: тёплая, с прядями и бахромой по краю
  roof(ctx, pts, snow ? '#fff' : '#e3b866', false, { flat: true });
  let y0 = 1e9,
    y1 = -1e9,
    x0 = 1e9,
    x1 = -1e9;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = snow ? 'rgba(170,200,225,.7)' : 'rgba(150,100,30,.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const mid = (x0 + x1) / 2;
  for (let x = x0; x < x1; x += 7) {
    const top = mid + (x - mid) * 0.72;
    for (let k = 0; k < 3; k++) {
      const a = (k + ((x * 3) % 5) / 5) / 3.4,
        b2 = a + 0.2;
      ctx.moveTo(top + (x - top) * a, y0 + (y1 - y0) * a);
      ctx.lineTo(top + (x - top) * b2, y0 + (y1 - y0) * b2);
    }
  }
  ctx.stroke();
  ctx.restore();
  // бахрома
  if (!snow) {
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.2;
    ctx.fillStyle = '#d4a04c';
    for (let x = x0 + 4; x < x1 - 4; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x - 4, y1 - 1);
      ctx.lineTo(x, y1 + 7);
      ctx.lineTo(x + 4, y1 - 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  poly(ctx, pts, null, OUT, 2.5);
}
function bamboo(ctx, x, y, w, h, col) {
  fillRR(ctx, x, y, w, h, 3, col, OUT, 2.2);
  ctx.strokeStyle = 'rgba(74,55,40,.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let xx = x + 10; xx < x + w - 2; xx += 10) {
    ctx.moveTo(xx, y + 2);
    ctx.lineTo(xx, y + h - 2);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(74,55,40,.25)';
  for (let xx = x + 2; xx < x + w - 6; xx += 10) ctx.fillRect(xx, y + ((xx * 7) % (h - 12)) + 4, 7, 1.4);
}
function surfboard(ctx, x, bot, col, lean) {
  ctx.save();
  ctx.translate(x, bot);
  ctx.rotate(lean);
  ell(ctx, 0, -32, 8, 32, col, OUT, 1.8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-1.5, -60, 3, 56);
  ell(ctx, 0, -44, 4, 4, '#fff', null);
  ctx.restore();
}
function drink(ctx, x, bot, col) {
  poly(ctx, [x - 5, bot - 14, x + 5, bot - 14, x + 3.5, bot, x - 3.5, bot], col, OUT, 1.1);
  line(ctx, x + 1, bot - 14, x + 5, bot - 22, OUT, 1.2);
  ell(ctx, x - 4, bot - 16, 3, 3, '#ffd43b', OUT, 0.9);
}
function paintBeachCafe(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, bot, cx } = g;
  baseShadow(ctx, g);
  surfboard(ctx, X + W - 10, bot, '#ff8fab', 0.14);
  surfboard(ctx, X + W + 6, bot + 2, '#4dabf7', 0.26);
  bamboo(ctx, X + 8, Y + 44, W - 16, bot - Y - 44, snow ? '#d9efe6' : b.wall);
  // окна-прилавки по бокам от входа
  for (const sx of [-1, 1]) {
    const x = sx < 0 ? X + 18 : cx + 24;
    const w = cx - 24 - (X + 18);
    showcase(ctx, x, Y + 62, w, 42, lit, (c, xx, yy, ww, hh) => {
      for (let i = 0; i < 3; i++)
        drink(
          c,
          xx + 14 + i * ((ww - 28) / 2),
          yy + hh - 2,
          ['#ff922b', '#f783ac', '#63e6be'][(i + (sx > 0 ? 1 : 0)) % 3],
        );
    });
    fillRR(ctx, x - 6, Y + 104, w + 12, 9, 2, WOOD, OUT, 1.8);
    awning(ctx, x - 4, Y + 50, w + 8, 14, 6, b.roof);
  }
  // вход: занавеска из бусин
  fillRR(ctx, cx - 18, bot - 74, 36, 74, 4, lit ? '#ffe9a0' : '#3d5a52', OUT, 2.2);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 7; j++)
      ell(
        ctx,
        cx - 13 + i * 6.5,
        bot - 68 + j * 8 + (i % 2) * 4,
        2,
        2.6,
        ['#ffd43b', '#ff8fab', '#63e6be'][(i + j) % 3],
      );
  thatch(ctx, [X - 14, Y + 50, X + 34, Y - 26, X + W - 34, Y - 26, X + W + 14, Y + 50], snow);
  signBoard(ctx, title(b), cx, Y + 10, 170, 26, 'wood');
  lanterns(ctx, X + 4, X + W - 4, Y + 56, lit);
}

// ================= ТЦ, БОЛЬНИЦА, ШКОЛА =================
const MALL_WINDOWS = {
  fashion: [
    (c, x, y, w, h) => {
      dress(c, x + w * 0.27, y + 6, 1.5, '#ff6b9d');
      dress(c, x + w * 0.73, y + 12, 1.3, '#845ef7');
    },
    (c, x, y, w, h) => {
      mannequinIn(c, x + w * 0.3, y + h - 6, 1.3, '#ffd43b');
      // сумочка и туфелька на тумбе
      fillRR(c, x + w * 0.56, y + h - 26, w * 0.36, 20, 3, '#fff8ec', OUT, 1.2);
      fillRR(c, x + w * 0.62, y + h - 44, 18, 15, 4, '#f783ac', OUT, 1.3);
      c.beginPath();
      c.arc(x + w * 0.62 + 9, y + h - 44, 6, Math.PI, 0);
      c.strokeStyle = OUT;
      c.lineWidth = 1.5;
      c.stroke();
    },
  ],
  home: [
    (c, x, y, w, h) => {
      // диван и картина
      fillRR(c, x + 8, y + h - 34, w - 16, 22, 6, '#ff8787', OUT, 1.5);
      fillRR(c, x + 4, y + h - 26, 14, 20, 5, '#fa5252', OUT, 1.5);
      fillRR(c, x + w - 18, y + h - 26, 14, 20, 5, '#fa5252', OUT, 1.5);
      fillRR(c, x + 14, y + h - 14, w - 28, 10, 3, '#fa5252', OUT, 1.5);
      fillRR(c, x + w * 0.3, y + 12, w * 0.4, 26, 2, '#fff', WOOD, 3);
      ell(c, x + w * 0.5, y + 28, 7, 5, '#ffd43b');
    },
    (c, x, y, w, h) => {
      // торшер и кресло, комод с вазой
      line(c, x + 20, y + h - 4, x + 20, y + 36, OUT, 2.5);
      poly(c, [x + 8, y + 36, x + 32, y + 36, x + 26, y + 14, x + 14, y + 14], '#ffe066', OUT, 1.5);
      fillRR(c, x + w * 0.46, y + h - 30, w * 0.46, 26, 3, WOOD_L, OUT, 1.5);
      line(c, x + w * 0.46, y + h - 17, x + w * 0.92, y + h - 17, OUT, 1.2);
      ell(c, x + w * 0.7, y + h - 38, 6, 8, '#74c0fc', OUT, 1.3);
      flower(c, x + w * 0.7, y + h - 50, 3.5, '#ff8fab');
    },
  ],
  food: [
    (c, x, y, w, h) => {
      c.fillStyle = WOOD_L;
      c.fillRect(x, y + h - 10, w, 10);
      pile(c, x + w * 0.28, y + h - 10, 3, 7, ['#fa5252', '#ff8787']);
      pile(c, x + w * 0.72, y + h - 10, 3, 7, ['#ff922b', '#ffa94d']);
      // связка бананов сверху
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(x + w * 0.5 + i * 4 - 4, y + 10, 12, 0.3, 1.9);
        c.strokeStyle = OUT;
        c.lineWidth = 5;
        c.stroke();
        c.strokeStyle = '#ffd43b';
        c.lineWidth = 3;
        c.stroke();
      }
    },
    (c, x, y, w, h) => {
      c.fillStyle = WOOD_L;
      c.fillRect(x, y + h - 10, w, 10);
      // хлеб, сыр, зелень, бутылка молока
      ell(c, x + w * 0.24, y + h - 18, 13, 8, '#e8a85c', OUT, 1.4);
      for (const dx of [-5, 0, 5])
        line(c, x + w * 0.24 + dx, y + h - 23, x + w * 0.24 + dx + 3, y + h - 16, '#b9772f', 1.2);
      poly(c, [x + w * 0.46, y + h - 10, x + w * 0.68, y + h - 10, x + w * 0.68, y + h - 26], '#ffd43b', OUT, 1.4);
      ell(c, x + w * 0.62, y + h - 15, 2, 2, '#f59f00');
      fillRR(c, x + w * 0.78, y + h - 36, 12, 26, 3, '#fff', OUT, 1.4);
      fillRR(c, x + w * 0.78 + 3, y + h - 42, 6, 7, 2, '#4dabf7', OUT, 1.2);
      pile(c, x + w * 0.5, y + 34, 2, 6, ['#51cf66', '#94d82d']);
    },
  ],
};
function mallBody(ctx, b, snow, lit, o = {}) {
  const s = shopBody(ctx, b, snow, { roofH: 62, up: 14, ...o }),
    { X, W, bot, cx } = s;
  // верхний ряд окон
  const n = 4,
    ww = 34;
  for (let i = 0; i < n; i++) {
    const x = X + 26 + (i * (W - 52 - ww)) / (n - 1);
    win(ctx, x, s.aw + 28, ww, 30, lit, { cross: true, r: 3 });
  }
  return s;
}
function paintMall(ctx, b, snow, lit) {
  const s = mallBody(ctx, b, snow, lit),
    { X, W, bot, cx } = s;
  const wy = s.aw + 76,
    wh = bot - wy - 16,
    ww = W * 0.29;
  const scenes = MALL_WINDOWS[b.theme] || [];
  if (lit) {
    glow(ctx, X + 20 + ww / 2, wy + wh / 2, 70, 0.3);
    glow(ctx, X + W - 20 - ww / 2, wy + wh / 2, 70, 0.3);
  }
  showcase(ctx, X + 20, wy, ww, wh, lit, scenes[0]);
  showcase(ctx, X + W - 20 - ww, wy, ww, wh, lit, scenes[1]);
  // стеклянные двери под козырьком
  door(ctx, cx, bot, 72, wh + 14, '#eef9ff', { double: true, glass: true, lit, frame: '#fff8ec' });
  fillRR(ctx, cx - 50, wy - 12, 100, 12, 4, shade(b.roof, -0.1), OUT, 2);
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  ctx.fillRect(cx - 47, wy - 10, 94, 3);
  // вывеска во всю крышу и значок над ней
  signBoard(ctx, b.name, cx, s.top + 34, W - 40, 34, 'plate', shade(b.roof, -0.18));
  const ey = s.top - 8;
  poly(
    ctx,
    [cx - 44, s.top + 3, cx - 26, ey - 16, cx + 26, ey - 16, cx + 44, s.top + 3],
    snow ? '#fff' : b.roof,
    OUT,
    2.5,
  );
  ell(ctx, cx, ey - 12, 22, 22, '#fff8ec', OUT, 2.5);
  emoji(ctx, b.icon, cx, ey - 12, 24);
}
function paintHospital(ctx, b, snow, lit) {
  const s = mallBody(ctx, b, snow, lit, { awning: false, roofH: 46 }),
    { X, W, bot, cx } = s;
  // голубая полоса и нижний ряд окон
  ctx.fillStyle = '#74c0fc';
  ctx.fillRect(X + 7, s.aw + 66, W - 14, 7);
  const wy = s.aw + 88,
    wh = bot - wy - 30;
  for (const dx of [-124, -76, 76, 124]) {
    if (lit) glow(ctx, cx + dx, wy + wh / 2, 34, 0.3);
    win(ctx, cx + dx - 17, wy, 34, wh, lit, { r: 3 });
  }
  // вход с козырьком и крестами на дверях
  door(ctx, cx, bot, 70, wh + 36, '#eef9ff', { double: true, glass: true, lit, frame: '#fff' });
  fillRR(ctx, cx - 52, wy - 14, 104, 13, 4, '#fa5252', OUT, 2);
  for (const dx of [-18, 18]) {
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(cx + dx - 2, bot - 28, 4, 12);
    ctx.fillRect(cx + dx - 6, bot - 24, 12, 4);
  }
  signBoard(ctx, b.name.toUpperCase(), cx, s.top + 26, 170, 26, 'plate', '#fa5252');
  // большой красный крест на крыше
  ell(ctx, cx, s.top - 22, 27, 27, '#fff', OUT, 2.5);
  ctx.fillStyle = '#fa5252';
  ctx.fillRect(cx - 6.5, s.top - 41, 13, 38);
  ctx.fillRect(cx - 19, s.top - 28.5, 38, 13);
  if (lit) glow(ctx, cx, s.top - 22, 44, 0.35);
}
function paintSchool(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, H, bot, cx } = g;
  baseShadow(ctx, g);
  wall(ctx, X + 6, Y + 44, W - 12, H - 44, b.wall, { eave: 14, brick: true });
  roof(ctx, [X - 10, Y + 56, X + 34, Y - 16, X + W - 34, Y - 16, X + W + 10, Y + 56], b.roof, snow);
  // башенка с колоколом
  fillRR(ctx, cx - 20, Y - 62, 40, 50, 3, '#fff8ec', OUT, 2.2);
  fillRR(ctx, cx - 13, Y - 54, 26, 32, 12, '#5b4636', OUT, 1.8);
  // колокол
  ctx.beginPath();
  ctx.moveTo(cx - 9, Y - 28);
  ctx.quadraticCurveTo(cx - 8, Y - 46, cx, Y - 47);
  ctx.quadraticCurveTo(cx + 8, Y - 46, cx + 9, Y - 28);
  ctx.closePath();
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ell(ctx, cx, Y - 26, 3, 3, '#f59f00', OUT, 1.2);
  gable(ctx, cx - 30, cx + 30, Y - 60, Y - 92, b.roof, snow, { rows: 8 });
  // фронтон с часами
  gable(ctx, cx - 70, cx + 70, Y + 58, Y - 6, b.roof, snow);
  ell(ctx, cx, Y + 30, 19, 19, '#fff', OUT, 2.4);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    line(
      ctx,
      cx + Math.cos(a) * 14,
      Y + 30 + Math.sin(a) * 14,
      cx + Math.cos(a) * 16.5,
      Y + 30 + Math.sin(a) * 16.5,
      OUT,
      i % 3 ? 1 : 2,
    );
  }
  line(ctx, cx, Y + 30, cx, Y + 18, OUT, 2.4);
  line(ctx, cx, Y + 30, cx + 9, Y + 34, '#fa5252', 2);
  ell(ctx, cx, Y + 30, 2, 2, OUT);
  // окна в два ряда
  for (const dx of [-124, -78, 78, 124]) {
    if (lit) glow(ctx, cx + dx, Y + 200, 36, 0.3);
    win(ctx, cx + dx - 17, Y + 84, 34, 44, lit, { r: 3 });
    win(ctx, cx + dx - 17, Y + 168, 34, 58, lit, { r: 3 });
  }
  steps(ctx, cx, bot, 70);
  door(ctx, cx, bot - 6, 60, 88, '#a85f42', { arch: true, double: true, frame: '#fff8ec' });
  signBoard(ctx, b.name.toUpperCase(), cx, Y + 78, 110, 24, 'wood');
  // буквы и цифры на стене
  for (const [ch, dx, dy, col] of [
    ['А', -44, 142, '#fa5252'],
    ['Б', 44, 142, '#4dabf7'],
    ['2', -46, 196, '#51a36a'],
    ['3', 46, 196, '#f59f00'],
  ])
    fitText(ctx, ch, cx + dx, Y + dy, 20, 17, col, '#fff');
}

// ================= НЕБОСКРЁБЫ =================
function paintTowerFashion(ctx, b, snow, lit) {
  const s = towerBody(ctx, b, snow, lit),
    { X, W, bot, cx, top } = s;
  // афиши на фасаде
  for (const [dx, col, dc] of [
    [-44, '#fff0f6', '#e64980'],
    [44, '#f3f0ff', '#845ef7'],
  ]) {
    fillRR(ctx, cx + dx - 17, top + 46, 34, 84, 3, col, OUT, 1.8);
    mannequinIn(ctx, cx + dx, top + 122, 1.05, dc);
    emoji(ctx, '⭐', cx + dx, top + 56, 9);
  }
  // корона-парапет и туфелька
  const cy = top - 10;
  poly(
    ctx,
    [
      X + 14,
      cy,
      X + 14,
      cy - 18,
      X + 40,
      cy - 8,
      cx - 22,
      cy - 26,
      cx,
      cy - 10,
      cx + 22,
      cy - 26,
      X + W - 40,
      cy - 8,
      X + W - 14,
      cy - 18,
      X + W - 14,
      cy,
    ],
    snow ? '#fff' : '#ffd43b',
    OUT,
    2.2,
  );
  if (lit) glow(ctx, cx, cy - 46, 40, 0.5);
  ell(ctx, cx, cy - 46, 24, 24, lit ? '#fff0f6' : '#fff', OUT, 2.5);
  ell(ctx, cx, cy - 46, 19, 19, null, '#e64980', 2);
  emoji(ctx, '👠', cx, cy - 46, 24);
  // вход: розовый козырёк, красная дорожка-подиум и столбики
  poly(ctx, [cx - 26, bot - 2, cx + 26, bot - 2, cx + 34, bot + 10, cx - 34, bot + 10], '#e03131', OUT, 1.8);
  door(ctx, cx, bot, 50, 56, '#fff0f6', { double: true, glass: true, lit, frame: '#fff' });
  fillRR(ctx, cx - 38, bot - 70, 76, 13, 6, '#e64980', OUT, 2);
  for (const dx of [-38, 38]) {
    line(ctx, cx + dx, bot + 6, cx + dx, bot - 14, OUT, 4);
    line(ctx, cx + dx, bot + 6, cx + dx, bot - 14, GOLD, 2);
    ell(ctx, cx + dx, bot - 16, 3.5, 3.5, GOLD, OUT, 1.2);
  }
  signBoard(ctx, title(b), cx, bot - 90, W + 10, 22, 'neon', '#ff8fab', lit);
}
function paintTowerHamster(ctx, b, snow, lit) {
  const s = towerBody(ctx, b, snow, lit),
    { X, W, bot, cx, top } = s;
  // смотровая площадка: «тарелка» с окнами и перилами
  const dy = top - 6;
  ctx.beginPath();
  ctx.moveTo(X + 16, dy);
  ctx.lineTo(X - 14, dy - 22);
  ctx.lineTo(X + W + 14, dy - 22);
  ctx.lineTo(X + W - 16, dy);
  ctx.closePath();
  ctx.fillStyle = shade(b.wall, -0.25);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  fillRR(ctx, X - 18, dy - 50, W + 36, 30, 8, lit ? LIT : '#d6f0ff', OUT, 2.5);
  for (let x = X - 6; x < X + W + 10; x += 20) line(ctx, x, dy - 50, x, dy - 20, OUT, 1.5);
  if (!lit) {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(X - 12, dy - 46, W * 0.4, 5);
  }
  fillRR(ctx, X - 22, dy - 56, W + 44, 9, 4, snow ? '#fff' : '#fff8ec', OUT, 2.2);
  if (lit) glow(ctx, cx, dy - 36, 110, 0.22);
  // купол и шпиль
  ctx.beginPath();
  ctx.ellipse(cx, dy - 56, 46, 30, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = snow ? '#fff' : shade(b.wall, -0.12);
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx - 12, dy - 68, 18, 9, -0.3, Math.PI, 0);
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
  line(ctx, cx, dy - 86, cx, dy - 128, OUT, 5);
  line(ctx, cx, dy - 86, cx, dy - 128, '#ced4da', 2.4);
  line(ctx, cx - 10, dy - 104, cx + 10, dy - 104, OUT, 2.4);
  ell(ctx, cx, dy - 130, 5, 5, '#7a1f1f', OUT, 1.5);
  // подзорная труба на площадке
  emoji(ctx, '🔭', X + W + 4, dy - 60, 18);
  door(ctx, cx, bot, 50, 56, '#e7f5ff', { double: true, glass: true, lit, frame: '#fff' });
  fillRR(ctx, cx - 36, bot - 68, 72, 11, 5, shade(b.wall, -0.3), OUT, 2);
  signBoard(ctx, title(b), cx, bot - 88, W + 26, 23, 'plate', '#1c7ed6');
}
function paintBank(ctx, b, snow, lit) {
  const s = towerBody(ctx, b, snow, lit),
    { X, W, bot, cx, top } = s;
  // большая золотая монета на крыше
  const my = top - 40;
  if (lit) glow(ctx, cx, my, 48, 0.45);
  fillRR(ctx, cx - 6, top - 14, 12, 10, 2, '#adb5bd', OUT, 1.6);
  ell(ctx, cx + 2, my + 1.5, 28, 28, '#c98a00', OUT, 2.5);
  ell(ctx, cx, my, 28, 28, GOLD, OUT, 2.5);
  ell(ctx, cx, my, 22, 22, null, '#f59f00', 2);
  emoji(ctx, '🌻', cx, my, 26);
  ell(ctx, cx - 12, my - 14, 7, 3.5, 'rgba(255,255,255,.7)', null, 1, -0.6);
  // портик: ступени, колонны, фронтон
  const ph = 92,
    py = bot - ph;
  fillRR(ctx, X - 8, bot - 6, W + 16, 10, 3, '#e3e7ec', OUT, 2);
  fillRR(ctx, X - 2, bot - 12, W + 4, 8, 3, '#f1f3f5', OUT, 2);
  fillRR(ctx, X + 12, py + 22, W - 24, ph - 34, 2, shade(b.wall, -0.3), OUT, 2);
  door(ctx, cx, bot - 12, 44, 54, '#8d6e53', { arch: true, double: true, frame: GOLD });
  for (let i = 0; i < 4; i++) {
    const x = X + 16 + (i * (W - 32 - 16)) / 3;
    fillRR(ctx, x, py + 26, 16, ph - 38, 4, '#fff8ec', OUT, 2);
    ctx.fillStyle = 'rgba(0,0,0,.09)';
    ctx.fillRect(x + 9, py + 28, 4, ph - 44);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(x + 5, py + 30, 1.3, ph - 48);
    fillRR(ctx, x - 3, py + 22, 22, 7, 2, '#fff8ec', OUT, 1.8);
    fillRR(ctx, x - 3, bot - 19, 22, 8, 2, '#fff8ec', OUT, 1.8);
  }
  fillRR(ctx, X - 2, py + 2, W + 4, 22, 3, '#fff8ec', OUT, 2.2);
  fitText(ctx, 'ХОМЯК-БАНК', cx, py + 13, W - 14, 14, '#8a6d00');
  poly(ctx, [X - 8, py + 3, cx, py - 34, X + W + 8, py + 3], snow ? '#fff' : '#fff8ec', OUT, 2.5);
  ell(ctx, cx, py - 10, 9, 9, GOLD, OUT, 1.8);
  fitText(ctx, '₽', cx, py - 10, 12, 11, '#8a6d00');
}

// ================= РЫНОК =================
function stall(ctx, x, y, w, bot, col, goods, snow) {
  // столбики
  for (const px of [x + 4, x + w - 4]) {
    line(ctx, px, bot, px, y + 20, OUT, 5);
    line(ctx, px, bot, px, y + 20, WOOD_L, 2.6);
  }
  // задняя стенка с товаром на полке
  fillRR(ctx, x + 4, y + 34, w - 8, bot - y - 70, 2, '#fff3d6', OUT, 1.8);
  // прилавок
  fillRR(ctx, x - 2, bot - 42, w + 4, 40, 3, WOOD, OUT, 2.2);
  ctx.fillStyle = 'rgba(0,0,0,.12)';
  for (let xx = x + 12; xx < x + w; xx += 16) ctx.fillRect(xx, bot - 40, 1.4, 36);
  fillRR(ctx, x - 5, bot - 46, w + 10, 8, 2, WOOD_L, OUT, 2);
  // товар горками
  const n = goods.length;
  goods.forEach((cols, i) => pile(ctx, x + (w * (i + 0.5)) / n, bot - 46, 3, 6.2, cols));
  // навес
  awning(ctx, x - 8, y + 2, w + 16, 34, Math.round(w / 15), snow ? '#fff' : col, snow ? '#e9f2f8' : '#fff');
  fillRR(ctx, x - 10, y - 4, w + 20, 9, 4, snow ? '#fff' : shade(col, -0.15), OUT, 2);
}
function paintMarket(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, bot, cx } = g;
  baseShadow(ctx, g);
  const sw = (W - 80) / 2;
  stall(
    ctx,
    X + 8,
    Y - 14,
    sw - 8,
    bot,
    '#fa5252',
    [
      ['#fa5252', '#ff8787'],
      ['#ff922b', '#ffa94d'],
      ['#51cf66', '#94d82d'],
    ],
    snow,
  );
  stall(
    ctx,
    X + W - sw,
    Y - 14,
    sw - 8,
    bot,
    '#12b886',
    [
      ['#ffd43b', '#ffe066'],
      ['#b197fc', '#e599f7'],
      ['#ff8fab', '#fa5252'],
    ],
    snow,
  );
  // ценники
  for (const [x, tx] of [
    [X + 30, '40'],
    [X + W - 36, '60'],
  ]) {
    fillRR(ctx, x - 9, bot - 76, 18, 12, 2, '#fff', OUT, 1.2);
    fitText(ctx, tx, x, bot - 70, 14, 8, '#e03131');
  }
  // ворота рынка: два столба с вывеской, весы и корзина
  for (const dx of [-34, 34]) {
    fillRR(ctx, cx + dx - 5, Y - 6, 10, bot - Y + 6, 3, WOOD_D, OUT, 2);
    ell(ctx, cx + dx, Y - 8, 7, 4, WOOD, OUT, 1.6);
  }
  if (lit) glow(ctx, cx, bot - 30, 46, 0.4);
  lanterns(ctx, cx - 30, cx + 30, Y + 44, lit);
  signBoard(ctx, title(b), cx, Y + 14, 108, 30, 'wood');
  bunting(ctx, X + 6, cx - 44, Y - 12, 3);
  bunting(ctx, cx + 44, X + W - 6, Y - 12, 3);
}

// ================= НОВЫЕ ЗДАНИЯ: агентство, жилой дом, бунгало, отель =================
function miniHouse(ctx, x, y, s, col) {
  fillRR(ctx, x - 7 * s, y - 6 * s, 14 * s, 12 * s, 1, '#fff8ec', OUT, 1);
  poly(ctx, [x - 9 * s, y - 6 * s, x, y - 15 * s, x + 9 * s, y - 6 * s], col, OUT, 1);
  ctx.fillStyle = OUT;
  ctx.fillRect(x - 2 * s, y, 4 * s, 6 * s);
}
function paintRealtor(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, H, bot, cx } = g;
  baseShadow(ctx, g);
  wall(ctx, X + 10, Y + 78, W - 20, H - 78, b.wall, { siding: 9, eave: 14 });
  gable(ctx, X - 6, X + W + 6, Y + 88, Y - 30, b.roof, snow);
  // значок: домик с ключом
  ell(ctx, cx, Y + 34, 24, 24, '#fff8ec', OUT, 2.2);
  miniHouse(ctx, cx - 4, Y + 38, 1.25, '#fa5252');
  emoji(ctx, '🔑', cx + 10, Y + 42, 14);
  // витрина с объявлениями
  showcase(ctx, X + 22, Y + 110, 104, 56, lit, (c, x, y) => {
    [
      ['#fa5252', '25 000'],
      ['#4dabf7', '45 000'],
      ['#f59f00', '60 000'],
    ].forEach(([col, price], i) => {
      fillRR(c, x + 5 + i * 33, y + 6, 28, 44, 2, '#fff', OUT, 1.1);
      miniHouse(c, x + 19 + i * 33, y + 26, 0.9, col);
      fitText(c, price, x + 19 + i * 33, y + 42, 24, 6.5, '#2f9e44');
    });
  });
  door(ctx, cx + 62, bot, 36, 66, shade(b.roof, -0.05), { glass: true, lit, frame: '#fff8ec' });
  wallLamp(ctx, cx + 92, bot - 62, lit);
  signBoard(ctx, title(b), cx, Y + 92, W - 30, 24, 'plate', '#5c940d');
  // табличка «Продаётся» у крыльца
  line(ctx, X + 4, bot + 4, X + 4, bot - 26, OUT, 3);
  fillRR(ctx, X - 16, bot - 44, 40, 20, 3, '#fff', OUT, 1.6);
  fitText(ctx, 'ПРОДАЁТСЯ', X + 4, bot - 34, 34, 6.5, '#e03131');
}
function balcony(ctx, x, y, w, snow, laundry) {
  fillRR(ctx, x - 4, y + 12, w + 8, 5, 2, '#fff8ec', OUT, 1.6);
  for (let i = 0; i <= 4; i++) line(ctx, x - 2 + (i * (w + 4)) / 4, y, x - 2 + (i * (w + 4)) / 4, y + 12, OUT, 1.6);
  line(ctx, x - 4, y, x + w + 4, y, OUT, 2.4);
  if (laundry && !snow) {
    fillRR(ctx, x + 2, y + 1, 9, 10, 1, '#ff8fab', OUT, 1);
    fillRR(ctx, x + 14, y + 1, 11, 8, 1, '#74c0fc', OUT, 1);
  } else if (!snow)
    for (let i = 0; i < 3; i++) flower(ctx, x + 5 + (i * (w - 10)) / 2, y - 2, 2.6, ['#ff6b9d', '#ffd43b', '#fff'][i]);
}
function paintApartment(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 84;
  baseShadow(ctx, g);
  wall(ctx, X + 6, top, W - 12, bot - top, b.wall, { eave: 0, brick: true, r: 4 });
  // водосточная труба
  line(ctx, X + W - 14, top + 8, X + W - 14, bot - 4, OUT, 5);
  line(ctx, X + W - 14, top + 8, X + W - 14, bot - 4, '#adb5bd', 2.6);
  // карниз-крыша с черепицей, бак и антенна
  fillRR(ctx, X + 34, top - 36, 30, 26, 3, '#74c0fc', OUT, 2);
  line(ctx, X + 34, top - 24, X + 64, top - 24, OUT, 1.3);
  line(ctx, X + W - 60, top - 10, X + W - 60, top - 50, OUT, 2);
  line(ctx, X + W - 70, top - 44, X + W - 50, top - 44, OUT, 2);
  line(ctx, X + W - 66, top - 36, X + W - 54, top - 36, OUT, 2);
  roof(ctx, [X - 4, top + 12, X + 6, top - 12, X + W - 6, top - 12, X + W + 4, top + 12], b.roof, snow, {
    rows: 8,
    snowKeep: 0.4,
  });
  // три этажа окон
  const cols = [-96, -34, 34, 96];
  for (let f = 0; f < 3; f++) {
    const y = top + 30 + f * 96;
    for (const dx of cols) {
      if (f === 2 && Math.abs(dx) < 40) continue; // внизу по центру — вход
      const on = lit && (f * 7 + dx) % 3 !== 0;
      if (on) glow(ctx, cx + dx, y + 24, 30, 0.3);
      win(ctx, cx + dx - 16, y, 32, 44, on, {
        r: 3,
        curtain: on ? null : ['#ffd8a8', '#d0ebff', '#ffc9de'][(f + Math.abs(dx)) % 3],
      });
      if (f < 2) balcony(ctx, cx + dx - 16, y + 34, 32, snow, (f + dx) % 4 === 0);
      else if (!snow) fillRR(ctx, cx + dx - 18, y + 46, 36, 6, 2, WOOD, OUT, 1.3);
    }
  }
  // вход: козырёк, дверь, номер дома
  steps(ctx, cx, bot, 56);
  door(ctx, cx, bot - 6, 50, 76, '#7a4a22', { double: true, glass: true, lit, frame: '#fff8ec' });
  poly(ctx, [cx - 42, bot - 86, cx - 34, bot - 100, cx + 34, bot - 100, cx + 42, bot - 86], b.roof, OUT, 2);
  wallLamp(ctx, cx - 40, bot - 60, lit);
  signBoard(ctx, title(b), cx, bot - 116, 120, 22, 'plate', shade(b.roof, -0.1));
}
function paintBungalow(ctx, b, snow, lit) {
  const g = geom(b),
    { X, Y, W, bot, cx } = g;
  baseShadow(ctx, g);
  // сваи и настил
  for (let x = X + 16; x < X + W - 8; x += 34) fillRR(ctx, x, bot - 14, 8, 14, 2, WOOD_D, OUT, 1.6);
  surfboard(ctx, X + 20, bot - 8, '#ffd43b', -0.12);
  bamboo(ctx, X + 12, Y + 42, W - 24, bot - Y - 54, snow ? '#f4e4cf' : b.wall);
  fillRR(ctx, X + 4, bot - 18, W - 8, 9, 3, WOOD_L, OUT, 2);
  // окно со ставнями и дверь
  if (lit) glow(ctx, X + 74, Y + 84, 34);
  win(ctx, X + 54, Y + 66, 40, 34, lit, { shutters: '#4dabf7', box: true, snow });
  win(ctx, X + W - 86, Y + 66, 30, 34, lit, { shutters: '#4dabf7' });
  door(ctx, cx, bot - 16, 34, 62, '#4dabf7', { arch: true, frame: '#fff8ec' });
  // перила крыльца
  for (const sx of [-1, 1]) {
    const x0 = cx + sx * 24,
      x1 = sx < 0 ? X + 8 : X + W - 8;
    line(ctx, x0, bot - 34, x1, bot - 34, OUT, 4);
    line(ctx, x0, bot - 34, x1, bot - 34, '#fff8ec', 2);
    for (let x = Math.min(x0, x1) + 6; x < Math.max(x0, x1); x += 14) line(ctx, x, bot - 34, x, bot - 18, OUT, 2);
  }
  thatch(ctx, [X - 12, Y + 52, cx, Y - 44, X + W + 12, Y + 52], snow);
  // гирлянда из ракушек и табличка
  for (let i = 0; i < 7; i++) {
    const x = X + 34 + i * ((W - 68) / 6);
    ell(ctx, x, Y + 60 + (i % 2) * 3, 3.4, 3, i % 2 ? '#ffd8e4' : '#fff', OUT, 1);
  }
  signBoard(ctx, title(b), cx, Y + 22, 120, 24, 'wood');
  ell(ctx, cx, Y - 8, 9, 9, '#fff', OUT, 1.6);
  emoji(ctx, '🐚', cx, Y - 8, 11);
  line(ctx, X + W + 2, bot + 4, X + W + 2, bot - 24, OUT, 3);
  fillRR(ctx, X + W - 18, bot - 42, 40, 20, 3, '#fff', OUT, 1.6);
  fitText(ctx, 'ПРОДАЁТСЯ', X + W + 2, bot - 32, 34, 6.5, '#e03131');
}
function star5(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      rad = i % 2 ? r * 0.52 : r;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
}
function paintHotel(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 76,
    cw = 152; // ширина центральной части
  baseShadow(ctx, g, 10);
  // флаги на крыше
  for (const [dx, col] of [
    [-200, '#fa5252'],
    [200, '#ffd43b'],
  ]) {
    line(ctx, cx + dx, top - 8, cx + dx, top - 58, OUT, 3);
    poly(ctx, [cx + dx, top - 58, cx + dx + 26, top - 51, cx + dx, top - 44], col, OUT, 1.6);
  }
  // крылья
  wall(ctx, X + 6, top + 14, W - 12, bot - top - 14, b.wall, { eave: 12, r: 5 });
  roof(ctx, [X - 8, top + 26, X + 14, top - 14, X + W - 14, top - 14, X + W + 8, top + 26], b.roof, snow, {
    snowKeep: 0.35,
  });
  // окна крыльев: три этажа, на верхних — балконы, внизу — маркизы
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const wx = cx + side * (cw / 2 + 34 + i * 54);
      for (let f = 0; f < 3; f++) {
        const y = top + 44 + f * 94;
        const on = lit && (i + f * 2 + (side > 0 ? 1 : 0)) % 3 !== 0;
        if (on) glow(ctx, wx, y + 24, 32, 0.3);
        win(ctx, wx - 16, y, 32, f === 2 ? 50 : 46, on, {
          arch: f === 0,
          r: 3,
          curtain: on ? null : 'rgba(255,255,255,.85)',
        });
        if (f < 2) balcony(ctx, wx - 16, y + 36, 32, snow, false);
        else awning(ctx, wx - 22, y - 12, 44, 14, 4, b.roof);
      }
    }
  // центральная часть: выше, с фронтоном и вывеской
  wall(ctx, cx - cw / 2, top - 22, cw, bot - top + 22, shade(b.wall, 0.4), { eave: 0, r: 5 });
  gable(ctx, cx - cw / 2 - 8, cx + cw / 2 + 8, top - 14, top - 74, b.roof, snow);
  if (lit) glow(ctx, cx, top - 40, 40, 0.5);
  star5(ctx, cx, top - 38, 17, lit ? '#ffe48a' : GOLD);
  signBoard(ctx, 'ОТЕЛЬ', cx, top + 6, 96, 24, 'neon', '#63e6be', lit);
  signBoard(ctx, '«Морская звезда»', cx, top + 34, 138, 22, 'plate', '#1098ad');
  // большие окна центра
  for (const dx of [-42, 42]) {
    if (lit) glow(ctx, cx + dx, top + 96, 34, 0.3);
    win(ctx, cx + dx - 18, top + 66, 36, 58, lit, { arch: true, curtain: lit ? null : 'rgba(255,255,255,.85)' });
    win(ctx, cx + dx - 18, top + 150, 36, 50, lit, { r: 3, curtain: lit ? null : 'rgba(255,255,255,.85)' });
    balcony(ctx, cx + dx - 18, top + 112, 36, snow, false);
  }
  // вход: красный козырёк с золотом, двери, ковровая дорожка, фонари
  poly(ctx, [cx - 30, bot - 2, cx + 30, bot - 2, cx + 38, bot + 10, cx - 38, bot + 10], '#e03131', OUT, 1.8);
  fillRR(ctx, cx - 62, bot - 6, 124, 9, 3, '#e3e7ec', OUT, 2);
  door(ctx, cx, bot - 6, 64, 82, '#e3fafc', { arch: true, double: true, glass: true, lit, frame: GOLD });
  ctx.beginPath();
  ctx.moveTo(cx - 60, bot - 92);
  ctx.quadraticCurveTo(cx, bot - 130, cx + 60, bot - 92);
  ctx.lineTo(cx + 60, bot - 80);
  ctx.lineTo(cx - 60, bot - 80);
  ctx.closePath();
  ctx.fillStyle = '#e03131';
  ctx.fill();
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  awning(ctx, cx - 60, bot - 82, 120, 13, 10, GOLD, '#e03131');
  for (const dx of [-56, 56]) {
    line(ctx, cx + dx, bot - 80, cx + dx, bot - 4, OUT, 4);
    line(ctx, cx + dx, bot - 80, cx + dx, bot - 4, GOLD, 2);
    wallLamp(ctx, cx + dx * 1.34, bot - 60, lit);
  }
  // гирлянда фонариков вдоль крыльев
  lanterns(ctx, X + 14, cx - cw / 2 - 6, top + 30, lit);
  lanterns(ctx, cx + cw / 2 + 6, X + W - 14, top + 30, lit);
}

// ================= ДОМА ЖИТЕЛЕЙ: дорисовка по характеру хозяина =================
/** Цвет ставней и прочее: поля добавляются к зданию house (locations/town.js). */
export const HOUSE_STYLE = {
  plusha: { shutters: '#e8590c' },
  myata: { shutters: '#2f9e44' },
  prof: { shutters: '#5b4636', attic: false },
  busya: { shutters: '#f783ac', attic: false },
  ponchik: { shutters: '#1971c2', smoke: true },
  senya: { shutters: '#495057', attic: false },
  bob: { shutters: '#0b7285', attic: false },
  zefirka: { shutters: '#b197fc' },
};
export const HOUSE_ART = {
  // Плюша: уютное крыльцо — навес на столбиках, фонарик, вязаные сердечки
  plusha(ctx, g, snow, lit) {
    const { cx, bot } = g;
    for (const dx of [-30, 30]) {
      line(ctx, cx + dx, bot - 4, cx + dx, bot - 72, OUT, 5);
      line(ctx, cx + dx, bot - 4, cx + dx, bot - 72, '#fff8ec', 2.6);
    }
    poly(ctx, [cx - 40, bot - 68, cx, bot - 96, cx + 40, bot - 68], snow ? '#fff' : '#e8590c', OUT, 2.2);
    line(ctx, cx - 40, bot - 68, cx + 40, bot - 68, OUT, 2.2);
    wallLamp(ctx, cx, bot - 58, lit);
    emoji(ctx, '🧡', g.winL + 18, g.winY - 12, 10);
    emoji(ctx, '🧡', g.winR + 18, g.winY - 12, 10);
    // коврик у двери
    fillRR(ctx, cx - 18, bot + 2, 36, 9, 3, '#ffa94d', OUT, 1.4);
  },
  // Мята: вьюнок по стенам, лейка и горшки
  myata(ctx, g, snow) {
    const sea = snow ? 'winter' : 'summer';
    ivy(ctx, g.wx + 6, g.bot - 10, 96, sea, 1);
    ivy(ctx, g.wx + g.ww - 6, g.bot - 10, 96, sea, -1);
    if (!snow) {
      for (let i = 0; i < 7; i++)
        flower(ctx, g.left + 30 + i * 22, g.eaveY + 3 + (i % 2) * 3, 3.4, ['#ff8fab', '#fff', '#ffd43b'][i % 3]);
      // лейка у двери
      fillRR(ctx, g.cx + 28, g.bot - 16, 14, 14, 3, '#74c0fc', OUT, 1.5);
      line(ctx, g.cx + 42, g.bot - 10, g.cx + 50, g.bot - 18, OUT, 2.4);
    }
    emoji(ctx, '🌿', g.cx, g.atticY, 14);
  },
  // Профессор: телескоп на крыше, часы на фронтоне, стопка книг
  prof(ctx, g, snow, lit) {
    const { cx, bot } = g;
    // круглые часы-окно
    ell(ctx, cx, g.atticY, 15, 15, '#fff8ec', OUT, 2);
    for (let i = 0; i < 12; i += 3) {
      const a = (i * TAU) / 12;
      line(
        ctx,
        cx + Math.cos(a) * 10,
        g.atticY + Math.sin(a) * 10,
        cx + Math.cos(a) * 12.5,
        g.atticY + Math.sin(a) * 12.5,
        OUT,
        1.6,
      );
    }
    line(ctx, cx, g.atticY, cx, g.atticY - 9, OUT, 2);
    line(ctx, cx, g.atticY, cx + 6, g.atticY + 3, OUT, 2);
    // телескоп на треноге на скате крыши
    const tx = g.left + 46,
      ty = g.eaveY - 44;
    line(ctx, tx, ty, tx - 9, ty + 20, OUT, 2.4);
    line(ctx, tx, ty, tx + 9, ty + 20, OUT, 2.4);
    line(ctx, tx, ty, tx, ty + 22, OUT, 2.4);
    ctx.save();
    ctx.translate(tx, ty - 2);
    ctx.rotate(-0.6);
    fillRR(ctx, -16, -5, 32, 10, 3, '#5b6676', OUT, 1.8);
    fillRR(ctx, 12, -7, 9, 14, 2, GOLD, OUT, 1.6);
    fillRR(ctx, -21, -3.5, 7, 7, 2, GOLD, OUT, 1.4);
    ctx.restore();
    // книги у двери
    for (let i = 0; i < 3; i++)
      fillRR(ctx, cx + 26 + (i % 2) * 2, bot - 8 - i * 6, 20, 6, 1.5, ['#fa5252', '#4dabf7', '#51a36a'][i], OUT, 1.2);
    if (lit) glow(ctx, tx, ty, 16, 0.3);
  },
  // Буся: сердечко на фронтоне, бант, полосатый козырёк
  busya(ctx, g, snow) {
    const { cx, bot } = g;
    emoji(ctx, '💗', cx, g.atticY + 2, 24);
    bow(ctx, cx, g.peakY + 30, 0.75, '#ff8fab');
    awning(ctx, cx - 28, bot - 74, 56, 14, 6, snow ? '#fff' : '#f783ac');
    for (const dx of [-28, 28]) emoji(ctx, '🌹', cx + dx, bot - 12, 12);
  },
  // Пончик: пирог на подоконнике, пончик на фронтоне
  ponchik(ctx, g) {
    const { cx } = g;
    emoji(ctx, '🍩', cx, g.atticY, 22);
    // пирог остывает на окне
    const px = g.winR + 18,
      py = g.winY + 36;
    ell(ctx, px, py - 2, 14, 5, '#e8a85c', OUT, 1.4);
    ell(ctx, px, py - 5, 10, 3.2, '#f6c98a', OUT, 1);
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (const dx of [-5, 3]) {
      ctx.moveTo(px + dx, py - 10);
      ctx.bezierCurveTo(px + dx - 4, py - 14, px + dx + 4, py - 18, px + dx, py - 22);
    }
    ctx.stroke();
  },
  // Сеня: звезда чемпиона, спортивные полосы, медаль над дверью
  senya(ctx, g) {
    const { cx, bot } = g;
    star5(ctx, cx, g.atticY, 15, GOLD);
    ctx.fillStyle = '#fa5252';
    ctx.fillRect(g.wx + 2, g.wallTop + 16, g.ww - 4, 4);
    ctx.fillStyle = '#4dabf7';
    ctx.fillRect(g.wx + 2, g.wallTop + 21, g.ww - 4, 3);
    emoji(ctx, '🏅', cx + 30, bot - 50, 14);
    emoji(ctx, '🏊', cx - 30, bot - 50, 14);
  },
  // Капитан Боб: иллюминатор со штурвалом, якорь, спасательный круг, канат
  bob(ctx, g) {
    const { cx, bot } = g;
    ell(ctx, cx, g.atticY, 16, 16, GOLD, OUT, 2);
    ell(ctx, cx, g.atticY, 11, 11, '#cfeaff', OUT, 1.6);
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8;
      line(
        ctx,
        cx + Math.cos(a) * 11,
        g.atticY + Math.sin(a) * 11,
        cx + Math.cos(a) * 19,
        g.atticY + Math.sin(a) * 19,
        OUT,
        3,
      );
      line(
        ctx,
        cx + Math.cos(a) * 11,
        g.atticY + Math.sin(a) * 11,
        cx + Math.cos(a) * 19,
        g.atticY + Math.sin(a) * 19,
        WOOD_L,
        1.4,
      );
    }
    // спасательный круг справа от двери
    const lx = cx + 34,
      ly = bot - 44;
    ell(ctx, lx, ly, 11, 11, '#fff', OUT, 1.8);
    ell(ctx, lx, ly, 4.5, 4.5, '#c5f6fa', OUT, 1.4);
    ctx.fillStyle = '#fa5252';
    for (const a of [0, 1.57, 3.14, 4.71]) {
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a);
      ctx.fillRect(-2.6, -10.4, 5.2, 5.4);
      ctx.restore();
    }
    emoji(ctx, '⚓', cx - 34, bot - 44, 20);
    // канат по карнизу
    ctx.strokeStyle = '#d9b382';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(g.wx + 4, g.wallTop + 18);
    ctx.quadraticCurveTo(cx, g.wallTop + 28, g.wx + g.ww - 4, g.wallTop + 18);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  // Зефирка: флажки, вертушка на крыше, наклейки-звёздочки
  zefirka(ctx, g) {
    const { cx, bot } = g;
    bunting(ctx, g.wx + 4, g.wx + g.ww - 4, g.wallTop + 14, 4);
    // вертушка
    const px = cx,
      py = g.peakY - 12;
    line(ctx, px, g.peakY + 4, px, py, OUT, 2.4);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i * TAU) / 4 + 0.4);
      poly(ctx, [0, 0, 12, -4, 8, 6], ['#ff8fab', '#ffd43b', '#74c0fc', '#b197fc'][i], OUT, 1.2);
      ctx.restore();
    }
    ell(ctx, px, py, 2.2, 2.2, '#fff', OUT, 1);
    for (const [dx, dy] of [
      [-38, -40],
      [38, -46],
      [30, -22],
    ])
      emoji(ctx, '⭐', cx + dx, bot + dy, 9);
  },
};

const wideBox =
  (up, side = 44) =>
  (b) => [-side, -up, b.w * T + side, b.h * T + 16];
defineBuildings({
  villa: {
    paint: paintVilla,
    icon: '🏡',
    box: wideBox(76),
    hitUp: () => 60,
    lights: (b) => doorLight(b, 130, 30),
  },
  salon: { paint: paintSalon, box: wideBox(60), lights: (b) => doorLight(b) },
  boutique: { paint: paintBoutique, box: wideBox(60), lights: (b) => doorLight(b) },
  cafe: { paint: paintCafe, box: wideBox(76), lights: (b) => doorLight(b) },
  rest: { paint: paintRest, box: wideBox(60), lights: (b) => doorLight(b, 130) },
  poolhall: { paint: paintPool, box: wideBox(112, 50), hitUp: () => 60, lights: (b) => doorLight(b) },
  beachcafe: { paint: paintBeachCafe, box: wideBox(50, 50), lights: (b) => doorLight(b, 100) },
  mallx: { paint: paintMall, box: wideBox(76), lights: (b) => doorLight(b, 130) },
  hospital: { paint: paintHospital, box: wideBox(80), lights: (b) => doorLight(b, 120) },
  school: { paint: paintSchool, box: wideBox(104), hitUp: () => 70, lights: (b) => doorLight(b, 110) },
  towerFashion: {
    paint: paintTowerFashion,
    box: (b) => towerBox(b, 96),
    hitUp: (b) => b.floors * T * 0.62,
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 60),
  },
  towerHamster: {
    paint: paintTowerHamster,
    box: (b) => towerBox(b, 150, 52),
    hitUp: (b) => b.floors * T * 0.62,
    live: (ctx, b, t) => beacon(ctx, b, t, 136),
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 80),
  },
  bank: {
    paint: paintBank,
    box: (b) => towerBox(b, 90),
    hitUp: (b) => b.floors * T * 0.62,
    lights: (b) => doorLight(b, 90, b.floors * T * 0.62 - b.h * T + T + 60),
  },
  market: { paint: paintMarket, box: wideBox(40), lights: (b) => doorLight(b, 110) },
  realtor: { paint: paintRealtor, box: wideBox(50), lights: (b) => doorLight(b) },
  apartment: { paint: paintApartment, box: wideBox(150), hitUp: () => 90, lights: (b) => doorLight(b, 100, 84) },
  bungalow: { paint: paintBungalow, box: wideBox(60, 50), lights: (b) => doorLight(b) },
  hotel: { paint: paintHotel, box: wideBox(170), hitUp: () => 110, lights: (b) => doorLight(b, 150, 90) },
});
