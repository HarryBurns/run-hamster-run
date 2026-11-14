// Мини-игра «Витрина» (работа хозяйки в своём бутике): покупательница показывает эскиз — какой наряд хочет
// увидеть на витрине. Одень манекен: шляпка, наряд и туфельки, как на эскизе.
// Ход игры общий с «Баристой» и «Стилистом» — orders.js; здесь только полки и рисунок.
import { pick } from '../core/util.js';
import { drawHamster } from '../art/hamster.js';
import { CLOTHES_BY_ID, defaultLook } from '../data/index.js';
import { clothesIcon } from '../ui/icons.js';
import { orderGame, ORDERS } from './orders.js';

// Что лежит на полках бутика (id из data/clothes.js) и как это коротко назвать на кнопке.
const SHELVES = [
  [
    'head',
    'Шляпка',
    [
      ['crown', 'Корона'],
      ['tophat', 'Цилиндр'],
      ['beret_black', 'Берет'],
      ['sunhat', 'Шляпа'],
    ],
  ],
  [
    'body',
    'Наряд',
    [
      ['dress_evening', 'Вечернее'],
      ['dress_daisy', 'Ромашка'],
      ['princess_pink', 'Принцесса'],
      ['tuxedo', 'Смокинг'],
    ],
  ],
  [
    'feet',
    'Туфельки',
    [
      ['heels_red', 'Красные'],
      ['heels_black', 'Чёрные'],
      ['shoes_gold', 'Золотые'],
      ['sn_white', 'Кеды'],
    ],
  ],
];
const MANNEQUIN = { ...defaultLook(), fur: '#f3ede4', spots: null, ear: '#e6d5c3', beauty: { blush: null } };

export default {
  id: 'window',
  title: 'Витрина',
  icon: '🎀',
  howTo:
    'Покупательница показывает эскиз: какой наряд она хочет увидеть на витрине. Одень манекен — <b>шляпка</b>, <b>наряд</b> и <b>туфельки</b>, как на эскизе. Успей, пока у неё не кончилось терпение!',

  start(host) {
    const shelves = SHELVES.map(([slot, label, list]) => ({
      id: slot,
      label,
      items: list
        .filter(([id]) => CLOTHES_BY_ID[id])
        .map(([id, name]) => ({ k: id, name, icon: () => clothesIcon(CLOTHES_BY_ID[id], 40) })),
    }));
    const dressed = (keys) => {
      const outfit = {};
      for (const k of keys) outfit[CLOTHES_BY_ID[k].slot] = CLOTHES_BY_ID[k];
      return { ...MANNEQUIN, outfit };
    };
    return orderGame(host, {
      bg: 'linear-gradient(#f3f0ff 0,#f3f0ff 56%,#e5dbff 56%,#b197fc 100%)',
      shelves,
      order: () => shelves.map((sh) => pick(sh.items).k),
      picture: {
        w: 120,
        h: 132,
        draw(ctx, w, h, keys) {
          // манекен на подставке
          ctx.fillStyle = '#868e96';
          ctx.fillRect(w / 2 - 22, h - 9, 44, 5);
          drawHamster(ctx, w / 2, h - 12, 1.02, dressed(keys), { shadow: false });
        },
      },
      noun: 'Эскиз',
      trayCap: 'На витрине:',
      patience: 9,
      ask: ['«Хочу увидеть на витрине вот это!»', '«Одень манекен как на эскизе!»', '«А есть у вас такой наряд?»'],
      serve: 'Одень манекен как на эскизе!',
      wrong: 'Ой, на эскизе другое!',
      doneAll: 'Все витрины — точь-в-точь по эскизам! У бутика толпа покупателей!',
      doneSome: (n) => `Все ${ORDERS} витрин оформлены! Быстро и без ошибок: ${n}.`,
    });
  },
};
