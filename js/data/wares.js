// ВЕЩИ НА ПРИЛАВКЕ: одежда, мебель и украшения — сезон, цена и «ассортимент дня» (вторая половина Э1).
//
// Что написано у вещи в её таблице (data/clothes.js, data/furniture.js):
//   season — коллекция из таблицы сезонов вещей (WARE_MONTHS в data/seasons.js): 'cold', 'hot', 'rain', 'spring',
//            'autumn', 'newyear', 'halloween'. Поля нет — вещь продаётся круглый год;
//   stock  — «привоз» для круглогодичной вещи: 'delivery' — бывает два дня из трёх, 'special' (самое дорогое и
//            редкое) — через день. Поля нет — базовая вещь, она на прилавке всегда.
// Правило одно для всех магазинов (числа — WARES в data/economy.js):
//   - сезонная вещь в сезон — на прилавке всегда, по обычной цене; в первый месяц сезона она «новинка», в последний —
//     распродажа (цена × WARES.sale);
//   - сезонная вещь не в сезон — по обычной цене, но бывает один день из трёх;
//   - круглогодичная вещь — всегда или по своему «привозу» (stock).
// Вещи покупают по одной, поэтому «мало штук» здесь нет: вещь сегодня либо есть, либо её не привезли. Что куплено —
// носится и ставится в любой сезон: правило касается только прилавка. Продать вещь нельзя, так что на распродаже
// не заработать (dev/balance.js это проверяет).
// Есть ли вещь на прилавке сегодня — stockOn из data/stock.js с ключом 'магазин:вещь'; окна берут готовое
// из features/wares.js.
import { monthOfDay } from './calendar.js';
import { CLOTHES } from './clothes.js';
import { MARKET, WARES } from './economy.js';
import { FURNITURE } from './furniture.js';
import { warePhase, whenWare } from './seasons.js';
import { stockOn, nextStockIn, pickOn } from './stock.js';

const round10 = (n) => Math.max(10, Math.round(n / 10) * 10);

/** Сезон вещи в этом месяце (0–11): 'new' — только начался, 'in', 'last' — последний месяц, 'off'; null — круглый год. */
export const wareSeason = (it, month) => warePhase(it.season, month);
/** Когда у вещи сезон, словами со значками: «осенью 🍂 и зимой ❄️», «к Новому году 🎄»; '' — круглый год. */
export const wareWhen = (it) => whenWare(it.season);
/** Сколько вещь стоит в этом месяце: в последний месяц сезона — распродажа, в остальное время — обычная цена. */
export const warePrice = (it, month) =>
  wareSeason(it, month) === 'last' ? round10(it.price * WARES.sale) : it.price;
/** Правило «ассортимента дня» для вещи в этом месяце (data/stock.js): null — на прилавке всегда. */
export function wareRule(it, month) {
  const phase = wareSeason(it, month);
  if (phase === 'off') return WARES.off;
  if (phase) return null;
  return (it.stock && WARES[it.stock]) || null;
}
/** Ключ вещи для «ассортимента дня»: 'магазин:вещь'. */
export const wareKey = (it) => it.shop + ':' + it.id;
/** Привезли ли вещь в её магазин в день day (чистый расчёт: для окон, писем, автотеста и dev/balance.js). */
export const wareOn = (it, day) => stockOn(day, wareKey(it), wareRule(it, monthOfDay(day))) > 0;
/** Через сколько дней вещь снова привезут: 1 — завтра… 0 — в ближайшие дни не будет. */
export const wareBackIn = (it, day) => nextStockIn(day, wareKey(it), (d) => wareRule(it, monthOfDay(d)));

/** Все вещи, которые продаёт магазин: 'mall' | 'boutique' | 'beach' — одежда, 'home' — мебель, 'market' — вещицы. */
export const shopWares = (shop) => [
  ...CLOTHES.filter((c) => c.shop === shop).map((def) => ({ kind: 'clothes', def })),
  ...FURNITURE.filter((f) => f.shop === shop).map((def) => ({ kind: 'furn', def })),
];
/**
 * Вещицы ручной работы, которые торговец привёз на рынок в день day: MARKET.trinkets штук, каждый день другие.
 * Сезонная вещица не в сезон приезжает только в «свой» день (правило то же, что в магазинах) — зато в этот день
 * торговец берёт её обязательно; остальные места — жребий среди вещиц, которые сейчас в сезоне или круглый год.
 */
export function trinketsOn(day) {
  const all = shopWares('market'),
    month = monthOfDay(day),
    can = all.filter((q) => wareOn(q.def, day)).map((q) => q.def),
    rare = can.filter((d) => wareRule(d, month)).map((d) => d.id),
    usual = can.filter((d) => !wareRule(d, month)).map((d) => d.id);
  const ids = [...rare, ...pickOn(day, 'market', usual, Math.max(0, MARKET.trinkets - rare.length))].slice(
    0,
    MARKET.trinkets,
  );
  return ids.map((id) => all.find((q) => q.def.id === id));
}
