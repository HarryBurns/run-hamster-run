// ОБЩИЕ ВИДЫ ЗДАНИЙ — для любых локаций «вид сверху» (как описывать вид — engine/topdown/kinds.js).
//
//   house   домик жителя (поле npc — чей; на табличке его имя)      shop   магазинчик с навесом и вывеской
//   mall    большой магазин с двумя витринами                       tower  высотка (поле floors — этажи)
//   villa   вилла хомячка
//
// Здание в описании локации: { id, kind, x, y, w, h, name, icon, wall, roof, act }. Цвета wall и roof — свои
// у каждого здания. Снег на крыше и свет в окнах рисунок получает параметрами (snow, lit).
import { NPC_BY_ID } from '../../data/index.js';
import { ell, fillRR, line, poly, shade } from '../../core/draw.js';
import { T, OUT, SP, hash, label, defineBuildings } from '../../engine/topdown/kinds.js';

/** Общие размеры «пятна» здания b в единицах мира. */
const dims = (b) => {
  const X = b.x * T,
    Y = b.y * T,
    Wd = b.w * T,
    H = b.h * T;
  return { X, Y, Wd, H, bot: Y + H, cx: X + Wd / 2 };
};
const shadow = (ctx, d) => {
  ctx.fillStyle = 'rgba(0,0,0,.13)';
  ctx.fillRect(d.X + 2, d.bot - 6, d.Wd + 6, 12);
};
const winCol = (lit) => (lit ? '#ffe066' : '#d0ebff');

