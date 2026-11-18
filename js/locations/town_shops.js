// Магазины, кафе и заведения города: салон красоты, бутик, кафе, ресторан «Золотой орешек», бассейн, пляжное кафе,
// торговые центры, рынок, агентство недвижимости. Мелочи витрин — town_details.js.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, rr, shade, emoji } from '../core/draw.js';
import { OUT, doorX } from '../engine/topdown/kinds.js';
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
} from './common/buildings.js';
import { signBoard, awning, flower, fitText, WOOD, WOOD_D, WOOD_L, LIT, GOLD } from './common/paint.js';
import {
  own,
  title,
  dress,
  mannequinIn,
  pile,
  bunting,
  lanterns,
  bow,
  thatch,
  bamboo,
  surfboard,
  mallBody,
} from './town_details.js';

function cake(ctx, x, bot, col) {
  fillRR(ctx, x - 9, bot - 12, 18, 12, 3, '#fff3d6', OUT, 1.2);
  fillRR(ctx, x - 10, bot - 15, 20, 6, 3, col, OUT, 1.2);
  ell(ctx, x, bot - 17, 2.6, 2.6, '#fa5252', OUT, 0.9);
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

export function paintSalon(ctx, b, snow, lit) {
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
  door(ctx, cx + doorX(b), bot, 34, 64, '#e64980', { glass: true, lit, frame: '#fff8ec' });
  barberPole(ctx, X + W - 18, bot - 76, 54);
  // сердечки-наклейки на стене
  for (const [dx, dy] of [
    [W - 24, g.wy - 8],
    [W - 40, g.wy + 6],
  ])
    emoji(ctx, '💗', X + dx, dy, 11);
  signBoard(ctx, title(b), cx, g.top + 28, W - 14, 26, 'plate', '#e64980', false, !!own(b));
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

export function paintBoutique(ctx, b, snow, lit) {
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
  door(ctx, cx + doorX(b), bot, 34, 64, '#fff8ec', { glass: true, lit, frame: '#845ef7', arch: true });
  wallLamp(ctx, X + W - 14, bot - 70, lit);
  signBoard(ctx, title(b), cx, g.top + 30, W - 14, 26, 'plate', '#845ef7', false, !!own(b));
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

export function paintCafe(ctx, b, snow, lit) {
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
  door(ctx, cx + doorX(b), bot, 34, 64, '#d6336c', { glass: true, lit, frame: '#fff8ec' });
  chalkboard(ctx, X + W - 18, bot + 2);
  signBoard(ctx, title(b), cx - 14, g.top + 28, W - 62, 25, 'plate', '#d6336c', false, !!own(b));
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

export function paintRest(ctx, b, snow, lit) {
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
  signBoard(ctx, own(b) || b.name, cx, Y + 26, 216, 30, 'neon', GOLD, lit, !!own(b));
  nut(ctx, cx, Y - 12, 20);
}

export function paintPool(ctx, b, snow, lit) {
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

function drink(ctx, x, bot, col) {
  poly(ctx, [x - 5, bot - 14, x + 5, bot - 14, x + 3.5, bot, x - 3.5, bot], col, OUT, 1.1);
  line(ctx, x + 1, bot - 14, x + 5, bot - 22, OUT, 1.2);
  ell(ctx, x - 4, bot - 16, 3, 3, '#ffd43b', OUT, 0.9);
}

export function paintBeachCafe(ctx, b, snow, lit) {
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
  signBoard(ctx, title(b), cx, Y + 10, 170, 26, 'wood', undefined, false, !!own(b));
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

export function paintMall(ctx, b, snow, lit) {
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

export function paintMarket(ctx, b, snow, lit) {
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

export function paintRealtor(ctx, b, snow, lit) {
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
  door(ctx, cx + doorX(b), bot, 36, 66, shade(b.roof, -0.05), { glass: true, lit, frame: '#fff8ec' });
  wallLamp(ctx, cx + 92, bot - 62, lit);
  signBoard(ctx, title(b), cx, Y + 92, W - 30, 24, 'plate', '#5c940d');
  // табличка «Продаётся» у крыльца
  line(ctx, X + 4, bot + 4, X + 4, bot - 26, OUT, 3);
  fillRR(ctx, X - 16, bot - 44, 40, 20, 3, '#fff', OUT, 1.6);
  fitText(ctx, 'ПРОДАЁТСЯ', X + 4, bot - 34, 34, 6.5, '#e03131');
}
