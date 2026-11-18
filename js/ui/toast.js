// Подсказки — короткие сообщения вверху экрана, которые исчезают сами.
// Пока открыто окно (класс win-open у body ставит ui/panel.js), подсказки встают на нижний край шапки (и вкладок)
// верхнего окна, компактнее и не больше двух — заголовок и ✕ окна остаются на виду, кнопки внизу окна тоже (Ф2),
// и первая строка окна не прячется.
import { setFlag, setDayFlag } from '../core/actions.js';
import { el } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';

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

/**
 * Подсказка один раз за игру: если отметки flag ещё нет — поставить её и показать toast(text, kind) (через delay мс,
 * если delay задан). true — подсказку показали.
 */
export function hintOnce(flag, text, kind = '', delay = 0) {
  const s = G.state;
  if (!s || s.flags[flag]) return false;
  setFlag(flag);
  if (delay) setTimeout(() => toast(text, kind), delay);
  else toast(text, kind);
  return true;
}
/** Подсказка один раз в день: отметка дня flag в группе group (по умолчанию warn; null — без группы). true — показали. */
export function hintToday(flag, text, kind = '', group = 'warn') {
  const s = G.state;
  if (!s || ((group ? s.dayFlags[group] : s.dayFlags) || {})[flag]) return false;
  setDayFlag(flag, 1, group);
  toast(text, kind);
  return true;
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
  // подсказка «сидит» на нижнем краю шапки: верхняя половина — на шапке под заголовком (он по центру шапки, выше),
  // нижняя — на отступе окна, первая строка окна (заголовок раздела, «Причёска» в салоне) остаётся видна; у окна
  // с вкладками — чуть заходит на низ вкладок (надписи на них выше)
  const first = toastBox.children[Math.max(0, toastBox.children.length - 2)], // верхняя из видимых (их не больше двух)
    h = first ? first.offsetHeight : 28;
  toastBox.style.top = Math.round(top - (tabs ? 10 : Math.min(16, h * 0.5))) + 'px';
}
addEventListener('resize', placeToasts);
