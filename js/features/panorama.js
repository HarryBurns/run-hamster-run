// Подзорная труба на башне: вид на город.
import { makeCanvas, ell, fillRR, poly, mix } from '../core/draw.js';
import { register } from '../core/registry.js';
import { cal, playerLook, darkness } from '../core/state.js';
import { el } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { openPanel } from '../ui/panel.js';

register('panorama', () => openPanorama(), 'подзорная труба: вид на город');

export function openPanorama() {
  openPanel({
    title: 'Подзорная труба: город',
    icon: '🔭',
    cls: 'wide',
    render(body) {
      const w = 900,
        h = 480;
      const { canvas, ctx } = makeCanvas(w, h);
      canvas.className = 'pano';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const c = cal(),
        d = darkness();
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      g.addColorStop(0, mix('#58b9ff', '#151540', d));
      g.addColorStop(1, mix('#ffe8c2', '#4a3a78', d));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (d > 0.5) {
        ell(ctx, 720, 90, 40, 40, '#fff3bf');
        for (let i = 0; i < 50; i++) ell(ctx, (i * 173) % w, (i * 71) % 220, 1.5, 1.5, '#fff');
      } else {
        ell(ctx, 720, 110, 46, 46, '#ffe066');
        for (const [x, y] of [
          [150, 80],
          [420, 130],
          [600, 60],
        ]) {
          ell(ctx, x, y, 50, 18, '#fff');
          ell(ctx, x + 30, y - 12, 34, 16, '#fff');
        }
      }
      ctx.fillStyle = mix('#3fb0ea', '#1c2f6b', d);
      ctx.fillRect(0, 250, w, 90);
      for (let i = 0; i < 30; i++) ell(ctx, (i * 97) % w, 262 + ((i * 31) % 70), 16, 2, 'rgba(255,255,255,.5)');
      ctx.fillStyle = c.season === 'winter' ? '#f3ead2' : '#ffe9a8';
      ctx.fillRect(0, 330, w, 30);
      const grass = { winter: '#f6fbff', spring: '#a8e67a', summer: '#86db5c', autumn: '#cdd36a' }[c.season];
      ctx.fillStyle = grass;
      ctx.fillRect(0, 356, w, 130);
      const cols = ['#f783ac', '#74c0fc', '#ffd43b', '#b2f2bb', '#ffc9de', '#a5d8ff', '#ffe066', '#e5dbff'];
      for (let i = 0; i < 12; i++) {
        const bw = 44 + ((i * 13) % 30),
          bh = 50 + ((i * 37) % 90),
          bx = 40 + i * 72,
          by = 430 - (i % 3) * 12;
        fillRR(ctx, bx, by - bh, bw, bh, 5, cols[i % cols.length], '#4a3728', 2);
        for (let yy = by - bh + 10; yy < by - 12; yy += 16)
          for (let xx = bx + 8; xx < bx + bw - 10; xx += 14) fillRR(ctx, xx, yy, 8, 9, 2, d > 0.4 ? '#ffe066' : '#fff');
        if (i % 2)
          poly(
            ctx,
            [bx - 4, by - bh, bx + bw / 2, by - bh - 22, bx + bw + 4, by - bh],
            c.season === 'winter' ? '#fff' : '#f76e5c',
            '#4a3728',
            2,
          );
      }
      for (let i = 0; i < 9; i++) {
        const px = 30 + i * 105;
        fillRR(ctx, px - 3, 322, 6, 40, 2, '#c98b5a');
        for (let k = 0; k < 5; k++)
          ell(
            ctx,
            px + Math.cos(-0.2 - k * 0.7) * 16,
            322 + Math.sin(-0.2 - k * 0.7) * 10,
            16,
            5,
            c.season === 'winter' ? '#fff' : '#40c057',
            null,
            1,
            -0.2 - k * 0.7,
          );
      }
      fillRR(ctx, 0, h - 26, w, 26, 0, '#868e96');
      for (let x = 10; x < w; x += 40) fillRR(ctx, x, h - 70, 6, 50, 2, '#adb5bd');
      fillRR(ctx, 0, h - 76, w, 10, 4, '#dee2e6', '#4a3728', 2);
      drawHamster(ctx, 130, h - 22, 1.5, playerLook(), { happy: true, armsUp: true });
      body.appendChild(canvas);
      body.appendChild(el('p', 'center', `Ух ты! Отсюда видно весь город, пляж и даже твою виллу. ${c.seasonIcon}`));
    },
  });
}
