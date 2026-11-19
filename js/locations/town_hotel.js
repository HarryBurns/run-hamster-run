// Курортный отель на набережной: корпус с балконами, водная горка, вывеска; где стоит швейцар (DOORMAN).
import { ell, fillRR, line, poly, shade } from '../core/draw.js';
import { OUT } from '../engine/topdown/kinds.js';
import { geom, baseShadow, wall, gable, win, door, glow, wallLamp } from './common/buildings.js';
import { signBoard, awning, GOLD } from './common/paint.js';
import { own, lanterns, balcony, star5 } from './town_details.js';

// Курортный отель «Морская звезда» (П.17): пять этажей у моря — белые стены, пастельные балконы с маркизами,
// центральная башенка со звездой и неоновой вывеской, на крыше крыльев — терраса с бассейном и зонтиками, справа —
// водная горка-спираль с крыши (она внутри отеля — мини-игра «Горка»). У входа — красный навес на золотых столбиках,
// ковровая дорожка и швейцар в ливрее. Пальмы у здания — обычные пальмы города (locations/town.js).
const HOTEL_TINTS = ['#96f2d7', '#ffd8a8', '#d0bfff']; // мята, персик, сирень — балконы и маркизы по столбцам

export const DOORMAN = {
  fur: '#c98b5a',
  belly: '#f6dfb8',
  spots: null,
  ear: '#ffb3c1',
  outfit: {
    body: { id: 'x_doorman_coat', slot: 'body', kind: 'jacketA', c: '#e03131', c2: '#ffd43b' },
    head: { id: 'x_doorman_cap', slot: 'head', kind: 'cap', c: '#e03131', c2: '#ffd43b' },
    acc: { id: 'x_doorman_bow', slot: 'acc', kind: 'bowtie', c: '#ffd43b' },
  },
  beauty: { blush: '#ffb0bd' },
};

function hotelSlide(ctx, x0, top, bot, snow) {
  // водная горка справа от здания: с крыши правого крыла — две широкие петли вниз, в бассейн-брызгалку у земли
  const pts = [];
  for (let k = 0; k <= 72; k++) {
    const q = k / 72,
      y = top + 4 + q * (bot - top - 40) + Math.cos(q * Math.PI * 4) * 10,
      x = x0 + 26 + Math.sin(q * Math.PI * 4) * 34 * (1 - q * 0.3);
    pts.push([x, y]);
  }
  const tube = (w, col) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  // опоры
  for (const q of [0.2, 0.45, 0.7, 0.9]) {
    const [x, y] = pts[Math.round(q * 72)];
    line(ctx, x, y, x, bot - 8, OUT, 4);
    line(ctx, x, y, x, bot - 8, '#dee2e6', 2);
  }
  tube(24, OUT);
  tube(19, '#ffd43b');
  tube(8, '#ff922b');
  ctx.setLineDash([3, 10]);
  tube(3, 'rgba(255,255,255,.8)');
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  // бассейн-брызгалка внизу
  const [ex, ey] = pts[72];
  fillRR(ctx, ex - 34, bot - 24, 72, 22, 10, '#e7f5ff', OUT, 2);
  fillRR(ctx, ex - 29, bot - 20, 62, 13, 6, snow ? '#d0ebff' : '#4dabf7');
  if (!snow)
    for (let i = 0; i < 3; i++)
      ell(ctx, ex - 12 + i * 12, Math.min(ey, bot - 26) - (i % 2) * 6, 3.4, 3.4, '#e7f5ff', OUT, 1);
  // площадка наверху
  fillRR(ctx, x0 + 2, top - 6, 48, 12, 3, '#fff8ec', OUT, 1.8);
}

