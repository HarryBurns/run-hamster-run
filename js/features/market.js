// Рынок: продать урожай, улов, находки и домашние блюда; купить редкости, которых нет в ТЦ.
//
// Рынок стоит на площади с фонтаном (здание 'market' в locations/town.js, act: 'market') — продают только там.
// Другому прилавку достаточно написать act: 'market' (или { do: 'market', tab: 'buy' }).
//
// Правила (числа — в data/economy.js, разделы MARKET, SEASONAL и STOCK):
//  - торговец платит за продукт заметно меньше, чем тот сейчас стоит в магазине (sellPrice в data/food.js): перепродажа
//    никогда не выгодна; своё сезонное (урожай, собранное) в сезон идёт дешевле, вне сезона — в полтора раза дороже;
//    улов, жемчуг, самоцветы из пещер (CAVES.gems) окаменелости из пустыни (DESERT.fossils) перья попугаев из джунглей (JUNGLE.feathers) редкие ракушки с секретного пляжа (COVE.shells.sell) и находки удалённого острова (ISLAND) — по своей цене; блюдо — по продуктам, из которых оно приготовлено;
//  - у торговца на день ограниченный кошелёк: когда монеты кончились — приходи завтра;
//  - «Купить редкости»: вещицы ручной работы и то, чего сегодня нет в ТЦ «Вкусный», — овощи и фрукты не по сезону
//    (по 1–2 штуки и не каждый день; правило — features/pantry.js).
import { addItem, addClothes, award, earn, sellPearls, setDayFlag, wear } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, hasClothes } from '../core/state.js';
import { el, fmtMoney } from '../core/util.js';
import {
  INGREDIENTS,
  DISHES,
  MARKET,
  CAVES,
  DESERT,
  JUNGLE,
  COVE,
  ISLAND,
  FIND_BY_ID,
  VENDORS,
  vendorLook,
  isSeasonal,
  inSeason,
  sellPrice,
  isSunHat,
} from '../data/index.js';
import { clothesIcon, furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';
import { foodToday, buyFood, seasonText } from './pantry.js';
import { leftText } from './stock.js';
import { trinketsToday, wareToday, wareBadge, warePriceTag } from './wares.js';

const S = () => G.state;

/** Сколько монет осталось сегодня в кошельке торговца. */
export const purseLeft = () => Math.max(0, MARKET.purse - (S().dayFlags.marketPaid || 0));

/** Сколько жемчужин лежит в рюкзаке: найдено минус продано. */
export const pearlsLeft = () => Math.max(0, (S().pearls || 0) - (S().pearlsSold || 0));

/**
 * Что у игрока есть на продажу: [{ bag, id, e, name, n, sell, group, season }].
 * group: own — урожай, улов и находки (всё, что растёт, ловится и находится), dish — домашние блюда,
 *        shop — остальные продукты из магазина. season — 'in' | 'off' у сезонного продукта (цена от него зависит).
 */
export function sellable() {
  const s = S(),
    month = cal().month,
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
        sell: sellPrice(i, month),
        group: isSeasonal(i) || MARKET.sell[i.id] ? 'own' : 'shop',
        season: !isSeasonal(i) ? null : inSeason(i, month) ? 'in' : 'off',
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
  // самоцветы из пещер (находки вида gem; цены — CAVES.gems): добывают в мини-игре «Кристаллы», их мало в день
  // окаменелости из пустыни (находки вида fossil; цены — DESERT.fossils): выкапывают в «Раскопках», их мало в день
  // перья попугаев из джунглей (находки вида feather; цены — JUNGLE.feathers): по перу от каждого попугая в день
  // ракушки с секретного пляжа (находки вида shell; цены — COVE.shells.sell): море выносит 1–2 в день
  // находки с удалённого острова (вулканическое стекло — ISLAND.obsidian, цветы для леи — ISLAND.flowers): по одной в день
  for (const [id, sell] of [
    ...Object.entries(CAVES.gems),
    ...Object.entries(DESERT.fossils),
    ...Object.entries(JUNGLE.feathers),
    ...Object.entries(COVE.shells.sell),
    ['obsidian', ISLAND.obsidian],
    ...Object.entries(ISLAND.flowers),
  ]) {
    const n = s.finds[id] || 0;
    if (n > 0) out.push({ bag: 'finds', id, e: FIND_BY_ID[id].e, name: FIND_BY_ID[id].name, n, sell, group: 'own' });
  }
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
// Вещицы ручной работы: торговец привозит по нескольку штук в день, каждый день другие — trinketsToday()
// из features/wares.js (общий «ассортимент дня»; сезонные вещицы не в сезон приезжают реже).
/** Не по сезону: чего сегодня нет в ТЦ «Вкусный», а торговец привёз (и что у него уже раскупили). */
export const rareFood = () =>
  INGREDIENTS.map((ing) => ({ ing, f: foodToday(ing) })).filter((q) => q.f.market.state !== 'none');

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
        'Продавать пока нечего. Вырасти урожай на грядках, поймай рыбку, собери кокосы, ягоды или грибы, найди жемчужину на дне или приготовь что-нибудь вкусное — и приходи!',
      ),
    );
    return;
  }
  if (!left)
    body.appendChild(el('p', 'center', '«Ох, все монеты на сегодня раздал! Приходи завтра — принесу полный кошелёк».'));
  for (const [group, title] of [
    ['own', '🥕 Урожай, улов и находки <span class="muted">— не в сезон за них дают больше</span>'],
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
      if (g.season)
        card.appendChild(
          el(
            'div',
            'note ' + (g.season === 'off' ? 'up' : 'off'),
            g.season === 'in' ? 'сезон: дешевле' : 'не сезон: дороже ↑',
          ),
        );
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
      'Здесь то, чего нет в магазинах: вещицы ручной работы и немного овощей и фруктов не по сезону — то, чего сегодня не привезли в ТЦ «Вкусный». Каждый день всё новое!',
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
      // сезонная вещица: значок «Сезон!» / «Не сезон», в конце сезона — скидка (правило то же, что в магазинах)
      const cost = wareToday(def).price,
        badge = wareBadge(def, 'r');
      if (badge) card.appendChild(badge);
      card.appendChild(warePriceTag(def));
      if (kind === 'furn' && S().storage[def.id]) card.appendChild(el('span', 'cnt', '×' + S().storage[def.id]));
      card.appendChild(
        buyBtn('Купить', cost, () => {
          if (!buy(cost, kind === 'clothes' ? def.name : null)) return;
          if (kind === 'clothes') {
            addClothes(def.id);
            wear(def.slot, def.id);
            emit('buy', { cat: 'clothes', id: def.id, sun: isSunHat(def) });
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
  body.appendChild(el('h4', 'sect', '🥭 Не по сезону <span class="muted">— мало и дороже</span>'));
  const rare = rareFood();
  if (!rare.length) {
    body.appendChild(
      el('p', 'muted', '«Сегодня не по сезону ничего не привёз. Загляни завтра — или спроси в ТЦ «Вкусный»!»'),
    );
    return;
  }
  grid = el('div', 'grid');
  for (const { ing, f } of rare) {
    const card = el('div', 'card' + (f.market.state === 'ok' ? '' : ' away'));
    card.appendChild(el('div', 'e', ing.e));
    card.appendChild(el('div', 'nm', ing.name));
    if (S().ing[ing.id]) card.appendChild(el('span', 'cnt', '×' + S().ing[ing.id]));
    if (f.market.state === 'ok') {
      card.appendChild(priceTag(f.price));
      card.appendChild(el('div', 'note', leftText(f.market)));
      card.appendChild(
        buyBtn('Купить', f.price, () => {
          if (buyFood(ing, 1, 'market')) panel.refresh();
        }),
      );
    } else card.appendChild(el('div', 'muted', `Раскупили! Сезон — ${seasonText(ing)}.`));
    grid.appendChild(card);
  }
  body.appendChild(grid);
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
