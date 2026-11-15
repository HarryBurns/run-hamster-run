// АССОРТИМЕНТ ДНЯ: товар бывает на прилавке не каждый день и понемногу — ОБЩИЙ расчёт для всех магазинов.
//
// Здесь только чистый расчёт «сколько штук привезли в такой-то день» — от номера дня и ключа товара, без жребия
// «на лету»: перезагрузка страницы ничего не меняет, а автотест и dev/balance.js считают то же самое.
// Сколько из привезённого уже куплено сегодня и подписи для карточек — features/stock.js.
//
// Правило (rule):
//   null / undefined                       товар есть всегда и сколько угодно;
//   { days, of, min, max }                 в каждом отрезке из of дней товар привозят в days из них (в какие
//                                          именно — у каждого товара свои), и в такой день его от min до max штук;
//   { days, of }                           бывает не каждый день, но когда есть — сколько угодно;
//   { days: 0 }                            товара здесь нет совсем (удобно, когда правило зависит от дня).
// Второй способ — «каждый день привозят n товаров из списка» (вещицы на рынке): pickOn(день, магазин, список, n).
// Ключ — 'магазин:товар' ('food:mango', 'market:mango', 'cafe:choco_cake'): у одного товара в разных магазинах
// дни разные. Сами правила — числа баланса, они лежат в data/economy.js (STOCK); какое правило у какого товара —
// решает таблица товара (у продуктов — foodRule в data/food.js, у одежды и мебели — wareRule в data/wares.js).

/** Число 0…1 — одно и то же для одной пары «число, ключ». */
function roll(n, key) {
  let h = (2166136261 ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Сколько штук товара привезли в день day: 0 — сегодня его нет, Infinity — сколько угодно. */
export function stockOn(day, key, rule) {
  if (!rule) return Infinity;
  const of = Math.max(1, rule.of || 1),
    days = rule.days === undefined ? of : Math.min(of, rule.days);
  if (days < of) {
    // отрезок из of дней: дни отрезка выстраиваются по жребию, товар привозят в первые days из них
    const block = Math.floor(day / of),
      mine = roll(block, key + '#' + (day % of));
    let before = 0;
    for (let i = 0; i < of; i++) if (i !== day % of && roll(block, key + '#' + i) < mine) before++;
    if (before >= days) return 0;
  }
  if (!rule.max) return Infinity;
  const min = rule.min || 1;
  return min + Math.floor(roll(day, key + '#n') * (rule.max - min + 1));
}

/**
 * Через сколько дней товар снова будет на прилавке: 1 — завтра, 2 — послезавтра… 0 — в ближайшие limit дней не будет.
 * ruleOn(day) — правило товара в тот день (оно может меняться: наступит сезон — и товар будет всегда).
 */
export function nextStockIn(day, key, ruleOn, limit = 12) {
  for (let i = 1; i <= limit; i++) if (stockOn(day + i, key, ruleOn(day + i)) > 0) return i;
  return 0;
}

/**
 * «Сегодня привезли n товаров из списка»: какие именно — у каждого дня свои (жребий по дню и ключу товара), но один
 * и тот же день — одни и те же. ids — товары, которые сегодня вообще могут приехать; вернёт не больше n из них.
 */
export function pickOn(day, shop, ids, n) {
  return ids
    .map((id) => ({ id, r: roll(day, shop + ':' + id + '#pick') }))
    .sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : 1))
    .slice(0, n)
    .map((q) => q.id);
}
