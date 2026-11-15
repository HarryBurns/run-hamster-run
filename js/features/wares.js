// Вещи сегодня: одежда, мебель и украшения — что на прилавке, сколько стоит, какой значок на карточке.
// Одно правило для ТЦ «Модный», бутика, пляжного магазинчика, ТЦ «Уютный дом» и рынка (data/wares.js, числа —
// WARES в data/economy.js):
//  - базовые вещи есть всегда; часть обычных вещей — «привоз»: два дня из трёх, самое дорогое — через день;
//  - сезонная вещь в сезон есть всегда («Сезон!»), в первый месяц сезона она «Новинка!», в последний — распродажа;
//  - сезонная вещь не в сезон — «Не сезон»: по обычной цене, но бывает один день из трёх;
//  - вещи, которой сегодня нет, — серая карточка: «Сегодня нет — привезут завтра. Сезон — зимой ❄️».
// Что уже куплено, от прилавка не зависит: носить и ставить можно в любой сезон.
import { G, cal } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import {
  WARES,
  monthOfDay,
  shopWares,
  trinketsOn,
  wareOn,
  warePrice,
  wareRule,
  wareSeason,
  wareWhen,
} from '../data/index.js';
import { priceTag } from './purchase.js';
import { stockToday, comeBack, awayCard } from './stock.js';

const S = () => G.state;

/** Вещицы ручной работы, которые торговец привёз на рынок сегодня: [{ kind: 'clothes' | 'furn', def }]. */
export const trinketsToday = () => trinketsOn(S().day);

/**
 * Всё про вещь сегодня одной записью:
 *   season — 'new' | 'in' | 'last' | 'off' или null (круглый год); price — цена сегодня, sale — идёт ли распродажа;
 *   here — есть ли на прилавке своего магазина; fresh — её привезли именно сегодня (бывает не каждый день).
 */
export function wareToday(it) {
  const month = cal().month,
    rule = wareRule(it, month);
  // рынок: торговец привозит несколько вещиц из тех, что сегодня «в привозе»; магазины — каждая вещь по своему правилу
  const here =
    it.shop === 'market'
      ? trinketsToday().some((q) => q.def === it)
      : stockToday(it.shop, it.id, rule).state === 'ok';
  const price = warePrice(it, month);
  return { season: wareSeason(it, month), price, sale: price < it.price, here, fresh: here && !!rule };
}
/** Когда вещь снова привезут: «завтра», «послезавтра», «через 3 дня»; '' — в ближайшие дни не будет. */
export const wareBack = (it) => comeBack(it.shop, it.id, (day) => wareRule(it, monthOfDay(day)));
/** Подпись для серой карточки: почему вещи сегодня нет и когда будет. */
export function wareAwayText(it) {
  const back = wareBack(it),
    off = wareSeason(it, cal().month) === 'off';
  return `Сегодня нет — ${back ? 'привезут ' + back : 'загляни позже'}.${off ? ` Сезон — ${wareWhen(it)}.` : ''}`;
}
/** Серая карточка вещи, которой сегодня нет: icon — готовый значок (clothesIcon, furnIcon), have — сколько уже есть. */
export const wareAwayCard = (it, icon, have = 0) => awayCard(icon, it.name, wareAwayText(it), have);

/**
 * Значок на карточку вещи: «Новинка!», «Сезон!», «Скидка −30 %», «Не сезон», «Сегодня!» (привоз); null — базовая вещь.
 * side: 'l' — в левом углу карточки (в правом — «Есть ✓»), 'r' — в правом (в левом — «×2»).
 */
export function wareBadge(it, side = 'r') {
  const w = wareToday(it),
    pos = ' ' + side;
  if (w.season === 'new') return el('span', 'badge season' + pos, 'Новинка!');
  if (w.season === 'last') return el('span', 'badge sale' + pos, `Скидка −${Math.round((1 - WARES.sale) * 100)} %`);
  if (w.season === 'in') return el('span', 'badge season' + pos, 'Сезон!');
  if (w.season === 'off') return el('span', 'badge off' + pos, 'Не сезон');
  return w.fresh ? el('span', 'badge treat' + pos, 'Сегодня!') : null;
}
/** Ценник вещи на сегодня; на распродаже рядом — зачёркнутая обычная цена. */
export function warePriceTag(it) {
  const w = wareToday(it),
    tag = priceTag(w.price);
  if (w.sale) tag.insertBefore(el('s', 'was', fmtMoney(it.price)), tag.querySelector('.lack'));
  return tag;
}
/** Порядок карточек на витрине: сначала сезонное, потом сегодняшний привоз, потом базовое; чего нет — в конце. */
export function wareOrder(it) {
  const w = wareToday(it);
  return !w.here ? 3 : w.season && w.season !== 'off' ? 0 : w.fresh ? 1 : 2;
}

const names = (list, max = 3) =>
  list
    .slice(0, max)
    .map((it) => `<b>${it.name}</b>`)
    .join(', ') + (list.length > max ? ` и ещё ${list.length - max}` : '');
/**
 * Строка-пояснение над витриной: что привезли сегодня и что привезут завтра (items — вещи этого отдела, которые
 * стоит показывать: без тех, что у игрока уже есть). null — в отделе всё как всегда.
 */
export function wareNote(items) {
  const day = S().day,
    today = items.filter((it) => wareToday(it).fresh),
    soon = items.filter((it) => !wareToday(it).here && wareOn(it, day + 1));
  if (!today.length && !soon.length) return null;
  const parts = [];
  if (today.length) parts.push(`Сегодня привезли: ${names(today)}.`);
  if (soon.length) parts.push(`Завтра привезут: ${names(soon)}.`);
  return el('p', 'muted ware-note', '🚚 ' + parts.join(' '));
}

/** Вещи магазина, которые сегодня можно купить (для писем и проверок): [{ kind, def }]. */
export const waresHere = (shop) => shopWares(shop).filter((q) => wareToday(q.def).here);
