// Магазины: мебель и семена, продукты, кафе и рестораны, банк.
import { addItem } from '../core/actions.js';
import { sfx } from '../core/audio.js';
import { makeCanvas, ell, fillRR, star } from '../core/draw.js';
import { emit } from '../core/events.js';
import { register } from '../core/registry.js';
import { G, count } from '../core/state.js';
import { el, fmtMoney, plural } from '../core/util.js';
import { FURNITURE, FURN_CATS, INGREDIENTS, ING_BY_ID, SEEDS, DISHES, vendorLook } from '../data/index.js';
import { furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { toast } from '../ui/toast.js';
import { price, buy } from './purchase.js';

const S = () => G.state;

function ownedFurn(id) {
  return (S().storage[id] || 0) + S().villa.filter((i) => i.id === id).length;
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
          card.appendChild(el('div', 'pr', price(sd.price)));
          if (count('seeds', sd.id)) card.appendChild(el('span', 'cnt', '×' + count('seeds', sd.id)));
          const b = el('button', 'btn small green', 'Купить');
          b.onclick = () => {
            if (buy(sd.price)) {
              addItem('seeds', sd.id, 1);
              emit('buy', { cat: 'seeds' });
              panel.refresh();
            }
          };
          card.appendChild(b);
          grid.appendChild(card);
        }
        body.appendChild(el('p', 'muted', 'Семена сажают на грядках во дворе виллы.'));
      } else {
        for (const f of FURNITURE.filter((q) => q.cat === tab && q.shop === 'home')) {
          const card = el('div', 'card');
          card.appendChild(furnIcon(f, 112));
          card.appendChild(el('div', 'nm', f.name));
          card.appendChild(el('div', 'pr', price(f.price)));
          if (ownedFurn(f.id)) card.appendChild(el('span', 'cnt', '×' + ownedFurn(f.id)));
          const b = el('button', 'btn small green', 'Купить');
          b.onclick = () => {
            if (!buy(f.price)) return;
            addItem('storage', f.id, 1);
            emit('buy', { cat: 'furniture', id: f.id });
            toast(`${f.name} — в кладовке. Дома нажми 🔨, чтобы поставить!`, 'good');
            panel.refresh();
          };
          card.appendChild(b);
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
    render(body, tab, panel) {
      body.appendChild(
        el(
          'p',
          'muted',
          'Морковку, клубнику, помидоры, тыкву и семечки вырасти на грядках, рыбку поймай сама. А кокосы можно стрясти с любой пальмы — бесплатно!',
        ),
      );
      const grid = el('div', 'grid');
      for (const ing of INGREDIENTS.filter((i) => i.src === 'shop')) {
        const card = el('div', 'card');
        card.appendChild(el('div', 'e', ing.e));
        card.appendChild(el('div', 'nm', ing.name));
        card.appendChild(el('div', 'pr', price(ing.price)));
        if (count('ing', ing.id)) card.appendChild(el('span', 'cnt', '×' + count('ing', ing.id)));
        const row = el('div', 'row');
        for (const n of [1, 5]) {
          const b = el('button', 'btn small ' + (n === 1 ? 'green' : 'blue'), '+' + n);
          b.onclick = () => {
            if (buy(ing.price * n)) {
              addItem('ing', ing.id, n);
              emit('buy', { cat: 'food' });
              panel.refresh();
            }
          };
          row.appendChild(b);
        }
        card.appendChild(row);
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
        card.appendChild(el('div', 'pr', price(d.price)));
        if (count('dishes', d.id)) card.appendChild(el('span', 'cnt', '×' + count('dishes', d.id)));
        const b = el('button', 'btn small green', 'Купить');
        b.onclick = () => {
          if (buy(d.price, d.name)) {
            addItem('dishes', d.id, 1);
            emit('buy', { cat: 'dish', id: d.id });
            panel.refresh();
          }
        };
        const b2 = el('button', 'btn small yellow', 'Съесть тут');
        b2.onclick = () => {
          if (buy(d.price)) {
            sfx('eat');
            toast(`Ням-ням! ${d.e} ${d.name}`, 'good');
            emit('buy', { cat: 'dish', id: d.id });
            emit('eat');
            panel.refresh();
          }
        };
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

register('bank', () => openBank(), 'Хомяк-Банк');

function openBank() {
  openPanel({
    title: 'Хомяк-Банк',
    portrait: vendorLook('bank'),
    cls: 'narrow',
    render(body) {
      const { canvas, ctx } = makeCanvas(300, 170);
      canvas.style.cssText += ';display:block;margin:0 auto';
      fillRR(ctx, 10, 10, 280, 150, 18, '#868e96', '#4a3728', 3);
      fillRR(ctx, 24, 24, 252, 122, 10, '#495057');
      for (let r = 0; r < 5; r++)
        for (let i = 0; i < 9 - r; i++) {
          const x = 52 + i * 24 + r * 12,
            y = 130 - r * 16;
          ell(ctx, x, y, 13, 6, '#ffd43b', '#e0a800', 2);
        }
      star(ctx, 150, 46, 14, '#ffd43b', '#e0a800', 2);
      body.appendChild(canvas);
      body.appendChild(
        el('p', 'center', `В хранилище лежит:<br><b style="font-size:24px">🪙 ${fmtMoney(S().money)}</b>`),
      );
      body.appendChild(
        el(
          'p',
          'center muted',
          `Потрачено за всё время: ${fmtMoney(S().spent)} монет.<br>Банкир Монеткин говорит: «Хватит ещё на миллион лет!»`,
        ),
      );
    },
  });
}
