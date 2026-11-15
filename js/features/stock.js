// АССОРТИМЕНТ ДНЯ — общий механизм для всех магазинов: товар бывает на прилавке не каждый день и понемногу.
//
// Как пользоваться (образец — продукты: features/pantry.js, окна — shops.js и market.js):
//   const st = stockToday('food', 'mango', rule);    // rule — правило из таблиц (data/stock.js, STOCK в economy.js)
//   st.state: 'ok' — есть (st.left — сколько осталось, Infinity — сколько угодно),
//             'none' — сегодня не привезли, 'sold' — привезли, но уже раскупили;
//   купили — takeStock(st, n): купленное сегодня запоминается в отметках дня (dayFlags.bought) и утром забывается;
//   нет в продаже — карточку не прячем: awayCard(…) рисует её серой, с подписью, почему нет и когда будет
//   (comeBack(…) — «завтра», «послезавтра», «через 3 дня»).
// Сколько привезли — чистый расчёт от номера дня и ключа 'магазин:товар' (data/stock.js): перезагрузка страницы
// ассортимент не меняет. Магазину одежды или мебели достаточно своего правила и своего имени магазина.
import { setDayFlag } from '../core/actions.js';
import { G } from '../core/state.js';
import { el, plural } from '../core/util.js';
import { stockOn, nextStockIn } from '../data/index.js';

const S = () => G.state;
const boughtToday = (key) => (S().dayFlags.bought || {})[key] || 0;

/**
 * Что с товаром сегодня: { key, limited, total, left, state }.
 * shop — имя магазина, id — товар, rule — правило ассортимента (null — есть всегда и сколько угодно).
 */
export function stockToday(shop, id, rule) {
  const key = shop + ':' + id,
    total = stockOn(S().day, key, rule),
    left = Math.max(0, total - boughtToday(key));
  return { key, limited: total !== Infinity, total, left, state: total <= 0 ? 'none' : left <= 0 ? 'sold' : 'ok' };
}
/** Купили n штук товара: запомнить до утра (для товара без ограничений ничего не пишется). */
export function takeStock(st, n = 1) {
  if (st.limited) setDayFlag(st.key, boughtToday(st.key) + n, 'bought');
}
/**
 * Когда товар снова будет на прилавке: «завтра», «послезавтра», «через 3 дня»; '' — в ближайшие дни не будет.
 * ruleOn(day) — правило товара в тот день (со сменой сезона оно меняется).
 */
export function comeBack(shop, id, ruleOn) {
  const n = nextStockIn(S().day, shop + ':' + id, ruleOn);
  return !n ? '' : n === 1 ? 'завтра' : n === 2 ? 'послезавтра' : `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
}
/** Строчка для карточки товара, которого сегодня мало: «Осталось 2 шт.» ('' — товара сколько угодно). */
export const leftText = (st) => (st.limited && st.left > 0 ? `Осталось ${st.left} шт.` : '');
/**
 * Серая карточка товара, которого сегодня нет: значок (текст-эмодзи или готовый элемент), название и подпись,
 * почему нет и когда будет. have — сколько такого уже есть у игрока (покажется «×N»).
 */
export function awayCard(icon, name, text, have = 0) {
  const card = el('div', 'card away');
  if (typeof icon === 'string') card.appendChild(el('div', 'e', icon));
  else card.appendChild(icon);
  card.appendChild(el('div', 'nm', name));
  card.appendChild(el('div', 'muted', text));
  if (have) card.appendChild(el('span', 'cnt', '×' + have));
  return card;
}
