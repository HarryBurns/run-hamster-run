// Рюкзак: вкусняшки, продукты, семена, кладовка; отсюда же можно продать лишнее на рынке.
import { run } from '../core/registry.js';
import { G } from '../core/state.js';
import { el } from '../core/util.js';
import { FURN_BY_ID, ING_BY_ID, SEED_BY_ID } from '../data/index.js';
import { furnIcon } from '../ui/icons.js';
import { openPanel } from '../ui/panel.js';
import { eat, dishGrid, ingGrid } from './cooking.js';

const S = () => G.state;

export function openBackpack() {
  openPanel({
    title: 'Рюкзак',
    icon: '🎒',
    tabs: [
      { id: 'dishes', name: '🍰 Вкусняшки' },
      { id: 'ing', name: '🥕 Продукты' },
      { id: 'seeds', name: '🌱 Семена' },
      { id: 'furn', name: '📦 Кладовка' },
    ],
    // рынок пока без своего прилавка в городе: продать можно прямо отсюда
    foot: [
      {
        text: '💰 Продать',
        cls: 'yellow',
        fn: (panel) => {
          panel.close();
          run('market');
        },
      },
    ],
    render(body, tab, panel) {
      if (tab === 'dishes') dishGrid(body, panel, eat);
      else if (tab === 'ing') ingGrid(body);
      else if (tab === 'seeds') {
        const ids = Object.keys(S().seeds);
        if (!ids.length) {
          body.appendChild(el('p', 'muted center', 'Семян нет. Они продаются в ТЦ «Уютный дом».'));
          return;
        }
        const grid = el('div', 'grid small');
        for (const id of ids) {
          const sd = SEED_BY_ID[id];
          const card = el('div', 'card');
          card.appendChild(el('div', 'e', ING_BY_ID[sd.crop].e));
          card.appendChild(el('div', '', sd.name));
          card.appendChild(el('span', 'cnt', '×' + S().seeds[id]));
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'muted center', 'Сажай на грядках во дворе виллы.'));
      } else {
        const ids = Object.keys(S().storage);
        if (!ids.length) {
          body.appendChild(el('p', 'muted center', 'Кладовка пуста. Мебель продаётся в ТЦ «Уютный дом».'));
          return;
        }
        const grid = el('div', 'grid small');
        for (const id of ids) {
          const f = FURN_BY_ID[id];
          if (!f) continue;
          const card = el('div', 'card');
          card.appendChild(furnIcon(f, 70));
          card.appendChild(el('div', '', f.name));
          card.appendChild(el('span', 'cnt', '×' + S().storage[id]));
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'muted center', 'Чтобы поставить мебель, нажми 🔨 у себя дома.'));
      }
    },
  });
}
