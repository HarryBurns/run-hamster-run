// Общие мелочи рисунка для домов «тайных мест» (этап 13): качнуть потроганный предмет, огонь, факел, подушка,
// ковёр, светящаяся вода. Координаты — дома (x — центр, y — пол или точка крепления), t — время в секундах.
import { ell, fillRR, line, poly, shade } from '../core/draw.js';

const OUT = '#4a3728';

/** Качнуть предмет вокруг точки (x, y): k — 0..1 (только что потрогали — сильнее). Вызывать внутри save/restore. */
export function wob(ctx, x, y, t, k) {
  if (k <= 0) return;
  const a = Math.sin(t * 26) * 0.07 * k;
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.translate(-x, -y);
}

/** Огонёк: три языка пламени, пляшут (s — размер). */
export function flame(ctx, x, y, s, t) {
  const f = (dx, h, w, c, ph) => {
    const hh = h * s * (0.85 + Math.sin(t * 9 + ph) * 0.15);
    ctx.beginPath();
    ctx.moveTo(x + dx - w * s, y);
    ctx.quadraticCurveTo(x + dx - w * s * 0.8, y - hh * 0.6, x + dx + Math.sin(t * 7 + ph) * 3, y - hh);
    ctx.quadraticCurveTo(x + dx + w * s * 0.8, y - hh * 0.6, x + dx + w * s, y);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  };
  f(-10 * s, 30, 10, '#ff922b', 0);
  f(10 * s, 26, 10, '#ff922b', 2);
  f(0, 40, 13, '#ffa94d', 1);
  f(0, 24, 7, '#ffe066', 3);
}

/** Факел на стене: держатель и огонь (y — высота держателя). */
export function torch(ctx, x, y, t) {
  fillRR(ctx, x - 5, y - 4, 10, 40, 3, '#8d5524', OUT, 1.5);
  fillRR(ctx, x - 11, y - 10, 22, 12, 4, '#5c3a21', OUT, 1.5);
  flame(ctx, x, y - 8, 0.62, t);
}

/** Подушка для сидения на полу. */
export function cushion(ctx, x, y, c, c2) {
  ell(ctx, x, y - 16, 44, 17, c, OUT, 2);
  line(ctx, x - 34, y - 16, x + 34, y - 16, c2 || shade(c, 0.25), 3);
  for (const dx of [-44, 44]) ell(ctx, x + dx, y - 16, 5, 5, '#ffd43b', OUT, 1);
}

/** Ковёр на стене или на полу: рамка, ромбы, бахрома (x0, y0 — левый верх, w × h). */
export function carpet(ctx, x0, y0, w, h, c, c2, c3) {
  fillRR(ctx, x0, y0, w, h, 4, c, OUT, 2);
  fillRR(ctx, x0 + 8, y0 + 8, w - 16, h - 16, 3, null, c2, 3);
  const n = Math.max(1, Math.round((w - 20) / 46));
  for (let i = 0; i < n; i++) {
    const cx = x0 + 10 + ((w - 20) * (i + 0.5)) / n,
      cy = y0 + h / 2,
      r = Math.min(18, h / 2 - 14);
    poly(ctx, [cx, cy - r, cx + r * 0.8, cy, cx, cy + r, cx - r * 0.8, cy], i % 2 ? c2 : c3, OUT, 1.2);
  }
  for (let xx = x0 + 4; xx < x0 + w; xx += 9) line(ctx, xx, y0 + h, xx, y0 + h + 7, c2, 2);
}

/** Светящаяся вода (грот): тёмно-бирюзовая гладь и мерцающие огоньки. */
export function glowWater(ctx, x0, x1, y, depth, t) {
  const g = ctx.createLinearGradient(0, y - 6, 0, y + depth);
  g.addColorStop(0, '#3bc9db');
  g.addColorStop(1, '#0b3d5c');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y - 6, x1 - x0, depth + 6);
  for (let i = 0; i < (x1 - x0) / 22; i++) {
    const xx = x0 + ((i * 53 + t * 9) % (x1 - x0)),
      yy = y + 6 + ((i * 29) % Math.max(6, depth - 14)),
      a = 0.45 + Math.sin(t * 2.4 + i * 1.7) * 0.4;
    ctx.globalAlpha = Math.max(0, a);
    ell(ctx, xx, yy, 3, 3, '#c5f6fa');
  }
  ctx.globalAlpha = 1;
  line(ctx, x0, y - 6, x1, y - 6, 'rgba(255,255,255,.6)', 2);
}
