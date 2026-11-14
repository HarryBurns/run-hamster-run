// Магазины: мебель и семена, продукты, кафе и рестораны. Банк — в bank.js, рынок — в market.js.
import { addItem } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { register, run } from '../core/registry.js';
import { G, cal, count } from '../core/state.js';
import { el, plural } from '../core/util.js';
import {
  FURNITURE,
  FURN_CATS,
  INGREDIENTS,
  ING_BY_ID,
  SEEDS,
  DISHES,
  SEASONS,
  vendorLook,
  inSeason,
} from '../data/index.js';
import { furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { buy, priceTag, buyBtn } from './purchase.js';

const S = () => G.state;
const WHEN = { winter: 'зимой', spring: 'весной', summer: 'летом', autumn: 'осенью' };

function ownedFurn(id) {
  const homes = [S().villa, ...Object.values(S().homes || {})];
  return (S().storage[id] || 0) + homes.flat().filter((i) => i.id === id).length;
}

function openHomeMall() {
  openPanel({
    title: 'ТЦ «Уютный дом»',
    portrait: vendorLook('home'),
    money: true,
    cls: 'wide',
    tabs: [...FURN_CATS.map((c) => ({ id: c.id, name: `${c.icon} ${c.name}` })), { id: 'seeds', name: '🌱 Семена' }],
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      if (tab === 'seeds') {
        for (const sd of SEEDS) {
          const ing = ING_BY_ID[sd.crop];
          const card = el('div', 'card');
          card.appendChild(el('div', 'e', ing.e));
          card.appendChild(el('div', 'nm', sd.name));
          card.appendChild(el('div', 'muted', `растёт ${sd.days} ${plural(sd.days, 'день', 'дня', 'дней')}`));
          card.appendChild(priceTag(sd.price));
          if (count('seeds', sd.id)) card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
          card.appendChild(
            buyBtn('Купить', sd.price, () => {
              if (buy(sd.price)) {
                addItem('seeds', sd.id, 1);
                emit('buy', { cat: 'seeds' });
                panel.refresh();
              }
            }),
          );
          grid.appendChild(card);
        }
        body.appendChild(
          el(
            'p',
            'muted',
            'Семена сажают на грядках во дворе виллы. Урожай можно съесть, приготовить или продать на рынке.',
          ),
        );
      } else {
        for (const f of FURNITURE.filter((q) => q.cat === tab && q.shop === 'home')) {
          const card = el('div', 'card');
          card.appendChild(furnIcon(f, 112));
          card.appendChild(el('div', 'nm', f.name));
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
      }
      body.appendChild(grid);
    },
  });
}

function openFoodMall() {
  openPanel({
    title: 'ТЦ «Вкусный»',
    portrait: vendorLook('food'),
    money: true,
    cls: 'wide',
    // рынок пока без своего прилавка в городе: вход к торговцу — отсюда (и из рюкзака)
    foot: [
      {
        text: '💰 Продать на рынке',
        cls: 'yellow',
        fn: (panel) => {
          panel.close();
          run('market');
        },
      },
    ],
    render(body, tab, panel) {
      body.appendChild(
        el(
          'p',
          'muted',
          'Морковку, клубнику, помидоры, тыкву и семечки вырасти на грядках, рыбку поймай сама. А кокосы можно стрясти с любой пальмы — бесплатно! Лишнее можно продать — кнопка «Продать на рынке» внизу.',
        ),
      );
      const sea = cal().season;
      const shop = INGREDIENTS.filter((i) => i.src === 'shop');
      const grid = el('div', 'grid');
      for (const ing of shop.filter((i) => inSeason(i, sea))) {
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', ing.name));
        card.appendChild(priceTag(ing.price));
        if (ing.seasons) card.appendChild(el('span', 'badge season', 'Сезон!'));
        if (count('ing', ing.id)) card.appendChild(el('span', 'cnt', '×' + count('ing', ing.id)));
        const row = el('div', 'row');
        for (const n of [1, 5]) {
          row.appendChild(
            buyBtn(
              '+' + n,
              ing.price * n,
              () => {
                if (buy(ing.price * n)) {
                  addItem('ing', ing.id, n);
                  emit('buy', { cat: 'food' });
                  panel.refresh();
                }
              },
              n === 1 ? 'green' : 'blue',
            ),
          );
        }
        card.appendChild(row);
        grid.appendChild(card);
      }
      // южные фрукты не в сезон: в ТЦ их нет, но видно, когда привезут и где взять сейчас
      for (const ing of shop.filter((i) => !inSeason(i, sea))) {
        const card = el('div', 'card away');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', ing.name));
        const when = ing.seasons.map((q) => SEASONS[q].icon + ' ' + WHEN[q]).join(' и ');
        card.appendChild(el('div', 'muted', `Не сезон: привезут ${when}. А сейчас есть на рынке.`));
        if (count('ing', ing.id)) card.appendChild(el('span', 'cnt', '×' + count('ing', ing.id)));
        grid.appendChild(card);
      }
      body.appendChild(grid);
    },
  });
}

function openCafe(kind, title) {
  openPanel({
    title,
    portrait: vendorLook(kind),
    money: true,
    render(body, tab, panel) {
      const grid = el('div', 'grid');
      for (const d of DISHES.filter((q) => q.cafe === kind)) {
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', d.e));
        card.appendChild(el('div', 'nm', d.name));
        card.appendChild(priceTag(d.price));
        if (count('dishes', d.id)) card.appendChild(el('span', 'cnt', '×' + count('dishes', d.id)));
        const b = buyBtn('Купить', d.price, () => {
          if (buy(d.price, d.name)) {
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
              sfx('eat');
              toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
              emit('buy', { cat: 'dish', id: d.id });
              emit('eat');
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

register('home-mall', () => openHomeMall(), 'ТЦ «Уютный дом»: мебель и семена');

register('food-mall', () => openFoodMall(), 'ТЦ «Вкусный»: продукты');

register('cafe', (p, ctx) => openCafe(p.kind, p.title || ctx.building.name), 'кафе: { kind, title? }');
