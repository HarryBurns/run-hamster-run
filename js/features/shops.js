// Магазины: мебель и семена, продукты, кафе и рестораны. Банк — в bank.js, рынок — в market.js.
import { addItem } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, cal, count } from '../core/state.js';
import { el, plural } from '../core/util.js';
import {
  FURNITURE,
  FURN_CATS,
  HOLIDAY_BY_ID,
  festShelfOn,
  FIND_BY_ID,
  PRICES,
  INGREDIENTS,
  ING_BY_ID,
  SEEDS,
  DISHES,
  SEASONS,
  vendorLook,
  canSow,
  dishRule,
  whenRipe,
} from '../data/index.js';
import { furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';
import { bizByVendor, bizFoot, bizSign } from './business.js';
import { foodToday, buyFood, mallAwayText } from './pantry.js';
import { stockToday, takeStock, comeBack, leftText, awayCard } from './stock.js';
import { renderWheelsShop } from './wheels.js';
import { renderYardShop } from './yard.js';
import { wareToday, wareAwayCard, wareBadge, warePriceTag, wareOrder, wareNote } from './wares.js';

const S = () => G.state;

function ownedFurn(id) {
  const homes = [S().villa, ...Object.values(S().homes || {})];
  return (S().storage[id] || 0) + homes.flat().filter((i) => i.id === id).length;
}

/** Праздничная полка (этап 15, Пр13): около праздника — украшения к нему (shop: 'fest'). */
function renderFestShelf(body, panel, hid) {
  const h = HOLIDAY_BY_ID[hid],
    grid = el('div', 'grid fest-shelf');
  body.appendChild(
    el(
      'p',
      'muted',
      `${h.icon} Скоро ${h.name}! Украшения к празднику — только эти дни. Купленное ляжет в кладовку: дома нажми 🔨 и поставь, оно будет радовать круглый год.`,
    ),
  );
  for (const f of FURNITURE.filter((q) => q.shop === 'fest' && q.fest === hid)) {
    const card = el('div', 'card fest-' + f.id);
    card.appendChild(furnIcon(f, 112));
    card.appendChild(el('div', 'nm', f.name));
    card.appendChild(el('span', 'badge season r', `${h.icon} К празднику`));
    card.appendChild(priceTag(f.price));
    if (ownedFurn(f.id)) card.appendChild(el('span', 'cnt', '×' + ownedFurn(f.id)));
    card.appendChild(
      buyBtn('Купить', f.price, () => {
        if (!buy(f.price)) return;
        addItem('storage', f.id, 1);
        emit('buy', { cat: 'furniture', id: f.id });
        toast(`${f.name} — в кладовке. Дома нажми 🔨, чтобы поставить!`, 'good');
        panel.refresh();
      }),
    );
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

function openHomeMall() {
  const fest = festShelfOn(S().day, S().startDay || 0);
  openPanel({
    title: 'ТЦ «Уютный дом»',
    portrait: vendorLook('home'),
    money: true,
    cls: 'wide',
    tabs: [
      ...(fest ? [{ id: 'fest', name: `${HOLIDAY_BY_ID[fest].icon} К празднику` }] : []),
      ...FURN_CATS.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` })),
      { id: 'seeds', name: '🌱 Семена' },
      { id: 'tools', name: '🔦 Для походов' },
      { id: 'yard', name: '🌷 Для двора' },
      { id: 'wheels', name: '🛴 Колёса' },
    ],
    render(body, tab, panel) {
      // этап 17б: транспорт (features/wheels.js) и всё для двора (features/yard.js) — свои вкладки
      if (tab === 'wheels') return renderWheelsShop(body, panel);
      if (tab === 'yard') return renderYardShop(body, panel);
      if (tab === 'fest') return renderFestShelf(body, panel, fest);
      const grid = el('div', 'grid');
      if (tab === 'tools') {
        // инструменты (сумка finds, вид tool): есть всегда, нужен один — второй не продаём
        body.appendChild(
          el(
            'p',
            'muted',
            'Всё для походов и приключений. Фонарик пригодится там, где темно, — например, в пещерах под горой.',
          ),
        );
        for (const [id, price] of Object.entries(PRICES.tools)) {
          const f = FIND_BY_ID[id],
            have = count('finds', id);
          const card = el('div', 'card tool-' + id);
          card.appendChild(el('div', 'e', f.e));
          card.appendChild(el('div', 'nm', f.name));
          card.appendChild(priceTag(price));
          if (have) {
            card.appendChild(el('span', 'cnt', '✓'));
            card.appendChild(el('div', 'note', 'Уже в рюкзаке — он у тебя есть!'));
          } else
            card.appendChild(
              buyBtn('Купить', price, () => {
                if (!buy(price, f.name)) return;
                addItem('finds', id, 1);
                emit('buy', { cat: 'tool', id });
                sfx('coin');
                toast(`${f.e} ${f.name} — в рюкзаке!`, 'good');
                panel.refresh();
              }),
            );
          grid.appendChild(card);
        }
      } else if (tab === 'seeds') {
        // сначала то, что можно сажать прямо сейчас; остальное купить можно, но посадить — только в свой сезон
        const month = cal().month;
        for (const sd of [...SEEDS].sort((x, y) => canSow(y, month) - canSow(x, month))) {
          const ing = ING_BY_ID[sd.crop],
            now = canSow(sd, month);
          const card = el('div', 'card');
          card.appendChild(el('div', 'e', ing.e));
          card.appendChild(el('div', 'nm', sd.name));
          card.appendChild(el('div', 'muted', `растёт ${sd.days} ${plural(sd.days, 'день', 'дня', 'дней')}`));
          card.appendChild(
            now
              ? el('span', 'badge season r', 'Пора сажать!')
              : el('div', 'note off', `Сажают ${whenRipe(sd.crop, true)}`),
          );
          card.appendChild(priceTag(sd.price));
          if (count('seeds', sd.id)) card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
          card.appendChild(
            buyBtn(now ? 'Купить' : 'Купить впрок', sd.price, () => {
              if (buy(sd.price)) {
                addItem('seeds', sd.id, 1);
                emit('buy', { cat: 'seeds' });
                panel.refresh();
              }
            }),
          );
          grid.appendChild(card);
        }
        const c = cal();
        body.appendChild(
          el(
            'p',
            'muted',
            `Семена сажают на грядках во дворе у дома — каждую культуру в свой сезон. Сейчас ${c.seasonName.toLowerCase()} ${c.seasonIcon}: можно сажать ${SEEDS.filter(
              (q) => canSow(q, month),
            )
              .map((q) => ING_BY_ID[q.crop].e + ' ' + q.sow.toLowerCase())
              .join(', ')}. Урожай можно съесть, приготовить или продать на рынке.`,
          ),
        );
      } else {
        // витрина дня (features/wares.js): сначала сезонное, потом сегодняшний привоз; чего сегодня нет — в конце, серым
        const list = FURNITURE.filter((q) => q.cat === tab && q.shop === 'home').sort(
          (a, b) => wareOrder(a) - wareOrder(b),
        );
        const note = wareNote(list);
        if (note) body.appendChild(note);
        for (const f of list) {
          const w = wareToday(f);
          if (!w.here) {
            grid.appendChild(wareAwayCard(f, furnIcon(f, 112), ownedFurn(f.id)));
            continue;
          }
          const card = el('div', 'card'),
            badge = wareBadge(f, 'r');
          card.appendChild(furnIcon(f, 112));
          card.appendChild(el('div', 'nm', f.name));
          if (badge) card.appendChild(badge);
          card.appendChild(warePriceTag(f));
          if (ownedFurn(f.id)) card.appendChild(el('span', 'cnt', '×' + ownedFurn(f.id)));
          card.appendChild(
            buyBtn('Купить', w.price, () => {
              if (!buy(w.price)) return;
              addItem('storage', f.id, 1);
              emit('buy', { cat: 'furniture', id: f.id });
              toast(`${f.name} — в кладовке. Дома нажми 🔨, чтобы поставить!`, 'good');
              panel.refresh();
            }),
          );
          grid.appendChild(card);
        }
      }
      body.appendChild(grid);
    },
  });
}

/** Карточка продукта в ТЦ «Вкусный»: цена на сегодня, значок сезона, сколько осталось; нет в продаже — серая. */
function foodCard(ing, panel) {
  const f = foodToday(ing),
    have = count('ing', ing.id);
  if (f.mall.state !== 'ok') return awayCard(ing.e, ing.name, mallAwayText(ing), have);
  const card = el('div', 'card');
  card.appendChild(el('div', 'e', ing.e));
  card.appendChild(el('div', 'nm', ing.name));
  card.appendChild(priceTag(f.price));
  if (f.season === 'in') card.appendChild(el('span', 'badge season r', 'Сезон!'));
  if (f.season === 'off') card.appendChild(el('span', 'badge off', 'Не сезон'));
  if (ing.treat) card.appendChild(el('span', 'badge treat', 'Сегодня!'));
  if (f.mall.limited) card.appendChild(el('div', 'note', leftText(f.mall)));
  if (have) card.appendChild(el('span', 'cnt', '×' + have));
  const row = el('div', 'row');
  for (const n of f.mall.limited ? [1] : [1, 5]) {
    row.appendChild(
      buyBtn(
        '+' + n,
        f.price * n,
        () => {
          if (buyFood(ing, n, 'food')) panel.refresh();
        },
        n === 1 ? 'green' : 'blue',
      ),
    );
  }
  card.appendChild(row);
  return card;
}

function openFoodMall() {
  openPanel({
    title: 'ТЦ «Вкусный»',
    portrait: vendorLook('food'),
    money: true,
    cls: 'wide',
    render(body, tab, panel) {
      const c = cal(),
        sea = SEASONS[c.season];
      body.appendChild(
        el(
          'p',
          'muted',
          `Всё, что растёт, — сезонное. В свой сезон его много и оно дешевле (а что-то можно вырастить на грядке или собрать в городе бесплатно). Не в сезон — дороже, по паре штук и не каждый день. Рыбку поймай сама, а лишнее продай на рынке у фонтана.`,
        ),
      );
      const all = INGREDIENTS.filter((i) => i.price > 0).map((ing) => ({ ing, f: foodToday(ing) }));
      const section = (title, list) => {
        if (!list.length) return;
        body.appendChild(el('h4', 'sect', title));
        const grid = el('div', 'grid');
        for (const { ing } of list) grid.appendChild(foodCard(ing, panel));
        body.appendChild(grid);
      };
      const here = (q) => q.f.mall.state === 'ok';
      section(
        `${sea.icon} Сезон: ${sea.name.toLowerCase()} — много и дешевле`,
        all.filter((q) => q.f.season === 'in'),
      );
      section(
        '🛒 Всегда на полке',
        all.filter((q) => !q.f.season).sort((x, y) => here(y) - here(x)),
      );
      section(
        '📦 Не сезон — мало, дороже и не каждый день',
        all.filter((q) => q.f.season === 'off').sort((x, y) => here(y) - here(x)),
      );
    },
  });
}

function openCafe(kind, title) {
  const biz = bizByVendor(kind); // кафе и ресторан можно купить: внизу окна — «Купить заведение» или «Моё заведение»
  openPanel({
    title,
    portrait: vendorLook(kind),
    money: true,
    // в ресторане работа — в диалоге у двери («Помочь на кухне»), в кафе — кнопка здесь
    foot: biz ? () => bizFoot(biz, { work: kind !== 'rest' }) : null,
    render(body, tab, panel) {
      const sign = bizSign(biz);
      if (sign) body.appendChild(sign);
      const grid = el('div', 'grid');
      for (const d of DISHES.filter((q) => q.cafe === kind)) {
        // «лакомства дня» бывают не каждый день и понемногу (ассортимент дня — stock.js)
        const st = stockToday('cafe', d.id, dishRule(d));
        if (st.state !== 'ok') {
          const back = comeBack('cafe', d.id, () => dishRule(d));
          grid.appendChild(
            awayCard(
              d.e,
              d.name,
              st.state === 'sold' ? `Раскупили! Ещё приготовят ${back}.` : `Сегодня нет — загляни ${back}.`,
              count('dishes', d.id),
            ),
          );
          continue;
        }
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', d.e));
        card.appendChild(el('div', 'nm', d.name));
        card.appendChild(priceTag(d.price));
        if (st.limited) {
          card.appendChild(el('span', 'badge treat', 'Сегодня!'));
          card.appendChild(el('div', 'note', leftText(st)));
        }
        if (count('dishes', d.id)) card.appendChild(el('span', 'cnt', '×' + count('dishes', d.id)));
        const b = buyBtn('Купить', d.price, () => {
          if (buy(d.price, d.name)) {
            takeStock(st);
            addItem('dishes', d.id, 1);
            emit('buy', { cat: 'dish', id: d.id });
            panel.refresh();
          }
        });
        const b2 = buyBtn(
          'Съесть тут',
          d.price,
          () => {
            if (buy(d.price)) {
              takeStock(st);
              sfx('eat');
              toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
              emit('buy', { cat: 'dish', id: d.id });
              emit('eat', { id: d.id });
              panel.refresh();
            }
          },
          'yellow',
        );
        card.append(b, b2);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

register('home-mall', () => openHomeMall(), 'ТЦ «Уютный дом»: мебель, семена и «Для походов» (фонарик)');

register('food-mall', () => openFoodMall(), 'ТЦ «Вкусный»: продукты');

register(
  'cafe',
  (p, ctx) => openCafe(p.kind, p.title || (ctx.building && ctx.building.name) || 'Кафе'),
  'кафе: { kind, title? }',
);
