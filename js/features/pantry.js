// Продукты сегодня: сколько стоят, есть ли на прилавке, где взять то, чего не хватает.
// Одно правило для ТЦ «Вкусный», рынка, окна готовки и писем (числа — SEASONAL и STOCK в data/economy.js):
//  - круглогодичное (мука, молоко, яйца…) есть в ТЦ всегда; «лакомства дня» (мёд) — не каждый день;
//  - сезонное в сезон — в ТЦ всегда, сколько угодно и дешевле обычного;
//  - сезонное вне сезона — дороже, по 1–3 штуки и не каждый день: в ТЦ через день, а в день, когда в ТЦ не
//    привезли, иногда выручает рынок (у торговца 1–2 штуки по той же цене). Бывает, что сегодня нет нигде.
import { addItem } from '../core/actions.js';
import { emit } from '../core/events.js';
import { cal } from '../core/state.js';
import {
  GATHER,
  FOREST_GATHER,
  SEASONS,
  STOCK,
  buyPrice,
  foodRule,
  inSeason,
  isSeasonal,
  monthOfDay,
  whenRipe,
} from '../data/index.js';
import { buy } from './purchase.js';
import { stockToday, takeStock, comeBack } from './stock.js';

const NEVER = { days: 0 }; // правило «здесь этого нет»
const mallRule = (ing) => (day) => foodRule(ing, monthOfDay(day));

/** Продукт в ТЦ «Вкусный» сегодня (см. stockToday в stock.js); у рыбы цены нет — её не продают. */
export const mallStock = (ing) => stockToday('food', ing.id, ing.price ? foodRule(ing, cal().month) : NEVER);
/** Продукт на рынке сегодня: сезонное вне сезона — и только в день, когда в ТЦ его не привезли. */
export function marketStock(ing) {
  const rare = isSeasonal(ing) && !inSeason(ing, cal().month) && mallStock(ing).state === 'none';
  return stockToday('market', ing.id, rare ? STOCK.offMarket : NEVER);
}
/** Когда у продукта сезон, со значками: «летом ☀️ и осенью 🍂». */
export const seasonText = (ing) => whenRipe(ing.id, true);
/** Через сколько дней продукт снова привезут в ТЦ: «завтра», «послезавтра»… */
export const mallBack = (ing) => comeBack('food', ing.id, mallRule(ing));

/**
 * Всё про продукт сегодня одной записью: season — 'in' | 'off' | null (круглый год), price — цена покупки,
 * mall и market — что на прилавках (stockToday), where — где его сегодня можно купить: 'mall' | 'market' | null.
 */
export function foodToday(ing) {
  const month = cal().month,
    mall = mallStock(ing),
    market = marketStock(ing);
  return {
    season: !isSeasonal(ing) ? null : inSeason(ing, month) ? 'in' : 'off',
    price: buyPrice(ing, month),
    mall,
    market,
    where: mall.state === 'ok' ? 'mall' : market.state === 'ok' ? 'market' : null,
  };
}
/** Купить n штук продукта: shop — 'food' (ТЦ) или 'market'. true — куплено. */
export function buyFood(ing, n = 1, shop = 'food') {
  const st = shop === 'market' ? marketStock(ing) : mallStock(ing);
  n = Math.min(n, st.left);
  if (n < 1 || !buy(buyPrice(ing, cal().month) * n)) return false;
  takeStock(st, n);
  addItem('ing', ing.id, n);
  emit('buy', { cat: 'food', id: ing.id, n });
  return true;
}
/** Почему продукта сегодня нет в ТЦ и когда будет — подпись для серой карточки. */
export function mallAwayText(ing) {
  const f = foodToday(ing),
    back = mallBack(ing),
    again = back ? `привезут ${back}` : 'загляни позже';
  const season = f.season === 'off' ? ` Сезон — ${seasonText(ing)}.` : '';
  if (f.mall.state === 'sold') return `Раскупили! Ещё ${again}.${season}`;
  if (f.where === 'market') return `Сегодня нет — спроси на рынке 🧺.${season}`;
  return `Сегодня нет — ${again}.${season}`;
}
/**
 * Где взять продукт, которого не хватает для блюда, — короткая подсказка для окна готовки и писем:
 * { ok: можно ли достать сегодня, text }.
 */
export function whereToGet(ing) {
  const f = foodToday(ing),
    c = cal();
  if (!ing.price) return { ok: true, text: 'поймай на рыбалке 🎣' };
  if (!f.season) {
    if (f.where) return { ok: true, text: 'есть в ТЦ «Вкусный»' };
    const back = mallBack(ing);
    return {
      ok: false,
      text: `сегодня в ТЦ нет${f.mall.state === 'sold' ? ' (раскупили)' : ''} — ${back ? 'привезут ' + back : 'загляни позже'}`,
    };
  }
  const own =
    ing.src === 'garden'
      ? 'вырасти на грядке'
      : GATHER[ing.id] && FOREST_GATHER[ing.id]
        ? 'собери в городе или в лесу'
        : GATHER[ing.id]
          ? 'собери в городе'
          : FOREST_GATHER[ing.id]
            ? 'собери в лесу'
            : '';
  if (f.season === 'in')
    return { ok: true, text: `сейчас сезон ${SEASONS[c.season].icon}: ${own ? own + ' или ' : ''}купи в ТЦ «Вкусный»` };
  const lead = `не сезон (сезон — ${seasonText(ing)})`;
  if (f.where === 'mall') return { ok: true, text: `${lead}: сегодня есть в ТЦ «Вкусный», но мало и дороже` };
  if (f.where === 'market') return { ok: true, text: `${lead}: сегодня есть на рынке, но мало и дороже` };
  const back = mallBack(ing);
  return { ok: false, text: `${lead}: сегодня нет в продаже — ${back ? 'в ТЦ привезут ' + back : 'загляни позже'}` };
}
