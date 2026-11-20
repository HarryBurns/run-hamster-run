// Род героя в текстах: хомячок (он) или хомяшка (она). Пол выбирают при старте новой игры (state.gender: 'm' | 'f').
//
// ОДИН СПОСОБ НА ВСЮ ИГРУ — разметка прямо в строке: «{ему|ей}», первая часть — хомячку, вторая — хомяшке.
//   'Ты наш{ёл|ла} ракушку!'   'Готов{|а}?'   '{Хомячок|Хомяшка} спит'   'Молодец, справил{ся|ась}!'
// Разметку можно писать где угодно: в таблицах data/, в репликах, письмах, заданиях, подсказках, на канве.
// Раскрывает её gx(строка) — и делает это САМ ПОКАЗ, а не автор строки:
//   — el() из core/util.js (почти все окна), подсказки (ui/toast.js), реплики (ui/dialog.js);
//   — «страховочная сетка» installGenderNet(): всё, что попало на страницу или на канву другим путём (textContent,
//     innerHTML, ctx.fillText), раскрывается перед показом. Поэтому сырая разметка до игрока не доходит.
// Самому звать gx() нужно только там, где строку меряют или режут ДО показа (перенос по словам на канве, длина
// текста) или сравнивают с чем-то.
// Слова в скобках — без «{», «}» и «|». Проверка, что нигде не осталось «она» без разметки, — node dev/gender_lint.js.

/** Кто герой сейчас: () => 'm' | 'f'. Ставит core/save.js (читает G.state.gender); до загрузки игры — «она». */
let source = () => 'f';
export function bindGender(fn) {
  source = fn;
}
/** Пол героя: 'm' — хомячок, 'f' — хомяшка (так игра обращалась раньше — и к старым сохранениям). */
export const gender = () => (source() === 'm' ? 'm' : 'f');
export const isBoy = () => gender() === 'm';

const RE = /\{([^{}|]*)\|([^{}|]*)\}/g;
/** Раскрыть разметку «{ему|ей}» в строке под пол героя (who — для кого, если не для героя этой игры). */
export function gx(str, who) {
  if (typeof str !== 'string' || str.indexOf('{') < 0) return str;
  const boy = (who || gender()) === 'm';
  return str.replace(RE, (_, m, f) => (boy ? m : f));
}
/** Короткая запись для кода: gg('купил', 'купила'). */
export const gg = (m, f) => (gender() === 'm' ? m : f);

const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
let net = false;
/**
 * Страховочная сетка: раскрывать разметку во всём, что появляется на странице (текст и подписи-атрибуты) и на канве.
 * Зовётся один раз при запуске (main.js). Текст без «{» проверяется одним indexOf — на скорость не влияет.
 */
export function installGenderNet(root = document.documentElement) {
  if (net || typeof MutationObserver === 'undefined') return;
  net = true;
  const fixText = (n) => {
    const v = n.nodeValue;
    if (v && v.indexOf('{') >= 0) {
      const t = gx(v);
      if (t !== v) n.nodeValue = t;
    }
  };
  const fixAttrs = (e) => {
    for (const a of ATTRS) {
      const v = e.getAttribute(a);
      if (v && v.indexOf('{') >= 0) {
        const t = gx(v);
        if (t !== v) e.setAttribute(a, t);
      }
    }
  };
  const fixTree = (n) => {
    if (n.nodeType === 3) return fixText(n);
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    const tx = n.textContent;
    if (tx && tx.indexOf('{') >= 0) {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) fixText(w.currentNode);
    }
    fixAttrs(n);
    if (n.firstElementChild) for (const e of n.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) fixAttrs(e);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target);
      else for (const n of m.addedNodes) fixTree(n);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  fixTree(root);
  // канва: текст рисуют и меряют только через эти три метода
  const P = typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype;
  if (P)
    for (const k of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[k];
      P[k] = function (text, ...rest) {
        return orig.call(this, typeof text === 'string' && text.indexOf('{') >= 0 ? gx(text) : text, ...rest);
      };
    }
}
