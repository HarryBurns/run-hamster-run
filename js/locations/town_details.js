// Мелочи для фасадов и витрин зданий города, общие для нескольких зданий: подпись вывески (своё название
// купленного заведения), платья и манекены в витринах, флажки, фонарики, плющ, бантики, соломенная крыша,
// бамбук, доски для сёрфинга, балконы, звёздочки, корпус торгового центра. Сами здания — town_shops.js,
// town_public.js, town_homes.js, town_hotel.js; список видов зданий — town_buildings.js.
import { ell, fillRR, line, poly, shade } from '../core/draw.js';
import { OUT } from '../engine/topdown/kinds.js';
import { roof, win, glow, shopBody } from './common/buildings.js';
import { flower, leafTones } from './common/paint.js';

/** Своё название заведения на вывеске (поле signText — его ставит town.js у купленных заведений) или null. */
export const own = (b) => (b.signText && b.signText()) || null;

export const title = (b) => `${b.icon || ''} ${own(b) || b.name || ''}`.trim();

// ---------- мелочи для витрин ----------
export function dress(ctx, x, y, s, col) {
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

export function mannequinIn(ctx, x, bot, s, col) {
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

export function pile(ctx, x, bot, n, r, cols) {
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

export function bunting(ctx, x0, x1, y, sag = 8) {
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

export function lanterns(ctx, x0, x1, y, lit) {
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
export function ivy(ctx, x, bot, h, sea, dir = 1) {
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

export function bow(ctx, x, y, s, col) {
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

export function thatch(ctx, pts, snow) {
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

export function bamboo(ctx, x, y, w, h, col) {
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

export function surfboard(ctx, x, bot, col, lean) {
  ctx.save();
  ctx.translate(x, bot);
  ctx.rotate(lean);
  ell(ctx, 0, -32, 8, 32, col, OUT, 1.8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-1.5, -60, 3, 56);
  ell(ctx, 0, -44, 4, 4, '#fff', null);
  ctx.restore();
}

export function mallBody(ctx, b, snow, lit, o = {}) {
  const s = shopBody(ctx, b, snow, { roofH: 62, up: 14, ...o }),
    { X, W } = s;
  // верхний ряд окон
  const n = 4,
    ww = 34;
  for (let i = 0; i < n; i++) {
    const x = X + 26 + (i * (W - 52 - ww)) / (n - 1);
    win(ctx, x, s.aw + 28, ww, 30, lit, { cross: true, r: 3 });
  }
  return s;
}

export function balcony(ctx, x, y, w, snow, laundry) {
  fillRR(ctx, x - 4, y + 12, w + 8, 5, 2, '#fff8ec', OUT, 1.6);
  for (let i = 0; i <= 4; i++) line(ctx, x - 2 + (i * (w + 4)) / 4, y, x - 2 + (i * (w + 4)) / 4, y + 12, OUT, 1.6);
  line(ctx, x - 4, y, x + w + 4, y, OUT, 2.4);
  if (laundry && !snow) {
    fillRR(ctx, x + 2, y + 1, 9, 10, 1, '#ff8fab', OUT, 1);
    fillRR(ctx, x + 14, y + 1, 11, 8, 1, '#74c0fc', OUT, 1);
  } else if (!snow)
    for (let i = 0; i < 3; i++) flower(ctx, x + 5 + (i * (w - 10)) / 2, y - 2, 2.6, ['#ff6b9d', '#ffd43b', '#fff'][i]);
}

export function star5(ctx, x, y, r, col) {
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
