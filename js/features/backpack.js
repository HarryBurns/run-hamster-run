// Рюкзак: вкусняшки, продукты, семена, находки (не еда: для гербария Мяты — data/finds.js), кладовка.
// Компас в находках нажимается — стрелка к цели задания (features/compass.js).
// Продают лишнее на рынке — у прилавков на площади.
import { G } from '../core/state.js';
import { el } from '../core/util.js';
import { FURN_BY_ID, ING_BY_ID, SEED_BY_ID, FIND_BY_ID, ICON, PIECES } from '../data/index.js';
import { furnIcon } from '../ui/icons.js';
import { openPanel, message } from '../ui/panel.js';
import { sfx } from '../core/audio.js';
import { piecesFound, treasureMapImage } from './cove.js';
import { eat, dishGrid, ingGrid } from './cooking.js';
import { canPlantNow, sowHint } from './garden.js';
import { useCompass } from './compass.js';

const S = () => G.state;

/** Карта сокровищ Зефирки (С2): посмотреть, что уже сложилось из найденных кусочков. */
export function showTreasureMap() {
  const have = piecesFound(),
    all = have.length === PIECES.length;
  return message({
    title: 'Карта сокровищ',
    icon: '🗺️',
    cls: 'narrow',
    html: `<p class="center"><img class="treasure-map" src="${treasureMapImage(have)}" alt="Карта сокровищ" style="width:100%;max-width:340px;height:auto;border-radius:12px"></p><p class="center">${
      all
        ? 'Все три кусочка на месте: скалы на востоке моря, буёк-ракушка, подводный грот — и крестик на секретном пляже!'
        : `Кусочков: <b>${have.length} из ${PIECES.length}</b>. Где искать остальные — в журнале 📖`
    }</p>`,
    buttons: [{ text: 'Понятно' }],
  });
}

export function openBackpack() {
  openPanel({
    title: 'Рюкзак',
    icon: '🎒',
    tabs: [
      { id: 'dishes', name: '🍰 Вкусняшки' },
      { id: 'ing', name: '🥕 Продукты' },
      { id: 'seeds', name: '🌱 Семена' },
      { id: 'finds', name: '🌿 Находки' },
      { id: 'furn', name: '📦 Кладовка' },
    ],
    render(body, tab, panel) {
      if (tab === 'dishes') dishGrid(body, panel, eat);
      else if (tab === 'ing') ingGrid(body, panel);
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
          card.appendChild(
            el(
              'div',
              'note' + (canPlantNow(id) ? ' up' : ' off'),
              canPlantNow(id) ? 'пора сажать' : sowHint(sd).toLowerCase(),
            ),
          );
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(el('p', 'muted center', 'Сажай на грядках во дворе у дома — каждую культуру в свой сезон.'));
      } else if (tab === 'finds') {
        const ids = Object.keys(S().finds).filter((id) => FIND_BY_ID[id] && S().finds[id] > 0);
        const pieces = piecesFound(); // кусочки карты сокровищ — не находки из сумки, а шаги задания Зефирки
        if (!ids.length && !pieces.length) {
          body.appendChild(el('p', 'muted center', 'Находок пока нет. Их собирают для заданий из журнала 📜'));
          return;
        }
        const grid = el('div', 'grid small');
        if (pieces.length) {
          // карта сокровищ: одна карточка на все кусочки; нажать — посмотреть карту
          const card = el('div', 'card tap map-card');
          card.appendChild(el('div', 'e', ICON.map_piece));
          card.appendChild(el('div', '', 'Карта сокровищ'));
          card.appendChild(
            el('span', 'cnt', pieces.length === PIECES.length ? 'вся' : `${pieces.length} из ${PIECES.length}`),
          );
          card.appendChild(el('div', 'note up', 'посмотреть'));
          card.onclick = () => {
            sfx('paper');
            showTreasureMap();
          };
          grid.appendChild(card);
        }
        for (const id of ids) {
          const f = FIND_BY_ID[id];
          const card = el('div', id === 'compass' ? 'card tap compass-card' : 'card');
          card.appendChild(el('div', 'e', f.e));
          card.appendChild(el('div', '', f.name));
          card.appendChild(el('span', 'cnt', '×' + S().finds[id]));
          if (id === 'compass') {
            // компас Капитана Боба (О5): стрелка к цели задания
            card.appendChild(el('div', 'note up', 'куда идти?'));
            card.onclick = () => useCompass();
          }
          grid.appendChild(card);
        }
        body.appendChild(grid);
        body.appendChild(
          el(
            'p',
            'muted center',
            'Находки — не еда. Одни нужны для заданий из журнала 📖, из других жители делают украшения, а лишнее берёт рынок.',
          ),
        );
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
