// Рынок: продать урожай, улов, находки и домашние блюда; купить редкости, которых нет в ТЦ.
//
// Своего здания у рынка пока нет (город перестраивают): действие 'market' зовут кнопка «Продать на рынке»
// в ТЦ «Вкусный» и кнопка «Продать» в рюкзаке. Когда на площади появится прилавок, ему достаточно
// написать act: 'market' (или { do: 'market', tab: 'buy' }).
//
// Правила (числа — в data/economy.js, раздел MARKET):
//  - цена продукта на рынке — поле sell (data/food.js): своё (урожай, рыба, кокос) стоит дорого, купленное
//    в магазине — дешевле, чем в магазине; блюдо — по продуктам, из которых оно приготовлено;
//  - у торговца на день ограниченный кошелёк: когда монеты кончились — приходи завтра.
import { addItem, addClothes, award, earn, sellPearls, setDayFlag, wear } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes } from '../core/state.js';
import { el, fmtMoney, seeded } from '../core/util.js';
import { INGREDIENTS, DISHES, CLOTHES, FURNITURE, MARKET, VENDORS, vendorLook, inSeason } from '../data/index.js';
import { clothesIcon, furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';

const S = () => G.state;

/** Сколько монет осталось сегодня в кошельке торговца. */
export const purseLeft = () => Math.max(0, MARKET.purse - (S().dayFlags.marketPaid || 0));

/** Сколько жемчужин лежит в рюкзаке: найдено минус продано. */
export const pearlsLeft = () => Math.max(0, (S().pearls || 0) - (S().pearlsSold || 0));

/**
 * Что у игрока есть на продажу: [{ bag, id, e, name, n, sell, group }].
 * group: own — своё (урожай, улов, находки: всё, у чего есть цена в MARKET.sell), dish — домашние блюда,
 *        shop — купленное в магазине.
 */
export function sellable() {
  const s = S(),
    out = [];
  for (const i of INGREDIENTS) {
    const n = s.ing[i.id] || 0;
    if (n > 0 && i.sell > 0)
      out.push({
        bag: 'ing',
        id: i.id,
        e: i.e,
        name: i.name,
        n,
        sell: i.sell,
        group: MARKET.sell[i.id] ? 'own' : 'shop',
      });
  }
  if (pearlsLeft() > 0)
    out.push({
      bag: 'pearl',
      id: 'pearl',
      e: '⚪',
      name: 'Жемчужина',
      n: pearlsLeft(),
      sell: MARKET.sell.pearl,
      group: 'own',
    });
  for (const d of DISHES) {
    const n = s.dishes[d.id] || 0;
    if (n > 0 && d.sell > 0)
      out.push({ bag: 'dishes', id: d.id, e: d.e, name: d.name, n, sell: d.sell, group: 'dish' });
  }
  return out;
}

/** Сколько штук товара торговец может купить прямо сейчас (хватит ли у него монет). */
const canTake = (g, n = g.n) => Math.min(n, g.n, Math.floor(purseLeft() / g.sell));

/** Продать n штук. Возвращает, сколько продано на самом деле (кошелёк торговца не бесконечный). */
export function sellGoods(g, n) {
  n = canTake(g, n);
  if (n <= 0) {
    toast('У торговца на сегодня кончились монеты. Приходи завтра! 🌙');
    return 0;
  }
  if (g.bag === 'pearl') sellPearls(n);
  else addItem(g.bag, g.id, -n);
  const sum = n * g.sell;
  earn(sum, 'market');
  setDayFlag('marketPaid', (S().dayFlags.marketPaid || 0) + sum);
  sfx('coin');
  toast(`Продано: ${g.e} ${g.name}${n > 1 ? ' ×' + n : ''} — +${fmtMoney(sum)} 🪙`, 'good');
  award('x_market', { delay: 900 });
  emit('sell', { id: g.id, n, sum });
  return n;
}

// ---------- редкости ----------
/** Вещицы, которые торговец привёз сегодня: каждый день другие (но один и тот же день — одни и те же). */
function trinketsToday() {
  const pool = [
    ...CLOTHES.filter((c) => c.shop === 'market').map((def) => ({ kind: 'clothes', def })),
    ...FURNITURE.filter((f) => f.shop === 'market').map((def) => ({ kind: 'furn', def })),
  ];
  const r = seeded(7919 * (S().day + 3));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, MARKET.trinkets);
}
/** Южные фрукты, которых сейчас нет в ТЦ «Вкусный» (не сезон): на рынке они есть всегда, но дороже. */
const rareFruits = () => INGREDIENTS.filter((i) => i.src === 'shop' && !inSeason(i, cal().season));

