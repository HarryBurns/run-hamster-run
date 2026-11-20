// Подсказки — короткие сообщения вверху экрана, которые исчезают сами — не раньше, чем их успеет прочитать ребёнок
// (по длине текста, toast ниже); касание убирает подсказку, мышь или палец на ней — придерживают.
// Пока открыто окно (класс win-open у body ставит ui/panel.js), подсказки компактнее, не больше двух и встают рядом
// с верхним окном — над ним или под ним, а окну во весь экран — внизу, над кнопками (placeToasts): шапка, ✕, вкладки
// и первые строки окна (экран телевизора) остаются на виду (Ф2, П20-6).
import { setFlag, setDayFlag } from '../core/actions.js';
import { el, readSec } from '../core/util.js';
import { devToasts } from '../core/dev.js';
import { sfx } from '../core/audio.js';
import { G } from '../core/state.js';

let toastBox = null;
const MAX = 3; // на экране не больше трёх (при открытом окне видно две — style.css)
const FADE = 400; // мс: тает (.toast.out)
// Подсказка-указатель («Нажми на …», «нажимай», «жми») — живёт короче (не дольше POINT_MS) и тает, как только нажали
// куда-нибудь мимо неё (туда, куда она звала, — П20-7): нажатия при открытом окне проходят сквозь подсказку, и висеть
// над окном ещё 12 с ей незачем. Сразу после появления (POINT_MIN) нажатие не убирает её, а оставляет ещё 1,5 с.
const POINT = /(^|[^а-яё])(нажм|нажим|жми)/i,
  POINT_MS = 7000,
  POINT_MIN = 1500;
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
  const point = POINT.test(msg),
    ms = Math.min(readSec(msg) * 1000, point ? POINT_MS : 1e9);
  const same = live().find((t) => t._q.msg === msg && t._q.kind === kind);
  if (same) {
    toastBox.appendChild(same); // наверх стопки — как новая
    same._q.born = performance.now();
    arm(same, ms);
    placeToasts();
    return;
  }
  const t = el('div', 'toast ' + kind, msg);
  t._q = { msg, kind, held: 0, end: 0, left: 0, tm: 0, gone: false, down: 0, point, born: performance.now() };
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
  setTimeout(
    () => {
      t.remove();
      if (document.body.classList.contains('win-open')) placeToasts(); // над окном: оставшаяся — вплотную к окну
    },
    now ? FADE / 2 : FADE,
  );
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
// нажали мимо подсказки-указателя — она сделала своё дело (в автотесте, devToasts.fast, — как раньше)
addEventListener(
  'pointerdown',
  (e) => {
    if (!toastBox || !toastBox.firstChild) return;
    for (const t of live()) {
      if (!t._q.point || t.contains(e.target)) continue;
      if (performance.now() - t._q.born >= POINT_MIN) fade(t);
      else if (!t._q.held) arm(t, Math.min(left(t), POINT_MIN));
    }
  },
  { capture: true, passive: true },
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
 * Поставить подсказки рядом с верхним открытым окном так, чтобы они не закрывали его шапку (заголовок, ✕, вкладки)
 * и первые строки (экран телевизора, П20-6): над окном, если там хватает места (плашки HUD под затемнением окна можно
 * закрыть), иначе под окном; не помещаются обе — только новая (старшая прячется, класс tuck); совсем нет места
 * (окно во весь экран) — внизу окна, над его кнопками. Без окон — на обычное место, но не на плашки HUD (на телефоне
 * они в несколько рядов, и подсказка ложилась на плашку письма — З18).
 */
export function placeToasts() {
  if (!toastBox) return;
  const panels = document.querySelectorAll('.overlay > .panel'),
    p = panels[panels.length - 1];
  for (const t of toastBox.children) t.classList.remove('tuck');
  if (!p || !document.body.classList.contains('win-open')) {
    toastBox.style.top = '';
    const b = hudBottom();
    if (b && b + 6 > toastBox.getBoundingClientRect().top) toastBox.style.top = Math.round(b + 6) + 'px';
    return;
  }
  watchPanel(p);
  // offsetTop/offsetHeight не зависят от анимации появления окна (transform: scale)
  const top = p.parentElement.offsetTop + p.offsetTop,
    bottom = top + p.offsetHeight,
    H = innerHeight,
    // сверху — не под «чёлку» телефона: у окна-подложки отступ 10px + safe-area-inset-top (style.css, .overlay)
    safe = Math.max(4, (parseFloat(getComputedStyle(p.parentElement).paddingTop) || 10) - 6),
    GAP = 6;
  const put = () => {
    const h = toastBox.offsetHeight;
    if (!h) return true;
    if (top - GAP - h >= safe) toastBox.style.top = Math.round(top - GAP - h) + 'px';
    else if (bottom + GAP + h <= H - 4) toastBox.style.top = Math.round(bottom + GAP) + 'px';
    else return false;
    return true;
  };
  if (put()) return;
  // обе не помещаются — видна только новая (старшая и так скоро растает)
  const vis = [...toastBox.children].filter((t) => getComputedStyle(t).display !== 'none');
  for (const t of vis.slice(0, -1)) t.classList.add('tuck');
  if (put()) return;
  // окно во весь экран: внизу окна, над его кнопками (их и шапку не закрываем; сквозь подсказку можно нажимать)
  const foot = p.querySelector('.panel-foot'),
    head = p.querySelector('.panel-head'),
    floor = foot && foot.offsetHeight ? top + foot.offsetTop : bottom - 10,
    ceil = top + (head ? head.offsetTop + head.offsetHeight : 0) + GAP;
  toastBox.style.top = Math.round(Math.max(ceil, floor - GAP - toastBox.offsetHeight)) + 'px';
}
/** Окно поменяло высоту (новый канал телевизора, другая вкладка) — подсказки переставить. */
const watched = new WeakSet();
let ro = null;
function watchPanel(p) {
  if (watched.has(p) || typeof ResizeObserver === 'undefined') return;
  watched.add(p);
  ro = ro || new ResizeObserver(() => placeToasts());
  ro.observe(p);
}
addEventListener('resize', placeToasts);
