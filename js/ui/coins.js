// Отклик на изменение счёта: рядом с числом монет всплывает «+350» или «−120», а само число вздрагивает.
// Заметно, но не мешает: ничего не закрывает и не требует нажатий.
//
// Число монет показывают HUD (плашка сверху) и окна с ценами (магазины, рынок). Каждый, кто его показывает,
// называет себя: moneyAnchor(элемент) → функция «больше не показываю». Отклик появляется у того, кто назвался
// последним, — то есть у открытого окна, а если окон с монетами нет — у плашки HUD.
import { on } from '../core/events.js';
import { G } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';

const anchors = []; // элементы с числом монет: первый — плашка HUD, дальше — окна в порядке открытия

/** Сообщить, что в этом элементе показано число монет. Возвращает функцию, которая это отменяет. */
export function moneyAnchor(elem) {
  anchors.push(elem);
  return () => {
    const i = anchors.indexOf(elem);
    if (i >= 0) anchors.splice(i, 1);
  };
}

function fly(anchor, delta) {
  // вздрогнуть: класс снимаем и ставим заново, чтобы анимация началась сначала и при частых покупках
  anchor.classList.remove('bump');
  void anchor.offsetWidth;
  anchor.classList.add('bump');
  const r = anchor.getBoundingClientRect();
  const f = el(
    'div',
    'money-fly ' + (delta > 0 ? 'plus' : 'minus'),
    (delta > 0 ? '+' : '−') + fmtMoney(Math.abs(delta)),
  );
  f.style.left = r.left + r.width / 2 + 'px';
  f.style.top = r.bottom + 2 + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

on('money', ({ delta }) => {
  if (!delta) return;
  const anchor = anchors.filter((a) => a.isConnected).pop();
  if (!anchor) return;
  // плашку HUD не видно под мини-игрой и другими окнами во весь экран — там о монетах говорит само окно
  if (anchor === anchors[0] && G.cover > 0) return;
  fly(anchor, delta);
});
