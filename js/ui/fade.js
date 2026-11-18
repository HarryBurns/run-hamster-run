// Затемнение экрана.
//   fadeTo(надпись, мс)   затемнение с надписью (сон, переход по карте): Promise с функцией, которая его снимает
//   fadeScene({...})      сценка в затемнении — картинка с анимацией и подпись (поездки: канатная дорога, автобус,
//                         грот, кораблики; спа в отеле; праздничные сценки): Promise, который выполнится, когда
//                         затемнение снято. Слои паузы снимаются всегда — даже если рисунок или переход упадёт.
import { makeCanvas } from '../core/draw.js';
import { playerLook } from '../core/state.js';
import { el } from '../core/util.js';
import { openLayer } from './modals.js';

export function fadeTo(msg, ms = 1500) {
  return new Promise((resolve) => {
    const f = el('div', 'fade', `<div class="msg">${msg}</div>`);
    document.body.appendChild(f);
    const closeLayer = openLayer();
    requestAnimationFrame(() => f.classList.add('on'));
    let uncover = null;
    const tc = setTimeout(() => {
      uncover = openLayer({ pause: false, cover: true });
    }, 450); // экран уже тёмный — сцену под ним не рисуем
    setTimeout(() => {
      resolve(() => {
        clearTimeout(tc);
        if (uncover) uncover();
        f.classList.remove('on');
        setTimeout(() => {
          f.remove();
          closeLayer();
        }, 380);
      });
    }, ms);
  });
}

/** Плавный разгон и торможение: 0..1 → 0..1. */
export const smooth = (p) => p * p * (3 - 2 * p);

/**
 * Сценка в затемнении: окно с картинкой (канва шириной до w, высотой w × ratio) и подписью text поверх игры, мир на
 * паузе. paint(ctx, w, h, p, look, t) рисует кадр: p — 0..1 доля сценки (ms мс), look — наряд хомячка, t — секунды.
 * cls — свой класс окна. go — поездка: с 400 мс сцену под затемнением не рисуем, за 300 мс до конца — go() (переход
 * в другое место), затемнение снимается через 150 мс после конца. Promise выполняется, когда затемнение снято.
 */
export function fadeScene({ cls = '', text, paint, ms, w = 560, ratio = 0.56, go = null }) {
  return new Promise((resolve) => {
    const W = Math.min(w, window.innerWidth - 32),
      H = Math.round(W * ratio);
    const f = el(
      'div',
      `fade cable-ride${cls ? ' ' + cls : ''}`,
      `<div class="msg"><div><div class="ride-pic"></div><p>${text}</p></div></div>`,
    );
    const { canvas, ctx } = makeCanvas(W, H);
    canvas.style.borderRadius = '18px';
    f.querySelector('.ride-pic').appendChild(canvas);
    document.body.appendChild(f);
    const closeLayer = openLayer();
    let uncover = null,
      raf = 0;
    const t0 = performance.now(),
      look = playerLook();
    const loop = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      raf = 0;
      paint(ctx, W, H, p, look, (now - t0) / 1000);
      ctx.globalAlpha = 1;
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => f.classList.add('on'));
    const tc = go
      ? setTimeout(() => {
          uncover = openLayer({ pause: false, cover: true }); // экран уже тёмный — сцену под ним не рисуем
        }, 400)
      : 0;
    if (go) setTimeout(go, ms - 300);
    // сторож пауз: что бы ни случилось с рисунком или переходом, слои снимутся и Promise выполнится
    setTimeout(
      () => {
        try {
          cancelAnimationFrame(raf);
          clearTimeout(tc);
          if (uncover) uncover();
          f.classList.remove('on');
        } finally {
          setTimeout(() => {
            try {
              f.remove();
            } finally {
              closeLayer();
              resolve();
            }
          }, 380);
        }
      },
      go ? ms + 150 : ms,
    );
  });
}
