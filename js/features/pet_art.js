// РИСУНКИ ПИТОМЦА (features/pet.js) — без логики: кадр питомца (повёрнутый и в нужном размере), миска и мячик рядом,
// облачко «хочу есть», всплывающие сердечки. Что и когда рисовать (где питомец, что он делает, какой кадр), решает
// pet.js. Сам питомец (котёнок, щенок, крольчонок, ёжик) — art/pets.js.
import { ell, heart, line } from '../core/draw.js';
import { drawPet } from '../art/pets.js';

/** Кадр питомца kind: dir — куда смотрит (1 / −1), pose — поза drawPet, k — размер. */
export function paintPet(c, kind, dir, pose, k = 1) {
  c.save();
  c.scale(dir * k, k);
  drawPet(c, kind, pose);
  c.restore();
}

/**
 * Миска с кормом и мячик — рядом с питомцем e ({ fx, dir, sc }). (x, y) — где питомец, k — размер, side — дома
 * (там мячик катится по полу этажа, а не летит по карте).
 */
export function drawProps(ctx, e, x, y, k, side) {
  const fx = e.fx;
  if (!fx) return;
  if (fx.kind === 'feed') {
    const bx = x + e.dir * 19 * k;
    ell(ctx, bx, y - 3 * k, 8 * k, 4 * k, '#74c0fc', '#4a3728', 1.6);
    if (fx.t / fx.dur < 0.75) ell(ctx, bx, y - 5 * k, 5.6 * k, 2.4 * k, '#c98b5a');
  } else if (fx.kind === 'play') {
    const q = fx.t / fx.dur;
    let bx, by, up;
    if (q < 0.3) {
      // летит от хомячка к месту
      const a = q / 0.3,
        from = side ? { x: e.sc.p.x, y: 0 } : { x: e.sc.p.x, y: e.sc.p.y };
      bx = from.x + (fx.to.x - from.x) * a;
      by = (side ? y : from.y + (fx.to.y - from.y) * a) - 4 * k;
      up = Math.sin(a * Math.PI) * 46 * k;
    } else if (q < 0.6) {
      bx = fx.to.x;
      by = (side ? y : fx.to.y) - 4 * k;
      up = 0;
    } else {
      bx = x + e.dir * 13 * k;
      by = y - 12 * k;
      up = 0;
    }
    ell(ctx, bx, y - 1 + (side ? 0 : by - y + 4 * k), 5 * k, 2 * k, 'rgba(52,38,70,.17)');
    ell(ctx, bx, by - up, 4.6 * k, 4.6 * k, '#c0eb75', '#4a3728', 1.5);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(bx - 3 * k, by - up, 4 * k, -0.7, 0.7);
    ctx.stroke();
  }
}

/** Облачко с миской над питомцем: проголодался. */
export function drawBubble(ctx, x, y, t) {
  const by = y + Math.sin(t * 3) * 2;
  ell(ctx, x + 14, by - 12, 13, 11, '#fff', '#4a3728', 1.8);
  ell(ctx, x + 5, by + 1, 3, 3, '#fff', '#4a3728', 1.4);
  ell(ctx, x + 14, by - 10, 7, 3.4, '#74c0fc', '#4a3728', 1.3);
  ell(ctx, x + 14, by - 11.4, 4.8, 1.8, '#fff8ec');
  line(ctx, x + 11, by - 17, 11.6 + x, by - 19.5, '#4a3728', 1);
  line(ctx, x + 14, by - 17.5, 14 + x, by - 20.5, '#4a3728', 1);
  line(ctx, x + 17, by - 17, 16.4 + x, by - 19.5, '#4a3728', 1);
}

/** Всплывающие сердечки list ([{ x, y, t, side }]) — те, что в доме (side) или в локации. */
export function drawHearts(ctx, list, side) {
  for (const q of list) {
    if (q.side !== side || q.t < 0) continue;
    const k = q.t / 1.2;
    ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 1.8));
    heart(ctx, q.x + Math.sin(q.t * 5 + q.x) * 4, q.y - k * 46 * (side ? 1.5 : 1), (side ? 9 : 6) + k * 2, '#ff5c8a');
  }
  ctx.globalAlpha = 1;
}
