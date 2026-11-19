// РИСУНКИ В ГОСТЯХ (features/visits.js) — без логики: чаепитие за столом у жителя и ночное небо в телескоп.
// Когда показывать и что за этим следует (дружба, наклейки, время), решает visits.js.
import { ell, fillRR, star } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';

/**
 * Чаепитие: хомячок (look) и хозяин (hostLook; small — маленький житель) за столом, чайник, чашки, угощение teaE.
 * t — секунды с начала сценки.
 */
export function paintTea(ctx, W, H, t, look, hostLook, small, teaE) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#e8c9a0';
  ctx.fillRect(0, H - 22, W, 22);
  const sip = Math.sin(t * 2.2) > 0.75;
  drawHamster(ctx, 62, H - 20, 1.25, look, {
    time: t,
    dir: 1,
    sit: true,
    blink: blinkAt(t),
    happy: sip,
    shadow: false,
  });
  drawHamster(ctx, W - 62, H - 20, 1.25 * (small ? 0.8 : 1), hostLook, {
    time: t + 1.7,
    dir: -1,
    sit: true,
    blink: blinkAt(t, 1.7),
    talk: !sip && t % 3 < 1.6,
    happy: sip,
    shadow: false,
  });
  // стол, скатерть, чайник, чашки, угощение
  fillRR(ctx, W / 2 - 8, H - 62, 16, 44, 4, '#b9834f', '#4a3728');
  fillRR(ctx, W / 2 - 66, H - 74, 132, 14, 7, '#fff', '#4a3728');
  ell(ctx, W / 2 - 16, H - 90, 17, 13, '#ff8fab', '#4a3728');
  fillRR(ctx, W / 2 - 24, H - 106, 16, 5, 2.5, '#ff8fab', '#4a3728', 1.5);
  ell(ctx, W / 2 - 16, H - 108, 3.5, 3.5, '#ffd43b', '#4a3728', 1.2);
  for (const dx of [-50, 52]) fillRR(ctx, W / 2 + dx - 8, H - 86, 16, 11, 4, '#fff', '#4a3728', 1.5);
  ctx.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(teaE, W / 2 + 20, H - 86);
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.5 + i * 0.25) % 1,
      x = W / 2 + [-50, 52, -20, -12][i] + Math.sin(p * 6 + i) * 4;
    ctx.globalAlpha = 0.6 * (1 - p);
    ell(ctx, x, H - 94 - (i > 1 ? 22 : 0) - p * 30, 5, 5, '#fff');
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.35 + i / 3) % 1;
    ctx.globalAlpha = 1 - p;
    star(ctx, 40 + i * 110 + Math.sin(p * 5) * 8, 40 - p * 26, 5, '#ffd43b');
  }
  ctx.globalAlpha = 1;
}

/** Созвездия, которых нет ни в одном атласе: название и точки (на канве 320 × 220). */
const SKY = [
  {
    name: 'Большой Хомяк',
    pts: [
      [60, 70],
      [92, 48],
      [128, 60],
      [136, 96],
      [100, 112],
      [66, 100],
      [60, 70],
    ],
  },
  {
    name: 'Семечка',
    pts: [
      [212, 44],
      [236, 70],
      [222, 100],
      [198, 74],
      [212, 44],
    ],
  },
  {
    name: 'Колесо',
    pts: [
      [236, 150],
      [262, 136],
      [286, 152],
      [278, 180],
      [250, 184],
      [236, 150],
    ],
  },
  {
    name: 'Морковка',
    pts: [
      [70, 170],
      [110, 150],
      [150, 160],
      [110, 176],
      [70, 170],
    ],
  },
];

/** Ночное небо в телескоп (канва W × H): мерцающие звёзды, созвездия SKY, падающая звезда, месяц. */
export function paintStars(ctx, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#12123a');
  g.addColorStop(1, '#3b2f6b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * (0.6 + (i % 5) * 0.3) + i));
    ctx.fillStyle = '#fff';
    ctx.fillRect((i * 97) % W, (i * 53) % H, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.font = '800 11px ui-rounded, "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  for (const c of SKY) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    c.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    c.pts.forEach(([x, y], i) => star(ctx, x, y, 4.5 + Math.sin(t * 3 + i + x) * 1.2, '#ffe066'));
    const cx = c.pts.reduce((a, q) => a + q[0], 0) / c.pts.length,
      cy = Math.max(...c.pts.map((q) => q[1]));
    ctx.fillStyle = '#d0bfff';
    ctx.fillText(c.name, cx, cy + 16);
  }
  // падающая звезда
  const p = (t % 4) / 1.2;
  if (p < 1) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - p})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(300 - p * 150, 16 + p * 70);
    ctx.lineTo(320 - p * 150, 6 + p * 70);
    ctx.stroke();
  }
  ell(ctx, 160, 26, 13, 13, '#fff3bf');
  ell(ctx, 166, 22, 11, 11, '#12123a');
}
