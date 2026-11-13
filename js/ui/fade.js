// Затемнение экрана с надписью (сон). fadeTo() возвращает Promise с функцией, которая снимает затемнение.
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
