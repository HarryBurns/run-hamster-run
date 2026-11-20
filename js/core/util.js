// Мелкие помощники: математика, случайные числа, текст, DOM. Рисование — в draw.js.
import { gx } from './gender.js';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const irnd = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Детерминированный генератор случайных чисел (для карты и ежедневных событий).
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- текст / DOM ----------
export function fmtMoney(n) {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100,
    b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
/** Экранировать строку, которую набрал игрок (имя), перед вставкой в HTML. */
export function esc(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
/**
 * Сколько секунд показывать текст, чтобы его успел прочитать ребёнок 8–10 лет, который читает медленно: 2,5 с —
 * заметить и перевести взгляд, плюс 0,09 с на знак (≈ 11 знаков в секунду — 80–90 слов в минуту, медленное чтение
 * во 2–3 классе), не меньше min и не больше max (дольше 12 с текст уже мешает — его можно придержать). Эмодзи не читают.
 * Две строки подсказки (~90 знаков) — около 10,5 с, «Привет!» — min.
 */
export function readSec(text, min = 3.5, max = 12) {
  const n = String(text == null ? '' : text)
    .replace(/<[^>]*>/g, '')
    .replace(/\p{Extended_Pictographic}|[\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim().length;
  return clamp(2.5 + 0.09 * n, min, max);
}
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = gx(html); // «{он|она}» — под пол героя (core/gender.js)
  return e;
}