function paintHouse(ctx, b, snow, lit) {
  const { X, Y, Wd, H, bot, cx } = dims(b),
    win = winCol(lit);
  shadow(ctx, { X, bot, Wd });
  fillRR(ctx, X + 8, Y + H * 0.42, Wd - 16, H * 0.58, 4, b.wall, OUT, 2.5);
  fillRR(ctx, X + Wd * 0.68, Y - 6, 18, 40, 3, '#adb5bd', OUT, 2);
  poly(ctx, [X - 6, Y + H * 0.48, cx, Y - 20, X + Wd + 6, Y + H * 0.48], snow ? '#fff' : b.roof, OUT, 2.5);
  if (snow)
    poly(
      ctx,
      [
        X + 14,
        Y + H * 0.48 - 8,
        cx,
        Y + 8,
        X + Wd - 14,
        Y + H * 0.48 - 8,
        X + Wd + 2,
        Y + H * 0.48,
        X - 2,
        Y + H * 0.48,
      ],
      b.roof,
    );
  fillRR(ctx, cx - 16, bot - 58, 32, 58, 6, shade(b.roof, -0.15), OUT, 2);
  ell(ctx, cx + 8, bot - 28, 3, 3, '#ffd43b');
  fillRR(ctx, X + 20, Y + H * 0.56, 34, 34, 5, win, OUT, 2);
  fillRR(ctx, X + Wd - 54, Y + H * 0.56, 34, 34, 5, win, OUT, 2);
  line(ctx, X + 37, Y + H * 0.56, X + 37, Y + H * 0.56 + 34, OUT, 1.5);
  line(ctx, X + Wd - 37, Y + H * 0.56, X + Wd - 37, Y + H * 0.56 + 34, OUT, 1.5);
  ell(ctx, cx, Y + H * 0.2, 12, 12, win, OUT, 2);
  const n = NPC_BY_ID[b.npc];
  label(ctx, n.name.split(' ').pop(), cx, bot - 70, Wd, 13, 'rgba(255,255,255,.92)');
}
function paintTower(ctx, b, snow, lit) {
  const { X, Wd, bot, cx } = dims(b),
    win = winCol(lit);
  shadow(ctx, { X, bot, Wd });
  const top = bot - b.floors * T * 0.62 - T;
  fillRR(ctx, X + 10, top, Wd - 20, bot - top, 8, b.wall, OUT, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(X + 14, top + 4, 16, bot - top - 8);
  for (let f = 0; f < b.floors; f++)
    for (let i = 0; i < 4; i++) {
      const wy = top + 20 + f * T * 0.62,
        wx = X + 24 + i * ((Wd - 48 - 22) / 3);
      const on = lit && hash(b.x + i, f) < 0.7;
      fillRR(ctx, wx, wy, 22, 18, 3, on ? '#ffe066' : lit ? '#3b4a6b' : '#e7f5ff', OUT, 1.5);
    }
  fillRR(ctx, X + 4, top - 10, Wd - 8, 16, 5, snow ? '#fff' : shade(b.wall, -0.2), OUT, 2.5);
  line(ctx, cx, top - 10, cx, top - 44, OUT, 3);
  ell(ctx, cx, top - 46, 5, 5, '#7a1f1f', OUT, 1.5); // погасший огонёк; горящий рисует drawBuilding
  fillRR(ctx, cx - 26, bot - 54, 52, 54, 6, '#fff', OUT, 2);
  fillRR(ctx, cx - 20, bot - 48, 18, 48, 3, win, OUT, 1.5);
  fillRR(ctx, cx + 2, bot - 48, 18, 48, 3, win, OUT, 1.5);
  label(ctx, `${b.icon} ${b.name}`, cx, bot - 74, Wd + 60, 15, '#fff');
}
function paintVilla(ctx, b, snow, lit) {
  const { X, Y, Wd, H, bot, cx } = dims(b),
    win = winCol(lit);
  shadow(ctx, { X, bot, Wd });
  fillRR(ctx, X + 6, Y + 30, Wd - 12, H - 30, 6, b.wall, OUT, 3);
  poly(ctx, [X - 14, Y + 40, X + 60, Y - 34, X + Wd - 60, Y - 34, X + Wd + 14, Y + 40], snow ? '#fff' : b.roof, OUT, 3);
  if (snow) poly(ctx, [X + 4, Y + 40, X + 70, Y - 12, X + Wd - 70, Y - 12, X + Wd - 4, Y + 40], b.roof);
  poly(ctx, [cx - 76, Y + 40, cx, Y - 10, cx + 76, Y + 40], '#fff', OUT, 2.5);
  ell(ctx, cx, Y + 20, 13, 13, win, OUT, 2);
  for (const dx of [-70, 70]) {
    fillRR(ctx, cx + dx - 9, Y + 40, 18, H - 40, 5, '#fff', OUT, 2);
  }
  for (let r = 0; r < 2; r++)
    for (const dx of [-190, -130, 130, 190]) {
      fillRR(ctx, cx + dx - 18, Y + 62 + r * 74, 36, 44, 16, win, OUT, 2);
      line(ctx, cx + dx, Y + 62 + r * 74, cx + dx, Y + 106 + r * 74, OUT, 1.5);
      if (r === 0) fillRR(ctx, cx + dx - 24, Y + 104, 48, 8, 3, '#fff', OUT, 1.5);
    }
  fillRR(ctx, cx - 48, Y + 96, 96, 10, 4, '#fff', OUT, 2);
  for (let i = -2; i <= 2; i++) line(ctx, cx + i * 20, Y + 106, cx + i * 20, Y + 124, OUT, 2);
  fillRR(ctx, cx - 44, Y + 56, 88, 40, 6, win, OUT, 2);
  fillRR(ctx, cx - 30, bot - 84, 60, 84, 26, '#e8590c', OUT, 2.5);
  line(ctx, cx, bot - 84, cx, bot, OUT, 2);
  ell(ctx, cx - 7, bot - 38, 3.5, 3.5, '#ffd43b');
  ell(ctx, cx + 7, bot - 38, 3.5, 3.5, '#ffd43b');
}
/** Магазин (mall = false) или ТЦ. */
function paintShop(ctx, b, snow, lit, mall) {
  const { X, Y, Wd, H, bot, cx } = dims(b),
    win = winCol(lit);
  shadow(ctx, { X, bot, Wd });
  const roofH = mall ? H * 0.3 : H * 0.34;
  fillRR(ctx, X + 4, Y + roofH - 8, Wd - 8, H - roofH + 8, 5, b.wall, OUT, 2.5);
  fillRR(ctx, X - 2, Y - 10, Wd + 4, roofH + 8, 8, snow ? '#fff' : b.roof, OUT, 2.5);
  if (snow) fillRR(ctx, X + 2, Y + roofH * 0.45, Wd - 4, roofH * 0.55 - 6, 4, b.roof);
  else {
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(X + 4, Y - 4, Wd - 8, 8);
  }
  // навес в полоску
  const aw = Y + roofH - 2;
  for (let i = 0; i < b.w * 2; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : b.roof;
    ctx.beginPath();
    ctx.moveTo(X + 4 + i * ((Wd - 8) / (b.w * 2)), aw);
    ctx.lineTo(X + 4 + (i + 1) * ((Wd - 8) / (b.w * 2)), aw);
    ctx.lineTo(X + 4 + (i + 1) * ((Wd - 8) / (b.w * 2)), aw + 14);
    ctx.arc(X + 4 + (i + 0.5) * ((Wd - 8) / (b.w * 2)), aw + 14, (Wd - 8) / (b.w * 4), 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  }
  line(ctx, X + 4, aw, X + Wd - 4, aw, OUT, 2);
  // витрины и дверь
  const wy = aw + 34,
    wh = bot - wy - 16;
  if (mall) {
    for (const sx of [-1, 1]) {
      fillRR(ctx, cx + sx * (Wd * 0.3) - Wd * 0.14, wy, Wd * 0.28, wh, 6, win, OUT, 2);
      line(ctx, cx + sx * (Wd * 0.3), wy, cx + sx * (Wd * 0.3), wy + wh, OUT, 1.5);
    }
    fillRR(ctx, cx - 34, bot - wh - 22, 68, wh + 22, 8, '#fff', OUT, 2.5);
    fillRR(ctx, cx - 28, bot - wh - 16, 26, wh + 16, 4, win, OUT, 1.5);
    fillRR(ctx, cx + 2, bot - wh - 16, 26, wh + 16, 4, win, OUT, 1.5);
  } else {
    fillRR(ctx, X + 14, wy, Wd * 0.36, wh, 6, win, OUT, 2);
    if (b.w >= 5) fillRR(ctx, X + Wd - 14 - Wd * 0.26, wy, Wd * 0.26, wh, 6, win, OUT, 2);
    fillRR(ctx, cx - 14 + (b.w < 5 ? 26 : 0), bot - 62, 34, 62, 7, shade(b.roof, -0.1), OUT, 2);
    fillRR(ctx, cx - 8 + (b.w < 5 ? 26 : 0), bot - 54, 22, 26, 4, win, OUT, 1.5);
  }
  label(ctx, `${b.icon} ${b.name}`, cx, Y + roofH * 0.5 - 2, Wd + 30, mall ? 19 : 15, '#fff');
}

defineBuildings({
  house: {
    paint: paintHouse,
    mapDraw(ctx, b, k) {
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x * k + 1, b.y * k + 1, b.w * k - 2, b.h * k * 0.4);
    },
  },
  shop: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, false) },
  mall: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, true) },
  villa: { paint: paintVilla, icon: '🏡' },
  market: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, false) },
  office: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, false) },
  bungalow: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, false) },
  apartment: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, true) },
  hotel: { paint: (ctx, b, snow, lit) => paintShop(ctx, b, snow, lit, true) },
  tower: {
    paint: paintTower,
    // башни высокие, у вывесок запас по бокам
    box: (b) => [-44, -(b.floors * T * 0.62 + T + 60 - b.h * T), b.w * T + 44, b.h * T + 12],
    hitUp: (b) => b.floors * T * 0.62,
    live(ctx, b, t) {
      if (Math.sin(t * 4) > 0) {
        // огонёк на шпиле мигает
        const cx = (b.x + b.w / 2) * T,
          top = (b.y + b.h) * T - b.floors * T * 0.62 - T;
        SP.world();
        ell(ctx, cx, top - 46, 5, 5, '#fa5252', OUT, 1.5);
      }
    },
  },
});
