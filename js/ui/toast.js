// Подсказки — короткие сообщения вверху экрана, которые исчезают сами.
// Пока открыто окно (класс win-open у body ставит ui/panel.js), подсказки встают сразу под шапкой (и вкладками)
// верхнего окна, компактнее и не больше двух — заголовок и ✕ окна остаются на виду, кнопки внизу окна тоже (Ф2).
import { el } from '../core/util.js';
import { sfx } from '../core/audio.js';

let toastBox = null;
export function toast(msg, kind = '') {
  if (!toastBox) {
    toastBox = el('div');
    toastBox.id = 'toasts';
    document.body.appendChild(toastBox);
  }
  if (msg.startsWith('Новая наклейка')) sfx('sticker');
  const t = el('div', 'toast ' + kind, msg);
  toastBox.appendChild(t);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  placeToasts();
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

/** Поставить подсказки под шапку верхнего открытого окна (или на обычное место, если окон нет). */
export function placeToasts() {
  if (!toastBox) return;
  const panels = document.querySelectorAll('.overlay > .panel'),
    p = panels[panels.length - 1];
  if (!p || !document.body.classList.contains('win-open')) {
    toastBox.style.top = '';
    return;
  }
  // offsetTop/offsetHeight не зависят от анимации появления окна (transform: scale)
  const head = p.querySelector('.panel-head'),
    tabs = p.querySelector(':scope > .tabs');
  const top = p.parentElement.offsetTop + p.offsetTop + (head ? head.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
  toastBox.style.top = top + 6 + 'px';
}
addEventListener('resize', placeToasts);
