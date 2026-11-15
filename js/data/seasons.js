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
// Сезоны вещей (одежда, мебель, украшения) — в этом же файле, таблица WARE_MONTHS ниже.
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
  mushroom: months('autumn'), // грибы на опушке и в парке, а больше всего — в лесу
  // растёт в лесу (П.9; сколько и где — FOREST_GATHER в economy.js): летом — немного, осенью — много
  porcini: months('summer', 'autumn'), // белые грибы под ёлками
  nuts: months('autumn'), // лещина (орешки в ТЦ «Вкусный» не в сезон дороже и бывают не каждый день)
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

// Кроме урожая, в лесу (П.9) по сезонам живёт ещё кое-что — это не продукты, но сезон у них тот же календарный:
// пчёлы в улье дают мёд, на ёлках можно отломить веточку к Новому году. Ключ — «что», значение — месяцы.
export const WILD_MONTHS = {
  bees: months('summer', 'autumn'), // улей: летом и осенью — баночка мёда в день; весной пчёлы только проснулись
  firTwig: months('winter'), // еловые веточки под ёлками
};
/** Бывает ли это (ключ WILD_MONTHS) в этом месяце (0–11). */
export const wildIn = (id, month) => WILD_MONTHS[id].includes(month);

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
/** Сезоны, на которые приходятся месяцы m, по порядку: ['summer', 'autumn']. */
function seasonsIn(m) {
  const list = ORDER.filter((s) => m.some((q) => SEASON_OF_MONTH[q] === s));
  // начинаем с сезона, перед которым перерыв: «осенью и зимой», а не «зимой и осенью»
  const start = list.findIndex((s) => !list.includes(ORDER[(ORDER.indexOf(s) + 3) % 4]));
  return start > 0 ? [...list.slice(start), ...list.slice(0, start)] : list;
}
/** Сезоны словами: «весной», «осенью и зимой»; icons — со значками: «осенью 🍂 и зимой ❄️». */
const whenText = (list, icons) => list.map((s) => SEASONS[s].when + (icons ? ' ' + SEASONS[s].icon : '')).join(' и ');
/** В какие сезоны продукт поспевает: ['summer', 'autumn'] или null — круглый год. */
export function seasonsOf(id) {
  const m = harvestMonths(id);
  return m ? seasonsIn(m) : null;
}
/** Словами, когда сезон: «весной», «осенью и зимой»; icons — со значками сезонов: «осенью 🍂 и зимой ❄️»; '' — круглый год. */
export function whenRipe(id, icons = false) {
  return whenText(seasonsOf(id) || [], icons);
}

// СЕЗОНЫ ВЕЩЕЙ: одежда, мебель и украшения (вторая половина Э1). Вещь в своей таблице (data/clothes.js,
// data/furniture.js) называет «коллекцию» полем season: 'cold'; здесь — в какие месяцы у коллекции сезон.
// У вещи поля season нет — она продаётся круглый год. Что значит «в сезон» и «не в сезон» для прилавка и цены —
// data/wares.js (числа — WARES в economy.js).
/** Месяц праздника и по месяцу до и после: around(11) → [10, 11, 0]. */
const around = (month) => [(month + 11) % 12, month, (month + 1) % 12];
export const WARE_MONTHS = {
  cold: months('autumn', 'winter'), // тёплое: пуховики, шапки, шарфы, угги; камин, кресло-качалка с пледом
  hot: months('spring', 'summer'), // летнее: купальники, шорты, сандалии, панамки, тёмные очки; гамак, цветы, лейка
  rain: months('spring', 'autumn'), // от дождя: куртка-дождевик, резиновые сапожки
  spring: months('spring'), // весенние куртки, рассада
  autumn: months('autumn'), // осенние куртки
  // праздничное: месяц праздника и по месяцу до и после (сами праздники — отдельный этап, п. 13 плана)
  newyear: around(11), // Новый год — декабрь: гирлянда-огоньки, новогодний колпак
  halloween: around(9), // Хэллоуин — октябрь: шляпа волшебницы
};
/** Как сказать про праздничную коллекцию, когда у неё сезон (у остальных — по сезонам года). */
const WARE_WHEN = { newyear: 'к Новому году 🎄', halloween: 'к Хэллоуину 🎃' };

/**
 * Что с коллекцией вещей в этом месяце (0–11): 'new' — сезон только начался, 'in' — сезон, 'last' — последний
 * месяц сезона, 'off' — не сезон; null — у вещи сезона нет (season — имя коллекции или undefined).
 */
export function warePhase(season, month) {
  const m = WARE_MONTHS[season];
  if (!m || m.length >= 12) return null;
  if (!m.includes(month)) return 'off';
  if (!m.includes((month + 11) % 12)) return 'new';
  return m.includes((month + 1) % 12) ? 'in' : 'last';
}
/** Словами, когда у коллекции сезон: «осенью 🍂 и зимой ❄️», «к Новому году 🎄»; '' — круглый год. */
export function whenWare(season, icons = true) {
  const m = WARE_MONTHS[season];
  if (!m || m.length >= 12) return '';
  return WARE_WHEN[season] || whenText(seasonsIn(m), icons);
}
