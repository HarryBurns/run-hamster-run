// Рисованные значки вещей в окнах и подсказках (этап 12). У вещи с рисованным значком в поле `e` — особая буква
// (data/icons.js). Игра вставляет её в текст как обычный эмодзи (карточка рюкзака, строка рынка, подсказка «+1 …»,
// окно награды, рецепт) — а этот модуль следит за страницей и заменяет каждую такую букву на картинку из art/items.js.
// Так значок появляется везде сам, и там, где он пока не нарисован, остаётся обычный эмодзи.
// Картинка — <img class="ico"> высотой с букву (размер берёт от шрифта вокруг: 1.2em), alt — запасной эмодзи.
import { ICON_RE, iconName, iconFallback } from '../data/icons.js';
import { itemIconURL, hasItemArt } from '../art/items.js';

const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1 };
/** Картинка значка для страницы. */
export function itemIconImg(name) {
  const img = document.createElement('img');
  img.className = 'ico';
  img.alt = iconFallback(name);
  img.draggable = false;
  img.dataset.ico = name;
  img.src = itemIconURL(name);
  return img;
}
function fixText(node) {
  const str = node.nodeValue;
  if (!str || !ICON_RE.test(str)) return;
  const parent = node.parentNode;
  if (!parent || SKIP[parent.nodeName]) return;
  const frag = document.createDocumentFragment();
  for (const part of str.split(/([\uE000-\uE0FF])/)) {
    if (!part) continue;
    const name = ICON_RE.test(part) && iconName(part);
    if (name && hasItemArt(name)) frag.appendChild(itemIconImg(name));
    else frag.appendChild(document.createTextNode(name ? iconFallback(name) : part));
  }
  parent.replaceChild(frag, node);
}
function fixTree(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
  if (!ICON_RE.test(root.textContent)) return; // обычно значков нет — выходим сразу
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
    list = [];
  while (walker.nextNode()) list.push(walker.currentNode);
  list.forEach(fixText);
}
let installed = false;
/** Включить замену букв-значков на картинки во всей странице (один раз, при запуске игры). */
export function installItemIcons() {
  if (installed || typeof MutationObserver === 'undefined') return;
  installed = true;
  fixTree(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') fixText(m.target);
      else for (const n of m.addedNodes) fixTree(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
