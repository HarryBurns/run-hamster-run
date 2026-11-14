// Мини-игра «Стилист» (работа хозяйки в своём салоне красоты): гостья показывает картинку — какую причёску
// хочет. Выбери на полках причёску, её цвет и бантик, чтобы получилось как на картинке.
// Ход игры общий с «Баристой» и «Витриной» — orders.js; здесь только полки и рисунок.
import { pick } from '../core/util.js';
import { makeCanvas } from '../core/draw.js';
import { drawPortrait } from '../art/hamster.js';
import { BEAUTY, defaultLook } from '../data/index.js';
import { orderGame, ORDERS } from './orders.js';

const opt = (key, vs) => BEAUTY[key].options.filter((o) => vs.includes(o.v));
const TUFTS = opt('tuft', [1, 2, 3, 4]);
const HAIRS = opt('hair', ['#ff6b9d', '#845ef7', '#4dabf7', '#ffd43b']);
const BOWS = opt('bow', ['#ff5c8a', '#4dabf7', '#ffd43b', '#b197fc']);
const dot = (c) => () => {
  const s = document.createElement('span');
  s.className = 'dot';
  s.style.background = c;
  return s;
};
/** Значок причёски: белая мордочка с такой причёской. */
const tuftIcon = (v) => () => {
  const { canvas, ctx } = makeCanvas(40, 40);
  const base = defaultLook();
  drawPortrait(ctx, 20, 22, 40, {
    ...base,
    spots: null,
    outfit: {},
    beauty: { ...base.beauty, tuft: v, hair: '#a8703f' },
  });
  return canvas;
};

export default {
  id: 'stylist',
  title: 'Стилист',
  icon: '💇',
  howTo:
    'Гостья показывает картинку: какую <b>причёску</b>, какого <b>цвета</b> и с каким <b>бантиком</b> она хочет. Выбери всё это на полках, чтобы получилось точь-в-точь. Успей, пока у гостьи не кончилось терпение!',

  start(host) {
    const byKey = {};
    const shelf = (id, label, list, mk) => ({
      id,
      label,
      items: list.map((o) => {
        const it = { k: id + ':' + o.v, name: o.name, icon: mk(o), v: o.v };
        byKey[it.k] = { key: id, v: o.v };
        return it;
      }),
    });
    const shelves = [
      shelf('tuft', 'Причёска', TUFTS, (o) => tuftIcon(o.v)),
      shelf('hair', 'Цвет', HAIRS, (o) => dot(o.c)),
      shelf('bow', 'Бантик', BOWS, (o) => dot(o.c)),
    ];
    /** Внешность гостьи с выбранным: без шляпы (иначе причёску не видно), остальное — как у неё. */
    const styled = (guest, keys) => {
      const b = { ...guest.look.beauty, tuft: 0, hair: null, bow: null };
      for (const k of keys) b[byKey[k].key] = byKey[k].v;
      return { ...guest.look, outfit: { ...guest.look.outfit, head: null }, beauty: b };
    };
    return orderGame(host, {
      bg: 'linear-gradient(#ffe3ec 0,#ffe3ec 56%,#e5dbff 56%,#d0bfff 100%)',
      shelves,
      order: () => shelves.map((sh) => pick(sh.items).k),
      picture: {
        w: 120,
        h: 120,
        draw(ctx, w, h, keys, t, guest) {
          drawPortrait(ctx, w / 2, h / 2 + 4, w, styled(guest, keys), { time: t, blink: t % 3.3 < 0.13 });
        },
      },
      noun: 'Гостья',
      patience: 9,
      ask: ['«Сделай мне вот так!»', '«Хочу такую причёску!»', '«Как на этой картинке, пожалуйста!»'],
      serve: 'Выбери причёску, цвет и бантик!',
      wrong: 'Ой, на картинке по-другому!',
      doneAll: 'Все причёски — точь-в-точь как на картинках! В твой салон выстроится очередь!',
      doneSome: (n) => `Все ${ORDERS} гостей ушли красивыми! Быстро и без ошибок: ${n}.`,
    });
  },
};
