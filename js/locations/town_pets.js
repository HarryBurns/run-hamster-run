// ПРИЮТ «ТЁПЛЫЕ ЛАПКИ» (этап 17б) — здание города (вид shelter): отсюда хомячок берёт питомца (features/pet.js,
// действие shelter). В витрине — котёнок и крольчонок, над дверью — сердечко с лапкой, у стены — миски.
import { ell, fillRR, heart } from '../core/draw.js';
import { drawPet } from '../art/pets.js';
import { OUT, doorX, defineBuildings } from '../engine/topdown/kinds.js';
import { shopBody, showcase, door, facadeLights } from './common/buildings.js';
import { signBoard } from './common/paint.js';

function paw(ctx, x, y, s, col) {
  ell(ctx, x, y + 2 * s, 4.2 * s, 3.4 * s, col);
  for (const [dx, dy] of [
    [-4.4, -2.4],
    [-1.5, -4.8],
    [1.5, -4.8],
    [4.4, -2.4],
  ])
    ell(ctx, x + dx * s, y + dy * s, 1.5 * s, 1.9 * s, col);
}

function paintShelter(ctx, b, snow, lit) {
  const g = shopBody(ctx, b, snow, { roofH: 56 }),
    { X, W, bot, cx } = g,
    wh = bot - g.wy - 16;
  // витрина: два зверька на подушках
  showcase(ctx, X + 14, g.wy, 96, wh, lit, (c, x, y, w, h) => {
    for (const [kind, dx, col] of [
      ['kitten', 26, '#ffc9de'],
      ['bunny', 70, '#b2f2bb'],
    ]) {
      fillRR(c, x + dx - 19, y + h - 12, 38, 12, 5, col, OUT, 1.4);
      c.save();
      c.translate(x + dx - 3, y + h - 9);
      c.scale(1.15, 1.15);
      drawPet(c, kind, { mood: 'ok', wag: 0.2 });
      c.restore();
    }
  });
  door(ctx, cx + doorX(b), bot, 34, 64, '#ff922b', { glass: true, lit, frame: '#fff8ec' });
  // миски у двери
  for (const [dx, col] of [
    [W - 26, '#74c0fc'],
    [W - 12, '#ff8fab'],
  ]) {
    ell(ctx, X + dx, bot - 5, 6.5, 3.2, col, OUT, 1.4);
    ell(ctx, X + dx, bot - 6.5, 4.6, 1.8, '#fff3d6');
  }
  // следы лапок на стене
  paw(ctx, X + W - 20, g.wy + 4, 1.1, 'rgba(255,146,43,.55)');
  paw(ctx, X + W - 34, g.wy + 18, 0.9, 'rgba(255,146,43,.45)');
  signBoard(ctx, `${b.icon || ''} ${b.name || ''}`.trim(), cx, g.top + 28, W - 12, 26, 'plate', '#e8590c', false, true);
  // сердечко с лапкой над вывеской
  heart(ctx, cx, g.top - 12, 12, '#ff6b9d');
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2;
  ctx.stroke();
  paw(ctx, cx, g.top - 12, 0.9, '#fff');
}

defineBuildings({
  shelter: {
    paint: paintShelter,
    doorX: 42,
    box: (b) => [-44, -64, b.w * 48 + 44, b.h * 48 + 16],
    lights: (b) => facadeLights(b),
    icon: '🐾',
  },
});
