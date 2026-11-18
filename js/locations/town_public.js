// Общественные здания и высотки города: больница, школа, два небоскрёба, банк.
import { TAU } from '../core/util.js';
import { ell, fillRR, line, poly, shade, emoji } from '../core/draw.js';
import { OUT } from '../engine/topdown/kinds.js';
import { geom, baseShadow, wall, roof, gable, win, door, steps, glow, towerBody } from './common/buildings.js';
import { signBoard, fitText, LIT, GOLD } from './common/paint.js';
import { title, mannequinIn, mallBody } from './town_details.js';

export function paintHospital(ctx, b, snow, lit) {
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

export function paintSchool(ctx, b, snow, lit) {
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
export function paintTowerFashion(ctx, b, snow, lit) {
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

export function paintTowerHamster(ctx, b, snow, lit) {
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

export function paintBank(ctx, b, snow, lit) {
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
