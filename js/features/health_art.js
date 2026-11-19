// РИСУНКИ БОЛЕЗНИ (features/health.js) — без логики: простуженная хомячок с кружкой чая (иногда чихает) и приём
// у доктора по шагам (градусник, «скажи а-а-а», витаминка). Когда заболела, что делать и когда здорова — health.js.
import { ell, fillRR, line, star, emoji } from '../core/draw.js';
import { drawHamster, blinkAt } from '../art/hamster.js';

/** Простуженная хомячок (look) на канве W × H; t — секунды с начала: раз в 4,2 с чихает. */
export function paintSick(ctx, W, H, t, look) {
  const sn = (t % 4.2) - 1.6;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#d0ebff';
  ctx.fillRect(0, H - 18, W, 18);
  drawHamster(ctx, W / 2, H - 20, 1.25, look, {
    time: t,
    blink: blinkAt(t),
    sneeze: sn >= 0 && sn < 1.1 ? sn / 1.1 : null,
    shadow: false,
  });
  // кружка с тёплым чаем рядом
  ell(ctx, W / 2 + 94, H - 30, 5, 6, null, '#4a3728', 1.5);
  fillRR(ctx, W / 2 + 70, H - 42, 22, 24, 6, '#fff', '#4a3728', 1.5);
  ell(ctx, W / 2 + 81, H - 30, 4, 4, '#ff8fab');
  for (let i = 0; i < 2; i++) {
    const p = (t * 0.5 + i * 0.5) % 1;
    ctx.globalAlpha = 0.7 * (1 - p);
    ell(ctx, W / 2 + 77 + i * 8 + Math.sin(p * 6 + i) * 3, H - 48 - p * 24, 4, 4, '#a5d8ff');
  }
  ctx.globalAlpha = 1;
}

/**
 * Приём у доктора (канва W × H): кабинет, хомячок (look) на кушетке, доктор (docLook) с зеркальцем и стетоскопом.
 * stage — шаг приёма (DOCTOR_STAGES): 1 — фонарик к ротику, 2 — витаминка, чай и звёздочки.
 */
export function paintDoctor(ctx, W, H, t, stage, look, docLook) {
  ctx.clearRect(0, 0, W, H);
  // кабинет: плакат с крестиком, кушетка
  fillRR(ctx, 18, 16, 46, 46, 8, '#fff', '#4a3728', 1.5);
  ctx.fillStyle = '#fa5252';
  ctx.fillRect(36, 24, 10, 30);
  ctx.fillRect(26, 34, 30, 10);
  ctx.fillStyle = '#c3fae8';
  ctx.fillRect(0, H - 20, W, 20);
  // кушетка: спинка, сиденье, ножки
  fillRR(ctx, 34, H - 92, 112, 50, 10, '#ffd8e4', '#4a3728', 1.5);
  for (const lx of [44, 132]) fillRR(ctx, lx, H - 36, 6, 18, 2, '#adb5bd', '#4a3728', 1.2);
  fillRR(ctx, 30, H - 48, 120, 14, 6, '#fff', '#4a3728', 1.5);
  const happy = stage === 2;
  drawHamster(ctx, 92, H - 44, 1.2, look, {
    time: t,
    dir: 1,
    sit: true,
    blink: blinkAt(t),
    talk: stage === 1,
    happy,
    armsUp: happy && Math.sin(t * 8) > 0.3,
    shadow: false,
  });
  const dx = W - 72,
    dy = H - 20,
    ds = 1.25;
  drawHamster(ctx, dx, dy, ds, docLook, {
    time: t + 1.3,
    dir: -1,
    blink: blinkAt(t, 1.3),
    talk: t % 3 < 1.4,
    shadow: false,
  });
  // зеркальце доктора на лбу и трубка-стетоскоп на шее
  line(ctx, dx - 26 * ds, dy - 66 * ds, dx + 26 * ds, dy - 66 * ds, '#868e96', 2.5);
  ell(ctx, dx - 6 * ds, dy - 67 * ds, 7, 7, '#e9ecef', '#4a3728', 1.5);
  ell(ctx, dx - 6 * ds, dy - 67 * ds, 3, 3, '#fff');
  ctx.strokeStyle = '#495057';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(dx - 12 * ds, dy - 30 * ds);
  ctx.quadraticCurveTo(dx - 16 * ds, dy - 14 * ds, dx - 4 * ds, dy - 12 * ds);
  ctx.stroke();
  ell(ctx, dx - 3 * ds, dy - 12 * ds, 4, 4, '#adb5bd', '#4a3728', 1.2);
  if (stage === 1) {
    // фонарик: лучик к ротику
    ctx.fillStyle = 'rgba(255,224,102,.45)';
    ctx.beginPath();
    ctx.moveTo(dx - 34, dy - 50);
    ctx.lineTo(112, H - 104);
    ctx.lineTo(112, H - 88);
    ctx.closePath();
    ctx.fill();
    fillRR(ctx, dx - 44, dy - 56, 14, 8, 3, '#ffd43b', '#4a3728', 1.2);
  }
  if (stage === 2) {
    emoji(ctx, '🍬', 150 + Math.sin(t * 3) * 3, 70, 22);
    emoji(ctx, '🍵', 176, H - 56, 22);
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.4 + i / 3) % 1;
      ctx.globalAlpha = 1 - p;
      star(ctx, 60 + i * 50 + Math.sin(p * 5) * 8, 70 - p * 30, 5, '#ffd43b');
    }
    ctx.globalAlpha = 1;
  }
}
