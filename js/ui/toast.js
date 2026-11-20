// Подсказки — короткие сообщения вверху экрана, которые исчезают сами — не раньше, чем их успеет прочитать ребёнок
// (по длине текста, toast ниже); касание убирает подсказку, мышь или палец на ней — придерживают.
// Пока открыто окно (класс win-open у body ставит ui/panel.js), подсказки встают на нижний край шапки (и вкладок)
// верхнего окна, компактнее и не больше двух — заголовок и ✕ окна остаются на виду, кнопки внизу окна тоже (Ф2),
// и первая строка окна не прячется.
import { setFlag, setDayFlag } from '../core/actions.js';
import { el, readSec } from '../core/util.js';
import { devToasts } from '../core/dev.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';

let toastBox = null;
const MAX = 3; // на экране не больше трёх (при открытом окне видно две — style.css)
const FADE = 400; // мс: тает (.toast.out)
/**
 * Показать подсказку msg (kind: '' | 'good'). Висит столько, сколько нужно медленно читающему ребёнку 8–10 лет
 * (readSec: 3,5–12 с по длине текста); касание или щелчок — убрать раньше; пока на ней мышь или палец — не тает
 * (отпустили — ещё хотя бы 1,5 с). Та же подсказка ещё на экране — она не повторяется, а показывается заново.
 * Пришла четвёртая — самая старая сразу тает, а старшая из оставшихся — не дольше 2 с: новые не ждут и не теряются.
 * Для автотеста (devToasts.fast, core/dev.js) — по-старому: 2,6 с и сквозь подсказку можно нажимать.
 */
export function toast(msg, kind = '') {
  if (!toastBox) {
    toastBox = el('div');
    toastBox.id = 'toasts';
    document.body.appendChild(toastBox);
  }
  if (msg.startsWith('Новая наклейка')) sfx('sticker');
  const fast = devToasts.fast;
  toastBox.classList.toggle('fast', fast);
  if (fast) {
    const t = el('div', 'toast ' + kind, msg);
    toastBox.appendChild(t);
    while (toastBox.children.length > MAX) toastBox.firstChild.remove();
    placeToasts();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
    return;
  }
  const ms = readSec(msg) * 1000;
  const same = live().find((t) => t._q.msg === msg && t._q.kind === kind);
  if (same) {
    toastBox.appendChild(same); // наверх стопки — как новая
    arm(same, ms);
    placeToasts();
    return;
  }
  const t = el('div', 'toast ' + kind, msg);
  t._q = { msg, kind, held: 0, end: 0, left: 0, tm: 0, gone: false, down: 0 };
  t.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    t._q.down = performance.now();
    holdOn(t, 'press', true);
  });
  const up = () => holdOn(t, 'press', false);
  t.addEventListener('pointerup', up);
  t.addEventListener('pointercancel', up);
  t.addEventListener('click', (e) => {
    e.stopPropagation();
    // короткое касание — «прочитала, убери»; долго держала палец — читала, пусть ещё повисит
    if (performance.now() - t._q.down < 600) fade(t);
  });
  const old = live();
  if (old.length >= MAX) fade(old[0], true);
  toastBox.appendChild(t);
  arm(t, ms);
  const rest = live();
  if (rest.length >= MAX) arm(rest[0], Math.min(left(rest[0]), 2000));
  placeToasts();
}
const live = () => (toastBox ? [...toastBox.children].filter((t) => t._q && !t._q.gone) : []);
const left = (t) => (t._q.held ? t._q.left : Math.max(0, t._q.end - performance.now()));
/** Подсказка t растает через ms (если её сейчас не держат — иначе после того, как отпустят). */
function arm(t, ms) {
  const q = t._q;
  clearTimeout(q.tm);
  q.left = ms;
  q.end = performance.now() + ms;
  if (!q.held) q.tm = setTimeout(() => fade(t), ms);
}
/** Придержать подсказку (why: 'hover' — мышь над ней, 'press' — нажата) или отпустить. */
function holdOn(t, why, on) {
  const q = t._q;
  if (!q || q.gone) return;
  const bit = why === 'press' ? 1 : 2,
    was = q.held;
  q.held = on ? q.held | bit : q.held & ~bit;
  if (!was && q.held) {
    q.left = Math.max(0, q.end - performance.now());
    clearTimeout(q.tm);
  } else if (was && !q.held) arm(t, Math.max(q.left, 1500));
}
function fade(t, now) {
  const q = t._q;
  if (!q || q.gone) return;
  q.gone = true;
  clearTimeout(q.tm);
  t.classList.add('out');
  setTimeout(() => t.remove(), now ? FADE / 2 : FADE);
}
// мышь над подсказкой — не тает. По прямоугольнику, а не по событиям самой подсказки: при открытом окне сквозь
// подсказки можно нажимать (pointer-events: none — вкладки и ✕ под ними), а придержать мышью всё равно можно
addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType !== 'mouse' || !toastBox || !toastBox.firstChild) return;
    for (const t of live()) {
      const r = t.getBoundingClientRect();
      holdOn(t, 'hover', !!r.width && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom); // prettier-ignore
    }
  },
  { passive: true },
);
/** Для автотеста: подсказки на экране — текст, сколько ещё будут видны (мс) и придержаны ли. */
export function toastsInfo() {
  return live().map((t) => ({ text: t.textContent, left: Math.round(left(t)), held: !!t._q.held }));
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

/**
 * Нижний край плашек HUD сверху (дата, монеты, письмо, журнал), которые сейчас видно (0 — не видно ни одной: заставка,
 * мини-игра или пианино поверх). На телефоне плашки в два-три ряда — ниже обычного места подсказок.
 */
function hudBottom() {
  const top = document.querySelector('#hud .hud-top');
  if (!top) return 0;
  let b = 0;
  for (const c of top.children) {
    const r = c.getBoundingClientRect();
    if (c.hidden || !r.height) continue;
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (at && top.contains(at)) b = Math.max(b, r.bottom);
  }
  return b;
}

/**
 * Поставить подсказки под шапку верхнего открытого окна, а если окон нет — на обычное место, но не на плашки HUD
 * (на телефоне они в несколько рядов, и подсказка ложилась на плашку письма — З18).
 */
export function placeToasts() {
  if (!toastBox) return;
  const panels = document.querySelectorAll('.overlay > .panel'),
    p = panels[panels.length - 1];
  if (!p || !document.body.classList.contains('win-open')) {
    toastBox.style.top = '';
    const b = hudBottom();
    if (b && b + 6 > toastBox.getBoundingClientRect().top) toastBox.style.top = Math.round(b + 6) + 'px';
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
