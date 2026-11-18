// КУПАНИЕ НА МЕСТЕ (горячий источник на горе, заводь под водопадом в джунглях): хомячок сидит в воде по шейку —
// способ передвижения ride с bath: true (стоит на месте, рисуется в воде, круги по воде). Вылезти — нажатие куда
// угодно, E, стрелка (или WASD) или кнопка «🧺 Вылезти»: тогда он встаёт на бережок.
//   const bath = bathSpot({ at: [x, y], stand: [x, y], extra(ctx, e, t) — что дорисовать (пар, брызги), keys })
//   bath.start(sc) — окунуться; bath.end(sc) — вылезти (false — и так не в воде); bath.isIn(sc) — в воде ли;
//   bath.update(sc) — для крюка update (стрелки — вылезти); bath.button(sc) — кнопка «Вылезти» или null.
import { ell } from '../../core/draw.js';
import { keys } from '../../core/input.js';
import { drawHamster, blinkAt } from '../../art/hamster.js';
import { T, PS } from '../../engine/topdown/index.js';

const OUT_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'];

export function bathSpot({ at, stand, extra = null, keys: outKeys = OUT_KEYS }) {
  const isIn = (sc) => !!(sc.p.ride && sc.p.ride.bath);
  function start(sc) {
    const p = sc.p;
    p.path = [];
    p.pending = null;
    p.x = at[0] * T;
    p.y = at[1] * T;
    p.dir = 1;
    p.ride = {
      bath: true,
      speed: 0,
      pass: () => false,
      draw(ctx, _sc, e, t, look) {
        ell(ctx, e.x, e.y - 18, 30, 10, 'rgba(255,255,255,.45)');
        drawHamster(ctx, e.x, e.y + 6, PS, look, { time: t, dir: 0, clipBelow: -34, happy: true, blink: blinkAt(t) });
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y - 20, 26 + Math.sin(t * 3) * 3, 8, 0, 0, Math.PI);
        ctx.stroke();
        if (extra) extra(ctx, e, t);
      },
      drop: (s) => end(s),
    };
  }
  function end(sc) {
    if (!isIn(sc)) return false;
    sc.p.ride = null;
    sc.p.x = stand[0] * T;
    sc.p.y = stand[1] * T;
    return true;
  }
  return {
    isIn,
    start,
    end,
    update(sc) {
      if (isIn(sc) && outKeys.some((k) => keys.has(k))) end(sc);
    },
    button: (sc) => (isIn(sc) ? { id: 'bath', icon: '🧺', label: 'Вылезти', fn: () => end(sc) } : null),
  };
}