function renderSell(body, panel) {
  const left = purseLeft();
  const purse = el(
    'div',
    'purse' + (left ? '' : ' empty'),
    `<div>👛 У торговца сегодня с собой: <b>🪙 ${fmtMoney(left)}</b> из ${fmtMoney(MARKET.purse)}</div>
     <div class="bar"><i style="width:${Math.round((left / MARKET.purse) * 100)}%"></i></div>`,
  );
  body.appendChild(purse);
  const goods = sellable();
  if (!goods.length) {
    body.appendChild(
      el(
        'p',
        'muted center',
        'Продавать пока нечего. Вырасти урожай на грядках, поймай рыбку, стряси кокос с пальмы, найди жемчужину на дне или приготовь что-нибудь вкусное — и приходи!',
      ),
    );
    return;
  }
  if (!left)
    body.appendChild(el('p', 'center', '«Ох, все монеты на сегодня раздал! Приходи завтра — принесу полный кошелёк».'));
  for (const [group, title] of [
    ['own', '🥕 Урожай, улов и находки'],
    ['dish', '🍰 Домашние блюда'],
    ['shop', '🛒 Продукты из магазина <span class="muted">— за них дают меньше, чем они стоили</span>'],
  ]) {
    const list = goods.filter((g) => g.group === group);
    if (!list.length) continue;
    body.appendChild(el('h4', 'sect', title));
    const grid = el('div', 'grid');
    for (const g of list) {
      const card = el('div', 'card');
      card.appendChild(el('div', 'e', g.e));
      card.appendChild(el('div', 'nm', g.name));
      card.appendChild(el('span', 'cnt', '×' + g.n));
      card.appendChild(el('div', 'pr', `🪙 ${fmtMoney(g.sell)} <span class="per">за штуку</span>`));
      const one = el('button', 'btn small green', `Продать 1<br><b>+${fmtMoney(g.sell)}</b>`);
      one.disabled = canTake(g, 1) < 1;
      one.onclick = () => {
        sellGoods(g, 1);
        panel.refresh();
      };
      card.appendChild(one);
      if (g.n > 1) {
        const k = canTake(g); // на всё может не хватить кошелька торговца
        const all = el(
          'button',
          'btn small yellow',
          `${k === g.n ? 'Продать все' : 'Продать'} ${k || g.n}<br><b>+${fmtMoney((k || g.n) * g.sell)}</b>`,
        );
        all.disabled = k < 1;
        all.onclick = () => {
          sellGoods(g, k);
          panel.refresh();
        };
        card.appendChild(all);
      }
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }
}

function renderBuy(body, panel) {
  body.appendChild(
    el(
      'p',
      'muted',
      'Здесь то, чего нет в магазинах: фрукты не по сезону и вещицы ручной работы. Вещицы каждый день новые!',
    ),
  );
  body.appendChild(el('h4', 'sect', '🎁 Сегодня привезли'));
  let grid = el('div', 'grid');
  for (const { kind, def } of trinketsToday()) {
    const card = el('div', 'card');
    card.appendChild(kind === 'clothes' ? clothesIcon(def, 84) : furnIcon(def, 96));
    card.appendChild(el('div', 'nm', def.name));
    if (kind === 'clothes' && hasClothes(def.id)) {
      card.appendChild(el('span', 'badge', 'Есть ✓'));
      card.appendChild(el('div', 'muted', 'В шкафу'));
    } else {
      card.appendChild(priceTag(def.price));
      if (kind === 'furn' && S().storage[def.id]) card.appendChild(el('span', 'cnt', '×' + S().storage[def.id]));
      card.appendChild(
        buyBtn('Купить', def.price, () => {
          if (!buy(def.price, kind === 'clothes' ? def.name : null)) return;
          if (kind === 'clothes') {
            addClothes(def.id);
            wear(def.slot, def.id);
            emit('buy', { cat: 'clothes', id: def.id });
          } else {
            addItem('storage', def.id, 1);
            emit('buy', { cat: 'furniture', id: def.id });
            toast(`${def.name} — в кладовке. Дома нажми 🔨, чтобы поставить!`, 'good');
          }
          panel.refresh();
        }),
      );
    }
    grid.appendChild(card);
  }
  body.appendChild(grid);
  const fruits = rareFruits();
  if (fruits.length) {
    body.appendChild(el('h4', 'sect', '🥭 Фрукты не по сезону'));
    grid = el('div', 'grid');
    for (const ing of fruits) {
      const card = el('div', 'card');
      card.appendChild(el('div', 'e', ing.e));
      card.appendChild(el('div', 'nm', ing.name));
      card.appendChild(priceTag(ing.rare));
      if (S().ing[ing.id]) card.appendChild(el('span', 'cnt', '×' + S().ing[ing.id]));
      card.appendChild(
        buyBtn('Купить', ing.rare, () => {
          if (!buy(ing.rare)) return;
          addItem('ing', ing.id, 1);
          emit('buy', { cat: 'food' });
          panel.refresh();
        }),
      );
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }
}

/** Окно рынка. tab: 'sell' (по умолчанию) или 'buy'. */
export function openMarket(tab = 'sell') {
  return openPanel({
    title: 'Рынок',
    portrait: vendorLook('market'),
    money: true,
    cls: 'wide',
    tab: tab === 'buy' ? 'buy' : 'sell',
    tabs: [
      { id: 'sell', name: '💰 Продать' },
      { id: 'buy', name: '🧺 Купить редкости' },
    ],
    render(body, t, panel) {
      if (t === 'sell') renderSell(body, panel);
      else renderBuy(body, panel);
    },
  });
}

register('market', (p) => openMarket(p.tab || p.arg), `рынок: market, market:buy или { tab } — ${VENDORS.market.name}`);
