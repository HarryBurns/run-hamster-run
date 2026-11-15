// СЕЗОНЫ УРОЖАЯ: в какие месяцы что растёт и поспевает — ОДНА таблица на всю игру.
//
// Отсюда берут сезон все, кому он нужен:
//   - растения в городе (locations/common/plants.js): плод есть только в свои месяцы;
//   - огород (features/garden.js): культуру сажают только в её сезон (что уже посажено — дорастает);
//   - продукты (data/food.js): поля months и seasons у продукта; у сезонного продукта цена в ТЦ «Вкусный» и на
//     рынке зависит от сезона (buyPrice, sellPrice), а вне сезона он бывает на прилавке не каждый день и понемногу
//     (foodRule — правило для «ассортимента дня», data/stock.js);
//   - задания (data/tasks.js): «Кокосовый день» приходит только когда кокосы есть на пальмах;
//   - расчёт баланса (dev/balance.js): сколько дают сбор и огород в каждом сезоне, нет ли выгодной перепродажи.
// Сезонную мебель, украшения и одежду (вторая половина Э1 в docs/BACKLOG.md) записывать в эту же таблицу.
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
  // южные фрукты: их только покупают
  pineapple: months('spring', 'summer'),
  kiwi: months('autumn', 'winter'),
  orange: months('winter', 'spring'),
  lemon: months('winter', 'spring'),
  peach: months('summer'),
  grapes: months('autumn'),
  melon: months('summer', 'autumn'),
  avocado: months('spring'),
  // огород: культуру сажают (и она поспевает) в свой сезон — в каждом сезоне есть что посадить
  lettuce: months('winter', 'spring'), // зимой — под парничком
  strawberry: months('spring', 'summer'),
  tomato: months('summer'),
  carrot: months('summer', 'autumn'),
  seeds: months('autumn'), // подсолнухи
  pumpkin: months('autumn'),
  // рыбалка — круглый год (зимой рыбу ловят в лунке)
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
/** Словами, когда сезон: «весной», «осенью и зимой»; icons — со значками сезонов: «осенью 🍂 и зимой ❄️»; '' — круглый год. */
export function whenRipe(id, icons = false) {
  return (seasonsOf(id) || []).map((s) => SEASONS[s].when + (icons ? ' ' + SEASONS[s].icon : '')).join(' и ');
}
