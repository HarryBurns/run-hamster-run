// Подсказки — короткие сообщения вверху экрана, которые исчезают сами.
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
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}