export function paintHotel(ctx, b, snow, lit) {
  const g = geom(b),
    { X, W, bot, cx } = g,
    top = g.Y - 150, // крыша крыльев
    cw = 160, // ширина центральной башенки
    FL = 4, // этажей в крыльях (+ первый с маркизами)
    fh = (bot - 46 - (top + 30)) / FL; // высота этажа
  baseShadow(ctx, g, 12);
  // крылья: стены и плоская крыша-терраса с перилами, зонтиками и бортиком бассейна
  wall(ctx, X + 6, top, W - 12, bot - top, b.wall, { eave: 0, r: 5 });
  fillRR(ctx, X - 2, top - 8, W + 4, 12, 4, snow ? '#f8f9fa' : b.roof, OUT, 2);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? X + 10 : cx + cw / 2 + 4,
      x1 = side < 0 ? cx - cw / 2 - 4 : X + W - 10;
    for (let x = x0; x <= x1; x += 12) line(ctx, x, top - 24, x, top - 8, OUT, 1.6);
    line(ctx, x0 - 2, top - 24, x1 + 2, top - 24, OUT, 2.6);
    line(ctx, x0 - 2, top - 24, x1 + 2, top - 24, '#fff', 1.2);
    if (!snow) {
      // бассейн на крыше: голубая кромка, два зонтика
      fillRR(ctx, x0 + 14, top - 15, x1 - x0 - 28, 7, 3, '#74c0fc', OUT, 1.4);
      for (const k of [0.25, 0.75]) {
        const ux = x0 + (x1 - x0) * k;
        line(ctx, ux, top - 10, ux, top - 46, OUT, 2);
        ctx.beginPath();
        ctx.moveTo(ux - 20, top - 38);
        ctx.quadraticCurveTo(ux, top - 62, ux + 20, top - 38);
        ctx.closePath();
        ctx.fillStyle = side < 0 ? '#ff8fab' : '#63e6be';
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }
  // окна крыльев: верхние этажи с балконами и маркизами пастельных цветов, внизу — большие окна с маркизами
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const wx = cx + side * (cw / 2 + 34 + i * 54),
        tint = HOTEL_TINTS[(i + (side > 0 ? 1 : 0)) % 3];
      for (let f = 0; f < FL; f++) {
        const y = top + 30 + f * fh,
          low = f === FL - 1;
        const on = lit && (i + f * 2 + (side > 0 ? 1 : 0)) % 3 !== 0;
        if (on) glow(ctx, wx, y + 22, 30, 0.3);
        win(ctx, wx - 15, y, 30, low ? 46 : 38, on, {
          arch: f === 0,
          r: 3,
          curtain: on ? null : 'rgba(255,255,255,.85)',
        });
        if (!low) {
          awning(ctx, wx - 19, y - 9, 38, 10, 4, tint);
          balcony(ctx, wx - 16, y + 28, 32, snow, false);
          ctx.fillStyle = shade(tint, -0.05);
          ctx.fillRect(wx - 17, y + 41, 34, 3);
        } else awning(ctx, wx - 22, y - 12, 44, 14, 4, b.roof);
      }
    }
  // центральная башенка: выше крыльев, с фронтоном, звездой и вывеской
  const ct = top - 44;
  wall(ctx, cx - cw / 2, ct, cw, bot - ct, shade(b.wall, 0.4), { eave: 0, r: 5 });
  gable(ctx, cx - cw / 2 - 8, cx + cw / 2 + 8, ct + 8, ct - 52, b.roof, snow);
  if (lit) glow(ctx, cx, ct - 18, 40, 0.5);
  star5(ctx, cx, ct - 18, 16, lit ? '#ffe48a' : GOLD);
  for (const [dx, col] of [
    [-cw / 2 - 2, '#fa5252'],
    [cw / 2 + 2, '#ffd43b'],
  ]) {
    line(ctx, cx + dx, ct + 4, cx + dx, ct - 46, OUT, 3);
    poly(ctx, [cx + dx, ct - 46, cx + dx + (dx < 0 ? -24 : 24), ct - 39, cx + dx, ct - 32], col, OUT, 1.6);
  }
  signBoard(ctx, 'ОТЕЛЬ', cx, ct + 26, 96, 24, 'neon', '#63e6be', lit);
  signBoard(ctx, own(b) || '«Морская звезда»', cx, ct + 54, 142, 22, 'plate', b.roof);
  // большие окна центра с балконами
  for (const dx of [-40, 40])
    for (let f = 0; f < 3; f++) {
      const y = ct + 76 + f * 62,
        on = lit && (f + (dx > 0 ? 1 : 0)) % 2 === 0;
      if (on) glow(ctx, cx + dx, y + 22, 32, 0.3);
      win(ctx, cx + dx - 17, y, 34, 42, on, { arch: f === 0, r: 3, curtain: on ? null : 'rgba(255,255,255,.85)' });
      balcony(ctx, cx + dx - 17, y + 30, 34, snow, false);
    }
  // вход: навес на золотых столбиках, двери, ковровая дорожка, фонари
  poly(ctx, [cx - 30, bot - 2, cx + 30, bot - 2, cx + 38, bot + 10, cx - 38, bot + 10], '#e03131', OUT, 1.8);
  fillRR(ctx, cx - 62, bot - 6, 124, 9, 3, '#e3e7ec', OUT, 2);
  door(ctx, cx, bot - 6, 64, 82, '#e3fafc', { arch: true, double: true, glass: true, lit, frame: GOLD });
  ctx.beginPath();
  ctx.moveTo(cx - 60, bot - 92);
  ctx.quadraticCurveTo(cx, bot - 130, cx + 60, bot - 92);
  ctx.lineTo(cx + 60, bot - 80);
  ctx.lineTo(cx - 60, bot - 80);
  ctx.closePath();
  ctx.fillStyle = snow ? '#f8f9fa' : '#e03131';
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
  // гирлянды фонариков под крышей крыльев
  lanterns(ctx, X + 14, cx - cw / 2 - 6, top + 8, lit);
  lanterns(ctx, cx + cw / 2 + 6, X + W - 14, top + 8, lit);
  // водная горка справа; швейцар у двери — живой, отдельно от здания (locations/doorman.js, От3)
  hotelSlide(ctx, X + W - 30, top - 20, bot, snow);
}
