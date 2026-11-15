// Подзорная труба на башне: вид на город.
//
// Картинка складывается из тех же слоёв, что и вид со смотровой площадки (interiors/tower_view.js): небо, море
// с островами, пляж с пальмами набережной, дальние кварталы, площадь, крыши у башни. Слои идут строго от дальнего
// к ближнему, поэтому пальмы набережной всегда позади домов, которые ближе к зрителю, а город тот же, что на карте.
import { makeCanvas, fillRR } from '../core/draw.js';
import { register } from '../core/registry.js';
import { G, cal, playerLook, darkness } from '../core/state.js';
import { el } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { openPanel } from '../ui/panel.js';
import { VIEW_H, VIEW_LAYERS, viewEnv, renderViewLayer, paintViewLive } from '../interiors/tower_view.js';

register('panorama', () => openPanorama(), 'подзорная труба: вид на город');

const W = 900,
  H = 480,
  FLOOR = 26, // пол площадки внизу картинки
  TOP = 30; // сколько неба срезано сверху (в единицах панорамы)
// Чем дальше слой, тем сильнее он сжат по ширине: улицы сходятся вдаль, а по краям видны пустыня и лес.
const ZOOM = { sky: 1, sea: 0.7, beach: 0.75, far: 0.8, mid: 0.87, near: 0.94 };

export function openPanorama() {
  openPanel({
    title: 'Подзорная труба: город',
    icon: '🔭',
    cls: 'wide',
    render(body) {
      const { canvas, ctx } = makeCanvas(W, H);
      canvas.className = 'pano';
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const c = cal(),
        env = viewEnv(c.season, darkness()),
        m = (H - FLOOR) / (VIEW_H - TOP), // CSS-пикселей в единице панорамы
        k = (m * canvas.width) / W, // и пикселей канвы
        L = W / m,
        dy = Math.round(TOP * k);
      for (const l of VIEW_LAYERS) {
        const img = renderViewLayer(l, L, env, k, ZOOM[l.id]);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(img.c, 0, img.top - dy);
        if (l.live) {
          ctx.setTransform(k, 0, 0, k, 0, -dy);
          paintViewLive(ctx, l, L, env, G.time, ZOOM[l.id]);
        }
      }
      ctx.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
      if (env.d > 0) {
        ctx.fillStyle = `rgba(24,24,72,${env.d * 0.25})`;
        ctx.fillRect(0, 0, W, H);
      }
      // ограждение площадки и сама хомячок — ближе всего
      fillRR(ctx, 0, H - FLOOR, W, FLOOR, 0, '#868e96');
      for (let x = 10; x < W; x += 40) fillRR(ctx, x, H - 70, 6, 50, 2, '#adb5bd');
      fillRR(ctx, 0, H - 76, W, 10, 4, '#dee2e6', '#4a3728', 2);
      drawHamster(ctx, 56, H - 20, 1.2, playerLook(), { happy: true, armsUp: true }); // с краю: не заслонять город
      body.appendChild(canvas);
      body.appendChild(
        el(
          'p',
          'center',
          `Ух ты! Отсюда видно весь город: рынок на площади, парк с прудом, пляж с пирсом и острова в море. А справа, под красной крышей, — твоя вилла! ${c.seasonIcon}`,
        ),
      );
    },
  });
}
