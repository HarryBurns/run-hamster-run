// СЕЗОНЫ УРОЖАЯ: в какие месяцы что растёт и поспевает — ОДНА таблица на всю игру.
//
// Отсюда берут сезон все, кому он нужен:
//   - растения в городе (locations/common/plants.js): плод есть только в свои месяцы;
//   - продукты (data/food.js): поля months и seasons у продукта; южные фрукты (south) ТЦ «Вкусный» продаёт
//     только в сезон, а вне сезона они есть на рынке и дороже (features/shops.js, features/market.js);
//   - задания (data/tasks.js): «Кокосовый день» приходит только когда кокосы есть на пальмах;
//   - расчёт баланса (dev/balance.js): сколько даёт сбор в каждом сезоне.
// Ассортимент магазинов «по сезону» (Э1 в docs/BACKLOG.md) делать по этой же таблице.
//
// Месяцы — числами: 0 — январь … 11 — декабрь (как cal().month). Сезон можно записать целиком — months('summer') —
// или по месяцам: [6, 7, 8]. Продукта в таблице нет — значит, он есть круглый год (мука, молоко, яйца…).
import { SEASON_OF_MONTH, SEASONS } from './calendar.js';

/** Все месяцы названных сезонов: months('winter', 'spring') → [0, 1, 2, 3, 4, 11]. */
const months = (...seasons) => SEASON_OF_MONTH.map((s, m) => (seasons.includes(s) ? m : -1)).filter((m) => m >= 0);
const ALL_YEAR = months('winter', 'spring', 'summer', 'autumn');

export const HARVEST_MONTHS = {
  // растёт в городе и на островах — в каждом сезоне есть что собрать (сколько с одного растения — GATHER в economy.js)
  coconut: months('winter'), // кокосовые пальмы
  banana: months('spring'), // банановые пальмы
  mango: months('summer'), // манговые деревья
  blueberry: months('summer'), // кусты черники
  mushroom: months('autumn'), // грибы на опушке и в парке
  // южные фрукты: в сезон — в ТЦ «Вкусный», вне сезона — только на рынке и дороже
  pineapple: months('spring', 'summer'),
  kiwi: months('autumn', 'winter'),
  orange: months('winter', 'spring'),
  lemon: months('winter', 'spring'),
  peach: months('summer'),
  grapes: months('autumn'),
  melon: months('summer', 'autumn'),
  avocado: months('spring'),
  // огород и рыбалка: пока круглый год (зимой грядки под парничком, рыбу ловят в лунке)
  carrot: ALL_YEAR,
  tomato: ALL_YEAR,
  strawberry: ALL_YEAR,
  seeds: ALL_YEAR,
  pumpkin: ALL_YEAR,
  fish: ALL_YEAR,
};

/** Месяцы сезона продукта (0–11) или null, если он есть круглый год. */
export function harvestMonths(id) {
  const m = HARVEST_MONTHS[id];
  return m && m.length < 12 ? m : null;
}
/** Сезон ли у продукта в этом месяце (0–11). У кого сезона нет — всегда. */
export function ripeIn(id, month) {
  const m = harvestMonths(id);
  return !m || m.includes(month);
}
const ORDER = Object.keys(SEASONS); // по кругу: зима → весна → лето → осень
/** В какие сезоны продукт поспевает: ['summer', 'autumn'] или null — круглый год. */
export function seasonsOf(id) {
  const m = harvestMonths(id);
  if (!m) return null;
  const list = ORDER.filter((s) => m.some((q) => SEASON_OF_MONTH[q] === s));
  // начинаем с сезона, перед которым перерыв: «осенью и зимой», а не «зимой и осенью»
  const start = list.findIndex((s) => !list.includes(ORDER[(ORDER.indexOf(s) + 3) % 4]));
  return start > 0 ? [...list.slice(start), ...list.slice(0, start)] : list;
}
/** Словами, когда сезон: «весной», «осенью и зимой»; '' — круглый год. */
export function whenRipe(id) {
  return (seasonsOf(id) || []).map((s) => SEASONS[s].when).join(' и ');
}
